// src/game/characters/syne.ts
// Character stats and move data for Syne (Light)

import { toFixed } from '../../engine/physics/fixednum.js';
import type { FighterStats, Move } from '../../engine/ecs/component.js';

export const SYNE_STATS: FighterStats = {
  maxFallSpeed:     toFixed(-0.70),
  maxFastFallSpeed: toFixed(-1.40),
  jumpForce:        toFixed(1.25),
  doubleJumpForce:  toFixed(1.05),
  walkSpeed:        toFixed(0.7),
  runSpeed:         toFixed(1.0),
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
    iasa: 11, landingLag: 0,
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
    iasa: 11, landingLag: 0,
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
    iasa: 40, landingLag: 0,
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
    iasa: 34, landingLag: 0,
  },
  downSmash: {
    totalFrames: 38,
    hitboxes: [
      { activeFrames: [7, 13], offsetX: toFixed(24), offsetY: toFixed(-14), width: toFixed(32), height: toFixed(22), damage: 12, knockbackScaling: toFixed(1.1), baseKnockback: toFixed(5), launchAngle: 30, hitlagFrames: 5, id: 'syne_dsmash_r' },
      { activeFrames: [7, 13], offsetX: toFixed(-24), offsetY: toFixed(-14), width: toFixed(32), height: toFixed(22), damage: 12, knockbackScaling: toFixed(1.1), baseKnockback: toFixed(5), launchAngle: 150, hitlagFrames: 5, id: 'syne_dsmash_l' },
    ],
    hurtboxes: [{ activeFrames: [0, 38], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 30, landingLag: 0,
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
};
