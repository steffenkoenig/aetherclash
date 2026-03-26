// src/game/characters/gorun.ts
// Stats and move-set data for Gorun — The Heavy Vanguard (Super-Heavy, w=1.7)

import { toFixed } from '../../engine/physics/fixednum.js';
import type { FighterStats, Move } from '../../engine/ecs/component.js';
import { moveRegistries } from '../../engine/ecs/component.js';

export const GORUN_STATS: FighterStats = {
  maxFallSpeed:     toFixed(-1.10),
  maxFastFallSpeed: toFixed(-2.00),
  jumpForce:        toFixed(0.87),
  doubleJumpForce:  toFixed(0.55),
  walkSpeed:        toFixed(0.30),
  runSpeed:         toFixed(0.76),
  weightClass:      toFixed(1.7),
  shieldHealthMax:  toFixed(120),
};

export const GORUN_MOVES: Record<string, Move> = {
  neutralJab: {
    totalFrames: 28,
    hitboxes: [{
      activeFrames:    [8, 12],
      offsetX:         toFixed(28),
      offsetY:         toFixed(0),
      width:           toFixed(44),
      height:          toFixed(44),
      damage:          8,
      knockbackScaling: toFixed(0.8),
      baseKnockback:   toFixed(5),
      launchAngle:     40,
      hitlagFrames:    4,
      id:              'gorun_jab_0',
    }],
    hurtboxes: [{ activeFrames: [0, 27], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(38), height: toFixed(72) }],
    iasa: 18,
  },

  forwardTilt: {
    totalFrames: 36,
    hitboxes: [{
      activeFrames:    [9, 13],
      offsetX:         toFixed(40),
      offsetY:         toFixed(5),
      width:           toFixed(50),
      height:          toFixed(30),
      damage:          14,
      knockbackScaling: toFixed(1.2),
      baseKnockback:   toFixed(6),
      launchAngle:     35,
      hitlagFrames:    5,
      id:              'gorun_ftilt_0',
    }],
    hurtboxes: [{ activeFrames: [0, 35], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(38), height: toFixed(72) }],
    iasa: 26,
  },

  forwardSmash: {
    totalFrames: 70,
    hitboxes: [{
      activeFrames:    [28, 36],
      offsetX:         toFixed(55),
      offsetY:         toFixed(10),
      width:           toFixed(60),
      height:          toFixed(40),
      damage:          25,
      knockbackScaling: toFixed(1.8),
      baseKnockback:   toFixed(15),
      launchAngle:     40,
      hitlagFrames:    8,
      id:              'gorun_fsmash_0',
    }],
    hurtboxes: [{ activeFrames: [0, 69], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(38), height: toFixed(72) }],
    iasa: 56,
  },

  neutralAir: {
    totalFrames: 50,
    hitboxes: [{
      activeFrames:    [8, 28],
      offsetX:         toFixed(0),
      offsetY:         toFixed(0),
      width:           toFixed(50),
      height:          toFixed(80),
      damage:          12,
      knockbackScaling: toFixed(1.0),
      baseKnockback:   toFixed(4),
      launchAngle:     50,
      hitlagFrames:    4,
      id:              'gorun_nair_0',
    }],
    hurtboxes: [{ activeFrames: [0, 49], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(38), height: toFixed(72) }],
    iasa: 38,
    landingLag: 16,
  },

  downAir: {
    totalFrames: 60,
    hitboxes: [{
      activeFrames:    [20, 30],
      offsetX:         toFixed(0),
      offsetY:         toFixed(-40),
      width:           toFixed(40),
      height:          toFixed(36),
      damage:          20,
      knockbackScaling: toFixed(1.6),
      baseKnockback:   toFixed(12),
      launchAngle:     270,
      hitlagFrames:    7,
      id:              'gorun_dair_0',
    }],
    hurtboxes: [{ activeFrames: [0, 59], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(38), height: toFixed(72) }],
    iasa: 48,
    landingLag: 20,
  },
};

moveRegistries.set('gorun', GORUN_MOVES);
