// src/game/stages/cloudCitadel.ts
// Stage layout for Pastel Paper Peaks -- storybook cardboard-and-felt world.
//
// The main cloud platform is bouncy: characters receive a gentle upward impulse
// on every landing, giving an effective 1.1x jump-height multiplier.
// Three smaller pass-through cloud platforms are arranged in a triangle above.
// Every 60 s a "Windy" event pushes all players slightly to the left.

import { toFixed } from '../../engine/physics/fixednum.js';
import type { Platform } from '../../engine/physics/collision.js';
import type { BlastZones } from '../../engine/physics/blastZone.js';

export const CLOUD_CITADEL_PLATFORMS: Platform[] = [
  // Main cloud -- bouncy landing surface.
  { x1: toFixed(-380), x2: toFixed(380), y: toFixed(0), passThrough: false, bouncy: true },
  // Lower-left cloud (triangle arrangement).
  { x1: toFixed(-260), x2: toFixed(-70), y: toFixed(120), passThrough: true },
  // Lower-right cloud.
  { x1: toFixed(70),   x2: toFixed(260), y: toFixed(120), passThrough: true },
  // Upper-centre cloud (apex of the triangle).
  { x1: toFixed(-100), x2: toFixed(100), y: toFixed(220), passThrough: true },
];

export const CLOUD_CITADEL_BLAST_ZONES: BlastZones = {
  left:   toFixed(-650),
  right:  toFixed(650),
  top:    toFixed(720),
  bottom: toFixed(-355),
};
