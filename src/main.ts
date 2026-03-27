// src/main.ts
// Entry point: Phase 2 — 2-player split-keyboard combat sandbox.

import { toFixed, toFloat, fixedMul, fixedNeg } from './engine/physics/fixednum.js';
import { createEntity }                          from './engine/ecs/entity.js';
import {
  transformComponents,
  physicsComponents,
  fighterComponents,
  renderableComponents,
  type Fighter,
  type Physics,
  type Renderable,
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
import {
  transitionFighterState,
  tickFighterTimers,
  hitlagMap,
  dodgeFramesMap,
  grabFramesMap,
  airDodgeUsedSet,
  isEntityFrozenByHitlag,
} from './engine/physics/stateMachine.js';
import { initKeyboard, sampleKeyboard, type InputState } from './engine/input/keyboard.js';
import { InputBuffer }                     from './engine/input/buffer.js';
import { startLoop }                       from './engine/loop.js';
import { initRenderer, render } from './renderer/gl.js';
import { updateCamera } from './renderer/camera.js';
import { initHud, updateHud }              from './renderer/hud.js';
import { KAEL_STATS, KAEL_MOVES }          from './game/characters/kael.js';
import { GORUN_STATS, GORUN_MOVES }        from './game/characters/gorun.js';
import {
  AETHER_PLATEAU_PLATFORMS,
  AETHER_PLATEAU_BLAST_ZONES,
} from './game/stages/aetherPlateau.js';
import { matchState, tickFrame }           from './game/state.js';

// ── Stage setup ───────────────────────────────────────────────────────────────

platforms.push(...AETHER_PLATEAU_PLATFORMS);
setBlastZones(AETHER_PLATEAU_BLAST_ZONES);

// ── Move data map (built once; passed to checkHitboxSystem every frame) ───────

const MOVE_DATA = new Map([
  ['kael',  new Map(Object.entries(KAEL_MOVES))],
  ['gorun', new Map(Object.entries(GORUN_MOVES))],
]);

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

/** Shield health drained per frame while shielding (100 HP / 200 frames ≈ 3.3 s). */
const SHIELD_DRAIN_PER_FRAME = 0.5;
/** Shield health regenerated per frame when not shielding (slow regen). */
const SHIELD_REGEN_PER_FRAME = 0.1;
/** Speed multiplier applied to a roll dodge. */
const ROLL_SPEED_MULTIPLIER  = toFixed(1.2);

// ── Player 1 entity — Kael ────────────────────────────────────────────────────

const player1Id = createEntity();

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
  characterId:      'kael',
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
  stats:            KAEL_STATS,
});

renderableComponents.set(player1Id, {
  meshUrl:        '/assets/kael/kael.glb',
  atlasUrl:       '/assets/kael/kael_atlas.png',
  animationClip:  'idle',
  animationFrame: 0,
  animationSpeed: 1.0,
  loop:           true,
});

// ── Player 2 entity — Gorun ───────────────────────────────────────────────────

const player2Id = createEntity();

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
  characterId:      'gorun',
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
  stats:            GORUN_STATS,
});

renderableComponents.set(player2Id, {
  meshUrl:        '/assets/gorun/gorun.glb',
  atlasUrl:       '/assets/gorun/gorun_atlas.png',
  animationClip:  'idle',
  animationFrame: 0,
  animationSpeed: 1.0,
  loop:           true,
});

// ── Input buffers ─────────────────────────────────────────────────────────────

const buffer1 = new InputBuffer();
const buffer2 = new InputBuffer();

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
  const attackJust  = p2Pressed.has('Numpad7');
  const specialJust = p2Pressed.has('Numpad8');
  const grabJust    = p2Pressed.has('Numpad9');

  const result: InputState = {
    jump:    p2Down.has('ArrowUp'),
    attack:  p2Down.has('Numpad7'),
    special: p2Down.has('Numpad8'),
    shield:  p2Down.has('Numpad0'),
    grab:    p2Down.has('Numpad9'),
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

// ── Move helpers ──────────────────────────────────────────────────────────────

// Convenience wrapper — looks up a character's move table from the shared map.
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
  let moveId: string;

  if (phys.grounded) {
    if (Math.abs(input.stickX) > STICK_THRESHOLD) moveId = 'forwardSmash';
    else if (input.stickY > STICK_THRESHOLD)      moveId = 'upSmash';
    else {
      // Kael has neutralJab1; Gorun has neutralJab
      moveId = fighter.characterId === 'kael' ? 'neutralJab1' : 'neutralJab';
    }
  } else {
    moveId = 'neutralAir';
  }

  fighter.attackFrame  = 0;
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

  // ── Register shield input for tech detection ───────────────────────────
  setEntityShieldInput(playerId, input.shield);

  // ── Freeze during hitlag / hitstun / KO / active dodge / active grab / shield break ──
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

  // ── Rolling: keep momentum; no new input accepted ─────────────────────
  if (fighter.state === 'rolling') {
    syncAnimation(fighter, renderable);
    return;
  }

  // ── Pass-through flag for one-way platforms ────────────────────────────
  setEntityPassThroughInput(playerId, input.stickY < -STICK_THRESHOLD);

  // ── Record buffered presses ────────────────────────────────────────────
  if (input.jumpJustPressed)    buffer.press('jump',    matchState.frame);
  if (input.attackJustPressed)  buffer.press('attack',  matchState.frame);
  if (input.specialJustPressed) buffer.press('special', matchState.frame);
  if (input.grabJustPressed)    buffer.press('grab',    matchState.frame);

  // ── Shield degradation ────────────────────────────────────────────────
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

  // ── Air dodge (shield while airborne, once per airborne sequence) ──────
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

  // ── Shield (grounded) → spot dodge / roll dodge / stay shielding ──────
  if (input.shield && phys.grounded && fighter.state !== 'attack') {
    // Spot dodge: shield + down
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

    // Roll dodge: shield + left or right
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

    // Plain shield (no stick direction)
    if (fighter.state !== 'shielding') {
      transitionFighterState(playerId, 'shielding');
    }
    phys.vx = toFixed(0);
    syncAnimation(fighter, renderable);
    return;
  }

  // Shield released: drop out of shielding
  if (fighter.state === 'shielding') {
    transitionFighterState(playerId, 'idle');
  }

  // ── Grab ──────────────────────────────────────────────────────────────
  if (
    phys.grounded &&
    fighter.state !== 'attack'    &&
    fighter.state !== 'shielding'
  ) {
    if (buffer.consume('grab', matchState.frame)) {
      transitionFighterState(playerId, 'grabbing');
      grabFramesMap.set(playerId, GRAB_TOTAL_FRAMES);
      phys.vx = toFixed(0);
      syncAnimation(fighter, renderable);
      return;
    }
  }

  // ── Attack start ──────────────────────────────────────────────────────
  if (fighter.state !== 'attack') {
    if (buffer.consume('attack', matchState.frame)) {
      startAttack(playerId, fighter, phys, input);
    }
  }

  // ── Attack frame advancement ──────────────────────────────────────────
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
    return; // no horizontal movement during attack
  }

  // ── Horizontal movement ───────────────────────────────────────────────
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
    // Air drift at 80% of run speed
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

  // ── Fast-fall ─────────────────────────────────────────────────────────
  if (!phys.grounded && input.stickY < -STICK_THRESHOLD && phys.vy <= 0) {
    phys.fastFalling       = true;
    phys.gravityMultiplier = toFixed(2.5);
  }

  // ── Jump (with input buffer) ──────────────────────────────────────────
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

  // Reset gravity multiplier when not fast-falling
  if (!phys.fastFalling) {
    phys.gravityMultiplier = toFixed(1.0);
  }

  syncAnimation(fighter, renderable);
}

// ── Position integration ──────────────────────────────────────────────────────

function integratePositions(): void {
  for (const [id, phys] of physicsComponents) {
    // Skip position integration for entities frozen by hitlag.
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

function updateDebugOverlay(): void {
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
    `P1 [Kael]  state=${f1?.state ?? '?'}  ${p1Pos}  dmg=${toFloat(f1?.damagePercent ?? 0).toFixed(1)}%  stk=${f1?.stocks ?? 0}  gnd=${p1?.grounded ?? false}`,
    `P2 [Gorun] state=${f2?.state ?? '?'}  ${p2Pos}  dmg=${toFloat(f2?.damagePercent ?? 0).toFixed(1)}%  stk=${f2?.stocks ?? 0}`,
  ].join('\n');
}

// ── Initialise and start ──────────────────────────────────────────────────────

initKeyboard();
const canvas = initRenderer();
canvas.style.position = 'absolute';
canvas.style.top      = '0';
canvas.style.left     = '0';

initHud([player1Id, player2Id]);

startLoop(
  () => {
    // ── Physics step (60 Hz) ─────────────────────────────────────────────
    tickFighterTimers(player1Id);
    tickFighterTimers(player2Id);

    const input1 = sampleKeyboard();
    const input2 = samplePlayer2Input();

    processPlayerInput(player1Id, input1, buffer1);
    processPlayerInput(player2Id, input2, buffer2);

    integratePositions();
    applyGravitySystem();
    platformCollisionSystem();
    checkHitboxSystem([player1Id, player2Id], MOVE_DATA);
    blastZoneSystem();
    updateCamera([player1Id, player2Id]);

    tickFrame();
  },
  (alpha) => {
    // ── Render callback (display refresh rate) ───────────────────────────
    render(platforms, alpha);
    updateHud();
    updateDebugOverlay();
  },
);
