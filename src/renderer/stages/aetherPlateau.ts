// src/renderer/stages/aetherPlateau.ts
// Floating grassy stone island in warm afternoon sky.

import * as THREE from 'three';
import { stdMat, toonMat, basicMat, addPointLight, addMesh } from './shared.js';

export function buildAetherPlateauEnvironment(scene: THREE.Scene): THREE.Group {
  const group = new THREE.Group();
  group.name = 'aetherPlateau_env';
  scene.add(group);

  // ── Far sky backdrop ────────────────────────────────────────────────────────
  addMesh(group, new THREE.PlaneGeometry(8000, 4000), basicMat(0x7ec8e3), 0, 0, -550);
  addMesh(group, new THREE.PlaneGeometry(8000, 1200), basicMat(0xffd580), 0, -1800, -549);

  // ── Sun ────────────────────────────────────────────────────────────────────
  addMesh(group, new THREE.SphereGeometry(160, 16, 12),
    stdMat(0xffee44, { emissive: 0xffcc00, emissiveIntensity: 0.9 }),
    -700, 600, -480);
  // Corona rays
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    addMesh(group, new THREE.BoxGeometry(24, 200, 8),
      stdMat(0xffee44, { emissive: 0xffdd00, emissiveIntensity: 0.7 }),
      -700 + Math.cos(angle) * 210, 600 + Math.sin(angle) * 210, -480,
      0, 0, angle);
  }

  // ── Distant mountains ──────────────────────────────────────────────────────
  const mtPositions: [number, number][] = [[-900, -350], [-500, -350], [500, -350], [900, -350]];
  for (const [mx, my] of mtPositions) {
    addMesh(group, new THREE.ConeGeometry(250, 600, 6),
      toonMat(0x4a5870), mx, my, -400);
  }

  // ── Cloud puffs ────────────────────────────────────────────────────────────
  const cloudPos: [number, number, number][] = [
    [-700, 300, -350], [-350, 330, -300], [0, 320, -280],
    [400, 310, -250], [750, 340, -320], [-600, 250, -200],
    [250, 260, -180], [600, 270, -150],
  ];
  for (const [cx, cy, cz] of cloudPos) {
    addMesh(group, new THREE.SphereGeometry(80 + Math.random() * 60, 8, 6),
      basicMat(0xffffff, { transparent: true, opacity: 0.85 }),
      cx, cy, cz, 0, 0, 0, 2.5, 0.6, 1.0);
    addMesh(group, new THREE.SphereGeometry(60 + Math.random() * 40, 8, 6),
      basicMat(0xfff4e0, { transparent: true, opacity: 0.75 }),
      cx + 80, cy - 20, cz, 0, 0, 0, 2.0, 0.55, 0.9);
  }

  // ── Background tree line ───────────────────────────────────────────────────
  for (let i = 0; i < 10; i++) {
    const tx = -800 + i * 160 + (i % 3 === 0 ? 40 : 0);
    const ty = -200;
    const tz = -200;
    addMesh(group, new THREE.CylinderGeometry(10, 14, 120, 6),
      toonMat(0x5a3a20), tx, ty - 20, tz);
    addMesh(group, new THREE.SphereGeometry(60 + (i % 3) * 20, 8, 7),
      toonMat(0x2a5a18), tx, ty + 60, tz, 0, 0, 0, 1, 0.9, 1);
  }

  // ── Ancient ruin columns ───────────────────────────────────────────────────
  const colPositions = [-550, -350, 350, 550];
  for (const cpx of colPositions) {
    addMesh(group, new THREE.CylinderGeometry(22, 28, 200, 8),
      toonMat(0x8a7a60), cpx, -100, -120);
    // Crumbled top slab
    addMesh(group, new THREE.BoxGeometry(60, 18, 60),
      toonMat(0x7a6a50), cpx + 5, 2, -120, 0.1, 0, 0.05);
  }

  // ── Main floating island ───────────────────────────────────────────────────
  // Stone body
  addMesh(group, new THREE.BoxGeometry(1800, 200, 500),
    toonMat(0x9a8060), 0, -220, -100);
  // Grassy top
  addMesh(group, new THREE.BoxGeometry(1820, 25, 510),
    toonMat(0x5a9c30), 0, -115, -100);
  // Dark earth underside
  addMesh(group, new THREE.BoxGeometry(1800, 40, 500),
    toonMat(0x4a3818), 0, -310, -100);
  // Hanging stalactites below island
  const stalPos: [number, number][] = [[-500, -330], [-200, -340], [200, -340], [500, -330]];
  for (const [sx, _] of stalPos) {
    addMesh(group, new THREE.ConeGeometry(30, 100, 6),
      toonMat(0x6a5040), sx, -380, -100, Math.PI, 0, 0);
  }
  // Grass tufts along top
  for (let i = -8; i <= 8; i++) {
    addMesh(group, new THREE.BoxGeometry(25, 18, 20),
      toonMat(0x78c040), i * 105, -106, -90, -0.15, 0, 0);
  }

  // ── Foreground trees ──────────────────────────────────────────────────────
  const fgTreePos: [number, number, number][] = [
    [-600, -65, +30], [-400, -70, +20], [-280, -60, +15],
    [280, -60, +15], [420, -68, +25], [620, -65, +30],
  ];
  for (const [tx, ty, tz] of fgTreePos) {
    const trunkH = 80 + Math.abs(tx) % 30;
    addMesh(group, new THREE.CylinderGeometry(8, 12, trunkH, 7),
      toonMat(0x6b4020), tx, ty - trunkH / 2 + 10, tz);
    addMesh(group, new THREE.SphereGeometry(40 + Math.abs(tx) % 20, 8, 7),
      toonMat(0x3a8a28), tx, ty + 24, tz);
    addMesh(group, new THREE.SphereGeometry(28, 8, 6),
      toonMat(0x4a9c32), tx + 20, ty + 38, tz - 5);
  }

  // ── Foreground rocks ──────────────────────────────────────────────────────
  const rockPos: [number, number, number][] = [
    [-650, -90, 60], [-480, -82, 55], [500, -85, 58], [670, -88, 60],
  ];
  for (const [rx, ry, rz] of rockPos) {
    addMesh(group, new THREE.SphereGeometry(28 + Math.abs(rx) % 12, 7, 6),
      toonMat(0x7a6848), rx, ry, rz, 0.2, 0.3, 0.1, 1.4, 0.8, 1.1);
  }

  // ── Lights ────────────────────────────────────────────────────────────────
  addPointLight(group, 0xffee88, 1.5, -600, 400, -400);
  addPointLight(group, 0xffd060, 1.2, 500, 300, -300);

  return group;
}
