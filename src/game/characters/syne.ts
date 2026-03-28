// src/game/characters/syne.ts
// Character stats and move data for Syne (Light)

import { toFixed } from '../../engine/physics/fixednum.js';
import type { FighterStats, Move } from '../../engine/ecs/component.js';

export const SYNE_STATS: FighterStats = {
  maxFallSpeed:     toFixed(-9.0),
  maxFastFallSpeed: toFixed(-13.0),
  jumpForce:        toFixed(17.0),
  doubleJumpForce:  toFixed(15.0),
  walkSpeed:        toFixed(5.5),
  runSpeed:         toFixed(8.5),
  weightClass:      toFixed(0.8),
};

export const SYNE_MOVES: Record<string, Move> = {
  // === JABS ===
  neutralJab1: {
    totalFrames: 14,
    hitboxes: [{
      activeFrames: [3, 6],
      offsetX: toFixed(14), offsetY: toFixed(5),
      width: toFixed(22), height: toFixed(22),
      damage: 4, knockbackScaling: toFixed(0.7), baseKnockback: toFixed(2),
      launchAngle: 45, hitlagFrames: 3, id: 'syne_jab1',
    }],
    hurtboxes: [{ activeFrames: [0, 14], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 11, landingLag: 0, nextJab: 'neutralJab2',
  },
  neutralJab2: {
    totalFrames: 14,
    hitboxes: [{
      activeFrames: [3, 6],
      offsetX: toFixed(14), offsetY: toFixed(5),
      width: toFixed(22), height: toFixed(22),
      damage: 4, knockbackScaling: toFixed(0.7), baseKnockback: toFixed(2),
      launchAngle: 45, hitlagFrames: 3, id: 'syne_jab2',
    }],
    hurtboxes: [{ activeFrames: [0, 14], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 11, landingLag: 0, nextJab: 'neutralJab3',
  },
  // === TILTS ===
  forwardTilt: {
    totalFrames: 26,
    hitboxes: [{
      activeFrames: [7, 12],
      offsetX: toFixed(18), offsetY: toFixed(0),
      width: toFixed(32), height: toFixed(28),
      damage: 9, knockbackScaling: toFixed(1.0), baseKnockback: toFixed(3),
      launchAngle: 38, hitlagFrames: 4, id: 'syne_ftilt',
    }],
    hurtboxes: [{ activeFrames: [0, 26], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 20, landingLag: 0,
  },
  upTilt: {
    totalFrames: 24,
    hitboxes: [{
      activeFrames: [5, 11],
      offsetX: toFixed(0), offsetY: toFixed(28),
      width: toFixed(36), height: toFixed(28),
      damage: 8, knockbackScaling: toFixed(1.0), baseKnockback: toFixed(4),
      launchAngle: 85, hitlagFrames: 4, id: 'syne_utilt',
    }],
    hurtboxes: [{ activeFrames: [0, 24], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 18, landingLag: 0,
  },
  downTilt: {
    totalFrames: 20,
    hitboxes: [{
      activeFrames: [5, 9],
      offsetX: toFixed(16), offsetY: toFixed(-20),
      width: toFixed(28), height: toFixed(18),
      damage: 7, knockbackScaling: toFixed(0.9), baseKnockback: toFixed(2),
      launchAngle: 25, hitlagFrames: 3, id: 'syne_dtilt',
    }],
    hurtboxes: [{ activeFrames: [0, 20], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 16, landingLag: 0,
  },
  // === SMASHES ===
  forwardSmash: {
    totalFrames: 50,
    hitboxes: [{
      activeFrames: [17, 25],
      offsetX: toFixed(36), offsetY: toFixed(8),
      width: toFixed(44), height: toFixed(28),
      damage: 16, knockbackScaling: toFixed(1.4), baseKnockback: toFixed(9),
      launchAngle: 40, hitlagFrames: 6, id: 'syne_fsmash',
    }],
    hurtboxes: [{ activeFrames: [0, 50], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 40, landingLag: 0, canCharge: true,
  },
  upSmash: {
    totalFrames: 42,
    hitboxes: [{
      activeFrames: [10, 18],
      offsetX: toFixed(0), offsetY: toFixed(36),
      width: toFixed(42), height: toFixed(36),
      damage: 14, knockbackScaling: toFixed(1.2), baseKnockback: toFixed(7),
      launchAngle: 88, hitlagFrames: 5, id: 'syne_usmash',
    }],
    hurtboxes: [{ activeFrames: [0, 42], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 34, landingLag: 0, canCharge: true,
  },
  downSmash: {
    totalFrames: 38,
    hitboxes: [
      { activeFrames: [7, 13], offsetX: toFixed(24), offsetY: toFixed(-14), width: toFixed(32), height: toFixed(22), damage: 12, knockbackScaling: toFixed(1.1), baseKnockback: toFixed(5), launchAngle: 30, hitlagFrames: 5, id: 'syne_dsmash_r' },
      { activeFrames: [7, 13], offsetX: toFixed(-24), offsetY: toFixed(-14), width: toFixed(32), height: toFixed(22), damage: 12, knockbackScaling: toFixed(1.1), baseKnockback: toFixed(5), launchAngle: 150, hitlagFrames: 5, id: 'syne_dsmash_l' },
    ],
    hurtboxes: [{ activeFrames: [0, 38], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 30, landingLag: 0, canCharge: true,
  },
  // === THROWS ===
  forwardThrow: {
    totalFrames: 26,
    hitboxes: [{ activeFrames: [7, 9], offsetX: toFixed(20), offsetY: toFixed(0), width: toFixed(20), height: toFixed(20), damage: 7, knockbackScaling: toFixed(0.9), baseKnockback: toFixed(8), launchAngle: 20, hitlagFrames: 4, id: 'syne_fthrow' }],
    hurtboxes: [{ activeFrames: [0, 26], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 26, landingLag: 0, isThrow: true,
  },
  backThrow: {
    totalFrames: 28,
    hitboxes: [{ activeFrames: [9, 11], offsetX: toFixed(-20), offsetY: toFixed(0), width: toFixed(20), height: toFixed(20), damage: 9, knockbackScaling: toFixed(1.0), baseKnockback: toFixed(9), launchAngle: 155, hitlagFrames: 4, id: 'syne_bthrow' }],
    hurtboxes: [{ activeFrames: [0, 28], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 28, landingLag: 0, isThrow: true,
  },
  upThrow: {
    totalFrames: 24,
    hitboxes: [{ activeFrames: [7, 9], offsetX: toFixed(0), offsetY: toFixed(20), width: toFixed(20), height: toFixed(20), damage: 6, knockbackScaling: toFixed(0.85), baseKnockback: toFixed(10), launchAngle: 90, hitlagFrames: 4, id: 'syne_uthrow' }],
    hurtboxes: [{ activeFrames: [0, 24], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 24, landingLag: 0, isThrow: true,
  },
  downThrow: {
    totalFrames: 30,
    hitboxes: [{ activeFrames: [9, 11], offsetX: toFixed(0), offsetY: toFixed(-10), width: toFixed(20), height: toFixed(20), damage: 5, knockbackScaling: toFixed(0.75), baseKnockback: toFixed(6), launchAngle: 70, hitlagFrames: 4, id: 'syne_dthrow' }],
    hurtboxes: [{ activeFrames: [0, 30], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 30, landingLag: 0, isThrow: true,
  },
  // === AERIALS ===
  neutralAir: {
    totalFrames: 28,
    hitboxes: [{
      activeFrames: [4, 13],
      offsetX: toFixed(0), offsetY: toFixed(0),
      width: toFixed(38), height: toFixed(48),
      damage: 7, knockbackScaling: toFixed(0.9), baseKnockback: toFixed(3),
      launchAngle: 45, hitlagFrames: 4, id: 'syne_nair',
    }],
    hurtboxes: [{ activeFrames: [0, 28], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 22, landingLag: 7,
  },
  forwardAir: {
    totalFrames: 30,
    hitboxes: [{
      activeFrames: [7, 13],
      offsetX: toFixed(24), offsetY: toFixed(4),
      width: toFixed(30), height: toFixed(28),
      damage: 11, knockbackScaling: toFixed(1.1), baseKnockback: toFixed(4),
      launchAngle: 45, hitlagFrames: 4, id: 'syne_fair',
    }],
    hurtboxes: [{ activeFrames: [0, 30], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 24, landingLag: 9,
  },
  backAir: {
    totalFrames: 28,
    hitboxes: [{
      activeFrames: [5, 10],
      offsetX: toFixed(-24), offsetY: toFixed(0),
      width: toFixed(28), height: toFixed(32),
      damage: 12, knockbackScaling: toFixed(1.2), baseKnockback: toFixed(6),
      launchAngle: 150, hitlagFrames: 4, id: 'syne_bair',
    }],
    hurtboxes: [{ activeFrames: [0, 28], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 22, landingLag: 7,
  },
  upAir: {
    totalFrames: 28,
    hitboxes: [{
      activeFrames: [6, 12],
      offsetX: toFixed(0), offsetY: toFixed(32),
      width: toFixed(36), height: toFixed(28),
      damage: 10, knockbackScaling: toFixed(1.1), baseKnockback: toFixed(5),
      launchAngle: 80, hitlagFrames: 4, id: 'syne_uair',
    }],
    hurtboxes: [{ activeFrames: [0, 28], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 22, landingLag: 7,
  },
  downAir: {
    totalFrames: 34,
    hitboxes: [{
      activeFrames: [6, 14],
      offsetX: toFixed(0), offsetY: toFixed(-26),
      width: toFixed(30), height: toFixed(24),
      damage: 9, knockbackScaling: toFixed(1.0), baseKnockback: toFixed(4),
      launchAngle: 270, hitlagFrames: 4, id: 'syne_dair',
    }],
    hurtboxes: [{ activeFrames: [0, 34], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 26, landingLag: 12,
  },
  // === SPECIALS ===
  neutralSpecial: {
    totalFrames: 30,
    hitboxes: [
      { activeFrames: [5, 9],  offsetX: toFixed(22), offsetY: toFixed(5), width: toFixed(22), height: toFixed(22), damage: 3, knockbackScaling: toFixed(0.5), baseKnockback: toFixed(2), launchAngle: 45, hitlagFrames: 3, id: 'syne_nspecial_1' },
      { activeFrames: [10, 14], offsetX: toFixed(22), offsetY: toFixed(5), width: toFixed(22), height: toFixed(22), damage: 3, knockbackScaling: toFixed(0.5), baseKnockback: toFixed(2), launchAngle: 45, hitlagFrames: 3, id: 'syne_nspecial_2' },
      { activeFrames: [15, 20], offsetX: toFixed(22), offsetY: toFixed(5), width: toFixed(26), height: toFixed(26), damage: 7, knockbackScaling: toFixed(1.0), baseKnockback: toFixed(5), launchAngle: 55, hitlagFrames: 4, id: 'syne_nspecial_3' },
    ],
    hurtboxes: [{ activeFrames: [0, 30], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 24, landingLag: 5,
  },
  sideSpecial: {
    totalFrames: 28,
    hitboxes: [{
      activeFrames: [3, 12],
      offsetX: toFixed(28), offsetY: toFixed(5),
      width: toFixed(30), height: toFixed(28),
      damage: 10, knockbackScaling: toFixed(1.0), baseKnockback: toFixed(4),
      launchAngle: 40, hitlagFrames: 4, id: 'syne_sspecial',
    }],
    // Intangible only during the active dash frames (3–12) — phase dash window.
    hurtboxes: [
      { activeFrames: [0, 2],   offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false },
      { activeFrames: [3, 12],  offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: true,  invincible: false },
      { activeFrames: [13, 28], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false },
    ],
    iasa: 22, landingLag: 6,
  },
  upSpecial: {
    totalFrames: 42,
    hitboxes: [
      { activeFrames: [3, 8], offsetX: toFixed(0), offsetY: toFixed(10), width: toFixed(32), height: toFixed(28), damage: 5, knockbackScaling: toFixed(0.7), baseKnockback: toFixed(3), launchAngle: 70, hitlagFrames: 3, id: 'syne_uspecial_1' },
      { activeFrames: [9, 16], offsetX: toFixed(0), offsetY: toFixed(35), width: toFixed(28), height: toFixed(28), damage: 11, knockbackScaling: toFixed(1.1), baseKnockback: toFixed(6), launchAngle: 88, hitlagFrames: 5, id: 'syne_uspecial_2' },
    ],
    hurtboxes: [{ activeFrames: [0, 42], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 34, landingLag: 10,
  },
  downSpecial: {
    totalFrames: 40,
    hitboxes: [
      { activeFrames: [14, 22], offsetX: toFixed(30), offsetY: toFixed(-8), width: toFixed(36), height: toFixed(22), damage: 9, knockbackScaling: toFixed(0.9), baseKnockback: toFixed(4), launchAngle: 35, hitlagFrames: 4, id: 'syne_dspecial_r' },
      { activeFrames: [14, 22], offsetX: toFixed(-30), offsetY: toFixed(-8), width: toFixed(36), height: toFixed(22), damage: 9, knockbackScaling: toFixed(0.9), baseKnockback: toFixed(4), launchAngle: 145, hitlagFrames: 4, id: 'syne_dspecial_l' },
    ],
    hurtboxes: [{ activeFrames: [0, 40], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 32, landingLag: 10,
  },
};
