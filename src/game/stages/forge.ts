// src/game/stages/forge.ts
// Stage layout for Sector Omega: Cargo Bay -- asymmetric high-speed industrial transport.
//
// The deck is deliberately asymmetrical: the left side sits 30 units lower than
// the right, connected by a 30-degree ramp (visual only; collisions are hard boxes).
// A "Pit" gap runs across the stage centre -- fall through it and you die.
// A Cargo Drone hazard occasionally flies across the upper zone.

import { toFixed } from '../../engine/physics/fixednum.js';
import type { Platform } from '../../engine/physics/collision.js';
import type { BlastZones } from '../../engine/physics/blastZone.js';

export const FORGE_PLATFORMS: Platform[] = [
  // Left deck (lower side).
  { x1: toFixed(-500), x2: toFixed(-40), y: toFixed(-30), passThrough: false },
  // Right deck (higher side).
  { x1: toFixed(40),   x2: toFixed(500), y: toFixed(30),  passThrough: false },
  // Elevated left catwalk.
  { x1: toFixed(-380), x2: toFixed(-160), y: toFixed(100), passThrough: true },
  // Elevated right catwalk (slightly higher to match asymmetry).
  { x1: toFixed(160),  x2: toFixed(380),  y: toFixed(130), passThrough: true },
];

export const FORGE_BLAST_ZONES: BlastZones = {
  left:   toFixed(-800),
  right:  toFixed(800),
  top:    toFixed(620),
  bottom: toFixed(-355),
};
