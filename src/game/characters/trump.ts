// src/game/characters/trump.ts
// Character stats and move data for The Real Estate Mogul (satirical Trump)
// Strengths: massive knockback, stage control; Weakness: large hitbox, short grab range.

import { toFixed } from '../../engine/physics/fixednum.js';
import type { FighterStats, Move } from '../../engine/ecs/component.js';

export const TRUMP_STATS: FighterStats = {
  maxFallSpeed:     toFixed(-13.0),
  maxFastFallSpeed: toFixed(-20.0),
  jumpForce:        toFixed(14.5),
  doubleJumpForce:  toFixed(12.5),
  walkSpeed:        toFixed(4.5),
  runSpeed:         toFixed(7.0),
  weightClass:      toFixed(1.2),  // Heavy — large hitbox, hard to launch
};

export const TRUMP_MOVES: Record<string, Move> = {
  // === JABS — stubby small-handed punches ===
  neutralJab1: {
    totalFrames: 16,
    hitboxes: [{
      activeFrames: [4, 7],
      offsetX: toFixed(12), offsetY: toFixed(4),   // Short reach (Small Hands)
      width: toFixed(18), height: toFixed(18),
      damage: 3, knockbackScaling: toFixed(0.9), baseKnockback: toFixed(3),
      launchAngle: 45, hitlagFrames: 4, id: 'trump_jab1',
    }],
    hurtboxes: [{ activeFrames: [0, 16], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(36), height: toFixed(64), intangible: false, invincible: false }],
    iasa: 13, landingLag: 0, nextJab: 'neutralJab2',
  },
  neutralJab2: {
    totalFrames: 16,
    hitboxes: [{
      activeFrames: [4, 7],
      offsetX: toFixed(12), offsetY: toFixed(4),
      width: toFixed(18), height: toFixed(18),
      damage: 3, knockbackScaling: toFixed(0.9), baseKnockback: toFixed(3),
      launchAngle: 45, hitlagFrames: 4, id: 'trump_jab2',
    }],
    hurtboxes: [{ activeFrames: [0, 16], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(36), height: toFixed(64), intangible: false, invincible: false }],
    iasa: 13, landingLag: 0, nextJab: 'neutralJab3',
  },
  neutralJab3: {
    totalFrames: 22,
    hitboxes: [{
      activeFrames: [5, 10],
      offsetX: toFixed(14), offsetY: toFixed(4),
      width: toFixed(22), height: toFixed(22),
      damage: 6, knockbackScaling: toFixed(1.1), baseKnockback: toFixed(5),
      launchAngle: 55, hitlagFrames: 4, id: 'trump_jab3',
    }],
    hurtboxes: [{ activeFrames: [0, 22], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(36), height: toFixed(64), intangible: false, invincible: false }],
    iasa: 17, landingLag: 0,
  },

  // === TILTS ===
  dashAttack: {
    totalFrames: 34,
    hitboxes: [{
      activeFrames: [7, 16],
      offsetX: toFixed(22), offsetY: toFixed(0),
      width: toFixed(44), height: toFixed(38),
      damage: 10, knockbackScaling: toFixed(1.1), baseKnockback: toFixed(4),
      launchAngle: 38, hitlagFrames: 5, id: 'trump_dash',
    }],
    hurtboxes: [{ activeFrames: [0, 34], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(36), height: toFixed(64), intangible: false, invincible: false }],
    iasa: 27, landingLag: 0,
  },
  getupAttack: {
    totalFrames: 26,
    hitboxes: [{
      activeFrames: [6, 14],
      offsetX: toFixed(22), offsetY: toFixed(-8),
      width: toFixed(40), height: toFixed(28),
      damage: 7, knockbackScaling: toFixed(0.9), baseKnockback: toFixed(4),
      launchAngle: 75, hitlagFrames: 4, id: 'trump_getup',
    }],
    hurtboxes: [{ activeFrames: [0, 26], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(36), height: toFixed(64), intangible: false, invincible: false }],
    iasa: 21, landingLag: 0,
  },
  forwardTilt: {
    totalFrames: 32,
    // Tie whip — long range for a tilt but only moderate damage
    hitboxes: [{
      activeFrames: [9, 15],
      offsetX: toFixed(38), offsetY: toFixed(-4),  // Long range (tie whip)
      width: toFixed(30), height: toFixed(14),
      damage: 9, knockbackScaling: toFixed(1.0), baseKnockback: toFixed(4),
      launchAngle: 30, hitlagFrames: 4, id: 'trump_ftilt',
    }],
    hurtboxes: [{ activeFrames: [0, 32], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(36), height: toFixed(64), intangible: false, invincible: false }],
    iasa: 25, landingLag: 0,
  },
  upTilt: {
    totalFrames: 30,
    hitboxes: [{
      activeFrames: [7, 13],
      offsetX: toFixed(0), offsetY: toFixed(32),
      width: toFixed(38), height: toFixed(28),
      damage: 10, knockbackScaling: toFixed(1.2), baseKnockback: toFixed(5),
      launchAngle: 85, hitlagFrames: 4, id: 'trump_utilt',
    }],
    hurtboxes: [{ activeFrames: [0, 30], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(36), height: toFixed(64), intangible: false, invincible: false }],
    iasa: 24, landingLag: 0,
  },
  downTilt: {
    totalFrames: 24,
    hitboxes: [{
      activeFrames: [6, 10],
      offsetX: toFixed(18), offsetY: toFixed(-20),
      width: toFixed(28), height: toFixed(18),
      damage: 7, knockbackScaling: toFixed(0.9), baseKnockback: toFixed(2),
      launchAngle: 25, hitlagFrames: 4, id: 'trump_dtilt',
    }],
    hurtboxes: [{ activeFrames: [0, 24], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(36), height: toFixed(64), intangible: false, invincible: false }],
    iasa: 19, landingLag: 0,
  },

  // === SMASHES — massive knockback ===
  forwardSmash: {
    // "Big League" power punch — huge knockback, high endlag
    totalFrames: 58,
    hitboxes: [{
      activeFrames: [22, 30],
      offsetX: toFixed(44), offsetY: toFixed(8),
      width: toFixed(54), height: toFixed(34),
      damage: 22, knockbackScaling: toFixed(1.8), baseKnockback: toFixed(14),  // Massive knockback
      launchAngle: 38, hitlagFrames: 7, id: 'trump_fsmash',
    }],
    hurtboxes: [{ activeFrames: [0, 58], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(36), height: toFixed(64), intangible: false, invincible: false }],
    iasa: 48, landingLag: 0, canCharge: true,
  },
  upSmash: {
    totalFrames: 48,
    hitboxes: [
      { activeFrames: [11, 17], offsetX: toFixed(0), offsetY: toFixed(28), width: toFixed(42), height: toFixed(28), damage: 9, knockbackScaling: toFixed(1.0), baseKnockback: toFixed(5), launchAngle: 85, hitlagFrames: 4, id: 'trump_usmash_1' },
      { activeFrames: [18, 25], offsetX: toFixed(0), offsetY: toFixed(50), width: toFixed(50), height: toFixed(38), damage: 18, knockbackScaling: toFixed(1.5), baseKnockback: toFixed(10), launchAngle: 90, hitlagFrames: 6, id: 'trump_usmash_2' },
    ],
    hurtboxes: [{ activeFrames: [0, 48], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(36), height: toFixed(64), intangible: false, invincible: false }],
    iasa: 40, landingLag: 0, canCharge: true,
  },
  downSmash: {
    totalFrames: 44,
    hitboxes: [
      { activeFrames: [9, 16], offsetX: toFixed(28), offsetY: toFixed(-14), width: toFixed(38), height: toFixed(26), damage: 14, knockbackScaling: toFixed(1.3), baseKnockback: toFixed(7), launchAngle: 28, hitlagFrames: 5, id: 'trump_dsmash_r' },
      { activeFrames: [9, 16], offsetX: toFixed(-28), offsetY: toFixed(-14), width: toFixed(38), height: toFixed(26), damage: 14, knockbackScaling: toFixed(1.3), baseKnockback: toFixed(7), launchAngle: 152, hitlagFrames: 5, id: 'trump_dsmash_l' },
    ],
    hurtboxes: [{ activeFrames: [0, 44], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(36), height: toFixed(64), intangible: false, invincible: false }],
    iasa: 36, landingLag: 0, canCharge: true,
  },

  // === THROWS — short grab range (Small Hands disadvantage) ===
  forwardThrow: {
    totalFrames: 30,
    hitboxes: [{
      activeFrames: [8, 10],
      offsetX: toFixed(14), offsetY: toFixed(0),   // Short grab range
      width: toFixed(14), height: toFixed(14),
      damage: 10, knockbackScaling: toFixed(1.2), baseKnockback: toFixed(9),
      launchAngle: 18, hitlagFrames: 4, id: 'trump_fthrow',
    }],
    hurtboxes: [{ activeFrames: [0, 30], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(36), height: toFixed(64), intangible: false, invincible: false }],
    iasa: 30, landingLag: 0, isThrow: true,
  },
  backThrow: {
    totalFrames: 32,
    hitboxes: [{
      activeFrames: [10, 12],
      offsetX: toFixed(-14), offsetY: toFixed(0),
      width: toFixed(14), height: toFixed(14),
      damage: 12, knockbackScaling: toFixed(1.3), baseKnockback: toFixed(11),
      launchAngle: 162, hitlagFrames: 4, id: 'trump_bthrow',
    }],
    hurtboxes: [{ activeFrames: [0, 32], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(36), height: toFixed(64), intangible: false, invincible: false }],
    iasa: 32, landingLag: 0, isThrow: true,
  },
  upThrow: {
    totalFrames: 28,
    hitboxes: [{
      activeFrames: [8, 10],
      offsetX: toFixed(0), offsetY: toFixed(18),
      width: toFixed(14), height: toFixed(14),
      damage: 8, knockbackScaling: toFixed(1.0), baseKnockback: toFixed(10),
      launchAngle: 90, hitlagFrames: 4, id: 'trump_uthrow',
    }],
    hurtboxes: [{ activeFrames: [0, 28], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(36), height: toFixed(64), intangible: false, invincible: false }],
    iasa: 28, landingLag: 0, isThrow: true,
  },
  downThrow: {
    totalFrames: 34,
    hitboxes: [{
      activeFrames: [10, 12],
      offsetX: toFixed(0), offsetY: toFixed(-10),
      width: toFixed(14), height: toFixed(14),
      damage: 7, knockbackScaling: toFixed(0.9), baseKnockback: toFixed(6),
      launchAngle: 58, hitlagFrames: 4, id: 'trump_dthrow',
    }],
    hurtboxes: [{ activeFrames: [0, 34], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(36), height: toFixed(64), intangible: false, invincible: false }],
    iasa: 34, landingLag: 0, isThrow: true,
  },

  // === AERIALS ===
  neutralAir: {
    totalFrames: 32,
    hitboxes: [{
      activeFrames: [5, 16],
      offsetX: toFixed(0), offsetY: toFixed(0),
      width: toFixed(46), height: toFixed(54),
      damage: 8, knockbackScaling: toFixed(1.0), baseKnockback: toFixed(3),
      launchAngle: 45, hitlagFrames: 4, id: 'trump_nair',
    }],
    hurtboxes: [{ activeFrames: [0, 32], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(36), height: toFixed(64), intangible: false, invincible: false }],
    iasa: 26, landingLag: 9,
  },
  forwardAir: {
    totalFrames: 38,
    hitboxes: [
      // Tie-whip forward swing — long reaching
      { activeFrames: [9, 14], offsetX: toFixed(36), offsetY: toFixed(-2), width: toFixed(14), height: toFixed(14), damage: 14, knockbackScaling: toFixed(1.4), baseKnockback: toFixed(6), launchAngle: 32, hitlagFrames: 5, id: 'trump_fair_sweet' },
      { activeFrames: [9, 18], offsetX: toFixed(24), offsetY: toFixed(-2), width: toFixed(28), height: toFixed(28), damage: 8, knockbackScaling: toFixed(1.0), baseKnockback: toFixed(3), launchAngle: 42, hitlagFrames: 4, id: 'trump_fair_sour' },
    ],
    hurtboxes: [{ activeFrames: [0, 38], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(36), height: toFixed(64), intangible: false, invincible: false }],
    iasa: 31, landingLag: 11,
  },
  backAir: {
    totalFrames: 32,
    hitboxes: [{
      activeFrames: [7, 13],
      offsetX: toFixed(-28), offsetY: toFixed(2),
      width: toFixed(32), height: toFixed(36),
      damage: 15, knockbackScaling: toFixed(1.5), baseKnockback: toFixed(8),
      launchAngle: 148, hitlagFrames: 5, id: 'trump_bair',
    }],
    hurtboxes: [{ activeFrames: [0, 32], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(36), height: toFixed(64), intangible: false, invincible: false }],
    iasa: 26, landingLag: 9,
  },
  upAir: {
    totalFrames: 32,
    hitboxes: [{
      activeFrames: [8, 14],
      offsetX: toFixed(0), offsetY: toFixed(38),
      width: toFixed(42), height: toFixed(30),
      damage: 11, knockbackScaling: toFixed(1.2), baseKnockback: toFixed(5),
      launchAngle: 80, hitlagFrames: 4, id: 'trump_uair',
    }],
    hurtboxes: [{ activeFrames: [0, 32], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(36), height: toFixed(64), intangible: false, invincible: false }],
    iasa: 26, landingLag: 9,
  },
  downAir: {
    totalFrames: 40,
    hitboxes: [
      { activeFrames: [6, 9], offsetX: toFixed(0), offsetY: toFixed(-32), width: toFixed(26), height: toFixed(22), damage: 13, knockbackScaling: toFixed(1.3), baseKnockback: toFixed(7), launchAngle: 270, hitlagFrames: 5, id: 'trump_dair_sweet' },
      { activeFrames: [10, 20], offsetX: toFixed(0), offsetY: toFixed(-28), width: toFixed(32), height: toFixed(26), damage: 9, knockbackScaling: toFixed(1.0), baseKnockback: toFixed(3), launchAngle: 280, hitlagFrames: 4, id: 'trump_dair_late' },
    ],
    hurtboxes: [{ activeFrames: [0, 40], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(36), height: toFixed(64), intangible: false, invincible: false }],
    iasa: 34, landingLag: 13,
  },

  // === SPECIALS ===
  // neutralSpecial: Tie Whip — long ranged whip attack forward
  neutralSpecial: {
    totalFrames: 38,
    hitboxes: [{
      activeFrames: [8, 22],   // Tie lashes forward
      offsetX: toFixed(50), offsetY: toFixed(-4),
      width: toFixed(20), height: toFixed(12),
      damage: 11, knockbackScaling: toFixed(1.1), baseKnockback: toFixed(5),
      launchAngle: 35, hitlagFrames: 4, id: 'trump_nspecial',
    }],
    hurtboxes: [{ activeFrames: [0, 38], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(36), height: toFixed(64), intangible: false, invincible: false }],
    iasa: 30, landingLag: 7,
  },
  // sideSpecial: The Wall — summons a large hitbox representing the gold wall
  sideSpecial: {
    totalFrames: 60,
    hitboxes: [
      // Wall contact — enemies knocked into it take damage
      { activeFrames: [10, 60], offsetX: toFixed(60), offsetY: toFixed(0), width: toFixed(16), height: toFixed(70), damage: 8, knockbackScaling: toFixed(0.8), baseKnockback: toFixed(3), launchAngle: 180, hitlagFrames: 5, id: 'trump_wall' },
    ],
    hurtboxes: [{ activeFrames: [0, 60], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(36), height: toFixed(64), intangible: false, invincible: false }],
    iasa: 55, landingLag: 8,
  },
  // upSpecial: Helicopter Hair — spinning upward recovery
  upSpecial: {
    totalFrames: 52,
    hitboxes: [
      { activeFrames: [4, 12], offsetX: toFixed(0), offsetY: toFixed(18), width: toFixed(38), height: toFixed(32), damage: 7, knockbackScaling: toFixed(0.9), baseKnockback: toFixed(4), launchAngle: 80, hitlagFrames: 4, id: 'trump_uspecial_rise' },
      { activeFrames: [13, 22], offsetX: toFixed(0), offsetY: toFixed(48), width: toFixed(34), height: toFixed(28), damage: 16, knockbackScaling: toFixed(1.4), baseKnockback: toFixed(9), launchAngle: 90, hitlagFrames: 6, id: 'trump_uspecial_apex' },
    ],
    hurtboxes: [{ activeFrames: [0, 52], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(36), height: toFixed(64), intangible: false, invincible: false }],
    iasa: 44, landingLag: 14,
  },
  // downSpecial / Ultimate: "You're Fired!" — concentrated beam, huge launch
  downSpecial: {
    totalFrames: 72,
    hitboxes: [
      // Startup finger-point
      { activeFrames: [18, 22], offsetX: toFixed(30), offsetY: toFixed(8), width: toFixed(28), height: toFixed(18), damage: 5, knockbackScaling: toFixed(0.6), baseKnockback: toFixed(2), launchAngle: 45, hitlagFrames: 3, id: 'trump_fired_windup' },
      // BEAM — instant KO potential above 100%
      { activeFrames: [23, 38], offsetX: toFixed(55), offsetY: toFixed(8), width: toFixed(80), height: toFixed(24), damage: 30, knockbackScaling: toFixed(2.0), baseKnockback: toFixed(20), launchAngle: 25, hitlagFrames: 9, id: 'trump_fired_beam' },
    ],
    hurtboxes: [{ activeFrames: [0, 72], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(36), height: toFixed(64), intangible: false, invincible: false }],
    iasa: 62, landingLag: 12,
  },
};
