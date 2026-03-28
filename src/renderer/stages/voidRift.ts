// src/renderer/stages/voidRift.ts
// Space between dimensions — cosmic void with dimensional rift portal.

import * as THREE from 'three';
import { stdMat, basicMat, addPointLight, addMesh } from './shared.js';

export function buildVoidRiftEnvironment(scene: THREE.Scene): THREE.Group {
  const group = new THREE.Group();
  group.name = 'voidRift_env';
  scene.add(group);

  // ── Void backdrop ──────────────────────────────────────────────────────────
  addMesh(group, new THREE.PlaneGeometry(8000, 4000), basicMat(0x010008), 0, 0, -580);

  // ── Stars ──────────────────────────────────────────────────────────────────
  const starMat = stdMat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 1 });
  const starSeeds = [
    [300,-100],[-400,200],[600,-300],[-200,400],[800,100],[-600,-200],
    [100,500],[-700,0],[450,-250],[750,350],[-350,-400],[50,-180],
    [-550,300],[680,-80],[200,420],[-120,-350],[900,-150],[550,280],
    [-800,150],[-100,480],[400,-420],[-450,80],[700,-320],[-250,200],
    [120,-50],[820,220],[-680,-100],[380,360],[-30,-440],[600,110],
    [-900,280],[150,-380],[720,-200],[-500,440],[-280,-280],[490,330],
    [-150,160],[860,-260],[330,-130],[740,400],[-620,50],[-40,-500],
    [200,-100],[-800,-300],[600,450],[100,-450],[450,80],[-340,-180],
    [780,-40],[270,490],[-700,320],[560,-370],[80,380],[-440,-80],
    [900,150],[-200,-460],[400,260],[-550,-250],[650,-500],[350,190],
    [-900,-400],[150,340],[-60,-160],[820,-400],[500,-90],[-300,430],
    [700,280],[-750,-50],[200,-320],[400,-60],[-600,400],[850,320],
    [-100,-220],[550,-500],[720,100],[280,-480],[-800,480],[650,-180],
    [-400,-350],[300,440],[-650,280],[460,-300],[800,-500],[120,220],
    [-300,-100],[680,380],[80,-400],[960,60],[-960,-80],[480,500],
    [-920,320],[340,-230],[-760,200],[840,-380],[160,450],[-480,-480],
    [580,120],[-340,380],[700,-40],[-880,180],
  ];
  for (const [sx, sy] of starSeeds) {
    addMesh(group, new THREE.SphereGeometry(1.5 + Math.abs(sx) % 2, 4, 3),
      starMat, sx, sy, -520);
  }

  // ── Distant nebula ─────────────────────────────────────────────────────────
  const nebulaDefs: [number, number, number, number, number, number][] = [
    [-300, 100, -460, 400, 0x330066, 0.18],
    [200,  -50, -450, 500, 0x220044, 0.15],
    [0,    200, -470, 350, 0x1a0044, 0.22],
  ];
  for (const [nx, ny, nz, nr, nc, no] of nebulaDefs) {
    addMesh(group, new THREE.SphereGeometry(nr, 12, 8),
      stdMat(nc, { emissive: nc, emissiveIntensity: 0.3, transparent: true, opacity: no }),
      nx, ny, nz);
  }

  // ── Central rift portal ────────────────────────────────────────────────────
  addMesh(group, new THREE.TorusGeometry(250, 20, 10, 32),
    stdMat(0xaa22ff, { emissive: 0xaa22ff, emissiveIntensity: 1.0 }), 0, 60, -380);
  // Inner void disc
  addMesh(group, new THREE.CircleGeometry(230, 32),
    stdMat(0x110022, { emissive: 0x220044, emissiveIntensity: 0.4 }), 0, 60, -382);
  // Energy tendrils (8, at 45° intervals)
  for (let t = 0; t < 8; t++) {
    const angle = (t / 8) * Math.PI * 2;
    addMesh(group, new THREE.BoxGeometry(6, 180, 4),
      stdMat(0xaa22ff, { emissive: 0xaa22ff, emissiveIntensity: 0.8 }),
      Math.cos(angle) * 250, 60 + Math.sin(angle) * 250, -378, 0, 0, angle);
  }
  // Portal glow rings
  for (let r = 0; r < 3; r++) {
    addMesh(group, new THREE.TorusGeometry(270 + r * 30, 6, 6, 32),
      stdMat(0x6600cc, { emissive: 0x6600cc, emissiveIntensity: 0.4, transparent: true, opacity: 0.4 - r * 0.1 }),
      0, 60, -385 - r * 5);
  }

  // ── Floating asteroid fragments ────────────────────────────────────────────
  const asteroidDefs: [number, number, number, number][] = [
    [-600, 300, -300, 80], [400, -50, -280, 100], [-300, -150, -320, 65],
    [550, 200, -290, 90], [-450, 100, -310, 50], [200, 350, -270, 75],
  ];
  for (const [ax, ay, az, ar] of asteroidDefs) {
    addMesh(group, new THREE.OctahedronGeometry(ar, 1),
      stdMat(0x18102a, { roughness: 0.9 }), ax, ay, az, 0.3, 0.5, 0.2);
    // Void energy crack
    addMesh(group, new THREE.BoxGeometry(ar * 1.2, 3, 3),
      stdMat(0x6600cc, { emissive: 0x6600cc, emissiveIntensity: 0.8 }), ax, ay, az + ar * 0.5);
  }

  // ── Ancient ruin chunks ────────────────────────────────────────────────────
  const ruinDefs: [number, number, number, number, number, number][] = [
    [-700, 150, -220, 100, 60, 60], [-200, 300, -210, 80, 50, 70],
    [350, -80, -230, 120, 40, 80], [600, 250, -215, 60, 80, 50],
    [-500, -100, -225, 90, 60, 60],
  ];
  for (const [rx, ry, rz, rw, rh, rd] of ruinDefs) {
    addMesh(group, new THREE.BoxGeometry(rw, rh, rd),
      stdMat(0x2a1e30, { roughness: 0.9 }), rx, ry, rz, 0.2, 0.3, 0.1);
  }

  // ── Dimensional tear strips ────────────────────────────────────────────────
  const tearPositions: [number, number][] = [[-400, 0.1], [-200, -0.08], [200, 0.12], [400, -0.1]];
  for (const [tx, tilt] of tearPositions) {
    addMesh(group, new THREE.BoxGeometry(8, 400, 6),
      stdMat(0xaa22ff, { emissive: 0x8811ee, emissiveIntensity: 0.9 }),
      tx, 0, -150, 0, 0, tilt);
  }

  // ── Void floor plane ──────────────────────────────────────────────────────
  addMesh(group, new THREE.BoxGeometry(3000, 8, 1200),
    stdMat(0x060412, { roughness: 1.0 }), 0, -250, -300);
  // Emissive grid lines on floor
  for (let g = 0; g < 15; g++) {
    addMesh(group, new THREE.BoxGeometry(3000, 2, 2),
      stdMat(0x440088, { emissive: 0x440088, emissiveIntensity: 0.7 }),
      0, -245, -900 + g * 80);
  }
  for (let g = 0; g < 12; g++) {
    addMesh(group, new THREE.BoxGeometry(2, 2, 1200),
      stdMat(0x440088, { emissive: 0x440088, emissiveIntensity: 0.7 }),
      -1100 + g * 200, -245, -300);
  }

  // ── Foreground void shards ─────────────────────────────────────────────────
  const shardPos: [number, number, number][] = [
    [-620, -80, +30], [-450, -65, +25], [450, -65, +28], [640, -80, +30],
  ];
  for (const [fx, fy, fz] of shardPos) {
    addMesh(group, new THREE.OctahedronGeometry(35 + Math.abs(fx) % 15, 0),
      stdMat(0x18102a, { roughness: 0.85 }), fx, fy, fz, 0.3, 0.5, 0.2);
    addMesh(group, new THREE.OctahedronGeometry(20, 0),
      stdMat(0x6600cc, { emissive: 0x6600cc, emissiveIntensity: 0.6 }),
      fx + 20, fy + 30, fz, 0.1, 1.0, 0.2);
  }

  // ── Lights ─────────────────────────────────────────────────────────────────
  addPointLight(group, 0xaa00ff, 3.0, 0, 60, -380, 800);
  addPointLight(group, 0x4400aa, 1.5, -400, 0, -150, 400);
  addPointLight(group, 0x4400aa, 1.5,  400, 0, -150, 400);

  return group;
}
