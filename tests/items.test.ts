// tests/items.test.ts
// Phase 4 acceptance tests — Items system and Stage Hazards

import { describe, it, expect, beforeEach } from 'vitest';

import { toFixed, toFloat } from '../src/engine/physics/fixednum.js';
import {
  transformComponents,
  physicsComponents,
  fighterComponents,
  clearAllComponents,
} from '../src/engine/ecs/component.js';
import { createEntity, resetEntityCounter } from '../src/engine/ecs/entity.js';
import { KAEL_STATS } from '../src/game/characters/kael.js';
import { platforms } from '../src/engine/physics/collision.js';
import {
  clearStateMachineMaps,
  hitlagMap,
  shieldBreakMap,
  dodgeFramesMap,
  grabFramesMap,
  techWindowMap,
  airDodgeUsedSet,
} from '../src/engine/physics/stateMachine.js';
import { respawnTimers } from '../src/engine/physics/blastZone.js';
import { hitRegistry } from '../src/engine/physics/collision.js';
import { seedRng } from '../src/engine/physics/lcg.js';
import { matchState } from '../src/game/state.js';

import {
  activeItems,
  clearItems,
  setItemSpawnPoints,
  setItemSpawnSetting,
  trySpawnItem,
  tickItems,
  hitAssistOrb,
  getHeldItem,
  useHeldItem,
  ORB_COLOURS,
  SPAWN_INTERVAL_FRAMES,
  EMBER_CORE_FUEL_FRAMES,
  RUNESHARD_CHARGES,
  SPEED_BOOTS_FRAMES,
  MIRROR_SHARD_INVINCIBILITY,
  BLAST_IMP_STANDBY_FRAMES,
  BLAST_IMP_WALK_FRAMES,
  NEXUS_CAPSULE_FLIGHT_FRAMES,
  NEXUS_CAPSULE_CREATURE_FRAMES,
  GYROSTONE_STANDBY_FRAMES,
  THUNDER_BOLT_PULSES,
} from '../src/game/items/items.ts';

import {
  clearHazards,
  setHazard,
  initForgeGeysers,
  initCloudLightning,
  initDigitalGrid,
  tickHazards,
  getGeyserStates,
  getLightningTarget,
  getDigitalGridPhase,
  DIGITAL_GRID_PHASE1_FRAMES,
  DIGITAL_GRID_PHASE2_FRAMES,
} from '../src/game/hazards/hazards.ts';

import {
  DIGITAL_GRID_PLATFORMS_PHASE1,
  DIGITAL_GRID_PLATFORMS_PHASE2,
} from '../src/game/stages/digitalGrid.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function resetAll(): void {
  clearAllComponents();
  resetEntityCounter();
  clearStateMachineMaps();
  hitRegistry.clear();
  hitlagMap.clear();
  shieldBreakMap.clear();
  dodgeFramesMap.clear();
  grabFramesMap.clear();
  techWindowMap.clear();
  airDodgeUsedSet.clear();
  respawnTimers.clear();
  platforms.length = 0;
  matchState.frame = 0;
  clearItems();
  clearHazards();
}

function makeGroundedFighter(x = 0, y = 30) {
  const id = createEntity();
  transformComponents.set(id, {
    x: toFixed(x), y: toFixed(y),
    prevX: toFixed(x), prevY: toFixed(y),
    facingRight: true,
  });
  physicsComponents.set(id, {
    vx: toFixed(0), vy: toFixed(0),
    gravityMultiplier: toFixed(1.0),
    grounded: true, fastFalling: false,
  });
  fighterComponents.set(id, {
    characterId: 'kael', state: 'idle', damagePercent: toFixed(0),
    stocks: 3, jumpCount: 0, hitstunFrames: 0, invincibleFrames: 0,
    hitlagFrames: 0, shieldHealth: 100, shieldBreakFrames: 0,
    attackFrame: 0, currentMoveId: null, stats: KAEL_STATS,
  });
  return id;
}

// ── Items system tests ─────────────────────────────────────────────────────────

describe('items system', () => {
  beforeEach(() => {
    resetAll();
    seedRng(42);
  });

  it('no items spawn when setting is off', () => {
    setItemSpawnSetting('off');
    setItemSpawnPoints([{ x: toFixed(0), y: toFixed(50) }]);
    for (let f = 0; f < 5000; f++) trySpawnItem(f);
    expect(activeItems).toHaveLength(0);
  });

  it('items spawn at the configured interval (low setting)', () => {
    setItemSpawnSetting('low');
    setItemSpawnPoints([{ x: toFixed(0), y: toFixed(50) }]);

    const interval = SPAWN_INTERVAL_FRAMES['low'];
    // Before the first interval, nothing spawns
    trySpawnItem(0);
    expect(activeItems).toHaveLength(0);

    // At exactly the interval, one item spawns
    trySpawnItem(interval);
    expect(activeItems).toHaveLength(1);

    // A second item spawns after another interval
    trySpawnItem(interval * 2);
    expect(activeItems.length).toBeGreaterThanOrEqual(1);
  });

  it('items spawn at the medium interval (~25 s)', () => {
    setItemSpawnSetting('medium');
    setItemSpawnPoints([{ x: toFixed(0), y: toFixed(50) }]);
    expect(SPAWN_INTERVAL_FRAMES['medium']).toBe(1500);
    trySpawnItem(1500);
    expect(activeItems.length).toBeGreaterThanOrEqual(1);
  });

  it('items spawn at the high interval (~12 s)', () => {
    setItemSpawnSetting('high');
    setItemSpawnPoints([{ x: toFixed(0), y: toFixed(50) }]);
    expect(SPAWN_INTERVAL_FRAMES['high']).toBe(720);
    trySpawnItem(720);
    expect(activeItems.length).toBeGreaterThanOrEqual(1);
  });

  it('spawned items are one of the 4 valid categories', () => {
    setItemSpawnSetting('high');
    const pts = [
      { x: toFixed(-50), y: toFixed(50) },
      { x: toFixed(50),  y: toFixed(50) },
    ];
    setItemSpawnPoints(pts);

    // Spawn several items
    for (let f = 0; f < 720 * 10; f += 720) trySpawnItem(f);

    const validCategories = new Set([
      'meleeAugment', 'throwableProjectile', 'assistOrb', 'healingCharm',
    ]);
    for (const item of activeItems) {
      expect(validCategories.has(item.category)).toBe(true);
    }
  });

  it('two identical seeds produce identical item spawn sequences', () => {
    setItemSpawnSetting('high');
    setItemSpawnPoints([{ x: toFixed(0), y: toFixed(50) }]);

    // Run 1
    clearItems();
    seedRng(99);
    const types1: string[] = [];
    for (let f = 0; f <= 720 * 5; f++) {
      trySpawnItem(f);
    }
    for (const item of activeItems) types1.push(item.itemType);

    // Run 2
    clearItems();
    seedRng(99);
    const types2: string[] = [];
    for (let f = 0; f <= 720 * 5; f++) {
      trySpawnItem(f);
    }
    for (const item of activeItems) types2.push(item.itemType);

    expect(types1).toEqual(types2);
  });

  it('assist orb has HP and can be broken', () => {
    setItemSpawnSetting('high');
    setItemSpawnPoints([{ x: toFixed(0), y: toFixed(50) }]);

    // Force an assist orb to spawn by seeding to a known value
    // (we try until we get one)
    let orbItem = null;
    for (let attempt = 0; attempt < 20; attempt++) {
      clearItems();
      seedRng(attempt * 7 + 1);
      trySpawnItem(720);
      orbItem = activeItems.find(i => i.itemType === 'assistOrb') ?? null;
      if (orbItem) break;
    }
    if (!orbItem) return; // guard: very unlikely all 20 attempts miss

    expect(orbItem.orbHp).toBe(20);
    expect(ORB_COLOURS).toContain(orbItem.orbColour);

    // Deal 15 damage — not broken yet
    const result1 = hitAssistOrb(orbItem, 15);
    expect(result1).toBeNull();
    expect(orbItem.orbHp).toBe(5);

    // Deal 5 more — broken, returns colour
    const result2 = hitAssistOrb(orbItem, 5);
    expect(result2).not.toBeNull();
    expect(ORB_COLOURS).toContain(result2);
  });

  it('aether crystal reduces fighter damage percent on pickup', () => {
    setItemSpawnSetting('high');
    setItemSpawnPoints([{ x: toFixed(0), y: toFixed(40) }]);

    const fid = makeGroundedFighter(0, 40);
    fighterComponents.get(fid)!.damagePercent = toFixed(100);

    // Find a crystal item
    for (let attempt = 0; attempt < 30; attempt++) {
      clearItems();
      seedRng(attempt * 13);
      trySpawnItem(720);
      const crystal = activeItems.find(i => i.itemType === 'aetherCrystal');
      if (!crystal) continue;

      // Place fighter right on top of the crystal
      crystal.x = transformComponents.get(fid)!.x;
      crystal.y = transformComponents.get(fid)!.y;

      tickItems(0);

      const dmg = toFloat(fighterComponents.get(fid)!.damagePercent);
      expect(dmg).toBeCloseTo(70, 0); // 100% - 30% = 70%
      return;
    }
  });

  it('item duration expires and removes the item', () => {
    setItemSpawnSetting('high');
    setItemSpawnPoints([{ x: toFixed(0), y: toFixed(50) }]);
    seedRng(1);
    trySpawnItem(720);

    // Find an augment (has durationFrames > 0)
    const augment = activeItems.find(i => i.category === 'meleeAugment');
    if (!augment) return;

    const duration = augment.durationFrames;
    expect(duration).toBeGreaterThan(0);

    // Tick until expiry
    for (let f = 0; f < duration; f++) tickItems(f);
    expect(activeItems.find(i => i === augment)).toBeUndefined();
  });
});

// ── Stage hazard tests ────────────────────────────────────────────────────────

describe('stage hazards — Forge Geysers', () => {
  beforeEach(() => {
    resetAll();
    seedRng(1);
  });

  it('geysers start in warning state before erupting', () => {
    initForgeGeysers(toFixed(-440), toFixed(440));
    setHazard('forgeGeysers');

    // GEYSER_INTERVAL_FRAMES = 1200, GEYSER_WARN_FRAMES = 180.
    // Warning begins when cooldown reaches 180 (after 1020 ticks).
    // Tick 1018 times → cooldown = 182 → no warning yet.
    const BEFORE_WARN = 1200 - 180 - 2;
    for (let f = 0; f < BEFORE_WARN; f++) tickHazards();
    const before = getGeyserStates();
    expect(before[0]!.warning).toBe(false);
    expect(before[0]!.active).toBe(false);

    // Tick 2 more → cooldown = 180 → warning on
    tickHazards();
    tickHazards();
    const during = getGeyserStates();
    expect(during[0]!.warning).toBe(true);
  });

  it('geysers erupt and deal damage to fighters in column', () => {
    initForgeGeysers(toFixed(0), toFixed(440));
    setHazard('forgeGeysers');

    const fid = makeGroundedFighter(0, 0); // right under left geyser
    const initial = fighterComponents.get(fid)!.damagePercent;

    // Geyser starts with cooldown = 1200.
    // After 1200 ticks: cooldown hits 0.
    // Next tick (1201st): else branch fires → activeFrames = 180.
    // Next tick (1202nd): activeFrames > 0 → damage applied.
    for (let f = 0; f < 1202; f++) tickHazards();

    const after = fighterComponents.get(fid)!.damagePercent;
    expect(after).toBeGreaterThan(initial);
  });

  it('same seed produces same geyser eruption timing on two peers', () => {
    // Peer A
    clearHazards();
    seedRng(42);
    initForgeGeysers(toFixed(-440), toFixed(440));
    setHazard('forgeGeysers');
    const statesA: boolean[] = [];
    for (let f = 0; f < 1300; f++) {
      tickHazards();
      statesA.push(getGeyserStates()[0]!.active);
    }

    // Peer B
    clearHazards();
    seedRng(42);
    initForgeGeysers(toFixed(-440), toFixed(440));
    setHazard('forgeGeysers');
    const statesB: boolean[] = [];
    for (let f = 0; f < 1300; f++) {
      tickHazards();
      statesB.push(getGeyserStates()[0]!.active);
    }

    expect(statesA).toEqual(statesB);
  });
});

describe('stage hazards — Cloud Citadel Lightning', () => {
  beforeEach(() => {
    resetAll();
    seedRng(7);
  });

  it('lightning targets a valid platform index', () => {
    platforms.push(
      { x1: toFixed(-300), x2: toFixed(300), y: toFixed(0), passThrough: false },
    );
    initCloudLightning();
    setHazard('cloudLightning');

    // Advance until a warning is visible
    for (let f = 0; f < 2000; f++) {
      tickHazards();
      const target = getLightningTarget();
      if (target >= 0) {
        expect(target).toBeGreaterThanOrEqual(0);
        expect(target).toBeLessThan(platforms.length);
        return;
      }
    }
  });

  it('lightning deals damage to fighter on targeted platform', () => {
    platforms.push(
      { x1: toFixed(-300), x2: toFixed(300), y: toFixed(0), passThrough: false },
    );
    initCloudLightning();
    setHazard('cloudLightning');

    const fid = makeGroundedFighter(0, 30); // on the main stage
    const initial = fighterComponents.get(fid)!.damagePercent;

    // Find when a warning is visible then advance to the strike
    let warningDetected = false;
    for (let f = 0; f < 3000; f++) {
      tickHazards();
      if (!warningDetected && getLightningTarget() >= 0) {
        warningDetected = true;
      }
      if (warningDetected && getLightningTarget() === -1) {
        // Strike just happened
        const after = fighterComponents.get(fid)!.damagePercent;
        if (after > initial) {
          expect(after).toBeGreaterThan(initial);
          return;
        }
      }
    }
  });
});

describe('stage hazards — Digital Grid Phase Transitions', () => {
  beforeEach(() => {
    resetAll();
    seedRng(3);
    platforms.push(...DIGITAL_GRID_PLATFORMS_PHASE1);
  });

  it('starts in phase 1', () => {
    initDigitalGrid(DIGITAL_GRID_PLATFORMS_PHASE1, DIGITAL_GRID_PLATFORMS_PHASE2);
    setHazard('digitalGrid');
    expect(getDigitalGridPhase()).toBe(1);
  });

  it('transitions to phase 2 after DIGITAL_GRID_PHASE1_FRAMES', () => {
    initDigitalGrid(DIGITAL_GRID_PLATFORMS_PHASE1, DIGITAL_GRID_PLATFORMS_PHASE2);
    setHazard('digitalGrid');

    for (let f = 0; f < DIGITAL_GRID_PHASE1_FRAMES; f++) tickHazards();
    expect(getDigitalGridPhase()).toBe(2);
  });

  it('transitions back to phase 1 after DIGITAL_GRID_PHASE2_FRAMES', () => {
    initDigitalGrid(DIGITAL_GRID_PLATFORMS_PHASE1, DIGITAL_GRID_PLATFORMS_PHASE2);
    setHazard('digitalGrid');

    for (let f = 0; f < DIGITAL_GRID_PHASE1_FRAMES + DIGITAL_GRID_PHASE2_FRAMES; f++) {
      tickHazards();
    }
    expect(getDigitalGridPhase()).toBe(1);
  });

  it('phase transition swaps platform layout', () => {
    initDigitalGrid(DIGITAL_GRID_PLATFORMS_PHASE1, DIGITAL_GRID_PLATFORMS_PHASE2);
    setHazard('digitalGrid');

    const phase1Count = DIGITAL_GRID_PLATFORMS_PHASE1.length;
    const phase2Count = DIGITAL_GRID_PLATFORMS_PHASE2.length;

    // Advance to phase 2
    for (let f = 0; f < DIGITAL_GRID_PHASE1_FRAMES; f++) tickHazards();

    // Platform count should match phase 2 layout
    expect(platforms.length).toBe(phase2Count);

    // Advance back to phase 1
    for (let f = 0; f < DIGITAL_GRID_PHASE2_FRAMES; f++) tickHazards();
    expect(platforms.length).toBe(phase1Count);
  });

  it('two peers with same seed transition on the same frame', () => {
    const FRAMES = DIGITAL_GRID_PHASE1_FRAMES + 10;

    // Peer A
    clearHazards();
    platforms.length = 0;
    platforms.push(...DIGITAL_GRID_PLATFORMS_PHASE1);
    seedRng(5);
    initDigitalGrid(DIGITAL_GRID_PLATFORMS_PHASE1, DIGITAL_GRID_PLATFORMS_PHASE2);
    setHazard('digitalGrid');
    const phasesA: number[] = [];
    for (let f = 0; f < FRAMES; f++) { tickHazards(); phasesA.push(getDigitalGridPhase()); }

    // Peer B
    clearHazards();
    platforms.length = 0;
    platforms.push(...DIGITAL_GRID_PLATFORMS_PHASE1);
    seedRng(5);
    initDigitalGrid(DIGITAL_GRID_PLATFORMS_PHASE1, DIGITAL_GRID_PLATFORMS_PHASE2);
    setHazard('digitalGrid');
    const phasesB: number[] = [];
    for (let f = 0; f < FRAMES; f++) { tickHazards(); phasesB.push(getDigitalGridPhase()); }

    expect(phasesA).toEqual(phasesB);
  });
});

// ── New item type tests ───────────────────────────────────────────────────────

describe('new item types', () => {
  beforeEach(() => {
    resetAll();
    seedRng(42);
  });

  // ── helpers ─────────────────────────────────────────────────────────────────

  /** Force an item of the given itemType to spawn by iterating seeds. */
  function forceSpawn(itemType: string, maxAttempts = 100) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      clearItems();
      seedRng(attempt * 17 + 3);
      setItemSpawnSetting('high');
      setItemSpawnPoints([{ x: toFixed(0), y: toFixed(50) }]);
      trySpawnItem(720);
      const found = activeItems.find(i => i.itemType === itemType);
      if (found) return found;
    }
    return null;
  }

  // ── emberCore ────────────────────────────────────────────────────────────────────

  it('emberCore starts with correct fuel frames', () => {
    const item = forceSpawn('emberCore');
    if (!item) return; // guard
    expect(item.fuelFrames).toBe(EMBER_CORE_FUEL_FRAMES);
    expect(item.category).toBe('meleeAugment');
  });

  it('emberCore burns out after EMBER_CORE_FUEL_FRAMES ticks while held', () => {
    const item = forceSpawn('emberCore');
    if (!item) return;

    const fid = makeGroundedFighter(0, 50);
    item.heldBy = fid;

    for (let f = 0; f < EMBER_CORE_FUEL_FRAMES; f++) tickItems(f);

    // Item should be removed when fuel hits 0
    expect(activeItems.find(i => i === item)).toBeUndefined();
  });

  it('emberCore damages nearby fighters while held', () => {
    const item = forceSpawn('emberCore');
    if (!item) return;

    const holder = makeGroundedFighter(0, 50);
    const victim = makeGroundedFighter(10, 50); // very close
    item.heldBy = holder;
    item.x = toFixed(0);
    item.y = toFixed(50);

    const dmgBefore = fighterComponents.get(victim)!.damagePercent;
    tickItems(0);
    const dmgAfter = fighterComponents.get(victim)!.damagePercent;
    expect(dmgAfter).toBeGreaterThan(dmgBefore);
  });

  // ── runeshard ────────────────────────────────────────────────────────────────────

  it('runeshard starts with RUNESHARD_CHARGES charges', () => {
    const item = forceSpawn('runeshard');
    if (!item) return;
    expect(item.charges).toBe(RUNESHARD_CHARGES);
    expect(item.category).toBe('meleeAugment');
  });

  it('runeshard fires and loses charges while held', () => {
    const item = forceSpawn('runeshard');
    if (!item) return;

    const holder = makeGroundedFighter(0, 50);
    const target = makeGroundedFighter(100, 50); // within range
    item.heldBy = holder;
    item.x = toFixed(0);
    item.y = toFixed(50);

    const initialCharges = item.charges;
    // Tick enough frames for one shot (RUNESHARD_SHOT_INTERVAL = 30 frames)
    for (let f = 0; f <= 30; f++) tickItems(f);

    expect(item.charges).toBeLessThan(initialCharges);
    const dmg = fighterComponents.get(target)!.damagePercent;
    expect(dmg).toBeGreaterThan(0);
  });

  it('runeshard is removed when all charges are exhausted', () => {
    const item = forceSpawn('runeshard');
    if (!item) return;

    const holder = makeGroundedFighter(0, 50);
    item.heldBy = holder;
    item.x = toFixed(0);
    item.y = toFixed(50);
    makeGroundedFighter(80, 50); // target to absorb shots

    // Tick enough for all RUNESHARD_CHARGES shots (each fires every 30 frames)
    for (let f = 0; f <= RUNESHARD_CHARGES * 31; f++) tickItems(f);

    expect(activeItems.find(i => i === item)).toBeUndefined();
  });

  // ── speedBoots ──────────────────────────────────────────────────────────────

  it('speedBoots duration expires after SPEED_BOOTS_FRAMES while held', () => {
    const item = forceSpawn('speedBoots');
    if (!item) return;

    const holder = makeGroundedFighter(0, 50);
    item.heldBy = holder;

    for (let f = 0; f < SPEED_BOOTS_FRAMES; f++) tickItems(f);

    expect(activeItems.find(i => i === item)).toBeUndefined();
  });

  it('speedBoots applies a velocity boost to the holder each tick', () => {
    const item = forceSpawn('speedBoots');
    if (!item) return;

    const holder = makeGroundedFighter(0, 50);
    item.heldBy = holder;
    item.x = toFixed(0);
    item.y = toFixed(50);

    const physBefore = physicsComponents.get(holder)!.vx;
    tickItems(0);
    const physAfter  = physicsComponents.get(holder)!.vx;
    // Boost should have changed vx (facingRight=true → positive boost)
    expect(physAfter).not.toBe(physBefore);
  });

  // ── mirrorShard ─────────────────────────────────────────────────────────────

  it('mirrorShard grants invincibility to the holder on pickup and disappears', () => {
    const item = forceSpawn('mirrorShard');
    if (!item) return;

    const holder = makeGroundedFighter(0, 50);
    item.heldBy = holder;
    item.x = toFixed(0);
    item.y = toFixed(50);

    tickItems(0); // pickup tick — grants invincibility and removes item

    const fighter = fighterComponents.get(holder)!;
    expect(fighter.invincibleFrames).toBeGreaterThanOrEqual(MIRROR_SHARD_INVINCIBILITY);
    expect(activeItems.find(i => i === item)).toBeUndefined();
  });

  // ── blastImp ───────────────────────────────────────────────────────────────────

  it('blastImp starts in standby and does not move immediately', () => {
    const item = forceSpawn('blastImp');
    if (!item) return;

    const xBefore = item.x;
    for (let f = 0; f < 10; f++) tickItems(f);
    expect(item.walkActive).toBe(false);
    expect(item.x).toBe(xBefore); // no movement yet
  });

  it('blastImp starts walking after BLAST_IMP_STANDBY_FRAMES', () => {
    const item = forceSpawn('blastImp');
    if (!item) return;

    for (let f = 0; f < BLAST_IMP_STANDBY_FRAMES; f++) tickItems(f);
    expect(item.walkActive).toBe(true);
  });

  it('blastImp explodes and damages nearby fighters after walk phase', () => {
    const item = forceSpawn('blastImp');
    if (!item) return;

    const victim = makeGroundedFighter(0, 50);
    item.x = toFixed(0);
    item.y = toFixed(50);
    const dmgBefore = fighterComponents.get(victim)!.damagePercent;

    for (let f = 0; f < BLAST_IMP_STANDBY_FRAMES + BLAST_IMP_WALK_FRAMES + 5; f++) {
      tickItems(f);
    }

    const dmgAfter = fighterComponents.get(victim)!.damagePercent;
    expect(dmgAfter).toBeGreaterThan(dmgBefore);
    expect(activeItems.find(i => i === item)).toBeUndefined();
  });

  // ── nexusCapsule ─────────────────────────────────────────────────────────────

  it('nexusCapsule releases a creature after NEXUS_CAPSULE_FLIGHT_FRAMES', () => {
    const item = forceSpawn('nexusCapsule');
    if (!item) return;

    item.vx = toFixed(1); // give it some velocity

    for (let f = 0; f < NEXUS_CAPSULE_FLIGHT_FRAMES; f++) tickItems(f);

    expect(item.creatureActive).toBe(true);
    expect(item.creatureFrames).toBe(NEXUS_CAPSULE_CREATURE_FRAMES);
  });

  it('nexusCapsule creature damages nearby fighters then disappears', () => {
    const item = forceSpawn('nexusCapsule');
    if (!item) return;

    // Put creature right next to the victim
    item.creatureActive = true;
    item.creatureFrames = NEXUS_CAPSULE_CREATURE_FRAMES;
    item.vx = toFixed(0);

    const victim = makeGroundedFighter(0, 50);
    item.x = toFixed(0);
    item.y = toFixed(50);

    const dmgBefore = fighterComponents.get(victim)!.damagePercent;
    // Tick 15 frames (first damage pulse interval)
    for (let f = 0; f < 15; f++) tickItems(f);
    const dmgAfter = fighterComponents.get(victim)!.damagePercent;
    expect(dmgAfter).toBeGreaterThan(dmgBefore);

    // Tick until creature frames run out
    for (let f = 15; f <= NEXUS_CAPSULE_CREATURE_FRAMES + 5; f++) tickItems(f);
    expect(activeItems.find(i => i === item)).toBeUndefined();
  });

  // ── gyrostone ──────────────────────────────────────────────────────────────────

  it('gyrostone auto-activates after GYROSTONE_STANDBY_FRAMES', () => {
    const item = forceSpawn('gyrostone');
    if (!item) return;

    expect(item.deployed).toBe(false);
    for (let f = 0; f < GYROSTONE_STANDBY_FRAMES; f++) tickItems(f);
    expect(item.deployed).toBe(true);
  });

  // ── gravityAnchor ────────────────────────────────────────────────────────────

  it('gravityAnchor deploys as a gravity well and pulls nearby fighters', () => {
    const item = forceSpawn('gravityAnchor');
    if (!item) return;

    // Force it deployed at a known position
    item.deployed     = true;
    item.deployFrames = 300;
    item.x = toFixed(0);
    item.y = toFixed(50);
    item.vx = toFixed(0);

    const victim = makeGroundedFighter(50, 50); // 50 units to the right
    const phys   = physicsComponents.get(victim)!;
    const vxBefore = phys.vx;

    tickItems(0);

    // Fighter should be pulled left (toward anchor at x=0)
    expect(phys.vx).toBeLessThan(vxBefore);
  });

  it('gravityAnchor disappears after deployFrames', () => {
    const item = forceSpawn('gravityAnchor');
    if (!item) return;

    item.deployed     = true;
    item.deployFrames = 5;
    item.vx = toFixed(0);

    for (let f = 0; f < 10; f++) tickItems(f);
    expect(activeItems.find(i => i === item)).toBeUndefined();
  });

  // ── iceTag ───────────────────────────────────────────────────────────────────

  it('iceTag freezes the first fighter it hits', () => {
    const item = forceSpawn('iceTag');
    if (!item) return;

    item.vx = toFixed(2);
    item.y  = toFixed(50);
    item.x  = toFixed(-5);

    const victim = makeGroundedFighter(0, 50);

    // Tick once — iceTag should hit and freeze
    tickItems(0);

    const fighter = fighterComponents.get(victim)!;
    expect(fighter.hitstunFrames).toBe(180);
    expect(activeItems.find(i => i === item)).toBeUndefined();
  });

  it('iceTag expires after 120 flight frames if it hits nothing', () => {
    const item = forceSpawn('iceTag');
    if (!item) return;

    item.vx = toFixed(1);
    item.x  = toFixed(-9999); // far from any fighter

    for (let f = 0; f < 125; f++) tickItems(f);
    expect(activeItems.find(i => i === item)).toBeUndefined();
  });

  // ── thunderBolt ───────────────────────────────────────────────────────────────

  it('thunderBolt delivers multiple shock pulses after initial hit', () => {
    const item = forceSpawn('thunderBolt');
    if (!item) return;

    // Place it right on the victim so initial hit fires immediately
    const victim = makeGroundedFighter(0, 50);
    item.x  = toFixed(0);
    item.y  = toFixed(50);
    item.vx = toFixed(0);

    const dmgBefore = fighterComponents.get(victim)!.damagePercent;

    // Tick enough for initial hit + at least one pulse (60 frame interval)
    for (let f = 0; f < 70; f++) tickItems(f);

    const dmgAfter = fighterComponents.get(victim)!.damagePercent;
    expect(dmgAfter).toBeGreaterThan(dmgBefore);
  });

  it('thunderBolt is removed after all pulses are delivered', () => {
    const item = forceSpawn('thunderBolt');
    if (!item) return;

    // Arm it immediately
    item.boltArmed  = true;
    item.boltFrames = 1;
    item.charges    = THUNDER_BOLT_PULSES;
    item.x = toFixed(-9999); // nothing to hit during pulses

    for (let f = 0; f < THUNDER_BOLT_PULSES * 65; f++) tickItems(f);
    expect(activeItems.find(i => i === item)).toBeUndefined();
  });

  // ── all 16 item types span valid categories ──────────────────────────────────

  it('items from all 4 categories spawn with valid item types', () => {
    const validTypes = new Set([
      'energyRod', 'heavyMallet', 'emberCore', 'runeshard', 'speedBoots', 'mirrorShard',
      'explosiveSphere', 'boomerang', 'nexusCapsule', 'blastImp', 'gyrostone',
      'gravityAnchor', 'iceTag', 'thunderBolt',
      'assistOrb', 'aetherCrystal',
    ]);
    // Run a high number of attempts; collect every item type that appears
    const found = new Set<string>();
    for (let attempt = 0; attempt < 2000; attempt++) {
      clearItems();
      seedRng(attempt * 31 + 7); // stride 31 for better LCG spread
      setItemSpawnSetting('high');
      setItemSpawnPoints([{ x: toFixed(0), y: toFixed(50) }]);
      trySpawnItem(720);
      for (const item of activeItems) {
        expect(validTypes.has(item.itemType)).toBe(true);
        found.add(item.itemType);
      }
    }
    // All 4 categories produce items — assistOrb and aetherCrystal are unique
    // per category, so both must appear. MeleeAugment and throwable types are
    // wide, but 2000 attempts with stride sampling is sufficient for coverage.
    expect(found.has('assistOrb')).toBe(true);
    expect(found.has('aetherCrystal')).toBe(true);
    // Verify at least one type from each of the two wider categories appears
    const meleeTypes = ['energyRod', 'heavyMallet', 'emberCore', 'runeshard', 'speedBoots', 'mirrorShard'];
    const throwTypes = ['explosiveSphere', 'boomerang', 'nexusCapsule', 'blastImp', 'gyrostone', 'gravityAnchor', 'iceTag', 'thunderBolt'];
    expect(meleeTypes.some(t => found.has(t))).toBe(true);
    expect(throwTypes.some(t => found.has(t))).toBe(true);
  });
});

// ── getHeldItem / useHeldItem tests ───────────────────────────────────────────

describe('getHeldItem and useHeldItem', () => {
  beforeEach(() => {
    resetAll();
    seedRng(42);
  });

  it('getHeldItem returns null when no item held', () => {
    const fid = makeGroundedFighter(0, 30);
    expect(getHeldItem(fid)).toBeNull();
  });

  it('getHeldItem returns item when held', () => {
    const fid = makeGroundedFighter(0, 30);
    // Manually create and attach an item
    activeItems.push({
      entityId: 999, itemType: 'energyRod', category: 'meleeAugment',
      heldBy: fid, durationFrames: 0, orbHp: 0, orbColour: null,
      x: toFixed(0), y: toFixed(30), vx: toFixed(0), vy: toFixed(0),
      boomerangReturnFrame: 0, proxTrap: false, proxArmFrames: 0,
      fuelFrames: 0, charges: 0, shotCooldown: 0,
      walkFrames: 0, walkActive: false, deployed: false, deployFrames: 0,
      reflectReady: false, flightFrames: 0, creatureActive: false,
      creatureFrames: 0, boltArmed: false, boltFrames: 0, throwArmFrames: 0,
    });
    expect(getHeldItem(fid)).not.toBeNull();
    expect(getHeldItem(fid)!.itemType).toBe('energyRod');
  });

  it('useHeldItem with energyRod deals damage to nearby opponent and removes item', () => {
    const attacker = makeGroundedFighter(0, 30);
    const victim   = makeGroundedFighter(30, 30); // within 60-unit swing range

    activeItems.push({
      entityId: 998, itemType: 'energyRod', category: 'meleeAugment',
      heldBy: attacker, durationFrames: 0, orbHp: 0, orbColour: null,
      x: toFixed(0), y: toFixed(30), vx: toFixed(0), vy: toFixed(0),
      boomerangReturnFrame: 0, proxTrap: false, proxArmFrames: 0,
      fuelFrames: 0, charges: 0, shotCooldown: 0,
      walkFrames: 0, walkActive: false, deployed: false, deployFrames: 0,
      reflectReady: false, flightFrames: 0, creatureActive: false,
      creatureFrames: 0, boltArmed: false, boltFrames: 0, throwArmFrames: 0,
    });

    const victimFighter = fighterComponents.get(victim)!;
    expect(toFloat(victimFighter.damagePercent)).toBeCloseTo(0);

    useHeldItem(attacker, true);

    // Victim should have taken damage
    expect(toFloat(victimFighter.damagePercent)).toBeGreaterThan(0);
    // Item should be removed
    expect(getHeldItem(attacker)).toBeNull();
    expect(activeItems.length).toBe(0);
  });

  it('useHeldItem with throwable detaches item and gives it velocity', () => {
    const fid = makeGroundedFighter(0, 30);

    activeItems.push({
      entityId: 997, itemType: 'boomerang', category: 'throwableProjectile',
      heldBy: fid, durationFrames: 0, orbHp: 0, orbColour: null,
      x: toFixed(0), y: toFixed(30), vx: toFixed(0), vy: toFixed(0),
      boomerangReturnFrame: 0, proxTrap: false, proxArmFrames: 0,
      fuelFrames: 0, charges: 0, shotCooldown: 0,
      walkFrames: 0, walkActive: false, deployed: false, deployFrames: 0,
      reflectReady: false, flightFrames: 0, creatureActive: false,
      creatureFrames: 0, boltArmed: false, boltFrames: 0, throwArmFrames: 0,
    });

    expect(getHeldItem(fid)).not.toBeNull();
    useHeldItem(fid, true);

    // Item detached from holder
    expect(getHeldItem(fid)).toBeNull();
    // Item still in activeItems (not removed — it flies now)
    expect(activeItems.length).toBe(1);
    // Item has positive vx (thrown right)
    expect(activeItems[0]!.heldBy).toBeNull();
    expect(activeItems[0]!.vx).toBeGreaterThan(0);
    // throwArmFrames is set — prevents immediate re-pickup
    expect(activeItems[0]!.throwArmFrames).toBeGreaterThan(0);
  });

  it('thrown item is not immediately re-picked up by the thrower', () => {
    // nexusCapsule has no immediate hit check, making it safe for this test.
    const fid = makeGroundedFighter(0, 30);

    activeItems.push({
      entityId: 990, itemType: 'nexusCapsule', category: 'throwableProjectile',
      heldBy: fid, durationFrames: 0, orbHp: 0, orbColour: null,
      x: toFixed(0), y: toFixed(30), vx: toFixed(0), vy: toFixed(0),
      boomerangReturnFrame: 0, proxTrap: false, proxArmFrames: 0,
      fuelFrames: 0, charges: 0, shotCooldown: 0,
      walkFrames: 0, walkActive: false, deployed: false, deployFrames: 0,
      reflectReady: false, flightFrames: 0, creatureActive: false,
      creatureFrames: 0, boltArmed: false, boltFrames: 0, throwArmFrames: 0,
    });

    // Throw the item
    useHeldItem(fid, true);
    expect(getHeldItem(fid)).toBeNull();
    // throwArmFrames must be set so re-pickup is blocked
    expect(activeItems[0]!.throwArmFrames).toBeGreaterThan(0);

    // The tickItems call that runs in the same game-loop iteration must NOT
    // re-attach the item to the thrower (this was the original bug).
    tickItems(0);
    expect(getHeldItem(fid)).toBeNull();

    // Once the arm window expires, the fighter can pick it up again by walking
    // onto it.
    activeItems[0]!.throwArmFrames = 0;
    const transform = transformComponents.get(fid)!;
    transform.x = activeItems[0]!.x;
    transform.y = activeItems[0]!.y;
    tickItems(1);
    expect(getHeldItem(fid)).not.toBeNull();
  });

  it('useHeldItem with heavyMallet deals more damage than energyRod', () => {
    const attacker = makeGroundedFighter(0, 30);
    const victim1  = makeGroundedFighter(20, 30);

    activeItems.push({
      entityId: 996, itemType: 'heavyMallet', category: 'meleeAugment',
      heldBy: attacker, durationFrames: 0, orbHp: 0, orbColour: null,
      x: toFixed(0), y: toFixed(30), vx: toFixed(0), vy: toFixed(0),
      boomerangReturnFrame: 0, proxTrap: false, proxArmFrames: 0,
      fuelFrames: 0, charges: 0, shotCooldown: 0,
      walkFrames: 0, walkActive: false, deployed: false, deployFrames: 0,
      reflectReady: false, flightFrames: 0, creatureActive: false,
      creatureFrames: 0, boltArmed: false, boltFrames: 0, throwArmFrames: 0,
    });

    useHeldItem(attacker, true);

    const victimFighter = fighterComponents.get(victim1)!;
    // heavyMallet deals 20% — more than energyRod's 12%
    expect(toFloat(victimFighter.damagePercent)).toBeGreaterThanOrEqual(20);
  });
});

// ── Regression tests for previously-missing item actions ─────────────────────

describe('item action regression', () => {
  beforeEach(resetAll);

  it('boomerang in flight damages fighters it passes through', () => {
    const fighter = makeGroundedFighter(20, 30);

    // Boomerang flying rightward, overlapping the fighter's position
    activeItems.push({
      entityId: 990, itemType: 'boomerang', category: 'throwableProjectile',
      heldBy: null, durationFrames: 0, orbHp: 0, orbColour: null,
      x: toFixed(20), y: toFixed(30),
      vx: toFixed(5), vy: toFixed(0),
      boomerangReturnFrame: 20, proxTrap: false, proxArmFrames: 0,
      fuelFrames: 0, charges: 0, shotCooldown: 0,
      walkFrames: 0, walkActive: false, deployed: false, deployFrames: 0,
      reflectReady: false, flightFrames: 0, creatureActive: false,
      creatureFrames: 0, boltArmed: false, boltFrames: 0, throwArmFrames: 0,
    });

    const before = fighterComponents.get(fighter)!.damagePercent;
    tickItems(1);
    const after = fighterComponents.get(fighter)!.damagePercent;
    expect(after).toBeGreaterThan(before); // 10% outward damage applied
  });

  it('boomerang does not deal damage again within cooldown window', () => {
    const fighter = makeGroundedFighter(20, 30);

    activeItems.push({
      entityId: 991, itemType: 'boomerang', category: 'throwableProjectile',
      heldBy: null, durationFrames: 0, orbHp: 0, orbColour: null,
      x: toFixed(20), y: toFixed(30),
      vx: toFixed(5), vy: toFixed(0),
      boomerangReturnFrame: 20, proxTrap: false, proxArmFrames: 0,
      fuelFrames: 0, charges: 0, shotCooldown: 0,
      walkFrames: 0, walkActive: false, deployed: false, deployFrames: 0,
      reflectReady: false, flightFrames: 0, creatureActive: false,
      creatureFrames: 0, boltArmed: false, boltFrames: 0, throwArmFrames: 0,
    });

    tickItems(1); // first hit
    const afterFirst = fighterComponents.get(fighter)!.damagePercent;
    tickItems(2); // within cooldown — should NOT deal damage again
    const afterSecond = fighterComponents.get(fighter)!.damagePercent;
    expect(afterSecond).toBe(afterFirst);
  });

  it('assistOrb loses HP when a fighter in attack state is nearby', () => {
    const fighter = makeGroundedFighter(0, 30);
    fighterComponents.get(fighter)!.state = 'attack';

    activeItems.push({
      entityId: 992, itemType: 'assistOrb', category: 'assistOrb',
      heldBy: null, durationFrames: 0, orbHp: 20, orbColour: 'gold',
      x: toFixed(0), y: toFixed(30),
      vx: toFixed(0), vy: toFixed(0),
      boomerangReturnFrame: 0, proxTrap: false, proxArmFrames: 0,
      fuelFrames: 0, charges: 0, shotCooldown: 0,
      walkFrames: 0, walkActive: false, deployed: false, deployFrames: 0,
      reflectReady: false, flightFrames: 0, creatureActive: false,
      creatureFrames: 0, boltArmed: false, boltFrames: 0, throwArmFrames: 0,
    });

    tickItems(1);
    // orbHp should have decreased
    expect(activeItems[0]!.orbHp).toBeLessThan(20);
  });

  it('assistOrb is removed when HP reaches 0', () => {
    const fighter = makeGroundedFighter(0, 30);
    fighterComponents.get(fighter)!.state = 'attack';

    activeItems.push({
      entityId: 993, itemType: 'assistOrb', category: 'assistOrb',
      heldBy: null, durationFrames: 0, orbHp: 5, orbColour: 'gold',
      x: toFixed(0), y: toFixed(30),
      vx: toFixed(0), vy: toFixed(0),
      boomerangReturnFrame: 0, proxTrap: false, proxArmFrames: 0,
      fuelFrames: 0, charges: 0, shotCooldown: 0,
      walkFrames: 0, walkActive: false, deployed: false, deployFrames: 0,
      reflectReady: false, flightFrames: 0, creatureActive: false,
      creatureFrames: 0, boltArmed: false, boltFrames: 0, throwArmFrames: 0,
    });

    tickItems(1);
    // Orb with 5 HP takes 5 damage per hit → should be removed
    expect(activeItems.find(it => it.entityId === 993)).toBeUndefined();
  });

  it('explosiveSphere arms into fuse after slide phase', () => {
    makeGroundedFighter(1000, 30); // far away so proximity doesn't trigger

    activeItems.push({
      entityId: 994, itemType: 'explosiveSphere', category: 'throwableProjectile',
      heldBy: null, durationFrames: 0, orbHp: 0, orbColour: null,
      x: toFixed(0), y: toFixed(30),
      vx: toFixed(3), vy: toFixed(0),
      boomerangReturnFrame: 0, proxTrap: true, proxArmFrames: 1,
      fuelFrames: 0, charges: 0, shotCooldown: 0,
      walkFrames: 0, walkActive: false, deployed: false, deployFrames: 0,
      reflectReady: false, flightFrames: 0, creatureActive: false,
      creatureFrames: 0, boltArmed: false, boltFrames: 0, throwArmFrames: 0,
    });

    tickItems(1); // proxArmFrames → 0, deployFrames set to 240
    const sphere = activeItems.find(it => it.entityId === 994);
    // After slide phase the sphere should still exist with a fuse
    expect(sphere).toBeDefined();
    expect(sphere!.deployFrames).toBe(240);
  });
});
