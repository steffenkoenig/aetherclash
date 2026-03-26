# Game Design — Items

## Overview

Items spawn periodically during matches to introduce **"controlled chaos"** — tactical depth and moment-to-moment unpredictability without undermining the core skill-based meta. Item spawning can be configured per lobby:

| Spawn Setting | Description |
| :--- | :--- |
| **Off** | No items spawn. Recommended for competitive/ranked play. |
| **Low** | Rare spawns (~1 item every 45 seconds). |
| **Medium** | Standard spawns (~1 item every 25 seconds). Default for casual matches. |
| **High** | Frequent spawns (~1 item every 12 seconds). Party/chaotic mode. |

Items appear on the stage surface at predetermined spawn points (unique per stage layout). A soft glowing particle effect marks the spawn location 2 seconds before the item materialises. Only one item of each category can be active on stage at once.

---

## Item Categories

### 1. Melee Augments

Melee Augments temporarily replace a character's standard physical attacks with a powered weapon.

#### Energy Rod
- **Appearance:** A glowing crystalline staff pulsing with electric-blue light.
- **Duration:** 15 seconds or until the wielder is KO'd.
- **Effect:** Replaces all standard Jab/Tilt attacks with wide-arc electric strikes.
  - Each swing deals **+8% bonus damage** compared to the wielder's base attacks.
  - On a fully charged smash attack with the rod, applies a **stun** to the opponent for 12 frames.
- **Drop Condition:** The item drops at the wielder's current position if they are hit by a grab or a strong smash attack.

#### Heavy Mallet
- **Appearance:** An oversized wooden mallet with a glowing Aether-core head.
- **Duration:** 10 seconds or until dropped.
- **Effect:** Replaces all attacks with a single overhead smash.
  - Slow startup (35 frames), but delivers **+15% damage** and **+30% knockback scaling** (`s` multiplied by 1.3).
  - The wielder loses their standard attack options entirely — all four directions produce only the Mallet smash.
- **Tactical Note:** The Mallet is extremely powerful in the hands of a Heavy Vanguard character (Gorun), creating a potentially match-winning tool.

---

### 2. Throwable Projectiles

Throwable items can be **picked up** and **held**. While held, the item occupies the player's "grab" slot — they cannot grab opponents but can throw the item at any angle.

#### Explosive Sphere
- **Appearance:** A fist-sized metallic ball with a glowing seam and a short fuse.
- **Throw Mechanics:**
  - **Tap Throw:** Tossed in a shallow arc; explodes on contact with any surface or opponent.
  - **Strong Throw:** Hurled in a straight line at high speed; explodes on contact.
  - **Drop:** Placing it gently sets it on the ground as a proximity trap (2-second delay before arm detonation).
- **Explosion Radius:** ~3 character widths.
- **Damage / Knockback:** 22% damage, high knockback (`s = 1.6`, `b = 12`). Can kill at moderate percentages.
- **Self-Damage:** The thrower is **not** immune to the explosion. Position carefully.

#### Boomerang
- **Appearance:** An aerodynamically styled wing-shaped blade with trailing wind particles.
- **Throw Mechanics:**
  - Travels forward ~70% of stage width, then curves back to the thrower's original throw position.
  - If the return path is blocked (wall or opponent), it stops and falls.
  - Can be **caught on return** — if the thrower catches it, the cooldown resets and it can be thrown again immediately.
- **Damage:** 10% on the outward pass, 12% on the return pass (slight speed bonus).
- **Knockback:** Moderate (`s = 1.1`, `b = 6`).
- **Tactical Note:** Skilled players throw the boomerang and then reposition to cover both the forward and return hitboxes simultaneously.

---

### 3. Assist Orbs

Assist Orbs are floating glowing spheres that drift slowly across the stage until **broken** by an attack. Breaking an orb summons a **Guardian NPC** that performs one powerful action and then vanishes.

#### Breaking Mechanics
- The orb has **20 HP**. Any attack deals its full damage value to the orb.
- A player who deals the **final hit** that breaks the orb **owns** the Guardian — it will attack their opponents, not them.
- If the orb is broken by a move that hits multiple characters simultaneously (e.g., an area attack), the first character in the priority list (player 1, 2, 3, 4) claims ownership.

#### Guardian Roster

The specific Guardian summoned is randomly selected at spawn time and is **hinted** by the orb's colour:

| Orb Colour | Guardian | Effect |
| :--- | :--- | :--- |
| **Gold** | Titan Golem | Stomps across the stage dealing 3 hits × 15% with massive knockback. |
| **Silver** | Spectral Archer | Fires a volley of 5 homing arrows (8% each) that track the nearest opponent for 3 seconds. |
| **Green** | Vine Wraith | Grabs the nearest opponent and slams them into the ground, burying them for 2 seconds. |
| **Red** | Flame Phoenix | Creates a sweeping wave of fire that travels across the entire stage floor (12% per hit, multiple hits). |
| **Purple** | Void Stalker | Teleports behind the opponent closest to a blast zone and delivers a single spike (25%, high downward knockback). |

---

### 4. Healing Charms

Healing Charms are the rarest item drops. They **reduce the holder's current Impact Percentage**, directly countering the core damage-escalation mechanic.

#### Aether Crystal
- **Appearance:** A small, faceted gemstone glowing with soft white light.
- **Activation:** Automatically activates when picked up (no button press required).
- **Effect:** Reduces the holder's Impact Percentage by **−30%** (e.g., 100% → 70%).
- **Percentage Floor:** Cannot reduce below 0%.
- **Visual Feedback:** A ripple of white light emanates from the character, and the damage counter briefly flashes green.
- **Spawn Rate Note:** The Aether Crystal has a **50% lower spawn probability** than all other item types. If an Aether Crystal spawned within the last 90 seconds, it cannot spawn again for the next 60 seconds (cooldown stacks).

---

## Item Interaction Rules

| Interaction | Behaviour |
| :--- | :--- |
| Shield + Item | A shielded player cannot pick up items. The item passes through the shield hitbox. |
| Grab + Melee Augment | Grabbing while holding a Melee Augment **drops** the augment at the holder's feet and performs the normal grab. |
| KO with item held | The item drops at the last in-bounds position of the KO'd player. |
| Item vs. Projectile | Throwable projectiles can be **deflected** by a physical melee attack. If deflected, ownership transfers to the deflecting player. |
| Stage Hazard + Item | Items with a fixed fuse (Explosive Sphere) will detonate when caught in a stage hazard (e.g., fire geyser). |

---

## Competitive Item Usage (Optional Module)

For tournament play, a **"Curated Items"** mode is available:

- All Melee Augments: **Disabled**
- Heavy Mallet: **Disabled**
- Explosive Sphere: **Disabled**
- Boomerang: **Enabled** (medium spawn rate)
- Assist Orbs: **Disabled**
- Healing Charms: **Disabled**

This mirrors how traditional platform-fighter tournament scenes typically handle items: removing high-variance tools while keeping lower-impact neutral options.

---

## Related Documents

- [Mechanics](mechanics.md) — Core knockback formula (relevant to item knockback values)
- [Stages](stages.md) — Spawn point locations per stage
- [Characters](characters.md) — Character-specific item synergies
