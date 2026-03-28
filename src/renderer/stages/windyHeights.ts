// src/renderer/stages/windyHeights.ts
// Windy Heights — a bright, cheerful floating meadow high above the clouds.
//
// Visual style: vivid N64-era cartoon colours, a wide grassy island, a large
// gnarled tree on the left flank (the source of the wind), rolling cloud layers
// below, and a warm blue sky with cartoon puffs above.

import * as THREE from 'three';
import { toonMat, basicMat, addPointLight, addMesh } from './shared.js';

export function buildWindyHeightsEnvironment(scene: THREE.Scene): THREE.Group {
  const group = new THREE.Group();
  group.name = 'windyHeights_env';
  scene.add(group);

  // ── Sky backdrop ────────────────────────────────────────────────────────────
  addMesh(group, new THREE.PlaneGeometry(8000, 4000), basicMat(0x5ec8f0), 0, 200, -560);
  // Horizon band — lighter near the bottom
  addMesh(group, new THREE.PlaneGeometry(8000, 1000), basicMat(0xa8e4f8), 0, -1200, -558);

  // ── Cartoon sun ─────────────────────────────────────────────────────────────
  addMesh(group, new THREE.CircleGeometry(120, 20), basicMat(0xffee44), 560, 540, -460);
  // Sun rays
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    addMesh(group, new THREE.BoxGeometry(12, 70, 4),
      basicMat(0xffdd22),
      560 + Math.cos(a) * 160, 540 + Math.sin(a) * 160, -460,
      0, 0, a);
  }
  // Cheerful face
  addMesh(group, new THREE.CircleGeometry(18, 10), basicMat(0xcc8800), 530, 555, -459);
  addMesh(group, new THREE.CircleGeometry(18, 10), basicMat(0xcc8800), 580, 555, -459);
  addMesh(group, new THREE.BoxGeometry(50, 10, 4),  basicMat(0xcc8800), 557, 520, -459);

  // ── Distant rolling hills ────────────────────────────────────────────────────
  const hillDefs: [number, number, number, number][] = [
    [-900, -280, -420, 220], [-600, -300, -400, 190], [-300, -270, -380, 240],
    [0,   -290, -390, 200],  [300, -270, -380, 230],  [600, -300, -400, 195],
    [900, -280, -420, 215],
  ];
  for (const [hx, hy, hz, hr] of hillDefs) {
    addMesh(group, new THREE.SphereGeometry(hr, 10, 6),
      toonMat(0x4aaa28), hx, hy, hz, 0, 0, 0, 1.6, 0.5, 1.0);
  }

  // ── Background sky clouds ───────────────────────────────────────────────────
  const bgCloudPos: [number, number, number][] = [
    [-700, 280, -380], [-450, 310, -360], [-150, 295, -340],
    [200, 300, -350],  [480, 280, -370],  [740, 310, -360],
  ];
  for (const [cx, cy, cz] of bgCloudPos) {
    for (let p = 0; p < 3; p++) {
      addMesh(group, new THREE.SphereGeometry(60 + p * 15, 8, 5),
        basicMat(0xffffff, { transparent: true, opacity: 0.8 }),
        cx + p * 55, cy - p * 8, cz, 0, 0, 0, 1.4, 0.6, 1.0);
    }
  }

  // ── Main grassy island ──────────────────────────────────────────────────────
  // Stone body
  addMesh(group, new THREE.BoxGeometry(1900, 180, 480),
    toonMat(0x8a7050), 0, -210, -100);
  // Grassy top layer
  addMesh(group, new THREE.BoxGeometry(1920, 22, 490),
    toonMat(0x5cb830), 0, -122, -100);
  // Dark earth base
  addMesh(group, new THREE.BoxGeometry(1900, 38, 480),
    toonMat(0x4a3010), 0, -298, -100);
  // Hanging roots / stalactites below
  const rootsX = [-600, -300, 0, 300, 600];
  for (const rx of rootsX) {
    addMesh(group, new THREE.ConeGeometry(16, 70, 5),
      toonMat(0x4a3010), rx, -340, -100, Math.PI, 0, 0);
  }
  // Grass tufts along the top surface
  for (let i = -9; i <= 9; i++) {
    const hue = i % 2 === 0 ? 0x6dd840 : 0x5cb830;
    addMesh(group, new THREE.BoxGeometry(22, 16, 18),
      toonMat(hue), i * 105, -113, -88, -0.12, 0, 0);
  }

  // ── Colourful wildflowers scattered on the island ───────────────────────────
  const flowerColors = [0xff4488, 0xffcc00, 0xff6622, 0xaa44ff, 0x44ddff];
  const flowerX = [-700, -550, -400, -250, -100, 100, 250, 400, 550, 720];
  for (let fi = 0; fi < flowerX.length; fi++) {
    const fc = flowerColors[fi % flowerColors.length]!;
    // Stem
    addMesh(group, new THREE.CylinderGeometry(3, 3, 26, 5),
      toonMat(0x3a8a28), flowerX[fi]!, -107, -72, 0, 0, 0);
    // Bloom
    addMesh(group, new THREE.SphereGeometry(12, 7, 5),
      toonMat(fc), flowerX[fi]!, -90, -72);
  }

  // ── The great Gale Tree (left flank — source of the wind gusts) ─────────────
  // Main trunk
  addMesh(group, new THREE.CylinderGeometry(28, 40, 380, 7),
    toonMat(0x5a3010), -660, 80, +50, 0, 0, 0.05);
  // Branch 1 (right sweep)
  addMesh(group, new THREE.CylinderGeometry(12, 20, 180, 6),
    toonMat(0x5a3010), -600, 230, +40, 0, 0, -0.5);
  // Branch 2 (left lean)
  addMesh(group, new THREE.CylinderGeometry(10, 18, 150, 6),
    toonMat(0x5a3010), -740, 200, +35, 0, 0, 0.4);
  // Foliage canopy layers
  const foliageDefs: [number, number, number, number][] = [
    [-640, 300, 50, 120], [-720, 280, 40, 100], [-600, 330, 45, 110],
    [-660, 380, 48, 95],  [-590, 260, 42, 85],
  ];
  for (const [fx, fy, fz, fr] of foliageDefs) {
    addMesh(group, new THREE.SphereGeometry(fr, 9, 7),
      toonMat(0x3a9a1c), fx, fy, fz, 0, 0, 0, 1.2, 0.85, 1.0);
    addMesh(group, new THREE.SphereGeometry(fr * 0.65, 8, 6),
      toonMat(0x4ab828), fx + 40, fy + 30, fz - 10, 0, 0, 0, 1.1, 0.8, 1.0);
  }
  // Wind-whoosh swirl hints coming from the tree
  for (let w = 0; w < 4; w++) {
    addMesh(group, new THREE.TorusGeometry(30 + w * 15, 4, 4, 12, Math.PI * 1.2),
      basicMat(0xd8f0ff, { transparent: true, opacity: 0.35 }),
      -530 + w * 60, 160 + w * 20, +20, 0, 0, w * 0.3);
  }

  // ── Floating cloud platform visuals (three pass-through platforms) ───────────
  // Left cloud ledge (y=155 in physics)
  buildCloudPlatform(group, -187, 145, -25, 210, 40);
  // Right cloud ledge (y=155)
  buildCloudPlatform(group,  187, 145, -25, 210, 40);
  // Top centre cloud (y=268)
  buildCloudPlatform(group,    0, 258, -20, 240, 45);

  // ── Foreground grass tufts / bushes framing the stage ──────────────────────
  const bushPos: [number, number, number][] = [
    [-750, -90, +55], [-550, -82, +52], [560, -85, +50], [760, -90, +55],
  ];
  for (const [bx, by, bz] of bushPos) {
    addMesh(group, new THREE.SphereGeometry(34, 8, 6),
      toonMat(0x3a9a1c), bx, by, bz, 0, 0, 0, 1.3, 0.6, 1.0);
    addMesh(group, new THREE.SphereGeometry(24, 7, 5),
      toonMat(0x4ab828), bx + 28, by + 8, bz - 5, 0, 0, 0, 1.1, 0.55, 0.9);
  }

  // ── Under-cloud puffs (below the island for depth) ──────────────────────────
  const underCloudPos: [number, number, number][] = [
    [-800, -260, -80], [-500, -280, -70], [-200, -255, -60],
    [200, -260, -65],  [520, -275, -75],  [820, -260, -80],
  ];
  for (const [ux, uy, uz] of underCloudPos) {
    addMesh(group, new THREE.SphereGeometry(85, 7, 5),
      basicMat(0xffffff, { transparent: true, opacity: 0.45 }),
      ux, uy, uz, 0, 0, 0, 1.6, 0.45, 1.0);
  }

  // ── Lights ─────────────────────────────────────────────────────────────────
  addPointLight(group, 0xfff8aa, 1.8, 500, 450, -400);
  addPointLight(group, 0xccffcc, 0.8, -400, 200, -200);

  return group;
}

/**
 * Build a cloud platform visual centred at (cx, cy, cz) with the given width
 * and height.  Three overlapping ellipsoid spheres make up the puff shape.
 */
function buildCloudPlatform(
  group: THREE.Group,
  cx: number, cy: number, cz: number,
  width: number, height: number,
): void {
  const segments = 9;
  // Central blob
  addMesh(group, new THREE.SphereGeometry(height * 0.85, segments, 6),
    toonMat(0xfafafa), cx, cy, cz, 0, 0, 0, width / (height * 1.7), 0.55, 1.0);
  // Left fluff
  addMesh(group, new THREE.SphereGeometry(height * 0.65, segments, 5),
    toonMat(0xf0f0ff), cx - width * 0.28, cy - 8, cz, 0, 0, 0, 1.2, 0.5, 0.9);
  // Right fluff
  addMesh(group, new THREE.SphereGeometry(height * 0.65, segments, 5),
    toonMat(0xf0f0ff), cx + width * 0.28, cy - 8, cz, 0, 0, 0, 1.2, 0.5, 0.9);
  // Slight shadow layer underneath
  addMesh(group, new THREE.SphereGeometry(height * 0.5, segments, 4),
    basicMat(0xccddff, { transparent: true, opacity: 0.3 }),
    cx, cy - height * 0.35, cz, 0, 0, 0, width / (height * 1.2), 0.25, 1.0);
}
