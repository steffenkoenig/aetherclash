// src/game/stages/aetherPlateau.ts
// Stage layout for Aether Plateau — standard competitive layout.

import { toFixed } from '../../engine/physics/fixednum.js';
import type { Platform } from '../../engine/physics/collision.js';
import type { BlastZones } from '../../engine/physics/blastZone.js';

export const AETHER_PLATEAU_PLATFORMS: Platform[] = [
  // Main stage
  { x1: toFixed(-425), x2: toFixed(425), y: toFixed(0), passThrough: false },
  // Left platform (pass-through)
  { x1: toFixed(-280), x2: toFixed(-130), y: toFixed(130), passThrough: true },
  // Right platform (pass-through)
  { x1: toFixed(130), x2: toFixed(280), y: toFixed(130), passThrough: true },
  // Top center platform (pass-through)
  { x1: toFixed(-110), x2: toFixed(110), y: toFixed(230), passThrough: true },
];

export const AETHER_PLATEAU_BLAST_ZONES: BlastZones = {
  left:   toFixed(-750),
  right:  toFixed(750),
  top:    toFixed(580),
  bottom: toFixed(-320),
};
