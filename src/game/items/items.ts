// src/game/items/items.ts
// Items system — 4 categories as described in docs/game-design/items.md
//
// All RNG calls go through nextRng() so both peers spawn identical items on
// identical frames. Spawn timers use the frame counter (matchState.frame),
// never wall-clock time.

import type { EntityId } from '../../engine/ecs/entity.js';
import type { Fixed } from '../../engine/physics/fixednum.js';
import { toFixed, fixedAdd } from '../../engine/physics/fixednum.js';
import {
  transformComponents,
  physicsComponents,
  fighterComponents,
} from '../../engine/ecs/component.js';
import { nextRng } from '../../engine/physics/lcg.js';

// ── Item categories ───────────────────────────────────────────────────────────

export type ItemCategory =
  | 'meleeAugment'
  | 'throwableProjectile'
  | 'assistOrb'
  | 'healingCharm';

export type ItemType =
  | 'energyRod'
  | 'heavyMallet'
  | 'explosiveSphere'
  | 'boomerang'
  | 'assistOrb'
  | 'aetherCrystal';

// ── Orb / Guardian colours ────────────────────────────────────────────────────

export type OrbColour = 'gold' | 'silver' | 'green' | 'red' | 'purple';

export const ORB_COLOURS: readonly OrbColour[] = ['gold', 'silver', 'green', 'red', 'purple'];

export const ORB_GUARDIAN: Record<OrbColour, string> = {
  gold:   'Titan Golem',
  silver: 'Spectral Archer',
  green:  'Vine Wraith',
  red:    'Flame Phoenix',
  purple: 'Void Stalker',
};

// ── Spawn settings ────────────────────────────────────────────────────────────

export type SpawnSetting = 'off' | 'low' | 'medium' | 'high';

/** Minimum frames between spawns per setting (at 60 Hz). */
export const SPAWN_INTERVAL_FRAMES: Record<SpawnSetting, number> = {
  off:    Infinity,
  low:    2700, // ~45 s
  medium: 1500, // ~25 s
  high:    720, // ~12 s
};

// ── Item entity ───────────────────────────────────────────────────────────────

export interface ItemEntity {
  entityId:      EntityId;
  itemType:      ItemType;
  category:      ItemCategory;
  /** Owning fighter (for augments held by a fighter). null = on-stage. */
  heldBy:        EntityId | null;
  /** Frames remaining before the item expires (0 = never). */
  durationFrames: number;
  /** For assistOrb: how much HP the orb still has. */
  orbHp:         number;
  /** For assistOrb: chosen guardian. */
  orbColour:     OrbColour | null;
  /** World position (null if held). */
  x:             Fixed;
  y:             Fixed;
  /** Horizontal velocity (used by boomerang, explosive sphere). */
  vx:            Fixed;
  vy:            Fixed;
  /** For boomerang: frames until it reverses direction. */
  boomerangReturnFrame: number;
  /** For explosive sphere: whether it is armed as a proximity trap. */
  proxTrap:      boolean;
  /** Frames until proximity trap detonates. */
  proxArmFrames: number;
}

// ── Active items (module-level state) ────────────────────────────────────────

/** All currently active item entities. */
export const activeItems: ItemEntity[] = [];

/** Per-category "one active at a time" tracking. */
const activeCategorySet = new Set<ItemCategory>();

/** Frame of last spawn. */
let lastSpawnFrame = 0;

/** Current spawn setting. */
let spawnSetting: SpawnSetting = 'medium';

/** Spawn points for the current stage. */
let spawnPoints: Array<{ x: Fixed; y: Fixed }> = [];

let nextEntityId = 10000; // high range to avoid ECS collisions

// ── Public configuration API ──────────────────────────────────────────────────

export function setItemSpawnSetting(setting: SpawnSetting): void {
  spawnSetting = setting;
}

export function setItemSpawnPoints(points: Array<{ x: Fixed; y: Fixed }>): void {
  spawnPoints = points;
}

export function clearItems(): void {
  activeItems.length = 0;
  activeCategorySet.clear();
  lastSpawnFrame = 0;
}

// ── Spawn logic ───────────────────────────────────────────────────────────────

/**
 * Choose and spawn a new item at a random spawn point.
 * Uses the shared LCG so both peers spawn the same item at the same frame.
 */
export function trySpawnItem(currentFrame: number): void {
  const interval = SPAWN_INTERVAL_FRAMES[spawnSetting];
  if (!isFinite(interval)) return;
  if (currentFrame - lastSpawnFrame < interval) return;
  if (spawnPoints.length === 0) return;

  lastSpawnFrame = currentFrame;

  // Pick a random spawn point using LCG
  const ptIdx = nextRng() % spawnPoints.length;
  const pt = spawnPoints[ptIdx]!;

  // Pick a random category (weighted: skip categories already on stage)
  const availableCategories: ItemCategory[] = (
    ['meleeAugment', 'throwableProjectile', 'assistOrb', 'healingCharm'] as ItemCategory[]
  ).filter(c => !activeCategorySet.has(c));
  if (availableCategories.length === 0) return;

  const catIdx  = nextRng() % availableCategories.length;
  const category = availableCategories[catIdx]!;

  const item = buildItem(category, pt.x, pt.y);
  activeItems.push(item);
  activeCategorySet.add(category);
}

function buildItem(category: ItemCategory, x: Fixed, y: Fixed): ItemEntity {
  const id = nextEntityId++;
  let itemType: ItemType;
  let durationFrames = 0;
  let orbHp = 0;
  let orbColour: OrbColour | null = null;

  switch (category) {
    case 'meleeAugment':
      itemType = (nextRng() & 1) === 0 ? 'energyRod' : 'heavyMallet';
      durationFrames = itemType === 'energyRod' ? 900 : 600; // 15 s | 10 s at 60 Hz
      break;
    case 'throwableProjectile':
      itemType = (nextRng() & 1) === 0 ? 'explosiveSphere' : 'boomerang';
      durationFrames = 0; // persists until used
      break;
    case 'assistOrb':
      itemType = 'assistOrb';
      orbHp = 20;
      orbColour = ORB_COLOURS[nextRng() % ORB_COLOURS.length] ?? 'gold';
      durationFrames = 0;
      break;
    case 'healingCharm':
      itemType = 'aetherCrystal';
      durationFrames = 0;
      break;
  }

  return {
    entityId: id,
    itemType,
    category,
    heldBy: null,
    durationFrames,
    orbHp,
    orbColour,
    x, y,
    vx: toFixed(0),
    vy: toFixed(0),
    boomerangReturnFrame: 0,
    proxTrap: false,
    proxArmFrames: 0,
  };
}

// ── Per-frame item simulation ─────────────────────────────────────────────────

/**
 * Advance all active items by one physics frame.
 * - Decrement duration timers and remove expired items.
 * - Move projectiles.
 * - Check fighter proximity for pick-up / hit.
 */
export function tickItems(currentFrame: number): void {
  for (let i = activeItems.length - 1; i >= 0; i--) {
    const item = activeItems[i]!;

    // Duration countdown
    if (item.durationFrames > 0) {
      item.durationFrames--;
      if (item.durationFrames === 0) {
        removeItem(i);
        continue;
      }
    }

    // Augments held by a fighter expire when the fighter is KO'd
    if (item.heldBy !== null) {
      const f = fighterComponents.get(item.heldBy);
      if (!f || f.state === 'KO') {
        item.heldBy = null;
        activeCategorySet.delete(item.category);
        activeItems.splice(i, 1);
        continue;
      }
      // Track fighter position
      const t = transformComponents.get(item.heldBy);
      if (t) { item.x = t.x; item.y = t.y; }
      continue;
    }

    // Boomerang movement
    if (item.itemType === 'boomerang') {
      item.x = fixedAdd(item.x, item.vx);
      item.y = fixedAdd(item.y, item.vy);
      // Simple return after boomerangReturnFrame frames
      if (item.boomerangReturnFrame > 0) {
        item.boomerangReturnFrame--;
        if (item.boomerangReturnFrame === 0) {
          item.vx = -item.vx; // reverse
        }
      }
    }

    // Explosive sphere proximity trap countdown
    if (item.itemType === 'explosiveSphere' && item.proxTrap) {
      if (item.proxArmFrames > 0) {
        item.proxArmFrames--;
      } else {
        // Detonate — apply damage to nearby fighters
        explodeItem(item);
        removeItem(i);
        continue;
      }
    }

    // Auto-pick-up check for healing charms and assist orbs
    checkFighterPickup(item, i, currentFrame);
  }
}

function removeItem(idx: number): void {
  const item = activeItems[idx]!;
  activeCategorySet.delete(item.category);
  activeItems.splice(idx, 1);
}

/** Apply healing charm or orb pick-up if a fighter is close enough. */
function checkFighterPickup(
  item: ItemEntity,
  idx: number,
  _currentFrame: number,
): void {
  for (const [fid, fighter] of fighterComponents) {
    if (fighter.state === 'KO') continue;
    const t = transformComponents.get(fid);
    if (!t) continue;

    const dx = (t.x - item.x) | 0;
    const dy = (t.y - item.y) | 0;
    // Integer distance check (avoid sqrt)
    if (Math.abs(dx) > 40 * 65536 || Math.abs(dy) > 40 * 65536) continue;

    switch (item.itemType) {
      case 'aetherCrystal':
        // Auto-activate: reduce damage by 30%, floor 0
        fighter.damagePercent = Math.max(0, fighter.damagePercent - toFixed(30)) | 0;
        removeItem(idx);
        return;

      case 'energyRod':
      case 'heavyMallet':
        // Picked up by fighter
        item.heldBy = fid;
        return;

      case 'explosiveSphere':
      case 'boomerang':
        // Picked up for throwing
        item.heldBy = fid;
        return;

      default:
        break;
    }
  }
}

/** Detonate an explosive sphere — deal damage to fighters in blast radius. */
function explodeItem(item: ItemEntity): void {
  const BLAST_RADIUS = 3 * 30 * 65536; // ~3 character widths in Q16.16
  for (const [fid, fighter] of fighterComponents) {
    if (fighter.state === 'KO') continue;
    const t = transformComponents.get(fid);
    if (!t) continue;
    const dx = Math.abs((t.x - item.x) | 0);
    const dy = Math.abs((t.y - item.y) | 0);
    if (dx <= BLAST_RADIUS && dy <= BLAST_RADIUS) {
      fighter.damagePercent = fixedAdd(fighter.damagePercent, toFixed(22));
      const phys = physicsComponents.get(fid);
      if (phys) {
        // High knockback
        phys.vx = fixedAdd(phys.vx, t.facingRight ? -toFixed(3) : toFixed(3));
        phys.vy = fixedAdd(phys.vy, toFixed(5));
        phys.grounded = false;
      }
    }
  }
}

/**
 * Deal damage to an assist orb (called when a hitbox intersects the orb).
 * Returns the orbColour of the guardian summoned if the orb is broken, else null.
 */
export function hitAssistOrb(item: ItemEntity, damage: number): OrbColour | null {
  if (item.itemType !== 'assistOrb') return null;
  item.orbHp -= damage;
  if (item.orbHp <= 0) {
    const colour = item.orbColour;
    const idx = activeItems.indexOf(item);
    if (idx !== -1) removeItem(idx);
    return colour;
  }
  return null;
}
