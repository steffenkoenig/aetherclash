// src/game/characters/lizzy.ts
// Character stats and move data for The Eternal Regent (satirical Queen Elizabeth II Ghost)
// Strengths: high poise (hard to interrupt), spectral corgi hitboxes; Weakness: slowest walk speed.

import { toFixed } from '../../engine/physics/fixednum.js';
import type { FighterStats, Move } from '../../engine/ecs/component.js';

export const LIZZY_STATS: FighterStats = {
  maxFallSpeed:     toFixed(-10.0),
  maxFastFallSpeed: toFixed(-16.0),
  jumpForce:        toFixed(15.5),
  doubleJumpForce:  toFixed(13.5),
  walkSpeed:        toFixed(2.5),   // Slowest walk speed in the roster
  runSpeed:         toFixed(7.0),
  weightClass:      toFixed(0.95),
};

export const LIZZY_MOVES: Record<string, Move> = {
  // === JABS — high poise (invincible hurtboxes during active hitbox) ===
  neutralJab1: {
    totalFrames: 16,
    hitboxes: [{
      activeFrames: [4, 8],
      offsetX: toFixed(16), offsetY: toFixed(5),
      width: toFixed(26), height: toFixed(26),
      damage: 4, knockbackScaling: toFixed(0.9), baseKnockback: toFixed(3),
      launchAngle: 45, hitlagFrames: 4, id: 'lizzy_jab1',
    }],
    // High poise — intangible while hitting
    hurtboxes: [{ activeFrames: [4, 8], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: true, invincible: false }],
    iasa: 13, landingLag: 0, nextJab: 'neutralJab2',
  },
  neutralJab2: {
    totalFrames: 16,
    hitboxes: [{
      activeFrames: [4, 8],
      offsetX: toFixed(16), offsetY: toFixed(5),
      width: toFixed(26), height: toFixed(26),
      damage: 4, knockbackScaling: toFixed(0.9), baseKnockback: toFixed(3),
      launchAngle: 45, hitlagFrames: 4, id: 'lizzy_jab2',
    }],
    hurtboxes: [{ activeFrames: [4, 8], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: true, invincible: false }],
    iasa: 13, landingLag: 0, nextJab: 'neutralJab3',
  },
  neutralJab3: {
    totalFrames: 20,
    hitboxes: [{
      activeFrames: [5, 10],
      offsetX: toFixed(18), offsetY: toFixed(4),
      width: toFixed(30), height: toFixed(28),
      damage: 6, knockbackScaling: toFixed(1.0), baseKnockback: toFixed(5),
      launchAngle: 55, hitlagFrames: 4, id: 'lizzy_jab3',
    }],
    hurtboxes: [{ activeFrames: [5, 10], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: true, invincible: false }],
    iasa: 16, landingLag: 0,
  },

  // === TILTS ===
  dashAttack: {
    totalFrames: 32,
    hitboxes: [{
      activeFrames: [6, 15],
      offsetX: toFixed(20), offsetY: toFixed(0),
      width: toFixed(40), height: toFixed(34),
      damage: 9, knockbackScaling: toFixed(1.0), baseKnockback: toFixed(3),
      launchAngle: 40, hitlagFrames: 4, id: 'lizzy_dash',
    }],
    hurtboxes: [{ activeFrames: [6, 15], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: true, invincible: false }],
    iasa: 26, landingLag: 0,
  },
  getupAttack: {
    totalFrames: 24,
    hitboxes: [{
      activeFrames: [5, 13],
      offsetX: toFixed(20), offsetY: toFixed(-8),
      width: toFixed(36), height: toFixed(26),
      damage: 6, knockbackScaling: toFixed(0.8), baseKnockback: toFixed(3),
      launchAngle: 74, hitlagFrames: 4, id: 'lizzy_getup',
    }],
    hurtboxes: [{ activeFrames: [0, 24], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 20, landingLag: 0,
  },
  forwardTilt: {
    totalFrames: 30,
    hitboxes: [{
      activeFrames: [8, 14],
      offsetX: toFixed(22), offsetY: toFixed(0),
      width: toFixed(36), height: toFixed(30),
      damage: 10, knockbackScaling: toFixed(1.1), baseKnockback: toFixed(4),
      launchAngle: 40, hitlagFrames: 4, id: 'lizzy_ftilt',
    }],
    hurtboxes: [{ activeFrames: [8, 14], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: true, invincible: false }],
    iasa: 24, landingLag: 0,
  },
  upTilt: {
    totalFrames: 28,
    hitboxes: [{
      activeFrames: [6, 12],
      offsetX: toFixed(0), offsetY: toFixed(30),
      width: toFixed(40), height: toFixed(28),
      damage: 10, knockbackScaling: toFixed(1.2), baseKnockback: toFixed(5),
      launchAngle: 85, hitlagFrames: 4, id: 'lizzy_utilt',
    }],
    hurtboxes: [{ activeFrames: [6, 12], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: true, invincible: false }],
    iasa: 22, landingLag: 0,
  },
  downTilt: {
    totalFrames: 22,
    hitboxes: [{
      activeFrames: [5, 9],
      offsetX: toFixed(18), offsetY: toFixed(-20),
      width: toFixed(30), height: toFixed(18),
      damage: 7, knockbackScaling: toFixed(0.9), baseKnockback: toFixed(2),
      launchAngle: 22, hitlagFrames: 3, id: 'lizzy_dtilt',
    }],
    hurtboxes: [{ activeFrames: [0, 22], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 18, landingLag: 0,
  },

  // === SMASHES — poise during active ===
  forwardSmash: {
    totalFrames: 52,
    hitboxes: [{
      activeFrames: [19, 27],
      offsetX: toFixed(38), offsetY: toFixed(8),
      width: toFixed(50), height: toFixed(30),
      damage: 18, knockbackScaling: toFixed(1.5), baseKnockback: toFixed(10),
      launchAngle: 40, hitlagFrames: 6, id: 'lizzy_fsmash',
    }],
    hurtboxes: [{ activeFrames: [19, 27], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: true, invincible: false }],
    iasa: 43, landingLag: 0, canCharge: true,
  },
  upSmash: {
    totalFrames: 44,
    hitboxes: [
      { activeFrames: [10, 15], offsetX: toFixed(0), offsetY: toFixed(28), width: toFixed(38), height: toFixed(28), damage: 8, knockbackScaling: toFixed(1.0), baseKnockback: toFixed(4), launchAngle: 85, hitlagFrames: 4, id: 'lizzy_usmash_1' },
      { activeFrames: [16, 22], offsetX: toFixed(0), offsetY: toFixed(44), width: toFixed(44), height: toFixed(34), damage: 16, knockbackScaling: toFixed(1.4), baseKnockback: toFixed(9), launchAngle: 90, hitlagFrames: 6, id: 'lizzy_usmash_2' },
    ],
    hurtboxes: [{ activeFrames: [10, 22], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: true, invincible: false }],
    iasa: 37, landingLag: 0, canCharge: true,
  },
  downSmash: {
    totalFrames: 40,
    hitboxes: [
      { activeFrames: [8, 14], offsetX: toFixed(26), offsetY: toFixed(-14), width: toFixed(36), height: toFixed(24), damage: 13, knockbackScaling: toFixed(1.2), baseKnockback: toFixed(6), launchAngle: 30, hitlagFrames: 5, id: 'lizzy_dsmash_r' },
      { activeFrames: [8, 14], offsetX: toFixed(-26), offsetY: toFixed(-14), width: toFixed(36), height: toFixed(24), damage: 13, knockbackScaling: toFixed(1.2), baseKnockback: toFixed(6), launchAngle: 150, hitlagFrames: 5, id: 'lizzy_dsmash_l' },
    ],
    hurtboxes: [{ activeFrames: [8, 14], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: true, invincible: false }],
    iasa: 33, landingLag: 0, canCharge: true,
  },

  // === THROWS ===
  forwardThrow: {
    totalFrames: 28,
    hitboxes: [{ activeFrames: [8, 10], offsetX: toFixed(20), offsetY: toFixed(0), width: toFixed(18), height: toFixed(18), damage: 8, knockbackScaling: toFixed(1.0), baseKnockback: toFixed(8), launchAngle: 15, hitlagFrames: 4, id: 'lizzy_fthrow' }],
    hurtboxes: [{ activeFrames: [0, 28], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 28, landingLag: 0, isThrow: true,
  },
  backThrow: {
    totalFrames: 30,
    hitboxes: [{ activeFrames: [10, 12], offsetX: toFixed(-20), offsetY: toFixed(0), width: toFixed(18), height: toFixed(18), damage: 10, knockbackScaling: toFixed(1.1), baseKnockback: toFixed(9), launchAngle: 160, hitlagFrames: 4, id: 'lizzy_bthrow' }],
    hurtboxes: [{ activeFrames: [0, 30], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 30, landingLag: 0, isThrow: true,
  },
  upThrow: {
    totalFrames: 26,
    hitboxes: [{ activeFrames: [8, 10], offsetX: toFixed(0), offsetY: toFixed(18), width: toFixed(18), height: toFixed(18), damage: 7, knockbackScaling: toFixed(0.9), baseKnockback: toFixed(10), launchAngle: 90, hitlagFrames: 4, id: 'lizzy_uthrow' }],
    hurtboxes: [{ activeFrames: [0, 26], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 26, landingLag: 0, isThrow: true,
  },
  downThrow: {
    totalFrames: 32,
    hitboxes: [{ activeFrames: [10, 12], offsetX: toFixed(0), offsetY: toFixed(-10), width: toFixed(18), height: toFixed(18), damage: 6, knockbackScaling: toFixed(0.8), baseKnockback: toFixed(6), launchAngle: 60, hitlagFrames: 4, id: 'lizzy_dthrow' }],
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
      launchAngle: 45, hitlagFrames: 4, id: 'lizzy_nair',
    }],
    // Poise during nair active
    hurtboxes: [{ activeFrames: [4, 14], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: true, invincible: false }],
    iasa: 24, landingLag: 8,
  },
  forwardAir: {
    totalFrames: 34,
    hitboxes: [
      { activeFrames: [8, 12], offsetX: toFixed(28), offsetY: toFixed(4), width: toFixed(14), height: toFixed(14), damage: 12, knockbackScaling: toFixed(1.2), baseKnockback: toFixed(5), launchAngle: 35, hitlagFrames: 5, id: 'lizzy_fair_sweet' },
      { activeFrames: [8, 16], offsetX: toFixed(18), offsetY: toFixed(4), width: toFixed(28), height: toFixed(28), damage: 7, knockbackScaling: toFixed(0.9), baseKnockback: toFixed(3), launchAngle: 44, hitlagFrames: 4, id: 'lizzy_fair_sour' },
    ],
    hurtboxes: [{ activeFrames: [8, 16], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: true, invincible: false }],
    iasa: 28, landingLag: 9,
  },
  backAir: {
    totalFrames: 30,
    hitboxes: [{
      activeFrames: [6, 11],
      offsetX: toFixed(-24), offsetY: toFixed(0),
      width: toFixed(30), height: toFixed(34),
      damage: 13, knockbackScaling: toFixed(1.3), baseKnockback: toFixed(6),
      launchAngle: 150, hitlagFrames: 5, id: 'lizzy_bair',
    }],
    hurtboxes: [{ activeFrames: [6, 11], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: true, invincible: false }],
    iasa: 24, landingLag: 8,
  },
  upAir: {
    totalFrames: 30,
    hitboxes: [{
      activeFrames: [7, 13],
      offsetX: toFixed(0), offsetY: toFixed(34),
      width: toFixed(40), height: toFixed(28),
      damage: 10, knockbackScaling: toFixed(1.1), baseKnockback: toFixed(4),
      launchAngle: 80, hitlagFrames: 4, id: 'lizzy_uair',
    }],
    hurtboxes: [{ activeFrames: [7, 13], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: true, invincible: false }],
    iasa: 24, landingLag: 8,
  },
  downAir: {
    totalFrames: 38,
    hitboxes: [
      { activeFrames: [5, 8], offsetX: toFixed(0), offsetY: toFixed(-30), width: toFixed(24), height: toFixed(18), damage: 11, knockbackScaling: toFixed(1.2), baseKnockback: toFixed(6), launchAngle: 270, hitlagFrames: 5, id: 'lizzy_dair_sweet' },
      { activeFrames: [9, 18], offsetX: toFixed(0), offsetY: toFixed(-24), width: toFixed(30), height: toFixed(24), damage: 8, knockbackScaling: toFixed(1.0), baseKnockback: toFixed(3), launchAngle: 280, hitlagFrames: 4, id: 'lizzy_dair_late' },
    ],
    hurtboxes: [{ activeFrames: [0, 38], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 32, landingLag: 13,
  },

  // === SPECIALS ===
  // neutralSpecial: Spectral Corgi — launches a corgi hitbox forward
  neutralSpecial: {
    totalFrames: 36,
    hitboxes: [
      { activeFrames: [8, 14], offsetX: toFixed(28), offsetY: toFixed(-12), width: toFixed(26), height: toFixed(20), damage: 7, knockbackScaling: toFixed(0.9), baseKnockback: toFixed(3), launchAngle: 30, hitlagFrames: 4, id: 'lizzy_corgi_bite1' },
      { activeFrames: [14, 30], offsetX: toFixed(50), offsetY: toFixed(-12), width: toFixed(30), height: toFixed(22), damage: 5, knockbackScaling: toFixed(0.7), baseKnockback: toFixed(2), launchAngle: 25, hitlagFrames: 3, id: 'lizzy_corgi_run' },
    ],
    hurtboxes: [{ activeFrames: [0, 36], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 29, landingLag: 6,
  },
  // sideSpecial: Royal Decree — time stop AOE (large freeze hitbox with low knockback)
  sideSpecial: {
    totalFrames: 55,
    hitboxes: [
      { activeFrames: [10, 20], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(100), height: toFixed(70), damage: 2, knockbackScaling: toFixed(0.2), baseKnockback: toFixed(0), launchAngle: 90, hitlagFrames: 20, id: 'lizzy_decree_freeze' },
    ],
    hurtboxes: [{ activeFrames: [0, 55], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 48, landingLag: 8,
  },
  // upSpecial: Royal Ascension — ghostly float upward, wide poise hitbox
  upSpecial: {
    totalFrames: 52,
    hitboxes: [
      { activeFrames: [4, 12], offsetX: toFixed(0), offsetY: toFixed(16), width: toFixed(36), height: toFixed(32), damage: 7, knockbackScaling: toFixed(0.9), baseKnockback: toFixed(4), launchAngle: 80, hitlagFrames: 4, id: 'lizzy_uspecial_rise' },
      { activeFrames: [13, 22], offsetX: toFixed(0), offsetY: toFixed(46), width: toFixed(32), height: toFixed(28), damage: 14, knockbackScaling: toFixed(1.3), baseKnockback: toFixed(8), launchAngle: 90, hitlagFrames: 6, id: 'lizzy_uspecial_apex' },
    ],
    // Full poise during ascent
    hurtboxes: [{ activeFrames: [4, 22], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: true, invincible: false }],
    iasa: 44, landingLag: 13,
  },
  // downSpecial / Ultimate: The Jubilee — tea wave across stage
  downSpecial: {
    totalFrames: 70,
    hitboxes: [
      { activeFrames: [14, 22], offsetX: toFixed(-60), offsetY: toFixed(-15), width: toFixed(44), height: toFixed(30), damage: 12, knockbackScaling: toFixed(1.0), baseKnockback: toFixed(6), launchAngle: 38, hitlagFrames: 5, id: 'lizzy_tea_wave1' },
      { activeFrames: [22, 36], offsetX: toFixed(0), offsetY: toFixed(-15), width: toFixed(44), height: toFixed(30), damage: 12, knockbackScaling: toFixed(1.0), baseKnockback: toFixed(6), launchAngle: 38, hitlagFrames: 5, id: 'lizzy_tea_wave2' },
      { activeFrames: [36, 52], offsetX: toFixed(60), offsetY: toFixed(-15), width: toFixed(44), height: toFixed(30), damage: 14, knockbackScaling: toFixed(1.2), baseKnockback: toFixed(8), launchAngle: 40, hitlagFrames: 6, id: 'lizzy_tea_wave3' },
    ],
    hurtboxes: [{ activeFrames: [0, 70], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 61, landingLag: 10,
  },
};
