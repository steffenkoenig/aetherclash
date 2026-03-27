# Implementation — Build Guide

## Overview

This guide provides step-by-step technical implementation guidelines for each major system in Aether Clash. It expands on the [Roadmap](roadmap.md) phases with specific coding guidelines, patterns, and pitfalls to avoid.

---

## 1. Project Setup

### Initialise the Project

```bash
npm create vite@latest aetherclash -- --template vanilla-ts
cd aetherclash
npm install
```

### Recommended Additional Packages

```bash
npm install --save-dev eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin prettier
npm install --save-dev vitest                         # unit testing
```

No runtime dependencies are required for the game engine. Three.js is optional for the renderer — raw WebGL 2.0 keeps the bundle size minimal.

### Folder Structure

```
aetherclash/
├── src/
│   ├── engine/
│   │   ├── loop.ts          # Game loop
│   │   ├── ecs/             # Entity-Component-System
│   │   │   ├── entity.ts
│   │   │   ├── component.ts
│   │   │   └── system.ts
│   │   ├── physics/
│   │   │   ├── gravity.ts
│   │   │   ├── collision.ts
│   │   │   ├── knockback.ts
│   │   │   └── fixednum.ts  # Q16.16 fixed-point arithmetic
│   │   ├── input/
│   │   │   ├── keyboard.ts
│   │   │   ├── gamepad.ts
│   │   │   └── buffer.ts
│   │   └── net/
│   │       ├── rollback.ts
│   │       ├── webrtc.ts
│   │       └── websocket.ts
│   ├── game/
│   │   ├── characters/      # Per-character data (stats, move sets)
│   │   ├── stages/          # Per-stage layout data
│   │   ├── items/           # Item behaviour
│   │   └── state.ts         # Match state
│   ├── renderer/
│   │   ├── gl.ts            # WebGL context setup
│   │   ├── camera.ts
│   │   ├── models.ts
│   │   ├── particles.ts
│   │   └── hud.ts
│   ├── audio/
│   │   └── audio.ts
│   └── main.ts              # Entry point
├── public/
│   └── assets/              # Textures, audio files
├── server/
│   └── signalling.ts        # WebSocket signalling server (Node.js)
├── tests/
│   ├── physics.test.ts
│   ├── rollback.test.ts
│   └── determinism.test.ts
└── vite.config.ts
```

---

## 2. Fixed-Point Arithmetic

All physics values must use deterministic fixed-point arithmetic to guarantee identical results across browsers and CPU architectures.

### Q16.16 Implementation

```typescript
// src/engine/physics/fixednum.ts

// A Q16.16 fixed-point number is stored as a 32-bit integer.
// The high 16 bits are the integer part, the low 16 bits are the fraction.
// Example: 1.5 is stored as 0x00018000 = 98304

type Fixed = number; // Tagged type: always an integer representing Q16.16

const FRAC_BITS = 16;
const FRAC_SCALE = 1 << FRAC_BITS; // 65536

export function toFixed(n: number): Fixed {
  return Math.round(n * FRAC_SCALE) | 0;
}

export function toFloat(f: Fixed): number {
  return f / FRAC_SCALE;
}

export function fixedMul(a: Fixed, b: Fixed): Fixed {
  // Use BigInt for intermediate multiplication to avoid overflow
  return Number((BigInt(a) * BigInt(b)) >> BigInt(FRAC_BITS)) | 0;
}

export function fixedDiv(a: Fixed, b: Fixed): Fixed {
  return Number((BigInt(a) << BigInt(FRAC_BITS)) / BigInt(b)) | 0;
}

// Addition and subtraction are plain integer operations — no scaling needed
export function fixedAdd(a: Fixed, b: Fixed): Fixed { return (a + b) | 0; }
export function fixedSub(a: Fixed, b: Fixed): Fixed { return (a - b) | 0; }
```

**Rule:** All positions (`x`, `y`), velocities (`vx`, `vy`), and physics constants (`gravity`, knockback values) are stored as `Fixed`. Only convert to `number` for rendering (renderer operates in float space).

---

## 3. Physics Sandbox (Phase 1)

### Game Loop

```typescript
// src/engine/loop.ts

const FIXED_STEP_MS = 1000 / 60; // 16.667ms
let lastTime = 0;
let accumulator = 0;

export function startLoop(
  onPhysicsStep: () => void,
  onRender: (alpha: number) => void
): void {
  function frame(now: number) {
    const delta = now - lastTime;
    lastTime = now;
    accumulator += Math.min(delta, 50); // clamp to avoid spiral of death

    while (accumulator >= FIXED_STEP_MS) {
      onPhysicsStep();
      accumulator -= FIXED_STEP_MS;
    }

    onRender(accumulator / FIXED_STEP_MS);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame((now) => {
    lastTime = now;
    requestAnimationFrame(frame);
  });
}
```

**Critical:** The `Math.min(delta, 50)` clamp prevents the physics from running more than 3 steps per render frame (50ms / 16.67ms ≈ 3). Without this, a tab becoming visible after being in the background would run hundreds of physics steps at once.

### Gravity System

```typescript
// src/engine/physics/gravity.ts

const GRAVITY = toFixed(-0.09); // units per frame²

export function applyGravity(fighter: Fighter): void {
  if (fighter.grounded) return;
  if (fighter.state === 'ledgeHang') return;

  const multiplier = toFixed(fighter.gravityMultiplier);
  fighter.vy = fixedAdd(fighter.vy, fixedMul(GRAVITY, multiplier));

  // Clamp to terminal velocity
  const termVel = toFixed(fighter.fastFalling
    ? fighter.stats.maxFastFallSpeed
    : fighter.stats.maxFallSpeed);

  if (fighter.vy < termVel) {
    fighter.vy = termVel;
  }
}
```

---

## 4. Hitbox / Hurtbox System (Phase 2)

### Defining Move Data

Move data is declared as a static data file per character, not computed at runtime:

```typescript
// src/game/characters/kael.ts

export const kaelMoves: Record<string, Move> = {
  forwardSmash: {
    totalFrames: 55,
    hitboxes: [
      {
        activeFrames: [20, 28],
        offsetX: toFixed(40), // relative to character center
        offsetY: toFixed(10),
        width: toFixed(50),
        height: toFixed(30),
        damage: 18,
        knockbackScaling: toFixed(1.5),
        baseKnockback: toFixed(10),
        launchAngle: 40, // degrees
        hitlagFrames: 6,
        id: 'kael_fsmash_0',
      },
    ],
    hurtboxes: [
      // hurtboxes per-frame (simplified: just the body for now)
      { activeFrames: [0, 55], offsetX: toFixed(0), offsetY: toFixed(0), width: toFixed(30), height: toFixed(60) },
    ],
    iasa: 45, // "Interruptible As Soon As" — frame player can act again
    landingLag: 0,
  },
};
```

### Hit Registration

```typescript
// src/engine/physics/collision.ts

const hitRegistry = new Set<string>(); // "attackerEntityId_moveId_victimEntityId"

export function checkHitboxes(fighters: Fighter[]): void {
  for (const attacker of fighters) {
    const activeHitboxes = getActiveHitboxes(attacker);
    for (const hitbox of activeHitboxes) {
      for (const victim of fighters) {
        if (victim === attacker) continue;
        if (victim.intangible || victim.invincible) continue;

        const registryKey = `${attacker.id}_${hitbox.id}_${victim.id}`;
        if (hitRegistry.has(registryKey)) continue; // already hit this victim

        const victimHurtbox = getActiveHurtbox(victim);
        if (aabbOverlap(hitbox, victimHurtbox)) {
          hitRegistry.add(registryKey);
          applyKnockback(victim, attacker, hitbox);
          applyHitlag(attacker, hitbox.hitlagFrames);
          applyHitlag(victim, hitbox.hitlagFrames);
        }
      }
    }
  }
}

// Clear hit registry when a move ends
export function clearHitRegistry(attacker: Fighter): void {
  for (const key of hitRegistry) {
    if (key.startsWith(attacker.id)) hitRegistry.delete(key);
  }
}
```

---

## 5. Rollback Netcode (Phase 3)

### Implementing Determinism First

**Before writing any networking code,** verify that the simulation is deterministic:

```typescript
// tests/determinism.test.ts

import { describe, it, expect } from 'vitest';
import { createMatch, simulateFrames } from '../src/engine/loop';

describe('Physics Determinism', () => {
  it('produces identical state from identical inputs', () => {
    const inputs = generateRandomInputSequence(600); // 10 seconds at 60Hz

    const stateA = simulateFrames(inputs, seed=42);
    const stateB = simulateFrames(inputs, seed=42);

    expect(computeStateHash(stateA)).toBe(computeStateHash(stateB));
  });

  it('produces different state from different inputs', () => {
    const inputsA = generateRandomInputSequence(60);
    const inputsB = [...inputsA];
    inputsB[30] = { ...inputsA[30], jump: true }; // modify one frame

    const stateA = simulateFrames(inputsA, seed=42);
    const stateB = simulateFrames(inputsB, seed=42);

    expect(computeStateHash(stateA)).not.toBe(computeStateHash(stateB));
  });
});
```

Do not proceed to networking until determinism tests pass.

### State Serialisation for Rollback

Snapshots must be fast to create and restore. Avoid any allocation in the hot path:

```typescript
// src/engine/net/rollback.ts

interface Snapshot {
  frame: number;
  fighters: Uint8Array;  // serialised fighter states (fixed-size binary)
  rngState: number;      // 32-bit LCG state
}

const SNAPSHOT_POOL: Snapshot[] = Array.from(
  { length: 8 },
  () => ({ frame: 0, fighters: new Uint8Array(FIGHTER_STATE_SIZE * 4), rngState: 0 })
);
```

Pre-allocating the `Uint8Array` pool avoids garbage collection during rollback.

---

## 6. Asset Pipeline

### 3D Model Assets

All character and stage assets are low-poly **glTF/GLB** files. Each character GLB contains the rigged mesh, skeletal animation clips, and UV mapping for the flat-shaded texture atlas. Stage assets are split into platform geometry GLBs and background layer GLBs.

Expected file layout per character:

```
public/assets/kael/
  kael.glb           # Rigged low-poly mesh with embedded animation clips
  kael_atlas.png     # 2048×2048 flat-shaded texture atlas
  kael_atlas.json    # UV region metadata per surface (optional, for tooling)
```

Load character assets at runtime using the standard `fetch` + WebGL buffer upload path:

```typescript
import { loadGLTF } from '../renderer/models';

const kaelModel = await loadGLTF('/assets/kael/kael.glb');
const kaelAtlas = await loadTexture('/assets/kael/kael_atlas.png');
```

### Service Worker for Caching

After Phase 4, add a service worker that caches the compiled JS bundle and all 3D assets:

```typescript
// public/sw.js
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('aetherclash-v1').then(cache =>
      cache.addAll([
        '/',
        '/assets/index.js',
        '/assets/kael/kael.glb',
        '/assets/kael/kael_atlas.png',
        // ... all stage and character assets
      ])
    )
  );
});
```

This makes subsequent visits instant even on slow connections.

---

## 7. Coding Conventions

### Naming

| Pattern | Convention |
| :--- | :--- |
| Files | `camelCase.ts` |
| Interfaces | `PascalCase` |
| Constants | `UPPER_SNAKE_CASE` |
| Physics values | Always `Fixed` type with `toFixed()` conversion at definition |
| Event callbacks | `on` prefix (`onHit`, `onKO`, `onLand`) |

### Fixed vs Float

| Use Case | Type |
| :--- | :--- |
| Physics simulation | `Fixed` (Q16.16) |
| Renderer coordinates | `number` (float, converted from Fixed via `toFloat()`) |
| UI layout | CSS / HTML (never physics engine) |

### State Machine Pattern

All character states must go through the state machine:

```typescript
// Never set state directly from collision code:
// ❌ fighter.state = 'hitstun'; 

// Always use the transition function which validates the transition:
// ✅ fighter.transitionTo('hitstun', { hitstunFrames: 12 });
```

Invalid state transitions (e.g., going from `KO` to `attack`) are logged as errors and ignored.

---

## 8. Testing Strategy

| Test Type | Tool | What to Test |
| :--- | :--- | :--- |
| Unit tests | Vitest | Knockback formula, fixed-point math, input buffer logic |
| Determinism tests | Vitest | Same input → same state hash (run 1000 frames) |
| Integration tests | Vitest | Full match simulation (no rendering) |
| Manual playtest | Browser | Feel, balance, visual polish |
| Network tests | Two browser tabs | Rollback correctness, reconnect handling |

### Running Tests

```bash
npm run test         # run all unit/integration tests
npm run test:watch   # watch mode during development
```

---

## Related Documents

- [Roadmap](roadmap.md) — Phase-by-phase delivery milestones
- [Architecture](../technical/architecture.md) — Technology stack overview
- [Physics](../technical/physics.md) — Engine-level physics implementation
- [Networking](../technical/networking.md) — Rollback netcode details
