// src/game/stages/digitalGrid.ts
// Stage layout for Digital Grid — two-phase hazard stage.
// Phase 1 is the standard layout.
// Phase 2 (after 90s / 5400 frames) retracts the main floor.

import { toFixed } from '../../engine/physics/fixednum.js';
import type { Platform } from '../../engine/physics/collision.js';
import type { BlastZones } from '../../engine/physics/blastZone.js';

export const DIGITAL_GRID_PLATFORMS_PHASE1: Platform[] = [
  { x1: toFixed(-400), x2: toFixed(400), y: toFixed(0), passThrough: false },
  { x1: toFixed(-300), x2: toFixed(-120), y: toFixed(130), passThrough: true },
  { x1: toFixed(120), x2: toFixed(300), y: toFixed(130), passThrough: true },
  { x1: toFixed(-80), x2: toFixed(80), y: toFixed(200), passThrough: true },
];

export const DIGITAL_GRID_PLATFORMS_PHASE2: Platform[] = [
  { x1: toFixed(-200), x2: toFixed(-50), y: toFixed(0), passThrough: true },
  { x1: toFixed(50), x2: toFixed(200), y: toFixed(0), passThrough: true },
  { x1: toFixed(-300), x2: toFixed(-120), y: toFixed(130), passThrough: true },
  { x1: toFixed(120), x2: toFixed(300), y: toFixed(130), passThrough: true },
];

export const DIGITAL_GRID_BLAST_ZONES: BlastZones = {
  left:   toFixed(-750),
  right:  toFixed(750),
  top:    toFixed(650),
  bottom: toFixed(-320),
};

/** Frames before the stage transitions to phase 2 (90s at 60 Hz). */
export const DIGITAL_GRID_PHASE_DURATION = 5400;

/** Frames phase 2 remains active before cycling back to phase 1 (30s at 60 Hz). */
export const DIGITAL_GRID_PHASE2_DURATION = 1800;
