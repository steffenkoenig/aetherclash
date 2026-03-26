// src/engine/physics/gravity.ts
// Applies gravity each frame to all airborne entities.

import { toFixed, fixedAdd, fixedMul } from './fixednum.js';
import {
  physicsComponents,
  fighterComponents,
} from '../ecs/component.js';

// Gravity constant: −0.09 units/frame² (Q16.16)
export const GRAVITY = toFixed(-0.09);

export function applyGravitySystem(): void {
  for (const [id, phys] of physicsComponents) {
    if (phys.grounded) continue;

    const fighter = fighterComponents.get(id);
    if (fighter?.state === 'ledgeHang') continue;

    // Determine gravity multiplier
    let gravMul = phys.gravityMultiplier;
    if (fighter?.state === 'airDodge') {
      gravMul = toFixed(1.5);
    }

    phys.vy = fixedAdd(phys.vy, fixedMul(GRAVITY, gravMul));

    // Clamp to terminal velocity
    if (fighter) {
      const termVel = phys.fastFalling
        ? fighter.stats.maxFastFallSpeed
        : fighter.stats.maxFallSpeed;
      if (phys.vy < termVel) {
        phys.vy = termVel;
      }
    }
  }
}
