// src/game/stages/ancientRuin.ts
// Stage layout for Ancient Ruin — standard layout with a solid centre pillar platform.

import { toFixed } from '../../engine/physics/fixednum.js';
import type { Platform } from '../../engine/physics/collision.js';
import type { BlastZones } from '../../engine/physics/blastZone.js';

export const ANCIENT_RUIN_PLATFORMS: Platform[] = [
  { x1: toFixed(-400), x2: toFixed(400), y: toFixed(0), passThrough: false },
  { x1: toFixed(-280), x2: toFixed(-130), y: toFixed(140), passThrough: true },
  { x1: toFixed(130), x2: toFixed(280), y: toFixed(140), passThrough: true },
  // Centre pillar — solid (no pass-through)
  { x1: toFixed(-60), x2: toFixed(60), y: toFixed(100), passThrough: false },
];

export const ANCIENT_RUIN_BLAST_ZONES: BlastZones = {
  left:   toFixed(-725),
  right:  toFixed(725),
  top:    toFixed(610),
  bottom: toFixed(-340),
};
