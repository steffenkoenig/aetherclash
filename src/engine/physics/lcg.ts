// src/engine/physics/lcg.ts
// Seeded 32-bit Linear Congruential Generator (LCG) for deterministic RNG.
//
// Both peers are seeded with the same 32-bit integer from the `match_found`
// WebSocket message, guaranteeing identical pseudo-random sequences for item
// spawns, Guardian selection, and any other match-level randomness.
//
// The LCG state is included in every rollback snapshot so that re-simulation
// after a rollback produces identical sequences from that frame onward.
//
// Parameters (Numerical Recipes):
//   state_{n+1} = (1664525 × state_n + 1013904223) mod 2³²

// ── LCG state ─────────────────────────────────────────────────────────────────

/** Current 32-bit unsigned LCG state (shared across the simulation). */
export let rngState: number = 0;

// ── Public API ────────────────────────────────────────────────────────────────

/** Seed the shared RNG.  Call with the `seed` from `match_found`. */
export function seedRng(seed: number): void {
  rngState = seed >>> 0;
}

/**
 * Advance the LCG and return the next 32-bit unsigned integer.
 * Safe to call in any order on both peers as long as the seed matches.
 */
export function nextRng(): number {
  // Math.imul performs 32-bit integer multiplication without overflow.
  rngState = (Math.imul(1664525, rngState) + 1013904223) | 0;
  return rngState >>> 0;
}

/**
 * Return a float in [0, 1) derived from the shared LCG.
 * Use only for non-determinism-critical display effects; for simulation use
 * `nextRng()` and perform fixed-point operations on the raw integer.
 */
export function rngFloat(): number {
  return nextRng() / 0x100000000;
}

/** Save the current RNG state for snapshot/rollback. */
export function getRngState(): number {
  return rngState;
}

/** Restore the RNG state from a snapshot. */
export function setRngState(state: number): void {
  rngState = state >>> 0;
}
