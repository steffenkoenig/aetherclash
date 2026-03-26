// src/game/stages/aetherPlateau.ts
// Aether Plateau — competitive stage (symmetric, no hazards)

import { toFixed } from '../../engine/physics/fixednum.js';
import type { Stage } from './stage.js';

export const AETHER_PLATEAU: Stage = {
  id:   'aetherPlateau',
  name: 'Aether Plateau',

  platforms: [
    // Main stage (solid, non-pass-through)
    { x1: toFixed(-42), x2: toFixed(42), y: toFixed(0),  passThrough: false },
    // Left side platform
    { x1: toFixed(-65), x2: toFixed(-35), y: toFixed(55), passThrough: true },
    // Right side platform
    { x1: toFixed(35),  x2: toFixed(65),  y: toFixed(55), passThrough: true },
    // Top centre platform
    { x1: toFixed(-20), x2: toFixed(20),  y: toFixed(95), passThrough: true },
  ],

  blastZone: {
    left:   toFixed(-150),
    right:  toFixed(150),
    top:    toFixed(180),
    bottom: toFixed(-100),
  },

  ledgeColliders: [
    // Main stage edges
    { x: toFixed(-42), y: toFixed(0),  facingRight: true,  occupied: null },
    { x: toFixed(42),  y: toFixed(0),  facingRight: false, occupied: null },
    // Left side platform edges
    { x: toFixed(-65), y: toFixed(55), facingRight: true,  occupied: null },
    { x: toFixed(-35), y: toFixed(55), facingRight: false, occupied: null },
    // Right side platform edges
    { x: toFixed(35),  y: toFixed(55), facingRight: true,  occupied: null },
    { x: toFixed(65),  y: toFixed(55), facingRight: false, occupied: null },
  ],

  itemSpawnPoints: [
    { x: toFixed(0),   y: toFixed(80) },
    { x: toFixed(-50), y: toFixed(40) },
    { x: toFixed(50),  y: toFixed(40) },
  ],
};
