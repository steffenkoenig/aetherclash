// src/game/stages/stage.ts
// Stage data interface and helpers.

import type { Platform, LedgeCollider } from '../../engine/physics/collision.js';
import type { BlastZone } from '../../engine/physics/blastZone.js';
import type { Fixed } from '../../engine/physics/fixednum.js';

export interface ItemSpawnPoint {
  x: Fixed;
  y: Fixed;
}

export interface Stage {
  id: string;
  name: string;
  platforms: Platform[];
  blastZone: BlastZone;
  ledgeColliders: LedgeCollider[];
  itemSpawnPoints: ItemSpawnPoint[];
}
