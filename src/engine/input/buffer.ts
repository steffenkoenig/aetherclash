// src/engine/input/buffer.ts
// 5-frame FIFO input buffer for each action.
// Allows actions pressed slightly before they can be executed to still register.

export type InputAction = 'jump' | 'attack' | 'special' | 'grab';

/** Number of frames a buffered press remains valid. */
export const BUFFER_WINDOW = 5;

const ACTIONS: readonly InputAction[] = ['jump', 'attack', 'special', 'grab'];

export class InputBuffer {
  private readonly buffer: Map<InputAction, number[]>;

  constructor() {
    this.buffer = new Map(ACTIONS.map(a => [a, []]));
  }

  /**
   * Record that `action` was pressed at `currentFrame`.
   * Multiple presses accumulate in FIFO order.
   */
  press(action: InputAction, currentFrame: number): void {
    this.buffer.get(action)!.push(currentFrame);
  }

  /**
   * Consume the oldest buffered press for `action` that is still within the
   * buffer window.  Returns true if a press was available and consumed.
   */
  consume(action: InputAction, currentFrame: number): boolean {
    const frames = this.buffer.get(action)!;

    // Discard expired presses from the front of the queue.
    while (frames.length > 0 && currentFrame - frames[0] >= BUFFER_WINDOW) {
      frames.shift();
    }

    if (frames.length > 0) {
      frames.shift(); // consume the oldest valid press
      return true;
    }
    return false;
  }

  /** Discard all buffered presses for every action. */
  clear(): void {
    for (const frames of this.buffer.values()) {
      frames.length = 0;
    }
  }
}
