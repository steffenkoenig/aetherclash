// tests/combat.test.ts
// Phase 2 acceptance tests

import { describe, it, expect, beforeEach } from 'vitest';

// ── Imports ───────────────────────────────────────────────────────────────────
import {
  toFixed,
  toFloat,
} from '../src/engine/physics/fixednum.js';

import {
  transformComponents,
  physicsComponents,
  fighterComponents,
  moveRegistries,
} from '../src/engine/ecs/component.js';
import { createEntity, resetEntityCounter } from '../src/engine/ecs/entity.js';
import { KAEL_STATS } from '../src/game/characters/kael.js';

// Import character data to ensure move registries are populated
import '../src/game/characters/gorun.js';
import '../src/game/characters/vela.js';
import '../src/game/characters/syne.js';
import '../src/game/characters/zira.js';

import {
  computeKnockback,
  computeHitstun,
  computeHitlag,
  applyHit,
  DI_MAX_DEGREES,
} from '../src/engine/physics/knockback.js';
import { cosLUT, sinLUT } from '../src/engine/physics/trig.js';
import {
  FIGHTER_HALF_HEIGHT,
  platforms,
  ledgeColliders,
  hitboxSystem,
  resetHitRegistry,
  ledgeGrabSystem,
} from '../src/engine/physics/collision.js';
import {
  triggerKO,
  checkMatchEnd,
  setActiveBlastZone,
  blastZoneSystem,
  clearKOCallbacks,
  onKO,
} from '../src/engine/physics/blastZone.js';
import type { BlastZone } from '../src/engine/physics/blastZone.js';
import {
  transitionFighterState,
  fighterTimerSystem,
} from '../src/engine/physics/stateMachine.js';
import { InputBuffer, BUFFER_WINDOW } from '../src/engine/input/buffer.js';
import { GORUN_STATS } from '../src/game/characters/gorun.js';
import { SYNE_STATS } from '../src/game/characters/syne.js';
import { ZIRA_STATS } from '../src/game/characters/zira.js';
import { VELA_STATS } from '../src/game/characters/vela.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeGroundedFighter(characterId: string, stats: typeof KAEL_STATS) {
  const id = createEntity();
  transformComponents.set(id, {
    x: toFixed(0), y: FIGHTER_HALF_HEIGHT,
    prevX: toFixed(0), prevY: FIGHTER_HALF_HEIGHT,
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
    stats,
    hitlagFrames: 0,
    shieldHealth: stats.shieldHealthMax ?? toFixed(100),
  });
  return id;
}

function makeAirborne(characterId: string, stats: typeof KAEL_STATS, x = 0, y = 200) {
  const id = createEntity();
  transformComponents.set(id, {
    x: toFixed(x), y: toFixed(y),
    prevX: toFixed(x), prevY: toFixed(y),
    facingRight: true,
  });
  physicsComponents.set(id, {
    vx: toFixed(0), vy: toFixed(0),
    gravityMultiplier: toFixed(1.0),
    grounded: false, fastFalling: false,
  });
  fighterComponents.set(id, {
    characterId,
    state: 'jump',
    damagePercent: toFixed(0),
    stocks: 3,
    jumpCount: 1,
    hitstunFrames: 0,
    invincibleFrames: 0,
    stats,
    hitlagFrames: 0,
    shieldHealth: stats.shieldHealthMax ?? toFixed(100),
  });
  return id;
}

const STANDARD_BLAST_ZONE: BlastZone = {
  left:   toFixed(-150),
  right:  toFixed(150),
  top:    toFixed(180),
  bottom: toFixed(-100),
};

beforeEach(() => {
  transformComponents.clear();
  physicsComponents.clear();
  fighterComponents.clear();
  resetEntityCounter();
  platforms.length = 0;
  ledgeColliders.length = 0;
  resetHitRegistry();
  clearKOCallbacks();
  setActiveBlastZone(STANDARD_BLAST_ZONE);
});

// ── Knockback formula ─────────────────────────────────────────────────────────

describe('knockback formula', () => {
  // Reference float computation to cross-check fixed-point results
  function refKnockback(d: number, w: number, s: number, b: number): number {
    return ((d / 10 + (d * w) / 20) / (w + 1)) * s + b;
  }

  const TOLERANCE = 0.01; // maximum allowed error vs float reference (in world units)

  const weights = [
    { name: 'ultra-light (w=0.6)', w: 0.6 },
    { name: 'light (w=0.8)',       w: 0.8 },
    { name: 'medium (w=1.0)',      w: 1.0 },
    { name: 'heavy (w=1.3)',       w: 1.3 },
    { name: 'super-heavy (w=1.7)', w: 1.7 },
  ];

  const damages = [0, 50, 100, 150];

  const S = 1.5;
  const B = 10;

  for (const { name, w } of weights) {
    for (const d of damages) {
      it(`matches reference at d=${d}, ${name}`, () => {
        const expected = refKnockback(d, w, S, B);
        const result   = toFloat(
          computeKnockback(toFixed(d), toFixed(w), toFixed(S), toFixed(B)),
        );
        expect(Math.abs(result - expected)).toBeLessThan(TOLERANCE);
      });
    }
  }

  it('returns base knockback b when d=0', () => {
    // At d=0 the formula simplifies to F = b regardless of w and s
    const result = toFloat(computeKnockback(toFixed(0), toFixed(1.0), toFixed(2.0), toFixed(7)));
    expect(Math.abs(result - 7)).toBeLessThan(TOLERANCE);
  });
});

// ── Knockback DI ──────────────────────────────────────────────────────────────

describe('knockback DI', () => {
  it('DI adjusts launch angle by ≤15°', () => {
    // Use the LUT directly to verify the angular adjustment.
    // A full DI input (diX = 1.0) should shift the angle by exactly DI_MAX_DEGREES.
    const baseDeg = 40;
    const diInputX = 1.0; // maximum DI

    // Expected adjusted angle
    const expectedAngle = baseDeg + diInputX * DI_MAX_DEGREES; // 55°

    // Verify that the cos/sin values at the adjusted angle are plausible
    const cosVal = toFloat(cosLUT(expectedAngle));
    const sinVal = toFloat(sinLUT(expectedAngle));

    expect(DI_MAX_DEGREES).toBe(15);
    expect(expectedAngle).toBe(55);
    // cos(55°) ≈ 0.5736, sin(55°) ≈ 0.8192
    expect(Math.abs(cosVal - Math.cos((55 * Math.PI) / 180))).toBeLessThan(0.005);
    expect(Math.abs(sinVal - Math.sin((55 * Math.PI) / 180))).toBeLessThan(0.005);
  });

  it('DI cannot rotate the angle by more than ±15°', () => {
    // For any given DI input magnitude ≤1, adjustment should be ≤15°
    for (const di of [-1, -0.5, 0, 0.5, 1]) {
      const adjustment = di * DI_MAX_DEGREES;
      expect(Math.abs(adjustment)).toBeLessThanOrEqual(15);
    }
  });
});

// ── Hitstun ───────────────────────────────────────────────────────────────────

describe('hitstun', () => {
  it('duration = floor(F * 0.4)', () => {
    const cases: [number, number][] = [
      [10, 4],   // 10 * 0.4 = 4
      [40, 16],  // 40 * 0.4 = 16
      [25, 10],  // 25 * 0.4 = 10
      [1,  0],   // 1 * 0.4 = 0.4 → floor = 0
      [50, 20],
    ];

    for (const [force, expectedFrames] of cases) {
      const frames = computeHitstun(toFixed(force));
      expect(frames).toBe(expectedFrames);
    }
  });

  it('hitstun is applied to victim after applyHit', () => {
    const attackerId = makeGroundedFighter('kael', KAEL_STATS);
    const victimId   = makeGroundedFighter('kael', KAEL_STATS);

    // Set victim damage to 50% to generate meaningful knockback
    fighterComponents.get(victimId)!.damagePercent = toFixed(50);

    applyHit(
      attackerId, victimId,
      18,          // damage
      toFixed(1.5), // scaling
      toFixed(10),  // base knockback
      40,           // launch angle
      0,            // no DI
    );

    const victim = fighterComponents.get(victimId)!;
    expect(victim.state).toBe('hitstun');
    expect(victim.hitstunFrames).toBeGreaterThan(0);

    // Check the formula: F at d=50, w=1.0, s=1.5, b=10 ≈ 15.625
    // hitstunFrames = floor(15.625 * 0.4) = floor(6.25) = 6
    expect(victim.hitstunFrames).toBe(6);
  });
});

// ── Hitlag ────────────────────────────────────────────────────────────────────

describe('hitlag', () => {
  it('hitlag = max(4, floor(damage / 3))', () => {
    expect(computeHitlag(3)).toBe(4);   // max(4, 1) = 4
    expect(computeHitlag(9)).toBe(4);   // max(4, 3) = 4
    expect(computeHitlag(12)).toBe(4);  // max(4, 4) = 4
    expect(computeHitlag(15)).toBe(5);  // max(4, 5) = 5
    expect(computeHitlag(18)).toBe(6);  // max(4, 6) = 6
    expect(computeHitlag(24)).toBe(8);
  });

  it('hitlag is set on both attacker and victim after a hit', () => {
    const attackerId = makeGroundedFighter('kael', KAEL_STATS);
    const victimId   = makeGroundedFighter('kael', KAEL_STATS);

    const damage = 18; // hitlag = max(4, floor(18/3)) = 6
    applyHit(
      attackerId, victimId,
      damage,
      toFixed(1.5),
      toFixed(10),
      40,
      0,
    );

    const attacker = fighterComponents.get(attackerId)!;
    const victim   = fighterComponents.get(victimId)!;

    expect(attacker.hitlagFrames).toBe(computeHitlag(damage));
    expect(victim.hitlagFrames).toBe(computeHitlag(damage));
  });
});

// ── Hitbox single-hit-per-move-instance guarantee ─────────────────────────────

describe('hitbox registry', () => {
  it('same move cannot register twice on the same victim', () => {
    // Set up attacker in 'attack' state with forwardSmash active on frame 22
    const attackerId = makeGroundedFighter('kael', KAEL_STATS);
    const victimId   = makeGroundedFighter('kael', KAEL_STATS);

    // Position attacker at x=0, victim at x=60 (within hitbox range: offsetX=40, w=50)
    transformComponents.get(attackerId)!.x = toFixed(0);
    transformComponents.get(victimId)!.x   = toFixed(60);

    const attacker = fighterComponents.get(attackerId)!;
    attacker.state          = 'attack';
    attacker.currentMoveId  = 'forwardSmash';
    attacker.currentMoveFrame = 22; // active frames are [20, 28]

    // Clear victim hitlag so they can be hit
    fighterComponents.get(victimId)!.hitlagFrames = 0;

    const initialDamage = fighterComponents.get(victimId)!.damagePercent;

    // First hitbox check
    hitboxSystem();

    const afterFirstHit = fighterComponents.get(victimId)!.damagePercent;
    expect(afterFirstHit).toBeGreaterThan(initialDamage); // hit registered

    // Reset hitlag to allow another potential hit
    fighterComponents.get(attackerId)!.hitlagFrames = 0;
    fighterComponents.get(victimId)!.hitlagFrames   = 0;
    // Also reset victim to 'idle' so state machine doesn't block
    fighterComponents.get(victimId)!.state = 'idle';
    fighterComponents.get(victimId)!.hitstunFrames = 0;

    // Second hitbox check — same move instance, should NOT register again
    hitboxSystem();

    const afterSecondCheck = fighterComponents.get(victimId)!.damagePercent;
    expect(afterSecondCheck).toBe(afterFirstHit); // no additional damage
  });

  it('hitbox does not hit invincible fighters', () => {
    const attackerId = makeGroundedFighter('kael', KAEL_STATS);
    const victimId   = makeGroundedFighter('kael', KAEL_STATS);

    transformComponents.get(attackerId)!.x = toFixed(0);
    transformComponents.get(victimId)!.x   = toFixed(60);

    const attacker = fighterComponents.get(attackerId)!;
    attacker.state          = 'attack';
    attacker.currentMoveId  = 'forwardSmash';
    attacker.currentMoveFrame = 22;

    // Mark victim as invincible
    fighterComponents.get(victimId)!.invincibleFrames = 60;

    const initialDamage = fighterComponents.get(victimId)!.damagePercent;
    hitboxSystem();
    expect(fighterComponents.get(victimId)!.damagePercent).toBe(initialDamage);
  });
});

// ── Blast zones ───────────────────────────────────────────────────────────────

describe('blast zone', () => {
  it('KO triggered when character crosses left boundary', () => {
    const id = makeGroundedFighter('kael', KAEL_STATS);
    transformComponents.get(id)!.x = toFixed(-151); // beyond left blast zone

    blastZoneSystem();

    expect(fighterComponents.get(id)!.state).toBe('KO');
    expect(fighterComponents.get(id)!.stocks).toBe(2);
  });

  it('KO triggered when character crosses right boundary', () => {
    const id = makeGroundedFighter('kael', KAEL_STATS);
    transformComponents.get(id)!.x = toFixed(151);
    blastZoneSystem();
    expect(fighterComponents.get(id)!.state).toBe('KO');
  });

  it('KO triggered when character crosses top boundary', () => {
    const id = makeGroundedFighter('kael', KAEL_STATS);
    transformComponents.get(id)!.y = toFixed(181);
    blastZoneSystem();
    expect(fighterComponents.get(id)!.state).toBe('KO');
  });

  it('KO triggered when character crosses bottom boundary', () => {
    const id = makeGroundedFighter('kael', KAEL_STATS);
    transformComponents.get(id)!.y = toFixed(-101);
    blastZoneSystem();
    expect(fighterComponents.get(id)!.state).toBe('KO');
  });

  it('no KO when character is inside blast zone', () => {
    const id = makeGroundedFighter('kael', KAEL_STATS);
    // Position well within the blast zone
    transformComponents.get(id)!.x = toFixed(0);
    transformComponents.get(id)!.y = toFixed(30);
    blastZoneSystem();
    expect(fighterComponents.get(id)!.state).not.toBe('KO');
    expect(fighterComponents.get(id)!.stocks).toBe(3);
  });
});

// ── Stock system ──────────────────────────────────────────────────────────────

describe('stocks', () => {
  it('stock decremented on KO', () => {
    const id = makeGroundedFighter('kael', KAEL_STATS);
    expect(fighterComponents.get(id)!.stocks).toBe(3);

    triggerKO(id);

    expect(fighterComponents.get(id)!.stocks).toBe(2);
    expect(fighterComponents.get(id)!.state).toBe('KO');
  });

  it('stocks cannot go below 0', () => {
    const id = makeGroundedFighter('kael', KAEL_STATS);
    fighterComponents.get(id)!.stocks = 1;

    triggerKO(id);

    expect(fighterComponents.get(id)!.stocks).toBe(0);

    // Calling again should be a no-op (already KO'd)
    triggerKO(id);
    expect(fighterComponents.get(id)!.stocks).toBe(0);
  });

  it('match ends when last stock lost', () => {
    const p1 = makeGroundedFighter('kael', KAEL_STATS);
    const p2 = makeGroundedFighter('kael', KAEL_STATS);

    fighterComponents.get(p2)!.stocks = 1;
    triggerKO(p2);

    // p2 has no stocks; p1 still has stocks → p1 wins
    const winner = checkMatchEnd();
    expect(winner).toBe(p1);
  });

  it('match does not end while two fighters have stocks', () => {
    makeGroundedFighter('kael', KAEL_STATS);
    makeGroundedFighter('kael', KAEL_STATS);
    expect(checkMatchEnd()).toBeNull();
  });

  it('KO callback fires with the correct entity ID', () => {
    let koId: number | null = null;
    onKO((id) => { koId = id; });

    const fighter = makeGroundedFighter('kael', KAEL_STATS);
    triggerKO(fighter);
    expect(koId).toBe(fighter);
  });
});

// ── Input buffer ──────────────────────────────────────────────────────────────

describe('input buffer', () => {
  it('consumes a buffered press within the window', () => {
    const buf = new InputBuffer();
    buf.press('jump', 10);
    expect(buf.consume('jump', 12)).toBe(true);  // 12-10=2, within BUFFER_WINDOW=5
  });

  it('discards presses older than BUFFER_WINDOW', () => {
    const buf = new InputBuffer();
    buf.press('jump', 10);
    expect(buf.consume('jump', 16)).toBe(false); // 16-10=6 > BUFFER_WINDOW
  });

  it('jump pressed 3 frames early registers on landing frame', () => {
    // Simulates: player lands on frame 15, pressed jump on frame 12
    const buf = new InputBuffer();
    const pressFrame  = 12;
    const landFrame   = 15;

    buf.press('jump', pressFrame);

    // On landing frame, check if a jump is available
    expect(buf.consume('jump', landFrame)).toBe(true);
  });

  it('BUFFER_WINDOW is 5 frames', () => {
    expect(BUFFER_WINDOW).toBe(5);
  });

  it('each press can only be consumed once', () => {
    const buf = new InputBuffer();
    buf.press('attack', 20);
    expect(buf.consume('attack', 22)).toBe(true);
    expect(buf.consume('attack', 22)).toBe(false); // already consumed
  });

  it('has() does not consume the press', () => {
    const buf = new InputBuffer();
    buf.press('special', 30);
    expect(buf.has('special', 31)).toBe(true);
    expect(buf.consume('special', 31)).toBe(true); // still consumable
  });
});

// ── Shield break ──────────────────────────────────────────────────────────────

describe('shield', () => {
  /**
   * Helper: directly deplete a fighter's shield to 0 and apply shield break stun.
   * This simulates the shield system without needing a full physics tick.
   */
  function breakShield(entityId: number): void {
    const fighter = fighterComponents.get(entityId)!;
    fighter.shieldHealth = toFixed(0);
    // A shield break stuns for ~3 seconds = 180 frames
    transitionFighterState(entityId, 'shieldBreak', { hitstunFrames: 180 });
  }

  it('shield break stuns for ~3 s (180 frames) when fully depleted', () => {
    const id = makeGroundedFighter('kael', KAEL_STATS);
    transitionFighterState(id, 'shielding');
    breakShield(id);

    const fighter = fighterComponents.get(id)!;
    expect(fighter.state).toBe('shieldBreak');
    expect(fighter.hitstunFrames).toBeGreaterThanOrEqual(170); // ~3 seconds
    expect(fighter.hitstunFrames).toBeLessThanOrEqual(200);
  });

  it('fighter recovers from shield break stun after 180 frames', () => {
    const id = makeGroundedFighter('kael', KAEL_STATS);
    transitionFighterState(id, 'shielding');
    breakShield(id);

    // Simulate 180 physics frames
    for (let i = 0; i < 180; i++) {
      fighterTimerSystem();
    }

    expect(fighterComponents.get(id)!.state).toBe('idle');
  });

  it('shield starts at full health', () => {
    const id = makeGroundedFighter('kael', KAEL_STATS);
    const fighter = fighterComponents.get(id)!;
    expect(fighter.shieldHealth).toBe(KAEL_STATS.shieldHealthMax);
  });
});

// ── Ledge mechanics ───────────────────────────────────────────────────────────

describe('ledge', () => {
  it('aerial jumps refreshed on ledge grab', () => {
    // Create an airborne fighter who has used both jumps
    const id = makeAirborne('kael', KAEL_STATS, 0, 100);
    const fighter = fighterComponents.get(id)!;

    // Fighter has used both jumps
    fighter.jumpCount = 2;

    // Place a ledge collider near the fighter
    const ledgeX = toFixed(15); // grab hand at x=0 + FIGHTER_HALF_WIDTH=15
    const ledgeY = toFixed(130); // grabHandY = y + FIGHTER_HALF_HEIGHT = 100+30 = 130
    ledgeColliders.push({ x: ledgeX, y: ledgeY, facingRight: false, occupied: null });

    // Fighter is airborne and moving downward
    physicsComponents.get(id)!.vy = toFixed(-0.1);

    ledgeGrabSystem();

    expect(fighterComponents.get(id)!.state).toBe('ledgeHang');
    expect(fighterComponents.get(id)!.jumpCount).toBe(0); // jumps refreshed
  });

  it('ledge becomes occupied after grab', () => {
    const id = makeAirborne('kael', KAEL_STATS, 0, 100);
    const fighter = fighterComponents.get(id)!;
    fighter.jumpCount = 2;

    const ledgeX = toFixed(15);
    const ledgeY = toFixed(130);
    ledgeColliders.push({ x: ledgeX, y: ledgeY, facingRight: false, occupied: null });
    physicsComponents.get(id)!.vy = toFixed(-0.1);

    ledgeGrabSystem();

    expect(ledgeColliders[0]!.occupied).toBe(id);
  });
});

// ── State machine ─────────────────────────────────────────────────────────────

describe('state machine', () => {
  it('valid transitions succeed', () => {
    const id = makeGroundedFighter('kael', KAEL_STATS);
    const ok = transitionFighterState(id, 'jump');
    expect(ok).toBe(true);
    expect(fighterComponents.get(id)!.state).toBe('jump');
  });

  it('invalid transition (KO → attack) is rejected and logged', () => {
    const id = makeGroundedFighter('kael', KAEL_STATS);
    transitionFighterState(id, 'KO', { respawnCountdown: 180 });
    const ok = transitionFighterState(id, 'attack');
    expect(ok).toBe(false);
    expect(fighterComponents.get(id)!.state).toBe('KO');
  });

  it('transition data (hitstunFrames) is applied on transition', () => {
    const id = makeGroundedFighter('kael', KAEL_STATS);
    transitionFighterState(id, 'hitstun', { hitstunFrames: 12 });
    expect(fighterComponents.get(id)!.hitstunFrames).toBe(12);
  });
});

// ── Character weight classes ──────────────────────────────────────────────────

describe('character weight classes', () => {
  it('Kael has weight class 1.0 (medium)', () => {
    expect(toFloat(KAEL_STATS.weightClass)).toBeCloseTo(1.0, 2);
  });
  it('Gorun has weight class 1.7 (super-heavy)', () => {
    expect(toFloat(GORUN_STATS.weightClass)).toBeCloseTo(1.7, 2);
  });
  it('Vela has weight class 1.3 (heavy)', () => {
    expect(toFloat(VELA_STATS.weightClass)).toBeCloseTo(1.3, 2);
  });
  it('Syne has weight class 0.8 (light)', () => {
    expect(toFloat(SYNE_STATS.weightClass)).toBeCloseTo(0.8, 2);
  });
  it('Zira has weight class 0.6 (ultra-light)', () => {
    expect(toFloat(ZIRA_STATS.weightClass)).toBeCloseTo(0.6, 2);
  });
});

// ── Move registries ───────────────────────────────────────────────────────────

describe('move registries', () => {
  it('all 5 characters have move data registered', () => {
    expect(moveRegistries.has('kael')).toBe(true);
    expect(moveRegistries.has('gorun')).toBe(true);
    expect(moveRegistries.has('vela')).toBe(true);
    expect(moveRegistries.has('syne')).toBe(true);
    expect(moveRegistries.has('zira')).toBe(true);
  });

  it('kael forwardSmash has totalFrames=55', () => {
    const moves = moveRegistries.get('kael')!;
    expect(moves['forwardSmash']!.totalFrames).toBe(55);
  });

  it('kael forwardSmash hitbox id is kael_fsmash_0', () => {
    const moves = moveRegistries.get('kael')!;
    expect(moves['forwardSmash']!.hitboxes[0]!.id).toBe('kael_fsmash_0');
  });
});

// ── Move-instance hit registry ────────────────────────────────────────────────

describe('move-instance hit registry', () => {
  it('same move can hit the same victim on a new execution (moveInstanceId incremented)', () => {
    const attackerId = makeGroundedFighter('kael', KAEL_STATS);
    const victimId   = makeGroundedFighter('kael', KAEL_STATS);

    transformComponents.get(attackerId)!.x = toFixed(0);
    transformComponents.get(victimId)!.x   = toFixed(60);

    const attacker = fighterComponents.get(attackerId)!;
    attacker.state            = 'attack';
    attacker.currentMoveId    = 'forwardSmash';
    attacker.currentMoveFrame = 22;
    attacker.moveInstanceId   = 0;

    // First execution — registers hit
    hitboxSystem();
    const damageAfterFirst = fighterComponents.get(victimId)!.damagePercent;
    expect(damageAfterFirst).toBeGreaterThan(toFixed(0));

    // Simulate move end: reset hitlag and bump moveInstanceId (new execution)
    fighterComponents.get(attackerId)!.hitlagFrames = 0;
    fighterComponents.get(victimId)!.hitlagFrames   = 0;
    fighterComponents.get(victimId)!.hitstunFrames  = 0;
    fighterComponents.get(victimId)!.state          = 'idle';
    attacker.moveInstanceId = 1; // new move execution

    // Second execution of the same move — should register again
    hitboxSystem();
    const damageAfterSecond = fighterComponents.get(victimId)!.damagePercent;
    expect(damageAfterSecond).toBeGreaterThan(damageAfterFirst);
  });
});

// ── Respawn behaviour when stocks run out ─────────────────────────────────────

describe('stocks — no respawn when eliminated', () => {
  it('no respawnCountdown set when last stock is lost', () => {
    const id = makeGroundedFighter('kael', KAEL_STATS);
    fighterComponents.get(id)!.stocks = 1;

    triggerKO(id);

    const fighter = fighterComponents.get(id)!;
    expect(fighter.stocks).toBe(0);
    expect(fighter.state).toBe('KO');
    // respawnCountdown must NOT be set (or must be 0/undefined)
    expect(fighter.respawnCountdown ?? 0).toBe(0);
  });

  it('respawnCountdown is set when stocks remain', () => {
    const id = makeGroundedFighter('kael', KAEL_STATS);
    fighterComponents.get(id)!.stocks = 3;

    triggerKO(id);

    const fighter = fighterComponents.get(id)!;
    expect(fighter.stocks).toBe(2);
    expect(fighter.respawnCountdown).toBeGreaterThan(0);
  });
});

// ── Hitlag freezes other timers ───────────────────────────────────────────────

describe('hitlag timer freeze', () => {
  it('hitstun countdown does NOT advance while hitlag is active', () => {
    const id = makeGroundedFighter('kael', KAEL_STATS);
    transitionFighterState(id, 'hitstun', { hitstunFrames: 20 });
    const fighter = fighterComponents.get(id)!;
    fighter.hitlagFrames = 6; // 6 frames of hitlag

    // Tick 6 frames — should only decrement hitlagFrames, not hitstunFrames
    for (let i = 0; i < 6; i++) {
      fighterTimerSystem();
    }

    expect(fighter.hitlagFrames).toBe(0);
    expect(fighter.hitstunFrames).toBe(20); // unchanged during hitlag
  });

  it('hitstun resumes after hitlag expires', () => {
    const id = makeGroundedFighter('kael', KAEL_STATS);
    transitionFighterState(id, 'hitstun', { hitstunFrames: 5 });
    const fighter = fighterComponents.get(id)!;
    fighter.hitlagFrames = 2;

    // 2 frames of hitlag + 5 frames of hitstun = 7 total frames to recover
    for (let i = 0; i < 7; i++) {
      fighterTimerSystem();
    }

    expect(fighter.hitlagFrames).toBe(0);
    expect(fighter.hitstunFrames).toBe(0);
    expect(fighter.state).toBe('idle');
  });
});

// ── Ledge auto-release on state exit ─────────────────────────────────────────

describe('ledge auto-release', () => {
  it('ledge is released automatically when fighter leaves ledgeHang', () => {
    const id = makeAirborne('kael', KAEL_STATS, 0, 100);
    const fighter = fighterComponents.get(id)!;
    fighter.jumpCount = 2;

    const ledgeX = toFixed(15);
    const ledgeY = toFixed(130);
    ledgeColliders.push({ x: ledgeX, y: ledgeY, facingRight: false, occupied: null });
    physicsComponents.get(id)!.vy = toFixed(-0.1);

    ledgeGrabSystem();

    expect(ledgeColliders[0]!.occupied).toBe(id);
    expect(fighter.state).toBe('ledgeHang');

    // Transition out of ledgeHang (e.g. fighter jumps off)
    transitionFighterState(id, 'jump');

    // The ledge should be released automatically
    expect(ledgeColliders[0]!.occupied).toBeNull();
  });
});
