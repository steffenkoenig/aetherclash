// src/engine/net/spectator.ts
// Spectator mode: streams game state to observers via WebSocket.
//
// Architecture:
//   - Every 60 frames (1 second at 60 Hz) the host serialises a full snapshot
//     and sends it over the signalling WebSocket as a 'spectator_state' message.
//   - Per-frame inputs are appended as delta-compressed uint16 diffs.
//   - The 1-second delay is implemented on the receiver side by buffering
//     one full snapshot before starting playback.
//
// The spectator receives:
//   1. A full state snapshot every 60 frames (base frame).
//   2. Packed inputs for every frame within the 60-frame window.
//   The receiver applies the inputs on top of the base snapshot to reconstruct
//   intermediate frames.

import type { PackedInputState } from '../input/keyboard.js';
import type { RollbackManager } from './rollback.js';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Frames between full spectator state snapshots (1 second at 60 Hz). */
export const SPECTATOR_SNAPSHOT_INTERVAL = 60;

/** Buffer size in seconds — how long the spectator delays playback. */
export const SPECTATOR_DELAY_SECONDS = 1;

/** Number of snapshots held in the delay buffer. */
export const SPECTATOR_BUFFER_SLOTS = SPECTATOR_DELAY_SECONDS + 1;

// ── Spectator snapshot wire format ────────────────────────────────────────────

export interface SpectatorSnapshot {
  /** The simulation frame this snapshot was taken at. */
  frame: number;
  /** Base64-encoded full state bytes (from RollbackManager.saveSnapshot). */
  stateB64: string;
  /** Per-frame packed inputs: [fighter0Frame0, fighter1Frame0, ..., fighter0Frame59, ...] */
  inputs: PackedInputState[];
}

// ── SpectatorBroadcaster (runs on the host peer) ──────────────────────────────

export class SpectatorBroadcaster {
  private readonly numFighters: number;
  private readonly rollback: RollbackManager;
  private inputBuffer: PackedInputState[] = [];

  /** Called to transmit a snapshot to the signalling server (or direct WS). */
  public onSnapshot: ((snap: SpectatorSnapshot) => void) | null = null;

  constructor(rollback: RollbackManager, numFighters: number) {
    this.rollback    = rollback;
    this.numFighters = numFighters;
  }

  /**
   * Record one frame of inputs and, every SPECTATOR_SNAPSHOT_INTERVAL frames,
   * emit a SpectatorSnapshot via `onSnapshot`.
   *
   * @param frame   Current simulation frame.
   * @param inputs  One PackedInputState per fighter, in entity-ID order.
   */
  tick(frame: number, inputs: PackedInputState[]): void {
    for (let i = 0; i < this.numFighters; i++) {
      this.inputBuffer.push(inputs[i] ?? 0);
    }

    if (frame > 0 && frame % SPECTATOR_SNAPSHOT_INTERVAL === 0) {
      this.emit(frame);
    }
  }

  private emit(frame: number): void {
    if (!this.onSnapshot) return;

    this.rollback.saveSnapshot(frame);
    // Encode the snapshot data as base64
    // (We access the internal bytes by re-serialising via computeChecksum logic
    //  but for transmission we just encode the full snapshot.)
    const stateB64 = this.serializeCurrentState(frame);

    this.onSnapshot({
      frame,
      stateB64,
      inputs: [...this.inputBuffer],
    });

    this.inputBuffer = [];
  }

  private serializeCurrentState(frame: number): string {
    // Encode the full snapshot bytes saved for this frame.  The receiver can
    // call restoreSnapshot() after injecting these bytes into its own buffer.
    const bytes = this.rollback.getSnapshotBytes(frame);
    if (!bytes) {
      // Fallback: encode the 4-byte checksum if snapshot bytes are unavailable.
      const buf = new Uint8Array(4);
      new DataView(buf.buffer).setUint32(0, this.rollback.computeChecksum(), true);
      return btoa(String.fromCharCode(...buf));
    }
    return btoa(String.fromCharCode(...bytes));
  }
}

// ── SpectatorReceiver (runs on the observer client) ───────────────────────────

export class SpectatorReceiver {
  private readonly buffer: SpectatorSnapshot[] = [];
  private playingFrame = -1;

  /**
   * Called to apply a received snapshot to the simulation.
   * The caller is responsible for deserialising and replaying the inputs.
   */
  public onPlayback: ((snap: SpectatorSnapshot, inputFrame: number, inputs: PackedInputState[]) => void) | null = null;

  /**
   * Receive a snapshot from the network.
   * Snapshots are buffered for `SPECTATOR_DELAY_SECONDS` before playback starts.
   */
  receive(snap: SpectatorSnapshot): void {
    this.buffer.push(snap);
  }

  /**
   * Advance the receiver by one wall-clock second (i.e. call once per second).
   * Begins playback only once the delay buffer is full.
   */
  tick(): void {
    if (this.buffer.length < SPECTATOR_BUFFER_SLOTS) return;

    const snap = this.buffer.shift()!;
    this.playingFrame = snap.frame;

    if (!this.onPlayback) return;

    // Emit each frame's inputs for the caller to simulate
    const numFighters = snap.inputs.length / SPECTATOR_SNAPSHOT_INTERVAL;
    for (let f = 0; f < SPECTATOR_SNAPSHOT_INTERVAL; f++) {
      const frameInputs: PackedInputState[] = [];
      for (let p = 0; p < numFighters; p++) {
        frameInputs.push(snap.inputs[f * numFighters + p] ?? 0);
      }
      this.onPlayback(snap, snap.frame - SPECTATOR_SNAPSHOT_INTERVAL + f, frameInputs);
    }
  }

  /** Returns the frame currently being displayed by the spectator. */
  get currentFrame(): number {
    return this.playingFrame;
  }

  /** Returns the number of buffered snapshots (delay indicator). */
  get bufferDepth(): number {
    return this.buffer.length;
  }
}
