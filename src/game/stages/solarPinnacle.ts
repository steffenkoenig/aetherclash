// src/game/stages/solarPinnacle.ts
// Stage layout for Solar Pinnacle -- a mountaintop arena bathed in intense sunlight.
//
// Wide main summit with two tiers of side platforms rising steeply on each flank.
// A periodic solar-flare hazard scorches the right side of the stage.

import { toFixed } from '../../engine/physics/fixednum.js';
import type { Platform } from '../../engine/physics/collision.js';
import type { BlastZones } from '../../engine/physics/blastZone.js';

export const SOLAR_PINNACLE_PLATFORMS: Platform[] = [
  // Main summit.
  { x1: toFixed(-340), x2: toFixed(340), y: toFixed(0), passThrough: false },
  // Lower flanking ledges.
  { x1: toFixed(-460), x2: toFixed(-280), y: toFixed(-60), passThrough: true },
  { x1: toFixed(280),  x2: toFixed(460),  y: toFixed(-60), passThrough: true },
  // Upper side platforms.
  { x1: toFixed(-390), x2: toFixed(-200), y: toFixed(110), passThrough: true },
  { x1: toFixed(200),  x2: toFixed(390),  y: toFixed(110), passThrough: true },
];

export const SOLAR_PINNACLE_BLAST_ZONES: BlastZones = {
  left:   toFixed(-760),
  right:  toFixed(760),
  top:    toFixed(640),
  bottom: toFixed(-360),
};
