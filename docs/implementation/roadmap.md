# Implementation — Development Roadmap

## Overview

Development is structured into four phases, moving from a playable local prototype to a full browser-based multiplayer release. Each phase produces a testable build with clear success criteria.

---

## Phase 1 — Physics Sandbox *(Milestone: "It Feels Good")*

**Goal:** A single character on a single platform that feels satisfying to move. No combat yet. Prove that the core "feel" is correct before building on top of it.

**Duration Estimate:** 3–4 weeks

### Deliverables

- [ ] Project scaffolding: Vite + TypeScript, ESLint, Prettier, basic folder structure
- [ ] WebGL canvas setup (1920×1080 internal resolution, CSS viewport scaling)
- [ ] Fixed-step game loop at 60 Hz
- [ ] Basic entity-component-system (ECS) skeleton
- [ ] **Gravity and jump mechanics** for one character (Kael)
  - Gravity constant, terminal velocity, fast-fall
  - Jump, double jump, short hop
- [ ] Platform collision detection (one flat platform)
  - Pass-through platforms
  - Landing detection (continuous collision)
- [ ] Basic character rendering (placeholder quad with UV, no atlas yet)
- [ ] Keyboard input (movement, jump)
- [ ] Debug overlay: show position, velocity, state, FPS

### Success Criteria
- The character can walk, run, jump, double jump, short hop, fast-fall, and land.
- Movement "feels" tight — no floatiness or stickiness.
- Physics runs deterministically at 60 Hz on all target browsers.
- The game loop does not hitch under normal browser conditions.

---

## Phase 2 — Combat Core *(Milestone: "It's a Fighting Game")*

**Goal:** Two characters can fight each other locally. The knockback formula is implemented and tuned. This phase establishes the complete combat foundation.

**Duration Estimate:** 5–7 weeks

### Deliverables

- [ ] Complete character state machine (idle, walk, run, jump, attack, hitstun, shield, dodge, KO)
- [ ] **Hitbox / Hurtbox system**
  - Per-frame hitbox/hurtbox definitions for all moves
  - Hit registration with single-hit-per-move-instance guarantee
  - Hitlag (hit freeze frames)
- [ ] **Knockback formula** fully implemented (see [Physics](../technical/physics.md))
  - Damage percentage accumulator
  - Launch vector calculation
  - Directional Influence (DI)
  - Hitstun duration
- [ ] **Blast zones** and KO detection
- [ ] Stock system (3 lives, respawn with invincibility)
- [ ] Move set for all 5 characters (Kael, Gorun, Vela, Syne, Zira)
  - All standard attacks (jabs, tilts, smashes, aerials)
  - All four special abilities per character
- [ ] Grabbing and throwing system
- [ ] Shielding, rolling, spot-dodge
- [ ] Ledge grabbing and ledge options
- [ ] Techs (floor tech, wall tech)
- [ ] Input buffer (5-frame window)
- [ ] Damage HUD (percentages, stocks)
- [ ] 2-player local mode (split keyboard or two gamepads)
- [ ] All 5 competitive/casual stages (Aether Plateau, Forge, Cloud Citadel, Ancient Ruin, Digital Grid)
- [ ] Character texture atlases (final art assets)
- [ ] Stage background parallax layers

### Success Criteria
- All 5 characters feel distinct and all moves function correctly.
- Knockback values feel correct at low, medium, and high percentages.
- 2-player local matches are stable for full 8-minute sessions.
- Hitstun, DI, and shield mechanics are all functional.

---

## Phase 3 — Online Play *(Milestone: "Play with a Friend")*

**Goal:** Two players can connect online via a shared link and play with minimal latency using rollback netcode.

**Duration Estimate:** 6–8 weeks

### Deliverables

- [ ] **Determinism audit**
  - Replace all `Math.random()` with seeded LCG
  - Replace all floating-point positions with Q16.16 fixed-point
  - Add frame-hash CRC32 comparison
  - Run automated determinism tests (replay same inputs → same outcome)
- [ ] **WebSocket Signalling Server**
  - Node.js + `ws`
  - Lobby creation and join by code
  - WebRTC offer/answer/ICE relay
- [ ] **WebRTC DataChannel setup**
  - Unordered, no-retransmit configuration
  - Input packet encoding (16-bit compressed input)
  - RTT measurement
- [ ] **Rollback Netcode**
  - State snapshot and restore (circular buffer of 8 frames)
  - Input prediction (repeat-last-input)
  - Rollback-and-resimulate on misprediction
  - Desync detection and recovery
  - Adaptive input delay based on RTT
  - Delay-based fallback for high packet loss
- [ ] Character select screen
- [ ] Stage select screen
- [ ] Online lobby: private room (share link), casual quick match
- [ ] Connection quality indicator (HUD)
- [ ] Match result screen (winner, percentages, stocks remaining)

### Success Criteria
- Two players on the same city's network feel 0 frames of lag.
- Two players with 80ms RTT notice no gameplay degradation.
- Frame hash mismatches occur less than once per 10 minutes of play.
- WebRTC connects successfully on standard home NAT configurations (no TURN needed for >80% of pairs).

---

## Phase 4 — Polish & Live *(Milestone: "Public Launch")*

**Goal:** The game is production-ready with progression, ranked play, spectator support, and performance optimisation.

**Duration Estimate:** 6–8 weeks

### Deliverables

- [ ] **Items system** (see [Items](../game-design/items.md))
  - All 4 item categories fully implemented
  - Item spawn timer and spawn points per stage
  - Item spawn settings in lobby
- [ ] **Ranked Mode**
  - ELO-based matchmaking (±50 range expansion over time)
  - Seasonal ranked ladder
  - Player profiles (username, avatar, win/loss record)
  - JWT authentication (optional; anonymous play still available)
- [ ] **Audio**
  - Per-character impact sounds
  - KO sound and jingle
  - Stage-specific background music with dynamic intensity
  - Web Audio API spatial positioning for off-screen sounds
- [ ] **Spectator Mode**
  - Watch ongoing ranked matches with 1-second delay
  - WebSocket state stream (not WebRTC)
- [ ] **Replay System**
  - Save match input logs; replay by re-simulating
  - Share replay via URL (encoded input log in URL hash or stored server-side)
- [ ] **Accessibility**
  - Colour-blind-friendly palette option
  - Reduced motion mode (disables screen shake and particle effects)
  - Keyboard navigation for all menus
- [ ] **Performance Optimisation**
  - GPU profile pass: identify and eliminate overdraw
  - JS profile pass: identify hot simulation paths
  - Service worker for asset caching (subsequent loads are near-instant)
- [ ] **Stage Hazards** (Forge Geysers, Cloud Citadel Lightning, Digital Grid Phase Transition)
- [ ] Progressive asset loading (playable within 3 seconds of first visit)
- [ ] Mobile touch controls (basic; not competitively balanced)

### Success Criteria
- Game loads to main menu within 3 seconds on a 10 Mbps connection.
- Ranked mode matches correctly with ±200 ms queue time at launch with >100 concurrent players.
- Zero critical desyncs in ranked play over 1000 ranked matches.
- All accessibility features functional.

---

## Post-Launch Roadmap

| Milestone | Content |
| :--- | :--- |
| **v1.1** | Additional character (6th archetype: "The Summoner" — controls a pet) |
| **v1.2** | Tournament mode (bracket, bracket visualiser, admin tools) |
| **v1.3** | Stage editor (community-created stages, shared via URL) |
| **v2.0** | 4-player Smash Party mode (2v2 team battles and free-for-all) |

---

## Related Documents

- [Build Guide](build-guide.md) — Implementation guidelines and coding standards for each phase
- [Architecture](../technical/architecture.md) — Technology stack decisions
- [Networking](../technical/networking.md) — Rollback netcode implementation details
