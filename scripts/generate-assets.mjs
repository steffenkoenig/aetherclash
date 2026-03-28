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
    default:      buildDefaultChar(group, color); break;
  }

  return group;
}

// ---------------------------------------------------------------------------
// Kael — The Balanced Hero
// Medium warrior with full plate armour, sword on right side, shield on left.
// ---------------------------------------------------------------------------
function buildKael(group, color) {
  const mainMat   = mat(color, 0.2, 0.7);
  const armorMat  = mat(0x8899cc, 0.55, 0.4);
  const darkMat   = mat(0x1a2233, 0.1, 0.9);
  const eyeMat    = mat(0x88ccff, 0.0, 0.4);
  const swordMat  = mat(0xdde8ff, 0.85, 0.15);

  // ── Core animated parts ──────────────────────────────────────────────────
  const torso = new THREE.Mesh(new THREE.BoxGeometry(28, 30, 15), mainMat);
  torso.name = 'torso'; torso.position.set(0, 15, 0); group.add(torso);

  const head = new THREE.Mesh(new THREE.BoxGeometry(20, 22, 17), mainMat);
  head.name = 'head'; head.position.set(0, 41, 0); group.add(head);

  const eyeL = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 2), eyeMat);
  eyeL.name = 'eyeL'; eyeL.position.set(-5, 42, 9.5); group.add(eyeL);
  const eyeR = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 2), eyeMat);
  eyeR.name = 'eyeR'; eyeR.position.set(5, 42, 9.5); group.add(eyeR);

  const armL = new THREE.Mesh(new THREE.BoxGeometry(9, 24, 9), mainMat);
  armL.name = 'armL'; armL.position.set(-21, 14, 0); group.add(armL);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(9, 24, 9), mainMat);
  armR.name = 'armR'; armR.position.set(21, 14, 0); group.add(armR);

  const legL = new THREE.Mesh(new THREE.BoxGeometry(11, 26, 11), mainMat);
  legL.name = 'legL'; legL.position.set(-7, -13, 0); group.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(11, 26, 11), mainMat);
  legR.name = 'legR'; legR.position.set(7, -13, 0); group.add(legR);

  // ── Armour extras ────────────────────────────────────────────────────────
  // Chest plate
  const chest = new THREE.Mesh(new THREE.BoxGeometry(25, 22, 3), armorMat);
  chest.name = 'chestPlate'; chest.position.set(0, 17, 9); group.add(chest);

  // Neck guard
  const neck = new THREE.Mesh(new THREE.BoxGeometry(10, 5, 3), armorMat);
  neck.name = 'neckGuard'; neck.position.set(0, 31, 9); group.add(neck);

  // Shoulder pauldrons
  const pL = new THREE.Mesh(new THREE.BoxGeometry(12, 8, 16), armorMat);
  pL.name = 'pauldronL'; pL.position.set(-22, 30, 0); group.add(pL);
  const pR = new THREE.Mesh(new THREE.BoxGeometry(12, 8, 16), armorMat);
  pR.name = 'pauldronR'; pR.position.set(22, 30, 0); group.add(pR);

  // Belt
  const belt = new THREE.Mesh(new THREE.BoxGeometry(28, 5, 16), darkMat);
  belt.name = 'belt'; belt.position.set(0, 1, 0); group.add(belt);

  // Helmet brow & crest
  const brow = new THREE.Mesh(new THREE.BoxGeometry(22, 4, 4), armorMat);
  brow.name = 'helmetBrow'; brow.position.set(0, 45, 9.5); group.add(brow);
  const crest = new THREE.Mesh(new THREE.BoxGeometry(4, 10, 16), armorMat);
  crest.name = 'helmetCrest'; crest.position.set(0, 54, 0); group.add(crest);

  // Greaves (lower-leg armour)
  const gL = new THREE.Mesh(new THREE.BoxGeometry(12, 14, 12), armorMat);
  gL.name = 'greaveL'; gL.position.set(-7, -22, 1); group.add(gL);
  const gR = new THREE.Mesh(new THREE.BoxGeometry(12, 14, 12), armorMat);
  gR.name = 'greaveR'; gR.position.set(7, -22, 1); group.add(gR);

  // Sword (right side, hanging at rest)
  const blade = new THREE.Mesh(new THREE.BoxGeometry(3, 38, 4), swordMat);
  blade.name = 'swordBlade'; blade.position.set(30, 2, 0); group.add(blade);
  const hilt = new THREE.Mesh(new THREE.BoxGeometry(3, 10, 4), darkMat);
  hilt.name = 'swordHandle'; hilt.position.set(30, 22, 0); group.add(hilt);
  const guard = new THREE.Mesh(new THREE.BoxGeometry(16, 4, 5), darkMat);
  guard.name = 'swordGuard'; guard.position.set(30, 21, 0); group.add(guard);

  // Shield (left arm)
  const shield = new THREE.Mesh(new THREE.BoxGeometry(3, 20, 20), armorMat);
  shield.name = 'shield'; shield.position.set(-26, 8, 0); group.add(shield);
  const emblem = new THREE.Mesh(new THREE.BoxGeometry(2, 8, 8), mat(color, 0.4, 0.5));
  emblem.name = 'shieldEmblem'; emblem.position.set(-28, 8, 0); group.add(emblem);
}

// ---------------------------------------------------------------------------
// Gorun — The Heavy Vanguard
// Massive armoured giant.  Everything is oversized; wields a giant hammer.
// ---------------------------------------------------------------------------
function buildGorun(group, color) {
  const mainMat    = mat(color, 0.3, 0.65);
  const armorMat   = mat(0x333333, 0.7, 0.35);
  const accentMat  = mat(0xff4400, 0.4, 0.5);
  const eyeMat     = mat(0xff6600, 0.0, 0.3);
  const hammerMat  = mat(0x555566, 0.75, 0.3);

  // ── Core animated parts (all oversized) ──────────────────────────────────
  const torso = new THREE.Mesh(new THREE.BoxGeometry(46, 32, 24), mainMat);
  torso.name = 'torso'; torso.position.set(0, 16, 0); group.add(torso);

  const head = new THREE.Mesh(new THREE.BoxGeometry(28, 24, 24), mainMat);
  head.name = 'head'; head.position.set(0, 44, 0); group.add(head);

  // Narrow glowing slit eyes (helmet look)
  const eyeL = new THREE.Mesh(new THREE.BoxGeometry(6, 3, 2), eyeMat);
  eyeL.name = 'eyeL'; eyeL.position.set(-6, 44, 13); group.add(eyeL);
  const eyeR = new THREE.Mesh(new THREE.BoxGeometry(6, 3, 2), eyeMat);
  eyeR.name = 'eyeR'; eyeR.position.set(6, 44, 13); group.add(eyeR);

  const armL = new THREE.Mesh(new THREE.BoxGeometry(16, 26, 16), mainMat);
  armL.name = 'armL'; armL.position.set(-33, 14, 0); group.add(armL);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(16, 26, 16), mainMat);
  armR.name = 'armR'; armR.position.set(33, 14, 0); group.add(armR);

  const legL = new THREE.Mesh(new THREE.BoxGeometry(18, 28, 18), mainMat);
  legL.name = 'legL'; legL.position.set(-12, -14, 0); group.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(18, 28, 18), mainMat);
  legR.name = 'legR'; legR.position.set(12, -14, 0); group.add(legR);

  // ── Armour extras ────────────────────────────────────────────────────────
  // Helmet faceplate
  const face = new THREE.Mesh(new THREE.BoxGeometry(24, 10, 3), armorMat);
  face.name = 'helmetFace'; face.position.set(0, 41, 13.5); group.add(face);
  const brow = new THREE.Mesh(new THREE.BoxGeometry(30, 6, 4), armorMat);
  brow.name = 'helmetBrow'; brow.position.set(0, 51, 13); group.add(brow);

  // Shoulder armour (oversized)
  const sL = new THREE.Mesh(new THREE.BoxGeometry(22, 14, 24), armorMat);
  sL.name = 'shoulderL'; sL.position.set(-33, 32, 0); group.add(sL);
  const sR = new THREE.Mesh(new THREE.BoxGeometry(22, 14, 24), armorMat);
  sR.name = 'shoulderR'; sR.position.set(33, 32, 0); group.add(sR);

  // Chest plate with glowing accent rivets
  const cPlate = new THREE.Mesh(new THREE.BoxGeometry(42, 28, 4), armorMat);
  cPlate.name = 'chestPlate'; cPlate.position.set(0, 18, 13); group.add(cPlate);
  for (const [rx, ry] of [[-10, 22], [10, 22], [-10, 10], [10, 10]]) {
    const rivet = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 3), accentMat);
    rivet.position.set(rx, ry, 15.5); group.add(rivet);
  }

  // Belt plate
  const belt = new THREE.Mesh(new THREE.BoxGeometry(46, 7, 25), armorMat);
  belt.name = 'beltPlate'; belt.position.set(0, 1, 0); group.add(belt);

  // Knee pads
  const kL = new THREE.Mesh(new THREE.BoxGeometry(20, 10, 20), armorMat);
  kL.name = 'kneeL'; kL.position.set(-12, -18, 2); group.add(kL);
  const kR = new THREE.Mesh(new THREE.BoxGeometry(20, 10, 20), armorMat);
  kR.name = 'kneeR'; kR.position.set(12, -18, 2); group.add(kR);

  // Hammer (right side — shaft + head)
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(8, 36, 8), armorMat);
  shaft.name = 'hammerShaft'; shaft.position.set(50, 10, 0); group.add(shaft);
  const hamHead = new THREE.Mesh(new THREE.BoxGeometry(24, 24, 22), hammerMat);
  hamHead.name = 'hammerHead'; hamHead.position.set(50, -5, 0); group.add(hamHead);
  const hamAccent = new THREE.Mesh(new THREE.BoxGeometry(22, 4, 20), accentMat);
  hamAccent.name = 'hammerAccent'; hamAccent.position.set(50, -5, 0); group.add(hamAccent);
}

// ---------------------------------------------------------------------------
// Vela — The Blade Master
// Tall, lean duelist.  Long curved blade, flowing ponytail and cloak elements.
// ---------------------------------------------------------------------------
function buildVela(group, color) {
  const mainMat  = mat(color, 0.15, 0.65);
  const darkMat  = mat(0x111111, 0.1, 0.9);
  const bladeMat = mat(0xccddff, 0.9, 0.1);
  const eyeMat   = mat(0xaaffcc, 0.0, 0.3);
  const clothMat = mat(0x224433, 0.0, 0.95);

  // ── Core animated parts (taller + leaner) ────────────────────────────────
  const torso = new THREE.Mesh(new THREE.BoxGeometry(22, 32, 13), mainMat);
  torso.name = 'torso'; torso.position.set(0, 16, 0); group.add(torso);

  const head = new THREE.Mesh(new THREE.BoxGeometry(18, 22, 15), mainMat);
  head.name = 'head'; head.position.set(0, 43, 0); group.add(head);

  const eyeL = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 2), eyeMat);
  eyeL.name = 'eyeL'; eyeL.position.set(-4, 44, 8.5); group.add(eyeL);
  const eyeR = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 2), eyeMat);
  eyeR.name = 'eyeR'; eyeR.position.set(4, 44, 8.5); group.add(eyeR);

  const armL = new THREE.Mesh(new THREE.BoxGeometry(7, 28, 7), mainMat);
  armL.name = 'armL'; armL.position.set(-16, 14, 0); group.add(armL);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(7, 28, 7), mainMat);
  armR.name = 'armR'; armR.position.set(16, 14, 0); group.add(armR);

  const legL = new THREE.Mesh(new THREE.BoxGeometry(9, 32, 9), mainMat);
  legL.name = 'legL'; legL.position.set(-6, -16, 0); group.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(9, 32, 9), mainMat);
  legR.name = 'legR'; legR.position.set(6, -16, 0); group.add(legR);

  // ── Signature extras ─────────────────────────────────────────────────────
  // Ponytail (3-segment, swept back)
  const pt1 = new THREE.Mesh(new THREE.BoxGeometry(6, 20, 4), mainMat);
  pt1.name = 'ponytail1'; pt1.position.set(0, 51, -9); group.add(pt1);
  const pt2 = new THREE.Mesh(new THREE.BoxGeometry(4, 14, 3), mainMat);
  pt2.name = 'ponytail2'; pt2.position.set(0, 41, -14); group.add(pt2);
  const pt3 = new THREE.Mesh(new THREE.BoxGeometry(3, 10, 3), mainMat);
  pt3.name = 'ponytail3'; pt3.position.set(0, 33, -18); group.add(pt3);

  // Collar / neck scarf
  const collar = new THREE.Mesh(new THREE.BoxGeometry(16, 5, 4), darkMat);
  collar.name = 'collar'; collar.position.set(0, 32, 7.5); group.add(collar);

  // Belt sash
  const sash = new THREE.Mesh(new THREE.BoxGeometry(22, 5, 14), darkMat);
  sash.name = 'beltSash'; sash.position.set(0, 1, 1); group.add(sash);

  // Cloak panels (left and right of torso, angled back)
  const cL = new THREE.Mesh(new THREE.BoxGeometry(4, 28, 2), clothMat);
  cL.name = 'cloakL'; cL.position.set(-13, 6, -7); group.add(cL);
  const cR = new THREE.Mesh(new THREE.BoxGeometry(4, 28, 2), clothMat);
  cR.name = 'cloakR'; cR.position.set(13, 6, -7); group.add(cR);

  // Long curved blade — two-piece (blade + guard)
  const blade = new THREE.Mesh(new THREE.BoxGeometry(3, 52, 4), bladeMat);
  blade.name = 'swordBlade'; blade.position.set(22, -4, 0); group.add(blade);
  const guard = new THREE.Mesh(new THREE.BoxGeometry(16, 3, 5), darkMat);
  guard.name = 'swordGuard'; guard.position.set(22, 21, 0); group.add(guard);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(3, 12, 4), darkMat);
  handle.name = 'swordHandle'; handle.position.set(22, 27, 0); group.add(handle);

  // Boot wraps (lower-leg detail)
  const bL = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), darkMat);
  bL.name = 'bootL'; bL.position.set(-6, -30, 0.5); group.add(bL);
  const bR = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), darkMat);
  bR.name = 'bootR'; bR.position.set(6, -30, 0.5); group.add(bR);
}

// ---------------------------------------------------------------------------
// Syne — The Projectile Tactician
// Slim tech engineer.  Dome helmet, large backpack, energy arm cannon.
// ---------------------------------------------------------------------------
function buildSyne(group, color) {
  const mainMat   = mat(color, 0.2, 0.65);
  const techMat   = mat(0x223344, 0.6, 0.4);
  const glowMat   = mat(0x00ffee, 0.0, 0.3);
  const eyeMat    = mat(0x00eeff, 0.0, 0.2);
  const darkMat   = mat(0x111122, 0.1, 0.9);

  // ── Core animated parts (slim) ────────────────────────────────────────────
  const torso = new THREE.Mesh(new THREE.BoxGeometry(20, 26, 14), mainMat);
  torso.name = 'torso'; torso.position.set(0, 13, 0); group.add(torso);

  const head = new THREE.Mesh(new THREE.BoxGeometry(18, 20, 18), mainMat);
  head.name = 'head'; head.position.set(0, 37, 0); group.add(head);

  // Wide visor-slit eyes
  const eyeL = new THREE.Mesh(new THREE.BoxGeometry(6, 3, 2), eyeMat);
  eyeL.name = 'eyeL'; eyeL.position.set(-5, 37, 9.5); group.add(eyeL);
  const eyeR = new THREE.Mesh(new THREE.BoxGeometry(6, 3, 2), eyeMat);
  eyeR.name = 'eyeR'; eyeR.position.set(5, 37, 9.5); group.add(eyeR);

  const armL = new THREE.Mesh(new THREE.BoxGeometry(7, 22, 7), mainMat);
  armL.name = 'armL'; armL.position.set(-15, 13, 0); group.add(armL);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(7, 22, 7), mainMat);
  armR.name = 'armR'; armR.position.set(15, 13, 0); group.add(armR);

  const legL = new THREE.Mesh(new THREE.BoxGeometry(8, 26, 8), mainMat);
  legL.name = 'legL'; legL.position.set(-6, -13, 0); group.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(8, 26, 8), mainMat);
  legR.name = 'legR'; legR.position.set(6, -13, 0); group.add(legR);

  // ── Tech extras ──────────────────────────────────────────────────────────
  // Dome helmet top
  const dome = new THREE.Mesh(new THREE.BoxGeometry(18, 12, 18), techMat);
  dome.name = 'helmetDome'; dome.position.set(0, 48, 0); group.add(dome);
  // Antenna
  const ant = new THREE.Mesh(new THREE.BoxGeometry(2, 14, 2), glowMat);
  ant.name = 'antenna'; ant.position.set(6, 60, 0); group.add(ant);
  const antTip = new THREE.Mesh(new THREE.BoxGeometry(5, 5, 5), glowMat);
  antTip.name = 'antennaTip'; antTip.position.set(6, 68, 0); group.add(antTip);

  // Visor plate
  const visor = new THREE.Mesh(new THREE.BoxGeometry(18, 5, 3), glowMat);
  visor.name = 'visor'; visor.position.set(0, 37, 10.5); group.add(visor);

  // Backpack (large tech device)
  const pack = new THREE.Mesh(new THREE.BoxGeometry(20, 26, 10), techMat);
  pack.name = 'backpack'; pack.position.set(0, 13, -12); group.add(pack);
  const packOrb = new THREE.Mesh(new THREE.BoxGeometry(8, 8, 8), glowMat);
  packOrb.name = 'packOrb'; packOrb.position.set(0, 15, -17); group.add(packOrb);

  // Belt utility pack
  const bPack = new THREE.Mesh(new THREE.BoxGeometry(16, 5, 14), techMat);
  bPack.name = 'beltPack'; bPack.position.set(0, 1, 0); group.add(bPack);

  // Left arm cannon / mine-deployer
  const cannon = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), techMat);
  cannon.name = 'cannon'; cannon.position.set(-18, 5, 3); group.add(cannon);
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(5, 5, 14), darkMat);
  barrel.name = 'cannonBarrel'; barrel.position.set(-18, 5, 11); group.add(barrel);

  // Tech boots
  const bootL = new THREE.Mesh(new THREE.BoxGeometry(9, 8, 11), techMat);
  bootL.name = 'bootL'; bootL.position.set(-6, -25, 1); group.add(bootL);
  const bootR = new THREE.Mesh(new THREE.BoxGeometry(9, 8, 11), techMat);
  bootR.name = 'bootR'; bootR.position.set(6, -25, 1); group.add(bootR);
}

// ---------------------------------------------------------------------------
// Zira — The Agile Striker
// Compact ultra-light street fighter.  Mohawk, wristbands, knee pads, boots.
// ---------------------------------------------------------------------------
function buildZira(group, color) {
  const mainMat   = mat(color, 0.15, 0.7);
  const darkMat   = mat(0x550011, 0.1, 0.85);
  const accentMat = mat(0xff3300, 0.2, 0.6);
  const eyeMat    = mat(0xff9900, 0.0, 0.3);
  const padMat    = mat(0x222222, 0.2, 0.7);

  // ── Core animated parts (compact + slim) ─────────────────────────────────
  const torso = new THREE.Mesh(new THREE.BoxGeometry(18, 24, 12), mainMat);
  torso.name = 'torso'; torso.position.set(0, 12, 0); group.add(torso);

  const head = new THREE.Mesh(new THREE.BoxGeometry(16, 18, 14), mainMat);
  head.name = 'head'; head.position.set(0, 33, 0); group.add(head);

  const eyeL = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 2), eyeMat);
  eyeL.name = 'eyeL'; eyeL.position.set(-4, 33, 7.5); group.add(eyeL);
  const eyeR = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 2), eyeMat);
  eyeR.name = 'eyeR'; eyeR.position.set(4, 33, 7.5); group.add(eyeR);

  const armL = new THREE.Mesh(new THREE.BoxGeometry(6, 20, 6), mainMat);
  armL.name = 'armL'; armL.position.set(-14, 12, 0); group.add(armL);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(6, 20, 6), mainMat);
  armR.name = 'armR'; armR.position.set(14, 12, 0); group.add(armR);

  const legL = new THREE.Mesh(new THREE.BoxGeometry(8, 28, 8), mainMat);
  legL.name = 'legL'; legL.position.set(-6, -14, 0); group.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(8, 28, 8), mainMat);
  legR.name = 'legR'; legR.position.set(6, -14, 0); group.add(legR);

  // ── Street-fighter extras ────────────────────────────────────────────────
  // Mohawk — three tapering segments
  const m1 = new THREE.Mesh(new THREE.BoxGeometry(4, 14, 14), accentMat);
  m1.name = 'mohawk1'; m1.position.set(0, 48, 0); group.add(m1);
  const m2 = new THREE.Mesh(new THREE.BoxGeometry(3, 10, 10), accentMat);
  m2.name = 'mohawk2'; m2.position.set(0, 57, 0); group.add(m2);
  const m3 = new THREE.Mesh(new THREE.BoxGeometry(2, 7, 7), accentMat);
  m3.name = 'mohawk3'; m3.position.set(0, 65, 0); group.add(m3);

  // Wristbands
  const wL = new THREE.Mesh(new THREE.BoxGeometry(7, 5, 7), padMat);
  wL.name = 'wristL'; wL.position.set(-14, 4, 0); group.add(wL);
  const wR = new THREE.Mesh(new THREE.BoxGeometry(7, 5, 7), padMat);
  wR.name = 'wristR'; wR.position.set(14, 4, 0); group.add(wR);

  // Chest wraps / tank-top stripes
  const stripe1 = new THREE.Mesh(new THREE.BoxGeometry(18, 4, 2), darkMat);
  stripe1.name = 'stripe1'; stripe1.position.set(0, 20, 7); group.add(stripe1);
  const stripe2 = new THREE.Mesh(new THREE.BoxGeometry(18, 4, 2), darkMat);
  stripe2.name = 'stripe2'; stripe2.position.set(0, 10, 7); group.add(stripe2);

  // Knee pads
  const kL = new THREE.Mesh(new THREE.BoxGeometry(9, 7, 9), padMat);
  kL.name = 'kneeL'; kL.position.set(-6, -10, 1.5); group.add(kL);
  const kR = new THREE.Mesh(new THREE.BoxGeometry(9, 7, 9), padMat);
  kR.name = 'kneeR'; kR.position.set(6, -10, 1.5); group.add(kR);

  // Combat boots
  const bootL = new THREE.Mesh(new THREE.BoxGeometry(9, 10, 13), darkMat);
  bootL.name = 'bootL'; bootL.position.set(-6, -26, 2); group.add(bootL);
  const bootR = new THREE.Mesh(new THREE.BoxGeometry(9, 10, 13), darkMat);
  bootR.name = 'bootR'; bootR.position.set(6, -26, 2); group.add(bootR);
  // Toe cap accent
  const toeL = new THREE.Mesh(new THREE.BoxGeometry(9, 4, 4), accentMat);
  toeL.name = 'toeL'; toeL.position.set(-6, -28, 9); group.add(toeL);
  const toeR = new THREE.Mesh(new THREE.BoxGeometry(9, 4, 4), accentMat);
  toeR.name = 'toeR'; toeR.position.set(6, -28, 9); group.add(toeR);
}

// ---------------------------------------------------------------------------
// Default fallback character (simple box-humanoid)
// ---------------------------------------------------------------------------
function buildDefaultChar(group, color) {
  const mainMat = mat(color);
  const eyeMat  = mat(0xffffff);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(26, 28, 16), mainMat);
  torso.name = 'torso'; torso.position.set(0, 14, 0); group.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(20, 20, 18), mainMat);
  head.name = 'head'; head.position.set(0, 38, 0); group.add(head);
  const eyeL = new THREE.Mesh(new THREE.BoxGeometry(5, 5, 2), eyeMat);
  eyeL.name = 'eyeL'; eyeL.position.set(-5, 40, 9); group.add(eyeL);
  const eyeR = new THREE.Mesh(new THREE.BoxGeometry(5, 5, 2), eyeMat);
  eyeR.name = 'eyeR'; eyeR.position.set(5, 40, 9); group.add(eyeR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(8, 24, 8), mainMat);
  armL.name = 'armL'; armL.position.set(-17, 14, 0); group.add(armL);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(8, 24, 8), mainMat);
  armR.name = 'armR'; armR.position.set(17, 14, 0); group.add(armR);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(10, 26, 10), mainMat);
  legL.name = 'legL'; legL.position.set(-7, -13, 0); group.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(10, 26, 10), mainMat);
  legR.name = 'legR'; legR.position.set(7, -13, 0); group.add(legR);
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

  return clips;
}

// ---------------------------------------------------------------------------
// Stage definitions
// ---------------------------------------------------------------------------

const stages = [
  {
    id: 'aetherPlateau',
    platforms: [
      { x1: -425, x2:  425, y:   0, passThru: false },
      { x1: -280, x2: -130, y: 130, passThru: true  },
      { x1:  130, x2:  280, y: 130, passThru: true  },
      { x1: -110, x2:  110, y: 230, passThru: true  },
    ],
    mainColor: 0xC8A86E,
    passColor: 0xD8B87E,
    bgColor:   0xFFD580,
    decorations(group) {
      const cloudY = 150;   // world Y for cloud puffs
      const cloudZ = -150;  // world Z for cloud puffs
      for (const x of [-300, 300]) {
        const cloud = new THREE.Mesh(
          new THREE.SphereGeometry(60, 6, 4),
          new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0, roughness: 1 }),
        );
        cloud.scale.set(2, 1, 1);
        cloud.position.set(x, cloudY, cloudZ);
        group.add(cloud);
      }
    },
  },
  {
    id: 'forge',
    platforms: [
      { x1: -550, x2:  550, y:   0, passThru: false },
      { x1: -350, x2: -150, y: 120, passThru: true  },
      { x1:  150, x2:  350, y: 120, passThru: true  },
    ],
    mainColor: 0x444444,
    passColor: 0x666666,
    bgColor:   0xFF6600,
    decorations(group) {
      for (const x of [-500, -250, 250, 500]) {
        const pillar = new THREE.Mesh(
          new THREE.BoxGeometry(30, 200, 20),
          new THREE.MeshStandardMaterial({
            color: 0xFF4400, metalness: 0, roughness: 0.5,
            emissive: 0xFF2200, emissiveIntensity: 0.3,
          }),
        );
        pillar.position.set(x, -200, -100);
        group.add(pillar);
      }
    },
  },
  {
    id: 'cloudCitadel',
    platforms: [
      { x1: -300, x2:  300, y:   0, passThru: false },
      { x1: -350, x2: -200, y: 160, passThru: true  },
      { x1:  200, x2:  350, y: 160, passThru: true  },
      { x1: -100, x2:  100, y: 100, passThru: true  },
    ],
    mainColor: 0xF0F4FF,
    passColor: 0xCCD0E8,
    bgColor:   0x87CEEB,
    decorations(group) {
      for (const x of [-200, -100, 100, 200]) {
        const spire = new THREE.Mesh(
          new THREE.BoxGeometry(20, 150, 20),
          new THREE.MeshStandardMaterial({ color: 0xCCD0E8, metalness: 0, roughness: 0.8 }),
        );
        spire.position.set(x, 50, -100);
        group.add(spire);
      }
    },
  },
  {
    id: 'ancientRuin',
    platforms: [
      { x1: -400, x2:  400, y:   0, passThru: false },
      { x1: -280, x2: -130, y: 140, passThru: true  },
      { x1:  130, x2:  280, y: 140, passThru: true  },
      { x1:  -60, x2:   60, y: 100, passThru: false },
    ],
    mainColor: 0x7A7060,
    passColor: 0x9A9070,
    bgColor:   0x8B6050,
    decorations(group) {
      for (const x of [-180, -320, 180, 320]) {
        const pillar = new THREE.Mesh(
          new THREE.BoxGeometry(25, 120, 25),
          new THREE.MeshStandardMaterial({ color: 0x8B7355, metalness: 0, roughness: 0.9 }),
        );
        pillar.position.set(x, -30, -80);
        group.add(pillar);
      }
    },
  },
  {
    id: 'digitalGrid',
    platforms: [
      { x1: -400, x2:  400, y:   0, passThru: false },
      { x1: -300, x2: -120, y: 130, passThru: true  },
      { x1:  120, x2:  300, y: 130, passThru: true  },
      { x1:  -80, x2:   80, y: 200, passThru: true  },
    ],
    mainColor: 0x0A1020,
    passColor: 0x0A2040,
    bgColor:   0x0A1020,
    decorations(group) {
      for (let i = 0; i < 10; i++) {
        const line = new THREE.Mesh(
          new THREE.BoxGeometry(1000, 2, 1),
          new THREE.MeshStandardMaterial({
            color: 0x0088FF, metalness: 0, roughness: 0.5,
            emissive: 0x0044FF, emissiveIntensity: 0.5,
          }),
        );
        line.position.set(0, -50 - i * 50, -150);
        group.add(line);
      }
    },
  },
];

/** Build a THREE.Group containing platform meshes, highlights, bg plane, and decorations. */
function buildStage(stageDef) {
  const group = new THREE.Group();
  group.name = `${stageDef.id}_root`;

  // Background plane
  const bgPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(4000, 2000),
    new THREE.MeshStandardMaterial({ color: stageDef.bgColor, metalness: 0, roughness: 1 }),
  );
  bgPlane.name = 'background';
  bgPlane.position.set(0, 0, -200);
  group.add(bgPlane);

  // Platform meshes
  for (const plat of stageDef.platforms) {
    const width = plat.x2 - plat.x1;
    const cx    = (plat.x1 + plat.x2) / 2;
    const color = plat.passThru ? stageDef.passColor : stageDef.mainColor;

    const platMesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, 20, 50),
      new THREE.MeshStandardMaterial({ color, metalness: 0, roughness: 0.8 }),
    );
    platMesh.position.set(cx, plat.y - 10, -20);
    group.add(platMesh);

    // Edge highlight strip on top surface
    const hlColor = lightenColor(color, 0.1);
    const hlMesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, 3, 50),
      new THREE.MeshStandardMaterial({ color: hlColor, metalness: 0, roughness: 0.7 }),
    );
    hlMesh.position.set(cx, plat.y + 1.5, -19);
    group.add(hlMesh);
  }

  stageDef.decorations(group);

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
  const dir = path.join(BASE_DIR, 'public', 'assets', char.id);
  fs.mkdirSync(dir, { recursive: true });
  const group = buildCharacter(char.id, char.color);
  const clips = buildAnimations(char.id);
  await exportGLB(group, clips, path.join(dir, `${char.id}.glb`));
}

for (const stage of stages) {
  const dir = path.join(BASE_DIR, 'public', 'assets', stage.id);
  fs.mkdirSync(dir, { recursive: true });
  const group = buildStage(stage);
  await exportGLB(group, [], path.join(dir, `${stage.id}.glb`));
}

console.log('All assets generated.');
