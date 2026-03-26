// src/game/stages/forge.ts
// Forge of the Vanguard — casual/competitive stage (wide, two lava geysers)

import { toFixed } from '../../engine/physics/fixednum.js';
import type { Stage } from './stage.js';

export const FORGE: Stage = {
  id:   'forge',
  name: 'Forge of the Vanguard',

  platforms: [
    // Main stage (wide, solid)
    { x1: toFixed(-55), x2: toFixed(55), y: toFixed(0),  passThrough: false },
    // Left side platform (lower, close to main)
    { x1: toFixed(-70), x2: toFixed(-40), y: toFixed(40), passThrough: true },
    // Right side platform
    { x1: toFixed(40),  x2: toFixed(70),  y: toFixed(40), passThrough: true },
  ],

  blastZone: {
    left:   toFixed(-170),
    right:  toFixed(170),
    top:    toFixed(200),
    bottom: toFixed(-110),
  },

  ledgeColliders: [
    { x: toFixed(-55), y: toFixed(0),  facingRight: true,  occupied: null },
    { x: toFixed(55),  y: toFixed(0),  facingRight: false, occupied: null },
    { x: toFixed(-70), y: toFixed(40), facingRight: true,  occupied: null },
    { x: toFixed(-40), y: toFixed(40), facingRight: false, occupied: null },
    { x: toFixed(40),  y: toFixed(40), facingRight: true,  occupied: null },
    { x: toFixed(70),  y: toFixed(40), facingRight: false, occupied: null },
  ],

  itemSpawnPoints: [
    { x: toFixed(-35),  y: toFixed(60) },
    { x: toFixed(0),    y: toFixed(60) },
    { x: toFixed(35),   y: toFixed(60) },
    { x: toFixed(0),    y: toFixed(110) },
  ],
};
