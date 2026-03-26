# GitHub Copilot Instructions — Aether Clash

## Project Overview

**Aether Clash** is a competitive multiplayer 2D platform fighter that runs entirely in a modern web browser. Key characteristics:

- **No runtime dependencies** — the game engine is vanilla TypeScript compiled with Vite.
- **Determinism is non-negotiable** — the physics simulation must produce bit-identical results on all clients to support rollback netcode.
- **Fixed-point arithmetic everywhere in physics** — never use raw `number` floats for physics values.
- **Target platform** — Chrome 90+, Firefox 88+, Safari 15+; WebGL 2.0 renderer.

---

## Technology Stack

| Layer | Technology |
| :--- | :--- |
| Language | TypeScript (strict mode) |
| Bundler | Vite |
| Renderer | WebGL 2.0 (raw preferred; Three.js optional) |
| Physics | Custom deterministic engine (Q16.16 fixed-point) |
| Networking | WebRTC DataChannel (game data) + WebSocket (signalling) |
| Testing | Vitest (planned; see [Build Guide](docs/implementation/build-guide.md) for test scripts) |
| Linting | ESLint + `@typescript-eslint` (planned; see [Build Guide](docs/implementation/build-guide.md) for lint configuration) |

---

## Planned Folder Structure

> **Note:** The repository currently contains documentation only. The directory layout below reflects the *intended* source structure for implementation. See the [Build Guide](docs/implementation/build-guide.md) for the scaffolding steps.

```
src/
  engine/
    loop.ts              # Fixed-step game loop (60 Hz physics, rAF render)
    ecs/                 # Entity-Component-System
    physics/
      fixednum.ts        # Q16.16 fixed-point helpers (toFixed/toFloat/fixedMul/…)
      gravity.ts
      collision.ts
      knockback.ts
    input/
      keyboard.ts
      gamepad.ts
      buffer.ts          # 5-frame input buffer (FIFO per action)
    net/
      rollback.ts        # 8-frame circular snapshot buffer
      webrtc.ts
      websocket.ts
  game/
    characters/          # Static move-set data per character
    stages/              # Platform layout data
    items/
    state.ts             # Match state
  renderer/
    gl.ts                # WebGL context setup
    camera.ts            # Intelligent camera (lerp + zoom)
    sprites.ts           # Texture-atlas sprite batching
    particles.ts
    hud.ts               # HTML/CSS overlay (not WebGL)
  audio/
    audio.ts             # Web Audio API
  main.ts                # Entry point
server/
  signalling.ts          # Node.js WebSocket signalling server
tests/
  physics.test.ts
  rollback.test.ts
  determinism.test.ts
```

---

## Critical Rules

### 1. Fixed-Point Arithmetic (Physics Only)

All physics values — positions (`x`, `y`), velocities (`vx`, `vy`), and physics constants — **must** use the `Fixed` type (Q16.16 fixed-point stored as a 32-bit integer). The helpers are in `src/engine/physics/fixednum.ts`:

```typescript
type Fixed = number; // always an integer representing Q16.16

toFixed(n: number): Fixed        // convert float → Fixed at definition time
toFloat(f: Fixed): number        // convert Fixed → float for rendering only
fixedAdd(a, b): Fixed            // plain integer add
fixedSub(a, b): Fixed            // plain integer subtract
fixedMul(a, b): Fixed            // BigInt intermediate to avoid overflow
fixedDiv(a, b): Fixed            // BigInt intermediate
```

**Rules:**
- ✅ Use `Fixed` for all physics values. Call `toFloat()` only in the renderer.
- ❌ Never use raw float arithmetic (`*`, `/`, `+`, `-`) on physics values.
- ❌ Never call `Math.cos` / `Math.sin` in the physics simulation — use a 512-entry pre-computed LUT instead to guarantee cross-browser determinism.
- ❌ Never call `Math.random()` in the simulation — use the shared seeded LCG (`rngState`).
- ❌ Never use `Date.now()` or `performance.now()` inside a physics step — time is a frame counter only.

### 2. Determinism

The simulation must produce **identical results** given identical inputs on every browser and CPU architecture. Violations cause desync between peers, which triggers a costly full re-sync (or match abandonment).

Checklist when adding physics code:
- [ ] All numeric values use `Fixed` (not `number`).
- [ ] No floating-point operations in the simulation path.
- [ ] No calls to `Math.random()` — use the shared LCG.
- [ ] No calls to `Math.cos`/`Math.sin` — use the trig LUT.
- [ ] Entities are processed in a deterministic order (sorted by entity ID).
- [ ] New state fields are included in the CRC32 checksum and rollback snapshot.

### 3. State Machine for Character State

Character states must **always** go through the state machine transition function:

```typescript
// ❌ Never set state directly:
fighter.state = 'hitstun';

// ✅ Always use the transition function:
fighter.transitionTo('hitstun', { hitstunFrames: 12 });
```

Invalid transitions (e.g., `KO` → `attack`) are logged as errors and silently ignored.

### 4. Rollback Snapshot Performance

Snapshots must be creatable and restorable in **< 1 ms**. Rules:
- Use pre-allocated `Uint8Array` pools — no heap allocation in the snapshot hot path.
- Snapshots must contain **all simulation-affecting state** (e.g., frame, serialised fighters, projectiles/items, stage/physics state, `rngState`). This may be stored as a single packed binary blob, and the snapshot CRC32 must cover the entire blob.
- The circular buffer holds **8 frames**. Do not grow it without updating the rollback depth constant.

### 5. Input Encoding

The `InputState` (rich runtime object) and `PackedInputState` (uint16 wire format) are distinct types. Use `encodeInput()` / `decodeInput()` to convert between them. Never send the full `InputState` object over the network.

---

## Coding Conventions

### Naming

| Pattern | Convention |
| :--- | :--- |
| Files | `camelCase.ts` |
| Interfaces / Types | `PascalCase` |
| Constants | `UPPER_SNAKE_CASE` |
| Physics values | Always `Fixed` type, initialised with `toFixed()` |
| Event callbacks | `on` prefix (`onHit`, `onKO`, `onLand`) |

### Fixed vs Float

| Context | Type |
| :--- | :--- |
| Physics simulation | `Fixed` (Q16.16) |
| Renderer coordinates | `number` (float, converted via `toFloat()`) |
| UI layout | CSS/HTML — never involves the physics engine |

### Move Data

Move data is declared as **static data** per character (not computed at runtime). All numeric fields (offsets, dimensions, knockback values) use `toFixed()` at declaration. Example:

```typescript
// src/game/characters/kael.ts
export const kaelMoves: Record<string, Move> = {
  forwardSmash: {
    totalFrames: 55,
    hitboxes: [{
      activeFrames: [20, 28],
      offsetX: toFixed(40),
      damage: 18,
      knockbackScaling: toFixed(1.5),
      baseKnockback: toFixed(10),
      launchAngle: 40, // degrees — integer, not Fixed
      hitlagFrames: 6,
      id: 'kael_fsmash_0',
    }],
    iasa: 45,
  },
};
```

### Game Loop

The game loop runs physics at a fixed 60 Hz and renders at the display refresh rate. The `Math.min(delta, 50)` clamp in `loop.ts` **must not be removed** — it prevents a spiral-of-death when a tab wakes from the background.

---

## Physics Reference

### Knockback Formula

$$F = \left( \frac{\frac{d}{10} + \frac{d \cdot w}{20}}{w + 1} \cdot s \right) + b$$

- `d` = victim's damage percentage
- `w` = victim's weight class value (0.6 – 1.7)
- `s` = move's knockback scaling factor
- `b` = move's base knockback
- `F` = launch force magnitude

All variables are `Fixed`. Use `fixedMul` / `fixedDiv` for all arithmetic.

### Hitstun

```
hitstunFrames = floor(F * 0.4)
```

### Hitlag

```
hitlagFrames = max(4, floor(damage / 3))
```

### Gravity

```
GRAVITY_CONSTANT = toFixed(-0.09)   // units per frame² at 60 Hz
fighter.vy = fixedAdd(fighter.vy, fixedMul(GRAVITY_CONSTANT, gravityMultiplier))
```

---

## Testing

### Test Files

| File | Focus |
| :--- | :--- |
| `tests/physics.test.ts` | Knockback formula, fixed-point arithmetic, input buffer logic |
| `tests/determinism.test.ts` | Same inputs → same state hash over 600 frames |
| `tests/rollback.test.ts` | Rollback snapshot correctness, re-simulation accuracy |

### Running Tests

```bash
npm run test          # run all tests (Vitest)
npm run test:watch    # watch mode during development
```

### Determinism Test Pattern

```typescript
it('produces identical state from identical inputs', () => {
  const inputs = generateRandomInputSequence(600);
  const stateA = simulateFrames(inputs, 42);
  const stateB = simulateFrames(inputs, 42);
  expect(computeStateHash(stateA)).toBe(computeStateHash(stateB));
});
```

**Always run determinism tests after modifying any physics code.** Do not proceed to networking changes until determinism tests pass.

---

## Review Focus Areas

When reviewing physics or networking code, check for:

1. **Determinism violations** — any raw float operation, `Math.random()`, `Math.cos`/`Math.sin`, or `Date.now()` inside the simulation path.
2. **State machine bypasses** — direct assignment to `fighter.state` instead of `fighter.transitionTo()`.
3. **Snapshot omissions** — new game-state fields not included in the rollback snapshot or the CRC32 hash.
4. **Allocation in hot paths** — object/array creation inside `checkHitboxes`, `applyKnockback`, `onPhysicsStep`, or snapshot save/restore.
5. **Hit registry leaks** — `hitRegistry` entries not cleared when a move ends, causing missed hits on subsequent uses of the same move.
6. **Input encoding drift** — changes to `InputState` fields not reflected in the `PackedInputState` bit layout and `encodeInput`/`decodeInput` implementations.
7. **Game loop timing** — removal or weakening of the 50 ms delta clamp in `loop.ts`.
8. **WebRTC channel config** — `ordered: false` and `maxRetransmits: 0` must be preserved on the game DataChannel; changing these breaks low-latency behaviour.

---

## Security Considerations

- **Cheating / input injection:** Both peers run the same deterministic simulation. Desync is detected via CRC32 every 60 frames. Do not add any simulation shortcut that only runs on one peer.
- **Signalling server rate limiting:** Max 10 connection requests per IP per minute. Do not remove or weaken this limit.
- **JWT authentication:** Persistent player profiles use JWT. Anonymous guests require no account. Do not store sensitive data in `localStorage` beyond custom key bindings.
- **WebRTC IP exposure:** Only ICE candidates are exchanged. Players can opt into relay-only (TURN) mode. Do not log or expose ICE candidates beyond the signalling flow.
