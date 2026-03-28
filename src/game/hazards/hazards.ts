// src/game/hazards/hazards.ts
// Stage environmental hazards.
//
// All timers are driven by the match frame counter so both peers fire hazards
// on identical frames. RNG calls for random targeting use nextRng().
//
// Hazards implemented:
//   Sector Omega: Cargo Bay  -- Cargo Drone (flies across, 5 % damage + knockback)
//   Pastel Paper Peaks       -- Wind Gust (pushes all fighters left every 60 s)
//   Overgrown Clockwork Spire-- (gear rotation is visual-only; no gameplay hazard)
//   Forge of the Vanguard    -- Lava Geysers (left + right)  [legacy, now Cargo Bay]
//   Cloud Citadel            -- Lightning Strikes (random platform)  [legacy]
//   Digital Grid             -- Phase Transitions (layout swap at 90 s / 30 s)
//   Crystal Caverns          -- Stalactite Drop (random X column, 12 % damage)
//   Solar Pinnacle           -- Solar Flare (right-side damage zone, every 25 s)

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
import { transitionFighterState } from '../../engine/physics/stateMachine.js';

// ── Hazard types ──────────────────────────────────────────────────────────────

export type HazardType =
  | 'forgeGeysers'
  | 'cloudLightning'
  | 'digitalGrid'
  | 'cargoDrone'
  | 'windGust'
  | 'crystalStalactite'
  | 'solarFlare';

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

// ── Cargo Drone state ─────────────────────────────────────────────────────────

const DRONE_INTERVAL_MIN = 1800; // 30 s
const DRONE_INTERVAL_MAX = 3600; // 60 s
/** Width of the drone hitbox in world units (Q16.16). */
const DRONE_HITBOX_HALF_WIDTH = toFixed(30);
/** Y position of the drone flight path (above the main platform). */
const DRONE_Y = toFixed(180);
/** Horizontal speed of the drone per frame (Q16.16). */
const DRONE_SPEED = toFixed(5);

interface CargoDrone {
  /** Frames remaining until the next drone spawns (<= 0 means currently flying). */
  cooldownFrames: number;
  /** Current X position when airborne; meaningless when cooldownFrames > 0. */
  x: Fixed;
  /** +1 = flying right, -1 = flying left. */
  direction: 1 | -1;
  /** True while the drone is crossing the stage. */
  active: boolean;
}

let drone: CargoDrone | null = null;

// ── Wind Gust state ───────────────────────────────────────────────────────────

const WIND_INTERVAL_FRAMES = 3600; // 60 s
const WIND_PUSH_FRAMES      =  120; // 2 s of wind
/** Horizontal impulse per frame applied to all fighters (Q16.16, negative = left). */
const WIND_IMPULSE = toFixed(-0.3);

let windGust: { cooldownFrames: number; activeFrames: number } | null = null;

// ── Crystal Stalactite state ──────────────────────────────────────────────────

const STALACTITE_INTERVAL_MIN = 1200; // 20 s
const STALACTITE_INTERVAL_MAX = 2400; // 40 s
const STALACTITE_WARN_FRAMES  =  180; // 3 s warning
const STALACTITE_DAMAGE        =   12;
/** Half-width of the stalactite impact column (Q16.16). */
const STALACTITE_HALF_WIDTH = toFixed(25);

interface Stalactite {
  cooldownFrames: number;
  warningFrames: number;
  /** X position of the impact column. */
  x: Fixed;
}

let stalactite: Stalactite | null = null;

// ── Solar Flare state ─────────────────────────────────────────────────────────

const FLARE_INTERVAL_FRAMES = 1500; // 25 s
const FLARE_WARN_FRAMES      =  240; // 4 s
const FLARE_ACTIVE_FRAMES    =  120; // 2 s
const FLARE_DAMAGE_PER_FRAME =    2; // % per frame while inside flare zone
/** X boundary: fighters to the right of this X are caught in the flare (Q16.16). */
const FLARE_ZONE_X = toFixed(100);

interface SolarFlare {
  cooldownFrames: number;
  warningFrames: number;
  activeFrames: number;
}

let solarFlare: SolarFlare | null = null;

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
  drone = null;
  windGust = null;
  stalactite = null;
  solarFlare = null;
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

/** Call once when loading the Cargo Bay stage. */
export function initCargoDrone(): void {
  const cd = DRONE_INTERVAL_MIN +
    (nextRng() % (DRONE_INTERVAL_MAX - DRONE_INTERVAL_MIN));
  drone = { cooldownFrames: cd, x: toFixed(0), direction: 1, active: false };
}

/** Call once when loading the Pastel Paper Peaks stage. */
export function initWindGust(): void {
  windGust = { cooldownFrames: WIND_INTERVAL_FRAMES, activeFrames: 0 };
}

/** Call once when loading the Crystal Caverns stage. */
export function initCrystalStalactite(): void {
  const cd = STALACTITE_INTERVAL_MIN +
    (nextRng() % (STALACTITE_INTERVAL_MAX - STALACTITE_INTERVAL_MIN));
  stalactite = { cooldownFrames: cd, warningFrames: -1, x: toFixed(0) };
}

/** Call once when loading the Solar Pinnacle stage. */
export function initSolarFlare(): void {
  solarFlare = { cooldownFrames: FLARE_INTERVAL_FRAMES, warningFrames: -1, activeFrames: 0 };
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

/** Returns cargo drone state: position, direction, and whether it is active. */
export function getCargoDroneState(): { x: Fixed; direction: 1 | -1; active: boolean } | null {
  if (!drone) return null;
  return { x: drone.x, direction: drone.direction, active: drone.active };
}

/** Returns true while the wind-gust event is pushing fighters. */
export function isWindActive(): boolean {
  return (windGust?.activeFrames ?? 0) > 0;
}

/** Returns the X position of the current stalactite impact column, or null. */
export function getStalactiteState(): { x: Fixed; warning: boolean } | null {
  if (!stalactite || stalactite.warningFrames < 0) return null;
  return { x: stalactite.x, warning: stalactite.warningFrames > 0 };
}

/** Returns solar-flare state for the HUD / renderer. */
export function getSolarFlareState(): { warning: boolean; active: boolean } {
  if (!solarFlare) return { warning: false, active: false };
  return {
    warning: solarFlare.warningFrames > 0,
    active:  solarFlare.activeFrames > 0,
  };
}

// ── Main tick ─────────────────────────────────────────────────────────────────

/**
 * Advance hazard state by one physics frame.
 * Call from the main physics step after platformCollisionSystem().
 */
export function tickHazards(): void {
  switch (activeHazard) {
    case 'forgeGeysers':      tickGeysers();          break;
    case 'cloudLightning':    tickLightning();         break;
    case 'digitalGrid':       tickDigitalGrid();       break;
    case 'cargoDrone':        tickCargoDrone();        break;
    case 'windGust':          tickWindGust();          break;
    case 'crystalStalactite': tickCrystalStalactite(); break;
    case 'solarFlare':        tickSolarFlare();        break;
    default: break;
  }
}

// ── Geyser ────────────────────────────────────────────────────────────────────

function tickGeysers(): void {
  for (const g of geysers) {
    if (g.activeFrames > 0) {
      // Geyser is erupting -- damage fighters in column
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
    // Begin warning phase -- pick a random platform
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
      // Bury (stun): transition into hitstun for 120 frames (2 s)
      transitionFighterState(id, 'hitstun', { hitstunFrames: 120 });
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

// ── Cargo Drone ───────────────────────────────────────────────────────────────

function tickCargoDrone(): void {
  if (!drone) return;

  if (drone.active) {
    // Move drone across the stage
    drone.x = (drone.x + drone.direction * DRONE_SPEED) | 0;

    // Check fighter collision
    for (const [id, fighter] of fighterComponents) {
      if (fighter.state === 'KO') continue;
      const t = transformComponents.get(id);
      const p = physicsComponents.get(id);
      if (!t || !p) continue;
      const dx = Math.abs((t.x - drone.x) | 0);
      const dy = Math.abs((t.y - DRONE_Y) | 0);
      if (dx <= DRONE_HITBOX_HALF_WIDTH && dy <= toFixed(30)) {
        // 5% damage + minor horizontal knockback away from drone
        fighter.damagePercent = fixedAdd(fighter.damagePercent, toFixed(5));
        p.vx = (drone.direction > 0 ? toFixed(2) : toFixed(-2));
        p.vy = toFixed(1.5);
        p.grounded = false;
      }
    }

    // Deactivate when the drone has left the stage bounds
    const offScreen = drone.direction > 0
      ? (drone.x | 0) > toFixed(600)
      : (drone.x | 0) < toFixed(-600);
    if (offScreen) {
      drone.active = false;
      const cd = DRONE_INTERVAL_MIN +
        (nextRng() % (DRONE_INTERVAL_MAX - DRONE_INTERVAL_MIN));
      drone.cooldownFrames = cd;
    }
  } else if (drone.cooldownFrames > 0) {
    drone.cooldownFrames--;
  } else {
    // Spawn a new drone from a random side
    drone.active    = true;
    drone.direction = (nextRng() & 1) === 0 ? 1 : -1;
    drone.x         = drone.direction > 0 ? toFixed(-620) : toFixed(620);
  }
}

// ── Wind Gust ─────────────────────────────────────────────────────────────────

function tickWindGust(): void {
  if (!windGust) return;

  if (windGust.activeFrames > 0) {
    // Push all fighters left
    for (const [id, fighter] of fighterComponents) {
      if (fighter.state === 'KO') continue;
      const p = physicsComponents.get(id);
      if (!p) continue;
      p.vx = (p.vx + WIND_IMPULSE) | 0;
    }
    windGust.activeFrames--;
  } else if (windGust.cooldownFrames > 0) {
    windGust.cooldownFrames--;
  } else {
    // Trigger wind event
    windGust.activeFrames  = WIND_PUSH_FRAMES;
    windGust.cooldownFrames = WIND_INTERVAL_FRAMES;
  }
}

// ── Crystal Stalactite ────────────────────────────────────────────────────────

function tickCrystalStalactite(): void {
  if (!stalactite) return;

  if (stalactite.warningFrames > 0) {
    stalactite.warningFrames--;
  } else if (stalactite.warningFrames === 0) {
    // Impact!
    doStalactiteImpact(stalactite.x);
    stalactite.warningFrames = -1;
    const cd = STALACTITE_INTERVAL_MIN +
      (nextRng() % (STALACTITE_INTERVAL_MAX - STALACTITE_INTERVAL_MIN));
    stalactite.cooldownFrames = cd;
  } else if (stalactite.cooldownFrames > 0) {
    stalactite.cooldownFrames--;
  } else {
    // Pick a random X within the main floor bounds and start warning
    const range = toFixed(320);
    stalactite.x = ((nextRng() % (2 * (range >>> 0) + 1)) - (range >>> 0)) | 0;
    stalactite.warningFrames = STALACTITE_WARN_FRAMES;
  }
}

function doStalactiteImpact(impactX: Fixed): void {
  for (const [id, fighter] of fighterComponents) {
    if (fighter.state === 'KO') continue;
    const t = transformComponents.get(id);
    const p = physicsComponents.get(id);
    if (!t || !p) continue;
    if (Math.abs((t.x - impactX) | 0) <= STALACTITE_HALF_WIDTH) {
      fighter.damagePercent = fixedAdd(fighter.damagePercent, toFixed(STALACTITE_DAMAGE));
      // Short stun + downward spike to keep fighters near the floor
      transitionFighterState(id, 'hitstun', { hitstunFrames: 40 });
      p.vy = toFixed(-2);
    }
  }
}

// ── Solar Flare ───────────────────────────────────────────────────────────────

function tickSolarFlare(): void {
  if (!solarFlare) return;

  if (solarFlare.activeFrames > 0) {
    // Damage fighters in the flare zone (right side of stage)
    for (const [id, fighter] of fighterComponents) {
      if (fighter.state === 'KO') continue;
      const t = transformComponents.get(id);
      if (!t) continue;
      if ((t.x | 0) >= (FLARE_ZONE_X | 0)) {
        fighter.damagePercent = fixedAdd(fighter.damagePercent, toFixed(FLARE_DAMAGE_PER_FRAME));
      }
    }
    solarFlare.activeFrames--;
  } else if (solarFlare.warningFrames > 0) {
    solarFlare.warningFrames--;
  } else if (solarFlare.warningFrames === 0) {
    // Transition from warning to active
    solarFlare.warningFrames = -1;
    solarFlare.activeFrames  = FLARE_ACTIVE_FRAMES;
  } else if (solarFlare.cooldownFrames > 0) {
    solarFlare.cooldownFrames--;
  } else {
    // Start the warning phase
    solarFlare.warningFrames  = FLARE_WARN_FRAMES;
    solarFlare.cooldownFrames = FLARE_INTERVAL_FRAMES;
  }
}
