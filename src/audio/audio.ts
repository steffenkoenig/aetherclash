// src/audio/audio.ts
// Aether Clash audio system.
//
// Sound effects are loaded on demand (first trigger); the decoded AudioBuffer is
// cached in memory so subsequent plays are instant.
// Background music uses a streaming AudioBufferSourceNode and loops continuously.
//
// The audio context is created on the first user interaction to comply with
// browser autoplay policies.

// ── Module state ──────────────────────────────────────────────────────────────

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let musicGain: GainNode | null = null;
let sfxGain: GainNode | null = null;

/** Decoded AudioBuffer cache keyed by URL. */
const bufferCache = new Map<string, AudioBuffer>();

/** Loading promises (in-flight fetches) keyed by URL. */
const loadingPromises = new Map<string, Promise<AudioBuffer>>();

/** The currently playing music source node (if any). */
let musicSource: AudioBufferSourceNode | null = null;

/** Current music URL. */
let currentMusicUrl: string | null = null;

// ── Context lifecycle ─────────────────────────────────────────────────────────

/**
 * Initialise the audio context and gain graph.
 * Call once on the first user interaction (e.g. Start button click).
 */
export function initAudio(): void {
  if (ctx) return;
  ctx = new AudioContext();

  masterGain = ctx.createGain();
  masterGain.gain.value = 1.0;
  masterGain.connect(ctx.destination);

  sfxGain = ctx.createGain();
  sfxGain.gain.value = 0.8;
  sfxGain.connect(masterGain);

  musicGain = ctx.createGain();
  musicGain.gain.value = 0.4;
  musicGain.connect(masterGain);
}

/** Resume the AudioContext (required after tab becomes visible again). */
export async function resumeAudio(): Promise<void> {
  if (ctx?.state === 'suspended') {
    await ctx.resume();
  }
}

/** Suspend audio (tab hidden). */
export async function suspendAudio(): Promise<void> {
  await ctx?.suspend();
}

/** Dispose everything (match end, page unload). */
export function disposeAudio(): void {
  stopMusic();
  ctx?.close();
  ctx = null;
  masterGain = null;
  musicGain = null;
  sfxGain = null;
  bufferCache.clear();
  loadingPromises.clear();
}

// ── Volume controls ───────────────────────────────────────────────────────────

export function setMasterVolume(v: number): void {
  if (masterGain) masterGain.gain.value = Math.max(0, Math.min(1, v));
}

export function setSfxVolume(v: number): void {
  if (sfxGain) sfxGain.gain.value = Math.max(0, Math.min(1, v));
}

export function setMusicVolume(v: number): void {
  if (musicGain) musicGain.gain.value = Math.max(0, Math.min(1, v));
}

// ── Buffer loading ────────────────────────────────────────────────────────────

/**
 * Fetch and decode an audio file, returning a cached AudioBuffer.
 * Safe to call multiple times — returns the cached promise on subsequent calls.
 */
async function loadBuffer(url: string): Promise<AudioBuffer> {
  if (bufferCache.has(url)) return bufferCache.get(url)!;
  if (loadingPromises.has(url)) return loadingPromises.get(url)!;

  if (!ctx) throw new Error('[audio] AudioContext not initialised');

  const p = fetch(url)
    .then(r => r.arrayBuffer())
    .then(ab => ctx!.decodeAudioData(ab))
    .then(buf => {
      bufferCache.set(url, buf);
      loadingPromises.delete(url);
      return buf;
    })
    .catch(err => {
      loadingPromises.delete(url);
      throw err;
    });

  loadingPromises.set(url, p);
  return p;
}

// ── Sound effects ─────────────────────────────────────────────────────────────

/**
 * Play a one-shot sound effect.
 * Loads the buffer on first call; subsequent calls are instant.
 *
 * @param url        Path to the audio file relative to /public.
 * @param volume     Per-play volume multiplier (0–1). Default 1.
 * @param playbackRate  Speed/pitch multiplier. Default 1.
 */
export function playSfx(url: string, volume = 1, playbackRate = 1): void {
  if (!ctx || !sfxGain) return;

  // Fire-and-forget — load buffer then play
  loadBuffer(url).then(buf => {
    if (!ctx || !sfxGain) return;
    const source = ctx.createBufferSource();
    source.buffer = buf;
    source.playbackRate.value = playbackRate;

    const gain = ctx.createGain();
    gain.gain.value = Math.max(0, Math.min(1, volume));
    source.connect(gain);
    gain.connect(sfxGain);
    source.start();
  }).catch(() => {
    // Audio loading failure is non-fatal; silently ignore.
  });
}

// ── Named sound effect helpers ────────────────────────────────────────────────
//
// The actual audio asset paths live in public/assets/audio/.
// If a file is missing the playSfx() call silently fails.

export const SFX = {
  HIT:           '/assets/audio/hit.wav',
  STRONG_HIT:    '/assets/audio/hit_strong.wav',
  SHIELD_HIT:    '/assets/audio/shield_hit.wav',
  SHIELD_BREAK:  '/assets/audio/shield_break.wav',
  JUMP:          '/assets/audio/jump.wav',
  DOUBLE_JUMP:   '/assets/audio/double_jump.wav',
  LAND:          '/assets/audio/land.wav',
  KO:            '/assets/audio/ko.wav',
  ITEM_SPAWN:    '/assets/audio/item_spawn.wav',
  ITEM_PICKUP:   '/assets/audio/item_pickup.wav',
  EXPLOSION:     '/assets/audio/explosion.wav',
  GEYSER:        '/assets/audio/geyser.wav',
  LIGHTNING:     '/assets/audio/lightning.wav',
  PHASE_SHIFT:   '/assets/audio/phase_shift.wav',
  GUARDIAN:      '/assets/audio/guardian_summon.wav',
  HEAL:          '/assets/audio/heal.wav',
  MENU_SELECT:   '/assets/audio/menu_select.wav',
  MENU_CONFIRM:  '/assets/audio/menu_confirm.wav',
} as const;

export type SfxKey = keyof typeof SFX;

/** Play a named SFX by key. */
export function play(key: SfxKey, volume?: number, rate?: number): void {
  playSfx(SFX[key], volume, rate);
}

// ── Background music ──────────────────────────────────────────────────────────

/**
 * Start streaming background music.
 * If the same URL is already playing, this is a no-op.
 * Music loops continuously until stopMusic() is called.
 */
export function playMusic(url: string): void {
  if (!ctx || !musicGain) return;
  if (currentMusicUrl === url && musicSource) return;

  stopMusic();
  currentMusicUrl = url;

  loadBuffer(url).then(buf => {
    if (!ctx || !musicGain) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(musicGain!);
    src.start();
    musicSource = src;
  }).catch(() => {
    // Music loading failure is non-fatal.
  });
}

/** Stop background music immediately. */
export function stopMusic(): void {
  if (musicSource) {
    try { musicSource.stop(); } catch { /* already stopped */ }
    musicSource = null;
  }
  currentMusicUrl = null;
}

/** Fade music out over `durationSeconds`. */
export function fadeMusicOut(durationSeconds = 1): void {
  if (!ctx || !musicGain) return;
  const now = ctx.currentTime;
  musicGain.gain.setValueAtTime(musicGain.gain.value, now);
  musicGain.gain.linearRampToValueAtTime(0, now + durationSeconds);
  setTimeout(() => stopMusic(), durationSeconds * 1000 + 100);
}

// ── Stage music map ───────────────────────────────────────────────────────────

export const STAGE_MUSIC: Record<string, string> = {
  aetherPlateau: '/assets/audio/music_aether_plateau.wav',
  forge:         '/assets/audio/music_forge.wav',
  cloudCitadel:  '/assets/audio/music_cloud_citadel.wav',
  ancientRuin:   '/assets/audio/music_ancient_ruin.wav',
  digitalGrid:   '/assets/audio/music_digital_grid.wav',
};

/** Convenience: play the correct music track for the given stage ID. */
export function playStageMusic(stageId: string): void {
  const url = STAGE_MUSIC[stageId];
  if (url) playMusic(url);
}
