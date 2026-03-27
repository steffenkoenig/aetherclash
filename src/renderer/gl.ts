// src/renderer/gl.ts
// Three.js WebGL renderer — orthographic side-on view.
// Internal resolution: 1920×1080, CSS-scaled to fill the viewport.
//
// Rendering layers (back to front):
//   1. Deep-space background + star field
//   2. Stage geometry (platform meshes)
//   3. Character models (procedural humanoid groups; swapped for GLBs on load)
//   4. HUD (HTML/CSS overlay — not managed here)

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

// ── Internal resolution ───────────────────────────────────────────────────────

const INTERNAL_WIDTH  = 1920;
const INTERNAL_HEIGHT = 1080;

// ── Three.js singletons ───────────────────────────────────────────────────────

let renderer: THREE.WebGLRenderer;
let scene:    THREE.Scene;
let threeCamera: THREE.OrthographicCamera;

// ── Character mesh registry ───────────────────────────────────────────────────

// Maps entity id → Three.js Group currently in the scene.
const characterMeshes = new Map<number, THREE.Group>();
// Tracks which entities have already triggered a GLB swap (to swap only once).
const glbSwapped      = new Set<number>();

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

  // Orthographic camera matching the internal resolution
  threeCamera = new THREE.OrthographicCamera(
    -INTERNAL_WIDTH  / 2,  // left
     INTERNAL_WIDTH  / 2,  // right
     INTERNAL_HEIGHT / 2,  // top
    -INTERNAL_HEIGHT / 2,  // bottom
    0.1,
    2000,
  );
  threeCamera.position.set(0, 0, 1000);

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

  // Reset per-frame transient transforms before applying state pose
  group.rotation.z  = 0;
  group.scale.set(group.scale.x < 0 ? -1 : 1, 1, 1); // preserve facing, reset y/z

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
      group.scale.set(group.scale.x < 0 ? -0.95 : 0.95, 0.95, 1.2);
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
  threeCamera.position.set(camera.x, camera.y, 1000);
  threeCamera.zoom = camera.zoom;
  threeCamera.updateProjectionMatrix();

  // ── Platform meshes ───────────────────────────────────────────────────────
  for (const plat of stagePlatforms) {
    const key = platKey(plat);
    if (!platformMeshes.has(key)) {
      const mesh = buildPlatformMesh(plat);
      scene.add(mesh);
      platformMeshes.set(key, mesh);
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
      }).catch(() => { /* silently ignore */ });
    }

    const group = characterMeshes.get(id)!;

    // Position
    const wx = toFloat(transform.x);
    const wy = toFloat(transform.y);
    group.position.set(wx, wy, zOffset);

    // Facing direction (preserve any y/z scale set by pose)
    const faceSign = transform.facingRight ? 1 : -1;
    group.scale.x = faceSign * Math.abs(group.scale.x);

    // Pose animation
    applyPose(group, fighter.state);

    playerIndex++;
  }

  renderer.render(scene, threeCamera);
}
