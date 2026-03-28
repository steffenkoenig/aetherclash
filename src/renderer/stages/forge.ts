// src/renderer/stages/forge.ts
// Interior of a massive deep-space cargo ship.

import * as THREE from 'three';
import { stdMat, basicMat, addPointLight, addMesh } from './shared.js';

export function buildForgeEnvironment(scene: THREE.Scene): THREE.Group {
  const group = new THREE.Group();
  group.name = 'forge_env';
  scene.add(group);

  // ── Deep space backdrop ────────────────────────────────────────────────────
  addMesh(group, new THREE.PlaneGeometry(8000, 4000), basicMat(0x010108), 0, 0, -580);

  // ── Stars ─────────────────────────────────────────────────────────────────
  const starMat = stdMat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 1 });
  for (let i = 0; i < 80; i++) {
    const sr = 2 + Math.random() * 2;
    const sx = (Math.random() - 0.5) * 2400;
    const sy = (Math.random() - 0.5) * 900;
    addMesh(group, new THREE.SphereGeometry(sr, 4, 4), starMat, sx, sy, -520);
  }

  // ── Distant planet ────────────────────────────────────────────────────────
  addMesh(group, new THREE.SphereGeometry(280, 24, 18),
    stdMat(0x3a5060, { emissive: 0x0a2030, emissiveIntensity: 0.3 }),
    700, -100, -380);
  // Atmosphere rim
  addMesh(group, new THREE.SphereGeometry(295, 24, 18),
    stdMat(0x4488aa, { emissive: 0x2266aa, emissiveIntensity: 0.4, transparent: true, opacity: 0.35 }),
    700, -100, -380);

  // ── Rear bulkhead wall ─────────────────────────────────────────────────────
  addMesh(group, new THREE.BoxGeometry(2400, 1400, 60),
    stdMat(0x1a2530, { metalness: 0.6, roughness: 0.4 }), 0, 0, -300);
  // Rivet seam strips across the wall
  for (let i = 0; i < 12; i++) {
    addMesh(group, new THREE.BoxGeometry(2400, 6, 8),
      stdMat(0x0e1820, { metalness: 0.8, roughness: 0.3 }),
      0, -560 + i * 100, -268);
  }
  // Viewport window
  addMesh(group, new THREE.CircleGeometry(140, 24),
    stdMat(0x0044aa, { emissive: 0x0033cc, emissiveIntensity: 0.6 }),
    0, 160, -268);
  addMesh(group, new THREE.RingGeometry(138, 158, 24),
    stdMat(0x304050, { metalness: 0.7, roughness: 0.3 }), 0, 160, -267);

  // ── Side hull walls ────────────────────────────────────────────────────────
  for (const side of [-1, 1]) {
    const wx = side * 1000;
    addMesh(group, new THREE.BoxGeometry(200, 1400, 600),
      stdMat(0x182030, { metalness: 0.6, roughness: 0.5 }), wx, 0, -150);
    // Pipe conduits on walls
    for (let p = 0; p < 4; p++) {
      addMesh(group, new THREE.BoxGeometry(8, 1400, 8),
        stdMat(0x2a3840, { metalness: 0.7, roughness: 0.4 }),
        wx + side * (-60 + p * 20), 0, -50 + p * 30);
    }
    // Warning stripe panels
    for (let w = 0; w < 5; w++) {
      addMesh(group, new THREE.BoxGeometry(200, 40, 4),
        stdMat(w % 2 === 0 ? 0xffcc00 : 0x1a1a1a),
        wx, -300 + w * 120, -50);
    }
  }

  // ── Industrial ceiling ─────────────────────────────────────────────────────
  addMesh(group, new THREE.BoxGeometry(2200, 80, 800),
    stdMat(0x0e1820, { metalness: 0.7, roughness: 0.4 }), 0, 700, -160);
  // Structural ribs
  for (let r = 0; r < 8; r++) {
    addMesh(group, new THREE.BoxGeometry(2200, 8, 8),
      stdMat(0x2a3844, { metalness: 0.8, roughness: 0.3 }),
      0, 662, -360 + r * 80);
  }
  // Ceiling light strips
  for (let l = 0; l < 5; l++) {
    addMesh(group, new THREE.BoxGeometry(2200, 6, 6),
      stdMat(0xff6600, { emissive: 0xff4400, emissiveIntensity: 0.8 }),
      0, 658, -160 + l * 60);
  }

  // ── Cargo containers ──────────────────────────────────────────────────────
  const contPos: [number, number, number, number][] = [
    [-500, -120, -80, 0x1e2e3a],
    [-300, -120, -70, 0x182838],
    [300, -120, -75, 0x1a2c36],
    [500, -120, -80, 0x1c2e3e],
  ];
  for (const [cx, cy, cz, col] of contPos) {
    addMesh(group, new THREE.BoxGeometry(160, 180, 160),
      stdMat(col, { metalness: 0.5, roughness: 0.6 }), cx, cy, cz);
    // Warning stripes on container face
    for (let s = 0; s < 3; s++) {
      addMesh(group, new THREE.BoxGeometry(160, 18, 4),
        stdMat(s % 2 === 0 ? 0xffcc00 : 0x111111),
        cx, cy - 40 + s * 40, cz + 82);
    }
  }

  // ── Metal grating floor ────────────────────────────────────────────────────
  addMesh(group, new THREE.BoxGeometry(2000, 20, 600),
    stdMat(0x1e2c38, { metalness: 0.6, roughness: 0.5 }), 0, -200, -100);
  // Floor grating ribs
  for (let g = 0; g < 25; g++) {
    addMesh(group, new THREE.BoxGeometry(2000, 4, 4),
      stdMat(0x283848, { metalness: 0.7, roughness: 0.4 }),
      0, -189, -370 + g * 25);
  }
  for (let g = 0; g < 20; g++) {
    addMesh(group, new THREE.BoxGeometry(4, 4, 600),
      stdMat(0x283848, { metalness: 0.7, roughness: 0.4 }),
      -1000 + g * 100, -189, -100);
  }

  // ── Industrial crane arms ─────────────────────────────────────────────────
  for (const side of [-1, 1]) {
    const cx = side * 600;
    addMesh(group, new THREE.BoxGeometry(20, 400, 20),
      stdMat(0x2a3a4a, { metalness: 0.65, roughness: 0.45 }), cx, 300, +20);
    addMesh(group, new THREE.BoxGeometry(200, 16, 16),
      stdMat(0x2a3a4a, { metalness: 0.65, roughness: 0.45 }), cx + side * 100, 500, +20);
    // Cable
    addMesh(group, new THREE.BoxGeometry(4, 120, 4),
      stdMat(0x4a5a6a, { metalness: 0.8 }), cx + side * 180, 440, +20);
  }

  // ── Lights ─────────────────────────────────────────────────────────────────
  addPointLight(group, 0xff4400, 2.5, -350, 300, -80, 400);
  addPointLight(group, 0xff4400, 2.5,  350, 300, -80, 400);
  addPointLight(group, 0xff5500, 1.8, -600, 400, -150, 400);
  addPointLight(group, 0xff5500, 1.8,  600, 400, -150, 400);

  return group;
}
