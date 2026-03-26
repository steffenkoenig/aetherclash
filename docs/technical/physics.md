# Technical — Physics Engine

## Design Goals

1. **Deterministic:** Given the same inputs, two clients must always produce identical game states. This is non-negotiable for rollback netcode.
2. **Fixed-timestep:** All physics calculations run at exactly **60 Hz** regardless of display frame rate.
3. **Integer-friendly:** Positions and velocities use **fixed-point arithmetic** (Q16.16 format) to avoid floating-point rounding divergence across different CPU architectures and browsers.
4. **Fast enough for rollback:** A single physics step must complete in under **2 ms** on mid-range hardware so that the rollback system can replay up to 7 frames in one render frame (≤14 ms budget).

---

## Coordinate System

```
          Y+
          │
          │
          └──────── X+
         /
        /
      Z+ (out of screen, irrelevant for physics — 2D)
```

- Origin (0, 0) is the **center of the main stage floor**.
- All positions are in **world units** (1 unit ≈ 1 pixel at 1080p reference resolution).
- Positive Y is up. A character on the main stage floor has Y ≈ 0 (accounting for their height offset).

---

## Gravity Model

Each character has a **gravity multiplier** applied to a global gravity constant:

```
GRAVITY_CONSTANT = −0.09 units/frame²   (per 60Hz tick)
character.vy += GRAVITY_CONSTANT * character.gravityMultiplier
```

| Character State | Gravity Multiplier |
| :--- | :--- |
| Normal airborne | 1.0 |
| Fast-falling | 2.5 |
| During up-special ascent | 0.0 (overridden by move velocity) |
| During ledge hang | 0.0 (pinned) |
| During air dodge descent | 1.5 |

### Terminal Velocity

Each character has a maximum fall speed (terminal velocity):

| Character | `maxFallSpeed` | `maxFastFallSpeed` |
| :--- | :--- | :--- |
| Kael | −0.85 | −1.60 |
| Gorun | −1.10 | −2.00 |
| Vela | −0.90 | −1.65 |
| Syne | −0.70 | −1.40 |
| Zira | −0.90 | −1.70 |

---

## Knockback System

### Formula

$$F = \left( \frac{\frac{d}{10} + \frac{d \cdot w}{20}}{w + 1} \cdot s \right) + b$$

Where:
- `d` = victim's current damage percentage
- `w` = victim's weight class value
- `s` = move's scaling factor
- `b` = move's base knockback
- `F` = launch force magnitude

### Launch Vector

Every move defines a **launch angle** in degrees (0° = directly right, 90° = directly up).

> **Note:** The snippet below is **conceptual pseudocode** written in floating-point for readability. The real implementation must use Q16.16 fixed-point arithmetic for `d`, `w`, `s`, `b`, and `F` (via `fixedMul`/`fixedDiv`), and must replace `Math.cos`/`Math.sin` with a pre-computed lookup table (LUT) of 512 entries to guarantee identical results across all browsers and CPU architectures. See the [Build Guide](../implementation/build-guide.md) for the `FixedNum` API.

```typescript
// PSEUDOCODE — uses float arithmetic for clarity; real implementation uses Fixed + LUT
function applyKnockback(victim: Fighter, attacker: Fighter, move: Move): void {
  const d = victim.damagePercent;   // float equivalent of Q16.16 value
  const w = victim.weightClass;     // float equivalent of Q16.16 value
  const s = move.knockbackScaling;  // float equivalent of Q16.16 value
  const b = move.baseKnockback;     // float equivalent of Q16.16 value

  const F = ((d / 10 + (d * w) / 20) / (w + 1)) * s + b;

  // Flip angle for left-facing attacker
  const angleRad = toRadians(
    attacker.facingRight ? move.launchAngle : 180 - move.launchAngle
  );

  // Real implementation: victim.vx = fixedMul(cosLUT(angle), F_fixed);
  victim.vx = Math.cos(angleRad) * F;
  victim.vy = Math.sin(angleRad) * F;
  victim.state = 'hitstun';
  victim.hitstunFrames = computeHitstun(F);
}
```

### Hitstun Duration

The number of frames a victim cannot act after being hit:

```
hitstunFrames = floor(F * 0.4)
```

A launch force of 10 results in 4 frames of hitstun. A launch force of 40 results in 16 frames. This scales naturally — more powerful hits create longer combo windows.

### Directional Influence (DI)

The victim may apply directional influence by holding the stick during hitstun:

```typescript
const DI_MAX_ANGLE_CHANGE = 15; // degrees
const diInput = victim.inputState.stick; // normalised [-1, 1] vector
const baseAngle = move.launchAngle;      // degrees, before DI is applied
const angleAdjust = diInput.x * DI_MAX_ANGLE_CHANGE;
const adjustedAngle = clamp(baseAngle + angleAdjust, 0, 360);
```

DI is only factored in on the **first frame** of hitstun.

---

## Collision Detection

### Platform Collision (AABB vs Line Segment)

Stages are defined as a collection of **platform segments** (horizontal line segments with optional "pass-through" flags):

```typescript
interface Platform {
  x1: number;   // left edge
  x2: number;   // right edge
  y: number;    // surface height
  passThrough: boolean;
}
```

Each frame, for each airborne character, the engine checks if the character's **bottom edge** crossed a platform's surface Y between the previous and current position (continuous collision detection to avoid tunnelling at high speed):

```typescript
function checkPlatformLanding(char: Fighter, platform: Platform): boolean {
  const prevBottom = char.prevY - char.halfHeight;
  const currBottom = char.y - char.halfHeight;

  if (prevBottom >= platform.y && currBottom < platform.y) {
    if (char.x >= platform.x1 && char.x <= platform.x2) {
      if (platform.passThrough && char.inputState.down) return false; // drop through
      return true;
    }
  }
  return false;
}
```

### Ledge Detection

Ledge colliders are placed at the exact left and right edges of every solid platform. A character enters the `LEDGE_GRAB` state when all of the following are true:

1. They are airborne and moving downward (vy < 0).
2. Their "grab hand" position (top-right or top-left of bounding box, depending on facing) overlaps a ledge collider.
3. They have not recently released this ledge (5-second cooldown after voluntary release).
4. No other character is currently occupying this ledge.

### Hitbox vs Hurtbox

Every character has a set of **hitboxes** (offensive) and **hurtboxes** (defensive) that are active per-animation frame.

```typescript
interface Hitbox {
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  damage: number;
  knockbackScaling: number; // s
  baseKnockback: number;    // b
  launchAngle: number;      // degrees
  activeFrames: [number, number]; // [start, end] inclusive
  hitlagFrames: number;     // freeze frames on hit
  id: number;               // unique per move instance to prevent multi-hit issues
}
```

Hitbox vs Hurtbox uses AABB overlap detection. A hitbox can only register one hit per opponent per move instance (tracked via `id`). This prevents multi-registrations on multi-hit moves.

#### Hitlag (Hit Freeze)

When a hitbox lands, both the attacker and victim **freeze** for a short number of frames (hitlag):

```
hitlagFrames = max(4, floor(damage / 3))
```

Hitlag creates the satisfying "weight" of a landed hit and provides a brief window for the victim to apply DI.

---

## Blast Zone Detection

Each frame, after all position updates, the engine checks every fighter's position against the stage's blast zone boundaries:

```typescript
function checkBlastZones(char: Fighter, stage: Stage): void {
  if (
    char.x < stage.blastZone.left  ||
    char.x > stage.blastZone.right ||
    char.y > stage.blastZone.top   ||
    char.y < stage.blastZone.bottom
  ) {
    triggerKO(char);
  }
}
```

`triggerKO` deducts a stock, plays the KO animation, and schedules a respawn after a fixed delay.

---

## Determinism Guarantees

| Mechanism | Implementation |
| :--- | :--- |
| Fixed-point arithmetic | All positions, velocities use Q16.16 fixed-point via a `FixedNum` class |
| No `Math.random()` | All pseudo-random values (item spawns, Guardian selection) use a seeded LCG shared between peers at match start |
| No `Date.now()` in simulation | Time is tracked as a frame counter only |
| Sorted entity processing | Entities are processed in a deterministic order (sorted by entity ID, assigned sequentially) |
| Frame hash checks | A CRC32 of all fighter states is computed every 60 frames and compared between peers |

---

## Performance Targets

| Metric | Target |
| :--- | :--- |
| Physics step time | < 2 ms per frame |
| Collision check time | < 0.5 ms per frame |
| Max hitbox/hurtbox pairs | 32 pairs active simultaneously |
| Rollback depth | Up to 7 frames |
| Memory per game state snapshot | < 4 KB |

---

## Related Documents

- [Mechanics](../game-design/mechanics.md) — Game-level description of the knockback formula
- [Networking](networking.md) — How determinism is used by rollback netcode
- [Architecture](architecture.md) — Fixed-step game loop implementation
