// src/engine/physics/fixednum.ts
//
// Q16.16 fixed-point arithmetic.
// The high 16 bits are the integer part, the low 16 bits are the fraction.
// Example: 1.5 is stored as 0x00018000 = 98304

export type Fixed = number; // Tagged type: always an integer representing Q16.16

export const FRAC_BITS = 16;
export const FRAC_SCALE = 1 << FRAC_BITS; // 65536

export function toFixed(n: number): Fixed {
  return Math.round(n * FRAC_SCALE) | 0;
}

export function toFloat(f: Fixed): number {
  return f / FRAC_SCALE;
}

export function fixedMul(a: Fixed, b: Fixed): Fixed {
  // Use BigInt for intermediate multiplication to avoid 32-bit overflow
  return Number((BigInt(a) * BigInt(b)) >> BigInt(FRAC_BITS)) | 0;
}

export function fixedDiv(a: Fixed, b: Fixed): Fixed {
  return Number((BigInt(a) << BigInt(FRAC_BITS)) / BigInt(b)) | 0;
}

// Addition and subtraction are plain integer operations — no scaling needed
export function fixedAdd(a: Fixed, b: Fixed): Fixed {
  return (a + b) | 0;
}

export function fixedSub(a: Fixed, b: Fixed): Fixed {
  return (a - b) | 0;
}

/** Negate a fixed-point value: equivalent to multiplying by −1. */
export function fixedNeg(a: Fixed): Fixed {
  return (-a) | 0;
}
