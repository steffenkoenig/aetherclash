# Technical — Networking

## Overview

Aether Clash uses a two-tier networking approach:

| Tier | Protocol | Purpose |
| :--- | :--- | :--- |
| **Signalling** | WebSocket | Lobby discovery, matchmaking, WebRTC handshake relay |
| **Game data** | WebRTC DataChannel | Real-time frame-by-frame input exchange |

The game server **never** processes game state. All physics simulation runs client-side. The server only facilitates the initial connection and persistent player data (profiles, rankings).

---

## 1. WebSocket Layer — Signalling & Lobby

### Connection Flow

```
Client A                  Signalling Server              Client B
   │                           │                           │
   │── connect (JWT / anon) ──►│                           │
   │                           │◄── connect (JWT / anon) ──│
   │── find_match ────────────►│                           │
   │                           │◄── find_match ────────────│
   │                           │── match_found ───────────►│
   │◄── match_found ───────────│                           │
   │                           │                           │
   │── rtc_offer (SDP) ───────►│── rtc_offer ─────────────►│
   │◄── rtc_answer (SDP) ──────│◄── rtc_answer ────────────│
   │── ice_candidate ─────────►│── ice_candidate ─────────►│
   │◄── ice_candidate ─────────│◄── ice_candidate ──────────│
   │                           │                           │
   │────────── WebRTC DataChannel established ─────────────│
   │                (WebSocket no longer needed)            │
```

### WebSocket Message Types

| Message | Direction | Payload |
| :--- | :--- | :--- |
| `connect` | Client → Server | `{ token?: string, region: string }` |
| `find_match` | Client → Server | `{ mode: 'ranked' \| 'casual', characterId: string }` |
| `match_found` | Server → Client | `{ matchId, opponentId, seed: number, isHost: boolean }` |
| `rtc_offer` | Client → Server | `{ matchId, sdp: RTCSessionDescription }` |
| `rtc_answer` | Client → Server | `{ matchId, sdp: RTCSessionDescription }` |
| `ice_candidate` | Client → Server | `{ matchId, candidate: RTCIceCandidate }` |
| `match_cancel` | Client → Server | `{ matchId }` |
| `ping` | Client → Server | `{ timestamp: number }` |
| `pong` | Server → Client | `{ timestamp: number }` |

### Matchmaking Algorithm

1. Players are placed in a regional queue.
2. The server pairs the two players whose **skill rating** is closest.
3. If no match is found within **15 seconds**, the rating range expands by ±50 points.
4. If no match within **60 seconds**, the player is notified and offered casual play.

The `seed` value in `match_found` is a random 32-bit integer used to seed the shared PRNG for item spawns and Guardian selection — ensuring both peers generate the same "random" events.

---

## 2. WebRTC Layer — Real-Time Game Data

### DataChannel Configuration

```typescript
const dataChannel = peerConnection.createDataChannel('game', {
  ordered: false,       // Unordered: old packets are discarded, not queued
  maxRetransmits: 0,    // No retransmission — stale game data is useless
});
```

`ordered: false` and `maxRetransmits: 0` give WebRTC DataChannel UDP-like behaviour — critical for low-latency game input where a dropped packet is better than a delayed one (rollback netcode handles the gap).

### Input Packet Format

Each frame, each client sends a compact input packet:

```typescript
interface InputPacket {
  frame: number;        // Current simulation frame number (uint32)
  inputs: InputState;   // Encoded controller state (see Input docs)
  checksum: number;     // CRC32 of local game state at this frame (uint32)
}
```

Total wire size: **~12 bytes** per packet. At 60 Hz, this is ~720 bytes/sec per direction — well within WebRTC DataChannel overhead.

### Input Encoding

The `InputState` is packed into a 16-bit integer to minimise packet size:

| Bits | Field |
| :--- | :--- |
| 0 | Jump |
| 1 | Attack |
| 2 | Special |
| 3 | Shield |
| 4 | Grab |
| 5–6 | Stick X (3 states: left, neutral, right → 0, 1, 2) |
| 7–8 | Stick Y (3 states: down, neutral, up → 0, 1, 2) |
| 9 | c-Stick / Smash X |
| 10 | c-Stick / Smash Y |
| 11–15 | Reserved |

For more precise analog stick data (needed for DI and special angles), a secondary analog packet is sent every 4 frames rather than every frame to reduce bandwidth while maintaining accuracy.

---

## 3. Rollback Netcode

### Concept

Rollback netcode solves the fundamental problem of networked games: **input latency**. Instead of waiting for the opponent's input before simulating, the client:

1. **Predicts** the opponent's input for the current frame (usually a repeat of the last known input).
2. **Simulates** the frame immediately using the prediction.
3. When the opponent's **real input** arrives (typically 1–3 frames later), it compares to the prediction.
4. If they differ, the client **rolls back** to the last confirmed state and **re-simulates** the intervening frames with the correct input.

This makes the game feel as if both players are playing with 0ms latency (minus display latency), at the cost of brief, imperceptible correction flickers on high-latency connections.

### State Snapshot & Restore

The rollback system maintains a circular buffer of game state snapshots:

```typescript
const ROLLBACK_BUFFER_SIZE = 8; // frames

interface GameStateSnapshot {
  frame: number;
  fighters: FighterState[];
  projectiles: ProjectileState[];
  items: ItemState[];
  rngState: LCGState;
}

const stateBuffer: GameStateSnapshot[] = new Array(ROLLBACK_BUFFER_SIZE);
```

A snapshot must be **serialisable and copyable in < 1 ms**. This is why the physics engine uses simple fixed-point values (no heap-allocated objects in hot state).

### Rollback Flow

```
Frame 100: Local input confirmed. Opponent input missing → predict (use frame 99 input).
Frame 101: Simulate with prediction. Save snapshot[101].
Frame 102: Opponent input for frame 100 arrives. Differs from prediction.
           → Restore snapshot[99] (last confirmed state before divergence)
           → Resimulate frames 100, 101, 102 with correct inputs
           → Continue from frame 102
```

```typescript
function onOpponentInput(packet: InputPacket): void {
  if (packet.frame < currentFrame - ROLLBACK_BUFFER_SIZE) {
    // Too old to roll back; desync event logged
    requestResync();
    return;
  }

  if (packet.inputs !== predictedInputs[packet.frame]) {
    // Prediction was wrong — rollback needed
    const rollbackDepth = currentFrame - packet.frame;
    restoreSnapshot(packet.frame - 1);
    for (let f = packet.frame; f <= currentFrame; f++) {
      simulateFrame(getInputForFrame(f)); // uses real input where available
    }
  }
}
```

### Desync Detection

Every 60 frames (1 second), each client broadcasts the **CRC32 checksum** of the complete game state as part of their next input packet. If peers detect a mismatch:

1. The match is flagged as desynced.
2. Both clients send their full game state snapshots to each other.
3. The "host" player's state is used as canonical truth and synced to both.
4. If the desync recurs, the match is abandoned with a draw result.

### Delay-Based Fallback

For connections with very high packet loss (> 20% over 5 seconds), the system automatically falls back to **delay-based netcode** (2-frame input delay for both players), which trades feel for stability.

---

## 4. Latency & Quality of Service

### Adaptive Input Delay

At connection start, the system measures round-trip time (RTT) and sets initial input delay:

| RTT | Input Delay Added |
| :--- | :--- |
| < 60 ms | 0 frames (pure rollback) |
| 60–120 ms | 1 frame |
| 120–180 ms | 2 frames |
| > 180 ms | 3 frames |

Input delay above 3 frames is uncommon; if RTT exceeds 300 ms consistently, the game warns the player and offers to find a new match.

### Spectator Mode

Spectators receive a WebSocket stream (not WebRTC) of the canonical game state every 60 frames, combined with delta-compressed per-frame input events. This allows reconstruction of the match with a 1-second delay without imposing any cost on the competing players.

---

## 5. Server Infrastructure

### Signalling Server

- Language: Node.js with the `ws` package
- Horizontal scaling via Redis Pub/Sub for cross-instance matchmaking
- State: only ephemeral match rooms (no persistent game state)
- Target: deployed on a low-latency region hub (e.g., regional VMs in EU, NA, APAC)

### STUN / TURN

| Service | Usage |
| :--- | :--- |
| STUN | Used by ~80% of connections (standard NAT traversal) |
| TURN | Relay fallback for ~20% of connections behind symmetric NAT |

Self-hosted `coturn` is recommended for production. Google's public STUN servers (`stun:stun.l.google.com:19302`) are acceptable during development only.

---

## Related Documents

- [Architecture](architecture.md) — System overview and technology stack
- [Physics](physics.md) — Determinism requirements for rollback
- [Input](input.md) — Input encoding format
