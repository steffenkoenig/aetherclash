// src/main.ts
// Entry point — shows start menu (character + stage select), then runs the match.

import { toFixed, toFloat, fixedAdd, fixedSub, fixedMul, fixedNeg } from './engine/physics/fixednum.js';
import { createEntity, resetEntityCounter }      from './engine/ecs/entity.js';
import {
  transformComponents,
  physicsComponents,
  fighterComponents,
  renderableComponents,
  SHIELD_MAX_HEALTH,
  type Fighter,
  type Physics,
  type Renderable,
  clearAllComponents,
} from './engine/ecs/component.js';
import { applyGravitySystem }          from './engine/physics/gravity.js';
import {
  platforms,
  platformCollisionSystem,
  fighterBodyCollisionSystem,
  setEntityPassThroughInput,
  setEntityShieldInput,
  setEntityStickX,
  FIGHTER_HALF_HEIGHT,
  FIGHTER_HALF_WIDTH,
  checkHitboxSystem,
  clearHitRegistry,
  setLandingLagLookup,
  lastFrameHits,
} from './engine/physics/collision.js';
import { blastZoneSystem, setBlastZones } from './engine/physics/blastZone.js';
import { seedRng, nextRng } from './engine/physics/lcg.js';
import {
  transitionFighterState,
  tickFighterTimers,
  hitlagMap,
  dodgeFramesMap,
  grabFramesMap,
  airDodgeUsedSet,
  isEntityFrozenByHitlag,
  clearStateMachineMaps,
  landingLagMap,
  lCancelWindowMap,
  L_CANCEL_WINDOW,
  meteorCancelWindowMap,
  wavedashFramesMap,
  ledgeHangFramesMap,
} from './engine/physics/stateMachine.js';
import {
  applyKnockback,
  computeHitstunFrames,
  computeKnockbackForce,
} from './engine/physics/knockback.js';
import { initKeyboard, sampleKeyboard, type InputState } from './engine/input/keyboard.js';
import { InputBuffer }                     from './engine/input/buffer.js';
import {
  initTouchControls,
  sampleTouchInput,
  mergeTouchInput,
} from './engine/input/touch.js';
import {
  initGamepad,
  pollGamepads,
  sampleGamepad,
  mergeGamepadInput,
  setOnGamepadDisconnected,
} from './engine/input/gamepad.js';
import { startLoop, stopLoop }             from './engine/loop.js';
import { initRenderer, render, resetRenderer, resetItemMeshes, setStage } from './renderer/gl.js';
import { updateCamera } from './renderer/camera.js';
import { initHud, updateHud, disposeHud, registerP2KeysGetter }  from './renderer/hud.js';
import {
  initAudio,
  resumeAudio,
  playStageMusic,
  play as playAudio,
  fadeMusicOut,
} from './audio/audio.js';
import {
  triggerScreenShake,
  spawnHitSpark,
  spawnLaunchTrail,
  endLaunchTrail,
  triggerKOFlash,
  updateParticles,
  disposeParticles,
} from './renderer/particles.js';
import { TRUMP_STATS, TRUMP_MOVES }        from './game/characters/trump.js';
import { MUSK_STATS, MUSK_MOVES }          from './game/characters/musk.js';
import { PUTIN_STATS, PUTIN_MOVES }        from './game/characters/putin.js';
import { XI_STATS, XI_MOVES }              from './game/characters/xi.js';
import { LIZZY_STATS, LIZZY_MOVES }        from './game/characters/lizzy.js';
import type { FighterStats } from './engine/ecs/component.js';
import type { Move } from './engine/ecs/component.js';
import {
  AETHER_PLATEAU_PLATFORMS,
  AETHER_PLATEAU_BLAST_ZONES,
} from './game/stages/aetherPlateau.js';
import { FORGE_PLATFORMS, FORGE_BLAST_ZONES }               from './game/stages/forge.js';
import { CLOUD_CITADEL_PLATFORMS, CLOUD_CITADEL_BLAST_ZONES } from './game/stages/cloudCitadel.js';
import { ANCIENT_RUIN_PLATFORMS, ANCIENT_RUIN_BLAST_ZONES } from './game/stages/ancientRuin.js';
import {
  DIGITAL_GRID_PLATFORMS_PHASE1,
  DIGITAL_GRID_BLAST_ZONES,
} from './game/stages/digitalGrid.js';
import { CRYSTAL_CAVERN_PLATFORMS, CRYSTAL_CAVERN_BLAST_ZONES } from './game/stages/crystalCavern.js';
import { VOID_RIFT_PLATFORMS, VOID_RIFT_BLAST_ZONES }           from './game/stages/voidRift.js';
import { SOLAR_PINNACLE_PLATFORMS, SOLAR_PINNACLE_BLAST_ZONES } from './game/stages/solarPinnacle.js';
import { WINDY_HEIGHTS_PLATFORMS, WINDY_HEIGHTS_BLAST_ZONES }   from './game/stages/windyHeights.js';
import { BATTLEFIELD_PLATFORMS, BATTLEFIELD_BLAST_ZONES }       from './game/stages/battlefield.js';
import { matchState, tickFrame, resetMatchState } from './game/state.js';
import {
  clearItems,
  trySpawnItem,
  tickItems,
  setItemSpawnPoints,
  setItemSpawnSetting,
  setCuratedItemMode,
  useHeldItem,
} from './game/items/items.js';
import {
  clearHazards,
  setHazard,
  tickHazards,
  initForgeGeysers,
  initCloudLightning,
  initDigitalGrid,
  initCargoDrone,
  initWindGust,
  initCrystalStalactite,
  initSolarFlare,
  type HazardType,
} from './game/hazards/hazards.js';
import {
  DIGITAL_GRID_PLATFORMS_PHASE2,
} from './game/stages/digitalGrid.js';
import {
  initScreens,
  registerServiceWorker,
  type CharacterId,
  type StageId,
} from './ui/screens.js';

// ── Character lookup tables ───────────────────────────────────────────────────

const CHARACTER_STATS: Record<string, FighterStats> = {
  trump: TRUMP_STATS,
  musk:  MUSK_STATS,
  putin: PUTIN_STATS,
  xi:    XI_STATS,
  lizzy: LIZZY_STATS,
};

const CHARACTER_MOVES: Record<string, Record<string, Move>> = {
  trump: TRUMP_MOVES,
  musk:  MUSK_MOVES,
  putin: PUTIN_MOVES,
  xi:    XI_MOVES,
  lizzy: LIZZY_MOVES,
};

// ── Stage lookup tables ───────────────────────────────────────────────────────

import type { Platform } from './engine/physics/collision.js';
import type { BlastZones } from './engine/physics/blastZone.js';
import type { Fixed } from './engine/physics/fixednum.js';

const STAGE_PLATFORMS: Record<string, Platform[]> = {
  aetherPlateau: AETHER_PLATEAU_PLATFORMS,
  forge:         FORGE_PLATFORMS,
  cloudCitadel:  CLOUD_CITADEL_PLATFORMS,
  ancientRuin:   ANCIENT_RUIN_PLATFORMS,
  digitalGrid:   DIGITAL_GRID_PLATFORMS_PHASE1,
  crystalCavern: CRYSTAL_CAVERN_PLATFORMS,
  voidRift:      VOID_RIFT_PLATFORMS,
  solarPinnacle: SOLAR_PINNACLE_PLATFORMS,
  windyHeights:  WINDY_HEIGHTS_PLATFORMS,
  battlefield:   BATTLEFIELD_PLATFORMS,
};

const STAGE_BLAST_ZONES: Record<string, BlastZones> = {
  aetherPlateau: AETHER_PLATEAU_BLAST_ZONES,
  forge:         FORGE_BLAST_ZONES,
  cloudCitadel:  CLOUD_CITADEL_BLAST_ZONES,
  ancientRuin:   ANCIENT_RUIN_BLAST_ZONES,
  digitalGrid:   DIGITAL_GRID_BLAST_ZONES,
  crystalCavern: CRYSTAL_CAVERN_BLAST_ZONES,
  voidRift:      VOID_RIFT_BLAST_ZONES,
  solarPinnacle: SOLAR_PINNACLE_BLAST_ZONES,
  windyHeights:  WINDY_HEIGHTS_BLAST_ZONES,
  battlefield:   BATTLEFIELD_BLAST_ZONES,
};

/** Item spawn points (floating above platforms) per stage (Q16.16 coordinates). */
const STAGE_SPAWN_POINTS: Record<string, Array<{ x: Fixed; y: Fixed }>> = {
  // Y values must be at FIGHTER_HALF_HEIGHT (30) above the platform surface so
  // fighters standing on that platform can reach the item (pickup range = 60).
  aetherPlateau: [
    { x: toFixed(-200), y: FIGHTER_HALF_HEIGHT }, // main stage left
    { x: toFixed(0),    y: FIGHTER_HALF_HEIGHT }, // main stage centre
    { x: toFixed(200),  y: FIGHTER_HALF_HEIGHT }, // main stage right
    { x: toFixed(0),    y: toFixed(260)         }, // top centre platform (y=230+30)
  ],
  forge: [
    { x: toFixed(-250), y: fixedAdd(toFixed(-30), FIGHTER_HALF_HEIGHT) }, // left deck
    { x: toFixed(250),  y: fixedAdd(toFixed(30),  FIGHTER_HALF_HEIGHT) }, // right deck
    { x: toFixed(-270), y: toFixed(130) }, // left catwalk (y=100+30)
    { x: toFixed(270),  y: toFixed(160) }, // right catwalk (y=130+30)
  ],
  cloudCitadel: [
    { x: toFixed(-200), y: FIGHTER_HALF_HEIGHT }, // main cloud left
    { x: toFixed(0),    y: FIGHTER_HALF_HEIGHT }, // main cloud centre
    { x: toFixed(200),  y: FIGHTER_HALF_HEIGHT }, // main cloud right
    { x: toFixed(0),    y: toFixed(250)         }, // upper cloud (y=220+30)
  ],
  ancientRuin: [
    { x: toFixed(-200), y: FIGHTER_HALF_HEIGHT },
    { x: toFixed(0),    y: FIGHTER_HALF_HEIGHT },
    { x: toFixed(200),  y: FIGHTER_HALF_HEIGHT },
  ],
  digitalGrid: [
    { x: toFixed(-200), y: FIGHTER_HALF_HEIGHT },
    { x: toFixed(0),    y: FIGHTER_HALF_HEIGHT },
    { x: toFixed(200),  y: FIGHTER_HALF_HEIGHT },
  ],
  crystalCavern: [
    { x: toFixed(-180), y: FIGHTER_HALF_HEIGHT }, // main floor left
    { x: toFixed(0),    y: FIGHTER_HALF_HEIGHT }, // main floor centre
    { x: toFixed(180),  y: FIGHTER_HALF_HEIGHT }, // main floor right
    { x: toFixed(-215), y: toFixed(170) },          // left shelf (y=140+30)
    { x: toFixed(215),  y: toFixed(170) },          // right shelf
  ],
  voidRift: [
    { x: toFixed(-90),  y: FIGHTER_HALF_HEIGHT }, // central platform left
    { x: toFixed(0),    y: FIGHTER_HALF_HEIGHT }, // central platform centre
    { x: toFixed(90),   y: FIGHTER_HALF_HEIGHT }, // central platform right
  ],
  solarPinnacle: [
    { x: toFixed(-170), y: FIGHTER_HALF_HEIGHT }, // summit left
    { x: toFixed(0),    y: FIGHTER_HALF_HEIGHT }, // summit centre
    { x: toFixed(170),  y: FIGHTER_HALF_HEIGHT }, // summit right
    { x: toFixed(-370), y: fixedAdd(toFixed(-60), FIGHTER_HALF_HEIGHT) }, // lower-left ledge
    { x: toFixed(370),  y: fixedAdd(toFixed(-60), FIGHTER_HALF_HEIGHT) }, // lower-right ledge
  ],
  windyHeights: [
    { x: toFixed(-200), y: FIGHTER_HALF_HEIGHT },          // main platform left
    { x: toFixed(0),    y: FIGHTER_HALF_HEIGHT },          // main platform centre
    { x: toFixed(200),  y: FIGHTER_HALF_HEIGHT },          // main platform right
    { x: toFixed(-187), y: toFixed(185) },                 // left cloud ledge (y=155+30)
    { x: toFixed(187),  y: toFixed(185) },                 // right cloud ledge (y=155+30)
    { x: toFixed(0),    y: toFixed(298) },                 // top centre cloud (y=268+30)
  ],
  battlefield: [
    { x: toFixed(-200), y: FIGHTER_HALF_HEIGHT },          // main platform left
    { x: toFixed(0),    y: FIGHTER_HALF_HEIGHT },          // main platform centre
    { x: toFixed(200),  y: FIGHTER_HALF_HEIGHT },          // main platform right
    { x: toFixed(-170), y: toFixed(170) },                 // left platform (y=140+30)
    { x: toFixed(0),    y: toFixed(250) },                 // centre platform (y=220+30)
    { x: toFixed(170),  y: toFixed(170) },                 // right platform (y=140+30)
  ],
};

/** Hazard type per stage, or null for none. */
const STAGE_HAZARD: Record<string, HazardType | null> = {
  aetherPlateau: null,
  forge:         'cargoDrone',
  cloudCitadel:  'windGust',
  ancientRuin:   null,
  digitalGrid:   'digitalGrid',
  crystalCavern: 'crystalStalactite',
  voidRift:      null,
  solarPinnacle: 'solarFlare',
  windyHeights:  'windGust',
  battlefield:   null,
};

// ── Air-drift scale and input threshold ──────────────────────────────────────

const AIR_DRIFT_SCALE = toFixed(0.8);
/** Minimum stick magnitude to begin walking (partial tilt). */
const WALK_THRESHOLD  = 0.30;
/** Minimum stick magnitude to transition from walk to run (full tilt). */
const RUN_THRESHOLD   = 0.85;
/** Legacy alias — used for jump/attack/dodge checks. */
const STICK_THRESHOLD = 0.5;

// ── Short hop ─────────────────────────────────────────────────────────────────

/** Jump force scale for a short hop (tap, not hold). Docs: ~40% of full height. */
const SHORT_HOP_SCALE = toFixed(0.4);

/**
 * Per-player jump-hold frame counter.
 * Keyed by entity ID. Incremented while jump is held, reset when jump is released.
 * A value of 1 on the frame the buffer consumes the jump input means it was
 * a single-frame tap → short hop.
 */
const jumpHeldFrames = new Map<number, number>();

/**
 * Per-player C-stick active state from the previous frame.
 * Used to detect the transition from neutral to active (trigger-on-press, not hold).
 */
const prevCStickActive = new Map<number, boolean>();

/**
 * Per-player pummel cooldown frames remaining.
 * Decremented each frame; when > 0 the player cannot pummel again.
 */
const pummelCooldown = new Map<number, number>();

// ── Character-specific status maps ───────────────────────────────────────────

/**
 * Putin: Social Freeze — frames remaining during which the victim cannot use
 * special moves.  Set when `putin_nspecial` connects; decremented each frame.
 */
const specialLockMap = new Map<number, number>();

/**
 * Xi: Social Credit debt stack counter per entity.
 * Each hit from xi_credit1/2/3 increments the stack.  At 5 stacks the counter
 * resets and a speed debuff is applied.
 */
const creditStackMap = new Map<number, number>();

/**
 * Xi: Social Credit speed debuff — frames remaining during which the victim's
 * horizontal velocity is halved.  Applied when creditStackMap reaches 5 stacks.
 */
const speedDebuffMap = new Map<number, number>();

// ── Dodge / grab / shield constants ──────────────────────────────────────────

const SPOT_DODGE_INVINCIBLE_FRAMES = 8;
const SPOT_DODGE_TOTAL_FRAMES      = 20;
const ROLL_INVINCIBLE_FRAMES       = 15;
const ROLL_TOTAL_FRAMES            = 30;
const AIR_DODGE_INVINCIBLE_FRAMES  = 20;
const AIR_DODGE_TOTAL_FRAMES       = 30;
const GRAB_TOTAL_FRAMES            = 60;
const ROLL_SPEED_MULTIPLIER        = toFixed(0.7);

/** Shield health drained per frame while shielding. */
const SHIELD_DRAIN_PER_FRAME = 0.5;
/** Shield health regenerated per frame when not shielding (slow regen). */
const SHIELD_REGEN_PER_FRAME = 0.1;

/** Invincibility frames granted when executing a getup attack from hard knockdown. */
const GETUP_ATTACK_INVINCIBLE_FRAMES = 6;

/**
 * Fraction of run speed applied inward (toward the stage centre) when a
 * fighter jumps or drops off a ledge.  Ensures they clear the stage edge and
 * land on the main platform rather than dropping straight down the blast zone.
 */
const LEDGE_JUMP_INWARD_SCALE = toFixed(0.5);

/**
 * Friction applied per Q16.16 unit of horizontal velocity per frame during a
 * wavedash/waveland slide.  Larger = faster stop; smaller = longer slide.
 */
const WAVEDASH_FRICTION = toFixed(0.5);

// ── Smash charge constants ────────────────────────────────────────────────────

/** Frames the player must hold attack before a smash is fully charged. */
/** Damage/knockback multiplier at full charge (1.0 = uncharged, 1.4 = full). */

// ── Grab / pummel constants ───────────────────────────────────────────────────

/** Damage each pummel hit deals. */
const PUMMEL_DAMAGE = toFixed(2);
/** Frames between pummel hits. */
const PUMMEL_COOLDOWN_FRAMES = 20;
/** Frames the grabbed victim is immobilised after a throw. */
const THROW_VICTIM_HITSTUN_BASE = 20;
/**
 * Horizontal reach of a grab in world units (Q16.16).
 * Measured from the grabber's centre to the far edge of the grab box.
 * Set to 2.5 × FIGHTER_HALF_WIDTH so the grab connects when fighters are
 * standing roughly adjacent to each other.
 */
const GRAB_REACH: number = (FIGHTER_HALF_WIDTH * 5) >> 1; // ≈ toFixed(37.5)
/** Walk speed multiplier while carrying a grabbed opponent (slower than free walk). */
const GRAB_WALK_MULTIPLIER = toFixed(0.5);
/**
 * Horizontal distance from the grabber's centre to the held victim's centre.
 * One fighter-width in front keeps them visually overlapping.
 */
const GRAB_CARRY_OFFSET: number = FIGHTER_HALF_WIDTH << 1; // 2 × FIGHTER_HALF_WIDTH

// ── Up-special recovery constants ────────────────────────────────────────────

/** Horizontal velocity applied by upSpecial in the facing direction. */
const UP_SPECIAL_VX = toFixed(5.0);
/** Vertical velocity applied by upSpecial. */
const UP_SPECIAL_VY = toFixed(18.0);

// ── Player 2 key state (arrow keys + numpad; independent of keyboard.ts) ──────

const p2Down    = new Set<string>();
const p2Pressed = new Set<string>();

window.addEventListener('keydown', (e: KeyboardEvent) => {
  if (!p2Down.has(e.code)) p2Pressed.add(e.code);
  p2Down.add(e.code);
}, { passive: true });

window.addEventListener('keyup', (e: KeyboardEvent) => {
  p2Down.delete(e.code);
  p2Pressed.delete(e.code);
}, { passive: true });

function samplePlayer2Input(): InputState {
  const left  = p2Down.has('ArrowLeft');
  const right = p2Down.has('ArrowRight');
  const down  = p2Down.has('ArrowDown');

  let stickX = 0;
  if (right && !left) stickX = 1.0;
  else if (left && !right) stickX = -1.0;

  const jumpJust    = p2Pressed.has('ArrowUp');
  const attackJust  = p2Pressed.has('Numpad1');
  const specialJust = p2Pressed.has('Numpad2');
  const grabJust    = p2Pressed.has('Numpad3');

  const result: InputState = {
    jump:    p2Down.has('ArrowUp'),
    attack:  p2Down.has('Numpad1'),
    special: p2Down.has('Numpad2'),
    shield:  p2Down.has('Numpad0'),
    grab:    p2Down.has('Numpad3'),
    jumpJustPressed:    jumpJust,
    attackJustPressed:  attackJust,
    specialJustPressed: specialJust,
    grabJustPressed:    grabJust,
    stickX,
    stickY: p2Down.has('ArrowUp') ? 1.0 : down ? -1.0 : 0,
    cStickX: 0,
    cStickY: 0,
  };

  p2Pressed.clear();
  return result;
}

/** Read-only snapshot of currently held P2 key codes (for the HUD key display). */
export function getP2KeysDown(): ReadonlySet<string> {
  return p2Down;
}

// ── Move helpers ──────────────────────────────────────────────────────────────

let MOVE_DATA = new Map<string, Map<string, Move>>();

function getMoves(characterId: string) {
  return MOVE_DATA.get(characterId);
}

// ── Animation sync ────────────────────────────────────────────────────────────

function syncAnimation(fighter: Fighter, renderable: Renderable): void {
  if (renderable.animationClip !== fighter.state) {
    renderable.animationClip  = fighter.state;
    renderable.animationFrame = 0;
    renderable.loop = fighter.state === 'idle' || fighter.state === 'run' || fighter.state === 'crouch';
  }
}

// ── Attack initiation ─────────────────────────────────────────────────────────

function startAttack(playerId: number, fighter: Fighter, phys: Physics, input: InputState): void {
  const moves = getMoves(fighter.characterId);
  let moveId: string;

  if (phys.grounded) {
    if (input.stickY < -STICK_THRESHOLD) {
      // Down: downSmash if available, else downTilt
      moveId = moves?.has('downSmash') ? 'downSmash' : 'downTilt';
    } else if (input.stickY > STICK_THRESHOLD) {
      // Up: upSmash if available, else upTilt
      moveId = moves?.has('upSmash') ? 'upSmash' : 'upTilt';
    } else if (Math.abs(input.stickX) > STICK_THRESHOLD) {
      if (fighter.state === 'run') {
        // Dash attack — dedicated dashAttack move takes priority; fall back to
        // forwardTilt for characters that don't have one yet.
        moveId = moves?.has('dashAttack')  ? 'dashAttack'
               : moves?.has('forwardTilt') ? 'forwardTilt'
               : 'neutralJab';
      } else {
        // Standing forward: forwardSmash
        moveId = moves?.has('forwardSmash') ? 'forwardSmash' : 'forwardTilt';
      }
    } else {
      // Neutral attack: jab combo
      moveId = moves?.has('neutralJab1') ? 'neutralJab1' : 'neutralJab';
    }
  } else {
    // Aerial attacks — directional
    const facingRight = transformComponents.get(playerId)?.facingRight ?? true;
    if (input.stickY > STICK_THRESHOLD) {
      moveId = moves?.has('upAir') ? 'upAir' : 'neutralAir';
    } else if (input.stickY < -STICK_THRESHOLD) {
      moveId = moves?.has('downAir') ? 'downAir' : 'neutralAir';
    } else if (Math.abs(input.stickX) > STICK_THRESHOLD) {
      const isForward = (input.stickX > 0) === facingRight;
      moveId = isForward
        ? (moves?.has('forwardAir') ? 'forwardAir' : 'neutralAir')
        : (moves?.has('backAir')    ? 'backAir'    : 'neutralAir');
    } else {
      moveId = moves?.has('neutralAir') ? 'neutralAir' : 'neutralJab';
    }
  }

  fighter.attackFrame    = 0;
  fighter.currentMoveId  = moveId;
  fighter.smashChargeFrames = 0;
  transitionFighterState(playerId, 'attack');
}

function startSpecial(playerId: number, fighter: Fighter, phys: Physics, input: InputState): void {
  // Putin's Social Freeze: locked fighters cannot use specials.
  if ((specialLockMap.get(playerId) ?? 0) > 0) return;

  let moveId: string;

  if (input.stickY > STICK_THRESHOLD) {
    moveId = 'upSpecial';
  } else if (input.stickY < -STICK_THRESHOLD) {
    moveId = 'downSpecial';
  } else if (Math.abs(input.stickX) > STICK_THRESHOLD) {
    moveId = 'sideSpecial';
  } else {
    moveId = 'neutralSpecial';
  }

  // Up-special recovery: apply launch velocity on frame 0 so the fighter rises
  // even before the hitbox becomes active.  This is the classic SSB64 recovery
  // feel where pressing Up-B immediately lifts you out of disadvantage.
  if (moveId === 'upSpecial') {
    const transform = transformComponents.get(playerId);
    const facingRight = transform?.facingRight ?? true;
    phys.vy            = UP_SPECIAL_VY;
    phys.vx            = facingRight ? UP_SPECIAL_VX : fixedNeg(UP_SPECIAL_VX);
    phys.grounded      = false;
    phys.fastFalling   = false;
    phys.gravityMultiplier = toFixed(1.0);
  }

  fighter.attackFrame    = 0;
  fighter.currentMoveId  = moveId;
  fighter.smashChargeFrames = 0;
  transitionFighterState(playerId, 'attack');
}

// ── Per-player input processing ───────────────────────────────────────────────

function processPlayerInput(
  playerId: number,
  input:    InputState,
  buffer:   InputBuffer,
): void {
  const transform  = transformComponents.get(playerId)!;
  const phys       = physicsComponents.get(playerId)!;
  const fighter    = fighterComponents.get(playerId)!;
  const renderable = renderableComponents.get(playerId)!;

  setEntityShieldInput(playerId, input.shield);
  setEntityStickX(playerId, input.stickX);

  const hitlag = hitlagMap.get(playerId) ?? 0;

  // ── Airborne hitstun: meteor cancel ──────────────────────────────────────
  // While in hitstun in the air with a downward spike, pressing jump within
  // the meteor-cancel window reverses the downward momentum.
  if (fighter.state === 'hitstun' && !phys.grounded) {
    const meteorWin = meteorCancelWindowMap.get(playerId) ?? 0;
    if (meteorWin > 0 && input.jumpJustPressed) {
      phys.vy          = fixedMul(fighter.stats.jumpForce, toFixed(0.5));
      phys.fastFalling = false;
      meteorCancelWindowMap.delete(playerId);
    }
    syncAnimation(fighter, renderable);
    return;
  }

  // ── Grounded hitstun: getup options ──────────────────────────────────────
  // During hard knockdown, the fighter lies on the ground for hitstunFrames.
  // Pressing attack executes a getup attack; shield+direction executes a getup
  // roll.  No input = automatic standup when hitstunFrames expires normally.
  if (fighter.state === 'hitstun' && phys.grounded && fighter.hitstunFrames > 0) {
    if (input.attackJustPressed) {
      // Getup attack: cancel hitstun and execute a getup move with brief invincibility.
      fighter.hitstunFrames = 0;
      const moves = getMoves(fighter.characterId);
      const getupMoveId = moves?.has('getupAttack') ? 'getupAttack' : 'neutralJab1';
      transitionFighterState(playerId, 'idle');       // hitstun → idle
      fighter.attackFrame       = 0;
      fighter.currentMoveId     = getupMoveId;
      fighter.smashChargeFrames = 0;
      fighter.invincibleFrames  = GETUP_ATTACK_INVINCIBLE_FRAMES;
      transitionFighterState(playerId, 'attack');     // idle → attack
    } else if (input.shield && Math.abs(input.stickX) > STICK_THRESHOLD) {
      // Getup roll: cancel hitstun and roll in the direction of the stick.
      fighter.hitstunFrames = 0;
      transitionFighterState(playerId, 'idle');
      transitionFighterState(playerId, 'rolling');
      fighter.invincibleFrames = ROLL_INVINCIBLE_FRAMES;
      dodgeFramesMap.set(playerId, ROLL_TOTAL_FRAMES);
      phys.vx = input.stickX > 0
        ? fixedMul(fighter.stats.runSpeed, ROLL_SPEED_MULTIPLIER)
        : fixedNeg(fixedMul(fighter.stats.runSpeed, ROLL_SPEED_MULTIPLIER));
      transform.facingRight = input.stickX > 0;
    }
    syncAnimation(fighter, renderable);
    return;
  }

  if (
    fighter.state === 'KO'        ||
    fighter.state === 'hitstun'   ||
    fighter.state === 'spotDodge' ||
    fighter.state === 'airDodge'  ||
    fighter.shieldBreakFrames > 0 ||
    hitlag > 0
  ) {
    syncAnimation(fighter, renderable);
    return;
  }

  // ── Grab state: pummel + throw input ─────────────────────────────────────
  if (fighter.state === 'grabbing') {
    const victimId = fighter.grabVictimId;
    const victim   = victimId !== null ? fighterComponents.get(victimId) : null;

    // If the victim escaped (e.g. KO'd, grab timer expired) — release immediately.
    const grabTimer = grabFramesMap.get(playerId) ?? 0;
    if (!victim || victim.state === 'KO' || grabTimer <= 0) {
      fighter.grabVictimId = null;
      transitionFighterState(playerId, 'idle');
      syncAnimation(fighter, renderable);
      return;
    }

    // Keep victim frozen in hitstun for as long as the grab holds.
    if (victim.hitstunFrames <= 1) {
      victim.hitstunFrames = 1;
    }

    // Pummel: attack press while holding — rapid damage, no knockback.
    const cooldown = pummelCooldown.get(playerId) ?? 0;
    if (cooldown > 0) {
      pummelCooldown.set(playerId, cooldown - 1);
    }
    if (input.attackJustPressed && cooldown === 0) {
      victim.damagePercent = fixedAdd(victim.damagePercent, PUMMEL_DAMAGE);
      pummelCooldown.set(playerId, PUMMEL_COOLDOWN_FRAMES);
      playAudio('HIT');
    }

    // Throw: directional + attack (or just attack for forward throw).
    let throwMoveId: string | null = null;
    const facingForThrow = transform.facingRight;
    if (buffer.consume('attack', matchState.frame)) {
      if (input.stickY > STICK_THRESHOLD) {
        throwMoveId = 'upThrow';
      } else if (input.stickY < -STICK_THRESHOLD) {
        throwMoveId = 'downThrow';
      } else if (Math.abs(input.stickX) > STICK_THRESHOLD) {
        const isForward = (input.stickX > 0) === facingForThrow;
        throwMoveId = isForward ? 'forwardThrow' : 'backThrow';
      } else {
        throwMoveId = 'forwardThrow';
      }
    }

    if (throwMoveId !== null && victimId !== null) {
      const moves   = getMoves(fighter.characterId);
      const throwMove = moves?.get(throwMoveId);
      if (throwMove && throwMove.hitboxes.length > 0) {
        const hb = throwMove.hitboxes[0]!;
        // Apply knockback directly to the grabbed victim.
        applyKnockback(victimId, {
          victimDamage:        victim.damagePercent,
          victimWeight:        victim.stats.weightClass,
          moveScaling:         hb.knockbackScaling,
          moveBaseKnockback:   hb.baseKnockback,
          launchAngle:         hb.launchAngle,
          attackerFacingRight: transform.facingRight,
          diX:                 0,
        });
        // Force hitstun from throw.
        const force = computeKnockbackForce({
          victimDamage:        victim.damagePercent,
          victimWeight:        victim.stats.weightClass,
          moveScaling:         hb.knockbackScaling,
          moveBaseKnockback:   hb.baseKnockback,
          launchAngle:         hb.launchAngle,
          attackerFacingRight: transform.facingRight,
          diX:                 0,
        });
        victim.damagePercent = fixedAdd(victim.damagePercent, toFixed(hb.damage));
        victim.hitstunFrames = Math.max(THROW_VICTIM_HITSTUN_BASE, computeHitstunFrames(force));
        transitionFighterState(victimId, 'hitstun');
        // Release grip.
        fighter.grabVictimId = null;
        grabFramesMap.delete(playerId);
        clearHitRegistry(playerId);
        transitionFighterState(playerId, 'idle');
        playAudio('HIT');
      }
    }

    syncAnimation(fighter, renderable);

    // Allow the grabber to walk while carrying the victim.
    // Running is not permitted — cap at walk speed × GRAB_WALK_MULTIPLIER.
    if (phys.grounded) {
      if (input.stickX > WALK_THRESHOLD) {
        phys.vx = fixedMul(fighter.stats.walkSpeed, GRAB_WALK_MULTIPLIER);
        transform.facingRight = true;
      } else if (input.stickX < -WALK_THRESHOLD) {
        phys.vx = fixedNeg(fixedMul(fighter.stats.walkSpeed, GRAB_WALK_MULTIPLIER));
        transform.facingRight = false;
      } else {
        phys.vx = toFixed(0);
      }
    }

    return;
  }

  if (fighter.state === 'rolling') {
    syncAnimation(fighter, renderable);
    return;
  }

  // ── Ledge hang: jump off, drop, or get-up attack ──────────────────────────
  // While hanging on a ledge the fighter can:
  //   • Jump  → ledge jump (full-height leap back onto the stage)
  //   • Down-stick → drop off (fall with no upward velocity but air-jump intact)
  //   • Attack → ledge get-up attack (snap to ground, execute getupAttack move)
  //   • Timer expiry → auto-drop (same as down-stick; prevents infinite stall)
  // An inward horizontal nudge is applied so the fighter naturally lands back on
  // the stage rather than falling straight into the blast zone.
  if (fighter.state === 'ledgeHang') {
    const ledgeTimer = ledgeHangFramesMap.get(playerId) ?? 0;
    const doJump   = input.jumpJustPressed;
    const doDrop   = input.stickY < -STICK_THRESHOLD;
    const doAttack = input.attackJustPressed;

    if (doJump || doDrop || ledgeTimer === 0) {
      // Launch vertically for a ledge jump; just release for a drop.
      phys.vy              = doJump ? fighter.stats.jumpForce : toFixed(0);
      phys.fastFalling     = false;
      phys.gravityMultiplier = toFixed(1.0);
      // Nudge the fighter inward so they clear the stage edge.
      phys.vx = transform.facingRight
        ? fixedMul(fighter.stats.runSpeed, LEDGE_JUMP_INWARD_SCALE)
        : fixedNeg(fixedMul(fighter.stats.runSpeed, LEDGE_JUMP_INWARD_SCALE));
      transitionFighterState(playerId, 'jump');
      // Ledge-jump costs the first air-jump; a drop preserves the double-jump.
      fighter.jumpCount = doJump ? 1 : 0;
    } else if (doAttack) {
      // Ledge get-up attack: snap to grounded position and execute getup attack.
      const moves       = getMoves(fighter.characterId);
      const getupMoveId = moves?.has('getupAttack') ? 'getupAttack' : 'neutralJab1';
      fighter.attackFrame       = 0;
      fighter.currentMoveId     = getupMoveId;
      fighter.smashChargeFrames = 0;
      fighter.invincibleFrames  = GETUP_ATTACK_INVINCIBLE_FRAMES;
      phys.grounded = true;
      phys.vx       = toFixed(0);
      phys.vy       = toFixed(0);
      transitionFighterState(playerId, 'idle');   // ledgeHang → idle
      transitionFighterState(playerId, 'attack'); // idle → attack
    }
    syncAnimation(fighter, renderable);
    return;
  }


  const currentLandingLag = landingLagMap.get(playerId) ?? 0;
  if (currentLandingLag > 0) {
    // Still in landing lag; no action allowed. Allow L-cancel window update.
    syncAnimation(fighter, renderable);
    return;
  }

  // ── L-cancel window: pressing shield while airborne opens a 7-frame window ─
  // If the fighter lands during this window, their aerial landing lag is halved.
  if (!phys.grounded && input.shield) {
    lCancelWindowMap.set(playerId, L_CANCEL_WINDOW);
  }

  setEntityPassThroughInput(playerId, input.stickY < -STICK_THRESHOLD);

  // ── Crouch: grounded + down-stick from idle/walk/run/crouch ──────────────
  // Crouching reduces the fighter's hurtbox to roughly half height and signals
  // to the attack system to use down-tilts when attack is pressed.
  // Releasing the stick (or pressing shield/jump) exits crouch.
  if (
    phys.grounded &&
    !input.shield &&
    input.stickY < -STICK_THRESHOLD &&
    (fighter.state === 'idle'   ||
     fighter.state === 'walk'   ||
     fighter.state === 'run'    ||
     fighter.state === 'crouch')
  ) {
    if (fighter.state !== 'crouch') {
      phys.vx = toFixed(0);
      transitionFighterState(playerId, 'crouch');
    }
    // Allow attacking from crouch — always use downTilt (not downSmash, which
    // requires a stick-flick; crouching hold-down + attack = tilt in every
    // Smash game).  Fall back to a neutral jab if the character has no downTilt.
    if (input.attackJustPressed) {
      if (!useHeldItem(playerId, transform.facingRight)) {
        const crouchMoves = getMoves(fighter.characterId);
        const crouchMoveId = crouchMoves?.has('downTilt') ? 'downTilt' : 'neutralJab1';
        fighter.attackFrame       = 0;
        fighter.currentMoveId     = crouchMoveId;
        fighter.smashChargeFrames = 0;
        transitionFighterState(playerId, 'attack');
      }
    }
    syncAnimation(fighter, renderable);
    return;
  }

  // Exit crouch when stick is released or shield/jump pressed.
  if (fighter.state === 'crouch') {
    transitionFighterState(playerId, 'idle');
  }
  // ── Jump hold tracking (for short-hop detection) ──────────────────────────
  if (input.jump) {
    jumpHeldFrames.set(playerId, (jumpHeldFrames.get(playerId) ?? 0) + 1);
  } else {
    jumpHeldFrames.set(playerId, 0);
  }

  if (input.jumpJustPressed)    buffer.press('jump',    matchState.frame);
  if (input.attackJustPressed)  buffer.press('attack',  matchState.frame);
  if (input.specialJustPressed) buffer.press('special', matchState.frame);
  if (input.grabJustPressed)    buffer.press('grab',    matchState.frame);

  if (fighter.state === 'shielding') {
    fighter.shieldHealth -= SHIELD_DRAIN_PER_FRAME;
    if (fighter.shieldHealth <= 0) {
      fighter.shieldHealth = 0;
      transitionFighterState(playerId, 'idle', { shieldBreakFrames: 180 });
      syncAnimation(fighter, renderable);
      return;
    }
  } else {
    fighter.shieldHealth = Math.min(SHIELD_MAX_HEALTH, fighter.shieldHealth + SHIELD_REGEN_PER_FRAME);
  }

  if (
    input.shield &&
    !phys.grounded &&
    !airDodgeUsedSet.has(playerId) &&
    (fighter.state === 'jump' || fighter.state === 'doubleJump')
  ) {
    transitionFighterState(playerId, 'airDodge');
    fighter.invincibleFrames = AIR_DODGE_INVINCIBLE_FRAMES;
    airDodgeUsedSet.add(playerId);
    dodgeFramesMap.set(playerId, AIR_DODGE_TOTAL_FRAMES);
    if (Math.abs(input.stickX) > STICK_THRESHOLD) {
      phys.vx = input.stickX > 0
        ? fixedMul(fighter.stats.runSpeed, ROLL_SPEED_MULTIPLIER)
        : fixedNeg(fixedMul(fighter.stats.runSpeed, ROLL_SPEED_MULTIPLIER));
    }
    syncAnimation(fighter, renderable);
    return;
  }

  if (input.shield && phys.grounded && fighter.state !== 'attack') {
    if (input.stickY < -STICK_THRESHOLD) {
      const canSpot =
        fighter.state === 'shielding' ||
        fighter.state === 'idle'      ||
        fighter.state === 'walk'      ||
        fighter.state === 'run';
      if (canSpot) {
        transitionFighterState(playerId, 'spotDodge');
        fighter.invincibleFrames = SPOT_DODGE_INVINCIBLE_FRAMES;
        dodgeFramesMap.set(playerId, SPOT_DODGE_TOTAL_FRAMES);
      }
      syncAnimation(fighter, renderable);
      return;
    }

    if (Math.abs(input.stickX) > STICK_THRESHOLD) {
      const canRoll =
        fighter.state === 'shielding' ||
        fighter.state === 'idle'      ||
        fighter.state === 'walk'      ||
        fighter.state === 'run';
      if (canRoll) {
        transitionFighterState(playerId, 'rolling');
        fighter.invincibleFrames = ROLL_INVINCIBLE_FRAMES;
        dodgeFramesMap.set(playerId, ROLL_TOTAL_FRAMES);
        phys.vx = input.stickX > 0
          ? fixedMul(fighter.stats.runSpeed, ROLL_SPEED_MULTIPLIER)
          : fixedNeg(fixedMul(fighter.stats.runSpeed, ROLL_SPEED_MULTIPLIER));
        transform.facingRight = input.stickX > 0;
        syncAnimation(fighter, renderable);
        return;
      }
    }

    if (fighter.state !== 'shielding') {
      transitionFighterState(playerId, 'shielding');
    }
    phys.vx = toFixed(0);
    syncAnimation(fighter, renderable);
    return;
  }

  if (fighter.state === 'shielding') {
    transitionFighterState(playerId, 'idle');
  }

  if (
    phys.grounded &&
    fighter.state !== 'attack'    &&
    fighter.state !== 'shielding'
  ) {
    if (buffer.consume('grab', matchState.frame)) {
      // If holding an item, grab-press throws/uses it instead of grappling
      if (!useHeldItem(playerId, transform.facingRight)) {
        // Scan for an opponent within grab reach in the facing direction.
        let grabbedId: number | null = null;
        for (const [candidateId, candidateFighter] of fighterComponents) {
          if (candidateId === playerId) continue;
          // Cannot grab fighters in these states (KO, invincible dodges, ledge).
          const cs = candidateFighter.state;
          if (cs === 'KO' || cs === 'ledgeHang' || cs === 'rolling' ||
              cs === 'spotDodge' || cs === 'airDodge') continue;
          const ct = transformComponents.get(candidateId);
          if (!ct) continue;
          const dx = ct.x - transform.x;
          const dy = ct.y - transform.y;
          // Must be in front of the grabber and within reach.
          const inFront = transform.facingRight ? dx > 0 : dx < 0;
          const absDx = dx < 0 ? -dx : dx;
          const absDy = dy < 0 ? -dy : dy;
          if (inFront && absDx <= GRAB_REACH && absDy <= (FIGHTER_HALF_WIDTH << 1)) {
            grabbedId = candidateId;
            break;
          }
        }
        if (grabbedId !== null) {
          fighter.grabVictimId = grabbedId;
          // Pin victim in hitstun for the grab duration so they cannot act.
          // Grab beats shield: force shielding victim to idle first so the
          // state machine allows the hitstun transition.
          const victimFighter = fighterComponents.get(grabbedId)!;
          if (victimFighter.state === 'shielding') {
            transitionFighterState(grabbedId, 'idle');
          }
          victimFighter.hitstunFrames = GRAB_TOTAL_FRAMES;
          transitionFighterState(grabbedId, 'hitstun');
          transitionFighterState(playerId, 'grabbing');
          grabFramesMap.set(playerId, GRAB_TOTAL_FRAMES);
          phys.vx = toFixed(0);
          syncAnimation(fighter, renderable);
          return;
        }
      }
    }
  }

  if (fighter.state !== 'attack') {
    if (buffer.consume('attack', matchState.frame)) {
      if (!useHeldItem(playerId, transform.facingRight)) {
        startAttack(playerId, fighter, phys, input);
      }
    } else if (buffer.consume('special', matchState.frame)) {
      startSpecial(playerId, fighter, phys, input);
    } else if (!phys.grounded) {
      // C-stick triggers aerial attacks in the air (SSB64 smash-stick behaviour).
      // Only trigger on the frame the c-stick first crosses the threshold (not held).
      const cActive = Math.abs(input.cStickX) > STICK_THRESHOLD || Math.abs(input.cStickY) > STICK_THRESHOLD;
      const wasActive = prevCStickActive.get(playerId) ?? false;
      prevCStickActive.set(playerId, cActive);
      if (cActive && !wasActive) {
        const cInput: InputState = {
          ...input,
          stickX: input.cStickX,
          stickY: input.cStickY,
        };
        startAttack(playerId, fighter, phys, cInput);
      }
    }
  }

  // Clear c-stick tracking when grounded (reset edge-detection state).
  if (phys.grounded) {
    prevCStickActive.set(playerId, false);
  }

  if (fighter.state === 'attack') {
    fighter.attackFrame++;

    // ── Musk "Glitch" mechanic ────────────────────────────────────────────
    // 1% chance per gadget-move startup frame that the device misfires and
    // deals 10% self-damage + brief hitstun.  Uses the shared LCG so both
    // peers see the same outcome (determinism-safe).
    if (fighter.characterId === 'musk') {
      const gadgetMoves = ['neutralSpecial', 'sideSpecial', 'downSpecial'];
      const mid = fighter.currentMoveId ?? '';
      if (gadgetMoves.includes(mid) && fighter.attackFrame === 1) {
        // nextRng() returns a 32-bit unsigned integer; 1% ≈ value % 100 === 0
        if (nextRng() % 100 === 0) {
          fighter.damagePercent = fixedAdd(fighter.damagePercent, toFixed(10));
          // Self-knockback: small upward flinch, does not cause KO
          const selfPhys = physicsComponents.get(playerId);
          if (selfPhys) {
            selfPhys.vy = toFixed(6);
            selfPhys.grounded = false;
          }
          transitionFighterState(playerId, 'hitstun');
          fighter.hitstunFrames = 18;
          clearHitRegistry(playerId);
          fighter.currentMoveId = null;
          fighter.attackFrame   = 0;
          syncAnimation(fighter, renderable);
          return;
        }
      }
    }

    const moves = getMoves(fighter.characterId);
    const move  = moves?.get(fighter.currentMoveId ?? '');
    if (move) {
      // IASA (Interruptible As Soon As): at the IASA frame, allow jumps and
      // dodge-cancels out of the attack — matching SSB64 behaviour.
      const pastIasa = fighter.attackFrame >= move.iasa;
      if (pastIasa) {
        // Allow jump out of IASA
        if (buffer.consume('jump', matchState.frame)) {
          const heldFor = jumpHeldFrames.get(playerId) ?? 0;
          const isShortHop = heldFor <= 1;
          clearHitRegistry(playerId);
          fighter.currentMoveId = null;
          fighter.attackFrame   = 0;
          if (phys.grounded) {
            phys.vy = isShortHop
              ? fixedMul(fighter.stats.jumpForce, SHORT_HOP_SCALE)
              : fighter.stats.jumpForce;
            phys.grounded          = false;
            phys.fastFalling       = false;
            phys.gravityMultiplier = toFixed(1.0);
            transitionFighterState(playerId, 'jump');
            fighter.jumpCount = 1;
          } else if (fighter.jumpCount < 2) {
            phys.vy                = fighter.stats.doubleJumpForce;
            phys.fastFalling       = false;
            phys.gravityMultiplier = toFixed(1.0);
            transitionFighterState(playerId, 'doubleJump');
            fighter.jumpCount = 2;
          }
          syncAnimation(fighter, renderable);
          return;
        }
      }
      if (fighter.attackFrame >= move.totalFrames) {
        clearHitRegistry(playerId);
        fighter.currentMoveId = null;
        fighter.attackFrame   = 0;
        transitionFighterState(playerId, 'idle');
      }
    }
    syncAnimation(fighter, renderable);
    return;
  }

  if (phys.grounded) {
    const absX = Math.abs(input.stickX);
    if (input.stickX > WALK_THRESHOLD) {
      // Walk vs Run: partial stick = walk, full stick = run
      const isRun = absX >= RUN_THRESHOLD || fighter.state === 'run';
      if (isRun) {
        phys.vx = fighter.stats.runSpeed;
        if (fighter.state !== 'run') transitionFighterState(playerId, 'run');
      } else {
        phys.vx = fighter.stats.walkSpeed;
        if (fighter.state !== 'walk' && fighter.state !== 'run') transitionFighterState(playerId, 'walk');
      }
      transform.facingRight = true;
      wavedashFramesMap.delete(playerId); // directional input breaks wavedash slide
    } else if (input.stickX < -WALK_THRESHOLD) {
      const isRun = absX >= RUN_THRESHOLD || fighter.state === 'run';
      if (isRun) {
        phys.vx = fixedNeg(fighter.stats.runSpeed);
        if (fighter.state !== 'run') transitionFighterState(playerId, 'run');
      } else {
        phys.vx = fixedNeg(fighter.stats.walkSpeed);
        if (fighter.state !== 'walk' && fighter.state !== 'run') transitionFighterState(playerId, 'walk');
      }
      transform.facingRight = false;
      wavedashFramesMap.delete(playerId); // directional input breaks wavedash slide
    } else {
      // No stick input: check for active wavedash momentum before stopping.
      const wdFrames = wavedashFramesMap.get(playerId) ?? 0;
      if (wdFrames > 0) {
        // Waveland/wavedash slide: apply friction-based deceleration each frame
        // instead of instantly zeroing velocity.  This preserves the characteristic
        // sliding feel of a well-timed Melee wavedash.
        if (phys.vx > WAVEDASH_FRICTION) {
          phys.vx = fixedSub(phys.vx, WAVEDASH_FRICTION);
        } else if (phys.vx < fixedNeg(WAVEDASH_FRICTION)) {
          phys.vx = fixedAdd(phys.vx, WAVEDASH_FRICTION);
        } else {
          phys.vx = toFixed(0);
          wavedashFramesMap.delete(playerId);
        }
      } else {
        phys.vx = toFixed(0);
        if (fighter.state === 'run' || fighter.state === 'walk') {
          transitionFighterState(playerId, 'idle');
        }
      }
    }
  } else {
    // SSB64-style aerial drift: accelerate toward target velocity rather than
    // snapping instantly. This preserves knockback momentum in the air and
    // gives the floaty feel of the original game.
    const maxAirSpeed = fixedMul(fighter.stats.runSpeed, AIR_DRIFT_SCALE);
    const AIR_ACCEL   = toFixed(0.7); // units/frame² of horizontal acceleration in air
    if (input.stickX > STICK_THRESHOLD) {
      transform.facingRight = true;
      // Accelerate toward +maxAirSpeed
      const target = maxAirSpeed;
      if (phys.vx < target) {
        phys.vx = Math.min(fixedAdd(phys.vx, AIR_ACCEL), target);
      } else {
        // Already at or above target (e.g. from knockback) — slow toward it
        phys.vx = Math.max(fixedSub(phys.vx, AIR_ACCEL), target);
      }
    } else if (input.stickX < -STICK_THRESHOLD) {
      transform.facingRight = false;
      const target = fixedNeg(maxAirSpeed);
      if (phys.vx > target) {
        phys.vx = Math.max(fixedSub(phys.vx, AIR_ACCEL), target);
      } else {
        phys.vx = Math.min(fixedAdd(phys.vx, AIR_ACCEL), target);
      }
    } else {
      // No stick input: apply light air friction — gradually reduce speed
      // but don't instantly snap to zero. This preserves knockback momentum
      // when the player isn't actively DI-ing.
      const AIR_FRICTION = toFixed(0.08);
      if (phys.vx > AIR_FRICTION) {
        phys.vx = fixedSub(phys.vx, AIR_FRICTION);
      } else if (phys.vx < fixedNeg(AIR_FRICTION)) {
        phys.vx = fixedAdd(phys.vx, AIR_FRICTION);
      } else {
        phys.vx = toFixed(0);
      }
    }
  }

  if (!phys.grounded && input.stickY < -STICK_THRESHOLD && phys.vy <= 0) {
    phys.fastFalling       = true;
    phys.gravityMultiplier = toFixed(2.5);
  }

  // ── Xi Social Credit speed debuff ─────────────────────────────────────
  // When active, halve horizontal velocity (applied after all movement code
  // so it overrides walk/run/air-drift uniformly).
  if ((speedDebuffMap.get(playerId) ?? 0) > 0) {
    phys.vx = fixedMul(phys.vx, toFixed(0.5));
  }

  if (buffer.consume('jump', matchState.frame)) {
    // Short-hop detection: if the jump button has been held for only 1 frame
    // at the moment of execution, apply 40% of full jump height.
    const heldFor = jumpHeldFrames.get(playerId) ?? 0;
    const isShortHop = heldFor <= 1;

    if (phys.grounded) {
      phys.vy                = isShortHop
        ? fixedMul(fighter.stats.jumpForce, SHORT_HOP_SCALE)
        : fighter.stats.jumpForce;
      phys.grounded          = false;
      phys.fastFalling       = false;
      phys.gravityMultiplier = toFixed(1.0);
      transitionFighterState(playerId, 'jump');
      fighter.jumpCount = 1;
    } else if (fighter.jumpCount < 1) {
      phys.vy                = fighter.stats.jumpForce;
      phys.fastFalling       = false;
      phys.gravityMultiplier = toFixed(1.0);
      transitionFighterState(playerId, 'jump');
      fighter.jumpCount = 1;
    } else if (fighter.jumpCount < 2) {
      phys.vy                = fighter.stats.doubleJumpForce;
      phys.fastFalling       = false;
      phys.gravityMultiplier = toFixed(1.0);
      transitionFighterState(playerId, 'doubleJump');
      fighter.jumpCount = 2;
    }
  }

  if (!phys.fastFalling) {
    phys.gravityMultiplier = toFixed(1.0);
  }

  syncAnimation(fighter, renderable);
}

// ── Position integration ──────────────────────────────────────────────────────

function integratePositions(): void {
  for (const [id, phys] of physicsComponents) {
    if (isEntityFrozenByHitlag(id)) continue;
    const transform = transformComponents.get(id);
    if (!transform) continue;
    transform.prevX = transform.x;
    transform.prevY = transform.y;
    transform.x = (transform.x + phys.vx) | 0;
    transform.y = (transform.y + phys.vy) | 0;
  }
}

// ── Grab carry: keep victim glued to grabber after positions are integrated ───

/**
 * After integratePositions, snap every grabbed victim's position to sit just
 * in front of the grabber and zero out their velocity so gravity / friction
 * cannot pull them away during the same frame.
 */
function snapGrabbedFighters(entityIds: number[]): void {
  for (const id of entityIds) {
    const fighter = fighterComponents.get(id);
    if (fighter?.state !== 'grabbing' || fighter.grabVictimId === null) continue;
    const grabberT = transformComponents.get(id);
    const victimT  = transformComponents.get(fighter.grabVictimId);
    const victimP  = physicsComponents.get(fighter.grabVictimId);
    if (!grabberT || !victimT || !victimP) continue;
    victimT.x = grabberT.facingRight
      ? fixedAdd(grabberT.x, GRAB_CARRY_OFFSET)
      : fixedSub(grabberT.x, GRAB_CARRY_OFFSET);
    victimT.y       = grabberT.y;
    victimP.vx      = toFixed(0);
    victimP.vy      = toFixed(0);
    victimP.grounded = true;
  }
}

// ── Debug overlay ─────────────────────────────────────────────────────────────

const debugDiv = document.createElement('div');
debugDiv.id = 'debug-overlay';
Object.assign(debugDiv.style, {
  position:     'absolute',
  top:          '10px',
  left:         '10px',
  color:        '#0f0',
  fontFamily:   'monospace',
  fontSize:     '13px',
  pointerEvents: 'none',
  zIndex:       '100',
  textShadow:   '1px 1px 2px #000',
  whiteSpace:   'pre',
});
document.body.appendChild(debugDiv);

let fpsFrameCount = 0;
let fpsAccumMs    = 0;
let fps           = 0;
let lastRenderTime = performance.now();

// Mutable player IDs — set by startMatch()
let player1Id = -1;
let player2Id = -1;
let p1CharId  = 'trump';
let p2CharId  = 'putin';

// ── Pause menu ────────────────────────────────────────────────────────────────

let pauseOverlay: HTMLDivElement | null = null;
let matchPauseCallback: (() => void) | null = null;
let matchResumeCallback: (() => void) | null = null;

function showPauseMenu(): void {
  if (pauseOverlay) return; // already showing

  pauseOverlay = document.createElement('div');
  Object.assign(pauseOverlay.style, {
    position:       'fixed',
    inset:          '0',
    zIndex:         '250',
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    justifyContent: 'center',
    background:     'rgba(0,0,0,0.75)',
    fontFamily:     'monospace',
    color:          '#fff',
  });

  const title = document.createElement('h2');
  title.textContent = 'PAUSED';
  Object.assign(title.style, {
    fontSize:      '40px',
    fontWeight:    'bold',
    letterSpacing: '0.1em',
    marginBottom:  '32px',
  });
  pauseOverlay.appendChild(title);

  const btnStyle = {
    padding:      '14px 40px',
    fontSize:     '18px',
    fontFamily:   'monospace',
    border:       'none',
    borderRadius: '6px',
    cursor:       'pointer',
    marginBottom: '12px',
  };

  const resumeBtn = document.createElement('button');
  resumeBtn.textContent = '▶ Resume';
  Object.assign(resumeBtn.style, { ...btnStyle, background: '#4499FF', color: '#fff' });
  resumeBtn.onclick = () => hidePauseMenu();
  pauseOverlay.appendChild(resumeBtn);

  const quitBtn = document.createElement('button');
  quitBtn.textContent = '← Quit to Menu';
  Object.assign(quitBtn.style, { ...btnStyle, background: '#555', color: '#fff' });
  quitBtn.onclick = () => {
    hidePauseMenu();
    matchPauseCallback?.();
    location.reload();
  };
  pauseOverlay.appendChild(quitBtn);

  document.body.appendChild(pauseOverlay);
  resumeBtn.focus();
}

function hidePauseMenu(): void {
  if (!pauseOverlay) return;
  pauseOverlay.parentNode?.removeChild(pauseOverlay);
  pauseOverlay = null;
  matchResumeCallback?.();
}

/** Keydown handler active during a match (Escape = toggle pause). */
function onMatchKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    if (pauseOverlay) {
      hidePauseMenu();
    } else {
      showPauseMenu();
    }
  }
}

function disposePauseMenu(): void {
  window.removeEventListener('keydown', onMatchKeydown);
  if (pauseOverlay) {
    pauseOverlay.parentNode?.removeChild(pauseOverlay);
    pauseOverlay = null;
  }
  matchPauseCallback  = null;
  matchResumeCallback = null;
}

// ── Match result overlay ──────────────────────────────────────────────────────

function showMatchResult(winnerLabel: string): void {
  const overlay = document.createElement('div');
  Object.assign(overlay.style, {
    position:       'fixed',
    inset:          '0',
    zIndex:         '300',
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    justifyContent: 'center',
    background:     'rgba(0,0,0,0.80)',
    fontFamily:     'monospace',
    color:          '#fff',
  });

  const title = document.createElement('h1');
  title.textContent = `${winnerLabel} WINS!`;
  Object.assign(title.style, {
    fontSize:      '56px',
    fontWeight:    'bold',
    letterSpacing: '0.08em',
    textShadow:    '0 0 20px #fff',
    marginBottom:  '32px',
  });

  const rematch = document.createElement('button');
  rematch.textContent = '▶ Rematch';
  Object.assign(rematch.style, {
    padding:     '14px 40px',
    fontSize:    '18px',
    fontFamily:  'monospace',
    background:  '#4499FF',
    color:       '#fff',
    border:      'none',
    borderRadius: '6px',
    cursor:      'pointer',
    marginRight: '16px',
  });
  rematch.onclick = () => {
    overlay.remove();
    startMatch(p1CharId as import('./ui/screens.js').CharacterId,
               p2StageId as import('./ui/screens.js').StageId);
  };

  const menu = document.createElement('button');
  menu.textContent = '← Menu';
  Object.assign(menu.style, {
    padding:     '14px 40px',
    fontSize:    '18px',
    fontFamily:  'monospace',
    background:  '#555',
    color:       '#fff',
    border:      'none',
    borderRadius: '6px',
    cursor:      'pointer',
  });
  menu.onclick = () => {
    overlay.remove();
    location.reload();
  };

  const row = document.createElement('div');
  row.style.display = 'flex';
  row.appendChild(rematch);
  row.appendChild(menu);

  overlay.appendChild(title);
  overlay.appendChild(row);
  document.body.appendChild(overlay);
}

// Tracks the stage used by the current match so Rematch can replay it.
let p2StageId = 'aetherPlateau';

function updateDebugOverlay(): void {
  if (player1Id < 0) return;
  const t1 = transformComponents.get(player1Id);
  const p1 = physicsComponents.get(player1Id);
  const f1 = fighterComponents.get(player1Id);

  const t2 = transformComponents.get(player2Id);
  const f2 = fighterComponents.get(player2Id);

  const now = performance.now();
  fpsAccumMs += now - lastRenderTime;
  lastRenderTime = now;
  fpsFrameCount++;
  if (fpsAccumMs >= 500) {
    fps = Math.round((fpsFrameCount * 1000) / fpsAccumMs);
    fpsFrameCount = 0;
    fpsAccumMs    = 0;
  }

  const p1Pos = t1 ? `x=${toFloat(t1.x).toFixed(1)} y=${toFloat(t1.y).toFixed(1)}` : '—';
  const p2Pos = t2 ? `x=${toFloat(t2.x).toFixed(1)} y=${toFloat(t2.y).toFixed(1)}` : '—';

  debugDiv.textContent = [
    `Frame : ${matchState.frame}   FPS: ${fps}`,
    `P1 [${p1CharId}]  state=${f1?.state ?? '?'}  ${p1Pos}  dmg=${toFloat(f1?.damagePercent ?? 0).toFixed(1)}%  stk=${f1?.stocks ?? 0}  gnd=${p1?.grounded ?? false}`,
    `P2 [${p2CharId}]  state=${f2?.state ?? '?'}  ${p2Pos}  dmg=${toFloat(f2?.damagePercent ?? 0).toFixed(1)}%  stk=${f2?.stocks ?? 0}`,
  ].join('\n');
}

// ── Match startup ─────────────────────────────────────────────────────────────

function startMatch(p1Char: CharacterId, stageId: StageId): void {
  // The player 2 character is always the "other" one from the lobby default.
  // In local play we just pick the next character; in the future this would
  // come from a 2-player select screen. For now we default to gorun/kael.
  const p2Char = (p1Char === 'trump' ? 'putin' : 'trump') as CharacterId;
  p1CharId  = p1Char;
  p2CharId  = p2Char;
  p2StageId = stageId;

  // ── Audio ──────────────────────────────────────────────────────────────
  // initAudio() is a no-op after the first call, but requires a prior user
  // gesture — startMatch() is always triggered by a button click.
  initAudio();
  resumeAudio();
  playStageMusic(stageId);

  // ── Reset simulation state ─────────────────────────────────────────────
  clearAllComponents();
  clearStateMachineMaps();
  resetEntityCounter();
  resetMatchState();
  clearHitRegistry();
  seedRng(0); // reset deterministic RNG so every match starts from the same sequence
  platforms.length = 0;
  clearItems();
  clearHazards();
  specialLockMap.clear();
  creditStackMap.clear();
  speedDebuffMap.clear();

  // ── Stage ──────────────────────────────────────────────────────────────
  platforms.push(...(STAGE_PLATFORMS[stageId] ?? AETHER_PLATEAU_PLATFORMS));
  setBlastZones(STAGE_BLAST_ZONES[stageId] ?? AETHER_PLATEAU_BLAST_ZONES);

  // ── Items — spawn points and default setting ───────────────────────────
  setItemSpawnPoints(STAGE_SPAWN_POINTS[stageId] ?? STAGE_SPAWN_POINTS['aetherPlateau']!);
  setItemSpawnSetting('medium');
  setCuratedItemMode(false); // normal mode; flip to true for competitive play

  // ── Stage hazards ──────────────────────────────────────────────────────
  const hazardType = STAGE_HAZARD[stageId] ?? null;
  setHazard(hazardType);
  if (hazardType === 'forgeGeysers') {
    initForgeGeysers(toFixed(-440), toFixed(440));
  } else if (hazardType === 'cloudLightning') {
    initCloudLightning();
  } else if (hazardType === 'digitalGrid') {
    initDigitalGrid(DIGITAL_GRID_PLATFORMS_PHASE1, DIGITAL_GRID_PLATFORMS_PHASE2);
  } else if (hazardType === 'cargoDrone') {
    initCargoDrone();
  } else if (hazardType === 'windGust') {
    initWindGust();
  } else if (hazardType === 'crystalStalactite') {
    initCrystalStalactite();
  } else if (hazardType === 'solarFlare') {
    initSolarFlare();
  }

  // ── Move data ──────────────────────────────────────────────────────────
  MOVE_DATA = new Map(
    Object.entries(CHARACTER_MOVES).map(([id, moves]) => [id, new Map(Object.entries(moves))]),
  );

  // Register landing-lag lookup for the collision system.
  // This lets collision.ts resolve move.landingLag without importing MOVE_DATA directly.
  setLandingLagLookup((entityId, moveId) => {
    const fighter = fighterComponents.get(entityId);
    if (!fighter) return undefined;
    return MOVE_DATA.get(fighter.characterId)?.get(moveId);
  });

  // ── Player 1 entity ────────────────────────────────────────────────────
  player1Id = createEntity();

  transformComponents.set(player1Id, {
    x:          toFixed(-100),
    y:          FIGHTER_HALF_HEIGHT,
    prevX:      toFixed(-100),
    prevY:      FIGHTER_HALF_HEIGHT,
    facingRight: true,
  });
  physicsComponents.set(player1Id, {
    vx: toFixed(0), vy: toFixed(0),
    gravityMultiplier: toFixed(1.0),
    grounded: true, fastFalling: false,
  });
  fighterComponents.set(player1Id, {
    characterId:      p1Char,
    state:            'idle',
    damagePercent:    toFixed(0),
    stocks:           3,
    jumpCount:        0,
    hitstunFrames:    0,
    invincibleFrames: 0,
    hitlagFrames:     0,
    shieldHealth:     100,
    shieldBreakFrames: 0,
    attackFrame:      0,
    currentMoveId:    null,
    grabVictimId:     null,
    smashChargeFrames: 0,
    stats:            CHARACTER_STATS[p1Char] ?? TRUMP_STATS,
  });
  renderableComponents.set(player1Id, {
    meshUrl:        `/assets/characters/${p1Char}/${p1Char}.glb`,
    atlasUrl:       `/assets/characters/${p1Char}/${p1Char}_atlas.png`,
    animationClip:  'idle',
    animationFrame: 0,
    animationSpeed: 1.0,
    loop:           true,
  });

  // ── Player 2 entity ────────────────────────────────────────────────────
  player2Id = createEntity();

  transformComponents.set(player2Id, {
    x:          toFixed(100),
    y:          FIGHTER_HALF_HEIGHT,
    prevX:      toFixed(100),
    prevY:      FIGHTER_HALF_HEIGHT,
    facingRight: false,
  });
  physicsComponents.set(player2Id, {
    vx: toFixed(0), vy: toFixed(0),
    gravityMultiplier: toFixed(1.0),
    grounded: true, fastFalling: false,
  });
  fighterComponents.set(player2Id, {
    characterId:      p2Char,
    state:            'idle',
    damagePercent:    toFixed(0),
    stocks:           3,
    jumpCount:        0,
    hitstunFrames:    0,
    invincibleFrames: 0,
    hitlagFrames:     0,
    shieldHealth:     100,
    shieldBreakFrames: 0,
    attackFrame:      0,
    currentMoveId:    null,
    grabVictimId:     null,
    smashChargeFrames: 0,
    stats:            CHARACTER_STATS[p2Char] ?? PUTIN_STATS,
  });
  renderableComponents.set(player2Id, {
    meshUrl:        `/assets/characters/${p2Char}/${p2Char}.glb`,
    atlasUrl:       `/assets/characters/${p2Char}/${p2Char}_atlas.png`,
    animationClip:  'idle',
    animationFrame: 0,
    animationSpeed: 1.0,
    loop:           true,
  });

  // ── Input buffers ──────────────────────────────────────────────────────
  const buffer1 = new InputBuffer();
  const buffer2 = new InputBuffer();

  // ── Per-player previous-frame state (for particle effect detection) ────
  const prevState: Record<number, string> = {
    [player1Id]: 'idle',
    [player2Id]: 'idle',
  };

  // ── HUD ────────────────────────────────────────────────────────────────
  disposeHud();
  disposeParticles();
  disposePauseMenu();
  registerP2KeysGetter(getP2KeysDown);
  initHud([player1Id, player2Id]);
  resetItemMeshes();
  resetRenderer();
  setStage(stageId);

  // Accent colours for hit sparks (must match CHARACTER_COLORS in gl.ts)
  const CHARACTER_ACCENT: Record<string, string> = {
    trump: '#ff8800',
    musk:  '#00aaff',
    putin: '#4c7c4c',
    xi:    '#cc2222',
    lizzy: '#88ccff',
  };

  /** Scale from damage percentage to launch-trail force threshold (renderer only). */
  const DAMAGE_TO_FORCE_SCALE = 0.3;

  // ── Game loop ──────────────────────────────────────────────────────────
  stopLoop();
  let lastRenderMs = performance.now();

  // Store callbacks so the pause menu can resume with them
  function physicsStep(): void {
    tickFighterTimers(player1Id);
    tickFighterTimers(player2Id);

    // Poll gamepad API and merge with keyboard / touch input
    pollGamepads();
    const input1 = mergeGamepadInput(
      mergeTouchInput(sampleKeyboard(),     sampleTouchInput(0)),
      sampleGamepad(0),
    );
    const input2 = mergeGamepadInput(
      mergeTouchInput(samplePlayer2Input(), sampleTouchInput(1)),
      sampleGamepad(1),
    );

    processPlayerInput(player1Id, input1, buffer1);
    processPlayerInput(player2Id, input2, buffer2);

    // Build an InputState map so checkHitboxSystem can apply DI
    const inputMap = new Map([
      [player1Id, input1],
      [player2Id, input2],
    ]);

    integratePositions();
    snapGrabbedFighters([player1Id, player2Id]);
    applyGravitySystem();
    platformCollisionSystem();
    fighterBodyCollisionSystem([player1Id, player2Id]);
    checkHitboxSystem([player1Id, player2Id], MOVE_DATA, inputMap);

    // ── Character-specific on-hit effects ─────────────────────────────────
    for (const hit of lastFrameHits) {
      const { attackerId, victimId, attackerCharId, hitboxId } = hit;

      // Putin Social Freeze: neutralSpecial disables victim's specials 3 s (180 frames)
      if (attackerCharId === 'putin' && hitboxId === 'putin_nspecial') {
        specialLockMap.set(victimId, 180);
      }

      // Xi Social Credit: debt stack accumulates; 5 stacks → speed debuff 5 s (300 frames)
      if (attackerCharId === 'xi' &&
          (hitboxId === 'xi_credit1' || hitboxId === 'xi_credit2' || hitboxId === 'xi_credit3')) {
        const stacks = (creditStackMap.get(victimId) ?? 0) + 1;
        if (stacks >= 5) {
          creditStackMap.delete(victimId);
          speedDebuffMap.set(victimId, 300);
          // Visual: spawn a red "SANCTIONED" spark burst at the victim
          const vTransform = transformComponents.get(victimId);
          if (vTransform) spawnHitSpark(toFloat(vTransform.x), toFloat(vTransform.y), '#cc2222');
        } else {
          creditStackMap.set(victimId, stacks);
        }
      }

      // Lizzy Royal Decree: freeze victim for 1.5 s (90 frames); Lizzy is exempt
      if (attackerCharId === 'lizzy' && hitboxId === 'lizzy_decree_freeze') {
        const victimFighter = fighterComponents.get(victimId);
        if (victimFighter) {
          hitlagMap.set(victimId, 90);
          victimFighter.hitlagFrames = 90;
        }
        // Clear the attacker's own hitlag so only the victim is frozen
        const attackerFighter = fighterComponents.get(attackerId);
        if (attackerFighter) {
          hitlagMap.set(attackerId, 0);
          attackerFighter.hitlagFrames = 0;
        }
      }
    }

    // ── Decrement character-specific status timers ─────────────────────────
    for (const entityId of [player1Id, player2Id]) {
      const sl = specialLockMap.get(entityId);
      if (sl !== undefined) {
        if (sl <= 1) specialLockMap.delete(entityId);
        else specialLockMap.set(entityId, sl - 1);
      }
      const sd = speedDebuffMap.get(entityId);
      if (sd !== undefined) {
        if (sd <= 1) speedDebuffMap.delete(entityId);
        else speedDebuffMap.set(entityId, sd - 1);
      }
    }

    blastZoneSystem();
    trySpawnItem(matchState.frame);
    tickItems(matchState.frame);
    tickHazards();

    // ── Particle effect triggers (state-transition detection) ──────────────
    for (const entityId of [player1Id, player2Id]) {
      const fighter   = fighterComponents.get(entityId);
      const transform = transformComponents.get(entityId);
      if (!fighter || !transform) continue;

      const prev = prevState[entityId] ?? 'idle';
      const curr = fighter.state;

      if (curr !== prev) {
        const wx = toFloat(transform.x);
        const wy = toFloat(transform.y);
        const color = CHARACTER_ACCENT[fighter.characterId] ?? '#ffffff';

        // Fighter just entered hitstun → hit confirmed → spawn sparks + shake + SFX
        if (curr === 'hitstun') {
          spawnHitSpark(wx, wy, color);
          const dmgFloat = toFloat(fighter.damagePercent);
          if (dmgFloat >= 80) {
            triggerScreenShake(12, 300); // smash-level
            playAudio('STRONG_HIT');
          } else {
            triggerScreenShake(6, 200);  // standard hit
            playAudio('HIT');
          }
        }

        // Fighter just entered KO → KO flash + strong shake + SFX
        if (curr === 'KO') {
          triggerKOFlash();
          triggerScreenShake(20, 500);
          playAudio('KO');
        }

        // Jump / double-jump SFX
        if (curr === 'jump') {
          playAudio('JUMP');
        } else if (curr === 'doubleJump') {
          playAudio('DOUBLE_JUMP');
        }

        // Shield break SFX
        if (prev !== 'shielding' && fighter.shieldBreakFrames > 0) {
          playAudio('SHIELD_BREAK');
        }

        // Landing (any aerial → grounded state transition while in air)
        const wasAerial = prev === 'jump' || prev === 'doubleJump' || prev === 'airDodge' || prev === 'hitstun';
        const isGrounded = physicsComponents.get(entityId)?.grounded ?? false;
        if (wasAerial && isGrounded) {
          playAudio('LAND');
        }

        // Fighter left hitstun → end launch trail
        if (prev === 'hitstun' && curr !== 'hitstun') {
          endLaunchTrail(entityId);
        }

        prevState[entityId] = curr;
      }

      // While in hitstun, keep updating the launch trail
      if (fighter.state === 'hitstun') {
        const wx = toFloat(transform.x);
        const wy = toFloat(transform.y);
        const dmgFloat = toFloat(fighter.damagePercent);
        spawnLaunchTrail(entityId, wx, wy, dmgFloat * DAMAGE_TO_FORCE_SCALE);
      }
    }

    // ── Match-end detection ────────────────────────────────────────────────
    const mf1 = fighterComponents.get(player1Id);
    const mf2 = fighterComponents.get(player2Id);
    if ((mf1 && mf1.stocks <= 0) || (mf2 && mf2.stocks <= 0)) {
      const winnerLabel = (mf2 && mf2.stocks <= 0)
        ? p1CharId.charAt(0).toUpperCase() + p1CharId.slice(1)
        : p2CharId.charAt(0).toUpperCase() + p2CharId.slice(1);
      fadeMusicOut(1.5);
      stopLoop();
      disposePauseMenu();
      showMatchResult(winnerLabel);
      return;
    }

    updateCamera([player1Id, player2Id]);

    tickFrame();
  }

  function renderStep(alpha: number): void {
    render(platforms, alpha);
    updateHud();
    updateDebugOverlay();

    // Advance and render all particle / VFX systems
    const nowMs   = performance.now();
    const deltaMs = Math.min(nowMs - lastRenderMs, 50);
    lastRenderMs  = nowMs;
    updateParticles(deltaMs);
  }

  // Wire pause callbacks: stopLoop on pause, startLoop(same cbs) on resume.
  matchPauseCallback  = () => stopLoop();
  matchResumeCallback = () => startLoop(physicsStep, renderStep);

  // Register Escape key pause handler for this match.
  window.addEventListener('keydown', onMatchKeydown);

  // ── Gamepad reconnect prompt ───────────────────────────────────────────
  setOnGamepadDisconnected(() => {
    // Pause the match and show the reconnect prompt
    if (!pauseOverlay) showPauseMenu();
  });

  startLoop(physicsStep, renderStep);
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

registerServiceWorker();
initKeyboard();
initGamepad();
initTouchControls();
initRenderer();

initScreens({
  onMatchReady: (characterId, stageId) => {
    startMatch(characterId, stageId);
  },
});

