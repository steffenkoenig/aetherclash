// src/renderer/stages/crystalCavern.ts
// Vast underground crystal palace, bioluminescent cave.

import * as THREE from 'three';
import { stdMat, basicMat, addPointLight, addMesh } from './shared.js';

export function buildCrystalCavernEnvironment(scene: THREE.Scene): THREE.Group {
  const group = new THREE.Group();
  group.name = 'crystalCavern_env';
  scene.add(group);

  // ── Cave void backdrop ────────────────────────────────────────────────────
  addMesh(group, new THREE.PlaneGeometry(8000, 4000), basicMat(0x04030e), 0, 0, -580);

  // ── Cave ceiling mass ─────────────────────────────────────────────────────
  addMesh(group, new THREE.BoxGeometry(3000, 600, 2000),
    stdMat(0x12101e, { roughness: 0.95 }), 0, 820, -300);
  // Ceiling stalactites
  const stalDefs: [number, number, number, number][] = [
    [-800, -100, 80, 0], [-650, -180, -100, 1], [-400, -120, -200, 2],
    [-200, -150, -80, 0], [0, -160, -300, 1], [200, -130, -150, 2],
    [420, -170, -80, 0], [600, -110, -200, 1], [780, -190, -100, 2],
    [-700, -80, -300, 0], [-300, -100, -400, 1], [100, -90, -350, 2],
    [350, -120, -420, 0], [650, -100, -350, 1], [-100, -200, -50, 2],
    [-500, -150, -50, 0], [500, -130, -50, 1],
  ];
  const stalMats = [
    stdMat(0x1a1a30, { roughness: 0.9 }),
    stdMat(0x141228, { roughness: 0.9 }),
    stdMat(0x181520, { roughness: 0.9 }),
  ];
  for (const [sx, len, sz, mi] of stalDefs) {
    const r = 15 + Math.abs(sx) % 25;
    const h = 80 + Math.abs(len);
    addMesh(group, new THREE.ConeGeometry(r, h, 5),
      stalMats[mi]!, sx, 520, sz, Math.PI, 0, 0);
  }

  // ── Cave side walls ───────────────────────────────────────────────────────
  addMesh(group, new THREE.BoxGeometry(400, 2000, 1500),
    stdMat(0x0e0c1a, { roughness: 0.95 }), -1100, 0, -300);
  addMesh(group, new THREE.BoxGeometry(400, 2000, 1500),
    stdMat(0x0e0c1a, { roughness: 0.95 }),  1100, 0, -300);
  // Wall ledge protrusions
  for (let p = 0; p < 5; p++) {
    addMesh(group, new THREE.BoxGeometry(100, 30, 80),
      stdMat(0x141222, { roughness: 0.9 }), -940, -200 + p * 150, -100 - p * 50);
    addMesh(group, new THREE.BoxGeometry(100, 30, 80),
      stdMat(0x141222, { roughness: 0.9 }),  940, -200 + p * 150, -100 - p * 50);
  }

  // ── Background mega crystal cluster ───────────────────────────────────────
  const bgCrystalColors = [0x44ffee, 0xcc44ff, 0x4488ff, 0x44ff88, 0xff44aa, 0xffee44];
  for (let c = 0; c < 12; c++) {
    const angle = (c / 12) * Math.PI * 2;
    const r = 120 + c * 30;
    const h = 200 + (c % 5) * 80;
    const col = bgCrystalColors[c % bgCrystalColors.length]!;
    addMesh(group, new THREE.ConeGeometry(30 + c % 3 * 15, h, 4),
      stdMat(col, { emissive: col, emissiveIntensity: 0.45 }),
      Math.cos(angle) * r, -300 + h * 0.5, -350,
      (c % 3) * 0.15, angle * 0.3, 0);
  }

  // ── Underground glowing pool ──────────────────────────────────────────────
  addMesh(group, new THREE.BoxGeometry(600, 8, 300),
    stdMat(0x004466, { emissive: 0x004466, emissiveIntensity: 0.8 }), 0, -280, -250);
  // Ripple rings
  for (let r = 0; r < 4; r++) {
    addMesh(group, new THREE.TorusGeometry(60 + r * 40, 4, 4, 16),
      stdMat(0x00aacc, { emissive: 0x00aacc, emissiveIntensity: 0.6, transparent: true, opacity: 0.5 }),
      0, -275, -250, -Math.PI / 2, 0, 0);
  }

  // ── Crystal clusters flanking stage ──────────────────────────────────────
  const clusterDefs: [number, number, number, number[]][] = [
    [-600, -80, -150, [0x44ffee, 0x22ddcc, 0x66ffff]],
    [-350, -70, -80,  [0xcc44ff, 0xaa22ee, 0xee66ff]],
    [350,  -70, -80,  [0x4488ff, 0x2266dd, 0x66aaff]],
    [600,  -80, -150, [0x44ff88, 0x22dd66, 0x66ffaa]],
  ];
  for (const [cx, cy, cz, colors] of clusterDefs) {
    for (let c = 0; c < 7; c++) {
      const angle = (c / 7) * Math.PI * 2;
      const offset = c * 14;
      const h = 60 + offset;
      const col = colors[c % colors.length]!;
      addMesh(group, new THREE.ConeGeometry(12 + c % 3 * 6, h, 4),
        stdMat(col, { emissive: col, emissiveIntensity: 0.5 }),
        cx + Math.cos(angle) * 30, cy + h * 0.5, cz + Math.sin(angle) * 25,
        (c % 3) * 0.15, angle, 0);
    }
    // Mini point light per cluster
    const clusterLight = new THREE.PointLight(colors[0]!, 1.2, 250);
    clusterLight.position.set(cx, cy + 50, cz);
    group.add(clusterLight);
  }

  // ── Rock floor ────────────────────────────────────────────────────────────
  addMesh(group, new THREE.BoxGeometry(2400, 40, 700),
    stdMat(0x0e0c1a, { roughness: 0.95 }), 0, -100, -50);
  // Crystal veins in floor
  const veinColors = [0x00aacc, 0x8844ff, 0x44ffcc];
  for (let v = 0; v < 12; v++) {
    const vCol = veinColors[v % 3]!;
    addMesh(group, new THREE.BoxGeometry(2400, 2, 2),
      stdMat(vCol, { emissive: vCol, emissiveIntensity: 0.5 }),
      0, -79, -350 + v * 56);
  }

  // ── Foreground stalactites from above ─────────────────────────────────────
  for (let s = 0; s < 5; s++) {
    const fx = -600 + s * 300;
    addMesh(group, new THREE.ConeGeometry(18 + s * 4, 100 + s * 20, 5),
      stdMat(0x1a1830, { roughness: 0.9 }), fx, 620, +40, Math.PI, 0, 0);
  }

  // ── Foreground crystal shards ──────────────────────────────────────────────
  const fgShardDefs: [number, number, number, number][] = [
    [-680, -80, +40, 0x44ffee], [-520, -70, +35, 0xcc44ff],
    [520, -70, +35, 0x4488ff], [680, -80, +40, 0x44ff88],
  ];
  for (const [fx, fy, fz, col] of fgShardDefs) {
    for (let c = 0; c < 4; c++) {
      addMesh(group, new THREE.ConeGeometry(10 + c * 4, 50 + c * 20, 4),
        stdMat(col, { emissive: col, emissiveIntensity: 0.4 }),
        fx + c * 18, fy + 25 + c * 10, fz + c * 5, c * 0.2, c * 0.5, 0);
    }
  }

  // ── Lights ─────────────────────────────────────────────────────────────────
  addPointLight(group, 0x44ffcc, 2.0, -400, 100, -120, 600);
  addPointLight(group, 0x44ffcc, 1.5,  400, -100, -200, 600);
  addPointLight(group, 0xaa22ff, 1.5,   0, 200, -300, 500);
  addPointLight(group, 0x2244ff, 1.0, -600, -50, -100, 400);

  return group;
}
