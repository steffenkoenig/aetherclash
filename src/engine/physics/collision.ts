// src/engine/physics/collision.ts
// Continuous AABB-vs-line-segment platform collision detection.
// Phase 2 additions: hitbox/hurtbox checking, hit registry, ledge grab detection.

import type { Fixed } from './fixednum.js';
import { toFixed, fixedAdd, fixedSub, FRAC_SCALE } from './fixednum.js';
import {
  transformComponents,
  physicsComponents,
  fighterComponents,
  moveRegistries,
} from '../ecs/component.js';
import type { Hitbox, Hurtbox } from '../ecs/component.js';
import { applyHit } from './knockback.js';
import { transitionFighterState } from './stateMachine.js';

// ── Platform ──────────────────────────────────────────────────────────────────

export interface Platform {
  x1: Fixed;
  x2: Fixed;
  y: Fixed;
  passThrough: boolean;
}

// Half-dimensions of a fighter in world units (Q16.16)
export const FIGHTER_HALF_HEIGHT = toFixed(30);
export const FIGHTER_HALF_WIDTH  = toFixed(15);

// Default body hurtbox dimensions
const DEFAULT_HURTBOX_WIDTH  = toFixed(30);
const DEFAULT_HURTBOX_HEIGHT = toFixed(60);

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
        // Snap to surface
        transform.y = platform.y + FIGHTER_HALF_HEIGHT;
        phys.vy = 0;
        phys.grounded = true;
        phys.fastFalling = false;

        const fighter = fighterComponents.get(id);
        if (fighter) {
          fighter.jumpCount = 0;
          if (
            fighter.state === 'jump' ||
            fighter.state === 'doubleJump' ||
            fighter.state === 'airDodge'
          ) {
            fighter.state = 'idle';
          }
        }
        break;
      }
    }
  }
}

// Per-entity pass-through input flag; set by the input system each frame.
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

// ── Hitbox / Hurtbox AABB check ───────────────────────────────────────────────

/**
 * Test AABB overlap between two axis-aligned rectangles.
 * Each rectangle is described by its centre (cx, cy) and half-dimensions (hw, hh).
 * All values are Fixed.
 */
export function aabbOverlap(
  cx1: Fixed, cy1: Fixed, hw1: Fixed, hh1: Fixed,
  cx2: Fixed, cy2: Fixed, hw2: Fixed, hh2: Fixed,
): boolean {
  return (
    Math.abs(cx1 - cx2) < hw1 + hw2 &&
    Math.abs(cy1 - cy2) < hh1 + hh2
  );
}

// Hit registry: prevents the same hitbox from registering on the same victim twice.
// Key format: "attackerId_hitboxId_victimId"
const hitRegistry = new Set<string>();

/** Clear hit registry entries for a specific attacker's move (call when a move ends). */
export function clearHitRegistry(attackerId: number): void {
  for (const key of hitRegistry) {
    if (key.startsWith(`${attackerId}_`)) {
      hitRegistry.delete(key);
    }
  }
}

/** Clear all hit registry entries (call at match start/reset). */
export function resetHitRegistry(): void {
  hitRegistry.clear();
}

/**
 * Return the active hitboxes for an entity given its current move frame.
 */
export function getActiveHitboxes(entityId: number): Hitbox[] {
  const fighter = fighterComponents.get(entityId);
  if (!fighter || fighter.state !== 'attack') return [];
  const moveId = fighter.currentMoveId;
  if (!moveId) return [];
  const moves = moveRegistries.get(fighter.characterId);
  if (!moves) return [];
  const move = moves[moveId];
  if (!move) return [];
  const frame = fighter.currentMoveFrame ?? 0;
  return move.hitboxes.filter(h => frame >= h.activeFrames[0] && frame <= h.activeFrames[1]);
}

/**
 * Return the active hurtboxes for an entity given its current move frame.
 * Falls back to the default full-body hurtbox if none are defined.
 */
export function getActiveHurtboxes(entityId: number): Hurtbox[] {
  const fighter = fighterComponents.get(entityId);
  if (!fighter) return [];
  const moveId = fighter.currentMoveId;
  if (!moveId) {
    // Default: full body hurtbox centred on the fighter
    return [{
      offsetX: toFixed(0),
      offsetY: toFixed(0),
      width:   DEFAULT_HURTBOX_WIDTH,
      height:  DEFAULT_HURTBOX_HEIGHT,
      activeFrames: [0, 9999],
    }];
  }
  const moves = moveRegistries.get(fighter.characterId);
  if (!moves) return [];
  const move = moves[moveId];
  if (!move || move.hurtboxes.length === 0) {
    return [{
      offsetX: toFixed(0),
      offsetY: toFixed(0),
      width:   DEFAULT_HURTBOX_WIDTH,
      height:  DEFAULT_HURTBOX_HEIGHT,
      activeFrames: [0, 9999],
    }];
  }
  const frame = fighter.currentMoveFrame ?? 0;
  return move.hurtboxes.filter(h => frame >= h.activeFrames[0] && frame <= h.activeFrames[1]);
}

/**
 * System: check hitboxes of all attacking fighters against hurtboxes of all others.
 * Applies hits via applyHit(); respects the hit registry (single-hit-per-move guarantee).
 *
 * @param diInputMap  Optional map of entityId → stickX for DI (defaults to 0 for all)
 */
export function hitboxSystem(diInputMap?: Map<number, number>): void {
  const entities = [...fighterComponents.keys()];

  for (const attackerId of entities) {
    const attacker = fighterComponents.get(attackerId)!;
    // Skip hitlag frames (both attacker and victim are frozen)
    if ((attacker.hitlagFrames ?? 0) > 0) continue;
    if (attacker.state !== 'attack') continue;

    const activeHitboxes = getActiveHitboxes(attackerId);
    if (activeHitboxes.length === 0) continue;

    const attackerTransform = transformComponents.get(attackerId);
    if (!attackerTransform) continue;

    for (const victimId of entities) {
      if (victimId === attackerId) continue;
      const victim = fighterComponents.get(victimId)!;

      // Invincible / already in KO
      if (victim.invincibleFrames > 0 || victim.state === 'KO') continue;
      // Victim also frozen during hitlag
      if ((victim.hitlagFrames ?? 0) > 0) continue;

      const victimTransform = transformComponents.get(victimId);
      if (!victimTransform) continue;

      const activeHurtboxes = getActiveHurtboxes(victimId);

      for (const hitbox of activeHitboxes) {
        const registryKey = `${attackerId}_${hitbox.id}_${victimId}`;
        if (hitRegistry.has(registryKey)) continue; // already hit

        // Compute world-space hitbox centre; >> 1 divides the Fixed integer by 2
        // which correctly computes half the fixed-point width/height value.
        const hbCX = fixedAdd(attackerTransform.x, hitbox.offsetX);
        const hbCY = fixedAdd(attackerTransform.y, hitbox.offsetY);
        const hbHW = hitbox.width  >> 1;
        const hbHH = hitbox.height >> 1;

        for (const hurtbox of activeHurtboxes) {
          const hurtCX = fixedAdd(victimTransform.x, hurtbox.offsetX);
          const hurtCY = fixedAdd(victimTransform.y, hurtbox.offsetY);
          const hurtHW = hurtbox.width  >> 1;
          const hurtHH = hurtbox.height >> 1;

          if (aabbOverlap(hbCX, hbCY, hbHW, hbHH, hurtCX, hurtCY, hurtHW, hurtHH)) {
            hitRegistry.add(registryKey);
            const di = diInputMap?.get(victimId) ?? 0;
            applyHit(
              attackerId,
              victimId,
              hitbox.damage,
              hitbox.knockbackScaling,
              hitbox.baseKnockback,
              hitbox.launchAngle,
              di,
            );
            break; // one hitbox overlap is enough per victim per frame
          }
        }
      }
    }
  }
}

// ── Ledge colliders ───────────────────────────────────────────────────────────

export interface LedgeCollider {
  x: Fixed;
  y: Fixed;
  /** If true, the character hangs facing right (ledge is on the left edge of a platform). */
  facingRight: boolean;
  /** Entity ID of the character currently hanging here; null = free. */
  occupied: number | null;
}

export const ledgeColliders: LedgeCollider[] = [];

/** Range (in Fixed world units) within which a grab-hand can latch onto a ledge. */
const LEDGE_GRAB_RANGE = toFixed(20);

/**
 * System: check if any airborne fighter's grab-hand overlaps an unoccupied ledge collider.
 * On a successful grab:
 *  - Snaps the fighter to the ledge
 *  - Transitions to 'ledgeHang'
 *  - Resets jumpCount (refreshes aerial jumps)
 *  - Grants 20 frames of intangibility
 */
export function ledgeGrabSystem(): void {
  for (const [id, fighter] of fighterComponents) {
    if (fighter.state === 'ledgeHang' || fighter.state === 'KO') continue;

    const phys = physicsComponents.get(id);
    if (!phys || phys.grounded) continue;
    if (phys.vy > 0) continue; // only grab while moving downward

    const transform = transformComponents.get(id);
    if (!transform) continue;

    // Grab-hand position: top of fighter, on the side the character is facing
    const grabHandX = transform.facingRight
      ? fixedAdd(transform.x,  FIGHTER_HALF_WIDTH)
      : fixedSub(transform.x, FIGHTER_HALF_WIDTH);
    const grabHandY = fixedAdd(transform.y, FIGHTER_HALF_HEIGHT);

    for (const ledge of ledgeColliders) {
      if (ledge.occupied !== null) continue; // already occupied

      const dx = Math.abs(grabHandX - ledge.x);
      const dy = Math.abs(grabHandY - ledge.y);

      if (dx < LEDGE_GRAB_RANGE && dy < LEDGE_GRAB_RANGE) {
        // Snap fighter to ledge hang position
        transform.x = ledge.facingRight
          ? fixedSub(ledge.x, FIGHTER_HALF_WIDTH)
          : fixedAdd(ledge.x, FIGHTER_HALF_WIDTH);
        transform.y = fixedSub(ledge.y, FIGHTER_HALF_HEIGHT);

        phys.vx       = toFixed(0);
        phys.vy       = toFixed(0);
        phys.grounded = false;

        // Refresh aerial jumps
        fighter.jumpCount = 0;

        // 20-frame intangibility window
        fighter.invincibleFrames = 20;

        ledge.occupied = id;

        transitionFighterState(id, 'ledgeHang', { ledgeHangFrames: 0 });
        break;
      }
    }
  }
}

/** Release a ledge when the fighter leaves the ledgeHang state. */
export function releaseLedge(entityId: number): void {
  for (const ledge of ledgeColliders) {
    if (ledge.occupied === entityId) {
      ledge.occupied = null;
      break;
    }
  }
}
