# Game Design — Mechanics

## 1. The Impact Percentage System

The defining mechanic of Aether Clash is the **Impact Percentage** — a damage accumulator that replaces the traditional health bar.

| State | Percentage Range | Combat Feel |
| :--- | :--- | :--- |
| Fresh | 0% – 30% | Near-zero knockback; attacks barely move the opponent |
| Damaged | 31% – 80% | Moderate knockback; combos start to connect across the stage |
| Vulnerable | 81% – 120% | High knockback; any strong hit is potentially lethal |
| Critical | 121%+ | Extremely high knockback; a single charged move can guarantee a KO |

### Rules
- Percentage starts at **0%** on every spawn/respawn.
- Percentage **never decreases** naturally during a stock (only Healing Charms reduce it).
- There is no upper cap; percentage can technically exceed 999%, though matches rarely reach that point.
- Percentage is displayed below each character as a large, color-coded number (white → yellow → orange → red as it increases).

---

## 2. Knockback Formula

The distance (and trajectory) a player is launched after taking a hit is governed by the following formula:

$$F = \left( \frac{\frac{d}{10} + \frac{d \cdot w}{20}}{w + 1} \cdot s \right) + b$$

### Variable Definitions

| Variable | Name | Description |
| :--- | :--- | :--- |
| `d` | Victim Damage % | The current Impact Percentage of the player being hit |
| `w` | Weight Class | A numeric value representing the character's mass (see below) |
| `s` | Scaling Factor | A per-move multiplier that controls how much the move's knockback grows with damage |
| `b` | Base Knockback | A flat velocity added regardless of damage; defines the minimum launch distance |
| `F` | Launch Force | The resulting launch velocity applied to the victim |

### Weight Classes

| Class | `w` Value | Example Archetype |
| :--- | :--- | :--- |
| Ultra-Light | 0.6 | Agile Striker |
| Light | 0.8 | Projectile Tactician |
| Medium | 1.0 | Balanced Hero |
| Heavy | 1.3 | Blade Master |
| Super-Heavy | 1.7 | Heavy Vanguard |

Higher `w` values resist knockback (divide the numerator more aggressively) but also make the character a larger target and slower to move.

### Formula Intuition

- At **low damage** (`d` near 0): the entire fraction approaches 0, so `F ≈ b`. The move has only its base knockback.
- At **high damage** (`d` large): the fraction dominates, scaled by `s`. Moves with high `s` (finisher smashes) become exponentially more dangerous.
- **Heavy characters** (`w` large): the `d·w/20` term grows but is divided by `(w+1)`, which partially cancels — heavier characters survive slightly longer but are not immune to launch at extreme percentages.

### Directional Influence (DI)

A player who is being launched may hold a direction on the analog stick to slightly alter their launch angle (up to ±15°). DI is the primary defensive skill for survivability at high percentages, allowing a player to steer themselves back toward the stage or extend their recovery window.

---

## 3. Blast Zones

The stage is surrounded by four invisible boundaries. Crossing any boundary results in a **KO**.

```
              ┌──────────────── TOP BLAST ZONE ─────────────────┐
              │                                                   │
LEFT          │         ╔═══════════════════════╗                │ RIGHT
BLAST    ─────┼─────────║      STAGE AREA        ║────────────────┼──── BLAST
ZONE          │         ╚═══════════════════════╝                │ ZONE
              │                                                   │
              └─────────────── BOTTOM BLAST ZONE ────────────────┘
```

| Boundary | Primary Cause of KO |
| :--- | :--- |
| **Left / Right** | Horizontal smash attacks, side-angled launches at high % |
| **Bottom** | Spike moves (downward attacks), missed recoveries |
| **Top** | Vertical smash attacks ("meteor" smashes reversed), up-specials |

- Bottom KOs are generally the most "embarrassing" and are typically intentional "edgeguard" plays.
- The exact pixel distance of blast zones varies by stage — larger stages have wider zones to compensate for the extra travel distance.

---

## 4. Movement

### Ground Movement

| Action | Input | Notes |
| :--- | :--- | :--- |
| Walk | Tilt left/right stick lightly | Slow, controlled; allows crouching transitions |
| Run / Dash | Press left/right stick fully | Faster; can be canceled into a slide-stop or attack |
| Crouch | Hold stick down | Reduces hurtbox height; can crawl on applicable stages |
| Dash Attack | Dash + Attack | Carries momentum; varies per character |
| Pivot | Reverse stick direction during run | Reverses facing direction with a brief skid animation |

### Aerial Movement

| Action | Input | Notes |
| :--- | :--- | :--- |
| Jump | Jump button | Initial jump from ground |
| Double Jump | Jump button (in air) | A second jump usable once per airborne phase |
| Short Hop | Lightly tap Jump | Jumps ~40% of full jump height; critical for approaching safely |
| Fast Fall | Down on stick (descending) | Rapidly increases fall speed; used for combo timing |
| Air Dodge | Shield + Directional input | Grants 20 frames of intangibility; has a 30-frame landing lag on grounded use |

### Ledge Mechanics

When a character's hand collides with the edge of a platform from below, they enter the **Ledge Hang** state:
- All aerial jumps are **refreshed** upon grabbing the ledge.
- The character is **temporarily intangible** for the first 20 frames of the hang.
- From ledge hang, the player can: roll onto stage, jump from ledge, attack from ledge, or release downward to drop.
- An opponent occupying the same ledge will **trump** the hanging player, sending them into a brief tumble.

---

## 5. Combat Actions

### Standard Attacks (Jab, Tilt, Smash)

| Attack Type | Input | Description |
| :--- | :--- | :--- |
| Neutral Jab | Attack (standing) | Fast, low-damage; typically a 2–3 hit string |
| Forward Tilt | Tilt stick + Attack | Mid-range, mid-damage; poke/spacing tool |
| Up Tilt | Up + Attack | Anti-air; launches upward |
| Down Tilt | Down + Attack | Low sweep; often leads into combos |
| Forward Smash | Charge Fwd + Attack | Slow startup, highest damage; primary kill move |
| Up Smash | Charge Up + Attack | Vertical kill option; strong anti-air |
| Down Smash | Charge Down + Attack | Hits both sides; punishes rolls |

### Aerial Attacks

Each character has five aerial attacks (Neutral, Forward, Back, Up, Down). Back-airs and down-airs are typically the strongest kill options from the air.

### Special Abilities

Every character has **four special abilities** mapped to the Special button + direction:

| Input | Slot | Typical Function |
| :--- | :--- | :--- |
| Neutral Special | No direction | Projectile, charge attack, or stance |
| Side Special | Left or Right | Dash move, multi-hit, or throw |
| Up Special | Up | Recovery move; grants extra height but leaves character vulnerable |
| Down Special | Down | Counter, trap, absorb, or ground-slam |

---

## 6. Grabbing & Throwing

- **Grab:** Grabs ignore shields. Use Grab button at close range.
- **Pummel:** Repeatedly press Attack while holding to deal small damage before throwing.
- **Throw Directions:** Throw in four directions (forward, back, up, down). Each throw has a unique angle and knockback profile. Back-throws and down-throws are common kill options at high percentages near blast zones.

---

## 7. Shielding & Invincibility

| State | Duration | Notes |
| :--- | :--- | :--- |
| **Shield** | Hold Shield button | Absorbs all attacks; degrades over time — if fully depleted, **Shield Break** stuns the character for ~3 seconds |
| **Roll Dodge** | Shield + Left/Right | Brief intangibility with movement; has a ~15-frame recovery window |
| **Spot Dodge** | Shield + Down | In-place dodge; 8 frames of invincibility, 12-frame recovery |
| **Air Dodge** | Shield (in air) + Direction | 20 frames intangible; directional for distance; landing lag if used toward stage |

---

## 8. Tech Mechanics

**Tech** (short for "technical recovery") allows a player to avoid entering the tumble state when hitting the floor or a wall at speed:

- **Floor Tech:** Press Shield within 20 frames of hitting the floor. The character bounces up and can act immediately. Can tech in-place, forward, or backward.
- **Wall Tech:** Press Shield within 20 frames of hitting a wall. Bounces off the wall into the air.
- Missing a tech results in a **hard knockdown** — the character lies on the floor for ~30 frames, completely vulnerable.

---

## Related Documents

- [Characters](characters.md) — Per-character weight, speed, and move-set data
- [Physics](../technical/physics.md) — Engine-level implementation of the knockback formula
- [Input](../technical/input.md) — Input buffer and control mapping
