// src/engine/physics/knockback.ts
// Knockback formula, hitstun/hitlag helpers, and velocity application.
// All physics arithmetic uses Q16.16 fixed-point operations.

import type { Fixed } from './fixednum.js';
import {
  toFixed,
  toFloat,
  fixedAdd,
  fixedMul,
  fixedDiv,
} from './fixednum.js';
import type { EntityId } from '../ecs/entity.js';
import {
  transformComponents,
  physicsComponents,
  fighterComponents,
} from '../ecs/component.js';
import { sinDeg, cosDeg } from './trig.js';
import { transitionFighterState } from './stateMachine.js';

// ── Pre-computed fixed-point constants ────────────────────────────────────────

const FIXED_1  = toFixed(1);
const FIXED_10 = toFixed(10);
const FIXED_20 = toFixed(20);
const FIXED_04 = toFixed(0.4);

/** Maximum DI angle adjustment in degrees. */
const DI_MAX_DEGREES = 15;

// ── Public types ──────────────────────────────────────────────────────────────

export interface KnockbackParams {
  /** Current damage percentage of the victim (Q16.16). */
  victimDamage: Fixed;
  /** Victim's weight class value (Q16.16; range 0.6–1.7). */
  victimWeight: Fixed;
  /** Move knockback scaling factor `s` (Q16.16). */
  moveScaling: Fixed;
  /** Move base knockback `b` (Q16.16). */
  moveBaseKnockback: Fixed;
  /** Launch angle in degrees (0 = right, 90 = up, 180 = left, 270 = down). */
  launchAngle: number;
  /** Whether the attacker is currently facing right. */
  attackerFacingRight: boolean;
  /** DI stick X input of the victim at the moment of impact (−1 to +1). */
  diX: number;
}

// ── Knockback formula ─────────────────────────────────────────────────────────

/**
 * F = ((d/10 + d·w/20) / (w+1)) · s + b
 *
 * All operands are Q16.16 Fixed values.
 */
export function computeKnockbackForce(params: KnockbackParams): Fixed {
  const { victimDamage: d, victimWeight: w, moveScaling: s, moveBaseKnockback: b } = params;

  // d / 10
  const dDiv10 = fixedDiv(d, FIXED_10);

  // (d * w) / 20
  const dTimesW     = fixedMul(d, w);
  const dTimesWDiv20 = fixedDiv(dTimesW, FIXED_20);

  // d/10 + d·w/20
  const numerator = fixedAdd(dDiv10, dTimesWDiv20);

  // w + 1
  const wPlus1 = fixedAdd(w, FIXED_1);

  // (numerator) / (w + 1)
  const baseForce = fixedDiv(numerator, wPlus1);

  // baseForce · s + b
  return fixedAdd(fixedMul(baseForce, s), b);
}

/**
 * hitstunFrames = floor(F · 0.4)
 */
export function computeHitstunFrames(force: Fixed): number {
  return Math.floor(toFloat(fixedMul(force, FIXED_04)));
}

/**
 * hitlagFrames = max(4, floor(damage / 3))
 * `damage` is a plain integer (move's damage property, not Fixed).
 */
export function computeHitlagFrames(damage: number): number {
  return Math.max(4, Math.floor(damage / 3));
}

// ── Velocity application ──────────────────────────────────────────────────────

/**
 * Apply knockback velocity to the victim and transition them into hitstun.
 *
 * Angle resolution order:
 *   1. Use `launchAngle` as-is if attacker faces right; flip if faces left.
 *   2. Add DI adjustment (±DI_MAX_DEGREES based on diX).
 *   3. Look up sin/cos via the deterministic LUT.
 */
export function applyKnockback(
  victimEntityId: EntityId,
  params: KnockbackParams,
): void {
  const transform = transformComponents.get(victimEntityId);
  const phys      = physicsComponents.get(victimEntityId);
  const fighter   = fighterComponents.get(victimEntityId);
  if (!transform || !phys || !fighter) return;

  const force = computeKnockbackForce(params);

  // Step 1: horizontal flip when attacker faces left.
  let angle = params.attackerFacingRight
    ? params.launchAngle
    : 180 - params.launchAngle;

  // Step 2: DI adjustment — clamped to ±DI_MAX_DEGREES by scaling diX.
  angle += params.diX * DI_MAX_DEGREES;

  // Normalise to [0, 360).
  angle = ((angle % 360) + 360) % 360;

  // Step 3: velocity components via the deterministic trig LUT.
  // sinDeg/cosDeg return Q16.16 Fixed values directly; fixedMul scales by force.
  const vx: Fixed = fixedMul(cosDeg(angle), force);
  const vy: Fixed = fixedMul(sinDeg(angle), force);

  phys.vx       = vx;
  phys.vy       = vy;
  phys.grounded = false;

  const hitstunFrames = computeHitstunFrames(force);
  transitionFighterState(victimEntityId, 'hitstun', { hitstunFrames });
}
