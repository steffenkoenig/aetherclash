// src/game/characters/zira.ts
// Stats and move-set data for Zira — The Agile Striker (Ultra-Light, w=0.6)

import { toFixed } from '../../engine/physics/fixednum.js';
import type { FighterStats, Move } from '../../engine/ecs/component.js';
import { moveRegistries } from '../../engine/ecs/component.js';

export const ZIRA_STATS: FighterStats = {
  maxFallSpeed:     toFixed(-0.90),
  maxFastFallSpeed: toFixed(-1.70),
  jumpForce:        toFixed(1.36),
  doubleJumpForce:  toFixed(1.09),
  walkSpeed:        toFixed(0.825),
  runSpeed:         toFixed(1.64),
  weightClass:      toFixed(0.6),
  shieldHealthMax:  toFixed(85),
};

export const ZIRA_MOVES: Record<string, Move> = {
  neutralJab1: {
    totalFrames: 12,
    hitboxes: [{
      activeFrames:    [2, 4],
      offsetX:         toFixed(16),
      offsetY:         toFixed(2),
      width:           toFixed(20),
      height:          toFixed(20),
      damage:          2,
      knockbackScaling: toFixed(0.7),
      baseKnockback:   toFixed(1),
      launchAngle:     45,
      hitlagFrames:    4,
      id:              'zira_jab1_0',
    }],
    hurtboxes: [{ activeFrames: [0, 11], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(24), height: toFixed(52) }],
    iasa: 6,
  },

  neutralJab2: {
    totalFrames: 12,
    hitboxes: [{
      activeFrames:    [2, 4],
      offsetX:         toFixed(16),
      offsetY:         toFixed(2),
      width:           toFixed(20),
      height:          toFixed(20),
      damage:          2,
      knockbackScaling: toFixed(0.7),
      baseKnockback:   toFixed(1),
      launchAngle:     45,
      hitlagFrames:    4,
      id:              'zira_jab2_0',
    }],
    hurtboxes: [{ activeFrames: [0, 11], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(24), height: toFixed(52) }],
    iasa: 6,
  },

  forwardSmash: {
    totalFrames: 44,
    hitboxes: [{
      activeFrames:    [12, 18],
      offsetX:         toFixed(35),
      offsetY:         toFixed(0),
      width:           toFixed(40),
      height:          toFixed(26),
      damage:          15,
      knockbackScaling: toFixed(1.4),
      baseKnockback:   toFixed(9),
      launchAngle:     38,
      hitlagFrames:    5,
      id:              'zira_fsmash_0',
    }],
    hurtboxes: [{ activeFrames: [0, 43], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(24), height: toFixed(52) }],
    iasa: 34,
  },

  backAir: {
    totalFrames: 26,
    hitboxes: [{
      activeFrames:    [4, 8],
      offsetX:         toFixed(-28),
      offsetY:         toFixed(0),
      width:           toFixed(28),
      height:          toFixed(28),
      damage:          13,
      knockbackScaling: toFixed(1.3),
      baseKnockback:   toFixed(6),
      launchAngle:     160,
      hitlagFrames:    4,
      id:              'zira_bair_0',
    }],
    hurtboxes: [{ activeFrames: [0, 25], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(24), height: toFixed(52) }],
    iasa: 18,
    landingLag: 8,
  },

  downAir: {
    totalFrames: 46,
    hitboxes: [
      // Multi-hit drill kick (hits 1-4, weak)
      {
        activeFrames:    [8, 28],
        offsetX:         toFixed(0),
        offsetY:         toFixed(-32),
        width:           toFixed(24),
        height:          toFixed(24),
        damage:          3,
        knockbackScaling: toFixed(0.5),
        baseKnockback:   toFixed(1),
        launchAngle:     270,
        hitlagFrames:    4,
        id:              'zira_dair_drill',
      },
      // Launch hit (hit 5)
      {
        activeFrames:    [29, 34],
        offsetX:         toFixed(0),
        offsetY:         toFixed(-32),
        width:           toFixed(26),
        height:          toFixed(26),
        damage:          14,
        knockbackScaling: toFixed(1.4),
        baseKnockback:   toFixed(8),
        launchAngle:     280,
        hitlagFrames:    5,
        id:              'zira_dair_launch',
      },
    ],
    hurtboxes: [{ activeFrames: [0, 45], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(24), height: toFixed(52) }],
    iasa: 38,
    landingLag: 12,
  },

  neutralAir: {
    totalFrames: 24,
    hitboxes: [{
      activeFrames:    [3, 14],
      offsetX:         toFixed(0),
      offsetY:         toFixed(0),
      width:           toFixed(32),
      height:          toFixed(56),
      damage:          7,
      knockbackScaling: toFixed(0.9),
      baseKnockback:   toFixed(2),
      launchAngle:     50,
      hitlagFrames:    4,
      id:              'zira_nair_0',
    }],
    hurtboxes: [{ activeFrames: [0, 23], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(24), height: toFixed(52) }],
    iasa: 16,
    landingLag: 4,
  },
};

moveRegistries.set('zira', ZIRA_MOVES);
