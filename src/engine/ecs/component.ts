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
  | 'KO';

export interface FighterStats {
  maxFallSpeed: Fixed;
  maxFastFallSpeed: Fixed;
  jumpForce: Fixed;
  doubleJumpForce: Fixed;
  walkSpeed: Fixed;
  runSpeed: Fixed;
  weightClass: Fixed;
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
}

// ── Registries ────────────────────────────────────────────────────────────────

export const transformComponents = new Map<EntityId, Transform>();
export const physicsComponents   = new Map<EntityId, Physics>();
export const fighterComponents   = new Map<EntityId, Fighter>();

export function clearAllComponents(): void {
  transformComponents.clear();
  physicsComponents.clear();
  fighterComponents.clear();
}
