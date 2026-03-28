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
