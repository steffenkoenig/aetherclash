// src/renderer/camera.ts
// Dynamic camera: frames all on-stage fighters with velocity look-ahead,
// subtle roll-tilt, and FOV breathing — giving a kinetic N64-platform-fighter feel.
//
// Fighters that have been launched well outside the stage blast-zone are
// excluded from the bounding-box so the camera stays on the action; the HUD
// arrow indicators (hud.ts) communicate off-screen fighter positions.

import { toFloat }                                 from '../engine/physics/fixednum.js';
import { transformComponents, physicsComponents }  from '../engine/ecs/component.js';
import { activeBlastZones }                        from '../engine/physics/blastZone.js';

export interface CameraState {
  x:    number;  // world-space centre X
  y:    number;  // world-space centre Y
  zoom: number;  // orthographic zoom scale (higher = zoomed in)
  tilt: number;  // Z-axis roll in radians — subtle camera bank
  fov:  number;  // PerspectiveCamera FOV in degrees — breathes with zoom
  zOff: number;  // Z-offset added to base PERSP_Z (pulls back when spread is wide)
}

// ── Tuning constants ──────────────────────────────────────────────────────────

/** Padding (world units) added around the tightest fighter bounding box. */
const PADDING_X = 260;
const PADDING_Y = 180;

/** Zoom range (THREE.PerspectiveCamera.zoom units). */
const ZOOM_MAX = 1.30;
const ZOOM_MIN = 0.42;

/**
 * Fraction of the average fighter velocity vector added to the camera target
 * position — makes the camera "look ahead" of the action.
 */
const LOOK_AHEAD = 0.12;

/** Maximum camera roll in radians (≈ 2.5°). */
const MAX_TILT = 0.044;

/** Base FOV and extra degrees added at minimum zoom (camera pulled back). */
const FOV_BASE  = 45;
const FOV_SWELL =  9;   // additional FOV at minimum zoom

/** Maximum extra Z depth pushed to the camera position when fighters are spread. */
const PERSP_Z_RANGE = 120;

/**
 * Fighters more than this many world units beyond a blast-zone boundary are
 * considered "off-stage" and excluded from the bounding-box calculation.
 */
const OUT_OF_FRAME_MARGIN = 180;

/** Lerp rates — lower = more lag / more cinematic feel. */
const LERP_POS  = 0.065;
const LERP_ZOOM = 0.038;
const LERP_TILT = 0.042;
const LERP_FOV  = 0.040;
const LERP_ZOFF = 0.038;

/** Internal reference resolution matching the Three.js renderer. */
const VIEWPORT_W = 1920;
const VIEWPORT_H = 1080;

// ── Camera state ──────────────────────────────────────────────────────────────

export const camera: CameraState = {
  x: 0, y: 0, zoom: 1.0, tilt: 0, fov: FOV_BASE, zOff: 0,
};

// ── Camera update ─────────────────────────────────────────────────────────────

/**
 * Advance the camera by one render frame toward the current fight.
 *
 * Only fighters within `OUT_OF_FRAME_MARGIN` of the blast-zone boundary are
 * included in the bounding-box so the camera stays on the main action.
 * Fighters that have been launched off-stage are excluded; the HUD arrow
 * indicators communicate their whereabouts to the player instead.
 */
export function updateCamera(fighterEntityIds: number[]): void {
  if (fighterEntityIds.length === 0) return;

  // Blast-zone bounds converted to floats, padded outward by the margin.
  const bzL = toFloat(activeBlastZones.left)   - OUT_OF_FRAME_MARGIN;
  const bzR = toFloat(activeBlastZones.right)  + OUT_OF_FRAME_MARGIN;
  const bzT = toFloat(activeBlastZones.top)    + OUT_OF_FRAME_MARGIN;
  const bzB = toFloat(activeBlastZones.bottom) - OUT_OF_FRAME_MARGIN;

  let minX = Infinity,  maxX = -Infinity;
  let minY = Infinity,  maxY = -Infinity;
  let sumVx = 0, sumVy = 0;
  let count = 0;

  for (const id of fighterEntityIds) {
    const t = transformComponents.get(id);
    if (!t) continue;
    const fx = toFloat(t.x);
    const fy = toFloat(t.y);

    // Exclude fighters launched well outside the blast zone.
    if (fx < bzL || fx > bzR || fy < bzB || fy > bzT) continue;

    if (fx < minX) minX = fx;
    if (fx > maxX) maxX = fx;
    if (fy < minY) minY = fy;
    if (fy > maxY) maxY = fy;

    const p = physicsComponents.get(id);
    if (p) { sumVx += toFloat(p.vx); sumVy += toFloat(p.vy); }
    count++;
  }

  // If every fighter is off-stage, keep the current state and wait for respawn.
  if (count === 0) return;

  const avgVx = sumVx / count;
  const avgVy = sumVy / count;

  // Target centre: bounding-box midpoint nudged toward fighter velocity direction.
  const targetX = (minX + maxX) / 2 + avgVx * LOOK_AHEAD;
  const targetY = (minY + maxY) / 2 + avgVy * LOOK_AHEAD;

  // Zoom: fit the fighter spread + padding into the viewport.
  const spreadX    = (maxX - minX) + PADDING_X;
  const spreadY    = (maxY - minY) + PADDING_Y;
  const zoomX      = VIEWPORT_W / spreadX;
  const zoomY      = VIEWPORT_H / spreadY;
  const targetZoom = Math.max(Math.min(zoomX, zoomY, ZOOM_MAX), ZOOM_MIN);

  // Tilt: lean the camera slightly toward whichever side has more fighters.
  // Uses tanh for a smooth -1…+1 mapping; modulated by how spread-out they are.
  const horizCentre = (minX + maxX) / 2;
  const normHoriz   = Math.tanh(horizCentre / 300);       // -1…+1
  const normSpread  = Math.min((maxX - minX) / 600, 1.0); // 0…1
  const targetTilt  = -normHoriz * normSpread * MAX_TILT;  // sign: right-heavy → clockwise

  // FOV breathing: wider angle when fighters are spread far apart (zoomed out).
  const zoomFrac  = (targetZoom - ZOOM_MIN) / (ZOOM_MAX - ZOOM_MIN); // 0=min, 1=max
  const targetFov = FOV_BASE + (1.0 - zoomFrac) * FOV_SWELL;

  // Z pull-back: push the camera further away when the spread is large,
  // accentuating the sense of depth and distance.
  const targetZoff = (1.0 - zoomFrac) * PERSP_Z_RANGE;

  // Lerp all camera fields toward their targets.
  camera.x    += (targetX    - camera.x)    * LERP_POS;
  camera.y    += (targetY    - camera.y)    * LERP_POS;
  camera.zoom += (targetZoom - camera.zoom) * LERP_ZOOM;
  camera.tilt += (targetTilt - camera.tilt) * LERP_TILT;
  camera.fov  += (targetFov  - camera.fov)  * LERP_FOV;
  camera.zOff += (targetZoff - camera.zOff) * LERP_ZOFF;
}

// ── Clip-space transform for HUD / offscreen indicators ──────────────────────

/**
 * Return the world-to-NDC transform parameters that match the current camera
 * state.  Used by hud.ts to place offscreen arrow indicators.
 */
export function getCameraTransform(): {
  offsetX: number;
  offsetY: number;
  scaleX:  number;
  scaleY:  number;
} {
  const scaleX = (2 / VIEWPORT_W) * camera.zoom;
  const scaleY = (2 / VIEWPORT_H) * camera.zoom;
  return {
    offsetX: -camera.x * scaleX,
    offsetY: -camera.y * scaleY,
    scaleX,
    scaleY,
  };
}
