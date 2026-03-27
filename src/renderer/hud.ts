// src/renderer/hud.ts
// Damage percentage HUD and stock icon overlay (HTML/CSS over the WebGL canvas).
// Colour-codes percentages: white (0–30%) → yellow (31–80%) → orange (81–120%) → red (121%+)

import { toFloat } from '../engine/physics/fixednum.js';
import { fighterComponents } from '../engine/ecs/component.js';

// ── Colour thresholds ─────────────────────────────────────────────────────────

const PCT_FRESH       = 30;   // 0–30%:   white
const PCT_DAMAGED     = 80;   // 31–80%:  yellow
const PCT_VULNERABLE  = 120;  // 81–120%: orange
                               // 121%+:   red

function pctToColour(pct: number): string {
  if (pct <= PCT_FRESH)      return '#ffffff';
  if (pct <= PCT_DAMAGED)    return '#f5f000';
  if (pct <= PCT_VULNERABLE) return '#ff8000';
  return '#ff2020';
}

// ── Stock icon helpers ────────────────────────────────────────────────────────

const STOCK_COLOURS = ['#4aa8ff', '#ff5555', '#44dd66', '#f5e800'];

function makeStockIcon(colour: string): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = 'hud-stock-icon';
  Object.assign(span.style, {
    display: 'inline-block',
    width:   '14px',
    height:  '14px',
    borderRadius: '50%',
    background: colour,
    margin: '0 3px',
  });
  return span;
}

// ── Panel cached references ───────────────────────────────────────────────────

interface PanelRefs {
  panel: HTMLDivElement;
  pctLabel: HTMLDivElement;
  stockRow: HTMLDivElement;
  colour: string;
  lastStockCount: number; // track previous stock count to avoid unnecessary DOM rebuilds
}

// ── HUD container ─────────────────────────────────────────────────────────────

let hudContainer: HTMLDivElement | null = null;
let panelRefs: PanelRefs[] = [];

/**
 * Initialise the HUD overlay.  Call once after the canvas has been added to the DOM.
 * @param playerCount  Number of fighters in the match (1–4).
 */
export function initHUD(playerCount: number): void {
  // Remove any previous HUD
  if (hudContainer) {
    hudContainer.remove();
  }
  panelRefs = [];

  hudContainer = document.createElement('div');
  hudContainer.id = 'hud-overlay';
  Object.assign(hudContainer.style, {
    position:  'absolute',
    bottom:    '20px',
    left:      '50%',
    transform: 'translateX(-50%)',
    display:   'flex',
    gap:       '40px',
    pointerEvents: 'none',
    zIndex:    '50',
    fontFamily: '"Segoe UI", Arial, sans-serif',
  });

  for (let i = 0; i < playerCount; i++) {
    const colour = STOCK_COLOURS[i % STOCK_COLOURS.length]!;

    const panel = document.createElement('div');
    panel.className = 'hud-player-panel';
    Object.assign(panel.style, {
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      background:     'rgba(0,0,0,0.55)',
      borderRadius:   '10px',
      padding:        '8px 18px',
      minWidth:       '90px',
    });

    const nameLabel = document.createElement('div');
    nameLabel.className = 'hud-player-name';
    nameLabel.textContent = `P${i + 1}`;
    Object.assign(nameLabel.style, {
      color:        colour,
      fontSize:     '14px',
      fontWeight:   'bold',
      marginBottom: '4px',
    });

    const pctLabel = document.createElement('div');
    pctLabel.className = 'hud-damage-pct';
    pctLabel.textContent = '0%';
    Object.assign(pctLabel.style, {
      fontSize:   '32px',
      fontWeight: 'bold',
      color:      '#ffffff',
      lineHeight: '1.1',
    });

    const stockRow = document.createElement('div');
    stockRow.className = 'hud-stock-row';
    Object.assign(stockRow.style, {
      display:   'flex',
      marginTop: '5px',
    });

    panel.appendChild(nameLabel);
    panel.appendChild(pctLabel);
    panel.appendChild(stockRow);
    hudContainer.appendChild(panel);

    // Cache references — avoids querySelector on every frame
    panelRefs.push({ panel, pctLabel, stockRow, colour, lastStockCount: -1 });
  }

  document.body.appendChild(hudContainer);
}

/**
 * Update the HUD each render frame.
 * Maps fighterComponents in insertion order to the player panels.
 */
export function updateHUD(): void {
  if (!hudContainer) return;

  let idx = 0;
  for (const [, fighter] of fighterComponents) {
    const refs = panelRefs[idx];
    if (!refs) break;

    // Damage percentage
    const pct = Math.max(0, toFloat(fighter.damagePercent));
    const pctText = `${Math.round(pct)}%`;
    if (refs.pctLabel.textContent !== pctText) {
      refs.pctLabel.textContent = pctText;
    }
    const newColour = pctToColour(pct);
    if (refs.pctLabel.style.color !== newColour) {
      refs.pctLabel.style.color = newColour;
    }

    // Stock icons — only rebuild when the stock count has changed
    if (fighter.stocks !== refs.lastStockCount) {
      refs.stockRow.innerHTML = '';
      for (let s = 0; s < fighter.stocks; s++) {
        refs.stockRow.appendChild(makeStockIcon(refs.colour));
      }
      refs.lastStockCount = fighter.stocks;
    }

    // Dim panel if fighter is KO'd
    const opacity = fighter.state === 'KO' ? '0.4' : '1';
    if (refs.panel.style.opacity !== opacity) {
      refs.panel.style.opacity = opacity;
    }

    idx++;
  }
}

/** Remove the HUD from the DOM (call on match end). */
export function disposeHUD(): void {
  hudContainer?.remove();
  hudContainer = null;
  panelRefs    = [];
}
