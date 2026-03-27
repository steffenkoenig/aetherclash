// tests/replay.test.ts
// Phase 4 acceptance tests — Replay System

import { describe, it, expect, beforeEach } from 'vitest';

import { toFixed } from '../src/engine/physics/fixednum.js';
import {
  transformComponents,
  physicsComponents,
  fighterComponents,
  clearAllComponents,
} from '../src/engine/ecs/component.js';
import { createEntity, resetEntityCounter } from '../src/engine/ecs/entity.js';
import { KAEL_STATS, KAEL_MOVES } from '../src/game/characters/kael.js';
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
import { seedRng } from '../src/engine/physics/lcg.js';
import { computeStateChecksum } from '../src/engine/net/rollback.js';
import {
  AETHER_PLATEAU_PLATFORMS,
  AETHER_PLATEAU_BLAST_ZONES,
} from '../src/game/stages/aetherPlateau.js';
import {
  ReplayRecorder,
  ReplayPlayer,
} from '../src/engine/replay/replay.ts';
import {
  encodeInput,
  type InputState,
} from '../src/engine/input/keyboard.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

const ALL_MOVE_IDS = [
  ...Object.keys(KAEL_MOVES),
  ...Object.keys(GORUN_MOVES),
].sort();

const NEUTRAL: InputState = {
  jump: false, attack: false, special: false, shield: false, grab: false,
  jumpJustPressed: false, attackJustPressed: false,
  specialJustPressed: false, grabJustPressed: false,
  stickX: 0, stickY: 0, cStickX: 0, cStickY: 0,
};

const PACKED_NEUTRAL = encodeInput(NEUTRAL);
const PACKED_RIGHT   = encodeInput({ ...NEUTRAL, stickX: 1.0 });

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

function setupFighters(): { p1: number; p2: number } {
  platforms.push(...AETHER_PLATEAU_PLATFORMS);
  setBlastZones(AETHER_PLATEAU_BLAST_ZONES);

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
    characterId: 'kael', state: 'jump', damagePercent: toFixed(0),
    stocks: 3, jumpCount: 1, hitstunFrames: 0, invincibleFrames: 0,
    hitlagFrames: 0, shieldHealth: 100, shieldBreakFrames: 0,
    attackFrame: 0, currentMoveId: null, stats: KAEL_STATS,
  });

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
    characterId: 'gorun', state: 'idle', damagePercent: toFixed(0),
    stocks: 3, jumpCount: 0, hitstunFrames: 0, invincibleFrames: 0,
    hitlagFrames: 0, shieldHealth: 100, shieldBreakFrames: 0,
    attackFrame: 0, currentMoveId: null, stats: GORUN_STATS,
  });

  return { p1, p2 };
}

function physicsStep(): void {
  const ids = [...physicsComponents.keys()];
  for (const id of ids) tickFighterTimers(id);
  applyGravitySystem();
  platformCollisionSystem();
  blastZoneSystem();
  for (const [id, phys] of physicsComponents) {
    const t = transformComponents.get(id);
    if (!t) continue;
    t.prevX = t.x; t.prevY = t.y;
    t.x = (t.x + phys.vx) | 0;
    t.y = (t.y + phys.vy) | 0;
  }
  matchState.frame++;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('replay: record and playback', () => {
  beforeEach(resetAll);

  it('recorder captures the correct number of frames', () => {
    const rec = new ReplayRecorder(2, 42);
    rec.start();
    for (let f = 0; f < 60; f++) {
      rec.recordFrame([PACKED_NEUTRAL, PACKED_NEUTRAL]);
    }
    rec.stop();
    expect(rec.frameCount).toBe(60);
  });

  it('recorded inputs are retrievable per frame', () => {
    const rec = new ReplayRecorder(2, 42);
    rec.start();
    rec.recordFrame([PACKED_NEUTRAL, PACKED_RIGHT]);
    rec.recordFrame([PACKED_RIGHT, PACKED_NEUTRAL]);
    rec.stop();

    expect(rec.getFrameInputs(0)).toEqual([PACKED_NEUTRAL, PACKED_RIGHT]);
    expect(rec.getFrameInputs(1)).toEqual([PACKED_RIGHT, PACKED_NEUTRAL]);
  });

  it('serialise/deserialise round-trips the input log', () => {
    const rec = new ReplayRecorder(2, 12345);
    rec.start();
    for (let f = 0; f < 30; f++) {
      rec.recordFrame([f % 3 === 0 ? PACKED_RIGHT : PACKED_NEUTRAL, PACKED_NEUTRAL]);
    }
    rec.stop();

    const bytes = rec.serialise();
    const player = ReplayPlayer.deserialise(bytes);

    expect(player.numFighters).toBe(2);
    expect(player.seed).toBe(12345);
    expect(player.frameCount).toBe(30);

    for (let f = 0; f < 30; f++) {
      expect(player.getFrameInputs(f)).toEqual(rec.getFrameInputs(f));
    }
  });

  it('base64url encode/decode round-trips the input log', () => {
    const rec = new ReplayRecorder(2, 99);
    rec.start();
    for (let f = 0; f < 20; f++) {
      rec.recordFrame([PACKED_RIGHT, PACKED_NEUTRAL]);
    }
    rec.stop();

    const hash   = rec.toUrlHash();
    const player = ReplayPlayer.fromUrlHash(hash);

    expect(player.seed).toBe(99);
    expect(player.frameCount).toBe(20);
    for (let f = 0; f < 20; f++) {
      expect(player.getFrameInputs(f)).toEqual([PACKED_RIGHT, PACKED_NEUTRAL]);
    }
  });

  it('replay reconstructs the match identically from the input log', () => {
    // ── Direct simulation (truth) ─────────────────────────────────────────
    resetAll();
    seedRng(42);
    const { p1: dp1, p2: dp2 } = setupFighters();

    const inputLog: Array<[number, number]> = [];
    for (let f = 0; f < 60; f++) {
      const inp0 = f % 5 === 0 ? PACKED_RIGHT : PACKED_NEUTRAL;
      const inp1 = f % 7 === 0 ? PACKED_RIGHT : PACKED_NEUTRAL;
      inputLog.push([inp0, inp1]);
      // Apply stick-X input to vx as a simple simulation of player movement
      physicsComponents.get(dp1)!.vx = inp0 === PACKED_RIGHT ? toFixed(0.5) : toFixed(0);
      physicsComponents.get(dp2)!.vx = inp1 === PACKED_RIGHT ? toFixed(0.5) : toFixed(0);
      physicsStep();
    }
    const truthHash = computeStateChecksum([dp1, dp2], ALL_MOVE_IDS);

    // ── Replay simulation ─────────────────────────────────────────────────
    resetAll();
    seedRng(42);
    const { p1: rp1, p2: rp2 } = setupFighters();

    const rec = new ReplayRecorder(2, 42);
    rec.start();
    for (const [inp0, inp1] of inputLog) rec.recordFrame([inp0, inp1]);
    rec.stop();

    const bytes  = rec.serialise();
    const player = ReplayPlayer.deserialise(bytes);

    player.play((f, inputs) => {
      const inp0 = inputs[0] ?? PACKED_NEUTRAL;
      const inp1 = inputs[1] ?? PACKED_NEUTRAL;
      physicsComponents.get(rp1)!.vx = inp0 === PACKED_RIGHT ? toFixed(0.5) : toFixed(0);
      physicsComponents.get(rp2)!.vx = inp1 === PACKED_RIGHT ? toFixed(0.5) : toFixed(0);
      physicsStep();
      void f;
    });

    const replayHash = computeStateChecksum([rp1, rp2], ALL_MOVE_IDS);
    expect(replayHash).toBe(truthHash);
  });

  it('throws on unsupported format version', () => {
    const buf = new Uint8Array(10);
    buf[0] = 99; // wrong version
    expect(() => ReplayPlayer.deserialise(buf)).toThrow('Unsupported format version');
  });

  it('throws on buffer too short', () => {
    expect(() => ReplayPlayer.deserialise(new Uint8Array(3))).toThrow('Buffer too short');
  });
});
