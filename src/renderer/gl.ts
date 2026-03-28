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

  function toon(hex: number): THREE.MeshToonMaterial {
    return new THREE.MeshToonMaterial({ color: hex });
  }
  function box(w: number, h: number, d: number, mat: THREE.Material): THREE.Mesh {
    return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  }
  function add(group: THREE.Group, mesh: THREE.Mesh, x: number, y: number, z: number): THREE.Mesh {
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  }

  const group = new THREE.Group();
  let torso: THREE.Mesh, head: THREE.Mesh, armL: THREE.Mesh, armR: THREE.Mesh,
      legL: THREE.Mesh, legR: THREE.Mesh;

  if (characterId === 'kael') {
    // ── Kael: armoured warrior ─────────────────────────────────────────────
    const bodyM  = toon(mainColor);
    const armorM = toon(0x8899cc);
    const darkM  = toon(0x1a2233);
    const eyeM   = toon(0x88ccff);
    const swordM = toon(0xdde8ff);
    torso = add(group, box(28, 30, 15, bodyM),  0, 15,  0);
    head  = add(group, box(20, 22, 17, bodyM),  0, 41,  0);
    armL  = add(group, box( 9, 24,  9, bodyM), -21, 14, 0);
    armR  = add(group, box( 9, 24,  9, bodyM),  21, 14, 0);
    legL  = add(group, box(11, 26, 11, bodyM),  -7, -13, 0);
    legR  = add(group, box(11, 26, 11, bodyM),   7, -13, 0);
    add(group, box( 4, 4, 2, eyeM),  -5, 42, 9.5);
    add(group, box( 4, 4, 2, eyeM),   5, 42, 9.5);
    add(group, box(25, 22, 3, armorM), 0, 17,  9);   // chest plate
    add(group, box(12,  8, 16, armorM), -22, 30, 0);  // pauldron L
    add(group, box(12,  8, 16, armorM),  22, 30, 0);  // pauldron R
    add(group, box(28,  5, 16, darkM),   0,  1,  0);  // belt
    add(group, box(22,  4,  4, armorM),  0, 45, 9.5); // brow
    add(group, box( 4, 10, 16, armorM),  0, 54,  0);  // crest
    add(group, box(12, 14, 12, armorM), -7, -22, 1);  // greave L
    add(group, box(12, 14, 12, armorM),  7, -22, 1);  // greave R
    add(group, box( 3, 38,  4, swordM), 30,  2,  0);  // sword blade
    add(group, box(16,  4,  5, darkM),  30, 21,  0);  // sword guard
    add(group, box( 3, 20, 20, armorM), -26, 8,  0);  // shield

  } else if (characterId === 'gorun') {
    // ── Gorun: massive armoured giant ─────────────────────────────────────
    const bodyM   = toon(mainColor);
    const armorM  = toon(0x333333);
    const accentM = toon(0xff4400);
    const eyeM    = toon(0xff6600);
    const hammerM = toon(0x555566);
    torso = add(group, box(46, 32, 24, bodyM),   0, 16,  0);
    head  = add(group, box(28, 24, 24, bodyM),   0, 44,  0);
    armL  = add(group, box(16, 26, 16, bodyM), -33, 14,  0);
    armR  = add(group, box(16, 26, 16, bodyM),  33, 14,  0);
    legL  = add(group, box(18, 28, 18, bodyM), -12, -14, 0);
    legR  = add(group, box(18, 28, 18, bodyM),  12, -14, 0);
    add(group, box( 6, 3, 2, eyeM),  -6, 44, 13);
    add(group, box( 6, 3, 2, eyeM),   6, 44, 13);
    add(group, box(24, 10, 3, armorM),  0, 41, 13.5); // faceplate
    add(group, box(30,  6, 4, armorM),  0, 51, 13);   // brow
    add(group, box(22, 14, 24, armorM), -33, 32, 0);  // shoulder L
    add(group, box(22, 14, 24, armorM),  33, 32, 0);  // shoulder R
    add(group, box(42, 28, 4, armorM),   0, 18, 13);  // chest plate
    for (const [rx, ry] of [[-10, 22] as const, [10, 22] as const,
                              [-10, 10] as const, [10, 10] as const]) {
      add(group, box(4, 4, 3, accentM), rx, ry, 15.5); // rivets
    }
    add(group, box(46,  7, 25, armorM),  0,  1,  0);  // belt plate
    add(group, box(20, 10, 20, armorM), -12, -18, 2);  // knee L
    add(group, box(20, 10, 20, armorM),  12, -18, 2);  // knee R
    add(group, box( 8, 36,  8, armorM),  50, 10,  0);  // hammer shaft
    add(group, box(24, 24, 22, hammerM), 50, -5,  0);  // hammer head
    add(group, box(22,  4, 20, accentM), 50, -5,  0);  // hammer accent

  } else if (characterId === 'vela') {
    // ── Vela: tall lean blade master ───────────────────────────────────────
    const bodyM  = toon(mainColor);
    const darkM  = toon(0x111111);
    const bladeM = toon(0xccddff);
    const eyeM   = toon(0xaaffcc);
    const clothM = toon(0x224433);
    torso = add(group, box(22, 32, 13, bodyM),   0, 16,  0);
    head  = add(group, box(18, 22, 15, bodyM),   0, 43,  0);
    armL  = add(group, box( 7, 28,  7, bodyM), -16, 14,  0);
    armR  = add(group, box( 7, 28,  7, bodyM),  16, 14,  0);
    legL  = add(group, box( 9, 32,  9, bodyM),  -6, -16, 0);
    legR  = add(group, box( 9, 32,  9, bodyM),   6, -16, 0);
    add(group, box(4, 4, 2, eyeM), -4, 44, 8.5);
    add(group, box(4, 4, 2, eyeM),  4, 44, 8.5);
    add(group, box(6, 20, 4, bodyM),  0, 51,  -9); // ponytail 1
    add(group, box(4, 14, 3, bodyM),  0, 41, -14); // ponytail 2
    add(group, box(3, 10, 3, bodyM),  0, 33, -18); // ponytail 3
    add(group, box(16, 5, 4, darkM),  0, 32, 7.5); // collar
    add(group, box(22, 5, 14, darkM), 0,  1,  1);  // belt sash
    add(group, box(4, 28,  2, clothM), -13, 6, -7); // cloak L
    add(group, box(4, 28,  2, clothM),  13, 6, -7); // cloak R
    add(group, box(3, 52,  4, bladeM),  22, -4, 0); // blade
    add(group, box(16, 3,  5, darkM),   22, 21, 0); // guard
    add(group, box(3, 12,  4, darkM),   22, 27, 0); // handle
    add(group, box(10, 10, 10, darkM),  -6, -30, 0.5); // boot L
    add(group, box(10, 10, 10, darkM),   6, -30, 0.5); // boot R

  } else if (characterId === 'syne') {
    // ── Syne: slim tech engineer ───────────────────────────────────────────
    const bodyM  = toon(mainColor);
    const techM  = toon(0x223344);
    const glowM  = toon(0x00ffee);
    const eyeM   = toon(0x00eeff);
    const darkM  = toon(0x111122);
    torso = add(group, box(20, 26, 14, bodyM),  0, 13,  0);
    head  = add(group, box(18, 20, 18, bodyM),  0, 37,  0);
    armL  = add(group, box( 7, 22,  7, bodyM), -15, 13, 0);
    armR  = add(group, box( 7, 22,  7, bodyM),  15, 13, 0);
    legL  = add(group, box( 8, 26,  8, bodyM),  -6, -13, 0);
    legR  = add(group, box( 8, 26,  8, bodyM),   6, -13, 0);
    add(group, box(6, 3, 2, eyeM), -5, 37, 9.5);
    add(group, box(6, 3, 2, eyeM),  5, 37, 9.5);
    add(group, box(18, 12, 18, techM),  0, 48,  0);   // helmet dome
    add(group, box( 2, 14,  2, glowM),  6, 60,  0);   // antenna
    add(group, box( 5,  5,  5, glowM),  6, 68,  0);   // antenna tip
    add(group, box(18,  5,  3, glowM),  0, 37, 10.5); // visor
    add(group, box(20, 26, 10, techM),  0, 13, -12);  // backpack
    add(group, box( 8,  8,  8, glowM),  0, 15, -17);  // pack orb
    add(group, box(16,  5, 14, techM),  0,  1,   0);  // belt pack
    add(group, box(10, 10, 10, techM), -18, 5,   3);  // arm cannon
    add(group, box( 5,  5, 14, darkM), -18, 5,  11);  // barrel
    add(group, box( 9,  8, 11, techM),  -6, -25, 1);  // boot L
    add(group, box( 9,  8, 11, techM),   6, -25, 1);  // boot R

  } else if (characterId === 'zira') {
    // ── Zira: compact agile street fighter ─────────────────────────────────
    const bodyM   = toon(mainColor);
    const darkM   = toon(0x550011);
    const accentM = toon(0xff3300);
    const eyeM    = toon(0xff9900);
    const padM    = toon(0x222222);
    torso = add(group, box(18, 24, 12, bodyM),   0, 12,  0);
    head  = add(group, box(16, 18, 14, bodyM),   0, 33,  0);
    armL  = add(group, box( 6, 20,  6, bodyM), -14, 12,  0);
    armR  = add(group, box( 6, 20,  6, bodyM),  14, 12,  0);
    legL  = add(group, box( 8, 28,  8, bodyM),  -6, -14, 0);
    legR  = add(group, box( 8, 28,  8, bodyM),   6, -14, 0);
    add(group, box(4, 3, 2, eyeM), -4, 33, 7.5);
    add(group, box(4, 3, 2, eyeM),  4, 33, 7.5);
    add(group, box(4, 14, 14, accentM), 0, 48, 0); // mohawk 1
    add(group, box(3, 10, 10, accentM), 0, 57, 0); // mohawk 2
    add(group, box(2,  7,  7, accentM), 0, 65, 0); // mohawk 3
    add(group, box(7,  5,  7, padM),  -14, 4,  0); // wristband L
    add(group, box(7,  5,  7, padM),   14, 4,  0); // wristband R
    add(group, box(18, 4,  2, darkM),   0, 20,  7); // stripe 1
    add(group, box(18, 4,  2, darkM),   0, 10,  7); // stripe 2
    add(group, box(9,  7,  9, padM),   -6, -10, 1.5); // knee L
    add(group, box(9,  7,  9, padM),    6, -10, 1.5); // knee R
    add(group, box(9, 10, 13, darkM),  -6, -26,  2);  // boot L
    add(group, box(9, 10, 13, darkM),   6, -26,  2);  // boot R
    add(group, box(9,  4,  4, accentM), -6, -28, 9); // toe cap L
    add(group, box(9,  4,  4, accentM),  6, -28, 9); // toe cap R

  } else {
    // ── Fallback: simple box-humanoid ──────────────────────────────────────
    const bodyM  = toon(mainColor);
    const dimM   = toon(dimColor(mainColor, 0.7));
    const darkM  = toon(dimColor(mainColor, 0.6));
    const eyeM   = toon(0x111111);
    torso = add(group, box(26, 28, 16, bodyM),   0,  3, 0);
    head  = add(group, box(20, 20, 16, bodyM),   0, 28, 0);
    armL  = add(group, box( 8, 22,  8, dimM),  -17,  5, 0);
    armR  = add(group, box( 8, 22,  8, dimM),   17,  5, 0);
    legL  = add(group, box(10, 26, 10, darkM),  -8, -21, 0);
    legR  = add(group, box(10, 26, 10, darkM),   8, -21, 0);
    add(group, box(4, 3, 2, eyeM), -5, 30, 8);
    add(group, box(4, 3, 2, eyeM),  5, 30, 8);
  }

  group.userData['parts'] = { torso: torso!, head: head!, armL: armL!, armR: armR!, legL: legL!, legR: legR! };

  return group;
}

// ── Platform mesh builder ─────────────────────────────────────────────────────

const PLAT_THICKNESS = 20;
const PLAT_DEPTH     = 50;

export function buildPlatformMesh(plat: Platform): THREE.Group {
  const x1 = toFloat(plat.x1);
  const x2 = toFloat(plat.x2);
  const py  = toFloat(plat.y);
  const width = toFloat(fixedSub(plat.x2, plat.x1));
  const cx  = (x1 + x2) / 2;
  const cy  = py - 10; // top surface at platform.y

  const bodyColor = plat.passThrough ? 0x88CC66 : 0x9B8B7A;
  const edgeColor = plat.passThrough ? 0xaaddaa : 0xbbaaaa;

  const bodyMat = new THREE.MeshToonMaterial({ color: bodyColor });
  const edgeMat = new THREE.MeshToonMaterial({ color: edgeColor });

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(width, PLAT_THICKNESS, PLAT_DEPTH),
    bodyMat,
  );
  body.position.set(0, 0, 0);

  const edge = new THREE.Mesh(
    new THREE.BoxGeometry(width, 3, PLAT_DEPTH),
    edgeMat,
  );
  edge.position.set(0, PLAT_THICKNESS / 2 + 1.5, 0);

  const group = new THREE.Group();
  group.add(body, edge);
  group.position.set(cx, cy, -20);

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

  scene.add(new THREE.AmbientLight(0xffffff, 0.5));

  const dirLight = new THREE.DirectionalLight(0xffe8d0, 1.0);
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
  // Keep platform meshes (they'll be re-used or recreated).
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
