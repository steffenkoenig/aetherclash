'use strict';

// ─── Internal Resolution ────────────────────────────────────────────────────
const GAME_WIDTH  = 1280;
const GAME_HEIGHT = 720;

// ─── Physics ─────────────────────────────────────────────────────────────────
const GRAVITY           = 0.65;
const TERMINAL_VELOCITY = 22;
const GROUND_FRICTION   = 0.72;
const AIR_FRICTION      = 0.985;
const WALK_SPEED        = 4.5;
const RUN_SPEED         = 8.0;
const JUMP_FORCE        = -17;
const DOUBLE_JUMP_FORCE = -15;
const FALL_SPEED_FAST   = 2.5;  // fast-fall multiplier

// ─── Blast Zones (world coords) ──────────────────────────────────────────────
const BLAST_LEFT   = -420;
const BLAST_RIGHT  = GAME_WIDTH  + 420;
const BLAST_TOP    = -320;
const BLAST_BOTTOM = GAME_HEIGHT + 160;

// ─── Match Settings ───────────────────────────────────────────────────────────
const STOCK_COUNT           = 3;
const RESPAWN_INVINCIBILITY = 180;  // frames of invincibility after spawn
const RESPAWN_DELAY         = 120;  // frames before respawn

// ─── Input ────────────────────────────────────────────────────────────────────
const INPUT_BUFFER_FRAMES = 5;

// ─── Items ────────────────────────────────────────────────────────────────────
const ITEM_SPAWN_INTERVAL_MIN = 8000;   // ms
const ITEM_SPAWN_INTERVAL_MAX = 15000;  // ms
const MAX_ITEMS_ON_STAGE      = 3;

// ─── Item Types ───────────────────────────────────────────────────────────────
const ITEM_TYPE = Object.freeze({
    MELEE_AUGMENT:  'melee_augment',
    THROWABLE:      'throwable',
    ASSIST_ORB:     'assist_orb',
    HEALING_CHARM:  'healing_charm'
});

// ─── Player States ────────────────────────────────────────────────────────────
const STATE = Object.freeze({
    IDLE:         'idle',
    WALK:         'walk',
    RUN:          'run',
    JUMP:         'jump',
    DOUBLE_JUMP:  'double_jump',
    FALL:         'fall',
    ATTACK:       'attack',
    AIR_ATTACK:   'air_attack',
    HIT_STUN:     'hit_stun',
    KNOCKED_BACK: 'knocked_back',
    AIR_DODGE:    'air_dodge',
    LEDGE_GRAB:   'ledge_grab',
    DEAD:         'dead'
});

// ─── Attack Types ─────────────────────────────────────────────────────────────
const ATTACK = Object.freeze({
    JAB:          'jab',
    FORWARD_TILT: 'forward_tilt',
    UP_TILT:      'up_tilt',
    DOWN_TILT:    'down_tilt',
    FORWARD_SMASH:'forward_smash',
    UP_SMASH:     'up_smash',
    DOWN_SMASH:   'down_smash',
    NEUTRAL_AIR:  'neutral_air',
    FORWARD_AIR:  'forward_air',
    BACK_AIR:     'back_air',
    UP_AIR:       'up_air',
    DOWN_AIR:     'down_air',
    UP_ABILITY:   'up_ability',
    NEUTRAL_ABILITY: 'neutral_ability'
});

// ─── Character Archetypes ────────────────────────────────────────────────────
// weight: 1 (light) – 10 (heavy) | walkSpeed / runSpeed are multipliers
const CHARACTERS = [
    {
        id:         'hero',
        name:       'Aether Knight',
        archetype:  'The Balanced Hero',
        weight:     5,
        walkSpeed:  1.0,
        runSpeed:   1.0,
        jumpForce:  JUMP_FORCE,
        djForce:    DOUBLE_JUMP_FORCE,
        fallSpeed:  1.0,
        color:      '#4A9EFF',
        darkColor:  '#1E6DD5',
        lightColor: '#A0CFFF',
        desc:       'Average speed & weight. Versatile multi-hit up ability.',
        // move definitions: { base, scale, hitboxFrames, recoveryFrames, angle, name }
        moves: {
            [ATTACK.JAB]:           { base: 3,  scale: 0.6, hitFrames: [3,5],  recoveryFrames: 10, angle: 0,   name: 'Jab'          },
            [ATTACK.FORWARD_TILT]:  { base: 6,  scale: 0.9, hitFrames: [5,8],  recoveryFrames: 15, angle: 10,  name: 'Side Slash'   },
            [ATTACK.UP_TILT]:       { base: 5,  scale: 0.8, hitFrames: [4,7],  recoveryFrames: 14, angle: 80,  name: 'Up Slice'     },
            [ATTACK.DOWN_TILT]:     { base: 4,  scale: 0.7, hitFrames: [4,6],  recoveryFrames: 12, angle: -70, name: 'Leg Sweep'    },
            [ATTACK.FORWARD_SMASH]: { base: 14, scale: 1.4, hitFrames: [9,12], recoveryFrames: 28, angle: 15,  name: 'Power Slash'  },
            [ATTACK.UP_SMASH]:      { base: 13, scale: 1.2, hitFrames: [8,12], recoveryFrames: 26, angle: 85,  name: 'Rising Cut'   },
            [ATTACK.DOWN_SMASH]:    { base: 10, scale: 1.1, hitFrames: [5,9],  recoveryFrames: 22, angle: -90, name: 'Ground Slam'  },
            [ATTACK.NEUTRAL_AIR]:   { base: 5,  scale: 0.8, hitFrames: [3,9],  recoveryFrames: 16, angle: 45,  name: 'Spin'         },
            [ATTACK.FORWARD_AIR]:   { base: 7,  scale: 1.0, hitFrames: [5,8],  recoveryFrames: 18, angle: 20,  name: 'Air Slash'    },
            [ATTACK.BACK_AIR]:      { base: 8,  scale: 1.0, hitFrames: [4,7],  recoveryFrames: 18, angle: 160, name: 'Heel Kick'    },
            [ATTACK.UP_AIR]:        { base: 6,  scale: 0.9, hitFrames: [4,7],  recoveryFrames: 15, angle: 85,  name: 'Sky Slash'    },
            [ATTACK.DOWN_AIR]:      { base: 9,  scale: 1.1, hitFrames: [5,9],  recoveryFrames: 20, angle: -80, name: 'Meteor'       },
            [ATTACK.UP_ABILITY]:    { base: 5,  scale: 0.7, hitFrames: [3,18], recoveryFrames: 30, angle: 85,  name: 'Spin Leap', multiHit: 4 },
            [ATTACK.NEUTRAL_ABILITY]:{base: 7,  scale: 1.0, hitFrames: [8,12], recoveryFrames: 24, angle: 20,  name: 'Aether Orb'  }
        }
    },
    {
        id:         'vanguard',
        name:       'Iron Colossus',
        archetype:  'The Heavy Vanguard',
        weight:     9,
        walkSpeed:  0.65,
        runSpeed:   0.65,
        jumpForce:  JUMP_FORCE * 0.88,
        djForce:    DOUBLE_JUMP_FORCE * 0.88,
        fallSpeed:  1.35,
        color:      '#FF6B35',
        darkColor:  '#B83A10',
        lightColor: '#FFA07A',
        desc:       'Slow but massive force. Plunging crash up ability.',
        moves: {
            [ATTACK.JAB]:           { base: 5,  scale: 0.7, hitFrames: [5,7],  recoveryFrames: 14, angle: 5,   name: 'Heavy Jab'    },
            [ATTACK.FORWARD_TILT]:  { base: 9,  scale: 1.1, hitFrames: [7,10], recoveryFrames: 20, angle: 5,   name: 'Hammer Fist'  },
            [ATTACK.UP_TILT]:       { base: 8,  scale: 1.0, hitFrames: [6,9],  recoveryFrames: 18, angle: 78,  name: 'Uppercut'     },
            [ATTACK.DOWN_TILT]:     { base: 6,  scale: 0.8, hitFrames: [5,8],  recoveryFrames: 15, angle: -60, name: 'Ground Pound' },
            [ATTACK.FORWARD_SMASH]: { base: 20, scale: 1.8, hitFrames: [12,16],recoveryFrames: 38, angle: 10,  name: 'Titan Blow'   },
            [ATTACK.UP_SMASH]:      { base: 18, scale: 1.6, hitFrames: [10,15],recoveryFrames: 35, angle: 88,  name: 'Eruption'     },
            [ATTACK.DOWN_SMASH]:    { base: 15, scale: 1.3, hitFrames: [7,12], recoveryFrames: 30, angle: -85, name: 'Quake Slam'   },
            [ATTACK.NEUTRAL_AIR]:   { base: 6,  scale: 0.9, hitFrames: [4,8],  recoveryFrames: 18, angle: 30,  name: 'Comet'        },
            [ATTACK.FORWARD_AIR]:   { base: 10, scale: 1.2, hitFrames: [6,9],  recoveryFrames: 22, angle: 15,  name: 'Dive Fist'    },
            [ATTACK.BACK_AIR]:      { base: 11, scale: 1.3, hitFrames: [5,8],  recoveryFrames: 22, angle: 155, name: 'Tail Swing'   },
            [ATTACK.UP_AIR]:        { base: 9,  scale: 1.1, hitFrames: [5,9],  recoveryFrames: 20, angle: 88,  name: 'Head Butt'    },
            [ATTACK.DOWN_AIR]:      { base: 14, scale: 1.5, hitFrames: [7,12], recoveryFrames: 28, angle: -90, name: 'Comet Drop'   },
            [ATTACK.UP_ABILITY]:    { base: 8,  scale: 1.2, hitFrames: [15,20],recoveryFrames: 50, angle: -80, name: 'Crash Leap'   },
            [ATTACK.NEUTRAL_ABILITY]:{base: 10, scale: 1.2, hitFrames: [8,14], recoveryFrames: 30, angle: 0,   name: 'Iron Charge'  }
        }
    },
    {
        id:         'blade',
        name:       'Crimson Fencer',
        archetype:  'The Blade Master',
        weight:     4,
        walkSpeed:  1.1,
        runSpeed:   1.2,
        jumpForce:  JUMP_FORCE * 1.05,
        djForce:    DOUBLE_JUMP_FORCE * 1.05,
        fallSpeed:  0.95,
        color:      '#FF3F6C',
        darkColor:  '#B0003A',
        lightColor: '#FF90A8',
        desc:       'High reach and fast edged strikes. Dash-slash up ability.',
        moves: {
            [ATTACK.JAB]:           { base: 2,  scale: 0.5, hitFrames: [2,4],  recoveryFrames: 8,  angle: 0,   name: 'Quick Stab'   },
            [ATTACK.FORWARD_TILT]:  { base: 7,  scale: 1.0, hitFrames: [4,7],  recoveryFrames: 13, angle: 10,  name: 'Lunge'        },
            [ATTACK.UP_TILT]:       { base: 6,  scale: 0.9, hitFrames: [3,6],  recoveryFrames: 12, angle: 82,  name: 'Rising Blade' },
            [ATTACK.DOWN_TILT]:     { base: 4,  scale: 0.7, hitFrames: [3,5],  recoveryFrames: 10, angle: -65, name: 'Low Sweep'    },
            [ATTACK.FORWARD_SMASH]: { base: 15, scale: 1.5, hitFrames: [7,11], recoveryFrames: 25, angle: 12,  name: 'Deep Thrust'  },
            [ATTACK.UP_SMASH]:      { base: 12, scale: 1.2, hitFrames: [6,10], recoveryFrames: 22, angle: 87,  name: 'Vault Cut'    },
            [ATTACK.DOWN_SMASH]:    { base: 10, scale: 1.1, hitFrames: [4,8],  recoveryFrames: 20, angle: -88, name: 'Blade Spin'   },
            [ATTACK.NEUTRAL_AIR]:   { base: 4,  scale: 0.8, hitFrames: [2,8],  recoveryFrames: 14, angle: 40,  name: 'Blade Whirl'  },
            [ATTACK.FORWARD_AIR]:   { base: 8,  scale: 1.1, hitFrames: [3,6],  recoveryFrames: 14, angle: 18,  name: 'Air Pierce'   },
            [ATTACK.BACK_AIR]:      { base: 9,  scale: 1.2, hitFrames: [3,6],  recoveryFrames: 14, angle: 162, name: 'Back Slash'   },
            [ATTACK.UP_AIR]:        { base: 7,  scale: 1.0, hitFrames: [3,6],  recoveryFrames: 13, angle: 88,  name: 'Skyward Cut'  },
            [ATTACK.DOWN_AIR]:      { base: 10, scale: 1.2, hitFrames: [4,7],  recoveryFrames: 18, angle: -85, name: 'Skewer'       },
            [ATTACK.UP_ABILITY]:    { base: 9,  scale: 1.1, hitFrames: [5,12], recoveryFrames: 22, angle: 70,  name: 'Dash Slash'   },
            [ATTACK.NEUTRAL_ABILITY]:{base: 6,  scale: 0.8, hitFrames: [6,10], recoveryFrames: 18, angle: 5,   name: 'Blade Storm'  }
        }
    },
    {
        id:         'tactician',
        name:       'Void Sentinel',
        archetype:  'The Projectile Tactician',
        weight:     4,
        walkSpeed:  0.9,
        runSpeed:   0.95,
        jumpForce:  JUMP_FORCE * 1.0,
        djForce:    DOUBLE_JUMP_FORCE * 1.0,
        fallSpeed:  0.9,
        color:      '#8B5CF6',
        darkColor:  '#5B21B6',
        lightColor: '#C4B5FD',
        desc:       'Traps and long-range energy. Tether recovery up ability.',
        moves: {
            [ATTACK.JAB]:           { base: 3,  scale: 0.5, hitFrames: [4,6],  recoveryFrames: 11, angle: 5,   name: 'Pulse'        },
            [ATTACK.FORWARD_TILT]:  { base: 7,  scale: 0.9, hitFrames: [6,9],  recoveryFrames: 16, angle: 8,   name: 'Void Bolt'    },
            [ATTACK.UP_TILT]:       { base: 5,  scale: 0.8, hitFrames: [4,7],  recoveryFrames: 14, angle: 82,  name: 'Wave Shot'    },
            [ATTACK.DOWN_TILT]:     { base: 4,  scale: 0.7, hitFrames: [4,6],  recoveryFrames: 12, angle: -68, name: 'Trip Mine'    },
            [ATTACK.FORWARD_SMASH]: { base: 12, scale: 1.3, hitFrames: [8,13], recoveryFrames: 28, angle: 10,  name: 'Void Cannon'  },
            [ATTACK.UP_SMASH]:      { base: 11, scale: 1.2, hitFrames: [7,12], recoveryFrames: 26, angle: 86,  name: 'Flux Pillar'  },
            [ATTACK.DOWN_SMASH]:    { base: 10, scale: 1.1, hitFrames: [5,10], recoveryFrames: 24, angle: -88, name: 'Trap Field'   },
            [ATTACK.NEUTRAL_AIR]:   { base: 5,  scale: 0.8, hitFrames: [3,7],  recoveryFrames: 16, angle: 45,  name: 'Orb Burst'    },
            [ATTACK.FORWARD_AIR]:   { base: 7,  scale: 1.0, hitFrames: [5,8],  recoveryFrames: 18, angle: 20,  name: 'Air Bolt'     },
            [ATTACK.BACK_AIR]:      { base: 7,  scale: 1.0, hitFrames: [4,7],  recoveryFrames: 16, angle: 158, name: 'Back Pulse'   },
            [ATTACK.UP_AIR]:        { base: 6,  scale: 0.9, hitFrames: [4,7],  recoveryFrames: 15, angle: 85,  name: 'Sky Burst'    },
            [ATTACK.DOWN_AIR]:      { base: 8,  scale: 1.1, hitFrames: [5,9],  recoveryFrames: 20, angle: -82, name: 'Drop Mine'    },
            [ATTACK.UP_ABILITY]:    { base: 0,  scale: 0.0, hitFrames: [0,0],  recoveryFrames: 30, angle: 90,  name: 'Tether', isTether: true },
            [ATTACK.NEUTRAL_ABILITY]:{base: 8,  scale: 1.0, hitFrames: [6,12], recoveryFrames: 26, angle: 5,   name: 'Void Trap'    }
        }
    },
    {
        id:         'striker',
        name:       'Neon Tempest',
        archetype:  'The Agile Striker',
        weight:     2,
        walkSpeed:  1.3,
        runSpeed:   1.5,
        jumpForce:  JUMP_FORCE * 1.1,
        djForce:    DOUBLE_JUMP_FORCE * 1.1,
        fallSpeed:  0.85,
        color:      '#10D9A0',
        darkColor:  '#047857',
        lightColor: '#6EECD2',
        desc:       'Ultra-fast and light. Rapid kick-lift up ability.',
        moves: {
            [ATTACK.JAB]:           { base: 2,  scale: 0.4, hitFrames: [1,3],  recoveryFrames: 7,  angle: 2,   name: 'Jab Combo'    },
            [ATTACK.FORWARD_TILT]:  { base: 5,  scale: 0.8, hitFrames: [3,5],  recoveryFrames: 11, angle: 5,   name: 'Roundhouse'   },
            [ATTACK.UP_TILT]:       { base: 4,  scale: 0.7, hitFrames: [2,5],  recoveryFrames: 10, angle: 80,  name: 'Flip Kick'    },
            [ATTACK.DOWN_TILT]:     { base: 3,  scale: 0.6, hitFrames: [2,4],  recoveryFrames: 9,  angle: -62, name: 'Low Kick'     },
            [ATTACK.FORWARD_SMASH]: { base: 11, scale: 1.3, hitFrames: [6,9],  recoveryFrames: 22, angle: 12,  name: 'Blitz Kick'   },
            [ATTACK.UP_SMASH]:      { base: 10, scale: 1.1, hitFrames: [5,9],  recoveryFrames: 20, angle: 86,  name: 'Spiral Kick'  },
            [ATTACK.DOWN_SMASH]:    { base: 9,  scale: 1.0, hitFrames: [4,8],  recoveryFrames: 18, angle: -86, name: 'Sweep Spin'   },
            [ATTACK.NEUTRAL_AIR]:   { base: 3,  scale: 0.7, hitFrames: [2,8],  recoveryFrames: 12, angle: 42,  name: 'Twister'      },
            [ATTACK.FORWARD_AIR]:   { base: 6,  scale: 0.9, hitFrames: [3,5],  recoveryFrames: 12, angle: 18,  name: 'Air Kick'     },
            [ATTACK.BACK_AIR]:      { base: 7,  scale: 1.0, hitFrames: [2,5],  recoveryFrames: 13, angle: 160, name: 'Mule Kick'    },
            [ATTACK.UP_AIR]:        { base: 5,  scale: 0.8, hitFrames: [2,5],  recoveryFrames: 11, angle: 88,  name: 'Axle Kick'    },
            [ATTACK.DOWN_AIR]:      { base: 7,  scale: 1.0, hitFrames: [3,7],  recoveryFrames: 16, angle: -80, name: 'Stomp'        },
            [ATTACK.UP_ABILITY]:    { base: 3,  scale: 0.5, hitFrames: [2,20], recoveryFrames: 25, angle: 88,  name: 'Kick Lift', multiHit: 6 },
            [ATTACK.NEUTRAL_ABILITY]:{base: 5,  scale: 0.7, hitFrames: [4,9],  recoveryFrames: 18, angle: 8,   name: 'Burst Dash'   }
        }
    }
];

// ─── Stage Definitions ────────────────────────────────────────────────────────
const STAGES = [
    {
        id:   'gateway',
        name: 'Gateway Colosseum',
        bgColor: '#0A0F1E',
        skyColor: '#1A2540',
        platforms: [
            // Main stage
            { x: 240, y: 520, width: 800, height: 24, isMain: true },
            // Left platform
            { x: 80,  y: 400, width: 200, height: 20, isMain: false },
            // Right platform
            { x: 1000, y: 400, width: 200, height: 20, isMain: false },
            // Top center platform
            { x: 540, y: 310, width: 200, height: 20, isMain: false }
        ],
        spawnPoints: [
            { x: 480, y: 460 },
            { x: 800, y: 460 },
            { x: 300, y: 340 },
            { x: 980, y: 340 }
        ]
    }
];
