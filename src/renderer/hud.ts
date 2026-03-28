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

import { toFloat }                               from '../engine/physics/fixednum.js';
import { fighterComponents, transformComponents } from '../engine/ecs/component.js';
import { getCameraTransform }                    from './camera.js';
import { getKeysDown }                           from '../engine/input/keyboard.js';
import { activeItems }                           from '../game/items/items.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const PLAYER_COLORS = ['#4499FF', '#FF4444', '#44FF66', '#FFEE22'] as const;

/** Human-readable names for every item type. */
const ITEM_NAMES: Record<string, string> = {
  energyRod:       'Energy Rod',
  heavyMallet:     'Mallet',
  emberCore:       'Ember Core',
  runeshard:       'Runeshard',
  speedBoots:      'Speed Boots',
  mirrorShard:     'Mirror Shard',
  explosiveSphere: 'Bomb',
  boomerang:       'Boomerang',
  nexusCapsule:    'Nexus Capsule',
  blastImp:        'Blast Imp',
  gyrostone:       'Gyrostone',
  gravityAnchor:   'Gravity Anchor',
  iceTag:          'Ice Tag',
  thunderBolt:     'Thunder Bolt',
  assistOrb:       'Assist Orb',
  aetherCrystal:   'Aether Crystal',
};

// ── Module state ──────────────────────────────────────────────────────────────

let hudRoot: HTMLDivElement | null = null;
const panels: HTMLDivElement[]              = [];
const damageLabels: HTMLDivElement[]        = [];
const stockContainers: HTMLDivElement[]     = [];
const itemLabels: HTMLDivElement[]          = [];
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

  // Root bar: full-width bottom strip, space-between so P1 sits at the left
  // corner and P2 at the right corner — matching the Super Smash Bros. N64
  // layout.
  hudRoot = document.createElement('div');
  hudRoot.id = 'hud-root';
  Object.assign(hudRoot.style, {
    position:        'fixed',
    bottom:          '0',
    left:            '0',
    right:           '0',
    display:         'flex',
    justifyContent:  'space-between',
    alignItems:      'flex-end',
    padding:         '0 16px 16px',
    zIndex:          '50',
    pointerEvents:   'none',
  });

  for (let i = 0; i < playerEntityIds.length; i++) {
    const id      = playerEntityIds[i]!;
    const fighter = fighterComponents.get(id);
    const color   = PLAYER_COLORS[i % PLAYER_COLORS.length]!;

    // ── Panel (SSB64-style card) ────────────────────────────────────────────
    const panel = document.createElement('div');
    Object.assign(panel.style, {
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      background:     'rgba(10,10,30,0.82)',
      borderRadius:   '10px',
      padding:        '10px 18px 12px',
      minWidth:       '150px',
      border:         `3px solid ${color}`,
      boxShadow:      `0 0 14px ${color}88`,
    });

    // Player + character name
    const nameLabel = document.createElement('div');
    nameLabel.textContent = `P${i + 1}  ${fighter?.characterId.toUpperCase() ?? ''}`;
    Object.assign(nameLabel.style, {
      color,
      fontSize:      '13px',
      fontFamily:    '"Arial Black", "Impact", sans-serif',
      fontWeight:    '900',
      letterSpacing: '0.08em',
      marginBottom:  '4px',
      textShadow:    '1px 1px 3px #000',
    });
    panel.appendChild(nameLabel);

    // Damage percentage — large, bold, SSB64-style
    const dmgLabel = document.createElement('div');
    dmgLabel.textContent = '0%';
    Object.assign(dmgLabel.style, {
      fontSize:   '62px',
      fontFamily: '"Arial Black", "Impact", sans-serif',
      fontWeight: '900',
      color:      '#FFFFFF',
      lineHeight: '1',
      textShadow: '2px 2px 0 #000, -1px -1px 0 #000, 2px -1px 0 #000, -1px 2px 0 #000',
    });
    panel.appendChild(dmgLabel);
    damageLabels.push(dmgLabel);

    // Stock icons — slightly larger circles for SSB64 feel
    const stockCont = document.createElement('div');
    Object.assign(stockCont.style, {
      display:   'flex',
      gap:       '7px',
      marginTop: '9px',
    });
    const initialStocks = fighter?.stocks ?? 3;
    for (let s = 0; s < 3; s++) {
      const dot = document.createElement('div');
      dot.className = 'stock-icon';
      Object.assign(dot.style, {
        width:        '20px',
        height:       '20px',
        borderRadius: '50%',
        background:   s < initialStocks ? color : '#1a1a2e',
        border:       `2px solid ${s < initialStocks ? color : '#444'}`,
        boxShadow:    s < initialStocks ? `0 0 6px ${color}` : 'none',
      });
      stockCont.appendChild(dot);
    }
    panel.appendChild(stockCont);
    stockContainers.push(stockCont);

    // Held item indicator
    const itemLabel = document.createElement('div');
    itemLabel.textContent = '';
    Object.assign(itemLabel.style, {
      marginTop:  '6px',
      fontSize:   '11px',
      fontFamily: 'monospace',
      color:      '#FFD700',
      textAlign:  'center',
      minHeight:  '14px',
      letterSpacing: '0.04em',
    });
    panel.appendChild(itemLabel);
    itemLabels.push(itemLabel);

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
      const pct = Math.round(toFloat(fighter.damagePercent));
      dmgLabel.textContent = `${pct}%`;
      dmgLabel.style.color = getDamageColor(pct);
    }

    // ── Stock icons ─────────────────────────────────────────────────────────
    const stockCont = stockContainers[i];
    if (stockCont && fighter) {
      const color   = PLAYER_COLORS[i % PLAYER_COLORS.length]!;
      const dots    = stockCont.querySelectorAll<HTMLDivElement>('.stock-icon');
      dots.forEach((dot, j) => {
        const alive = j < fighter.stocks;
        dot.style.background = alive ? color : '#1a1a2e';
        dot.style.border     = `2px solid ${alive ? color : '#444'}`;
        dot.style.boxShadow  = alive ? `0 0 6px ${color}` : 'none';
      });
    }

    // ── Held item indicator ─────────────────────────────────────────────────
    const itemLabel = itemLabels[i];
    if (itemLabel) {
      const held = activeItems.find(it => it.heldBy === id);
      itemLabel.textContent = held ? `⚔ ${ITEM_NAMES[held.itemType] ?? held.itemType}` : '';
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

  panels.length              = 0;
  damageLabels.length        = 0;
  stockContainers.length     = 0;
  itemLabels.length          = 0;
  offscreenIndicators.length = 0;
  trackedIds                 = [];

  hideConnectionQuality();
}

// ── Keyboard overlay ───────────────────────────────────────────────────────────

/**
 * Key layout definitions.
 *
 * Each entry is a row; each key is { label, code, action }.
 * `null` is a spacer of roughly one key-width.
 *
 * P1: WASD movement + Q(special) E(attack) R(grab) F(shield) — all near WASD.
 * P2: Arrow keys movement + Numpad1(attack) Numpad2(special) Numpad3(grab) Numpad0(shield).
 */
type KeyDef = { label: string; code: string; wide?: boolean; action?: string } | null;

const KEY_LAYOUT: Array<Array<KeyDef[]>> = [
  // ── P1 rows ────────────────────────────────────────────────────────────────
  [
    // row 0: Q (special) W (jump) E (attack) R (grab) — physical top row near movement
    [
      { label: 'Q', code: 'KeyQ', action: 'special' },
      { label: 'W', code: 'KeyW', action: 'jump'    },
      { label: 'E', code: 'KeyE', action: 'attack'  },
      { label: 'R', code: 'KeyR', action: 'grab'    },
    ],
    // row 1: A S D (move) F (shield) — home row
    [
      { label: 'A', code: 'KeyA', action: 'left'   },
      { label: 'S', code: 'KeyS', action: 'down'   },
      { label: 'D', code: 'KeyD', action: 'right'  },
      { label: 'F', code: 'KeyF', action: 'shield' },
    ],
    // row 2: space bar (also jump)
    [
      { label: 'SPACE', code: 'Space', wide: true, action: 'jump' },
    ],
  ],
  // ── P2 rows ────────────────────────────────────────────────────────────────
  [
    // row 0: numpad action keys 1 2 3
    [
      { label: '1', code: 'Numpad1', action: 'attack'  },
      { label: '2', code: 'Numpad2', action: 'special' },
      { label: '3', code: 'Numpad3', action: 'grab'    },
    ],
    // row 1: numpad 0 (shield) + arrow up (jump)
    [
      { label: '0', code: 'Numpad0', wide: true, action: 'shield' },
      null,
      { label: '↑', code: 'ArrowUp', action: 'jump' },
    ],
    // row 2: arrow cluster
    [
      { label: '←', code: 'ArrowLeft',  action: 'left'  },
      { label: '↓', code: 'ArrowDown',  action: 'down'  },
      { label: '→', code: 'ArrowRight', action: 'right' },
    ],
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

  for (const rowDef of rows) {
    const rowEl = document.createElement('div');
    Object.assign(rowEl.style, { display: 'flex', gap: '3px' });

    for (const keyDef of rowDef) {
      if (keyDef === null) {
        const spacer = document.createElement('div');
        Object.assign(spacer.style, { width: '28px', flexShrink: '0' });
        rowEl.appendChild(spacer);
        continue;
      }

      // Outer wrapper: key cap + action label stacked vertically
      const wrapper = document.createElement('div');
      Object.assign(wrapper.style, {
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        gap:            '1px',
        flexShrink:     '0',
        width:          keyDef.wide ? '56px' : '28px',
      });

      // Key cap (the "button" visual)
      const cap = document.createElement('div');
      Object.assign(cap.style, {
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        width:          '100%',
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
      });
      cap.textContent = keyDef.label;

      // Visible action label below the key cap
      const actionEl = document.createElement('div');
      Object.assign(actionEl.style, {
        color:       'rgba(255,255,255,0.45)',
        fontSize:    '7px',
        fontFamily:  'monospace',
        lineHeight:  '1',
        textAlign:   'center',
        whiteSpace:  'nowrap',
        overflow:    'hidden',
      });
      actionEl.textContent = keyDef.action ?? '';

      wrapper.appendChild(cap);
      wrapper.appendChild(actionEl);
      rowEl.appendChild(wrapper);
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
