// src/renderer/hud.ts
// Damage HUD rendered as an HTML/CSS overlay above the WebGL canvas.
//
// Damage colour:  white (0–30%) → yellow (31–80%) → orange (81–120%) → red (121%+)
// Layout: two side-by-side panels fixed at the bottom centre of the screen.
// Off-screen indicators: arrow icons pinned to the viewport edge when a fighter
// is outside the camera's visible area.

import { toFloat }                          from '../engine/physics/fixednum.js';
import { fighterComponents, transformComponents } from '../engine/ecs/component.js';
import { getCameraTransform }              from './camera.js';

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
}

/** Remove all HUD DOM elements and reset module state. */
export function disposeHud(): void {
  if (hudRoot?.parentNode) hudRoot.parentNode.removeChild(hudRoot);
  hudRoot = null;

  for (const el of offscreenIndicators) {
    if (el.parentNode) el.parentNode.removeChild(el);
  }

  panels.length              = 0;
  damageLabels.length        = 0;
  stockContainers.length     = 0;
  offscreenIndicators.length = 0;
  trackedIds                 = [];

  hideConnectionQuality();
}
