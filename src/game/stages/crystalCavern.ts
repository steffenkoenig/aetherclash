// src/game/stages/crystalCavern.ts
// Stage layout for Crystal Caverns -- underground cave with glowing crystal formations.
//
// A compact underground arena with a low ceiling, encouraging close-quarters
// combat. Stalactite hazards periodically crash down onto the main floor.

import { toFixed } from '../../engine/physics/fixednum.js';
import type { Platform } from '../../engine/physics/collision.js';
import type { BlastZones } from '../../engine/physics/blastZone.js';

export const CRYSTAL_CAVERN_PLATFORMS: Platform[] = [
  // Main cavern floor.
  { x1: toFixed(-360), x2: toFixed(360), y: toFixed(0), passThrough: false },
  // Left crystal shelf.
  { x1: toFixed(-320), x2: toFixed(-110), y: toFixed(140), passThrough: true },
  // Right crystal shelf.
  { x1: toFixed(110),  x2: toFixed(320),  y: toFixed(140), passThrough: true },
  // Central crystal spire platform (solid -- blocks access to the ceiling gap).
  { x1: toFixed(-70),  x2: toFixed(70),   y: toFixed(220), passThrough: false },
];

export const CRYSTAL_CAVERN_BLAST_ZONES: BlastZones = {
  left:   toFixed(-660),
  right:  toFixed(660),
  top:    toFixed(560),
  bottom: toFixed(-310),
};
