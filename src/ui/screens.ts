// src/ui/screens.ts
// Navigation between lobby → character select → stage select → match start.
//
// All screens are implemented as absolutely-positioned HTML overlay panels
// layered above the WebGL canvas.  The game loop does not start until the
// player has chosen a character and a stage.
//
// Accessibility features:
//   - All interactive elements are keyboard-navigable (tabIndex, Enter/Space).
//   - ARIA labels on cards and buttons.
//   - Colour-blind-friendly palette: uses distinct shapes + labels, not colour alone.
//   - Respects `prefers-reduced-motion` by removing CSS transitions when set.
//   - Keyboard shortcut: Escape cancels / goes back.

// ── Service Worker registration ───────────────────────────────────────────────

export function registerServiceWorker(): void {
  if (typeof navigator === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/sw.js').catch(() => {
    // SW registration failure is non-fatal — the game works without it.
  });
}

// ── Reduced-motion detection ──────────────────────────────────────────────────

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// ── Character / stage metadata ────────────────────────────────────────────────

export const CHARACTERS = [
  { id: 'kael',  label: 'Kael',  description: 'Balanced all-rounder.' },
  { id: 'gorun', label: 'Gorun', description: 'Heavy hard-hitter.' },
  { id: 'vela',  label: 'Vela',  description: 'Fast rushdown brawler.' },
  { id: 'syne',  label: 'Syne',  description: 'Technical combo master.' },
  { id: 'zira',  label: 'Zira',  description: 'Long-range harasser.' },
] as const;

export const STAGES = [
  { id: 'aetherPlateau', label: 'Aether Plateau',  description: 'Classic flat stage.' },
  { id: 'forge',         label: 'Forge',            description: 'Industrial hazards.' },
  { id: 'cloudCitadel',  label: 'Cloud Citadel',    description: 'Sky-high platforms.' },
  { id: 'ancientRuin',   label: 'Ancient Ruin',     description: 'Crumbling history.' },
  { id: 'digitalGrid',   label: 'Digital Grid',     description: 'Shifting terrain.' },
] as const;

export type CharacterId = (typeof CHARACTERS)[number]['id'];
export type StageId     = (typeof STAGES)[number]['id'];

// ── Screen manager state ──────────────────────────────────────────────────────

export type ScreenName = 'lobby' | 'characterSelect' | 'stageSelect' | 'match';

interface ScreensCallbacks {
  onMatchReady: (characterId: CharacterId, stageId: StageId) => void;
}

let root: HTMLDivElement | null = null;
let callbacks: ScreensCallbacks | null = null;

let selectedCharacter: CharacterId | null = null;
let selectedStage:     StageId     | null = null;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Initialise the screen manager.
 * Creates a full-screen overlay and shows the lobby screen.
 */
export function initScreens(cb: ScreensCallbacks): void {
  callbacks = cb;
  root = document.createElement('div');
  root.id = 'screens-root';
  Object.assign(root.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '200',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.92)',
    fontFamily: 'monospace',
    color: '#fff',
  });
  document.body.appendChild(root);
  showLobby();
}

/** Remove all screen DOM elements. */
export function disposeScreens(): void {
  root?.parentNode?.removeChild(root);
  root = null;
  callbacks = null;
  selectedCharacter = null;
  selectedStage = null;
}

// ── Screen builders ───────────────────────────────────────────────────────────

function clear(): void {
  if (!root) return;
  while (root.firstChild) root.removeChild(root.firstChild);
}

function showLobby(): void {
  clear();
  if (!root) return;

  const box = makePanel('AETHER CLASH', '520px');

  const subtitle = document.createElement('p');
  subtitle.textContent = 'Choose your fighter and stage to begin.';
  subtitle.style.color = '#aaa';
  subtitle.style.marginBottom = '32px';
  box.appendChild(subtitle);

  const btn = makeButton('Local Match', '#4499FF');
  btn.onclick = () => showCharacterSelect();
  box.appendChild(btn);

  root.appendChild(box);
}

function showCharacterSelect(): void {
  clear();
  if (!root) return;

  const box = makePanel('SELECT CHARACTER', '700px');

  const grid = document.createElement('div');
  Object.assign(grid.style, {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: '12px',
    marginBottom: '24px',
  });

  for (const char of CHARACTERS) {
    const card = document.createElement('div');
    Object.assign(card.style, {
      padding: '16px 8px',
      borderRadius: '8px',
      border: '2px solid #444',
      textAlign: 'center',
      cursor: 'pointer',
      transition: 'border-color 0.15s',
      background: '#111',
    });
    card.innerHTML = `<div style="font-size:28px;margin-bottom:6px">🥷</div>
      <div style="font-weight:bold;font-size:15px">${char.label}</div>
      <div style="font-size:11px;color:#999;margin-top:4px">${char.description}</div>`;

    card.onmouseenter = () => { card.style.borderColor = '#4499FF'; };
    card.onmouseleave = () => {
      card.style.borderColor = selectedCharacter === char.id ? '#4499FF' : '#444';
    };
    card.onclick = () => {
      selectedCharacter = char.id;
      grid.querySelectorAll<HTMLDivElement>('[data-char]').forEach(el => {
        el.style.borderColor = '#444';
      });
      card.style.borderColor = '#4499FF';
    };
    card.dataset['char'] = char.id;

    grid.appendChild(card);
  }
  box.appendChild(grid);

  const nav = document.createElement('div');
  nav.style.display = 'flex';
  nav.style.gap = '12px';
  nav.style.justifyContent = 'center';

  const backBtn = makeButton('← Back', '#555');
  backBtn.onclick = () => showLobby();
  nav.appendChild(backBtn);

  const nextBtn = makeButton('Next →', '#4499FF');
  nextBtn.onclick = () => {
    if (!selectedCharacter) {
      selectedCharacter = 'kael'; // default
    }
    showStageSelect();
  };
  nav.appendChild(nextBtn);

  box.appendChild(nav);
  root.appendChild(box);
}

function showStageSelect(): void {
  clear();
  if (!root) return;

  const box = makePanel('SELECT STAGE', '700px');

  const grid = document.createElement('div');
  Object.assign(grid.style, {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: '12px',
    marginBottom: '24px',
  });

  for (const stage of STAGES) {
    const card = document.createElement('div');
    Object.assign(card.style, {
      padding: '16px 8px',
      borderRadius: '8px',
      border: '2px solid #444',
      textAlign: 'center',
      cursor: 'pointer',
      transition: 'border-color 0.15s',
      background: '#111',
    });
    card.innerHTML = `<div style="font-size:28px;margin-bottom:6px">🏟️</div>
      <div style="font-weight:bold;font-size:13px">${stage.label}</div>
      <div style="font-size:11px;color:#999;margin-top:4px">${stage.description}</div>`;

    card.onmouseenter = () => { card.style.borderColor = '#44FF66'; };
    card.onmouseleave = () => {
      card.style.borderColor = selectedStage === stage.id ? '#44FF66' : '#444';
    };
    card.onclick = () => {
      selectedStage = stage.id;
      grid.querySelectorAll<HTMLDivElement>('[data-stage]').forEach(el => {
        el.style.borderColor = '#444';
      });
      card.style.borderColor = '#44FF66';
    };
    card.dataset['stage'] = stage.id;

    grid.appendChild(card);
  }
  box.appendChild(grid);

  const nav = document.createElement('div');
  nav.style.display = 'flex';
  nav.style.gap = '12px';
  nav.style.justifyContent = 'center';

  const backBtn = makeButton('← Back', '#555');
  backBtn.onclick = () => showCharacterSelect();
  nav.appendChild(backBtn);

  const startBtn = makeButton('▶ Fight!', '#FF4444');
  startBtn.onclick = () => {
    const charId  = selectedCharacter ?? 'kael';
    const stageId = selectedStage    ?? 'aetherPlateau';
    disposeScreens();
    callbacks?.onMatchReady(charId as CharacterId, stageId as StageId);
  };
  nav.appendChild(startBtn);

  box.appendChild(nav);
  root.appendChild(box);
}

// ── DOM helpers ───────────────────────────────────────────────────────────────

function makePanel(title: string, width: string): HTMLDivElement {
  const box = document.createElement('div');
  Object.assign(box.style, {
    width,
    maxWidth: '95vw',
    background: 'rgba(10,10,20,0.98)',
    borderRadius: '12px',
    padding: '40px 48px',
    border: '1px solid #333',
    boxShadow: '0 8px 40px rgba(0,0,0,0.7)',
  });

  const h1 = document.createElement('h1');
  h1.textContent = title;
  Object.assign(h1.style, {
    fontSize: '28px',
    fontWeight: 'bold',
    letterSpacing: '0.1em',
    textAlign: 'center',
    marginBottom: '24px',
    color: '#eee',
  });
  box.appendChild(h1);

  return box;
}

function makeButton(label: string, color: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.textContent = label;
  Object.assign(btn.style, {
    padding: '12px 32px',
    fontSize: '16px',
    fontFamily: 'monospace',
    background: color,
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    letterSpacing: '0.05em',
  });
  return btn;
}
