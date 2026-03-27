# Technical — Rendering

> Renderer: **Three.js r0.183.2** wrapping WebGL 2.0. Import path: `three` (from npm).

## Overview

Aether Clash uses **Three.js (WebGL 2.0)** for all in-game rendering. The renderer targets **60 FPS** at 1080p on mid-range hardware (integrated GPU) and degrades gracefully to 30 FPS by halving the render step without affecting the physics simulation.

The visual style is **"Retro-Modern 3D"** — low-poly 3D models rendered in a 3D world, while the gameplay is constrained to a 2D side-scrolling plane. Characters look like poseable action figures rendered in real time; environments are clean, thematic 3D geometry with animated background layers providing depth.

---

## Rendering Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Render Pipeline                    │
│                                                     │
│  ┌───────────────┐  ┌──────────────┐                │
│  │  Background   │  │   Stage      │                │
│  │  Layer(s)     │  │   Geometry   │                │
│  │  (parallax)   │  │   (platforms)│                │
│  └───────────────┘  └──────────────┘                │
│  ┌─────────────────────────────────┐                │
│  │   Character Models              │                │
│  │   (low-poly 3D, Z-buffer depth) │                │
│  └─────────────────────────────────┘                │
│  ┌─────────────────────────────────┐                │
│  │   Projectiles / Items           │                │
│  └─────────────────────────────────┘                │
│  ┌─────────────────────────────────┐                │
│  │   Particle Effects              │                │
│  └─────────────────────────────────┘                │
│  ┌─────────────────────────────────┐                │
│  │   HUD Layer (HTML/CSS overlay)  │                │
│  └─────────────────────────────────┘                │
└─────────────────────────────────────────────────────┘
```

Rendering is layered: background → geometry → characters → particles → HUD.

The HUD layer is intentionally rendered as **HTML/CSS over the canvas** (not WebGL) for maximum layout flexibility and accessibility.

---

## Renderer Setup

The game renders into a `<canvas>` element that is sized using CSS to fill the browser viewport:

```typescript
canvas.style.width  = '100vw';
canvas.style.height = '100vh';
canvas.style.objectFit = 'contain';
```

The **internal resolution** is fixed at **1920×1080** regardless of display size. Three.js handles the WebGL viewport automatically. This means the physics engine always operates at the same reference resolution.

```typescript
// src/renderer/gl.ts

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(1920, 1080, false);   // internal resolution
renderer.setClearColor(0x0d0d1e);

const camera = new THREE.OrthographicCamera(
  -960, 960,   // left / right
   540, -540,  // top / bottom
   0.1, 2000,  // near / far
);
camera.position.set(0, 0, 1000);

window.addEventListener('resize', () => {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});
```

```typescript
function onResize(): void {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  // Three.js handles viewport sizing automatically.
}
```

---

## Character Rendering

### 3D Mesh Assets

Each character is a **low-poly 3D mesh** (glTF/GLB format) loaded at runtime via Three.js `GLTFLoader`. Materials and textures are embedded directly in the GLB file. Three.js `GLTFLoader` parses and uploads them automatically.

```
public/assets/kael/
  kael.glb           # Rigged low-poly mesh with embedded animation clips and materials
```

```typescript
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
loader.load('/assets/kael/kael.glb', (gltf) => {
  scene.add(gltf.scene);
  // gltf.animations contains AnimationClip[]
});
```

### Animation System

Characters cycle through animation clips based on their **state machine** state (idle, run, jump, attack, hitstun, etc.). There are two complementary approaches:

- **State-driven pose animation:** Applied directly to object transforms in the render loop for immediate responsiveness — used for Phase 1 and 2 placeholder rendering.
- **GLB-embedded AnimationClips via `THREE.AnimationMixer`:** Clips embedded in the GLB are played via `THREE.AnimationMixer` + `AnimationAction`, enabling smooth blended transitions. This is the target approach for Phase 3+.

Each clip has:
- A named animation clip embedded in the glTF asset.
- A playback speed (frames per animation tick, where 1 tick = 1 physics frame at 60 Hz).
- A loop flag (looping for idle/run, one-shot for attacks).
- A callback for "active frames" (when hitboxes should be live).

### Low-Poly 3D Models

Characters are **real-time low-poly 3D models** rendered from a fixed side-on orthographic camera. The gameplay plane is 2D (all physics positions are X/Y), but the characters and environments exist in 3D space. This allows:

- Slight perspective depth effects (characters can be nudged along the Z axis for visual layering).
- Clean silhouettes with readable body language at small sizes.
- The "action figure" aesthetic with dynamic lighting.

```typescript
const material = new THREE.MeshToonMaterial({ color: 0x4488ee });
const mesh = new THREE.Mesh(new THREE.BoxGeometry(26, 28, 16), material);
```

---

## Intelligent Camera System

The camera is the most gameplay-critical rendering component. It must keep all active players visible while maintaining the best possible zoom level.

### Camera Target Calculation

```typescript
function computeCameraTarget(fighters: Fighter[]): CameraState {
  // 1. Find the bounding box of all fighters
  const xs = fighters.map(f => f.x);
  const ys = fighters.map(f => f.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  // 2. Camera center is the midpoint of the bounding box
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  // 3. Zoom level is the minimum zoom that fits all fighters
  const spreadX = (maxX - minX) + CAMERA_PADDING_X;
  const spreadY = (maxY - minY) + CAMERA_PADDING_Y;
  const zoomX = VIEWPORT_WIDTH  / spreadX;
  const zoomY = VIEWPORT_HEIGHT / spreadY;
  const zoom = Math.min(zoomX, zoomY, CAMERA_ZOOM_MAX);

  return { cx, cy, zoom: Math.max(zoom, CAMERA_ZOOM_MIN) };
}
```

Constants:
- `CAMERA_PADDING_X = 300` — extra horizontal padding around fighters
- `CAMERA_PADDING_Y = 200` — extra vertical padding
- `CAMERA_ZOOM_MAX = 1.2` — zoom in slightly for 1v1 close-range fights
- `CAMERA_ZOOM_MIN = 0.5` — zoom out far enough to see all corners of most stages

### Camera Smoothing

The camera does not snap to the target immediately — it lerps (linearly interpolates) toward it:

```typescript
camera.x   += (target.cx   - camera.x)   * CAMERA_LERP;
camera.y   += (target.cy   - camera.y)   * CAMERA_LERP;
camera.zoom += (target.zoom - camera.zoom) * CAMERA_ZOOM_LERP;

// CAMERA_LERP      = 0.08 (position)
// CAMERA_ZOOM_LERP = 0.04 (zoom, slower to avoid nausea)
```

Zoom changes are intentionally slower than position changes to avoid disorienting the player during fast engagements.

### Three.js Camera Integration

```typescript
// Driven from camera.ts every render frame:
threeCamera.position.set(camera.x, camera.y, 1000);
threeCamera.zoom = camera.zoom;     // zoom in/out without changing frustum
threeCamera.updateProjectionMatrix(); // required after changing zoom
```

---

## Visual Effects

### Launch Trails

When a character is launched with a knockback force above a threshold (F > 8), a **launch trail** is spawned:

| Launch Force | Trail Color | Duration |
| :--- | :--- | :--- |
| 8–15 | White | 0.3 seconds |
| 16–25 | Yellow/Orange | 0.5 seconds |
| 26–40 | Orange/Red | 0.7 seconds |
| 40+ | Red/Purple | 1.0 second |

Trails are rendered as a series of fading quads following the character's previous positions (last 8 positions stored).

### Screen Shake

High-impact hits trigger camera shake. The camera offset is perturbed by a damped sine wave:

```typescript
function triggerScreenShake(intensity: number, duration: number): void {
  shakeIntensity = intensity;
  shakeDuration  = duration;
  shakeDecay     = intensity / duration;
}

// Per frame:
if (shakeDuration > 0) {
  camera.offsetX = Math.sin(shakeTimer * 60) * shakeIntensity;
  shakeIntensity -= shakeDecay * FIXED_STEP;
  shakeDuration  -= FIXED_STEP;
}
```

Shake values for key events:
| Event | Intensity | Duration |
| :--- | :--- | :--- |
| Light hit | 2 px | 0.1 s |
| Strong hit | 6 px | 0.2 s |
| Smash attack land | 12 px | 0.3 s |
| KO | 20 px | 0.5 s |

### Hit Sparks

A burst of 6–12 particle quads spawns at the hit location. Each particle has a random velocity within the hit angle cone, a lifespan of 0.2–0.4 seconds, and fades out via alpha. Colour matches the attacking character's accent colour.

### KO Flash

When a player crosses a blast zone, a full-screen white flash (1 frame) followed by a brief dark vignette (0.5 seconds, fading) signals the KO.

---

## HUD System

The HUD is rendered as an HTML/CSS overlay above the Three.js canvas. It includes:

### Damage Display

```
Player 1: KAEL           Player 2: GORUN
  ♥ ♥ ♥                    ♥ ♥ ♥
  124%                      67%
```

- Damage percentage is styled with colour transitions:
  - 0–50%: White
  - 51–100%: Yellow
  - 101–150%: Orange
  - 151%+: Red (pulsing animation)
- Stock icons (hearts / custom icons) displayed below the character name.

### Off-Screen Indicator ("Magnifying Glass")

When a character is off-screen (outside the camera viewport) but has not yet crossed a blast zone:

1. A small circular HUD element appears at the **edge of the viewport** in the direction of the off-screen character.
2. The circle contains a miniature silhouette of the character.
3. The circle's border colour matches the player's assigned colour.
4. An arrow inside the circle points toward the off-screen position.

This prevents a player from being "lost" when launched far off stage during a recovery attempt.

### Timer & Stock Counter

- A central timer (Time Mode only) displayed at the top center.
- Stock counts displayed as small icons below each damage percentage.

---

## Parallax Background System

Stage backgrounds are composed of 3–5 independent 3D geometry layers placed at increasing Z depths. As the camera pans, each layer translates at a different rate, creating a natural parallax depth effect:

```typescript
const bgPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(7680, 4320),
  new THREE.MeshBasicMaterial({ color: 0x1a1a3e }),
);
bgPlane.position.set(0, 0, -400);
scene.add(bgPlane);

// Parallax: offset each layer by camera.x * depth
parallaxLayers.forEach(layer => {
  layer.mesh.position.x = -camera.x * layer.depth;
});
```

Each layer is a low-poly 3D mesh with flat-shaded materials that matches the overall "Retro-Modern 3D" aesthetic of the stage.

---

## Performance Budget

| Component | Target GPU Time | Note |
| :--- | :--- | :--- |
| Background layers | < 0.5 ms | Three.js draw call overhead included |
| Stage geometry | < 0.3 ms | |
| Character models (×4) | < 1.0 ms | Three.js AnimationMixer overhead included |
| Particles + trails | < 0.5 ms | |
| Total frame budget | < 4 ms GPU | Leaves room for 60 FPS on 8 ms budget |

Three.js r0.183.2 adds negligible CPU overhead on top of raw WebGL for the scene sizes used in Aether Clash.

---

## Related Documents

- [Architecture](architecture.md) — Canvas setup, asset pipeline
- [Renderer Setup](rendering.md) — This document
- [Stages](../game-design/stages.md) — Stage aesthetics, colour palettes
- [Characters](../game-design/characters.md) — Character visual design
