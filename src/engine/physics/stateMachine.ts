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

// ── Transition table ──────────────────────────────────────────────────────────

const VALID_TRANSITIONS = new Map<FighterState, ReadonlySet<FighterState>>([
  ['idle',       new Set<FighterState>(['idle', 'walk', 'run', 'jump', 'attack', 'hitstun', 'shielding', 'grabbing', 'spotDodge', 'KO', 'ledgeHang'])],
  ['walk',       new Set<FighterState>(['idle', 'run', 'jump', 'attack', 'hitstun', 'shielding', 'grabbing', 'spotDodge', 'KO', 'ledgeHang'])],
  ['run',        new Set<FighterState>(['idle', 'walk', 'jump', 'attack', 'hitstun', 'shielding', 'grabbing', 'spotDodge', 'KO', 'ledgeHang'])],
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
}
