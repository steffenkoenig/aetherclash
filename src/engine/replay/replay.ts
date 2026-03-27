// src/engine/replay/replay.ts
// Input-log based replay system.
//
// How it works:
//   1. During a match, every frame's inputs for all fighters are appended to a
//      compact log (2 bytes per fighter per frame).
//   2. The log can be serialised to a base64 URL hash for sharing.
//   3. To replay, seed the RNG identically, reset the simulation, and feed the
//      recorded inputs back frame-by-frame through the physics step callback.
//
// The log is deterministic: same seed + same inputs = identical replay on any client.

import type { PackedInputState } from '../input/keyboard.js';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Maximum number of fighters in a replay. */
const MAX_FIGHTERS = 4;

/** Header size (bytes): version(1) + seed(4) + numFighters(1) = 6 */
const HEADER_BYTES = 6;

/** Version byte. Increment when the format changes. */
const FORMAT_VERSION = 1;

// ── ReplayRecorder ────────────────────────────────────────────────────────────

/**
 * Records inputs for all fighters every frame.
 * A single instance covers one full match.
 */
export class ReplayRecorder {
  private readonly numFighters: number;
  private readonly seed: number;
  private readonly frames: PackedInputState[][] = [];
  private recording = false;

  constructor(numFighters: number, seed: number) {
    if (numFighters < 1 || numFighters > MAX_FIGHTERS) {
      throw new RangeError(`numFighters must be 1–${MAX_FIGHTERS}`);
    }
    this.numFighters = numFighters;
    this.seed = seed;
  }

  /** Start recording. */
  start(): void {
    this.frames.length = 0;
    this.recording = true;
  }

  /** Stop recording (match ended). */
  stop(): void {
    this.recording = false;
  }

  /**
   * Record one frame of inputs.
   * @param inputs  One PackedInputState per fighter, in entity-ID order.
   */
  recordFrame(inputs: PackedInputState[]): void {
    if (!this.recording) return;
    this.frames.push(inputs.slice(0, this.numFighters));
  }

  /** Total number of recorded frames. */
  get frameCount(): number {
    return this.frames.length;
  }

  /** Read-only access to a specific frame's inputs. */
  getFrameInputs(frame: number): PackedInputState[] | undefined {
    return this.frames[frame];
  }

  /**
   * Serialise the replay log to a Uint8Array suitable for base64 encoding.
   *
   * Binary layout:
   *   [0]       version  (uint8)
   *   [1..4]    seed     (uint32 LE)
   *   [5]       numFighters (uint8)
   *   [6..]     frames: each frame is numFighters × uint16 LE
   */
  serialise(): Uint8Array {
    const bytesPerFrame = this.numFighters * 2;
    const totalBytes    = HEADER_BYTES + this.frames.length * bytesPerFrame;
    const buf  = new Uint8Array(totalBytes);
    const view = new DataView(buf.buffer);

    view.setUint8(0,  FORMAT_VERSION);
    view.setUint32(1, this.seed >>> 0, true);
    view.setUint8(5,  this.numFighters);

    let off = HEADER_BYTES;
    for (const frameInputs of this.frames) {
      for (let f = 0; f < this.numFighters; f++) {
        view.setUint16(off, frameInputs[f] ?? 0, true);
        off += 2;
      }
    }
    return buf;
  }

  /**
   * Encode the replay as a base64url string (suitable for use in a URL hash).
   */
  toUrlHash(): string {
    const bytes = this.serialise();
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]!);
    }
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }
}

// ── ReplayPlayer ──────────────────────────────────────────────────────────────

/**
 * Replays a recorded match by feeding stored inputs back into the simulation.
 */
export class ReplayPlayer {
  readonly numFighters: number;
  readonly seed: number;
  readonly frameCount: number;
  private readonly frames: PackedInputState[][];

  private constructor(
    numFighters: number,
    seed: number,
    frames: PackedInputState[][],
  ) {
    this.numFighters = numFighters;
    this.seed = seed;
    this.frameCount = frames.length;
    this.frames = frames;
  }

  /**
   * Deserialise a replay from a Uint8Array produced by ReplayRecorder.serialise().
   */
  static deserialise(data: Uint8Array): ReplayPlayer {
    if (data.length < HEADER_BYTES) {
      throw new Error('[replay] Buffer too short');
    }
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

    const version = view.getUint8(0);
    if (version !== FORMAT_VERSION) {
      throw new Error(`[replay] Unsupported format version ${version}`);
    }

    const seed        = view.getUint32(1, true);
    const numFighters = view.getUint8(5);
    const bytesPerFrame = numFighters * 2;

    const frameDataBytes = data.length - HEADER_BYTES;
    const frameCount = Math.floor(frameDataBytes / bytesPerFrame);
    const frames: PackedInputState[][] = [];

    let off = HEADER_BYTES;
    for (let f = 0; f < frameCount; f++) {
      const inputs: PackedInputState[] = [];
      for (let p = 0; p < numFighters; p++) {
        inputs.push(view.getUint16(off, true));
        off += 2;
      }
      frames.push(inputs);
    }

    return new ReplayPlayer(numFighters, seed, frames);
  }

  /**
   * Deserialise from a base64url hash string (as produced by toUrlHash()).
   */
  static fromUrlHash(hash: string): ReplayPlayer {
    const b64 = hash
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    const padded = b64 + '=='.slice(0, (4 - (b64.length % 4)) % 4);
    const binary = atob(padded);
    const bytes  = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return ReplayPlayer.deserialise(bytes);
  }

  /**
   * Get the inputs for frame `f`.
   * @returns  Array of PackedInputState, one per fighter, or undefined if out of range.
   */
  getFrameInputs(f: number): PackedInputState[] | undefined {
    return this.frames[f];
  }

  /**
   * Replay the full match by calling `step(frame, inputs)` for every frame.
   * The caller is responsible for initialising the simulation with `this.seed`
   * before calling this method.
   *
   * @param step  Callback invoked for each frame with the frame index and
   *              the array of packed inputs for all fighters.
   */
  play(step: (frame: number, inputs: PackedInputState[]) => void): void {
    for (let f = 0; f < this.frameCount; f++) {
      step(f, this.frames[f] ?? []);
    }
  }
}

// ── URL hash integration ──────────────────────────────────────────────────────

/**
 * Write a replay hash to window.location.hash.
 * Safe to call in a browser context; no-op in Node/Vitest.
 */
export function saveReplayToUrl(recorder: ReplayRecorder): void {
  if (typeof window === 'undefined') return;
  window.location.hash = recorder.toUrlHash();
}

/**
 * Try to load a replay from window.location.hash.
 * Returns null if the hash is absent or malformed.
 */
export function loadReplayFromUrl(): ReplayPlayer | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash.slice(1);
  if (!hash) return null;
  try {
    return ReplayPlayer.fromUrlHash(hash);
  } catch {
    return null;
  }
}
