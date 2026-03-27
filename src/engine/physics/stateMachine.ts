// src/engine/physics/stateMachine.ts
// Fighter state machine: validates transitions, fires callbacks, ticks timers.

import type { EntityId } from '../ecs/entity.js';
import { fighterComponents, type FighterState } from '../ecs/component.js';

// ── Supplemental per-entity timer maps ────────────────────────────────────────

/** Frames both attacker and victim are frozen after a hit. */
export const hitlagMap = new Map<EntityId, number>();

/** Frames of shield-break stun remaining. */
export const shieldBreakMap = new Map<EntityId, number>();

/** Countdown frames before a fighter auto-releases a ledge (0 = no limit). */
const ledgeHangFramesMap = new Map<EntityId, number>();

/** Countdown frames for dodge/roll/air-dodge duration. */
export const dodgeFramesMap = new Map<EntityId, number>();

/** Countdown frames for grab duration. */
export const grabFramesMap = new Map<EntityId, number>();

/**
 * Tech-window countdown per fighter.
 * Set to 20 when a fighter enters hitstun; allows a floor tech if shield is
 * pressed before the window expires and they land.
 */
export const techWindowMap = new Map<EntityId, number>();

/**
 * Tracks fighters that have already used their air dodge.
 * Cleared when the fighter lands (grounded again).
 */
export const airDodgeUsedSet = new Set<EntityId>();

// ── Transition table ──────────────────────────────────────────────────────────

const VALID_TRANSITIONS = new Map<FighterState, ReadonlySet<FighterState>>([
  ['idle',       new Set<FighterState>(['idle', 'walk', 'run', 'jump', 'attack', 'hitstun', 'shielding', 'grabbing', 'spotDodge', 'rolling', 'KO', 'ledgeHang'])],
  ['walk',       new Set<FighterState>(['idle', 'run', 'jump', 'attack', 'hitstun', 'shielding', 'grabbing', 'spotDodge', 'rolling', 'KO', 'ledgeHang'])],
  ['run',        new Set<FighterState>(['idle', 'walk', 'jump', 'attack', 'hitstun', 'shielding', 'grabbing', 'spotDodge', 'rolling', 'KO', 'ledgeHang'])],
  ['jump',       new Set<FighterState>(['idle', 'jump', 'doubleJump', 'attack', 'hitstun', 'airDodge', 'KO', 'ledgeHang'])],
  ['doubleJump', new Set<FighterState>(['idle', 'attack', 'hitstun', 'airDodge', 'KO', 'ledgeHang'])],
  ['attack',     new Set<FighterState>(['idle', 'jump', 'hitstun', 'KO'])],
  ['hitstun',    new Set<FighterState>(['hitstun', 'idle', 'KO', 'ledgeHang'])],
  ['shielding',  new Set<FighterState>(['idle', 'rolling', 'spotDodge', 'KO'])],
  ['rolling',    new Set<FighterState>(['idle', 'KO'])],
  ['spotDodge',  new Set<FighterState>(['idle', 'KO'])],
  ['airDodge',   new Set<FighterState>(['idle', 'hitstun', 'KO', 'ledgeHang'])],
  ['grabbing',   new Set<FighterState>(['idle', 'attack', 'KO'])],
  ['ledgeHang',  new Set<FighterState>(['idle', 'jump', 'rolling', 'attack', 'KO'])],
  ['KO',         new Set<FighterState>(['KO'])],
]);

// ── Public types ──────────────────────────────────────────────────────────────

export type StateTransitionData = {
  hitstunFrames?: number;
  invincibleFrames?: number;
  shieldBreakFrames?: number;
  ledgeHangFrames?: number;
};

type TransitionCallback = (
  entityId: EntityId,
  from: FighterState,
  to: FighterState,
) => void;

const transitionCallbacks: TransitionCallback[] = [];

// ── API ───────────────────────────────────────────────────────────────────────

/**
 * Register a callback invoked on every valid state transition.
 * Callbacks are fired after the fighter component has been mutated.
 */
export function onStateTransition(cb: TransitionCallback): void {
  transitionCallbacks.push(cb);
}

/**
 * Attempt to transition a fighter to `newState`.
 * Returns true if the transition was valid and applied; false otherwise.
 * Invalid transitions are logged and silently ignored.
 */
export function transitionFighterState(
  entityId: EntityId,
  newState: FighterState,
  data?: StateTransitionData,
): boolean {
  const fighter = fighterComponents.get(entityId);
  if (!fighter) return false;

  const fromState = fighter.state;
  const validTargets = VALID_TRANSITIONS.get(fromState);

  if (!validTargets || !validTargets.has(newState)) {
    console.error(
      `[stateMachine] Invalid transition: ${fromState} → ${newState} for entity ${entityId}`,
    );
    return false;
  }

  fighter.state = newState;

  if (data?.hitstunFrames !== undefined) {
    fighter.hitstunFrames = data.hitstunFrames;
  }
  if (data?.invincibleFrames !== undefined) {
    fighter.invincibleFrames = data.invincibleFrames;
  }
  if (data?.shieldBreakFrames !== undefined) {
    shieldBreakMap.set(entityId, data.shieldBreakFrames);
    fighter.shieldBreakFrames = data.shieldBreakFrames;
  }
  if (data?.ledgeHangFrames !== undefined) {
    ledgeHangFramesMap.set(entityId, data.ledgeHangFrames);
  }

  if (newState === 'hitstun') {
    techWindowMap.set(entityId, 20);
  }

  for (const cb of transitionCallbacks) {
    cb(entityId, fromState, newState);
  }
  return true;
}

/**
 * Advance per-entity timers by one physics frame.
 * Returns early (after decrementing hitlag) while hitlag is active.
 */
export function tickFighterTimers(entityId: EntityId): void {
  const fighter = fighterComponents.get(entityId);
  if (!fighter) return;

  // 1. Hitlag — both combatants are frozen; decrement and bail out.
  const hitlag = hitlagMap.get(entityId) ?? 0;
  if (hitlag > 0) {
    const next = hitlag - 1;
    hitlagMap.set(entityId, next);
    fighter.hitlagFrames = next;
    return;
  }

  // 2. Hitstun
  if (fighter.hitstunFrames > 0) {
    fighter.hitstunFrames--;
    if (fighter.hitstunFrames === 0 && fighter.state === 'hitstun') {
      transitionFighterState(entityId, 'idle');
    }
  }

  // 3. Invincibility
  if (fighter.invincibleFrames > 0) {
    fighter.invincibleFrames--;
  }

  // 4. Shield-break stun
  const shieldBreak = shieldBreakMap.get(entityId) ?? 0;
  if (shieldBreak > 0) {
    const next = shieldBreak - 1;
    shieldBreakMap.set(entityId, next);
    fighter.shieldBreakFrames = next;
    if (next === 0 && fighter.state !== 'idle') {
      // Attempt to return to idle; logs an error and ignores if state forbids it.
      transitionFighterState(entityId, 'idle');
    }
  }

  // 5. Ledge-hang countdown (player input is expected to exit the state
  //    before the timer expires; no automatic state change here).
  const ledgeHang = ledgeHangFramesMap.get(entityId) ?? 0;
  if (ledgeHang > 0) {
    ledgeHangFramesMap.set(entityId, ledgeHang - 1);
  }

  // 6. Dodge / roll / air-dodge countdown
  const dodge = dodgeFramesMap.get(entityId) ?? 0;
  if (dodge > 0) {
    const next = dodge - 1;
    dodgeFramesMap.set(entityId, next);
    if (next === 0) {
      if (
        fighter.state === 'spotDodge' ||
        fighter.state === 'rolling' ||
        fighter.state === 'airDodge'
      ) {
        transitionFighterState(entityId, 'idle');
      }
    }
  }

  // 7. Grab countdown
  const grab = grabFramesMap.get(entityId) ?? 0;
  if (grab > 0) {
    const next = grab - 1;
    grabFramesMap.set(entityId, next);
    if (next === 0 && fighter.state === 'grabbing') {
      transitionFighterState(entityId, 'idle');
    }
  }

  // 8. Tech-window countdown (ticks regardless of other states)
  const techWin = techWindowMap.get(entityId) ?? 0;
  if (techWin > 0) {
    techWindowMap.set(entityId, techWin - 1);
  }
}
