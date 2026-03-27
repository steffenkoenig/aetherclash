# Game Design — Overview

## Executive Summary

**Aether Clash** is a competitive multiplayer fighting game designed to eliminate the barriers of entry associated with traditional gaming. Running entirely within a modern web browser, it uses a **Knockout (KO)** system rather than a health-bar system. Players battle on suspended stages, aiming to increase their opponents' vulnerability until they can be launched into the surrounding **Blast Zones**.

The game draws inspiration from classic platform fighters while innovating on accessibility: no client to install, no account required to play a casual match, and sub-second matchmaking for a frictionless experience.

---

## Genre

| Attribute | Value |
| :--- | :--- |
| Primary Genre | Platform Fighter |
| Secondary Genre | Physics-Based Brawler |
| Perspective | Side-scrolling (3D world constrained to a 2D play plane) |
| Player Count | 2–4 players (local or online) |
| Session Length | 2–8 minutes per match (Stock or Time mode) |

---

## Design Pillars

### 1. Instant Access
The game must load and be playable within seconds of visiting the URL. All assets are streamed progressively; the first character and stage are playable before the full roster downloads. Zero-installation also means zero update friction — the latest version is always live.

### 2. Expressive, Physics-Driven Combat
Every hit feels different based on the victim's current damage percentage, the victim's character weight, and the specific move used. Players must read the situation and adapt — a combo that works at 30% becomes a lethal finishing move at 120%.

### 3. Competitive Depth Without Complexity Walls
A new player picks up the basics (jump, attack, dodge) within one minute. A competitive player spends months mastering hitbox timing, DI (directional influence), and punish windows. The skill ceiling is high but the floor is intentionally low.

### 4. Fair, Readable Encounters
All gameplay information is communicated visually. Damage percentages are displayed prominently. Launch trails, screen shake, and off-screen HUD indicators ensure players always understand the game state even during chaotic multi-player matches.

### 5. Browser-Native Performance
The renderer and physics engine are optimized specifically for WebGL in a browser context. Texture atlases minimize HTTP requests; the physics step runs at a fixed 60 Hz regardless of display frame rate; rollback netcode masks any network jitter.

---

## Target Audience

| Segment | Description |
| :--- | :--- |
| **Casual Players** | Fans of party-fighter games looking for a quick session with friends via a shared link. |
| **Competitive Players** | Fighting-game community members who want a ranked ladder and frame-data transparency. |
| **Streamers / Content Creators** | Spectator mode and sharable match replays make the game broadcast-friendly. |
| **Non-Gaming Platforms** | Schools, offices, or locked-down devices where client installs are not permitted. |

---

## Win Conditions & Match Formats

### Stock Mode (Primary Competitive Format)
- Each player starts with **3 stocks** (lives).
- Losing a stock occurs when a player crosses a Blast Zone boundary.
- The last player with at least one stock remaining wins.
- Time limit: **8 minutes**. If time expires, the player with the most stocks wins; ties are resolved by lowest current damage percentage.

### Time Mode (Casual / Party Format)
- No stocks. Players score **1 point per KO**.
- Self-destructs (SD) subtract 1 point.
- Match duration: **3 minutes**.
- Player with the highest score at the end wins.

---

## Core Game Loop

```
Spawn → Build Damage % → Land KO → Respawn (invincible for 3 s) → Repeat
```

1. **Spawn** — Player appears on a platform with 0% damage and 3 seconds of respawn invincibility.
2. **Engage** — Players exchange attacks, accumulating percentage. Higher percentage = more knockback taken.
3. **KO** — A sufficiently powerful hit at high percentage sends a player past the Blast Zone.
4. **Respawn** — A stock is deducted and the player re-enters the stage.
5. **Victory** — The last player with stocks remaining is declared the winner.

---

## Tone & Aesthetic

Aether Clash adopts a **"Retro-Modern 3D"** aesthetic:

- **Models:** Low-poly "action figure" characters built as real-time 3D meshes with clean, flat-shaded materials. Instantly readable silhouettes rendered from a fixed side-on camera.
- **Stages:** Vibrant, thematic 3D environments (sky islands, ancient ruins, digital grid) built from low-poly geometry, with animated 3D background layers providing depth.
- **UI:** Minimal and clean — large damage percentages, simple stock indicators, no clutter.
- **Audio:** Punchy impact sounds, dynamic music that escalates during close match situations, satisfying KO jingle.

---

## Related Documents

- [Mechanics](mechanics.md) — Detailed combat and movement rules
- [Characters](characters.md) — Full archetype and move-set documentation
- [Items](items.md) — Weapons and power-up system
- [Stages](stages.md) — Stage roster and design notes
