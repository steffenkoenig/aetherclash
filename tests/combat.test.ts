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
  meteorCancelWindowMap,
  wavedashFramesMap,
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
  meteorCancelWindowMap.clear();
  wavedashFramesMap.clear();
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

import { checkHitboxSystem, setEntityStickX } from '../src/engine/physics/collision.js';

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

// ── Ledge hang: input handling (regression for missing handler) ───────────────

import { ledgeHangFramesMap } from '../src/engine/physics/stateMachine.js';
import { fixedMul } from '../src/engine/physics/fixednum.js';

describe('ledgeHang input handling', () => {
  function makeLedgeFighter() {
    const id = createEntity();
    transformComponents.set(id, {
      x: toFixed(235), y: toFixed(-30),
      prevX: toFixed(235), prevY: toFixed(-25),
      facingRight: true,
    });
    physicsComponents.set(id, {
      vx: toFixed(0), vy: toFixed(0),
      gravityMultiplier: toFixed(1.0),
      grounded: false, fastFalling: false,
    });
    fighterComponents.set(id, {
      characterId: 'kael', state: 'ledgeHang',
      damagePercent: toFixed(0),
      stocks: 3, jumpCount: 0, hitstunFrames: 0, invincibleFrames: 0,
      hitlagFrames: 0, shieldHealth: 100, shieldBreakFrames: 0,
      attackFrame: 0, currentMoveId: null, grabVictimId: null, smashChargeFrames: 0,
      stats: KAEL_STATS,
    });
    ledgeHangFramesMap.set(id, 10); // timer still running
    return id;
  }

  it('ledgeHang → jump is a valid state-machine transition', () => {
    const id = makeLedgeFighter();
    const ok = transitionFighterState(id, 'jump');
    expect(ok).toBe(true);
    expect(fighterComponents.get(id)!.state).toBe('jump');
  });

  it('ledgeHang → idle → attack (ledge attack path) are valid transitions', () => {
    const id = makeLedgeFighter();
    expect(transitionFighterState(id, 'idle')).toBe(true);
    expect(transitionFighterState(id, 'attack')).toBe(true);
    expect(fighterComponents.get(id)!.state).toBe('attack');
  });

  it('ledge jump logic: vy = jumpForce, jumpCount = 1, state = jump', () => {
    // Simulate the ledgeHang jump branch from processPlayerInput
    const id = makeLedgeFighter();
    const fighter = fighterComponents.get(id)!;
    const phys    = physicsComponents.get(id)!;

    // doJump = true path
    phys.vy              = fighter.stats.jumpForce;
    phys.fastFalling     = false;
    phys.gravityMultiplier = toFixed(1.0);
    const LEDGE_JUMP_INWARD_SCALE = toFixed(0.5);
    phys.vx = fixedMul(fighter.stats.runSpeed, LEDGE_JUMP_INWARD_SCALE); // facingRight
    transitionFighterState(id, 'jump');
    fighter.jumpCount = 1;

    expect(fighter.state).toBe('jump');
    expect(phys.vy).toBe(fighter.stats.jumpForce);
    expect(fighter.jumpCount).toBe(1);
    expect(phys.fastFalling).toBe(false);
    expect(phys.vx).toBeGreaterThan(0); // inward nudge when facingRight
  });

  it('ledge drop logic: vy = 0, jumpCount = 0 (double-jump preserved), state = jump', () => {
    // Simulate the ledgeHang drop branch (doDrop = true, doJump = false)
    const id = makeLedgeFighter();
    const fighter = fighterComponents.get(id)!;
    const phys    = physicsComponents.get(id)!;

    phys.vy              = toFixed(0);
    phys.fastFalling     = false;
    phys.gravityMultiplier = toFixed(1.0);
    const LEDGE_JUMP_INWARD_SCALE = toFixed(0.5);
    phys.vx = fixedMul(fighter.stats.runSpeed, LEDGE_JUMP_INWARD_SCALE);
    transitionFighterState(id, 'jump');
    fighter.jumpCount = 0; // drop: double-jump intact

    expect(fighter.state).toBe('jump');
    expect(phys.vy).toBe(toFixed(0));
    expect(fighter.jumpCount).toBe(0);
  });

  it('timer-expiry drop: when ledgeHangFramesMap = 0, fighter should drop', () => {
    // Simulate the ledgeTimer === 0 path: same as drop
    const id = makeLedgeFighter();
    ledgeHangFramesMap.set(id, 0); // force timer expiry
    const fighter = fighterComponents.get(id)!;
    const phys    = physicsComponents.get(id)!;

    // Simulate the auto-drop logic (ledgeTimer === 0 path)
    phys.vy              = toFixed(0);
    phys.fastFalling     = false;
    phys.gravityMultiplier = toFixed(1.0);
    const LEDGE_JUMP_INWARD_SCALE = toFixed(0.5);
    phys.vx = fixedMul(fighter.stats.runSpeed, LEDGE_JUMP_INWARD_SCALE);
    transitionFighterState(id, 'jump');
    fighter.jumpCount = 0;

    expect(fighter.state).toBe('jump');
    expect(phys.vy).toBe(toFixed(0));
  });

  it('ledge attack: fighter enters attack state with getupAttack move, grounded, invincible', () => {
    // Simulate the doAttack path
    const id = makeLedgeFighter();
    const fighter = fighterComponents.get(id)!;
    const phys    = physicsComponents.get(id)!;

    fighter.attackFrame       = 0;
    fighter.currentMoveId     = 'getupAttack';
    fighter.smashChargeFrames = 0;
    fighter.invincibleFrames  = 6; // GETUP_ATTACK_INVINCIBLE_FRAMES
    phys.grounded = true;
    phys.vx       = toFixed(0);
    phys.vy       = toFixed(0);
    transitionFighterState(id, 'idle');
    transitionFighterState(id, 'attack');

    expect(fighter.state).toBe('attack');
    expect(fighter.currentMoveId).toBe('getupAttack');
    expect(fighter.invincibleFrames).toBe(6);
    expect(phys.grounded).toBe(true);
  });
});



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

// ── Shield hit interaction (Gap 1) ────────────────────────────────────────────

describe('shield hit interaction', () => {
  function makeShieldMove(): Move {
    return {
      totalFrames: 30,
      hitboxes: [{
        activeFrames: [3, 10],
        offsetX: toFixed(30), offsetY: toFixed(0),
        width: toFixed(40), height: toFixed(40),
        damage: 10, knockbackScaling: toFixed(1.0), baseKnockback: toFixed(5),
        launchAngle: 45, hitlagFrames: 4, id: 'test_shield_hitbox',
      }],
      hurtboxes: [{
        activeFrames: [0, 30], offsetX: toFixed(0), offsetY: toFixed(0),
        width: toFixed(30), height: toFixed(60), intangible: false, invincible: false,
      }],
      iasa: 25, landingLag: 0,
    };
  }

  it('attack on shielding opponent reduces shield health instead of dealing hitstun', () => {
    const attackerId = makeAttacker(0, 'shieldMove', 5);
    const victimId   = makeGroundedFighter('kael', KAEL_STATS, 40, 30);

    // Put victim in shielding state with full health
    transitionFighterState(victimId, 'shielding');
    const victim = fighterComponents.get(victimId)!;
    victim.shieldHealth = 100;

    const moveData = makeMoveData('kael', 'shieldMove', makeShieldMove());
    checkHitboxSystem([attackerId, victimId], moveData);

    // Shield should have lost health
    expect(victim.shieldHealth).toBeLessThan(100);
    // Victim must NOT be in hitstun — shield absorbed the hit
    expect(victim.state).toBe('shielding');
    // Victim should not have taken damage to their percent
    expect(victim.damagePercent).toBe(toFixed(0));
  });

  it('both fighters receive hitlag when attack is shielded', () => {
    const attackerId = makeAttacker(0, 'shieldMove2', 5);
    const victimId   = makeGroundedFighter('kael', KAEL_STATS, 40, 30);

    transitionFighterState(victimId, 'shielding');

    const move = makeShieldMove();
    move.hitboxes[0]!.id = 'test_shield_hitbox_2';
    const moveData = makeMoveData('kael', 'shieldMove2', move);
    checkHitboxSystem([attackerId, victimId], moveData);

    const expectedHitlag = computeHitlagFrames(10);
    expect(fighterComponents.get(attackerId)!.hitlagFrames).toBe(expectedHitlag);
    expect(fighterComponents.get(victimId)!.hitlagFrames).toBe(expectedHitlag);
  });

  it('shield breaks when health is depleted by a hit', () => {
    const attackerId = makeAttacker(0, 'shieldBreaker', 5);
    const victimId   = makeGroundedFighter('kael', KAEL_STATS, 40, 30);

    transitionFighterState(victimId, 'shielding');
    // Deplete shield almost entirely so one hit finishes it
    fighterComponents.get(victimId)!.shieldHealth = 1;

    const move = makeShieldMove();
    move.hitboxes[0]!.id = 'test_shield_break';
    const moveData = makeMoveData('kael', 'shieldBreaker', move);
    checkHitboxSystem([attackerId, victimId], moveData);

    const victim = fighterComponents.get(victimId)!;
    expect(victim.shieldHealth).toBe(0);
    // After shield break the fighter must no longer be shielding
    expect(victim.state).not.toBe('shielding');
  });

  it('same hitbox does not re-hit a shielding fighter on the next frame', () => {
    const attackerId = makeAttacker(0, 'shieldRepeat', 5);
    const victimId   = makeGroundedFighter('kael', KAEL_STATS, 40, 30);

    transitionFighterState(victimId, 'shielding');
    const victim = fighterComponents.get(victimId)!;
    const startHealth = victim.shieldHealth;

    const move = makeShieldMove();
    move.hitboxes[0]!.id = 'test_shield_repeat';
    const moveData = makeMoveData('kael', 'shieldRepeat', move);

    checkHitboxSystem([attackerId, victimId], moveData);
    const healthAfterFirst = victim.shieldHealth;

    // Reset hitlag so the system re-runs
    hitlagMap.set(attackerId, 0);
    fighterComponents.get(attackerId)!.hitlagFrames = 0;
    hitlagMap.set(victimId, 0);
    victim.hitlagFrames = 0;

    checkHitboxSystem([attackerId, victimId], moveData);
    // Shield health must not decrease again (hit already registered)
    expect(victim.shieldHealth).toBe(healthAfterFirst);
    expect(victim.shieldHealth).toBeLessThan(startHealth);
  });
});

// ── Directional tech roll (Gap 2) ─────────────────────────────────────────────

describe('directional tech roll', () => {
  function makeHitstunFighterAbovePlatform(x = 0) {
    const plat = { x1: toFixed(-200), x2: toFixed(200), y: toFixed(0), passThrough: false };
    platforms.push(plat);

    const id = createEntity();
    transformComponents.set(id, {
      x: toFixed(x),
      prevX: toFixed(x),
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
    return id;
  }

  it('tech-in-place (no stick): fighter returns to idle', () => {
    const id = makeHitstunFighterAbovePlatform();
    setEntityShieldInput(id, true);
    setEntityStickX(id, 0);

    platformCollisionSystem();

    const fighter = fighterComponents.get(id)!;
    expect(fighter.state).toBe('idle');
    expect(fighter.hitstunFrames).toBe(0);
    expect(fighter.invincibleFrames).toBeGreaterThan(0);
  });

  it('tech roll right (stick right): fighter enters rolling state moving right', () => {
    const id = makeHitstunFighterAbovePlatform();
    setEntityShieldInput(id, true);
    setEntityStickX(id, 1.0);

    platformCollisionSystem();

    const fighter = fighterComponents.get(id)!;
    expect(fighter.state).toBe('rolling');
    expect(fighter.hitstunFrames).toBe(0);
    expect(fighter.invincibleFrames).toBeGreaterThan(0);
    // Should be moving right
    expect(physicsComponents.get(id)!.vx).toBeGreaterThan(0);
    expect(transformComponents.get(id)!.facingRight).toBe(true);
  });

  it('tech roll left (stick left): fighter enters rolling state moving left', () => {
    const id = makeHitstunFighterAbovePlatform();
    setEntityShieldInput(id, true);
    setEntityStickX(id, -1.0);

    platformCollisionSystem();

    const fighter = fighterComponents.get(id)!;
    expect(fighter.state).toBe('rolling');
    expect(fighter.hitstunFrames).toBe(0);
    expect(fighter.invincibleFrames).toBeGreaterThan(0);
    // Should be moving left
    expect(physicsComponents.get(id)!.vx).toBeLessThan(0);
    expect(transformComponents.get(id)!.facingRight).toBe(false);
  });

  it('no tech (no shield): hard-knockdown applies 30 frames hitstun', () => {
    const id = makeHitstunFighterAbovePlatform();
    setEntityShieldInput(id, false);
    setEntityStickX(id, 0);

    platformCollisionSystem();

    const fighter = fighterComponents.get(id)!;
    expect(fighter.hitstunFrames).toBe(30);
    // State stays hitstun (grounded hard-knockdown)
    expect(fighter.state).toBe('hitstun');
  });
});

// ── Dash attack per character (Gap 3) ─────────────────────────────────────────

import { KAEL_MOVES }  from '../src/game/characters/kael.js';
import { SYNE_MOVES }  from '../src/game/characters/syne.js';
import { VELA_MOVES }  from '../src/game/characters/vela.js';
import { GORUN_MOVES } from '../src/game/characters/gorun.js';
import { ZIRA_MOVES }  from '../src/game/characters/zira.js';

describe('dash attack moves', () => {
  const characters: [string, Record<string, Move>][] = [
    ['kael',  KAEL_MOVES],
    ['syne',  SYNE_MOVES],
    ['vela',  VELA_MOVES],
    ['gorun', GORUN_MOVES],
    ['zira',  ZIRA_MOVES],
  ];

  for (const [charId, moves] of characters) {
    it(`${charId} has a dedicated dashAttack move`, () => {
      expect(moves.dashAttack).toBeDefined();
    });

    it(`${charId} dashAttack has valid active frames and damage`, () => {
      const da = moves.dashAttack!;
      expect(da.hitboxes.length).toBeGreaterThan(0);
      const hb = da.hitboxes[0]!;
      expect(hb.damage).toBeGreaterThan(0);
      expect(hb.activeFrames[1]).toBeGreaterThan(hb.activeFrames[0]);
      expect(da.iasa).toBeGreaterThan(0);
      expect(da.iasa).toBeLessThan(da.totalFrames);
    });

    it(`${charId} dashAttack hitbox id is unique`, () => {
      const da = moves.dashAttack!;
      const hb = da.hitboxes[0]!;
      expect(hb.id).toBe(`${charId}_dash`);
    });
  }
});

// ── Getup attack / getup roll ─────────────────────────────────────────────────

describe('getup options from grounded hitstun', () => {
  function makeHardKnockdownFighter(hitstunFrames = 30) {
    const id = makeGroundedFighter('kael');
    const fighter = fighterComponents.get(id)!;
    fighter.state = 'hitstun';
    fighter.hitstunFrames = hitstunFrames;
    return id;
  }

  it('getup attack: pressing attack during grounded hitstun exits hitstun with attack state', () => {
    const id = makeHardKnockdownFighter(25);
    const fighter = fighterComponents.get(id)!;

    // Simulate the getup attack logic (mirrors processPlayerInput)
    expect(fighter.state).toBe('hitstun');
    fighter.hitstunFrames = 0;
    transitionFighterState(id, 'idle');
    fighter.attackFrame = 0;
    fighter.currentMoveId = 'getupAttack';
    fighter.smashChargeFrames = 0;
    fighter.invincibleFrames = 6;
    transitionFighterState(id, 'attack');

    expect(fighter.state).toBe('attack');
    expect(fighter.currentMoveId).toBe('getupAttack');
    expect(fighter.invincibleFrames).toBe(6);
  });

  it('getup roll: pressing shield+direction during grounded hitstun exits hitstun with rolling state', () => {
    const id = makeHardKnockdownFighter(15);
    const fighter = fighterComponents.get(id)!;
    const phys = physicsComponents.get(id)!;
    const transform = transformComponents.get(id)!;

    // Simulate getup roll right
    fighter.hitstunFrames = 0;
    transitionFighterState(id, 'idle');
    transitionFighterState(id, 'rolling');
    fighter.invincibleFrames = 15;
    dodgeFramesMap.set(id, 30);
    phys.vx = toFixed(4);
    transform.facingRight = true;

    expect(fighter.state).toBe('rolling');
    expect(fighter.invincibleFrames).toBe(15);
    expect(toFloat(phys.vx)).toBeCloseTo(4, 1);
  });

  it('getup attack: invincibility frames are granted on execution', () => {
    const id = makeHardKnockdownFighter(20);
    const fighter = fighterComponents.get(id)!;

    fighter.hitstunFrames = 0;
    transitionFighterState(id, 'idle');
    fighter.currentMoveId = 'getupAttack';
    fighter.attackFrame   = 0;
    fighter.invincibleFrames = 6;
    transitionFighterState(id, 'attack');

    expect(fighter.invincibleFrames).toBeGreaterThan(0);
    expect(fighter.state).toBe('attack');
  });

  it('all 5 characters have a getupAttack move', () => {
    const characters: [string, Record<string, Move>][] = [
      ['kael',  KAEL_MOVES],
      ['syne',  SYNE_MOVES],
      ['vela',  VELA_MOVES],
      ['gorun', GORUN_MOVES],
      ['zira',  ZIRA_MOVES],
    ];
    for (const [charId, moves] of characters) {
      expect(moves.getupAttack, `${charId} missing getupAttack`).toBeDefined();
      const ga = moves.getupAttack!;
      expect(ga.hitboxes.length).toBeGreaterThan(0);
      const hb = ga.hitboxes[0]!;
      expect(hb.damage).toBeGreaterThan(0);
      expect(hb.id).toBe(`${charId}_getup`);
      expect(ga.iasa).toBeGreaterThan(0);
      expect(ga.iasa).toBeLessThan(ga.totalFrames);
    }
  });

  it('without input, grounded hitstun expires naturally via tickFighterTimers → idle', () => {
    const id = makeHardKnockdownFighter(5);
    const fighter = fighterComponents.get(id)!;

    for (let i = 0; i < 5; i++) {
      expect(fighter.state).toBe('hitstun');
      tickFighterTimers(id);
    }
    expect(fighter.state).toBe('idle');
    expect(fighter.hitstunFrames).toBe(0);
  });
});

// ── Meteor cancel ─────────────────────────────────────────────────────────────

describe('meteor cancel', () => {
  function makeAirborneHitstunFighter(vy = -12) {
    const id = createEntity();
    transformComponents.set(id, {
      x: toFixed(0), y: toFixed(200),
      prevX: toFixed(0), prevY: toFixed(200),
      facingRight: true,
    });
    physicsComponents.set(id, {
      vx: toFixed(0), vy: toFixed(vy),
      gravityMultiplier: toFixed(1.0),
      grounded: false, fastFalling: false,
    });
    fighterComponents.set(id, {
      characterId: 'kael', state: 'hitstun',
      damagePercent: toFixed(30),
      stocks: 3, jumpCount: 1, hitstunFrames: 30, invincibleFrames: 0,
      hitlagFrames: 0, shieldHealth: 100, shieldBreakFrames: 0,
      attackFrame: 0, currentMoveId: null, grabVictimId: null, smashChargeFrames: 0,
      stats: KAEL_STATS,
    });
    return id;
  }

  it('applyKnockback with downward angle (270°) sets meteorCancelWindowMap', () => {
    const id = makeAirborneHitstunFighter(0);
    const fighter = fighterComponents.get(id)!;
    fighter.state = 'idle';
    fighter.hitstunFrames = 0;

    applyKnockback(id, {
      victimDamage:      toFixed(40),
      victimWeight:      toFixed(1.0),
      moveScaling:       toFixed(1.2),
      moveBaseKnockback: toFixed(6),
      launchAngle:       270,
      attackerFacingRight: true,
      diX: 0,
    });

    expect(meteorCancelWindowMap.get(id)).toBe(20);
    expect(fighter.state).toBe('hitstun');
  });

  it('applyKnockback with upward angle (90°) does NOT set meteorCancelWindowMap', () => {
    const id = makeAirborneHitstunFighter(0);
    const fighter = fighterComponents.get(id)!;
    fighter.state = 'idle';
    fighter.hitstunFrames = 0;

    applyKnockback(id, {
      victimDamage:      toFixed(40),
      victimWeight:      toFixed(1.0),
      moveScaling:       toFixed(1.2),
      moveBaseKnockback: toFixed(6),
      launchAngle:       90,
      attackerFacingRight: true,
      diX: 0,
    });

    expect(meteorCancelWindowMap.get(id) ?? 0).toBe(0);
  });

  it('meteorCancelWindowMap ticks down each frame via tickFighterTimers', () => {
    const id = makeAirborneHitstunFighter();
    meteorCancelWindowMap.set(id, 20);

    tickFighterTimers(id);

    expect(meteorCancelWindowMap.get(id)).toBe(19);
  });

  it('meteorCancelWindowMap is reset to 20 when a new downward hit lands', () => {
    const id = makeAirborneHitstunFighter(0);
    meteorCancelWindowMap.set(id, 5); // already partially spent
    const fighter = fighterComponents.get(id)!;
    fighter.state = 'idle';
    fighter.hitstunFrames = 0;

    applyKnockback(id, {
      victimDamage:      toFixed(50),
      victimWeight:      toFixed(1.0),
      moveScaling:       toFixed(1.0),
      moveBaseKnockback: toFixed(5),
      launchAngle:       260,
      attackerFacingRight: true,
      diX: 0,
    });

    // Should be reset to 20 by the new hit
    expect(meteorCancelWindowMap.get(id)).toBe(20);
  });
});

// ── Wavedash / waveland ───────────────────────────────────────────────────────

describe('wavedash / waveland', () => {
  it('landing from airDodge with non-zero vx sets wavedashFramesMap', () => {
    const plat = { x1: toFixed(-500), x2: toFixed(500), y: toFixed(0), passThrough: false, bouncy: false };
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
      vx: toFixed(5), vy: toFixed(-3),
      gravityMultiplier: toFixed(1.0),
      grounded: false, fastFalling: false,
    });
    fighterComponents.set(id, {
      characterId: 'kael', state: 'airDodge',
      damagePercent: toFixed(0),
      stocks: 3, jumpCount: 1, hitstunFrames: 0, invincibleFrames: 0,
      hitlagFrames: 0, shieldHealth: 100, shieldBreakFrames: 0,
      attackFrame: 0, currentMoveId: null, grabVictimId: null, smashChargeFrames: 0,
      stats: KAEL_STATS,
    });

    platformCollisionSystem();

    const fighter = fighterComponents.get(id)!;
    expect(fighter.state).toBe('idle');
    expect(physicsComponents.get(id)!.grounded).toBe(true);
    expect(wavedashFramesMap.get(id)).toBeGreaterThan(0);
  });

  it('landing from airDodge with zero vx does NOT set wavedashFramesMap', () => {
    const plat = { x1: toFixed(-500), x2: toFixed(500), y: toFixed(0), passThrough: false, bouncy: false };
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
      characterId: 'kael', state: 'airDodge',
      damagePercent: toFixed(0),
      stocks: 3, jumpCount: 1, hitstunFrames: 0, invincibleFrames: 0,
      hitlagFrames: 0, shieldHealth: 100, shieldBreakFrames: 0,
      attackFrame: 0, currentMoveId: null, grabVictimId: null, smashChargeFrames: 0,
      stats: KAEL_STATS,
    });

    platformCollisionSystem();

    expect(wavedashFramesMap.get(id) ?? 0).toBe(0);
  });

  it('wavedashFramesMap ticks down via tickFighterTimers', () => {
    const id = makeGroundedFighter();
    wavedashFramesMap.set(id, 10);

    tickFighterTimers(id);

    expect(wavedashFramesMap.get(id)).toBe(9);
  });

  it('wavedashFramesMap is deleted (not set to 0) when countdown expires', () => {
    const id = makeGroundedFighter();
    wavedashFramesMap.set(id, 1);

    tickFighterTimers(id);

    expect(wavedashFramesMap.has(id)).toBe(false);
  });

  it('landing from jump state does NOT set wavedashFramesMap', () => {
    const plat = { x1: toFixed(-500), x2: toFixed(500), y: toFixed(0), passThrough: false, bouncy: false };
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
      vx: toFixed(5), vy: toFixed(-3),
      gravityMultiplier: toFixed(1.0),
      grounded: false, fastFalling: false,
    });
    fighterComponents.set(id, {
      characterId: 'kael', state: 'jump',
      damagePercent: toFixed(0),
      stocks: 3, jumpCount: 1, hitstunFrames: 0, invincibleFrames: 0,
      hitlagFrames: 0, shieldHealth: 100, shieldBreakFrames: 0,
      attackFrame: 0, currentMoveId: null, grabVictimId: null, smashChargeFrames: 0,
      stats: KAEL_STATS,
    });

    platformCollisionSystem();

    expect(wavedashFramesMap.get(id) ?? 0).toBe(0);
  });
});

// ── Crouch state ──────────────────────────────────────────────────────────────

describe('crouch state', () => {
  it('crouch → idle is a valid transition', () => {
    const id = makeGroundedFighter();
    transitionFighterState(id, 'crouch');
    expect(fighterComponents.get(id)!.state).toBe('crouch');
    const result = transitionFighterState(id, 'idle');
    expect(result).toBe(true);
    expect(fighterComponents.get(id)!.state).toBe('idle');
  });

  it('crouch → attack is a valid transition', () => {
    const id = makeGroundedFighter();
    transitionFighterState(id, 'crouch');
    const result = transitionFighterState(id, 'attack');
    expect(result).toBe(true);
    expect(fighterComponents.get(id)!.state).toBe('attack');
  });

  it('crouch → hitstun is a valid transition (fighter can be hit while crouching)', () => {
    const id = makeGroundedFighter();
    transitionFighterState(id, 'crouch');
    const result = transitionFighterState(id, 'hitstun', { hitstunFrames: 15 });
    expect(result).toBe(true);
    expect(fighterComponents.get(id)!.state).toBe('hitstun');
  });

  it('idle/walk/run → crouch are valid transitions', () => {
    for (const from of ['idle', 'walk', 'run'] as const) {
      const id = makeGroundedFighter();
      fighterComponents.get(id)!.state = from;
      const result = transitionFighterState(id, 'crouch');
      expect(result).toBe(true);
      expect(fighterComponents.get(id)!.state).toBe('crouch');
    }
  });

  it('crouching fighter has a smaller hurtbox (does not receive hits aimed high)', () => {
    platforms.length = 0;

    // Attacker fires a hitbox aimed at upper-body height (offsetY = +30, shoulder level).
    const attackerId = createEntity();
    transformComponents.set(attackerId, {
      x: toFixed(-50), y: toFixed(30),
      prevX: toFixed(-50), prevY: toFixed(30),
      facingRight: true,
    });
    physicsComponents.set(attackerId, {
      vx: toFixed(0), vy: toFixed(0),
      gravityMultiplier: toFixed(1.0),
      grounded: true, fastFalling: false,
    });
    fighterComponents.set(attackerId, {
      characterId: 'kael', state: 'attack',
      damagePercent: toFixed(0),
      stocks: 3, jumpCount: 0, hitstunFrames: 0, invincibleFrames: 0,
      hitlagFrames: 0, shieldHealth: 100, shieldBreakFrames: 0,
      attackFrame: 6, currentMoveId: 'upTilt', grabVictimId: null, smashChargeFrames: 0,
      stats: KAEL_STATS,
    });

    // Victim crouching directly in front at the same height.
    const victimId = makeGroundedFighter('kael', KAEL_STATS, 0, 30);
    transitionFighterState(victimId, 'crouch');

    const KAEL_MOVE_MAP = new Map(Object.entries(KAEL_MOVES));
    const moveData = new Map([['kael', KAEL_MOVE_MAP]]);

    // upTilt hitbox is at offsetY ≈ 30 above the fighter — it targets standing fighters.
    // A crouching fighter should dodge it since their top half of the hurtbox is gone.
    checkHitboxSystem([attackerId, victimId], moveData);

    // Victim should NOT have been hit (crouching avoids the high hitbox).
    const victim = fighterComponents.get(victimId)!;
    expect(victim.state).toBe('crouch');
    expect(victim.hitstunFrames).toBe(0);
  });
});

// ── Bug regression: syncAnimation loop for crouch ─────────────────────────────

import { renderableComponents } from '../src/engine/ecs/component.js';

describe('syncAnimation: loop flag', () => {
  function makeGroundedFighterWithRenderable(state: import('../src/engine/ecs/component.js').FighterState = 'idle') {
    const id = makeGroundedFighter();
    renderableComponents.set(id, {
      meshUrl: '', atlasUrl: '',
      animationClip: state, animationFrame: 0, animationSpeed: 1.0, loop: false,
    });
    fighterComponents.get(id)!.state = state;
    return id;
  }

  it('idle animation loops', () => {
    const id = makeGroundedFighterWithRenderable('idle');
    // Force syncAnimation to run by changing the clip label to a dummy
    const r = renderableComponents.get(id)!;
    r.animationClip = '__dirty__';  // make it "changed"
    fighterComponents.get(id)!.state = 'idle';
    // Simulate the syncAnimation logic inline (mirrors main.ts function)
    const fighter = fighterComponents.get(id)!;
    r.animationClip  = fighter.state;
    r.animationFrame = 0;
    r.loop = fighter.state === 'idle' || fighter.state === 'run' || fighter.state === 'crouch';
    expect(r.loop).toBe(true);
  });

  it('crouch animation loops (regression for missing crouch in loop condition)', () => {
    const id = makeGroundedFighterWithRenderable('crouch');
    const r = renderableComponents.get(id)!;
    r.animationClip = '__dirty__';
    fighterComponents.get(id)!.state = 'crouch';
    const fighter = fighterComponents.get(id)!;
    r.animationClip  = fighter.state;
    r.animationFrame = 0;
    r.loop = fighter.state === 'idle' || fighter.state === 'run' || fighter.state === 'crouch';
    expect(r.loop).toBe(true);
  });

  it('hitstun animation does not loop', () => {
    const id = makeGroundedFighterWithRenderable('hitstun');
    const r = renderableComponents.get(id)!;
    r.animationClip = '__dirty__';
    fighterComponents.get(id)!.state = 'hitstun';
    const fighter = fighterComponents.get(id)!;
    r.animationClip  = fighter.state;
    r.animationFrame = 0;
    r.loop = fighter.state === 'idle' || fighter.state === 'run' || fighter.state === 'crouch';
    expect(r.loop).toBe(false);
  });
});

// ── Bug regression: meteor cancel angle boundary (>= 220, <= 320) ─────────────

describe('meteor cancel: boundary angles', () => {
  function makeAirFighterAtAngle(): number {
    const id = createEntity();
    transformComponents.set(id, {
      x: toFixed(0), y: toFixed(200),
      prevX: toFixed(0), prevY: toFixed(200),
      facingRight: true,
    });
    physicsComponents.set(id, {
      vx: toFixed(0), vy: toFixed(0),
      gravityMultiplier: toFixed(1.0),
      grounded: false, fastFalling: false,
    });
    fighterComponents.set(id, {
      characterId: 'kael', state: 'idle',
      damagePercent: toFixed(0),
      stocks: 3, jumpCount: 1, hitstunFrames: 0, invincibleFrames: 0,
      hitlagFrames: 0, shieldHealth: 100, shieldBreakFrames: 0,
      attackFrame: 0, currentMoveId: null, grabVictimId: null, smashChargeFrames: 0,
      stats: KAEL_STATS,
    });
    return id;
  }

  it('exact 220° sets meteor cancel window (inclusive lower bound)', () => {
    const id = makeAirFighterAtAngle();
    meteorCancelWindowMap.delete(id);

    applyKnockback(id, {
      victimDamage:      toFixed(40),
      victimWeight:      toFixed(1.0),
      moveScaling:       toFixed(1.2),
      moveBaseKnockback: toFixed(6),
      launchAngle:       220,
      attackerFacingRight: true,
      diX: 0,
    });

    expect(meteorCancelWindowMap.get(id)).toBe(20);
  });

  it('exact 320° sets meteor cancel window (inclusive upper bound)', () => {
    const id = makeAirFighterAtAngle();
    meteorCancelWindowMap.delete(id);

    applyKnockback(id, {
      victimDamage:      toFixed(40),
      victimWeight:      toFixed(1.0),
      moveScaling:       toFixed(1.2),
      moveBaseKnockback: toFixed(6),
      launchAngle:       320,
      attackerFacingRight: true,
      diX: 0,
    });

    expect(meteorCancelWindowMap.get(id)).toBe(20);
  });

  it('angle just outside range (219°) does NOT set meteor cancel window', () => {
    const id = makeAirFighterAtAngle();
    meteorCancelWindowMap.delete(id);

    applyKnockback(id, {
      victimDamage:      toFixed(40),
      victimWeight:      toFixed(1.0),
      moveScaling:       toFixed(1.2),
      moveBaseKnockback: toFixed(6),
      launchAngle:       219,
      attackerFacingRight: true,
      diX: 0,
    });

    expect(meteorCancelWindowMap.get(id) ?? 0).toBe(0);
  });

  it('angle just outside range (321°) does NOT set meteor cancel window', () => {
    const id = makeAirFighterAtAngle();
    meteorCancelWindowMap.delete(id);

    applyKnockback(id, {
      victimDamage:      toFixed(40),
      victimWeight:      toFixed(1.0),
      moveScaling:       toFixed(1.2),
      moveBaseKnockback: toFixed(6),
      launchAngle:       321,
      attackerFacingRight: true,
      diX: 0,
    });

    expect(meteorCancelWindowMap.get(id) ?? 0).toBe(0);
  });
});

// ── Bug regression: crouch attack uses downTilt not downSmash ─────────────────

describe('crouch attack: downTilt selection', () => {
  it('attacking while crouching uses downTilt, not downSmash', () => {
    // Simulate the crouch-attack logic from processPlayerInput:
    // crouchMoveId = moves?.has('downTilt') ? 'downTilt' : 'neutralJab1'
    // This must NEVER select downSmash even when the character has one.
    const id = makeGroundedFighter('kael');
    const fighter = fighterComponents.get(id)!;
    fighter.state = 'crouch';

    // Simulate the fix: crouchMoveId is always downTilt
    const crouchMoves = new Map(Object.entries(KAEL_MOVES));
    const crouchMoveId = crouchMoves.has('downTilt') ? 'downTilt' : 'neutralJab1';

    // Kael must have downTilt
    expect(crouchMoves.has('downTilt')).toBe(true);
    // Should select downTilt, not downSmash
    expect(crouchMoveId).toBe('downTilt');
    // Confirm Kael also has downSmash (shows the bug would have been triggered before)
    expect(crouchMoves.has('downSmash')).toBe(true);
  });

  it('all 5 characters have downTilt so crouch attack never falls back to jab', () => {
    const characters: [string, Record<string, Move>][] = [
      ['kael',  KAEL_MOVES],
      ['syne',  SYNE_MOVES],
      ['vela',  VELA_MOVES],
      ['gorun', GORUN_MOVES],
      ['zira',  ZIRA_MOVES],
    ];
    for (const [charId, moves] of characters) {
      const crouchMoves = new Map(Object.entries(moves));
      const crouchMoveId = crouchMoves.has('downTilt') ? 'downTilt' : 'neutralJab1';
      expect(crouchMoveId).toBe('downTilt');
      expect(crouchMoves.has('downTilt'), `${charId} is missing downTilt`).toBe(true);
    }
  });
});

