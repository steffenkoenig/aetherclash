// src/engine/input/buffer.ts
// 5-frame FIFO input buffer.
// When a button is pressed, it is queued. If the engine cannot act on it
// immediately (e.g. the character is busy), subsequent frames will check the
// buffer and act as soon as the window is still open.

export type InputAction = 'jump' | 'attack' | 'special' | 'grab';

export const BUFFER_WINDOW = 5; // frames

export class InputBuffer {
  /** Per-action FIFO queue of frame numbers when the action was pressed. */
  private readonly buffer: Map<InputAction, number[]> = new Map();

  /**
   * Record that an action was pressed on `currentFrame`.
   * Multiple presses of the same action accumulate in order.
   */
  press(action: InputAction, currentFrame: number): void {
    let queue = this.buffer.get(action);
    if (!queue) {
      queue = [];
      this.buffer.set(action, queue);
    }
    queue.push(currentFrame);
  }

  /**
   * Attempt to consume a buffered press of `action` that is still within the
   * BUFFER_WINDOW frames of `currentFrame`.
   * Returns true if a valid press was consumed, false otherwise.
   */
  consume(action: InputAction, currentFrame: number): boolean {
    const queue = this.buffer.get(action);
    if (!queue || queue.length === 0) return false;

    // Discard expired presses (FIFO — remove from the front)
    while (queue.length > 0 && currentFrame - queue[0]! > BUFFER_WINDOW) {
      queue.shift();
    }

    if (queue.length === 0) return false;

    // Consume the oldest valid press
    queue.shift();
    return true;
  }

  /**
   * Peek at whether there is a buffered press without consuming it.
   */
  has(action: InputAction, currentFrame: number): boolean {
    const queue = this.buffer.get(action);
    if (!queue || queue.length === 0) return false;

    for (const frame of queue) {
      if (currentFrame - frame <= BUFFER_WINDOW) return true;
    }
    return false;
  }

  /** Clear all buffered presses for all actions. */
  clear(): void {
    this.buffer.clear();
  }

  /** Clear buffered presses for a single action. */
  clearAction(action: InputAction): void {
    this.buffer.delete(action);
  }
}
