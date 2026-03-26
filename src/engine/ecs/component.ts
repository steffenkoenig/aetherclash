// src/engine/ecs/component.ts
// Typed component registry using Maps keyed by EntityId

import type { EntityId } from './entity.js';
import type { Fixed } from '../physics/fixednum.js';

// ── Component data types ──────────────────────────────────────────────────────

export interface Transform {
  x: Fixed;
  y: Fixed;
  prevX: Fixed;
  prevY: Fixed;
  facingRight: boolean;
}

export interface Physics {
  vx: Fixed;
  vy: Fixed;
  gravityMultiplier: Fixed; // Q16.16; 1.0 = normal airborne
  grounded: boolean;
  fastFalling: boolean;
}

export type FighterState =
  | 'idle'
  | 'walk'
  | 'run'
  | 'jump'
  | 'doubleJump'
  | 'attack'
  | 'hitstun'
  | 'shielding'
  | 'rolling'
  | 'spotDodge'
  | 'airDodge'
  | 'grabbing'
  | 'ledgeHang'
  | 'shieldBreak'
  | 'KO';

export interface FighterStats {
  maxFallSpeed: Fixed;
  maxFastFallSpeed: Fixed;
  jumpForce: Fixed;
  doubleJumpForce: Fixed;
  walkSpeed: Fixed;
  runSpeed: Fixed;
  weightClass: Fixed;
  // Phase 2 additions
  shieldHealthMax?: Fixed;
}

// ── Phase 2: Move data types ──────────────────────────────────────────────────

export interface Hitbox {
  offsetX: Fixed;
  offsetY: Fixed;
  width: Fixed;
  height: Fixed;
  damage: number;
  knockbackScaling: Fixed;
  baseKnockback: Fixed;
  launchAngle: number; // degrees (integer, not Fixed)
  activeFrames: [number, number]; // [startFrame, endFrame] inclusive
  hitlagFrames: number;
  id: string; // unique per move instance — used by hit registry
}

export interface Hurtbox {
  offsetX: Fixed;
  offsetY: Fixed;
  width: Fixed;
  height: Fixed;
  activeFrames: [number, number];
}

export interface Move {
  totalFrames: number;
  hitboxes: Hitbox[];
  hurtboxes: Hurtbox[];
  iasa: number;        // "Interruptible As Soon As" — first frame the player can act
  landingLag?: number; // extra landing lag if this move is in progress on landing
}

export interface Fighter {
  characterId: string;
  state: FighterState;
  damagePercent: Fixed;
  stocks: number;
  jumpCount: number; // 0 = no jumps used, 1 = first jump used, 2 = both used
  hitstunFrames: number;
  invincibleFrames: number;
  stats: FighterStats;
  // Phase 2 additions (optional for backward compatibility with Phase 1 tests)
  hitlagFrames?: number;          // freeze frames from a hit (both attacker and victim)
  shieldHealth?: Fixed;           // current shield health; 0 = broken
  currentMoveId?: string | null;  // ID of the active move (matches Move map key)
  currentMoveFrame?: number;      // current frame within the active move
  respawnCountdown?: number;      // frames until respawn after KO (180 = 3 s)
  ledgeHangFrames?: number;       // frames since ledge grab (first 20 = intangible)
}

// ── Move registries ───────────────────────────────────────────────────────────

/** Maps characterId → move-name → Move data.  Populated by each character module. */
export const moveRegistries = new Map<string, Record<string, Move>>();

// ── ECS registries ────────────────────────────────────────────────────────────

export const transformComponents = new Map<EntityId, Transform>();
export const physicsComponents   = new Map<EntityId, Physics>();
export const fighterComponents   = new Map<EntityId, Fighter>();

export function clearAllComponents(): void {
  transformComponents.clear();
  physicsComponents.clear();
  fighterComponents.clear();
}
