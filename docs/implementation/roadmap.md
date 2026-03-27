# Implementation — Development Roadmap

## Agent Build Instructions

> **This section is written specifically for an autonomous coding agent.** Follow the steps below in strict order. Do not skip phases. Each phase has explicit acceptance tests — only advance to the next phase once all criteria in the current phase pass.

### Conventions the agent must follow at all times
- **Language:** TypeScript (strict mode, `"strict": true` in `tsconfig.json`).
- **Bundler:** Vite (`npm create vite@latest aetherclash -- --template vanilla-ts`).
- **Testing:** Vitest (`npm install --save-dev vitest`). Run `npm test` after every phase.
- **Folder layout:** Follow the structure in [Build Guide § Folder Structure](build-guide.md) exactly.
- **Physics values:** Always `Fixed` (Q16.16). Never use raw `number` for positions or velocities. Use `toFixed()`, `fixedAdd()`, `fixedMul()`, `fixedDiv()` from `src/engine/physics/fixednum.ts`. See [Build Guide § Fixed-Point Arithmetic](build-guide.md).
- **No floats in physics:** Any snippet using `Math.cos`/`Math.sin`/`Math.random` in the physics loop is a bug — use the LUT-based trig helpers and the seeded LCG RNG described in [Physics](../technical/physics.md).
- **No global state** outside the ECS world object and the rollback state buffer.
- **Commit after each completed deliverable.** Commit messages follow the pattern `feat(phase-N): short description`.

---

### Phase 1 — Physics Sandbox

**Stop condition:** All Phase 1 acceptance tests pass. Do not start Phase 2 until they do.

#### Step-by-step agent tasks

1. **Scaffold the project.**
   ```bash
   npm create vite@latest aetherclash -- --template vanilla-ts
   cd aetherclash
   npm install
   npm install --save-dev vitest eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin prettier
   npm install three                          # Three.js renderer (runtime)
   npm install --save-dev @types/three        # TypeScript types
   ```
   Create the folder tree from [Build Guide § Folder Structure](build-guide.md). Commit as `chore: initial scaffold`.

2. **Implement `src/engine/physics/fixednum.ts`.**
   Copy the full `FixedNum` implementation from [Build Guide § Fixed-Point Arithmetic](build-guide.md), including `toFixed`, `toFloat`, `fixedAdd`, `fixedSub`, `fixedMul`, `fixedDiv`.
   Write unit tests in `tests/physics.test.ts`:
   - `toFixed(1.5)` → `98304`.
   - `fixedMul(toFixed(2), toFixed(3))` → `toFixed(6)`.
   - `fixedAdd(toFixed(1), toFixed(2))` → `toFixed(3)`.
   Commit as `feat(phase-1): fixed-point arithmetic`.

3. **Implement the game loop (`src/engine/loop.ts`).**
   Follow the 60 Hz fixed-step loop in [Build Guide § Game Loop](build-guide.md). The loop must accumulate real elapsed time and fire physics steps in 16.67 ms increments. Clamp `delta` to 50 ms to prevent the spiral-of-death. Commit as `feat(phase-1): game loop`.

4. **Implement the ECS skeleton (`src/engine/ecs/`).**
   - `entity.ts` — `createEntity()` returning a unique numeric ID.
   - `component.ts` — a typed component registry (`Map<EntityId, ComponentData>`).
   - `system.ts` — `addSystem(fn)` and `runSystems(world)`.
   Define the `Transform`, `Physics`, and `Fighter` components described in [Architecture § ECS](../technical/architecture.md). Commit as `feat(phase-1): ECS skeleton`.

5. **Implement gravity (`src/engine/physics/gravity.ts`).**
   Use the constants from [Physics § Gravity Model](../technical/physics.md). Every airborne entity accumulates `GRAVITY * gravityMultiplier` per frame. Clamp to `maxFallSpeed` / `maxFastFallSpeed`. All values `Fixed`. Commit as `feat(phase-1): gravity`.

6. **Implement platform collision (`src/engine/physics/collision.ts`).**
   Implement continuous AABB-vs-line-segment landing detection from [Physics § Platform Collision](../technical/physics.md). Support `passThrough` flag — if the stick is held down the character drops through. Commit as `feat(phase-1): platform collision`.

7. **Implement keyboard input (`src/engine/input/keyboard.ts`).**
   Map keys to `InputState` (see [Input § Default Control Schemes](../technical/input.md)). Sample once per physics frame, not per render frame. Commit as `feat(phase-1): keyboard input`.

8. **Render a placeholder character and platform.**
   Set up the Three.js `WebGLRenderer` and `OrthographicCamera` in `src/renderer/gl.ts` at 1920×1080 internal resolution with CSS viewport scaling (see [Rendering § Renderer Setup](../technical/rendering.md)). Render procedural box-humanoid `MeshToonMaterial` groups as character placeholders and `BoxGeometry` slabs for platforms. Three.js manages the WebGL context. Commit as `feat(phase-1): placeholder renderer`.

9. **Add a debug overlay.**
   Print position (x, y), velocity (vx, vy), state, and FPS as HTML text above the canvas. Commit as `feat(phase-1): debug overlay`.

#### Phase 1 acceptance tests (run with `npm test`)
```
✓ fixednum: toFixed/toFloat round-trip within 1 ULP
✓ fixednum: fixedMul(toFixed(2), toFixed(3)) === toFixed(6)
✓ gravity: velocity decreases by GRAVITY each frame for airborne entity
✓ gravity: clamped at maxFallSpeed after 100 frames
✓ collision: entity lands on platform when crossing from above
✓ collision: entity passes through platform when stick is held down
✓ game loop: fires exactly 60 physics steps per simulated second
```

---

### Phase 2 — Combat Core

**Stop condition:** All Phase 2 acceptance tests pass.

#### Step-by-step agent tasks

1. **Implement the character state machine.**
   States: `idle`, `walk`, `run`, `jump`, `doubleJump`, `attack`, `hitstun`, `shielding`, `rolling`, `spotDodge`, `airDodge`, `grabbing`, `ledgeHang`, `KO`. Transitions must go through `fighter.transitionTo(state, data)` — invalid transitions are logged and ignored. See [Mechanics § Combat Actions](../game-design/mechanics.md). Commit as `feat(phase-2): state machine`.

2. **Implement the knockback system.**
   Implement the formula exactly as specified in [Physics § Knockback System](../technical/physics.md):
   ```
   F = ((d/10 + d*w/20) / (w+1)) * s + b
   ```
   All values `Fixed`. Use LUT-based sin/cos for the launch angle. Apply DI as described (±15°, only on first hitstun frame). Compute `hitstunFrames = floor(F * 0.4)`. Commit as `feat(phase-2): knockback formula`.

3. **Implement the hitbox / hurtbox system.**
   Follow [Build Guide § Hitbox / Hurtbox System](build-guide.md) exactly:
   - Per-frame hitbox/hurtbox definitions from static move-data files.
   - AABB overlap detection.
   - Single-hit-per-move-instance registry (keyed `attackerId_moveId_victimId`).
   - Hitlag freeze for both attacker and victim: `max(4, floor(damage / 3))` frames.
   Commit as `feat(phase-2): hitbox hurtbox system`.

4. **Implement blast zones and the stock system.**
   Check blast zone crossing after every position update. Deduct a stock on KO and respawn with 3 s invincibility. Commit as `feat(phase-2): blast zones and stocks`.

5. **Implement the input buffer.**
   Use the FIFO queue implementation from [Input § Input Buffer](../technical/input.md) with a 5-frame window. Wire it to every action that benefits from buffering (jump, attack, special, grab). Commit as `feat(phase-2): input buffer`.

6. **Implement all move sets for all 5 characters.**
   Define static move data files for Kael, Gorun, Vela, Syne, and Zira using the tables in [Characters](../game-design/characters.md). Each move must specify `totalFrames`, `hitboxes[]`, `hurtboxes[]`, and `iasa`. Commit as `feat(phase-2): character move data`.

7. **Implement grabbing and throwing, shielding, dodging, and techs.**
   Follow [Mechanics § Grabbing](../game-design/mechanics.md) and [Mechanics § Shielding](../game-design/mechanics.md). Shield degradation must deplete over time; shield break stuns for ~3 s. Floor and wall techs require pressing Shield within 20 frames of contact. Commit as `feat(phase-2): grabs shields techs`.

8. **Implement ledge grabbing.**
   Place ledge colliders at all solid platform edges. Trigger `LEDGE_HANG` when the grab-hand AABB overlaps a ledge collider while the character is airborne and moving downward. Refresh aerial jumps on grab. See [Mechanics § Ledge Mechanics](../game-design/mechanics.md). Commit as `feat(phase-2): ledge grabbing`.

9. **Load 3D character model assets.**
   Generate placeholder GLB files for all 5 characters and 5 stages using the asset generation script (`npm run generate-assets`). Load them at runtime via the `loadGLTF(url)` helper in `src/renderer/models.ts`, which uses Three.js `GLTFLoader` and falls back to procedural geometry if the file is absent. The renderer automatically swaps procedural groups for loaded GLB scenes. See [Architecture § 3D Asset Strategy](../technical/architecture.md). Commit as `feat(phase-2): 3d-character-models`.

10. **Implement the damage HUD.**
    Render damage percentages and stock icons as HTML over the canvas. Colour-code percentages: white → yellow → orange → red. See [Rendering § HUD System](../technical/rendering.md). Commit as `feat(phase-2): damage HUD`.

11. **Implement all 5 stages.**
    Define stage layout data (platform segments, blast zones, item spawn points) using coordinates from [Stages](../game-design/stages.md). Implement parallax background layers. Commit as `feat(phase-2): stages`.

#### Phase 2 acceptance tests
```
✓ knockback: formula matches expected values at d=0, 50, 100, 150 for each weight class
✓ knockback: DI adjusts launch angle by ≤15°
✓ hitstun: duration = floor(F * 0.4)
✓ hitbox: same move cannot register twice on the same victim
✓ hitbox: hitlag freezes both attacker and victim for correct duration
✓ blast zone: KO triggered when character crosses any boundary
✓ stocks: stock decremented on KO; match ends when last stock lost
✓ input buffer: jump pressed 3 frames early registers on landing frame
✓ shield: shield break stuns for ~3 s when fully depleted
✓ ledge: aerial jumps refreshed on ledge grab
```

---

### Phase 3 — Online Play

**Stop condition:** All Phase 3 acceptance tests pass.

#### Step-by-step agent tasks

1. **Determinism audit — do this before any networking code.**
   - Run `tests/determinism.test.ts`: simulate 600 frames with a known input sequence and a fixed seed; assert that the CRC32 state hash is identical on two independent runs.
   - Replace every `Math.random()` with the seeded LCG from [Physics § Determinism Guarantees](../technical/physics.md).
   - Confirm no floating-point values leak into the physics path (`Fixed` everywhere).
   - **Do not proceed until `npm test` passes the determinism suite.**
   Commit as `feat(phase-3): determinism audit`.

2. **Implement `PackedInputState` encoding.**
   Add `encodeInput(state: InputState): PackedInputState` and `decodeInput(packed: PackedInputState): InputState` in `src/engine/input/keyboard.ts`. Use the 16-bit bit layout from [Networking § Input Encoding](../technical/networking.md). Commit as `feat(phase-3): input encoding`.

3. **Implement the WebSocket signalling server (`server/signalling.ts`).**
   Handle `find_match`, `rtc_offer`, `rtc_answer`, `ice_candidate` messages as described in [Networking § WebSocket Layer](../technical/networking.md). The server must relay WebRTC handshake messages between peers and send `match_found` with a shared random `seed`. Commit as `feat(phase-3): signalling server`.

4. **Implement WebRTC DataChannel setup (`src/engine/net/webrtc.ts`).**
   Use `ordered: false`, `maxRetransmits: 0`. Send `InputPacket` (6-byte: uint32 frame + uint16 PackedInputState) every physics frame. Every 60 frames, append a uint32 CRC32 checksum to the packet (10 bytes total for that frame). Commit as `feat(phase-3): webrtc datachannel`.

5. **Implement rollback netcode (`src/engine/net/rollback.ts`).**
   Follow [Build Guide § Rollback Netcode](build-guide.md) and [Networking § Rollback Netcode](../technical/networking.md):
   - Pre-allocate 8 `Snapshot` objects (Uint8Array pool, no GC in hot path).
   - On each frame: save snapshot, predict opponent input (repeat last known), simulate.
   - On receiving opponent input: compare `PackedInputState` with `!==` (primitive comparison). If mismatch: restore snapshot, re-simulate all frames up to current.
   - Implement desync detection: compare CRC32 every 60 frames; on mismatch apply host state.
   - Implement adaptive input delay (0–3 frames based on RTT).
   Commit as `feat(phase-3): rollback netcode`.

6. **Implement character select and stage select screens.**
   Navigate from lobby → character select → stage select → match start. Commit as `feat(phase-3): character and stage select`.

7. **Implement the connection quality HUD indicator.**
   Show RTT and packet-loss percentage as a small overlay. Commit as `feat(phase-3): connection quality HUD`.

#### Phase 3 acceptance tests
```
✓ determinism: 600-frame replay with same inputs produces identical state hash
✓ determinism: changing one frame's input produces a different state hash
✓ encodeInput/decodeInput: round-trip preserves all button and stick states
✓ rollback: mispredicted input triggers resimulation of correct frames
✓ rollback: state is identical after resimulation to a direct simulation with correct inputs
✓ rollback: packets older than ROLLBACK_BUFFER_SIZE trigger requestResync()
✓ checksum: CRC32 mismatch between two simulations with different inputs is detected
```

---

### Phase 4 — Polish & Live

**Stop condition:** All Phase 4 acceptance tests pass and the manual checklist below is verified.

#### Step-by-step agent tasks

1. **Implement the items system.** Follow [Items](../game-design/items.md) exactly. Spawn items at the stage's designated spawn points using the shared LCG RNG (so both peers see the same item). Implement all 4 item categories. Commit as `feat(phase-4): items system`.

2. **Implement stage hazards.** Forge Geysers, Cloud Citadel Lightning, Digital Grid Phase Transitions — detailed in [Stages](../game-design/stages.md). Hazards must use the shared LCG so both peers trigger them on the same frame. Commit as `feat(phase-4): stage hazards`.

3. **Implement the audio system (`src/audio/audio.ts`).** Use the Web Audio API. Load sound effects on demand (first trigger). Stream background music. See [Architecture § Audio Loading](../technical/architecture.md). Commit as `feat(phase-4): audio`.

4. **Implement ranked mode.** ELO matchmaking via the signalling server. JWT auth (optional; guest play remains available). Player profiles stored server-side. Commit as `feat(phase-4): ranked mode`.

5. **Implement spectator mode.** WebSocket stream of game state every 60 frames + per-frame delta-compressed inputs. 1-second delay. Commit as `feat(phase-4): spectator mode`.

6. **Implement replay system.** Log all inputs per frame. Replay by re-simulating. Share via URL hash. Commit as `feat(phase-4): replay system`.

7. **Accessibility pass.** Colour-blind-friendly palette, reduced-motion mode, keyboard navigation for all menus. Commit as `feat(phase-4): accessibility`.

8. **Performance pass.** GPU and JS profiling. Service worker for asset caching. Target: main menu reachable within 3 seconds on a 10 Mbps connection. Commit as `feat(phase-4): performance`.

#### Phase 4 manual verification checklist
- [ ] Items spawn at the correct frequency on all 5 stages.
- [ ] Assist Orb Guardian matches the orb colour.
- [ ] Stage hazards fire on the correct frame on both clients simultaneously.
- [ ] Audio plays correctly; no missing sounds.
- [ ] Ranked matchmaking places players within ±200 ms queue time.
- [ ] Spectator mode shows play with exactly 1-second delay.
- [ ] Replay reconstructs the match identically from input log.
- [ ] Service worker caches assets; second visit loads in < 1 s.

---

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
- [ ] Input buffer (5-frame FIFO window)
- [ ] Damage HUD (percentages, stocks)
- [ ] 2-player local mode (split keyboard or two gamepads)
- [ ] All 5 competitive/casual stages (Aether Plateau, Forge, Cloud Citadel, Ancient Ruin, Digital Grid)
- [ ] Character 3D model assets (glTF/GLB with flat-shaded texture atlas — final art)
- [ ] Stage background 3D parallax layers

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
  - `PackedInputState` (uint16) encoding; 6-byte regular packet; 10-byte checksum packet (every 60 frames)
  - RTT measurement
- [ ] **Rollback Netcode**
  - State snapshot and restore (pre-allocated circular buffer, 8 frames)
  - Input prediction (repeat-last-input as `PackedInputState`)
  - Rollback-and-resimulate on misprediction (`!==` primitive comparison)
  - Desync detection and recovery (CRC32 every 60 frames)
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
- [ ] Character 3D model assets (glTF/GLB with flat-shaded texture atlas — final art)
- [ ] Stage background 3D parallax layers

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
