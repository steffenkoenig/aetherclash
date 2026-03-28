// src/game/stages/voidRift.ts
// Stage layout for Void Rift -- platforms suspended above an infinite dark void.
//
// A minimal, high-skill-floor stage. Three small platforms are spread far apart
// over a featureless void. The gaps between them are punishing -- mis-timing a
// recovery means instant death. Tight blast zones increase lethality.

import { toFixed } from '../../engine/physics/fixednum.js';
import type { Platform } from '../../engine/physics/collision.js';
import type { BlastZones } from '../../engine/physics/blastZone.js';

export const VOID_RIFT_PLATFORMS: Platform[] = [
  // Central platform -- the main fighting surface.
  { x1: toFixed(-180), x2: toFixed(180), y: toFixed(0), passThrough: false },
  // Left floating platform -- separated by a significant gap.
  { x1: toFixed(-380), x2: toFixed(-220), y: toFixed(80), passThrough: true },
  // Right floating platform.
  { x1: toFixed(220),  x2: toFixed(380),  y: toFixed(80), passThrough: true },
];

export const VOID_RIFT_BLAST_ZONES: BlastZones = {
  left:   toFixed(-620),
  right:  toFixed(620),
  top:    toFixed(500),
  bottom: toFixed(-280),
};
