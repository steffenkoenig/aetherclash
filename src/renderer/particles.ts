// src/renderer/particles.ts
// Visual effects: screen shake, launch trails, hit sparks, and KO flash.
//
// All effects are renderer-only — they never touch the physics simulation and
// are therefore safe to use `performance.now()` and `Math.random()`.
//
// API:
//   triggerScreenShake(intensity, duration)  — camera perturbation
//   getScreenShakeOffset()                   — call each render frame
//   spawnHitSpark(x, y, color)               — burst of particles at hit location
//   spawnLaunchTrail(entityId, x, y, force)  — fading quads tracking launch
//   triggerKOFlash()                         — full-screen white flash + vignette
//   updateParticles(deltaMs)                 — advance all active effects; call once per render
//   disposeParticles()                       — remove all DOM overlays from document

// ── Types ─────────────────────────────────────────────────────────────────────

interface Particle {
  x:       number;
  y:       number;
  vx:      number;
  vy:      number;
  life:    number; // remaining life in ms
  maxLife: number;
  size:    number;
  color:   string; // CSS hex string
}

interface TrailPoint {
  x: number;
  y: number;
}

interface LaunchTrail {
  entityId: number;
  points:   TrailPoint[];
  color:    string;
  duration: number; // ms
  elapsed:  number; // ms
}

// ── Module state ──────────────────────────────────────────────────────────────

const particles: Particle[] = [];
const trails: LaunchTrail[] = [];

// Screen shake
let shakeIntensity = 0; // px
let shakeDuration  = 0; // ms
let shakeElapsed   = 0; // ms

// KO flash overlay
let koFlashEl: HTMLDivElement | null = null;
let koFlashElapsed = 0;
const KO_FLASH_TOTAL_MS = 600; // 1 frame white (16 ms) + 0.5 s vignette

// Canvas overlay for rendering particles
let canvas: HTMLCanvasElement | null = null;
let ctx2d: CanvasRenderingContext2D | null = null;

// ── Screen Shake ──────────────────────────────────────────────────────────────

/**
 * Trigger a screen shake effect.
 * @param intensity  Maximum displacement in pixels (world units).
 * @param durationMs Duration of the shake in milliseconds.
 *
 * Shake values from rendering.md:
 *   Light hit:        intensity=2,  duration=100ms
 *   Strong hit:       intensity=6,  duration=200ms
 *   Smash attack land: intensity=12, duration=300ms
 *   KO:               intensity=20, duration=500ms
 */
export function triggerScreenShake(intensity: number, durationMs: number): void {
  // Upgrade intensity if a new hit is harder than the current shake
  if (intensity > shakeIntensity) {
    shakeIntensity = intensity;
  }
  if (durationMs > shakeDuration - shakeElapsed) {
    shakeDuration = durationMs;
    shakeElapsed  = 0;
  }
}

/**
 * Return the current shake offset {x, y} in world units.
 * Call once per render frame. Uses a damped sine wave as documented.
 */
export function getScreenShakeOffset(): { x: number; y: number } {
  if (shakeDuration <= 0 || shakeIntensity <= 0) return { x: 0, y: 0 };
  const progress = shakeElapsed / shakeDuration; // 0→1
  const decay    = 1 - progress;
  const freq     = 60; // oscillations per second (matches docs: sin(shakeTimer * 60))
  const timeSec  = shakeElapsed / 1000;
  return {
    x: Math.sin(timeSec * freq)      * shakeIntensity * decay,
    y: Math.sin(timeSec * freq + 1.5) * shakeIntensity * decay * 0.5,
  };
}

// ── Hit Sparks ────────────────────────────────────────────────────────────────

/**
 * Spawn a burst of 6–12 spark particles at world position (x, y).
 * @param x     World X coordinate (pixels).
 * @param y     World Y coordinate (pixels).
 * @param color CSS hex color string for the sparks (e.g. '#4488ee').
 */
export function spawnHitSpark(x: number, y: number, color: string): void {
  const count = 6 + Math.floor(Math.random() * 7); // 6–12
  for (let i = 0; i < count; i++) {
    const angle   = Math.random() * Math.PI * 2;
    const speed   = 60 + Math.random() * 120; // px/s
    const lifeMs  = 200 + Math.random() * 200; // 200–400 ms
    particles.push({
      x, y,
      vx:      Math.cos(angle) * speed,
      vy:      Math.sin(angle) * speed,
      life:    lifeMs,
      maxLife: lifeMs,
      size:    2 + Math.random() * 3,
      color,
    });
  }
}

// ── Launch Trails ─────────────────────────────────────────────────────────────

/**
 * Launch-force color thresholds from rendering.md:
 *   F  8–15 → White   0.3 s
 *   F 16–25 → Yellow/Orange 0.5 s
 *   F 26–40 → Orange/Red    0.7 s
 *   F  40+  → Red/Purple    1.0 s
 */
function trailColorForForce(force: number): { color: string; durationMs: number } {
  if (force >= 40) return { color: '#cc44ff', durationMs: 1000 };
  if (force >= 26) return { color: '#ff4400', durationMs:  700 };
  if (force >= 16) return { color: '#ffaa00', durationMs:  500 };
  return              { color: '#ffffff',   durationMs:  300 };
}

/**
 * Spawn or update a launch trail for a fighter entity.
 * Call each render frame while the fighter is in launch (hitstun) state,
 * passing their current world position.
 *
 * @param entityId  Fighter entity ID.
 * @param x         Current world X (pixels).
 * @param y         Current world Y (pixels).
 * @param force     Launch force magnitude (used to pick colour on first call).
 */
export function spawnLaunchTrail(
  entityId: number,
  x: number,
  y: number,
  force: number,
): void {
  let trail = trails.find(t => t.entityId === entityId);
  if (!trail) {
    const { color, durationMs } = trailColorForForce(force);
    trail = { entityId, points: [], color, duration: durationMs, elapsed: 0 };
    trails.push(trail);
  }
  // Store up to the last 8 positions
  trail.points.push({ x, y });
  if (trail.points.length > 8) trail.points.shift();
  // Reset elapsed whenever we receive a new point (trail is still "live")
  trail.elapsed = 0;
}

/**
 * Stop tracking the launch trail for `entityId` (call when fighter lands /
 * leaves hitstun).  The trail fades out naturally from this point.
 */
export function endLaunchTrail(_entityId: number): void {
  // Do nothing — trail fades based on `elapsed >= duration`; just leave it.
  // This is intentional: the last few positions remain visible for the fade.
}

// ── KO Flash ─────────────────────────────────────────────────────────────────

/**
 * Trigger the KO flash effect: a 1-frame white flash followed by a 0.5 s
 * dark vignette fade (rendering.md).
 */
export function triggerKOFlash(): void {
  ensureKOFlashEl();
  koFlashElapsed = 0;
  if (koFlashEl) {
    koFlashEl.style.display    = 'block';
    koFlashEl.style.background = '#ffffff';
    koFlashEl.style.opacity    = '1';
    koFlashEl.style.pointerEvents = 'none';
  }
}

function ensureKOFlashEl(): void {
  if (koFlashEl) return;
  koFlashEl = document.createElement('div');
  Object.assign(koFlashEl.style, {
    position:  'fixed',
    inset:     '0',
    zIndex:    '100',
    display:   'none',
    pointerEvents: 'none',
  });
  document.body.appendChild(koFlashEl);
}

// ── 2D Canvas overlay for particles and trails ────────────────────────────────

function ensureCanvas(): void {
  if (canvas) return;
  canvas = document.createElement('canvas');
  Object.assign(canvas.style, {
    position:      'fixed',
    inset:         '0',
    width:         '100%',
    height:        '100%',
    zIndex:        '50',
    pointerEvents: 'none',
  });
  document.body.appendChild(canvas);
  ctx2d = canvas.getContext('2d');
}

function resizeCanvas(): void {
  if (!canvas) return;
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}

// ── Update & render ───────────────────────────────────────────────────────────

/**
 * Advance all particle effects by `deltaMs` milliseconds and render them.
 * Call once per render frame (after the Three.js renderer.render() call).
 *
 * @param deltaMs       Elapsed time since the last render frame in ms.
 * @param worldToScreen Optional transform to convert world → screen coords.
 *                      If omitted, world coords are treated as screen coords.
 */
export function updateParticles(
  deltaMs: number,
  worldToScreen?: (wx: number, wy: number) => { sx: number; sy: number },
): void {
  updateScreenShakeInternal(deltaMs);
  updateKOFlash(deltaMs);
  updateParticleList(deltaMs);
  updateTrails(deltaMs);
  renderOverlay(worldToScreen);
}

function updateScreenShakeInternal(deltaMs: number): void {
  if (shakeDuration <= 0) return;
  shakeElapsed += deltaMs;
  if (shakeElapsed >= shakeDuration) {
    shakeIntensity = 0;
    shakeDuration  = 0;
    shakeElapsed   = 0;
  }
}

function updateKOFlash(deltaMs: number): void {
  if (!koFlashEl || koFlashEl.style.display === 'none') return;
  koFlashElapsed += deltaMs;
  const t = koFlashElapsed / KO_FLASH_TOTAL_MS; // 0→1

  if (t >= 1) {
    koFlashEl.style.display = 'none';
    return;
  }

  // First 16 ms: pure white flash.
  if (koFlashElapsed <= 16) {
    koFlashEl.style.background = '#ffffff';
    koFlashEl.style.opacity    = '1';
  } else {
    // Fade to a dark vignette for the remaining ~0.5 s
    const vignetteProgress = (koFlashElapsed - 16) / (KO_FLASH_TOTAL_MS - 16);
    const opacity = (1 - vignetteProgress) * 0.35;
    koFlashEl.style.background = 'radial-gradient(ellipse at center, transparent 40%, #000 100%)';
    koFlashEl.style.opacity    = String(Math.max(0, opacity));
  }
}

function updateParticleList(deltaMs: number): void {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]!;
    p.x    += p.vx * (deltaMs / 1000);
    p.y    += p.vy * (deltaMs / 1000);
    // Mild gravity on sparks (renderer-only, not physics)
    p.vy   += 200 * (deltaMs / 1000);
    p.life -= deltaMs;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function updateTrails(deltaMs: number): void {
  for (let i = trails.length - 1; i >= 0; i--) {
    const t = trails[i]!;
    t.elapsed += deltaMs;
    if (t.elapsed >= t.duration) trails.splice(i, 1);
  }
}

function renderOverlay(
  worldToScreen?: (wx: number, wy: number) => { sx: number; sy: number },
): void {
  if (particles.length === 0 && trails.length === 0) return;

  ensureCanvas();
  resizeCanvas();
  if (!ctx2d || !canvas) return;

  ctx2d.clearRect(0, 0, canvas.width, canvas.height);

  // Convert world coords to canvas (screen) coords
  const toScreen = worldToScreen
    ?? ((wx: number, wy: number) => ({ sx: wx, sy: wy }));

  // Draw trails
  for (const trail of trails) {
    if (trail.points.length < 2) continue;
    const alpha = 1 - trail.elapsed / trail.duration;
    ctx2d.save();
    ctx2d.globalAlpha = alpha;
    ctx2d.strokeStyle = trail.color;
    ctx2d.lineWidth   = 4;
    ctx2d.lineCap     = 'round';
    ctx2d.lineJoin    = 'round';
    ctx2d.beginPath();
    const p0 = toScreen(trail.points[0]!.x, trail.points[0]!.y);
    ctx2d.moveTo(p0.sx, p0.sy);
    for (let i = 1; i < trail.points.length; i++) {
      const pt = toScreen(trail.points[i]!.x, trail.points[i]!.y);
      ctx2d.lineTo(pt.sx, pt.sy);
      // Fade earlier points more aggressively
      ctx2d.globalAlpha = alpha * (i / trail.points.length);
    }
    ctx2d.stroke();
    ctx2d.restore();
  }

  // Draw particles
  for (const p of particles) {
    const lifeAlpha = p.life / p.maxLife;
    const { sx, sy } = toScreen(p.x, p.y);
    ctx2d.save();
    ctx2d.globalAlpha = lifeAlpha;
    ctx2d.fillStyle   = p.color;
    ctx2d.beginPath();
    ctx2d.arc(sx, sy, p.size * lifeAlpha, 0, Math.PI * 2);
    ctx2d.fill();
    ctx2d.restore();
  }
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

/**
 * Remove all particle overlay DOM elements from the document.
 * Call at match end or page teardown.
 */
export function disposeParticles(): void {
  particles.length = 0;
  trails.length    = 0;
  shakeIntensity   = 0;
  shakeDuration    = 0;
  shakeElapsed     = 0;

  if (canvas) {
    canvas.parentNode?.removeChild(canvas);
    canvas = null;
    ctx2d  = null;
  }
  if (koFlashEl) {
    koFlashEl.parentNode?.removeChild(koFlashEl);
    koFlashEl     = null;
    koFlashElapsed = 0;
  }
}
