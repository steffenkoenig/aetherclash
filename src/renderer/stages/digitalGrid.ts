// src/renderer/stages/digitalGrid.ts
// Interior of a vast data core — neon cyberpunk, infinite grid.

import * as THREE from 'three';
import { stdMat, basicMat, addPointLight, addMesh } from './shared.js';

export function buildDigitalGridEnvironment(scene: THREE.Scene): THREE.Group {
  const group = new THREE.Group();
  group.name = 'digitalGrid_env';
  scene.add(group);

  // ── Void backdrop ──────────────────────────────────────────────────────────
  addMesh(group, new THREE.PlaneGeometry(8000, 4000), basicMat(0x010208), 0, 0, -580);

  // ── Grid floor ────────────────────────────────────────────────────────────
  addMesh(group, new THREE.PlaneGeometry(3000, 1200),
    stdMat(0x030612, { roughness: 1.0 }),
    0, -180, -280, -Math.PI / 2, 0, 0);

  // Grid horizontal bars (representing rows receding into depth)
  for (let i = 0; i < 25; i++) {
    const bz = -80 - i * 48 + i * i * 0.4; // converging perspective spacing
    addMesh(group, new THREE.BoxGeometry(3000, 2, 2),
      stdMat(0x00ccee, { emissive: 0x00ccee, emissiveIntensity: 0.8 }),
      0, -179, bz);
  }
  // Grid vertical bars
  for (let i = 0; i < 20; i++) {
    const bx = -1000 + i * 105 + (i > 10 ? (i - 10) * 5 : 0);
    addMesh(group, new THREE.BoxGeometry(2, 2, 1200),
      stdMat(0x00ccee, { emissive: 0x00ccee, emissiveIntensity: 0.8 }),
      bx, -179, -280);
  }

  // ── Server tower stacks ────────────────────────────────────────────────────
  const towerX = [-720, -500, -280, 280, 500, 720];
  for (let i = 0; i < towerX.length; i++) {
    const tx = towerX[i]!;
    const tz = -200 - (i % 3) * 60;
    addMesh(group, new THREE.BoxGeometry(120, 900, 80),
      stdMat(0x0a0c18, { metalness: 0.3, roughness: 0.7 }), tx, 0, tz);
    // Glowing data ports
    for (let p = 0; p < 12; p++) {
      const portColor = p % 3 === 0 ? 0x00aaff : (p % 3 === 1 ? 0x0044ff : 0x00ffee);
      addMesh(group, new THREE.BoxGeometry(16, 6, 4),
        stdMat(portColor, { emissive: portColor, emissiveIntensity: 0.9 }),
        tx, -380 + p * 70, tz + 42);
    }
    // Side trim
    addMesh(group, new THREE.BoxGeometry(4, 900, 80),
      stdMat(0x00ccee, { emissive: 0x00aacc, emissiveIntensity: 0.4 }),
      tx + 62, 0, tz);
    addMesh(group, new THREE.BoxGeometry(4, 900, 80),
      stdMat(0x00ccee, { emissive: 0x00aacc, emissiveIntensity: 0.4 }),
      tx - 62, 0, tz);
  }

  // ── Holographic display panels ─────────────────────────────────────────────
  const panelDefs: [number, number][] = [[-500, 300], [-200, 250], [200, 280], [500, 260]];
  for (const [px, py] of panelDefs) {
    addMesh(group, new THREE.BoxGeometry(180, 240, 4),
      stdMat(0x2200aa, { emissive: 0x4400ff, emissiveIntensity: 0.5, transparent: true, opacity: 0.55 }),
      px, py, -300);
    // Panel frame
    addMesh(group, new THREE.BoxGeometry(190, 8, 6),
      stdMat(0x00ccee, { emissive: 0x00aacc, emissiveIntensity: 0.7 }), px, py + 124, -298);
    addMesh(group, new THREE.BoxGeometry(190, 8, 6),
      stdMat(0x00ccee, { emissive: 0x00aacc, emissiveIntensity: 0.7 }), px, py - 124, -298);
    // Panel scan lines
    for (let sl = 0; sl < 8; sl++) {
      addMesh(group, new THREE.BoxGeometry(160, 2, 2),
        stdMat(0x00eeff, { emissive: 0x00eeff, emissiveIntensity: 0.6 }),
        px, py - 100 + sl * 28, -297);
    }
  }

  // ── Neon conduit tubes ─────────────────────────────────────────────────────
  for (const side of [-1, 1]) {
    addMesh(group, new THREE.BoxGeometry(8, 600, 8),
      stdMat(0x00ffee, { emissive: 0x00ffee, emissiveIntensity: 1.0 }), side * 700, 0, -200);
  }
  addMesh(group, new THREE.BoxGeometry(1500, 8, 8),
    stdMat(0x00ffee, { emissive: 0x00ffee, emissiveIntensity: 1.0 }), 0, -200, -200);
  addMesh(group, new THREE.BoxGeometry(1500, 8, 8),
    stdMat(0x00ffee, { emissive: 0x00ffee, emissiveIntensity: 1.0 }), 0, 400, -200);
  // Horizontal accent strips
  addMesh(group, new THREE.BoxGeometry(2000, 4, 4),
    stdMat(0x0044ff, { emissive: 0x0044ff, emissiveIntensity: 0.8 }), 0, 0, -200);

  // ── Wireframe floating shapes ──────────────────────────────────────────────
  addMesh(group, new THREE.BoxGeometry(80, 80, 80),
    basicMat(0x00ccee, { wireframe: true }), -350, 350, -120, 0.3, 0.5, 0.2);
  addMesh(group, new THREE.BoxGeometry(60, 60, 60),
    basicMat(0x4400ff, { wireframe: true }), 300, 420, -140, 0.2, 0.4, 0.1);
  addMesh(group, new THREE.ConeGeometry(40, 80, 8),
    basicMat(0x00ffaa, { wireframe: true }), 550, 280, -110, 0.1, 0.3, 0.1);
  addMesh(group, new THREE.OctahedronGeometry(50, 0),
    basicMat(0x8800ff, { wireframe: true }), -500, 360, -115, 0.2, 0.6, 0.3);

  // ── Foreground data stream pillars ─────────────────────────────────────────
  for (const side of [-1, 1]) {
    const px = side * 500;
    for (let seg = 0; seg < 14; seg++) {
      const alpha = 1.0 - seg * 0.06;
      addMesh(group, new THREE.BoxGeometry(10, 28, 8),
        stdMat(0x00ffaa, { emissive: 0x00ffaa, emissiveIntensity: alpha, transparent: true, opacity: alpha }),
        px, 340 - seg * 50, +20);
    }
  }

  // ── Lights ─────────────────────────────────────────────────────────────────
  addPointLight(group, 0x00ffee, 2.5, -500, 300, -150, 600);
  addPointLight(group, 0x00ffee, 2.5,  500, 200, -200, 600);
  addPointLight(group, 0x0044ff, 1.5,  0, 500, -300, 400);

  return group;
}
