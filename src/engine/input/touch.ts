// src/engine/input/touch.ts
// On-screen virtual gamepad for mobile / touch-screen play.
//
// Two independent virtual controllers are rendered:
//   Player 1 — left side  (D-pad + 5 action buttons)
//   Player 2 — right side (D-pad + 5 action buttons)
//
// `sampleTouchInput(playerIndex)` returns an `InputState` compatible with the
// keyboard InputState so it can be merged with keyboard input seamlessly.
//
// The overlay is mounted lazily on the first call to `initTouchControls()`.
// On non-touch devices the overlay starts hidden; a small toggle button in the
// top-right corner lets desktop players reveal it for testing.

import { type InputState } from './keyboard.js';

// ── Internal state ────────────────────────────────────────────────────────────

/** Per-player runtime state (updated by pointer-event handlers). */
interface PadState {
  /** Currently held directions from the D-pad. */
  left:    boolean;
  right:   boolean;
  up:      boolean;
  down:    boolean;
  /** Buttons held this frame. */
  jump:    boolean;
  attack:  boolean;
  special: boolean;
  shield:  boolean;
  grab:    boolean;
  /** Edge-detected: true only the first frame a button is pressed. */
  jumpJust:    boolean;
  attackJust:  boolean;
  specialJust: boolean;
  grabJust:    boolean;
}

function makePadState(): PadState {
  return {
    left: false, right: false, up: false, down: false,
    jump: false, attack: false, special: false, shield: false, grab: false,
    jumpJust: false, attackJust: false, specialJust: false, grabJust: false,
  };
}

const padStates: [PadState, PadState] = [makePadState(), makePadState()];

let touchOverlayRoot: HTMLDivElement | null = null;
let isVisible = false;
let toggleBtn: HTMLButtonElement | null = null;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Mount the touch-control overlay (idempotent).
 * Automatically shown on touch devices; hidden by default on desktop.
 */
export function initTouchControls(): void {
  if (touchOverlayRoot) return; // already initialised

  const isTouchDevice = window.matchMedia('(pointer: coarse)').matches
    || navigator.maxTouchPoints > 0;

  buildOverlay();
  setVisible(isTouchDevice);

  // Toggle button for desktop testing
  buildToggleButton();
}

/** Clean up and remove the overlay from the DOM. */
export function disposeTouchControls(): void {
  touchOverlayRoot?.parentNode?.removeChild(touchOverlayRoot);
  toggleBtn?.parentNode?.removeChild(toggleBtn);
  touchOverlayRoot = null;
  toggleBtn = null;
  isVisible = false;
}

/**
 * Read (and then reset) the current virtual-pad state for the given player.
 * Call exactly once per physics frame, just like `sampleKeyboard()`.
 */
export function sampleTouchInput(playerIndex: 0 | 1): InputState {
  const ps = padStates[playerIndex]!;

  let stickX = 0;
  if (ps.right && !ps.left) stickX = 1.0;
  else if (ps.left && !ps.right) stickX = -1.0;

  const state: InputState = {
    jump:    ps.jump,
    attack:  ps.attack,
    special: ps.special,
    shield:  ps.shield,
    grab:    ps.grab,
    jumpJustPressed:    ps.jumpJust,
    attackJustPressed:  ps.attackJust,
    specialJustPressed: ps.specialJust,
    grabJustPressed:    ps.grabJust,
    stickX,
    stickY: ps.up ? 1.0 : ps.down ? -1.0 : 0,
    cStickX: 0,
    cStickY: 0,
  };

  // Reset edge-detection flags
  ps.jumpJust = false;
  ps.attackJust = false;
  ps.specialJust = false;
  ps.grabJust = false;

  return state;
}

/** Merge a touch InputState INTO an existing one (logical OR of every field). */
export function mergeTouchInput(base: InputState, touch: InputState): InputState {
  return {
    jump:    base.jump    || touch.jump,
    attack:  base.attack  || touch.attack,
    special: base.special || touch.special,
    shield:  base.shield  || touch.shield,
    grab:    base.grab    || touch.grab,
    jumpJustPressed:    base.jumpJustPressed    || touch.jumpJustPressed,
    attackJustPressed:  base.attackJustPressed  || touch.attackJustPressed,
    specialJustPressed: base.specialJustPressed || touch.specialJustPressed,
    grabJustPressed:    base.grabJustPressed    || touch.grabJustPressed,
    stickX:  touch.stickX !== 0 ? touch.stickX : base.stickX,
    stickY:  touch.stickY !== 0 ? touch.stickY : base.stickY,
    cStickX: base.cStickX || touch.cStickX,
    cStickY: base.cStickY || touch.cStickY,
  };
}

/** Whether the touch overlay is currently visible. */
export function isTouchControlsVisible(): boolean {
  return isVisible;
}

// ── Overlay construction ──────────────────────────────────────────────────────

const PLAYER_COLORS = ['#4499FF', '#FF4444'] as const;

/** Layout for one player's button cluster. */
interface BtnDef {
  label: string;
  action: 'jump' | 'attack' | 'special' | 'shield' | 'grab';
  col: number; // column in a 3-col grid
  row: number; // row in a 2-row grid
}

const BTN_LAYOUT: BtnDef[] = [
  { label: '↑',  action: 'jump',    col: 1, row: 0 },
  { label: 'A',  action: 'attack',  col: 2, row: 1 },
  { label: 'S',  action: 'special', col: 0, row: 1 },
  { label: 'G',  action: 'grab',    col: 2, row: 0 },
  { label: '🛡',  action: 'shield',  col: 0, row: 0 },
];

function buildOverlay(): void {
  const root = document.createElement('div');
  root.id = 'touch-overlay';
  Object.assign(root.style, {
    position:       'fixed',
    inset:          '0',
    pointerEvents:  'none', // children override this
    zIndex:         '200',
    display:        'flex',
    flexDirection:  'row',
    alignItems:     'flex-end',
    justifyContent: 'space-between',
    padding:        '0 0 env(safe-area-inset-bottom,0px) 0',
    userSelect:     'none',
  });

  for (let pi = 0; pi < 2; pi++) {
    const side = buildPlayerPad(pi as 0 | 1);
    root.appendChild(side);
  }

  document.body.appendChild(root);
  touchOverlayRoot = root;
}

function buildPlayerPad(playerIndex: 0 | 1): HTMLDivElement {
  const isLeft = playerIndex === 0;
  const color  = PLAYER_COLORS[playerIndex]!;

  const wrapper = document.createElement('div');
  Object.assign(wrapper.style, {
    display:       'flex',
    flexDirection: isLeft ? 'row' : 'row-reverse',
    alignItems:    'flex-end',
    gap:           '10px',
    padding:       '10px',
    pointerEvents: 'none',
  });

  // ── D-pad ──────────────────────────────────────────────────────────────────
  wrapper.appendChild(buildDPad(playerIndex, color));

  // ── Action buttons ─────────────────────────────────────────────────────────
  wrapper.appendChild(buildActionButtons(playerIndex, color));

  return wrapper;
}

// ── D-pad ─────────────────────────────────────────────────────────────────────

const BTN_SIZE    = 52; // px
const DPAD_CENTER = BTN_SIZE; // px offset of centre button in the 3x3 grid

function buildDPad(playerIndex: 0 | 1, color: string): HTMLDivElement {
  const container = document.createElement('div');
  Object.assign(container.style, {
    position:      'relative',
    width:         `${BTN_SIZE * 3}px`,
    height:        `${BTN_SIZE * 3}px`,
    pointerEvents: 'none',
  });

  const dirDefs: Array<{
    dir: 'up' | 'down' | 'left' | 'right';
    label: string;
    top: number;
    left: number;
  }> = [
    { dir: 'up',    label: '▲', top: 0,          left: DPAD_CENTER },
    { dir: 'down',  label: '▼', top: DPAD_CENTER * 2, left: DPAD_CENTER },
    { dir: 'left',  label: '◀', top: DPAD_CENTER,    left: 0 },
    { dir: 'right', label: '▶', top: DPAD_CENTER,    left: DPAD_CENTER * 2 },
  ];

  for (const { dir, label, top, left } of dirDefs) {
    const btn = makeTouchButton(label, color, '18px');
    Object.assign(btn.style, {
      position: 'absolute',
      top:  `${top}px`,
      left: `${left}px`,
      width:  `${BTN_SIZE}px`,
      height: `${BTN_SIZE}px`,
    });

    const ps = padStates[playerIndex]!;

    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      btn.setPointerCapture(e.pointerId);
      // Set edge-detection flag only on the initial press (not repeats)
      if (dir === 'up' && !ps.up) ps.jumpJust = true;
      ps[dir] = true;
    }, { passive: false });

    btn.addEventListener('pointerup', () => { ps[dir] = false; });
    btn.addEventListener('pointercancel', () => { ps[dir] = false; });

    container.appendChild(btn);
  }

  return container;
}

// ── Action buttons ────────────────────────────────────────────────────────────

const ACTION_BTN_SIZE = 56; // px

function buildActionButtons(playerIndex: 0 | 1, color: string): HTMLDivElement {
  const container = document.createElement('div');
  Object.assign(container.style, {
    display:    'grid',
    gridTemplateColumns: `repeat(3, ${ACTION_BTN_SIZE}px)`,
    gridTemplateRows:    `repeat(2, ${ACTION_BTN_SIZE}px)`,
    gap:        '4px',
    pointerEvents: 'none',
  });

  const ps = padStates[playerIndex]!;

  for (const def of BTN_LAYOUT) {
    const btn = makeTouchButton(def.label, color, '14px');
    Object.assign(btn.style, {
      gridColumn: `${def.col + 1}`,
      gridRow:    `${def.row + 1}`,
      width:      `${ACTION_BTN_SIZE}px`,
      height:     `${ACTION_BTN_SIZE}px`,
      fontSize:   '18px',
    });

    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      btn.setPointerCapture(e.pointerId);
      const wasHeld = ps[def.action];
      ps[def.action] = true;
      if (!wasHeld) {
        // edge detection — set just-pressed flag
        if (def.action === 'jump')    ps.jumpJust    = true;
        if (def.action === 'attack')  ps.attackJust  = true;
        if (def.action === 'special') ps.specialJust = true;
        if (def.action === 'grab')    ps.grabJust    = true;
      }
    }, { passive: false });

    btn.addEventListener('pointerup', () => { ps[def.action] = false; });
    btn.addEventListener('pointercancel', () => { ps[def.action] = false; });

    // Label below the button
    const labelEl = document.createElement('div');
    Object.assign(labelEl.style, {
      position:   'absolute',
      bottom:     '-14px',
      width:      '100%',
      textAlign:  'center',
      fontSize:   '9px',
      fontFamily: 'monospace',
      color:      'rgba(255,255,255,0.55)',
    });
    labelEl.textContent = def.action.toUpperCase();
    btn.style.position = 'relative';
    btn.appendChild(labelEl);

    container.appendChild(btn);
  }

  return container;
}

// ── Helper: create a styled touch button ──────────────────────────────────────

function makeTouchButton(label: string, color: string, fontSize: string): HTMLDivElement {
  const btn = document.createElement('div');
  Object.assign(btn.style, {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    background:     'rgba(0,0,0,0.55)',
    border:         `2px solid ${color}`,
    borderRadius:   '8px',
    color:          color,
    fontSize,
    fontFamily:     'monospace',
    fontWeight:     'bold',
    touchAction:    'none',
    pointerEvents:  'auto',
    boxSizing:      'border-box',
    cursor:         'pointer',
    WebkitTapHighlightColor: 'transparent',
    // Active feedback via pointer events (set inline on press)
  } as Partial<CSSStyleDeclaration>);

  btn.addEventListener('pointerdown', () => {
    btn.style.background = `rgba(${hexToRgb(color)},0.35)`;
    btn.style.boxShadow  = `0 0 8px 2px ${color}`;
  });
  btn.addEventListener('pointerup',     () => { resetBtnStyle(btn, color); });
  btn.addEventListener('pointercancel', () => { resetBtnStyle(btn, color); });

  btn.textContent = label;
  return btn;
}

function resetBtnStyle(btn: HTMLDivElement, _color: string): void {
  btn.style.background = 'rgba(0,0,0,0.55)';
  btn.style.boxShadow  = 'none';
}

function hexToRgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 0xff},${(n >> 8) & 0xff},${n & 0xff}`;
}

// ── Toggle button ─────────────────────────────────────────────────────────────

function buildToggleButton(): void {
  const btn = document.createElement('button');
  btn.id = 'touch-toggle-btn';
  btn.textContent = '🎮';
  Object.assign(btn.style, {
    position:   'fixed',
    top:        '8px',
    right:      '8px',
    zIndex:     '210',
    background: 'rgba(0,0,0,0.6)',
    border:     '1px solid rgba(255,255,255,0.3)',
    borderRadius: '6px',
    color:      '#fff',
    fontSize:   '18px',
    padding:    '4px 8px',
    cursor:     'pointer',
    fontFamily: 'monospace',
  } as Partial<CSSStyleDeclaration>);

  btn.addEventListener('click', () => {
    setVisible(!isVisible);
  });

  document.body.appendChild(btn);
  toggleBtn = btn;
}

// ── Visibility ────────────────────────────────────────────────────────────────

function setVisible(visible: boolean): void {
  isVisible = visible;
  if (touchOverlayRoot) {
    touchOverlayRoot.style.display = visible ? 'flex' : 'none';
  }
}
