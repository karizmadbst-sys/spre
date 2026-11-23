import { preloadAudioAsset } from './audioPreload';

export const FEMALE_FEAR_SCREAM_URL = '/assets/aistudio/1795113025845_20261119_183259_dda4ed84.mp3';
export const MALE_FEAR_SCREAM_URL = '/assets/aistudio/1795113054247_20261119_183222_15cf3533.mp3';
export const SNAKE_SWALLOW_SQUELCH_URL = '/assets/aistudio/1795115267470_20261119_190943_59ac0ac1.mp3';
export const SNAKE_FINAL_GULP_URL = '/assets/aistudio/1795115324815_20261119_190920_0f666a65.mp3';

export type ScreamCharacterVariant = 'male' | 'female';
export type SnakeEatAudioVariant = 'swallow' | 'finalGulp';

const SCREAM_CONFIG: Record<
  ScreamCharacterVariant,
  {
    url: string;
    leadTrimSec: number;
    maxDurationSec: number;
    localPeakGain: number;
    remotePeakGain: number;
  }
> = {
  female: {
    url: FEMALE_FEAR_SCREAM_URL,
    leadTrimSec: 0,
    maxDurationSec: 2.25,
    localPeakGain: 1.72,
    remotePeakGain: 1.54,
  },
  male: {
    url: MALE_FEAR_SCREAM_URL,
    leadTrimSec: 0.09,
    maxDurationSec: 2.28,
    localPeakGain: 1.12,
    remotePeakGain: 1.0,
  },
};

const SNAKE_EAT_CONFIG: Record<
  SnakeEatAudioVariant,
  {
    url: string;
    leadTrimSec: number;
    maxDurationSec: number;
    localPeakGain: number;
    remotePeakGain: number;
  }
> = {
  swallow: {
    url: SNAKE_SWALLOW_SQUELCH_URL,
    leadTrimSec: 0.25,
    maxDurationSec: 1.72,
    localPeakGain: 1.38,
    remotePeakGain: 1.2,
  },
  finalGulp: {
    url: SNAKE_FINAL_GULP_URL,
    leadTrimSec: 0.22,
    maxDurationSec: 0.74,
    localPeakGain: 1.95,
    remotePeakGain: 1.68,
  },
};

interface ActiveScreamInstance {
  attackKey: string;
  source: AudioBufferSourceNode;
  panner: PannerNode;
  filter: BiquadFilterNode;
  gain: GainNode;
  endTime: number;
  lastUnderwater: boolean;
  stopped: boolean;
}

interface ActivePositionalNode {
  attackKey: string;
  nodes: AudioScheduledSourceNode[];
  panner: PannerNode;
  filter: BiquadFilterNode;
  gain: GainNode;
  endTime: number;
  lastUnderwater: boolean;
  stopped: boolean;
}

export interface SnakeSwimAudioParams {
  worldX: number;
  worldY: number;
  worldZ: number;
  waterY: number;
  speed: number;
  swimPhase: number;
  distToListener: number;
  isChasing: boolean;
  isEating: boolean;
  isSwimming: boolean;
  listenerUnderwater: boolean;
  scale?: number;
}

interface ActiveSnakeSwimRig {
  monsterId: string;
  panner: PannerNode;
  envFilter: BiquadFilterNode;
  masterGain: GainNode;
  hissSource: AudioBufferSourceNode;
  hissHighpass: BiquadFilterNode;
  hissBandpass: BiquadFilterNode;
  hissLfo: OscillatorNode;
  hissLfoDepth: GainNode;
  hissModGain: GainNode;
  hissGain: GainNode;
  creatureOsc1: OscillatorNode;
  creatureOsc2: OscillatorNode;
  creatureFilter: BiquadFilterNode;
  creatureGain: GainNode;
  wakeSource: AudioBufferSourceNode;
  wakeFilter: BiquadFilterNode;
  wakeGain: GainNode;
  splashFilter: BiquadFilterNode;
  splashGain: GainNode;
  lastStrokeIdx: number;
  lastSplashTime: number;
  lastParamUpdateTime: number;
  lastPosX: number;
  lastPosY: number;
  lastPosZ: number;
  lastActive: boolean;
  lastChasing: boolean;
  disposed: boolean;
}

const MAX_POOLED_SNAKE_SWIM_RIGS = 8;
const _staleSwimIds: string[] = [];

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  private droneOsc1: OscillatorNode | null = null;
  private droneOsc2: OscillatorNode | null = null;
  private tensionOsc: OscillatorNode | null = null;
  private tensionGain: GainNode | null = null;
  private waterFilter: BiquadFilterNode | null = null;
  private waterGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private screamArrayBufferPromises: Partial<Record<ScreamCharacterVariant, Promise<ArrayBuffer | null>>> = {};
  private screamBuffers: Partial<Record<ScreamCharacterVariant, AudioBuffer>> = {};
  private screamDecodePromises: Partial<Record<ScreamCharacterVariant, Promise<AudioBuffer | null>>> = {};
  private activeScreams = new Map<string, ActiveScreamInstance>();
  private recentScreamKeys = new Map<string, number>();

  private snakeEatArrayBufferPromises: Partial<Record<SnakeEatAudioVariant, Promise<ArrayBuffer | null>>> = {};
  private snakeEatBuffers: Partial<Record<SnakeEatAudioVariant, AudioBuffer>> = {};
  private snakeEatDecodePromises: Partial<Record<SnakeEatAudioVariant, Promise<AudioBuffer | null>>> = {};
  private activeSnakeEatAudio = new Map<string, ActivePositionalNode[]>();
  private recentSnakeEatKeys = new Map<string, number>();
  private activeSnakeSwims = new Map<string, ActiveSnakeSwimRig>();
  private idleSnakeSwimPool: ActiveSnakeSwimRig[] = [];

  private masterVol = 0.8;
  private musicVol = 0.7;
  private sfxVol = 0.85;
  private muted = false;
  private started = false;
  private disposed = false;
  private hrtfWarmed = false;

  private lastGrowlTime = 0;
  private nextDripTime = 2.5;
  private nextGroanTime = 7.0;
  private panningModel: PanningModelType = 'equalpower';
  private lastAtmoUpdateTime = -1;
  private lastAtmoActive = false;
  private lastListenerPosX = NaN;
  private lastListenerPosY = NaN;
  private lastListenerPosZ = NaN;
  private lastListenerFwdX = NaN;
  private lastListenerFwdY = NaN;
  private lastListenerFwdZ = NaN;
  private lastListenerUpX = NaN;
  private lastListenerUpY = NaN;
  private lastListenerUpZ = NaN;

  constructor() {
    const isTouch =
      typeof window !== 'undefined' &&
      ('ontouchstart' in window ||
        (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) ||
        Boolean(window.matchMedia?.('(pointer: coarse)')?.matches));
    const cores = typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency ?? 4) : 4;
    // Use lightweight equalpower panning on mobile/low-core devices to prevent HRTF FIR convolution stalls
    this.panningModel = !isTouch && cores > 4 ? 'HRTF' : 'equalpower';
    this.preloadCharacterScreams();
    this.preloadSnakeEatingAudio();
  }

  public preloadCharacterScreams(): void {
    for (const variant of ['female', 'male'] as const) {
      if (!this.screamArrayBufferPromises[variant]) {
        this.screamArrayBufferPromises[variant] = preloadAudioAsset(SCREAM_CONFIG[variant].url);
      }
    }
  }

  public preloadSnakeEatingAudio(): void {
    for (const variant of ['swallow', 'finalGulp'] as const) {
      if (!this.snakeEatArrayBufferPromises[variant]) {
        this.snakeEatArrayBufferPromises[variant] = preloadAudioAsset(SNAKE_EAT_CONFIG[variant].url);
      }
    }
  }

  private ensureScreamBuffer(variant: ScreamCharacterVariant): Promise<AudioBuffer | null> {
    const cached = this.screamBuffers[variant];
    if (cached) {
      return Promise.resolve(cached);
    }
    const existingDecode = this.screamDecodePromises[variant];
    if (existingDecode) {
      return existingDecode;
    }
    if (!this.ctx) {
      return Promise.resolve(null);
    }
    this.preloadCharacterScreams();
    const ctx = this.ctx;
    const decodePromise = (this.screamArrayBufferPromises[variant] ?? Promise.resolve(null))
      .then((ab) => {
        if (!ab || this.ctx !== ctx) return null;
        return ctx.decodeAudioData(ab.slice(0));
      })
      .then((decoded) => {
        if (decoded && this.ctx === ctx) {
          this.screamBuffers[variant] = decoded;
        }
        return decoded;
      })
      .catch(() => null);
    this.screamDecodePromises[variant] = decodePromise;
    return decodePromise;
  }

  private ensureSnakeEatBuffer(variant: SnakeEatAudioVariant): Promise<AudioBuffer | null> {
    const cached = this.snakeEatBuffers[variant];
    if (cached) {
      return Promise.resolve(cached);
    }
    const existingDecode = this.snakeEatDecodePromises[variant];
    if (existingDecode) {
      return existingDecode;
    }
    if (!this.ctx) {
      return Promise.resolve(null);
    }
    this.preloadSnakeEatingAudio();
    const ctx = this.ctx;
    const decodePromise = (this.snakeEatArrayBufferPromises[variant] ?? Promise.resolve(null))
      .then((ab) => {
        if (!ab || this.ctx !== ctx) return null;
        return ctx.decodeAudioData(ab.slice(0));
      })
      .then((decoded) => {
        if (decoded && this.ctx === ctx) {
          this.snakeEatBuffers[variant] = decoded;
        }
        return decoded;
      })
      .catch(() => null);
    this.snakeEatDecodePromises[variant] = decodePromise;
    return decodePromise;
  }

  public async prewarmAsync(): Promise<void> {
    if (this.disposed) return;
    this.preloadCharacterScreams();
    this.preloadSnakeEatingAudio();
    if (this.ctx) {
      await Promise.all([
        this.ensureScreamBuffer('female'),
        this.ensureScreamBuffer('male'),
        this.ensureSnakeEatBuffer('swallow'),
        this.ensureSnakeEatBuffer('finalGulp'),
      ]);
      return;
    }
    await Promise.all([
      this.screamArrayBufferPromises.female ?? Promise.resolve(null),
      this.screamArrayBufferPromises.male ?? Promise.resolve(null),
      this.snakeEatArrayBufferPromises.swallow ?? Promise.resolve(null),
      this.snakeEatArrayBufferPromises.finalGulp ?? Promise.resolve(null),
    ]);
  }

  private warmupHrtfKernel(): void {
    if (!this.ctx || this.panningModel !== 'HRTF' || this.hrtfWarmed) return;
    const ctx = this.ctx;
    try {
      const warmPanner = ctx.createPanner();
      warmPanner.panningModel = 'HRTF';
      const silentGain = ctx.createGain();
      silentGain.gain.value = 0;
      const silentSrc = ctx.createBufferSource();
      silentSrc.buffer = ctx.createBuffer(1, Math.min(128, Math.max(32, Math.floor(ctx.sampleRate / 250))), ctx.sampleRate);
      silentSrc.connect(warmPanner);
      warmPanner.connect(silentGain);
      silentGain.connect(ctx.destination);
      silentSrc.onended = () => {
        try {
          silentSrc.disconnect();
          warmPanner.disconnect();
          silentGain.disconnect();
        } catch {
          // ignore disconnect errors
        }
      };
      const t = ctx.currentTime;
      silentSrc.start(t);
      silentSrc.stop(t + 0.015);
      this.hrtfWarmed = true;
    } catch {
      this.panningModel = 'equalpower';
      this.hrtfWarmed = true;
    }
  }

  public unlock(): void {
    if (this.disposed) return;
    if (
      this.ctx &&
      this.ctx.state === 'running' &&
      (this.panningModel !== 'HRTF' || this.hrtfWarmed) &&
      this.screamDecodePromises.female &&
      this.screamDecodePromises.male &&
      this.snakeEatDecodePromises.swallow &&
      this.snakeEatDecodePromises.finalGulp
    ) {
      return;
    }
    try {
      if (!this.ctx) {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;
        this.ctx = new AudioCtx();

        this.masterGain = this.ctx.createGain();
        this.musicGain = this.ctx.createGain();
        this.sfxGain = this.ctx.createGain();

        this.musicGain.connect(this.masterGain);
        this.sfxGain.connect(this.masterGain);
        this.masterGain.connect(this.ctx.destination);

        this.noiseBuffer = this.createNoiseBuffer(2.0);
        this.applyVolumes();
        this.startAmbience();
      }
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      if (this.panningModel === 'HRTF' && !this.hrtfWarmed) {
        this.warmupHrtfKernel();
      }
      this.prewarmMonsterSwimAudio(2);
      void this.ensureScreamBuffer('female');
      void this.ensureScreamBuffer('male');
      void this.ensureSnakeEatBuffer('swallow');
      void this.ensureSnakeEatBuffer('finalGulp');
    } catch {
      // AudioContext unavailable in headless or restricted contexts
    }
  }

  public setVolumes(master: number, music: number, sfx: number, muted: boolean): void {
    this.masterVol = master;
    this.musicVol = music;
    this.sfxVol = sfx;
    this.muted = muted;
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx || !this.masterGain || !this.musicGain || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    this.masterGain.gain.setTargetAtTime(this.muted ? 0 : this.masterVol, now, 0.05);
    this.musicGain.gain.setTargetAtTime(this.musicVol, now, 0.05);
    this.sfxGain.gain.setTargetAtTime(this.sfxVol, now, 0.05);
  }

  private createNoiseBuffer(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.04 * white) / 1.04; // soft brown/pinkish noise
      data[i] = last * 3.0;
    }
    return buffer;
  }

  private startAmbience(): void {
    if (!this.ctx || !this.musicGain || this.started) return;
    this.started = true;

    // Creepy indoor poolroom sub-drone
    const droneFilter = this.ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 180;

    const droneAmp = this.ctx.createGain();
    droneAmp.gain.value = 0.14;

    this.droneOsc1 = this.ctx.createOscillator();
    this.droneOsc1.type = 'sawtooth';
    this.droneOsc1.frequency.value = 46.2; // Low F#1

    this.droneOsc2 = this.ctx.createOscillator();
    this.droneOsc2.type = 'triangle';
    this.droneOsc2.frequency.value = 46.9; // Slight eerie beating

    this.droneOsc1.connect(droneFilter);
    this.droneOsc2.connect(droneFilter);
    droneFilter.connect(droneAmp);
    droneAmp.connect(this.musicGain);

    this.droneOsc1.start();
    this.droneOsc2.start();

    // Dynamic chase tension layer
    this.tensionGain = this.ctx.createGain();
    this.tensionGain.gain.value = 0;

    const tensionFilter = this.ctx.createBiquadFilter();
    tensionFilter.type = 'bandpass';
    tensionFilter.frequency.value = 340;
    tensionFilter.Q.value = 3.5;

    this.tensionOsc = this.ctx.createOscillator();
    this.tensionOsc.type = 'sawtooth';
    this.tensionOsc.frequency.value = 98;
    this.tensionOsc.connect(tensionFilter);
    tensionFilter.connect(this.tensionGain);
    this.tensionGain.connect(this.musicGain);
    this.tensionOsc.start();

    // Pool water lapping ambience loop
    if (this.noiseBuffer) {
      const noiseSrc = this.ctx.createBufferSource();
      noiseSrc.buffer = this.noiseBuffer;
      noiseSrc.loop = true;

      this.waterFilter = this.ctx.createBiquadFilter();
      this.waterFilter.type = 'bandpass';
      this.waterFilter.frequency.value = 420;
      this.waterFilter.Q.value = 1.1;

      this.waterGain = this.ctx.createGain();
      this.waterGain.gain.value = 0.08;

      noiseSrc.connect(this.waterFilter);
      this.waterFilter.connect(this.waterGain);
      this.waterGain.connect(this.musicGain);
      noiseSrc.start();
    }
  }

  public updateAtmosphere(
    nowSec: number,
    monsterDist: number,
    alertState: 'calm' | 'searching' | 'chasing',
    inWater: boolean,
    underwater: boolean,
    active: boolean
  ): void {
    if (!this.ctx || !this.tensionGain || !this.tensionOsc || !this.waterFilter || !this.waterGain) {
      return;
    }
    const t = this.ctx.currentTime;

    if (!active) {
      if (this.lastAtmoActive || this.lastAtmoUpdateTime < 0) {
        this.lastAtmoActive = false;
        this.lastAtmoUpdateTime = t;
        this.tensionGain.gain.cancelScheduledValues(t);
        this.tensionGain.gain.setTargetAtTime(0, t, 0.15);
        this.waterGain.gain.cancelScheduledValues(t);
        this.waterGain.gain.setTargetAtTime(0.05, t, 0.2);
      }
      return;
    }

    // Proximity dread curve (0 at >= 26m, 1 at <= 4m)
    const prox = Math.max(0, Math.min(1, 1 - (monsterDist - 4) / 22));
    const alertBoost = alertState === 'chasing' ? 0.35 : alertState === 'searching' ? 0.12 : 0;
    const targetTension = Math.min(0.28, (prox * 0.22 + alertBoost * 0.15));

    // Throttle AudioParam automation to ~20Hz and cancel prior targets so timelines stay O(1)
    if (!this.lastAtmoActive || t - this.lastAtmoUpdateTime >= 0.05) {
      this.lastAtmoActive = true;
      this.lastAtmoUpdateTime = t;
      this.tensionGain.gain.cancelScheduledValues(t);
      this.tensionGain.gain.setTargetAtTime(targetTension, t, 0.12);
      this.tensionOsc.frequency.cancelScheduledValues(t);
      this.tensionOsc.frequency.setTargetAtTime(
        alertState === 'chasing' ? 112 + Math.sin(nowSec * 9) * 6 : 92,
        t,
        0.1
      );

      // Water ambience muffled if underwater
      this.waterFilter.frequency.cancelScheduledValues(t);
      this.waterFilter.frequency.setTargetAtTime(underwater ? 180 : inWater ? 620 : 420, t, 0.12);
      this.waterGain.gain.cancelScheduledValues(t);
      this.waterGain.gain.setTargetAtTime(inWater ? 0.16 : 0.08, t, 0.12);
    }

    // Monster aquatic growl / breath periodically when nearby or chasing (only if 3D per-snake swim rigs aren't active)
    const growlCooldown = alertState === 'chasing' ? 2.8 : 6.0;
    if (this.activeSnakeSwims.size === 0 && prox > 0.2 && nowSec - this.lastGrowlTime > growlCooldown) {
      this.lastGrowlTime = nowSec;
      this.playMonsterGrowl(0.14 + prox * 0.25, alertState === 'chasing');
    }

    // Subtle echoing cavern water drips & distant structural groans
    if (!underwater && nowSec >= this.nextDripTime) {
      this.nextDripTime = nowSec + 3.6 + Math.random() * 5.2;
      this.playCavernDrip(0.05 + Math.random() * 0.04);
    }
    if (nowSec >= this.nextGroanTime) {
      this.nextGroanTime = nowSec + 11.5 + Math.random() * 11.0;
      this.playDistantGroan(0.06 + Math.random() * 0.04);
    }
  }

  private playCavernDrip(volume: number): void {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const baseFreq = 680 + Math.random() * 520;
    for (let echo = 0; echo < 2; echo++) {
      const start = t + echo * 0.22;
      const amp = volume * (echo === 0 ? 1 : 0.35);
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq, start);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.55, start + 0.055);
      g.gain.setValueAtTime(0.001, start);
      g.gain.linearRampToValueAtTime(amp, start + 0.008);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.14);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(start);
      osc.stop(start + 0.16);
    }
  }

  private playDistantGroan(volume: number): void {
    if (!this.ctx || !this.musicGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    const f0 = 38 + Math.random() * 14;
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.linearRampToValueAtTime(f0 * 0.72, t + 1.85);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(115, t);
    filter.Q.value = 3.2;
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(volume, t + 0.45);
    g.gain.exponentialRampToValueAtTime(0.001, t + 2.0);
    osc.connect(filter);
    filter.connect(g);
    g.connect(this.musicGain);
    osc.start(t);
    osc.stop(t + 2.05);
  }

  public playStep(sprinting: boolean): void {
    if (!this.ctx || !this.sfxGain || !this.noiseBuffer) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = (sprinting ? 1400 : 1050) + Math.random() * 260;
    filter.Q.value = 2.5;

    const g = this.ctx.createGain();
    const vol = sprinting ? 0.22 : 0.14;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain);
    src.start(t, Math.random() * 0.8, 0.09);
  }

  public playJump(): void {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(290, t + 0.13);
    g.gain.setValueAtTime(0.14, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.16);
  }

  public playPush(intensity = 1.0): void {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const amp = Math.max(0.15, Math.min(1.2, intensity));

    // Punchy low impact thud
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(185, t);
    osc.frequency.exponentialRampToValueAtTime(52, t + 0.16);
    g.gain.setValueAtTime(0.28 * amp, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.19);

    // Quick air shove whoosh
    if (this.noiseBuffer) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(680, t);
      bp.frequency.exponentialRampToValueAtTime(1450, t + 0.12);
      bp.Q.value = 1.4;
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(0.2 * amp, t);
      ng.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      src.connect(bp);
      bp.connect(ng);
      ng.connect(this.sfxGain);
      src.start(t, Math.random() * 0.4, 0.16);
    }
  }

  public playLand(inWater: boolean): void {
    if (inWater) {
      this.playSplash(0.45);
      return;
    }
    if (!this.ctx || !this.sfxGain || !this.noiseBuffer) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 520;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.28, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain);
    src.start(t, 0.1, 0.15);
  }

  public playSplash(intensity = 0.35): void {
    if (!this.ctx || !this.sfxGain || !this.noiseBuffer) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(950, t);
    filter.frequency.exponentialRampToValueAtTime(320, t + 0.35);
    filter.Q.value = 0.9;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(intensity, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.42);

    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain);
    src.start(t, Math.random() * 0.5, 0.45);
  }

  public playPlatformWarn(): void {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(110, t + 0.08);
    g.gain.setValueAtTime(0.15, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.11);
  }

  public playCheckpoint(): void {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const freqs = [440, 554.37, 659.25];
    freqs.forEach((f, idx) => {
      const osc = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.value = f;
      const start = t + idx * 0.07;
      g.gain.setValueAtTime(0.001, start);
      g.gain.linearRampToValueAtTime(0.14, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.45);
      osc.connect(g);
      g.connect(this.sfxGain!);
      osc.start(start);
      osc.stop(start + 0.48);
    });
  }

  public playVictory(): void {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const freqs = [392, 493.88, 587.33, 783.99];
    freqs.forEach((f, idx) => {
      const osc = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.value = f;
      const start = t + idx * 0.09;
      g.gain.setValueAtTime(0.001, start);
      g.gain.linearRampToValueAtTime(0.18, start + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.75);
      osc.connect(g);
      g.connect(this.sfxGain!);
      osc.start(start);
      osc.stop(start + 0.8);
    });
  }

  public playSerpentHiss(volume = 0.28, aggressive = false): void {
    if (!this.ctx || !this.sfxGain || !this.noiseBuffer) return;
    const t = this.ctx.currentTime;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(aggressive ? 3200 : 2100, t);
    bp.frequency.exponentialRampToValueAtTime(aggressive ? 1400 : 950, t + 0.65);
    bp.Q.value = aggressive ? 3.2 : 2.2;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(volume, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.68);

    src.connect(bp);
    bp.connect(g);
    g.connect(this.sfxGain);
    src.start(t, Math.random() * 0.6, 0.72);
  }

  public playSerpentEmerge(volume = 0.55): void {
    if (!this.ctx || !this.sfxGain) return;
    this.playSplash(volume * 0.95);
    this.playSerpentHiss(volume * 0.75, true);

    const t = this.ctx.currentTime;
    const sub = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    sub.type = 'sawtooth';
    sub.frequency.setValueAtTime(92, t);
    sub.frequency.exponentialRampToValueAtTime(36, t + 0.45);
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(volume * 0.6, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    sub.connect(g);
    g.connect(this.sfxGain);
    sub.start(t);
    sub.stop(t + 0.52);
  }

  public playMonsterGrowl(volume = 0.25, aggressive = false): void {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc2.type = 'square';
    const baseFreq = aggressive ? 86 : 52;
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.linearRampToValueAtTime(baseFreq * 0.68, t + 0.68);
    osc2.frequency.setValueAtTime(baseFreq * 1.09, t);
    osc2.frequency.linearRampToValueAtTime(baseFreq * 0.64, t + 0.68);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(aggressive ? 540 : 230, t);

    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(volume, t + 0.06);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.72);

    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc2.start(t);
    osc.stop(t + 0.74);
    osc2.stop(t + 0.74);

    if (aggressive) {
      this.playSerpentHiss(volume * 0.85, true);
    }
  }

  public playJumpscare(): void {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    // Piercing dissonant serpent shriek + hiss layers
    const shriekFreqs = [380, 540, 790, 1180];
    shriekFreqs.forEach((f) => {
      const osc = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f * 0.82, t);
      osc.frequency.exponentialRampToValueAtTime(f * 1.48, t + 0.12);
      osc.frequency.exponentialRampToValueAtTime(f * 0.55, t + 0.95);
      g.gain.setValueAtTime(0.24, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 1.05);
      osc.connect(g);
      g.connect(this.sfxGain!);
      osc.start(t);
      osc.stop(t + 1.1);
    });

    // Sharp fang-bite snap transient
    const snap = this.ctx.createOscillator();
    const snapG = this.ctx.createGain();
    snap.type = 'triangle';
    snap.frequency.setValueAtTime(1600, t);
    snap.frequency.exponentialRampToValueAtTime(140, t + 0.09);
    snapG.gain.setValueAtTime(0.55, t);
    snapG.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
    snap.connect(snapG);
    snapG.connect(this.sfxGain);
    snap.start(t);
    snap.stop(t + 0.12);

    // Sub-bass impact slam
    const sub = this.ctx.createOscillator();
    const subG = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(125, t);
    sub.frequency.exponentialRampToValueAtTime(26, t + 0.65);
    subG.gain.setValueAtTime(0.7, t);
    subG.gain.exponentialRampToValueAtTime(0.001, t + 0.85);
    sub.connect(subG);
    subG.connect(this.sfxGain);
    sub.start(t);
    sub.stop(t + 0.9);

    // Rushing water splash + serpent hiss noise burst
    if (this.noiseBuffer) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(2400, t);
      bp.frequency.exponentialRampToValueAtTime(420, t + 0.65);
      bp.Q.value = 0.9;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.55, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
      src.connect(bp);
      bp.connect(g);
      g.connect(this.sfxGain);
      src.start(t, 0, 0.85);
    }
  }

  public playEatingStrike(volume = 1.0): void {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const v = Math.max(0.15, Math.min(1.1, volume));

    // Heavy jaw clamp slam + bone-crunch snap
    const snap = this.ctx.createOscillator();
    const snapG = this.ctx.createGain();
    snap.type = 'triangle';
    snap.frequency.setValueAtTime(1280, t);
    snap.frequency.exponentialRampToValueAtTime(95, t + 0.14);
    snapG.gain.setValueAtTime(0.42 * v, t);
    snapG.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    snap.connect(snapG);
    snapG.connect(this.sfxGain);
    snap.start(t);
    snap.stop(t + 0.18);

    // Sub-bass water-erupting lunge thump
    const sub = this.ctx.createOscillator();
    const subG = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(108, t);
    sub.frequency.exponentialRampToValueAtTime(28, t + 0.55);
    subG.gain.setValueAtTime(0.55 * v, t);
    subG.gain.exponentialRampToValueAtTime(0.001, t + 0.65);
    sub.connect(subG);
    subG.connect(this.sfxGain);
    sub.start(t);
    sub.stop(t + 0.7);

    // Visceral serpent snarl + splash burst
    this.playMonsterGrowl(0.32 * v, true);
    this.playSplash(0.45 * v);
  }

  public playSwallowGulp(
    stage = 1,
    volume = 1.0,
    attackKey?: string,
    worldX?: number,
    worldY?: number,
    worldZ?: number,
    isLocalVictim = true
  ): void {
    if (!this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const v = Math.max(0.12, Math.min(1.0, volume));
    const pitchScale = stage >= 2 ? 0.76 : 0.96;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(stage >= 2 ? 410 : 480, t);
    filter.frequency.exponentialRampToValueAtTime(135, t + 0.38);
    filter.Q.value = 4.2;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime((stage >= 2 ? 0.42 : 0.36) * v, t + 0.045);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.44);

    // Deep resonant throat gulp envelope
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(135 * pitchScale, t);
    osc.frequency.exponentialRampToValueAtTime(52 * pitchScale, t + 0.24);
    osc.frequency.exponentialRampToValueAtTime(34 * pitchScale, t + 0.4);
    osc.connect(filter);
    filter.connect(g);

    const sources: AudioScheduledSourceNode[] = [osc];

    // Jaw snap / wet throat click
    if (this.noiseBuffer) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(620 * pitchScale, t);
      bp.frequency.exponentialRampToValueAtTime(210, t + 0.22);
      bp.Q.value = 2.0;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.24 * v, t);
      ng.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
      src.connect(bp);
      bp.connect(ng);
      ng.connect(g);
      src.start(t, Math.random() * 0.4, 0.28);
      sources.push(src);
    }

    const usePositional =
      attackKey !== undefined &&
      worldX !== undefined &&
      worldY !== undefined &&
      worldZ !== undefined;

    if (usePositional) {
      const panner = this.createHrtfPanner(worldX, worldY, worldZ, isLocalVictim);
      g.connect(panner);
      panner.connect(this.sfxGain);
      const endTime = t + 0.46;
      const inst: ActivePositionalNode = {
        attackKey,
        nodes: sources,
        panner,
        filter,
        gain: g,
        endTime,
        lastUnderwater: false,
        stopped: false,
      };
      this.registerSnakeEatNode(attackKey, inst);
      osc.onended = () => {
        inst.stopped = true;
        this.unregisterSnakeEatNode(attackKey, inst);
        try {
          osc.disconnect();
          filter.disconnect();
          g.disconnect();
          panner.disconnect();
        } catch {
          // ignore disconnect errors
        }
      };
    } else {
      g.connect(this.sfxGain);
    }

    osc.start(t);
    osc.stop(t + 0.45);
  }

  public updateListener(
    posX: number,
    posY: number,
    posZ: number,
    fwdX: number,
    fwdY: number,
    fwdZ: number,
    upX: number,
    upY: number,
    upZ: number
  ): void {
    if (!this.ctx) return;
    if (
      Math.abs(posX - this.lastListenerPosX) < 0.004 &&
      Math.abs(posY - this.lastListenerPosY) < 0.004 &&
      Math.abs(posZ - this.lastListenerPosZ) < 0.004 &&
      Math.abs(fwdX - this.lastListenerFwdX) < 0.004 &&
      Math.abs(fwdY - this.lastListenerFwdY) < 0.004 &&
      Math.abs(fwdZ - this.lastListenerFwdZ) < 0.004 &&
      Math.abs(upX - this.lastListenerUpX) < 0.004 &&
      Math.abs(upY - this.lastListenerUpY) < 0.004 &&
      Math.abs(upZ - this.lastListenerUpZ) < 0.004
    ) {
      return;
    }
    this.lastListenerPosX = posX;
    this.lastListenerPosY = posY;
    this.lastListenerPosZ = posZ;
    this.lastListenerFwdX = fwdX;
    this.lastListenerFwdY = fwdY;
    this.lastListenerFwdZ = fwdZ;
    this.lastListenerUpX = upX;
    this.lastListenerUpY = upY;
    this.lastListenerUpZ = upZ;

    const listener = this.ctx.listener;
    if ('positionX' in listener && listener.positionX) {
      listener.positionX.value = posX;
      listener.positionY.value = posY;
      listener.positionZ.value = posZ;
      listener.forwardX.value = fwdX;
      listener.forwardY.value = fwdY;
      listener.forwardZ.value = fwdZ;
      listener.upX.value = upX;
      listener.upY.value = upY;
      listener.upZ.value = upZ;
    } else if (typeof (listener as AudioListener & { setPosition?: (...a: number[]) => void }).setPosition === 'function') {
      const legacy = listener as AudioListener & {
        setPosition: (x: number, y: number, z: number) => void;
        setOrientation: (fx: number, fy: number, fz: number, ux: number, uy: number, uz: number) => void;
      };
      legacy.setPosition(posX, posY, posZ);
      legacy.setOrientation(fwdX, fwdY, fwdZ, upX, upY, upZ);
    }
  }

  public playCharacterEatingScream(
    characterId: ScreamCharacterVariant,
    attackKey: string,
    worldX: number,
    worldY: number,
    worldZ: number,
    initialOffsetSec = 0,
    isLocalVictim = true
  ): void {
    if (!this.ctx || !this.sfxGain) return;
    const nowMs = performance.now();
    const prevMs = this.recentScreamKeys.get(attackKey);
    if (prevMs !== undefined && nowMs - prevMs < 2500) {
      return;
    }
    this.recentScreamKeys.set(attackKey, nowMs);
    for (const [key, ts] of this.recentScreamKeys.entries()) {
      if (nowMs - ts > 6000) this.recentScreamKeys.delete(key);
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }

    const cached = this.screamBuffers[characterId];
    if (cached) {
      this.startCharacterScreamNode(
        characterId,
        attackKey,
        cached,
        worldX,
        worldY,
        worldZ,
        initialOffsetSec,
        isLocalVictim
      );
      return;
    }

    const triggerMs = nowMs;
    void this.ensureScreamBuffer(characterId).then((buffer) => {
      if (!buffer || !this.ctx || !this.sfxGain) return;
      if (this.recentScreamKeys.get(attackKey) !== triggerMs) return;
      const elapsedSec = (performance.now() - triggerMs) / 1000;
      if (elapsedSec > 0.45) return;
      this.startCharacterScreamNode(
        characterId,
        attackKey,
        buffer,
        worldX,
        worldY,
        worldZ,
        initialOffsetSec + elapsedSec,
        isLocalVictim
      );
    });
  }

  public playFemaleEatingScream(
    attackKey: string,
    worldX: number,
    worldY: number,
    worldZ: number,
    initialOffsetSec = 0,
    isLocalVictim = true
  ): void {
    this.playCharacterEatingScream('female', attackKey, worldX, worldY, worldZ, initialOffsetSec, isLocalVictim);
  }

  public playMaleEatingScream(
    attackKey: string,
    worldX: number,
    worldY: number,
    worldZ: number,
    initialOffsetSec = 0,
    isLocalVictim = true
  ): void {
    this.playCharacterEatingScream('male', attackKey, worldX, worldY, worldZ, initialOffsetSec, isLocalVictim);
  }

  private startCharacterScreamNode(
    characterId: ScreamCharacterVariant,
    attackKey: string,
    buffer: AudioBuffer,
    worldX: number,
    worldY: number,
    worldZ: number,
    initialOffsetSec: number,
    isLocalVictim: boolean
  ): void {
    if (!this.ctx || !this.sfxGain) return;
    const existing = this.activeScreams.get(attackKey);
    if (existing && !existing.stopped) {
      return;
    }

    const cfg = SCREAM_CONFIG[characterId];
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const offset = Math.max(0, Math.min(buffer.duration - 0.15, cfg.leadTrimSec + initialOffsetSec));
    const availableAfterOffset = Math.max(0.15, buffer.duration - offset);
    const remainingTarget = Math.max(0.15, cfg.maxDurationSec - initialOffsetSec);
    const playDuration = Math.min(availableAfterOffset, remainingTarget);

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(18000, t);
    filter.Q.value = 0.7;

    const panner = ctx.createPanner();
    try {
      panner.panningModel = this.panningModel;
    } catch {
      panner.panningModel = 'equalpower';
    }
    panner.distanceModel = 'inverse';
    panner.refDistance = isLocalVictim ? 3.8 : 4.2;
    panner.maxDistance = 55;
    panner.rolloffFactor = isLocalVictim ? 0.85 : 1.35;
    this.setPannerPosition(panner, worldX, worldY, worldZ);

    const gain = ctx.createGain();
    const peakGain = isLocalVictim ? cfg.localPeakGain : cfg.remotePeakGain;
    const fadeInEnd = t + Math.min(0.025, playDuration * 0.2);
    const swallowFadeStart = Math.max(fadeInEnd + 0.05, t + playDuration - 0.85);
    const swallowMid = swallowFadeStart + (t + playDuration - swallowFadeStart) * 0.55;
    const endTime = t + playDuration;

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(peakGain, fadeInEnd);
    gain.gain.setValueAtTime(peakGain, swallowFadeStart);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.04, peakGain * 0.28), swallowMid);
    gain.gain.exponentialRampToValueAtTime(0.0001, endTime);

    // Subtle throat-muffle rolloff as the victim is pulled inside the serpent's jaws
    filter.frequency.setValueAtTime(18000, swallowFadeStart);
    filter.frequency.exponentialRampToValueAtTime(2800, endTime);

    source.connect(filter);
    filter.connect(panner);
    panner.connect(gain);
    gain.connect(this.sfxGain);

    const instance: ActiveScreamInstance = {
      attackKey,
      source,
      panner,
      filter,
      gain,
      endTime,
      lastUnderwater: false,
      stopped: false,
    };
    this.activeScreams.set(attackKey, instance);

    source.onended = () => {
      instance.stopped = true;
      if (this.activeScreams.get(attackKey) === instance) {
        this.activeScreams.delete(attackKey);
      }
      try {
        source.disconnect();
        filter.disconnect();
        panner.disconnect();
        gain.disconnect();
      } catch {
        // ignore disconnect errors
      }
    };

    source.start(t, offset, playDuration + 0.02);
  }

  private createHrtfPanner(worldX: number, worldY: number, worldZ: number, isLocalVictim: boolean): PannerNode {
    const ctx = this.ctx!;
    const panner = ctx.createPanner();
    try {
      panner.panningModel = this.panningModel;
    } catch {
      panner.panningModel = 'equalpower';
    }
    panner.distanceModel = 'inverse';
    panner.refDistance = isLocalVictim ? 4.2 : 4.8;
    panner.maxDistance = 58;
    panner.rolloffFactor = isLocalVictim ? 0.78 : 1.25;
    this.setPannerPosition(panner, worldX, worldY, worldZ);
    return panner;
  }

  private setPannerPosition(panner: PannerNode, worldX: number, worldY: number, worldZ: number): void {
    if ('positionX' in panner && panner.positionX) {
      panner.positionX.value = worldX;
      panner.positionY.value = worldY;
      panner.positionZ.value = worldZ;
    } else if (typeof (panner as PannerNode & { setPosition?: (x: number, y: number, z: number) => void }).setPosition === 'function') {
      (panner as PannerNode & { setPosition: (x: number, y: number, z: number) => void }).setPosition(
        worldX,
        worldY,
        worldZ
      );
    }
  }

  private registerSnakeEatNode(attackKey: string, inst: ActivePositionalNode): void {
    const list = this.activeSnakeEatAudio.get(attackKey);
    if (list) {
      list.push(inst);
    } else {
      this.activeSnakeEatAudio.set(attackKey, [inst]);
    }
  }

  private unregisterSnakeEatNode(attackKey: string, inst: ActivePositionalNode): void {
    const list = this.activeSnakeEatAudio.get(attackKey);
    if (!list) return;
    const idx = list.indexOf(inst);
    if (idx !== -1) {
      list.splice(idx, 1);
    }
    if (list.length === 0) {
      this.activeSnakeEatAudio.delete(attackKey);
    }
  }

  public playSnakeSwallowingAudio(
    attackKey: string,
    worldX: number,
    worldY: number,
    worldZ: number,
    remainingSwallowSec: number,
    initialOffsetSec = 0,
    isLocalVictim = true
  ): void {
    this.playSnakeEatClip(
      'swallow',
      attackKey,
      worldX,
      worldY,
      worldZ,
      remainingSwallowSec,
      initialOffsetSec,
      isLocalVictim
    );
  }

  public playSnakeFinalGulpAudio(
    attackKey: string,
    worldX: number,
    worldY: number,
    worldZ: number,
    remainingSwallowSec: number,
    initialOffsetSec = 0,
    isLocalVictim = true
  ): void {
    this.playSnakeEatClip(
      'finalGulp',
      attackKey,
      worldX,
      worldY,
      worldZ,
      remainingSwallowSec,
      initialOffsetSec,
      isLocalVictim
    );
  }

  private playSnakeEatClip(
    variant: SnakeEatAudioVariant,
    attackKey: string,
    worldX: number,
    worldY: number,
    worldZ: number,
    remainingSwallowSec: number,
    initialOffsetSec = 0,
    isLocalVictim = true
  ): void {
    if (!this.ctx || !this.sfxGain) return;
    const dedupKey = `${attackKey}:${variant}`;
    const nowMs = performance.now();
    const prevMs = this.recentSnakeEatKeys.get(dedupKey);
    if (prevMs !== undefined && nowMs - prevMs < 4000) {
      return;
    }
    this.recentSnakeEatKeys.set(dedupKey, nowMs);
    for (const [k, ts] of this.recentSnakeEatKeys.entries()) {
      if (nowMs - ts > 8000) this.recentSnakeEatKeys.delete(k);
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }

    const cached = this.snakeEatBuffers[variant];
    if (cached) {
      this.startSnakeEatClipNode(
        variant,
        attackKey,
        cached,
        worldX,
        worldY,
        worldZ,
        remainingSwallowSec,
        initialOffsetSec,
        isLocalVictim
      );
      return;
    }

    const triggerMs = nowMs;
    void this.ensureSnakeEatBuffer(variant).then((buffer) => {
      if (!buffer || !this.ctx || !this.sfxGain) return;
      if (this.recentSnakeEatKeys.get(dedupKey) !== triggerMs) return;
      const elapsedSec = (performance.now() - triggerMs) / 1000;
      const rem = remainingSwallowSec - elapsedSec;
      if (rem <= 0.14 || elapsedSec > 0.55) return;
      this.startSnakeEatClipNode(
        variant,
        attackKey,
        buffer,
        worldX,
        worldY,
        worldZ,
        rem,
        initialOffsetSec + elapsedSec,
        isLocalVictim
      );
    });
  }

  private startSnakeEatClipNode(
    variant: SnakeEatAudioVariant,
    attackKey: string,
    buffer: AudioBuffer,
    worldX: number,
    worldY: number,
    worldZ: number,
    remainingSwallowSec: number,
    initialOffsetSec: number,
    isLocalVictim: boolean
  ): void {
    if (!this.ctx || !this.sfxGain) return;
    const cfg = SNAKE_EAT_CONFIG[variant];
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const offset = Math.max(0, Math.min(buffer.duration - 0.14, cfg.leadTrimSec + Math.max(0, initialOffsetSec)));
    const availableAfterOffset = Math.max(0.12, buffer.duration - offset);
    const maxVariantWindow = Math.max(0.12, cfg.maxDurationSec - Math.max(0, initialOffsetSec));
    const swallowCap = Math.max(0.12, remainingSwallowSec);
    const playDuration = Math.min(availableAfterOffset, maxVariantWindow, swallowCap);

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(16000, t);
    filter.Q.value = 0.7;

    const panner = this.createHrtfPanner(worldX, worldY, worldZ, isLocalVictim);

    const gain = ctx.createGain();
    const peakGain = isLocalVictim ? cfg.localPeakGain : cfg.remotePeakGain;
    const fadeInDur = variant === 'swallow' ? Math.min(0.1, playDuration * 0.25) : Math.min(0.03, playDuration * 0.15);
    const fadeOutDur = variant === 'swallow' ? Math.min(0.24, playDuration * 0.35) : Math.min(0.18, playDuration * 0.4);
    const fadeInEnd = t + fadeInDur;
    const fadeOutStart = Math.max(fadeInEnd + 0.02, t + playDuration - fadeOutDur);
    const endTime = t + playDuration;

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(peakGain, fadeInEnd);
    gain.gain.setValueAtTime(peakGain, fadeOutStart);
    gain.gain.exponentialRampToValueAtTime(0.0001, endTime);

    source.connect(filter);
    filter.connect(panner);
    panner.connect(gain);
    gain.connect(this.sfxGain);

    const inst: ActivePositionalNode = {
      attackKey,
      nodes: [source],
      panner,
      filter,
      gain,
      endTime,
      lastUnderwater: false,
      stopped: false,
    };
    this.registerSnakeEatNode(attackKey, inst);

    source.onended = () => {
      inst.stopped = true;
      this.unregisterSnakeEatNode(attackKey, inst);
      try {
        source.disconnect();
        filter.disconnect();
        panner.disconnect();
        gain.disconnect();
      } catch {
        // ignore disconnect errors
      }
    };

    source.start(t, offset, playDuration + 0.02);
  }

  public updateSnakeEatingAudioPosition(
    attackKey: string,
    worldX: number,
    worldY: number,
    worldZ: number,
    underwater: boolean
  ): void {
    if (!this.ctx) return;
    const list = this.activeSnakeEatAudio.get(attackKey);
    if (!list || list.length === 0) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < list.length; i++) {
      const inst = list[i];
      if (inst.stopped) continue;
      this.setPannerPosition(inst.panner, worldX, worldY, worldZ);
      if (inst.lastUnderwater !== underwater && t < inst.endTime - 0.06) {
        inst.lastUnderwater = underwater;
        inst.filter.frequency.cancelScheduledValues(t);
        inst.filter.frequency.setTargetAtTime(underwater ? 1100 : 16000, t, 0.04);
      }
    }
  }

  public stopAttackEatingAudio(attackKey: string, fadeSec = 0.08): void {
    if (!this.ctx) {
      this.activeScreams.delete(attackKey);
      this.activeSnakeEatAudio.delete(attackKey);
      return;
    }
    const t = this.ctx.currentTime;
    const screamInst = this.activeScreams.get(attackKey);
    if (screamInst && !screamInst.stopped) {
      screamInst.stopped = true;
      try {
        screamInst.gain.gain.cancelScheduledValues(t);
        screamInst.gain.gain.setValueAtTime(Math.max(0.0001, screamInst.gain.gain.value), t);
        screamInst.gain.gain.exponentialRampToValueAtTime(0.0001, t + fadeSec);
        screamInst.source.stop(t + fadeSec + 0.02);
      } catch {
        // ignore stop errors
      }
    }
    this.activeScreams.delete(attackKey);

    const snakeList = this.activeSnakeEatAudio.get(attackKey);
    if (snakeList) {
      for (const inst of snakeList) {
        if (inst.stopped) continue;
        inst.stopped = true;
        try {
          inst.gain.gain.cancelScheduledValues(t);
          inst.gain.gain.setValueAtTime(Math.max(0.0001, inst.gain.gain.value), t);
          inst.gain.gain.exponentialRampToValueAtTime(0.0001, t + fadeSec);
          for (const node of inst.nodes) {
            node.stop(t + fadeSec + 0.02);
          }
        } catch {
          // ignore stop errors
        }
      }
      this.activeSnakeEatAudio.delete(attackKey);
    }
  }

  public updateEatingScreamPosition(
    attackKey: string,
    worldX: number,
    worldY: number,
    worldZ: number,
    underwater: boolean
  ): void {
    if (!this.ctx) return;
    const inst = this.activeScreams.get(attackKey);
    if (!inst || inst.stopped) return;
    this.setPannerPosition(inst.panner, worldX, worldY, worldZ);
    if (underwater && !inst.lastUnderwater) {
      const t = this.ctx.currentTime;
      if (t < inst.endTime - 0.1) {
        inst.lastUnderwater = true;
        inst.filter.frequency.setTargetAtTime(1150, t, 0.04);
      }
    }
  }

  public updateFemaleScreamPosition(
    attackKey: string,
    worldX: number,
    worldY: number,
    worldZ: number,
    underwater: boolean
  ): void {
    this.updateEatingScreamPosition(attackKey, worldX, worldY, worldZ, underwater);
  }

  public stopEatingScreams(fadeSec = 0.12): void {
    this.recentScreamKeys.clear();
    this.recentSnakeEatKeys.clear();
    if (!this.ctx) {
      this.activeScreams.clear();
      this.activeSnakeEatAudio.clear();
      return;
    }
    const t = this.ctx.currentTime;
    for (const inst of this.activeScreams.values()) {
      if (inst.stopped) continue;
      inst.stopped = true;
      try {
        inst.gain.gain.cancelScheduledValues(t);
        inst.gain.gain.setValueAtTime(Math.max(0.0001, inst.gain.gain.value), t);
        inst.gain.gain.exponentialRampToValueAtTime(0.0001, t + fadeSec);
        inst.source.stop(t + fadeSec + 0.02);
      } catch {
        // ignore stop errors
      }
    }
    this.activeScreams.clear();

    for (const list of this.activeSnakeEatAudio.values()) {
      for (const inst of list) {
        if (inst.stopped) continue;
        inst.stopped = true;
        try {
          inst.gain.gain.cancelScheduledValues(t);
          inst.gain.gain.setValueAtTime(Math.max(0.0001, inst.gain.gain.value), t);
          inst.gain.gain.exponentialRampToValueAtTime(0.0001, t + fadeSec);
          for (const node of inst.nodes) {
            node.stop(t + fadeSec + 0.02);
          }
        } catch {
          // ignore stop errors
        }
      }
    }
    this.activeSnakeEatAudio.clear();
  }

  private createSnakeSwimRig(
    monsterId: string,
    worldX: number,
    worldY: number,
    worldZ: number
  ): ActiveSnakeSwimRig | null {
    if (!this.ctx || !this.sfxGain || !this.noiseBuffer || this.disposed) {
      return null;
    }

    const ctx = this.ctx;
    const t = ctx.currentTime;
    const panner = this.createHrtfPanner(worldX, worldY, worldZ, false);
    panner.refDistance = 4.6;
    panner.maxDistance = 54;
    panner.rolloffFactor = 1.05;

    const envFilter = ctx.createBiquadFilter();
    envFilter.type = 'lowpass';
    envFilter.frequency.setValueAtTime(16000, t);
    envFilter.Q.value = 0.7;

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0, t);

    envFilter.connect(panner);
    panner.connect(masterGain);
    masterGain.connect(this.sfxGain);

    // 1. Continuous modulated snake hissing layer (audible while swimming on/across water surface)
    const hissSource = ctx.createBufferSource();
    hissSource.buffer = this.noiseBuffer;
    hissSource.loop = true;

    const hissHighpass = ctx.createBiquadFilter();
    hissHighpass.type = 'highpass';
    hissHighpass.frequency.setValueAtTime(1450, t);
    hissHighpass.Q.value = 0.8;

    const hissBandpass = ctx.createBiquadFilter();
    hissBandpass.type = 'bandpass';
    hissBandpass.frequency.setValueAtTime(2250, t);
    hissBandpass.Q.value = 2.1;

    const hissModGain = ctx.createGain();
    hissModGain.gain.setValueAtTime(0.76, t);

    const hissLfo = ctx.createOscillator();
    hissLfo.type = 'sine';
    hissLfo.frequency.setValueAtTime(2.2, t);

    const hissLfoDepth = ctx.createGain();
    hissLfoDepth.gain.setValueAtTime(0.24, t);
    hissLfo.connect(hissLfoDepth);
    hissLfoDepth.connect(hissModGain.gain);

    const hissGain = ctx.createGain();
    hissGain.gain.setValueAtTime(0, t);

    hissSource.connect(hissHighpass);
    hissHighpass.connect(hissBandpass);
    hissBandpass.connect(hissModGain);
    hissModGain.connect(hissGain);
    hissGain.connect(envFilter);

    // 2. Underwater creature vocal & deep aquatic resonance layer
    const creatureOsc1 = ctx.createOscillator();
    creatureOsc1.type = 'sawtooth';
    creatureOsc1.frequency.setValueAtTime(52, t);

    const creatureOsc2 = ctx.createOscillator();
    creatureOsc2.type = 'triangle';
    creatureOsc2.frequency.setValueAtTime(55.4, t);

    const creatureFilter = ctx.createBiquadFilter();
    creatureFilter.type = 'lowpass';
    creatureFilter.frequency.setValueAtTime(200, t);
    creatureFilter.Q.value = 3.0;

    const creatureGain = ctx.createGain();
    creatureGain.gain.setValueAtTime(0, t);

    creatureOsc1.connect(creatureFilter);
    creatureOsc2.connect(creatureFilter);
    creatureFilter.connect(creatureGain);
    creatureGain.connect(envFilter);

    // 3. Continuous swimming-stroke water movement & wake gliding layer
    const wakeSource = ctx.createBufferSource();
    wakeSource.buffer = this.noiseBuffer;
    wakeSource.loop = true;

    const wakeFilter = ctx.createBiquadFilter();
    wakeFilter.type = 'bandpass';
    wakeFilter.frequency.setValueAtTime(560, t);
    wakeFilter.Q.value = 0.95;

    const wakeGain = ctx.createGain();
    wakeGain.gain.setValueAtTime(0, t);

    wakeSource.connect(wakeFilter);
    wakeFilter.connect(wakeGain);
    wakeGain.connect(envFilter);

    // 4. Reusable stroke-splash filter + gain stage (zero per-splash BiquadFilter/Gain allocations)
    const splashFilter = ctx.createBiquadFilter();
    splashFilter.type = 'bandpass';
    splashFilter.frequency.setValueAtTime(880, t);
    splashFilter.Q.value = 1.05;

    const splashGain = ctx.createGain();
    splashGain.gain.setValueAtTime(0, t);

    splashFilter.connect(splashGain);
    splashGain.connect(envFilter);

    const randOffset1 = Math.random() * Math.max(0.1, this.noiseBuffer.duration - 0.1);
    const randOffset2 = (randOffset1 + 0.73) % Math.max(0.1, this.noiseBuffer.duration - 0.1);
    hissSource.start(t, randOffset1);
    wakeSource.start(t, randOffset2);
    hissLfo.start(t);
    creatureOsc1.start(t);
    creatureOsc2.start(t);

    return {
      monsterId,
      panner,
      envFilter,
      masterGain,
      hissSource,
      hissHighpass,
      hissBandpass,
      hissLfo,
      hissLfoDepth,
      hissModGain,
      hissGain,
      creatureOsc1,
      creatureOsc2,
      creatureFilter,
      creatureGain,
      wakeSource,
      wakeFilter,
      wakeGain,
      splashFilter,
      splashGain,
      lastStrokeIdx: -1,
      lastSplashTime: t,
      lastParamUpdateTime: -1,
      lastPosX: worldX,
      lastPosY: worldY,
      lastPosZ: worldZ,
      lastActive: false,
      lastChasing: false,
      disposed: false,
    };
  }

  public prewarmMonsterSwimAudio(count: number): void {
    if (!this.ctx || !this.sfxGain || !this.noiseBuffer || this.disposed) return;
    const targetTotal = Math.min(MAX_POOLED_SNAKE_SWIM_RIGS, Math.max(0, Math.floor(count)));
    while (this.activeSnakeSwims.size + this.idleSnakeSwimPool.length < targetTotal) {
      const rig = this.createSnakeSwimRig('__pooled__', 0, 0, 0);
      if (!rig) break;
      rig.lastPosX = NaN;
      rig.lastPosY = NaN;
      rig.lastPosZ = NaN;
      this.idleSnakeSwimPool.push(rig);
    }
  }

  private ensureSnakeSwimRig(
    monsterId: string,
    worldX: number,
    worldY: number,
    worldZ: number
  ): ActiveSnakeSwimRig | null {
    const existing = this.activeSnakeSwims.get(monsterId);
    if (existing && !existing.disposed) {
      return existing;
    }
    if (!this.ctx || !this.sfxGain || !this.noiseBuffer || this.disposed) {
      return null;
    }

    const pooled = this.idleSnakeSwimPool.pop();
    if (pooled && !pooled.disposed) {
      const t = this.ctx.currentTime;
      pooled.monsterId = monsterId;
      pooled.lastStrokeIdx = -1;
      pooled.lastSplashTime = t;
      pooled.lastParamUpdateTime = -1;
      pooled.lastActive = false;
      pooled.lastChasing = false;
      pooled.lastPosX = worldX;
      pooled.lastPosY = worldY;
      pooled.lastPosZ = worldZ;
      this.setPannerPosition(pooled.panner, worldX, worldY, worldZ);
      pooled.masterGain.gain.cancelScheduledValues(t);
      pooled.masterGain.gain.setValueAtTime(0.0001, t);
      pooled.splashGain.gain.cancelScheduledValues(t);
      pooled.splashGain.gain.setValueAtTime(0, t);
      this.activeSnakeSwims.set(monsterId, pooled);
      return pooled;
    }

    const rig = this.createSnakeSwimRig(monsterId, worldX, worldY, worldZ);
    if (!rig) return null;
    this.activeSnakeSwims.set(monsterId, rig);
    return rig;
  }

  private triggerPositionalSwimSplash(rig: ActiveSnakeSwimRig, intensity: number): void {
    if (!this.ctx || !this.noiseBuffer || rig.disposed) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    rig.splashFilter.frequency.cancelScheduledValues(t);
    rig.splashFilter.frequency.setValueAtTime(880, t);
    rig.splashFilter.frequency.exponentialRampToValueAtTime(300, t + 0.24);

    const amp = Math.max(0.02, Math.min(0.24, intensity));
    rig.splashGain.gain.cancelScheduledValues(t);
    rig.splashGain.gain.setValueAtTime(0.0001, t);
    rig.splashGain.gain.linearRampToValueAtTime(amp, t + 0.02);
    rig.splashGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);

    src.connect(rig.splashFilter);
    src.onended = () => {
      try {
        src.disconnect();
      } catch {
        // ignore disconnect errors
      }
    };
    const maxOffset = Math.max(0.1, this.noiseBuffer.duration - 0.3);
    src.start(t, Math.random() * maxOffset, 0.28);
  }

  public updateSnakeSwimmingAudio(monsterId: string, params: SnakeSwimAudioParams): void {
    if (!this.ctx || !this.sfxGain) return;
    const scale = Math.max(0.5, params.scale ?? 1);
    const inWater = params.worldY <= params.waterY + 1.9 * scale;
    const isMoving = params.speed > 0.15;
    const farFade = Math.max(0, Math.min(1, 1 - Math.max(0, params.distToListener - 28) / 26));
    const active = params.isSwimming && !params.isEating && inWater && isMoving && farFade > 0.002;

    let rig = this.activeSnakeSwims.get(monsterId);
    if (!rig || rig.disposed) {
      if (!active) return;
      rig = this.ensureSnakeSwimRig(monsterId, params.worldX, params.worldY, params.worldZ) ?? undefined;
      if (!rig) return;
    }

    const t = this.ctx.currentTime;
    const dx = params.worldX - rig.lastPosX;
    const dy = params.worldY - rig.lastPosY;
    const dz = params.worldZ - rig.lastPosZ;
    if (!(dx * dx + dy * dy + dz * dz < 0.0004)) {
      rig.lastPosX = params.worldX;
      rig.lastPosY = params.worldY;
      rig.lastPosZ = params.worldZ;
      this.setPannerPosition(rig.panner, params.worldX, params.worldY, params.worldZ);
    }

    if (!active) {
      if (rig.lastActive || rig.lastParamUpdateTime < 0) {
        rig.lastActive = false;
        rig.lastChasing = false;
        rig.lastParamUpdateTime = t;
        rig.masterGain.gain.cancelScheduledValues(t);
        rig.masterGain.gain.setTargetAtTime(0, t, 0.08);
        rig.hissGain.gain.cancelScheduledValues(t);
        rig.hissGain.gain.setTargetAtTime(0, t, 0.08);
        rig.creatureGain.gain.cancelScheduledValues(t);
        rig.creatureGain.gain.setTargetAtTime(0, t, 0.08);
        rig.wakeGain.gain.cancelScheduledValues(t);
        rig.wakeGain.gain.setTargetAtTime(0, t, 0.08);
      }
      rig.lastStrokeIdx = -1;
      return;
    }

    const speedNorm = Math.min(1.6, Math.max(0, params.speed / (6.8 * scale)));
    const needParamUpdate =
      !rig.lastActive ||
      rig.lastChasing !== params.isChasing ||
      t - rig.lastParamUpdateTime >= 0.05;

    if (needParamUpdate) {
      rig.lastActive = true;
      rig.lastChasing = params.isChasing;
      rig.lastParamUpdateTime = t;

      const headRelY = params.worldY - params.waterY;
      const headAboveWater = headRelY >= -0.08 * scale;
      const headNearSurface = headRelY >= -0.75 * scale;
      const headDeepSubmerged = headRelY < -0.75 * scale;

      rig.envFilter.frequency.cancelScheduledValues(t);
      rig.envFilter.frequency.setTargetAtTime(
        params.listenerUnderwater || headDeepSubmerged ? 920 : 16000,
        t,
        0.06
      );
      rig.masterGain.gain.cancelScheduledValues(t);
      rig.masterGain.gain.setTargetAtTime(farFade, t, 0.08);

      // Keep hissing clearly audible across the water surface, attenuating smoothly only if deeply submerged
      const surfaceHissScale = headAboveWater ? 1.0 : headNearSurface ? 0.86 : 0.3;
      const strokeWave = 0.5 + 0.5 * Math.sin(params.swimPhase);
      const targetHiss =
        (0.24 + speedNorm * 0.14 + (params.isChasing ? 0.14 : 0)) * surfaceHissScale;
      rig.hissBandpass.frequency.cancelScheduledValues(t);
      rig.hissBandpass.frequency.setTargetAtTime(
        params.isChasing ? 2750 + strokeWave * 340 : 2050 + strokeWave * 360,
        t,
        0.08
      );
      rig.hissLfo.frequency.cancelScheduledValues(t);
      rig.hissLfo.frequency.setTargetAtTime(params.isChasing ? 3.3 : 2.15, t, 0.12);
      rig.hissGain.gain.cancelScheduledValues(t);
      rig.hissGain.gain.setTargetAtTime(targetHiss, t, 0.07);

      // Deep underwater creature vocalization & aquatic body rumble
      const creatureDepthBoost = headAboveWater ? 0.78 : 1.15;
      const targetCreature =
        (0.09 + speedNorm * 0.06 + (params.isChasing ? 0.08 : 0)) * creatureDepthBoost;
      rig.creatureOsc1.frequency.cancelScheduledValues(t);
      rig.creatureOsc1.frequency.setTargetAtTime(params.isChasing ? 64 + strokeWave * 9 : 48 + strokeWave * 5, t, 0.1);
      rig.creatureOsc2.frequency.cancelScheduledValues(t);
      rig.creatureOsc2.frequency.setTargetAtTime(params.isChasing ? 68.5 + strokeWave * 9 : 51.2 + strokeWave * 5, t, 0.1);
      rig.creatureFilter.frequency.cancelScheduledValues(t);
      rig.creatureFilter.frequency.setTargetAtTime(
        params.isChasing ? 290 + strokeWave * 75 : 185 + strokeWave * 55,
        t,
        0.09
      );
      rig.creatureGain.gain.cancelScheduledValues(t);
      rig.creatureGain.gain.setTargetAtTime(targetCreature, t, 0.08);

      // Subtle water movement & wake gliding synced with swimming wave
      const targetWake =
        (0.09 + speedNorm * 0.17 + (params.isChasing ? 0.08 : 0)) * (0.68 + strokeWave * 0.32);
      rig.wakeFilter.frequency.cancelScheduledValues(t);
      rig.wakeFilter.frequency.setTargetAtTime(460 + speedNorm * 300 + strokeWave * 280, t, 0.07);
      rig.wakeGain.gain.cancelScheduledValues(t);
      rig.wakeGain.gain.setTargetAtTime(targetWake, t, 0.07);
    }

    // Subtle stroke-synchronized splashing pulses
    const strokeIdx = Math.floor(params.swimPhase / Math.PI);
    const minSplashInterval = params.isChasing ? 0.16 : 0.32;
    if (
      rig.lastStrokeIdx !== -1 &&
      strokeIdx !== rig.lastStrokeIdx &&
      t - rig.lastSplashTime >= minSplashInterval &&
      params.distToListener < 42
    ) {
      rig.lastSplashTime = t;
      const splashAmp = (0.065 + Math.min(0.14, speedNorm * 0.085)) * farFade;
      this.triggerPositionalSwimSplash(rig, splashAmp);
    }
    rig.lastStrokeIdx = strokeIdx;
  }

  public pruneSnakeSwimmingAudio(activeMonsterIds: Set<string>, fadeSec = 0.1): void {
    if (this.activeSnakeSwims.size === 0) return;
    _staleSwimIds.length = 0;
    for (const id of this.activeSnakeSwims.keys()) {
      if (!activeMonsterIds.has(id)) {
        _staleSwimIds.push(id);
      }
    }
    for (let i = 0; i < _staleSwimIds.length; i++) {
      this.disposeSnakeSwimRig(_staleSwimIds[i], fadeSec);
    }
    _staleSwimIds.length = 0;
  }

  public stopSnakeSwimmingAudio(fadeSec = 0.12, monsterId?: string): void {
    if (monsterId !== undefined) {
      this.disposeSnakeSwimRig(monsterId, fadeSec);
      return;
    }
    if (this.activeSnakeSwims.size === 0) return;
    _staleSwimIds.length = 0;
    for (const id of this.activeSnakeSwims.keys()) {
      _staleSwimIds.push(id);
    }
    for (let i = 0; i < _staleSwimIds.length; i++) {
      this.disposeSnakeSwimRig(_staleSwimIds[i], fadeSec);
    }
    _staleSwimIds.length = 0;
  }

  private destroySwimRigNodes(rig: ActiveSnakeSwimRig, fadeSec: number): void {
    if (rig.disposed) return;
    rig.disposed = true;
    let disconnected = false;
    const disconnectNodes = () => {
      if (disconnected) return;
      disconnected = true;
      try {
        rig.hissSource.disconnect();
        rig.hissHighpass.disconnect();
        rig.hissBandpass.disconnect();
        rig.hissLfo.disconnect();
        rig.hissLfoDepth.disconnect();
        rig.hissModGain.disconnect();
        rig.hissGain.disconnect();
        rig.creatureOsc1.disconnect();
        rig.creatureOsc2.disconnect();
        rig.creatureFilter.disconnect();
        rig.creatureGain.disconnect();
        rig.wakeSource.disconnect();
        rig.wakeFilter.disconnect();
        rig.wakeGain.disconnect();
        rig.splashFilter.disconnect();
        rig.splashGain.disconnect();
        rig.envFilter.disconnect();
        rig.panner.disconnect();
        rig.masterGain.disconnect();
      } catch {
        // ignore disconnect errors
      }
    };
    const stopNodes = () => {
      try {
        rig.hissSource.stop();
        rig.hissLfo.stop();
        rig.creatureOsc1.stop();
        rig.creatureOsc2.stop();
        rig.wakeSource.stop();
      } catch {
        // ignore stop errors
      }
      disconnectNodes();
    };

    if (!this.ctx) {
      stopNodes();
      return;
    }
    const t = this.ctx.currentTime;
    const safeFade = Math.max(0.02, fadeSec);
    try {
      rig.hissSource.onended = disconnectNodes;
      rig.masterGain.gain.cancelScheduledValues(t);
      rig.masterGain.gain.setValueAtTime(Math.max(0.0001, rig.masterGain.gain.value), t);
      rig.masterGain.gain.exponentialRampToValueAtTime(0.0001, t + safeFade);
      rig.hissSource.stop(t + safeFade + 0.02);
      rig.hissLfo.stop(t + safeFade + 0.02);
      rig.creatureOsc1.stop(t + safeFade + 0.02);
      rig.creatureOsc2.stop(t + safeFade + 0.02);
      rig.wakeSource.stop(t + safeFade + 0.02);
      if (typeof window !== 'undefined') {
        window.setTimeout(disconnectNodes, Math.ceil((safeFade + 0.12) * 1000));
      }
    } catch {
      stopNodes();
    }
  }

  private disposeSnakeSwimRig(monsterId: string, fadeSec: number, destroyImmediately = false): void {
    const rig = this.activeSnakeSwims.get(monsterId);
    if (!rig) return;
    this.activeSnakeSwims.delete(monsterId);
    if (rig.disposed) return;

    if (!destroyImmediately && !this.disposed && this.ctx && this.idleSnakeSwimPool.length < MAX_POOLED_SNAKE_SWIM_RIGS) {
      const t = this.ctx.currentTime;
      const tc = Math.max(0.015, fadeSec * 0.35);
      rig.monsterId = '__pooled__';
      rig.lastActive = false;
      rig.lastChasing = false;
      rig.lastStrokeIdx = -1;
      rig.lastParamUpdateTime = -1;
      rig.lastPosX = NaN;
      rig.lastPosY = NaN;
      rig.lastPosZ = NaN;
      rig.masterGain.gain.cancelScheduledValues(t);
      rig.masterGain.gain.setTargetAtTime(0, t, tc);
      rig.hissGain.gain.cancelScheduledValues(t);
      rig.hissGain.gain.setTargetAtTime(0, t, tc);
      rig.creatureGain.gain.cancelScheduledValues(t);
      rig.creatureGain.gain.setTargetAtTime(0, t, tc);
      rig.wakeGain.gain.cancelScheduledValues(t);
      rig.wakeGain.gain.setTargetAtTime(0, t, tc);
      rig.splashGain.gain.cancelScheduledValues(t);
      rig.splashGain.gain.setTargetAtTime(0, t, tc);
      this.idleSnakeSwimPool.push(rig);
      return;
    }

    this.destroySwimRigNodes(rig, fadeSec);
  }

  public stopFemaleScreams(fadeSec = 0.12): void {
    this.stopEatingScreams(fadeSec);
  }

  public dispose(): void {
    this.disposed = true;
    try {
      this.stopEatingScreams(0.02);
      if (this.activeSnakeSwims.size > 0) {
        _staleSwimIds.length = 0;
        for (const id of this.activeSnakeSwims.keys()) {
          _staleSwimIds.push(id);
        }
        for (let i = 0; i < _staleSwimIds.length; i++) {
          this.disposeSnakeSwimRig(_staleSwimIds[i], 0.02, true);
        }
        _staleSwimIds.length = 0;
      }
      while (this.idleSnakeSwimPool.length > 0) {
        const pooled = this.idleSnakeSwimPool.pop();
        if (pooled) this.destroySwimRigNodes(pooled, 0.02);
      }
      this.droneOsc1?.stop();
      this.droneOsc2?.stop();
      this.tensionOsc?.stop();
      if (this.ctx && this.ctx.state !== 'closed') {
        void this.ctx.close();
      }
    } catch {
      // ignore
    }
    this.screamBuffers = {};
    this.screamDecodePromises = {};
    this.snakeEatBuffers = {};
    this.snakeEatDecodePromises = {};
    this.ctx = null;
  }
}
