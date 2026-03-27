// src/renderer/camera.ts
// Intelligent camera: lerps toward a bounding-box target that keeps all fighters visible.

import { toFloat } from '../engine/physics/fixednum.js';
import { transformComponents } from '../engine/ecs/component.js';

export interface CameraState {
  x: number;      // world-space center X
  y: number;      // world-space center Y
  zoom: number;   // scale factor (1.0 = 1:1 at internal resolution)
}

const CAMERA_PADDING_X = 300;
const CAMERA_PADDING_Y = 200;
const CAMERA_ZOOM_MAX  = 1.2;
const CAMERA_ZOOM_MIN  = 0.5;
const CAMERA_LERP      = 0.08;
const CAMERA_ZOOM_LERP = 0.04;

const VIEWPORT_WIDTH  = 1920;
const VIEWPORT_HEIGHT = 1080;

export const camera: CameraState = { x: 0, y: 0, zoom: 1.0 };

/** Update camera position and zoom toward the bounding box of all active fighters. */
export function updateCamera(fighterEntityIds: number[]): void {
  if (fighterEntityIds.length === 0) return;

  let minX = Infinity,  maxX = -Infinity;
  let minY = Infinity,  maxY = -Infinity;

  for (const id of fighterEntityIds) {
    const t = transformComponents.get(id);
    if (!t) continue;
    const fx = toFloat(t.x);
    const fy = toFloat(t.y);
    if (fx < minX) minX = fx;
    if (fx > maxX) maxX = fx;
    if (fy < minY) minY = fy;
    if (fy > maxY) maxY = fy;
  }

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  const spreadX  = (maxX - minX) + CAMERA_PADDING_X;
  const spreadY  = (maxY - minY) + CAMERA_PADDING_Y;
  const zoomX    = VIEWPORT_WIDTH  / spreadX;
  const zoomY    = VIEWPORT_HEIGHT / spreadY;
  const targetZoom = Math.max(
    Math.min(zoomX, zoomY, CAMERA_ZOOM_MAX),
    CAMERA_ZOOM_MIN,
  );

  camera.x    += (cx          - camera.x)    * CAMERA_LERP;
  camera.y    += (cy          - camera.y)    * CAMERA_LERP;
  camera.zoom += (targetZoom  - camera.zoom) * CAMERA_ZOOM_LERP;
}

/** Return the world-to-clip transform parameters for the current camera state. */
export function getCameraTransform(): {
  offsetX: number;
  offsetY: number;
  scaleX:  number;
  scaleY:  number;
} {
  const scaleX = (2 / VIEWPORT_WIDTH)  * camera.zoom;
  const scaleY = (2 / VIEWPORT_HEIGHT) * camera.zoom;
  return {
    offsetX: -camera.x * scaleX,
    offsetY: -camera.y * scaleY,
    scaleX,
    scaleY,
  };
}
