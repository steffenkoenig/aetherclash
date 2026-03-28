// scripts/generate-audio.mjs
// Generates procedural WAV audio files for all Aether Clash sound effects and
// stage music tracks.  Requires no external dependencies — uses only Node.js
// built-ins.
//
// Run with:  node scripts/generate-audio.mjs
//
// Output:    public/assets/audio/*.wav
//
// ─── WAV encoding helpers ────────────────────────────────────────────────────

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR   = path.resolve(__dirname, '../public/assets/audio');

fs.mkdirSync(OUT_DIR, { recursive: true });

const SAMPLE_RATE = 44100;
const BIT_DEPTH   = 16;
const CHANNELS    = 1;

/** Encode a Float32Array of samples (−1…+1) as a 16-bit PCM WAV Buffer. */
function encodeWav(samples) {
  const dataBytes  = samples.length * 2; // 2 bytes per 16-bit sample
  const fileSize   = 44 + dataBytes;
  const buf        = Buffer.alloc(fileSize);
  let   off        = 0;

  // RIFF header
  buf.write('RIFF', off);            off += 4;
  buf.writeUInt32LE(fileSize - 8, off); off += 4;
  buf.write('WAVE', off);            off += 4;

  // fmt chunk
  buf.write('fmt ', off);            off += 4;
  buf.writeUInt32LE(16, off);        off += 4; // chunk size
  buf.writeUInt16LE(1,  off);        off += 2; // PCM
  buf.writeUInt16LE(CHANNELS, off);  off += 2;
  buf.writeUInt32LE(SAMPLE_RATE, off); off += 4;
  buf.writeUInt32LE(SAMPLE_RATE * CHANNELS * (BIT_DEPTH / 8), off); off += 4; // byte rate
  buf.writeUInt16LE(CHANNELS * (BIT_DEPTH / 8), off); off += 2; // block align
  buf.writeUInt16LE(BIT_DEPTH, off); off += 2;

  // data chunk
  buf.write('data', off);            off += 4;
  buf.writeUInt32LE(dataBytes, off); off += 4;

  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    const pcm     = Math.round(clamped * 32767);
    buf.writeInt16LE(pcm, off);
    off += 2;
  }
  return buf;
}

/** Write a samples array to a .wav file. */
function writeWav(filename, samples) {
  const outPath = path.join(OUT_DIR, filename);
  fs.writeFileSync(outPath, encodeWav(samples));
  console.log(`  wrote ${filename}  (${samples.length} samples)`);
}

// ─── Synthesis primitives ────────────────────────────────────────────────────

const TAU = Math.PI * 2;

/** Simple ADSR envelope, all times in seconds. */
function adsr(t, totalDur, attack, decay, sustain, release) {
  if (t < attack) return t / attack;
  if (t < attack + decay) return 1 - (1 - sustain) * (t - attack) / decay;
  if (t < totalDur - release) return sustain;
  const tail = totalDur - release;
  return sustain * Math.max(0, 1 - (t - tail) / release);
}

/** Generate samples for a given duration at SAMPLE_RATE. */
function generate(durationSec, fn) {
  const n = Math.ceil(durationSec * SAMPLE_RATE);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = fn(i / SAMPLE_RATE, i);
  }
  return out;
}

/** Sine oscillator. */
function sine(freq, t) {
  return Math.sin(TAU * freq * t);
}

/** Sawtooth oscillator (band-limited via a few partials). */
function saw(freq, t) {
  let s = 0;
  for (let k = 1; k <= 6; k++) {
    s += (1 / k) * Math.sin(TAU * freq * k * t);
  }
  return s * (2 / Math.PI);
}

/** Square oscillator. */
function square(freq, t) {
  let s = 0;
  for (let k = 1; k <= 9; k += 2) {
    s += (1 / k) * Math.sin(TAU * freq * k * t);
  }
  return s * (4 / Math.PI);
}

/** Pink-ish noise via a simple IIR filter on white noise. */
const noiseState = { b0: 0, b1: 0, b2: 0 };
function pink() {
  const w = (Math.random() * 2 - 1);
  noiseState.b0 = 0.99765 * noiseState.b0 + w * 0.0990460;
  noiseState.b1 = 0.96300 * noiseState.b1 + w * 0.2965164;
  noiseState.b2 = 0.57000 * noiseState.b2 + w * 1.0526913;
  return (noiseState.b0 + noiseState.b1 + noiseState.b2 + w * 0.1848) / 5;
}

// ─── Sound definitions ───────────────────────────────────────────────────────

console.log('Generating sound effects…');

// hit.wav — short percussive click with mid-frequency punch
writeWav('hit.wav', generate(0.18, t => {
  const env = adsr(t, 0.18, 0.002, 0.04, 0.1, 0.1);
  const freq = 320 * Math.exp(-t * 12);
  return sine(freq, t) * env * 0.7 + pink() * env * 0.3;
}));

// hit_strong.wav — deeper, longer hit
writeWav('hit_strong.wav', generate(0.28, t => {
  const env = adsr(t, 0.28, 0.003, 0.06, 0.15, 0.15);
  const freq = 160 * Math.exp(-t * 8);
  return sine(freq, t) * env * 0.6 + sine(freq * 1.5, t) * env * 0.3 + pink() * env * 0.2;
}));

// shield_hit.wav — metallic clink
writeWav('shield_hit.wav', generate(0.15, t => {
  const env = adsr(t, 0.15, 0.001, 0.02, 0.0, 0.12);
  const base = 880;
  return (sine(base, t) * 0.5 + sine(base * 2.3, t) * 0.3 + sine(base * 3.7, t) * 0.2) * env;
}));

// shield_break.wav — shattering crunch
writeWav('shield_break.wav', generate(0.45, t => {
  const env = adsr(t, 0.45, 0.002, 0.05, 0.3, 0.3);
  const crunch = pink() * Math.exp(-t * 4) * 0.6;
  const tone   = sine(220 * Math.exp(-t * 3), t) * 0.4;
  return (crunch + tone) * env;
}));

// jump.wav — short upward chirp
writeWav('jump.wav', generate(0.16, t => {
  const env  = adsr(t, 0.16, 0.002, 0.05, 0.0, 0.1);
  const freq = 300 + t * 1800;
  return sine(freq, t) * env * 0.5 + sine(freq * 2, t) * env * 0.2;
}));

// double_jump.wav — two-tone ascending chirp
writeWav('double_jump.wav', generate(0.22, t => {
  const env  = adsr(t, 0.22, 0.002, 0.06, 0.0, 0.12);
  const freq = 400 + t * 2000;
  return (sine(freq, t) * 0.5 + sine(freq * 1.5, t) * 0.3) * env;
}));

// land.wav — dull thud
writeWav('land.wav', generate(0.12, t => {
  const env  = adsr(t, 0.12, 0.001, 0.03, 0.1, 0.08);
  const freq = 80 * Math.exp(-t * 20);
  return (sine(freq, t) * 0.5 + pink() * 0.5) * env * 0.9;
}));

// ko.wav — descending "whoosh" + impact
writeWav('ko.wav', generate(0.7, t => {
  const env  = adsr(t, 0.7, 0.01, 0.1, 0.3, 0.3);
  const freq = 600 * Math.exp(-t * 4);
  const whoosh = saw(freq, t) * 0.4 + pink() * 0.2;
  return whoosh * env;
}));

// item_spawn.wav — magical twinkle
writeWav('item_spawn.wav', generate(0.3, t => {
  const env = adsr(t, 0.3, 0.005, 0.05, 0.4, 0.2);
  return (sine(1046.5, t) * 0.4 + sine(1318.5, t) * 0.3 + sine(1568, t) * 0.3) * env;
}));

// item_pickup.wav — ascending ding
writeWav('item_pickup.wav', generate(0.2, t => {
  const env  = adsr(t, 0.2, 0.002, 0.03, 0.5, 0.15);
  const freq = 523.25 + t * 600;
  return sine(freq, t) * env * 0.7;
}));

// explosion.wav — boom with sub-bass
writeWav('explosion.wav', generate(0.6, t => {
  const env  = adsr(t, 0.6, 0.003, 0.08, 0.2, 0.4);
  const sub  = sine(40 * Math.exp(-t * 5), t) * 0.5;
  const rumble = pink() * Math.exp(-t * 3) * 0.5;
  return (sub + rumble) * env;
}));

// geyser.wav — rushing water burst
writeWav('geyser.wav', generate(0.5, t => {
  const env = adsr(t, 0.5, 0.02, 0.1, 0.6, 0.2);
  const freq = 200 + t * 300;
  return (sine(freq, t) * 0.3 + pink() * 0.7) * env;
}));

// lightning.wav — sharp electrical zap
writeWav('lightning.wav', generate(0.25, t => {
  const env  = adsr(t, 0.25, 0.001, 0.02, 0.3, 0.2);
  const zap  = pink() * 0.6 + sine(80 + t * 400, t) * 0.4;
  return zap * env;
}));

// phase_shift.wav — whoosh + rising pitch
writeWav('phase_shift.wav', generate(0.35, t => {
  const env  = adsr(t, 0.35, 0.01, 0.05, 0.5, 0.2);
  const freq = 200 + t * 1600;
  return (saw(freq, t) * 0.4 + sine(freq * 2, t) * 0.3 + pink() * 0.3) * env * 0.6;
}));

// guardian_summon.wav — deep resonant chord
writeWav('guardian_summon.wav', generate(0.55, t => {
  const env = adsr(t, 0.55, 0.02, 0.08, 0.6, 0.3);
  return (sine(110, t) * 0.4 + sine(165, t) * 0.35 + sine(220, t) * 0.25) * env;
}));

// heal.wav — soft shimmering chime
writeWav('heal.wav', generate(0.4, t => {
  const env = adsr(t, 0.4, 0.01, 0.05, 0.5, 0.25);
  return (sine(1174.7, t) * 0.4 + sine(1568, t) * 0.3 + sine(2093, t) * 0.3) * env * 0.6;
}));

// menu_select.wav — short blip
writeWav('menu_select.wav', generate(0.1, t => {
  const env  = adsr(t, 0.1, 0.001, 0.01, 0.3, 0.07);
  return sine(660, t) * env * 0.6;
}));

// menu_confirm.wav — two-tone confirmation
writeWav('menu_confirm.wav', generate(0.18, t => {
  const env  = adsr(t, 0.18, 0.002, 0.02, 0.4, 0.1);
  const freq = t < 0.09 ? 523.25 : 783.99;
  return sine(freq, t) * env * 0.6;
}));

// ─── Stage music ─────────────────────────────────────────────────────────────

console.log('\nGenerating stage music…');

/** Build a simple repeating arpeggio/melody loop.
 * @param {number[]} notes  Frequencies in Hz
 * @param {number}   bpm
 * @param {number}   bars   Number of bars (each bar = 4 beats)
 * @param {function} osc    Oscillator function (freq, t) => sample
 */
function buildLoop(notes, bpm, bars, osc, bassNotes) {
  const beatSec   = 60 / bpm;
  const barSec    = beatSec * 4;
  const totalSec  = barSec * bars;
  const n         = Math.ceil(totalSec * SAMPLE_RATE);
  const out       = new Float32Array(n);

  const noteCount = notes.length;
  const noteDur   = (barSec * bars) / noteCount;

  for (let i = 0; i < n; i++) {
    const t        = i / SAMPLE_RATE;
    const noteIdx  = Math.floor(t / noteDur) % noteCount;
    const noteTime = t % noteDur;
    const freq     = notes[noteIdx];
    const env      = adsr(noteTime, noteDur, 0.01, 0.05, 0.5, 0.1);

    let sample = osc(freq, t) * env * 0.35;

    // bass line: root note every beat, two octaves down
    if (bassNotes) {
      const beatIdx  = Math.floor(t / beatSec) % bassNotes.length;
      const beatTime = t % beatSec;
      const bEnv     = adsr(beatTime, beatSec, 0.005, 0.08, 0.3, 0.2);
      sample += sine(bassNotes[beatIdx] / 4, t) * bEnv * 0.2;
    }

    out[i] = sample;
  }
  return out;
}

// aether_plateau — bright, airy
writeWav('music_aether_plateau.wav', buildLoop(
  [523.25, 659.25, 783.99, 1046.5, 783.99, 659.25, 523.25, 415.3],
  128, 8, (f, t) => sine(f, t) * 0.6 + sine(f * 2, t) * 0.4,
  [261.63, 261.63, 329.63, 329.63],
));

// forge — heavy, rhythmic
writeWav('music_forge.wav', buildLoop(
  [110, 138.59, 164.81, 110, 138.59, 185, 164.81, 130.81],
  140, 8, (f, t) => saw(f, t) * 0.5 + square(f * 0.5, t) * 0.3,
  [55, 55, 69.3, 73.4],
));

// cloud_citadel — light and dreamy
writeWav('music_cloud_citadel.wav', buildLoop(
  [698.46, 880, 1046.5, 1174.7, 1046.5, 880, 698.46, 587.33],
  110, 8, (f, t) => sine(f, t) * 0.7 + sine(f * 1.5, t) * 0.3,
  [349.23, 349.23, 440, 440],
));

// ancient_ruin — mysterious, minor
writeWav('music_ancient_ruin.wav', buildLoop(
  [220, 261.63, 293.66, 220, 246.94, 293.66, 261.63, 220],
  100, 8, (f, t) => square(f, t) * 0.4 + sine(f * 0.5, t) * 0.4,
  [110, 110, 130.81, 123.47],
));

// digital_grid — electronic, driving
writeWav('music_digital_grid.wav', buildLoop(
  [329.63, 415.3, 493.88, 587.33, 659.25, 587.33, 493.88, 415.3],
  150, 8, (f, t) => {
    const s = saw(f, t) * 0.5 + square(f, t) * 0.3;
    // gated rhythm: mute every other eighth-note
    const gateHz = (150 / 60) * 2; // 2 gates per beat
    const gate   = Math.sin(Math.PI * gateHz * t) > 0 ? 1 : 0.2;
    return s * gate;
  },
  [164.81, 164.81, 196, 207.65],
));

console.log('\nAll audio files written to', OUT_DIR);
