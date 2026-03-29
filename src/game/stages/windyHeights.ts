// src/game/stages/windyHeights.ts
// Stage layout for Windy Heights — a sun-drenched floating meadow with gusting winds.
//
// Inspired by the classic "three platforms above a wide main stage" layout
// popularised by N64 platform fighters.  The main surface is intentionally
// wide and flat to encourage open neutral play; the three cloud platforms above
// form a triangle for aerial mix-ups.
//
// The stage's only hazard is a periodic wind gust (shared with Pastel Paper Peaks)
// that pushes all fighters sideways for two seconds every sixty seconds.

import { toFixed } from '../../engine/physics/fixednum.js';
import type { Platform } from '../../engine/physics/collision.js';
import type { BlastZones } from '../../engine/physics/blastZone.js';

export const WINDY_HEIGHTS_PLATFORMS: Platform[] = [
  // Wide grassy main platform — generous surface, no pits.
  { x1: toFixed(-430), x2: toFixed(430), y: toFixed(0), passThrough: false },
  // Left floating cloud ledge.
  { x1: toFixed(-290), x2: toFixed(-85), y: toFixed(155), passThrough: true },
  // Right floating cloud ledge.
  { x1: toFixed(85),   x2: toFixed(290), y: toFixed(155), passThrough: true },
  // Top centre cloud — apex of the triangle.
  { x1: toFixed(-115), x2: toFixed(115), y: toFixed(268), passThrough: true },
];

export const WINDY_HEIGHTS_BLAST_ZONES: BlastZones = {
  left:   toFixed(-760),
  right:  toFixed(760),
  top:    toFixed(620),
  bottom: toFixed(-350),
};
