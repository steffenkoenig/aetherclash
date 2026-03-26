// src/game/characters/syne.ts
// Stats and move-set data for Syne — The Projectile Tactician (Light, w=0.8)

import { toFixed } from '../../engine/physics/fixednum.js';
import type { FighterStats, Move } from '../../engine/ecs/component.js';
import { moveRegistries } from '../../engine/ecs/component.js';

export const SYNE_STATS: FighterStats = {
  maxFallSpeed:     toFixed(-0.70),
  maxFastFallSpeed: toFixed(-1.40),
  jumpForce:        toFixed(1.14),
  doubleJumpForce:  toFixed(0.93),
  walkSpeed:        toFixed(0.525),
  runSpeed:         toFixed(1.09),
  weightClass:      toFixed(0.8),
  shieldHealthMax:  toFixed(95),
};

export const SYNE_MOVES: Record<string, Move> = {
  neutralJab1: {
    totalFrames: 16,
    hitboxes: [{
      activeFrames:    [3, 5],
      offsetX:         toFixed(18),
      offsetY:         toFixed(0),
      width:           toFixed(24),
      height:          toFixed(24),
      damage:          4,
      knockbackScaling: toFixed(0.7),
      baseKnockback:   toFixed(2),
      launchAngle:     45,
      hitlagFrames:    4,
      id:              'syne_jab1_0',
    }],
    hurtboxes: [{ activeFrames: [0, 15], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(26), height: toFixed(56) }],
    iasa: 9,
  },

  neutralJab2: {
    totalFrames: 16,
    hitboxes: [{
      activeFrames:    [3, 5],
      offsetX:         toFixed(18),
      offsetY:         toFixed(0),
      width:           toFixed(24),
      height:          toFixed(24),
      damage:          4,
      knockbackScaling: toFixed(0.7),
      baseKnockback:   toFixed(2),
      launchAngle:     45,
      hitlagFrames:    4,
      id:              'syne_jab2_0',
    }],
    hurtboxes: [{ activeFrames: [0, 15], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(26), height: toFixed(56) }],
    iasa: 9,
  },

  forwardSmash: {
    totalFrames: 60,
    hitboxes: [{
      activeFrames:    [24, 34],
      offsetX:         toFixed(50),
      offsetY:         toFixed(5),
      width:           toFixed(56),
      height:          toFixed(26),
      damage:          16,
      knockbackScaling: toFixed(1.4),
      baseKnockback:   toFixed(9),
      launchAngle:     38,
      hitlagFrames:    5,
      id:              'syne_fsmash_0',
    }],
    hurtboxes: [{ activeFrames: [0, 59], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(26), height: toFixed(56) }],
    iasa: 48,
  },

  backAir: {
    totalFrames: 28,
    hitboxes: [{
      activeFrames:    [5, 9],
      offsetX:         toFixed(-28),
      offsetY:         toFixed(5),
      width:           toFixed(28),
      height:          toFixed(26),
      damage:          12,
      knockbackScaling: toFixed(1.2),
      baseKnockback:   toFixed(6),
      launchAngle:     165,
      hitlagFrames:    4,
      id:              'syne_bair_0',
    }],
    hurtboxes: [{ activeFrames: [0, 27], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(26), height: toFixed(56) }],
    iasa: 20,
    landingLag: 10,
  },

  neutralAir: {
    totalFrames: 28,
    hitboxes: [{
      activeFrames:    [4, 16],
      offsetX:         toFixed(0),
      offsetY:         toFixed(0),
      width:           toFixed(36),
      height:          toFixed(60),
      damage:          7,
      knockbackScaling: toFixed(0.9),
      baseKnockback:   toFixed(3),
      launchAngle:     50,
      hitlagFrames:    4,
      id:              'syne_nair_0',
    }],
    hurtboxes: [{ activeFrames: [0, 27], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(26), height: toFixed(56) }],
    iasa: 20,
    landingLag: 8,
  },
};

moveRegistries.set('syne', SYNE_MOVES);
