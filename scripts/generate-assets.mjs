// scripts/generate-assets.mjs
// Generates placeholder GLB assets for all 5 characters and 5 stages.
// Run with: node scripts/generate-assets.mjs

// Polyfill browser globals that Three.js addons expect in Node.js.
if (typeof globalThis.self === 'undefined') {
  globalThis.self = globalThis;
}

// GLTFExporter uses FileReader to read Blob data. Polyfill for Node.js.
if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class FileReader {
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((buffer) => {
        this.result = buffer;
        if (typeof this.onloadend === 'function') this.onloadend({ target: this });
      });
    }
    readAsDataURL(blob) {
      blob.arrayBuffer().then((buffer) => {
        const base64 = Buffer.from(buffer).toString('base64');
        const mimeType = blob.type || 'application/octet-stream';
        this.result = `data:${mimeType};base64,${base64}`;
        if (typeof this.onloadend === 'function') this.onloadend({ target: this });
      });
    }
  };
}

import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------------------------
// Animation constants
// ---------------------------------------------------------------------------

const IDLE_BOB_AMPLITUDE = 2; // units — root Y-bob height for idle animation

// ---------------------------------------------------------------------------
// Quaternion helpers
// ---------------------------------------------------------------------------

function quatRotX(deg) {
  const r = (deg * Math.PI) / 180 / 2;
  return [Math.sin(r), 0, 0, Math.cos(r)];
}

function quatRotZ(deg) {
  const r = (deg * Math.PI) / 180 / 2;
  return [0, 0, Math.sin(r), Math.cos(r)];
}

function quatIdentity() {
  return [0, 0, 0, 1];
}

/** Flatten an array of [x,y,z,w] quaternion tuples into a Float32Array. */
function flatQuat(...quats) {
  return new Float32Array(quats.flat());
}

/** Lighten a hex colour by adding `amount` (0–1) to each RGB channel. */
function lightenColor(hexColor, amount) {
  const c = new THREE.Color(hexColor);
  c.r = Math.min(1, c.r + amount);
  c.g = Math.min(1, c.g + amount);
  c.b = Math.min(1, c.b + amount);
  return c.getHex();
}

// ---------------------------------------------------------------------------
// Character definitions
// ---------------------------------------------------------------------------

const characters = [
  { id: 'kael',  color: 0x4488ee },
  { id: 'gorun', color: 0xee6600 },
  { id: 'vela',  color: 0x44dd66 },
  { id: 'syne',  color: 0xcc44ff },
  { id: 'zira',  color: 0xffd700 },
];

/**
 * Build a box-humanoid THREE.Group for a character.
 * Body part names must match animation track targets exactly.
 */
function buildCharacter(id, color) {
  const mat = new THREE.MeshStandardMaterial({ color, metalness: 0, roughness: 0.8 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0, roughness: 0.8 });

  const group = new THREE.Group();
  group.name = `${id}_root`;

  const torso = new THREE.Mesh(new THREE.BoxGeometry(26, 28, 16), mat);
  torso.name = 'torso';
  torso.position.set(0, 14, 0);
  group.add(torso);

  const head = new THREE.Mesh(new THREE.BoxGeometry(20, 20, 18), mat);
  head.name = 'head';
  head.position.set(0, 38, 0);
  group.add(head);

  const eyeL = new THREE.Mesh(new THREE.BoxGeometry(5, 5, 2), eyeMat);
  eyeL.name = 'eyeL';
  eyeL.position.set(-5, 40, 9);
  group.add(eyeL);

  const eyeR = new THREE.Mesh(new THREE.BoxGeometry(5, 5, 2), eyeMat);
  eyeR.name = 'eyeR';
  eyeR.position.set(5, 40, 9);
  group.add(eyeR);

  const armL = new THREE.Mesh(new THREE.BoxGeometry(8, 24, 8), mat);
  armL.name = 'armL';
  armL.position.set(-17, 14, 0);
  group.add(armL);

  const armR = new THREE.Mesh(new THREE.BoxGeometry(8, 24, 8), mat);
  armR.name = 'armR';
  armR.position.set(17, 14, 0);
  group.add(armR);

  const legL = new THREE.Mesh(new THREE.BoxGeometry(10, 26, 10), mat);
  legL.name = 'legL';
  legL.position.set(-7, -13, 0);
  group.add(legL);

  const legR = new THREE.Mesh(new THREE.BoxGeometry(10, 26, 10), mat);
  legR.name = 'legR';
  legR.position.set(7, -13, 0);
  group.add(legR);

  return group;
}

/** Build all AnimationClips for a character. */
function buildAnimations(id) {
  const root = `${id}_root`;
  const clips = [];

  // --- idle (1 s, loop): gentle root Y-bob ---
  clips.push(new THREE.AnimationClip('idle', 1.0, [
    new THREE.VectorKeyframeTrack(
      `${root}.position`,
      [0, 0.5, 1.0],
      new Float32Array([0, 0, 0,  0, IDLE_BOB_AMPLITUDE, 0,  0, 0, 0]),
    ),
  ]));

  // --- run (0.5 s, loop): leg/arm oscillation ---
  const runTimes = [0, 0.125, 0.25, 0.375, 0.5];
  clips.push(new THREE.AnimationClip('run', 0.5, [
    new THREE.QuaternionKeyframeTrack(
      'legL.quaternion', runTimes,
      flatQuat(quatRotX(30), quatRotX(0), quatRotX(-30), quatRotX(0), quatRotX(30)),
    ),
    new THREE.QuaternionKeyframeTrack(
      'legR.quaternion', runTimes,
      flatQuat(quatRotX(-30), quatRotX(0), quatRotX(30), quatRotX(0), quatRotX(-30)),
    ),
    new THREE.QuaternionKeyframeTrack(
      'armL.quaternion', runTimes,
      flatQuat(quatRotX(-20), quatRotX(0), quatRotX(20), quatRotX(0), quatRotX(-20)),
    ),
    new THREE.QuaternionKeyframeTrack(
      'armR.quaternion', runTimes,
      flatQuat(quatRotX(20), quatRotX(0), quatRotX(-20), quatRotX(0), quatRotX(20)),
    ),
  ]));

  // --- jump (0.2 s, one-shot): neutral → crouch pose ---
  const jumpTimes = [0, 0.2];
  clips.push(new THREE.AnimationClip('jump', 0.2, [
    new THREE.QuaternionKeyframeTrack(
      'legL.quaternion', jumpTimes,
      flatQuat(quatIdentity(), quatRotX(-20)),
    ),
    new THREE.QuaternionKeyframeTrack(
      'legR.quaternion', jumpTimes,
      flatQuat(quatIdentity(), quatRotX(-20)),
    ),
    new THREE.QuaternionKeyframeTrack(
      'armL.quaternion', jumpTimes,
      flatQuat(quatIdentity(), quatRotX(-20)),
    ),
    new THREE.QuaternionKeyframeTrack(
      'armR.quaternion', jumpTimes,
      flatQuat(quatIdentity(), quatRotX(-20)),
    ),
  ]));

  // --- attack (0.4 s, one-shot): right arm forward swing ---
  clips.push(new THREE.AnimationClip('attack', 0.4, [
    new THREE.QuaternionKeyframeTrack(
      'armR.quaternion',
      [0, 0.1, 0.2, 0.4],
      flatQuat(quatIdentity(), quatRotX(-90), quatRotX(-90), quatIdentity()),
    ),
  ]));

  // --- hitstun (0.3 s, loop): root Z wobble ±12° ---
  clips.push(new THREE.AnimationClip('hitstun', 0.3, [
    new THREE.QuaternionKeyframeTrack(
      `${root}.quaternion`,
      [0, 0.075, 0.15, 0.225, 0.3],
      flatQuat(
        quatRotZ(12), quatRotZ(-12), quatRotZ(12), quatRotZ(-12), quatRotZ(12),
      ),
    ),
  ]));

  // --- KO (0.5 s, one-shot): Z tilt + vertical squash ---
  clips.push(new THREE.AnimationClip('KO', 0.5, [
    new THREE.QuaternionKeyframeTrack(
      `${root}.quaternion`,
      [0, 0.5],
      flatQuat(quatIdentity(), quatRotZ(80)),
    ),
    new THREE.VectorKeyframeTrack(
      `${root}.scale`,
      [0, 0.5],
      new Float32Array([1, 1, 1,  1, 0.3, 1]),
    ),
  ]));

  return clips;
}

// ---------------------------------------------------------------------------
// Stage definitions
// ---------------------------------------------------------------------------

const stages = [
  {
    id: 'aetherPlateau',
    platforms: [
      { x1: -425, x2:  425, y:   0, passThru: false },
      { x1: -280, x2: -130, y: 130, passThru: true  },
      { x1:  130, x2:  280, y: 130, passThru: true  },
      { x1: -110, x2:  110, y: 230, passThru: true  },
    ],
    mainColor: 0xC8A86E,
    passColor: 0xD8B87E,
    bgColor:   0xFFD580,
    decorations(group) {
      const cloudY = 150;   // world Y for cloud puffs
      const cloudZ = -150;  // world Z for cloud puffs
      for (const x of [-300, 300]) {
        const cloud = new THREE.Mesh(
          new THREE.SphereGeometry(60, 6, 4),
          new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0, roughness: 1 }),
        );
        cloud.scale.set(2, 1, 1);
        cloud.position.set(x, cloudY, cloudZ);
        group.add(cloud);
      }
    },
  },
  {
    id: 'forge',
    platforms: [
      { x1: -550, x2:  550, y:   0, passThru: false },
      { x1: -350, x2: -150, y: 120, passThru: true  },
      { x1:  150, x2:  350, y: 120, passThru: true  },
    ],
    mainColor: 0x444444,
    passColor: 0x666666,
    bgColor:   0xFF6600,
    decorations(group) {
      for (const x of [-500, -250, 250, 500]) {
        const pillar = new THREE.Mesh(
          new THREE.BoxGeometry(30, 200, 20),
          new THREE.MeshStandardMaterial({
            color: 0xFF4400, metalness: 0, roughness: 0.5,
            emissive: 0xFF2200, emissiveIntensity: 0.3,
          }),
        );
        pillar.position.set(x, -200, -100);
        group.add(pillar);
      }
    },
  },
  {
    id: 'cloudCitadel',
    platforms: [
      { x1: -300, x2:  300, y:   0, passThru: false },
      { x1: -350, x2: -200, y: 160, passThru: true  },
      { x1:  200, x2:  350, y: 160, passThru: true  },
      { x1: -100, x2:  100, y: 100, passThru: true  },
    ],
    mainColor: 0xF0F4FF,
    passColor: 0xCCD0E8,
    bgColor:   0x87CEEB,
    decorations(group) {
      for (const x of [-200, -100, 100, 200]) {
        const spire = new THREE.Mesh(
          new THREE.BoxGeometry(20, 150, 20),
          new THREE.MeshStandardMaterial({ color: 0xCCD0E8, metalness: 0, roughness: 0.8 }),
        );
        spire.position.set(x, 50, -100);
        group.add(spire);
      }
    },
  },
  {
    id: 'ancientRuin',
    platforms: [
      { x1: -400, x2:  400, y:   0, passThru: false },
      { x1: -280, x2: -130, y: 140, passThru: true  },
      { x1:  130, x2:  280, y: 140, passThru: true  },
      { x1:  -60, x2:   60, y: 100, passThru: false },
    ],
    mainColor: 0x7A7060,
    passColor: 0x9A9070,
    bgColor:   0x8B6050,
    decorations(group) {
      for (const x of [-180, -320, 180, 320]) {
        const pillar = new THREE.Mesh(
          new THREE.BoxGeometry(25, 120, 25),
          new THREE.MeshStandardMaterial({ color: 0x8B7355, metalness: 0, roughness: 0.9 }),
        );
        pillar.position.set(x, -30, -80);
        group.add(pillar);
      }
    },
  },
  {
    id: 'digitalGrid',
    platforms: [
      { x1: -400, x2:  400, y:   0, passThru: false },
      { x1: -300, x2: -120, y: 130, passThru: true  },
      { x1:  120, x2:  300, y: 130, passThru: true  },
      { x1:  -80, x2:   80, y: 200, passThru: true  },
    ],
    mainColor: 0x0A1020,
    passColor: 0x0A2040,
    bgColor:   0x0A1020,
    decorations(group) {
      for (let i = 0; i < 10; i++) {
        const line = new THREE.Mesh(
          new THREE.BoxGeometry(1000, 2, 1),
          new THREE.MeshStandardMaterial({
            color: 0x0088FF, metalness: 0, roughness: 0.5,
            emissive: 0x0044FF, emissiveIntensity: 0.5,
          }),
        );
        line.position.set(0, -50 - i * 50, -150);
        group.add(line);
      }
    },
  },
];

/** Build a THREE.Group containing platform meshes, highlights, bg plane, and decorations. */
function buildStage(stageDef) {
  const group = new THREE.Group();
  group.name = `${stageDef.id}_root`;

  // Background plane
  const bgPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(4000, 2000),
    new THREE.MeshStandardMaterial({ color: stageDef.bgColor, metalness: 0, roughness: 1 }),
  );
  bgPlane.name = 'background';
  bgPlane.position.set(0, 0, -200);
  group.add(bgPlane);

  // Platform meshes
  for (const plat of stageDef.platforms) {
    const width = plat.x2 - plat.x1;
    const cx    = (plat.x1 + plat.x2) / 2;
    const color = plat.passThru ? stageDef.passColor : stageDef.mainColor;

    const platMesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, 20, 50),
      new THREE.MeshStandardMaterial({ color, metalness: 0, roughness: 0.8 }),
    );
    platMesh.position.set(cx, plat.y - 10, -20);
    group.add(platMesh);

    // Edge highlight strip on top surface
    const hlColor = lightenColor(color, 0.1);
    const hlMesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, 3, 50),
      new THREE.MeshStandardMaterial({ color: hlColor, metalness: 0, roughness: 0.7 }),
    );
    hlMesh.position.set(cx, plat.y + 1.5, -19);
    group.add(hlMesh);
  }

  stageDef.decorations(group);

  return group;
}

// ---------------------------------------------------------------------------
// GLB export helper
// ---------------------------------------------------------------------------

function exportGLB(object, animationClips, outputPath) {
  return new Promise((resolve, reject) => {
    const exporter = new GLTFExporter();
    exporter.parse(
      object,
      (result) => {
        fs.writeFileSync(outputPath, Buffer.from(result));
        console.log(`  ✓  ${outputPath}`);
        resolve();
      },
      (err) => reject(err),
      { binary: true, animations: animationClips },
    );
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const BASE_DIR = new URL('..', import.meta.url).pathname;

for (const char of characters) {
  const dir = path.join(BASE_DIR, 'public', 'assets', char.id);
  fs.mkdirSync(dir, { recursive: true });
  const group = buildCharacter(char.id, char.color);
  const clips = buildAnimations(char.id);
  await exportGLB(group, clips, path.join(dir, `${char.id}.glb`));
}

for (const stage of stages) {
  const dir = path.join(BASE_DIR, 'public', 'assets', stage.id);
  fs.mkdirSync(dir, { recursive: true });
  const group = buildStage(stage);
  await exportGLB(group, [], path.join(dir, `${stage.id}.glb`));
}

console.log('All assets generated.');
