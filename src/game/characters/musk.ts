// src/game/characters/musk.ts
// Character stats and move data for The Tech Archon (satirical Elon Musk)
// Strengths: unrivalled air mobility, fast projectiles; Weakness: 1% glitch self-damage.

import { toFixed } from '../../engine/physics/fixednum.js';
import type { FighterStats, Move } from '../../engine/ecs/component.js';

export const MUSK_STATS: FighterStats = {
  maxFallSpeed:     toFixed(-8.5),   // Slow fall = long air time
  maxFastFallSpeed: toFixed(-14.0),
  jumpForce:        toFixed(18.5),   // Highest jump in game — air dominance
  doubleJumpForce:  toFixed(16.0),
  walkSpeed:        toFixed(5.5),
  runSpeed:         toFixed(9.0),
  weightClass:      toFixed(0.75),   // Light — launched easily
};

export const MUSK_MOVES: Record<string, Move> = {
  // === JABS ===
  neutralJab1: {
    totalFrames: 13,
    hitboxes: [{
      activeFrames: [3, 6],
      offsetX: toFixed(14), offsetY: toFixed(5),
      width: toFixed(22), height: toFixed(22),
      damage: 4, knockbackScaling: toFixed(0.8), baseKnockback: toFixed(2),
      launchAngle: 45, hitlagFrames: 3, id: 'musk_jab1',
    }],
    hurtboxes: [{ activeFrames: [0, 13], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(28), height: toFixed(58), intangible: false, invincible: false }],
    iasa: 10, landingLag: 0, nextJab: 'neutralJab2',
  },
  neutralJab2: {
    totalFrames: 13,
    hitboxes: [{
      activeFrames: [3, 6],
      offsetX: toFixed(14), offsetY: toFixed(5),
      width: toFixed(22), height: toFixed(22),
      damage: 4, knockbackScaling: toFixed(0.8), baseKnockback: toFixed(2),
      launchAngle: 45, hitlagFrames: 3, id: 'musk_jab2',
    }],
    hurtboxes: [{ activeFrames: [0, 13], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(28), height: toFixed(58), intangible: false, invincible: false }],
    iasa: 10, landingLag: 0, nextJab: 'neutralJab3',
  },
  neutralJab3: {
    totalFrames: 18,
    hitboxes: [{
      activeFrames: [4, 8],
      offsetX: toFixed(16), offsetY: toFixed(4),
      width: toFixed(26), height: toFixed(26),
      damage: 6, knockbackScaling: toFixed(0.9), baseKnockback: toFixed(4),
      launchAngle: 55, hitlagFrames: 4, id: 'musk_jab3',
    }],
    hurtboxes: [{ activeFrames: [0, 18], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(28), height: toFixed(58), intangible: false, invincible: false }],
    iasa: 14, landingLag: 0,
  },

  // === TILTS ===
  dashAttack: {
    totalFrames: 30,
    hitboxes: [{
      activeFrames: [5, 14],
      offsetX: toFixed(20), offsetY: toFixed(0),
      width: toFixed(38), height: toFixed(34),
      damage: 9, knockbackScaling: toFixed(1.0), baseKnockback: toFixed(3),
      launchAngle: 40, hitlagFrames: 4, id: 'musk_dash',
    }],
    hurtboxes: [{ activeFrames: [0, 30], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(28), height: toFixed(58), intangible: false, invincible: false }],
    iasa: 24, landingLag: 0,
  },
  getupAttack: {
    totalFrames: 22,
    hitboxes: [{
      activeFrames: [5, 12],
      offsetX: toFixed(18), offsetY: toFixed(-8),
      width: toFixed(34), height: toFixed(26),
      damage: 6, knockbackScaling: toFixed(0.8), baseKnockback: toFixed(3),
      launchAngle: 72, hitlagFrames: 4, id: 'musk_getup',
    }],
    hurtboxes: [{ activeFrames: [0, 22], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(28), height: toFixed(58), intangible: false, invincible: false }],
    iasa: 18, landingLag: 0,
  },
  forwardTilt: {
    totalFrames: 28,
    hitboxes: [{
      activeFrames: [7, 13],
      offsetX: toFixed(22), offsetY: toFixed(0),
      width: toFixed(34), height: toFixed(28),
      damage: 10, knockbackScaling: toFixed(1.1), baseKnockback: toFixed(4),
      launchAngle: 40, hitlagFrames: 4, id: 'musk_ftilt',
    }],
    hurtboxes: [{ activeFrames: [0, 28], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(28), height: toFixed(58), intangible: false, invincible: false }],
    iasa: 22, landingLag: 0,
  },
  upTilt: {
    totalFrames: 26,
    hitboxes: [{
      activeFrames: [6, 12],
      offsetX: toFixed(0), offsetY: toFixed(28),
      width: toFixed(38), height: toFixed(26),
      damage: 9, knockbackScaling: toFixed(1.1), baseKnockback: toFixed(4),
      launchAngle: 85, hitlagFrames: 4, id: 'musk_utilt',
    }],
    hurtboxes: [{ activeFrames: [0, 26], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(28), height: toFixed(58), intangible: false, invincible: false }],
    iasa: 21, landingLag: 0,
  },
  downTilt: {
    totalFrames: 20,
    hitboxes: [{
      activeFrames: [4, 8],
      offsetX: toFixed(16), offsetY: toFixed(-18),
      width: toFixed(28), height: toFixed(18),
      damage: 7, knockbackScaling: toFixed(0.9), baseKnockback: toFixed(2),
      launchAngle: 22, hitlagFrames: 3, id: 'musk_dtilt',
    }],
    hurtboxes: [{ activeFrames: [0, 20], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(28), height: toFixed(58), intangible: false, invincible: false }],
    iasa: 16, landingLag: 0,
  },

  // === SMASHES ===
  forwardSmash: {
    totalFrames: 50,
    hitboxes: [{
      activeFrames: [18, 25],
      offsetX: toFixed(38), offsetY: toFixed(8),
      width: toFixed(48), height: toFixed(28),
      damage: 17, knockbackScaling: toFixed(1.4), baseKnockback: toFixed(9),
      launchAngle: 42, hitlagFrames: 6, id: 'musk_fsmash',
    }],
    hurtboxes: [{ activeFrames: [0, 50], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(28), height: toFixed(58), intangible: false, invincible: false }],
    iasa: 42, landingLag: 0, canCharge: true,
  },
  upSmash: {
    totalFrames: 42,
    hitboxes: [
      { activeFrames: [9, 14], offsetX: toFixed(0), offsetY: toFixed(28), width: toFixed(36), height: toFixed(28), damage: 8, knockbackScaling: toFixed(0.9), baseKnockback: toFixed(4), launchAngle: 82, hitlagFrames: 4, id: 'musk_usmash_1' },
      { activeFrames: [15, 21], offsetX: toFixed(0), offsetY: toFixed(44), width: toFixed(42), height: toFixed(32), damage: 15, knockbackScaling: toFixed(1.3), baseKnockback: toFixed(8), launchAngle: 90, hitlagFrames: 5, id: 'musk_usmash_2' },
    ],
    hurtboxes: [{ activeFrames: [0, 42], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(28), height: toFixed(58), intangible: false, invincible: false }],
    iasa: 35, landingLag: 0, canCharge: true,
  },
  downSmash: {
    totalFrames: 38,
    hitboxes: [
      { activeFrames: [8, 14], offsetX: toFixed(24), offsetY: toFixed(-14), width: toFixed(34), height: toFixed(24), damage: 12, knockbackScaling: toFixed(1.1), baseKnockback: toFixed(6), launchAngle: 32, hitlagFrames: 5, id: 'musk_dsmash_r' },
      { activeFrames: [8, 14], offsetX: toFixed(-24), offsetY: toFixed(-14), width: toFixed(34), height: toFixed(24), damage: 12, knockbackScaling: toFixed(1.1), baseKnockback: toFixed(6), launchAngle: 148, hitlagFrames: 5, id: 'musk_dsmash_l' },
    ],
    hurtboxes: [{ activeFrames: [0, 38], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(28), height: toFixed(58), intangible: false, invincible: false }],
    iasa: 31, landingLag: 0, canCharge: true,
  },

  // === THROWS ===
  forwardThrow: {
    totalFrames: 26,
    hitboxes: [{ activeFrames: [8, 10], offsetX: toFixed(20), offsetY: toFixed(0), width: toFixed(18), height: toFixed(18), damage: 8, knockbackScaling: toFixed(1.0), baseKnockback: toFixed(8), launchAngle: 15, hitlagFrames: 4, id: 'musk_fthrow' }],
    hurtboxes: [{ activeFrames: [0, 26], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(28), height: toFixed(58), intangible: false, invincible: false }],
    iasa: 26, landingLag: 0, isThrow: true,
  },
  backThrow: {
    totalFrames: 28,
    hitboxes: [{ activeFrames: [10, 12], offsetX: toFixed(-20), offsetY: toFixed(0), width: toFixed(18), height: toFixed(18), damage: 10, knockbackScaling: toFixed(1.1), baseKnockback: toFixed(9), launchAngle: 162, hitlagFrames: 4, id: 'musk_bthrow' }],
    hurtboxes: [{ activeFrames: [0, 28], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(28), height: toFixed(58), intangible: false, invincible: false }],
    iasa: 28, landingLag: 0, isThrow: true,
  },
  upThrow: {
    totalFrames: 24,
    hitboxes: [{ activeFrames: [7, 9], offsetX: toFixed(0), offsetY: toFixed(20), width: toFixed(18), height: toFixed(18), damage: 7, knockbackScaling: toFixed(0.9), baseKnockback: toFixed(10), launchAngle: 90, hitlagFrames: 4, id: 'musk_uthrow' }],
    hurtboxes: [{ activeFrames: [0, 24], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(28), height: toFixed(58), intangible: false, invincible: false }],
    iasa: 24, landingLag: 0, isThrow: true,
  },
  downThrow: {
    totalFrames: 30,
    hitboxes: [{ activeFrames: [9, 11], offsetX: toFixed(0), offsetY: toFixed(-10), width: toFixed(18), height: toFixed(18), damage: 6, knockbackScaling: toFixed(0.8), baseKnockback: toFixed(5), launchAngle: 62, hitlagFrames: 4, id: 'musk_dthrow' }],
    hurtboxes: [{ activeFrames: [0, 30], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(28), height: toFixed(58), intangible: false, invincible: false }],
    iasa: 30, landingLag: 0, isThrow: true,
  },

  // === AERIALS — strong air game ===
  neutralAir: {
    totalFrames: 28,
    hitboxes: [{
      activeFrames: [4, 13],
      offsetX: toFixed(0), offsetY: toFixed(0),
      width: toFixed(38), height: toFixed(48),
      damage: 9, knockbackScaling: toFixed(1.0), baseKnockback: toFixed(3),
      launchAngle: 45, hitlagFrames: 4, id: 'musk_nair',
    }],
    hurtboxes: [{ activeFrames: [0, 28], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(28), height: toFixed(58), intangible: false, invincible: false }],
    iasa: 22, landingLag: 7,
  },
  forwardAir: {
    // Flamethrower burst — multi-hit at mid range
    totalFrames: 34,
    hitboxes: [
      { activeFrames: [7, 11], offsetX: toFixed(28), offsetY: toFixed(4), width: toFixed(12), height: toFixed(12), damage: 13, knockbackScaling: toFixed(1.3), baseKnockback: toFixed(5), launchAngle: 35, hitlagFrames: 5, id: 'musk_fair_sweet' },
      { activeFrames: [7, 16], offsetX: toFixed(18), offsetY: toFixed(4), width: toFixed(26), height: toFixed(26), damage: 7, knockbackScaling: toFixed(0.9), baseKnockback: toFixed(3), launchAngle: 42, hitlagFrames: 4, id: 'musk_fair_sour' },
    ],
    hurtboxes: [{ activeFrames: [0, 34], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(28), height: toFixed(58), intangible: false, invincible: false }],
    iasa: 27, landingLag: 9,
  },
  backAir: {
    totalFrames: 28,
    hitboxes: [{
      activeFrames: [6, 11],
      offsetX: toFixed(-24), offsetY: toFixed(0),
      width: toFixed(28), height: toFixed(32),
      damage: 13, knockbackScaling: toFixed(1.3), baseKnockback: toFixed(6),
      launchAngle: 148, hitlagFrames: 5, id: 'musk_bair',
    }],
    hurtboxes: [{ activeFrames: [0, 28], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(28), height: toFixed(58), intangible: false, invincible: false }],
    iasa: 22, landingLag: 7,
  },
  upAir: {
    totalFrames: 28,
    hitboxes: [{
      activeFrames: [6, 12],
      offsetX: toFixed(0), offsetY: toFixed(32),
      width: toFixed(36), height: toFixed(26),
      damage: 11, knockbackScaling: toFixed(1.1), baseKnockback: toFixed(4),
      launchAngle: 82, hitlagFrames: 4, id: 'musk_uair',
    }],
    hurtboxes: [{ activeFrames: [0, 28], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(28), height: toFixed(58), intangible: false, invincible: false }],
    iasa: 22, landingLag: 7,
  },
  downAir: {
    totalFrames: 36,
    hitboxes: [
      { activeFrames: [5, 8], offsetX: toFixed(0), offsetY: toFixed(-28), width: toFixed(22), height: toFixed(18), damage: 10, knockbackScaling: toFixed(1.1), baseKnockback: toFixed(5), launchAngle: 270, hitlagFrames: 5, id: 'musk_dair_sweet' },
      { activeFrames: [9, 18], offsetX: toFixed(0), offsetY: toFixed(-24), width: toFixed(28), height: toFixed(22), damage: 7, knockbackScaling: toFixed(0.9), baseKnockback: toFixed(3), launchAngle: 280, hitlagFrames: 4, id: 'musk_dair_late' },
    ],
    hurtboxes: [{ activeFrames: [0, 36], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(28), height: toFixed(58), intangible: false, invincible: false }],
    iasa: 29, landingLag: 12,
  },

  // === SPECIALS ===
  // neutralSpecial: Flamethrower Burst — "Not a Flamethrower" multi-hit fire
  neutralSpecial: {
    totalFrames: 36,
    hitboxes: [
      { activeFrames: [8, 12], offsetX: toFixed(30), offsetY: toFixed(4), width: toFixed(22), height: toFixed(22), damage: 5, knockbackScaling: toFixed(0.6), baseKnockback: toFixed(1), launchAngle: 40, hitlagFrames: 3, id: 'musk_flame1' },
      { activeFrames: [12, 16], offsetX: toFixed(44), offsetY: toFixed(4), width: toFixed(26), height: toFixed(26), damage: 5, knockbackScaling: toFixed(0.6), baseKnockback: toFixed(1), launchAngle: 40, hitlagFrames: 3, id: 'musk_flame2' },
      { activeFrames: [16, 22], offsetX: toFixed(56), offsetY: toFixed(4), width: toFixed(30), height: toFixed(30), damage: 7, knockbackScaling: toFixed(0.9), baseKnockback: toFixed(3), launchAngle: 42, hitlagFrames: 4, id: 'musk_flame3' },
    ],
    hurtboxes: [{ activeFrames: [0, 36], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(28), height: toFixed(58), intangible: false, invincible: false }],
    iasa: 28, landingLag: 6,
  },
  // sideSpecial: X-Factor — digital X shuriken (sticks to enemies)
  sideSpecial: {
    totalFrames: 38,
    hitboxes: [
      { activeFrames: [6, 10], offsetX: toFixed(26), offsetY: toFixed(4), width: toFixed(18), height: toFixed(18), damage: 6, knockbackScaling: toFixed(0.8), baseKnockback: toFixed(2), launchAngle: 40, hitlagFrames: 3, id: 'musk_xshuriken_throw' },
      { activeFrames: [10, 30], offsetX: toFixed(55), offsetY: toFixed(4), width: toFixed(20), height: toFixed(20), damage: 4, knockbackScaling: toFixed(0.5), baseKnockback: toFixed(1), launchAngle: 40, hitlagFrames: 3, id: 'musk_xshuriken_fly' },
    ],
    hurtboxes: [{ activeFrames: [0, 38], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(28), height: toFixed(58), intangible: false, invincible: false }],
    iasa: 30, landingLag: 7,
  },
  // upSpecial: Rocket Boost — SpaceX ascent recovery
  upSpecial: {
    totalFrames: 48,
    hitboxes: [
      { activeFrames: [3, 10], offsetX: toFixed(0), offsetY: toFixed(16), width: toFixed(32), height: toFixed(30), damage: 6, knockbackScaling: toFixed(0.8), baseKnockback: toFixed(3), launchAngle: 78, hitlagFrames: 4, id: 'musk_rocket_rise' },
      { activeFrames: [11, 20], offsetX: toFixed(0), offsetY: toFixed(44), width: toFixed(28), height: toFixed(26), damage: 13, knockbackScaling: toFixed(1.2), baseKnockback: toFixed(7), launchAngle: 90, hitlagFrames: 5, id: 'musk_rocket_apex' },
    ],
    hurtboxes: [{ activeFrames: [0, 48], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(28), height: toFixed(58), intangible: false, invincible: false }],
    iasa: 40, landingLag: 13,
  },
  // downSpecial / Ultimate: Mars Colonization — rocket grabs and drags upward
  downSpecial: {
    totalFrames: 68,
    hitboxes: [
      { activeFrames: [10, 16], offsetX: toFixed(28), offsetY: toFixed(0), width: toFixed(26), height: toFixed(50), damage: 8, knockbackScaling: toFixed(0.8), baseKnockback: toFixed(4), launchAngle: 90, hitlagFrames: 5, id: 'musk_rocket_grab' },
      { activeFrames: [17, 45], offsetX: toFixed(28), offsetY: toFixed(20), width: toFixed(20), height: toFixed(20), damage: 3, knockbackScaling: toFixed(0.4), baseKnockback: toFixed(1), launchAngle: 90, hitlagFrames: 3, id: 'musk_rocket_carry' },
      { activeFrames: [46, 55], offsetX: toFixed(0), offsetY: toFixed(60), width: toFixed(40), height: toFixed(30), damage: 20, knockbackScaling: toFixed(1.6), baseKnockback: toFixed(15), launchAngle: 90, hitlagFrames: 7, id: 'musk_rocket_launch' },
    ],
    hurtboxes: [{ activeFrames: [0, 68], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(28), height: toFixed(58), intangible: false, invincible: false }],
    iasa: 58, landingLag: 10,
  },
};
