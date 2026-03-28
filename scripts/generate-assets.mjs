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
      for (const x of [-300, 300]) {
        const cloud = new THREE.Mesh(
          new THREE.SphereGeometry(60, 6, 4),
          new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0, roughness: 1 }),
        );
        cloud.scale.set(2, 1, 1);
        cloud.position.set(x, 150, -150);
        group.add(cloud);
      }
    },
  },
  {
    // Sector Omega: Cargo Bay — asymmetric metal deck with pit and drone lane.
    id: 'forge',
    platforms: [
      { x1: -500, x2:  -40, y: -30, passThru: false },
      { x1:   40, x2:  500, y:  30, passThru: false },
      { x1: -380, x2: -160, y: 100, passThru: true  },
      { x1:  160, x2:  380, y: 130, passThru: true  },
    ],
    mainColor: 0x3A4A5A,
    passColor: 0x4A5A6A,
    bgColor:   0x050B14,
    decorations(group) {
      // Hazard-stripe edges on deck gaps
      const stripeMat = new THREE.MeshStandardMaterial({ color: 0xFFCC00, metalness: 0, roughness: 0.6 });
      for (const x of [-500, 500]) {
        const edge = new THREE.Mesh(new THREE.BoxGeometry(10, 15, 50), stripeMat);
        edge.position.set(x, -38, -20);
        group.add(edge);
      }
      // Background monitor / spire
      const spire = new THREE.Mesh(
        new THREE.BoxGeometry(60, 300, 30),
        new THREE.MeshStandardMaterial({ color: 0x223344, emissive: 0x0044AA, emissiveIntensity: 0.4 }),
      );
      spire.position.set(0, -200, -180);
      group.add(spire);
      // Star-streak panels in background
      for (let i = 0; i < 6; i++) {
        const streak = new THREE.Mesh(
          new THREE.BoxGeometry(4, 80, 2),
          new THREE.MeshStandardMaterial({ color: 0xCCDDFF, emissive: 0x8899CC, emissiveIntensity: 0.6 }),
        );
        streak.position.set(-600 + i * 240, 120, -190);
        group.add(streak);
      }
    },
  },
  {
    // Pastel Paper Peaks — bouncy cloud platforms, storybook aesthetic.
    id: 'cloudCitadel',
    platforms: [
      { x1: -380, x2:  380, y:   0, passThru: false },
      { x1: -260, x2:  -70, y: 120, passThru: true  },
      { x1:   70, x2:  260, y: 120, passThru: true  },
      { x1: -100, x2:  100, y: 220, passThru: true  },
    ],
    mainColor: 0xFAFAFF,
    passColor: 0xE8F0FF,
    bgColor:   0xFFEEFF,
    decorations(group) {
      // Pastel hills in background
      const hillColors = [0xFFCCDD, 0xCCEEFF, 0xDDFFCC];
      for (let i = 0; i < 3; i++) {
        const hill = new THREE.Mesh(
          new THREE.SphereGeometry(180 + i * 60, 5, 3),
          new THREE.MeshStandardMaterial({ color: hillColors[i], metalness: 0, roughness: 1 }),
        );
        hill.scale.set(1.4, 0.6, 0.8);
        hill.position.set(-400 + i * 400, -180, -220);
        group.add(hill);
      }
      // Cartoon sun
      const sun = new THREE.Mesh(
        new THREE.SphereGeometry(70, 6, 4),
        new THREE.MeshStandardMaterial({ color: 0xFFFF88, emissive: 0xFFDD44, emissiveIntensity: 0.5 }),
      );
      sun.position.set(350, 280, -200);
      group.add(sun);
    },
  },
  {
    // Overgrown Clockwork Spire — wide stone bridge + chain-hung planks.
    id: 'ancientRuin',
    platforms: [
      { x1: -420, x2:  420, y:   0, passThru: false },
      { x1: -390, x2: -180, y: 150, passThru: true  },
      { x1:  180, x2:  390, y: 150, passThru: true  },
    ],
    mainColor: 0x6A6050,
    passColor: 0x8A7A5A,
    bgColor:   0x3A4030,
    decorations(group) {
      // Central stone gear (background, visual only)
      const gearMat = new THREE.MeshStandardMaterial({ color: 0x887766, roughness: 0.95, metalness: 0.1 });
      const gearBody = new THREE.Mesh(new THREE.CylinderGeometry(120, 120, 20, 8), gearMat);
      gearBody.rotation.x = Math.PI / 2;
      gearBody.position.set(0, 80, -160);
      group.add(gearBody);
      // Gear teeth
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const tooth = new THREE.Mesh(new THREE.BoxGeometry(20, 30, 18), gearMat);
        tooth.position.set(Math.cos(angle) * 130, 80 + Math.sin(angle) * 130, -160);
        group.add(tooth);
      }
      // Ruined pillars
      const pillarMat = new THREE.MeshStandardMaterial({ color: 0x7A6B55, roughness: 0.9 });
      for (const x of [-340, 340]) {
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(28, 160, 28), pillarMat);
        pillar.position.set(x, -50, -90);
        group.add(pillar);
        // Moss accent
        const moss = new THREE.Mesh(
          new THREE.BoxGeometry(30, 20, 30),
          new THREE.MeshStandardMaterial({ color: 0x4A7A30, roughness: 1 }),
        );
        moss.position.set(x, 40, -90);
        group.add(moss);
      }
    },
  },
  {
    // The Neon Polygon Grid — single wide hexagonal slab, Data Core interior.
    id: 'digitalGrid',
    platforms: [
      { x1: -460, x2:  460, y:   0, passThru: false },
      { x1: -220, x2:  -50, y: 160, passThru: true  },
      { x1:   50, x2:  220, y: 160, passThru: true  },
    ],
    mainColor: 0x0A0820,
    passColor: 0x100840,
    bgColor:   0x020408,
    decorations(group) {
      // Cyan edge glow strips along the main slab
      const glowMat = new THREE.MeshStandardMaterial({
        color: 0x00FFEE, emissive: 0x00CCBB, emissiveIntensity: 0.8, roughness: 0.2,
      });
      for (const x of [-460, 460]) {
        const strip = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 52), glowMat);
        strip.position.set(x, 0, -18);
        group.add(strip);
      }
      // Background wireframe cube silhouettes
      const wireMat = new THREE.MeshStandardMaterial({
        color: 0x3344AA, emissive: 0x1122AA, emissiveIntensity: 0.3, wireframe: true,
      });
      for (let i = 0; i < 4; i++) {
        const cube = new THREE.Mesh(new THREE.BoxGeometry(80, 80, 80), wireMat);
        cube.position.set(-450 + i * 300, 60 + (i % 2) * 80, -180);
        group.add(cube);
      }
      // Grid scan lines
      const lineMat = new THREE.MeshStandardMaterial({
        color: 0x0055FF, emissive: 0x0033CC, emissiveIntensity: 0.4,
      });
      for (let i = 0; i < 8; i++) {
        const line = new THREE.Mesh(new THREE.BoxGeometry(960, 2, 1), lineMat);
        line.position.set(0, -40 - i * 40, -155);
        group.add(line);
      }
    },
  },
  {
    // Crystal Caverns — underground cave with glowing crystal formations.
    id: 'crystalCavern',
    platforms: [
      { x1: -360, x2:  360, y:   0, passThru: false },
      { x1: -320, x2: -110, y: 140, passThru: true  },
      { x1:  110, x2:  320, y: 140, passThru: true  },
      { x1:  -70, x2:   70, y: 220, passThru: false },
    ],
    mainColor: 0x1A1A2E,
    passColor: 0x2A2A4E,
    bgColor:   0x0A0A1A,
    decorations(group) {
      // Glowing crystal clusters
      const crystalColors = [0x44FFEE, 0xFF44CC, 0x88AAFF];
      for (let i = 0; i < 6; i++) {
        const c = crystalColors[i % 3];
        const xtal = new THREE.Mesh(
          new THREE.ConeGeometry(12 + (i % 3) * 6, 50 + (i % 2) * 30, 5),
          new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.5, roughness: 0.3 }),
        );
        xtal.position.set(-300 + i * 120, -20, -80 - (i % 2) * 30);
        group.add(xtal);
      }
      // Stalactite hints from ceiling
      for (let i = 0; i < 5; i++) {
        const stala = new THREE.Mesh(
          new THREE.ConeGeometry(8, 40, 4),
          new THREE.MeshStandardMaterial({ color: 0x334455, roughness: 0.9 }),
        );
        stala.rotation.z = Math.PI; // point downward
        stala.position.set(-200 + i * 100, 290, -100);
        group.add(stala);
      }
      // Cave wall panels
      const wallMat = new THREE.MeshStandardMaterial({ color: 0x222233, roughness: 1 });
      for (const x of [-420, 420]) {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(40, 400, 60), wallMat);
        wall.position.set(x, 50, -100);
        group.add(wall);
      }
    },
  },
  {
    // Void Rift — sparse platforms suspended over an infinite dark void.
    id: 'voidRift',
    platforms: [
      { x1: -180, x2:  180, y:   0, passThru: false },
      { x1: -380, x2: -220, y:  80, passThru: true  },
      { x1:  220, x2:  380, y:  80, passThru: true  },
    ],
    mainColor: 0x1A0A2A,
    passColor: 0x2A1A3A,
    bgColor:   0x000008,
    decorations(group) {
      // Void energy cracks emanating from centre
      const crackMat = new THREE.MeshStandardMaterial({
        color: 0x6600AA, emissive: 0x440088, emissiveIntensity: 0.7,
      });
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        const crack = new THREE.Mesh(new THREE.BoxGeometry(3, 200, 2), crackMat);
        crack.rotation.z = angle;
        crack.position.set(0, 0, -160);
        group.add(crack);
      }
      // Distant void stars
      for (let i = 0; i < 12; i++) {
        const star = new THREE.Mesh(
          new THREE.SphereGeometry(3, 3, 2),
          new THREE.MeshStandardMaterial({ color: 0xAABBFF, emissive: 0x8899DD, emissiveIntensity: 0.9 }),
        );
        star.position.set(-500 + i * 90, -100 + (i % 4) * 80, -200);
        group.add(star);
      }
      // Rift portal ring
      const ringMat = new THREE.MeshStandardMaterial({
        color: 0x9900FF, emissive: 0x6600CC, emissiveIntensity: 0.8, wireframe: true,
      });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(140, 8, 6, 12), ringMat);
      ring.position.set(0, -80, -170);
      group.add(ring);
    },
  },
  {
    // Solar Pinnacle — mountaintop arena with solar-flare hazards.
    id: 'solarPinnacle',
    platforms: [
      { x1: -340, x2:  340, y:   0, passThru: false },
      { x1: -460, x2: -280, y: -60, passThru: true  },
      { x1:  280, x2:  460, y: -60, passThru: true  },
      { x1: -390, x2: -200, y: 110, passThru: true  },
      { x1:  200, x2:  390, y: 110, passThru: true  },
    ],
    mainColor: 0xE8D090,
    passColor: 0xD0B870,
    bgColor:   0xFF8C00,
    decorations(group) {
      // Giant sun in background
      const sun = new THREE.Mesh(
        new THREE.SphereGeometry(200, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0xFFEE44, emissive: 0xFFCC00, emissiveIntensity: 0.6 }),
      );
      sun.position.set(200, 300, -250);
      group.add(sun);
      // Solar corona rays
      const rayMat = new THREE.MeshStandardMaterial({ color: 0xFFAA00, emissive: 0xFF8800, emissiveIntensity: 0.5 });
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const ray = new THREE.Mesh(new THREE.BoxGeometry(6, 120, 4), rayMat);
        ray.rotation.z = angle;
        ray.position.set(200 + Math.cos(angle) * 240, 300 + Math.sin(angle) * 240, -248);
        group.add(ray);
      }
      // Mountain peak rocks
      const rockMat = new THREE.MeshStandardMaterial({ color: 0xAA9966, roughness: 1 });
      for (const x of [-480, 480]) {
        const rock = new THREE.Mesh(new THREE.ConeGeometry(60, 160, 5), rockMat);
        rock.position.set(x, -180, -120);
        group.add(rock);
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
