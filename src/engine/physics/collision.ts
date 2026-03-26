// src/engine/physics/collision.ts
// Continuous AABB-vs-line-segment platform collision detection.

import type { Fixed } from './fixednum.js';
import {
  transformComponents,
  physicsComponents,
  fighterComponents,
} from '../ecs/component.js';

export interface Platform {
  x1: Fixed;
  x2: Fixed;
  y: Fixed;
  passThrough: boolean;
}

// Half-height of a fighter in world units (Q16.16)
import { toFixed } from './fixednum.js';
export const FIGHTER_HALF_HEIGHT = toFixed(30);

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
    if (phys.grounded) {
      // Re-check: is the entity still above the platform it landed on?
      const transform = transformComponents.get(id);
      if (transform) {
        let stillGrounded = false;
        for (const platform of platforms) {
          const bottom = transform.y - FIGHTER_HALF_HEIGHT;
          if (
            Math.abs(bottom - platform.y) <= 1 && // within 1 Q16.16 unit
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
          if (fighter.state === 'jump' || fighter.state === 'doubleJump' || fighter.state === 'airDodge') {
            fighter.state = 'idle';
          }
        }
        break;
      }
    }
  }
}

// Per-entity pass-through input flag; set by the input system each frame
const passThroughInputs = new Map<number, boolean>();

export function setEntityPassThroughInput(entityId: number, down: boolean): void {
  passThroughInputs.set(entityId, down);
}

export function getEntityPassThroughInput(entityId: number): boolean {
  return passThroughInputs.get(entityId) ?? false;
}
