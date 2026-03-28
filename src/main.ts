// src/main.ts
// Entry point — shows start menu (character + stage select), then runs the match.

import { toFixed, toFloat, fixedMul, fixedNeg } from './engine/physics/fixednum.js';
import { createEntity, resetEntityCounter }      from './engine/ecs/entity.js';
import {
  transformComponents,
  physicsComponents,
  fighterComponents,
  renderableComponents,
  type Fighter,
  type Physics,
  type Renderable,
  clearAllComponents,
} from './engine/ecs/component.js';
import { applyGravitySystem }          from './engine/physics/gravity.js';
import {
  platforms,
  platformCollisionSystem,
  setEntityPassThroughInput,
  setEntityShieldInput,
  FIGHTER_HALF_HEIGHT,
  checkHitboxSystem,
  clearHitRegistry,
} from './engine/physics/collision.js';
import { blastZoneSystem, setBlastZones } from './engine/physics/blastZone.js';
import { seedRng } from './engine/physics/lcg.js';
import {
  transitionFighterState,
  tickFighterTimers,
  hitlagMap,
  dodgeFramesMap,
  grabFramesMap,
  airDodgeUsedSet,
  isEntityFrozenByHitlag,
  clearStateMachineMaps,
} from './engine/physics/stateMachine.js';
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
} from './engine/input/gamepad.js';
import { startLoop, stopLoop }             from './engine/loop.js';
import { initRenderer, render, resetRenderer, resetItemMeshes } from './renderer/gl.js';
import { updateCamera } from './renderer/camera.js';
import { initHud, updateHud, disposeHud, registerP2KeysGetter }  from './renderer/hud.js';
import {
  triggerScreenShake,
  spawnHitSpark,
  spawnLaunchTrail,
  endLaunchTrail,
  triggerKOFlash,
  updateParticles,
  disposeParticles,
} from './renderer/particles.js';
import { KAEL_STATS, KAEL_MOVES }          from './game/characters/kael.js';
import { GORUN_STATS, GORUN_MOVES }        from './game/characters/gorun.js';
import { VELA_STATS, VELA_MOVES }          from './game/characters/vela.js';
import { SYNE_STATS, SYNE_MOVES }          from './game/characters/syne.js';
import { ZIRA_STATS, ZIRA_MOVES }          from './game/characters/zira.js';
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
import { matchState, tickFrame, resetMatchState } from './game/state.js';
import {
  clearItems,
  trySpawnItem,
  tickItems,
  setItemSpawnPoints,
  setItemSpawnSetting,
  useHeldItem,
} from './game/items/items.js';
import {
  clearHazards,
  setHazard,
  tickHazards,
  initForgeGeysers,
  initCloudLightning,
  initDigitalGrid,
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
  kael:  KAEL_STATS,
  gorun: GORUN_STATS,
  vela:  VELA_STATS,
  syne:  SYNE_STATS,
  zira:  ZIRA_STATS,
};

const CHARACTER_MOVES: Record<string, Record<string, Move>> = {
  kael:  KAEL_MOVES,
  gorun: GORUN_MOVES,
  vela:  VELA_MOVES,
  syne:  SYNE_MOVES,
  zira:  ZIRA_MOVES,
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
};

const STAGE_BLAST_ZONES: Record<string, BlastZones> = {
  aetherPlateau: AETHER_PLATEAU_BLAST_ZONES,
  forge:         FORGE_BLAST_ZONES,
  cloudCitadel:  CLOUD_CITADEL_BLAST_ZONES,
  ancientRuin:   ANCIENT_RUIN_BLAST_ZONES,
  digitalGrid:   DIGITAL_GRID_BLAST_ZONES,
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
    { x: toFixed(-250), y: FIGHTER_HALF_HEIGHT }, // main stage left
    { x: toFixed(0),    y: FIGHTER_HALF_HEIGHT }, // main stage centre
    { x: toFixed(250),  y: FIGHTER_HALF_HEIGHT }, // main stage right
  ],
  cloudCitadel: [
    { x: toFixed(-200), y: FIGHTER_HALF_HEIGHT }, // main stage left
    { x: toFixed(0),    y: FIGHTER_HALF_HEIGHT }, // main stage centre
    { x: toFixed(200),  y: FIGHTER_HALF_HEIGHT }, // main stage right
  ],
  ancientRuin: [
    { x: toFixed(-150), y: FIGHTER_HALF_HEIGHT },
    { x: toFixed(0),    y: FIGHTER_HALF_HEIGHT },
    { x: toFixed(150),  y: FIGHTER_HALF_HEIGHT },
  ],
  digitalGrid: [
    { x: toFixed(-200), y: FIGHTER_HALF_HEIGHT },
    { x: toFixed(0),    y: FIGHTER_HALF_HEIGHT },
    { x: toFixed(200),  y: FIGHTER_HALF_HEIGHT },
  ],
};

/** Hazard type per stage, or null for none. */
const STAGE_HAZARD: Record<string, HazardType | null> = {
  aetherPlateau: null,
  forge:         'forgeGeysers',
  cloudCitadel:  'cloudLightning',
  ancientRuin:   null,
  digitalGrid:   'digitalGrid',
};

// ── Air-drift scale and input threshold ──────────────────────────────────────

const AIR_DRIFT_SCALE = toFixed(0.8);
const STICK_THRESHOLD = 0.5;

// ── Dodge / grab / shield constants ──────────────────────────────────────────

const SPOT_DODGE_INVINCIBLE_FRAMES = 8;
const SPOT_DODGE_TOTAL_FRAMES      = 20;
const ROLL_INVINCIBLE_FRAMES       = 15;
const ROLL_TOTAL_FRAMES            = 30;
const AIR_DODGE_INVINCIBLE_FRAMES  = 20;
const AIR_DODGE_TOTAL_FRAMES       = 30;
const GRAB_TOTAL_FRAMES            = 20;
const ROLL_SPEED_MULTIPLIER        = toFixed(0.7);

/** Shield health drained per frame while shielding. */
const SHIELD_DRAIN_PER_FRAME = 0.5;
/** Shield health regenerated per frame when not shielding (slow regen). */
const SHIELD_REGEN_PER_FRAME = 0.1;

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
    renderable.loop = fighter.state === 'idle' || fighter.state === 'run';
  }
}

// ── Attack initiation ─────────────────────────────────────────────────────────

function startAttack(playerId: number, fighter: Fighter, phys: Physics, input: InputState): void {
  const moves = getMoves(fighter.characterId);
  let moveId: string;

  if (phys.grounded) {
    if (Math.abs(input.stickX) > STICK_THRESHOLD) moveId = 'forwardSmash';
    else if (input.stickY > STICK_THRESHOLD)      moveId = 'upSmash';
    else {
      // Try neutralJab1 first (kael), then neutralJab (others)
      moveId = moves?.has('neutralJab1') ? 'neutralJab1' : 'neutralJab';
    }
  } else {
    moveId = 'neutralAir';
  }

  fighter.attackFrame   = 0;
  fighter.currentMoveId = moveId;
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

  const hitlag = hitlagMap.get(playerId) ?? 0;
  if (
    fighter.state === 'KO'        ||
    fighter.state === 'hitstun'   ||
    fighter.state === 'spotDodge' ||
    fighter.state === 'airDodge'  ||
    fighter.state === 'grabbing'  ||
    fighter.shieldBreakFrames > 0 ||
    hitlag > 0
  ) {
    syncAnimation(fighter, renderable);
    return;
  }

  if (fighter.state === 'rolling') {
    syncAnimation(fighter, renderable);
    return;
  }

  setEntityPassThroughInput(playerId, input.stickY < -STICK_THRESHOLD);

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
    fighter.shieldHealth = Math.min(100, fighter.shieldHealth + SHIELD_REGEN_PER_FRAME);
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
        transitionFighterState(playerId, 'grabbing');
        grabFramesMap.set(playerId, GRAB_TOTAL_FRAMES);
        phys.vx = toFixed(0);
        syncAnimation(fighter, renderable);
        return;
      }
    }
  }

  if (fighter.state !== 'attack') {
    if (buffer.consume('attack', matchState.frame)) {
      if (!useHeldItem(playerId, transform.facingRight)) {
        startAttack(playerId, fighter, phys, input);
      }
    }
  }

  if (fighter.state === 'attack') {
    fighter.attackFrame++;
    const moves = getMoves(fighter.characterId);
    const move  = moves?.get(fighter.currentMoveId ?? '');
    if (move && fighter.attackFrame >= move.totalFrames) {
      clearHitRegistry(playerId);
      fighter.currentMoveId = null;
      fighter.attackFrame   = 0;
      transitionFighterState(playerId, 'idle');
    }
    syncAnimation(fighter, renderable);
    return;
  }

  if (phys.grounded) {
    if (input.stickX > 0) {
      phys.vx = fighter.stats.runSpeed;
      transform.facingRight = true;
      if (fighter.state !== 'run') transitionFighterState(playerId, 'run');
    } else if (input.stickX < 0) {
      phys.vx = fixedNeg(fighter.stats.runSpeed);
      transform.facingRight = false;
      if (fighter.state !== 'run') transitionFighterState(playerId, 'run');
    } else {
      phys.vx = toFixed(0);
      if (fighter.state === 'run' || fighter.state === 'walk') {
        transitionFighterState(playerId, 'idle');
      }
    }
  } else {
    if (input.stickX > 0) {
      phys.vx = fixedMul(fighter.stats.runSpeed, AIR_DRIFT_SCALE);
      transform.facingRight = true;
    } else if (input.stickX < 0) {
      phys.vx = fixedNeg(fixedMul(fighter.stats.runSpeed, AIR_DRIFT_SCALE));
      transform.facingRight = false;
    } else {
      phys.vx = toFixed(0);
    }
  }

  if (!phys.grounded && input.stickY < -STICK_THRESHOLD && phys.vy <= 0) {
    phys.fastFalling       = true;
    phys.gravityMultiplier = toFixed(2.5);
  }

  if (buffer.consume('jump', matchState.frame)) {
    if (phys.grounded) {
      phys.vy                = fighter.stats.jumpForce;
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
let p1CharId  = 'kael';
let p2CharId  = 'gorun';

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
  const p2Char = (p1Char === 'kael' ? 'gorun' : 'kael') as CharacterId;
  p1CharId  = p1Char;
  p2CharId  = p2Char;
  p2StageId = stageId;

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

  // ── Stage ──────────────────────────────────────────────────────────────
  platforms.push(...(STAGE_PLATFORMS[stageId] ?? AETHER_PLATEAU_PLATFORMS));
  setBlastZones(STAGE_BLAST_ZONES[stageId] ?? AETHER_PLATEAU_BLAST_ZONES);

  // ── Items — spawn points and default setting ───────────────────────────
  setItemSpawnPoints(STAGE_SPAWN_POINTS[stageId] ?? STAGE_SPAWN_POINTS['aetherPlateau']!);
  setItemSpawnSetting('medium');

  // ── Stage hazards ──────────────────────────────────────────────────────
  const hazardType = STAGE_HAZARD[stageId] ?? null;
  setHazard(hazardType);
  if (hazardType === 'forgeGeysers') {
    initForgeGeysers(toFixed(-440), toFixed(440));
  } else if (hazardType === 'cloudLightning') {
    initCloudLightning();
  } else if (hazardType === 'digitalGrid') {
    initDigitalGrid(DIGITAL_GRID_PLATFORMS_PHASE1, DIGITAL_GRID_PLATFORMS_PHASE2);
  }

  // ── Move data ──────────────────────────────────────────────────────────
  MOVE_DATA = new Map(
    Object.entries(CHARACTER_MOVES).map(([id, moves]) => [id, new Map(Object.entries(moves))]),
  );

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
    stats:            CHARACTER_STATS[p1Char] ?? KAEL_STATS,
  });
  renderableComponents.set(player1Id, {
    meshUrl:        `/assets/${p1Char}/${p1Char}.glb`,
    atlasUrl:       `/assets/${p1Char}/${p1Char}_atlas.png`,
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
    stats:            CHARACTER_STATS[p2Char] ?? GORUN_STATS,
  });
  renderableComponents.set(player2Id, {
    meshUrl:        `/assets/${p2Char}/${p2Char}.glb`,
    atlasUrl:       `/assets/${p2Char}/${p2Char}_atlas.png`,
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
  registerP2KeysGetter(getP2KeysDown);
  initHud([player1Id, player2Id]);
  resetItemMeshes();
  resetRenderer();

  // Accent colours for hit sparks (must match CHARACTER_COLORS in gl.ts)
  const CHARACTER_ACCENT: Record<string, string> = {
    kael:  '#4488ee',
    gorun: '#ee6600',
    vela:  '#44dd66',
    syne:  '#cc44ff',
    zira:  '#ffd700',
  };

  /** Scale from damage percentage to launch-trail force threshold (renderer only). */
  const DAMAGE_TO_FORCE_SCALE = 0.3;

  // ── Game loop ──────────────────────────────────────────────────────────
  stopLoop();
  let lastRenderMs = performance.now();
  startLoop(
    () => {
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

      integratePositions();
      applyGravitySystem();
      platformCollisionSystem();
      checkHitboxSystem([player1Id, player2Id], MOVE_DATA);
      blastZoneSystem();
      trySpawnItem(matchState.frame);
      tickItems(matchState.frame);
      tickHazards();

      // ── Particle effect triggers (state-transition detection) ────────────
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

          // Fighter just entered hitstun → hit confirmed → spawn sparks + shake
          if (curr === 'hitstun') {
            spawnHitSpark(wx, wy, color);
            const dmgFloat = toFloat(fighter.damagePercent);
            if (dmgFloat >= 80) {
              triggerScreenShake(12, 300); // smash-level
            } else {
              triggerScreenShake(6, 200);  // standard hit
            }
          }

          // Fighter just entered KO → KO flash + strong shake
          if (curr === 'KO') {
            triggerKOFlash();
            triggerScreenShake(20, 500);
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

      // ── Match-end detection ──────────────────────────────────────────────
      const mf1 = fighterComponents.get(player1Id);
      const mf2 = fighterComponents.get(player2Id);
      if ((mf1 && mf1.stocks <= 0) || (mf2 && mf2.stocks <= 0)) {
        const winnerLabel = (mf2 && mf2.stocks <= 0)
          ? p1CharId.charAt(0).toUpperCase() + p1CharId.slice(1)
          : p2CharId.charAt(0).toUpperCase() + p2CharId.slice(1);
        stopLoop();
        showMatchResult(winnerLabel);
        return;
      }

      updateCamera([player1Id, player2Id]);

      tickFrame();
    },
    (alpha) => {
      render(platforms, alpha);
      updateHud();
      updateDebugOverlay();

      // Advance and render all particle / VFX systems
      const nowMs  = performance.now();
      const deltaMs = Math.min(nowMs - lastRenderMs, 50);
      lastRenderMs = nowMs;
      updateParticles(deltaMs);
    },
  );
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

