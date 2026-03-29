// src/engine/physics/collision.ts
// Continuous AABB-vs-line-segment platform collision detection.

import type { Fixed } from './fixednum.js';
import { FRAC_SCALE, toFixed, fixedAdd, fixedSub, fixedNeg } from './fixednum.js';
import type { EntityId } from '../ecs/entity.js';
import {
  transformComponents,
  physicsComponents,
  fighterComponents,
  ledgeColliderComponents,
  type Move,
} from '../ecs/component.js';
import type { InputState } from '../input/keyboard.js';
import { applyKnockback, computeHitlagFrames } from './knockback.js';
import { hitlagMap, dodgeFramesMap, transitionFighterState, techWindowMap, airDodgeUsedSet, isEntityFrozenByHitlag, landingLagMap, lCancelWindowMap, wavedashFramesMap } from './stateMachine.js';
import { fixedMul } from './fixednum.js';

export interface Platform {
  x1: Fixed;
  x2: Fixed;
  y: Fixed;
  passThrough: boolean;
  /** When true, characters bounce slightly on landing (1.1× effective jump height). */
  bouncy?: boolean;
}

// Half-height and half-width of a fighter in world units (Q16.16)
export const FIGHTER_HALF_HEIGHT = toFixed(30);
export const FIGHTER_HALF_WIDTH  = toFixed(15);

// The set of platforms for the current stage (populated by the stage setup)
export const platforms: Platform[] = [];

export function checkPlatformLanding(
  entityId: number,
  platform: Platform,
): boolean {
  const transform = transformComponents.get(entityId);
  const phys = physicsComponents.get(entityId);
  if (!transform || !phys) return false;
  if (phys.grounded) return false;
  // Only check landing when moving downward (vy <= 0)
  if (phys.vy > 0) return false;

  const prevBottom = transform.prevY - FIGHTER_HALF_HEIGHT;
  const currBottom = transform.y - FIGHTER_HALF_HEIGHT;

  // Continuous: did the bottom edge cross the platform surface Y this frame?
  if (prevBottom >= platform.y && currBottom < platform.y) {
    if (transform.x >= platform.x1 && transform.x <= platform.x2) {
      // Pass-through: if holding down, drop through
      const fighter = fighterComponents.get(entityId);
      if (platform.passThrough && fighter) {
        // Check input via the fighter's associated input (injected externally)
        if (getEntityPassThroughInput(entityId)) return false;
      }
      return true;
    }
  }
  return false;
}

// Called by the collision system each physics step
export function platformCollisionSystem(): void {
  for (const [id, phys] of physicsComponents) {
    // Skip collision detection for entities frozen by hitlag.
    if (isEntityFrozenByHitlag(id)) continue;

    if (phys.grounded) {
      // Re-check: is the entity still above the platform it landed on?
      const transform = transformComponents.get(id);
      if (transform) {
        let stillGrounded = false;
        for (const platform of platforms) {
          const bottom = transform.y - FIGHTER_HALF_HEIGHT;
          if (
            Math.abs(bottom - platform.y) <= FRAC_SCALE && // within 1 world unit (Q16.16)
            transform.x >= platform.x1 &&
            transform.x <= platform.x2
          ) {
            stillGrounded = true;
            break;
          }
        }
        if (!stillGrounded) {
          phys.grounded = false;
        }
      }
      continue;
    }

    for (const platform of platforms) {
      if (checkPlatformLanding(id, platform)) {
        const transform = transformComponents.get(id)!;
        transform.y      = platform.y + FIGHTER_HALF_HEIGHT;
        // Bouncy platforms give a small upward velocity on landing (≈1.1× jump height).
        phys.vy          = platform.bouncy ? toFixed(1.5) : 0;
        phys.grounded    = !platform.bouncy;
        phys.fastFalling = false;

        // Clear air-dodge used flag on landing.
        airDodgeUsedSet.delete(id);

        const fighter = fighterComponents.get(id);
        if (fighter) {
          fighter.jumpCount = 0;

          if (platform.bouncy) {
            // Bouncy platforms keep the fighter airborne; stay in jump state so
            // gravity and aerial movement rules continue to apply correctly.
            transitionFighterState(id, 'jump');
          } else if (fighter.state === 'hitstun' && fighter.hitstunFrames > 0) {
            // Floor tech: if shield was pressed within the tech window, apply a
            // tech. The stick direction at the moment of the tech determines
            // whether the fighter rolls left, rolls right, or stays in place.
            const techWin = techWindowMap.get(id) ?? 0;
            if (getEntityShieldInput(id) && techWin > 0) {
              fighter.hitstunFrames = 0;
              techWindowMap.set(id, 0);
              fighter.invincibleFrames = TECH_INVINCIBILITY_FRAMES;

              const stickX = getEntityStickX(id);
              if (stickX > TECH_STICK_THRESHOLD) {
                // Tech roll right
                transitionFighterState(id, 'rolling');
                phys.vx = fixedMul(fighter.stats.runSpeed, TECH_ROLL_SPEED);
                transform.facingRight = true;
                dodgeFramesMap.set(id, TECH_ROLL_TOTAL_FRAMES);
              } else if (stickX < -TECH_STICK_THRESHOLD) {
                // Tech roll left
                transitionFighterState(id, 'rolling');
                phys.vx = fixedNeg(fixedMul(fighter.stats.runSpeed, TECH_ROLL_SPEED));
                transform.facingRight = false;
                dodgeFramesMap.set(id, TECH_ROLL_TOTAL_FRAMES);
              } else {
                // Tech in place
                transitionFighterState(id, 'idle');
              }
            } else {
              fighter.hitstunFrames = 30;
            }
          } else if (
            fighter.state === 'jump' ||
            fighter.state === 'doubleJump'
          ) {
            transitionFighterState(id, 'idle');
          } else if (fighter.state === 'airDodge') {
            // Waveland / wavedash: preserve horizontal momentum from the air dodge
            // for WAVEDASH_FRAMES frames using friction-based deceleration.
            // If vx == 0 (e.g. pure vertical air dodge), no slide occurs.
            const wasMoving = phys.vx !== 0;
            transitionFighterState(id, 'idle');
            if (wasMoving) {
              wavedashFramesMap.set(id, WAVEDASH_FRAMES);
            }
          } else if (fighter.state === 'attack' && fighter.currentMoveId !== null) {
            // Landing while in an aerial attack: apply landing lag.
            // L-cancel: pressing shield within L_CANCEL_WINDOW frames before
            // landing halves the lag (a core SSB64/Melee mechanic).
            const move = getAttackLandingLag(id, fighter.currentMoveId);
            const rawLag = move?.landingLag ?? 4;
            if (rawLag > 0) {
              const lCancelActive = (lCancelWindowMap.get(id) ?? 0) > 0;
              // Integer halving ensures identical results across all platforms
              // (determinism requirement). >> 1 === floor(rawLag/2); add 1 first
              // to round up odd values (e.g. 7 → 4, not 3).
              const lag = lCancelActive ? (rawLag + 1) >> 1 : rawLag;
              landingLagMap.set(id, lag);
              lCancelWindowMap.delete(id);
            }
            // Clear attack state on landing
            fighter.currentMoveId = null;
            fighter.attackFrame   = 0;
            transitionFighterState(id, 'idle');
          }
        }
        break;
      }
    }
  }
}

// Per-entity pass-through input flag; set by the input system each frame.
// Entries are removed when the flag is cleared to prevent stale accumulation.
const passThroughInputs = new Map<number, boolean>();

// ── Landing lag lookup (injected by main.ts to avoid circular deps) ───────────

type LandingLagLookup = (entityId: number, moveId: string) => import('../ecs/component.js').Move | undefined;
let _landingLagLookup: LandingLagLookup | null = null;

/** Register the move-lookup function for landing lag resolution. */
export function setLandingLagLookup(fn: LandingLagLookup): void {
  _landingLagLookup = fn;
}

function getAttackLandingLag(entityId: number, moveId: string): import('../ecs/component.js').Move | undefined {
  return _landingLagLookup?.(entityId, moveId);
}

export function setEntityPassThroughInput(entityId: number, down: boolean): void {
  if (down) {
    passThroughInputs.set(entityId, true);
  } else {
    passThroughInputs.delete(entityId);
  }
}

export function getEntityPassThroughInput(entityId: number): boolean {
  return passThroughInputs.get(entityId) ?? false;
}

export function clearPassThroughInputs(): void {
  passThroughInputs.clear();
}

// Per-entity shield input; set by the input system each frame.
const shieldInputs = new Map<number, boolean>();

export function setEntityShieldInput(entityId: number, shielding: boolean): void {
  if (shielding) {
    shieldInputs.set(entityId, true);
  } else {
    shieldInputs.delete(entityId);
  }
}

export function getEntityShieldInput(entityId: number): boolean {
  return shieldInputs.get(entityId) ?? false;
}

// Per-entity main-stick X input; used by tech-roll and shield-interaction code.
const stickXInputs = new Map<number, number>();

export function setEntityStickX(entityId: number, stickX: number): void {
  stickXInputs.set(entityId, stickX);
}

export function getEntityStickX(entityId: number): number {
  return stickXInputs.get(entityId) ?? 0;
}

// ── Shield-hit constants ───────────────────────────────────────────────────────

/**
 * Fraction of an attack's damage dealt to the shield when blocked.
 * Shields take 70 % of the raw hitbox damage (to match SSB64/Melee feel).
 */
const SHIELD_DAMAGE_RATIO = 0.7;

/**
 * Velocity magnitude pushed onto the attacker when their move is shielded
 * (shield-pushback). Applied away from the victim so both fighters separate.
 */
const SHIELD_PUSHBACK = toFixed(3.0);

// ── Tech-roll constants ────────────────────────────────────────────────────────

/** Frames the fighter is invincible during/after a tech or tech roll. */
const TECH_INVINCIBILITY_FRAMES = 10;

/**
 * Duration of a tech roll in frames (matches normal roll but slightly shorter
 * to reward the skill of teching with direction).
 */
const TECH_ROLL_TOTAL_FRAMES = 25;

/** Q16.16 speed multiplier for the lateral movement during a tech roll. */
const TECH_ROLL_SPEED = toFixed(0.7); // same as normal roll

/** Stick threshold to decide left/right tech roll vs. tech-in-place. */
const TECH_STICK_THRESHOLD = 0.5;

/**
 * Frames of wavedash/waveland momentum preservation after landing from
 * an air dodge with non-zero horizontal velocity.  During these frames,
 * ground movement applies friction decay instead of an instant stop.
 */
const WAVEDASH_FRAMES = 10;

// ── Hit registry ──────────────────────────────────────────────────────────────

/**
 * Tracks hits that have already landed this move instance.
 * Key format: `${attackerEntityId}_${hitbox.id}_${victimEntityId}`
 */
export const hitRegistry = new Set<string>();

/**
 * Remove all hit-registry entries belonging to a specific attacker.
 * Call when the attacker's move ends so the hitboxes can re-hit on reuse.
 * If called with no argument, clears the entire registry (e.g. on match reset).
 */
export function clearHitRegistry(attackerEntityId?: EntityId): void {
  if (attackerEntityId === undefined) {
    hitRegistry.clear();
    return;
  }
  const prefix = `${attackerEntityId}_`;
  for (const key of hitRegistry) {
    if (key.startsWith(prefix)) {
      hitRegistry.delete(key);
    }
  }
}

// ── AABB overlap ──────────────────────────────────────────────────────────────

/**
 * Returns true when two axis-aligned bounding boxes (described by their
 * centre positions and full width/height in Q16.16) overlap.
 */
function aabbOverlap(
  ax: Fixed, ay: Fixed, aw: Fixed, ah: Fixed,
  bx: Fixed, by: Fixed, bw: Fixed, bh: Fixed,
): boolean {
  // Sum of half-widths / half-heights using integer right-shift (÷2 in Q16.16).
  const halfWidthSum  = (fixedAdd(aw, bw)) >> 1;
  const halfHeightSum = (fixedAdd(ah, bh)) >> 1;

  const dx = ax > bx ? fixedSub(ax, bx) : fixedSub(bx, ax);
  const dy = ay > by ? fixedSub(ay, by) : fixedSub(by, ay);

  return dx < halfWidthSum && dy < halfHeightSum;
}

// ── Ledge grab constants ──────────────────────────────────────────────────────

/** Size of the grab-hand detection box in world units (Q16.16). */
const LEDGE_GRAB_BOX = toFixed(8);

/** Frames a fighter can cling to a ledge before being forced off. */
const LEDGE_HANG_MAX_FRAMES = 300; // 5 s at 60 Hz

/** Cooldown applied to a ledge after a fighter releases it, in frames. */
const LEDGE_RELEASE_COOLDOWN = 60; // 1 s at 60 Hz

// ── Hitbox system ─────────────────────────────────────────────────────────────

/**
 * Scan all active hitboxes against all active hurtboxes.
 *
 * @param fighters   - All fighter entity IDs participating in the match.
 * @param moveData   - Map<characterId, Map<moveName, Move>> — static move tables.
 * @param inputMap   - Optional map of entity ID → current InputState, used to
 *                     read the victim's stickX for Directional Influence (DI).
 */
export function checkHitboxSystem(
  fighters: EntityId[],
  moveData: Map<string, Map<string, Move>>,
  inputMap?: ReadonlyMap<EntityId, InputState>,
): void {
  for (const attackerId of fighters) {
    const attackerFighter    = fighterComponents.get(attackerId);
    const attackerTransform  = transformComponents.get(attackerId);
    if (!attackerFighter || !attackerTransform) continue;
    if (attackerFighter.state !== 'attack') continue;
    if (!attackerFighter.currentMoveId) continue;

    const charMoves = moveData.get(attackerFighter.characterId);
    if (!charMoves) continue;

    const move = charMoves.get(attackerFighter.currentMoveId);
    if (!move) continue;

    const frame         = attackerFighter.attackFrame;
    const facingRight   = attackerTransform.facingRight;

    for (const hitbox of move.hitboxes) {
      if (frame < hitbox.activeFrames[0] || frame > hitbox.activeFrames[1]) continue;

      // World-space centre of the hitbox, flipped when attacker faces left.
      const hbWorldX = facingRight
        ? fixedAdd(attackerTransform.x, hitbox.offsetX)
        : fixedSub(attackerTransform.x, hitbox.offsetX);
      const hbWorldY = fixedAdd(attackerTransform.y, hitbox.offsetY);

      for (const victimId of fighters) {
        if (victimId === attackerId) continue;

        const victimFighter   = fighterComponents.get(victimId);
        const victimTransform = transformComponents.get(victimId);
        if (!victimFighter || !victimTransform) continue;
        if (victimFighter.invincibleFrames > 0) continue;

        const registryKey = `${attackerId}_${hitbox.id}_${victimId}`;
        if (hitRegistry.has(registryKey)) continue;

        // Determine the victim's active hurtbox.
        // Use a move-specific hurtbox when available; fall back to the base box.
        let hurtX: Fixed = victimTransform.x;
        let hurtY: Fixed = victimTransform.y;
        let hurtW: Fixed = FIGHTER_HALF_WIDTH  << 1; // 2 * FIGHTER_HALF_WIDTH
        let hurtH: Fixed = FIGHTER_HALF_HEIGHT << 1; // 2 * FIGHTER_HALF_HEIGHT

        if (victimFighter.currentMoveId && victimFighter.state === 'attack') {
          const victimCharMoves = moveData.get(victimFighter.characterId);
          const victimMove = victimCharMoves?.get(victimFighter.currentMoveId);
          if (victimMove) {
            const vFrame = victimFighter.attackFrame;
            const activeHurtbox = victimMove.hurtboxes.find(
              hb => vFrame >= hb.activeFrames[0] && vFrame <= hb.activeFrames[1],
            );
            if (activeHurtbox && !activeHurtbox.intangible && !activeHurtbox.invincible) {
              const hbOffX = victimTransform.facingRight
                ? activeHurtbox.offsetX
                : fixedNeg(activeHurtbox.offsetX);
              hurtX = fixedAdd(victimTransform.x, hbOffX);
              hurtY = fixedAdd(victimTransform.y, activeHurtbox.offsetY);
              hurtW = activeHurtbox.width;
              hurtH = activeHurtbox.height;
            }
          }
        }

        // Crouch: smaller hurtbox — feet stay at the same position but the top
        // of the box is only half as high, making the fighter harder to hit with
        // attacks aimed at the upper body.
        if (victimFighter.state === 'crouch') {
          hurtH = FIGHTER_HALF_HEIGHT;                          // half normal height
          hurtY = fixedSub(victimTransform.y, FIGHTER_HALF_HEIGHT >> 1); // shift centre down
        }

        if (!aabbOverlap(hbWorldX, hbWorldY, hitbox.width, hitbox.height,
                          hurtX,    hurtY,    hurtW,       hurtH)) continue;

        // ── Hit confirmed ─────────────────────────────────────────────────
        hitRegistry.add(registryKey);

        // ── Shield hit: attack absorbed by an active shield ───────────────
        if (victimFighter.state === 'shielding') {
          // Deal shield damage (fraction of raw hitbox damage).
          const shieldDamage = hitbox.damage * SHIELD_DAMAGE_RATIO;
          victimFighter.shieldHealth -= shieldDamage;

          // Freeze both combatants for hitlag (same as a normal hit — creates
          // the "shield-hit lag" window used for shield pressure timing).
          const hitlag = computeHitlagFrames(hitbox.damage);
          hitlagMap.set(attackerId, hitlag);
          attackerFighter.hitlagFrames = hitlag;
          hitlagMap.set(victimId, hitlag);
          victimFighter.hitlagFrames = hitlag;

          // Push the attacker away from the shielding victim (shield pushback).
          const attackerPhys = physicsComponents.get(attackerId);
          if (attackerPhys) {
            attackerPhys.vx = facingRight
              ? fixedNeg(SHIELD_PUSHBACK)
              : SHIELD_PUSHBACK;
          }

          // If the shield is broken, trigger shield-break stun.
          if (victimFighter.shieldHealth <= 0) {
            victimFighter.shieldHealth = 0;
            transitionFighterState(victimId, 'idle', { shieldBreakFrames: 180 });
          }
          continue;
        }

        // ── Normal hit ────────────────────────────────────────────────────

        // Read victim's DI stick input (clamped to ±1) for Directional
        // Influence. Only the first frame of hitstun uses DI (applied once
        // by applyKnockback). If no inputMap provided, DI is 0 (neutral).
        const diX = inputMap?.get(victimId)?.stickX ?? 0;

        applyKnockback(victimId, {
          victimDamage:       fixedAdd(victimFighter.damagePercent, toFixed(hitbox.damage)),
          victimWeight:       victimFighter.stats.weightClass,
          moveScaling:        hitbox.knockbackScaling,
          moveBaseKnockback:  hitbox.baseKnockback,
          launchAngle:        hitbox.launchAngle,
          attackerFacingRight: facingRight,
          diX,
        });

        // Accumulate damage on victim.
        victimFighter.damagePercent = fixedAdd(
          victimFighter.damagePercent,
          toFixed(hitbox.damage),
        );

        // Freeze both combatants for hitlag.
        const hitlag = computeHitlagFrames(hitbox.damage);
        hitlagMap.set(attackerId, hitlag);
        attackerFighter.hitlagFrames = hitlag;
        hitlagMap.set(victimId, hitlag);
        victimFighter.hitlagFrames = hitlag;
      }
    }
  }
}

// ── Ledge grab system ─────────────────────────────────────────────────────────

/**
 * Detect and resolve ledge grabs for all airborne, falling fighters.
 * Also maintains ledge occupancy state and decrements ledge cooldowns.
 */
export function ledgeGrabSystem(): void {
  // 1. Release stale ledge occupants (fighter left ledgeHang state externally).
  for (const [, ledge] of ledgeColliderComponents) {
    if (ledge.occupiedByEntityId !== null) {
      const occupantFighter = fighterComponents.get(ledge.occupiedByEntityId);
      if (!occupantFighter || occupantFighter.state !== 'ledgeHang') {
        ledge.occupiedByEntityId = null;
        ledge.cooldownFrames     = LEDGE_RELEASE_COOLDOWN;
      }
    }

    // Decrement per-ledge cooldown.
    if (ledge.cooldownFrames > 0) {
      ledge.cooldownFrames--;
    }
  }

  // 2. Try to grab ledges for falling airborne fighters.
  for (const [entityId, phys] of physicsComponents) {
    if (phys.grounded) continue;
    if (phys.vy >= 0) continue; // only check when falling (vy < 0)

    const fighter   = fighterComponents.get(entityId);
    const transform = transformComponents.get(entityId);
    if (!fighter || !transform) continue;
    if (fighter.state === 'KO' || fighter.state === 'hitstun') continue;

    // Grab-hand position: top corner on the side the fighter faces.
    const grabHandX: Fixed = transform.facingRight
      ? fixedAdd(transform.x, FIGHTER_HALF_WIDTH)
      : fixedSub(transform.x, FIGHTER_HALF_WIDTH);
    const grabHandY: Fixed = fixedAdd(transform.y, FIGHTER_HALF_HEIGHT);

    for (const [, ledge] of ledgeColliderComponents) {
      if (ledge.occupiedByEntityId !== null) continue;
      if (ledge.cooldownFrames > 0) continue;

      if (!aabbOverlap(
        grabHandX,  grabHandY,  LEDGE_GRAB_BOX, LEDGE_GRAB_BOX,
        ledge.x,    ledge.y,    toFixed(1),     toFixed(1),
      )) continue;

      // ── Ledge grab confirmed ──────────────────────────────────────────
      ledge.occupiedByEntityId = entityId;

      phys.vx       = toFixed(0);
      phys.vy       = toFixed(0);
      phys.grounded = false;
      fighter.jumpCount = 0; // refresh jumps

      transitionFighterState(entityId, 'ledgeHang', {
        ledgeHangFrames: LEDGE_HANG_MAX_FRAMES,
      });

      break; // a fighter can only grab one ledge at a time
    }
  }
}

// ── Fighter body collision ────────────────────────────────────────────────────

/**
 * Prevent fighters from passing through each other.
 * For each overlapping pair, push them apart along the X axis by half the
 * penetration depth and zero out the velocity component that drives the
 * overlap so they don't immediately re-enter each other.
 *
 * Only horizontal separation is applied; vertical pass-through is intentional
 * (fighters can jump over each other), but if two fighters are at the same
 * height the separation keeps them side-by-side.
 */
export function fighterBodyCollisionSystem(entityIds: EntityId[]): void {
  const FULL_WIDTH  = FIGHTER_HALF_WIDTH  << 1; // toFixed(30) — full fighter width (diameter)
  const FULL_HEIGHT = FIGHTER_HALF_HEIGHT << 1; // toFixed(60) — full fighter height (diameter)

  for (let i = 0; i < entityIds.length; i++) {
    for (let j = i + 1; j < entityIds.length; j++) {
      const idA = entityIds[i]!;
      const idB = entityIds[j]!;

      const tA = transformComponents.get(idA);
      const tB = transformComponents.get(idB);
      const pA = physicsComponents.get(idA);
      const pB = physicsComponents.get(idB);
      const fA = fighterComponents.get(idA);
      const fB = fighterComponents.get(idB);

      if (!tA || !tB || !pA || !pB || !fA || !fB) continue;

      // Don't separate fighters that are KO'd — blast-zone logic owns them.
      if (fA.state === 'KO' || fB.state === 'KO') continue;

      // Check Y overlap first — if they're on very different heights they
      // haven't collided (one jumped over the other).
      const dy = tA.y > tB.y ? fixedSub(tA.y, tB.y) : fixedSub(tB.y, tA.y);
      if (dy >= FULL_HEIGHT) continue;

      // Check X overlap.
      const dx = tA.x > tB.x ? fixedSub(tA.x, tB.x) : fixedSub(tB.x, tA.x);
      if (dx >= FULL_WIDTH) continue;

      // Penetration depth and half-separation in Q16.16.
      const penetration = fixedSub(FULL_WIDTH, dx);
      const halfSep     = penetration >> 1;

      if (tA.x >= tB.x) {
        // A is to the right: push A further right, B further left.
        tA.x = fixedAdd(tA.x, halfSep);
        tB.x = fixedSub(tB.x, halfSep);
        // Clamp velocities so the fighters don't immediately re-penetrate.
        if (pA.vx < 0) pA.vx = toFixed(0);
        if (pB.vx > 0) pB.vx = toFixed(0);
      } else {
        // A is to the left: push A further left, B further right.
        tA.x = fixedSub(tA.x, halfSep);
        tB.x = fixedAdd(tB.x, halfSep);
        if (pA.vx > 0) pA.vx = toFixed(0);
        if (pB.vx < 0) pB.vx = toFixed(0);
      }
    }
  }
}
