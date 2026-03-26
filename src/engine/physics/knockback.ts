// src/engine/physics/knockback.ts
// Knockback formula, hitstun/hitlag computation, and DI application.
// All physics values use Q16.16 fixed-point arithmetic.

import type { Fixed } from './fixednum.js';
import {
  toFixed,
  toFloat,
  fixedAdd,
  fixedMul,
  fixedDiv,
} from './fixednum.js';
import { cosLUT, sinLUT } from './trig.js';
import { fighterComponents, physicsComponents, transformComponents } from '../ecs/component.js';
import { transitionFighterState } from './stateMachine.js';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Maximum angle adjustment from Directional Influence (degrees). */
export const DI_MAX_DEGREES = 15;

// ── Pure formula helpers (exported for tests) ─────────────────────────────────

/**
 * Compute the knockback launch force.
 *
 *   F = ((d/10 + d*w/20) / (w+1)) * s + b
 *
 * All parameters and the return value are Q16.16 Fixed.
 *
 * @param d - Victim's current damage percentage (Fixed)
 * @param w - Victim's weight class value (Fixed)
 * @param s - Move's knockback scaling factor (Fixed)
 * @param b - Move's base knockback (Fixed)
 * @returns Launch force F (Fixed)
 */
export function computeKnockback(d: Fixed, w: Fixed, s: Fixed, b: Fixed): Fixed {
  // d / 10
  const d10 = fixedDiv(d, toFixed(10));
  // d * w / 20
  const dw20 = fixedDiv(fixedMul(d, w), toFixed(20));
  // (d/10 + d*w/20) / (w + 1)
  const numerator = fixedAdd(d10, dw20);
  const wPlus1    = fixedAdd(w, toFixed(1));
  const fraction  = fixedDiv(numerator, wPlus1);
  // fraction * s + b
  return fixedAdd(fixedMul(fraction, s), b);
}

/**
 * Compute hitstun duration: floor(F * 0.4)
 * Converts to float before computing the floor since the result is an integer frame count.
 * @param force - Launch force F (Fixed)
 * @returns Number of hitstun frames (integer)
 */
export function computeHitstun(force: Fixed): number {
  return Math.floor(toFloat(force) * 0.4);
}

/**
 * Compute hitlag duration: max(4, floor(damage / 3))
 * @param damage - Raw damage value of the hit (integer)
 * @returns Number of hitlag frames (integer)
 */
export function computeHitlag(damage: number): number {
  return Math.max(4, Math.floor(damage / 3));
}

// ── Full hit application ──────────────────────────────────────────────────────

/**
 * Apply a hit from attacker to victim:
 *  - Computes knockback force using the victim's current damage and weight
 *  - Accumulates damage on the victim
 *  - Applies DI (only on the very first hitstun frame, i.e. when transitioning into hitstun)
 *  - Sets vx/vy on the victim
 *  - Sets hitstun and hitlag frames on both attacker and victim
 *  - Transitions the victim to 'hitstun'
 *
 * @param attackerId    - Entity ID of the attacker
 * @param victimId      - Entity ID of the victim
 * @param damage        - Raw damage integer for this hit
 * @param knockbackScaling - Move's scaling factor (Fixed)
 * @param baseKnockback    - Move's base knockback (Fixed)
 * @param launchAngleDeg   - Move's launch angle in degrees (0 = right, 90 = up)
 * @param diInputX         - Victim's stick X in [-1, 1] for DI (float, not Fixed)
 */
export function applyHit(
  attackerId: number,
  victimId: number,
  damage: number,
  knockbackScaling: Fixed,
  baseKnockback: Fixed,
  launchAngleDeg: number,
  diInputX: number,
): void {
  const attackerTransform = transformComponents.get(attackerId);
  const victimFighter     = fighterComponents.get(victimId);
  const victimPhys        = physicsComponents.get(victimId);
  const attackerFighter   = fighterComponents.get(attackerId);

  if (!attackerTransform || !victimFighter || !victimPhys || !attackerFighter) return;

  // Compute force from victim's pre-hit damage
  const F = computeKnockback(
    victimFighter.damagePercent,
    victimFighter.stats.weightClass,
    knockbackScaling,
    baseKnockback,
  );

  // Flip launch angle if the attacker is facing left (before applying DI)
  let angle = attackerTransform.facingRight ? launchAngleDeg : 180 - launchAngleDeg;

  // Apply DI (only valid on the first hitstun frame, caller responsibility)
  angle += diInputX * DI_MAX_DEGREES;

  // Normalise angle to [0, 360)
  angle = ((angle % 360) + 360) % 360;

  // Apply launch velocity using LUT-based trig
  victimPhys.vx = fixedMul(cosLUT(angle), F);
  victimPhys.vy = fixedMul(sinLUT(angle), F);

  // Victim leaves the ground
  victimPhys.grounded    = false;
  victimPhys.fastFalling = false;

  // Accumulate damage (add to damage AFTER computing knockback — consistent with the spec)
  victimFighter.damagePercent = fixedAdd(
    victimFighter.damagePercent,
    toFixed(damage),
  );

  // Hitstun and hitlag
  const hitstunFrames = computeHitstun(F);
  const hitlagFrames  = computeHitlag(damage);

  transitionFighterState(victimId, 'hitstun', { hitstunFrames });

  victimFighter.hitlagFrames   = hitlagFrames;
  attackerFighter.hitlagFrames = hitlagFrames;
}
