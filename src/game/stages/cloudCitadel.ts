// src/game/stages/cloudCitadel.ts
// Stage layout for Cloud Citadel — smaller main platform with raised side and centre platforms.

import { toFixed } from '../../engine/physics/fixednum.js';
import type { Platform } from '../../engine/physics/collision.js';
import type { BlastZones } from '../../engine/physics/blastZone.js';

export const CLOUD_CITADEL_PLATFORMS: Platform[] = [
  { x1: toFixed(-300), x2: toFixed(300), y: toFixed(0), passThrough: false },
  { x1: toFixed(-350), x2: toFixed(-200), y: toFixed(160), passThrough: true },
  { x1: toFixed(200), x2: toFixed(350), y: toFixed(160), passThrough: true },
  { x1: toFixed(-100), x2: toFixed(100), y: toFixed(100), passThrough: true },
];

export const CLOUD_CITADEL_BLAST_ZONES: BlastZones = {
  left:   toFixed(-650),
  right:  toFixed(650),
  top:    toFixed(710),
  bottom: toFixed(-355),
};
