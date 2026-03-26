# Game Design — Stages

## Overview

Each stage in Aether Clash is a distinct arena that influences player strategy through its layout, blast zone distances, and optional environmental hazards. All stages are visually cohesive with the Retro-Modern 3D aesthetic: low-poly geometry, vibrant atmospheric backgrounds, and animated environmental details.

Stages are divided into two categories:

| Category | Description |
| :--- | :--- |
| **Competitive** | Flat or near-flat platforms; no stage hazards; used in ranked/tournament play. |
| **Casual** | Varied layouts with dynamic elements and optional hazards; used in party modes. |

---

## Stage Roster

### 1. Aether Plateau *(Competitive)*

**Setting:** A suspended stone slab floating in a golden sky above the clouds.

**Layout:**
```
          ┌──────────────────────────────────────────┐
          │            [Soft Platform]                │
          │                                           │
          │  [Platform L]             [Platform R]   │
          │                                           │
          └──────────────────────────────────────────┘
                     MAIN STAGE (flat)
```

| Property | Value |
| :--- | :--- |
| Main Stage Width | 85 units |
| Left Blast Zone | −150 units |
| Right Blast Zone | +150 units |
| Top Blast Zone | +180 units |
| Bottom Blast Zone | −100 units |
| Side Platforms | 2 (medium height, pass-through) |
| Top Platform | 1 (pass-through, centered) |
| Stage Hazards | None |
| Item Spawn Points | 3 |

**Design Notes:** Aether Plateau is the default competitive stage — a near-symmetrical layout that rewards fundamentals. Its moderate blast zone distances make early kills possible but require skill to achieve. The top platform is an important positioning tool for characters with strong vertical game (Zira, Kael).

---

### 2. Forge of the Vanguard *(Casual / Competitive)*

**Setting:** A floating industrial forge platform above a churning lava sea. Giant mechanical arms rotate slowly in the background.

**Layout:**
```
       [Lava Geyser]   [Platform L]   [Platform R]   [Lava Geyser]
              │                                              │
   ───────────┴──────────────────────────────────────────────┴──────
                         MAIN STAGE (flat, wide)
```

| Property | Value |
| :--- | :--- |
| Main Stage Width | 110 units |
| Left Blast Zone | −170 units |
| Right Blast Zone | +170 units |
| Top Blast Zone | +200 units |
| Bottom Blast Zone | −110 units |
| Side Platforms | 2 (lower, close to main stage) |
| Stage Hazards | 2 Lava Geysers (see below) |
| Item Spawn Points | 4 |

**Lava Geyser Hazard:**
- Two geysers sit at the left and right edges of the main stage.
- Every 20 seconds they erupt, sending a vertical jet of flame upward.
- The geyser jet stays active for 3 seconds and deals 8% per frame of contact with moderate upward knockback.
- The eruption is telegraphed 3 seconds in advance by a red glow.
- Players can choose to position near the geyser to force opponents into it during a confrontation.

**Design Notes:** The wide main stage benefits heavy characters and projectile users. Geysers create a dynamic center-edge tension. Acceptable as a competitive secondary stage if geysers are disabled via the match settings.

---

### 3. Cloud Citadel *(Casual)*

**Setting:** A crystalline sky fortress floating among storm clouds. The background features intermittent lightning strikes that illuminate the arena.

**Layout:**
```
        ┌──────────┐         ┌──────────┐
        │ Tower L  │         │ Tower R  │
        └────┬─────┘         └────┬─────┘
             │     ┌──────┐       │
             │     │ Sky  │       │
             │     │ Walk │       │
             └─────┴──────┴───────┘
                   MAIN BASE (narrow)
```

| Property | Value |
| :--- | :--- |
| Main Stage Width | 60 units (base only) |
| Left Blast Zone | −130 units |
| Right Blast Zone | +130 units |
| Top Blast Zone | +220 units |
| Bottom Blast Zone | −110 units |
| Side Platforms | 2 raised towers (pass-through tops) |
| Centre Platform | 1 (mid-height, pass-through) |
| Stage Hazards | Lightning Strikes |
| Item Spawn Points | 5 |

**Lightning Strike Hazard:**
- A random platform (chosen from any of the 3 platforms or main stage) is targeted by a storm cloud every 15–30 seconds.
- A visual storm cloud icon appears above the target platform 5 seconds before the strike.
- The strike deals 18% and buries (stuns) any character on the platform at the moment of impact.
- Players who are in the air when the strike lands are unaffected.

**Design Notes:** The narrow main stage pushes players to use the towers aggressively. Lightning strikes reward awareness and punish campers. Best played in 3–4 player mode for maximum chaos.

---

### 4. Ancient Ruin *(Competitive)*

**Setting:** Crumbling stone arches and pillars over a deep abyss. A distant civilization glows at the horizon.

**Layout:**
```
         [Arch Platform L]          [Arch Platform R]
                  │    [Centre Pillar]    │
                  │          │            │
    ──────────────┴──────────┴────────────┴──────────────
                         MAIN STAGE
```

| Property | Value |
| :--- | :--- |
| Main Stage Width | 80 units |
| Left Blast Zone | −145 units |
| Right Blast Zone | +145 units |
| Top Blast Zone | +190 units |
| Bottom Blast Zone | −105 units |
| Side Platforms | 2 (arched, pass-through) |
| Centre Platform | 1 (pillar, no pass-through — solid top) |
| Stage Hazards | None |
| Item Spawn Points | 3 |

**Design Notes:** The solid center pillar (unlike the pass-through platforms on other stages) creates a unique wall-tech opportunity. Players can intentionally wall-bounce off it. This rewards tech-skilled players. A common competitive secondary stage.

---

### 5. Digital Grid *(Casual)*

**Setting:** A neon-lit virtual environment styled after a digital data landscape. Moving data streams scroll across the background.

**Layout (Phase 1 — Standard):**
```
    ┌──────────┐               ┌──────────┐
    │  Node L  │               │  Node R  │
    └─────┬────┘               └────┬─────┘
          │        [Centre]         │
          └──────────┬──────────────┘
                     │
         ────────────┴────────────────
                  GRID FLOOR
```

**Layout (Phase 2 — after 90 seconds, alternating every 30s):**
- The Grid Floor retracts and is replaced by two smaller hovering panels.
- Phase 2 has no "solid" main stage — both panels are pass-through.
- After 30 seconds in Phase 2, the main stage returns (Phase 1 resumes).

| Property | Value |
| :--- | :--- |
| Stage Hazards | Phase Transition (layout changes) |
| Item Spawn Points | 4 |

**Design Notes:** The phase transition forces constant adaptation. Players who understand the transition timer gain a major advantage by baiting opponents onto disappearing terrain.

---

## Stage Selection in Competitive Play

### Starter Stage Pool (no bans)
- Aether Plateau
- Ancient Ruin

### Counterpick Stage Pool (available after Game 1)
- Forge of the Vanguard (hazards off)
- Cloud Citadel (hazards off)
- Digital Grid (Phase transitions on)

### Banned Stages
- Digital Grid is banned in sets using "hazards off" ruleset because phase transitions are considered integral to the stage identity, not a hazard that can be toggled.

---

## Stage Aesthetic Reference

| Stage | Colour Palette | Ambient Sound | Background Motion |
| :--- | :--- | :--- | :--- |
| Aether Plateau | Gold, cream, sky blue | Wind, distant thunder | Drifting cloud layers |
| Forge of the Vanguard | Orange, dark grey, red | Industrial machinery, lava bubbling | Rotating mechanical arms |
| Cloud Citadel | Pale blue, white, violet | Storm winds, distant lightning | Storm clouds, lightning flashes |
| Ancient Ruin | Earthy brown, moss green, muted gold | Echo, distant water drips | Floating stone debris |
| Digital Grid | Cyan, electric blue, black | Electronic hum, data pings | Scrolling data streams |

---

## Related Documents

- [Mechanics](mechanics.md) — Blast zone KO mechanics
- [Items](items.md) — Item spawn point counts per stage
- [Rendering](../technical/rendering.md) — Stage rendering and parallax background system
