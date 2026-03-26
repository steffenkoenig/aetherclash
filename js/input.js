'use strict';

// ─── Input Manager ────────────────────────────────────────────────────────────
// Supports two players via keyboard.
// P1: WASD + J (attack) + K (special/ability) + L (dodge/shield)
// P2: Arrow keys + NumPad1 (attack) + NumPad2 (special) + NumPad3 (dodge)

const KEY_MAP = {
    // Player 1
    'KeyA':         { player: 0, action: 'left'    },
    'KeyD':         { player: 0, action: 'right'   },
    'KeyW':         { player: 0, action: 'up'      },
    'KeyS':         { player: 0, action: 'down'    },
    'KeyJ':         { player: 0, action: 'attack'  },
    'KeyK':         { player: 0, action: 'special' },
    'KeyL':         { player: 0, action: 'dodge'   },
    'ShiftLeft':    { player: 0, action: 'grab'    },

    // Player 2
    'ArrowLeft':    { player: 1, action: 'left'    },
    'ArrowRight':   { player: 1, action: 'right'   },
    'ArrowUp':      { player: 1, action: 'up'      },
    'ArrowDown':    { player: 1, action: 'down'    },
    'Numpad1':      { player: 1, action: 'attack'  },
    'Numpad2':      { player: 1, action: 'special' },
    'Numpad3':      { player: 1, action: 'dodge'   },
    'ShiftRight':   { player: 1, action: 'grab'    },

    // Also support comma/period for P2 attack/special (more accessible)
    'Comma':        { player: 1, action: 'attack'  },
    'Period':       { player: 1, action: 'special' },
    'Slash':        { player: 1, action: 'dodge'   }
};

class InputManager {
    constructor(playerCount = 2) {
        this.playerCount = playerCount;

        // Current held state
        this.held = Array.from({ length: playerCount }, () => ({
            left: false, right: false, up: false, down: false,
            attack: false, special: false, dodge: false, grab: false
        }));

        // Just-pressed this frame
        this.pressed = Array.from({ length: playerCount }, () => ({
            left: false, right: false, up: false, down: false,
            attack: false, special: false, dodge: false, grab: false
        }));

        // Just-released this frame
        this.released = Array.from({ length: playerCount }, () => ({
            left: false, right: false, up: false, down: false,
            attack: false, special: false, dodge: false, grab: false
        }));

        // Input buffer: array per player of { action, framesLeft }
        this.buffer = Array.from({ length: playerCount }, () => []);

        this._keydown = this._onKeyDown.bind(this);
        this._keyup   = this._onKeyUp.bind(this);

        window.addEventListener('keydown', this._keydown);
        window.addEventListener('keyup',   this._keyup);
    }

    _onKeyDown(e) {
        // Prevent default for game keys to stop scrolling etc.
        const mapping = KEY_MAP[e.code];
        if (!mapping) return;
        e.preventDefault();

        const { player: p, action: a } = mapping;
        if (!this.held[p][a]) {
            this.held[p][a]    = true;
            this.pressed[p][a] = true;
            // Add to input buffer
            this.buffer[p].push({ action: a, framesLeft: INPUT_BUFFER_FRAMES });
        }
    }

    _onKeyUp(e) {
        const mapping = KEY_MAP[e.code];
        if (!mapping) return;
        e.preventDefault();

        const { player: p, action: a } = mapping;
        this.held[p][a]     = false;
        this.released[p][a] = true;
    }

    // Called once per frame to clear per-frame state
    update() {
        for (let p = 0; p < this.playerCount; p++) {
            for (const key of Object.keys(this.pressed[p])) {
                this.pressed[p][key]  = false;
                this.released[p][key] = false;
            }
            // Decrement buffer timers
            this.buffer[p] = this.buffer[p]
                .map(entry => ({ ...entry, framesLeft: entry.framesLeft - 1 }))
                .filter(entry => entry.framesLeft > 0);
        }
    }

    // Check if action was buffered for player p
    consumeBuffer(p, action) {
        const idx = this.buffer[p].findIndex(e => e.action === action);
        if (idx !== -1) {
            this.buffer[p].splice(idx, 1);
            return true;
        }
        return false;
    }

    destroy() {
        window.removeEventListener('keydown', this._keydown);
        window.removeEventListener('keyup',   this._keyup);
    }
}
