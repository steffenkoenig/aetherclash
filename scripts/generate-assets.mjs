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
  { id: 'trump', color: 0xff8800 },
  { id: 'musk',  color: 0x00aaff },
  { id: 'putin', color: 0x4c7c4c },
  { id: 'xi',    color: 0xcc2222 },
  { id: 'lizzy', color: 0x88ccff },
];

/** Shared helper: create a MeshStandardMaterial. */
function mat(color, metalness = 0.1, roughness = 0.75) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness });
}

/**
 * Build a character-specific THREE.Group.
 * Body part names (torso, head, eyeL, eyeR, armL, armR, legL, legR) must match
 * the animation track targets exactly.  Extra decorative meshes may use any name.
 */
function buildCharacter(id, color) {
  const group = new THREE.Group();
  group.name = `${id}_root`;

  switch (id) {
    case 'kael':  buildKael(group, color);  break;
    case 'gorun': buildGorun(group, color); break;
    case 'vela':  buildVela(group, color);  break;
    case 'syne':  buildSyne(group, color);  break;
    case 'zira':  buildZira(group, color);  break;
    case 'trump': buildTrump(group, color); break;
    case 'musk':  buildMusk(group, color);  break;
    case 'putin': buildPutin(group, color); break;
    case 'xi':    buildXi(group, color);    break;
    case 'lizzy': buildLizzy(group, color); break;
    default:      buildDefaultChar(group, color); break;
  }

  return group;
}

// ---------------------------------------------------------------------------
// buildBipedRig — shared helper for all characters
//
// Creates named THREE.Group objects anchored at joint pivot points so that
// animation quaternion tracks rotate limbs from the correct joint (shoulder,
// hip, neck) rather than from each limb's own centre of mass.
//
// Layout (all Y values in root-group space):
//   Torso group  → y = 0  (waist pivot; chest geometry extends upward)
//   Head  group  → y = torsoH + 7  (neck-top pivot)
//   ArmL/R group → y = shoulderY   (shoulder pivot; arm hangs down)
//   LegL/R group → y = 0           (hip pivot; leg hangs down)
//
// CapsuleGeometry(r, L): total height = L + 2r, centred at origin.
// To span [pivot … pivot − totalLen]: position centre at y = −totalLen/2,
// with geometryLength = totalLen − 2r.
// ---------------------------------------------------------------------------
function buildBipedRig(group, {
  bodyMat, skinMat = null,
  torsoW = 12, waistW = 9, torsoH = 28,
  shoulderX = 15, shoulderY = 26,
  armRadius = 4.5, armLen = 24,
  hipX = 7, legRadius = 5.5, legLen = 28,
}) {
  const sm = skinMat || bodyMat;
  const ltH = torsoH * 0.42;  // lower-torso height (waist → belly)
  const utH = torsoH * 0.58;  // upper-torso height (belly → neck base)
  const uaL = armLen  * 0.54; // upper-arm length (shoulder → elbow)
  const faL = armLen  * 0.46; // forearm length   (elbow → wrist)
  const thL = legLen  * 0.54; // thigh length     (hip → knee)
  const shL = legLen  * 0.46; // shin length      (knee → ankle)

  // ── Torso group (waist pivot) ─────────────────────────────────────────────
  const torso = new THREE.Group();
  torso.name = 'torso'; torso.position.set(0, 0, 0); group.add(torso);

  // Pelvis — flattened sphere below waist pivot
  { const m = new THREE.Mesh(new THREE.SphereGeometry(waistW * 1.1, 10, 7), bodyMat);
    m.scale.set(1.3, 0.65, 1.0); m.position.set(0, -4, 0); torso.add(m); }
  // Lower torso cylinder
  { const m = new THREE.Mesh(new THREE.CylinderGeometry(waistW, waistW * 1.1, ltH, 10), bodyMat);
    m.position.set(0, ltH * 0.5, 0); torso.add(m); }
  // Chest / upper torso (wider at top)
  { const m = new THREE.Mesh(new THREE.CylinderGeometry(torsoW, waistW, utH, 10), bodyMat);
    m.position.set(0, ltH + utH * 0.5, 0); torso.add(m); }
  // Neck cylinder
  { const m = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 4.5, 7, 8), sm);
    m.position.set(0, torsoH + 3.5, 0); torso.add(m); }

  // ── Head group (neck-top pivot) ───────────────────────────────────────────
  const head = new THREE.Group();
  head.name = 'head'; head.position.set(0, torsoH + 7, 0); group.add(head);

  // ── Arm groups (shoulder pivot — geometry hangs downward) ─────────────────
  function addArm(side) {
    const g = new THREE.Group();
    g.name = side < 0 ? 'armL' : 'armR';
    g.position.set(side * shoulderX, shoulderY, 0); group.add(g);
    // Shoulder ball at pivot
    { const m = new THREE.Mesh(new THREE.SphereGeometry(armRadius + 1.5, 8, 6), bodyMat);
      g.add(m); }
    // Upper arm: spans y = 0 → −uaL
    { const cL = Math.max(1, uaL - armRadius * 2);
      const m = new THREE.Mesh(new THREE.CapsuleGeometry(armRadius, cL, 5, 8), bodyMat);
      m.position.set(0, -uaL * 0.5, 0); g.add(m); }
    // Elbow ball at y = −uaL
    { const m = new THREE.Mesh(new THREE.SphereGeometry(armRadius * 0.88, 7, 5), bodyMat);
      m.position.set(0, -uaL, 0); g.add(m); }
    // Forearm: spans y = −uaL → −(uaL+faL)
    { const fr = armRadius * 0.78;
      const cL = Math.max(1, faL - fr * 2);
      const m = new THREE.Mesh(new THREE.CapsuleGeometry(fr, cL, 5, 8), bodyMat);
      m.position.set(0, -(uaL + faL * 0.5), 0); g.add(m); }
    // Hand sphere at wrist
    { const m = new THREE.Mesh(new THREE.SphereGeometry(armRadius * 0.86, 7, 6), sm);
      m.scale.set(0.92, 0.86, 1.2); m.position.set(0, -(uaL + faL), 0); g.add(m); }
    return g;
  }
  const armL = addArm(-1);
  const armR = addArm(1);

  // ── Leg groups (hip pivot — geometry hangs downward) ──────────────────────
  function addLeg(side) {
    const g = new THREE.Group();
    g.name = side < 0 ? 'legL' : 'legR';
    g.position.set(side * hipX, 0, 0); group.add(g);
    // Hip socket ball
    { const m = new THREE.Mesh(new THREE.SphereGeometry(legRadius * 0.9, 8, 6), bodyMat);
      m.position.set(0, -legRadius * 0.2, 0); g.add(m); }
    // Thigh: spans y = 0 → −thL
    { const cL = Math.max(1, thL - legRadius * 2);
      const m = new THREE.Mesh(new THREE.CapsuleGeometry(legRadius, cL, 5, 8), bodyMat);
      m.position.set(0, -thL * 0.5, 0); g.add(m); }
    // Knee ball at y = −thL
    { const m = new THREE.Mesh(new THREE.SphereGeometry(legRadius * 0.84, 7, 5), bodyMat);
      m.position.set(0, -thL, 0); g.add(m); }
    // Shin: spans y = −thL → −(thL+shL)
    { const sr = legRadius * 0.8;
      const cL = Math.max(1, shL - sr * 2);
      const m = new THREE.Mesh(new THREE.CapsuleGeometry(sr, cL, 5, 8), bodyMat);
      m.position.set(0, -(thL + shL * 0.5), 0); g.add(m); }
    // Foot at ankle
    { const m = new THREE.Mesh(new THREE.SphereGeometry(legRadius * 0.86, 7, 5), bodyMat);
      m.scale.set(0.9, 0.58, 1.65); m.position.set(0, -(thL + shL), 4); g.add(m); }
    return g;
  }
  const legL = addLeg(-1);
  const legR = addLeg(1);

  return { torso, head, armL, armR, legL, legR };
}

// ---------------------------------------------------------------------------
// Kael — The Balanced Hero
// Medium armoured warrior with plate armour, round helmet and sword+shield.
// ---------------------------------------------------------------------------
function buildKael(group, color) {
  const bodyMat  = mat(color,    0.2, 0.60);
  const armorMat = mat(0x8899cc, 0.6, 0.30);
  const darkMat  = mat(0x1a2233, 0.1, 0.90);
  const eyeMat   = mat(0x88ccff, 0.0, 0.30);
  const swordMat = mat(0xdde8ff, 0.9, 0.10);

  const { torso, head, armL, armR, legL, legR } = buildBipedRig(group, {
    bodyMat, torsoW: 13, waistW: 9, torsoH: 28,
    shoulderX: 16, shoulderY: 26,
    armRadius: 4.5, armLen: 24,
    hipX: 7, legRadius: 5.5, legLen: 28,
  });

  // ── Head: round helmet with visor band, crest and glowing eyes ────────────
  { const m = new THREE.Mesh(new THREE.SphereGeometry(11, 16, 12), bodyMat);
    m.position.set(0, 11, 0); head.add(m); }
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(2.5, 8, 6), eyeMat);
  eyeL.name = 'eyeL'; eyeL.position.set(-5, 13, 10); head.add(eyeL);
  const eyeR = new THREE.Mesh(new THREE.SphereGeometry(2.5, 8, 6), eyeMat);
  eyeR.name = 'eyeR'; eyeR.position.set( 5, 13, 10); head.add(eyeR);
  { const m = new THREE.Mesh(new THREE.CylinderGeometry(11.5, 11.5, 3, 16), armorMat);
    m.position.set(0, 7, 0); head.add(m); }  // visor band
  { const m = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2.5, 12, 6), armorMat);
    m.position.set(0, 22, 0); head.add(m); } // helmet crest

  // ── Torso: chest plate + belt ring ────────────────────────────────────────
  { const m = new THREE.Mesh(new THREE.SphereGeometry(14, 12, 8), armorMat);
    m.scale.set(1.0, 0.8, 0.32); m.position.set(0, 18, 11); torso.add(m); } // chest plate
  { const m = new THREE.Mesh(new THREE.TorusGeometry(11, 2.5, 8, 16), darkMat);
    m.rotation.x = Math.PI / 2; m.position.set(0, 1, 0); torso.add(m); }    // belt ring

  // ── Arms: pauldrons at shoulder pivot + greaves on shins ──────────────────
  for (const arm of [armL, armR]) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(8, 10, 8), armorMat);
    p.scale.set(1.4, 0.65, 1.4); arm.add(p); // pauldron sits at shoulder pivot
  }
  for (const leg of [legL, legR]) {
    const g = new THREE.Mesh(new THREE.CylinderGeometry(7, 6, 10, 8), armorMat);
    g.position.set(0, -(28 * 0.54) - 6, 1); leg.add(g); // greave over shin
  }

  // ── Weapon + shield (attached to root group) ──────────────────────────────
  // Sword (right side)
  { const m = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 0.3, 38, 8), swordMat);
    m.position.set(28, 2, 0); group.add(m); }  // blade
  { const m = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 2.5, 8), darkMat);
    m.position.set(28, 21, 0); group.add(m); } // guard
  { const m = new THREE.Mesh(new THREE.CapsuleGeometry(2, 8, 4, 8), darkMat);
    m.position.set(28, 28, 0); group.add(m); } // grip
  // Shield (left side) — disc + emblem
  { const m = new THREE.Mesh(new THREE.CylinderGeometry(13, 13, 3, 12), armorMat);
    m.rotation.z = Math.PI / 2; m.position.set(-29, 8, 0); group.add(m); }
  { const m = new THREE.Mesh(new THREE.SphereGeometry(5, 10, 8), mat(color, 0.4, 0.5));
    m.scale.z = 0.4; m.position.set(-32, 8, 0); group.add(m); }
}

// ---------------------------------------------------------------------------
// Gorun — The Heavy Vanguard
// Massive armoured giant with horned helmet, huge shoulders and war-hammer.
// ---------------------------------------------------------------------------
function buildGorun(group, color) {
  const bodyMat   = mat(color,    0.3, 0.65);
  const armorMat  = mat(0x333333, 0.7, 0.35);
  const accentMat = mat(0xff4400, 0.4, 0.50);
  const eyeMat    = mat(0xff6600, 0.0, 0.30);
  const hammerMat = mat(0x555566, 0.8, 0.30);

  const { torso, head, armL, armR, legL, legR } = buildBipedRig(group, {
    bodyMat, torsoW: 22, waistW: 16, torsoH: 32,
    shoulderX: 26, shoulderY: 30,
    armRadius: 7.5, armLen: 30,
    hipX: 12, legRadius: 9, legLen: 34,
  });

  // ── Head: horned helmet sphere ─────────────────────────────────────────────
  { const m = new THREE.Mesh(new THREE.SphereGeometry(14, 16, 12), bodyMat);
    m.position.set(0, 14, 0); head.add(m); }
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(3, 8, 6), eyeMat);
  eyeL.name = 'eyeL'; eyeL.scale.set(1.8, 0.6, 0.5); eyeL.position.set(-7, 16, 13); head.add(eyeL);
  const eyeR = new THREE.Mesh(new THREE.SphereGeometry(3, 8, 6), eyeMat);
  eyeR.name = 'eyeR'; eyeR.scale.set(1.8, 0.6, 0.5); eyeR.position.set( 7, 16, 13); head.add(eyeR);
  { const m = new THREE.Mesh(new THREE.CylinderGeometry(14.5, 14.5, 4, 16), armorMat);
    m.position.set(0, 8, 0); head.add(m); }  // visor band
  { const m = new THREE.Mesh(new THREE.ConeGeometry(4, 22, 8), armorMat);
    m.position.set(-11, 28, 0); head.add(m); } // horn L
  { const m = new THREE.Mesh(new THREE.ConeGeometry(4, 22, 8), armorMat);
    m.position.set( 11, 28, 0); head.add(m); } // horn R

  // ── Torso: massive chest plate + belt rivets ───────────────────────────────
  { const m = new THREE.Mesh(new THREE.SphereGeometry(20, 12, 8), armorMat);
    m.scale.set(1.0, 0.7, 0.35); m.position.set(0, 20, 13); torso.add(m); } // chest plate
  { const m = new THREE.Mesh(new THREE.TorusGeometry(18, 3.5, 8, 14), armorMat);
    m.rotation.x = Math.PI / 2; m.position.set(0, 1, 0); torso.add(m); }    // belt ring
  for (const [rx, rz] of [[-9, 15], [9, 15], [-9, -15], [9, -15]]) {
    const r = new THREE.Mesh(new THREE.SphereGeometry(2.5, 6, 5), accentMat);
    r.position.set(rx, 1, rz); torso.add(r);
  }

  // ── Arms: massive pauldrons with accent spikes ─────────────────────────────
  for (const arm of [armL, armR]) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(14, 12, 8), armorMat);
    p.scale.set(1.5, 0.6, 1.5); arm.add(p); // shoulder plate at pivot
    const s = new THREE.Mesh(new THREE.ConeGeometry(5, 17, 8), accentMat);
    s.position.set(0, 14, 0); arm.add(s);   // spike above shoulder
  }
  // Knee plates on legs
  for (const leg of [legL, legR]) {
    const k = new THREE.Mesh(new THREE.SphereGeometry(11, 10, 8), armorMat);
    k.scale.set(1, 0.55, 0.9); k.position.set(0, -(34 * 0.54) + 2, 6); leg.add(k);
  }

  // ── Hammer (root group — right side) ──────────────────────────────────────
  { const m = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 38, 8), armorMat);
    m.position.set(52, 10, 0); group.add(m); } // shaft
  { const m = new THREE.Mesh(new THREE.SphereGeometry(14, 12, 8), hammerMat);
    m.scale.set(1.5, 1.2, 1.2); m.position.set(52, -6, 0); group.add(m); } // head
  { const m = new THREE.Mesh(new THREE.TorusGeometry(14, 2.5, 6, 12), accentMat);
    m.rotation.z = Math.PI / 2; m.position.set(52, -6, 0); group.add(m); } // band
}

// ---------------------------------------------------------------------------
// Vela — The Blade Master
// Tall lean duelist with sphere-chain ponytail, cloak panels and long blade.
// ---------------------------------------------------------------------------
function buildVela(group, color) {
  const bodyMat  = mat(color,    0.15, 0.65);
  const darkMat  = mat(0x111111, 0.10, 0.90);
  const bladeMat = mat(0xccddff, 0.90, 0.10);
  const eyeMat   = mat(0xaaffcc, 0.00, 0.30);
  const clothMat = mat(0x224433, 0.00, 0.95);

  const { torso, head, armL, armR, legL, legR } = buildBipedRig(group, {
    bodyMat, torsoW: 11, waistW: 8, torsoH: 30,
    shoulderX: 14, shoulderY: 28,
    armRadius: 3.5, armLen: 28,
    hipX: 6, legRadius: 4.5, legLen: 32,
  });

  // ── Head: elegant sphere + sphere-chain ponytail ───────────────────────────
  { const m = new THREE.Mesh(new THREE.SphereGeometry(9.5, 16, 12), bodyMat);
    m.position.set(0, 10, 0); head.add(m); }
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(2, 8, 6), eyeMat);
  eyeL.name = 'eyeL'; eyeL.position.set(-4, 12, 8.5); head.add(eyeL);
  const eyeR = new THREE.Mesh(new THREE.SphereGeometry(2, 8, 6), eyeMat);
  eyeR.name = 'eyeR'; eyeR.position.set( 4, 12, 8.5); head.add(eyeR);
  // Ponytail — decreasing spheres sweeping back from crown
  for (const [py, pz, pr] of [[17, -4, 4], [12, -10, 3], [6, -16, 2.2], [0, -22, 1.6]]) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(pr, 8, 6), bodyMat);
    m.position.set(0, py, pz); head.add(m);
  }

  // ── Torso: collar ring + belt sash + cloak panels ─────────────────────────
  { const m = new THREE.Mesh(new THREE.TorusGeometry(7, 2, 8, 12), darkMat);
    m.rotation.x = Math.PI / 2; m.position.set(0, 30, 0); torso.add(m); } // collar
  { const m = new THREE.Mesh(new THREE.TorusGeometry(9, 2, 8, 12), darkMat);
    m.rotation.x = Math.PI / 2; m.position.set(0, 1, 0); torso.add(m); }  // belt sash
  for (const sx of [-13, 13]) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(2, 3.5, 28, 6), clothMat);
    m.position.set(sx, 6, -7); torso.add(m); // cloak panel
  }

  // ── Arms: long blade glove on right forearm ────────────────────────────────
  // (No extra decoration needed — shape is distinctive enough)

  // ── Legs: tall dark boots over shins ─────────────────────────────────────
  for (const leg of [legL, legR]) {
    const side = leg === legL ? -1 : 1;
    const b = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 5, 10, 8), darkMat);
    b.position.set(0, -(32 * 0.54) - 4, 1); leg.add(b); // boot cylinder over shin
  }

  // ── Sword (root group — right side) ───────────────────────────────────────
  { const m = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 0.4, 52, 8), bladeMat);
    m.position.set(20, -4, 0); group.add(m); } // blade
  { const m = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 2, 8), darkMat);
    m.position.set(20, 22, 0); group.add(m); } // guard
  { const m = new THREE.Mesh(new THREE.CapsuleGeometry(1.8, 10, 4, 8), darkMat);
    m.position.set(20, 28, 0); group.add(m); } // grip
}

// ---------------------------------------------------------------------------
// Syne — The Projectile Tactician
// Slim tech engineer with dome helmet, backpack reactor and arm cannon.
// ---------------------------------------------------------------------------
function buildSyne(group, color) {
  const bodyMat = mat(color,    0.20, 0.65);
  const techMat = mat(0x223344, 0.60, 0.40);
  const glowMat = mat(0x00ffee, 0.00, 0.30);
  const eyeMat  = mat(0x00eeff, 0.00, 0.20);
  const darkMat = mat(0x111122, 0.10, 0.90);

  const { torso, head, armL, armR, legL, legR } = buildBipedRig(group, {
    bodyMat, torsoW: 10, waistW: 8, torsoH: 26,
    shoulderX: 14, shoulderY: 24,
    armRadius: 3, armLen: 22,
    hipX: 6, legRadius: 3.5, legLen: 26,
  });

  // ── Head: tech dome helmet + visor + antenna ───────────────────────────────
  { const m = new THREE.Mesh(new THREE.SphereGeometry(9, 16, 12), bodyMat);
    m.position.set(0, 9, 0); head.add(m); } // head sphere
  { const m = new THREE.Mesh(new THREE.SphereGeometry(11, 16, 10), techMat);
    m.position.set(0, 11, 0); head.add(m); } // dome helmet over head
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(3, 8, 6), eyeMat);
  eyeL.name = 'eyeL'; eyeL.scale.set(1.8, 0.55, 0.5); eyeL.position.set(-5, 10, 9.5); head.add(eyeL);
  const eyeR = new THREE.Mesh(new THREE.SphereGeometry(3, 8, 6), eyeMat);
  eyeR.name = 'eyeR'; eyeR.scale.set(1.8, 0.55, 0.5); eyeR.position.set( 5, 10, 9.5); head.add(eyeR);
  { const m = new THREE.Mesh(new THREE.TorusGeometry(9, 2, 6, 16, Math.PI), glowMat);
    m.rotation.z = Math.PI / 2; m.position.set(0, 10, 9); head.add(m); } // visor arc
  { const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 14, 6), glowMat);
    m.position.set(6, 22, 0); head.add(m); } // antenna
  { const m = new THREE.Mesh(new THREE.SphereGeometry(3, 8, 6), glowMat);
    m.position.set(6, 30, 0); head.add(m); } // tip

  // ── Torso: backpack reactor + belt ring ────────────────────────────────────
  { const m = new THREE.Mesh(new THREE.CylinderGeometry(9, 8, 26, 8), techMat);
    m.rotation.x = Math.PI / 2; m.position.set(0, 13, -12); torso.add(m); } // backpack
  { const m = new THREE.Mesh(new THREE.SphereGeometry(4.5, 10, 8), glowMat);
    m.position.set(0, 13, -18); torso.add(m); } // reactor orb
  { const m = new THREE.Mesh(new THREE.TorusGeometry(9, 2.5, 8, 12), techMat);
    m.rotation.x = Math.PI / 2; m.position.set(0, 1, 0); torso.add(m); } // belt ring

  // ── Arms: cannon on left arm group ────────────────────────────────────────
  { const m = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 5.5, 12, 8), techMat);
    m.rotation.x = Math.PI / 2; m.position.set(0, -8, 5); armL.add(m); } // cannon housing
  { const m = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 14, 8), darkMat);
    m.rotation.x = Math.PI / 2; m.position.set(0, -8, 13); armL.add(m); } // barrel

  // ── Legs: tech boots on shins ─────────────────────────────────────────────
  for (const leg of [legL, legR]) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4, 8, 8), techMat);
    b.position.set(0, -(26 * 0.54) - 3, 1); leg.add(b); // boot over shin
  }
}

// ---------------------------------------------------------------------------
// Zira — The Agile Striker
// Compact street fighter with mohawk, wristbands and toe-cap boots.
// ---------------------------------------------------------------------------
function buildZira(group, color) {
  const bodyMat   = mat(color,    0.15, 0.70);
  const darkMat   = mat(0x550011, 0.10, 0.85);
  const accentMat = mat(0xff3300, 0.20, 0.60);
  const eyeMat    = mat(0xff9900, 0.00, 0.30);
  const padMat    = mat(0x222222, 0.20, 0.70);

  const { torso, head, armL, armR, legL, legR } = buildBipedRig(group, {
    bodyMat, torsoW: 9, waistW: 7, torsoH: 24,
    shoulderX: 12, shoulderY: 22,
    armRadius: 2.8, armLen: 20,
    hipX: 6, legRadius: 3.8, legLen: 26,
  });

  // ── Head: round sphere + mohawk cone + glowing eyes ────────────────────────
  { const m = new THREE.Mesh(new THREE.SphereGeometry(8, 16, 12), bodyMat);
    m.position.set(0, 8, 0); head.add(m); }
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(2, 8, 6), eyeMat);
  eyeL.name = 'eyeL'; eyeL.position.set(-4, 10, 7.5); head.add(eyeL);
  const eyeR = new THREE.Mesh(new THREE.SphereGeometry(2, 8, 6), eyeMat);
  eyeR.name = 'eyeR'; eyeR.position.set( 4, 10, 7.5); head.add(eyeR);
  // Mohawk base ring + cone
  { const m = new THREE.Mesh(new THREE.TorusGeometry(3.5, 1.5, 6, 12), accentMat);
    m.rotation.x = Math.PI / 2; m.position.set(0, 16, 0); head.add(m); }
  { const m = new THREE.Mesh(new THREE.ConeGeometry(2.5, 18, 6), accentMat);
    m.position.set(0, 25, 0); head.add(m); }

  // ── Torso: neck collar + chest bands ──────────────────────────────────────
  { const m = new THREE.Mesh(new THREE.TorusGeometry(6, 1.5, 6, 12), darkMat);
    m.rotation.x = Math.PI / 2; m.position.set(0, 24, 0); torso.add(m); } // collar
  { const m = new THREE.Mesh(new THREE.TorusGeometry(8.5, 1.2, 6, 12), darkMat);
    m.rotation.x = Math.PI / 2; m.position.set(0, 18, 0); torso.add(m); } // chest band 1
  { const m = new THREE.Mesh(new THREE.TorusGeometry(8, 1.2, 6, 12), darkMat);
    m.rotation.x = Math.PI / 2; m.position.set(0, 10, 0); torso.add(m); } // chest band 2

  // ── Arms: wristband torus rings at the wrist (end of forearm) ─────────────
  const wristY = -(20 * 0.54 + 20 * 0.46);   // = −armLen (wrist position in arm group)
  for (const arm of [armL, armR]) {
    const w = new THREE.Mesh(new THREE.TorusGeometry(3.5, 1.5, 8, 12), padMat);
    w.rotation.x = Math.PI / 2; w.position.set(0, wristY + 3, 0); arm.add(w);
  }

  // ── Legs: knee pads on thighs, dark boots on shins ────────────────────────
  for (const leg of [legL, legR]) {
    // Knee pad at bottom of thigh (y = −thL)
    const k = new THREE.Mesh(new THREE.SphereGeometry(5, 8, 6), padMat);
    k.scale.set(1, 0.55, 0.8); k.position.set(0, -(26 * 0.54) + 2, 4); leg.add(k);
    // Boot cylinder over shin
    const b = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4, 9, 8), darkMat);
    b.position.set(0, -(26 * 0.54) - 4, 2); leg.add(b);
    // Toe cap
    const t = new THREE.Mesh(new THREE.SphereGeometry(4, 8, 6), accentMat);
    t.scale.set(1, 0.5, 0.7); t.position.set(0, -(26 * 0.54 + 26 * 0.46), 7); leg.add(t);
  }
}

// ---------------------------------------------------------------------------
// Trump — wide orange suit, combed-over hair, red tie
// ---------------------------------------------------------------------------
function buildTrump(group, color) {
  const suitMat  = mat(color);
  const tieMat   = mat(0xdd0000);
  const skinMat  = mat(0xffc090);
  const hairMat  = mat(0xffdd88);
  const eyeMat   = mat(0x3355aa);
  const { head, torso, armL, armR } = buildBipedRig(group, {
    bodyMat: suitMat, torsoW: 18, waistW: 13, torsoH: 30,
    shoulderX: 20, shoulderY: 28,
    armRadius: 6, armLen: 26,
    hipX: 10, legRadius: 7, legLen: 28,
  });
  { const m = new THREE.Mesh(new THREE.SphereGeometry(12, 14, 10), skinMat);
    m.position.set(0, 12, 0); head.add(m); }
  for (const [x, y, z] of [[-5, 14, 11],[5, 14, 11]]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(2.5, 8, 6), eyeMat);
    e.position.set(x, y, z); head.add(e);
  }
  // Combover
  const co = new THREE.Mesh(new THREE.CapsuleGeometry(11, 2, 4, 6), hairMat);
  co.rotation.z = Math.PI / 2; co.position.set(0, 23, -2); head.add(co);
  // Tie
  { const k = new THREE.Mesh(new THREE.CylinderGeometry(10, 7, 10, 6), tieMat);
    k.position.set(0, 14, 8); torso.add(k); }
  { const t = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 4, 28, 6), tieMat);
    t.position.set(0, 2, 9); torso.add(t); }
  // Small hands
  for (const arm of [armL, armR]) {
    const h = new THREE.Mesh(new THREE.SphereGeometry(4, 8, 6), skinMat);
    h.position.set(0, -28, 0); arm.add(h);
  }
}

// ---------------------------------------------------------------------------
// Musk — slim dark turtleneck, X belt buckle, rocket thruster backpack
// ---------------------------------------------------------------------------
function buildMusk(group, color) {
  const bodyMat = mat(color);
  const darkMat = mat(0x222244);
  const skinMat = mat(0xffe0c0);
  const eyeMat  = mat(0x33bb99);
  const glowMat = mat(0x00ffee);
  const { head, torso, armL } = buildBipedRig(group, {
    bodyMat: darkMat, torsoW: 10, waistW: 8, torsoH: 28,
    shoulderX: 14, shoulderY: 26,
    armRadius: 3.5, armLen: 24,
    hipX: 6, legRadius: 4, legLen: 26,
  });
  { const m = new THREE.Mesh(new THREE.SphereGeometry(10, 14, 10), skinMat);
    m.position.set(0, 10, 0); head.add(m); }
  for (const [x, y, z] of [[-5, 12, 9.5],[5, 12, 9.5]]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(2.5, 8, 6), eyeMat);
    e.position.set(x, y, z); head.add(e);
  }
  { const c = new THREE.Mesh(new THREE.CylinderGeometry(9, 8, 6, 10), darkMat);
    c.position.set(0, 3, 0); head.add(c); }
  // Rocket backpack
  { const r = new THREE.Mesh(new THREE.CapsuleGeometry(5, 18, 4, 8), bodyMat);
    r.rotation.x = Math.PI / 2; r.position.set(0, 14, -14); torso.add(r); }
  { const g = new THREE.Mesh(new THREE.SphereGeometry(4, 8, 6), glowMat);
    g.position.set(0, 14, -22); torso.add(g); }
  // X belt
  for (const rz of [Math.PI / 4, -Math.PI / 4]) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 14, 4), glowMat);
    b.rotation.z = rz; b.position.set(0, 2, 8); torso.add(b);
  }
  void armL; void darkMat;
}

// ---------------------------------------------------------------------------
// Putin — shirtless, wide, bear-saddle, chest medals
// ---------------------------------------------------------------------------
function buildPutin(group, color) {
  const skinMat  = mat(color);
  const bearMat  = mat(0x8b5e3c);
  const eyeMat   = mat(0x3399cc);
  const medalMat = mat(0xffd700);
  const { head, torso } = buildBipedRig(group, {
    bodyMat: skinMat, torsoW: 20, waistW: 14, torsoH: 30,
    shoulderX: 24, shoulderY: 28,
    armRadius: 7, armLen: 28,
    hipX: 11, legRadius: 8, legLen: 30,
  });
  { const m = new THREE.Mesh(new THREE.SphereGeometry(12, 14, 10), skinMat);
    m.position.set(0, 12, 0); head.add(m); }
  for (const [x, y, z] of [[-5, 14, 11],[5, 14, 11]]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(2.5, 8, 6), eyeMat);
    e.position.set(x, y, z); head.add(e);
  }
  // Bear saddle
  { const s = new THREE.Mesh(new THREE.SphereGeometry(20, 10, 8), bearMat);
    s.scale.set(1.8, 0.9, 1.4); s.position.set(0, -46, 0); torso.add(s); }
  // Bear ears
  for (const bx of [-18, 18]) {
    const e = new THREE.Mesh(new THREE.ConeGeometry(5, 9, 6), bearMat);
    e.position.set(bx, -42, 14); group.add(e);
  }
  // Chest medals
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(3, 8, 6), medalMat);
    m.scale.set(0.5, 1, 0.3); m.position.set(-8 + i * 8, 20, 13); torso.add(m);
  }
  void eyeMat;
}

// ---------------------------------------------------------------------------
// Xi — dark red Mao suit, five-star chest, Little Red Book
// ---------------------------------------------------------------------------
function buildXi(group, color) {
  const suitMat = mat(color);
  const skinMat = mat(0xf5d8b0);
  const starMat = mat(0xffd700);
  const eyeMat  = mat(0x222222);
  const colMat  = mat(0x660000);
  const { head, torso } = buildBipedRig(group, {
    bodyMat: suitMat, torsoW: 16, waistW: 12, torsoH: 32,
    shoulderX: 18, shoulderY: 28,
    armRadius: 5.5, armLen: 26,
    hipX: 9, legRadius: 7, legLen: 30,
  });
  { const m = new THREE.Mesh(new THREE.SphereGeometry(11, 14, 10), skinMat);
    m.position.set(0, 11, 0); head.add(m); }
  for (const [x, y, z] of [[-4, 13, 10],[4, 13, 10]]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(2.2, 8, 6), eyeMat);
    e.position.set(x, y, z); head.add(e);
  }
  { const c = new THREE.Mesh(new THREE.CylinderGeometry(10, 9, 6, 8), colMat);
    c.position.set(0, 3, 0); head.add(c); }
  // Five stars on chest
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    const s = new THREE.Mesh(new THREE.SphereGeometry(2.5, 8, 6), starMat);
    s.position.set(Math.cos(a) * 5, 22 + Math.sin(a) * 5, 13); torso.add(s);
  }
  // Little Red Book
  { const b = new THREE.Mesh(new THREE.BoxGeometry(8, 10, 2), mat(0xdd0000));
    b.position.set(-26, -4, 0); group.add(b); }
  void suitMat;
}

// ---------------------------------------------------------------------------
// Lizzy — pastel coat, crown, handbag, spectral corgi
// ---------------------------------------------------------------------------
function buildLizzy(group, color) {
  const coatMat  = mat(color);
  const skinMat  = mat(0xffe0cc);
  const crownMat = mat(0xffd700);
  const eyeMat   = mat(0x224488);
  const corgiMat = mat(0xee8833);
  const { head } = buildBipedRig(group, {
    bodyMat: coatMat, torsoW: 13, waistW: 10, torsoH: 28,
    shoulderX: 16, shoulderY: 26,
    armRadius: 4.5, armLen: 24,
    hipX: 7, legRadius: 5.5, legLen: 28,
  });
  { const m = new THREE.Mesh(new THREE.SphereGeometry(10, 14, 10), skinMat);
    m.position.set(0, 10, 0); head.add(m); }
  for (const [x, y, z] of [[-4, 12, 9],[4, 12, 9]]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(2.2, 8, 6), eyeMat);
    e.position.set(x, y, z); head.add(e);
  }
  // Crown
  { const c = new THREE.Mesh(new THREE.CylinderGeometry(8, 9, 6, 6), crownMat);
    c.position.set(0, 22, 0); head.add(c); }
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const p = new THREE.Mesh(new THREE.ConeGeometry(2, 8, 5), crownMat);
    p.position.set(Math.cos(a) * 7, 27, Math.sin(a) * 7); head.add(p);
  }
  // Handbag
  { const b = new THREE.Mesh(new THREE.BoxGeometry(10, 8, 4), coatMat);
    b.position.set(-24, -8, 0); group.add(b); }
  // Spectral corgi
  { const cb = new THREE.Mesh(new THREE.SphereGeometry(6, 10, 8), corgiMat);
    cb.scale.set(2, 0.9, 1.2); cb.position.set(-30, -48, 8); group.add(cb); }
  { const cg = new THREE.Mesh(new THREE.ConeGeometry(3, 7, 5), corgiMat);
    cg.position.set(-30, -44, 16); group.add(cg); }
  void eyeMat;
}

// ---------------------------------------------------------------------------
// Default fallback character — simple jointed humanoid
// ---------------------------------------------------------------------------
function buildDefaultChar(group, color) {
  const bodyMat = mat(color);
  const eyeMat  = mat(0xffffff);

  const { head } = buildBipedRig(group, {
    bodyMat, torsoW: 12, waistW: 9, torsoH: 28,
    shoulderX: 15, shoulderY: 26,
    armRadius: 4, armLen: 22,
    hipX: 7, legRadius: 5, legLen: 26,
  });
  { const m = new THREE.Mesh(new THREE.SphereGeometry(10, 14, 10), bodyMat);
    m.position.set(0, 10, 0); head.add(m); }
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(2.5, 8, 6), eyeMat);
  eyeL.name = 'eyeL'; eyeL.position.set(-4, 12, 9); head.add(eyeL);
  const eyeR = new THREE.Mesh(new THREE.SphereGeometry(2.5, 8, 6), eyeMat);
  eyeR.name = 'eyeR'; eyeR.position.set( 4, 12, 9); head.add(eyeR);
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

  // --- walk (0.6 s, loop): slower/smaller amplitude leg & arm swing ---
  const walkTimes = [0, 0.15, 0.3, 0.45, 0.6];
  clips.push(new THREE.AnimationClip('walk', 0.6, [
    new THREE.QuaternionKeyframeTrack(
      'legL.quaternion', walkTimes,
      flatQuat(quatRotX(20), quatRotX(0), quatRotX(-20), quatRotX(0), quatRotX(20)),
    ),
    new THREE.QuaternionKeyframeTrack(
      'legR.quaternion', walkTimes,
      flatQuat(quatRotX(-20), quatRotX(0), quatRotX(20), quatRotX(0), quatRotX(-20)),
    ),
    new THREE.QuaternionKeyframeTrack(
      'armL.quaternion', walkTimes,
      flatQuat(quatRotX(-12), quatRotX(0), quatRotX(12), quatRotX(0), quatRotX(-12)),
    ),
    new THREE.QuaternionKeyframeTrack(
      'armR.quaternion', walkTimes,
      flatQuat(quatRotX(12), quatRotX(0), quatRotX(-12), quatRotX(0), quatRotX(12)),
    ),
  ]));

  // --- crouch (0.15 s, one-shot): legs bent, body compressed, arms in guard ---
  const crouchTimes = [0, 0.15];
  clips.push(new THREE.AnimationClip('crouch', 0.15, [
    new THREE.VectorKeyframeTrack(
      `${root}.scale`,
      crouchTimes,
      new Float32Array([1, 1, 1,  1, 0.65, 1]),
    ),
    new THREE.QuaternionKeyframeTrack(
      'legL.quaternion', crouchTimes,
      flatQuat(quatIdentity(), quatRotX(40)),
    ),
    new THREE.QuaternionKeyframeTrack(
      'legR.quaternion', crouchTimes,
      flatQuat(quatIdentity(), quatRotX(40)),
    ),
    new THREE.QuaternionKeyframeTrack(
      'armL.quaternion', crouchTimes,
      flatQuat(quatIdentity(), quatRotX(-25)),
    ),
    new THREE.QuaternionKeyframeTrack(
      'armR.quaternion', crouchTimes,
      flatQuat(quatIdentity(), quatRotX(-25)),
    ),
  ]));

  // --- grabbing (0.2 s, one-shot): both arms thrust forward, slight knee bend ---
  const grabTimes = [0, 0.1, 0.2];
  clips.push(new THREE.AnimationClip('grabbing', 0.2, [
    new THREE.QuaternionKeyframeTrack(
      'armL.quaternion', grabTimes,
      flatQuat(quatIdentity(), quatRotX(-90), quatRotX(-90)),
    ),
    new THREE.QuaternionKeyframeTrack(
      'armR.quaternion', grabTimes,
      flatQuat(quatIdentity(), quatRotX(-90), quatRotX(-90)),
    ),
    new THREE.QuaternionKeyframeTrack(
      'legL.quaternion', grabTimes,
      flatQuat(quatIdentity(), quatRotX(15), quatRotX(15)),
    ),
    new THREE.QuaternionKeyframeTrack(
      'legR.quaternion', grabTimes,
      flatQuat(quatIdentity(), quatRotX(15), quatRotX(15)),
    ),
  ]));

  // --- ledgeHang (1.2 s, loop): arms overhead, legs dangling, gentle Z sway ---
  const hangTimes = [0, 0.3, 0.6, 0.9, 1.2];
  clips.push(new THREE.AnimationClip('ledgeHang', 1.2, [
    new THREE.QuaternionKeyframeTrack(
      `${root}.quaternion`, hangTimes,
      flatQuat(
        quatRotZ(0), quatRotZ(3), quatRotZ(0), quatRotZ(-3), quatRotZ(0),
      ),
    ),
    new THREE.QuaternionKeyframeTrack(
      'armL.quaternion', hangTimes,
      flatQuat(
        quatRotX(-135), quatRotX(-135), quatRotX(-135), quatRotX(-135), quatRotX(-135),
      ),
    ),
    new THREE.QuaternionKeyframeTrack(
      'armR.quaternion', hangTimes,
      flatQuat(
        quatRotX(-135), quatRotX(-135), quatRotX(-135), quatRotX(-135), quatRotX(-135),
      ),
    ),
    new THREE.QuaternionKeyframeTrack(
      'legL.quaternion', hangTimes,
      flatQuat(
        quatRotX(25), quatRotX(25), quatRotX(25), quatRotX(25), quatRotX(25),
      ),
    ),
    new THREE.QuaternionKeyframeTrack(
      'legR.quaternion', hangTimes,
      flatQuat(
        quatRotX(25), quatRotX(25), quatRotX(25), quatRotX(25), quatRotX(25),
      ),
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
  const dir = path.join(BASE_DIR, 'public', 'assets', 'characters', char.id);
  fs.mkdirSync(dir, { recursive: true });
  const group = buildCharacter(char.id, char.color);
  const clips = buildAnimations(char.id);
  await exportGLB(group, clips, path.join(dir, `${char.id}.glb`));
}

for (const stage of stages) {
  const dir = path.join(BASE_DIR, 'public', 'assets', 'stages', stage.id);
  fs.mkdirSync(dir, { recursive: true });
  const group = buildStage(stage);
  await exportGLB(group, [], path.join(dir, `${stage.id}.glb`));
}

console.log('All assets generated.');
