# Aether Clash — Project Documentation

**Aether Clash** is a competitive multiplayer platform fighter running entirely in a modern web browser. It features a **"Retro-Modern 3D"** visual style — low-poly 3D models and environments rendered in a 3D world, with gameplay constrained to a 2D side-scrolling plane. It uses physics-based knockback ("Impact Percentage") instead of traditional health bars, and targets a "desktop-quality" online experience with zero installation required.

---

## Documentation Index

### Game Design
| Document | Description |
| :--- | :--- |
| [Overview](game-design/overview.md) | Executive summary, genre, target audience, and design pillars |
| [Mechanics](game-design/mechanics.md) | Combat system, knockback formula, movement, recovery, and blast zones |
| [Characters](game-design/characters.md) | Character archetypes, stats, move sets, and design notes |
| [Items](game-design/items.md) | Weapons, throwables, assist orbs, and healing charms |
| [Stages](game-design/stages.md) | Stage roster, layouts, hazards, and blast zone boundaries |

### Technical Reference
| Document | Description |
| :--- | :--- |
| [Architecture](technical/architecture.md) | High-level technology stack and system components |
| [Physics](technical/physics.md) | Physics engine, knockback calculation, gravity, and collision |
| [Networking](technical/networking.md) | Rollback netcode, WebRTC peer-to-peer, WebSocket signalling |
| [Rendering](technical/rendering.md) | WebGL renderer, camera system, visual effects, and HUD |
| [Input](technical/input.md) | Input handling, input buffer, control schemes |

### Implementation
| Document | Description |
| :--- | :--- |
| [Roadmap](implementation/roadmap.md) | Phased development plan and milestones |
| [Build Guide](implementation/build-guide.md) | Step-by-step implementation strategy and coding guidelines |

---

## Quick-Start Summary

```
Browser → WebSocket (matchmaking) → WebRTC (P2P combat) → Rollback Netcode
```

1. A player opens the game URL — no download or plugin required.
2. They are matched via a lightweight WebSocket lobby server.
3. A direct WebRTC peer connection is established for ultra-low-latency combat.
4. Rollback netcode keeps both clients in sync frame-perfectly.

---

## Version

| Field | Value |
| :--- | :--- |
| Whitepaper Version | 1.0 |
| Genre | Platform Fighter (3D world, 2D gameplay) / Physics-Based Brawler |
| Platform | Web Browser (HTML5 / WebGL) |
| Target Players | 2–4 simultaneous online |
