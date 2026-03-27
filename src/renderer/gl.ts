// src/renderer/gl.ts
// WebGL 2.0 canvas setup and placeholder renderer.
// Internal resolution: 1920×1080 with CSS viewport scaling.
//
// Rendering pipeline (layered, back-to-front):
//   1. Background geometry (3D parallax layers)
//   2. Stage geometry (3D platform meshes)
//   3. Character models (low-poly 3D, Z-buffer depth)
//   4. Projectiles / Items
//   5. Particle effects
//   6. HUD (HTML/CSS overlay, not WebGL)
//
// Phase 1: characters and platforms are rendered as placeholder coloured quads.
//          Z-buffer depth testing is already enabled so Phase 2 mesh rendering
//          will work without further pipeline changes.

import { toFloat } from '../engine/physics/fixednum.js';
import {
  transformComponents,
  renderableComponents,
} from '../engine/ecs/component.js';
import type { Platform } from '../engine/physics/collision.js';

// ── Canvas / context ─────────────────────────────────────────────────────────

let canvas: HTMLCanvasElement;
let gl: WebGL2RenderingContext;
let program: WebGLProgram;
let vao: WebGLVertexArrayObject;
let positionBuffer: WebGLBuffer;

// Cached uniform locations (populated once after program link; guaranteed non-null
// because we throw on link failure before reaching this point)
let uTranslation!: WebGLUniformLocation;
let uSize!: WebGLUniformLocation;
let uColor!: WebGLUniformLocation;

const INTERNAL_WIDTH  = 1920;
const INTERNAL_HEIGHT = 1080;

// World-space origin is the centre of the stage floor.
// We map world units 1:1 to pixels at 1080p.
const WORLD_TO_CLIP_X = 2 / INTERNAL_WIDTH;
const WORLD_TO_CLIP_Y = 2 / INTERNAL_HEIGHT;

const VS_SOURCE = `#version 300 es
precision highp float;
in vec2 a_position;
uniform vec2 u_translation;
uniform vec2 u_size;
uniform vec4 u_color;
out vec4 v_color;

void main() {
  // Build a unit quad [-0.5, 0.5]^2 → world space → clip space
  vec2 worldPos = a_position * u_size + u_translation;
  // Convert world coords to clip coords
  // World origin at centre of screen; +Y is up
  vec2 clip = vec2(
    worldPos.x * ${WORLD_TO_CLIP_X.toFixed(8)},
    worldPos.y * ${WORLD_TO_CLIP_Y.toFixed(8)}
  );
  gl_Position = vec4(clip, 0.0, 1.0);
  v_color = u_color;
}
`;

const FS_SOURCE = `#version 300 es
precision mediump float;
in vec4 v_color;
out vec4 fragColor;
void main() {
  fragColor = v_color;
}
`;

export function initRenderer(existingCanvas?: HTMLCanvasElement): HTMLCanvasElement {
  canvas = existingCanvas ?? document.createElement('canvas');
  canvas.style.width  = '100vw';
  canvas.style.height = '100vh';
  canvas.style.objectFit = 'contain';
  canvas.style.display = 'block';
  canvas.style.background = '#000';

  if (!existingCanvas) {
    document.body.style.margin = '0';
    document.body.style.overflow = 'hidden';
    document.body.style.background = '#000';
    document.body.appendChild(canvas);
  }

  const ctx = canvas.getContext('webgl2');
  if (!ctx) throw new Error('WebGL 2.0 not supported');
  gl = ctx;

  resizeRenderer();
  window.addEventListener('resize', resizeRenderer);

  // Enable Z-buffer depth testing — required for correct 3D model layering.
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);

  program = createShaderProgram(VS_SOURCE, FS_SOURCE);
  gl.useProgram(program);

  // Cache uniform locations once after program link
  uTranslation = gl.getUniformLocation(program, 'u_translation')!;
  uSize        = gl.getUniformLocation(program, 'u_size')!;
  uColor       = gl.getUniformLocation(program, 'u_color')!;

  // Unit quad vertices (two triangles)
  const verts = new Float32Array([
    -0.5, -0.5,
     0.5, -0.5,
    -0.5,  0.5,
    -0.5,  0.5,
     0.5, -0.5,
     0.5,  0.5,
  ]);

  vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);

  positionBuffer = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);

  const posLoc = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  gl.bindVertexArray(null);

  return canvas;
}

function resizeRenderer(): void {
  const dpr = Math.min(window.devicePixelRatio ?? 1, 2);
  canvas.width  = INTERNAL_WIDTH  * dpr;
  canvas.height = INTERNAL_HEIGHT * dpr;
  gl.viewport(0, 0, canvas.width, canvas.height);
}

function createShaderProgram(vs: string, fs: string): WebGLProgram {
  const vert = compileShader(gl.VERTEX_SHADER, vs);
  const frag = compileShader(gl.FRAGMENT_SHADER, fs);
  const prog = gl.createProgram()!;
  gl.attachShader(prog, vert);
  gl.attachShader(prog, frag);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(`Shader link error: ${gl.getProgramInfoLog(prog)}`);
  }
  return prog;
}

function compileShader(type: number, src: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(`Shader compile error: ${gl.getShaderInfoLog(shader)}`);
  }
  return shader;
}

// ── Drawing helpers ───────────────────────────────────────────────────────────

function drawQuad(x: number, y: number, w: number, h: number, r: number, g: number, b: number, a = 1.0): void {
  gl.uniform2f(uTranslation, x, y);
  gl.uniform2f(uSize, w, h);
  gl.uniform4f(uColor, r, g, b, a);

  gl.bindVertexArray(vao);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  gl.bindVertexArray(null);
}

// ── Render function ───────────────────────────────────────────────────────────

export function render(stagePlatforms: Platform[], _alpha: number): void {
  gl.clearColor(0.05, 0.05, 0.12, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.useProgram(program);

  // ── Stage geometry ────────────────────────────────────────────────────────
  // Phase 2: draw platform GLB meshes here.
  // Phase 1 placeholder: white rectangles.
  for (const plat of stagePlatforms) {
    const x1 = toFloat(plat.x1);
    const x2 = toFloat(plat.x2);
    const py  = toFloat(plat.y);
    const w   = x2 - x1;
    const cx  = (x1 + x2) / 2;
    const PLAT_THICKNESS = 10;
    drawQuad(cx, py - PLAT_THICKNESS / 2, w, PLAT_THICKNESS, 0.9, 0.9, 0.9);
  }

  // ── Character models ──────────────────────────────────────────────────────
  // Each entity that has both a Transform and a Renderable component is a
  // 3D model (character, item, etc.).  The Renderable tracks which glTF mesh
  // and animation clip to display.
  //
  // Phase 2: upload transform matrix + animation pose to GPU, bind the atlas
  //          texture, draw the character GLB mesh.
  // Phase 1 placeholder: coloured quads sized to roughly match character hitbox.
  const FIGHTER_COLORS = [
    [0.2, 0.6, 1.0],  // blue
    [1.0, 0.3, 0.3],  // red
    [0.3, 1.0, 0.4],  // green
    [1.0, 0.9, 0.2],  // yellow
  ];
  let colorIdx = 0;

  for (const [id, transform] of transformComponents) {
    const renderable = renderableComponents.get(id);
    if (!renderable) continue;

    const fx = toFloat(transform.x);
    const fy = toFloat(transform.y);
    const [r, g, b] = FIGHTER_COLORS[colorIdx % FIGHTER_COLORS.length]!;

    // Phase 1 placeholder: draw a 30×60 coloured quad in place of the 3D mesh.
    drawQuad(fx, fy, 30, 60, r, g, b);

    colorIdx++;
  }
}
