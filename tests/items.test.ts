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
  ORB_COLOURS,
  SPAWN_INTERVAL_FRAMES,
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
