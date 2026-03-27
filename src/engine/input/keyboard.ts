// src/engine/input/keyboard.ts
// Keyboard input: samples once per physics frame.

export interface InputState {
  // Digital buttons (held this frame)
  jump:    boolean;
  attack:  boolean;
  special: boolean;
  shield:  boolean;
  grab:    boolean;

  // Edge-detection: true only on the first frame the button is pressed
  jumpJustPressed:    boolean;
  attackJustPressed:  boolean;
  specialJustPressed: boolean;
  grabJustPressed:    boolean;

  // Stick (−1.0 to +1.0; keyboard emulates discrete 8 directions)
  stickX:  number;
  stickY:  number;

  // C-Stick (smash stick)
  cStickX: number;
  cStickY: number;
}

export function makeNeutralInput(): InputState {
  return {
    jump: false, attack: false, special: false, shield: false, grab: false,
    jumpJustPressed: false, attackJustPressed: false,
    specialJustPressed: false, grabJustPressed: false,
    stickX: 0, stickY: 0, cStickX: 0, cStickY: 0,
  };
}

// ── Raw key state ─────────────────────────────────────────────────────────────

const keysDown = new Set<string>();
// Track which keys were pressed since the last sample (for edge detection)
const keysPressed = new Set<string>();

let mostRecentHorizontal: 'left' | 'right' | null = null;
let mostRecentVertical:   'up'   | 'down'  | null = null;

export function initKeyboard(): void {
  window.addEventListener('keydown', onKeyDown, { passive: true });
  window.addEventListener('keyup',   onKeyUp,   { passive: true });
}

export function disposeKeyboard(): void {
  window.removeEventListener('keydown', onKeyDown);
  window.removeEventListener('keyup',   onKeyUp);
}

function onKeyDown(e: KeyboardEvent): void {
  if (!keysDown.has(e.code)) {
    keysPressed.add(e.code);
  }
  keysDown.add(e.code);

  if (e.code === 'KeyA' || e.code === 'ArrowLeft')  mostRecentHorizontal = 'left';
  if (e.code === 'KeyD' || e.code === 'ArrowRight') mostRecentHorizontal = 'right';
  if (e.code === 'KeyW' || e.code === 'ArrowUp' || e.code === 'Space') mostRecentVertical = 'up';
  if (e.code === 'KeyS' || e.code === 'ArrowDown')  mostRecentVertical = 'down';
}

function onKeyUp(e: KeyboardEvent): void {
  keysDown.delete(e.code);
  keysPressed.delete(e.code);
}

// ── Sampling ──────────────────────────────────────────────────────────────────

export function sampleKeyboard(): InputState {
  const left  = keysDown.has('KeyA') || keysDown.has('ArrowLeft');
  const right = keysDown.has('KeyD') || keysDown.has('ArrowRight');
  const up    = keysDown.has('KeyW') || keysDown.has('ArrowUp') || keysDown.has('Space');
  const down  = keysDown.has('KeyS') || keysDown.has('ArrowDown');

  // SOCD: Last Input Wins
  let stickX = 0;
  if (left && right) {
    stickX = mostRecentHorizontal === 'right' ? 1.0 : -1.0;
  } else if (left) {
    stickX = -1.0;
  } else if (right) {
    stickX = 1.0;
  }

  let stickY = 0;
  if (up && down) {
    stickY = mostRecentVertical === 'up' ? 1.0 : -1.0;
  } else if (up) {
    stickY = 1.0;
  } else if (down) {
    stickY = -1.0;
  }

  const jumpKeys    = ['KeyW', 'ArrowUp', 'Space'];
  const attackKeys  = ['KeyJ'];
  const specialKeys = ['KeyK'];
  const grabKeys    = ['KeyI'];

  const jumpHeld    = jumpKeys.some(k => keysDown.has(k));
  const attackHeld  = attackKeys.some(k => keysDown.has(k));
  const specialHeld = specialKeys.some(k => keysDown.has(k));
  const grabHeld    = grabKeys.some(k => keysDown.has(k));

  // Edge-detection: only true when the key transitioned down this sample
  const jumpJustPressed    = jumpKeys.some(k => keysPressed.has(k));
  const attackJustPressed  = attackKeys.some(k => keysPressed.has(k));
  const specialJustPressed = specialKeys.some(k => keysPressed.has(k));
  const grabJustPressed    = grabKeys.some(k => keysPressed.has(k));

  const state: InputState = {
    jump:    jumpHeld,
    attack:  attackHeld,
    special: specialHeld,
    shield:  keysDown.has('KeyL'),
    grab:    grabHeld,
    jumpJustPressed,
    attackJustPressed,
    specialJustPressed,
    grabJustPressed,
    stickX,
    stickY,
    cStickX: 0,
    cStickY: 0,
  };

  // Clear pressed-this-frame set after sampling so each press fires once
  keysPressed.clear();

  return state;
}

// ── Network encoding ──────────────────────────────────────────────────────────

/**
 * Compact 16-bit wire representation of an InputState.
 *
 * Bit layout (from networking.md § Input Encoding):
 *   0     Jump
 *   1     Attack
 *   2     Special
 *   3     Shield
 *   4     Grab
 *   5–6   Stick X  (0 = left, 1 = neutral, 2 = right)
 *   7–8   Stick Y  (0 = down, 1 = neutral, 2 = up)
 *   9     C-Stick X pushed (nonzero → set)
 *   10    C-Stick Y pushed (nonzero → set)
 *   11–15 Reserved
 */
export type PackedInputState = number; // uint16

/** Encode a rich InputState into a compact 16-bit PackedInputState for network transmission. */
export function encodeInput(state: InputState): PackedInputState {
  let packed = 0;

  if (state.jump)    packed |= 1 << 0;
  if (state.attack)  packed |= 1 << 1;
  if (state.special) packed |= 1 << 2;
  if (state.shield)  packed |= 1 << 3;
  if (state.grab)    packed |= 1 << 4;

  // Stick X: 0 = left (< −0.5), 1 = neutral, 2 = right (> 0.5)
  const stickXCode = state.stickX < -0.5 ? 0 : state.stickX > 0.5 ? 2 : 1;
  packed |= (stickXCode & 0x3) << 5;

  // Stick Y: 0 = down (< −0.5), 1 = neutral, 2 = up (> 0.5)
  const stickYCode = state.stickY < -0.5 ? 0 : state.stickY > 0.5 ? 2 : 1;
  packed |= (stickYCode & 0x3) << 7;

  if (state.cStickX !== 0) packed |= 1 << 9;
  if (state.cStickY !== 0) packed |= 1 << 10;

  return packed & 0xFFFF;
}

/**
 * Decode a 16-bit PackedInputState back into a full InputState.
 * Edge-detection fields (jumpJustPressed etc.) are always false — they cannot
 * be round-tripped over the network and must be derived locally.
 */
export function decodeInput(packed: PackedInputState): InputState {
  const jump    = (packed & (1 << 0)) !== 0;
  const attack  = (packed & (1 << 1)) !== 0;
  const special = (packed & (1 << 2)) !== 0;
  const shield  = (packed & (1 << 3)) !== 0;
  const grab    = (packed & (1 << 4)) !== 0;

  const stickXCode = (packed >> 5) & 0x3;
  const stickX = stickXCode === 0 ? -1.0 : stickXCode === 2 ? 1.0 : 0;

  const stickYCode = (packed >> 7) & 0x3;
  const stickY = stickYCode === 0 ? -1.0 : stickYCode === 2 ? 1.0 : 0;

  const cStickX = (packed & (1 << 9))  !== 0 ? 1.0 : 0;
  const cStickY = (packed & (1 << 10)) !== 0 ? 1.0 : 0;

  return {
    jump, attack, special, shield, grab,
    jumpJustPressed:    false,
    attackJustPressed:  false,
    specialJustPressed: false,
    grabJustPressed:    false,
    stickX, stickY, cStickX, cStickY,
  };
}

// Expose for testing / headless simulation
export function simulateKeyDown(code: string): void {
  if (!keysDown.has(code)) keysPressed.add(code);
  keysDown.add(code);
}

export function simulateKeyUp(code: string): void {
  keysDown.delete(code);
  keysPressed.delete(code);
}

export function clearKeyState(): void {
  keysDown.clear();
  keysPressed.clear();
  mostRecentHorizontal = null;
  mostRecentVertical   = null;
}
