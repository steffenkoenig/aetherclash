// tests/determinism.test.ts
// Phase 3 acceptance tests — Determinism Audit
//
// ✓ 600-frame replay with same inputs produces identical state hash
// ✓ changing one frame's input produces a different state hash

import { describe, it, expect, beforeEach } from 'vitest';

import { toFixed } from '../src/engine/physics/fixednum.js';
import {
  transformComponents,
  physicsComponents,
  fighterComponents,
  clearAllComponents,
} from '../src/engine/ecs/component.js';
import { createEntity, resetEntityCounter } from '../src/engine/ecs/entity.js';
import { KAEL_STATS, KAEL_MOVES }  from '../src/game/characters/kael.js';
import { GORUN_STATS, GORUN_MOVES } from '../src/game/characters/gorun.js';
import {
  platforms,
  platformCollisionSystem,
  hitRegistry,
} from '../src/engine/physics/collision.js';
import {
  setBlastZones,
  blastZoneSystem,
  respawnTimers,
} from '../src/engine/physics/blastZone.js';
import {
  clearStateMachineMaps,
  tickFighterTimers,
  hitlagMap,
  shieldBreakMap,
  dodgeFramesMap,
  grabFramesMap,
  techWindowMap,
  airDodgeUsedSet,
} from '../src/engine/physics/stateMachine.js';
import { applyGravitySystem } from '../src/engine/physics/gravity.js';
import { matchState } from '../src/game/state.js';
import { seedRng, setRngState } from '../src/engine/physics/lcg.js';
import { computeStateChecksum } from '../src/engine/net/rollback.js';
import {
  AETHER_PLATEAU_PLATFORMS,
  AETHER_PLATEAU_BLAST_ZONES,
} from '../src/game/stages/aetherPlateau.js';

// ── All move IDs used by both characters ──────────────────────────────────────

const ALL_MOVE_IDS = [
  ...Object.keys(KAEL_MOVES),
  ...Object.keys(GORUN_MOVES),
].sort();

// ── Reset helpers ─────────────────────────────────────────────────────────────

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
}

// ── Simulation setup ──────────────────────────────────────────────────────────

/**
 * Spawn two fighters in a deterministic starting configuration.
 * P1 (Kael) starts airborne — so gravity kicks in immediately, giving the
 * determinism test something non-trivial to hash.
 * P2 (Gorun) starts grounded.
 */
function setupFighters(): { p1: number; p2: number } {
  platforms.push(...AETHER_PLATEAU_PLATFORMS);
  setBlastZones(AETHER_PLATEAU_BLAST_ZONES);

  // P1: Kael — airborne, moving right
  const p1 = createEntity();
  transformComponents.set(p1, {
    x: toFixed(-100), y: toFixed(100),
    prevX: toFixed(-100), prevY: toFixed(100),
    facingRight: true,
  });
  physicsComponents.set(p1, {
    vx: toFixed(0.3), vy: toFixed(0),
    gravityMultiplier: toFixed(1.0),
    grounded: false, fastFalling: false,
  });
  fighterComponents.set(p1, {
    characterId: 'kael',
    state: 'jump',
    damagePercent: toFixed(0),
    stocks: 3,
    jumpCount: 1,
    hitstunFrames: 0,
    invincibleFrames: 0,
    hitlagFrames: 0,
    shieldHealth: 100,
    shieldBreakFrames: 0,
    attackFrame: 0,
    currentMoveId: null,
    stats: KAEL_STATS,
  });

  // P2: Gorun — grounded, standing still
  const p2 = createEntity();
  transformComponents.set(p2, {
    x: toFixed(80), y: toFixed(30),
    prevX: toFixed(80), prevY: toFixed(30),
    facingRight: false,
  });
  physicsComponents.set(p2, {
    vx: toFixed(0), vy: toFixed(0),
    gravityMultiplier: toFixed(1.0),
    grounded: true, fastFalling: false,
  });
  fighterComponents.set(p2, {
    characterId: 'gorun',
    state: 'idle',
    damagePercent: toFixed(0),
    stocks: 3,
    jumpCount: 0,
    hitstunFrames: 0,
    invincibleFrames: 0,
    hitlagFrames: 0,
    shieldHealth: 100,
    shieldBreakFrames: 0,
    attackFrame: 0,
    currentMoveId: null,
    stats: GORUN_STATS,
  });

  return { p1, p2 };
}

/**
 * Run `frames` physics steps.
 * Optional: at `divergeFrame`, inject a horizontal velocity on P2 (persistent
 * change — P2 keeps moving and ends up at a different position by the end).
 */
function runSimulation(
  fighters: { p1: number; p2: number },
  frames: number,
  divergeFrame?: number,
): void {
  for (let i = 0; i < frames; i++) {
    tickFighterTimers(fighters.p1);
    tickFighterTimers(fighters.p2);

    // Inject a persistent horizontal drift on P2 at the specified frame.
    // The velocity is never cleared by the physics systems for grounded entities,
    // so P2 ends up at a different X position from frame `divergeFrame` onward.
    if (divergeFrame !== undefined && matchState.frame === divergeFrame) {
      physicsComponents.get(fighters.p2)!.vx = toFixed(0.5);
    }

    applyGravitySystem();
    platformCollisionSystem();
    blastZoneSystem();

    // Integrate positions (simplified: add velocity to position)
    for (const [id, phys] of physicsComponents) {
      const t = transformComponents.get(id);
      if (!t) continue;
      t.prevX = t.x;
      t.prevY = t.y;
      t.x = (t.x + phys.vx) | 0;
      t.y = (t.y + phys.vy) | 0;
    }

    matchState.frame++;
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('determinism', () => {
  beforeEach(() => {
    resetAll();
  });

  it('600-frame replay with same inputs produces identical state hash', () => {
    // ── Run 1 ─────────────────────────────────────────────────────────────
    resetAll();
    seedRng(42);
    const fighters1 = setupFighters();
    runSimulation(fighters1, 600);
    const hash1 = computeStateChecksum(
      [fighters1.p1, fighters1.p2],
      ALL_MOVE_IDS,
    );

    // ── Run 2 (identical initial conditions) ──────────────────────────────
    resetAll();
    seedRng(42);
    const fighters2 = setupFighters();
    runSimulation(fighters2, 600);
    const hash2 = computeStateChecksum(
      [fighters2.p1, fighters2.p2],
      ALL_MOVE_IDS,
    );

    expect(hash1).toBe(hash2);
  });

  it('changing one frame input produces a different state hash', () => {
    // ── Baseline run — no extra input ─────────────────────────────────────
    resetAll();
    seedRng(42);
    const fightersA = setupFighters();
    runSimulation(fightersA, 120);
    const hashA = computeStateChecksum(
      [fightersA.p1, fightersA.p2],
      ALL_MOVE_IDS,
    );

    // ── Modified run — P2 drifts right from frame 60 (persistent change) ────
    resetAll();
    seedRng(42);
    const fightersB = setupFighters();
    runSimulation(fightersB, 120, 60 /* divergeFrame */);
    const hashB = computeStateChecksum(
      [fightersB.p1, fightersB.p2],
      ALL_MOVE_IDS,
    );

    expect(hashA).not.toBe(hashB);
  });
});

// ── encodeInput / decodeInput round-trip ──────────────────────────────────────

import {
  encodeInput,
  decodeInput,
  type InputState,
} from '../src/engine/input/keyboard.js';

describe('encodeInput/decodeInput', () => {
  const cases: Array<Partial<InputState>> = [
    // All buttons off, stick neutral
    {},
    // All buttons on, stick neutral
    { jump: true, attack: true, special: true, shield: true, grab: true },
    // Stick left + up
    { stickX: -1.0, stickY:  1.0 },
    // Stick right + down
    { stickX:  1.0, stickY: -1.0 },
    // C-Stick pushed
    { cStickX: 1.0, cStickY: 1.0 },
    // Mixed
    { jump: true, attack: false, stickX: 1.0, stickY: 0, shield: true },
  ];

  for (const partial of cases) {
    const input: InputState = {
      jump: false, attack: false, special: false, shield: false, grab: false,
      jumpJustPressed: false, attackJustPressed: false,
      specialJustPressed: false, grabJustPressed: false,
      stickX: 0, stickY: 0, cStickX: 0, cStickY: 0,
      ...partial,
    };

    it(`round-trip: ${JSON.stringify(partial)}`, () => {
      const packed  = encodeInput(input);
      const decoded = decodeInput(packed);

      // Digital buttons must be preserved exactly
      expect(decoded.jump).toBe(input.jump);
      expect(decoded.attack).toBe(input.attack);
      expect(decoded.special).toBe(input.special);
      expect(decoded.shield).toBe(input.shield);
      expect(decoded.grab).toBe(input.grab);

      // Stick is quantised to 3 values: -1 | 0 | 1
      expect(decoded.stickX).toBe(
        input.stickX < -0.5 ? -1.0 : input.stickX > 0.5 ? 1.0 : 0,
      );
      expect(decoded.stickY).toBe(
        input.stickY < -0.5 ? -1.0 : input.stickY > 0.5 ? 1.0 : 0,
      );

      // C-stick is boolean (pushed or not)
      expect(decoded.cStickX).toBe(input.cStickX !== 0 ? 1.0 : 0);
      expect(decoded.cStickY).toBe(input.cStickY !== 0 ? 1.0 : 0);

      // Edge-detection flags cannot round-trip (always false on decode)
      expect(decoded.jumpJustPressed).toBe(false);
      expect(decoded.attackJustPressed).toBe(false);
    });
  }

  it('packed value fits in 16 bits', () => {
    const input: InputState = {
      jump: true, attack: true, special: true, shield: true, grab: true,
      jumpJustPressed: true, attackJustPressed: true,
      specialJustPressed: true, grabJustPressed: true,
      stickX: 1.0, stickY: 1.0, cStickX: 1.0, cStickY: 1.0,
    };
    const packed = encodeInput(input);
    expect(packed).toBeGreaterThanOrEqual(0);
    expect(packed).toBeLessThanOrEqual(0xFFFF);
  });
});

// ── CRC32 checksum ────────────────────────────────────────────────────────────

import { crc32 } from '../src/engine/physics/crc32.js';

describe('crc32', () => {
  it('known vector: crc32 of empty array is 0x00000000', () => {
    expect(crc32(new Uint8Array(0))).toBe(0x00000000);
  });

  it('known vector: crc32([0x31..0x39]) === 0xCBF43926', () => {
    // "123456789"
    const data = new Uint8Array([0x31,0x32,0x33,0x34,0x35,0x36,0x37,0x38,0x39]);
    expect(crc32(data)).toBe(0xCBF43926);
  });

  it('different inputs produce different checksums', () => {
    resetAll();
    seedRng(42);
    const f1 = setupFighters();
    runSimulation(f1, 30);
    const csA = computeStateChecksum([f1.p1, f1.p2], ALL_MOVE_IDS);

    resetAll();
    seedRng(42);
    const f2 = setupFighters();
    runSimulation(f2, 30, 15 /* extraJumpFrame */);
    const csB = computeStateChecksum([f2.p1, f2.p2], ALL_MOVE_IDS);

    expect(csA).not.toBe(csB);
  });

  it('same inputs produce the same checksum (seeded RNG)', () => {
    resetAll();
    seedRng(99);
    setRngState(99);
    const f1 = setupFighters();
    runSimulation(f1, 60);
    const csA = computeStateChecksum([f1.p1, f1.p2], ALL_MOVE_IDS);

    resetAll();
    seedRng(99);
    setRngState(99);
    const f2 = setupFighters();
    runSimulation(f2, 60);
    const csB = computeStateChecksum([f2.p1, f2.p2], ALL_MOVE_IDS);

    expect(csA).toBe(csB);
  });
});
