/**
 * Pure, zero-allocation real-time audio feature extraction and file validation.
 * Designed to run inside the render loop without creating temporary objects or arrays.
 */

export interface AudioFeatures {
  /** Low-frequency energy (20–250 Hz), normalized 0..1 */
  bass: number;
  /** Mid-frequency energy (250–2500 Hz), normalized 0..1 */
  mid: number;
  /** High-frequency energy (2500–12000 Hz), normalized 0..1 */
  high: number;
  /** Overall perceptual loudness / intensity, normalized 0..1 */
  intensity: number;
  /** Time-domain waveform amplitude (RMS), normalized 0..1 */
  waveformAmplitude: number;
  /** Musical onset / transient pulse, decaying smoothly 0..1 */
  transient: number;
  /** True when audio is actively playing and producing signal */
  active: boolean;
}

export interface AudioAnalysisScratch {
  prevBass: number;
  prevMid: number;
  prevEnergy: number;
  energyAvg: number;
  transientCooldown: number;
}

export function createAudioFeatures(): AudioFeatures {
  return {
    bass: 0,
    mid: 0,
    high: 0,
    intensity: 0,
    waveformAmplitude: 0,
    transient: 0,
    active: false,
  };
}

export function createAudioAnalysisScratch(): AudioAnalysisScratch {
  return {
    prevBass: 0,
    prevMid: 0,
    prevEnergy: 0,
    energyAvg: 0.08,
    transientCooldown: 0,
  };
}

const SUPPORTED_AUDIO_EXTENSIONS = new Set([
  'mp3',
  'wav',
  'ogg',
  'oga',
  'm4a',
  'aac',
  'flac',
  'webm',
  'opus',
]);

const SUPPORTED_MIME_PREFIXES = ['audio/'];
const SUPPORTED_EXACT_MIMES = new Set(['application/ogg', 'video/ogg', 'video/webm']);

export interface FileValidationResult {
  valid: boolean;
  reason?: string;
}

export function validateAudioFile(file: { name: string; type: string; size: number } | null): FileValidationResult {
  if (!file) {
    return { valid: false, reason: 'No audio file was selected.' };
  }
  if (file.size <= 0) {
    return { valid: false, reason: 'The selected file is empty.' };
  }
  // Guard against absurdly large files (> 250 MB)
  if (file.size > 250 * 1024 * 1024) {
    return { valid: false, reason: 'Audio file exceeds the 250 MB local playback limit.' };
  }

  const extMatch = file.name.toLowerCase().match(/\.([a-z0-9]+)$/);
  const ext = extMatch ? extMatch[1] : '';
  const mime = (file.type || '').toLowerCase().trim();

  const hasValidMime =
    SUPPORTED_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix)) ||
    SUPPORTED_EXACT_MIMES.has(mime);
  const hasValidExt = SUPPORTED_AUDIO_EXTENSIONS.has(ext);

  if (!hasValidMime && !hasValidExt) {
    return {
      valid: false,
      reason: 'Unsupported format. Please select an MP3, WAV, OGG, M4A, FLAC, or AAC audio file.',
    };
  }

  return { valid: true };
}

/**
 * Computes average normalized energy (0..1) across a frequency range [minHz, maxHz]
 * given Uint8Array FFT magnitude bins (0..255).
 */
export function computeBandEnergy(
  freqData: Uint8Array,
  sampleRate: number,
  fftSize: number,
  minHz: number,
  maxHz: number
): number {
  const binCount = freqData.length;
  if (binCount === 0 || sampleRate <= 0 || fftSize <= 0) return 0;

  const hzPerBin = sampleRate / fftSize;
  const startBin = Math.max(0, Math.min(binCount - 1, Math.floor(minHz / hzPerBin)));
  const endBin = Math.max(startBin, Math.min(binCount - 1, Math.ceil(maxHz / hzPerBin)));

  let sum = 0;
  let count = 0;
  for (let i = startBin; i <= endBin; i++) {
    sum += freqData[i];
    count++;
  }
  if (count === 0) return 0;
  return sum / (count * 255);
}

/**
 * Computes normalized time-domain RMS waveform amplitude (0..1) from Uint8Array PCM (centered at 128).
 */
export function computeWaveformAmplitude(timeData: Uint8Array): number {
  const len = timeData.length;
  if (len === 0) return 0;
  let sumSq = 0;
  for (let i = 0; i < len; i++) {
    const centered = (timeData[i] - 128) / 128;
    sumSq += centered * centered;
  }
  const rms = Math.sqrt(sumSq / len);
  // Scale modestly so musical signals sit comfortably in 0..1
  return Math.min(1, rms * 2.2);
}

function expSmooth(current: number, target: number, rate: number, dt: number): number {
  const alpha = 1 - Math.exp(-rate * dt);
  return current + (target - current) * alpha;
}

/**
 * Updates `out` AudioFeatures in-place with zero allocations.
 * Uses frame-rate independent exponential smoothing and a gentle spectral-flux onset detector.
 */
export function analyzeAudioFrame(
  freqData: Uint8Array,
  timeData: Uint8Array,
  sampleRate: number,
  fftSize: number,
  dt: number,
  isPlaying: boolean,
  scratch: AudioAnalysisScratch,
  out: AudioFeatures
): AudioFeatures {
  const safeDt = Math.max(0.001, Math.min(dt, 0.1));

  if (!isPlaying) {
    out.bass = expSmooth(out.bass, 0, 5.0, safeDt);
    out.mid = expSmooth(out.mid, 0, 5.0, safeDt);
    out.high = expSmooth(out.high, 0, 5.5, safeDt);
    out.intensity = expSmooth(out.intensity, 0, 4.5, safeDt);
    out.waveformAmplitude = expSmooth(out.waveformAmplitude, 0, 6.0, safeDt);
    out.transient = Math.max(0, out.transient * Math.exp(-6.5 * safeDt));
    out.active = false;
    scratch.transientCooldown = Math.max(0, scratch.transientCooldown - safeDt);
    return out;
  }

  const rawBass = computeBandEnergy(freqData, sampleRate, fftSize, 24, 240);
  const rawMid = computeBandEnergy(freqData, sampleRate, fftSize, 240, 2400);
  const rawHigh = computeBandEnergy(freqData, sampleRate, fftSize, 2400, 11500);
  const rawWave = computeWaveformAmplitude(timeData);

  // Perceptually weighted overall intensity
  const rawIntensity = Math.min(1, rawBass * 0.42 + rawMid * 0.40 + rawHigh * 0.18);

  // Asymmetric smoothing: responsive attack, silky organic release
  const bassRate = rawBass > out.bass ? 16 : 6.5;
  const midRate = rawMid > out.mid ? 14 : 5.5;
  const highRate = rawHigh > out.high ? 18 : 7.5;
  const intensityRate = rawIntensity > out.intensity ? 12 : 4.5;

  out.bass = expSmooth(out.bass, rawBass, bassRate, safeDt);
  out.mid = expSmooth(out.mid, rawMid, midRate, safeDt);
  out.high = expSmooth(out.high, rawHigh, highRate, safeDt);
  out.intensity = expSmooth(out.intensity, rawIntensity, intensityRate, safeDt);
  out.waveformAmplitude = expSmooth(out.waveformAmplitude, rawWave, 15, safeDt);

  // Lightweight spectral-flux onset detector for occasional refined accents
  const bassFlux = Math.max(0, rawBass - scratch.prevBass);
  const midFlux = Math.max(0, rawMid - scratch.prevMid);
  const combinedFlux = bassFlux * 0.65 + midFlux * 0.35;

  scratch.energyAvg = expSmooth(scratch.energyAvg, Math.max(0.05, rawIntensity), 1.4, safeDt);
  scratch.transientCooldown = Math.max(0, scratch.transientCooldown - safeDt);

  // Decay existing transient smoothly
  out.transient = Math.max(0, out.transient * Math.exp(-5.2 * safeDt));

  const onsetThreshold = Math.max(0.09, scratch.energyAvg * 0.34);
  if (combinedFlux > onsetThreshold && scratch.transientCooldown <= 0) {
    const strength = Math.min(1, (combinedFlux - onsetThreshold) * 3.8 + 0.35);
    out.transient = Math.max(out.transient, strength);
    // Prevent rapid-fire strobing; transients are occasional refined accents
    scratch.transientCooldown = 0.28;
  }

  scratch.prevBass = rawBass;
  scratch.prevMid = rawMid;
  scratch.prevEnergy = rawIntensity;

  out.active = rawIntensity > 0.005 || rawWave > 0.005;
  return out;
}
