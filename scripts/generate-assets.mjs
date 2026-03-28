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
// Stage definitions — background geometry only (platforms rendered at runtime)
// ---------------------------------------------------------------------------

/**
 * Each stage defines only its background / decoration geometry.
 * The renderer draws the physics platforms separately, so stage GLBs must NOT
 * include duplicate platform boxes.
 */
const stages = [
  {
    id: 'aetherPlateau',
    bgColor: 0x87ceeb,
    buildBackground(group) {
      // Sky gradient plane
      group.add(skyPlane(0xffd580));

      // Distant rolling hills
      const hillMat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 1, metalness: 0 });
      const hills = [
        { x: -600, r: 260, c: 0x8fbc5f },
        { x:    0, r: 320, c: 0x7aad4e },
        { x:  600, r: 260, c: 0x8fbc5f },
      ];
      for (const h of hills) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(h.r, 8, 5), hillMat(h.c));
        m.scale.set(1.6, 0.55, 0.6);
        m.position.set(h.x, -340, -190);
        group.add(m);
      }

      // Two large cumulus cloud puffs flanking the stage
      const cloudMat = new THREE.MeshToonMaterial({ color: 0xffffff });
      for (const [sx, sy] of [[-520, 180], [520, 210], [-300, 280], [310, 270]]) {
        const c = new THREE.Mesh(new THREE.SphereGeometry(80 + Math.abs(sx % 30), 6, 4), cloudMat);
        c.scale.set(1.8, 0.8, 0.6);
        c.position.set(sx, sy, -160);
        group.add(c);
      }

      // Sun
      const sunGeo = new THREE.SphereGeometry(70, 8, 6);
      const sunMat = new THREE.MeshStandardMaterial({ color: 0xffe060, emissive: 0xffcc00, emissiveIntensity: 0.6 });
      const sun = new THREE.Mesh(sunGeo, sunMat);
      sun.position.set(-450, 350, -190);
      group.add(sun);
    },
  },

  {
    // Sector Omega: Cargo Bay — deep-space industrial transport
    id: 'forge',
    bgColor: 0x050b14,
    buildBackground(group) {
      group.add(skyPlane(0x050b14));

      // Star streaks (warp effect) — long horizontal lines
      const streakMat = new THREE.MeshStandardMaterial({ color: 0x99bbff, emissive: 0x6688cc, emissiveIntensity: 0.7 });
      for (let i = 0; i < 18; i++) {
        const len = 180 + (i * 37 % 200);
        const streak = new THREE.Mesh(new THREE.BoxGeometry(len, 1.5, 1), streakMat);
        streak.position.set(-700 + (i * 83 % 1400), -280 + (i * 61 % 560), -185);
        group.add(streak);
      }

      // Spaceship hull panels — left and right bulkhead walls
      const hullMat = new THREE.MeshStandardMaterial({ color: 0x1e2e40, metalness: 0.6, roughness: 0.5 });
      const rivetMat = new THREE.MeshStandardMaterial({ color: 0x3a5060, metalness: 0.8, roughness: 0.3 });
      for (const sx of [-1, 1]) {
        // Main hull section
        const panel = new THREE.Mesh(new THREE.BoxGeometry(260, 700, 30), hullMat);
        panel.position.set(sx * 740, -50, -150);
        group.add(panel);
        // Rivet rows
        for (let row = -2; row <= 2; row++) {
          const bar = new THREE.Mesh(new THREE.BoxGeometry(240, 6, 34), rivetMat);
          bar.position.set(sx * 740, row * 120, -134);
          group.add(bar);
        }
      }

      // Central background — cargo bay rear wall with viewport window
      const rearWall = new THREE.Mesh(new THREE.BoxGeometry(900, 600, 20), hullMat);
      rearWall.position.set(0, -100, -180);
      group.add(rearWall);

      // Viewport window — glowing oval showing space outside
      const windowMat = new THREE.MeshStandardMaterial({ color: 0x0033aa, emissive: 0x0022cc, emissiveIntensity: 0.5 });
      const porthole = new THREE.Mesh(new THREE.CircleGeometry(90, 12), windowMat);
      porthole.position.set(0, 80, -168);
      group.add(porthole);
      // Window frame
      const frameMat = new THREE.MeshStandardMaterial({ color: 0x445566, metalness: 0.7, roughness: 0.4 });
      const frame = new THREE.Mesh(new THREE.TorusGeometry(92, 8, 6, 12), frameMat);
      frame.position.set(0, 80, -167);
      group.add(frame);

      // Alarm-light columns
      const alarmMat = new THREE.MeshStandardMaterial({ color: 0xdd2200, emissive: 0xaa1100, emissiveIntensity: 0.5 });
      for (const ax of [-380, 380]) {
        const light = new THREE.Mesh(new THREE.SphereGeometry(14, 6, 4), alarmMat);
        light.position.set(ax, 120, -140);
        group.add(light);
        const pole = new THREE.Mesh(new THREE.BoxGeometry(6, 80, 6), rivetMat);
        pole.position.set(ax, 80, -140);
        group.add(pole);
      }

      // Floor grating lines
      const gratingMat = new THREE.MeshStandardMaterial({ color: 0x223344, metalness: 0.4, roughness: 0.6 });
      for (let i = -4; i <= 4; i++) {
        const line = new THREE.Mesh(new THREE.BoxGeometry(900, 3, 4), gratingMat);
        line.position.set(0, -320 + i * 20, -155);
        group.add(line);
      }
    },
  },

  {
    // Pastel Paper Peaks — storybook cardboard world
    id: 'cloudCitadel',
    bgColor: 0xffeeff,
    buildBackground(group) {
      group.add(skyPlane(0xfce8ff));

      // Pastel horizon band
      const horizMat = new THREE.MeshStandardMaterial({ color: 0xffccee, roughness: 1 });
      const horiz = new THREE.Mesh(new THREE.PlaneGeometry(4000, 400), horizMat);
      horiz.position.set(0, -300, -199);
      group.add(horiz);

      // Rolling pastel hills (big, flat-bottomed)
      const hillColors = [0xffd0e8, 0xd0eeff, 0xd8ffd0, 0xffe8c0];
      for (let i = 0; i < 4; i++) {
        const hill = new THREE.Mesh(
          new THREE.SphereGeometry(300 + i * 40, 7, 4),
          new THREE.MeshToonMaterial({ color: hillColors[i] }),
        );
        hill.scale.set(1.4, 0.5, 0.5);
        hill.position.set(-700 + i * 480, -390, -195);
        group.add(hill);
      }

      // Big cartoon sun with rays
      const sunMat = new THREE.MeshToonMaterial({ color: 0xffee44 });
      const sun = new THREE.Mesh(new THREE.CircleGeometry(80, 10), sunMat);
      sun.position.set(420, 300, -192);
      group.add(sun);
      const rayMat = new THREE.MeshToonMaterial({ color: 0xffdd00 });
      for (let r = 0; r < 8; r++) {
        const angle = (r / 8) * Math.PI * 2;
        const ray = new THREE.Mesh(new THREE.BoxGeometry(12, 60, 2), rayMat);
        ray.rotation.z = angle;
        ray.position.set(420 + Math.cos(angle) * 110, 300 + Math.sin(angle) * 110, -191);
        group.add(ray);
      }

      // Cartoon trees (cylinder trunk + sphere foliage)
      const trunkMat = new THREE.MeshToonMaterial({ color: 0xaa7744 });
      const leafColors = [0x66cc44, 0x44aa66, 0x88dd44];
      for (let t = 0; t < 5; t++) {
        const tx = -550 + t * 280;
        const ty = -250 + (t % 2) * 30;
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(10, 14, 80, 6), trunkMat);
        trunk.position.set(tx, ty - 40, -170);
        group.add(trunk);
        const leaves = new THREE.Mesh(
          new THREE.SphereGeometry(55 + t * 6, 6, 4),
          new THREE.MeshToonMaterial({ color: leafColors[t % 3] }),
        );
        leaves.position.set(tx, ty + 30, -170);
        group.add(leaves);
      }

      // Rainbow arc
      const arcColors = [0xff4444, 0xff9900, 0xffee00, 0x44cc44, 0x4488ff, 0x8844ff];
      for (let a = 0; a < arcColors.length; a++) {
        const arc = new THREE.Mesh(
          new THREE.TorusGeometry(260 + a * 18, 8, 4, 20, Math.PI),
          new THREE.MeshToonMaterial({ color: arcColors[a] }),
        );
        arc.position.set(-150, -80, -188 + a);
        group.add(arc);
      }
    },
  },

  {
    // Overgrown Clockwork Spire — ancient ruins reclaimed by nature
    id: 'ancientRuin',
    bgColor: 0x3a4030,
    buildBackground(group) {
      group.add(skyPlane(0x2a3020));

      // Misty sky gradient overlay
      const mistMat = new THREE.MeshStandardMaterial({ color: 0x607850, transparent: true, opacity: 0.35 });
      const mist = new THREE.Mesh(new THREE.PlaneGeometry(4000, 800), mistMat);
      mist.position.set(0, -100, -198);
      group.add(mist);

      // Stone spire tower — tall background centrepiece
      const stoneMat = new THREE.MeshStandardMaterial({ color: 0x6a6050, roughness: 0.95, metalness: 0.05 });
      const darkStoneMat = new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 1 });
      const tower = new THREE.Mesh(new THREE.BoxGeometry(120, 520, 60), stoneMat);
      tower.position.set(0, -10, -170);
      group.add(tower);
      // Tower top — battlements
      for (let b = -2; b <= 2; b++) {
        const merlon = new THREE.Mesh(new THREE.BoxGeometry(20, 40, 62), darkStoneMat);
        merlon.position.set(b * 28, 250, -170);
        group.add(merlon);
      }

      // Stone gear on the spire face
      const gearMat = new THREE.MeshStandardMaterial({ color: 0x7a6850, roughness: 0.9, metalness: 0.15 });
      const gear = new THREE.Mesh(new THREE.CylinderGeometry(88, 88, 16, 8), gearMat);
      gear.rotation.x = Math.PI / 2;
      gear.position.set(0, 80, -136);
      group.add(gear);
      // Gear teeth
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2;
        const tooth = new THREE.Mesh(new THREE.BoxGeometry(18, 28, 18), gearMat);
        tooth.position.set(Math.cos(ang) * 98, 80 + Math.sin(ang) * 98, -136);
        group.add(tooth);
      }
      // Gear hub
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(22, 22, 18, 8), darkStoneMat);
      hub.rotation.x = Math.PI / 2;
      hub.position.set(0, 80, -134);
      group.add(hub);

      // Ruined side pillars with ivy
      const mossMat = new THREE.MeshStandardMaterial({ color: 0x4a7a30, roughness: 1 });
      for (const px of [-350, -220, 220, 350]) {
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(30, 200, 30), stoneMat);
        pillar.position.set(px, -80, -130);
        group.add(pillar);
        // Moss patches
        const moss = new THREE.Mesh(new THREE.BoxGeometry(32, 50, 32), mossMat);
        moss.position.set(px, -5, -130);
        group.add(moss);
        // Crumbled top
        const rubble = new THREE.Mesh(new THREE.BoxGeometry(28, 20, 28), darkStoneMat);
        rubble.rotation.z = 0.15 * (px > 0 ? 1 : -1);
        rubble.position.set(px, 25, -130);
        group.add(rubble);
      }

      // Large tree roots creeping from sides
      const rootMat = new THREE.MeshStandardMaterial({ color: 0x5a4a2a, roughness: 1 });
      for (const rx of [-480, 480]) {
        const root = new THREE.Mesh(new THREE.BoxGeometry(30, 300, 20), rootMat);
        root.rotation.z = rx > 0 ? 0.3 : -0.3;
        root.position.set(rx, -200, -145);
        group.add(root);
      }

      // Hanging vines
      const vineMat = new THREE.MeshStandardMaterial({ color: 0x3a6020, roughness: 1 });
      for (let v = 0; v < 6; v++) {
        const vine = new THREE.Mesh(new THREE.BoxGeometry(5, 120 + v * 20, 4), vineMat);
        vine.position.set(-280 + v * 110, 100 - v * 10, -140);
        group.add(vine);
      }
    },
  },

  {
    // The Neon Polygon Grid — Data Core interior
    id: 'digitalGrid',
    bgColor: 0x020408,
    buildBackground(group) {
      group.add(skyPlane(0x020408));

      // Deep grid floor extending into the background
      const gridMat = new THREE.MeshStandardMaterial({ color: 0x0a0820, roughness: 1 });
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(4000, 2000), gridMat);
      floor.position.set(0, -350, -195);
      group.add(floor);

      // Horizontal scan-line grid (deep background)
      const scanMat = new THREE.MeshStandardMaterial({ color: 0x001122, emissive: 0x000820, emissiveIntensity: 0.8 });
      for (let i = -10; i <= 10; i++) {
        const hLine = new THREE.Mesh(new THREE.BoxGeometry(2000, 1.5, 1), scanMat);
        hLine.position.set(0, i * 50 - 100, -190);
        group.add(hLine);
        const vLine = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1000, 1), scanMat);
        vLine.position.set(i * 100, -100, -190);
        group.add(vLine);
      }

      // Floating low-poly wireframe cubes
      const wireMat = new THREE.MeshStandardMaterial({ color: 0x0066ff, emissive: 0x0033cc, emissiveIntensity: 0.5, wireframe: true });
      const cubePositions = [[-500, 150], [-250, 220], [0, 260], [250, 200], [500, 170]];
      for (const [cx, cy] of cubePositions) {
        const size = 60 + Math.abs(cx % 40);
        const cube = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), wireMat);
        cube.position.set(cx, cy, -160 - Math.abs(cx % 30));
        cube.rotation.set(0.3, 0.5, 0.2);
        group.add(cube);
      }

      // Low-poly pyramids drifting behind the stage
      const pyMat = new THREE.MeshStandardMaterial({ color: 0x440088, emissive: 0x220066, emissiveIntensity: 0.4 });
      for (let p = 0; p < 6; p++) {
        const py = new THREE.Mesh(new THREE.ConeGeometry(25 + p * 8, 50, 4), pyMat);
        py.position.set(-600 + p * 240, -80 + (p % 3) * 60, -175 - p * 5);
        group.add(py);
      }

      // Cyan edge-glow data conduit tubes
      const conduitMat = new THREE.MeshStandardMaterial({ color: 0x00ffee, emissive: 0x00ccbb, emissiveIntensity: 0.9, metalness: 0.1 });
      for (const [cx, cy, cw, ch] of [[-700, 0, 8, 600], [700, 0, 8, 600], [0, -350, 1500, 8]]) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(cw, ch, 6), conduitMat);
        bar.position.set(cx, cy, -155);
        group.add(bar);
      }

      // Data orbs — glowing spheres at conduit intersections
      const orbMat = new THREE.MeshStandardMaterial({ color: 0x00eeff, emissive: 0x00ddee, emissiveIntensity: 1.0 });
      for (const [ox, oy] of [[-700, -350], [700, -350], [-700, 0], [700, 0]]) {
        const orb = new THREE.Mesh(new THREE.SphereGeometry(18, 6, 4), orbMat);
        orb.position.set(ox, oy, -154);
        group.add(orb);
      }
    },
  },

  {
    // Crystal Caverns — underground cave with glowing crystal formations
    id: 'crystalCavern',
    bgColor: 0x0a0a1a,
    buildBackground(group) {
      group.add(skyPlane(0x08081a));

      // Cave ceiling — large dark slab
      const rockMat = new THREE.MeshStandardMaterial({ color: 0x1a1828, roughness: 1 });
      const ceilMat = new THREE.MeshStandardMaterial({ color: 0x111120, roughness: 1 });
      const ceiling = new THREE.Mesh(new THREE.BoxGeometry(2200, 300, 80), ceilMat);
      ceiling.position.set(0, 440, -140);
      group.add(ceiling);

      // Cave walls
      for (const wx of [-1, 1]) {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(300, 1200, 80), rockMat);
        wall.position.set(wx * 950, 0, -140);
        group.add(wall);
      }

      // Stalactites hanging from ceiling
      const stalMat = new THREE.MeshStandardMaterial({ color: 0x2a2840, roughness: 0.9 });
      const stalPositions = [-400, -240, -80, 80, 240, 400];
      for (let i = 0; i < stalPositions.length; i++) {
        const h = 80 + (i * 37 % 80);
        const stalaCtite = new THREE.Mesh(new THREE.ConeGeometry(12 + i % 8, h, 5), stalMat);
        stalaCtite.rotation.z = Math.PI; // point downward
        stalaCtite.position.set(stalPositions[i], 280 + (i % 3) * 20, -120 - i * 8);
        group.add(stalaCtite);
      }

      // Stalagmites rising from floor
      for (let i = 0; i < 5; i++) {
        const stalagMite = new THREE.Mesh(new THREE.ConeGeometry(10 + i % 6, 60 + i * 12, 5), stalMat);
        stalagMite.position.set(-500 + i * 240, -300, -130 - i * 6);
        group.add(stalagMite);
      }

      // Crystal formations — three clusters of glowing spires
      const crystalColors = [
        { col: 0x44ffee, emi: 0x22ccbb },
        { col: 0xff44cc, emi: 0xcc2299 },
        { col: 0x8888ff, emi: 0x5555cc },
        { col: 0x44ff88, emi: 0x22cc55 },
      ];
      const clusterPositions = [[-480, -120], [-200, -80], [200, -100], [480, -130]];
      for (let ci = 0; ci < clusterPositions.length; ci++) {
        const [clx, cly] = clusterPositions[ci];
        const cc = crystalColors[ci % crystalColors.length];
        const cMat = new THREE.MeshStandardMaterial({ color: cc.col, emissive: cc.emi, emissiveIntensity: 0.6, transparent: true, opacity: 0.85 });
        // 3–4 crystal spires per cluster
        for (let s = 0; s < 4; s++) {
          const spire = new THREE.Mesh(new THREE.ConeGeometry(8 + s * 3, 60 + s * 20, 5), cMat);
          spire.rotation.z = (s - 1.5) * 0.15;
          spire.position.set(clx + (s - 1.5) * 22, cly + s * 8, -130 - s * 10);
          group.add(spire);
        }
      }

      // Underground pool glow (flat emissive plane at floor level)
      const poolMat = new THREE.MeshStandardMaterial({ color: 0x004466, emissive: 0x002244, emissiveIntensity: 0.6 });
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(300, 120), poolMat);
      pool.position.set(200, -340, -140);
      group.add(pool);
    },
  },

  {
    // Void Rift — sparse platforms suspended over an infinite dark void
    id: 'voidRift',
    bgColor: 0x000008,
    buildBackground(group) {
      group.add(skyPlane(0x000008));

      // Void abyss gradient (dark purple at bottom)
      const abyssMat = new THREE.MeshStandardMaterial({ color: 0x0a0018, roughness: 1 });
      const abyss = new THREE.Mesh(new THREE.PlaneGeometry(4000, 1200), abyssMat);
      abyss.position.set(0, -400, -198);
      group.add(abyss);

      // Distant void stars / particles
      const starMat = new THREE.MeshStandardMaterial({ color: 0xaabbff, emissive: 0x6677cc, emissiveIntensity: 0.8 });
      for (let i = 0; i < 60; i++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(2 + (i % 3), 3, 2), starMat);
        s.position.set(-900 + (i * 31 % 1800), -400 + (i * 19 % 800), -192 - (i % 4) * 3);
        group.add(s);
      }

      // Central rift portal — large glowing ring
      const riftMat = new THREE.MeshStandardMaterial({ color: 0x6600bb, emissive: 0x4400aa, emissiveIntensity: 0.8 });
      const riftRing = new THREE.Mesh(new THREE.TorusGeometry(180, 12, 8, 24), riftMat);
      riftRing.position.set(0, -60, -182);
      group.add(riftRing);

      // Inner rift glow disc
      const riftCoreMat = new THREE.MeshStandardMaterial({ color: 0x220044, emissive: 0x110033, emissiveIntensity: 0.5 });
      const riftCore = new THREE.Mesh(new THREE.CircleGeometry(168, 24), riftCoreMat);
      riftCore.position.set(0, -60, -183);
      group.add(riftCore);

      // Energy tendrils radiating from rift
      const tendrilMat = new THREE.MeshStandardMaterial({ color: 0x8833ff, emissive: 0x5511cc, emissiveIntensity: 0.7 });
      for (let t = 0; t < 8; t++) {
        const ang = (t / 8) * Math.PI * 2;
        const tendril = new THREE.Mesh(new THREE.BoxGeometry(4, 140, 3), tendrilMat);
        tendril.rotation.z = ang;
        tendril.position.set(Math.cos(ang) * 260, -60 + Math.sin(ang) * 260, -181);
        group.add(tendril);
      }

      // Floating debris / asteroid shards around the stage
      const debrisMat = new THREE.MeshStandardMaterial({ color: 0x1a0a2a, roughness: 1 });
      const debrisPos = [[-650, 120], [-550, -180], [550, 100], [640, -150], [-700, -50], [710, 60]];
      for (const [dx, dy] of debrisPos) {
        const shard = new THREE.Mesh(new THREE.OctahedronGeometry(20 + Math.abs(dx % 20), 0), debrisMat);
        shard.rotation.set(dx % 1.5, dy % 1.5, 0.4);
        shard.position.set(dx, dy, -165 - Math.abs(dy % 20));
        group.add(shard);
      }
    },
  },

  {
    // Solar Pinnacle — mountaintop arena with solar-flare hazard
    id: 'solarPinnacle',
    bgColor: 0xff8c00,
    buildBackground(group) {
      group.add(skyPlane(0xff8c00));

      // Sky gradient — bright orange fading to deep amber at horizon
      const horizMat = new THREE.MeshStandardMaterial({ color: 0xcc4400, roughness: 1 });
      const horiz = new THREE.Mesh(new THREE.PlaneGeometry(4000, 500), horizMat);
      horiz.position.set(0, -380, -198);
      group.add(horiz);

      // Enormous sun
      const sunMat = new THREE.MeshStandardMaterial({ color: 0xffee44, emissive: 0xffcc00, emissiveIntensity: 0.7 });
      const sun = new THREE.Mesh(new THREE.SphereGeometry(220, 10, 8), sunMat);
      sun.position.set(280, 320, -195);
      group.add(sun);

      // Sun corona halo
      const haloMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, emissive: 0xff8800, emissiveIntensity: 0.4, transparent: true, opacity: 0.4 });
      const halo = new THREE.Mesh(new THREE.CircleGeometry(280, 12), haloMat);
      halo.position.set(280, 320, -196);
      group.add(halo);

      // Solar corona rays
      const rayMat = new THREE.MeshStandardMaterial({ color: 0xffcc44, emissive: 0xffaa00, emissiveIntensity: 0.5 });
      for (let r = 0; r < 12; r++) {
        const ang = (r / 12) * Math.PI * 2;
        const len = 120 + (r % 3) * 60;
        const ray = new THREE.Mesh(new THREE.BoxGeometry(7, len, 4), rayMat);
        ray.rotation.z = ang;
        ray.position.set(280 + Math.cos(ang) * (280 + len / 2), 320 + Math.sin(ang) * (280 + len / 2), -193);
        group.add(ray);
      }

      // Mountain peaks flanking the stage
      const rockMat = new THREE.MeshStandardMaterial({ color: 0x8a7040, roughness: 0.95 });
      const snowMat = new THREE.MeshStandardMaterial({ color: 0xeeeedd, roughness: 1 });
      for (const [mx, mh, flip] of [[-700, 500, -1], [-500, 380, -1], [500, 400, 1], [700, 520, 1]]) {
        const peak = new THREE.Mesh(new THREE.ConeGeometry(180, mh, 6), rockMat);
        peak.position.set(mx, -300, -160 - Math.abs(mx % 30));
        group.add(peak);
        // Snow cap
        const cap = new THREE.Mesh(new THREE.ConeGeometry(60, mh * 0.22, 6), snowMat);
        cap.position.set(mx, -300 + mh * 0.39, -159 - Math.abs(mx % 30));
        group.add(cap);
        void flip;
      }

      // High-altitude clouds
      const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffe8cc, transparent: true, opacity: 0.6 });
      for (let c = 0; c < 4; c++) {
        const cloud = new THREE.Mesh(new THREE.SphereGeometry(70 + c * 20, 6, 4), cloudMat);
        cloud.scale.set(2.2, 0.7, 0.6);
        cloud.position.set(-500 + c * 340, 180 + c * 30, -155);
        group.add(cloud);
      }
    },
  },
];

// ---------------------------------------------------------------------------
// Background plane helper
// ---------------------------------------------------------------------------

function skyPlane(color) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0 });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(4000, 2000), mat);
  plane.name = 'background';
  plane.position.set(0, 0, -200);
  return plane;
}

// ---------------------------------------------------------------------------
// Build stage group (background + decorations only; platforms rendered at runtime)
// ---------------------------------------------------------------------------

function buildStage(stageDef) {
  const group = new THREE.Group();
  group.name = `${stageDef.id}_root`;
  stageDef.buildBackground(group);
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
