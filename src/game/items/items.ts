// src/game/items/items.ts
// Items system — 16 item types across 4 categories.
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
import { GRAVITY } from '../../engine/physics/gravity.js';

// ── Item categories ───────────────────────────────────────────────────────────

export type ItemCategory =
  | 'meleeAugment'
  | 'throwableProjectile'
  | 'assistOrb'
  | 'healingCharm';

export type ItemType =
  // ── Melee augments (held) ──────────────────────────────────────────────────
  | 'energyRod'       // electric staff — +8% damage on swings, stun on smash
  | 'heavyMallet'     // slow overhead smash — +15% damage, +30% knockback
  | 'emberCore'            // fire thrower — continuous flame aura while held (300 fuel frames)
  | 'runeshard'            // magic runeshard — auto fires 8% star shots every 30 f; 16 charges
  | 'speedBoots'      // rocket boots — boosts horizontal movement speed for 8 s
  | 'mirrorShard'     // crystal shard — grants 90 f invincibility on pickup; one use
  // ── Throwable projectiles ──────────────────────────────────────────────────
  | 'explosiveSphere' // fist-sized bomb — explodes on impact or as proximity trap
  | 'boomerang'       // returns to thrower; 10% out, 12% return
  | 'nexusCapsule'     // releases a creature on impact that attacks nearby foes for ~3 s
  | 'blastImp'           // walking bomb — can be thrown or left to self-destruct
  | 'gyrostone'          // dual-mode — thrown or self-activates and shoots in a direction
  | 'gravityAnchor'   // deploys a gravity well pulling fighters in for 5 s
  | 'iceTag'          // freezes the first opponent it hits for 3 s (180 f hitstun)
  | 'thunderBolt'     // thrown lightning rod — chains 15% shock + stun on hit
  // ── Assist orb (summoner) ──────────────────────────────────────────────────
  | 'assistOrb'       // orb with 20 HP — breaking summons a Guardian NPC
  // ── Healing charms ────────────────────────────────────────────────────────
  | 'aetherCrystal';  // auto-heal on pickup — reduces damage% by 30

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

// ── Item balance constants ────────────────────────────────────────────────────

/** emberCore: total frames of continuous flame use before burning out. */
export const EMBER_CORE_FUEL_FRAMES   = 300;
/** runeshard: total number of star shots before it runs dry. */
export const RUNESHARD_CHARGES       = 16;
/** runeshard: frames between auto-shot pulses while held. */
export const RUNESHARD_SHOT_INTERVAL = 30;
/** speedBoots: duration in frames (8 s @ 60 Hz). */
export const SPEED_BOOTS_FRAMES = 480;
/** mirrorShard: invincibility frames granted on pickup. */
export const MIRROR_SHARD_INVINCIBILITY = 90;
/** blastImp: frames on stage before it stands up and walks. */
export const BLAST_IMP_STANDBY_FRAMES = 300;
/** blastImp: frames the blastImp walks before detonating. */
export const BLAST_IMP_WALK_FRAMES = 120;
/** nexusCapsule: frames of flight before creature release. */
export const NEXUS_CAPSULE_FLIGHT_FRAMES = 90;
/** nexusCapsule: frames the released creature stays active. */
export const NEXUS_CAPSULE_CREATURE_FRAMES = 180;
/** gyrostone: frames on stage before auto-activation. */
export const GYROSTONE_STANDBY_FRAMES = 180;
/** gyrostone / gravityAnchor: frames in deployed/activated state. */
export const ITEM_DEPLOYED_FRAMES = 300;
/** thunderBolt: frames between shock pulses after hitting a fighter. */
export const THUNDER_BOLT_PULSE_FRAMES = 60;
/** thunderBolt: number of shock pulses. */
export const THUNDER_BOLT_PULSES = 3;
/** explosiveSphere: frames the armed mine waits before auto-detonation (4 s @ 60 Hz). */
export const EXPLOSIVE_SPHERE_FUSE_FRAMES = 240;
/** assistOrb: maximum hit-points (breaks and summons guardian at 0). */
export const ASSIST_ORB_MAX_HP = 20;
/** assistOrb: Q16.16 world-unit radius within which fighter attacks damage the orb. */
export const ASSIST_ORB_HIT_RANGE = 50 * 65536;

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
  /** Horizontal velocity (used by boomerang, explosive sphere, thrown items). */
  vx:            Fixed;
  vy:            Fixed;
  /** For boomerang: frames until it reverses direction. */
  boomerangReturnFrame: number;
  /** For explosive sphere: whether it is armed as a proximity trap. */
  proxTrap:      boolean;
  /** Frames until proximity trap detonates. */
  proxArmFrames: number;
  // ── New item-specific fields ───────────────────────────────────────────────
  /** emberCore: remaining fuel frames (starts at EMBER_CORE_FUEL_FRAMES). */
  fuelFrames:    number;
  /** runeshard: remaining magic shot charges (starts at RUNESHARD_CHARGES). */
  charges:       number;
  /** runeshard: frames until next auto-shot; also used as a general per-pass
   *  hit cooldown for boomerang (30 frames between hits on each directional pass). */
  shotCooldown:  number;
  /** blastImp: frames until it stands up (when > 0, counting down). */
  walkFrames:    number;
  /** blastImp: true once it starts walking towards its explosion. */
  walkActive:    boolean;
  /**
   * gyrostone / gravityAnchor: true once the item enters its "second phase"
   * (gyrostone fires a shell; gravityAnchor becomes a deployed gravity well).
   */
  deployed:      boolean;
  /** Frames remaining in the deployed state. */
  deployFrames:  number;
  /** mirrorShard: true until the reflect has been consumed. */
  reflectReady:  boolean;
  /** nexusCapsule: frames the ball has been in-flight (counts up). */
  flightFrames:  number;
  /** nexusCapsule: true once the creature has been released. */
  creatureActive: boolean;
  /** nexusCapsule: frames remaining for the active creature. */
  creatureFrames: number;
  /** thunderBolt: true once the bolt has been thrown and armed. */
  boltArmed:     boolean;
  /** thunderBolt: frames until the shock pulse repeats. */
  boltFrames:    number;
  /**
   * Frames remaining where the item cannot be re-picked up after being thrown.
   * Set by `useHeldItem` for all throwable items; counts down in `tickItems`.
   */
  throwArmFrames: number;
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

/**
 * Item types allowed in curated (competitive) mode, per items.md §7.
 * Only the boomerang is retained; all high-variance items are disabled.
 */
const CURATED_ALLOWED: ReadonlySet<ItemType> = new Set<ItemType>(['boomerang']);

/** Whether curated (competitive) item mode is active. */
let curatedModeEnabled = false;

// ── Public configuration API ──────────────────────────────────────────────────

export function setItemSpawnSetting(setting: SpawnSetting): void {
  spawnSetting = setting;
}

export function setItemSpawnPoints(points: Array<{ x: Fixed; y: Fixed }>): void {
  spawnPoints = points;
}

/**
 * Enable or disable curated (competitive) item mode.
 *
 * When enabled (per items.md §7):
 *   - All Melee Augments, Assist Orbs, Healing Charms are disabled.
 *   - Of throwable projectiles, only the Boomerang is allowed.
 * Both peers must call this with the same value before `trySpawnItem` is
 * called so the RNG remains synchronised.
 */
export function setCuratedItemMode(enabled: boolean): void {
  curatedModeEnabled = enabled;
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

  // In curated mode only throwableProjectile (boomerang only) is allowed.
  const allCategories: ItemCategory[] =
    ['meleeAugment', 'throwableProjectile', 'assistOrb', 'healingCharm'];
  const allowedCategories = curatedModeEnabled
    ? (['throwableProjectile'] as ItemCategory[])
    : allCategories;

  // Pick a random category (weighted: skip categories already on stage)
  const availableCategories = allowedCategories.filter(c => !activeCategorySet.has(c));
  if (availableCategories.length === 0) return;

  const catIdx  = nextRng() % availableCategories.length;
  const category = availableCategories[catIdx]!;

  const item = buildItem(category, pt.x, pt.y);

  // In curated mode, reject items that are not on the allowed list.
  if (curatedModeEnabled && !CURATED_ALLOWED.has(item.itemType)) {
    // Consume the RNG roll but don't spawn.
    return;
  }

  activeItems.push(item);
  activeCategorySet.add(category);
}

function buildItem(category: ItemCategory, x: Fixed, y: Fixed): ItemEntity {
  const id = nextEntityId++;
  let itemType: ItemType;
  let durationFrames = 0;
  let orbHp = 0;
  let orbColour: OrbColour | null = null;
  let fuelFrames  = 0;
  let charges     = 0;

  switch (category) {
    case 'meleeAugment': {
      // 6 melee augments — pick one at random
      const r = nextRng() % 6;
      if      (r === 0) { itemType = 'energyRod';   durationFrames = 900; }
      else if (r === 1) { itemType = 'heavyMallet';  durationFrames = 600; }
      else if (r === 2) { itemType = 'emberCore';         fuelFrames = EMBER_CORE_FUEL_FRAMES; }
      else if (r === 3) { itemType = 'runeshard';         charges = RUNESHARD_CHARGES; }
      else if (r === 4) { itemType = 'speedBoots';   durationFrames = SPEED_BOOTS_FRAMES; }
      else              { itemType = 'mirrorShard'; }
      break;
    }
    case 'throwableProjectile': {
      // 8 throwable projectiles — pick one at random
      const r = nextRng() % 8;
      if      (r === 0) itemType = 'explosiveSphere';
      else if (r === 1) itemType = 'boomerang';
      else if (r === 2) itemType = 'nexusCapsule';
      else if (r === 3) itemType = 'blastImp';
      else if (r === 4) itemType = 'gyrostone';
      else if (r === 5) itemType = 'gravityAnchor';
      else if (r === 6) itemType = 'iceTag';
      else              itemType = 'thunderBolt';
      break;
    }
    case 'assistOrb':
      itemType = 'assistOrb';
      orbHp = ASSIST_ORB_MAX_HP;
      orbColour = ORB_COLOURS[nextRng() % ORB_COLOURS.length] ?? 'gold';
      break;
    case 'healingCharm':
      itemType = 'aetherCrystal';
      break;
    default:
      itemType = 'aetherCrystal';
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
    proxTrap:      false,
    proxArmFrames: 0,
    // New fields
    fuelFrames,
    charges,
    shotCooldown:   0,
    walkFrames:     BLAST_IMP_STANDBY_FRAMES,
    walkActive:     false,
    deployed:       false,
    deployFrames:   0,
    reflectReady:   itemType === 'mirrorShard',
    flightFrames:   0,
    creatureActive: false,
    creatureFrames: 0,
    boltArmed:      false,
    boltFrames:     0,
    throwArmFrames: 0,
  };
}

// ── Per-frame item simulation ─────────────────────────────────────────────────

/**
 * Advance all active items by one physics frame.
 * - Decrement duration timers and remove expired items.
 * - Move projectiles.
 * - Check fighter proximity for pick-up / hit / passive effects.
 */
export function tickItems(currentFrame: number): void {
  for (let i = activeItems.length - 1; i >= 0; i--) {
    const item = activeItems[i]!;

    // Duration countdown (0 = no limit)
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

      // ── Held-item passive effects ──────────────────────────────────────────

      // emberCore: burn nearby fighters while held
      if (item.itemType === 'emberCore') {
        if (item.fuelFrames > 0) {
          item.fuelFrames--;
          applyFireAura(item);
          if (item.fuelFrames === 0) {
            removeItem(i);
            continue;
          }
        }
      }

      // runeshard: auto-fire star shots at interval while held
      if (item.itemType === 'runeshard') {
        if (item.charges > 0) {
          if (item.shotCooldown > 0) {
            item.shotCooldown--;
          } else {
            item.shotCooldown = RUNESHARD_SHOT_INTERVAL;
            item.charges--;
            fireRuneshardShot(item);
            if (item.charges === 0) {
              removeItem(i);
              continue;
            }
          }
        }
      }

      // mirrorShard: grant invincibility to holder on first frame of pickup
      if (item.itemType === 'mirrorShard' && item.reflectReady) {
        item.reflectReady = false;
        const hf = fighterComponents.get(item.heldBy);
        if (hf) {
          hf.invincibleFrames = Math.max(hf.invincibleFrames, MIRROR_SHARD_INVINCIBILITY);
        }
        // One-use: remove after granting
        removeItem(i);
        continue;
      }

      // speedBoots: apply gentle horizontal boost toward movement direction
      if (item.itemType === 'speedBoots') {
        const phys = physicsComponents.get(item.heldBy);
        const tf   = transformComponents.get(item.heldBy);
        if (phys && tf) {
          const boost = tf.facingRight ? toFixed(0.3) : -toFixed(0.3);
          phys.vx = fixedAdd(phys.vx, boost);
        }
      }

      continue; // rest of loop is for on-stage items
    }

    // ── On-stage item simulation ───────────────────────────────────────────

    // Arm-frame guard: newly-thrown items cannot be re-picked up until the
    // counter reaches zero (prevents the thrower from immediately reclaiming).
    if (item.throwArmFrames > 0) {
      item.throwArmFrames--;
    }

    // Boomerang movement + hit detection
    if (item.itemType === 'boomerang') {
      item.x = fixedAdd(item.x, item.vx);
      item.y = fixedAdd(item.y, item.vy);
      if (item.boomerangReturnFrame > 0) {
        item.boomerangReturnFrame--;
        if (item.boomerangReturnFrame === 0) {
          item.vx = -item.vx;
          item.shotCooldown = 0; // reset hit cooldown on direction reversal
        }
      }
      // Hit fighters along the flight path (10% outward, 12% returning)
      if (item.shotCooldown > 0) {
        item.shotCooldown--;
      } else {
        checkBoomerangHit(item);
      }
    }

    // Explosive sphere proximity trap: slide to its landing spot, then arm a fuse
    if (item.itemType === 'explosiveSphere' && item.proxTrap) {
      if (item.proxArmFrames > 0) {
        // Slide while arming
        item.x = fixedAdd(item.x, item.vx);
        item.y = fixedAdd(item.y, item.vy);
        if ((item.y | 0) < 0) { item.y = 0; item.vy = 0; }
        item.proxArmFrames--;
        if (item.proxArmFrames === 0) {
          // Become stationary; start the 4-second fuse (240 frames)
          item.vx = toFixed(0);
          item.vy = toFixed(0);
          item.deployFrames = EXPLOSIVE_SPHERE_FUSE_FRAMES;
        }
      } else if (item.deployFrames > 0) {
        // Armed and waiting — check for fighter proximity OR fuse expiry
        item.deployFrames--;
        const PROX_RANGE = 2 * 30 * 65536; // 2 × fighter half-width in Q16.16
        let triggered = item.deployFrames <= 0;
        if (!triggered) {
          for (const [fid] of fighterComponents) {
            const ft = transformComponents.get(fid);
            if (!ft) continue;
            if (Math.abs((ft.x - item.x) | 0) <= PROX_RANGE &&
                Math.abs((ft.y - item.y) | 0) <= PROX_RANGE) {
              triggered = true;
              break;
            }
          }
        }
        if (triggered) {
          explodeItem(item);
          removeItem(i);
          continue;
        }
      }
    }

    // assistOrb: on-stage — take damage from fighters in attack state nearby
    if (item.itemType === 'assistOrb') {
      const ORB_HIT_RANGE = ASSIST_ORB_HIT_RANGE;
      let orbBroken = false;
      for (const [fid, fighter] of fighterComponents) {
        if (fighter.state !== 'attack') continue;
        const t = transformComponents.get(fid);
        if (!t) continue;
        if (Math.abs((t.x - item.x) | 0) <= ORB_HIT_RANGE &&
            Math.abs((t.y - item.y) | 0) <= ORB_HIT_RANGE) {
          item.orbHp -= 5;
          if (item.orbHp <= 0) {
            orbBroken = true;
            break;
          }
        }
      }
      if (orbBroken) {
        removeItem(i);
        continue;
      }
    }

    // nexusCapsule: in-flight, release creature after NEXUS_CAPSULE_FLIGHT_FRAMES
    if (item.itemType === 'nexusCapsule') {
      if (!item.creatureActive) {
        item.x = fixedAdd(item.x, item.vx);
        item.y = fixedAdd(item.y, item.vy);
        item.flightFrames++;
        if (item.flightFrames >= NEXUS_CAPSULE_FLIGHT_FRAMES) {
          item.creatureActive = true;
          item.creatureFrames = NEXUS_CAPSULE_CREATURE_FRAMES;
          item.vx = toFixed(0);
          item.vy = toFixed(0);
        }
      } else {
        // Creature is active — attack nearest fighter each frame
        applyCreatureAttack(item);
        item.creatureFrames--;
        if (item.creatureFrames <= 0) {
          removeItem(i);
          continue;
        }
      }
    }

    // blastImp: count down, then walk, then explode
    if (item.itemType === 'blastImp') {
      if (!item.walkActive) {
        // Standby phase: count down
        item.walkFrames--;
        if (item.walkFrames <= 0) {
          item.walkActive = true;
          item.walkFrames = BLAST_IMP_WALK_FRAMES;
          // Start walking left or right (LCG-driven for determinism)
          item.vx = (nextRng() & 1) === 0 ? toFixed(0.8) : -toFixed(0.8);
        }
      } else {
        // Walk phase: move and count down to explosion
        item.x = fixedAdd(item.x, item.vx);
        item.walkFrames--;
        if (item.walkFrames <= 0) {
          // Explode
          explodeItem(item);
          removeItem(i);
          continue;
        }
      }
    }

    // gyrostone: auto-activate after standby frames
    if (item.itemType === 'gyrostone') {
      if (!item.deployed) {
        item.deployFrames++;
        if (item.deployFrames >= GYROSTONE_STANDBY_FRAMES) {
          activateOyster(item);
        }
      } else {
        // Deployed: shoot as fast projectile
        item.x = fixedAdd(item.x, item.vx);
        item.deployFrames--;
        checkOysterHit(item, i);
        if (item.deployFrames <= 0) {
          removeItem(i);
          continue;
        }
      }
    }

    // gravityAnchor: after flight, deploy as gravity well
    if (item.itemType === 'gravityAnchor') {
      if (!item.deployed) {
        item.x = fixedAdd(item.x, item.vx);
        item.y = fixedAdd(item.y, item.vy);
        item.flightFrames++;
        if (item.flightFrames >= NEXUS_CAPSULE_FLIGHT_FRAMES) {
          item.deployed     = true;
          item.deployFrames = ITEM_DEPLOYED_FRAMES;
          item.vx = toFixed(0);
          item.vy = toFixed(0);
        }
      } else {
        applyGravityWell(item);
        item.deployFrames--;
        if (item.deployFrames <= 0) {
          removeItem(i);
          continue;
        }
      }
    }

    // iceTag: travel and freeze first fighter hit
    if (item.itemType === 'iceTag') {
      item.x = fixedAdd(item.x, item.vx);
      item.y = fixedAdd(item.y, item.vy);
      if (checkIceTagHit(item)) {
        removeItem(i);
        continue;
      }
      // Expire after 120 frames of flight
      item.flightFrames++;
      if (item.flightFrames >= 120) {
        removeItem(i);
        continue;
      }
    }

    // thunderBolt: travel to hit fighter, then shock pulses
    if (item.itemType === 'thunderBolt') {
      if (!item.boltArmed) {
        item.x = fixedAdd(item.x, item.vx);
        item.y = fixedAdd(item.y, item.vy);
        item.flightFrames++;
        if (checkThunderBoltHit(item)) {
          item.boltArmed  = true;
          item.boltFrames = THUNDER_BOLT_PULSE_FRAMES;
          item.charges    = THUNDER_BOLT_PULSES;
          item.vx = toFixed(0);
          item.vy = toFixed(0);
        }
        if (item.flightFrames >= 120) {
          removeItem(i);
          continue;
        }
      } else {
        item.boltFrames--;
        if (item.boltFrames <= 0 && item.charges > 0) {
          item.charges--;
          applyThunderPulse(item);
          item.boltFrames = THUNDER_BOLT_PULSE_FRAMES;
        }
        if (item.charges <= 0) {
          removeItem(i);
          continue;
        }
      }
    }

    // ── Item gravity for idle pickup items ────────────────────────────────────
    // Melee-augments and healing charms don't self-integrate their position.
    // Apply gravity so they fall from spawn height to the stage floor (y ≥ 0).
    switch (item.itemType) {
      case 'energyRod':
      case 'heavyMallet':
      case 'emberCore':
      case 'runeshard':
      case 'speedBoots':
      case 'mirrorShard':
      case 'aetherCrystal':
      case 'assistOrb':
        item.vy = fixedAdd(item.vy, GRAVITY);
        item.y  = fixedAdd(item.y,  item.vy);
        if ((item.y | 0) < 0) { item.y = 0; item.vy = 0; }
        break;
      default:
        break;
    }

    // Auto-pick-up check for healing charms, assist orbs, and held augments
    checkFighterPickup(item, i, currentFrame);
  }
}

function removeItem(idx: number): void {
  const item = activeItems[idx]!;
  activeCategorySet.delete(item.category);
  activeItems.splice(idx, 1);
}

// ── emberCore: continuous fire aura damage ────────────────────────────────────────

function applyFireAura(item: ItemEntity): void {
  const FIRE_RANGE = 35 * 65536; // Q16.16 units
  for (const [fid, fighter] of fighterComponents) {
    if (fid === item.heldBy) continue;
    if (fighter.state === 'KO') continue;
    const t = transformComponents.get(fid);
    if (!t) continue;
    if (Math.abs((t.x - item.x) | 0) <= FIRE_RANGE &&
        Math.abs((t.y - item.y) | 0) <= FIRE_RANGE) {
      fighter.damagePercent = fixedAdd(fighter.damagePercent, toFixed(3));
    }
  }
}

// ── boomerang: hit fighters along flight path ─────────────────────────────────────

/**
 * Damage the first fighter within range of the boomerang.
 * 10% on the outward pass (`boomerangReturnFrame > 0`), 12% on the return.
 * Uses `item.shotCooldown` as a 30-frame per-pass cooldown to avoid
 * hitting the same fighter every single frame.
 */
function checkBoomerangHit(item: ItemEntity): void {
  const HIT_RANGE = 25 * 65536; // Q16.16
  const isReturning = item.boomerangReturnFrame === 0;
  const damage = isReturning ? toFixed(12) : toFixed(10);

  for (const [fid, fighter] of fighterComponents) {
    if (fighter.state === 'KO') continue;
    const t = transformComponents.get(fid);
    if (!t) continue;
    if (Math.abs((t.x - item.x) | 0) <= HIT_RANGE &&
        Math.abs((t.y - item.y) | 0) <= HIT_RANGE) {
      fighter.damagePercent = fixedAdd(fighter.damagePercent, damage);
      const phys = physicsComponents.get(fid);
      if (phys) {
        const dir = item.vx > 0 ? 1 : -1;
        phys.vx = fixedAdd(phys.vx, toFixed(1.5 * dir));
        phys.vy = fixedAdd(phys.vy, toFixed(1.5));
        phys.grounded = false;
      }
      item.shotCooldown = 30; // 0.5 s cooldown before next hit
      return;
    }
  }
}

// ── runeshard: auto-fire star shot ─────────────────────────────────────────────────

function fireRuneshardShot(item: ItemEntity): void {
  const SHOT_RANGE = 200 * 65536; // Q16.16
  let nearestDist = Infinity;
  let nearestFid: EntityId | null = null;
  for (const [fid, fighter] of fighterComponents) {
    if (fid === item.heldBy) continue;
    if (fighter.state === 'KO') continue;
    const t = transformComponents.get(fid);
    if (!t) continue;
    const dx = Math.abs((t.x - item.x) | 0);
    const dy = Math.abs((t.y - item.y) | 0);
    const dist = dx + dy;
    if (dist < nearestDist) {
      nearestDist = dist;
      nearestFid  = fid;
    }
  }
  if (nearestFid !== null && nearestDist <= SHOT_RANGE) {
    const fighter = fighterComponents.get(nearestFid)!;
    fighter.damagePercent = fixedAdd(fighter.damagePercent, toFixed(8));
  }
}

// ── nexusCapsule: creature attack ──────────────────────────────────────────────

function applyCreatureAttack(item: ItemEntity): void {
  const CREATURE_RANGE = 80 * 65536;
  // Deal ~4% every 15 frames while creature is active
  if (item.creatureFrames % 15 !== 0) return;
  for (const [fid, fighter] of fighterComponents) {
    if (fighter.state === 'KO') continue;
    const t = transformComponents.get(fid);
    if (!t) continue;
    const dx = Math.abs((t.x - item.x) | 0);
    const dy = Math.abs((t.y - item.y) | 0);
    if (dx <= CREATURE_RANGE && dy <= CREATURE_RANGE) {
      fighter.damagePercent = fixedAdd(fighter.damagePercent, toFixed(4));
    }
  }
}

// ── gyrostone: activation ────────────────────────────────────────────────────────

function activateOyster(item: ItemEntity): void {
  item.deployed     = true;
  item.deployFrames = 60; // travels for 60 frames
  // Direction determined by LCG
  item.vx = (nextRng() & 1) === 0 ? toFixed(6) : -toFixed(6);
}

function checkOysterHit(item: ItemEntity, _idx: number): void {
  const HIT_RANGE = 30 * 65536;
  for (const [fid, fighter] of fighterComponents) {
    if (fighter.state === 'KO') continue;
    const t = transformComponents.get(fid);
    if (!t) continue;
    if (Math.abs((t.x - item.x) | 0) <= HIT_RANGE &&
        Math.abs((t.y - item.y) | 0) <= HIT_RANGE) {
      fighter.damagePercent = fixedAdd(fighter.damagePercent, toFixed(15));
      const phys = physicsComponents.get(fid);
      if (phys) {
        phys.vx = fixedAdd(phys.vx, item.vx > 0 ? toFixed(2) : -toFixed(2));
        phys.grounded = false;
      }
    }
  }
}

// ── gravityAnchor: pull nearby fighters ──────────────────────────────────────

function applyGravityWell(item: ItemEntity): void {
  const WELL_RANGE = 150 * 65536;
  const PULL = toFixed(0.1);
  for (const [fid, fighter] of fighterComponents) {
    if (fighter.state === 'KO') continue;
    const t    = transformComponents.get(fid);
    const phys = physicsComponents.get(fid);
    if (!t || !phys) continue;
    const dx = (t.x - item.x) | 0;
    const dy = (t.y - item.y) | 0;
    if (Math.abs(dx) <= WELL_RANGE && Math.abs(dy) <= WELL_RANGE) {
      // Pull toward anchor
      phys.vx = fixedAdd(phys.vx, dx > 0 ? -PULL : PULL);
      phys.vy = fixedAdd(phys.vy, dy > 0 ? -PULL : PULL);
    }
  }
}

// ── iceTag: freeze on hit ─────────────────────────────────────────────────────

function checkIceTagHit(item: ItemEntity): boolean {
  const HIT_RANGE = 25 * 65536;
  for (const [fid, fighter] of fighterComponents) {
    if (fighter.state === 'KO') continue;
    const t = transformComponents.get(fid);
    if (!t) continue;
    if (Math.abs((t.x - item.x) | 0) <= HIT_RANGE &&
        Math.abs((t.y - item.y) | 0) <= HIT_RANGE) {
      // Freeze for 3 s = 180 frames
      fighter.hitstunFrames = Math.max(fighter.hitstunFrames, 180);
      return true;
    }
  }
  return false;
}

// ── thunderBolt: initial hit + shock pulses ───────────────────────────────────

function checkThunderBoltHit(item: ItemEntity): boolean {
  const HIT_RANGE = 30 * 65536;
  for (const [fid, fighter] of fighterComponents) {
    if (fighter.state === 'KO') continue;
    const t = transformComponents.get(fid);
    if (!t) continue;
    if (Math.abs((t.x - item.x) | 0) <= HIT_RANGE &&
        Math.abs((t.y - item.y) | 0) <= HIT_RANGE) {
      // Initial hit: 15% damage
      fighter.damagePercent = fixedAdd(fighter.damagePercent, toFixed(15));
      return true;
    }
  }
  return false;
}

function applyThunderPulse(item: ItemEntity): void {
  const PULSE_RANGE = 50 * 65536;
  for (const [fid, fighter] of fighterComponents) {
    if (fighter.state === 'KO') continue;
    const t = transformComponents.get(fid);
    if (!t) continue;
    if (Math.abs((t.x - item.x) | 0) <= PULSE_RANGE &&
        Math.abs((t.y - item.y) | 0) <= PULSE_RANGE) {
      fighter.damagePercent = fixedAdd(fighter.damagePercent, toFixed(8));
      fighter.hitstunFrames = Math.max(fighter.hitstunFrames, 30);
    }
  }
}

/** Apply healing charm or orb pick-up if a fighter is close enough. */
function checkFighterPickup(
  item: ItemEntity,
  idx: number,
  _currentFrame: number,
): void {
  // Newly-thrown items are guarded by throwArmFrames to prevent the thrower
  // from immediately re-picking up their own projectile.
  if (item.throwArmFrames > 0) return;

  for (const [fid, fighter] of fighterComponents) {
    if (fighter.state === 'KO') continue;
    const t = transformComponents.get(fid);
    if (!t) continue;

    const dx = (t.x - item.x) | 0;
    const dy = (t.y - item.y) | 0;
    // Integer distance check (avoid sqrt). 60 world-units ≈ 2 character widths.
    if (Math.abs(dx) > 60 * 65536 || Math.abs(dy) > 60 * 65536) continue;

    switch (item.itemType) {
      case 'aetherCrystal':
        // Auto-activate: reduce damage by 30%, floor 0
        fighter.damagePercent = Math.max(0, fighter.damagePercent - toFixed(30)) | 0;
        removeItem(idx);
        return;

      case 'energyRod':
      case 'heavyMallet':
      case 'emberCore':
      case 'runeshard':
      case 'speedBoots':
      case 'mirrorShard':
        // Picked up by fighter — attach
        item.heldBy = fid;
        return;

      case 'explosiveSphere':
      case 'boomerang':
      case 'nexusCapsule':
      case 'blastImp':
      case 'gyrostone':
      case 'gravityAnchor':
      case 'iceTag':
      case 'thunderBolt':
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

/** Return the item currently held by `entityId`, or null if none. */
export function getHeldItem(entityId: EntityId): ItemEntity | null {
  for (const item of activeItems) {
    if (item.heldBy === entityId) return item;
  }
  return null;
}

/**
 * Activate or throw the item held by `entityId`.
 *
 * - **Throwable** items (`explosiveSphere`, `boomerang`, etc.) are detached
 *   from the holder and launched in `facingRight` direction.
 * - **Melee augments** (`energyRod`, `heavyMallet`) deal bonus damage to the
 *   nearest opponent within range and are then removed.
 * - **Passive augments** held in hand (`emberCore`, `runeshard`, `speedBoots`)
 *   are not consumed by this call — they activate via `tickItems` already.
 *
 * Returns `true` if an item was activated (so the caller can skip normal
 * attack logic), `false` when the fighter holds nothing.
 */
export function useHeldItem(entityId: EntityId, facingRight: boolean): boolean {
  const item = getHeldItem(entityId);
  if (!item) return false;

  const tf = transformComponents.get(entityId);
  if (!tf) return false;

  const dir = facingRight ? 1 : -1;

  switch (item.itemType) {
    // ── Throwables ──────────────────────────────────────────────────────────
    case 'explosiveSphere':
      item.heldBy    = null;
      item.vx        = toFixed(3 * dir);
      item.vy        = toFixed(1);
      item.proxTrap  = true;
      item.proxArmFrames = 120;
      item.throwArmFrames = 30;
      break;

    case 'boomerang':
      item.heldBy = null;
      item.vx = toFixed(5 * dir);
      item.vy = toFixed(0);
      item.boomerangReturnFrame = 40;
      item.throwArmFrames = 30;
      break;

    case 'nexusCapsule':
      item.heldBy = null;
      item.vx = toFixed(4 * dir);
      item.vy = toFixed(1);
      item.throwArmFrames = 30;
      break;

    case 'blastImp':
      item.heldBy     = null;
      item.walkActive = true;
      item.walkFrames = BLAST_IMP_WALK_FRAMES;
      item.vx         = toFixed(0.8 * dir);
      item.throwArmFrames = 30;
      break;

    case 'gyrostone':
      item.heldBy       = null;
      item.deployed     = true;
      item.deployFrames = 60;
      item.vx           = toFixed(6 * dir);
      item.throwArmFrames = 30;
      break;

    case 'gravityAnchor':
      item.heldBy = null;
      item.vx = toFixed(4 * dir);
      item.vy = toFixed(1);
      item.throwArmFrames = 30;
      break;

    case 'iceTag':
      item.heldBy = null;
      item.vx = toFixed(5 * dir);
      item.vy = toFixed(0);
      item.throwArmFrames = 30;
      break;

    case 'thunderBolt':
      item.heldBy = null;
      item.vx = toFixed(4 * dir);
      item.vy = toFixed(0);
      item.throwArmFrames = 30;
      break;

    // ── Melee augments — swing at nearest opponent in range ─────────────────
    case 'energyRod': {
      const SWING_RANGE = 60 * 65536;
      const DAMAGE = toFixed(12);
      for (const [fid, fighter] of fighterComponents) {
        if (fid === entityId) continue;
        if (fighter.state === 'KO') continue;
        const t = transformComponents.get(fid);
        if (!t) continue;
        if (Math.abs((t.x - tf.x) | 0) <= SWING_RANGE &&
            Math.abs((t.y - tf.y) | 0) <= SWING_RANGE) {
          fighter.damagePercent = fixedAdd(fighter.damagePercent, DAMAGE);
          const phys = physicsComponents.get(fid);
          if (phys) {
            phys.vx = fixedAdd(phys.vx, toFixed(2 * dir));
            phys.vy = fixedAdd(phys.vy, toFixed(2));
            phys.grounded = false;
          }
        }
      }
      // Energy rod is consumed on use
      const idx = activeItems.indexOf(item);
      if (idx !== -1) removeItem(idx);
      break;
    }

    case 'heavyMallet': {
      const SWING_RANGE = 70 * 65536;
      const DAMAGE = toFixed(20);
      for (const [fid, fighter] of fighterComponents) {
        if (fid === entityId) continue;
        if (fighter.state === 'KO') continue;
        const t = transformComponents.get(fid);
        if (!t) continue;
        if (Math.abs((t.x - tf.x) | 0) <= SWING_RANGE &&
            Math.abs((t.y - tf.y) | 0) <= SWING_RANGE) {
          fighter.damagePercent = fixedAdd(fighter.damagePercent, DAMAGE);
          const phys = physicsComponents.get(fid);
          if (phys) {
            phys.vx = fixedAdd(phys.vx, toFixed(3 * dir));
            phys.vy = fixedAdd(phys.vy, toFixed(4));
            phys.grounded = false;
          }
        }
      }
      // Heavy mallet is consumed on use
      const idx = activeItems.indexOf(item);
      if (idx !== -1) removeItem(idx);
      break;
    }

    // Passive augments (emberCore, runeshard, speedBoots) activate via tickItems.
    // Don't block the attack action — return false so a normal attack fires too.
    default:
      return false;
  }
  return true;
}
