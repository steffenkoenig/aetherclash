// src/game/characters/kael.ts
// Character stats for Kael (default character)

import { toFixed } from '../../engine/physics/fixednum.js';
import type { FighterStats } from '../../engine/ecs/component.js';

export const KAEL_STATS: FighterStats = {
  maxFallSpeed:     toFixed(-0.85),
  maxFastFallSpeed: toFixed(-1.60),
  jumpForce:        toFixed(1.2),
  doubleJumpForce:  toFixed(1.0),
  walkSpeed:        toFixed(0.6),
  runSpeed:         toFixed(1.2),
  weightClass:      toFixed(1.0),
};
