// src/game/characters/zira.ts
// Character stats and move data for Zira (Ultra-Light, fastest character)

import { toFixed } from '../../engine/physics/fixednum.js';
import type { FighterStats, Move } from '../../engine/ecs/component.js';

export const ZIRA_STATS: FighterStats = {
  maxFallSpeed:     toFixed(-11.0),
  maxFastFallSpeed: toFixed(-18.0),
  jumpForce:        toFixed(18.0),
  doubleJumpForce:  toFixed(16.0),
  walkSpeed:        toFixed(7.0),
  runSpeed:         toFixed(11.0),
  weightClass:      toFixed(0.6),
};

export const ZIRA_MOVES: Record<string, Move> = {
  // === JABS ===
  neutralJab1: {
    totalFrames: 10,
    hitboxes: [{
      activeFrames: [2, 4],
      offsetX: toFixed(12), offsetY: toFixed(4),
      width: toFixed(18), height: toFixed(18),
      damage: 2, knockbackScaling: toFixed(0.7), baseKnockback: toFixed(1),
      launchAngle: 45, hitlagFrames: 3, id: 'zira_jab1',
    }],
    hurtboxes: [{ activeFrames: [0, 10], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 8, landingLag: 0, nextJab: 'neutralJab2',
  },
  neutralJab2: {
    totalFrames: 10,
    hitboxes: [{
      activeFrames: [2, 4],
      offsetX: toFixed(12), offsetY: toFixed(4),
      width: toFixed(18), height: toFixed(18),
      damage: 2, knockbackScaling: toFixed(0.7), baseKnockback: toFixed(1),
      launchAngle: 45, hitlagFrames: 3, id: 'zira_jab2',
    }],
    hurtboxes: [{ activeFrames: [0, 10], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 8, landingLag: 0, nextJab: 'neutralJab3',
  },
  // Rapid jab — multi-hit loop, each instance is 5 frames
  rapidJab: {
    totalFrames: 5,
    hitboxes: [{
      activeFrames: [1, 4],
      offsetX: toFixed(14), offsetY: toFixed(4),
      width: toFixed(20), height: toFixed(20),
      damage: 1, knockbackScaling: toFixed(0.5), baseKnockback: toFixed(0),
      launchAngle: 45, hitlagFrames: 2, id: 'zira_rapid_jab',
    }],
    hurtboxes: [{ activeFrames: [0, 5], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 4, landingLag: 0,
  },
  // === TILTS ===
  dashAttack: {
    totalFrames: 26,
    hitboxes: [{
      activeFrames: [4, 13],
      offsetX: toFixed(15), offsetY: toFixed(2),
      width: toFixed(32), height: toFixed(30),
      damage: 6, knockbackScaling: toFixed(0.8), baseKnockback: toFixed(2),
      launchAngle: 45, hitlagFrames: 4, id: 'zira_dash',
    }],
    hurtboxes: [{ activeFrames: [0, 26], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 20, landingLag: 0,
  },
  forwardTilt: {
    totalFrames: 24,
    hitboxes: [{
      activeFrames: [6, 11],
      offsetX: toFixed(18), offsetY: toFixed(0),
      width: toFixed(30), height: toFixed(26),
      damage: 9, knockbackScaling: toFixed(1.0), baseKnockback: toFixed(3),
      launchAngle: 38, hitlagFrames: 4, id: 'zira_ftilt',
    }],
    hurtboxes: [{ activeFrames: [0, 24], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 18, landingLag: 0,
  },
  upTilt: {
    totalFrames: 22,
    hitboxes: [{
      activeFrames: [5, 10],
      offsetX: toFixed(0), offsetY: toFixed(28),
      width: toFixed(34), height: toFixed(26),
      damage: 8, knockbackScaling: toFixed(1.0), baseKnockback: toFixed(4),
      launchAngle: 85, hitlagFrames: 4, id: 'zira_utilt',
    }],
    hurtboxes: [{ activeFrames: [0, 22], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 17, landingLag: 0,
  },
  downTilt: {
    totalFrames: 18,
    hitboxes: [{
      activeFrames: [4, 8],
      offsetX: toFixed(16), offsetY: toFixed(-18),
      width: toFixed(26), height: toFixed(16),
      damage: 6, knockbackScaling: toFixed(0.8), baseKnockback: toFixed(1),
      launchAngle: 20, hitlagFrames: 3, id: 'zira_dtilt',
    }],
    hurtboxes: [{ activeFrames: [0, 18], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 14, landingLag: 0,
  },
  // === SMASHES ===
  forwardSmash: {
    totalFrames: 46,
    hitboxes: [{
      activeFrames: [14, 22],
      offsetX: toFixed(34), offsetY: toFixed(8),
      width: toFixed(40), height: toFixed(26),
      damage: 15, knockbackScaling: toFixed(1.4), baseKnockback: toFixed(9),
      launchAngle: 40, hitlagFrames: 6, id: 'zira_fsmash',
    }],
    hurtboxes: [{ activeFrames: [0, 46], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 36, landingLag: 0, canCharge: true,
  },
  upSmash: {
    totalFrames: 40,
    hitboxes: [
      { activeFrames: [8, 13], offsetX: toFixed(0), offsetY: toFixed(28), width: toFixed(36), height: toFixed(28), damage: 6, knockbackScaling: toFixed(0.9), baseKnockback: toFixed(3), launchAngle: 85, hitlagFrames: 3, id: 'zira_usmash_1' },
      { activeFrames: [14, 20], offsetX: toFixed(0), offsetY: toFixed(42), width: toFixed(40), height: toFixed(32), damage: 13, knockbackScaling: toFixed(1.2), baseKnockback: toFixed(8), launchAngle: 90, hitlagFrames: 5, id: 'zira_usmash_2' },
    ],
    hurtboxes: [{ activeFrames: [0, 40], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 32, landingLag: 0, canCharge: true,
  },
  downSmash: {
    totalFrames: 36,
    hitboxes: [
      { activeFrames: [6, 12], offsetX: toFixed(22), offsetY: toFixed(-14), width: toFixed(30), height: toFixed(20), damage: 10, knockbackScaling: toFixed(1.1), baseKnockback: toFixed(5), launchAngle: 30, hitlagFrames: 4, id: 'zira_dsmash_r' },
      { activeFrames: [6, 12], offsetX: toFixed(-22), offsetY: toFixed(-14), width: toFixed(30), height: toFixed(20), damage: 10, knockbackScaling: toFixed(1.1), baseKnockback: toFixed(5), launchAngle: 150, hitlagFrames: 4, id: 'zira_dsmash_l' },
    ],
    hurtboxes: [{ activeFrames: [0, 36], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 28, landingLag: 0, canCharge: true,
  },
  // === THROWS ===
  forwardThrow: {
    totalFrames: 22,
    hitboxes: [{ activeFrames: [6, 8], offsetX: toFixed(20), offsetY: toFixed(0), width: toFixed(20), height: toFixed(20), damage: 5, knockbackScaling: toFixed(0.85), baseKnockback: toFixed(7), launchAngle: 20, hitlagFrames: 4, id: 'zira_fthrow' }],
    hurtboxes: [{ activeFrames: [0, 22], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 22, landingLag: 0, isThrow: true,
  },
  backThrow: {
    totalFrames: 24,
    hitboxes: [{ activeFrames: [8, 10], offsetX: toFixed(-20), offsetY: toFixed(0), width: toFixed(20), height: toFixed(20), damage: 7, knockbackScaling: toFixed(0.95), baseKnockback: toFixed(8), launchAngle: 150, hitlagFrames: 4, id: 'zira_bthrow' }],
    hurtboxes: [{ activeFrames: [0, 24], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 24, landingLag: 0, isThrow: true,
  },
  upThrow: {
    totalFrames: 20,
    hitboxes: [{ activeFrames: [6, 8], offsetX: toFixed(0), offsetY: toFixed(20), width: toFixed(20), height: toFixed(20), damage: 4, knockbackScaling: toFixed(0.8), baseKnockback: toFixed(11), launchAngle: 90, hitlagFrames: 4, id: 'zira_uthrow' }],
    hurtboxes: [{ activeFrames: [0, 20], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 20, landingLag: 0, isThrow: true,
  },
  downThrow: {
    totalFrames: 26,
    hitboxes: [{ activeFrames: [8, 10], offsetX: toFixed(0), offsetY: toFixed(-10), width: toFixed(20), height: toFixed(20), damage: 4, knockbackScaling: toFixed(0.7), baseKnockback: toFixed(5), launchAngle: 60, hitlagFrames: 4, id: 'zira_dthrow' }],
    hurtboxes: [{ activeFrames: [0, 26], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 26, landingLag: 0, isThrow: true,
  },
  // === AERIALS ===
  neutralAir: {
    totalFrames: 26,
    hitboxes: [{
      activeFrames: [3, 12],
      offsetX: toFixed(0), offsetY: toFixed(0),
      width: toFixed(36), height: toFixed(46),
      damage: 7, knockbackScaling: toFixed(0.9), baseKnockback: toFixed(2),
      launchAngle: 45, hitlagFrames: 3, id: 'zira_nair',
    }],
    hurtboxes: [{ activeFrames: [0, 26], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 20, landingLag: 6,
  },
  forwardAir: {
    totalFrames: 28,
    hitboxes: [{
      activeFrames: [6, 12],
      offsetX: toFixed(22), offsetY: toFixed(4),
      width: toFixed(28), height: toFixed(26),
      damage: 11, knockbackScaling: toFixed(1.1), baseKnockback: toFixed(4),
      launchAngle: 45, hitlagFrames: 4, id: 'zira_fair',
    }],
    hurtboxes: [{ activeFrames: [0, 28], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 22, landingLag: 8,
  },
  backAir: {
    totalFrames: 26,
    hitboxes: [{
      activeFrames: [5, 10],
      offsetX: toFixed(-22), offsetY: toFixed(0),
      width: toFixed(26), height: toFixed(30),
      damage: 13, knockbackScaling: toFixed(1.3), baseKnockback: toFixed(6),
      launchAngle: 150, hitlagFrames: 4, id: 'zira_bair',
    }],
    hurtboxes: [{ activeFrames: [0, 26], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 20, landingLag: 6,
  },
  upAir: {
    totalFrames: 26,
    hitboxes: [{
      activeFrames: [5, 11],
      offsetX: toFixed(0), offsetY: toFixed(30),
      width: toFixed(34), height: toFixed(26),
      damage: 10, knockbackScaling: toFixed(1.2), baseKnockback: toFixed(5),
      launchAngle: 80, hitlagFrames: 4, id: 'zira_uair',
    }],
    hurtboxes: [{ activeFrames: [0, 26], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 20, landingLag: 6,
  },
  // Down air — multi-hit drill (5 hits × 2 dmg) + final launch hit (14 dmg)
  downAir: {
    totalFrames: 44,
    hitboxes: [
      { activeFrames: [5, 9],   offsetX: toFixed(0), offsetY: toFixed(-22), width: toFixed(22), height: toFixed(18), damage: 2, knockbackScaling: toFixed(0.3), baseKnockback: toFixed(0), launchAngle: 270, hitlagFrames: 2, id: 'zira_dair_drill_1' },
      { activeFrames: [10, 14], offsetX: toFixed(0), offsetY: toFixed(-22), width: toFixed(22), height: toFixed(18), damage: 2, knockbackScaling: toFixed(0.3), baseKnockback: toFixed(0), launchAngle: 270, hitlagFrames: 2, id: 'zira_dair_drill_2' },
      { activeFrames: [15, 19], offsetX: toFixed(0), offsetY: toFixed(-22), width: toFixed(22), height: toFixed(18), damage: 2, knockbackScaling: toFixed(0.3), baseKnockback: toFixed(0), launchAngle: 270, hitlagFrames: 2, id: 'zira_dair_drill_3' },
      { activeFrames: [20, 24], offsetX: toFixed(0), offsetY: toFixed(-22), width: toFixed(22), height: toFixed(18), damage: 2, knockbackScaling: toFixed(0.3), baseKnockback: toFixed(0), launchAngle: 270, hitlagFrames: 2, id: 'zira_dair_drill_4' },
      { activeFrames: [25, 29], offsetX: toFixed(0), offsetY: toFixed(-22), width: toFixed(22), height: toFixed(18), damage: 2, knockbackScaling: toFixed(0.3), baseKnockback: toFixed(0), launchAngle: 270, hitlagFrames: 2, id: 'zira_dair_drill_5' },
      // Final launch hit
      { activeFrames: [30, 34], offsetX: toFixed(0), offsetY: toFixed(-24), width: toFixed(26), height: toFixed(20), damage: 14, knockbackScaling: toFixed(1.4), baseKnockback: toFixed(8), launchAngle: 270, hitlagFrames: 6, id: 'zira_dair_launch' },
    ],
    hurtboxes: [{ activeFrames: [0, 44], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 36, landingLag: 14,
  },
  // === SPECIALS ===
  neutralSpecial: {
    totalFrames: 22,
    hitboxes: [{
      activeFrames: [4, 12],
      offsetX: toFixed(20), offsetY: toFixed(5),
      width: toFixed(28), height: toFixed(28),
      damage: 8, knockbackScaling: toFixed(0.9), baseKnockback: toFixed(4),
      launchAngle: 45, hitlagFrames: 3, id: 'zira_nspecial',
    }],
    hurtboxes: [{ activeFrames: [0, 22], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 18, landingLag: 4,
  },
  sideSpecial: {
    totalFrames: 26,
    hitboxes: [
      { activeFrames: [3, 8],  offsetX: toFixed(18), offsetY: toFixed(5), width: toFixed(20), height: toFixed(20), damage: 3, knockbackScaling: toFixed(0.5), baseKnockback: toFixed(1), launchAngle: 45, hitlagFrames: 2, id: 'zira_sspecial_1' },
      { activeFrames: [9, 14], offsetX: toFixed(25), offsetY: toFixed(5), width: toFixed(20), height: toFixed(20), damage: 3, knockbackScaling: toFixed(0.5), baseKnockback: toFixed(1), launchAngle: 45, hitlagFrames: 2, id: 'zira_sspecial_2' },
      { activeFrames: [15, 20], offsetX: toFixed(30), offsetY: toFixed(5), width: toFixed(22), height: toFixed(22), damage: 8, knockbackScaling: toFixed(1.0), baseKnockback: toFixed(4), launchAngle: 38, hitlagFrames: 4, id: 'zira_sspecial_3' },
    ],
    hurtboxes: [{ activeFrames: [0, 26], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 20, landingLag: 6,
  },
  upSpecial: {
    totalFrames: 36,
    hitboxes: [
      { activeFrames: [2, 7],  offsetX: toFixed(0), offsetY: toFixed(12), width: toFixed(28), height: toFixed(25), damage: 4, knockbackScaling: toFixed(0.6), baseKnockback: toFixed(2), launchAngle: 70, hitlagFrames: 3, id: 'zira_uspecial_1' },
      { activeFrames: [8, 14], offsetX: toFixed(0), offsetY: toFixed(32), width: toFixed(24), height: toFixed(24), damage: 10, knockbackScaling: toFixed(1.1), baseKnockback: toFixed(5), launchAngle: 90, hitlagFrames: 4, id: 'zira_uspecial_2' },
    ],
    hurtboxes: [{ activeFrames: [0, 36], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 28, landingLag: 8,
  },
  downSpecial: {
    totalFrames: 32,
    hitboxes: [
      { activeFrames: [8, 14], offsetX: toFixed(28), offsetY: toFixed(-10), width: toFixed(32), height: toFixed(20), damage: 7, knockbackScaling: toFixed(0.8), baseKnockback: toFixed(3), launchAngle: 30, hitlagFrames: 3, id: 'zira_dspecial_r' },
      { activeFrames: [8, 14], offsetX: toFixed(-28), offsetY: toFixed(-10), width: toFixed(32), height: toFixed(20), damage: 7, knockbackScaling: toFixed(0.8), baseKnockback: toFixed(3), launchAngle: 150, hitlagFrames: 3, id: 'zira_dspecial_l' },
    ],
    hurtboxes: [{ activeFrames: [0, 32], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 26, landingLag: 6,
  },
};
