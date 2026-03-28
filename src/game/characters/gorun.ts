// src/game/characters/gorun.ts
// Character stats and move data for Gorun (Super-Heavy)

import { toFixed } from '../../engine/physics/fixednum.js';
import type { FighterStats, Move } from '../../engine/ecs/component.js';

export const GORUN_STATS: FighterStats = {
  maxFallSpeed:     toFixed(-16.0),
  maxFastFallSpeed: toFixed(-24.0),
  jumpForce:        toFixed(14.0),
  doubleJumpForce:  toFixed(12.0),
  walkSpeed:        toFixed(3.5),
  runSpeed:         toFixed(6.0),
  weightClass:      toFixed(1.7),
};

export const GORUN_MOVES: Record<string, Move> = {
  // === JABS ===
  neutralJab: {
    totalFrames: 28,
    hitboxes: [{
      activeFrames: [8, 14],
      offsetX: toFixed(20), offsetY: toFixed(5),
      width: toFixed(40), height: toFixed(35),
      damage: 8, knockbackScaling: toFixed(0.8), baseKnockback: toFixed(5),
      launchAngle: 45, hitlagFrames: 4, id: 'gorun_jab',
    }],
    hurtboxes: [{ activeFrames: [0, 28], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 22, landingLag: 0,
  },
  // === TILTS ===
  forwardTilt: {
    totalFrames: 35,
    hitboxes: [{
      activeFrames: [10, 17],
      offsetX: toFixed(25), offsetY: toFixed(0),
      width: toFixed(50), height: toFixed(35),
      damage: 14, knockbackScaling: toFixed(1.2), baseKnockback: toFixed(6),
      launchAngle: 38, hitlagFrames: 5, id: 'gorun_ftilt',
    }],
    hurtboxes: [{ activeFrames: [0, 35], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 28, landingLag: 0,
  },
  upTilt: {
    totalFrames: 32,
    hitboxes: [{
      activeFrames: [8, 15],
      offsetX: toFixed(0), offsetY: toFixed(35),
      width: toFixed(50), height: toFixed(35),
      damage: 12, knockbackScaling: toFixed(1.1), baseKnockback: toFixed(5),
      launchAngle: 85, hitlagFrames: 5, id: 'gorun_utilt',
    }],
    hurtboxes: [{ activeFrames: [0, 32], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 26, landingLag: 0,
  },
  downTilt: {
    totalFrames: 28,
    hitboxes: [
      { activeFrames: [7, 12], offsetX: toFixed(22), offsetY: toFixed(-20), width: toFixed(38), height: toFixed(22), damage: 10, knockbackScaling: toFixed(1.0), baseKnockback: toFixed(3), launchAngle: 25, hitlagFrames: 4, id: 'gorun_dtilt' },
      // Shockwave hitbox — ground-level extra range
      {
        activeFrames: [10, 16],
        offsetX: toFixed(45), offsetY: toFixed(-22),
        width: toFixed(25), height: toFixed(15),
        damage: 6, knockbackScaling: toFixed(0.8), baseKnockback: toFixed(2),
        launchAngle: 20, hitlagFrames: 4, id: 'gorun_dtilt_shockwave',
      },
    ],
    hurtboxes: [{ activeFrames: [0, 28], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 22, landingLag: 0,
  },
  // === SMASHES ===
  forwardSmash: {
    totalFrames: 70,
    hitboxes: [{
      activeFrames: [28, 38],
      offsetX: toFixed(50), offsetY: toFixed(10),
      width: toFixed(65), height: toFixed(40),
      damage: 25, knockbackScaling: toFixed(1.8), baseKnockback: toFixed(15),
      launchAngle: 40, hitlagFrames: 8, id: 'gorun_fsmash',
    }],
    hurtboxes: [{ activeFrames: [0, 70], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 58, landingLag: 0,
  },
  upSmash: {
    totalFrames: 52,
    hitboxes: [
      { activeFrames: [12, 18], offsetX: toFixed(0), offsetY: toFixed(35), width: toFixed(50), height: toFixed(35), damage: 11, knockbackScaling: toFixed(1.0), baseKnockback: toFixed(5), launchAngle: 85, hitlagFrames: 5, id: 'gorun_usmash_1' },
      { activeFrames: [19, 27], offsetX: toFixed(0), offsetY: toFixed(55), width: toFixed(60), height: toFixed(45), damage: 22, knockbackScaling: toFixed(1.6), baseKnockback: toFixed(12), launchAngle: 90, hitlagFrames: 8, id: 'gorun_usmash_2' },
    ],
    hurtboxes: [{ activeFrames: [0, 52], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 44, landingLag: 0,
  },
  downSmash: {
    totalFrames: 48,
    hitboxes: [
      { activeFrames: [10, 18], offsetX: toFixed(30), offsetY: toFixed(-15), width: toFixed(55), height: toFixed(30), damage: 20, knockbackScaling: toFixed(1.4), baseKnockback: toFixed(8), launchAngle: 30, hitlagFrames: 7, id: 'gorun_dsmash_r' },
      { activeFrames: [10, 18], offsetX: toFixed(-30), offsetY: toFixed(-15), width: toFixed(55), height: toFixed(30), damage: 20, knockbackScaling: toFixed(1.4), baseKnockback: toFixed(8), launchAngle: 150, hitlagFrames: 7, id: 'gorun_dsmash_l' },
    ],
    hurtboxes: [{ activeFrames: [0, 48], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 40, landingLag: 0,
  },
  // === AERIALS ===
  neutralAir: {
    totalFrames: 35,
    hitboxes: [{
      activeFrames: [6, 18],
      offsetX: toFixed(0), offsetY: toFixed(0),
      width: toFixed(55), height: toFixed(60),
      damage: 12, knockbackScaling: toFixed(1.0), baseKnockback: toFixed(4),
      launchAngle: 45, hitlagFrames: 5, id: 'gorun_nair',
    }],
    hurtboxes: [{ activeFrames: [0, 35], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 28, landingLag: 12,
  },
  forwardAir: {
    totalFrames: 42,
    hitboxes: [{
      activeFrames: [12, 20],
      offsetX: toFixed(35), offsetY: toFixed(5),
      width: toFixed(55), height: toFixed(40),
      damage: 18, knockbackScaling: toFixed(1.5), baseKnockback: toFixed(8),
      launchAngle: 40, hitlagFrames: 6, id: 'gorun_fair',
    }],
    hurtboxes: [{ activeFrames: [0, 42], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 34, landingLag: 14,
  },
  backAir: {
    totalFrames: 36,
    hitboxes: [{
      activeFrames: [8, 15],
      offsetX: toFixed(-30), offsetY: toFixed(0),
      width: toFixed(45), height: toFixed(40),
      damage: 16, knockbackScaling: toFixed(1.4), baseKnockback: toFixed(7),
      launchAngle: 150, hitlagFrames: 6, id: 'gorun_bair',
    }],
    hurtboxes: [{ activeFrames: [0, 36], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 28, landingLag: 12,
  },
  upAir: {
    totalFrames: 36,
    hitboxes: [{
      activeFrames: [9, 17],
      offsetX: toFixed(0), offsetY: toFixed(40),
      width: toFixed(50), height: toFixed(35),
      damage: 14, knockbackScaling: toFixed(1.2), baseKnockback: toFixed(6),
      launchAngle: 80, hitlagFrames: 5, id: 'gorun_uair',
    }],
    hurtboxes: [{ activeFrames: [0, 36], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 28, landingLag: 12,
  },
  downAir: {
    totalFrames: 45,
    hitboxes: [{
      activeFrames: [8, 16],
      offsetX: toFixed(0), offsetY: toFixed(-35),
      width: toFixed(45), height: toFixed(30),
      damage: 20, knockbackScaling: toFixed(1.6), baseKnockback: toFixed(12),
      launchAngle: 270, hitlagFrames: 7, id: 'gorun_dair',
    }],
    hurtboxes: [{ activeFrames: [0, 45], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 36, landingLag: 18,
  },
  // === SPECIALS ===
  neutralSpecial: {
    totalFrames: 50,
    hitboxes: [{
      activeFrames: [16, 26],
      offsetX: toFixed(0), offsetY: toFixed(-20),
      width: toFixed(60), height: toFixed(25),
      damage: 18, knockbackScaling: toFixed(1.4), baseKnockback: toFixed(9),
      launchAngle: 30, hitlagFrames: 7, id: 'gorun_nspecial',
    }],
    hurtboxes: [{ activeFrames: [0, 50], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 40, landingLag: 8,
  },
  sideSpecial: {
    totalFrames: 55,
    hitboxes: [
      { activeFrames: [8, 16], offsetX: toFixed(25), offsetY: toFixed(5), width: toFixed(30), height: toFixed(40), damage: 12, knockbackScaling: toFixed(1.0), baseKnockback: toFixed(6), launchAngle: 50, hitlagFrames: 5, id: 'gorun_sspecial_1' },
      { activeFrames: [17, 28], offsetX: toFixed(40), offsetY: toFixed(0), width: toFixed(50), height: toFixed(45), damage: 20, knockbackScaling: toFixed(1.5), baseKnockback: toFixed(10), launchAngle: 40, hitlagFrames: 7, id: 'gorun_sspecial_2' },
    ],
    hurtboxes: [{ activeFrames: [0, 55], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 45, landingLag: 12,
  },
  upSpecial: {
    totalFrames: 60,
    hitboxes: [
      { activeFrames: [6, 14], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(50), height: toFixed(30), damage: 10, knockbackScaling: toFixed(1.0), baseKnockback: toFixed(5), launchAngle: 75, hitlagFrames: 5, id: 'gorun_uspecial_launch' },
      { activeFrames: [30, 40], offsetX: toFixed(0), offsetY: toFixed(-20), width: toFixed(55), height: toFixed(35), damage: 22, knockbackScaling: toFixed(1.6), baseKnockback: toFixed(12), launchAngle: 270, hitlagFrames: 8, id: 'gorun_uspecial_land' },
    ],
    hurtboxes: [{ activeFrames: [0, 60], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 50, landingLag: 20,
  },
  downSpecial: {
    totalFrames: 48,
    hitboxes: [
      { activeFrames: [12, 20], offsetX: toFixed(40), offsetY: toFixed(-15), width: toFixed(45), height: toFixed(25), damage: 14, knockbackScaling: toFixed(1.2), baseKnockback: toFixed(7), launchAngle: 25, hitlagFrames: 6, id: 'gorun_dspecial_r' },
      { activeFrames: [12, 20], offsetX: toFixed(-40), offsetY: toFixed(-15), width: toFixed(45), height: toFixed(25), damage: 14, knockbackScaling: toFixed(1.2), baseKnockback: toFixed(7), launchAngle: 155, hitlagFrames: 6, id: 'gorun_dspecial_l' },
    ],
    hurtboxes: [{ activeFrames: [0, 48], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60), intangible: false, invincible: false }],
    iasa: 40, landingLag: 14,
  },
};
