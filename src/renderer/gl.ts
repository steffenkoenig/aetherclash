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
  SHIELD_MAX_HEALTH,
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

// Pre-allocated quaternion and axis for the per-frame camera roll (tilt).
// Avoids heap allocation in the render hot path.
const _camRollAxis = new THREE.Vector3(0, 0, 1);
const _camRollQ    = new THREE.Quaternion();

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

// ── Shield bubble registry ────────────────────────────────────────────────────

// Maps entity id → semi-transparent sphere shown while shielding.
const shieldBubbleMeshes = new Map<number, THREE.Mesh>();

/** Radius of the shield bubble in world units. */
const SHIELD_BUBBLE_RADIUS = 45;

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
  walk:       'walk',
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
  crouch:     'crouch',
  grabbing:   'grabbing',
  ledgeHang:  'ledgeHang',
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
  const loop = clipName === 'idle' || clipName === 'run' || clipName === 'walk' ||
               clipName === 'hitstun' || clipName === 'ledgeHang';
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
  windyHeights:   0x5ec8f0,
  battlefield:    0x1a2a3a,
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
  windyHeights:  { ambient: 0xfff8e0, aIntensity: 0.80, dir: 0xfff0a0, dIntensity: 1.15, fog: new THREE.Fog(0xa8e4f8, 900, 2800) },
  battlefield:   { ambient: 0x304050, aIntensity: 0.60, dir: 0x88aacc, dIntensity: 1.10, fog: new THREE.Fog(0x0a1520, 800, 2400) },
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
  // satirical roster
  trump: 0xff8800,
  musk:  0x00aaff,
  putin: 0x4c7c4c,
  xi:    0xcc2222,
  lizzy: 0x88ccff,
};
const FALLBACK_COLOR = 0xff4444;

// ── Procedural character mesh ─────────────────────────────────────────────────


export function createCharacterMesh(characterId: string): THREE.Group {
  const mainColor = CHARACTER_COLORS[characterId] ?? FALLBACK_COLOR;

  function toon(hex: number): THREE.MeshToonMaterial {
    return new THREE.MeshToonMaterial({ color: hex });
  }
  function sphere(r: number, mat: THREE.Material, wSeg = 14, hSeg = 10): THREE.Mesh {
    return new THREE.Mesh(new THREE.SphereGeometry(r, wSeg, hSeg), mat);
  }
  function capsule(r: number, l: number, mat: THREE.Material): THREE.Mesh {
    return new THREE.Mesh(new THREE.CapsuleGeometry(r, l, 5, 8), mat);
  }
  function cylinder(rt: number, rb: number, h: number, segs: number, mat: THREE.Material): THREE.Mesh {
    return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, segs), mat);
  }
  function cone(r: number, h: number, segs: number, mat: THREE.Material): THREE.Mesh {
    return new THREE.Mesh(new THREE.ConeGeometry(r, h, segs), mat);
  }
  function torus(r: number, tube: number, mat: THREE.Material): THREE.Mesh {
    return new THREE.Mesh(new THREE.TorusGeometry(r, tube, 7, 14), mat);
  }
  function add(group: THREE.Group, mesh: THREE.Mesh, x: number, y: number, z: number): THREE.Mesh {
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  }

  // ── Shared biped rig helper ───────────────────────────────────────────────
  // Creates named THREE.Group objects anchored at joint pivots (shoulder, hip,
  // neck) so that applyPose rotations swing limbs from the correct joint.
  // CapsuleGeometry(r,L): total height = L+2r; centred at origin.
  // To span [pivot … pivot−span]: centre at y=−span/2, L = span−2r.
  function makeRig(torsoW: number, waistW: number, torsoH: number,
    shX: number, shY: number, ar: number, aLen: number,
    hpX: number, lr: number, lLen: number,
    bodyM: THREE.Material, skinM: THREE.Material) {

    const ltH = torsoH * 0.42, utH = torsoH * 0.58;
    const uaL = aLen * 0.54,   faL = aLen * 0.46;
    const thL = lLen * 0.54,   shL = lLen * 0.46;

    // Torso group (waist pivot)
    const torsoG = new THREE.Group();
    torsoG.position.set(0, 0, 0); group.add(torsoG);
    { const m = new THREE.Mesh(new THREE.SphereGeometry(waistW * 1.1, 10, 7), bodyM);
      m.scale.set(1.3, 0.65, 1.0); m.position.set(0, -4, 0); torsoG.add(m); }
    { const m = new THREE.Mesh(new THREE.CylinderGeometry(waistW, waistW * 1.1, ltH, 10), bodyM);
      m.position.set(0, ltH * 0.5, 0); torsoG.add(m); }
    { const m = new THREE.Mesh(new THREE.CylinderGeometry(torsoW, waistW, utH, 10), bodyM);
      m.position.set(0, ltH + utH * 0.5, 0); torsoG.add(m); }
    { const m = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 4.5, 7, 8), skinM);
      m.position.set(0, torsoH + 3.5, 0); torsoG.add(m); }

    // Head group (neck-top pivot)
    const headG = new THREE.Group();
    headG.position.set(0, torsoH + 7, 0); group.add(headG);

    // Arm groups (shoulder pivot — geometry hangs downward)
    function makeArm(side: number): THREE.Group {
      const g = new THREE.Group();
      g.position.set(side * shX, shY, 0); group.add(g);
      { const m = new THREE.Mesh(new THREE.SphereGeometry(ar + 1.5, 8, 6), bodyM); g.add(m); }
      { const cL = Math.max(1, uaL - ar * 2);
        const m = new THREE.Mesh(new THREE.CapsuleGeometry(ar, cL, 5, 8), bodyM);
        m.position.set(0, -uaL * 0.5, 0); g.add(m); }
      { const m = new THREE.Mesh(new THREE.SphereGeometry(ar * 0.88, 7, 5), bodyM);
        m.position.set(0, -uaL, 0); g.add(m); }
      { const fr = ar * 0.78; const cL = Math.max(1, faL - fr * 2);
        const m = new THREE.Mesh(new THREE.CapsuleGeometry(fr, cL, 5, 8), bodyM);
        m.position.set(0, -(uaL + faL * 0.5), 0); g.add(m); }
      { const m = new THREE.Mesh(new THREE.SphereGeometry(ar * 0.86, 7, 6), skinM);
        m.scale.set(0.92, 0.86, 1.2); m.position.set(0, -(uaL + faL), 0); g.add(m); }
      return g;
    }

    // Leg groups (hip pivot — geometry hangs downward)
    function makeLeg(side: number): THREE.Group {
      const g = new THREE.Group();
      g.position.set(side * hpX, 0, 0); group.add(g);
      { const m = new THREE.Mesh(new THREE.SphereGeometry(lr * 0.9, 8, 6), bodyM);
        m.position.set(0, -lr * 0.2, 0); g.add(m); }
      { const cL = Math.max(1, thL - lr * 2);
        const m = new THREE.Mesh(new THREE.CapsuleGeometry(lr, cL, 5, 8), bodyM);
        m.position.set(0, -thL * 0.5, 0); g.add(m); }
      { const m = new THREE.Mesh(new THREE.SphereGeometry(lr * 0.84, 7, 5), bodyM);
        m.position.set(0, -thL, 0); g.add(m); }
      { const sr = lr * 0.8; const cL = Math.max(1, shL - sr * 2);
        const m = new THREE.Mesh(new THREE.CapsuleGeometry(sr, cL, 5, 8), bodyM);
        m.position.set(0, -(thL + shL * 0.5), 0); g.add(m); }
      { const m = new THREE.Mesh(new THREE.SphereGeometry(lr * 0.86, 7, 5), bodyM);
        m.scale.set(0.9, 0.58, 1.65); m.position.set(0, -(thL + shL), 4); g.add(m); }
      return g;
    }

    return {
      torso: torsoG as unknown as THREE.Object3D,
      head:  headG  as unknown as THREE.Object3D,
      armL:  makeArm(-1) as unknown as THREE.Object3D,
      armR:  makeArm(1)  as unknown as THREE.Object3D,
      legL:  makeLeg(-1) as unknown as THREE.Object3D,
      legR:  makeLeg(1)  as unknown as THREE.Object3D,
    };
  }

  const group = new THREE.Group();

  let parts: { torso: THREE.Object3D; head: THREE.Object3D;
               armL: THREE.Object3D; armR: THREE.Object3D;
               legL: THREE.Object3D; legR: THREE.Object3D; };

  if (characterId === 'kael') {
    const bodyM = toon(mainColor); const armorM = toon(0x8899cc);
    const darkM = toon(0x1a2233); const eyeM = toon(0x88ccff);
    const swordM = toon(0xdde8ff);
    parts = makeRig(13, 9, 28, 16, 26, 4.5, 24, 7, 5.5, 28, bodyM, bodyM);
    const h = parts.head as THREE.Group;
    add(h, sphere(11, bodyM), 0, 11, 0);
    add(h, sphere(2.5, eyeM, 8, 6), -5, 13, 10);
    add(h, sphere(2.5, eyeM, 8, 6),  5, 13, 10);
    add(h, cylinder(11.5, 11.5, 3, 14, armorM), 0, 7, 0);
    add(h, cylinder(1.5, 2.5, 12, 6, armorM), 0, 22, 0);
    const t = parts.torso as THREE.Group;
    const cp = sphere(14, armorM); cp.scale.set(1, 0.8, 0.32); add(t, cp, 0, 18, 11);
    const blt = torus(11, 2.5, darkM); blt.rotation.x = Math.PI / 2; add(t, blt, 0, 1, 0);
    for (const arm of [parts.armL, parts.armR] as THREE.Group[]) {
      const p = sphere(8, armorM); p.scale.set(1.4, 0.65, 1.4); arm.add(p);
    }
    add(group, cylinder(1.2, 0.3, 38, 8, swordM), 28, 2, 0);
    add(group, cylinder(8, 8, 2.5, 8, darkM), 28, 21, 0);
    const shd = cylinder(13, 13, 3, 12, armorM); shd.rotation.z = Math.PI / 2;
    add(group, shd, -29, 8, 0);

  } else if (characterId === 'gorun') {
    const bodyM = toon(mainColor); const armorM = toon(0x333333);
    const accentM = toon(0xff4400); const eyeM = toon(0xff6600);
    const hammerM = toon(0x555566);
    parts = makeRig(22, 16, 32, 26, 30, 7.5, 30, 12, 9, 34, bodyM, bodyM);
    const h = parts.head as THREE.Group;
    add(h, sphere(14, bodyM), 0, 14, 0);
    const eL = sphere(3, eyeM); eL.scale.set(1.8, 0.6, 0.5); add(h, eL, -7, 16, 13);
    const eR = sphere(3, eyeM); eR.scale.set(1.8, 0.6, 0.5); add(h, eR,  7, 16, 13);
    add(h, cylinder(14.5, 14.5, 4, 14, armorM), 0, 8, 0);
    add(h, cone(4, 22, 8, armorM), -11, 28, 0);
    add(h, cone(4, 22, 8, armorM),  11, 28, 0);
    for (const arm of [parts.armL, parts.armR] as THREE.Group[]) {
      const p = sphere(14, armorM); p.scale.set(1.5, 0.6, 1.5); arm.add(p);
    }
    add(group, cylinder(4, 4, 38, 8, armorM), 52, 10, 0);
    const hh = sphere(14, hammerM); hh.scale.set(1.5, 1.2, 1.2); add(group, hh, 52, -6, 0);
    const hband = torus(14, 2.5, accentM); hband.rotation.z = Math.PI / 2; add(group, hband, 52, -6, 0);

  } else if (characterId === 'vela') {
    const bodyM = toon(mainColor); const darkM = toon(0x111111);
    const bladeM = toon(0xccddff); const eyeM = toon(0xaaffcc);
    const clothM = toon(0x224433);
    parts = makeRig(11, 8, 30, 14, 28, 3.5, 28, 6, 4.5, 32, bodyM, bodyM);
    const h = parts.head as THREE.Group;
    add(h, sphere(9.5, bodyM), 0, 10, 0);
    add(h, sphere(2, eyeM, 8, 6), -4, 12, 8.5);
    add(h, sphere(2, eyeM, 8, 6),  4, 12, 8.5);
    for (const [py, pz, pr] of [[17, -4, 4], [12, -10, 3], [6, -16, 2.2], [0, -22, 1.6]] as number[][]) {
      add(h, sphere(pr, bodyM), 0, py, pz);
    }
    const t = parts.torso as THREE.Group;
    const col = torus(7, 2, darkM); col.rotation.x = Math.PI / 2; add(t, col, 0, 30, 0);
    const sash = torus(9, 2, darkM); sash.rotation.x = Math.PI / 2; add(t, sash, 0, 1, 0);
    add(t, cylinder(2, 3.5, 28, 6, clothM), -13, 6, -7);
    add(t, cylinder(2, 3.5, 28, 6, clothM),  13, 6, -7);
    add(group, cylinder(1.5, 0.4, 52, 8, bladeM), 20, -4, 0);
    add(group, cylinder(7, 7, 2, 8, darkM), 20, 22, 0);

  } else if (characterId === 'syne') {
    const bodyM = toon(mainColor); const techM = toon(0x223344);
    const glowM = toon(0x00ffee); const eyeM = toon(0x00eeff);
    const darkM = toon(0x111122);
    parts = makeRig(10, 8, 26, 14, 24, 3, 22, 6, 3.5, 26, bodyM, bodyM);
    const h = parts.head as THREE.Group;
    add(h, sphere(9, bodyM), 0, 9, 0);
    add(h, sphere(11, techM), 0, 11, 0);
    const evL = sphere(3, eyeM); evL.scale.set(1.8, 0.55, 0.5); add(h, evL, -5, 10, 9.5);
    const evR = sphere(3, eyeM); evR.scale.set(1.8, 0.55, 0.5); add(h, evR,  5, 10, 9.5);
    add(h, cylinder(1, 1, 14, 6, glowM), 6, 22, 0);
    add(h, sphere(3, glowM), 6, 30, 0);
    const t = parts.torso as THREE.Group;
    const bkPk = cylinder(9, 8, 26, 8, techM); bkPk.rotation.x = Math.PI / 2; add(t, bkPk, 0, 13, -12);
    add(t, sphere(4.5, glowM), 0, 13, -18);
    const bltR = torus(9, 2.5, techM); bltR.rotation.x = Math.PI / 2; add(t, bltR, 0, 1, 0);
    const cnPk = cylinder(5.5, 5.5, 12, 8, techM); cnPk.rotation.x = Math.PI / 2;
    (parts.armL as THREE.Group).add(cnPk); cnPk.position.set(0, -8, 5);
    const brPk = cylinder(2.5, 2.5, 14, 8, darkM); brPk.rotation.x = Math.PI / 2;
    (parts.armL as THREE.Group).add(brPk); brPk.position.set(0, -8, 13);

  } else if (characterId === 'zira') {
    const bodyM = toon(mainColor); const darkM = toon(0x550011);
    const accentM = toon(0xff3300); const eyeM = toon(0xff9900);
    const padM = toon(0x222222);
    parts = makeRig(9, 7, 24, 12, 22, 2.8, 20, 6, 3.8, 26, bodyM, bodyM);
    const h = parts.head as THREE.Group;
    add(h, sphere(8, bodyM), 0, 8, 0);
    add(h, sphere(2, eyeM, 8, 6), -4, 10, 7.5);
    add(h, sphere(2, eyeM, 8, 6),  4, 10, 7.5);
    const mhBs = torus(3.5, 1.5, accentM); mhBs.rotation.x = Math.PI / 2; add(h, mhBs, 0, 16, 0);
    add(h, cone(2.5, 18, 6, accentM), 0, 25, 0);
    const t = parts.torso as THREE.Group;
    const nkRg = torus(6, 1.5, darkM); nkRg.rotation.x = Math.PI / 2; add(t, nkRg, 0, 24, 0);
    const cb1 = torus(8.5, 1.2, darkM); cb1.rotation.x = Math.PI / 2; add(t, cb1, 0, 18, 0);
    const cb2 = torus(8, 1.2, darkM); cb2.rotation.x = Math.PI / 2; add(t, cb2, 0, 10, 0);
    for (const arm of [parts.armL, parts.armR] as THREE.Group[]) {
      const wb = torus(3.5, 1.5, padM); wb.rotation.x = Math.PI / 2;
      arm.add(wb); wb.position.set(0, -20, 0);
    }

  } else if (characterId === 'trump') {
    // Orange suit, combed-over hair, red tie, wide torso
    const suitM  = toon(mainColor);
    const tieM   = toon(0xdd0000);
    const skinM  = toon(0xffc090);
    const hairM  = toon(0xffdd88);
    const eyeM   = toon(0x3355aa);
    parts = makeRig(18, 13, 30, 20, 28, 6, 26, 10, 7, 28, suitM, suitM);
    const hTr = parts.head as THREE.Group;
    add(hTr, sphere(12, skinM), 0, 12, 0);
    add(hTr, sphere(2.5, eyeM, 8, 6), -5, 14, 11);
    add(hTr, sphere(2.5, eyeM, 8, 6),  5, 14, 11);
    const co = capsule(11, 2, hairM); co.rotation.z = Math.PI / 2;
    co.position.set(0, 23, -2); hTr.add(co);
    const tTr = parts.torso as THREE.Group;
    add(tTr, cylinder(10, 7, 10, 6, tieM), 0, 14, 8);
    add(tTr, cylinder(2.5, 4, 28, 6, tieM), 0, 2, 9);
    const jkt = sphere(18, suitM); jkt.scale.set(1, 0.55, 0.35); jkt.position.set(0, 18, 10); tTr.add(jkt);
    add(group, sphere(4, skinM), 28, -6, 2);
    add(group, sphere(4, skinM), -28, -6, 2);
    void skinM; void hairM; void eyeM;

  } else if (characterId === 'musk') {
    // Slim dark turtleneck, X belt, rocket thruster backpack
    const bodyM  = toon(mainColor);
    const darkM  = toon(0x222244);
    const skinM  = toon(0xffe0c0);
    const eyeM   = toon(0x33bb99);
    const glowM  = toon(0x00ffee);
    parts = makeRig(10, 8, 28, 14, 26, 3.5, 24, 6, 4, 26, darkM, darkM);
    const hMu = parts.head as THREE.Group;
    add(hMu, sphere(10, skinM), 0, 10, 0);
    add(hMu, sphere(2.5, eyeM, 8, 6), -5, 12, 9.5);
    add(hMu, sphere(2.5, eyeM, 8, 6),  5, 12, 9.5);
    const colMu = cylinder(9, 8, 6, 10, darkM); colMu.position.set(0, 3, 0); hMu.add(colMu);
    const tMu = parts.torso as THREE.Group;
    const rkt = capsule(5, 18, bodyM); rkt.rotation.x = Math.PI / 2; rkt.position.set(0, 14, -14); tMu.add(rkt);
    add(tMu, sphere(4, glowM), 0, 14, -22);
    const bx1 = cylinder(1.5, 1.5, 14, 4, glowM); bx1.rotation.z =  Math.PI / 4; bx1.position.set(0, 2, 8); tMu.add(bx1);
    const bx2 = cylinder(1.5, 1.5, 14, 4, glowM); bx2.rotation.z = -Math.PI / 4; bx2.position.set(0, 2, 8); tMu.add(bx2);
    void skinM; void eyeM;

  } else if (characterId === 'putin') {
    // Shirtless, wide body, bear-saddle, medals
    const skinM  = toon(mainColor);
    const bearM  = toon(0x8b5e3c);
    const eyeM   = toon(0x3399cc);
    parts = makeRig(20, 14, 30, 24, 28, 7, 28, 11, 8, 30, skinM, skinM);
    const hPu = parts.head as THREE.Group;
    add(hPu, sphere(12, skinM), 0, 12, 0);
    add(hPu, sphere(2.5, eyeM, 8, 6), -5, 14, 11);
    add(hPu, sphere(2.5, eyeM, 8, 6),  5, 14, 11);
    const saddle = sphere(20, bearM); saddle.scale.set(1.8, 0.9, 1.4); saddle.position.set(0, -46, 0);
    parts.torso.add(saddle);
    add(group, cone(5, 9, 6, bearM), -18, -42, 14);
    add(group, cone(5, 9, 6, bearM),  18, -42, 14);
    for (let i = 0; i < 3; i++) {
      const medal = sphere(3, toon(0xffd700)); medal.scale.set(0.5, 1, 0.3);
      medal.position.set(-8 + i * 8, 20, 13); parts.torso.add(medal);
    }
    void eyeM;

  } else if (characterId === 'xi') {
    // Dark red Mao suit with subtle honeycomb pattern, gold stars, little red book
    const suitM  = toon(mainColor);
    const skinM  = toon(0xf5d8b0);
    const starM  = toon(0xffd700);
    const eyeM   = toon(0x222222);
    const darkM  = toon(0x660000);
    const honeyM = toon(0xb31b1b); // slightly lighter red for honeycomb cells
    parts = makeRig(16, 12, 32, 18, 28, 5.5, 26, 9, 7, 30, suitM, suitM);
    const hXi = parts.head as THREE.Group;
    add(hXi, sphere(11, skinM), 0, 11, 0);
    add(hXi, sphere(2.2, eyeM, 8, 6), -4, 13, 10);
    add(hXi, sphere(2.2, eyeM, 8, 6),  4, 13, 10);
    const colXi = cylinder(10, 9, 6, 8, darkM); colXi.position.set(0, 3, 0); hXi.add(colXi);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      const s = sphere(2.5, starM); s.position.set(Math.cos(a) * 5, 22 + Math.sin(a) * 5, 13);
      parts.torso.add(s);
    }
    // Subtle honeycomb pattern: small flat hexagonal cylinders on the suit front
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 2; col++) {
        const hCell = cylinder(2.2, 2.2, 0.8, 6, honeyM);
        hCell.position.set(-5 + col * 10, 20 - row * 9, 17);
        parts.torso.add(hCell);
      }
    }
    const book = new THREE.Mesh(new THREE.BoxGeometry(8, 10, 2), toon(0xdd0000));
    book.position.set(-26, -4, 0); group.add(book);
    void suitM; void skinM; void starM; void eyeM; void darkM; void honeyM;

  } else if (characterId === 'lizzy') {
    // Translucent neon-blue ghost dress, crown, handbag, spectral corgi
    // Use transparent toon materials for the spectral appearance
    const ghostToon = (hex: number, opacity = 0.72) => {
      const m = new THREE.MeshToonMaterial({ color: hex, transparent: true, opacity, depthWrite: false });
      return m;
    };
    const coatM  = ghostToon(mainColor);
    const skinM  = ghostToon(0xc0e8ff, 0.80); // cool blue-tinted skin
    const crownM = toon(0xffd700);
    const eyeM   = ghostToon(0x0044cc, 0.90);
    const corgiM = ghostToon(0xee8833, 0.65); // spectral corgi
    parts = makeRig(13, 10, 28, 16, 26, 4.5, 24, 7, 5.5, 28, coatM, coatM);
    const hLi = parts.head as THREE.Group;
    add(hLi, sphere(10, skinM), 0, 10, 0);
    add(hLi, sphere(2.2, eyeM, 8, 6), -4, 12, 9);
    add(hLi, sphere(2.2, eyeM, 8, 6),  4, 12, 9);
    add(hLi, cylinder(8, 9, 6, 6, crownM), 0, 22, 0);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2; add(hLi, cone(2, 8, 5, crownM), Math.cos(a) * 7, 27, Math.sin(a) * 7);
    }
    const bag = new THREE.Mesh(new THREE.BoxGeometry(10, 8, 4), coatM); bag.position.set(-24, -8, 0); group.add(bag);
    const corgiBody = sphere(6, corgiM); corgiBody.scale.set(2, 0.9, 1.2); corgiBody.position.set(-30, -48, 8); group.add(corgiBody);
    add(group, cone(3, 7, 5, corgiM), -30, -44, 16);
    void skinM; void eyeM; void corgiM;

  } else {
    // ── Fallback: jointed humanoid ─────────────────────────────────────────
    const bodyM = toon(mainColor); const eyeM = toon(0x111111);
    parts = makeRig(12, 9, 28, 15, 26, 4, 22, 7, 5, 26, bodyM, bodyM);
    const h = parts.head as THREE.Group;
    add(h, sphere(10, bodyM), 0, 10, 0);
    add(h, sphere(2.5, eyeM, 8, 6), -5, 12, 9);
    add(h, sphere(2.5, eyeM, 8, 6),  5, 12, 9);
  }

  group.userData['parts'] = parts;

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
  // Remove shield bubbles
  for (const mesh of shieldBubbleMeshes.values()) {
    scene?.remove(mesh);
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
  }
  shieldBubbleMeshes.clear();
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

function applyPose(
  group: THREE.Group,
  state: FighterState,
  moveId?: string | null,
  facingRight?: boolean,
): void {
  const parts = group.userData['parts'] as Parts | undefined;
  if (!parts) return;

  const { armL, armR, legL, legR } = parts;
  // renderTime is wall-clock seconds — renderer-only, never fed into physics.
  // Using Date.now() here is intentional and determinism-safe; it only drives
  // visual animation, not the simulation state.
  const renderTime = Date.now() * 0.001;

  // Reset per-frame transient transforms before applying state pose.
  // rotation.y (facing direction) is set by the caller — do not touch it here.
  group.rotation.z = 0;
  group.scale.set(1, 1, 1);

  // Reset arm/leg positions before any pose branch so all states start clean.
  armR.position.z = 0;
  armL.position.z = 0;
  armR.position.y = (armR.userData['baseY'] as number) ?? armR.position.y;
  armL.position.y = (armL.userData['baseY'] as number) ?? armL.position.y;

  // ── Special-move emissive glow ──────────────────────────────────────────
  // When the fighter is executing a special move, pulse the character meshes
  // with an emissive colour so specials are visually distinct from normals.
  const isSpecial = state === 'attack' && moveId != null &&
    (moveId.endsWith('Special') || moveId.includes('special'));
  group.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const mat = obj.material;
    if (mat instanceof THREE.MeshToonMaterial) {
      if (isSpecial) {
        // Yellow-white pulse: bright when active, fades with a sine wave.
        const pulse = (Math.sin(renderTime * 12) + 1) * 0.5; // 0→1 fast pulse
        mat.emissive = new THREE.Color(0.6 + pulse * 0.4, 0.8 + pulse * 0.2, 0.2);
      } else {
        mat.emissive = new THREE.Color(0, 0, 0);
      }
    }
  });

  switch (state) {
    case 'idle': {
      const bob = Math.sin(renderTime * 3) * 1.5;
      group.position.y += bob;
      legL.rotation.x = 0;
      legR.rotation.x = 0;
      armL.rotation.x = 0;
      armR.rotation.x = 0;
      break;
    }
    case 'run': {
      const s = Math.sin(renderTime * 6);
      legL.rotation.x =  s * 0.5;
      legR.rotation.x = -s * 0.5;
      armL.rotation.x = -s * 0.3;
      armR.rotation.x =  s * 0.3;
      // Slight forward lean when running
      group.rotation.z = facingRight ? -0.12 : 0.12;
      break;
    }
    case 'jump':
    case 'doubleJump':
      legL.rotation.x = -0.35;
      legR.rotation.x = -0.35;
      armL.rotation.x = -0.4;
      armR.rotation.x = -0.4;
      armL.position.z = 6;
      armR.position.z = 6;
      break;

    case 'attack':
      if (isSpecial) {
        // Special pose: both arms raised and spread wide (charging stance).
        armL.rotation.x = -Math.PI * 0.65;
        armR.rotation.x = -Math.PI * 0.65;
        armL.position.z = 12;
        armR.position.z = 12;
        group.rotation.z = facingRight ? -0.15 : 0.15;
      } else {
        // Move-specific attack poses that visually match hitbox positions.
        // Local +Z on this rig = world facing direction, so armR.position.z
        // directly extends the arm toward the opponent.
        const mid = moveId ?? '';

        if (mid.startsWith('up')) {
          // Up attacks: both arms raised overhead
          armL.rotation.x = -Math.PI * 0.85;
          armR.rotation.x = -Math.PI * 0.85;
          armL.position.z = 8;
          armR.position.z = 8;
          // Slight backward lean to sell the upward swing
          group.rotation.z = facingRight ? 0.1 : -0.1;

        } else if (mid.startsWith('down') || mid === 'downAir') {
          // Down attacks: arms sweep low
          armL.rotation.x = 0.55;
          armR.rotation.x = 0.55;
          armL.position.z = 14;
          armR.position.z = 14;
          group.scale.y = 0.88; // slight crouch
          group.rotation.z = facingRight ? -0.1 : 0.1;

        } else if (mid === 'backAir') {
          // Back air: leading arm swings backward
          armL.rotation.x = Math.PI / 2;
          armL.position.z = -28; // backward relative to facing
          armR.rotation.x = 0.2;
          group.rotation.z = facingRight ? 0.15 : -0.15;

        } else if (mid.includes('Jab') || mid === 'neutralJab') {
          // Jab: quick short punch forward
          armR.rotation.x = -Math.PI / 2;
          armR.position.z = 22; // ~15 unit hitbox offsetX → z≈22

        } else if (mid.includes('Smash') && !mid.startsWith('up') && !mid.startsWith('down')) {
          // Forward smash: big lunge — arm extends far, body leans in
          armR.rotation.x = -Math.PI / 2;
          armR.position.z = 46; // ~40-50 unit hitbox offsetX
          armL.rotation.x = 0.3;
          group.rotation.z = facingRight ? -0.22 : 0.22;
          group.scale.z = 1.15; // stretch forward

        } else if (mid === 'neutralAir') {
          // Neutral air: spinning kick, both arms out
          const spin = Math.sin(renderTime * 14);
          armL.rotation.x = -Math.PI / 2 + spin * 0.4;
          armR.rotation.x = -Math.PI / 2 - spin * 0.4;
          armL.position.z = 12;
          armR.position.z = 12;

        } else {
          // Default forward attack (tilt / forward air / other):
          // Extend arm proportional to typical tilt hitbox (~20-30 units)
          armR.rotation.x = -Math.PI / 2;
          armR.position.z = 34; // covers forwardTilt (z≈25-35) and forwardAir
          armL.rotation.x = 0.15;
          group.rotation.z = facingRight ? -0.14 : 0.14;
        }
      }
      break;

    case 'hitstun':
      // Tumble animation: body tilts backward + arms flung
      group.rotation.z = (facingRight ? 0.3 : -0.3) + Math.sin(renderTime * 50) * 0.15;
      armL.rotation.x = 0.6;
      armR.rotation.x = 0.6;
      legL.rotation.x = 0.4;
      legR.rotation.x = -0.3;
      break;

    case 'KO':
      group.rotation.z = 1.4;
      group.scale.y    = 0.3;
      break;

    case 'shielding':
      group.scale.set(0.92, 0.92, 1.18);
      // Arms in protective stance
      armL.rotation.x = -0.6;
      armR.rotation.x = -0.6;
      armL.position.z = 10;
      armR.position.z = 10;
      break;

    case 'spotDodge':
      group.scale.set(1, 0.75, 1.3);
      group.rotation.z = facingRight ? -0.05 : 0.05;
      break;

    case 'rolling':
      // Rolling dodge: lean strongly in movement direction
      group.rotation.z = facingRight ? -0.45 : 0.45;
      legL.rotation.x = 0.5;
      legR.rotation.x = -0.5;
      break;

    case 'airDodge':
      // Air dodge: tuck into a ball
      group.scale.set(0.85, 0.85, 0.85);
      armL.rotation.x = -0.5;
      armR.rotation.x = -0.5;
      legL.rotation.x = 0.5;
      legR.rotation.x = 0.5;
      break;

    case 'walk': {
      // Slower walk cycle — same leg/arm swing as run but at half speed/amplitude.
      const w = Math.sin(renderTime * 4);
      legL.rotation.x =  w * 0.35;
      legR.rotation.x = -w * 0.35;
      armL.rotation.x = -w * 0.2;
      armR.rotation.x =  w * 0.2;
      break;
    }

    case 'crouch':
      // Compressed squat: legs bent, body low, arms guard-raised.
      group.scale.y = 0.65;
      legL.rotation.x = 0.7;
      legR.rotation.x = 0.7;
      armL.rotation.x = -0.45;
      armR.rotation.x = -0.45;
      armL.position.z = 6;
      armR.position.z = 6;
      break;

    case 'grabbing':
      // Clinch grab: both arms thrust forward to hold the opponent.
      armL.rotation.x = -Math.PI / 2;
      armR.rotation.x = -Math.PI / 2;
      armL.position.z = 18;
      armR.position.z = 18;
      legL.rotation.x = 0.25;
      legR.rotation.x = 0.25;
      group.rotation.z = facingRight ? -0.1 : 0.1;
      break;

    case 'ledgeHang':
      // Hanging from ledge: arms raised overhead, legs dangling below.
      armL.rotation.x = -Math.PI * 0.75;
      armR.rotation.x = -Math.PI * 0.75;
      armL.position.z = 4;
      armR.position.z = 4;
      legL.rotation.x = 0.4;
      legR.rotation.x = 0.4;
      group.scale.y = 1.05; // slight stretch from hanging
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
  // Position: centre on fight, pulled back proportionally to spread.
  const camZ = PERSP_Z + camera.zOff;
  threeCamera.position.set(camera.x, camera.y + PERSP_TILT_Y, camZ);
  threeCamera.lookAt(camera.x, camera.y, 0);
  // Apply subtle roll (tilt) on top of the lookAt orientation.
  if (Math.abs(camera.tilt) > 0.0001) {
    _camRollQ.setFromAxisAngle(_camRollAxis, camera.tilt);
    threeCamera.quaternion.multiply(_camRollQ);
  }
  // Dynamic FOV breathing and orthographic zoom scale.
  threeCamera.fov  = camera.fov;
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
      applyPose(group, fighter.state, fighter.currentMoveId, transform.facingRight);
    }

    // ── Character-specific per-frame visual effects ───────────────────────────

    // Trump: glowing orange aura when at low damage (high health).
    // Only active outside special moves (applyPose drives emissive during specials).
    // Emissive intensity fades out as damage% rises toward 100.
    const isSpecialActive = fighter.state === 'attack' &&
      fighter.currentMoveId != null &&
      fighter.currentMoveId.includes('Special');
    if (fighter.characterId === 'trump' && !isSpecialActive) {
      const dmgPct  = toFloat(fighter.damagePercent);          // 0–∞ raw %
      const auraStr = Math.max(0, 1 - dmgPct / 100) * 0.6;   // 0.6 at 0%, 0 at 100%+
      group.traverse((obj) => {
        if (!(obj instanceof THREE.Mesh)) return;
        const mat = obj.material;
        if (mat instanceof THREE.MeshToonMaterial) {
          mat.emissive.setRGB(auraStr, auraStr * 0.4, 0); // warm orange hue
        }
      });
    }

    // Lizzy: persistent neon-blue ghost translucency — make all toon materials
    // semi-transparent so she reads as a spectral apparition.
    // Opacity is already baked into the mesh materials at creation time; this
    // block is a safety net in case a material was added after initial creation.
    if (fighter.characterId === 'lizzy') {
      group.traverse((obj) => {
        if (!(obj instanceof THREE.Mesh)) return;
        const mat = obj.material;
        if (mat instanceof THREE.MeshToonMaterial && !mat.transparent) {
          mat.transparent = true;
          mat.opacity     = 0.72;
          mat.depthWrite  = false;
        }
      });
    }

    // ── Shield bubble ────────────────────────────────────────────────────────
    if (fighter.state === 'shielding') {
      let bubble = shieldBubbleMeshes.get(id);
      if (!bubble) {
        const geo = new THREE.SphereGeometry(SHIELD_BUBBLE_RADIUS, 16, 12);
        const mat = new THREE.MeshStandardMaterial({
          transparent:   true,
          opacity:       0.45,
          side:          THREE.FrontSide,
          depthWrite:    false,
          metalness:     0.1,
          roughness:     0.2,
        });
        bubble = new THREE.Mesh(geo, mat);
        scene.add(bubble);
        shieldBubbleMeshes.set(id, bubble);
      }
      // Position bubble over character
      bubble.position.set(wx, wy + 5, zOffset);
      bubble.visible = true;
      // Tint: green (full) → yellow → red (depleted)
      const health = fighter.shieldHealth / SHIELD_MAX_HEALTH;
      const mat    = bubble.material as THREE.MeshStandardMaterial;
      if (health > 0.5) {
        mat.color.setHex(0x44dd88);
      } else if (health > 0.25) {
        mat.color.setHex(0xffdd00);
      } else {
        mat.color.setHex(0xff4422);
      }
      // Scale bubble slightly smaller as shield drains
      const scale = 0.7 + health * 0.3;
      bubble.scale.setScalar(scale);
    } else {
      const bubble = shieldBubbleMeshes.get(id);
      if (bubble) bubble.visible = false;
    }

    playerIndex++;
  }

  renderer.render(scene, threeCamera);
}
