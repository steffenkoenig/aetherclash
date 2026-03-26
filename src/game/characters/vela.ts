// src/game/characters/vela.ts
// Stats and move-set data for Vela — The Blade Master (Heavy, w=1.3)

import { toFixed } from '../../engine/physics/fixednum.js';
import type { FighterStats, Move } from '../../engine/ecs/component.js';
import { moveRegistries } from '../../engine/ecs/component.js';

export const VELA_STATS: FighterStats = {
  maxFallSpeed:     toFixed(-0.90),
  maxFastFallSpeed: toFixed(-1.65),
  jumpForce:        toFixed(1.09),
  doubleJumpForce:  toFixed(0.76),
  walkSpeed:        toFixed(0.675),
  runSpeed:         toFixed(1.42),
  weightClass:      toFixed(1.3),
  shieldHealthMax:  toFixed(110),
};

export const VELA_MOVES: Record<string, Move> = {
  neutralJab1: {
    totalFrames: 18,
    hitboxes: [{
      activeFrames:    [3, 5],
      offsetX:         toFixed(30),
      offsetY:         toFixed(0),
      width:           toFixed(40),
      height:          toFixed(20),
      damage:          5,
      knockbackScaling: toFixed(0.9),
      baseKnockback:   toFixed(3),
      launchAngle:     40,
      hitlagFrames:    4,
      id:              'vela_jab1_0',
    }],
    hurtboxes: [{ activeFrames: [0, 17], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(32), height: toFixed(64) }],
    iasa: 10,
  },

  neutralJab2: {
    totalFrames: 20,
    hitboxes: [{
      activeFrames:    [4, 7],
      offsetX:         toFixed(32),
      offsetY:         toFixed(5),
      width:           toFixed(44),
      height:          toFixed(22),
      damage:          7,
      knockbackScaling: toFixed(0.9),
      baseKnockback:   toFixed(3),
      launchAngle:     45,
      hitlagFrames:    4,
      id:              'vela_jab2_0',
    }],
    hurtboxes: [{ activeFrames: [0, 19], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(32), height: toFixed(64) }],
    iasa: 12,
  },

  forwardSmash: {
    totalFrames: 58,
    hitboxes: [
      // Feint hit (weak)
      {
        activeFrames:    [10, 14],
        offsetX:         toFixed(38),
        offsetY:         toFixed(5),
        width:           toFixed(44),
        height:          toFixed(26),
        damage:          6,
        knockbackScaling: toFixed(0.8),
        baseKnockback:   toFixed(3),
        launchAngle:     35,
        hitlagFrames:    4,
        id:              'vela_fsmash_feint',
      },
      // Full stab (strong, disjointed)
      {
        activeFrames:    [22, 30],
        offsetX:         toFixed(55),
        offsetY:         toFixed(5),
        width:           toFixed(52),
        height:          toFixed(24),
        damage:          20,
        knockbackScaling: toFixed(1.6),
        baseKnockback:   toFixed(10),
        launchAngle:     38,
        hitlagFrames:    7,
        id:              'vela_fsmash_stab',
      },
    ],
    hurtboxes: [{ activeFrames: [0, 57], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(32), height: toFixed(64) }],
    iasa: 46,
  },

  backAir: {
    totalFrames: 32,
    hitboxes: [{
      activeFrames:    [5, 10],
      offsetX:         toFixed(-38),
      offsetY:         toFixed(0),
      width:           toFixed(32),
      height:          toFixed(32),
      damage:          16,
      knockbackScaling: toFixed(1.5),
      baseKnockback:   toFixed(8),
      launchAngle:     165,
      hitlagFrames:    5,
      id:              'vela_bair_0',
    }],
    hurtboxes: [{ activeFrames: [0, 31], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(32), height: toFixed(64) }],
    iasa: 22,
    landingLag: 10,
  },

  neutralAir: {
    totalFrames: 32,
    hitboxes: [{
      activeFrames:    [3, 18],
      offsetX:         toFixed(0),
      offsetY:         toFixed(0),
      width:           toFixed(44),
      height:          toFixed(68),
      damage:          9,
      knockbackScaling: toFixed(1.0),
      baseKnockback:   toFixed(3),
      launchAngle:     50,
      hitlagFrames:    4,
      id:              'vela_nair_0',
    }],
    hurtboxes: [{ activeFrames: [0, 31], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(32), height: toFixed(64) }],
    iasa: 22,
    landingLag: 6,
  },
};

moveRegistries.set('vela', VELA_MOVES);
