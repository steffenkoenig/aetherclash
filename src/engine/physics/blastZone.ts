// src/engine/physics/blastZone.ts
// Blast zone detection and KO/stock management.

import type { EntityId } from '../ecs/entity.js';
import type { Fixed } from './fixednum.js';
import { toFixed } from './fixednum.js';
import {
  transformComponents,
  physicsComponents,
  fighterComponents,
} from '../ecs/component.js';
import { transitionFighterState } from './stateMachine.js';

// ── Blast zone config ─────────────────────────────────────────────────────────

export interface BlastZones {
  left:   Fixed; // e.g. toFixed(-150)
  right:  Fixed; // e.g. toFixed(150)
  top:    Fixed; // e.g. toFixed(180)
  bottom: Fixed; // e.g. toFixed(-100)
}

/** Blast zones for the currently loaded stage. Set by stage setup. */
export let activeBlastZones: BlastZones = {
  left:   toFixed(-150),
  right:  toFixed(150),
  top:    toFixed(180),
  bottom: toFixed(-100),
};

export function setBlastZones(zones: BlastZones): void {
  activeBlastZones = zones;
}

// ── Respawn constants ─────────────────────────────────────────────────────────

/** Frames before control is restored after a KO (3 s at 60 Hz). */
export const RESPAWN_DELAY_FRAMES = 180;

/** Frames of post-respawn invincibility (3 s at 60 Hz). */
export const RESPAWN_INVINCIBILITY_FRAMES = 180;

/** Respawn X position — centre stage (Q16.16). */
export const RESPAWN_X: Fixed = toFixed(0);

/** Respawn Y position — above the main platform (Q16.16). */
export const RESPAWN_Y: Fixed = toFixed(200);

/** Per-entity countdown until the fighter regains control after a KO. */
export const respawnTimers = new Map<EntityId, number>();

// ── Per-entity logic ──────────────────────────────────────────────────────────

/**
 * Check whether `entityId` has crossed a blast zone boundary.
 * If so:
 *   - Decrement stocks.
 *   - If stocks reach 0: keep the fighter in KO (match-end handled externally).
 *   - Otherwise: teleport to the respawn point, reset physics, grant invincibility,
 *     reset damage, and return the fighter to idle.
 */
export function checkBlastZones(entityId: EntityId): void {
  const transform = transformComponents.get(entityId);
  const phys      = physicsComponents.get(entityId);
  const fighter   = fighterComponents.get(entityId);
  if (!transform || !phys || !fighter) return;

  const { x, y } = transform;
  const { left, right, top, bottom } = activeBlastZones;

  // Fixed values are stored as integers; ordering is preserved, so < / > are valid.
  const outOfBounds = x < left || x > right || y > top || y < bottom;
  if (!outOfBounds) return;

  fighter.stocks--;

  if (fighter.stocks <= 0) {
    // No stocks remain — lock into KO; match termination is handled externally.
    transitionFighterState(entityId, 'KO');
    return;
  }

  // Respawn
  transform.x    = RESPAWN_X;
  transform.y    = RESPAWN_Y;
  transform.prevX = RESPAWN_X;
  transform.prevY = RESPAWN_Y;

  phys.vx       = toFixed(0);
  phys.vy       = toFixed(0);
  phys.grounded = false;

  fighter.damagePercent    = toFixed(0);
  fighter.invincibleFrames = RESPAWN_INVINCIBILITY_FRAMES;

  respawnTimers.set(entityId, RESPAWN_DELAY_FRAMES);

  transitionFighterState(entityId, 'idle');
}

// ── System ────────────────────────────────────────────────────────────────────

/** Run blast-zone checks for every registered fighter. Call once per physics frame. */
export function blastZoneSystem(): void {
  for (const [id] of fighterComponents) {
    checkBlastZones(id);
  }
}
