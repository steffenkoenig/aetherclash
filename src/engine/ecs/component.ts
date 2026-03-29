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
  | 'crouch'
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
  /** Frames both attacker and victim are frozen after a hit. */
  hitlagFrames: number;
  /** Shield health 0–SHIELD_MAX_HEALTH; depletes while shielding. */
  shieldHealth: number;
  /** Frames of shield-break stun remaining. */
  shieldBreakFrames: number;
  /** Current frame index within the active move animation. */
  attackFrame: number;
  /** ID of the active move, or null when not attacking. */
  currentMoveId: string | null;
  stats: FighterStats;
  /**
   * EntityId of the opponent currently being held in a grab, or null.
   * Set when the grab connects; cleared when the grab ends or throw is executed.
   */
  grabVictimId: number | null;
  /**
   * Frames the attack button has been held while a smash attack is charging.
   * 0 = not charging. Clamped to SMASH_CHARGE_MAX_FRAMES before release.
   */
  smashChargeFrames: number;
}

/** Maximum shield health value; depleted to 0 causes a shield break. */
export const SHIELD_MAX_HEALTH = 100;

// ── Move data types ───────────────────────────────────────────────────────────

export interface Hitbox {
  /** [firstActiveFrame, lastActiveFrame] (inclusive). */
  activeFrames: [number, number];
  offsetX: Fixed;
  offsetY: Fixed;
  width: Fixed;
  height: Fixed;
  /** Raw damage dealt (plain integer, not Fixed). */
  damage: number;
  knockbackScaling: Fixed;
  baseKnockback: Fixed;
  /** Launch angle in degrees (0 = right, 90 = up, 180 = left, 270 = down). */
  launchAngle: number;
  hitlagFrames: number;
  /** Unique identifier per move instance to drive the hit registry. */
  id: string;
}

export interface Hurtbox {
  /** [firstActiveFrame, lastActiveFrame] (inclusive). */
  activeFrames: [number, number];
  offsetX: Fixed;
  offsetY: Fixed;
  width: Fixed;
  height: Fixed;
  /** Intangible hurtboxes are not hit but do not grant full invincibility. */
  intangible: boolean;
  /** Fully invincible — hits pass through entirely. */
  invincible: boolean;
}

export interface Move {
  totalFrames: number;
  hitboxes: Hitbox[];
  hurtboxes: Hurtbox[];
  /** "Interruptible As Soon As" frame — earliest cancellable frame. */
  iasa: number;
  landingLag: number;
  /**
   * If true, holding the attack button delays the move's active frames,
   * allowing the player to charge for up to SMASH_CHARGE_MAX_FRAMES.
   * Damage and knockback are multiplied by up to SMASH_CHARGE_MULT_MAX.
   */
  canCharge?: boolean;
  /**
   * If set, this move is a throw — the move's hitbox is applied directly
   * to the grabbed victim and releases them.
   */
  isThrow?: boolean;
  /**
   * The next move ID in a jab chain sequence.
   * e.g. neutralJab1.nextJab = 'neutralJab2'.
   * If set, pressing attack again at IASA chains to this move.
   */
  nextJab?: string;
}

// ── Ledge collider ────────────────────────────────────────────────────────────

export interface LedgeCollider {
  x: Fixed;
  y: Fixed;
  /** Which side of the platform this ledge is on. */
  facingRight: boolean;
  /** EntityId of the fighter currently holding this ledge, or null if free. */
  occupiedByEntityId: EntityId | null;
  /** Cooldown frames remaining before this ledge can be grabbed again. */
  cooldownFrames: number;
}

/**
 * Renderable component — links an entity to its low-poly 3D glTF/GLB mesh and
 * flat-shaded texture atlas.  The gameplay plane is 2D (physics uses X/Y), but
 * characters and stage elements are rendered as real-time 3D models from a
 * fixed side-on orthographic camera.
 *
 * Asset layout (per character):
 *   public/assets/characters/<id>/<id>.glb          — rigged low-poly mesh + animation clips
 *   public/assets/characters/<id>/<id>_atlas.png    — 2048×2048 flat-shaded texture atlas
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

export const transformComponents   = new Map<EntityId, Transform>();
export const physicsComponents     = new Map<EntityId, Physics>();
export const fighterComponents     = new Map<EntityId, Fighter>();
export const renderableComponents  = new Map<EntityId, Renderable>();
export const ledgeColliderComponents = new Map<EntityId, LedgeCollider>();

export function clearAllComponents(): void {
  transformComponents.clear();
  physicsComponents.clear();
  fighterComponents.clear();
  renderableComponents.clear();
  ledgeColliderComponents.clear();
}
