# Technical — Architecture

## System Overview

Aether Clash is built as a **single-page web application** (SPA) with no server-side rendering of game state. The browser client is authoritative for all local physics simulation, and rollback netcode reconciles divergence between peers.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser Client                           │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────┐   │
│  │  Game Engine │  │  Renderer    │  │  UI / HUD Layer     │   │
│  │  (Physics,   │  │  (WebGL 2.0) │  │  (HTML/CSS overlay) │   │
│  │   Input,     │  │              │  │                     │   │
│  │   Rollback)  │  └──────────────┘  └─────────────────────┘   │
│  └──────┬───────┘                                               │
│         │                                                       │
│  ┌──────▼──────────────────────────────────────────────────┐    │
│  │              Network Layer                               │    │
│  │  ┌─────────────────────┐   ┌──────────────────────────┐ │    │
│  │  │  WebRTC (P2P)        │   │  WebSocket (Signalling)  │ │    │
│  │  │  Game frame data     │   │  Lobby / Matchmaking     │ │    │
│  │  └─────────────────────┘   └──────────────────────────┘ │    │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                             │  │
              ┌──────────────┘  └──────────────┐
              ▼                                ▼
   ┌──────────────────┐             ┌───────────────────┐
   │  Signalling      │             │  Opponent Browser  │
   │  Server          │             │  (Peer Client)     │
   │  (WebSocket)     │             └───────────────────┘
   └──────────────────┘
```

---

## Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Runtime** | Modern Browser (Chrome 90+, Firefox 88+, Safari 15+) | Execution environment |
| **Language** | TypeScript | Primary development language |
| **Bundler** | Vite | Fast HMR development + optimised production builds |
| **Renderer** | WebGL 2.0 (via Three.js or raw GL) | 3D scene rendering with 2D gameplay |
| **Physics** | Custom deterministic engine | Fixed-step simulation at 60 Hz |
| **Networking (Game)** | WebRTC DataChannel | Sub-20ms peer-to-peer input exchange |
| **Networking (Lobby)** | WebSocket | Matchmaking, lobby management, player profiles |
| **State Management** | Custom ECS (Entity-Component-System) | Game object management |
| **Asset Pipeline** | Vite + texture atlas generator | Minimal HTTP requests, fast load times |
| **Audio** | Web Audio API | Positional audio, dynamic music |

---

## Core Engine Modules

### 1. Game Loop (`engine/loop.ts`)

The game loop is decoupled from the rendering frame rate:

```
Physical Update: Fixed 60 Hz (16.67 ms step)
Render Update:  requestAnimationFrame (~60-120 Hz based on display)
```

The physics step accumulates real elapsed time and fires in fixed increments. This ensures physics determinism regardless of the display refresh rate — critical for rollback netcode consistency.

```typescript
// Simplified game loop
const FIXED_STEP = 1 / 60; // seconds
let accumulator = 0;
let lastTime = performance.now();

function gameLoop(now: number) {
  const delta = (now - lastTime) / 1000;
  lastTime = now;
  accumulator += delta;

  while (accumulator >= FIXED_STEP) {
    physicsStep(FIXED_STEP);
    accumulator -= FIXED_STEP;
  }

  render(accumulator / FIXED_STEP); // interpolation alpha
  requestAnimationFrame(gameLoop);
}
```

### 2. Entity-Component-System (`engine/ecs/`)

All game objects (characters, projectiles, items, stage elements) are represented as **entities** with attached **components**. Systems iterate over entities with matching component sets.

Key components:

| Component | Data |
| :--- | :--- |
| `Transform` | Position (x, y), rotation, scale |
| `Physics` | Velocity (vx, vy), acceleration, gravity multiplier |
| `Fighter` | Damage %, stocks, state machine, character ID |
| `Hitbox` | Shape, active frames, damage, knockback (s, b, angle) |
| `Hurtbox` | Shape, intangibility flag, invincibility flag |
| `Input` | Current frame input state, buffered inputs |
| `Renderable` | Mesh reference, animation state, texture atlas UV |
| `Collider` | AABB or convex shape, layer mask |

### 3. Input System (`engine/input/`)

See [Input](input.md) for full details.

### 4. Physics System (`engine/physics/`)

See [Physics](physics.md) for full details.

### 5. Rollback System (`engine/net/rollback.ts`)

See [Networking](networking.md) for full details.

---

## Asset Pipeline

### Texture Atlas Strategy

All character art is packed into a single texture atlas per character:
- All animation frames for all moves are packed into one 2048×2048 PNG.
- UV coordinates are stored in a JSON sidecar file loaded once at startup.
- Reduces draw calls per character from N (one per frame) to 1.

### Progressive Loading Order

1. **Core engine** (JS bundle, ~150 KB gzipped) — required before anything renders.
2. **UI assets** (main menu, HUD elements) — loaded in parallel with engine.
3. **Default stage** (Aether Plateau) — loaded first; player can enter practice mode immediately.
4. **Default character** (Kael) — loaded in parallel with stage.
5. **Remaining characters and stages** — streamed in the background.

### Audio Loading

Sound effects are loaded on demand (triggered by first occurrence). Background music uses the Web Audio API with streaming decoding — it begins playing before the full audio file is downloaded.

---

## Build System

### Development

```bash
npm install
npm run dev       # Vite dev server with HMR at http://localhost:5173
```

### Production Build

```bash
npm run build     # Outputs to /dist, hashed filenames, tree-shaken
npm run preview   # Preview production build locally
```

### Environment Variables

| Variable | Description |
| :--- | :--- |
| `VITE_WS_URL` | WebSocket signalling server URL |
| `VITE_STUN_URL` | STUN server URL for WebRTC NAT traversal |
| `VITE_TURN_URL` | TURN server URL for WebRTC relay fallback |

---

## Server Components

The game client is fully static HTML + JS + assets that can be served from any CDN. The only server-side components are:

| Server | Technology | Responsibility |
| :--- | :--- | :--- |
| **Signalling Server** | Node.js + `ws` package | WebSocket lobby, matchmaking, WebRTC offer/answer relay |
| **STUN Server** | Standard STUN (Google's public or self-hosted `coturn`) | ICE candidate discovery for WebRTC |
| **TURN Server** | `coturn` | Relay for players behind symmetric NAT (fallback) |

The signalling server is stateless between sessions and horizontally scalable. Match state is never sent through the server — only the initial WebRTC handshake.

---

## Security Considerations

| Concern | Mitigation |
| :--- | :--- |
| Input injection / cheating | Both peers run the same deterministic simulation. Desynchronisation is detected via hash comparison every 60 frames and triggers a re-sync. |
| DDoS on signalling server | Rate limiting per IP (max 10 connection requests per minute). |
| Player identity | Anonymous guest play requires no account; persistent profiles use JWT authentication. |
| WebRTC IP exposure | Only ICE candidates exchanged; players can opt into relay-only mode at the cost of slightly higher latency. |

---

## Related Documents

- [Physics](physics.md) — Deterministic physics engine
- [Networking](networking.md) — Rollback netcode, WebRTC, WebSockets
- [Rendering](rendering.md) — WebGL renderer details
- [Input](input.md) — Input system
- [Build Guide](../implementation/build-guide.md) — Step-by-step development strategy
