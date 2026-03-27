// src/renderer/hud.ts
// Damage HUD rendered as an HTML/CSS overlay above the WebGL canvas.
//
// Damage colour:  white (0–30%) → yellow (31–80%) → orange (81–120%) → red (121%+)
// Layout: two side-by-side panels fixed at the bottom centre of the screen.
// Off-screen indicators: arrow icons pinned to the viewport edge when a fighter
// is outside the camera's visible area.
//
// Also renders:
//   - Per-player keyboard help overlays in the bottom corners (keys glow when held)
//   - Active item dots drawn on a 2D canvas overlay

import { toFloat }                               from '../engine/physics/fixednum.js';
import { fighterComponents, transformComponents } from '../engine/ecs/component.js';
import { getCameraTransform }                    from './camera.js';
import { getKeysDown }                           from '../engine/input/keyboard.js';
import { activeItems }                           from '../game/items/items.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const PLAYER_COLORS = ['#4499FF', '#FF4444', '#44FF66', '#FFEE22'] as const;
/** Rounds damage to one decimal place before display. */
const DAMAGE_ROUND_FACTOR = 10;

// ── Module state ──────────────────────────────────────────────────────────────

let hudRoot: HTMLDivElement | null = null;
const panels: HTMLDivElement[]              = [];
const damageLabels: HTMLDivElement[]        = [];
const stockContainers: HTMLDivElement[]     = [];
const offscreenIndicators: HTMLDivElement[] = [];

let trackedIds: number[] = [];

// ── Keyboard overlay state ────────────────────────────────────────────────────

/** Callback to get P2 keys (injected from main.ts to avoid a circular dep). */
let getP2KeysDownFn: (() => ReadonlySet<string>) | null = null;

/** Register a getter for P2 key state. Call from main.ts after init. */
export function registerP2KeysGetter(fn: () => ReadonlySet<string>): void {
  getP2KeysDownFn = fn;
}

// DOM elements for keyboard key caps (one array per player)
const keyCapEls: Array<Array<{ el: HTMLElement; code: string }>> = [[], []];
let keyOverlayRoots: Array<HTMLDivElement | null> = [null, null];

// ── Item dot canvas ────────────────────────────────────────────────────────────

/** 2-D canvas overlay used to draw item dots in world space. */
let itemCanvas: HTMLCanvasElement | null = null;
let itemCtx: CanvasRenderingContext2D | null = null;

/** Colour for each ItemType category visible on the dot overlay. */
const ITEM_CATEGORY_COLOR: Record<string, string> = {
  meleeAugment:       '#FFD700', // gold
  throwableProjectile:'#FF6633', // orange-red
  assistOrb:          '#CC88FF', // purple
  healingCharm:       '#44FF88', // green
};

// ── Connection quality overlay ────────────────────────────────────────────────

let connQualityEl: HTMLDivElement | null = null;

/** Online connection stats updated each render frame. */
export interface ConnectionStats {
  rtt: number;        // round-trip time in ms
  packetLoss: number; // fraction 0–1
  inputDelay: number; // frames of adaptive input delay
}

let latestConnStats: ConnectionStats | null = null;

/**
 * Show or update the connection quality indicator.
 * Call once when a WebRTC DataChannel is established, then call
 * `updateConnectionStats` every render frame.
 */
export function showConnectionQuality(): void {
  if (connQualityEl) return;
  connQualityEl = document.createElement('div');
  connQualityEl.id = 'conn-quality';
  Object.assign(connQualityEl.style, {
    position:      'fixed',
    top:           '10px',
    right:         '10px',
    background:    'rgba(0,0,0,0.65)',
    color:         '#0f0',
    fontFamily:    'monospace',
    fontSize:      '12px',
    padding:       '6px 10px',
    borderRadius:  '4px',
    zIndex:        '60',
    pointerEvents: 'none',
    lineHeight:    '1.5',
  });
  document.body.appendChild(connQualityEl);
}

/** Update connection stats shown in the HUD overlay. */
export function updateConnectionStats(stats: ConnectionStats): void {
  latestConnStats = stats;
}

/** Hide and remove the connection quality indicator. */
export function hideConnectionQuality(): void {
  connQualityEl?.parentNode?.removeChild(connQualityEl);
  connQualityEl = null;
  latestConnStats = null;
}

function renderConnectionQuality(): void {
  if (!connQualityEl || !latestConnStats) return;
  const { rtt, packetLoss, inputDelay } = latestConnStats;
  const lossColor = packetLoss > 0.1 ? '#FF4444' : packetLoss > 0.02 ? '#FFEE22' : '#0f0';
  connQualityEl.innerHTML =
    `RTT: ${rtt.toFixed(0)} ms` +
    `<br>Loss: <span style="color:${lossColor}">${(packetLoss * 100).toFixed(1)}%</span>` +
    `<br>Delay: ${inputDelay}f`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getDamageColor(pct: number): string {
  if (pct <= 30)  return '#FFFFFF';
  if (pct <= 80)  return '#FFE000';
  if (pct <= 120) return '#FF8C00';
  return '#FF2020';
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Create HUD DOM elements and append them to `document.body`.
 * Call once after entities are registered; safe to call again after disposeHud.
 */
export function initHud(playerEntityIds: number[]): void {
  if (hudRoot) disposeHud();

  trackedIds = [...playerEntityIds];

  hudRoot = document.createElement('div');
  hudRoot.id = 'hud-root';
  Object.assign(hudRoot.style, {
    position:      'fixed',
    bottom:        '20px',
    left:          '50%',
    transform:     'translateX(-50%)',
    display:       'flex',
    gap:           '40px',
    zIndex:        '50',
    pointerEvents: 'none',
    fontFamily:    'monospace',
  });

  for (let i = 0; i < playerEntityIds.length; i++) {
    const id     = playerEntityIds[i]!;
    const fighter = fighterComponents.get(id);
    const color  = PLAYER_COLORS[i % PLAYER_COLORS.length]!;

    // ── Panel ──────────────────────────────────────────────────────────────
    const panel = document.createElement('div');
    Object.assign(panel.style, {
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      background:     'rgba(0,0,0,0.65)',
      borderRadius:   '8px',
      padding:        '10px 20px',
      minWidth:       '130px',
      border:         `2px solid ${color}`,
    });

    // Name label
    const nameLabel = document.createElement('div');
    nameLabel.textContent = `P${i + 1} ${fighter?.characterId.toUpperCase() ?? ''}`;
    Object.assign(nameLabel.style, {
      color,
      fontSize:     '14px',
      marginBottom: '4px',
      letterSpacing: '0.05em',
    });
    panel.appendChild(nameLabel);

    // Damage percentage (large, colour-coded)
    const dmgLabel = document.createElement('div');
    dmgLabel.textContent = '0.0%';
    Object.assign(dmgLabel.style, {
      fontSize:   '48px',
      fontWeight: 'bold',
      color:      '#FFFFFF',
      lineHeight: '1',
    });
    panel.appendChild(dmgLabel);
    damageLabels.push(dmgLabel);

    // Stock icons
    const stockCont = document.createElement('div');
    Object.assign(stockCont.style, {
      display:   'flex',
      gap:       '6px',
      marginTop: '8px',
    });
    const initialStocks = fighter?.stocks ?? 3;
    for (let s = 0; s < 3; s++) {
      const dot = document.createElement('div');
      dot.className = 'stock-icon';
      Object.assign(dot.style, {
        width:        '16px',
        height:       '16px',
        borderRadius: '50%',
        background:   s < initialStocks ? color : '#333',
        border:       '1px solid #555',
      });
      stockCont.appendChild(dot);
    }
    panel.appendChild(stockCont);
    stockContainers.push(stockCont);

    panels.push(panel);
    hudRoot.appendChild(panel);

    // ── Off-screen indicator (independently positioned) ────────────────────
    const arrow = document.createElement('div');
    arrow.className = 'offscreen-indicator';
    Object.assign(arrow.style, {
      position:      'fixed',
      display:       'none',
      fontSize:      '22px',
      color,
      zIndex:        '60',
      pointerEvents: 'none',
      textShadow:    '0 0 4px #000',
      userSelect:    'none',
    });
    document.body.appendChild(arrow);
    offscreenIndicators.push(arrow);
  }

  document.body.appendChild(hudRoot);

  // ── Keyboard overlays ──────────────────────────────────────────────────────
  buildKeyboardOverlay(0); // P1 bottom-left
  buildKeyboardOverlay(1); // P2 bottom-right

  // ── Item dot canvas ────────────────────────────────────────────────────────
  if (!itemCanvas) {
    itemCanvas = document.createElement('canvas');
    itemCanvas.id = 'item-overlay';
    Object.assign(itemCanvas.style, {
      position:      'fixed',
      top:           '0',
      left:          '0',
      width:         '100%',
      height:        '100%',
      pointerEvents: 'none',
      zIndex:        '49',
    });
    document.body.appendChild(itemCanvas);
    itemCtx = itemCanvas.getContext('2d');
  }
}

/**
 * Read current fighter state and refresh every HUD element.
 * Call once per render frame (after the physics step).
 */
export function updateHud(): void {
  if (!hudRoot || trackedIds.length === 0) return;

  const { offsetX, offsetY, scaleX, scaleY } = getCameraTransform();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const EDGE = 30;

  for (let i = 0; i < trackedIds.length; i++) {
    const id      = trackedIds[i]!;
    const fighter = fighterComponents.get(id);
    const transform = transformComponents.get(id);

    // ── Damage label ────────────────────────────────────────────────────────
    const dmgLabel = damageLabels[i];
    if (dmgLabel && fighter) {
      const pct = Math.round(toFloat(fighter.damagePercent) * DAMAGE_ROUND_FACTOR) / DAMAGE_ROUND_FACTOR;
      dmgLabel.textContent = `${pct.toFixed(1)}%`;
      dmgLabel.style.color = getDamageColor(pct);
    }

    // ── Stock icons ─────────────────────────────────────────────────────────
    const stockCont = stockContainers[i];
    if (stockCont && fighter) {
      const color   = PLAYER_COLORS[i % PLAYER_COLORS.length]!;
      const dots    = stockCont.querySelectorAll<HTMLDivElement>('.stock-icon');
      dots.forEach((dot, j) => {
        dot.style.background = j < fighter.stocks ? color : '#333';
      });
    }

    // ── Off-screen indicator ────────────────────────────────────────────────
    const indicator = offscreenIndicators[i];
    if (!indicator || !transform) continue;

    const wx    = toFloat(transform.x);
    const wy    = toFloat(transform.y);
    const clipX = wx * scaleX + offsetX;
    const clipY = wy * scaleY + offsetY;

    const offLeft   = clipX < -1;
    const offRight  = clipX >  1;
    const offBottom = clipY < -1;
    const offTop    = clipY >  1;

    if (offLeft || offRight || offBottom || offTop) {
      indicator.style.display = 'block';

      // Clamp world-space to edge pixel position
      const rawX = (clipX + 1) / 2 * vw;
      const rawY = (1 - clipY) / 2 * vh;
      const px   = Math.max(EDGE, Math.min(vw - EDGE, rawX));
      const py   = Math.max(EDGE, Math.min(vh - EDGE, rawY));

      indicator.style.left = `${px}px`;
      indicator.style.top  = `${py}px`;

      if (offLeft)        indicator.textContent = '◀';
      else if (offRight)  indicator.textContent = '▶';
      else if (offTop)    indicator.textContent = '▲';
      else                indicator.textContent = '▼';
    } else {
      indicator.style.display = 'none';
    }
  }

  renderConnectionQuality();
  renderKeyboardOverlays();
  renderItemDots();
}

/** Remove all HUD DOM elements and reset module state. */
export function disposeHud(): void {
  if (hudRoot?.parentNode) hudRoot.parentNode.removeChild(hudRoot);
  hudRoot = null;

  for (const el of offscreenIndicators) {
    if (el.parentNode) el.parentNode.removeChild(el);
  }

  // Remove keyboard overlays
  for (let p = 0; p < 2; p++) {
    keyOverlayRoots[p]?.parentNode?.removeChild(keyOverlayRoots[p]!);
    keyOverlayRoots[p] = null;
    keyCapEls[p]!.length = 0;
  }

  // Remove item canvas
  if (itemCanvas?.parentNode) itemCanvas.parentNode.removeChild(itemCanvas);
  itemCanvas = null;
  itemCtx   = null;

  panels.length              = 0;
  damageLabels.length        = 0;
  stockContainers.length     = 0;
  offscreenIndicators.length = 0;
  trackedIds                 = [];

  hideConnectionQuality();
}

// ── Keyboard overlay ───────────────────────────────────────────────────────────

/**
 * Key layout definitions.
 *
 * Each entry is a row; each key is { label, code }.
 * `null` is a spacer of roughly one key-width.
 *
 * P1 uses WASD + action keys (J attack, K special, I grab, L shield).
 * P2 uses Arrow keys + Numpad action keys (7 attack, 8 special, 9 grab, 0 shield).
 */
type KeyDef = { label: string; code: string; wide?: boolean } | null;

const KEY_LAYOUT: Array<Array<KeyDef[]>> = [
  // ── P1 rows ────────────────────────────────────────────────────────────────
  [
    // row 0: top action keys (arranged as I K _ L on keyboard)
    [
      { label: 'I', code: 'KeyI' },   // grab
      { label: 'K', code: 'KeyK' },   // special
      null,
      { label: 'L', code: 'KeyL' },   // shield
    ],
    // row 1: W (jump) + J (attack)
    [
      { label: 'W', code: 'KeyW' },   // jump / up
      null,
      { label: 'J', code: 'KeyJ' },   // attack
    ],
    // row 2: A S D movement
    [
      { label: 'A', code: 'KeyA' },   // left
      { label: 'S', code: 'KeyS' },   // down
      { label: 'D', code: 'KeyD' },   // right
    ],
    // row 3: space bar (also jump)
    [
      { label: 'SPACE', code: 'Space', wide: true },
    ],
  ],
  // ── P2 rows ────────────────────────────────────────────────────────────────
  [
    // row 0: numpad action keys 7 8 9
    [
      { label: '7', code: 'Numpad7' }, // attack
      { label: '8', code: 'Numpad8' }, // special
      { label: '9', code: 'Numpad9' }, // grab
    ],
    // row 1: numpad 0 (shield) + arrow up (jump)
    [
      { label: '0', code: 'Numpad0', wide: true }, // shield
      null,
      { label: '↑', code: 'ArrowUp' },             // jump
    ],
    // row 2: arrow cluster
    [
      { label: '←', code: 'ArrowLeft'  },  // left
      { label: '↓', code: 'ArrowDown'  },  // down
      { label: '→', code: 'ArrowRight' },  // right
    ],
  ],
];

// Action captions (same shape as KEY_LAYOUT rows/keys, used as tooltips)
const KEY_CAPTIONS: Array<Array<Array<string>>> = [
  [
    ['grab', 'special', '', 'shield'],
    ['jump', '', 'attack'],
    ['left', 'down', 'right'],
    ['jump'],
  ],
  [
    ['attack', 'special', 'grab'],
    ['shield', '', 'jump'],
    ['left', 'down', 'right'],
  ],
];

function buildKeyboardOverlay(playerIndex: 0 | 1): void {
  const isLeft = playerIndex === 0;
  const color  = PLAYER_COLORS[playerIndex]!;
  const rows   = KEY_LAYOUT[playerIndex]!;

  const root = document.createElement('div');
  root.className = `key-overlay key-overlay-p${playerIndex + 1}`;
  Object.assign(root.style, {
    position:      'fixed',
    bottom:        '100px',
    [isLeft ? 'left' : 'right']: '12px',
    display:       'flex',
    flexDirection: 'column',
    gap:           '3px',
    zIndex:        '55',
    pointerEvents: 'none',
    userSelect:    'none',
    opacity:       '0.72',
  });

  const caps: Array<{ el: HTMLElement; code: string }> = [];

  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    const rowDef     = rows[rowIdx]!;
    const captionRow = KEY_CAPTIONS[playerIndex]?.[rowIdx] ?? [];

    const rowEl = document.createElement('div');
    Object.assign(rowEl.style, { display: 'flex', gap: '3px' });

    for (let keyIdx = 0; keyIdx < rowDef.length; keyIdx++) {
      const keyDef = rowDef[keyIdx];
      if (keyDef === null) {
        const spacer = document.createElement('div');
        Object.assign(spacer.style, { width: '24px', flexShrink: '0' });
        rowEl.appendChild(spacer);
        continue;
      }

      const cap = document.createElement('div');
      Object.assign(cap.style, {
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        width:          keyDef.wide ? '56px' : '24px',
        height:         '22px',
        borderRadius:   '4px',
        border:         '1px solid rgba(255,255,255,0.18)',
        background:     'rgba(0,0,0,0.55)',
        color:          'rgba(255,255,255,0.40)',
        fontSize:       keyDef.wide ? '9px' : '11px',
        fontFamily:     'monospace',
        fontWeight:     'bold',
        lineHeight:     '1',
        textAlign:      'center',
        boxSizing:      'border-box',
        flexShrink:     '0',
      });
      cap.textContent = keyDef.label;

      const caption = captionRow[keyIdx] ?? '';
      if (caption) cap.title = caption;

      rowEl.appendChild(cap);
      caps.push({ el: cap, code: keyDef.code });
    }
    root.appendChild(rowEl);
  }

  // "P1 / P2 controls" label
  const label = document.createElement('div');
  Object.assign(label.style, {
    color,
    fontSize:   '9px',
    fontFamily: 'monospace',
    marginTop:  '2px',
    textAlign:  isLeft ? 'left' : 'right',
    opacity:    '0.8',
    letterSpacing: '0.04em',
  });
  label.textContent = isLeft ? 'P1 controls' : 'P2 controls';
  root.appendChild(label);

  document.body.appendChild(root);
  keyOverlayRoots[playerIndex] = root;
  keyCapEls[playerIndex]       = caps;
}

function renderKeyboardOverlays(): void {
  const p1Keys = getKeysDown();
  const p2Keys: ReadonlySet<string> = getP2KeysDownFn?.() ?? new Set<string>();
  const keySets: ReadonlySet<string>[] = [p1Keys, p2Keys];

  for (let p = 0; p < 2; p++) {
    const keys  = keySets[p]!;
    const color = PLAYER_COLORS[p]!;
    for (const { el, code } of (keyCapEls[p] ?? [])) {
      const held = keys.has(code);
      el.style.background = held ? `rgba(${hexToRgb(color)},0.35)` : 'rgba(0,0,0,0.55)';
      el.style.color      = held ? '#FFFFFF' : 'rgba(255,255,255,0.40)';
      el.style.border     = held ? `1px solid ${color}` : '1px solid rgba(255,255,255,0.18)';
      el.style.boxShadow  = held ? `0 0 6px 1px ${color}` : 'none';
    }
  }
}

/** Convert a CSS hex colour like '#4499FF' to 'r,g,b' triplet string. */
function hexToRgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 0xff},${(n >> 8) & 0xff},${n & 0xff}`;
}

// ── Item dot canvas rendering ──────────────────────────────────────────────────

/**
 * Draw one coloured dot per active item on the transparent overlay canvas.
 * World coordinates are projected to screen pixels using the camera transform
 * from getCameraTransform(), which maps world→clip space (−1 to +1).
 */
function renderItemDots(): void {
  if (!itemCanvas || !itemCtx) return;

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Resize canvas to match viewport when the window is resized
  if (itemCanvas.width !== vw || itemCanvas.height !== vh) {
    itemCanvas.width  = vw;
    itemCanvas.height = vh;
  }
  itemCtx.clearRect(0, 0, vw, vh);

  if (activeItems.length === 0) return;

  const { offsetX, offsetY, scaleX, scaleY } = getCameraTransform();

  for (const item of activeItems) {
    // Items held by a fighter move with their carrier — no dot needed
    if (item.heldBy !== null) continue;

    const wx = toFloat(item.x);
    const wy = toFloat(item.y);

    // World → clip (−1 to +1 in each axis)
    const clipX = wx * scaleX + offsetX;
    const clipY = wy * scaleY + offsetY;

    // Clip → CSS pixel (Y is flipped: +1 clip = top of screen)
    const px = (clipX + 1) / 2 * vw;
    const py = (1 - clipY) / 2 * vh;

    // Cull items outside the viewport
    if (px < -20 || px > vw + 20 || py < -20 || py > vh + 20) continue;

    const color = ITEM_CATEGORY_COLOR[item.category] ?? '#FFFFFF';

    itemCtx.save();

    // Outer glow ring
    itemCtx.beginPath();
    itemCtx.arc(px, py, 9, 0, Math.PI * 2);
    itemCtx.fillStyle = color + '44';
    itemCtx.fill();

    // Solid coloured dot
    itemCtx.beginPath();
    itemCtx.arc(px, py, 5, 0, Math.PI * 2);
    itemCtx.fillStyle = color;
    itemCtx.fill();

    // White highlight rim
    itemCtx.beginPath();
    itemCtx.arc(px, py, 5, 0, Math.PI * 2);
    itemCtx.strokeStyle = 'rgba(255,255,255,0.7)';
    itemCtx.lineWidth   = 1;
    itemCtx.stroke();

    itemCtx.restore();
  }
}
