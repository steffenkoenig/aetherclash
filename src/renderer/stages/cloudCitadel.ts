// src/renderer/stages/cloudCitadel.ts
// Floating castle kingdom in the clouds — pastel fairy-tale.

import * as THREE from 'three';
import { toonMat, basicMat, addPointLight, addMesh } from './shared.js';

export function buildCloudCitadelEnvironment(scene: THREE.Scene): THREE.Group {
  const group = new THREE.Group();
  group.name = 'cloudCitadel_env';
  scene.add(group);

  // ── Sky backdrop ────────────────────────────────────────────────────────────
  addMesh(group, new THREE.PlaneGeometry(8000, 3000), basicMat(0xd8c0ff), 0, 400, -560);
  addMesh(group, new THREE.PlaneGeometry(8000, 2000), basicMat(0xfff0e8), 0, -800, -559);

  // ── Rainbow ────────────────────────────────────────────────────────────────
  const rainbowColors = [0xff4444, 0xff8844, 0xffee44, 0x44ee44, 0x44aaff, 0xaa44ff];
  for (let i = 0; i < 6; i++) {
    addMesh(group, new THREE.TorusGeometry(400 + i * 12, 10 + i * 1, 6, 32, Math.PI),
      basicMat(rainbowColors[i]!, { transparent: true, opacity: 0.7 }),
      -200, -100, -500, 0, 0, 0);
  }

  // ── Large cartoon sun ──────────────────────────────────────────────────────
  addMesh(group, new THREE.CircleGeometry(130, 20),
    basicMat(0xffee44), 550, 500, -450);
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2;
    addMesh(group, new THREE.BoxGeometry(14, 80, 4),
      basicMat(0xffdd22),
      550 + Math.cos(angle) * 170, 500 + Math.sin(angle) * 170, -450,
      0, 0, angle);
  }

  // ── Background castle towers (3 towers) ────────────────────────────────────
  const towerDefs: [number, number, number, number][] = [
    [-550, -150, -320, 0xcc3344],
    [0,    -100, -350, 0x4466cc],
    [550,  -150, -300, 0x44aa44],
  ];
  for (const [tx, ty, tz, roofColor] of towerDefs) {
    addMesh(group, new THREE.CylinderGeometry(60, 70, 500, 8),
      toonMat(0x9090a0), tx, ty, tz);
    addMesh(group, new THREE.ConeGeometry(90, 140, 8),
      toonMat(roofColor), tx, ty + 320, tz);
    // Windows
    for (let w = 0; w < 4; w++) {
      const wa = (w / 4) * Math.PI * 2;
      addMesh(group, new THREE.BoxGeometry(18, 28, 8),
        toonMat(0x3a3050),
        tx + Math.cos(wa) * 58, ty + 50 + w * 60, tz + Math.sin(wa) * 58);
    }
    // Battlements
    for (let b = 0; b < 8; b++) {
      const ba = (b / 8) * Math.PI * 2;
      addMesh(group, new THREE.BoxGeometry(20, 35, 20),
        toonMat(0x8888a0),
        tx + Math.cos(ba) * 65, ty + 275, tz + Math.sin(ba) * 65);
    }
  }

  // ── Castle rear wall section ───────────────────────────────────────────────
  addMesh(group, new THREE.BoxGeometry(600, 400, 40),
    toonMat(0x8a8a9a), 0, -50, -220);
  // Wall trim
  addMesh(group, new THREE.BoxGeometry(600, 15, 50), toonMat(0xa0a0b0), 0, 150, -218);
  addMesh(group, new THREE.BoxGeometry(600, 15, 50), toonMat(0xa0a0b0), 0, -250, -218);

  // ── Dense cloud floor layer ────────────────────────────────────────────────
  const cloudColors = [0xf8f8ff, 0xe8e0ff, 0xe0f0ff, 0xfff0f8];
  const cloudDefs: [number, number, number, number][] = [
    [-900, -160, -200, 120], [-750, -180, -170, 100], [-600, -150, -180, 140],
    [-450, -170, -160, 110], [-300, -160, -140, 130], [-150, -180, -120, 100],
    [0,   -165, -130, 150], [150, -175, -115, 110], [300, -160, -140, 140],
    [450, -170, -155, 110], [600, -150, -175, 130], [750, -180, -165, 100],
    [900, -160, -190, 120],
    [-800, -140, -150, 90],  [-500, -155, -130, 115], [-200, -145, -110, 105],
    [100, -150, -120, 100],  [400, -140, -140, 118],  [700, -158, -160, 95],
    [850, -145, -145, 108],
  ];
  for (let i = 0; i < cloudDefs.length; i++) {
    const [cx, cy, cz, cr] = cloudDefs[i]!;
    const col = cloudColors[i % cloudColors.length]!;
    addMesh(group, new THREE.SphereGeometry(cr, 8, 5),
      toonMat(col), cx, cy, cz, 0, 0, 0, 1.4, 0.55, 1.0);
    addMesh(group, new THREE.SphereGeometry(cr * 0.75, 8, 5),
      toonMat(col), cx + cr * 0.7, cy - 15, cz, 0, 0, 0, 1.3, 0.5, 0.9);
  }

  // ── Closer side towers ─────────────────────────────────────────────────────
  for (const side of [-1, 1]) {
    const stx = side * 700;
    addMesh(group, new THREE.CylinderGeometry(55, 65, 450, 8),
      toonMat(0x9898a8), stx, -130, -60);
    addMesh(group, new THREE.ConeGeometry(80, 130, 8),
      toonMat(side > 0 ? 0xcc4466 : 0x4488cc), stx, 110, -60);
    // Battlements
    for (let b = 0; b < 8; b++) {
      const ba = (b / 8) * Math.PI * 2;
      addMesh(group, new THREE.BoxGeometry(18, 32, 18),
        toonMat(0x8888a8),
        stx + Math.cos(ba) * 58, 250, -60 + Math.sin(ba) * 58);
    }
    // Windows
    for (let w = 0; w < 3; w++) {
      addMesh(group, new THREE.BoxGeometry(16, 26, 6),
        toonMat(0x3030a0),
        stx + side * 52, -60 + w * 80, -30);
    }
  }

  // ── Foreground wispy clouds ────────────────────────────────────────────────
  const fgCloudPos: [number, number, number][] = [
    [-650, 50, +40], [-500, 80, +35], [500, 70, +38], [680, 60, +40],
  ];
  for (const [fx, fy, fz] of fgCloudPos) {
    addMesh(group, new THREE.SphereGeometry(90, 7, 5),
      basicMat(0xffffff, { transparent: true, opacity: 0.5 }),
      fx, fy, fz, 0, 0, 0, 2.0, 0.5, 1.0);
  }

  // ── Lights ─────────────────────────────────────────────────────────────────
  addPointLight(group, 0xfff0aa, 1.5, 0, 600, -400);
  addPointLight(group, 0xffccee, 1.0, 500, 400, -200);

  return group;
}
