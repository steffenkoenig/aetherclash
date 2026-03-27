// src/engine/input/buffer.ts
// 5-frame FIFO input buffer.
// When a button is pressed, it is queued. If the engine cannot act on it
// immediately (e.g. the character is busy), subsequent frames will check the
// buffer and act as soon as the window is still open.
//
// Implementation uses a per-action fixed-capacity ring buffer (power-of-2 size)
// so all operations (press/consume/has) are O(1) with no heap allocations.

export type InputAction = 'jump' | 'attack' | 'special' | 'grab';

export const BUFFER_WINDOW = 5; // frames

// ── Ring buffer ───────────────────────────────────────────────────────────────

// Must be a power of 2 and > BUFFER_WINDOW + 1 to prevent overwrite.
const RING_SIZE = 8;
const RING_MASK = RING_SIZE - 1;

/** Fixed-capacity circular buffer of frame-number integers. */
class RingBuffer {
  private readonly data = new Int32Array(RING_SIZE).fill(-1);
  private head = 0; // index of the oldest entry
  private count = 0;

  push(value: number): void {
    if (this.count < RING_SIZE) {
      const tail = (this.head + this.count) & RING_MASK;
      this.data[tail] = value;
      this.count++;
    } else {
      // Buffer full — should not happen with RING_SIZE > BUFFER_WINDOW + 1
      console.warn('InputBuffer ring overflow: oldest press silently dropped');
    }
  }

  /** Read the front element without removing it. Returns -1 when empty. */
  peekFront(): number {
    return this.count > 0 ? this.data[this.head]! : -1;
  }

  /** Remove the front element. */
  popFront(): void {
    if (this.count > 0) {
      this.head = (this.head + 1) & RING_MASK;
      this.count--;
    }
  }

  isEmpty(): boolean {
    return this.count === 0;
  }

  /** Read element at logical index i (0 = front). Returns -1 for out-of-range. */
  at(i: number): number {
    if (i < 0 || i >= this.count) return -1;
    return this.data[(this.head + i) & RING_MASK]!;
  }

  get length(): number {
    return this.count;
  }

  clear(): void {
    this.head = 0;
    this.count = 0;
  }
}

// ── InputBuffer ───────────────────────────────────────────────────────────────

export class InputBuffer {
  private readonly rings = new Map<InputAction, RingBuffer>();

  private ring(action: InputAction): RingBuffer {
    let r = this.rings.get(action);
    if (!r) {
      r = new RingBuffer();
      this.rings.set(action, r);
    }
    return r;
  }

  /**
   * Record that an action was pressed on `currentFrame`.
   * Multiple presses of the same action accumulate in FIFO order.
   */
  press(action: InputAction, currentFrame: number): void {
    this.ring(action).push(currentFrame);
  }

  /**
   * Attempt to consume a buffered press of `action` still within the
   * BUFFER_WINDOW frames of `currentFrame`.
   * Returns true if a valid press was consumed, false otherwise.
   */
  consume(action: InputAction, currentFrame: number): boolean {
    const r = this.ring(action);

    // Discard expired presses from the front (O(1) per iteration)
    while (!r.isEmpty() && currentFrame - r.peekFront() > BUFFER_WINDOW) {
      r.popFront();
    }

    if (r.isEmpty()) return false;

    // Consume the oldest valid press
    r.popFront();
    return true;
  }

  /**
   * Peek at whether there is a buffered press without consuming it.
   */
  has(action: InputAction, currentFrame: number): boolean {
    const r = this.ring(action);
    for (let i = 0; i < r.length; i++) {
      if (currentFrame - r.at(i) <= BUFFER_WINDOW) return true;
    }
    return false;
  }

  /** Clear all buffered presses for all actions. */
  clear(): void {
    for (const r of this.rings.values()) {
      r.clear();
    }
  }

  /** Clear buffered presses for a single action. */
  clearAction(action: InputAction): void {
    this.rings.get(action)?.clear();
  }
}
