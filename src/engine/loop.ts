// src/engine/loop.ts
// Fixed-step 60 Hz game loop using requestAnimationFrame.

export const FIXED_STEP_MS = 1000 / 60; // ~16.667 ms

let lastTime = 0;
let accumulator = 0;
let rafHandle = 0;

export function startLoop(
  onPhysicsStep: () => void,
  onRender: (alpha: number) => void,
): void {
  function frame(now: number) {
    const delta = now - lastTime;
    lastTime = now;
    // Clamp to 50 ms to avoid spiral-of-death when tab was hidden
    accumulator += Math.min(delta, 50);

    while (accumulator >= FIXED_STEP_MS) {
      onPhysicsStep();
      accumulator -= FIXED_STEP_MS;
    }

    onRender(accumulator / FIXED_STEP_MS);
    rafHandle = requestAnimationFrame(frame);
  }

  rafHandle = requestAnimationFrame((now) => {
    lastTime = now;
    rafHandle = requestAnimationFrame(frame);
  });
}

export function stopLoop(): void {
  if (rafHandle) {
    cancelAnimationFrame(rafHandle);
    rafHandle = 0;
  }
  accumulator = 0;
  lastTime = 0;
}

// ── Headless simulation (used by tests) ──────────────────────────────────────

/**
 * Simulates exactly `frames` physics steps with the given step callback.
 * Does not use requestAnimationFrame — suitable for unit tests.
 */
export function simulateFrames(
  frames: number,
  onPhysicsStep: () => void,
): void {
  for (let i = 0; i < frames; i++) {
    onPhysicsStep();
  }
}
