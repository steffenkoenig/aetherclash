// src/renderer/stages/ancientRuin.ts
// Stone temple overgrown with forest, ancient clockwork machinery.

import * as THREE from 'three';
import { stdMat, toonMat, basicMat, addPointLight, addMesh } from './shared.js';

export function buildAncientRuinEnvironment(scene: THREE.Scene): THREE.Group {
  const group = new THREE.Group();
  group.name = 'ancientRuin_env';
  scene.add(group);

  // ── Forest sky backdrop ────────────────────────────────────────────────────
  addMesh(group, new THREE.PlaneGeometry(8000, 4000), basicMat(0x1a2010), 0, 0, -560);

  // ── Deep background forest tree wall ──────────────────────────────────────
  for (let i = 0; i < 20; i++) {
    const tx = -900 + i * 90 + (i % 4) * 10;
    const trunkH = 400 + (i % 5) * 40;
    addMesh(group, new THREE.CylinderGeometry(20, 30, trunkH, 7),
      toonMat(0x2a1a0a), tx, -300 + trunkH * 0.5, -480);
    addMesh(group, new THREE.SphereGeometry(130 + (i % 4) * 30, 8, 6),
      toonMat(0x1a3a10), tx, -300 + trunkH + 80, -480,
      0, 0, 0, 1.6, 0.8, 1.2);
  }

  // ── Temple archway ─────────────────────────────────────────────────────────
  // Left and right pillars
  addMesh(group, new THREE.CylinderGeometry(40, 50, 300, 8),
    toonMat(0x7a6a50), -160, -50, -350);
  addMesh(group, new THREE.CylinderGeometry(40, 50, 300, 8),
    toonMat(0x7a6a50), 160, -50, -350);
  // Lintel
  addMesh(group, new THREE.BoxGeometry(380, 60, 80),
    toonMat(0x7a6a50), 0, 110, -350);
  // Carved face block clusters
  addMesh(group, new THREE.BoxGeometry(80, 60, 40), toonMat(0x6a5a40), 0, 90, -310);
  addMesh(group, new THREE.BoxGeometry(40, 30, 30), toonMat(0x5a4a30), -20, 110, -310);
  addMesh(group, new THREE.BoxGeometry(40, 30, 30), toonMat(0x5a4a30), 20, 105, -310);

  // ── Giant gear ─────────────────────────────────────────────────────────────
  addMesh(group, new THREE.CylinderGeometry(180, 180, 25, 8),
    stdMat(0x4a4030, { metalness: 0.3, roughness: 0.7 }), 0, 200, -280);
  // Gear teeth
  for (let t = 0; t < 8; t++) {
    const angle = (t / 8) * Math.PI * 2;
    addMesh(group, new THREE.CylinderGeometry(20, 20, 30, 6),
      stdMat(0x4a4030, { metalness: 0.3, roughness: 0.7 }),
      Math.cos(angle) * 190, 200 + Math.sin(angle) * 190, -280);
  }
  // Gear center hub
  addMesh(group, new THREE.CylinderGeometry(40, 40, 35, 8),
    stdMat(0x5a5040, { metalness: 0.4, roughness: 0.6 }), 0, 200, -278);

  // ── Ruined flanking columns ────────────────────────────────────────────────
  const colDefs: [number, number][] = [[-550, -200], [-400, -200], [-250, -200], [250, -200], [400, -200], [550, -200]];
  for (const [cx, cz] of colDefs) {
    addMesh(group, new THREE.CylinderGeometry(28, 35, 250, 8),
      toonMat(0x7a6a50), cx, -100, cz);
    // Crumbled top
    addMesh(group, new THREE.BoxGeometry(65, 28, 65),
      toonMat(0x6a5a40), cx + 8, 30, cz - 5, 0.2, 0, 0.1);
    // Moss overlay
    addMesh(group, new THREE.BoxGeometry(32, 250, 5),
      stdMat(0x2a4a18, { transparent: true, opacity: 0.6 }), cx, -100, cz + 18);
  }

  // ── Stone floor ────────────────────────────────────────────────────────────
  addMesh(group, new THREE.BoxGeometry(2200, 30, 700),
    toonMat(0x6a5c44), 0, -90, -120);
  // Floor crack lines
  for (let c = 0; c < 8; c++) {
    addMesh(group, new THREE.BoxGeometry(2, 700, 4),
      toonMat(0x3a2c1c), -800 + c * 220, -73, -120);
  }
  for (let c = 0; c < 5; c++) {
    addMesh(group, new THREE.BoxGeometry(2200, 2, 4),
      toonMat(0x3a2c1c), 0, -73, -420 + c * 140);
  }

  // ── Vine curtains ─────────────────────────────────────────────────────────
  for (let v = 0; v < 12; v++) {
    const vx = -500 + v * 90;
    addMesh(group, new THREE.BoxGeometry(5, 150, 3),
      stdMat(0x2a5018, { transparent: true, opacity: 0.7 }),
      vx, 0, -60 + (v % 3) * 10);
  }

  // ── Stone rubble piles ────────────────────────────────────────────────────
  const rubblePos: [number, number, number][] = [
    [-620, -90, -50], [-400, -88, -45], [420, -88, -48], [640, -90, -50],
  ];
  for (const [rx, ry, rz] of rubblePos) {
    for (let r = 0; r < 5; r++) {
      addMesh(group, new THREE.BoxGeometry(20 + r * 8, 16 + r * 4, 18 + r * 6),
        toonMat(0x6a5a44),
        rx + (r % 3) * 18 - 18, ry + r * 4, rz + (r % 2) * 12,
        r * 0.2, r * 0.15, r * 0.1);
    }
  }

  // ── Foreground ferns and grass ────────────────────────────────────────────
  for (let f = 0; f < 16; f++) {
    const fx = -720 + f * 96;
    addMesh(group, new THREE.SphereGeometry(20 + f % 4 * 5, 6, 4),
      stdMat(0x2a5518, { transparent: true, opacity: 0.8 }),
      fx, -75, +40, 0, 0, 0, 2.5, 0.4, 1.0);
  }

  // ── Large foreground tree trunks framing stage ────────────────────────────
  for (const side of [-1, 1]) {
    const ftx = side * 650;
    addMesh(group, new THREE.CylinderGeometry(22, 30, 350, 7),
      toonMat(0x3a2010), ftx, 0, +60, 0, 0, side * 0.08);
    addMesh(group, new THREE.CylinderGeometry(16, 22, 200, 6),
      toonMat(0x3a2010), ftx + side * 20, 280, +55, side * 0.15, 0, 0);
  }

  // ── Lights ─────────────────────────────────────────────────────────────────
  addPointLight(group, 0xffa040, 2.0, 0, 350, -200, 500);
  addPointLight(group, 0x40aa20, 0.8, -400, 100, -100, 400);

  return group;
}
