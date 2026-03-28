// src/game/stages/ancientRuin.ts
// Stage layout for Overgrown Clockwork Spire -- ancient ruins reclaimed by nature.
//
// The main bridge has a visual V-shape dip at its centre (purely cosmetic);
// the collision remains a single hard box as described.
// Two wooden planks float to either side, held by static chains.
// Every 30 s the central stone gear rotates 90 degrees (visual cue only).

import { toFixed } from '../../engine/physics/fixednum.js';
import type { Platform } from '../../engine/physics/collision.js';
import type { BlastZones } from '../../engine/physics/blastZone.js';

export const ANCIENT_RUIN_PLATFORMS: Platform[] = [
  // Wide stone bridge -- the V-shape dip is visual; collision = sharp flat box.
  { x1: toFixed(-420), x2: toFixed(420), y: toFixed(0), passThrough: false },
  // Left floating wooden plank (held by chains).
  { x1: toFixed(-390), x2: toFixed(-180), y: toFixed(150), passThrough: true },
  // Right floating wooden plank (held by chains).
  { x1: toFixed(180),  x2: toFixed(390),  y: toFixed(150), passThrough: true },
];

export const ANCIENT_RUIN_BLAST_ZONES: BlastZones = {
  left:   toFixed(-725),
  right:  toFixed(725),
  top:    toFixed(610),
  bottom: toFixed(-340),
};

/** Frames between gear rotation events (30 s at 60 Hz). Visual only. */
export const CLOCKWORK_GEAR_INTERVAL = 1800;
