// src/engine/physics/trig.ts
// Pre-computed 512-entry sin/cos lookup table for deterministic fixed-point trig.
// Entries are computed once at module load using Math.sin/cos (acceptable at init time).
// The physics simulation must use sinLUT/cosLUT — never Math.sin/cos directly.

import { toFixed } from './fixednum.js';
import type { Fixed } from './fixednum.js';

export const LUT_SIZE = 512;

// Initialise with full-precision float at startup, then freeze to Fixed
export const SIN_LUT: Fixed[] = new Array(LUT_SIZE);
export const COS_LUT: Fixed[] = new Array(LUT_SIZE);

for (let i = 0; i < LUT_SIZE; i++) {
  const angle = (i / LUT_SIZE) * 2 * Math.PI;
  SIN_LUT[i] = toFixed(Math.sin(angle));
  COS_LUT[i] = toFixed(Math.cos(angle));
}

/**
 * Convert a launch angle in degrees (integer, 0–360) to a 512-entry LUT index.
 * Handles negative and > 360 angles via modular arithmetic.
 */
export function degToLutIndex(degrees: number): number {
  const normalized = ((degrees % 360) + 360) % 360;
  return Math.round((normalized / 360) * LUT_SIZE) % LUT_SIZE;
}

/** LUT-based cos for an angle given in degrees. */
export function cosLUT(degrees: number): Fixed {
  return COS_LUT[degToLutIndex(degrees)]!;
}

/** LUT-based sin for an angle given in degrees. */
export function sinLUT(degrees: number): Fixed {
  return SIN_LUT[degToLutIndex(degrees)]!;
}
