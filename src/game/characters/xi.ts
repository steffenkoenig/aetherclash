// src/game/characters/xi.ts
// Character stats and move data for The Forbidden Honey (satirical Xi Jinping)
// Strengths: high health pool, can sanction (slow) enemies; Weakness: high startup lag on powerful moves.

import { toFixed } from '../../engine/physics/fixednum.js';
import type { FighterStats, Move } from '../../engine/ecs/component.js';

export const XI_STATS: FighterStats = {
  maxFallSpeed:     toFixed(-14.0),
  maxFastFallSpeed: toFixed(-22.0),
  jumpForce:        toFixed(14.0),
  doubleJumpForce:  toFixed(12.0),
  walkSpeed:        toFixed(3.8),
  runSpeed:         toFixed(6.5),
  weightClass:      toFixed(1.5),  // Heavy — high effective health, hard to launch
};

export const XI_MOVES: Record<string, Move> = {
  // === JABS ===
  neutralJab: {
    // Long startup — high lag characteristic
    totalFrames: 24,
    hitboxes: [{
      activeFrames: [8, 14],
      offsetX: toFixed(18), offsetY: toFixed(5),
      width: toFixed(34), height: toFixed(30),
      damage: 6, knockbackScaling: toFixed(0.8), baseKnockback: toFixed(4),
      launchAngle: 45, hitlagFrames: 4, id: 'xi_jab',
    }],
    hurtboxes: [{ activeFrames: [0, 24], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(32), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 19, landingLag: 0,
  },

  // === TILTS ===
  dashAttack: {
    totalFrames: 40,
    hitboxes: [{
      activeFrames: [10, 20],
      offsetX: toFixed(22), offsetY: toFixed(-2),
      width: toFixed(46), height: toFixed(36),
      damage: 12, knockbackScaling: toFixed(1.1), baseKnockback: toFixed(5),
      launchAngle: 36, hitlagFrames: 5, id: 'xi_dash',
    }],
    hurtboxes: [{ activeFrames: [0, 40], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(32), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 32, landingLag: 0,
  },
  getupAttack: {
    totalFrames: 28,
    hitboxes: [{
      activeFrames: [7, 16],
      offsetX: toFixed(20), offsetY: toFixed(-10),
      width: toFixed(40), height: toFixed(28),
      damage: 7, knockbackScaling: toFixed(0.8), baseKnockback: toFixed(4),
      launchAngle: 76, hitlagFrames: 4, id: 'xi_getup',
    }],
    hurtboxes: [{ activeFrames: [0, 28], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(32), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 22, landingLag: 0,
  },
  forwardTilt: {
    // Red Book swing — high startup
    totalFrames: 38,
    hitboxes: [{
      activeFrames: [14, 20],   // Long startup
      offsetX: toFixed(24), offsetY: toFixed(0),
      width: toFixed(44), height: toFixed(32),
      damage: 13, knockbackScaling: toFixed(1.2), baseKnockback: toFixed(6),
      launchAngle: 38, hitlagFrames: 5, id: 'xi_ftilt',
    }],
    hurtboxes: [{ activeFrames: [0, 38], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(32), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 30, landingLag: 0,
  },
  upTilt: {
    totalFrames: 34,
    hitboxes: [{
      activeFrames: [10, 17],
      offsetX: toFixed(0), offsetY: toFixed(32),
      width: toFixed(46), height: toFixed(30),
      damage: 11, knockbackScaling: toFixed(1.1), baseKnockback: toFixed(5),
      launchAngle: 85, hitlagFrames: 5, id: 'xi_utilt',
    }],
    hurtboxes: [{ activeFrames: [0, 34], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(32), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 27, landingLag: 0,
  },
  downTilt: {
    totalFrames: 30,
    hitboxes: [{
      activeFrames: [9, 14],
      offsetX: toFixed(22), offsetY: toFixed(-18),
      width: toFixed(36), height: toFixed(20),
      damage: 9, knockbackScaling: toFixed(0.9), baseKnockback: toFixed(3),
      launchAngle: 24, hitlagFrames: 4, id: 'xi_dtilt',
    }],
    hurtboxes: [{ activeFrames: [0, 30], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(32), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 24, landingLag: 0,
  },

  // === SMASHES — very high startup (slow but devastating) ===
  forwardSmash: {
    totalFrames: 75,             // Extremely high startup
    hitboxes: [{
      activeFrames: [30, 42],    // Hits VERY late
      offsetX: toFixed(46), offsetY: toFixed(10),
      width: toFixed(58), height: toFixed(36),
      damage: 24, knockbackScaling: toFixed(1.7), baseKnockback: toFixed(13),
      launchAngle: 40, hitlagFrames: 8, id: 'xi_fsmash',
    }],
    hurtboxes: [{ activeFrames: [0, 75], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(32), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 62, landingLag: 0, canCharge: true,
  },
  upSmash: {
    totalFrames: 58,
    hitboxes: [
      { activeFrames: [18, 24], offsetX: toFixed(0), offsetY: toFixed(32), width: toFixed(48), height: toFixed(32), damage: 10, knockbackScaling: toFixed(1.0), baseKnockback: toFixed(5), launchAngle: 85, hitlagFrames: 5, id: 'xi_usmash_1' },
      { activeFrames: [25, 34], offsetX: toFixed(0), offsetY: toFixed(52), width: toFixed(56), height: toFixed(44), damage: 22, knockbackScaling: toFixed(1.6), baseKnockback: toFixed(12), launchAngle: 90, hitlagFrames: 8, id: 'xi_usmash_2' },
    ],
    hurtboxes: [{ activeFrames: [0, 58], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(32), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 48, landingLag: 0, canCharge: true,
  },
  downSmash: {
    totalFrames: 52,
    hitboxes: [
      { activeFrames: [14, 22], offsetX: toFixed(30), offsetY: toFixed(-15), width: toFixed(50), height: toFixed(28), damage: 18, knockbackScaling: toFixed(1.3), baseKnockback: toFixed(8), launchAngle: 28, hitlagFrames: 7, id: 'xi_dsmash_r' },
      { activeFrames: [14, 22], offsetX: toFixed(-30), offsetY: toFixed(-15), width: toFixed(50), height: toFixed(28), damage: 18, knockbackScaling: toFixed(1.3), baseKnockback: toFixed(8), launchAngle: 152, hitlagFrames: 7, id: 'xi_dsmash_l' },
    ],
    hurtboxes: [{ activeFrames: [0, 52], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(32), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 43, landingLag: 0, canCharge: true,
  },

  // === THROWS ===
  forwardThrow: {
    totalFrames: 30,
    hitboxes: [{ activeFrames: [10, 12], offsetX: toFixed(22), offsetY: toFixed(0), width: toFixed(20), height: toFixed(20), damage: 11, knockbackScaling: toFixed(1.1), baseKnockback: toFixed(9), launchAngle: 16, hitlagFrames: 5, id: 'xi_fthrow' }],
    hurtboxes: [{ activeFrames: [0, 30], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(32), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 30, landingLag: 0, isThrow: true,
  },
  backThrow: {
    totalFrames: 32,
    hitboxes: [{ activeFrames: [11, 13], offsetX: toFixed(-22), offsetY: toFixed(0), width: toFixed(20), height: toFixed(20), damage: 13, knockbackScaling: toFixed(1.2), baseKnockback: toFixed(11), launchAngle: 162, hitlagFrames: 5, id: 'xi_bthrow' }],
    hurtboxes: [{ activeFrames: [0, 32], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(32), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 32, landingLag: 0, isThrow: true,
  },
  upThrow: {
    totalFrames: 28,
    hitboxes: [{ activeFrames: [9, 11], offsetX: toFixed(0), offsetY: toFixed(20), width: toFixed(20), height: toFixed(20), damage: 9, knockbackScaling: toFixed(1.0), baseKnockback: toFixed(11), launchAngle: 90, hitlagFrames: 4, id: 'xi_uthrow' }],
    hurtboxes: [{ activeFrames: [0, 28], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(32), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 28, landingLag: 0, isThrow: true,
  },
  downThrow: {
    totalFrames: 36,
    hitboxes: [{ activeFrames: [11, 13], offsetX: toFixed(0), offsetY: toFixed(-10), width: toFixed(20), height: toFixed(20), damage: 8, knockbackScaling: toFixed(0.9), baseKnockback: toFixed(6), launchAngle: 72, hitlagFrames: 4, id: 'xi_dthrow' }],
    hurtboxes: [{ activeFrames: [0, 36], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(32), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 36, landingLag: 0, isThrow: true,
  },

  // === AERIALS ===
  neutralAir: {
    totalFrames: 34,
    hitboxes: [{
      activeFrames: [6, 17],
      offsetX: toFixed(0), offsetY: toFixed(0),
      width: toFixed(50), height: toFixed(56),
      damage: 11, knockbackScaling: toFixed(1.0), baseKnockback: toFixed(4),
      launchAngle: 45, hitlagFrames: 5, id: 'xi_nair',
    }],
    hurtboxes: [{ activeFrames: [0, 34], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(32), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 27, landingLag: 11,
  },
  forwardAir: {
    totalFrames: 40,
    hitboxes: [{
      activeFrames: [12, 19],
      offsetX: toFixed(32), offsetY: toFixed(4),
      width: toFixed(50), height: toFixed(36),
      damage: 16, knockbackScaling: toFixed(1.4), baseKnockback: toFixed(7),
      launchAngle: 40, hitlagFrames: 6, id: 'xi_fair',
    }],
    hurtboxes: [{ activeFrames: [0, 40], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(32), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 32, landingLag: 13,
  },
  backAir: {
    totalFrames: 36,
    hitboxes: [{
      activeFrames: [9, 16],
      offsetX: toFixed(-28), offsetY: toFixed(0),
      width: toFixed(42), height: toFixed(36),
      damage: 14, knockbackScaling: toFixed(1.3), baseKnockback: toFixed(7),
      launchAngle: 150, hitlagFrames: 6, id: 'xi_bair',
    }],
    hurtboxes: [{ activeFrames: [0, 36], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(32), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 29, landingLag: 11,
  },
  upAir: {
    totalFrames: 36,
    hitboxes: [{
      activeFrames: [9, 16],
      offsetX: toFixed(0), offsetY: toFixed(36),
      width: toFixed(48), height: toFixed(32),
      damage: 12, knockbackScaling: toFixed(1.2), baseKnockback: toFixed(6),
      launchAngle: 80, hitlagFrames: 5, id: 'xi_uair',
    }],
    hurtboxes: [{ activeFrames: [0, 36], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(32), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 29, landingLag: 11,
  },
  downAir: {
    totalFrames: 44,
    hitboxes: [{
      activeFrames: [9, 17],
      offsetX: toFixed(0), offsetY: toFixed(-34),
      width: toFixed(44), height: toFixed(28),
      damage: 18, knockbackScaling: toFixed(1.5), baseKnockback: toFixed(10),
      launchAngle: 270, hitlagFrames: 7, id: 'xi_dair',
    }],
    hurtboxes: [{ activeFrames: [0, 44], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(32), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 35, landingLag: 16,
  },

  // === SPECIALS ===
  // neutralSpecial: Social Credit Hit — applies debt stack (multi-hit, moderate damage)
  neutralSpecial: {
    totalFrames: 44,
    hitboxes: [
      { activeFrames: [12, 16], offsetX: toFixed(24), offsetY: toFixed(4), width: toFixed(30), height: toFixed(28), damage: 6, knockbackScaling: toFixed(0.7), baseKnockback: toFixed(2), launchAngle: 50, hitlagFrames: 4, id: 'xi_credit1' },
      { activeFrames: [17, 22], offsetX: toFixed(30), offsetY: toFixed(4), width: toFixed(30), height: toFixed(28), damage: 6, knockbackScaling: toFixed(0.7), baseKnockback: toFixed(2), launchAngle: 50, hitlagFrames: 4, id: 'xi_credit2' },
      { activeFrames: [23, 30], offsetX: toFixed(32), offsetY: toFixed(4), width: toFixed(34), height: toFixed(32), damage: 9, knockbackScaling: toFixed(1.0), baseKnockback: toFixed(4), launchAngle: 45, hitlagFrames: 5, id: 'xi_credit3' },
    ],
    hurtboxes: [{ activeFrames: [0, 44], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(32), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 36, landingLag: 8,
  },
  // sideSpecial: Sanction Aura — large slow-zone hitbox
  sideSpecial: {
    totalFrames: 55,
    hitboxes: [
      { activeFrames: [14, 45], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(80), height: toFixed(64), damage: 4, knockbackScaling: toFixed(0.4), baseKnockback: toFixed(1), launchAngle: 40, hitlagFrames: 3, id: 'xi_sanction_aura' },
    ],
    hurtboxes: [{ activeFrames: [0, 55], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(32), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 48, landingLag: 8,
  },
  // upSpecial: Red Book Ascent — flies upward with glowing book
  upSpecial: {
    totalFrames: 54,
    hitboxes: [
      { activeFrames: [6, 14], offsetX: toFixed(0), offsetY: toFixed(16), width: toFixed(40), height: toFixed(34), damage: 8, knockbackScaling: toFixed(0.9), baseKnockback: toFixed(4), launchAngle: 78, hitlagFrames: 4, id: 'xi_uspecial_rise' },
      { activeFrames: [15, 25], offsetX: toFixed(0), offsetY: toFixed(50), width: toFixed(36), height: toFixed(30), damage: 15, knockbackScaling: toFixed(1.3), baseKnockback: toFixed(8), launchAngle: 90, hitlagFrames: 6, id: 'xi_uspecial_apex' },
    ],
    hurtboxes: [{ activeFrames: [0, 54], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(32), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 45, landingLag: 15,
  },
  // downSpecial / Ultimate: Great Firewall — cage that reflects projectiles, wide area
  downSpecial: {
    totalFrames: 78,
    hitboxes: [
      // Left wall
      { activeFrames: [16, 70], offsetX: toFixed(-80), offsetY: toFixed(0), width: toFixed(12), height: toFixed(80), damage: 6, knockbackScaling: toFixed(0.7), baseKnockback: toFixed(3), launchAngle: 0, hitlagFrames: 4, id: 'xi_firewall_l' },
      // Right wall
      { activeFrames: [16, 70], offsetX: toFixed(80), offsetY: toFixed(0), width: toFixed(12), height: toFixed(80), damage: 6, knockbackScaling: toFixed(0.7), baseKnockback: toFixed(3), launchAngle: 180, hitlagFrames: 4, id: 'xi_firewall_r' },
    ],
    hurtboxes: [{ activeFrames: [0, 78], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(32), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 68, landingLag: 12,
  },
};
