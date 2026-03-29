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
  { id: 'trump', label: 'THE MOGUL',   icon: '🏛️', archetype: 'POWERHOUSE',  description: 'Massive knockback. Tie-whip range. Small Hands grab penalty.' },
  { id: 'musk',  label: 'THE ARCHON',  icon: '🚀', archetype: 'AERIALIST',   description: 'Unrivalled air time. Flamethrower & X-shuriken toolkit.' },
  { id: 'putin', label: 'THE TSAR',    icon: '🐻', archetype: 'GRAPPLER',    description: 'Strongest throws in the game. Slow but unstoppable.' },
  { id: 'xi',    label: 'THE HONEY',   icon: '📕', archetype: 'TANK',         description: 'High health pool. Slow startup — but devastating payoff.' },
  { id: 'lizzy', label: 'THE REGENT',  icon: '👑', archetype: 'POISE MASTER', description: 'Slowest walk. Intangible on every hit. Spectral Corgis.' },
] as const;

export const STAGES = [
  { id: 'battlefield',    label: 'Battlefield',               icon: '⚔️',  type: 'STANDARD',  description: 'Iconic three-platform competitive layout. No hazards.' },
  { id: 'aetherPlateau',  label: 'Aether Plateau',            icon: '🏔️',  type: 'STANDARD',  description: 'Classic three-platform layout. No hazards.' },
  { id: 'windyHeights',   label: 'Windy Heights',             icon: '🍃',  type: 'BREEZY',    description: 'Sun-drenched meadow swept by gusting winds.' },
  { id: 'forge',          label: 'Cargo Bay Omega',           icon: '🚀',  type: 'DYNAMIC',   description: 'Asymmetric freight deck. Watch the drone.' },
  { id: 'cloudCitadel',   label: 'Pastel Paper Peaks',        icon: '☁️',  type: 'CASUAL',    description: 'Bouncy cloud platforms and gusting winds.' },
  { id: 'ancientRuin',    label: 'Clockwork Spire',           icon: '🏛️',  type: 'STANDARD',  description: 'Stone bridges over an ancient forest.' },
  { id: 'digitalGrid',    label: 'Neon Polygon Grid',         icon: '💻',  type: 'EXTREME',   description: 'The terrain itself shifts mid-fight.' },
  { id: 'crystalCavern',  label: 'Crystal Caverns',           icon: '💎',  type: 'DYNAMIC',   description: 'Stalactites crash down without warning.' },
  { id: 'voidRift',       label: 'Void Rift',                 icon: '🌌',  type: 'INTENSE',   description: 'Sparse platforms above infinite darkness.' },
  { id: 'solarPinnacle',  label: 'Solar Pinnacle',            icon: '☀️',  type: 'DYNAMIC',   description: 'Solar flares scorch the right flank.' },
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

/** Which screen is currently showing, so Escape knows where to go back to. */
let currentScreen: 'lobby' | 'characterSelect' | 'stageSelect' = 'lobby';

// ── Escape key back-navigation ────────────────────────────────────────────────

function onScreensKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return;
  if (currentScreen === 'characterSelect') {
    showLobby();
  } else if (currentScreen === 'stageSelect') {
    showCharacterSelect();
  }
}

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
    position:        'fixed',
    inset:           '0',
    zIndex:          '200',
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    background:      'radial-gradient(ellipse at 50% 40%, #0a0a28 0%, #000005 100%)',
    fontFamily:      '"Arial Black", "Impact", "Arial", sans-serif',
    color:           '#fff',
    overflow:        'hidden',
  });
  // Inject global CSS for reduced-motion and star animations.
  injectGlobalStyles();
  // Static star field backdrop.
  root.appendChild(buildStarfield());
  document.body.appendChild(root);
  window.addEventListener('keydown', onScreensKeydown);
  showLobby();
}

/** Remove all screen DOM elements. */
export function disposeScreens(): void {
  window.removeEventListener('keydown', onScreensKeydown);
  root?.parentNode?.removeChild(root);
  root = null;
  callbacks = null;
  selectedCharacter = null;
  selectedStage = null;
}

// ── Screen builders ───────────────────────────────────────────────────────────

function showLobby(): void {
  currentScreen = 'lobby';
  clearContent();
  if (!root) return;

  const box = document.createElement('div');
  Object.assign(box.style, {
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    gap:            '0',
    textAlign:      'center',
    position:       'relative',
    zIndex:         '1',
  });

  // ── Title logo ────────────────────────────────────────────────────────────
  const logoWrap = document.createElement('div');
  Object.assign(logoWrap.style, { position: 'relative', marginBottom: '8px' });

  // Star decoration above title
  const starRow = document.createElement('div');
  starRow.textContent = '✦  ✦  ✦  ✦  ✦';
  Object.assign(starRow.style, {
    fontSize:      '18px',
    color:         '#FFCC00',
    letterSpacing: '0.3em',
    marginBottom:  '8px',
    textShadow:    '0 0 8px #FFCC0088',
    animation:     prefersReducedMotion() ? 'none' : 'pulse 3s ease-in-out infinite',
  });
  logoWrap.appendChild(starRow);

  const logo = document.createElement('div');
  logo.textContent = 'AETHER CLASH';
  Object.assign(logo.style, {
    fontSize:      'clamp(42px, 7vw, 80px)',
    fontWeight:    '900',
    fontFamily:    '"Arial Black", "Impact", sans-serif',
    letterSpacing: '0.06em',
    lineHeight:    '1',
    color:         '#FFEE00',
    textShadow:    '4px 4px 0 #CC0000, 8px 8px 0 #880000, 0 0 30px #FFCC0066',
    marginBottom:  '6px',
    textTransform: 'uppercase',
  });
  logoWrap.appendChild(logo);

  const tagline = document.createElement('div');
  tagline.textContent = '— A PLATFORM FIGHTER —';
  Object.assign(tagline.style, {
    fontSize:      '13px',
    color:         '#FF8844',
    letterSpacing: '0.25em',
    marginBottom:  '0',
    fontWeight:    '700',
  });
  logoWrap.appendChild(tagline);
  box.appendChild(logoWrap);

  // ── Separator ────────────────────────────────────────────────────────────
  const sep = document.createElement('div');
  sep.textContent = '══════════════════════════════';
  Object.assign(sep.style, {
    fontSize:    '12px',
    color:       '#CC4400',
    margin:      '18px 0',
    letterSpacing: '0.05em',
    opacity:     '0.6',
  });
  box.appendChild(sep);

  // ── Start button ──────────────────────────────────────────────────────────
  const startBtn = makeButton('⚔  LOCAL MATCH', '#CC0000');
  Object.assign(startBtn.style, {
    fontSize:      '20px',
    padding:       '16px 48px',
    borderRadius:  '4px',
    letterSpacing: '0.12em',
    boxShadow:     '0 4px 0 #880000, 0 0 20px #CC000066',
    border:        '3px solid #FF4444',
    marginBottom:  '10px',
  });
  startBtn.onmouseenter = () => {
    startBtn.style.background = '#EE1111';
    startBtn.style.boxShadow  = '0 4px 0 #AA0000, 0 0 30px #FF000088';
    startBtn.style.transform  = 'translateY(-2px)';
  };
  startBtn.onmouseleave = () => {
    startBtn.style.background = '#CC0000';
    startBtn.style.boxShadow  = '0 4px 0 #880000, 0 0 20px #CC000066';
    startBtn.style.transform  = '';
  };
  startBtn.onclick = () => showCharacterSelect();
  box.appendChild(startBtn);

  const hint = document.createElement('div');
  hint.textContent = 'Press Enter or click to start';
  Object.assign(hint.style, {
    fontSize:  '11px',
    color:     '#666',
    marginTop: '8px',
    animation: prefersReducedMotion() ? 'none' : 'pulse 2s ease-in-out infinite',
  });
  box.appendChild(hint);

  // ── Fighter preview strip ─────────────────────────────────────────────────
  const strip = document.createElement('div');
  Object.assign(strip.style, {
    display:        'flex',
    gap:            '20px',
    marginTop:      '32px',
    justifyContent: 'center',
    opacity:        '0.55',
  });
  for (const c of CHARACTERS) {
    const pip = document.createElement('div');
    pip.textContent = c.icon;
    pip.style.fontSize = '28px';
    pip.title = c.label;
    strip.appendChild(pip);
  }
  box.appendChild(strip);

  root.appendChild(box);
}

function showCharacterSelect(): void {
  currentScreen = 'characterSelect';
  clearContent();
  if (!root) return;

  const box = makePanel('P1 — SELECT FIGHTER', '780px');

  const grid = document.createElement('div');
  grid.setAttribute('role', 'radiogroup');
  grid.setAttribute('aria-label', 'Select character');
  Object.assign(grid.style, {
    display:               'grid',
    gridTemplateColumns:   'repeat(6, 1fr)',
    gap:                   '10px',
    marginBottom:          '20px',
  });

  const ARCHETYPE_COLORS: Record<string, string> = {
    'BLADE MASTER': '#3399FF',
    'TITAN':        '#FF6633',
    'BLITZER':      '#FFCC00',
    'PSYCHIC':      '#BB44FF',
    'AERIALIST':    '#44FFAA',
  };

  const SELECTED_COLOR = '#FFEE00';

  for (const char of CHARACTERS) {
    const card = document.createElement('div');
    Object.assign(card.style, {
      padding:       '14px 6px 10px',
      borderRadius:  '6px',
      border:        '3px solid #333',
      textAlign:     'center',
      cursor:        'pointer',
      transition:    prefersReducedMotion() ? 'none' : 'border-color 0.12s, box-shadow 0.12s, transform 0.1s',
      background:    'rgba(10,10,30,0.95)',
      userSelect:    'none',
    });

    const archetypeColor = ARCHETYPE_COLORS[char.archetype] ?? '#4499FF';

    card.innerHTML = `
      <div style="font-size:36px;line-height:1;margin-bottom:8px">${char.icon}</div>
      <div style="font-weight:900;font-size:13px;letter-spacing:0.08em;color:#fff;margin-bottom:5px">${char.label}</div>
      <div style="display:inline-block;font-size:9px;font-weight:700;letter-spacing:0.1em;
                  background:${archetypeColor}22;color:${archetypeColor};border:1px solid ${archetypeColor}66;
                  border-radius:3px;padding:2px 6px;margin-bottom:5px">${char.archetype}</div>
      <div style="font-size:10px;color:#888;line-height:1.35">${char.description}</div>`;

    card.setAttribute('role', 'radio');
    card.setAttribute('aria-label', char.label);
    card.setAttribute('aria-checked', 'false');
    card.tabIndex = 0;
    card.dataset['char'] = char.id;

    const selectCard = () => {
      selectedCharacter = char.id;
      grid.querySelectorAll<HTMLDivElement>('[data-char]').forEach(el => {
        el.style.borderColor = '#333';
        el.style.boxShadow   = 'none';
        el.style.transform   = '';
        el.setAttribute('aria-checked', 'false');
      });
      card.style.borderColor = SELECTED_COLOR;
      card.style.boxShadow   = `0 0 14px ${SELECTED_COLOR}66`;
      card.style.transform   = 'translateY(-2px)';
      card.setAttribute('aria-checked', 'true');
    };

    card.onmouseenter = () => {
      if (selectedCharacter !== char.id) {
        card.style.borderColor = archetypeColor;
        card.style.boxShadow   = `0 0 8px ${archetypeColor}44`;
      }
    };
    card.onmouseleave = () => {
      if (selectedCharacter !== char.id) {
        card.style.borderColor = '#333';
        card.style.boxShadow   = 'none';
      }
    };
    card.onclick = selectCard;
    card.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectCard(); }
    };

    grid.appendChild(card);
  }

  // ── RANDOM card ──────────────────────────────────────────────────────────
  const rndCard = makeRandomCard('?', 'RANDOM', 'Surprise yourself!', '#888');
  rndCard.setAttribute('aria-label', 'Random character');
  rndCard.dataset['char'] = '__random__';
  rndCard.onclick = () => {
    const randomChar = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)]!;
    selectedCharacter = randomChar.id;
    grid.querySelectorAll<HTMLDivElement>('[data-char]').forEach(el => {
      el.style.borderColor = '#333';
      el.style.boxShadow   = 'none';
      el.style.transform   = '';
      el.setAttribute('aria-checked', 'false');
    });
    rndCard.style.borderColor = SELECTED_COLOR;
    rndCard.style.boxShadow   = `0 0 14px ${SELECTED_COLOR}66`;
    rndCard.style.transform   = 'translateY(-2px)';
    rndCard.setAttribute('aria-checked', 'true');
  };
  grid.appendChild(rndCard);
  box.appendChild(grid);

  const nav = makeNav();
  const backBtn = makeButton('← BACK', '#444');
  backBtn.onclick = () => showLobby();
  nav.appendChild(backBtn);
  const nextBtn = makeButton('NEXT →', '#0055CC');
  nextBtn.onclick = () => {
    if (!selectedCharacter) selectedCharacter = 'kael';
    showStageSelect();
  };
  nav.appendChild(nextBtn);
  box.appendChild(nav);
  root.appendChild(box);
}

function showStageSelect(): void {
  currentScreen = 'stageSelect';
  clearContent();
  if (!root) return;

  const box = makePanel('SELECT STAGE', '860px');

  const grid = document.createElement('div');
  grid.setAttribute('role', 'radiogroup');
  grid.setAttribute('aria-label', 'Select stage');
  Object.assign(grid.style, {
    display:             'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap:                 '10px',
    marginBottom:        '20px',
  });

  const TYPE_COLORS: Record<string, string> = {
    STANDARD:  '#4488FF',
    BREEZY:    '#44DD88',
    DYNAMIC:   '#FF8833',
    CASUAL:    '#FF88CC',
    EXTREME:   '#FF2244',
    INTENSE:   '#AA00FF',
  };

  const SELECTED_COLOR = '#44FF88';

  for (const stage of STAGES) {
    const card = document.createElement('div');
    Object.assign(card.style, {
      padding:      '12px 6px 10px',
      borderRadius: '6px',
      border:       '3px solid #333',
      textAlign:    'center',
      cursor:       'pointer',
      transition:   prefersReducedMotion() ? 'none' : 'border-color 0.12s, box-shadow 0.12s, transform 0.1s',
      background:   'rgba(10,10,30,0.95)',
      userSelect:   'none',
    });

    const typeColor = TYPE_COLORS[stage.type] ?? '#4488FF';

    card.innerHTML = `
      <div style="font-size:28px;line-height:1;margin-bottom:7px">${stage.icon}</div>
      <div style="font-weight:900;font-size:11px;letter-spacing:0.06em;color:#fff;margin-bottom:5px">${stage.label}</div>
      <div style="display:inline-block;font-size:9px;font-weight:700;letter-spacing:0.1em;
                  background:${typeColor}22;color:${typeColor};border:1px solid ${typeColor}66;
                  border-radius:3px;padding:2px 5px;margin-bottom:5px">${stage.type}</div>
      <div style="font-size:10px;color:#888;line-height:1.3">${stage.description}</div>`;

    card.setAttribute('role', 'radio');
    card.setAttribute('aria-label', stage.label);
    card.setAttribute('aria-checked', 'false');
    card.tabIndex = 0;
    card.dataset['stage'] = stage.id;

    const selectCard = () => {
      selectedStage = stage.id;
      grid.querySelectorAll<HTMLDivElement>('[data-stage]').forEach(el => {
        el.style.borderColor = '#333';
        el.style.boxShadow   = 'none';
        el.style.transform   = '';
        el.setAttribute('aria-checked', 'false');
      });
      card.style.borderColor = SELECTED_COLOR;
      card.style.boxShadow   = `0 0 14px ${SELECTED_COLOR}66`;
      card.style.transform   = 'translateY(-2px)';
      card.setAttribute('aria-checked', 'true');
    };

    card.onmouseenter = () => {
      if (selectedStage !== stage.id) {
        card.style.borderColor = typeColor;
        card.style.boxShadow   = `0 0 8px ${typeColor}44`;
      }
    };
    card.onmouseleave = () => {
      if (selectedStage !== stage.id) {
        card.style.borderColor = '#333';
        card.style.boxShadow   = 'none';
      }
    };
    card.onclick = selectCard;
    card.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectCard(); }
    };

    grid.appendChild(card);
  }

  // ── RANDOM stage card ────────────────────────────────────────────────────
  const rndCard = makeRandomCard('?', 'RANDOM', 'Spin the wheel!', '#888');
  rndCard.setAttribute('aria-label', 'Random stage');
  rndCard.dataset['stage'] = '__random__';
  rndCard.onclick = () => {
    const randomStage = STAGES[Math.floor(Math.random() * STAGES.length)]!;
    selectedStage = randomStage.id;
    grid.querySelectorAll<HTMLDivElement>('[data-stage]').forEach(el => {
      el.style.borderColor = '#333';
      el.style.boxShadow   = 'none';
      el.style.transform   = '';
      el.setAttribute('aria-checked', 'false');
    });
    rndCard.style.borderColor = SELECTED_COLOR;
    rndCard.style.boxShadow   = `0 0 14px ${SELECTED_COLOR}66`;
    rndCard.style.transform   = 'translateY(-2px)';
    rndCard.setAttribute('aria-checked', 'true');
  };
  grid.appendChild(rndCard);

  box.appendChild(grid);

  const nav = makeNav();
  const backBtn = makeButton('← BACK', '#444');
  backBtn.onclick = () => showCharacterSelect();
  nav.appendChild(backBtn);
  const startBtn = makeButton('⚔  FIGHT!', '#CC0000');
  Object.assign(startBtn.style, {
    border:    '3px solid #FF4444',
    boxShadow: '0 3px 0 #880000',
  });
  startBtn.onmouseenter = () => {
    startBtn.style.background = '#EE1111';
    startBtn.style.transform  = 'translateY(-2px)';
  };
  startBtn.onmouseleave = () => {
    startBtn.style.background = '#CC0000';
    startBtn.style.transform  = '';
  };
  startBtn.onclick = () => {
    const charId  = selectedCharacter ?? 'kael';
    const stageId = selectedStage    ?? 'aetherPlateau';
    const cb = callbacks;
    disposeScreens();
    cb?.onMatchReady(charId as CharacterId, stageId as StageId);
  };
  nav.appendChild(startBtn);
  box.appendChild(nav);
  root.appendChild(box);
}

// ── DOM helpers ───────────────────────────────────────────────────────────────

/**
 * Clears only the content panels added by showLobby/showCharacterSelect/
 * showStageSelect, leaving the persistent starfield in place.
 */
function clearContent(): void {
  if (!root) return;
  // Remove every child that is NOT the starfield backdrop.
  const toRemove: ChildNode[] = [];
  root.childNodes.forEach(n => {
    if ((n as HTMLElement).id !== 'screens-starfield') toRemove.push(n);
  });
  toRemove.forEach(n => root!.removeChild(n));
}

function makePanel(title: string, width: string): HTMLDivElement {
  const box = document.createElement('div');
  Object.assign(box.style, {
    width,
    maxWidth:     '97vw',
    maxHeight:    '90vh',
    overflowY:    'auto',
    background:   'rgba(8,8,22,0.97)',
    borderRadius: '8px',
    padding:      '32px 40px 28px',
    border:       '2px solid #222',
    boxShadow:    '0 10px 50px rgba(0,0,0,0.85)',
    position:     'relative',
    zIndex:       '1',
  });

  const h1 = document.createElement('h1');
  h1.textContent = title;
  Object.assign(h1.style, {
    fontSize:      '22px',
    fontWeight:    '900',
    fontFamily:    '"Arial Black", "Impact", sans-serif',
    letterSpacing: '0.14em',
    textAlign:     'center',
    marginBottom:  '22px',
    color:         '#FFEE00',
    textShadow:    '2px 2px 0 #CC0000',
    textTransform: 'uppercase',
  });
  box.appendChild(h1);
  return box;
}

function makeButton(label: string, color: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.textContent = label;
  Object.assign(btn.style, {
    padding:       '11px 28px',
    fontSize:      '15px',
    fontFamily:    '"Arial Black", "Impact", sans-serif',
    fontWeight:    '900',
    background:    color,
    color:         '#fff',
    border:        'none',
    borderRadius:  '4px',
    cursor:        'pointer',
    letterSpacing: '0.1em',
    textShadow:    '1px 1px 2px rgba(0,0,0,0.5)',
    transition:    prefersReducedMotion() ? 'none' : 'transform 0.08s, background 0.08s',
    userSelect:    'none',
  });
  return btn;
}

function makeNav(): HTMLDivElement {
  const nav = document.createElement('div');
  Object.assign(nav.style, {
    display:        'flex',
    gap:            '12px',
    justifyContent: 'center',
    marginTop:      '4px',
  });
  return nav;
}

function makeRandomCard(icon: string, label: string, desc: string, color: string): HTMLDivElement {
  const card = document.createElement('div');
  Object.assign(card.style, {
    padding:      '14px 6px 10px',
    borderRadius: '6px',
    border:       `3px dashed ${color}`,
    textAlign:    'center',
    cursor:       'pointer',
    background:   'rgba(10,10,30,0.95)',
    userSelect:   'none',
    transition:   prefersReducedMotion() ? 'none' : 'border-color 0.12s, box-shadow 0.12s, transform 0.1s',
  });
  card.innerHTML = `
    <div style="font-size:36px;line-height:1;margin-bottom:8px;color:${color}">${icon}</div>
    <div style="font-weight:900;font-size:13px;letter-spacing:0.08em;color:${color};margin-bottom:5px">${label}</div>
    <div style="font-size:10px;color:#666;line-height:1.35">${desc}</div>`;
  card.setAttribute('role', 'radio');
  card.setAttribute('aria-checked', 'false');
  card.tabIndex = 0;
  card.onmouseenter = () => {
    card.style.borderColor = '#aaa';
    card.style.boxShadow   = '0 0 8px #ffffff22';
  };
  card.onmouseleave = () => {
    if (card.getAttribute('aria-checked') !== 'true') {
      card.style.borderColor = color;
      card.style.boxShadow   = 'none';
    }
  };
  card.onkeydown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.click(); }
  };
  return card;
}

// ── Starfield backdrop ────────────────────────────────────────────────────────

function buildStarfield(): HTMLDivElement {
  const sf = document.createElement('div');
  sf.id = 'screens-starfield';
  Object.assign(sf.style, {
    position: 'absolute',
    inset:    '0',
    overflow: 'hidden',
    zIndex:   '0',
    pointerEvents: 'none',
  });

  const rng = mulberry32(0xdeadbeef); // deterministic pseudo-random

  for (let i = 0; i < 120; i++) {
    const star = document.createElement('div');
    const size = rng() < 0.1 ? 3 : 1;
    const x    = rng() * 100;
    const y    = rng() * 100;
    const dur  = 2 + rng() * 4;
    const del  = rng() * 5;
    const opacity = 0.2 + rng() * 0.7;
    Object.assign(star.style, {
      position:        'absolute',
      left:            `${x}%`,
      top:             `${y}%`,
      width:           `${size}px`,
      height:          `${size}px`,
      borderRadius:    '50%',
      background:      '#fff',
      opacity:         String(opacity),
      animation:       prefersReducedMotion()
        ? 'none'
        : `twinkle ${dur.toFixed(1)}s ${del.toFixed(1)}s ease-in-out infinite`,
    });
    sf.appendChild(star);
  }
  return sf;
}

// ── CSS injection ─────────────────────────────────────────────────────────────

function injectGlobalStyles(): void {
  if (document.getElementById('screens-styles')) return;
  const style = document.createElement('style');
  style.id = 'screens-styles';
  style.textContent = `
    @keyframes twinkle {
      0%, 100% { opacity: 0.15; transform: scale(1); }
      50%       { opacity: 1;    transform: scale(1.4); }
    }
    @keyframes pulse {
      0%, 100% { opacity: 0.6; }
      50%       { opacity: 1; }
    }
  `;
  document.head.appendChild(style);
}

// ── Tiny deterministic PRNG (Mulberry32) ─────────────────────────────────────
// Used for the starfield so positions are consistent across reloads (no Math.random).

function mulberry32(seed: number): () => number {
  let s = seed;
  return () => {
    s  |= 0; s  = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}
