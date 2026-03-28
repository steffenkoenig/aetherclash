// src/renderer/gl.ts
// Three.js WebGL renderer — perspective 2.5D view with gentle downward tilt.
// Internal resolution: 1920×1080, CSS-scaled to fill the viewport.
//
// Rendering layers (back to front):
//   1. Deep-space background + star field
//   2. Stage geometry (platform meshes)
//   3. Item pickups (glowing 3D shapes, one per active item)
//   4. Character models (procedural humanoid groups; swapped for GLBs on load)
//   5. HUD (HTML/CSS overlay — not managed here)

import * as THREE from 'three';
import { toFloat } from '../engine/physics/fixednum.js';
import {
  transformComponents,
  renderableComponents,
  fighterComponents,
  type FighterState,
} from '../engine/ecs/component.js';
import type { Platform } from '../engine/physics/collision.js';
import { fixedSub } from '../engine/physics/fixednum.js';
import { camera } from './camera.js';
import { loadGLTF } from './models.js';
import { activeItems, ASSIST_ORB_MAX_HP, type ItemCategory } from '../game/items/items.js';
import { buildStageEnvironment } from './stages/index.js';

// ── Internal resolution ───────────────────────────────────────────────────────

const INTERNAL_WIDTH  = 1920;
const INTERNAL_HEIGHT = 1080;

// ── Three.js singletons ───────────────────────────────────────────────────────

let renderer: THREE.WebGLRenderer;
let scene:    THREE.Scene;
let threeCamera: THREE.PerspectiveCamera;

// Camera Z distance and Y tilt for the 2.5D perspective look.
const PERSP_Z      = 700;
const PERSP_TILT_Y = 100;  // camera sits this many units above the focus point

let ambientLight: THREE.AmbientLight;
let dirLight: THREE.DirectionalLight;

// ── Character mesh registry ───────────────────────────────────────────────────

// Maps entity id → Three.js Group currently in the scene.
const characterMeshes = new Map<number, THREE.Group>();
// Tracks which entities have already triggered a GLB swap (to swap only once).
const glbSwapped      = new Set<number>();

// Per-entity smoothed Y-rotation for the turn-around animation (renderer-only).
// Keyed by entity id; value is the current rotation.y in radians.
const characterFaceAngles = new Map<number, number>();

// How quickly the character rotates toward its target facing angle per frame.
// At 60 Hz, ~12 frames to reach 90 % of the target — snappy but visibly smooth.
const TURN_LERP = 0.18;

// ── Item mesh registry ────────────────────────────────────────────────────────

// Maps item entityId → Three.js Mesh currently in the scene.
const itemMeshes = new Map<number, THREE.Mesh>();

/** Category-specific colours (hex) for item pickup meshes. */
const ITEM_MESH_COLOR: Record<ItemCategory, number> = {
  meleeAugment:        0xFFD700, // gold
  throwableProjectile: 0xFF6633, // orange-red
  assistOrb:           0xCC88FF, // purple
  healingCharm:        0x44FF88, // green
};

/** Build a glowing octahedron mesh for a given item category. */
function buildItemMesh(category: ItemCategory): THREE.Mesh {
  const hex = ITEM_MESH_COLOR[category];
  const geo = new THREE.OctahedronGeometry(14, 0);
  const mat = new THREE.MeshStandardMaterial({
    color:            hex,
    emissive:         hex,
    emissiveIntensity: 0.55,
    metalness:        0.35,
    roughness:        0.35,
  });
  return new THREE.Mesh(geo, mat);
}

/**
 * Remove all item meshes from the scene.
 * Call at match start / end to avoid stale meshes carrying over.
 */
export function resetItemMeshes(): void {
  for (const mesh of itemMeshes.values()) {
    scene?.remove(mesh);
    (mesh.material as THREE.Material).dispose();
    mesh.geometry.dispose();
  }
  itemMeshes.clear();
}

// ── Animation mixer registry ─────────────────────────────────────────────────

// AnimationMixers for GLB-loaded models, keyed by entity id.
const mixers       = new Map<number, THREE.AnimationMixer>();
// Per-entity GltfModel references (so we can look up clips).
const modelRefs    = new Map<number, import('./models.js').GltfModel>();
// Last clip name played per entity (to avoid restarting the same clip).
const activeClipNames = new Map<number, string>();

let lastMixerTime = 0;

/** Map fighter state names to GLB animation clip names. */
const STATE_TO_CLIP: Partial<Record<import('../engine/ecs/component.js').FighterState, string>> = {
  idle:       'idle',
  walk:       'run',
  run:        'run',
  jump:       'jump',
  doubleJump: 'jump',
  attack:     'attack',
  hitstun:    'hitstun',
  KO:         'KO',
  shielding:  'idle',
  spotDodge:  'idle',
  rolling:    'run',
  airDodge:   'jump',
};

function updateMixer(entityId: number, state: import('../engine/ecs/component.js').FighterState): void {
  const mixer = mixers.get(entityId);
  const model = modelRefs.get(entityId);
  if (!mixer || !model || model.clips.length === 0) return;

  const clipName = STATE_TO_CLIP[state] ?? 'idle';
  const current  = activeClipNames.get(entityId);
  if (current === clipName) return;

  const clip = THREE.AnimationClip.findByName(model.clips, clipName);
  if (!clip) return;

  mixer.stopAllAction();
  const action = mixer.clipAction(clip);
  const loop = clipName === 'idle' || clipName === 'run';
  action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
  action.clampWhenFinished = !loop;
  action.reset().play();
  activeClipNames.set(entityId, clipName);
}

// ── Platform mesh registry ────────────────────────────────────────────────────

// Maps a platform reference string to its mesh so we don't recreate every frame.
const platformMeshes = new Map<string, THREE.Group>();

/** Clear all cached platform meshes and remove them from the scene. */
export function clearPlatformMeshes(): void {
  for (const group of platformMeshes.values()) {
    scene?.remove(group);
    group.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        (obj as THREE.Mesh).geometry.dispose();
        const mat = (obj as THREE.Mesh).material;
        if (Array.isArray(mat)) mat.forEach(m => m.dispose());
        else (mat as THREE.Material).dispose();
      }
    });
  }
  platformMeshes.clear();
}

// ── Stage background (loaded from GLB) ───────────────────────────────────────

/** The current stage id used for platform styling. */
let currentStageId = 'aetherPlateau';

/** The Three.js Group added to the scene from the stage GLB, or null. */
let stageBackgroundGroup: THREE.Group | null = null;

/** Per-stage sky / fog colours for scene.background. */
const STAGE_SKY_COLOR: Record<string, number> = {
  aetherPlateau:  0xffd580,
  forge:          0x050b14,
  cloudCitadel:   0xffeeff,
  ancientRuin:    0x3a4030,
  digitalGrid:    0x020408,
  crystalCavern:  0x0a0a1a,
  voidRift:       0x000008,
  solarPinnacle:  0xff8c00,
};

interface StageLighting {
  ambient: number; aIntensity: number;
  dir: number; dIntensity: number;
  fog: THREE.Fog | THREE.FogExp2 | null;
}
const STAGE_LIGHTING: Record<string, StageLighting> = {
  aetherPlateau: { ambient: 0xfff8e0, aIntensity: 0.70, dir: 0xfff5c0, dIntensity: 1.1,  fog: new THREE.Fog(0xc8e8ff, 800, 2500) },
  forge:         { ambient: 0x1a2030, aIntensity: 0.35, dir: 0xff8030, dIntensity: 1.3,  fog: new THREE.FogExp2(0x050a14, 0.0004) },
  cloudCitadel:  { ambient: 0xfff0ff, aIntensity: 0.90, dir: 0xfff4ff, dIntensity: 0.9,  fog: new THREE.Fog(0xf0e8ff, 700, 2200) },
  ancientRuin:   { ambient: 0x405030, aIntensity: 0.45, dir: 0xb0c880, dIntensity: 0.85, fog: new THREE.FogExp2(0x1e2c14, 0.0006) },
  digitalGrid:   { ambient: 0x081828, aIntensity: 0.35, dir: 0x00ccff, dIntensity: 1.2,  fog: new THREE.FogExp2(0x020408, 0.0005) },
  crystalCavern: { ambient: 0x0a1020, aIntensity: 0.30, dir: 0x44ffcc, dIntensity: 1.0,  fog: new THREE.FogExp2(0x050412, 0.0006) },
  voidRift:      { ambient: 0x100028, aIntensity: 0.25, dir: 0x9933ff, dIntensity: 1.0,  fog: new THREE.FogExp2(0x080012, 0.0005) },
  solarPinnacle: { ambient: 0x402808, aIntensity: 0.55, dir: 0xffcc22, dIntensity: 1.4,  fog: new THREE.Fog(0xff8000, 600, 2000) },
};

/**
 * Build the stage environment and update platform mesh colours.
 * Call once per match before entities are spawned.
 */
export function setStage(stageId: string): void {
  // Remove previous stage background
  if (stageBackgroundGroup) {
    scene?.remove(stageBackgroundGroup);
    stageBackgroundGroup.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        (obj as THREE.Mesh).geometry.dispose();
        const mat = (obj as THREE.Mesh).material;
        if (Array.isArray(mat)) mat.forEach(m => m.dispose());
        else (mat as THREE.Material).dispose();
      }
    });
    stageBackgroundGroup = null;
  }

  clearPlatformMeshes();
  currentStageId = stageId;

  // Update sky background colour
  const skyHex = STAGE_SKY_COLOR[stageId] ?? 0x0d0d1e;
  if (scene) scene.background = new THREE.Color(skyHex);

  // Apply stage lighting
  const lighting = STAGE_LIGHTING[stageId] ?? STAGE_LIGHTING['aetherPlateau']!;
  if (ambientLight) {
    ambientLight.color.setHex(lighting.ambient);
    ambientLight.intensity = lighting.aIntensity;
  }
  if (dirLight) {
    dirLight.color.setHex(lighting.dir);
    dirLight.intensity = lighting.dIntensity;
  }
  if (scene) scene.fog = lighting.fog;

  // Build the stage environment directly (synchronous — no async GLB loading)
  if (scene) {
    stageBackgroundGroup = buildStageEnvironment(scene, stageId);
  }
}

// ── Character colour palette ──────────────────────────────────────────────────

const CHARACTER_COLORS: Record<string, number> = {
  kael:  0x4488ee,
  gorun: 0xee6600,
  vela:  0x44dd66,
  syne:  0xcc44ff,
  zira:  0xffd700,
};
const FALLBACK_COLOR = 0xff4444;

// ── Procedural character mesh ─────────────────────────────────────────────────

function dimColor(hex: number, factor: number): number {
  const r = ((hex >> 16) & 0xff) * factor;
  const g = ((hex >>  8) & 0xff) * factor;
  const b = ( hex        & 0xff) * factor;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}

export function createCharacterMesh(characterId: string): THREE.Group {
  const mainColor = CHARACTER_COLORS[characterId] ?? FALLBACK_COLOR;
  const armColor  = dimColor(mainColor, 0.7);
  const legColor  = dimColor(mainColor, 0.6);

  const mainMat  = new THREE.MeshToonMaterial({ color: mainColor });
  const armMat   = new THREE.MeshToonMaterial({ color: armColor });
  const legMat   = new THREE.MeshToonMaterial({ color: legColor });
  const eyeMat   = new THREE.MeshToonMaterial({ color: 0x111111 });

  function box(w: number, h: number, d: number, mat: THREE.Material): THREE.Mesh {
    return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  }

  const torso = box(26, 28, 16, mainMat);
  torso.position.set(0, 3, 0);

  const head = box(20, 20, 16, mainMat);
  head.position.set(0, 28, 0);

  const eyeL = box(4, 3, 2, eyeMat);
  eyeL.position.set(-5, 30, 8);

  const eyeR = box(4, 3, 2, eyeMat);
  eyeR.position.set(5, 30, 8);

  const armL = box(8, 22, 8, armMat);
  armL.position.set(-17, 5, 0);

  const armR = box(8, 22, 8, armMat);
  armR.position.set(17, 5, 0);

  const legL = box(10, 26, 10, legMat);
  legL.position.set(-8, -21, 0);

  const legR = box(10, 26, 10, legMat);
  legR.position.set(8, -21, 0);

  const group = new THREE.Group();
  group.add(torso, head, eyeL, eyeR, armL, armR, legL, legR);

  group.userData['parts'] = { torso, head, armL, armR, legL, legR };

  return group;
}

// ── Per-stage platform builders ────────────────────────────────────────────────

const PLAT_THICKNESS = 20;
const PLAT_DEPTH     = 50;

function pmToon(color: number): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({ color });
}
function pmStd(color: number, opts: {
  emissive?: number; emissiveIntensity?: number;
  metalness?: number; roughness?: number;
} = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    emissive:          opts.emissive          ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    metalness:         opts.metalness         ?? 0,
    roughness:         opts.roughness         ?? 0.8,
  });
}

function platBox(group: THREE.Group, w: number, h: number, d: number, mat: THREE.Material,
  ox = 0, oy = 0, oz = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(ox, oy, oz);
  group.add(mesh);
  return mesh;
}

function buildPlatAetherPlateau(group: THREE.Group, w: number, isPass: boolean): void {
  // Stone body + grass top + dark earth bottom
  platBox(group, w, PLAT_THICKNESS, PLAT_DEPTH, pmToon(isPass ? 0xc8a870 : 0xa87848));
  platBox(group, w + 4, 6, PLAT_DEPTH + 4, pmToon(0x58a030), 0, PLAT_THICKNESS / 2 + 3, 0);
  platBox(group, w, 8, PLAT_DEPTH, pmToon(0x3a2810), 0, -PLAT_THICKNESS / 2 - 4, 0);
  // Grass tufts along top
  const tuftCount = Math.max(2, Math.floor(w / 80));
  for (let i = 0; i < tuftCount; i++) {
    const tx = -w / 2 + (i + 0.5) * (w / tuftCount);
    platBox(group, 18, 12, 14, pmToon(0x78c040), tx, PLAT_THICKNESS / 2 + 9, -5, );
  }
  // Hanging stalactites below main (not pass-through)
  if (!isPass && w > 200) {
    for (let s = 0; s < Math.floor(w / 150); s++) {
      const sx = -w / 2 + 80 + s * 140;
      const stalGroup = new THREE.Group();
      stalGroup.add(new THREE.Mesh(new THREE.ConeGeometry(8, 35, 5), pmToon(0x7a6050)));
      stalGroup.position.set(sx, -PLAT_THICKNESS / 2 - 17, 0);
      stalGroup.rotation.z = Math.PI;
      group.add(stalGroup);
    }
  }
}

function buildPlatForge(group: THREE.Group, w: number, isPass: boolean): void {
  platBox(group, w, PLAT_THICKNESS, PLAT_DEPTH,
    pmStd(isPass ? 0x3e5060 : 0x2e3e50, { metalness: 0.65, roughness: 0.45 }));
  // Grating bars across top
  const barCount = Math.max(3, Math.floor(w / 50));
  for (let b = 0; b < barCount; b++) {
    const bx = -w / 2 + (b + 0.5) * (w / barCount);
    platBox(group, 4, 4, PLAT_DEPTH + 4,
      pmStd(0x3a4e60, { metalness: 0.7, roughness: 0.4 }), bx, PLAT_THICKNESS / 2 + 2, 0);
  }
  // Orange underglow emissive strip
  platBox(group, w - 8, 4, PLAT_DEPTH - 4,
    pmStd(0xff4400, { emissive: 0xff4400, emissiveIntensity: 0.9 }), 0, -PLAT_THICKNESS / 2 - 2, 0);
  // Warning stripe end panels
  platBox(group, 10, PLAT_THICKNESS, PLAT_DEPTH, pmToon(isPass ? 0x888800 : 0xaaaa00), -w / 2 - 5, 0, 0);
  platBox(group, 10, PLAT_THICKNESS, PLAT_DEPTH, pmToon(isPass ? 0x888800 : 0xaaaa00),  w / 2 + 5, 0, 0);
}

function buildPlatCloudCitadel(group: THREE.Group, w: number, _isPass: boolean): void {
  // Cloud puff shape — no flat box, overlapping flattened spheres
  const puffCount = Math.max(2, Math.floor(w / 80));
  for (let p = 0; p < puffCount; p++) {
    const px = -w / 2 + (p + 0.5) * (w / puffCount);
    const pr = 45 + (p % 3) * 12;
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(pr, 8, 6),
      pmToon(p % 2 === 0 ? 0xf8f8ff : 0xe8e8ff),
    );
    puff.scale.set(1.0, 0.5, 0.9);
    puff.position.set(px, 0, 0);
    group.add(puff);
  }
  // Slight shimmer highlight
  const shimmer = new THREE.Mesh(
    new THREE.BoxGeometry(w, 3, PLAT_DEPTH),
    pmToon(0xffffff),
  );
  shimmer.position.set(0, 22, 0);
  group.add(shimmer);
}

function buildPlatAncientRuin(group: THREE.Group, w: number, isPass: boolean): void {
  platBox(group, w, PLAT_THICKNESS, PLAT_DEPTH, pmToon(isPass ? 0x8a7a5a : 0x6a6050));
  // Moss top layer
  platBox(group, w + 4, 5, PLAT_DEPTH + 4,
    pmStd(0x2a4a18, { emissive: 0x1a3010, emissiveIntensity: 0.1 }), 0, PLAT_THICKNESS / 2 + 2, 0);
  // Vertical crack lines
  const crackCount = Math.max(2, Math.floor(w / 120));
  for (let c = 0; c < crackCount; c++) {
    const cx = -w / 2 + (c + 1) * (w / (crackCount + 1));
    platBox(group, 2, PLAT_THICKNESS, PLAT_DEPTH + 2, pmToon(0x3a2c1c), cx, 0, 0);
  }
  // Small rubble at each edge
  platBox(group, 20, 12, 20, pmToon(0x5a4a34), -w / 2 + 10, PLAT_THICKNESS / 2 + 6, 0);
  platBox(group, 20, 12, 20, pmToon(0x5a4a34),  w / 2 - 10, PLAT_THICKNESS / 2 + 6, 0);
}

function buildPlatDigitalGrid(group: THREE.Group, w: number, isPass: boolean): void {
  platBox(group, w, PLAT_THICKNESS, PLAT_DEPTH,
    pmStd(isPass ? 0x100840 : 0x080620, { emissive: 0x001a22, emissiveIntensity: 0.2, roughness: 0.9 }));
  // Glowing cyan edge frame
  platBox(group, w + 4, 3, PLAT_DEPTH + 4,
    pmStd(0x00ffee, { emissive: 0x00ffee, emissiveIntensity: 1.0 }), 0, PLAT_THICKNESS / 2 + 1, 0);
  platBox(group, w + 4, 3, PLAT_DEPTH + 4,
    pmStd(0x00aacc, { emissive: 0x00aacc, emissiveIntensity: 0.8 }), 0, -PLAT_THICKNESS / 2 - 1, 0);
  platBox(group, 3, PLAT_THICKNESS, PLAT_DEPTH + 4,
    pmStd(0x00ffee, { emissive: 0x00ffee, emissiveIntensity: 1.0 }), -w / 2 - 1, 0, 0);
  platBox(group, 3, PLAT_THICKNESS, PLAT_DEPTH + 4,
    pmStd(0x00ffee, { emissive: 0x00ffee, emissiveIntensity: 1.0 }),  w / 2 + 1, 0, 0);
  // Corner data nodes
  const dataMat = pmStd(0x00aaff, { emissive: 0x00aaff, emissiveIntensity: 1.0 });
  for (const cx of [-w / 2, w / 2]) {
    const node = new THREE.Mesh(new THREE.SphereGeometry(5, 6, 4), dataMat);
    node.position.set(cx, PLAT_THICKNESS / 2 + 2, 0);
    group.add(node);
  }
  // Scan line data tendrils hanging below
  for (let t = 0; t < 4; t++) {
    const tx = -w / 3 + t * (w / 3) * 0.66;
    for (let seg = 0; seg < 4; seg++) {
      platBox(group, 3, 8, 3,
        pmStd(0x00ffaa, { emissive: 0x00ffaa, emissiveIntensity: 0.8 - seg * 0.15,
          ...(seg > 0 ? {} : {}) }),
        tx, -PLAT_THICKNESS / 2 - 10 - seg * 14, 0);
    }
  }
}

function buildPlatCrystalCavern(group: THREE.Group, w: number, isPass: boolean): void {
  platBox(group, w, PLAT_THICKNESS, PLAT_DEPTH,
    pmStd(isPass ? 0x2a2a4e : 0x1a1a2e, { emissive: 0x060614, emissiveIntensity: 0.1, roughness: 0.85 }));
  // Crystal spires along top edge
  const spireCount = Math.max(3, Math.floor(w / 60));
  const spireColors = [0x44ffee, 0xcc44ff, 0x4488ff, 0x44ff88];
  for (let s = 0; s < spireCount; s++) {
    const sx = -w / 2 + (s + 0.5) * (w / spireCount);
    const sc = spireColors[s % spireColors.length]!;
    const h = 25 + (s % 3) * 15;
    const spire = new THREE.Mesh(
      new THREE.ConeGeometry(5 + (s % 3) * 2, h, 4),
      pmStd(sc, { emissive: sc, emissiveIntensity: 0.6 }),
    );
    spire.position.set(sx, PLAT_THICKNESS / 2 + h / 2, (s % 2) * 6 - 3);
    group.add(spire);
  }
  // Underglow teal strip
  platBox(group, w - 4, 4, PLAT_DEPTH - 4,
    pmStd(0x44ffcc, { emissive: 0x44ffcc, emissiveIntensity: 0.8 }), 0, -PLAT_THICKNESS / 2 - 2, 0);
}

function buildPlatVoidRift(group: THREE.Group, w: number, isPass: boolean): void {
  platBox(group, w, PLAT_THICKNESS, PLAT_DEPTH,
    pmStd(isPass ? 0x2a1a3a : 0x180a28, { emissive: 0x0a0014, emissiveIntensity: 0.15, roughness: 0.95 }));
  // Purple glowing edge outline
  platBox(group, w + 4, 3, PLAT_DEPTH + 4,
    pmStd(0x8833ff, { emissive: 0x8833ff, emissiveIntensity: 1.0 }), 0, PLAT_THICKNESS / 2 + 1, 0);
  platBox(group, w + 4, 3, PLAT_DEPTH + 4,
    pmStd(0x4400aa, { emissive: 0x4400aa, emissiveIntensity: 0.7 }), 0, -PLAT_THICKNESS / 2 - 1, 0);
  platBox(group, 3, PLAT_THICKNESS, PLAT_DEPTH + 4,
    pmStd(0x8833ff, { emissive: 0x8833ff, emissiveIntensity: 1.0 }), -w / 2 - 1, 0, 0);
  platBox(group, 3, PLAT_THICKNESS, PLAT_DEPTH + 4,
    pmStd(0x8833ff, { emissive: 0x8833ff, emissiveIntensity: 1.0 }),  w / 2 + 1, 0, 0);
  // Void tendril cones hanging below
  const tendrilCount = Math.max(2, Math.floor(w / 100));
  for (let t = 0; t < tendrilCount; t++) {
    const tx = -w / 2 + 60 + t * (w - 120) / Math.max(1, tendrilCount - 1);
    const tendril = new THREE.Mesh(
      new THREE.ConeGeometry(5, 28, 4),
      pmStd(0x6600cc, { emissive: 0x6600cc, emissiveIntensity: 0.7 }),
    );
    tendril.position.set(tx, -PLAT_THICKNESS / 2 - 14, 0);
    tendril.rotation.z = Math.PI;
    group.add(tendril);
  }
}

function buildPlatSolarPinnacle(group: THREE.Group, w: number, isPass: boolean): void {
  platBox(group, w, PLAT_THICKNESS, PLAT_DEPTH, pmToon(isPass ? 0xc09030 : 0xb87840));
  // Snow/ice top strip
  platBox(group, w + 4, 6, PLAT_DEPTH + 4, pmToon(0xf0f8ff), 0, PLAT_THICKNESS / 2 + 3, 0);
  // Geological strata lines
  platBox(group, w, 3, PLAT_DEPTH + 2, pmToon(0x9a5828), 0, 4, 0);
  platBox(group, w, 3, PLAT_DEPTH + 2, pmToon(0xd4902e), 0, -4, 0);
  // Warm golden edge glow
  platBox(group, 6, PLAT_THICKNESS, PLAT_DEPTH,
    pmStd(0xffcc44, { emissive: 0xffcc44, emissiveIntensity: 0.6 }), -w / 2 - 3, 0, 0);
  platBox(group, 6, PLAT_THICKNESS, PLAT_DEPTH,
    pmStd(0xffcc44, { emissive: 0xffcc44, emissiveIntensity: 0.6 }),  w / 2 + 3, 0, 0);
  // Rocky end protrusions
  platBox(group, 30, 25, 30, pmToon(0xa06030), -w / 2 + 15, PLAT_THICKNESS / 2 + 12, 0);
  platBox(group, 30, 25, 30, pmToon(0xa06030),  w / 2 - 15, PLAT_THICKNESS / 2 + 12, 0);
}

function buildPlatDefault(group: THREE.Group, w: number, isPass: boolean): void {
  platBox(group, w, PLAT_THICKNESS, PLAT_DEPTH, pmToon(isPass ? 0xd8b87e : 0xa87848));
  platBox(group, w + 4, 5, PLAT_DEPTH + 4, pmToon(0x58a030), 0, PLAT_THICKNESS / 2 + 2, 0);
}

// ── Platform mesh builder ─────────────────────────────────────────────────────

export function buildPlatformMesh(plat: Platform): THREE.Group {
  const x1 = toFloat(plat.x1);
  const x2 = toFloat(plat.x2);
  const py  = toFloat(plat.y);
  const w   = toFloat(fixedSub(plat.x2, plat.x1));
  const cx  = (x1 + x2) / 2;
  const group = new THREE.Group();
  switch (currentStageId) {
    case 'aetherPlateau': buildPlatAetherPlateau(group, w, plat.passThrough ?? false); break;
    case 'forge':         buildPlatForge(group, w, plat.passThrough ?? false);         break;
    case 'cloudCitadel':  buildPlatCloudCitadel(group, w, plat.passThrough ?? false);  break;
    case 'ancientRuin':   buildPlatAncientRuin(group, w, plat.passThrough ?? false);   break;
    case 'digitalGrid':   buildPlatDigitalGrid(group, w, plat.passThrough ?? false);   break;
    case 'crystalCavern': buildPlatCrystalCavern(group, w, plat.passThrough ?? false); break;
    case 'voidRift':      buildPlatVoidRift(group, w, plat.passThrough ?? false);      break;
    case 'solarPinnacle': buildPlatSolarPinnacle(group, w, plat.passThrough ?? false); break;
    default:              buildPlatDefault(group, w, plat.passThrough ?? false);        break;
  }
  group.position.set(cx, py - PLAT_THICKNESS / 2, -20);
  return group;
}

// ── Platform key (for caching) ────────────────────────────────────────────────

function platKey(plat: Platform): string {
  return `${plat.x1},${plat.x2},${plat.y},${plat.passThrough}`;
}

// ── Scene background setup ────────────────────────────────────────────────────

function buildBackground(): void {
  // Deep-space base plane
  const bgMat = new THREE.MeshBasicMaterial({ color: 0x1a1a3e });
  const bgPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(INTERNAL_WIDTH * 4, INTERNAL_HEIGHT * 4),
    bgMat,
  );
  bgPlane.position.set(0, 0, -400);
  scene.add(bgPlane);

  // Subtle horizon glow
  const horizonMat = new THREE.MeshBasicMaterial({ color: 0x252550, transparent: true, opacity: 0.6 });
  const horizonPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(INTERNAL_WIDTH * 4, INTERNAL_HEIGHT * 0.4),
    horizonMat,
  );
  horizonPlane.position.set(0, -INTERNAL_HEIGHT * 0.25, -399);
  scene.add(horizonPlane);

  // Star field: 200 small spheres scattered in the background
  const starMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (let i = 0; i < 200; i++) {
    const star = new THREE.Mesh(new THREE.SphereGeometry(1.5, 4, 4), starMat);
    star.position.set(
      (Math.random() - 0.5) * 4000,
      (Math.random() - 0.5) * 2400,
      -300,
    );
    scene.add(star);
  }
}

// ── Renderer initialisation ───────────────────────────────────────────────────

export function initRenderer(existingCanvas?: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = existingCanvas ?? document.createElement('canvas');
  canvas.style.width     = '100vw';
  canvas.style.height    = '100vh';
  canvas.style.objectFit = 'contain';
  canvas.style.display   = 'block';
  canvas.style.background = '#000';

  if (!existingCanvas) {
    document.body.style.margin   = '0';
    document.body.style.overflow = 'hidden';
    document.body.style.background = '#000';
    document.body.appendChild(canvas);
  }

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(INTERNAL_WIDTH, INTERNAL_HEIGHT, false);
  renderer.setClearColor(0x0d0d1e);
  renderer.shadowMap.enabled = false;

  // Perspective camera: 45° FOV, matches internal aspect ratio.
  // Positioned above and in front of the stage; looks slightly downward (~8°).
  threeCamera = new THREE.PerspectiveCamera(
    45,
    INTERNAL_WIDTH / INTERNAL_HEIGHT,
    0.1,
    5000,
  );
  threeCamera.position.set(0, PERSP_TILT_Y, PERSP_Z);
  threeCamera.lookAt(0, 0, 0);

  scene = new THREE.Scene();

  ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

  dirLight = new THREE.DirectionalLight(0xffe8d0, 1.0);
  dirLight.position.set(300, 600, 800);
  scene.add(dirLight);

  buildBackground();

  window.addEventListener('resize', onResize);

  return canvas;
}

function onResize(): void {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  // Re-apply the fixed internal size so the backbuffer matches the updated
  // pixel ratio (setPixelRatio alone does not resize the drawing buffer).
  renderer.setSize(INTERNAL_WIDTH, INTERNAL_HEIGHT, false);
  // Camera aspect is fixed (INTERNAL_WIDTH:INTERNAL_HEIGHT) — no update needed.
}

/**
 * Clear all per-match character meshes and mixer state so a new match can be
 * started with fresh entities.  Call this before creating new entities.
 * Also clears platform meshes so the new stage can apply its own visual style.
 */
export function resetRenderer(): void {
  for (const group of characterMeshes.values()) {
    scene?.remove(group);
  }
  characterMeshes.clear();
  glbSwapped.clear();
  characterFaceAngles.clear();
  mixers.clear();
  modelRefs.clear();
  activeClipNames.clear();
  lastMixerTime = 0;
  // Clear platform mesh cache — new stage will rebuild with its own palette.
  clearPlatformMeshes();
}

// ── Camera (no-op shim kept for API compatibility) ────────────────────────────

export function setRenderCamera(_offsetX: number, _offsetY: number, _scaleX: number, _scaleY: number): void {
  // No-op: the Three.js renderer drives the camera directly from camera.ts.
}

// ── Character pose animation ──────────────────────────────────────────────────

type Parts = {
  torso: THREE.Mesh;
  head:  THREE.Mesh;
  armL:  THREE.Mesh;
  armR:  THREE.Mesh;
  legL:  THREE.Mesh;
  legR:  THREE.Mesh;
};

function applyPose(group: THREE.Group, state: FighterState): void {
  const parts = group.userData['parts'] as Parts | undefined;
  if (!parts) return;

  const { armL, armR, legL, legR } = parts;
  // Date.now() is renderer-only (visual animation, never touches physics state).
  // The determinism rule applies only to the simulation path.
  const t = Date.now() * 0.001;

  // Reset per-frame transient transforms before applying state pose.
  // rotation.y (facing direction) is set by the caller — do not touch it here.
  group.rotation.z = 0;
  group.scale.set(1, 1, 1);

  // Reset arm forward position (used by attack)
  armR.position.z = 0;

  switch (state) {
    case 'idle': {
      const bob = Math.sin(Date.now() * 0.003) * 1.5;
      group.position.y += bob;
      legL.rotation.x = 0;
      legR.rotation.x = 0;
      armL.rotation.x = 0;
      armR.rotation.x = 0;
      break;
    }
    case 'run': {
      const s = Math.sin(t * 6);
      legL.rotation.x =  s * 0.5;
      legR.rotation.x = -s * 0.5;
      armL.rotation.x = -s * 0.3;
      armR.rotation.x =  s * 0.3;
      break;
    }
    case 'jump':
    case 'doubleJump':
      legL.rotation.x = -0.3;
      legR.rotation.x = -0.3;
      armL.rotation.x = -0.3;
      armR.rotation.x = -0.3;
      break;

    case 'attack':
      armR.rotation.x = -Math.PI / 2;
      armR.position.z = 10;
      break;

    case 'hitstun':
      group.rotation.z = Math.sin(Date.now() * 0.05) * 0.2;
      break;

    case 'KO':
      group.rotation.z = 1.4;
      group.scale.y    = 0.3;
      break;

    case 'shielding':
      group.scale.set(0.95, 0.95, 1.2);
      break;

    default:
      legL.rotation.x = 0;
      legR.rotation.x = 0;
      armL.rotation.x = 0;
      armR.rotation.x = 0;
      break;
  }
}

// ── Main render function ──────────────────────────────────────────────────────

export function render(stagePlatforms: Platform[], _alpha: number): void {
  // ── Camera update ─────────────────────────────────────────────────────────
  threeCamera.position.set(camera.x, camera.y + PERSP_TILT_Y, PERSP_Z);
  threeCamera.lookAt(camera.x, camera.y, 0);
  threeCamera.zoom = camera.zoom;
  threeCamera.updateProjectionMatrix();

  // ── AnimationMixer delta (renderer wall-clock, not physics time) ──────────
  const nowMs   = performance.now();
  const deltaMs = lastMixerTime === 0 ? 16.667 : Math.min(nowMs - lastMixerTime, 50);
  const deltaSec = deltaMs / 1000;
  lastMixerTime = nowMs;

  // Tick all active mixers
  for (const mixer of mixers.values()) {
    mixer.update(deltaSec);
  }

  // ── Platform meshes ───────────────────────────────────────────────────────
  for (const plat of stagePlatforms) {
    const key = platKey(plat);
    if (!platformMeshes.has(key)) {
      const mesh = buildPlatformMesh(plat);
      scene.add(mesh);
      platformMeshes.set(key, mesh);
    }
  }

  // ── Item meshes ────────────────────────────────────────────────────────────
  {
    // Gentle float: bob ±5 units in Y and rotate around Y-axis.
    // performance.now() is renderer-only — never touches physics state.
    const timeSec = performance.now() / 1000;

    // Track which entity IDs are in the current activeItems list so we can
    // remove meshes for items that have expired.
    const liveIds = new Set<number>();
    for (const item of activeItems) {
      liveIds.add(item.entityId);
    }

    // Remove meshes for items that no longer exist
    for (const [id, mesh] of itemMeshes) {
      if (!liveIds.has(id)) {
        scene.remove(mesh);
        (mesh.material as THREE.Material).dispose();
        mesh.geometry.dispose();
        itemMeshes.delete(id);
      }
    }

    // Create / update meshes for current items
    for (const item of activeItems) {
      let mesh = itemMeshes.get(item.entityId);
      if (!mesh) {
        mesh = buildItemMesh(item.category);
        scene.add(mesh);
        itemMeshes.set(item.entityId, mesh);
      }

      if (item.heldBy !== null) {
        // Item is held by a fighter — follow the fighter's position
        const holderTransform = transformComponents.get(item.heldBy);
        if (holderTransform) {
          const hx = toFloat(holderTransform.x);
          const hy = toFloat(holderTransform.y);
          mesh.position.set(hx, hy + 30, 2); // float above holder's head
        }
      } else {
        // Item is on-stage — float gently above its physics position
        const wx = toFloat(item.x);
        const wy = toFloat(item.y);
        const bob = Math.sin(timeSec * 2.5 + item.entityId * 0.7) * 5;
        mesh.position.set(wx, wy + 18 + bob, 0);
      }

      // ── Per-item visual state ────────────────────────────────────────────
      const mat = mesh.material as THREE.MeshStandardMaterial;
      // Reset material overrides to the category base color before applying
      // per-item state overrides.  This prevents stale overrides (e.g. armed
      // mine red) from persisting after the item changes state.
      const categoryBaseHex = ITEM_MESH_COLOR[item.category];
      mat.color.setHex(categoryBaseHex);
      mat.emissive.setHex(categoryBaseHex);
      let spinSpeed     = 1.8;
      let emissiveScale = 1.0;
      let meshScale     = 1.0;

      if (item.itemType === 'boomerang' && item.heldBy === null) {
        // Spin fast while in flight
        spinSpeed = 8.0;
      } else if (item.itemType === 'explosiveSphere' && item.proxTrap) {
        if (item.proxArmFrames === 0 && item.deployFrames > 0) {
          // Armed mine: pulse red
          const pulse = (Math.sin(timeSec * 8) + 1) / 2;
          mat.color.setHex(0xFF2200);
          mat.emissive.setHex(0xFF2200);
          emissiveScale = 0.5 + pulse * 1.5;
          meshScale = 1.0 + pulse * 0.15;
        }
      } else if (item.itemType === 'assistOrb') {
        // Scale with remaining HP (full size at 20 HP, 50% at 0)
        const hpFrac = Math.max(0, item.orbHp / ASSIST_ORB_MAX_HP);
        meshScale = 0.5 + hpFrac * 0.5;
        // Pulse faster as HP is lower
        const pulseRate = 2.0 + (1 - hpFrac) * 6;
        emissiveScale = 0.5 + ((Math.sin(timeSec * pulseRate) + 1) / 2) * 0.8;
      } else if (item.itemType === 'nexusCapsule' && item.creatureActive) {
        // Green glow while creature is active
        mat.color.setHex(0x44FF88);
        mat.emissive.setHex(0x44FF88);
        emissiveScale = 0.9 + Math.sin(timeSec * 4) * 0.3;
      } else if (item.itemType === 'blastImp' && item.walkActive) {
        // Orange glow when walking toward explosion
        mat.color.setHex(0xFF8800);
        mat.emissive.setHex(0xFF8800);
        spinSpeed = 4.0;
      }

      mat.emissiveIntensity = 0.55 * emissiveScale;
      mesh.scale.setScalar(meshScale);
      mesh.rotation.y = timeSec * spinSpeed + item.entityId * 0.9;
    }
  }

  // ── Character meshes ──────────────────────────────────────────────────────
  let playerIndex = 0;
  for (const [id, transform] of transformComponents) {
    const renderable = renderableComponents.get(id);
    const fighter    = fighterComponents.get(id);
    if (!renderable || !fighter) continue;

    const zOffset = (playerIndex % 2) * 4;

    // Create procedural group on first encounter
    if (!characterMeshes.has(id)) {
      const group = createCharacterMesh(fighter.characterId);
      scene.add(group);
      characterMeshes.set(id, group);

      // Kick off background GLB load
      loadGLTF(renderable.meshUrl).then((model) => {
        if (!model.loaded || model.failed || !model.root) return;
        const old = characterMeshes.get(id);
        if (!old || glbSwapped.has(id)) return;

        // Copy current transform to the new root
        model.root.position.copy(old.position);
        model.root.scale.copy(old.scale);
        model.root.rotation.copy(old.rotation);
        scene.remove(old);
        scene.add(model.root);
        characterMeshes.set(id, model.root as THREE.Group);
        glbSwapped.add(id);

        // Create an AnimationMixer for this GLB model
        const mixer = new THREE.AnimationMixer(model.root);
        mixers.set(id, mixer);
        modelRefs.set(id, model);
        // Start the idle clip immediately
        const currentFighter = fighterComponents.get(id);
        if (currentFighter) updateMixer(id, currentFighter.state);
      }).catch(() => { /* silently ignore */ });
    }

    const group = characterMeshes.get(id)!;

    // Position
    const wx = toFloat(transform.x);
    const wy = toFloat(transform.y);
    group.position.set(wx, wy, zOffset);

    // Facing direction — smooth turn-around via lerped rotation.y.
    // The procedural character's face (eyes) is on the local +Z side.
    // Rotating Y by +π/2 points local +Z toward world +X (character faces right).
    // Rotating Y by −π/2 points local +Z toward world −X (character faces left).
    // The lerp passes through 0 (facing the camera) for a natural pivot effect.
    const targetFaceAngle = transform.facingRight ? Math.PI / 2 : -Math.PI / 2;
    if (!characterFaceAngles.has(id)) {
      // First frame: snap directly to target so there is no startup spin.
      characterFaceAngles.set(id, targetFaceAngle);
    }
    const prevAngle = characterFaceAngles.get(id)!;
    const newAngle  = prevAngle + (targetFaceAngle - prevAngle) * TURN_LERP;
    characterFaceAngles.set(id, newAngle);
    group.rotation.y = newAngle;

    // Pose animation:
    //  - For GLB models: drive the AnimationMixer (already ticked above)
    //  - For procedural models: use the applyPose function
    if (glbSwapped.has(id)) {
      updateMixer(id, fighter.state);
    } else {
      applyPose(group, fighter.state);
    }

    playerIndex++;
  }

  renderer.render(scene, threeCamera);
}
