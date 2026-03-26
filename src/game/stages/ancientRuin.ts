// src/game/stages/ancientRuin.ts
// Ancient Ruin — competitive stage (solid centre pillar, two arch platforms)

import { toFixed } from '../../engine/physics/fixednum.js';
import type { Stage } from './stage.js';

export const ANCIENT_RUIN: Stage = {
  id:   'ancientRuin',
  name: 'Ancient Ruin',

  platforms: [
    // Main stage (solid)
    { x1: toFixed(-40), x2: toFixed(40), y: toFixed(0),  passThrough: false },
    // Left arch platform (pass-through)
    { x1: toFixed(-60), x2: toFixed(-28), y: toFixed(60), passThrough: true },
    // Right arch platform (pass-through)
    { x1: toFixed(28),  x2: toFixed(60),  y: toFixed(60), passThrough: true },
    // Centre pillar (solid top — creates wall-tech opportunities)
    { x1: toFixed(-10), x2: toFixed(10),  y: toFixed(40), passThrough: false },
  ],

  blastZone: {
    left:   toFixed(-145),
    right:  toFixed(145),
    top:    toFixed(190),
    bottom: toFixed(-105),
  },

  ledgeColliders: [
    { x: toFixed(-40), y: toFixed(0),  facingRight: true,  occupied: null },
    { x: toFixed(40),  y: toFixed(0),  facingRight: false, occupied: null },
    { x: toFixed(-60), y: toFixed(60), facingRight: true,  occupied: null },
    { x: toFixed(-28), y: toFixed(60), facingRight: false, occupied: null },
    { x: toFixed(28),  y: toFixed(60), facingRight: true,  occupied: null },
    { x: toFixed(60),  y: toFixed(60), facingRight: false, occupied: null },
  ],

  itemSpawnPoints: [
    { x: toFixed(-45), y: toFixed(50) },
    { x: toFixed(0),   y: toFixed(80) },
    { x: toFixed(45),  y: toFixed(50) },
  ],
};
