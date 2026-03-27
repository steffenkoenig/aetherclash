// src/main.ts
// Entry point: sets up the Physics Sandbox (Phase 1)

import { toFixed, toFloat, fixedMul, fixedNeg } from './engine/physics/fixednum.js';
import { createEntity } from './engine/ecs/entity.js';
import {
  transformComponents,
  physicsComponents,
  fighterComponents,
  renderableComponents,
} from './engine/ecs/component.js';
import { addSystem, runSystems } from './engine/ecs/system.js';
import { applyGravitySystem } from './engine/physics/gravity.js';
import {
  platforms,
  platformCollisionSystem,
  setEntityPassThroughInput,
  FIGHTER_HALF_HEIGHT,
} from './engine/physics/collision.js';
import { initKeyboard, sampleKeyboard } from './engine/input/keyboard.js';
import { startLoop } from './engine/loop.js';
import { initRenderer, render } from './renderer/gl.js';
import { KAEL_STATS } from './game/characters/kael.js';
import { matchState, tickFrame } from './game/state.js';

// ── Stage setup ───────────────────────────────────────────────────────────────

platforms.push({
  x1: toFixed(-400),
  x2: toFixed(400),
  y:  toFixed(0),
  passThrough: false,
});

// ── Create player entity ──────────────────────────────────────────────────────

const playerId = createEntity();

transformComponents.set(playerId, {
  x: toFixed(0),
  y: FIGHTER_HALF_HEIGHT,
  prevX: toFixed(0),
  prevY: FIGHTER_HALF_HEIGHT,
  facingRight: true,
});

physicsComponents.set(playerId, {
  vx: toFixed(0),
  vy: toFixed(0),
  gravityMultiplier: toFixed(1.0),
  grounded: true,
  fastFalling: false,
});

fighterComponents.set(playerId, {
  characterId: 'kael',
  state: 'idle',
  damagePercent: toFixed(0),
  stocks: 3,
  jumpCount: 0,
  hitstunFrames: 0,
  invincibleFrames: 0,
  hitlagFrames: 0,
  shieldHealth: 100,
  shieldBreakFrames: 0,
  attackFrame: 0,
  currentMoveId: null,
  stats: KAEL_STATS,
});

// Link the player entity to Kael's 3D model assets.
// Phase 2: loadGLTF and loadTexture will upload the mesh and atlas to the GPU.
renderableComponents.set(playerId, {
  meshUrl:        '/assets/kael/kael.glb',
  atlasUrl:       '/assets/kael/kael_atlas.png',
  animationClip:  'idle',
  animationFrame: 0,
  animationSpeed: 1.0,
  loop:           true,
});

// ── Input state ───────────────────────────────────────────────────────────────

// Air-drift scale: 80% of run speed (Fixed constant)
const AIR_DRIFT_SCALE = toFixed(0.8);

function processInput(): void {
  const input = sampleKeyboard();
  const transform = transformComponents.get(playerId)!;
  const phys = physicsComponents.get(playerId)!;
  const fighter = fighterComponents.get(playerId)!;
  const renderable = renderableComponents.get(playerId)!;

  // Pass-through flag for platforms
  setEntityPassThroughInput(playerId, input.stickY < -0.5);

  // Horizontal movement — all arithmetic stays in Fixed
  if (phys.grounded) {
    if (input.stickX > 0) {
      phys.vx = fighter.stats.runSpeed;
      fighter.state = 'run';
      transform.facingRight = true;
    } else if (input.stickX < 0) {
      phys.vx = fixedNeg(fighter.stats.runSpeed);
      fighter.state = 'run';
      transform.facingRight = false;
    } else {
      phys.vx = toFixed(0);
      fighter.state = 'idle';
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

  // Fast-fall: only trigger if moving downward and not already fast-falling
  if (!phys.grounded && input.stickY < -0.5 && phys.vy <= 0) {
    phys.fastFalling = true;
    phys.gravityMultiplier = toFixed(2.5);
  }

  // Jump — use jumpJustPressed (edge-detected in the input system)
  if (input.jumpJustPressed) {
    if (phys.grounded) {
      phys.vy = fighter.stats.jumpForce;
      phys.grounded = false;
      phys.fastFalling = false;
      phys.gravityMultiplier = toFixed(1.0);
      fighter.state = 'jump';
      fighter.jumpCount = 1;
    } else if (fighter.jumpCount < 2) {
      phys.vy = fighter.stats.doubleJumpForce;
      phys.fastFalling = false;
      phys.gravityMultiplier = toFixed(1.0);
      fighter.state = 'doubleJump';
      fighter.jumpCount = 2;
    }
  }

  // Reset gravity multiplier when not fast-falling
  if (!phys.fastFalling) {
    phys.gravityMultiplier = toFixed(1.0);
  }

  // Keep the Renderable animation clip in sync with the fighter's state so the
  // correct skeletal animation plays on the 3D model.
  // Phase 2: replace this simple state→loop mapping with the AnimationClip
  // metadata parsed from the glTF asset (each clip carries its own loop flag).
  if (renderable.animationClip !== fighter.state) {
    renderable.animationClip  = fighter.state;
    renderable.animationFrame = 0;
    renderable.loop = fighter.state === 'idle' || fighter.state === 'run';
  }
}

// ── Movement integration ──────────────────────────────────────────────────────

function integratePositions(): void {
  for (const [id, phys] of physicsComponents) {
    const transform = transformComponents.get(id);
    if (!transform) continue;
    transform.prevX = transform.x;
    transform.prevY = transform.y;
    transform.x = (transform.x + phys.vx) | 0;
    transform.y = (transform.y + phys.vy) | 0;
  }
}

// ── Systems ───────────────────────────────────────────────────────────────────

addSystem(applyGravitySystem);
addSystem(integratePositions);
addSystem(platformCollisionSystem);

// ── Debug overlay ─────────────────────────────────────────────────────────────

const debugDiv = document.createElement('div');
debugDiv.id = 'debug-overlay';
Object.assign(debugDiv.style, {
  position: 'absolute',
  top: '10px',
  left: '10px',
  color: '#0f0',
  fontFamily: 'monospace',
  fontSize: '14px',
  pointerEvents: 'none',
  zIndex: '100',
  textShadow: '1px 1px 2px #000',
  whiteSpace: 'pre',
});
document.body.appendChild(debugDiv);

let fpsFrameCount = 0;
let fpsAccumMs = 0;
let fps = 0;
let lastRenderTime = performance.now();

function updateDebugOverlay(): void {
  const transform = transformComponents.get(playerId);
  const phys      = physicsComponents.get(playerId);
  const fighter   = fighterComponents.get(playerId);
  if (!transform || !phys || !fighter) return;

  const now = performance.now();
  fpsAccumMs += now - lastRenderTime;
  lastRenderTime = now;
  fpsFrameCount++;
  if (fpsAccumMs >= 500) {
    fps = Math.round((fpsFrameCount * 1000) / fpsAccumMs);
    fpsFrameCount = 0;
    fpsAccumMs = 0;
  }

  debugDiv.textContent = [
    `Frame : ${matchState.frame}`,
    `FPS   : ${fps}`,
    `State : ${fighter.state}`,
    `Pos   : x=${toFloat(transform.x).toFixed(2)}  y=${toFloat(transform.y).toFixed(2)}`,
    `Vel   : vx=${toFloat(phys.vx).toFixed(3)}  vy=${toFloat(phys.vy).toFixed(3)}`,
    `Ground: ${phys.grounded}`,
  ].join('\n');
}

// ── Initialise and start ──────────────────────────────────────────────────────

initKeyboard();
const canvas = initRenderer();
canvas.style.position = 'absolute';
canvas.style.top = '0';
canvas.style.left = '0';

startLoop(
  () => {
    processInput();
    runSystems();
    tickFrame();
  },
  (alpha) => {
    render(platforms, alpha);
    updateDebugOverlay();
  },
);
