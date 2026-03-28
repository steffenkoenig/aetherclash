// src/engine/input/gamepad.ts
// Gamepad input system — polls the Web Gamepad API once per physics frame.
//
// Supported layouts:
//   XInput (Xbox):     A=jump, X=attack, B=special, LT=shield, LB=grab
//   PlayStation:       ×=jump, □=attack, ○=special, L2=shield, L1=grab
//   Switch Pro:        B=jump, Y=attack, A=special, ZL=shield, L=grab
//
// Deadzone constants from input.md:
//   STICK_DEADZONE  = 0.2
//   CSTICK_DEADZONE = 0.3

import type { InputState } from './keyboard.js';
import { makeNeutralInput } from './keyboard.js';

// ── Constants ─────────────────────────────────────────────────────────────────

export const STICK_DEADZONE  = 0.2;
export const CSTICK_DEADZONE = 0.3;

/** Maximum number of players that can use gamepads simultaneously. */
export const MAX_GAMEPAD_PLAYERS = 4;

// ── Button index layout (XInput / standard mapping) ──────────────────────────
// https://w3c.github.io/gamepad/#dfn-standard-gamepad

const BTN_A    = 0;  // Cross (PS) / B (Switch)
const BTN_B    = 1;  // Circle (PS) / A (Switch)
const BTN_X    = 2;  // Square (PS) / Y (Switch)
const BTN_LB   = 4;  // L1 (PS) / L (Switch)
const BTN_LT   = 6;  // L2 (PS) / ZL (Switch) (may be axis on some pads)

// Axis indices
const AXIS_LX = 0; // Left stick X
const AXIS_LY = 1; // Left stick Y (up is negative)
const AXIS_RX = 2; // Right stick X (c-stick)
const AXIS_RY = 3; // Right stick Y (c-stick)

// ── Module state ──────────────────────────────────────────────────────────────

/** Maps player index (0-based) to the Gamepad.index it is assigned to. */
const assignedGamepadIndices: Map<number, number> = new Map();

/**
 * Per-gamepad, per-button "pressed last frame" state for edge detection.
 * Key = Gamepad.index, value = array of booleans.
 */
const prevButtonState: Map<number, boolean[]> = new Map();

/** Optional callback: called when a gamepad disconnects mid-match. */
let onGamepadDisconnected: ((gamepadIndex: number) => void) | null = null;

// ── Helper ────────────────────────────────────────────────────────────────────

function applyDeadzone(value: number, zone: number): number {
  if (Math.abs(value) < zone) return 0;
  // Rescale so that the edge of the deadzone maps to 0 and 1.0 stays 1.0
  const sign = value < 0 ? -1 : 1;
  return sign * (Math.abs(value) - zone) / (1 - zone);
}

function isButtonPressed(gp: Gamepad, btnIdx: number): boolean {
  const btn = gp.buttons[btnIdx];
  if (!btn) return false;
  return btn.pressed || btn.value > 0.5;
}

function wasButtonJustPressed(gp: Gamepad, btnIdx: number, prevState: boolean[]): boolean {
  const now  = isButtonPressed(gp, btnIdx);
  const prev = prevState[btnIdx] ?? false;
  return now && !prev;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Initialise gamepad support.
 * Register `gamepadconnected` / `gamepaddisconnected` event listeners.
 * Must be called once at bootstrap (before the first physics frame).
 */
export function initGamepad(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('gamepadconnected', (e: GamepadEvent) => {
    assignGamepadToPlayer(e.gamepad.index);
  });

  window.addEventListener('gamepaddisconnected', (e: GamepadEvent) => {
    unassignGamepad(e.gamepad.index);
    onGamepadDisconnected?.(e.gamepad.index);
  });
}

/** Dispose gamepad event listeners (call on cleanup). */
export function disposeGamepad(): void {
  if (typeof window === 'undefined') return;
  // Listeners were added as anonymous functions, so we reset state instead.
  assignedGamepadIndices.clear();
  prevButtonState.clear();
}

/**
 * Assign a gamepad (by its raw Gamepad.index) to the first available player slot.
 * Returns the assigned player index (0-based), or -1 if all slots are full.
 */
export function assignGamepadToPlayer(gamepadIndex: number): number {
  // Check whether this gamepad is already assigned.
  for (const [player, gpIdx] of assignedGamepadIndices) {
    if (gpIdx === gamepadIndex) return player;
  }

  for (let player = 0; player < MAX_GAMEPAD_PLAYERS; player++) {
    if (!assignedGamepadIndices.has(player)) {
      assignedGamepadIndices.set(player, gamepadIndex);
      prevButtonState.set(gamepadIndex, []);
      return player;
    }
  }
  return -1; // no free slot
}

/**
 * Unassign a gamepad from whatever player it was assigned to.
 * Called automatically on `gamepaddisconnected`.
 */
export function unassignGamepad(gamepadIndex: number): void {
  for (const [player, gpIdx] of assignedGamepadIndices) {
    if (gpIdx === gamepadIndex) {
      assignedGamepadIndices.delete(player);
      break;
    }
  }
  prevButtonState.delete(gamepadIndex);
}

/**
 * Register a callback that is fired when a gamepad disconnects.
 * The match can use this to pause and show a reconnect prompt.
 */
export function setOnGamepadDisconnected(
  cb: ((gamepadIndex: number) => void) | null,
): void {
  onGamepadDisconnected = cb;
}

/**
 * Poll the Gamepad API and update internal state.
 * Call exactly once per physics frame, before sampling individual players.
 * Advances the "previous frame" button state used for edge detection.
 */
export function pollGamepads(): void {
  if (typeof navigator === 'undefined') return;
  const gamepads = navigator.getGamepads();
  for (const gp of gamepads) {
    if (!gp) continue;
    // Auto-assign any connected gamepad that has been connected but not yet
    // assigned (handles gamepads present before initGamepad() was called).
    if (!prevButtonState.has(gp.index)) {
      assignGamepadToPlayer(gp.index);
    }
  }
}

/**
 * Sample the gamepad assigned to `playerIndex` and return an InputState.
 * Returns null if no gamepad is assigned to that player (fall back to keyboard).
 *
 * Must be called after `pollGamepads()`.
 */
export function sampleGamepad(playerIndex: number): InputState | null {
  if (typeof navigator === 'undefined') return null;

  const gamepadIndex = assignedGamepadIndices.get(playerIndex);
  if (gamepadIndex === undefined) return null;

  const gamepads = navigator.getGamepads();
  const gp = gamepads[gamepadIndex];
  if (!gp || !gp.connected) return null;

  const prev = prevButtonState.get(gp.index) ?? [];

  // ── Sticks ────────────────────────────────────────────────────────────────
  const stickX  = applyDeadzone(gp.axes[AXIS_LX] ?? 0, STICK_DEADZONE);
  const stickY  = -applyDeadzone(gp.axes[AXIS_LY] ?? 0, STICK_DEADZONE); // Y axis: up = negative
  const cStickX = applyDeadzone(gp.axes[AXIS_RX] ?? 0, CSTICK_DEADZONE);
  const cStickY = -applyDeadzone(gp.axes[AXIS_RY] ?? 0, CSTICK_DEADZONE);

  // ── Buttons ───────────────────────────────────────────────────────────────
  const jump    = isButtonPressed(gp, BTN_A);
  const attack  = isButtonPressed(gp, BTN_X);
  const special = isButtonPressed(gp, BTN_B);
  const shield  = isButtonPressed(gp, BTN_LT);
  const grab    = isButtonPressed(gp, BTN_LB);

  // Edge detection: just-pressed this frame
  const jumpJustPressed    = wasButtonJustPressed(gp, BTN_A,  prev);
  const attackJustPressed  = wasButtonJustPressed(gp, BTN_X,  prev);
  const specialJustPressed = wasButtonJustPressed(gp, BTN_B,  prev);
  const grabJustPressed    = wasButtonJustPressed(gp, BTN_LB, prev);

  // ── Advance button state for next frame ────────────────────────────────────
  const newPrev: boolean[] = [];
  for (let i = 0; i < gp.buttons.length; i++) {
    newPrev[i] = isButtonPressed(gp, i);
  }
  prevButtonState.set(gp.index, newPrev);

  return {
    jump,
    attack,
    special,
    shield,
    grab,
    jumpJustPressed,
    attackJustPressed,
    specialJustPressed,
    grabJustPressed,
    stickX,
    stickY,
    cStickX,
    cStickY,
  };
}

/**
 * Merge a gamepad InputState on top of a keyboard/touch InputState.
 * Any `true` from either source wins. Stick values use the gamepad if it has
 * a nonzero value, otherwise fall back to the keyboard value.
 * Returns the merged InputState.
 */
export function mergeGamepadInput(
  base: InputState,
  gp: InputState | null,
): InputState {
  if (!gp) return base;
  return {
    jump:    base.jump    || gp.jump,
    attack:  base.attack  || gp.attack,
    special: base.special || gp.special,
    shield:  base.shield  || gp.shield,
    grab:    base.grab    || gp.grab,
    jumpJustPressed:    base.jumpJustPressed    || gp.jumpJustPressed,
    attackJustPressed:  base.attackJustPressed  || gp.attackJustPressed,
    specialJustPressed: base.specialJustPressed || gp.specialJustPressed,
    grabJustPressed:    base.grabJustPressed    || gp.grabJustPressed,
    // Gamepad stick takes priority when non-zero; otherwise fall back to keyboard
    stickX:  gp.stickX  !== 0 ? gp.stickX  : base.stickX,
    stickY:  gp.stickY  !== 0 ? gp.stickY  : base.stickY,
    cStickX: gp.cStickX !== 0 ? gp.cStickX : base.cStickX,
    cStickY: gp.cStickY !== 0 ? gp.cStickY : base.cStickY,
  };
}

// Expose for testing
export { makeNeutralInput };
