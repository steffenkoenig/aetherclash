// tests/combat.test.ts
// Phase 2 acceptance tests — Combat Core

import { describe, it, expect, beforeEach } from 'vitest';
import { toFixed, toFloat } from '../src/engine/physics/fixednum.js';
import {
  transformComponents,
  physicsComponents,
  fighterComponents,
  ledgeColliderComponents,
  clearAllComponents,
  type Move,
} from '../src/engine/ecs/component.js';
import { createEntity, resetEntityCounter } from '../src/engine/ecs/entity.js';
import { KAEL_STATS } from '../src/game/characters/kael.js';
import { hitlagMap, shieldBreakMap, transitionFighterState } from '../src/engine/physics/stateMachine.js';
import { hitRegistry, platforms, platformCollisionSystem } from '../src/engine/physics/collision.js';
import {
  dodgeFramesMap,
  grabFramesMap,
  techWindowMap,
  airDodgeUsedSet,
} from '../src/engine/physics/stateMachine.js';
import {
  setEntityShieldInput,
  FIGHTER_HALF_HEIGHT,
} from '../src/engine/physics/collision.js';
import { respawnTimers, setBlastZones } from '../src/engine/physics/blastZone.js';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeGroundedFighter(characterId = 'kael', stats = KAEL_STATS, x = 0, y = 30) {
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
  shieldBreakMap.clear();
  hitRegistry.clear();
  platforms.length = 0;
  respawnTimers.clear();
  dodgeFramesMap.clear();
  grabFramesMap.clear();
  techWindowMap.clear();
  airDodgeUsedSet.clear();
  setBlastZones({
    left:   toFixed(-750),
    right:  toFixed(750),
    top:    toFixed(580),
    bottom: toFixed(-320),
  });
});

// ── Knockback formula ─────────────────────────────────────────────────────────

import {
  computeKnockbackForce,
  computeHitstunFrames,
  computeHitlagFrames,
  applyKnockback,
} from '../src/engine/physics/knockback.js';

describe('knockback formula', () => {
  // Reference formula (float): F = ((d/10 + d*w/20) / (w+1)) * s + b
  function referenceKnockback(d: number, w: number, s: number, b: number): number {
    return ((d / 10 + (d * w) / 20) / (w + 1)) * s + b;
  }

  const weightClasses = [0.6, 0.8, 1.0, 1.3, 1.7] as const;
  const s = 1.2;
  const b = 5.0;

  it('matches reference at d=0 for each weight class (F ≈ b)', () => {
    for (const w of weightClasses) {
      const force = computeKnockbackForce({
        victimDamage:      toFixed(0),
        victimWeight:      toFixed(w),
        moveScaling:       toFixed(s),
        moveBaseKnockback: toFixed(b),
        launchAngle: 45,
        attackerFacingRight: true,
        diX: 0,
      });
      const ref = referenceKnockback(0, w, s, b);
      // At d=0 the formula collapses to b; allow ±0.01 tolerance for Q16.16 rounding
      expect(Math.abs(toFloat(force) - ref)).toBeLessThan(0.01);
    }
  });

  it('matches reference at d=50 for each weight class', () => {
    for (const w of weightClasses) {
      const force = computeKnockbackForce({
        victimDamage:      toFixed(50),
        victimWeight:      toFixed(w),
        moveScaling:       toFixed(s),
        moveBaseKnockback: toFixed(b),
        launchAngle: 45,
        attackerFacingRight: true,
        diX: 0,
      });
      const ref = referenceKnockback(50, w, s, b);
      expect(Math.abs(toFloat(force) - ref)).toBeLessThan(0.05);
    }
  });

  it('matches reference at d=100 for each weight class', () => {
    for (const w of weightClasses) {
      const force = computeKnockbackForce({
        victimDamage:      toFixed(100),
        victimWeight:      toFixed(w),
        moveScaling:       toFixed(s),
        moveBaseKnockback: toFixed(b),
        launchAngle: 45,
        attackerFacingRight: true,
        diX: 0,
      });
      const ref = referenceKnockback(100, w, s, b);
      expect(Math.abs(toFloat(force) - ref)).toBeLessThan(0.05);
    }
  });

  it('matches reference at d=150 for each weight class', () => {
    for (const w of weightClasses) {
      const force = computeKnockbackForce({
        victimDamage:      toFixed(150),
        victimWeight:      toFixed(w),
        moveScaling:       toFixed(s),
        moveBaseKnockback: toFixed(b),
        launchAngle: 45,
        attackerFacingRight: true,
        diX: 0,
      });
      const ref = referenceKnockback(150, w, s, b);
      expect(Math.abs(toFloat(force) - ref)).toBeLessThan(0.05);
    }
  });

  it('heavier characters produce less knockback force than lighter ones at same damage', () => {
    const lightForce = computeKnockbackForce({
      victimDamage:      toFixed(100),
      victimWeight:      toFixed(0.6),  // Ultra-Light (Zira)
      moveScaling:       toFixed(1.2),
      moveBaseKnockback: toFixed(5),
      launchAngle: 45,
      attackerFacingRight: true,
      diX: 0,
    });
    const heavyForce = computeKnockbackForce({
      victimDamage:      toFixed(100),
      victimWeight:      toFixed(1.7),  // Super-Heavy (Gorun)
      moveScaling:       toFixed(1.2),
      moveBaseKnockback: toFixed(5),
      launchAngle: 45,
      attackerFacingRight: true,
      diX: 0,
    });
    expect(lightForce).toBeGreaterThan(heavyForce);
  });

  it('DI adjusts launch angle by no more than 15°', () => {
    const victimId = makeGroundedFighter();
    const phys = physicsComponents.get(victimId)!;

    // Apply knockback with no DI
    applyKnockback(victimId, {
      victimDamage:      toFixed(50),
      victimWeight:      toFixed(1.0),
      moveScaling:       toFixed(1.0),
      moveBaseKnockback: toFixed(5),
      launchAngle: 45,
      attackerFacingRight: true,
      diX: 0,
    });
    const vxNoDI = phys.vx;
    const vyNoDI = phys.vy;

    // Reset
    fighterComponents.get(victimId)!.state = 'idle';
    fighterComponents.get(victimId)!.hitstunFrames = 0;

    // Apply knockback with maximum DI (diX = +1 → +15°)
    applyKnockback(victimId, {
      victimDamage:      toFixed(50),
      victimWeight:      toFixed(1.0),
      moveScaling:       toFixed(1.0),
      moveBaseKnockback: toFixed(5),
      launchAngle: 45,
      attackerFacingRight: true,
      diX: 1.0,
    });
    const vxDI = phys.vx;
    const vyDI = phys.vy;

    // Derive the angle change from velocity vectors
    const angleNoDI = Math.atan2(toFloat(vyNoDI), toFloat(vxNoDI)) * (180 / Math.PI);
    const angleDI   = Math.atan2(toFloat(vyDI),   toFloat(vxDI))   * (180 / Math.PI);
    const delta = Math.abs(angleDI - angleNoDI);
    expect(delta).toBeLessThanOrEqual(15.1); // 0.1° tolerance for LUT rounding
  });
});

// ── Hitstun ───────────────────────────────────────────────────────────────────

describe('hitstun', () => {
  // Q16.16 rounding: toFixed(0.4) = 26214 (not 26214.4), so the fixed-point
  // result may differ from the float ideal by at most 1 frame. Both results
  // are spec-correct — the tolerance is intentional.
  it('hitstunFrames = floor(F * 0.4) within ±1 frame (Q16.16 precision)', () => {
    const force = toFixed(20);  // 20 world units; float ideal = floor(8.0) = 8
    const result = computeHitstunFrames(force);
    const floatIdeal = Math.floor(20 * 0.4); // 8
    expect(Math.abs(result - floatIdeal)).toBeLessThanOrEqual(1);
  });

  it('hitstunFrames scales with force (higher force → more hitstun)', () => {
    const lowForce  = computeHitstunFrames(toFixed(10));
    const midForce  = computeHitstunFrames(toFixed(25));
    const highForce = computeHitstunFrames(toFixed(50));
    expect(lowForce).toBeLessThan(midForce);
    expect(midForce).toBeLessThan(highForce);
  });

  it('hitstunFrames = 0 when force = 0', () => {
    expect(computeHitstunFrames(toFixed(0))).toBe(0);
  });

  it('hitstunFrames matches floor(F * 0.4) within ±1 for various forces', () => {
    const cases = [0, 5, 10, 15, 25, 40, 100] as const;
    for (const f of cases) {
      const result    = computeHitstunFrames(toFixed(f));
      const floatIdeal = Math.floor(f * 0.4);
      expect(Math.abs(result - floatIdeal)).toBeLessThanOrEqual(1);
    }
  });
});

// ── Hitbox / Hurtbox ──────────────────────────────────────────────────────────

import { checkHitboxSystem } from '../src/engine/physics/collision.js';

function makeAttacker(x: number, moveId: string, frame: number) {
  const id = makeGroundedFighter('kael', KAEL_STATS, x, 30);
  const fighter = fighterComponents.get(id)!;
  fighter.state = 'attack';
  fighter.currentMoveId = moveId;
  fighter.attackFrame = frame;
  return id;
}

function makeMoveData(characterId: string, moveId: string, move: Move): Map<string, Map<string, Move>> {
  return new Map([[characterId, new Map([[moveId, move]])]]);
}

describe('hitbox / hurtbox', () => {
  it('same move cannot register twice on the same victim', () => {
    const attackerId = makeAttacker(0, 'testMove', 5);
    const victimId   = makeGroundedFighter('kael', KAEL_STATS, 40, 30);

    const move: Move = {
      totalFrames: 30,
      hitboxes: [{
        activeFrames: [3, 10],
        offsetX: toFixed(30), offsetY: toFixed(0),
        width: toFixed(40), height: toFixed(40),
        damage: 10, knockbackScaling: toFixed(1.0), baseKnockback: toFixed(5),
        launchAngle: 45, hitlagFrames: 4, id: 'test_hitbox_0',
      }],
      hurtboxes: [{
        activeFrames: [0, 30], offsetX: toFixed(0), offsetY: toFixed(0),
        width: toFixed(30), height: toFixed(60), intangible: false, invincible: false,
      }],
      iasa: 25, landingLag: 0,
    };

    const moveData = makeMoveData('kael', 'testMove', move);

    // First check — should register a hit
    checkHitboxSystem([attackerId, victimId], moveData);
    const sizeAfterFirst = hitRegistry.size;
    expect(sizeAfterFirst).toBe(1);

    const damageAfterFirst = fighterComponents.get(victimId)!.damagePercent;

    // Second check on same frame — should NOT register a second hit
    checkHitboxSystem([attackerId, victimId], moveData);
    expect(hitRegistry.size).toBe(1); // still 1 entry
    expect(fighterComponents.get(victimId)!.damagePercent).toBe(damageAfterFirst);
  });

  it('hitlag freezes both attacker and victim for the correct duration', () => {
    const attackerId = makeAttacker(0, 'testMove2', 5);
    const victimId   = makeGroundedFighter('kael', KAEL_STATS, 40, 30);

    const damage = 12; // hitlagFrames = max(4, floor(12/3)) = max(4, 4) = 4
    const expectedHitlag = computeHitlagFrames(damage);

    const move: Move = {
      totalFrames: 30,
      hitboxes: [{
        activeFrames: [3, 10],
        offsetX: toFixed(30), offsetY: toFixed(0),
        width: toFixed(40), height: toFixed(40),
        damage, knockbackScaling: toFixed(1.0), baseKnockback: toFixed(5),
        launchAngle: 45, hitlagFrames: expectedHitlag, id: 'test_hitbox_1',
      }],
      hurtboxes: [{
        activeFrames: [0, 30], offsetX: toFixed(0), offsetY: toFixed(0),
        width: toFixed(30), height: toFixed(60), intangible: false, invincible: false,
      }],
      iasa: 25, landingLag: 0,
    };

    const moveData = makeMoveData('kael', 'testMove2', move);
    checkHitboxSystem([attackerId, victimId], moveData);

    const attackerFighter = fighterComponents.get(attackerId)!;
    const victimFighter   = fighterComponents.get(victimId)!;

    expect(attackerFighter.hitlagFrames).toBe(expectedHitlag);
    expect(victimFighter.hitlagFrames).toBe(expectedHitlag);
  });
});

// ── Hitlag freeze via tickFighterTimers ────────────────────────────────────────

import { tickFighterTimers } from '../src/engine/physics/stateMachine.js';

describe('hitlag', () => {
  it('tickFighterTimers returns early while hitlag > 0 (hitstun does not tick down)', () => {
    const id = makeGroundedFighter();
    const fighter = fighterComponents.get(id)!;

    // Manually set up hitlag and hitstun
    hitlagMap.set(id, 3);
    fighter.hitlagFrames   = 3;
    fighter.hitstunFrames  = 10;
    fighter.state          = 'hitstun';

    // Tick once — hitlag should decrement but hitstun should stay at 10
    tickFighterTimers(id);
    expect(fighter.hitstunFrames).toBe(10); // unchanged while hitlag > 0
    expect(fighter.hitlagFrames).toBe(2);
  });

  it('hitstun ticks down after hitlag expires', () => {
    const id = makeGroundedFighter();
    const fighter = fighterComponents.get(id)!;

    hitlagMap.set(id, 1);
    fighter.hitlagFrames  = 1;
    fighter.hitstunFrames = 5;
    fighter.state         = 'hitstun';

    tickFighterTimers(id); // drains last hitlag frame, no hitstun change
    expect(fighter.hitstunFrames).toBe(5);

    tickFighterTimers(id); // now hitlag = 0, hitstun ticks
    expect(fighter.hitstunFrames).toBe(4);
  });
});

// ── Blast zones ───────────────────────────────────────────────────────────────

import { checkBlastZones, RESPAWN_INVINCIBILITY_FRAMES } from '../src/engine/physics/blastZone.js';

const TEST_BLAST_ZONES = {
  left:   toFixed(-750),
  right:  toFixed(750),
  top:    toFixed(580),
  bottom: toFixed(-320),
};

describe('blast zones', () => {
  beforeEach(() => {
    setBlastZones(TEST_BLAST_ZONES);
  });

  it('KO triggered when character crosses left blast zone', () => {
    const id = makeGroundedFighter();
    transformComponents.get(id)!.x = toFixed(-800); // past left boundary
    const stocksBefore = fighterComponents.get(id)!.stocks;
    checkBlastZones(id);
    expect(fighterComponents.get(id)!.stocks).toBe(stocksBefore - 1);
  });

  it('KO triggered when character crosses right blast zone', () => {
    const id = makeGroundedFighter();
    transformComponents.get(id)!.x = toFixed(800);
    const stocksBefore = fighterComponents.get(id)!.stocks;
    checkBlastZones(id);
    expect(fighterComponents.get(id)!.stocks).toBe(stocksBefore - 1);
  });

  it('KO triggered when character crosses top blast zone', () => {
    const id = makeGroundedFighter();
    transformComponents.get(id)!.y = toFixed(600);
    const stocksBefore = fighterComponents.get(id)!.stocks;
    checkBlastZones(id);
    expect(fighterComponents.get(id)!.stocks).toBe(stocksBefore - 1);
  });

  it('KO triggered when character crosses bottom blast zone', () => {
    const id = makeGroundedFighter();
    transformComponents.get(id)!.y = toFixed(-400);
    const stocksBefore = fighterComponents.get(id)!.stocks;
    checkBlastZones(id);
    expect(fighterComponents.get(id)!.stocks).toBe(stocksBefore - 1);
  });

  it('no KO when character is within the blast zones', () => {
    const id = makeGroundedFighter();
    transformComponents.get(id)!.x = toFixed(0);
    transformComponents.get(id)!.y = toFixed(50);
    const stocksBefore = fighterComponents.get(id)!.stocks;
    checkBlastZones(id);
    expect(fighterComponents.get(id)!.stocks).toBe(stocksBefore);
  });
});

// ── Stock system ──────────────────────────────────────────────────────────────

describe('stocks', () => {
  beforeEach(() => {
    setBlastZones(TEST_BLAST_ZONES);
  });

  it('stock is decremented on KO', () => {
    const id = makeGroundedFighter();
    fighterComponents.get(id)!.stocks = 3;
    transformComponents.get(id)!.x = toFixed(-800);
    checkBlastZones(id);
    expect(fighterComponents.get(id)!.stocks).toBe(2);
  });

  it('fighter respawns at spawn point with invincibility when stocks remain', () => {
    const id = makeGroundedFighter();
    fighterComponents.get(id)!.stocks = 2;
    transformComponents.get(id)!.x = toFixed(-800);
    checkBlastZones(id);

    const transform = transformComponents.get(id)!;
    const fighter   = fighterComponents.get(id)!;
    // Position should be reset to spawn
    expect(toFloat(transform.x)).toBe(0);
    // Invincibility should be granted
    expect(fighter.invincibleFrames).toBe(RESPAWN_INVINCIBILITY_FRAMES);
    // Damage resets to 0
    expect(fighter.damagePercent).toBe(toFixed(0));
  });

  it('fighter transitions to KO state when last stock is lost', () => {
    const id = makeGroundedFighter();
    fighterComponents.get(id)!.stocks = 1;
    transformComponents.get(id)!.x = toFixed(-800);
    checkBlastZones(id);
    expect(fighterComponents.get(id)!.state).toBe('KO');
    expect(fighterComponents.get(id)!.stocks).toBe(0);
  });

  it('match ends (KO state locked) when last stock is lost', () => {
    const id = makeGroundedFighter();
    const fighter = fighterComponents.get(id)!;
    fighter.stocks = 1;
    transformComponents.get(id)!.x = toFixed(-800);

    checkBlastZones(id);
    expect(fighter.state).toBe('KO');

    // Ensure the state machine blocks further transitions out of KO
    const result = transitionFighterState(id, 'idle');
    expect(result).toBe(false);
    expect(fighter.state).toBe('KO');
  });
});

// ── Input buffer ──────────────────────────────────────────────────────────────

import { InputBuffer, BUFFER_WINDOW } from '../src/engine/input/buffer.js';

describe('input buffer', () => {
  it('jump pressed 3 frames early registers on landing frame (within window)', () => {
    const buf = new InputBuffer();
    const pressFrame   = 10;
    const landingFrame = 13; // 3 frames later

    buf.press('jump', pressFrame);
    expect(buf.consume('jump', landingFrame)).toBe(true);
  });

  it('jump pressed exactly at the buffer window boundary still registers', () => {
    const buf = new InputBuffer();
    const pressFrame   = 10;
    const landingFrame = 10 + BUFFER_WINDOW - 1; // last valid frame

    buf.press('jump', pressFrame);
    expect(buf.consume('jump', landingFrame)).toBe(true);
  });

  it('jump pressed outside the buffer window is discarded', () => {
    const buf = new InputBuffer();
    buf.press('jump', 10);
    expect(buf.consume('jump', 10 + BUFFER_WINDOW)).toBe(false); // frame 15, expired
  });

  it('each press is consumed only once (FIFO)', () => {
    const buf = new InputBuffer();
    buf.press('jump', 10);
    expect(buf.consume('jump', 12)).toBe(true);
    expect(buf.consume('jump', 12)).toBe(false); // already consumed
  });

  it('multiple presses are consumed in FIFO order', () => {
    const buf = new InputBuffer();
    buf.press('attack', 10);
    buf.press('attack', 11);
    // Both within window
    expect(buf.consume('attack', 12)).toBe(true);
    expect(buf.consume('attack', 12)).toBe(true);
    expect(buf.consume('attack', 12)).toBe(false);
  });

  it('clear() discards all buffered presses', () => {
    const buf = new InputBuffer();
    buf.press('jump', 10);
    buf.press('attack', 10);
    buf.clear();
    expect(buf.consume('jump',   11)).toBe(false);
    expect(buf.consume('attack', 11)).toBe(false);
  });
});

// ── Shield break ──────────────────────────────────────────────────────────────

describe('shield', () => {
  it('shield break stuns for ~3 s (180 frames) when shield is fully depleted', () => {
    const id = makeGroundedFighter();
    const fighter = fighterComponents.get(id)!;

    // Simulate shield breaking: transition to shielding first, then trigger break
    transitionFighterState(id, 'shielding');
    // Trigger shield break with 180 frames of stun
    transitionFighterState(id, 'idle', { shieldBreakFrames: 180 });
    // shieldBreakMap should be set
    expect(shieldBreakMap.get(id)).toBe(180);
    expect(fighter.shieldBreakFrames).toBe(180);
  });

  it('shield break stun ticks down each frame', () => {
    const id = makeGroundedFighter();
    shieldBreakMap.set(id, 5);
    fighterComponents.get(id)!.shieldBreakFrames = 5;

    for (let i = 0; i < 5; i++) {
      tickFighterTimers(id);
    }
    expect(fighterComponents.get(id)!.shieldBreakFrames).toBe(0);
  });
});

// ── Ledge: aerial jumps refreshed on grab ─────────────────────────────────────

import { ledgeGrabSystem } from '../src/engine/physics/collision.js';

describe('ledge mechanics', () => {
  it('aerial jumps are refreshed when a fighter grabs a ledge', () => {
    // Platform with a right-edge ledge at x=250, y=0
    platforms.push({ x1: toFixed(150), x2: toFixed(250), y: toFixed(0), passThrough: false });

    // Register a ledge collider at the right edge of that platform
    const ledgeId = createEntity();
    ledgeColliderComponents.set(ledgeId, {
      x: toFixed(250),
      y: toFixed(0),
      facingRight: true,
      occupiedByEntityId: null,
      cooldownFrames: 0,
    });

    // Position fighter so the grab hand overlaps the ledge.
    // grabHandX = transform.x + FIGHTER_HALF_WIDTH (15) → transform.x = 250 - 15 = 235
    // grabHandY = transform.y + FIGHTER_HALF_HEIGHT (30) → transform.y =   0 - 30 = -30
    const fighterId = createEntity();
    transformComponents.set(fighterId, {
      x: toFixed(235),
      y: toFixed(-30),
      prevX: toFixed(235),
      prevY: toFixed(-25),
      facingRight: true,
    });
    physicsComponents.set(fighterId, {
      vx: toFixed(0),
      vy: toFixed(-2),  // falling (vy < 0 required by ledgeGrabSystem)
      gravityMultiplier: toFixed(1.0),
      grounded: false,
      fastFalling: false,
    });
    fighterComponents.set(fighterId, {
      characterId: 'kael',
      state: 'jump',
      damagePercent: toFixed(0),
      stocks: 3,
      jumpCount: 2,   // both jumps used — should be refreshed to 0 on grab
      hitstunFrames: 0,
      invincibleFrames: 0,
      hitlagFrames: 0,
      shieldHealth: 100,
      shieldBreakFrames: 0,
      attackFrame: 0,
      currentMoveId: null, grabVictimId: null, smashChargeFrames: 0,
      stats: KAEL_STATS,
    });

    ledgeGrabSystem();

    const fighter = fighterComponents.get(fighterId)!;
    expect(fighter.state).toBe('ledgeHang');
    // Jumps must be refreshed on ledge grab
    expect(fighter.jumpCount).toBe(0);
  });
});

// ── State machine: invalid transitions are blocked ─────────────────────────────

describe('state machine', () => {
  it('invalid transition KO → attack is blocked', () => {
    const id = makeGroundedFighter();
    const fighter = fighterComponents.get(id)!;
    fighter.state = 'KO';
    const result = transitionFighterState(id, 'attack');
    expect(result).toBe(false);
    expect(fighter.state).toBe('KO');
  });

  it('valid transition idle → jump is allowed', () => {
    const id = makeGroundedFighter();
    const result = transitionFighterState(id, 'jump');
    expect(result).toBe(true);
    expect(fighterComponents.get(id)!.state).toBe('jump');
  });

  it('hitstun countdown: fighter returns to idle after hitstun expires', () => {
    const id = makeGroundedFighter();
    transitionFighterState(id, 'hitstun', { hitstunFrames: 3 });

    tickFighterTimers(id); // frame 1: hitstunFrames → 2
    tickFighterTimers(id); // frame 2: hitstunFrames → 1
    tickFighterTimers(id); // frame 3: hitstunFrames → 0 → auto-transition to idle

    expect(fighterComponents.get(id)!.state).toBe('idle');
    expect(fighterComponents.get(id)!.hitstunFrames).toBe(0);
  });
});

// ── Trig LUT ──────────────────────────────────────────────────────────────────

import { sinDeg, cosDeg, LUT_SIZE } from '../src/engine/physics/trig.js';

describe('trig LUT', () => {
  it('LUT_SIZE is 512', () => {
    expect(LUT_SIZE).toBe(512);
  });

  it('sin(0°) ≈ 0', () => {
    expect(Math.abs(toFloat(sinDeg(0)))).toBeLessThan(0.001);
  });

  it('sin(90°) ≈ 1', () => {
    expect(Math.abs(toFloat(sinDeg(90)) - 1)).toBeLessThan(0.01);
  });

  it('cos(0°) ≈ 1', () => {
    expect(Math.abs(toFloat(cosDeg(0)) - 1)).toBeLessThan(0.001);
  });

  it('cos(90°) ≈ 0', () => {
    expect(Math.abs(toFloat(cosDeg(90)))).toBeLessThan(0.01);
  });

  it('sin²(θ) + cos²(θ) ≈ 1 for several angles', () => {
    const angles = [0, 30, 45, 60, 90, 120, 180, 270, 360];
    for (const a of angles) {
      const s = toFloat(sinDeg(a));
      const c = toFloat(cosDeg(a));
      expect(Math.abs(s * s + c * c - 1)).toBeLessThan(0.001);
    }
  });
});

// ── hitlag formula ────────────────────────────────────────────────────────────

describe('hitlag formula', () => {
  it('hitlagFrames = max(4, floor(damage/3))', () => {
    expect(computeHitlagFrames(3)).toBe(4);   // max(4, 1) = 4
    expect(computeHitlagFrames(9)).toBe(4);   // max(4, 3) = 4
    expect(computeHitlagFrames(12)).toBe(4);  // max(4, 4) = 4
    expect(computeHitlagFrames(15)).toBe(5);  // max(4, 5) = 5
    expect(computeHitlagFrames(18)).toBe(6);  // max(4, 6) = 6
  });
});

// ── Dodge timers ──────────────────────────────────────────────────────────────

describe('dodges via tickFighterTimers', () => {
  it('spotDodge: fighter transitions to idle after SPOT_DODGE_TOTAL_FRAMES', () => {
    const id = makeGroundedFighter();
    transitionFighterState(id, 'spotDodge');
    dodgeFramesMap.set(id, 20);

    for (let i = 0; i < 20; i++) {
      tickFighterTimers(id);
    }

    expect(fighterComponents.get(id)!.state).toBe('idle');
  });

  it('rolling: fighter transitions to idle after ROLL_TOTAL_FRAMES', () => {
    const id = makeGroundedFighter();
    transitionFighterState(id, 'rolling');
    dodgeFramesMap.set(id, 30);

    for (let i = 0; i < 30; i++) {
      tickFighterTimers(id);
    }

    expect(fighterComponents.get(id)!.state).toBe('idle');
  });

  it('airDodge: fighter transitions to idle after AIR_DODGE_TOTAL_FRAMES', () => {
    const id = makeGroundedFighter();
    physicsComponents.get(id)!.grounded = false;
    transitionFighterState(id, 'jump');
    transitionFighterState(id, 'airDodge');
    dodgeFramesMap.set(id, 30);

    for (let i = 0; i < 30; i++) {
      tickFighterTimers(id);
    }

    expect(fighterComponents.get(id)!.state).toBe('idle');
  });

  it('dodge countdown decrements each frame', () => {
    const id = makeGroundedFighter();
    transitionFighterState(id, 'spotDodge');
    dodgeFramesMap.set(id, 10);

    tickFighterTimers(id);
    expect(dodgeFramesMap.get(id)).toBe(9);

    tickFighterTimers(id);
    expect(dodgeFramesMap.get(id)).toBe(8);
  });
});

// ── Grab timer ────────────────────────────────────────────────────────────────

describe('grab timer via tickFighterTimers', () => {
  it('grabbing: fighter transitions to idle after GRAB_TOTAL_FRAMES', () => {
    const id = makeGroundedFighter();
    transitionFighterState(id, 'grabbing');
    grabFramesMap.set(id, 20);

    for (let i = 0; i < 20; i++) {
      tickFighterTimers(id);
    }

    expect(fighterComponents.get(id)!.state).toBe('idle');
  });

  it('grab countdown decrements each frame', () => {
    const id = makeGroundedFighter();
    transitionFighterState(id, 'grabbing');
    grabFramesMap.set(id, 5);

    tickFighterTimers(id);
    expect(grabFramesMap.get(id)).toBe(4);
  });
});

// ── Tech window ───────────────────────────────────────────────────────────────

describe('tech window', () => {
  it('entering hitstun starts a 20-frame tech window', () => {
    const id = makeGroundedFighter();
    transitionFighterState(id, 'hitstun', { hitstunFrames: 30 });
    expect(techWindowMap.get(id)).toBe(20);
  });

  it('tech window ticks down each frame via tickFighterTimers', () => {
    const id = makeGroundedFighter();
    transitionFighterState(id, 'hitstun', { hitstunFrames: 30 });
    expect(techWindowMap.get(id)).toBe(20);

    tickFighterTimers(id);
    expect(techWindowMap.get(id)).toBe(19);
  });

  it('floor tech: landing while in hitstun with shield pressed clears hitstun', () => {
    const plat = { x1: toFixed(-200), x2: toFixed(200), y: toFixed(0), passThrough: false };
    platforms.push(plat);

    const id = createEntity();
    transformComponents.set(id, {
      x: toFixed(0),
      prevX: toFixed(0),
      prevY: toFixed(0) + FIGHTER_HALF_HEIGHT + toFixed(2),
      y:     toFixed(0) + FIGHTER_HALF_HEIGHT - toFixed(2),
      facingRight: true,
    });
    physicsComponents.set(id, {
      vx: toFixed(0), vy: toFixed(-3),
      gravityMultiplier: toFixed(1.0),
      grounded: false, fastFalling: false,
    });
    fighterComponents.set(id, {
      characterId: 'kael',
      state: 'hitstun',
      damagePercent: toFixed(0),
      stocks: 3,
      jumpCount: 1,
      hitstunFrames: 15,
      invincibleFrames: 0,
      hitlagFrames: 0,
      shieldHealth: 100,
      shieldBreakFrames: 0,
      attackFrame: 0,
      currentMoveId: null, grabVictimId: null, smashChargeFrames: 0,
      stats: KAEL_STATS,
    });

    techWindowMap.set(id, 10);
    setEntityShieldInput(id, true);

    platformCollisionSystem();

    const fighter = fighterComponents.get(id)!;
    expect(fighter.hitstunFrames).toBe(0);
    expect(fighter.state).toBe('idle');
    expect(physicsComponents.get(id)!.grounded).toBe(true);
  });

  it('hard knockdown: landing while in hitstun without shield press extends hitstun 30 frames', () => {
    const plat = { x1: toFixed(-200), x2: toFixed(200), y: toFixed(0), passThrough: false };
    platforms.push(plat);

    const id = createEntity();
    transformComponents.set(id, {
      x: toFixed(0),
      prevX: toFixed(0),
      prevY: toFixed(0) + FIGHTER_HALF_HEIGHT + toFixed(2),
      y:     toFixed(0) + FIGHTER_HALF_HEIGHT - toFixed(2),
      facingRight: true,
    });
    physicsComponents.set(id, {
      vx: toFixed(0), vy: toFixed(-3),
      gravityMultiplier: toFixed(1.0),
      grounded: false, fastFalling: false,
    });
    fighterComponents.set(id, {
      characterId: 'kael',
      state: 'hitstun',
      damagePercent: toFixed(0),
      stocks: 3,
      jumpCount: 1,
      hitstunFrames: 15,
      invincibleFrames: 0,
      hitlagFrames: 0,
      shieldHealth: 100,
      shieldBreakFrames: 0,
      attackFrame: 0,
      currentMoveId: null, grabVictimId: null, smashChargeFrames: 0,
      stats: KAEL_STATS,
    });

    techWindowMap.set(id, 10);
    setEntityShieldInput(id, false);

    platformCollisionSystem();

    const fighter = fighterComponents.get(id)!;
    expect(fighter.hitstunFrames).toBe(30);
    expect(physicsComponents.get(id)!.grounded).toBe(true);
  });
});

// ── Fighter body collision ────────────────────────────────────────────────────

import { fighterBodyCollisionSystem } from '../src/engine/physics/collision.js';

describe('fighterBodyCollisionSystem', () => {
  it('separates two overlapping fighters on the same platform', () => {
    // Place two fighters at exactly the same X position (fully overlapping).
    const a = makeGroundedFighter('kael', KAEL_STATS, 0, 30);
    const b = makeGroundedFighter('kael', KAEL_STATS, 0, 30);

    fighterBodyCollisionSystem([a, b]);

    const tA = transformComponents.get(a)!;
    const tB = transformComponents.get(b)!;
    // After separation, A and B must be at least FIGHTER_HALF_WIDTH * 2 apart
    // (or equal to 30 world units).
    const dx = Math.abs(toFloat(tA.x) - toFloat(tB.x));
    expect(dx).toBeCloseTo(30, 3);
  });

  it('does not move fighters that are already separated', () => {
    // Place fighters 100 units apart — well outside each other's width.
    const a = makeGroundedFighter('kael', KAEL_STATS, -50, 30);
    const b = makeGroundedFighter('kael', KAEL_STATS,  50, 30);

    fighterBodyCollisionSystem([a, b]);

    const tA = transformComponents.get(a)!;
    const tB = transformComponents.get(b)!;
    expect(toFloat(tA.x)).toBeCloseTo(-50, 3);
    expect(toFloat(tB.x)).toBeCloseTo( 50, 3);
  });

  it('does not separate KO fighters', () => {
    // One fighter KO'd — they should pass through the other.
    const a = makeGroundedFighter('kael', KAEL_STATS, 0, 30);
    const b = makeGroundedFighter('kael', KAEL_STATS, 0, 30);
    fighterComponents.get(b)!.state = 'KO';

    fighterBodyCollisionSystem([a, b]);

    const tA = transformComponents.get(a)!;
    const tB = transformComponents.get(b)!;
    // Positions must not have changed.
    expect(toFloat(tA.x)).toBeCloseTo(0, 3);
    expect(toFloat(tB.x)).toBeCloseTo(0, 3);
  });

  it('does not separate fighters on very different Y heights', () => {
    // A is on the ground (y=30), B is in the air (y=30+90) — one jumped over.
    const a = makeGroundedFighter('kael', KAEL_STATS, 0, 30);
    const b = makeGroundedFighter('kael', KAEL_STATS, 0, 120);

    fighterBodyCollisionSystem([a, b]);

    const tA = transformComponents.get(a)!;
    const tB = transformComponents.get(b)!;
    expect(toFloat(tA.x)).toBeCloseTo(0, 3);
    expect(toFloat(tB.x)).toBeCloseTo(0, 3);
  });
});

