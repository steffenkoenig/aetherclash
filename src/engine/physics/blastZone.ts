// src/engine/physics/blastZone.ts
// Blast zone detection, KO triggering, and stock management.

import type { Fixed } from './fixednum.js';
import { toFixed } from './fixednum.js';
import {
  transformComponents,
  physicsComponents,
  fighterComponents,
} from '../ecs/component.js';
import { transitionFighterState } from './stateMachine.js';

// ── Blast zone type ───────────────────────────────────────────────────────────

export interface BlastZone {
  left:   Fixed;
  right:  Fixed;
  top:    Fixed;
  bottom: Fixed;
}

// ── KO callbacks ──────────────────────────────────────────────────────────────

export type KOCallback = (entityId: number) => void;
const koCallbacks: KOCallback[] = [];

export function onKO(cb: KOCallback): void {
  koCallbacks.push(cb);
}

export function clearKOCallbacks(): void {
  koCallbacks.length = 0;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const RESPAWN_DELAY_FRAMES      = 180; // 3 seconds at 60 Hz
const RESPAWN_INVINCIBLE_FRAMES = 180; // 3 seconds of spawn invincibility

// ── KO and respawn ────────────────────────────────────────────────────────────

export function triggerKO(entityId: number): void {
  const fighter = fighterComponents.get(entityId);
  if (!fighter) return;
  if (fighter.state === 'KO') return;

  fighter.stocks = Math.max(0, fighter.stocks - 1);

  if (fighter.stocks > 0) {
    // Stocks remain: schedule a respawn after the delay
    transitionFighterState(entityId, 'KO', { respawnCountdown: RESPAWN_DELAY_FRAMES });
  } else {
    // No stocks remaining: eliminated — stay KO'd with no respawn scheduled
    transitionFighterState(entityId, 'KO', {});
  }

  for (const cb of koCallbacks) {
    cb(entityId);
  }
}

export function isOutsideBlastZone(entityId: number, blastZone: BlastZone): boolean {
  const transform = transformComponents.get(entityId);
  if (!transform) return false;

  return (
    transform.x < blastZone.left  ||
    transform.x > blastZone.right ||
    transform.y > blastZone.top   ||
    transform.y < blastZone.bottom
  );
}

let _activeBlastZone: BlastZone | null = null;

export function setActiveBlastZone(zone: BlastZone): void {
  _activeBlastZone = zone;
}

export function getActiveBlastZone(): BlastZone | null {
  return _activeBlastZone;
}

export function blastZoneSystem(): void {
  if (!_activeBlastZone) return;

  for (const [id, fighter] of fighterComponents) {
    if (fighter.state === 'KO') {
      if (fighter.respawnCountdown !== undefined && fighter.respawnCountdown > 0) {
        fighter.respawnCountdown--;
        if (fighter.respawnCountdown === 0) {
          respawnFighter(id);
        }
      }
      continue;
    }

    if (isOutsideBlastZone(id, _activeBlastZone)) {
      triggerKO(id);
    }
  }
}

export function respawnFighter(entityId: number): void {
  const fighter   = fighterComponents.get(entityId);
  const transform = transformComponents.get(entityId);
  const phys      = physicsComponents.get(entityId);

  if (!fighter || !transform || !phys) return;

  fighter.damagePercent    = toFixed(0);
  fighter.hitstunFrames    = 0;
  fighter.hitlagFrames     = 0;
  fighter.invincibleFrames = RESPAWN_INVINCIBLE_FRAMES;
  fighter.jumpCount        = 0;

  transform.x     = toFixed(0);
  transform.y     = toFixed(200);
  transform.prevX = toFixed(0);
  transform.prevY = toFixed(200);

  phys.vx          = toFixed(0);
  phys.vy          = toFixed(0);
  phys.grounded    = false;
  phys.fastFalling = false;

  transitionFighterState(entityId, 'idle');
}

export function checkMatchEnd(): number | null {
  let survivorId: number | null = null;
  let aliveCount = 0;

  for (const [id, fighter] of fighterComponents) {
    if (fighter.stocks > 0) {
      aliveCount++;
      survivorId = id;
    }
  }

  return aliveCount <= 1 ? survivorId : null;
}
