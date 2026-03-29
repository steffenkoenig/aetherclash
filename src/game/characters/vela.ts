// src/game/characters/vela.ts
// Character stats and move data for Vela (Heavy, fast runner)

import { toFixed } from '../../engine/physics/fixednum.js';
import type { FighterStats, Move } from '../../engine/ecs/component.js';

export const VELA_STATS: FighterStats = {
  maxFallSpeed:     toFixed(-13.0),
  maxFastFallSpeed: toFixed(-21.0),
  jumpForce:        toFixed(16.0),
  doubleJumpForce:  toFixed(13.0),
  walkSpeed:        toFixed(6.0),
  runSpeed:         toFixed(9.5),
  weightClass:      toFixed(1.3),
};

export const VELA_MOVES: Record<string, Move> = {
  // === JABS ===
  neutralJab1: {
    totalFrames: 16,
    hitboxes: [{
      activeFrames: [4, 7],
      offsetX: toFixed(16), offsetY: toFixed(5),
      width: toFixed(28), height: toFixed(26),
      damage: 5, knockbackScaling: toFixed(0.9), baseKnockback: toFixed(3),
      launchAngle: 45, hitlagFrames: 4, id: 'vela_jab1',
    }],
    hurtboxes: [{ activeFrames: [0, 16], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 13, landingLag: 0, nextJab: 'neutralJab2',
  },
  neutralJab2: {
    totalFrames: 18,
    hitboxes: [{
      activeFrames: [4, 8],
      offsetX: toFixed(16), offsetY: toFixed(5),
      width: toFixed(30), height: toFixed(28),
      damage: 7, knockbackScaling: toFixed(0.9), baseKnockback: toFixed(3),
      launchAngle: 50, hitlagFrames: 4, id: 'vela_jab2',
    }],
    hurtboxes: [{ activeFrames: [0, 18], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 14, landingLag: 0, nextJab: 'neutralJab3',
  },
  // === TILTS ===
  dashAttack: {
    totalFrames: 35,
    hitboxes: [{
      activeFrames: [7, 17],
      offsetX: toFixed(22), offsetY: toFixed(0),
      width: toFixed(48), height: toFixed(36),
      damage: 10, knockbackScaling: toFixed(1.0), baseKnockback: toFixed(4),
      launchAngle: 38, hitlagFrames: 4, id: 'vela_dash',
    }],
    hurtboxes: [{ activeFrames: [0, 35], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 28, landingLag: 0,
  },
  getupAttack: {
    totalFrames: 22,
    hitboxes: [{
      activeFrames: [4, 13],
      offsetX: toFixed(22), offsetY: toFixed(-6),
      width: toFixed(40), height: toFixed(28),
      damage: 6, knockbackScaling: toFixed(0.85), baseKnockback: toFixed(4),
      launchAngle: 72, hitlagFrames: 4, id: 'vela_getup',
    }],
    hurtboxes: [{ activeFrames: [0, 22], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 18, landingLag: 0,
  },
  forwardTilt: {
    totalFrames: 28,
    hitboxes: [{
      activeFrames: [7, 13],
      offsetX: toFixed(30), offsetY: toFixed(2),
      width: toFixed(50), height: toFixed(28),
      damage: 12, knockbackScaling: toFixed(1.2), baseKnockback: toFixed(4),
      launchAngle: 38, hitlagFrames: 4, id: 'vela_ftilt',
    }],
    hurtboxes: [{ activeFrames: [0, 28], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 22, landingLag: 0,
  },
  upTilt: {
    totalFrames: 26,
    hitboxes: [{
      activeFrames: [6, 11],
      offsetX: toFixed(0), offsetY: toFixed(30),
      width: toFixed(42), height: toFixed(30),
      damage: 9, knockbackScaling: toFixed(1.0), baseKnockback: toFixed(3),
      launchAngle: 85, hitlagFrames: 4, id: 'vela_utilt',
    }],
    hurtboxes: [{ activeFrames: [0, 26], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 20, landingLag: 0,
  },
  downTilt: {
    totalFrames: 20,
    hitboxes: [{
      activeFrames: [5, 9],
      offsetX: toFixed(20), offsetY: toFixed(-20),
      width: toFixed(32), height: toFixed(20),
      damage: 8, knockbackScaling: toFixed(0.9), baseKnockback: toFixed(2),
      launchAngle: 25, hitlagFrames: 4, id: 'vela_dtilt',
    }],
    hurtboxes: [{ activeFrames: [0, 20], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 16, landingLag: 0,
  },
  // === SMASHES ===
  forwardSmash: {
    totalFrames: 52,
    hitboxes: [
      // First stage — short-range burst
      { activeFrames: [15, 20], offsetX: toFixed(30), offsetY: toFixed(5), width: toFixed(35), height: toFixed(30), damage: 8, knockbackScaling: toFixed(0.9), baseKnockback: toFixed(4), launchAngle: 40, hitlagFrames: 4, id: 'vela_fsmash_1' },
      // Second stage — disjointed blade tip
      { activeFrames: [21, 28], offsetX: toFixed(55), offsetY: toFixed(5), width: toFixed(40), height: toFixed(28), damage: 20, knockbackScaling: toFixed(1.6), baseKnockback: toFixed(10), launchAngle: 38, hitlagFrames: 7, id: 'vela_fsmash_2' },
    ],
    hurtboxes: [{ activeFrames: [0, 52], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 42, landingLag: 0, canCharge: true,
  },
  upSmash: {
    totalFrames: 44,
    hitboxes: [{
      activeFrames: [12, 20],
      offsetX: toFixed(0), offsetY: toFixed(40),
      width: toFixed(48), height: toFixed(40),
      damage: 17, knockbackScaling: toFixed(1.4), baseKnockback: toFixed(9),
      launchAngle: 88, hitlagFrames: 6, id: 'vela_usmash',
    }],
    hurtboxes: [{ activeFrames: [0, 44], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 36, landingLag: 0, canCharge: true,
  },
  downSmash: {
    totalFrames: 42,
    hitboxes: [
      { activeFrames: [8, 14], offsetX: toFixed(28), offsetY: toFixed(-15), width: toFixed(38), height: toFixed(25), damage: 14, knockbackScaling: toFixed(1.2), baseKnockback: toFixed(7), launchAngle: 30, hitlagFrames: 5, id: 'vela_dsmash_r' },
      { activeFrames: [8, 14], offsetX: toFixed(-28), offsetY: toFixed(-15), width: toFixed(38), height: toFixed(25), damage: 14, knockbackScaling: toFixed(1.2), baseKnockback: toFixed(7), launchAngle: 150, hitlagFrames: 5, id: 'vela_dsmash_l' },
    ],
    hurtboxes: [{ activeFrames: [0, 42], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 34, landingLag: 0, canCharge: true,
  },
  // === THROWS ===
  forwardThrow: {
    totalFrames: 24,
    hitboxes: [{ activeFrames: [6, 8], offsetX: toFixed(20), offsetY: toFixed(0), width: toFixed(20), height: toFixed(20), damage: 6, knockbackScaling: toFixed(0.9), baseKnockback: toFixed(7), launchAngle: 20, hitlagFrames: 4, id: 'vela_fthrow' }],
    hurtboxes: [{ activeFrames: [0, 24], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 24, landingLag: 0, isThrow: true,
  },
  backThrow: {
    totalFrames: 26,
    hitboxes: [{ activeFrames: [8, 10], offsetX: toFixed(-20), offsetY: toFixed(0), width: toFixed(20), height: toFixed(20), damage: 8, knockbackScaling: toFixed(1.0), baseKnockback: toFixed(8), launchAngle: 155, hitlagFrames: 4, id: 'vela_bthrow' }],
    hurtboxes: [{ activeFrames: [0, 26], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 26, landingLag: 0, isThrow: true,
  },
  upThrow: {
    totalFrames: 22,
    hitboxes: [{ activeFrames: [6, 8], offsetX: toFixed(0), offsetY: toFixed(20), width: toFixed(20), height: toFixed(20), damage: 5, knockbackScaling: toFixed(0.8), baseKnockback: toFixed(9), launchAngle: 90, hitlagFrames: 4, id: 'vela_uthrow' }],
    hurtboxes: [{ activeFrames: [0, 22], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 22, landingLag: 0, isThrow: true,
  },
  downThrow: {
    totalFrames: 28,
    hitboxes: [{ activeFrames: [8, 10], offsetX: toFixed(0), offsetY: toFixed(-10), width: toFixed(20), height: toFixed(20), damage: 5, knockbackScaling: toFixed(0.7), baseKnockback: toFixed(5), launchAngle: 65, hitlagFrames: 4, id: 'vela_dthrow' }],
    hurtboxes: [{ activeFrames: [0, 28], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 28, landingLag: 0, isThrow: true,
  },
  // === AERIALS ===
  neutralAir: {
    totalFrames: 28,
    hitboxes: [{
      activeFrames: [4, 14],
      offsetX: toFixed(0), offsetY: toFixed(0),
      width: toFixed(45), height: toFixed(52),
      damage: 9, knockbackScaling: toFixed(1.0), baseKnockback: toFixed(3),
      launchAngle: 45, hitlagFrames: 4, id: 'vela_nair',
    }],
    hurtboxes: [{ activeFrames: [0, 28], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 22, landingLag: 8,
  },
  forwardAir: {
    totalFrames: 32,
    hitboxes: [{
      activeFrames: [7, 13],
      offsetX: toFixed(28), offsetY: toFixed(-5),
      width: toFixed(38), height: toFixed(32),
      damage: 15, knockbackScaling: toFixed(1.4), baseKnockback: toFixed(6),
      launchAngle: 310, hitlagFrames: 5, id: 'vela_fair',
    }],
    hurtboxes: [{ activeFrames: [0, 32], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 25, landingLag: 10,
  },
  backAir: {
    totalFrames: 28,
    hitboxes: [{
      activeFrames: [5, 11],
      offsetX: toFixed(-28), offsetY: toFixed(0),
      width: toFixed(35), height: toFixed(36),
      damage: 16, knockbackScaling: toFixed(1.5), baseKnockback: toFixed(8),
      launchAngle: 150, hitlagFrames: 5, id: 'vela_bair',
    }],
    hurtboxes: [{ activeFrames: [0, 28], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 22, landingLag: 8,
  },
  upAir: {
    totalFrames: 28,
    hitboxes: [{
      activeFrames: [6, 12],
      offsetX: toFixed(0), offsetY: toFixed(36),
      width: toFixed(42), height: toFixed(30),
      damage: 11, knockbackScaling: toFixed(1.2), baseKnockback: toFixed(5),
      launchAngle: 80, hitlagFrames: 4, id: 'vela_uair',
    }],
    hurtboxes: [{ activeFrames: [0, 28], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 22, landingLag: 8,
  },
  downAir: {
    totalFrames: 36,
    hitboxes: [{
      activeFrames: [7, 15],
      offsetX: toFixed(0), offsetY: toFixed(-28),
      width: toFixed(34), height: toFixed(28),
      damage: 13, knockbackScaling: toFixed(1.3), baseKnockback: toFixed(7),
      launchAngle: 260, hitlagFrames: 5, id: 'vela_dair',
    }],
    hurtboxes: [{ activeFrames: [0, 36], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 28, landingLag: 12,
  },
  // === SPECIALS ===
  neutralSpecial: {
    totalFrames: 38,
    hitboxes: [{
      activeFrames: [8, 20],
      offsetX: toFixed(35), offsetY: toFixed(0),
      width: toFixed(50), height: toFixed(20),
      damage: 9, knockbackScaling: toFixed(1.0), baseKnockback: toFixed(4),
      launchAngle: 45, hitlagFrames: 4, id: 'vela_nspecial',
    }],
    hurtboxes: [{ activeFrames: [0, 38], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 30, landingLag: 6,
  },
  sideSpecial: {
    totalFrames: 32,
    hitboxes: [{
      activeFrames: [4, 16],
      offsetX: toFixed(30), offsetY: toFixed(5),
      width: toFixed(40), height: toFixed(35),
      damage: 11, knockbackScaling: toFixed(1.1), baseKnockback: toFixed(5),
      launchAngle: 42, hitlagFrames: 5, id: 'vela_sspecial',
    }],
    hurtboxes: [{ activeFrames: [0, 32], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 26, landingLag: 8,
  },
  upSpecial: {
    totalFrames: 44,
    hitboxes: [
      { activeFrames: [3, 8], offsetX: toFixed(0), offsetY: toFixed(15), width: toFixed(35), height: toFixed(30), damage: 6, knockbackScaling: toFixed(0.8), baseKnockback: toFixed(3), launchAngle: 75, hitlagFrames: 4, id: 'vela_uspecial_hit1' },
      { activeFrames: [9, 16], offsetX: toFixed(0), offsetY: toFixed(40), width: toFixed(30), height: toFixed(28), damage: 13, knockbackScaling: toFixed(1.2), baseKnockback: toFixed(7), launchAngle: 85, hitlagFrames: 5, id: 'vela_uspecial_hit2' },
    ],
    hurtboxes: [{ activeFrames: [0, 44], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 36, landingLag: 12,
  },
  downSpecial: {
    totalFrames: 42,
    hitboxes: [
      { activeFrames: [10, 18], offsetX: toFixed(38), offsetY: toFixed(-12), width: toFixed(42), height: toFixed(22), damage: 10, knockbackScaling: toFixed(1.0), baseKnockback: toFixed(5), launchAngle: 32, hitlagFrames: 4, id: 'vela_dspecial_r' },
      { activeFrames: [10, 18], offsetX: toFixed(-38), offsetY: toFixed(-12), width: toFixed(42), height: toFixed(22), damage: 10, knockbackScaling: toFixed(1.0), baseKnockback: toFixed(5), launchAngle: 148, hitlagFrames: 4, id: 'vela_dspecial_l' },
    ],
    hurtboxes: [{ activeFrames: [0, 42], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 34, landingLag: 10,
  },
};
