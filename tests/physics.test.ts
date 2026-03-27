// tests/physics.test.ts
// Phase 1 acceptance tests

import { describe, it, expect, beforeEach } from 'vitest';

// ── Fixed-point arithmetic ────────────────────────────────────────────────────
import {
  toFixed,
  toFloat,
  fixedMul,
  fixedAdd,
  fixedSub,
  fixedDiv,
  FRAC_SCALE,
} from '../src/engine/physics/fixednum.js';

describe('fixednum', () => {
  it('toFixed(1.5) === 98304', () => {
    expect(toFixed(1.5)).toBe(98304);
  });

  it('toFixed/toFloat round-trip within 1 ULP', () => {
    const values = [0, 1, -1, 1.5, -1.5, 0.09, -0.09, 100, -100, 0.001];
    for (const v of values) {
      const f = toFixed(v);
      const rt = toFloat(f);
      // 1 ULP in Q16.16 = 1/65536 ≈ 1.526e-5
      expect(Math.abs(rt - v)).toBeLessThanOrEqual(1 / FRAC_SCALE + Number.EPSILON);
    }
  });

  it('fixedMul(toFixed(2), toFixed(3)) === toFixed(6)', () => {
    expect(fixedMul(toFixed(2), toFixed(3))).toBe(toFixed(6));
  });

  it('fixedAdd(toFixed(1), toFixed(2)) === toFixed(3)', () => {
    expect(fixedAdd(toFixed(1), toFixed(2))).toBe(toFixed(3));
  });

  it('fixedSub(toFixed(5), toFixed(3)) === toFixed(2)', () => {
    expect(fixedSub(toFixed(5), toFixed(3))).toBe(toFixed(2));
  });

  it('fixedDiv(toFixed(6), toFixed(2)) === toFixed(3)', () => {
    expect(fixedDiv(toFixed(6), toFixed(2))).toBe(toFixed(3));
  });
});

// ── Gravity ───────────────────────────────────────────────────────────────────
import { GRAVITY } from '../src/engine/physics/gravity.js';
import {
  transformComponents,
  physicsComponents,
  fighterComponents,
} from '../src/engine/ecs/component.js';
import { createEntity, resetEntityCounter } from '../src/engine/ecs/entity.js';
import { KAEL_STATS } from '../src/game/characters/kael.js';

function makeAirborneEntity() {
  const id = createEntity();
  transformComponents.set(id, {
    x: toFixed(0), y: toFixed(100),
    prevX: toFixed(0), prevY: toFixed(100),
    facingRight: true,
  });
  physicsComponents.set(id, {
    vx: toFixed(0), vy: toFixed(0),
    gravityMultiplier: toFixed(1.0),
    grounded: false, fastFalling: false,
  });
  fighterComponents.set(id, {
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
  return id;
}

import { applyGravitySystem } from '../src/engine/physics/gravity.js';

describe('gravity', () => {
  beforeEach(() => {
    transformComponents.clear();
    physicsComponents.clear();
    fighterComponents.clear();
    resetEntityCounter();
  });

  it('velocity decreases by GRAVITY each frame for airborne entity', () => {
    const id = makeAirborneEntity();
    const phys = physicsComponents.get(id)!;

    applyGravitySystem();

    // After one frame: vy should equal GRAVITY * 1.0 = GRAVITY
    expect(phys.vy).toBe(fixedAdd(toFixed(0), fixedMul(GRAVITY, toFixed(1.0))));
  });

  it('velocity decreases by GRAVITY * gravityMultiplier per frame', () => {
    const id = makeAirborneEntity();
    const phys = physicsComponents.get(id)!;

    // Apply 3 frames
    for (let i = 0; i < 3; i++) {
      applyGravitySystem();
    }

    // vy after 3 frames = 3 * GRAVITY
    const expected = fixedMul(toFixed(3), GRAVITY);
    // Allow ±1 ULP tolerance for accumulation
    expect(Math.abs(phys.vy - expected)).toBeLessThanOrEqual(1);
  });

  it('clamped at maxFallSpeed after 100 frames', () => {
    const id = makeAirborneEntity();
    const phys = physicsComponents.get(id)!;

    for (let i = 0; i < 100; i++) {
      applyGravitySystem();
    }

    // vy must not be less than maxFallSpeed
    expect(phys.vy).toBeGreaterThanOrEqual(KAEL_STATS.maxFallSpeed);
    // And should equal exactly maxFallSpeed (was clamped)
    expect(phys.vy).toBe(KAEL_STATS.maxFallSpeed);
  });

  it('fast-fall clamps at maxFastFallSpeed', () => {
    const id = makeAirborneEntity();
    const phys = physicsComponents.get(id)!;
    phys.fastFalling = true;
    phys.gravityMultiplier = toFixed(2.5);

    for (let i = 0; i < 100; i++) {
      applyGravitySystem();
    }

    expect(phys.vy).toBeGreaterThanOrEqual(KAEL_STATS.maxFastFallSpeed);
    expect(phys.vy).toBe(KAEL_STATS.maxFastFallSpeed);
  });
});

// ── Platform collision ────────────────────────────────────────────────────────
import {
  platforms,
  checkPlatformLanding,
  platformCollisionSystem,
  FIGHTER_HALF_HEIGHT,
  setEntityPassThroughInput,
} from '../src/engine/physics/collision.js';

function makePlatform(passThrough = false) {
  return {
    x1: toFixed(-200),
    x2: toFixed(200),
    y: toFixed(0),
    passThrough,
  };
}

describe('collision', () => {
  beforeEach(() => {
    transformComponents.clear();
    physicsComponents.clear();
    fighterComponents.clear();
    resetEntityCounter();
    platforms.length = 0;
  });

  it('entity lands on platform when crossing from above', () => {
    const plat = makePlatform();
    // Entity bottom was above platform.y, now below
    const id = createEntity();
    transformComponents.set(id, {
      x: toFixed(0),
      prevX: toFixed(0),
      // prevY such that prevBottom = platform.y + 1 (above)
      prevY: plat.y + FIGHTER_HALF_HEIGHT + toFixed(1),
      // y such that currBottom = platform.y - 1 (crossed)
      y: plat.y + FIGHTER_HALF_HEIGHT - toFixed(1),
      facingRight: true,
    });
    physicsComponents.set(id, {
      vx: toFixed(0),
      vy: toFixed(-2),
      gravityMultiplier: toFixed(1.0),
      grounded: false,
      fastFalling: false,
    });
    fighterComponents.set(id, {
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

    expect(checkPlatformLanding(id, plat)).toBe(true);
  });

  it('entity does not land when moving upward', () => {
    const plat = makePlatform();
    const id = createEntity();
    transformComponents.set(id, {
      x: toFixed(0),
      prevX: toFixed(0),
      prevY: plat.y + FIGHTER_HALF_HEIGHT - toFixed(5),
      y: plat.y + FIGHTER_HALF_HEIGHT + toFixed(5),
      facingRight: true,
    });
    physicsComponents.set(id, {
      vx: toFixed(0),
      vy: toFixed(2), // moving UP
      gravityMultiplier: toFixed(1.0),
      grounded: false,
      fastFalling: false,
    });
    fighterComponents.set(id, {
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

    expect(checkPlatformLanding(id, plat)).toBe(false);
  });

  it('entity passes through platform when stick is held down', () => {
    const plat = makePlatform(true); // passThrough = true
    const id = createEntity();
    transformComponents.set(id, {
      x: toFixed(0),
      prevX: toFixed(0),
      prevY: plat.y + FIGHTER_HALF_HEIGHT + toFixed(1),
      y: plat.y + FIGHTER_HALF_HEIGHT - toFixed(1),
      facingRight: true,
    });
    physicsComponents.set(id, {
      vx: toFixed(0),
      vy: toFixed(-2),
      gravityMultiplier: toFixed(1.0),
      grounded: false,
      fastFalling: false,
    });
    fighterComponents.set(id, {
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

    // Set down-input (pass-through)
    setEntityPassThroughInput(id, true);

    expect(checkPlatformLanding(id, plat)).toBe(false);
  });

  it('platformCollisionSystem snaps entity to surface on landing', () => {
    const plat = makePlatform();
    platforms.push(plat);

    const id = createEntity();
    transformComponents.set(id, {
      x: toFixed(0),
      prevX: toFixed(0),
      prevY: plat.y + FIGHTER_HALF_HEIGHT + toFixed(2),
      y: plat.y + FIGHTER_HALF_HEIGHT - toFixed(2),
      facingRight: true,
    });
    const phys = {
      vx: toFixed(0),
      vy: toFixed(-3),
      gravityMultiplier: toFixed(1.0),
      grounded: false,
      fastFalling: false,
    };
    physicsComponents.set(id, phys);
    fighterComponents.set(id, {
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

    platformCollisionSystem();

    expect(phys.grounded).toBe(true);
    expect(phys.vy).toBe(0);
    const transform = transformComponents.get(id)!;
    expect(transform.y).toBe(plat.y + FIGHTER_HALF_HEIGHT);
  });
});

// ── Game loop ─────────────────────────────────────────────────────────────────
import { simulateFrames, FIXED_STEP_MS } from '../src/engine/loop.js';

describe('game loop', () => {
  it('fires exactly 60 physics steps per simulated second', () => {
    let count = 0;
    simulateFrames(60, () => { count++; });
    expect(count).toBe(60);
  });

  it('FIXED_STEP_MS is approximately 16.667 ms', () => {
    expect(Math.abs(FIXED_STEP_MS - 1000 / 60)).toBeLessThan(0.001);
  });
});
