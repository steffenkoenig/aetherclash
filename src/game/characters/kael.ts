// src/game/characters/kael.ts
// Character stats and move data for Kael (default character)

import { toFixed } from '../../engine/physics/fixednum.js';
import type { FighterStats, Move } from '../../engine/ecs/component.js';

export const KAEL_STATS: FighterStats = {
  maxFallSpeed:     toFixed(-12.0),
  maxFastFallSpeed: toFixed(-20.0),
  jumpForce:        toFixed(16.0),
  doubleJumpForce:  toFixed(14.0),
  walkSpeed:        toFixed(5.0),
  runSpeed:         toFixed(8.0),
  weightClass:      toFixed(1.0),
};

export const KAEL_MOVES: Record<string, Move> = {
  // === JABS ===
  neutralJab1: {
    totalFrames: 15,
    hitboxes: [{
      activeFrames: [3, 6],
      offsetX: toFixed(15), offsetY: toFixed(5),
      width: toFixed(25), height: toFixed(25),
      damage: 3, knockbackScaling: toFixed(0.8), baseKnockback: toFixed(3),
      launchAngle: 45, hitlagFrames: 4, id: 'kael_jab1',
    }],
    hurtboxes: [{ activeFrames: [0, 15], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 12, landingLag: 0, nextJab: 'neutralJab2',
  },
  neutralJab2: {
    totalFrames: 15,
    hitboxes: [{
      activeFrames: [3, 6],
      offsetX: toFixed(15), offsetY: toFixed(5),
      width: toFixed(25), height: toFixed(25),
      damage: 3, knockbackScaling: toFixed(0.8), baseKnockback: toFixed(3),
      launchAngle: 45, hitlagFrames: 4, id: 'kael_jab2',
    }],
    hurtboxes: [{ activeFrames: [0, 15], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 12, landingLag: 0, nextJab: 'neutralJab3',
  },
  neutralJab3: {
    totalFrames: 20,
    hitboxes: [{
      activeFrames: [4, 8],
      offsetX: toFixed(15), offsetY: toFixed(5),
      width: toFixed(30), height: toFixed(30),
      damage: 5, knockbackScaling: toFixed(0.9), baseKnockback: toFixed(4),
      launchAngle: 60, hitlagFrames: 4, id: 'kael_jab3',
    }],
    hurtboxes: [{ activeFrames: [0, 20], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 16, landingLag: 0,
  },
  // === TILTS ===
  forwardTilt: {
    totalFrames: 30,
    hitboxes: [{
      activeFrames: [8, 13],
      offsetX: toFixed(20), offsetY: toFixed(0),
      width: toFixed(35), height: toFixed(30),
      damage: 10, knockbackScaling: toFixed(1.1), baseKnockback: toFixed(4),
      launchAngle: 38, hitlagFrames: 4, id: 'kael_ftilt',
    }],
    hurtboxes: [{ activeFrames: [0, 30], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 24, landingLag: 0,
  },
  upTilt: {
    totalFrames: 28,
    hitboxes: [{
      activeFrames: [6, 12],
      offsetX: toFixed(0), offsetY: toFixed(30),
      width: toFixed(40), height: toFixed(30),
      damage: 9, knockbackScaling: toFixed(1.2), baseKnockback: toFixed(5),
      launchAngle: 85, hitlagFrames: 4, id: 'kael_utilt',
    }],
    hurtboxes: [{ activeFrames: [0, 28], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 22, landingLag: 0,
  },
  downTilt: {
    totalFrames: 22,
    hitboxes: [{
      activeFrames: [5, 9],
      offsetX: toFixed(18), offsetY: toFixed(-20),
      width: toFixed(30), height: toFixed(20),
      damage: 7, knockbackScaling: toFixed(0.9), baseKnockback: toFixed(2),
      launchAngle: 25, hitlagFrames: 4, id: 'kael_dtilt',
    }],
    hurtboxes: [{ activeFrames: [0, 22], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 18, landingLag: 0,
  },
  // === SMASHES ===
  forwardSmash: {
    totalFrames: 55,
    hitboxes: [{
      activeFrames: [20, 28],
      offsetX: toFixed(40), offsetY: toFixed(10),
      width: toFixed(50), height: toFixed(30),
      damage: 18, knockbackScaling: toFixed(1.5), baseKnockback: toFixed(10),
      launchAngle: 40, hitlagFrames: 6, id: 'kael_fsmash',
    }],
    hurtboxes: [{ activeFrames: [0, 55], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 45, landingLag: 0, canCharge: true,
  },
  upSmash: {
    totalFrames: 45,
    hitboxes: [
      { activeFrames: [10, 15], offsetX: toFixed(0), offsetY: toFixed(30), width: toFixed(40), height: toFixed(30), damage: 8, knockbackScaling: toFixed(1.0), baseKnockback: toFixed(4), launchAngle: 85, hitlagFrames: 4, id: 'kael_usmash_1' },
      { activeFrames: [16, 22], offsetX: toFixed(0), offsetY: toFixed(45), width: toFixed(45), height: toFixed(35), damage: 16, knockbackScaling: toFixed(1.3), baseKnockback: toFixed(8), launchAngle: 90, hitlagFrames: 6, id: 'kael_usmash_2' },
    ],
    hurtboxes: [{ activeFrames: [0, 45], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 38, landingLag: 0, canCharge: true,
  },
  downSmash: {
    totalFrames: 40,
    hitboxes: [
      { activeFrames: [8, 14], offsetX: toFixed(25), offsetY: toFixed(-15), width: toFixed(35), height: toFixed(25), damage: 12, knockbackScaling: toFixed(1.1), baseKnockback: toFixed(6), launchAngle: 30, hitlagFrames: 5, id: 'kael_dsmash_r' },
      { activeFrames: [8, 14], offsetX: toFixed(-25), offsetY: toFixed(-15), width: toFixed(35), height: toFixed(25), damage: 12, knockbackScaling: toFixed(1.1), baseKnockback: toFixed(6), launchAngle: 150, hitlagFrames: 5, id: 'kael_dsmash_l' },
    ],
    hurtboxes: [{ activeFrames: [0, 40], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 33, landingLag: 0, canCharge: true,
  },
  // === THROWS ===
  forwardThrow: {
    totalFrames: 28,
    hitboxes: [{
      activeFrames: [8, 10],
      offsetX: toFixed(20), offsetY: toFixed(0),
      width: toFixed(20), height: toFixed(20),
      damage: 8, knockbackScaling: toFixed(1.0), baseKnockback: toFixed(8),
      launchAngle: 15, hitlagFrames: 4, id: 'kael_fthrow',
    }],
    hurtboxes: [{ activeFrames: [0, 28], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 28, landingLag: 0, isThrow: true,
  },
  backThrow: {
    totalFrames: 30,
    hitboxes: [{
      activeFrames: [10, 12],
      offsetX: toFixed(-20), offsetY: toFixed(0),
      width: toFixed(20), height: toFixed(20),
      damage: 10, knockbackScaling: toFixed(1.1), baseKnockback: toFixed(9),
      launchAngle: 160, hitlagFrames: 4, id: 'kael_bthrow',
    }],
    hurtboxes: [{ activeFrames: [0, 30], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 30, landingLag: 0, isThrow: true,
  },
  upThrow: {
    totalFrames: 26,
    hitboxes: [{
      activeFrames: [8, 10],
      offsetX: toFixed(0), offsetY: toFixed(20),
      width: toFixed(20), height: toFixed(20),
      damage: 7, knockbackScaling: toFixed(0.9), baseKnockback: toFixed(10),
      launchAngle: 90, hitlagFrames: 4, id: 'kael_uthrow',
    }],
    hurtboxes: [{ activeFrames: [0, 26], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 26, landingLag: 0, isThrow: true,
  },
  downThrow: {
    totalFrames: 32,
    hitboxes: [{
      activeFrames: [10, 12],
      offsetX: toFixed(0), offsetY: toFixed(-10),
      width: toFixed(20), height: toFixed(20),
      damage: 6, knockbackScaling: toFixed(0.8), baseKnockback: toFixed(6),
      launchAngle: 60, hitlagFrames: 4, id: 'kael_dthrow',
    }],
    hurtboxes: [{ activeFrames: [0, 32], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 32, landingLag: 0, isThrow: true,
  },
  // === AERIALS ===
  neutralAir: {
    totalFrames: 30,
    hitboxes: [{
      activeFrames: [4, 14],
      offsetX: toFixed(0), offsetY: toFixed(0),
      width: toFixed(40), height: toFixed(50),
      damage: 8, knockbackScaling: toFixed(1.0), baseKnockback: toFixed(3),
      launchAngle: 45, hitlagFrames: 4, id: 'kael_nair',
    }],
    hurtboxes: [{ activeFrames: [0, 30], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 24, landingLag: 8,
  },
  forwardAir: {
    totalFrames: 35,
    hitboxes: [
      { activeFrames: [8, 12], offsetX: toFixed(30), offsetY: toFixed(5), width: toFixed(15), height: toFixed(15), damage: 12, knockbackScaling: toFixed(1.2), baseKnockback: toFixed(5), launchAngle: 35, hitlagFrames: 5, id: 'kael_fair_sweet' },
      { activeFrames: [8, 16], offsetX: toFixed(20), offsetY: toFixed(5), width: toFixed(30), height: toFixed(30), damage: 7, knockbackScaling: toFixed(0.9), baseKnockback: toFixed(3), launchAngle: 45, hitlagFrames: 4, id: 'kael_fair_sour' },
    ],
    hurtboxes: [{ activeFrames: [0, 35], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 28, landingLag: 10,
  },
  backAir: {
    totalFrames: 30,
    hitboxes: [{
      activeFrames: [6, 11],
      offsetX: toFixed(-25), offsetY: toFixed(0),
      width: toFixed(30), height: toFixed(35),
      damage: 14, knockbackScaling: toFixed(1.4), baseKnockback: toFixed(7),
      launchAngle: 150, hitlagFrames: 5, id: 'kael_bair',
    }],
    hurtboxes: [{ activeFrames: [0, 30], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 24, landingLag: 8,
  },
  upAir: {
    totalFrames: 30,
    hitboxes: [{
      activeFrames: [7, 13],
      offsetX: toFixed(0), offsetY: toFixed(35),
      width: toFixed(40), height: toFixed(30),
      damage: 10, knockbackScaling: toFixed(1.1), baseKnockback: toFixed(4),
      launchAngle: 80, hitlagFrames: 4, id: 'kael_uair',
    }],
    hurtboxes: [{ activeFrames: [0, 30], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 24, landingLag: 8,
  },
  downAir: {
    totalFrames: 38,
    hitboxes: [
      { activeFrames: [5, 8], offsetX: toFixed(0), offsetY: toFixed(-30), width: toFixed(25), height: toFixed(20), damage: 11, knockbackScaling: toFixed(1.2), baseKnockback: toFixed(6), launchAngle: 270, hitlagFrames: 5, id: 'kael_dair_sweet' },
      { activeFrames: [9, 18], offsetX: toFixed(0), offsetY: toFixed(-25), width: toFixed(30), height: toFixed(25), damage: 8, knockbackScaling: toFixed(1.0), baseKnockback: toFixed(3), launchAngle: 280, hitlagFrames: 4, id: 'kael_dair_late' },
    ],
    hurtboxes: [{ activeFrames: [0, 38], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 32, landingLag: 14,
  },
  // === SPECIALS ===
  neutralSpecial: {
    totalFrames: 35,
    hitboxes: [{
      activeFrames: [10, 20],
      offsetX: toFixed(25), offsetY: toFixed(5),
      width: toFixed(40), height: toFixed(40),
      damage: 12, knockbackScaling: toFixed(1.2), baseKnockback: toFixed(6),
      launchAngle: 45, hitlagFrames: 5, id: 'kael_nspecial',
    }],
    hurtboxes: [{ activeFrames: [0, 35], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 28, landingLag: 6,
  },
  sideSpecial: {
    totalFrames: 40,
    hitboxes: [
      { activeFrames: [5, 12], offsetX: toFixed(30), offsetY: toFixed(5), width: toFixed(20), height: toFixed(20), damage: 6, knockbackScaling: toFixed(0.8), baseKnockback: toFixed(3), launchAngle: 45, hitlagFrames: 4, id: 'kael_sspecial_hit1' },
      { activeFrames: [13, 22], offsetX: toFixed(40), offsetY: toFixed(5), width: toFixed(35), height: toFixed(30), damage: 10, knockbackScaling: toFixed(1.1), baseKnockback: toFixed(5), launchAngle: 38, hitlagFrames: 5, id: 'kael_sspecial_hit2' },
    ],
    hurtboxes: [{ activeFrames: [0, 40], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 32, landingLag: 8,
  },
  upSpecial: {
    totalFrames: 50,
    hitboxes: [
      { activeFrames: [4, 10], offsetX: toFixed(0), offsetY: toFixed(20), width: toFixed(35), height: toFixed(35), damage: 7, knockbackScaling: toFixed(0.9), baseKnockback: toFixed(4), launchAngle: 80, hitlagFrames: 4, id: 'kael_uspecial_rise' },
      { activeFrames: [11, 18], offsetX: toFixed(0), offsetY: toFixed(50), width: toFixed(30), height: toFixed(30), damage: 14, knockbackScaling: toFixed(1.3), baseKnockback: toFixed(8), launchAngle: 90, hitlagFrames: 6, id: 'kael_uspecial_apex' },
    ],
    hurtboxes: [{ activeFrames: [0, 50], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 42, landingLag: 14,
  },
  downSpecial: {
    totalFrames: 45,
    hitboxes: [
      { activeFrames: [15, 22], offsetX: toFixed(35), offsetY: toFixed(-10), width: toFixed(40), height: toFixed(20), damage: 8, knockbackScaling: toFixed(1.0), baseKnockback: toFixed(4), launchAngle: 30, hitlagFrames: 4, id: 'kael_dspecial_r' },
      { activeFrames: [15, 22], offsetX: toFixed(-35), offsetY: toFixed(-10), width: toFixed(40), height: toFixed(20), damage: 8, knockbackScaling: toFixed(1.0), baseKnockback: toFixed(4), launchAngle: 150, hitlagFrames: 4, id: 'kael_dspecial_l' },
    ],
    hurtboxes: [{ activeFrames: [0, 45], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 38, landingLag: 10,
  },
};
