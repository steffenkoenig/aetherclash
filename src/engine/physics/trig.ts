// src/engine/physics/trig.ts
// Pre-computed 512-entry sin/cos lookup table for deterministic fixed-point trig.
// Uses a deterministic polynomial approximation (not Math.sin/cos) to guarantee
// bit-identical results across all browsers and CPU architectures.
//
// The physics simulation must use sinLUT/cosLUT — never Math.sin/cos directly.

import { toFixed } from './fixednum.js';
import type { Fixed } from './fixednum.js';

export const LUT_SIZE = 512;

// Numeric constants — defined explicitly to avoid any platform-dependent Math.PI divergence.
const PI      = 3.141592653589793;
const TWO_PI  = PI * 2;
const HALF_PI = PI / 2;

/**
 * Deterministic polynomial approximation of sin(x) for x in radians.
 * Uses range reduction: first to [−π, π], then to [−π/2, π/2] via symmetry
 * (sin(π − x) = sin(x)), so the 7th-order Taylor series is applied in the
 * region where it achieves error < 0.001.
 * Avoids any platform-dependent transcendental functions (Math.sin/cos).
 */
function sinApprox(angleRad: number): number {
  // Range reduce to [−2π, 2π] then [−π, π]
  let x = angleRad % TWO_PI;
  if (x > PI)  x -= TWO_PI;
  if (x < -PI) x += TWO_PI;

  // Further reduce to [−π/2, π/2] using symmetry sin(π − x) = sin(x)
  if (x > HALF_PI)  x = PI - x;
  if (x < -HALF_PI) x = -PI - x;

  const x2 = x * x;
  const x3 = x2 * x;
  const x5 = x3 * x2;
  const x7 = x5 * x2;

  // sin(x) ≈ x − x³/6 + x⁵/120 − x⁷/5040  (error < 0.001 on [−π/2, π/2])
  return x - x3 / 6 + x5 / 120 - x7 / 5040;
}

/**
 * Deterministic polynomial approximation of cos(x) for x in radians.
 * Implemented via phase shift: cos(x) = sin(x + π/2).
 */
function cosApprox(angleRad: number): number {
  return sinApprox(angleRad + HALF_PI);
}

// Initialise with deterministic approximations, then freeze to Q16.16 Fixed.
export const SIN_LUT: Fixed[] = new Array(LUT_SIZE);
export const COS_LUT: Fixed[] = new Array(LUT_SIZE);

for (let i = 0; i < LUT_SIZE; i++) {
  const angle = (i / LUT_SIZE) * TWO_PI;
  SIN_LUT[i] = toFixed(sinApprox(angle));
  COS_LUT[i] = toFixed(cosApprox(angle));
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
