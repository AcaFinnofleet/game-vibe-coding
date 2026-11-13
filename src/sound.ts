// Sound effects, made on the spot with the browser's Web Audio API: no sound files needed.
// Each effect is a few beeps (tones that slide from one pitch to another) and hisses (noise).
// Browsers only allow sound after the player pressed a key or clicked, so the first effects
// before that stay silent.
import { SOUND } from './config';

export type SoundName = keyof typeof EFFECTS;

let audio: AudioContext | null = null;
let muted = false;
const lastPlayed = new Map<SoundName, number>(); // when each effect last played, in seconds

// Start the audio on the first key press or click.
export function initSound(): void {
  const start = () => {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') void audio.resume();
  };
  window.addEventListener('keydown', start);
  window.addEventListener('pointerdown', start);
}

export function setMuted(value: boolean): void {
  muted = value;
}

export function isMuted(): boolean {
  return muted;
}

// Play an effect. The same effect plays at most once every SOUND.minGap seconds (the growl once
// every SOUND.growlGap), so ten monsters growling at once sound like one growl and not like a buzz.
export function playSound(name: SoundName): void {
  if (!audio || muted || audio.state !== 'running') return;
  const now = audio.currentTime;
  const gap = name === 'growl' ? SOUND.growlGap : SOUND.minGap;
  if (now - (lastPlayed.get(name) ?? -Infinity) < gap) return;
  lastPlayed.set(name, now);
  EFFECTS[name](audio, now);
}

// A tone sliding from one pitch to another, fading out. start: seconds after now.
function beep(a: AudioContext, now: number, type: OscillatorType, from: number, to: number, length: number, start = 0, volume = 1): void {
  const t = now + start;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(to, t + length);
  gain.gain.setValueAtTime(SOUND.volume * volume, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + length);
  osc.connect(gain).connect(a.destination);
  osc.start(t);
  osc.stop(t + length);
}

// A hiss, filtered: low filter = rumble or whoosh, high filter = crackle. start: seconds after now.
function hiss(a: AudioContext, now: number, length: number, filter: BiquadFilterType, pitch: number, start = 0, volume = 1): void {
  const t = now + start;
  const buffer = a.createBuffer(1, Math.ceil(a.sampleRate * length), a.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const source = a.createBufferSource();
  source.buffer = buffer;
  const shape = a.createBiquadFilter();
  shape.type = filter;
  shape.frequency.value = pitch;
  const gain = a.createGain();
  gain.gain.setValueAtTime(SOUND.volume * volume, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + length);
  source.connect(shape).connect(gain).connect(a.destination);
  source.start(t);
}

const EFFECTS = {
  hop: (a: AudioContext, t: number) => beep(a, t, 'square', 300, 600, 0.12, 0, 0.4),
  lightning: (a: AudioContext, t: number) => {
    hiss(a, t, 0.35, 'highpass', 2000, 0, 1.2);
    beep(a, t, 'sawtooth', 1200, 80, 0.3, 0, 0.6);
  },
  lightningMiss: (a: AudioContext, t: number) => hiss(a, t, 0.15, 'highpass', 3000, 0, 0.6),
  fire: (a: AudioContext, t: number) => hiss(a, t, 0.3, 'lowpass', 900, 0, 1.2),
  fireHit: (a: AudioContext, t: number) => beep(a, t, 'square', 220, 70, 0.2, 0, 0.6),
  monsterBurns: (a: AudioContext, t: number) => {
    hiss(a, t, 0.6, 'lowpass', 600, 0, 1.4);
    beep(a, t, 'sawtooth', 500, 40, 0.6, 0, 0.5);
  },
  ice: (a: AudioContext, t: number) => {
    [1300, 1700, 2200].forEach((pitch, i) => beep(a, t, 'triangle', pitch, pitch * 1.02, 0.25, i * 0.06, 0.6));
  },
  hurt: (a: AudioContext, t: number) => beep(a, t, 'sawtooth', 240, 100, 0.3, 0, 0.7),
  out: (a: AudioContext, t: number) => beep(a, t, 'sawtooth', 420, 50, 0.9, 0, 0.8),
  comeback: (a: AudioContext, t: number) => {
    [400, 500, 650, 800].forEach((pitch, i) => beep(a, t, 'square', pitch, pitch, 0.1, i * 0.08, 0.4));
  },
  bonusLife: (a: AudioContext, t: number) => {
    beep(a, t, 'sine', 700, 700, 0.12, 0, 0.7);
    beep(a, t, 'sine', 1050, 1050, 0.2, 0.1, 0.7);
  },
  growl: (a: AudioContext, t: number) => {
    beep(a, t, 'sawtooth', 95, 60, 0.45, 0, 0.7);
    hiss(a, t, 0.4, 'lowpass', 300, 0, 0.5);
  },
  gameOver: (a: AudioContext, t: number) => {
    [440, 350, 260, 160].forEach((pitch, i) => beep(a, t, 'triangle', pitch, pitch * 0.97, 0.35, i * 0.3, 0.8));
  },
  newGame: (a: AudioContext, t: number) => {
    [520, 660, 780, 1040].forEach((pitch, i) => beep(a, t, 'square', pitch, pitch, 0.12, i * 0.1, 0.35));
  },
};
