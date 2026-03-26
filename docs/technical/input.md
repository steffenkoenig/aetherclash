# Technical — Input System

## Overview

The input system bridges hardware peripherals (keyboard, gamepad) and the game engine's fixed-step simulation. Two design priorities drive every decision:

1. **Responsiveness:** Input must feel instant. A button press that occurs even slightly early should still register for the intended action.
2. **Determinism:** The input state delivered to the physics step must be identical on both peers (when replaying frames during rollback).

---

## Supported Input Devices

| Device | Support Level |
| :--- | :--- |
| **Keyboard** | Full support; default device for browser |
| **Gamepad (XInput / DirectInput)** | Full support via Gamepad API |
| **DualShock / DualSense** | Full support (USB and Bluetooth) |
| **Nintendo Switch Pro Controller** | Full support (USB) |
| **Mobile Touch** | Basic support (virtual on-screen buttons; limited) |

---

## Default Control Schemes

### Keyboard (Default)

| Action | Key |
| :--- | :--- |
| Move Left | `A` or `←` |
| Move Right | `D` or `→` |
| Crouch / Down | `S` or `↓` |
| Jump | `W` or `↑` or `Space` |
| Attack | `J` |
| Special | `K` |
| Shield | `L` |
| Grab | `I` |
| Smash / Fast move | Hold `Shift` + direction + Attack |
| Pause | `Escape` |

The keyboard stick is emulated as a discrete 8-direction digital input. Full analog precision is unavailable on keyboard, which impacts DI accuracy and some special angle options.

> **Competitive keyboard note:** Because keyboard DI is limited to 8 fixed angles, keyboard players may find it harder to optimally influence diagonal launch trajectories compared to analog gamepad users. As a workaround, competitive keyboard players are encouraged to use a controller with analog sticks, or a keyboard with an analog emulation layer. The game's input remapping screen allows full rebinding to suit any preferred layout.

### Gamepad (Default)

| Action | Button |
| :--- | :--- |
| Move | Left Stick |
| Jump | `A` (XInput) / `×` (PS) |
| Attack | `X` (XInput) / `□` (PS) |
| Special | `B` (XInput) / `○` (PS) |
| Shield | `LT` / `L2` (analog; holding activates shield) |
| Grab | `LB` / `L1` |
| Smash | C-Stick / Right Stick (any direction) |
| Pause | `Start` |
| DI (during hitstun) | Left Stick |

All control schemes are user-remappable from the settings screen. Custom bindings are persisted to `localStorage`.

---

## Input State Structure

Each frame, the input system produces an `InputState` object that is consumed by the physics engine:

```typescript
interface InputState {
  // Digital buttons
  jump:    boolean;
  attack:  boolean;
  special: boolean;
  shield:  boolean;
  grab:    boolean;

  // Stick (normalised −1.0 to +1.0)
  stickX:  number;
  stickY:  number;

  // C-Stick / Smash stick
  cStickX: number;
  cStickY: number;
}
```

---

## Input Sampling

Input is sampled **once per physics frame** (60 Hz), not per render frame. This prevents different display frame rates from causing different input rates:

```typescript
function sampleInput(device: InputDevice): InputState {
  const raw = device.poll(); // keyboard or Gamepad API state
  return {
    jump:    raw.buttons.jump    || isFirstFrame(raw.buttons.jump),
    attack:  raw.buttons.attack  || isFirstFrame(raw.buttons.attack),
    special: raw.buttons.special || isFirstFrame(raw.buttons.special),
    shield:  raw.buttons.shield,
    grab:    raw.buttons.grab    || isFirstFrame(raw.buttons.grab),
    stickX:  applyDeadzone(raw.axes[0], STICK_DEADZONE),
    stickY:  applyDeadzone(raw.axes[1], STICK_DEADZONE),
    cStickX: applyDeadzone(raw.axes[2], CSTICK_DEADZONE),
    cStickY: applyDeadzone(raw.axes[3], CSTICK_DEADZONE),
  };
}

const STICK_DEADZONE  = 0.2;  // Ignore stick values below 20%
const CSTICK_DEADZONE = 0.3;
```

---

## Input Buffer

The **input buffer** is the key mechanic that makes the game feel responsive. When a button is pressed, it is recorded in a FIFO queue of length **5 frames**. If the game engine cannot act on the input immediately (e.g., the character is in the middle of another action), it will check the buffer on subsequent frames and act as soon as possible:

```typescript
class InputBuffer {
  private buffer: Map<InputAction, number> = new Map();
  private readonly BUFFER_WINDOW = 5; // frames

  press(action: InputAction, currentFrame: number): void {
    this.buffer.set(action, currentFrame);
  }

  consume(action: InputAction, currentFrame: number): boolean {
    const pressedAt = this.buffer.get(action);
    if (pressedAt !== undefined && currentFrame - pressedAt <= this.BUFFER_WINDOW) {
      this.buffer.delete(action);
      return true;
    }
    return false;
  }
}
```

### Buffer Interactions

| Scenario | Behaviour |
| :--- | :--- |
| Jump pressed 2 frames before landing | Jump fires immediately on the landing frame |
| Attack pressed during hitstun | Attack fires on the first frame after hitstun ends |
| Special pressed 4 frames into a run | Special fires immediately (run can be cancelled any time) |
| Attack pressed 6 frames before action is available | **Ignored** — outside the 5-frame window |

This system makes execution of moves feel forgiving to newer players while still being learnable for advanced players.

---

## Stick Thresholds

Stick input is classified into zones to determine action type:

```
       ┌──────────────────────────────────────┐
       │                UP ZONE               │
       │        (|Y| > 0.6, Y > 0)           │
       │                                      │
LEFT   │   TILT ZONE                TILT ZONE │  RIGHT
ZONE   │   (0.3 < |X|, |X| < 0.6)            │  ZONE
       │                                      │
       │        DOWN ZONE                     │
       │        (|Y| > 0.6, Y < 0)           │
       └──────────────────────────────────────┘
```

| Zone | Input Classification |
| :--- | :--- |
| `|X| < 0.3` and `|Y| < 0.3` | Neutral |
| `0.3 ≤ |X| < 0.6`, `|Y| < 0.3` | Walk / Tilt direction |
| `|X| ≥ 0.6`, `|Y| < 0.3` | Dash / Smash direction |
| `|Y| ≥ 0.6`, `X near 0` | Up/Down Tilt or Jump/Fast-fall |

Additionally, the **speed** of a stick flick (delta position per frame) determines whether an action is a "smash" input or a "tilt" input:

```typescript
const isSmashInput = Math.abs(stickX - prevStickX) > 0.6; // fast flick
```

---

## SOCD (Simultaneous Opposing Cardinal Directions) Handling

On keyboard, a player can press Left and Right simultaneously. The SOCD resolution rule is **"Last Input Wins"**:

```typescript
if (left && right) {
  stickX = mostRecentHorizontalKey === 'right' ? 1.0 : -1.0;
}
if (up && down) {
  stickY = mostRecentVerticalKey === 'up' ? 1.0 : -1.0;
}
```

This is consistent with the standard used in most modern platform fighters.

---

## Gamepad Polling

The Web Gamepad API requires **explicit polling** each animation frame (it does not emit events):

```typescript
function pollGamepads(): void {
  const gamepads = navigator.getGamepads();
  for (const gp of gamepads) {
    if (!gp) continue;
    updateGamepadState(gp);
  }
}
// Called at the start of each physics step
```

### Gamepad Connection / Disconnection

```typescript
window.addEventListener('gamepadconnected', (e) => {
  assignGamepadToPlayer(e.gamepad.index);
});
window.addEventListener('gamepaddisconnected', (e) => {
  unassignGamepad(e.gamepad.index);
  showReconnectPrompt();
});
```

If a gamepad disconnects mid-match, the game pauses and displays a 30-second reconnect prompt before forfeiting the stock.

---

## Input for Rollback

When the rollback system needs to re-simulate past frames, it replays the stored `InputState` history rather than re-polling the hardware. The input history is stored in a circular buffer matching the rollback depth:

```typescript
const INPUT_HISTORY_SIZE = 8; // one per potential rollback frame
const localInputHistory: InputState[] = new Array(INPUT_HISTORY_SIZE);
const remoteInputHistory: (InputState | null)[] = new Array(INPUT_HISTORY_SIZE);
// null = not yet received from opponent; prediction is used instead
```

See [Networking](networking.md) for how the rollback system interacts with remote input.

---

## Related Documents

- [Mechanics](../game-design/mechanics.md) — How inputs map to in-game actions
- [Networking](networking.md) — Input encoding for the network packet and rollback replay
- [Architecture](architecture.md) — Where input sampling fits in the game loop
