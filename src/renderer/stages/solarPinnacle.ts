// src/renderer/stages/solarPinnacle.ts
// High mountain summit above the clouds — intense solar heat.

import * as THREE from 'three';
import { stdMat, toonMat, basicMat, addPointLight, addMesh } from './shared.js';

export function buildSolarPinnacleEnvironment(scene: THREE.Scene): THREE.Group {
  const group = new THREE.Group();
  group.name = 'solarPinnacle_env';
  scene.add(group);

  // ── Sky backdrop ────────────────────────────────────────────────────────────
  addMesh(group, new THREE.PlaneGeometry(8000, 3000), basicMat(0xff8000), 0, 300, -580);
  addMesh(group, new THREE.PlaneGeometry(8000, 2000), basicMat(0xcc3300), 0, -700, -579);
  // Upper atmosphere tint
  addMesh(group, new THREE.PlaneGeometry(8000, 1500),
    basicMat(0xff4400, { transparent: true, opacity: 0.35 }), 0, 800, -578);

  // ── Enormous sun ───────────────────────────────────────────────────────────
  addMesh(group, new THREE.SphereGeometry(300, 16, 12),
    stdMat(0xffcc00, { emissive: 0xffcc00, emissiveIntensity: 0.8 }), 350, 700, -520);
  // Corona rings
  for (let r = 0; r < 4; r++) {
    addMesh(group, new THREE.TorusGeometry(340 + r * 25, 15 + r * 3, 6, 24),
      stdMat(0xffaa00, { emissive: 0xffaa00, emissiveIntensity: 0.5, transparent: true, opacity: 0.4 - r * 0.08 }),
      350, 700, -522 - r * 3);
  }
  // Solar ray boxes
  for (let r = 0; r < 16; r++) {
    const angle = (r / 16) * Math.PI * 2;
    const dist = 360 + (r % 3) * 20;
    addMesh(group, new THREE.BoxGeometry(12, 180 + (r % 4) * 30, 8),
      stdMat(0xffcc44, { emissive: 0xffcc44, emissiveIntensity: 0.6, transparent: true, opacity: 0.7 }),
      350 + Math.cos(angle) * dist, 700 + Math.sin(angle) * dist, -520, 0, 0, angle);
  }

  // ── Mountain range backdrop ────────────────────────────────────────────────
  const mtDefs: [number, number, number, number, number][] = [
    [-1000, -400, -420, 280, 700], [-700, -400, -400, 220, 600],
    [-400, -400, -380, 320, 900], [-100, -400, -360, 200, 600],
    [100,  -400, -360, 180, 550], [400, -400, -380, 300, 850],
    [700,  -400, -400, 230, 620], [1000, -400, -420, 270, 680],
  ];
  for (const [mx, my, mz, mr, mh] of mtDefs) {
    addMesh(group, new THREE.ConeGeometry(mr, mh, 6),
      toonMat(0x8a4418), mx, my + mh * 0.5, mz);
    // Snow cap
    addMesh(group, new THREE.ConeGeometry(mr * 0.28, mh * 0.15, 6),
      toonMat(0xf0f0f0), mx, my + mh * 0.93, mz);
  }

  // ── Mountain cliff face behind stage ──────────────────────────────────────
  addMesh(group, new THREE.BoxGeometry(2400, 1200, 80),
    toonMat(0x7a4820), 0, -200, -250);
  // Rock strata lines
  for (let s = 0; s < 8; s++) {
    addMesh(group, new THREE.BoxGeometry(2400, 10, 90),
      toonMat(s % 2 === 0 ? 0x6a3810 : 0x8a5428), 0, -700 + s * 155, -204);
  }
  // Rocky protrusions on cliff
  for (let p = 0; p < 6; p++) {
    addMesh(group, new THREE.BoxGeometry(80 + p * 20, 40, 60),
      toonMat(0x7a4820), -500 + p * 200, -100 + p * 30, -200, 0, 0, (p % 3 - 1) * 0.1);
  }

  // ── Cloud layer below stage ────────────────────────────────────────────────
  const cloudDefs: [number, number, number][] = [
    [-900, -280, -80], [-750, -250, -100], [-600, -300, -120],
    [-450, -270, -90], [-300, -290, -110], [-150, -260, -80],
    [0,   -280, -140], [150, -270, -100], [300, -285, -110],
    [450, -260, -95], [600, -300, -120], [750, -255, -100],
    [900, -280, -85],
    [-800, -320, -150], [-500, -310, -130], [-200, -330, -160],
    [100, -315, -145], [400, -325, -155], [700, -310, -140],
    [850, -290, -170], [-650, -305, -145], [-50, -300, -130],
    [250, -295, -115], [-350, -320, -165], [550, -285, -120],
  ];
  for (const [cx, cy, cz] of cloudDefs) {
    addMesh(group, new THREE.SphereGeometry(70 + Math.abs(cx) % 40, 8, 5),
      basicMat(0xffeecc, { transparent: true, opacity: 0.9 }),
      cx, cy, cz, 0, 0, 0, 1.6, 0.45, 1.2);
  }

  // ── Rocky terrain extending from stage ────────────────────────────────────
  addMesh(group, new THREE.BoxGeometry(2200, 80, 600),
    toonMat(0xb87840), 0, -130, -150);
  // Rocky protrusions on terrain
  const rockDefs: [number, number, number][] = [
    [-800, -90, -130], [-580, -88, -140], [-360, -92, -135],
    [360, -92, -138], [600, -86, -142], [830, -90, -128],
  ];
  for (const [rx, ry, rz] of rockDefs) {
    addMesh(group, new THREE.BoxGeometry(60 + Math.abs(rx) % 40, 50, 50),
      toonMat(0xa06830), rx, ry, rz, 0, 0, (Math.abs(rx) % 5) * 0.04 - 0.1);
    addMesh(group, new THREE.BoxGeometry(40, 30, 35),
      toonMat(0xb87840), rx + 25, ry + 20, rz + 10, 0.1, 0.2, 0);
  }

  // ── Foreground rock outcroppings ──────────────────────────────────────────
  const fgRockPos: [number, number, number][] = [
    [-620, -80, +50], [-430, -70, +45], [440, -72, +48], [640, -78, +50],
  ];
  for (const [fx, fy, fz] of fgRockPos) {
    addMesh(group, new THREE.BoxGeometry(90, 70, 70),
      toonMat(0xa06830), fx, fy, fz, 0.1, 0.2, 0.05);
    addMesh(group, new THREE.BoxGeometry(55, 45, 50),
      toonMat(0xb87840), fx + 30, fy + 30, fz - 5, 0.05, 0.1, 0.08);
  }

  // ── Wind-blown snow particles ──────────────────────────────────────────────
  const snowMat = basicMat(0xffffff, { transparent: true, opacity: 0.85 });
  const snowPositions = [
    [-400,100],[-200,200],[0,150],[200,250],[400,180],
    [-600,300],[-100,80],[300,350],[600,220],[-300,400],
    [100,300],[-500,160],[500,340],[-700,240],[700,120],
    [-150,420],[150,380],[450,100],[-450,320],[0,450],
  ];
  for (const [sx, sy] of snowPositions) {
    addMesh(group, new THREE.SphereGeometry(3, 4, 3), snowMat, sx, sy, +30);
  }

  // ── Foreground cloud wisps ─────────────────────────────────────────────────
  addMesh(group, new THREE.SphereGeometry(80, 7, 5),
    basicMat(0xffeecc, { transparent: true, opacity: 0.4 }),
    -550, 80, +50, 0, 0, 0, 2.2, 0.4, 1.0);
  addMesh(group, new THREE.SphereGeometry(70, 7, 5),
    basicMat(0xffeecc, { transparent: true, opacity: 0.35 }),
    550, 60, +48, 0, 0, 0, 2.0, 0.4, 1.0);

  // ── Lights ─────────────────────────────────────────────────────────────────
  addPointLight(group, 0xffcc44, 3.0, 350, 700, -500, 1200);
  addPointLight(group, 0xff8833, 1.5, -300, 400, -200, 800);

  return group;
}
