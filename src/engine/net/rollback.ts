// src/engine/net/rollback.ts
// Rollback netcode: snapshot / restore / resimulate.
//
// Architecture:
//   - Pre-allocates ROLLBACK_BUFFER_SIZE snapshot slots (Uint8Array pool, no GC
//     in the hot path).
//   - Each physics frame: caller saves a snapshot with saveSnapshot(), records
//     its local and predicted-opponent inputs with recordFrameInputs(), then runs
//     the simulation normally.
//   - When an opponent InputPacket arrives: onOpponentInput() compares the real
//     input with the stored prediction.  If they differ it restores the snapshot
//     from just before the divergent frame and calls the supplied `resimulate`
//     callback for every frame from the divergent point to the current frame.
//   - Every 60 frames the caller should also call computeChecksum() and include
//     the result in its outgoing InputPacket.  On receipt of a checksum, compare
//     with computeChecksum(); a mismatch triggers requestResync().

import type { EntityId } from '../ecs/entity.js';
import type { PackedInputState } from '../input/keyboard.js';
import type { FighterState } from '../ecs/component.js';
import {
  transformComponents,
  physicsComponents,
  fighterComponents,
} from '../ecs/component.js';
import {
  hitlagMap,
  shieldBreakMap,
  dodgeFramesMap,
  grabFramesMap,
  techWindowMap,
  airDodgeUsedSet,
  ledgeHangFramesMap,
} from '../physics/stateMachine.js';
import { hitRegistry } from '../physics/collision.js';
import { getRngState, setRngState } from '../physics/lcg.js';
import { matchState } from '../../game/state.js';
import { crc32 } from '../physics/crc32.js';
import { respawnTimers } from '../physics/blastZone.js';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Number of frames the circular snapshot buffer retains. */
export const ROLLBACK_BUFFER_SIZE = 8;

/** Maximum number of fighter entities supported. */
const MAX_FIGHTERS = 4;

// ── FighterState index table ──────────────────────────────────────────────────

const FIGHTER_STATES: readonly FighterState[] = [
  'idle', 'walk', 'run', 'jump', 'doubleJump', 'attack', 'hitstun',
  'shielding', 'rolling', 'spotDodge', 'airDodge', 'grabbing', 'ledgeHang', 'KO',
];

const FIGHTER_STATE_TO_IDX = new Map<FighterState, number>(
  FIGHTER_STATES.map((s, i) => [s, i]),
);

// ── Snapshot binary layout ────────────────────────────────────────────────────
//
// Global header (8 bytes):
//   [0]  frame     Uint32LE
//   [4]  rngState  Uint32LE
//
// Per-entity block (PER_ENTITY_BYTES each, sorted ascending by EntityId):
//   Transform:
//     [+0]  x                Int32LE
//     [+4]  y                Int32LE
//     [+8]  prevX            Int32LE
//     [+12] prevY            Int32LE
//     [+16] facingRight      Uint8  (0|1)
//   Physics:
//     [+17] vx               Int32LE
//     [+21] vy               Int32LE
//     [+25] gravityMultiplier Int32LE
//     [+29] grounded         Uint8  (0|1)
//     [+30] fastFalling      Uint8  (0|1)
//   Fighter:
//     [+31] stateIdx         Uint8  (index into FIGHTER_STATES)
//     [+32] damagePercent    Int32LE
//     [+36] stocks           Uint8
//     [+37] jumpCount        Uint8
//     [+38] hitstunFrames    Uint16LE
//     [+40] invincibleFrames Uint16LE
//     [+42] hitlagFrames     Uint16LE
//     [+44] shieldHealth     Uint16LE  (stored as round(shieldHealth*10), 0–1000)
//     [+46] shieldBreakFrames Uint16LE
//     [+48] attackFrame      Uint16LE
//     [+50] moveIdIdx        Uint8  (0=null, 1=index+1 in sorted moveIds)
//   Timer maps:
//     [+51] hitlag           Uint16LE
//     [+53] shieldBreakMap   Uint16LE
//     [+55] dodge            Uint16LE
//     [+57] grab             Uint16LE
//     [+59] tech             Uint16LE
//     [+61] respawnTimer     Uint16LE
//     [+63] ledgeHang        Uint16LE
//   Sets:
//     [+65] airDodgeUsed     Uint8  (0|1)
//   Total: 66 bytes

const PER_ENTITY_BYTES = 66;

/** Total snapshot buffer size per slot. */
const SNAPSHOT_DATA_BYTES = 8 + MAX_FIGHTERS * PER_ENTITY_BYTES;

// ── InputPacket ───────────────────────────────────────────────────────────────

export interface InputPacket {
  /** Simulation frame this input belongs to. */
  frame: number;
  /** Packed 16-bit input state. */
  inputs: PackedInputState;
  /** CRC32 of the sender's game state (present every 60 frames). */
  checksum?: number;
}

// ── RollbackManager ───────────────────────────────────────────────────────────

export class RollbackManager {
  private readonly sortedEntityIds: EntityId[];
  private readonly moveIds: readonly string[];
  private readonly moveIdIndex: Map<string, number>;

  // Pre-allocated snapshot pool — no heap allocation in hot path.
  private readonly snapshots: Array<{ frame: number; data: Uint8Array; view: DataView }>;

  // Pre-allocated scratch buffer + DataView for computeChecksum() — reused every call.
  private readonly checksumBuf: Uint8Array;
  private readonly checksumView: DataView;

  // Per-frame opponent input predictions, indexed by frame % ROLLBACK_BUFFER_SIZE.
  private readonly predictedInputs: PackedInputState[];

  // Per-frame local inputs, indexed by frame % ROLLBACK_BUFFER_SIZE.
  private readonly localInputHistory: PackedInputState[];

  /** True when the rollback buffer was exhausted and a full resync was requested. */
  public resyncRequested = false;

  /** Number of resimulation runs triggered (useful in tests). */
  public resimulationCount = 0;

  /**
   * @param entityIds   All fighter entity IDs that participate in the match.
   * @param allMoveIds  All possible move IDs across all characters in the match.
   *                    Used to encode `currentMoveId` as a 1-byte index.
   */
  constructor(entityIds: EntityId[], allMoveIds: string[]) {
    this.sortedEntityIds = [...entityIds].sort((a, b) => a - b);
    this.moveIds = [...allMoveIds].sort();
    this.moveIdIndex = new Map(this.moveIds.map((id, i) => [id, i + 1]));

    this.snapshots = Array.from({ length: ROLLBACK_BUFFER_SIZE }, () => {
      const data = new Uint8Array(SNAPSHOT_DATA_BYTES);
      return { frame: -1, data, view: new DataView(data.buffer) };
    });

    this.checksumBuf  = new Uint8Array(SNAPSHOT_DATA_BYTES);
    this.checksumView = new DataView(this.checksumBuf.buffer);

    this.predictedInputs  = new Array<PackedInputState>(ROLLBACK_BUFFER_SIZE).fill(0);
    this.localInputHistory = new Array<PackedInputState>(ROLLBACK_BUFFER_SIZE).fill(0);
  }

  /**
   * Return a read-only view of the raw snapshot bytes for `frame`.
   * Returns `null` if no snapshot has been saved for that frame.
   * Used by SpectatorBroadcaster to transmit full state to observers.
   */
  getSnapshotBytes(frame: number): Uint8Array | null {
    const slot = frame % ROLLBACK_BUFFER_SIZE;
    const snap = this.snapshots[slot]!;
    return snap.frame === frame ? snap.data : null;
  }

  // ── Snapshot save / restore ───────────────────────────────────────────────

  /** Serialise the full simulation state into the circular snapshot buffer. */
  saveSnapshot(frame: number): void {
    const slot = frame % ROLLBACK_BUFFER_SIZE;
    const snap = this.snapshots[slot]!;
    snap.frame = frame;

    const view = snap.view; // reuse pre-allocated DataView — no heap allocation
    let off = 0;

    // Global header
    view.setUint32(off, frame >>> 0, true);          off += 4;
    view.setUint32(off, getRngState(), true);         off += 4;

    // Per-entity blocks (sorted for determinism)
    for (const id of this.sortedEntityIds) {
      const t = transformComponents.get(id);
      const p = physicsComponents.get(id);
      const f = fighterComponents.get(id);

      if (!t || !p || !f) {
        // Fill with zeros if the entity is absent (shouldn't happen in a live match).
        off += PER_ENTITY_BYTES;
        continue;
      }

      // Transform
      view.setInt32(off,  t.x,             true); off += 4;
      view.setInt32(off,  t.y,             true); off += 4;
      view.setInt32(off,  t.prevX,         true); off += 4;
      view.setInt32(off,  t.prevY,         true); off += 4;
      view.setUint8(off,  t.facingRight ? 1 : 0); off += 1;

      // Physics
      view.setInt32(off,  p.vx,                  true); off += 4;
      view.setInt32(off,  p.vy,                  true); off += 4;
      view.setInt32(off,  p.gravityMultiplier,   true); off += 4;
      view.setUint8(off,  p.grounded    ? 1 : 0);        off += 1;
      view.setUint8(off,  p.fastFalling ? 1 : 0);        off += 1;

      // Fighter
      view.setUint8(off,  FIGHTER_STATE_TO_IDX.get(f.state) ?? 0); off += 1;
      view.setInt32(off,  f.damagePercent,  true); off += 4;
      view.setUint8(off,  f.stocks);               off += 1;
      view.setUint8(off,  f.jumpCount);            off += 1;
      view.setUint16(off, f.hitstunFrames,     true); off += 2;
      view.setUint16(off, f.invincibleFrames,  true); off += 2;
      view.setUint16(off, f.hitlagFrames,      true); off += 2;
      view.setUint16(off, Math.round(Math.max(0, Math.min(1000, f.shieldHealth * 10))), true); off += 2;
      view.setUint16(off, f.shieldBreakFrames, true); off += 2;
      view.setUint16(off, f.attackFrame,       true); off += 2;
      view.setUint8(off,  f.currentMoveId !== null
        ? (this.moveIdIndex.get(f.currentMoveId) ?? 0)
        : 0); off += 1;

      // Timer maps
      view.setUint16(off, hitlagMap.get(id)      ?? 0, true); off += 2;
      view.setUint16(off, shieldBreakMap.get(id) ?? 0, true); off += 2;
      view.setUint16(off, dodgeFramesMap.get(id) ?? 0, true); off += 2;
      view.setUint16(off, grabFramesMap.get(id)  ?? 0, true); off += 2;
      view.setUint16(off, techWindowMap.get(id)  ?? 0, true); off += 2;
      view.setUint16(off, respawnTimers.get(id)  ?? 0, true); off += 2;
      view.setUint16(off, ledgeHangFramesMap.get(id) ?? 0, true); off += 2;

      // Sets
      view.setUint8(off, airDodgeUsedSet.has(id) ? 1 : 0); off += 1;
    }
  }

  /** Restore simulation state from the snapshot saved for `frame`. */
  restoreSnapshot(frame: number): void {
    const slot = frame % ROLLBACK_BUFFER_SIZE;
    const snap = this.snapshots[slot]!;
    if (snap.frame !== frame) return; // snapshot expired or never saved

    const view = snap.view; // reuse pre-allocated DataView
    let off = 0;

    // Global header
    const savedFrame = view.getUint32(off, true); off += 4;
    const savedRng   = view.getUint32(off, true); off += 4;

    matchState.frame = savedFrame;
    setRngState(savedRng);

    // Per-entity blocks
    for (const id of this.sortedEntityIds) {
      const t = transformComponents.get(id);
      const p = physicsComponents.get(id);
      const f = fighterComponents.get(id);

      if (!t || !p || !f) {
        off += PER_ENTITY_BYTES;
        continue;
      }

      // Transform
      t.x           = view.getInt32(off, true); off += 4;
      t.y           = view.getInt32(off, true); off += 4;
      t.prevX       = view.getInt32(off, true); off += 4;
      t.prevY       = view.getInt32(off, true); off += 4;
      t.facingRight = view.getUint8(off) !== 0; off += 1;

      // Physics
      p.vx               = view.getInt32(off, true); off += 4;
      p.vy               = view.getInt32(off, true); off += 4;
      p.gravityMultiplier = view.getInt32(off, true); off += 4;
      p.grounded          = view.getUint8(off) !== 0; off += 1;
      p.fastFalling       = view.getUint8(off) !== 0; off += 1;

      // Fighter
      const stateIdx = view.getUint8(off); off += 1;
      f.state         = FIGHTER_STATES[stateIdx] ?? 'idle';
      f.damagePercent = view.getInt32(off, true);  off += 4;
      f.stocks        = view.getUint8(off);         off += 1;
      f.jumpCount     = view.getUint8(off);         off += 1;
      f.hitstunFrames    = view.getUint16(off, true); off += 2;
      f.invincibleFrames = view.getUint16(off, true); off += 2;
      f.hitlagFrames     = view.getUint16(off, true); off += 2;
      f.shieldHealth     = view.getUint16(off, true) / 10; off += 2;
      f.shieldBreakFrames = view.getUint16(off, true); off += 2;
      f.attackFrame       = view.getUint16(off, true); off += 2;
      const moveIdx = view.getUint8(off); off += 1;
      f.currentMoveId = moveIdx === 0 ? null : (this.moveIds[moveIdx - 1] ?? null);

      // Timer maps
      const hl = view.getUint16(off, true); off += 2;
      const sb = view.getUint16(off, true); off += 2;
      const dg = view.getUint16(off, true); off += 2;
      const gr = view.getUint16(off, true); off += 2;
      const tw = view.getUint16(off, true); off += 2;
      const rt = view.getUint16(off, true); off += 2;
      const lh = view.getUint16(off, true); off += 2;

      if (hl > 0) hitlagMap.set(id, hl);       else hitlagMap.delete(id);
      if (sb > 0) shieldBreakMap.set(id, sb);  else shieldBreakMap.delete(id);
      if (dg > 0) dodgeFramesMap.set(id, dg);  else dodgeFramesMap.delete(id);
      if (gr > 0) grabFramesMap.set(id, gr);   else grabFramesMap.delete(id);
      if (tw > 0) techWindowMap.set(id, tw);   else techWindowMap.delete(id);
      if (rt > 0) respawnTimers.set(id, rt);   else respawnTimers.delete(id);
      if (lh > 0) ledgeHangFramesMap.set(id, lh); else ledgeHangFramesMap.delete(id);

      // Sets
      const adu = view.getUint8(off); off += 1;
      if (adu) airDodgeUsedSet.add(id); else airDodgeUsedSet.delete(id);
    }

    // The hit registry is NOT restored; it will be rebuilt by re-simulation.
    hitRegistry.clear();
  }

  // ── Checksum ──────────────────────────────────────────────────────────────

  /**
   * Compute a CRC32 checksum of the current simulation state.
   * Both peers must call this for the same frame to get a comparable checksum.
   */
  computeChecksum(): number {
    // Serialise into the pre-allocated scratch buffer (no heap allocation).
    const view = this.checksumView;
    let off = 0;

    view.setUint32(off, matchState.frame >>> 0, true); off += 4;
    view.setUint32(off, getRngState(),           true); off += 4;

    for (const id of this.sortedEntityIds) {
      const t = transformComponents.get(id);
      const p = physicsComponents.get(id);
      const f = fighterComponents.get(id);

      if (!t || !p || !f) { off += PER_ENTITY_BYTES; continue; }

      view.setInt32(off,  t.x,             true); off += 4;
      view.setInt32(off,  t.y,             true); off += 4;
      view.setInt32(off,  t.prevX,         true); off += 4;
      view.setInt32(off,  t.prevY,         true); off += 4;
      view.setUint8(off,  t.facingRight ? 1 : 0); off += 1;

      view.setInt32(off,  p.vx,                 true); off += 4;
      view.setInt32(off,  p.vy,                 true); off += 4;
      view.setInt32(off,  p.gravityMultiplier,  true); off += 4;
      view.setUint8(off,  p.grounded    ? 1 : 0);       off += 1;
      view.setUint8(off,  p.fastFalling ? 1 : 0);       off += 1;

      view.setUint8(off,  FIGHTER_STATE_TO_IDX.get(f.state) ?? 0); off += 1;
      view.setInt32(off,  f.damagePercent, true); off += 4;
      view.setUint8(off,  f.stocks);              off += 1;
      view.setUint8(off,  f.jumpCount);           off += 1;
      view.setUint16(off, f.hitstunFrames,     true); off += 2;
      view.setUint16(off, f.invincibleFrames,  true); off += 2;
      view.setUint16(off, f.hitlagFrames,      true); off += 2;
      view.setUint16(off, Math.round(Math.max(0, Math.min(1000, f.shieldHealth * 10))), true); off += 2;
      view.setUint16(off, f.shieldBreakFrames, true); off += 2;
      view.setUint16(off, f.attackFrame,       true); off += 2;
      view.setUint8(off,  f.currentMoveId !== null
        ? (this.moveIdIndex.get(f.currentMoveId) ?? 0)
        : 0); off += 1;

      view.setUint16(off, hitlagMap.get(id)      ?? 0, true); off += 2;
      view.setUint16(off, shieldBreakMap.get(id) ?? 0, true); off += 2;
      view.setUint16(off, dodgeFramesMap.get(id) ?? 0, true); off += 2;
      view.setUint16(off, grabFramesMap.get(id)  ?? 0, true); off += 2;
      view.setUint16(off, techWindowMap.get(id)  ?? 0, true); off += 2;
      view.setUint16(off, respawnTimers.get(id)  ?? 0, true); off += 2;
      view.setUint16(off, ledgeHangFramesMap.get(id) ?? 0, true); off += 2;
      view.setUint8(off,  airDodgeUsedSet.has(id) ? 1 : 0); off += 1;
    }

    return crc32(this.checksumBuf.subarray(0, off));
  }

  // ── Input recording ───────────────────────────────────────────────────────

  /**
   * Record the local input and the predicted opponent input for `frame`.
   * Call once per physics frame, before simulating.
   */
  recordFrameInputs(
    frame: number,
    localInput: PackedInputState,
    predictedOpponentInput: PackedInputState,
  ): void {
    const slot = frame % ROLLBACK_BUFFER_SIZE;
    this.localInputHistory[slot] = localInput;
    this.predictedInputs[slot]   = predictedOpponentInput;
  }

  // ── Opponent input handling ───────────────────────────────────────────────

  /**
   * Process an incoming opponent InputPacket.
   *
   * If the packet is too old (older than ROLLBACK_BUFFER_SIZE frames before
   * `currentFrame`), calls `requestResync()` and returns false.
   *
   * If the real input differs from the prediction, restores the snapshot at
   * `packet.frame - 1`, then calls `resimulate(frame, localInput, opponentInput)`
   * for every frame from `packet.frame` to `currentFrame` (inclusive).
   *
   * @param packet        The packet received from the opponent.
   * @param currentFrame  The simulation frame the local peer is currently on.
   * @param resimulate    Callback: must run one full physics step for the given
   *                      frame using the supplied local and opponent inputs.
   * @returns  true if a rollback was triggered; false otherwise.
   */
  onOpponentInput(
    packet: InputPacket,
    currentFrame: number,
    resimulate: (
      frame: number,
      localInput: PackedInputState,
      opponentInput: PackedInputState,
    ) => void,
  ): boolean {
    if (packet.frame < currentFrame - ROLLBACK_BUFFER_SIZE) {
      this.requestResync();
      return false;
    }

    const predSlot = packet.frame % ROLLBACK_BUFFER_SIZE;
    if (packet.inputs !== this.predictedInputs[predSlot]) {
      // Prediction was wrong — rollback and resimulate.
      // Guard: frame 0 has no prior state to restore; clamp to 0.
      const rollbackFrame = packet.frame > 0 ? packet.frame - 1 : 0;
      this.restoreSnapshot(rollbackFrame);
      this.resimulationCount++;

      for (let f = packet.frame; f <= currentFrame; f++) {
        const localInput    = this.localInputHistory[f % ROLLBACK_BUFFER_SIZE] ?? 0;
        const opponentInput = f === packet.frame
          ? packet.inputs
          : (this.predictedInputs[f % ROLLBACK_BUFFER_SIZE] ?? 0);

        resimulate(f, localInput, opponentInput);

        // Save a fresh snapshot after each resimulated frame.
        this.saveSnapshot(f);
      }

      return true;
    }

    return false;
  }

  // ── Desync detection ──────────────────────────────────────────────────────

  /**
   * Compare a remote checksum with the local one.
   * Returns true if they match (no desync), false if they diverge.
   *
   * The caller is responsible for acting on a desync (e.g. applying host state).
   */
  verifyChecksum(remoteChecksum: number): boolean {
    return this.computeChecksum() === remoteChecksum;
  }

  // ── Resync ────────────────────────────────────────────────────────────────

  /**
   * Mark that a full state resync is required.
   * Called when a received packet is too old to roll back cleanly.
   */
  requestResync(): void {
    this.resyncRequested = true;
  }
}

// ── Standalone checksum helper ────────────────────────────────────────────────

/**
 * Compute a CRC32 of the current simulation state without a RollbackManager.
 * Useful in tests and the determinism audit.
 *
 * @param entityIds  Fighter entities to include (processed in sorted order).
 * @param moveIds    All possible move IDs (sorted), needed to encode currentMoveId.
 */
export function computeStateChecksum(
  entityIds: EntityId[],
  moveIds: string[],
): number {
  const mgr = new RollbackManager(entityIds, moveIds);
  return mgr.computeChecksum();
}
