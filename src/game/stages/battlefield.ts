// src/game/stages/battlefield.ts
// Battlefield — the iconic SSB64 competitive layout.
//
// Layout (matching the spirit of the original):
//   - Solid main platform spanning the full width.
//   - Three small pass-through platforms at the same height:
//       left, centre, and right.
//   The stage is intentionally compact; stocks end quickly at high damage.

import { toFixed } from '../../engine/physics/fixednum.js';
import type { Platform } from '../../engine/physics/collision.js';
import type { BlastZones } from '../../engine/physics/blastZone.js';

export const BATTLEFIELD_PLATFORMS: Platform[] = [
  // Main platform — solid, no pass-through.
  { x1: toFixed(-380), x2: toFixed(380), y: toFixed(0), passThrough: false },
  // Left platform (pass-through)
  { x1: toFixed(-250), x2: toFixed(-90), y: toFixed(140), passThrough: true },
  // Centre platform (pass-through) — slightly higher than the side ones.
  { x1: toFixed(-100), x2: toFixed(100), y: toFixed(220), passThrough: true },
  // Right platform (pass-through)
  { x1: toFixed(90),   x2: toFixed(250), y: toFixed(140), passThrough: true },
];

export const BATTLEFIELD_BLAST_ZONES: BlastZones = {
  left:   toFixed(-700),
  right:  toFixed(700),
  top:    toFixed(560),
  bottom: toFixed(-300),
};
