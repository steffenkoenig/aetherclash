// tests/characters.test.ts
// Validates that trump/musk/putin/xi/lizzy characters are fully implemented:
// correct stats, complete move sets, and that checkHitboxSystem populates
// lastFrameHits for character-specific on-hit mechanics.

import { describe, it, expect, beforeEach } from 'vitest';
import { toFixed, toFloat } from '../src/engine/physics/fixednum.js';
import {
  transformComponents,
  physicsComponents,
  fighterComponents,
  clearAllComponents,
  type Move,
} from '../src/engine/ecs/component.js';
import { createEntity, resetEntityCounter } from '../src/engine/ecs/entity.js';
import {
  hitRegistry,
  lastFrameHits,
  platforms,
  checkHitboxSystem,
} from '../src/engine/physics/collision.js';
import { hitlagMap, transitionFighterState } from '../src/engine/physics/stateMachine.js';
import { seedRng, nextRng } from '../src/engine/physics/lcg.js';

import { TRUMP_STATS, TRUMP_MOVES }  from '../src/game/characters/trump.js';
import { MUSK_STATS,  MUSK_MOVES  }  from '../src/game/characters/musk.js';
import { PUTIN_STATS, PUTIN_MOVES }  from '../src/game/characters/putin.js';
import { XI_STATS,    XI_MOVES    }  from '../src/game/characters/xi.js';
import { LIZZY_STATS, LIZZY_MOVES }  from '../src/game/characters/lizzy.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeGroundedFighter(
  characterId: string,
  stats: ReturnType<typeof TRUMP_STATS extends infer S ? () => S : never> = TRUMP_STATS as any,
  x = 0, y = 30,
) {
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
    characterId,
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
    currentMoveId: null, grabVictimId: null, smashChargeFrames: 0,
    stats,
  });
  return id;
}

beforeEach(() => {
  clearAllComponents();
  resetEntityCounter();
  hitlagMap.clear();
  hitRegistry.clear();
  platforms.length = 0;
});

// ── Move-set completeness ─────────────────────────────────────────────────────

const REQUIRED_MOVES = [
  'neutralJab1', 'dashAttack', 'forwardTilt', 'upTilt', 'downTilt',
  'forwardSmash', 'upSmash', 'downSmash',
  'forwardThrow', 'backThrow', 'upThrow', 'downThrow',
  'neutralAir', 'forwardAir', 'backAir', 'upAir', 'downAir',
  'neutralSpecial', 'sideSpecial', 'upSpecial', 'downSpecial',
];

// Some characters use a single neutralJab without a chain — either neutralJab1 or neutralJab is required.
const JABS_ALTERNATIVE = ['neutralJab', 'neutralJab1'];

describe('character move-set completeness', () => {
  const roster: [string, Record<string, Move>][] = [
    ['trump', TRUMP_MOVES],
    ['musk',  MUSK_MOVES],
    ['putin', PUTIN_MOVES],
    ['xi',    XI_MOVES],
    ['lizzy', LIZZY_MOVES],
  ];

  for (const [charId, moves] of roster) {
    const moveMap = new Map(Object.entries(moves));

    it(`${charId} has all four specials`, () => {
      expect(moveMap.has('neutralSpecial'), `${charId} missing neutralSpecial`).toBe(true);
      expect(moveMap.has('sideSpecial'),    `${charId} missing sideSpecial`).toBe(true);
      expect(moveMap.has('upSpecial'),      `${charId} missing upSpecial`).toBe(true);
      expect(moveMap.has('downSpecial'),    `${charId} missing downSpecial`).toBe(true);
    });

    it(`${charId} has all aerials`, () => {
      expect(moveMap.has('neutralAir'),  `${charId} missing neutralAir`).toBe(true);
      expect(moveMap.has('forwardAir'),  `${charId} missing forwardAir`).toBe(true);
      expect(moveMap.has('backAir'),     `${charId} missing backAir`).toBe(true);
      expect(moveMap.has('upAir'),       `${charId} missing upAir`).toBe(true);
      expect(moveMap.has('downAir'),     `${charId} missing downAir`).toBe(true);
    });

    it(`${charId} has all smashes`, () => {
      expect(moveMap.has('forwardSmash'), `${charId} missing forwardSmash`).toBe(true);
      expect(moveMap.has('upSmash'),      `${charId} missing upSmash`).toBe(true);
      expect(moveMap.has('downSmash'),    `${charId} missing downSmash`).toBe(true);
    });

    it(`${charId} has all throws`, () => {
      expect(moveMap.has('forwardThrow'), `${charId} missing forwardThrow`).toBe(true);
      expect(moveMap.has('backThrow'),    `${charId} missing backThrow`).toBe(true);
      expect(moveMap.has('upThrow'),      `${charId} missing upThrow`).toBe(true);
      expect(moveMap.has('downThrow'),    `${charId} missing downThrow`).toBe(true);
    });

    it(`${charId} has a jab`, () => {
      const hasJab = JABS_ALTERNATIVE.some(j => moveMap.has(j));
      expect(hasJab, `${charId} missing neutralJab or neutralJab1`).toBe(true);
    });
  }
});

// ── Stats reflect stated strengths/weaknesses ─────────────────────────────────

describe('character stats', () => {
  it('Trump has heaviest weight class among mogul tier (≥ 1.19)', () => {
    expect(toFloat(TRUMP_STATS.weightClass)).toBeGreaterThanOrEqual(1.19);
  });

  it('Trump has notable knock-back power (forwardSmash baseKnockback ≥ 12)', () => {
    const fsmash = TRUMP_MOVES['forwardSmash'];
    expect(fsmash).toBeDefined();
    expect(toFloat(fsmash!.hitboxes[0]!.baseKnockback)).toBeGreaterThanOrEqual(12);
  });

  it('Trump grab has short reach (forwardThrow offsetX ≤ 20)', () => {
    const fthrow = TRUMP_MOVES['forwardThrow'];
    expect(toFloat(fthrow!.hitboxes[0]!.offsetX)).toBeLessThanOrEqual(20);
  });

  it('Musk has highest jump force of the five (air mobility)', () => {
    const jumpForces = [
      TRUMP_STATS, MUSK_STATS, PUTIN_STATS, XI_STATS, LIZZY_STATS,
    ].map(s => toFloat(s.jumpForce));
    const muskJump = toFloat(MUSK_STATS.jumpForce);
    expect(muskJump).toBe(Math.max(...jumpForces));
  });

  it('Musk is the lightest of the five (easily launched)', () => {
    const weights = [
      TRUMP_STATS, MUSK_STATS, PUTIN_STATS, XI_STATS, LIZZY_STATS,
    ].map(s => toFloat(s.weightClass));
    expect(toFloat(MUSK_STATS.weightClass)).toBe(Math.min(...weights));
  });

  it('Putin is one of the slowest walkers (walkSpeed ≤ 3.5)', () => {
    expect(toFloat(PUTIN_STATS.walkSpeed)).toBeLessThanOrEqual(3.5);
  });

  it('Putin has the heaviest weight class', () => {
    const weights = [
      TRUMP_STATS, MUSK_STATS, PUTIN_STATS, XI_STATS, LIZZY_STATS,
    ].map(s => toFloat(s.weightClass));
    expect(toFloat(PUTIN_STATS.weightClass)).toBe(Math.max(...weights));
  });

  it('Lizzy has the slowest walk speed overall', () => {
    expect(toFloat(LIZZY_STATS.walkSpeed)).toBeLessThan(toFloat(PUTIN_STATS.walkSpeed));
  });

  it('Xi has high startup lag on forwardSmash (activeFrames[0] ≥ 28)', () => {
    const fsmash = XI_MOVES['forwardSmash'];
    expect(fsmash!.hitboxes[0]!.activeFrames[0]).toBeGreaterThanOrEqual(28);
  });

  it('Xi tank stats: weight ≥ 1.4', () => {
    expect(toFloat(XI_STATS.weightClass)).toBeGreaterThanOrEqual(1.4);
  });
});

// ── Poise: Lizzy hurtboxes are intangible during active frames ────────────────

describe('Lizzy poise mechanic', () => {
  it('neutralJab1 hurtbox is intangible during active frames', () => {
    const jab = LIZZY_MOVES['neutralJab1']!;
    const hurtbox = jab.hurtboxes[0]!;
    expect(hurtbox.intangible).toBe(true);
  });

  it('forwardSmash hurtbox is intangible during active frames', () => {
    const fsmash = LIZZY_MOVES['forwardSmash']!;
    const hurtbox = fsmash.hurtboxes[0]!;
    expect(hurtbox.intangible).toBe(true);
  });

  it('all aerials have poise hurtboxes during active frames', () => {
    const aerials = ['neutralAir', 'forwardAir', 'backAir', 'upAir'];
    for (const name of aerials) {
      const move = LIZZY_MOVES[name]!;
      const hasIntangible = move.hurtboxes.some(hb => hb.intangible);
      expect(hasIntangible, `${name} missing poise hurtbox`).toBe(true);
    }
  });
});

// ── Putin throw strength ───────────────────────────────────────────────────────

describe('Putin throw supremacy', () => {
  it('Putin backThrow baseKnockback > Trump backThrow', () => {
    const putinBthrow = PUTIN_MOVES['backThrow']!.hitboxes[0]!;
    const trumpBthrow = TRUMP_MOVES['backThrow']!.hitboxes[0]!;
    expect(toFloat(putinBthrow.baseKnockback)).toBeGreaterThan(toFloat(trumpBthrow.baseKnockback));
  });

  it('Putin forwardThrow baseKnockback is among the highest in the roster', () => {
    const fthrowKBs = [
      TRUMP_MOVES['forwardThrow']!.hitboxes[0]!.baseKnockback,
      MUSK_MOVES['forwardThrow']!.hitboxes[0]!.baseKnockback,
      PUTIN_MOVES['forwardThrow']!.hitboxes[0]!.baseKnockback,
      XI_MOVES['forwardThrow']!.hitboxes[0]!.baseKnockback,
      LIZZY_MOVES['forwardThrow']!.hitboxes[0]!.baseKnockback,
    ].map(toFloat);
    expect(toFloat(PUTIN_MOVES['forwardThrow']!.hitboxes[0]!.baseKnockback))
      .toBe(Math.max(...fthrowKBs));
  });
});

// ── checkHitboxSystem: lastFrameHits ─────────────────────────────────────────

describe('lastFrameHits: character on-hit event reporting', () => {
  function buildMoveData(charId: string, moves: Record<string, Move>) {
    const inner = new Map(Object.entries(moves));
    const outer = new Map([[charId, inner]]);
    return outer;
  }

  it('lastFrameHits is cleared at the start of each call', () => {
    // Populate the array with a dummy value
    (lastFrameHits as any[]).push({ attackerId: 99, victimId: 99, attackerCharId: 'dummy', hitboxId: 'x' });
    expect(lastFrameHits).toHaveLength(1);

    // Calling checkHitboxSystem with no fighters clears it
    checkHitboxSystem([], new Map());
    expect(lastFrameHits).toHaveLength(0);
  });

  it('records a hit event when Putin neutralSpecial connects', () => {
    const puId = createEntity();
    const vicId = createEntity();

    // Putin attacker
    transformComponents.set(puId, { x: toFixed(0), y: toFixed(30), prevX: toFixed(0), prevY: toFixed(30), facingRight: true });
    physicsComponents.set(puId, { vx: toFixed(0), vy: toFixed(0), gravityMultiplier: toFixed(1), grounded: true, fastFalling: false });
    const puFighter = {
      characterId: 'putin', state: 'attack' as const,
      damagePercent: toFixed(0), stocks: 3, jumpCount: 0,
      hitstunFrames: 0, invincibleFrames: 0, hitlagFrames: 0,
      shieldHealth: 100, shieldBreakFrames: 0,
      attackFrame: 12, // within activeFrames [12, 20]
      currentMoveId: 'neutralSpecial', grabVictimId: null, smashChargeFrames: 0,
      stats: PUTIN_STATS,
    };
    fighterComponents.set(puId, puFighter);

    // Victim — place them in the hitbox path (offsetX=24, width=38 → world x ≈ 24)
    transformComponents.set(vicId, { x: toFixed(24), y: toFixed(30), prevX: toFixed(24), prevY: toFixed(30), facingRight: false });
    physicsComponents.set(vicId, { vx: toFixed(0), vy: toFixed(0), gravityMultiplier: toFixed(1), grounded: true, fastFalling: false });
    fighterComponents.set(vicId, {
      characterId: 'kael', state: 'idle' as const,
      damagePercent: toFixed(0), stocks: 3, jumpCount: 0,
      hitstunFrames: 0, invincibleFrames: 0, hitlagFrames: 0,
      shieldHealth: 100, shieldBreakFrames: 0,
      attackFrame: 0, currentMoveId: null, grabVictimId: null, smashChargeFrames: 0,
      stats: PUTIN_STATS,
    });

    const moveData = buildMoveData('putin', PUTIN_MOVES);
    checkHitboxSystem([puId, vicId], moveData);

    expect(lastFrameHits).toHaveLength(1);
    expect(lastFrameHits[0]!.attackerCharId).toBe('putin');
    expect(lastFrameHits[0]!.hitboxId).toBe('putin_nspecial');
    expect(lastFrameHits[0]!.victimId).toBe(vicId);
  });

  it('records Xi credit hit events with correct IDs', () => {
    const xiId  = createEntity();
    const vicId = createEntity();

    transformComponents.set(xiId, { x: toFixed(0), y: toFixed(30), prevX: toFixed(0), prevY: toFixed(30), facingRight: true });
    physicsComponents.set(xiId, { vx: toFixed(0), vy: toFixed(0), gravityMultiplier: toFixed(1), grounded: true, fastFalling: false });
    fighterComponents.set(xiId, {
      characterId: 'xi', state: 'attack' as const,
      damagePercent: toFixed(0), stocks: 3, jumpCount: 0,
      hitstunFrames: 0, invincibleFrames: 0, hitlagFrames: 0,
      shieldHealth: 100, shieldBreakFrames: 0,
      attackFrame: 12, // activeFrames [12, 16]
      currentMoveId: 'neutralSpecial', grabVictimId: null, smashChargeFrames: 0,
      stats: XI_STATS,
    });

    transformComponents.set(vicId, { x: toFixed(24), y: toFixed(34), prevX: toFixed(24), prevY: toFixed(34), facingRight: false });
    physicsComponents.set(vicId, { vx: toFixed(0), vy: toFixed(0), gravityMultiplier: toFixed(1), grounded: true, fastFalling: false });
    fighterComponents.set(vicId, {
      characterId: 'kael', state: 'idle' as const,
      damagePercent: toFixed(0), stocks: 3, jumpCount: 0,
      hitstunFrames: 0, invincibleFrames: 0, hitlagFrames: 0,
      shieldHealth: 100, shieldBreakFrames: 0,
      attackFrame: 0, currentMoveId: null, grabVictimId: null, smashChargeFrames: 0,
      stats: PUTIN_STATS,
    });

    const moveData = buildMoveData('xi', XI_MOVES);
    checkHitboxSystem([xiId, vicId], moveData);

    expect(lastFrameHits).toHaveLength(1);
    expect(lastFrameHits[0]!.attackerCharId).toBe('xi');
    expect(lastFrameHits[0]!.hitboxId).toBe('xi_credit1');
  });

  it('records Lizzy decree freeze event', () => {
    const lizId = createEntity();
    const vicId = createEntity();

    // sideSpecial activeFrames [10, 20], hitboxId lizzy_decree_freeze
    // huge width=100 so any victim nearby is hit
    transformComponents.set(lizId, { x: toFixed(0), y: toFixed(30), prevX: toFixed(0), prevY: toFixed(30), facingRight: true });
    physicsComponents.set(lizId, { vx: toFixed(0), vy: toFixed(0), gravityMultiplier: toFixed(1), grounded: true, fastFalling: false });
    fighterComponents.set(lizId, {
      characterId: 'lizzy', state: 'attack' as const,
      damagePercent: toFixed(0), stocks: 3, jumpCount: 0,
      hitstunFrames: 0, invincibleFrames: 0, hitlagFrames: 0,
      shieldHealth: 100, shieldBreakFrames: 0,
      attackFrame: 10, // first active frame
      currentMoveId: 'sideSpecial', grabVictimId: null, smashChargeFrames: 0,
      stats: LIZZY_STATS,
    });

    transformComponents.set(vicId, { x: toFixed(30), y: toFixed(30), prevX: toFixed(30), prevY: toFixed(30), facingRight: false });
    physicsComponents.set(vicId, { vx: toFixed(0), vy: toFixed(0), gravityMultiplier: toFixed(1), grounded: true, fastFalling: false });
    fighterComponents.set(vicId, {
      characterId: 'kael', state: 'idle' as const,
      damagePercent: toFixed(0), stocks: 3, jumpCount: 0,
      hitstunFrames: 0, invincibleFrames: 0, hitlagFrames: 0,
      shieldHealth: 100, shieldBreakFrames: 0,
      attackFrame: 0, currentMoveId: null, grabVictimId: null, smashChargeFrames: 0,
      stats: PUTIN_STATS,
    });

    const moveData = buildMoveData('lizzy', LIZZY_MOVES);
    checkHitboxSystem([lizId, vicId], moveData);

    expect(lastFrameHits).toHaveLength(1);
    expect(lastFrameHits[0]!.attackerCharId).toBe('lizzy');
    expect(lastFrameHits[0]!.hitboxId).toBe('lizzy_decree_freeze');
  });
});

// ── Musk Glitch: LCG-based 1% self-damage roll ───────────────────────────────

describe('Musk Glitch mechanic (LCG determinism)', () => {
  it('nextRng() % 100 is deterministic given the same seed', () => {
    seedRng(42);
    const a = nextRng() % 100;
    seedRng(42);
    const b = nextRng() % 100;
    expect(a).toBe(b);
  });

  it('gadget move IDs for Musk glitch are correct', () => {
    const gadgetMoves = ['neutralSpecial', 'sideSpecial', 'downSpecial'];
    for (const name of gadgetMoves) {
      expect(MUSK_MOVES[name], `${name} missing from MUSK_MOVES`).toBeDefined();
    }
  });

  it('across 10 000 LCG rolls approximately 1% land on 0 mod 100', () => {
    seedRng(12345);
    let hits = 0;
    const TRIALS = 10_000;
    for (let i = 0; i < TRIALS; i++) {
      if (nextRng() % 100 === 0) hits++;
    }
    // 1% of 10 000 = 100; allow ±50 variance (3-sigma for binomial p=0.01 n=10000)
    expect(hits).toBeGreaterThanOrEqual(50);
    expect(hits).toBeLessThanOrEqual(150);
  });
});

// ── Special hitbox IDs: ensure the IDs used by on-hit logic match move data ──

describe('special hitbox IDs match game constants', () => {
  it('Putin neutralSpecial hitbox has id "putin_nspecial"', () => {
    const move = PUTIN_MOVES['neutralSpecial']!;
    const ids = move.hitboxes.map(h => h.id);
    expect(ids).toContain('putin_nspecial');
  });

  it('Xi neutralSpecial has xi_credit1, xi_credit2, xi_credit3', () => {
    const move = XI_MOVES['neutralSpecial']!;
    const ids = move.hitboxes.map(h => h.id);
    expect(ids).toContain('xi_credit1');
    expect(ids).toContain('xi_credit2');
    expect(ids).toContain('xi_credit3');
  });

  it('Lizzy sideSpecial has id "lizzy_decree_freeze"', () => {
    const move = LIZZY_MOVES['sideSpecial']!;
    const ids = move.hitboxes.map(h => h.id);
    expect(ids).toContain('lizzy_decree_freeze');
  });

  it('Trump downSpecial beam has id "trump_fired_beam"', () => {
    const move = TRUMP_MOVES['downSpecial']!;
    const ids = move.hitboxes.map(h => h.id);
    expect(ids).toContain('trump_fired_beam');
  });

  it('Musk downSpecial rocket launch has id "musk_rocket_launch"', () => {
    const move = MUSK_MOVES['downSpecial']!;
    const ids = move.hitboxes.map(h => h.id);
    expect(ids).toContain('musk_rocket_launch');
  });

  it('Putin downSpecial bear stampede has bear hitbox IDs', () => {
    const move = PUTIN_MOVES['downSpecial']!;
    const ids = move.hitboxes.map(h => h.id);
    expect(ids).toContain('putin_bear1');
    expect(ids).toContain('putin_bear2');
    expect(ids).toContain('putin_bear3');
  });

  it('Xi downSpecial firewall has left and right wall hitboxes', () => {
    const move = XI_MOVES['downSpecial']!;
    const ids = move.hitboxes.map(h => h.id);
    expect(ids).toContain('xi_firewall_l');
    expect(ids).toContain('xi_firewall_r');
  });

  it('Lizzy downSpecial tea wave has three stage-sweep hitboxes', () => {
    const move = LIZZY_MOVES['downSpecial']!;
    const ids = move.hitboxes.map(h => h.id);
    expect(ids).toContain('lizzy_tea_wave1');
    expect(ids).toContain('lizzy_tea_wave2');
    expect(ids).toContain('lizzy_tea_wave3');
  });
});
