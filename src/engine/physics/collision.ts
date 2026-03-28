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
import { hitlagMap, transitionFighterState, techWindowMap, airDodgeUsedSet, isEntityFrozenByHitlag } from './stateMachine.js';

export interface Platform {
  x1: Fixed;
  x2: Fixed;
  y: Fixed;
  passThrough: boolean;
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
        phys.vy          = 0;
        phys.grounded    = true;
        phys.fastFalling = false;

        // Clear air-dodge used flag on landing.
        airDodgeUsedSet.delete(id);

        const fighter = fighterComponents.get(id);
        if (fighter) {
          fighter.jumpCount = 0;

          if (fighter.state === 'hitstun' && fighter.hitstunFrames > 0) {
            // Floor tech: if shield was pressed within the tech window, normal landing.
            // Otherwise, add hard-knockdown frames (stay in grounded hitstun).
            const techWin = techWindowMap.get(id) ?? 0;
            if (getEntityShieldInput(id) && techWin > 0) {
              fighter.hitstunFrames = 0;
              techWindowMap.set(id, 0);
              transitionFighterState(id, 'idle');
            } else {
              fighter.hitstunFrames = 30;
            }
          } else if (
            fighter.state === 'jump' ||
            fighter.state === 'doubleJump' ||
            fighter.state === 'airDodge'
          ) {
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

        if (!aabbOverlap(hbWorldX, hbWorldY, hitbox.width, hitbox.height,
                          hurtX,    hurtY,    hurtW,       hurtH)) continue;

        // ── Hit confirmed ─────────────────────────────────────────────────
        hitRegistry.add(registryKey);

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
