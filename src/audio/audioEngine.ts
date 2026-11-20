/**
 * Local browser-only Web Audio API playback and analysis engine.
 *
 * - Reuses one AudioContext (latencyHint: 'interactive') and one AnalyserNode.
 * - Uses HTMLAudioElement + MediaElementAudioSourceNode connected to destination.
 * - Reuses Uint8Array FFT and waveform buffers with zero per-frame allocations.
 * - Revokes replaced object URLs and cleans up listeners properly.
 * - Designed with an extensible AudioSourceAdapter interface for future sources.
 */

import {
  analyzeAudioFrame,
  createAudioAnalysisScratch,
  createAudioFeatures,
  validateAudioFile,
  type AudioFeatures,
} from './audioAnalysis';

export interface AudioTrackMeta {
  name: string;
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  isMuted: boolean;
  volume: number;
  error: string | null;
}

export interface AudioSourceAdapter {
  readonly id: string;
  dispose(): void;
}

type TrackListener = (meta: AudioTrackMeta) => void;

const FFT_SIZE = 1024;

export class LocalAudioEngine implements AudioSourceAdapter {
  public readonly id = 'local-file';

  private audioEl: HTMLAudioElement | null = null;
  private audioCtx: AudioContext | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private objectUrl: string | null = null;

  private readonly freqData: Uint8Array<ArrayBuffer>;
  private readonly timeData: Uint8Array<ArrayBuffer>;
  private readonly scratch = createAudioAnalysisScratch();
  private readonly features: AudioFeatures = createAudioFeatures();

  private listeners = new Set<TrackListener>();
  private meta: AudioTrackMeta = {
    name: '',
    duration: 0,
    currentTime: 0,
    isPlaying: false,
    isMuted: false,
    volume: 0.85,
    error: null,
  };

  private boundOnPlay: () => void;
  private boundOnPause: () => void;
  private boundOnEnded: () => void;
  private boundOnLoadedMetadata: () => void;
  private boundOnTimeUpdate: () => void;
  private boundOnError: () => void;

  constructor() {
    this.freqData = new Uint8Array(new ArrayBuffer(FFT_SIZE / 2));
    this.timeData = new Uint8Array(new ArrayBuffer(FFT_SIZE));

    this.boundOnPlay = () => this.updateMeta({ isPlaying: true, error: null });
    this.boundOnPause = () => this.updateMeta({ isPlaying: false });
    this.boundOnEnded = () => this.updateMeta({ isPlaying: false });
    this.boundOnLoadedMetadata = () => {
      if (this.audioEl && Number.isFinite(this.audioEl.duration)) {
        this.updateMeta({ duration: this.audioEl.duration });
      }
    };
    this.boundOnTimeUpdate = () => {
      if (this.audioEl) {
        this.updateMeta({ currentTime: this.audioEl.currentTime });
      }
    };
    this.boundOnError = () => {
      this.updateMeta({
        isPlaying: false,
        error: 'Unable to decode this audio file. Try an MP3, WAV, or OGG track.',
      });
    };
  }

  public subscribe(listener: TrackListener): () => void {
    this.listeners.add(listener);
    listener({ ...this.meta });
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getMeta(): AudioTrackMeta {
    return { ...this.meta };
  }

  public getFeatures(): AudioFeatures {
    return this.features;
  }

  private emit(): void {
    const snapshot = { ...this.meta };
    this.listeners.forEach((fn) => fn(snapshot));
  }

  private updateMeta(patch: Partial<AudioTrackMeta>): void {
    this.meta = { ...this.meta, ...patch };
    this.emit();
  }

  private ensureAudioElement(): HTMLAudioElement {
    if (this.audioEl) return this.audioEl;

    const el = new Audio();
    el.preload = 'metadata';
    el.crossOrigin = 'anonymous';
    el.loop = true;
    el.volume = this.meta.volume;
    el.muted = this.meta.isMuted;

    el.addEventListener('play', this.boundOnPlay);
    el.addEventListener('pause', this.boundOnPause);
    el.addEventListener('ended', this.boundOnEnded);
    el.addEventListener('loadedmetadata', this.boundOnLoadedMetadata);
    el.addEventListener('timeupdate', this.boundOnTimeUpdate);
    el.addEventListener('error', this.boundOnError);

    this.audioEl = el;
    return el;
  }

  /**
   * Initializes or resumes the reusable Web Audio graph.
   * Must be invoked inside a user gesture handler before playback.
   */
  private async ensureAudioGraph(): Promise<void> {
    const el = this.ensureAudioElement();

    if (!this.audioCtx) {
      const AudioCtxCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtxCtor) {
        throw new Error('Web Audio API is not supported in this browser.');
      }
      this.audioCtx = new AudioCtxCtor({ latencyHint: 'interactive' });
    }

    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }

    if (!this.analyser) {
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = FFT_SIZE;
      // Balanced smoothing: responsive without jitter
      this.analyser.smoothingTimeConstant = 0.72;
      this.analyser.minDecibels = -88;
      this.analyser.maxDecibels = -18;
    }

    if (!this.sourceNode) {
      this.sourceNode = this.audioCtx.createMediaElementSource(el);
      this.sourceNode.connect(this.analyser);
      this.analyser.connect(this.audioCtx.destination);
    }
  }

  /**
   * Validates and loads a local audio file into the HTMLAudioElement.
   * Does not auto-play unless `autoPlayAfterLoad` is explicitly true (within user gesture).
   */
  public async loadLocalFile(file: File, autoPlayAfterLoad = false): Promise<boolean> {
    const validation = validateAudioFile(file);
    if (!validation.valid) {
      this.updateMeta({ error: validation.reason ?? 'Invalid audio file.' });
      return false;
    }

    const el = this.ensureAudioElement();

    // Pause current playback cleanly before replacing track
    if (!el.paused) {
      el.pause();
    }

    // Revoke previous object URL to prevent memory leaks
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }

    const nextUrl = URL.createObjectURL(file);
    this.objectUrl = nextUrl;
    el.src = nextUrl;
    el.load();

    const cleanName = file.name.replace(/\.[^/.]+$/, '');
    this.updateMeta({
      name: cleanName,
      duration: 0,
      currentTime: 0,
      isPlaying: false,
      error: null,
    });

    if (autoPlayAfterLoad) {
      return this.play();
    }
    return true;
  }

  public hasTrack(): boolean {
    return Boolean(this.objectUrl && this.meta.name);
  }

  public async play(): Promise<boolean> {
    if (!this.hasTrack()) return false;
    try {
      await this.ensureAudioGraph();
      const el = this.ensureAudioElement();
      await el.play();
      return true;
    } catch (err) {
      const msg =
        err instanceof Error && err.name === 'NotAllowedError'
          ? 'Click Play to begin audio playback.'
          : 'Unable to play this audio file.';
      this.updateMeta({ isPlaying: false, error: msg });
      return false;
    }
  }

  public pause(): void {
    if (this.audioEl && !this.audioEl.paused) {
      this.audioEl.pause();
    }
  }

  public async togglePlay(): Promise<void> {
    if (this.meta.isPlaying) {
      this.pause();
    } else {
      await this.play();
    }
  }

  public setVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    if (this.audioEl) {
      this.audioEl.volume = clamped;
      if (clamped > 0 && this.audioEl.muted) {
        this.audioEl.muted = false;
      }
    }
    this.updateMeta({
      volume: clamped,
      isMuted: clamped === 0 ? true : this.meta.isMuted && clamped === 0,
    });
  }

  public toggleMute(): void {
    const nextMuted = !this.meta.isMuted;
    if (this.audioEl) {
      this.audioEl.muted = nextMuted;
    }
    this.updateMeta({ isMuted: nextMuted });
  }

  public seek(seconds: number): void {
    if (!this.audioEl || !Number.isFinite(this.audioEl.duration) || this.audioEl.duration <= 0) {
      return;
    }
    const clamped = Math.max(0, Math.min(this.audioEl.duration, seconds));
    this.audioEl.currentTime = clamped;
    this.updateMeta({ currentTime: clamped });
  }

  public clearError(): void {
    if (this.meta.error) {
      this.updateMeta({ error: null });
    }
  }

  /**
   * Called once per animation frame inside R3F's useFrame.
   * Zero allocations: fills reusable typed arrays and updates `this.features` in-place.
   */
  public sampleFrame(dt: number): AudioFeatures {
    const playing = Boolean(this.audioEl && !this.audioEl.paused && !this.audioEl.ended && this.analyser);

    if (playing && this.analyser && this.audioCtx) {
      this.analyser.getByteFrequencyData(this.freqData);
      this.analyser.getByteTimeDomainData(this.timeData);
      return analyzeAudioFrame(
        this.freqData,
        this.timeData,
        this.audioCtx.sampleRate,
        FFT_SIZE,
        dt,
        true,
        this.scratch,
        this.features
      );
    }

    return analyzeAudioFrame(
      this.freqData,
      this.timeData,
      48000,
      FFT_SIZE,
      dt,
      false,
      this.scratch,
      this.features
    );
  }

  public dispose(): void {
    if (this.audioEl) {
      this.audioEl.pause();
      this.audioEl.removeEventListener('play', this.boundOnPlay);
      this.audioEl.removeEventListener('pause', this.boundOnPause);
      this.audioEl.removeEventListener('ended', this.boundOnEnded);
      this.audioEl.removeEventListener('loadedmetadata', this.boundOnLoadedMetadata);
      this.audioEl.removeEventListener('timeupdate', this.boundOnTimeUpdate);
      this.audioEl.removeEventListener('error', this.boundOnError);
      this.audioEl.removeAttribute('src');
      this.audioEl.load();
      this.audioEl = null;
    }

    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }

    try {
      this.sourceNode?.disconnect();
      this.analyser?.disconnect();
    } catch {
      // Ignore already disconnected nodes
    }
    this.sourceNode = null;
    this.analyser = null;

    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      void this.audioCtx.close();
    }
    this.audioCtx = null;
    this.listeners.clear();
  }
}
