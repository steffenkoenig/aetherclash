// src/game/characters/kael.ts
// Stats and move-set data for Kael — The Balanced Hero (Medium weight, w=1.0)

import { toFixed } from '../../engine/physics/fixednum.js';
import type { FighterStats, Move } from '../../engine/ecs/component.js';
import { moveRegistries } from '../../engine/ecs/component.js';

export const KAEL_STATS: FighterStats = {
  maxFallSpeed:     toFixed(-0.85),
  maxFastFallSpeed: toFixed(-1.60),
  jumpForce:        toFixed(1.2),
  doubleJumpForce:  toFixed(1.0),
  walkSpeed:        toFixed(0.6),
  runSpeed:         toFixed(1.2),
  weightClass:      toFixed(1.0),
  shieldHealthMax:  toFixed(100),
};

// ── Move data ─────────────────────────────────────────────────────────────────
// Hitbox/hurtbox offsets are relative to the fighter's centre (transform.x, transform.y).
// Frame indices are 0-based.

export const KAEL_MOVES: Record<string, Move> = {
  neutralJab1: {
    totalFrames: 14,
    hitboxes: [{
      activeFrames:    [3, 5],
      offsetX:         toFixed(20),
      offsetY:         toFixed(0),
      width:           toFixed(22),
      height:          toFixed(22),
      damage:          3,
      knockbackScaling: toFixed(0.8),
      baseKnockback:   toFixed(3),
      launchAngle:     50,
      hitlagFrames:    4,
      id:              'kael_jab1_0',
    }],
    hurtboxes: [{ activeFrames: [0, 13], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60) }],
    iasa: 8,
  },

  neutralJab2: {
    totalFrames: 14,
    hitboxes: [{
      activeFrames:    [3, 5],
      offsetX:         toFixed(20),
      offsetY:         toFixed(0),
      width:           toFixed(22),
      height:          toFixed(22),
      damage:          3,
      knockbackScaling: toFixed(0.8),
      baseKnockback:   toFixed(3),
      launchAngle:     50,
      hitlagFrames:    4,
      id:              'kael_jab2_0',
    }],
    hurtboxes: [{ activeFrames: [0, 13], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60) }],
    iasa: 8,
  },

  neutralJab3: {
    totalFrames: 24,
    hitboxes: [{
      activeFrames:    [3, 7],
      offsetX:         toFixed(22),
      offsetY:         toFixed(5),
      width:           toFixed(26),
      height:          toFixed(26),
      damage:          5,
      knockbackScaling: toFixed(0.8),
      baseKnockback:   toFixed(3),
      launchAngle:     60,
      hitlagFrames:    4,
      id:              'kael_jab3_0',
    }],
    hurtboxes: [{ activeFrames: [0, 23], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60) }],
    iasa: 14,
  },

  forwardTilt: {
    totalFrames: 30,
    hitboxes: [{
      activeFrames:    [7, 9],
      offsetX:         toFixed(32),
      offsetY:         toFixed(0),
      width:           toFixed(36),
      height:          toFixed(28),
      damage:          10,
      knockbackScaling: toFixed(1.1),
      baseKnockback:   toFixed(4),
      launchAngle:     35,
      hitlagFrames:    4,
      id:              'kael_ftilt_0',
    }],
    hurtboxes: [{ activeFrames: [0, 29], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60) }],
    iasa: 22,
  },

  upTilt: {
    totalFrames: 30,
    hitboxes: [{
      activeFrames:    [5, 10],
      offsetX:         toFixed(10),
      offsetY:         toFixed(35),
      width:           toFixed(40),
      height:          toFixed(30),
      damage:          9,
      knockbackScaling: toFixed(1.2),
      baseKnockback:   toFixed(5),
      launchAngle:     85,
      hitlagFrames:    4,
      id:              'kael_utilt_0',
    }],
    hurtboxes: [{ activeFrames: [0, 29], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60) }],
    iasa: 20,
  },

  downTilt: {
    totalFrames: 25,
    hitboxes: [{
      activeFrames:    [4, 7],
      offsetX:         toFixed(28),
      offsetY:         toFixed(-20),
      width:           toFixed(32),
      height:          toFixed(20),
      damage:          7,
      knockbackScaling: toFixed(0.9),
      baseKnockback:   toFixed(2),
      launchAngle:     25,
      hitlagFrames:    4,
      id:              'kael_dtilt_0',
    }],
    hurtboxes: [{ activeFrames: [0, 24], offsetX: toFixed(0), offsetY: toFixed(-10), width: toFixed(35), height: toFixed(40) }],
    iasa: 16,
  },

  forwardSmash: {
    totalFrames: 55,
    hitboxes: [{
      activeFrames:    [20, 28],
      offsetX:         toFixed(40),
      offsetY:         toFixed(10),
      width:           toFixed(50),
      height:          toFixed(30),
      damage:          18,
      knockbackScaling: toFixed(1.5),
      baseKnockback:   toFixed(10),
      launchAngle:     40,
      hitlagFrames:    6,
      id:              'kael_fsmash_0',
    }],
    hurtboxes: [{ activeFrames: [0, 54], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60) }],
    iasa: 45,
  },

  upSmash: {
    totalFrames: 50,
    hitboxes: [
      {
        activeFrames:    [12, 16],
        offsetX:         toFixed(5),
        offsetY:         toFixed(40),
        width:           toFixed(38),
        height:          toFixed(30),
        damage:          8,
        knockbackScaling: toFixed(1.3),
        baseKnockback:   toFixed(4),
        launchAngle:     90,
        hitlagFrames:    4,
        id:              'kael_usmash_0',
      },
      {
        activeFrames:    [17, 22],
        offsetX:         toFixed(5),
        offsetY:         toFixed(48),
        width:           toFixed(44),
        height:          toFixed(26),
        damage:          16,
        knockbackScaling: toFixed(1.3),
        baseKnockback:   toFixed(8),
        launchAngle:     90,
        hitlagFrames:    6,
        id:              'kael_usmash_1',
      },
    ],
    hurtboxes: [{ activeFrames: [0, 49], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60) }],
    iasa: 38,
  },

  downSmash: {
    totalFrames: 48,
    hitboxes: [
      {
        activeFrames:    [6, 12],
        offsetX:         toFixed(32),
        offsetY:         toFixed(-22),
        width:           toFixed(36),
        height:          toFixed(22),
        damage:          12,
        knockbackScaling: toFixed(1.1),
        baseKnockback:   toFixed(6),
        launchAngle:     30,
        hitlagFrames:    4,
        id:              'kael_dsmash_0',
      },
      {
        activeFrames:    [6, 12],
        offsetX:         toFixed(-32),
        offsetY:         toFixed(-22),
        width:           toFixed(36),
        height:          toFixed(22),
        damage:          12,
        knockbackScaling: toFixed(1.1),
        baseKnockback:   toFixed(6),
        launchAngle:     150,
        hitlagFrames:    4,
        id:              'kael_dsmash_1',
      },
    ],
    hurtboxes: [{ activeFrames: [0, 47], offsetX: toFixed(0), offsetY: toFixed(-15), width: toFixed(35), height: toFixed(40) }],
    iasa: 36,
  },

  neutralAir: {
    totalFrames: 36,
    hitboxes: [{
      activeFrames:    [4, 20],
      offsetX:         toFixed(0),
      offsetY:         toFixed(0),
      width:           toFixed(40),
      height:          toFixed(70),
      damage:          8,
      knockbackScaling: toFixed(1.0),
      baseKnockback:   toFixed(3),
      launchAngle:     50,
      hitlagFrames:    4,
      id:              'kael_nair_0',
    }],
    hurtboxes: [{ activeFrames: [0, 35], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60) }],
    iasa: 26,
    landingLag: 8,
  },

  forwardAir: {
    totalFrames: 38,
    hitboxes: [
      {
        activeFrames:    [8, 12],
        offsetX:         toFixed(35),
        offsetY:         toFixed(5),
        width:           toFixed(28),
        height:          toFixed(24),
        damage:          12,
        knockbackScaling: toFixed(1.2),
        baseKnockback:   toFixed(5),
        launchAngle:     45,
        hitlagFrames:    4,
        id:              'kael_fair_sweet',
      },
      {
        activeFrames:    [8, 18],
        offsetX:         toFixed(20),
        offsetY:         toFixed(5),
        width:           toFixed(26),
        height:          toFixed(26),
        damage:          7,
        knockbackScaling: toFixed(0.8),
        baseKnockback:   toFixed(3),
        launchAngle:     40,
        hitlagFrames:    4,
        id:              'kael_fair_sour',
      },
    ],
    hurtboxes: [{ activeFrames: [0, 37], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60) }],
    iasa: 28,
    landingLag: 10,
  },

  backAir: {
    totalFrames: 34,
    hitboxes: [{
      activeFrames:    [6, 11],
      offsetX:         toFixed(-35),
      offsetY:         toFixed(0),
      width:           toFixed(30),
      height:          toFixed(30),
      damage:          14,
      knockbackScaling: toFixed(1.4),
      baseKnockback:   toFixed(7),
      launchAngle:     160,
      hitlagFrames:    5,
      id:              'kael_bair_0',
    }],
    hurtboxes: [{ activeFrames: [0, 33], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60) }],
    iasa: 24,
    landingLag: 10,
  },

  upAir: {
    totalFrames: 32,
    hitboxes: [{
      activeFrames:    [5, 12],
      offsetX:         toFixed(0),
      offsetY:         toFixed(40),
      width:           toFixed(36),
      height:          toFixed(28),
      damage:          10,
      knockbackScaling: toFixed(1.1),
      baseKnockback:   toFixed(4),
      launchAngle:     88,
      hitlagFrames:    4,
      id:              'kael_uair_0',
    }],
    hurtboxes: [{ activeFrames: [0, 31], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60) }],
    iasa: 22,
    landingLag: 8,
  },

  downAir: {
    totalFrames: 44,
    hitboxes: [
      // Sweetspot spike (frame 5 only)
      {
        activeFrames:    [5, 5],
        offsetX:         toFixed(0),
        offsetY:         toFixed(-35),
        width:           toFixed(28),
        height:          toFixed(24),
        damage:          11,
        knockbackScaling: toFixed(1.2),
        baseKnockback:   toFixed(6),
        launchAngle:     270, // straight down = spike
        hitlagFrames:    4,
        id:              'kael_dair_spike',
      },
      // Sourspot (remaining active frames)
      {
        activeFrames:    [6, 14],
        offsetX:         toFixed(0),
        offsetY:         toFixed(-30),
        width:           toFixed(28),
        height:          toFixed(26),
        damage:          8,
        knockbackScaling: toFixed(1.0),
        baseKnockback:   toFixed(4),
        launchAngle:     240,
        hitlagFrames:    4,
        id:              'kael_dair_sour',
      },
    ],
    hurtboxes: [{ activeFrames: [0, 43], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60) }],
    iasa: 34,
    landingLag: 14,
  },
};

// Register moves so the hitbox system can look them up by characterId
moveRegistries.set('kael', KAEL_MOVES);
