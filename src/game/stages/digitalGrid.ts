// src/game/stages/digitalGrid.ts
// Digital Grid — casual stage (phase transition: main floor retracts after 90 s)

import { toFixed } from '../../engine/physics/fixednum.js';
import type { Stage } from './stage.js';

// Phase 1 layout (standard — grid floor present)
export const DIGITAL_GRID_PHASE1: Stage = {
  id:   'digitalGrid',
  name: 'Digital Grid',

  platforms: [
    // Grid floor (solid)
    { x1: toFixed(-40), x2: toFixed(40), y: toFixed(0),  passThrough: false },
    // Left node
    { x1: toFixed(-65), x2: toFixed(-35), y: toFixed(55), passThrough: true },
    // Right node
    { x1: toFixed(35),  x2: toFixed(65),  y: toFixed(55), passThrough: true },
    // Centre platform (mid-height)
    { x1: toFixed(-18), x2: toFixed(18),  y: toFixed(85),  passThrough: true },
  ],

  blastZone: {
    left:   toFixed(-140),
    right:  toFixed(140),
    top:    toFixed(200),
    bottom: toFixed(-110),
  },

  ledgeColliders: [
    { x: toFixed(-40), y: toFixed(0),  facingRight: true,  occupied: null },
    { x: toFixed(40),  y: toFixed(0),  facingRight: false, occupied: null },
    { x: toFixed(-65), y: toFixed(55), facingRight: true,  occupied: null },
    { x: toFixed(-35), y: toFixed(55), facingRight: false, occupied: null },
    { x: toFixed(35),  y: toFixed(55), facingRight: true,  occupied: null },
    { x: toFixed(65),  y: toFixed(55), facingRight: false, occupied: null },
  ],

  itemSpawnPoints: [
    { x: toFixed(-30), y: toFixed(60) },
    { x: toFixed(0),   y: toFixed(60) },
    { x: toFixed(30),  y: toFixed(60) },
    { x: toFixed(0),   y: toFixed(110) },
  ],
};

// Phase 2 layout (grid floor retracted — two hover panels, all pass-through)
export const DIGITAL_GRID_PHASE2: Stage = {
  id:   'digitalGrid',
  name: 'Digital Grid (Phase 2)',

  platforms: [
    // Left hover panel (pass-through)
    { x1: toFixed(-65), x2: toFixed(-20), y: toFixed(15), passThrough: true },
    // Right hover panel (pass-through)
    { x1: toFixed(20),  x2: toFixed(65),  y: toFixed(15), passThrough: true },
    // Nodes remain
    { x1: toFixed(-65), x2: toFixed(-35), y: toFixed(55), passThrough: true },
    { x1: toFixed(35),  x2: toFixed(65),  y: toFixed(55), passThrough: true },
    { x1: toFixed(-18), x2: toFixed(18),  y: toFixed(85), passThrough: true },
  ],

  blastZone: {
    left:   toFixed(-140),
    right:  toFixed(140),
    top:    toFixed(200),
    bottom: toFixed(-110),
  },

  ledgeColliders: [
    { x: toFixed(-65), y: toFixed(15), facingRight: true,  occupied: null },
    { x: toFixed(-20), y: toFixed(15), facingRight: false, occupied: null },
    { x: toFixed(20),  y: toFixed(15), facingRight: true,  occupied: null },
    { x: toFixed(65),  y: toFixed(15), facingRight: false, occupied: null },
    { x: toFixed(-65), y: toFixed(55), facingRight: true,  occupied: null },
    { x: toFixed(-35), y: toFixed(55), facingRight: false, occupied: null },
    { x: toFixed(35),  y: toFixed(55), facingRight: true,  occupied: null },
    { x: toFixed(65),  y: toFixed(55), facingRight: false, occupied: null },
  ],

  itemSpawnPoints: [
    { x: toFixed(-40), y: toFixed(80) },
    { x: toFixed(40),  y: toFixed(80) },
    { x: toFixed(0),   y: toFixed(110) },
    { x: toFixed(0),   y: toFixed(40) },
  ],
};

// Phase transition timing (frames)
export const PHASE1_DURATION_FRAMES  = 90 * 60;  // 90 seconds
export const PHASE2_DURATION_FRAMES  = 30 * 60;  // 30 seconds before returning

/** Digital Grid phase manager — tracks which phase is active. */
export class DigitalGridPhase {
  private frame = 0;
  private phase: 1 | 2 = 1;

  tick(): void {
    this.frame++;
    if (this.phase === 1 && this.frame >= PHASE1_DURATION_FRAMES) {
      this.phase = 2;
      this.frame = 0;
    } else if (this.phase === 2 && this.frame >= PHASE2_DURATION_FRAMES) {
      this.phase = 1;
      this.frame = 0;
    }
  }

  getPhase(): 1 | 2 {
    return this.phase;
  }

  getCurrentStage(): Stage {
    return this.phase === 1 ? DIGITAL_GRID_PHASE1 : DIGITAL_GRID_PHASE2;
  }

  reset(): void {
    this.frame = 0;
    this.phase = 1;
  }
}
