// src/engine/physics/trig.ts
// Pre-computed sin/cos lookup table (512 entries covering 0–360°).
// Use these functions instead of Math.sin/Math.cos in physics code
// to guarantee identical results across all JS engines.

export const LUT_SIZE = 512;

const SIN_LUT = new Float64Array(LUT_SIZE);
const COS_LUT = new Float64Array(LUT_SIZE);

// Build the LUTs at module load time — Math.sin/Math.cos are only called here,
// during initialisation, never inside the simulation.
(function buildLUTs(): void {
  const TWO_PI = 2 * Math.PI;
  for (let i = 0; i < LUT_SIZE; i++) {
    const radians = (i / LUT_SIZE) * TWO_PI;
    SIN_LUT[i] = Math.sin(radians);
    COS_LUT[i] = Math.cos(radians);
  }
})();

/** Normalise an angle in degrees to the range [0, 360). */
function normaliseDeg(degrees: number): number {
  degrees = degrees % 360;
  if (degrees < 0) degrees += 360;
  return degrees;
}

/**
 * Return the sine of an angle given in degrees, using the pre-computed LUT.
 * Returns a plain float — convert to Fixed with toFixed() at the call site.
 */
export function sinDeg(degrees: number): number {
  // Math.floor ensures the index is always in [0, LUT_SIZE-1].
  const index = Math.floor((normaliseDeg(degrees) / 360) * LUT_SIZE) % LUT_SIZE;
  return SIN_LUT[index]!;
}

/**
 * Return the cosine of an angle given in degrees, using the pre-computed LUT.
 * Returns a plain float — convert to Fixed with toFixed() at the call site.
 */
export function cosDeg(degrees: number): number {
  const index = Math.floor((normaliseDeg(degrees) / 360) * LUT_SIZE) % LUT_SIZE;
  return COS_LUT[index]!;
}
