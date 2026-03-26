// src/engine/physics/stateMachine.ts
// Fighter state machine — all state transitions must go through transitionFighterState().
// Invalid transitions are logged and silently ignored.

import type { FighterState } from '../ecs/component.js';
import { fighterComponents } from '../ecs/component.js';

// ── Allowed transitions ───────────────────────────────────────────────────────
// The map lists every state-from and the set of valid destination states.
// Any transition not listed is considered invalid and will be rejected.

const VALID_TRANSITIONS: Readonly<Record<FighterState, ReadonlyArray<FighterState>>> = {
  idle:        ['walk', 'run', 'jump', 'attack', 'shielding', 'spotDodge', 'grabbing', 'hitstun', 'KO'],
  walk:        ['idle', 'run', 'jump', 'attack', 'shielding', 'rolling', 'hitstun', 'KO'],
  run:         ['idle', 'walk', 'jump', 'attack', 'rolling', 'hitstun', 'KO'],
  jump:        ['doubleJump', 'attack', 'airDodge', 'ledgeHang', 'hitstun', 'KO', 'idle'],
  doubleJump:  ['attack', 'airDodge', 'ledgeHang', 'hitstun', 'KO', 'idle'],
  attack:      ['idle', 'walk', 'run', 'jump', 'hitstun', 'KO'],
  hitstun:     ['idle', 'jump', 'airDodge', 'attack', 'KO', 'ledgeHang'],
  shielding:   ['idle', 'rolling', 'spotDodge', 'airDodge', 'grabbing', 'hitstun', 'shieldBreak', 'KO'],
  rolling:     ['idle', 'hitstun', 'KO'],
  spotDodge:   ['idle', 'hitstun', 'KO'],
  airDodge:    ['idle', 'jump', 'ledgeHang', 'hitstun', 'KO'],
  grabbing:    ['idle', 'attack', 'hitstun', 'KO'],
  ledgeHang:   ['idle', 'jump', 'attack', 'rolling', 'hitstun', 'KO'],
  shieldBreak: ['idle', 'hitstun', 'KO'],
  KO:          ['idle'], // only allowed transition from KO is respawn → idle
};

/** Optional data that may accompany a state transition. */
export interface TransitionData {
  hitstunFrames?: number;
  respawnCountdown?: number;
  ledgeHangFrames?: number;
}

/**
 * Attempt to transition a fighter to a new state.
 * Invalid transitions are logged and silently ignored.
 * Returns true if the transition was applied, false if rejected.
 */
export function transitionFighterState(
  entityId: number,
  newState: FighterState,
  data: TransitionData = {},
): boolean {
  const fighter = fighterComponents.get(entityId);
  if (!fighter) {
    console.error(`transitionFighterState: entity ${entityId} has no Fighter component`);
    return false;
  }

  const allowed = VALID_TRANSITIONS[fighter.state];
  if (!allowed.includes(newState)) {
    console.error(
      `transitionFighterState: invalid transition ${fighter.state} → ${newState} for entity ${entityId}`,
    );
    return false;
  }

  fighter.state = newState;

  // Apply transition data
  if (data.hitstunFrames !== undefined) {
    fighter.hitstunFrames = data.hitstunFrames;
  }
  if (data.respawnCountdown !== undefined) {
    fighter.respawnCountdown = data.respawnCountdown;
  }
  if (data.ledgeHangFrames !== undefined) {
    fighter.ledgeHangFrames = data.ledgeHangFrames;
  }

  return true;
}

/**
 * Tick hitstun, hitlag, and shield-break countdown for a fighter.
 * Should be called once per physics frame with the entity's ID.
 */
export function tickFighterTimers(entityId: number): void {
  const fighter = fighterComponents.get(entityId);
  if (!fighter) return;

  // Decrement hitlag
  if (fighter.hitlagFrames !== undefined && fighter.hitlagFrames > 0) {
    fighter.hitlagFrames--;
  }

  // Decrement hitstun; when it expires, transition back to idle
  if (fighter.state === 'hitstun' && fighter.hitstunFrames > 0) {
    fighter.hitstunFrames--;
    if (fighter.hitstunFrames === 0) {
      transitionFighterState(entityId, 'idle');
    }
  }

  // Decrement shield-break stun
  if (fighter.state === 'shieldBreak' && fighter.hitstunFrames > 0) {
    fighter.hitstunFrames--;
    if (fighter.hitstunFrames === 0) {
      transitionFighterState(entityId, 'idle');
    }
  }

  // Decrement invincibility frames
  if (fighter.invincibleFrames > 0) {
    fighter.invincibleFrames--;
  }

  // Tick ledge hang frame counter (for intangibility window)
  if (fighter.state === 'ledgeHang' && fighter.ledgeHangFrames !== undefined) {
    fighter.ledgeHangFrames++;
  }
}

/**
 * Run the fighter timer system over all fighters each frame.
 */
export function fighterTimerSystem(): void {
  for (const [id] of fighterComponents) {
    tickFighterTimers(id);
  }
}
