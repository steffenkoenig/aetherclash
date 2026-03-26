// src/game/stages/cloudCitadel.ts
// Cloud Citadel — casual stage (narrow base, two towers, lightning hazard)

import { toFixed } from '../../engine/physics/fixednum.js';
import type { Stage } from './stage.js';

export const CLOUD_CITADEL: Stage = {
  id:   'cloudCitadel',
  name: 'Cloud Citadel',

  platforms: [
    // Main base (narrow)
    { x1: toFixed(-30), x2: toFixed(30), y: toFixed(0),   passThrough: false },
    // Left tower top (pass-through)
    { x1: toFixed(-65), x2: toFixed(-35), y: toFixed(80),  passThrough: true },
    // Right tower top (pass-through)
    { x1: toFixed(35),  x2: toFixed(65),  y: toFixed(80),  passThrough: true },
    // Centre sky-walk platform (mid-height, pass-through)
    { x1: toFixed(-20), x2: toFixed(20),  y: toFixed(45),  passThrough: true },
  ],

  blastZone: {
    left:   toFixed(-130),
    right:  toFixed(130),
    top:    toFixed(220),
    bottom: toFixed(-110),
  },

  ledgeColliders: [
    { x: toFixed(-30), y: toFixed(0),  facingRight: true,  occupied: null },
    { x: toFixed(30),  y: toFixed(0),  facingRight: false, occupied: null },
    { x: toFixed(-65), y: toFixed(80), facingRight: true,  occupied: null },
    { x: toFixed(-35), y: toFixed(80), facingRight: false, occupied: null },
    { x: toFixed(35),  y: toFixed(80), facingRight: true,  occupied: null },
    { x: toFixed(65),  y: toFixed(80), facingRight: false, occupied: null },
  ],

  itemSpawnPoints: [
    { x: toFixed(-50), y: toFixed(120) },
    { x: toFixed(0),   y: toFixed(80) },
    { x: toFixed(50),  y: toFixed(120) },
    { x: toFixed(-20), y: toFixed(40) },
    { x: toFixed(20),  y: toFixed(40) },
  ],
};
