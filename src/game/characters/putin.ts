// src/game/characters/putin.ts
// Character stats and move data for The Judo Tsar (satirical Vladimir Putin)
// Strengths: strongest throws/command grabs, high defense; Weakness: no projectiles, very slow.

import { toFixed } from '../../engine/physics/fixednum.js';
import type { FighterStats, Move } from '../../engine/ecs/component.js';

export const PUTIN_STATS: FighterStats = {
  maxFallSpeed:     toFixed(-16.0),
  maxFastFallSpeed: toFixed(-24.0),
  jumpForce:        toFixed(13.5),
  doubleJumpForce:  toFixed(11.5),
  walkSpeed:        toFixed(3.0),   // Very slow movement
  runSpeed:         toFixed(5.5),
  weightClass:      toFixed(1.7),   // Super heavy — hardest to launch
};

export const PUTIN_MOVES: Record<string, Move> = {
  // === JABS ===
  neutralJab: {
    totalFrames: 26,
    hitboxes: [{
      activeFrames: [7, 13],
      offsetX: toFixed(20), offsetY: toFixed(5),
      width: toFixed(38), height: toFixed(34),
      damage: 7, knockbackScaling: toFixed(0.9), baseKnockback: toFixed(5),
      launchAngle: 45, hitlagFrames: 4, id: 'putin_jab',
    }],
    hurtboxes: [{ activeFrames: [0, 26], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(34), height: toFixed(62), intangible: false, invincible: false }],
    iasa: 20, landingLag: 0,
  },

  // === TILTS ===
  dashAttack: {
    totalFrames: 42,
    hitboxes: [{
      activeFrames: [9, 20],
      offsetX: toFixed(26), offsetY: toFixed(-2),
      width: toFixed(52), height: toFixed(40),
      damage: 14, knockbackScaling: toFixed(1.2), baseKnockback: toFixed(6),
      launchAngle: 35, hitlagFrames: 5, id: 'putin_dash',
    }],
    hurtboxes: [{ activeFrames: [0, 42], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(34), height: toFixed(62), intangible: false, invincible: false }],
    iasa: 34, landingLag: 0,
  },
  getupAttack: {
    totalFrames: 28,
    hitboxes: [{
      activeFrames: [7, 16],
      offsetX: toFixed(22), offsetY: toFixed(-10),
      width: toFixed(42), height: toFixed(28),
      damage: 8, knockbackScaling: toFixed(0.9), baseKnockback: toFixed(5),
      launchAngle: 78, hitlagFrames: 5, id: 'putin_getup',
    }],
    hurtboxes: [{ activeFrames: [0, 28], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(34), height: toFixed(62), intangible: false, invincible: false }],
    iasa: 22, landingLag: 0,
  },
  forwardTilt: {
    totalFrames: 36,
    hitboxes: [{
      activeFrames: [11, 18],
      offsetX: toFixed(26), offsetY: toFixed(0),
      width: toFixed(48), height: toFixed(34),
      damage: 13, knockbackScaling: toFixed(1.2), baseKnockback: toFixed(6),
      launchAngle: 38, hitlagFrames: 5, id: 'putin_ftilt',
    }],
    hurtboxes: [{ activeFrames: [0, 36], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(34), height: toFixed(62), intangible: false, invincible: false }],
    iasa: 29, landingLag: 0,
  },
  upTilt: {
    totalFrames: 34,
    hitboxes: [{
      activeFrames: [9, 16],
      offsetX: toFixed(0), offsetY: toFixed(34),
      width: toFixed(48), height: toFixed(34),
      damage: 11, knockbackScaling: toFixed(1.1), baseKnockback: toFixed(5),
      launchAngle: 85, hitlagFrames: 5, id: 'putin_utilt',
    }],
    hurtboxes: [{ activeFrames: [0, 34], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(34), height: toFixed(62), intangible: false, invincible: false }],
    iasa: 27, landingLag: 0,
  },
  downTilt: {
    totalFrames: 30,
    hitboxes: [{
      activeFrames: [8, 14],
      offsetX: toFixed(24), offsetY: toFixed(-20),
      width: toFixed(40), height: toFixed(22),
      damage: 10, knockbackScaling: toFixed(1.0), baseKnockback: toFixed(3),
      launchAngle: 25, hitlagFrames: 4, id: 'putin_dtilt',
    }],
    hurtboxes: [{ activeFrames: [0, 30], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(34), height: toFixed(62), intangible: false, invincible: false }],
    iasa: 24, landingLag: 0,
  },

  // === SMASHES ===
  forwardSmash: {
    totalFrames: 65,
    hitboxes: [{
      activeFrames: [24, 34],
      offsetX: toFixed(48), offsetY: toFixed(8),
      width: toFixed(62), height: toFixed(38),
      damage: 24, knockbackScaling: toFixed(1.7), baseKnockback: toFixed(14),
      launchAngle: 40, hitlagFrames: 8, id: 'putin_fsmash',
    }],
    hurtboxes: [{ activeFrames: [0, 65], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(34), height: toFixed(62), intangible: false, invincible: false }],
    iasa: 54, landingLag: 0, canCharge: true,
  },
  upSmash: {
    totalFrames: 52,
    hitboxes: [
      { activeFrames: [12, 18], offsetX: toFixed(0), offsetY: toFixed(34), width: toFixed(48), height: toFixed(32), damage: 10, knockbackScaling: toFixed(1.0), baseKnockback: toFixed(5), launchAngle: 85, hitlagFrames: 5, id: 'putin_usmash_1' },
      { activeFrames: [19, 27], offsetX: toFixed(0), offsetY: toFixed(54), width: toFixed(56), height: toFixed(44), damage: 21, knockbackScaling: toFixed(1.6), baseKnockback: toFixed(12), launchAngle: 90, hitlagFrames: 8, id: 'putin_usmash_2' },
    ],
    hurtboxes: [{ activeFrames: [0, 52], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(34), height: toFixed(62), intangible: false, invincible: false }],
    iasa: 44, landingLag: 0, canCharge: true,
  },
  downSmash: {
    totalFrames: 48,
    hitboxes: [
      { activeFrames: [10, 18], offsetX: toFixed(32), offsetY: toFixed(-15), width: toFixed(52), height: toFixed(28), damage: 19, knockbackScaling: toFixed(1.4), baseKnockback: toFixed(8), launchAngle: 28, hitlagFrames: 7, id: 'putin_dsmash_r' },
      { activeFrames: [10, 18], offsetX: toFixed(-32), offsetY: toFixed(-15), width: toFixed(52), height: toFixed(28), damage: 19, knockbackScaling: toFixed(1.4), baseKnockback: toFixed(8), launchAngle: 152, hitlagFrames: 7, id: 'putin_dsmash_l' },
    ],
    hurtboxes: [{ activeFrames: [0, 48], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(34), height: toFixed(62), intangible: false, invincible: false }],
    iasa: 40, landingLag: 0, canCharge: true,
  },

  // === THROWS — strongest in the game ===
  forwardThrow: {
    totalFrames: 34,
    hitboxes: [{ activeFrames: [10, 12], offsetX: toFixed(26), offsetY: toFixed(0), width: toFixed(22), height: toFixed(22), damage: 14, knockbackScaling: toFixed(1.4), baseKnockback: toFixed(12), launchAngle: 18, hitlagFrames: 5, id: 'putin_fthrow' }],
    hurtboxes: [{ activeFrames: [0, 34], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(34), height: toFixed(62), intangible: false, invincible: false }],
    iasa: 34, landingLag: 0, isThrow: true,
  },
  backThrow: {
    totalFrames: 36,
    hitboxes: [{ activeFrames: [12, 14], offsetX: toFixed(-26), offsetY: toFixed(0), width: toFixed(22), height: toFixed(22), damage: 16, knockbackScaling: toFixed(1.5), baseKnockback: toFixed(14), launchAngle: 162, hitlagFrames: 5, id: 'putin_bthrow' }],
    hurtboxes: [{ activeFrames: [0, 36], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(34), height: toFixed(62), intangible: false, invincible: false }],
    iasa: 36, landingLag: 0, isThrow: true,
  },
  upThrow: {
    totalFrames: 32,
    hitboxes: [{ activeFrames: [10, 12], offsetX: toFixed(0), offsetY: toFixed(22), width: toFixed(22), height: toFixed(22), damage: 12, knockbackScaling: toFixed(1.2), baseKnockback: toFixed(14), launchAngle: 90, hitlagFrames: 5, id: 'putin_uthrow' }],
    hurtboxes: [{ activeFrames: [0, 32], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(34), height: toFixed(62), intangible: false, invincible: false }],
    iasa: 32, landingLag: 0, isThrow: true,
  },
  downThrow: {
    totalFrames: 40,
    hitboxes: [{ activeFrames: [12, 14], offsetX: toFixed(0), offsetY: toFixed(-10), width: toFixed(22), height: toFixed(22), damage: 10, knockbackScaling: toFixed(1.0), baseKnockback: toFixed(8), launchAngle: 80, hitlagFrames: 5, id: 'putin_dthrow' }],
    hurtboxes: [{ activeFrames: [0, 40], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(34), height: toFixed(62), intangible: false, invincible: false }],
    iasa: 40, landingLag: 0, isThrow: true,
  },

  // === AERIALS ===
  neutralAir: {
    totalFrames: 36,
    hitboxes: [{
      activeFrames: [6, 18],
      offsetX: toFixed(0), offsetY: toFixed(0),
      width: toFixed(52), height: toFixed(58),
      damage: 12, knockbackScaling: toFixed(1.0), baseKnockback: toFixed(4),
      launchAngle: 45, hitlagFrames: 5, id: 'putin_nair',
    }],
    hurtboxes: [{ activeFrames: [0, 36], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(34), height: toFixed(62), intangible: false, invincible: false }],
    iasa: 29, landingLag: 12,
  },
  forwardAir: {
    totalFrames: 44,
    hitboxes: [{
      activeFrames: [12, 20],
      offsetX: toFixed(36), offsetY: toFixed(4),
      width: toFixed(52), height: toFixed(38),
      damage: 17, knockbackScaling: toFixed(1.5), baseKnockback: toFixed(8),
      launchAngle: 40, hitlagFrames: 6, id: 'putin_fair',
    }],
    hurtboxes: [{ activeFrames: [0, 44], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(34), height: toFixed(62), intangible: false, invincible: false }],
    iasa: 36, landingLag: 14,
  },
  backAir: {
    totalFrames: 38,
    hitboxes: [{
      activeFrames: [9, 16],
      offsetX: toFixed(-32), offsetY: toFixed(0),
      width: toFixed(44), height: toFixed(38),
      damage: 15, knockbackScaling: toFixed(1.4), baseKnockback: toFixed(7),
      launchAngle: 150, hitlagFrames: 6, id: 'putin_bair',
    }],
    hurtboxes: [{ activeFrames: [0, 38], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(34), height: toFixed(62), intangible: false, invincible: false }],
    iasa: 30, landingLag: 12,
  },
  upAir: {
    totalFrames: 38,
    hitboxes: [{
      activeFrames: [9, 17],
      offsetX: toFixed(0), offsetY: toFixed(38),
      width: toFixed(50), height: toFixed(34),
      damage: 13, knockbackScaling: toFixed(1.2), baseKnockback: toFixed(6),
      launchAngle: 80, hitlagFrames: 5, id: 'putin_uair',
    }],
    hurtboxes: [{ activeFrames: [0, 38], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(34), height: toFixed(62), intangible: false, invincible: false }],
    iasa: 30, landingLag: 12,
  },
  downAir: {
    totalFrames: 46,
    hitboxes: [{
      activeFrames: [8, 17],
      offsetX: toFixed(0), offsetY: toFixed(-36),
      width: toFixed(46), height: toFixed(30),
      damage: 19, knockbackScaling: toFixed(1.6), baseKnockback: toFixed(11),
      launchAngle: 270, hitlagFrames: 7, id: 'putin_dair',
    }],
    hurtboxes: [{ activeFrames: [0, 46], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(34), height: toFixed(62), intangible: false, invincible: false }],
    iasa: 37, landingLag: 18,
  },

  // === SPECIALS ===
  // neutralSpecial: Social Freeze — judo-chop that disables specials (long stun hitbox)
  neutralSpecial: {
    totalFrames: 40,
    hitboxes: [{
      activeFrames: [12, 20],
      offsetX: toFixed(24), offsetY: toFixed(8),
      width: toFixed(38), height: toFixed(36),
      damage: 10, knockbackScaling: toFixed(0.9), baseKnockback: toFixed(5),
      launchAngle: 70, hitlagFrames: 6, id: 'putin_nspecial',
    }],
    hurtboxes: [{ activeFrames: [0, 40], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(34), height: toFixed(62), intangible: false, invincible: false }],
    iasa: 32, landingLag: 7,
  },
  // sideSpecial: Command Bear Grab — long-range command grab with the cybernetic bear
  sideSpecial: {
    totalFrames: 52,
    hitboxes: [
      { activeFrames: [8, 14], offsetX: toFixed(32), offsetY: toFixed(4), width: toFixed(28), height: toFixed(44), damage: 10, knockbackScaling: toFixed(0.8), baseKnockback: toFixed(5), launchAngle: 50, hitlagFrames: 5, id: 'putin_beargrab_grab' },
      { activeFrames: [15, 26], offsetX: toFixed(48), offsetY: toFixed(0), width: toFixed(44), height: toFixed(44), damage: 18, knockbackScaling: toFixed(1.5), baseKnockback: toFixed(10), launchAngle: 38, hitlagFrames: 7, id: 'putin_beargrab_slam' },
    ],
    hurtboxes: [{ activeFrames: [0, 52], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(34), height: toFixed(62), intangible: false, invincible: false }],
    iasa: 43, landingLag: 12,
  },
  // upSpecial: Bear Launch — mounted bear rockets upward
  upSpecial: {
    totalFrames: 56,
    hitboxes: [
      { activeFrames: [5, 14], offsetX: toFixed(0), offsetY: toFixed(16), width: toFixed(44), height: toFixed(38), damage: 9, knockbackScaling: toFixed(1.0), baseKnockback: toFixed(5), launchAngle: 78, hitlagFrames: 5, id: 'putin_uspecial_rise' },
      { activeFrames: [15, 24], offsetX: toFixed(0), offsetY: toFixed(52), width: toFixed(40), height: toFixed(34), damage: 16, knockbackScaling: toFixed(1.4), baseKnockback: toFixed(9), launchAngle: 90, hitlagFrames: 6, id: 'putin_uspecial_apex' },
    ],
    hurtboxes: [{ activeFrames: [0, 56], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(34), height: toFixed(62), intangible: false, invincible: false }],
    iasa: 47, landingLag: 16,
  },
  // downSpecial / Ultimate: Bear Charge — stampede sweeping the whole stage
  downSpecial: {
    totalFrames: 80,
    hitboxes: [
      { activeFrames: [12, 20], offsetX: toFixed(-50), offsetY: toFixed(0), width: toFixed(40), height: toFixed(48), damage: 15, knockbackScaling: toFixed(1.1), baseKnockback: toFixed(7), launchAngle: 42, hitlagFrames: 6, id: 'putin_bear1' },
      { activeFrames: [20, 35], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(40), height: toFixed(48), damage: 15, knockbackScaling: toFixed(1.1), baseKnockback: toFixed(7), launchAngle: 42, hitlagFrames: 6, id: 'putin_bear2' },
      { activeFrames: [35, 55], offsetX: toFixed(50), offsetY: toFixed(0), width: toFixed(40), height: toFixed(48), damage: 15, knockbackScaling: toFixed(1.1), baseKnockback: toFixed(7), launchAngle: 42, hitlagFrames: 6, id: 'putin_bear3' },
    ],
    hurtboxes: [{ activeFrames: [0, 80], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(34), height: toFixed(62), intangible: false, invincible: false }],
    iasa: 70, landingLag: 10,
  },
};
