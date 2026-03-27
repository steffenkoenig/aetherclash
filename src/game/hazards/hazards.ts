// src/game/hazards/hazards.ts
// Stage environmental hazards.
//
// All timers are driven by the match frame counter so both peers fire hazards
// on identical frames. RNG calls for random targeting use nextRng().
//
// Hazards implemented:
//   Forge of the Vanguard — Lava Geysers (left + right)
//   Cloud Citadel         — Lightning Strikes (random platform)
//   Digital Grid          — Phase Transitions (layout swap at 90 s / 30 s intervals)

import type { Fixed } from '../../engine/physics/fixednum.js';
import { toFixed, fixedAdd } from '../../engine/physics/fixednum.js';
import {
  physicsComponents,
  fighterComponents,
} from '../../engine/ecs/component.js';
import { transformComponents } from '../../engine/ecs/component.js';
import { nextRng } from '../../engine/physics/lcg.js';
import { platforms } from '../../engine/physics/collision.js';
import type { Platform } from '../../engine/physics/collision.js';

// ── Hazard types ──────────────────────────────────────────────────────────────

export type HazardType = 'forgeGeysers' | 'cloudLightning' | 'digitalGrid';

// ── State ─────────────────────────────────────────────────────────────────────

/** The active hazard type for the current match, or null for none. */
let activeHazard: HazardType | null = null;

// ── Forge Geyser state ────────────────────────────────────────────────────────

const GEYSER_INTERVAL_FRAMES = 1200; // 20 s at 60 Hz
const GEYSER_WARN_FRAMES     =  180; // 3 s warning
const GEYSER_ACTIVE_FRAMES   =  180; // 3 s active

interface Geyser {
  x: Fixed;
  /** Frames until next eruption. */
  cooldownFrames: number;
  /** Frames the jet is still active (0 = not erupting). */
  activeFrames: number;
}

const geysers: Geyser[] = [];

// ── Cloud Citadel Lightning state ─────────────────────────────────────────────

const LIGHTNING_MIN_FRAMES = 900;  // 15 s
const LIGHTNING_MAX_FRAMES = 1800; // 30 s
const LIGHTNING_WARN_FRAMES =  300; // 5 s
const LIGHTNING_STRIKE_DAMAGE = 18;

interface LightningStrike {
  /** Frames until strike. 0 = just struck this frame. */
  warningFrames: number;
  /** Index into platforms array of the targeted platform. */
  targetPlatformIdx: number;
  /** Frames before next strike is scheduled. */
  cooldownFrames: number;
}

let lightning: LightningStrike | null = null;

// ── Digital Grid phase-transition state ───────────────────────────────────────

export const DIGITAL_GRID_PHASE1_FRAMES = 5400; // 90 s
export const DIGITAL_GRID_PHASE2_FRAMES = 1800; // 30 s

let digitalGridPhase: 1 | 2 = 1;
let digitalGridPhaseFrames = 0;

/** Saved Phase 1 and Phase 2 platform layouts (set at stage init). */
let phase1Platforms: Platform[] = [];
let phase2Platforms: Platform[] = [];

// ── Public API ────────────────────────────────────────────────────────────────

export function setHazard(type: HazardType | null): void {
  activeHazard = type;
}

export function clearHazards(): void {
  activeHazard = null;
  geysers.length = 0;
  lightning = null;
  digitalGridPhase = 1;
  digitalGridPhaseFrames = 0;
  phase1Platforms = [];
  phase2Platforms = [];
}

/** Call once when loading the Forge stage, with the two geyser X positions. */
export function initForgeGeysers(leftX: Fixed, rightX: Fixed): void {
  geysers.length = 0;
  geysers.push({ x: leftX,  cooldownFrames: GEYSER_INTERVAL_FRAMES, activeFrames: 0 });
  geysers.push({ x: rightX, cooldownFrames: GEYSER_INTERVAL_FRAMES, activeFrames: 0 });
}

/** Call once when loading the Cloud Citadel stage. */
export function initCloudLightning(): void {
  const cd = LIGHTNING_MIN_FRAMES +
    (nextRng() % (LIGHTNING_MAX_FRAMES - LIGHTNING_MIN_FRAMES));
  lightning = { warningFrames: -1, targetPlatformIdx: 0, cooldownFrames: cd };
}

/** Call once when loading the Digital Grid stage with both layout arrays. */
export function initDigitalGrid(p1: Platform[], p2: Platform[]): void {
  phase1Platforms = p1;
  phase2Platforms = p2;
  digitalGridPhase = 1;
  digitalGridPhaseFrames = 0;
}

// ── Return current state (for rendering / HUD) ────────────────────────────────

/** Returns warning info for each geyser: { x, warning: bool, active: bool } */
export function getGeyserStates(): Array<{ x: Fixed; warning: boolean; active: boolean }> {
  return geysers.map(g => ({
    x: g.x,
    warning: g.cooldownFrames <= GEYSER_WARN_FRAMES && g.activeFrames === 0,
    active:  g.activeFrames > 0,
  }));
}

/** Returns the index of a platform currently targeted by lightning, or -1. */
export function getLightningTarget(): number {
  if (!lightning) return -1;
  if (lightning.warningFrames >= 0) return lightning.targetPlatformIdx;
  return -1;
}

/** Returns the current Digital Grid phase. */
export function getDigitalGridPhase(): 1 | 2 {
  return digitalGridPhase;
}

// ── Main tick ─────────────────────────────────────────────────────────────────

/**
 * Advance hazard state by one physics frame.
 * Call from the main physics step after platformCollisionSystem().
 */
export function tickHazards(): void {
  switch (activeHazard) {
    case 'forgeGeysers':    tickGeysers();    break;
    case 'cloudLightning':  tickLightning();  break;
    case 'digitalGrid':     tickDigitalGrid();break;
    default: break;
  }
}

// ── Geyser ────────────────────────────────────────────────────────────────────

function tickGeysers(): void {
  for (const g of geysers) {
    if (g.activeFrames > 0) {
      // Geyser is erupting — damage fighters in column
      applyGeyserDamage(g);
      g.activeFrames--;
    } else if (g.cooldownFrames > 0) {
      g.cooldownFrames--;
    } else {
      // Erupt
      g.activeFrames   = GEYSER_ACTIVE_FRAMES;
      g.cooldownFrames = GEYSER_INTERVAL_FRAMES;
    }
  }
}

function applyGeyserDamage(g: Geyser): void {
  const COLUMN_WIDTH = toFixed(20);
  for (const [id, fighter] of fighterComponents) {
    if (fighter.state === 'KO') continue;
    const t = transformComponents.get(id);
    const p = physicsComponents.get(id);
    if (!t || !p) continue;
    if (Math.abs((t.x - g.x) | 0) <= COLUMN_WIDTH) {
      // 8% damage per frame of contact
      fighter.damagePercent = fixedAdd(fighter.damagePercent, toFixed(8));
      // Upward knockback
      p.vy = toFixed(4);
      p.grounded = false;
    }
  }
}

// ── Cloud Citadel Lightning ───────────────────────────────────────────────────

function tickLightning(): void {
  if (!lightning) return;

  if (lightning.warningFrames >= 0) {
    // Counting down to the strike
    if (lightning.warningFrames === 0) {
      // STRIKE
      doLightningStrike(lightning.targetPlatformIdx);
      lightning.warningFrames = -1;
      // Schedule next
      const cd = LIGHTNING_MIN_FRAMES +
        (nextRng() % (LIGHTNING_MAX_FRAMES - LIGHTNING_MIN_FRAMES));
      lightning.cooldownFrames = cd;
    } else {
      lightning.warningFrames--;
    }
  } else if (lightning.cooldownFrames > 0) {
    lightning.cooldownFrames--;
  } else {
    // Begin warning phase — pick a random platform
    lightning.targetPlatformIdx = platforms.length > 0
      ? (nextRng() % platforms.length)
      : 0;
    lightning.warningFrames = LIGHTNING_WARN_FRAMES;
  }
}

function doLightningStrike(platformIdx: number): void {
  const plat = platforms[platformIdx];
  if (!plat) return;
  const midX = ((plat.x1 + plat.x2) / 2) | 0;
  for (const [id, fighter] of fighterComponents) {
    if (fighter.state === 'KO') continue;
    const t = transformComponents.get(id);
    const p = physicsComponents.get(id);
    if (!t || !p) continue;
    // Check if fighter is standing on this platform (within Y tolerance)
    if (!p.grounded) continue;
    const onPlat = t.x >= plat.x1 && t.x <= plat.x2 &&
                   Math.abs((t.y - plat.y) | 0) < toFixed(35);
    if (onPlat) {
      fighter.damagePercent = fixedAdd(fighter.damagePercent, toFixed(LIGHTNING_STRIKE_DAMAGE));
      // Bury (stun): set hitstunFrames to 120 = 2 s
      fighter.hitstunFrames = 120;
    }
    void midX; // used implicitly via platform x range check
  }
}

// ── Digital Grid Phase Transition ─────────────────────────────────────────────

function tickDigitalGrid(): void {
  digitalGridPhaseFrames++;

  const threshold = digitalGridPhase === 1
    ? DIGITAL_GRID_PHASE1_FRAMES
    : DIGITAL_GRID_PHASE2_FRAMES;

  if (digitalGridPhaseFrames >= threshold) {
    digitalGridPhaseFrames = 0;
    if (digitalGridPhase === 1) {
      digitalGridPhase = 2;
      applyPlatformLayout(phase2Platforms);
    } else {
      digitalGridPhase = 1;
      applyPlatformLayout(phase1Platforms);
    }
  }
}

function applyPlatformLayout(layout: Platform[]): void {
  platforms.length = 0;
  for (const p of layout) platforms.push(p);
}
