// src/game/stages/digitalGrid.ts
// Stage layout for The Neon Polygon Grid — Data Core interior.
//
// Phase 1 (90 s): A single wide elongated hexagonal slab — minimal, flat arena.
// Phase 2 (30 s): The slab retracts, leaving two solid island fragments
//                 separated by a central void the players must leap across.

import { toFixed } from '../../engine/physics/fixednum.js';
import type { Platform } from '../../engine/physics/collision.js';
import type { BlastZones } from '../../engine/physics/blastZone.js';

export const DIGITAL_GRID_PLATFORMS_PHASE1: Platform[] = [
  // Single wide elongated slab -- the "hexagonal" main stage.
  { x1: toFixed(-460), x2: toFixed(460), y: toFixed(0), passThrough: false },
  // Two upper pass-through platforms for vertical play.
  { x1: toFixed(-220), x2: toFixed(-50), y: toFixed(160), passThrough: true },
  { x1: toFixed(50),   x2: toFixed(220), y: toFixed(160), passThrough: true },
];

export const DIGITAL_GRID_PLATFORMS_PHASE2: Platform[] = [
  // Left island -- slab has retracted, leaving two separated solid fragments.
  { x1: toFixed(-460), x2: toFixed(-140), y: toFixed(0), passThrough: false },
  // Right island.
  { x1: toFixed(140),  x2: toFixed(460),  y: toFixed(0), passThrough: false },
  // Upper pass-through platforms remain.
  { x1: toFixed(-220), x2: toFixed(-50), y: toFixed(160), passThrough: true },
  { x1: toFixed(50),   x2: toFixed(220), y: toFixed(160), passThrough: true },
];

export const DIGITAL_GRID_BLAST_ZONES: BlastZones = {
  left:   toFixed(-750),
  right:  toFixed(750),
  top:    toFixed(650),
  bottom: toFixed(-320),
};

/** Frames before the stage transitions to phase 2 (90 s at 60 Hz). */
export const DIGITAL_GRID_PHASE_DURATION = 5400;

/** Frames phase 2 remains active before cycling back to phase 1 (30 s at 60 Hz). */
export const DIGITAL_GRID_PHASE2_DURATION = 1800;
