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

/**
 * Renderable component — links an entity to its low-poly 3D glTF/GLB mesh and
 * flat-shaded texture atlas.  The gameplay plane is 2D (physics uses X/Y), but
 * characters and stage elements are rendered as real-time 3D models from a
 * fixed side-on orthographic camera.
 *
 * Asset layout (per character):
 *   public/assets/<id>/<id>.glb          — rigged low-poly mesh + animation clips
 *   public/assets/<id>/<id>_atlas.png    — 2048×2048 flat-shaded texture atlas
 */
export interface Renderable {
  /** Path to the glTF/GLB rigged mesh asset (relative to /public). */
  meshUrl: string;
  /** Path to the 2048×2048 flat-shaded texture atlas PNG. */
  atlasUrl: string;
  /** Name of the active skeletal animation clip embedded in the glTF. */
  animationClip: string;
  /** Current frame index within the active clip (advanced each physics step). */
  animationFrame: number;
  /** Playback speed multiplier (1.0 = one physics-frame advance per game-frame). */
  animationSpeed: number;
  /** Whether the current clip loops on reaching its last frame. */
  loop: boolean;
}

// ── Registries ────────────────────────────────────────────────────────────────

export const transformComponents  = new Map<EntityId, Transform>();
export const physicsComponents    = new Map<EntityId, Physics>();
export const fighterComponents    = new Map<EntityId, Fighter>();
export const renderableComponents = new Map<EntityId, Renderable>();

export function clearAllComponents(): void {
  transformComponents.clear();
  physicsComponents.clear();
  fighterComponents.clear();
  renderableComponents.clear();
}
