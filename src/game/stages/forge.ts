// src/game/stages/forge.ts
// Stage layout for Forge — wide stage with two side platforms.

import { toFixed } from '../../engine/physics/fixednum.js';
import type { Platform } from '../../engine/physics/collision.js';
import type { BlastZones } from '../../engine/physics/blastZone.js';

export const FORGE_PLATFORMS: Platform[] = [
  { x1: toFixed(-550), x2: toFixed(550), y: toFixed(0), passThrough: false },
  { x1: toFixed(-350), x2: toFixed(-150), y: toFixed(120), passThrough: true },
  { x1: toFixed(150), x2: toFixed(350), y: toFixed(120), passThrough: true },
];

export const FORGE_BLAST_ZONES: BlastZones = {
  left:   toFixed(-850),
  right:  toFixed(850),
  top:    toFixed(650),
  bottom: toFixed(-355),
};
