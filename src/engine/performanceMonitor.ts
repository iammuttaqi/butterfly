/**
 * Real-time frame-budget performance monitor and hysteresis-based adaptive quality controller.
 * Target: 60 FPS (~16.67 ms per frame).
 */

export type QualityTier = 'high' | 'balanced' | 'performance';

export interface QualityPreset {
  tier: QualityTier;
  label: string;
  maxDpr: number;
  particleCount: number;
  bokehCount: number;
  enableHaloGlow: boolean;
  shaderDetail: number; // 1.0 = full, 0.65 = balanced, 0.35 = performance
  enableExtraAccentLight: boolean;
}

export const QUALITY_PRESETS: Record<QualityTier, QualityPreset> = {
  high: {
    tier: 'high',
    label: 'High',
    maxDpr: 2.0,
    particleCount: 220,
    bokehCount: 34,
    enableHaloGlow: true,
    shaderDetail: 1.0,
    enableExtraAccentLight: true,
  },
  balanced: {
    tier: 'balanced',
    label: 'Balanced',
    maxDpr: 1.5,
    particleCount: 130,
    bokehCount: 20,
    enableHaloGlow: true,
    shaderDetail: 0.65,
    enableExtraAccentLight: true,
  },
  performance: {
    tier: 'performance',
    label: 'Performance',
    maxDpr: 1.0,
    particleCount: 70,
    bokehCount: 10,
    enableHaloGlow: false,
    shaderDetail: 0.35,
    enableExtraAccentLight: false,
  },
};

export interface PerformanceSnapshot {
  fps: number;
  frameTimeMs: number;
  avgFrameTimeMs: number;
  stabilityPercent: number;
  qualityTier: QualityTier;
  audioActive: boolean;
  adaptiveEnabled: boolean;
}

export class AdaptivePerformanceMonitor {
  private readonly windowSize: number;
  private readonly samples: Float32Array;
  private sampleIndex = 0;
  private sampleCount = 0;
  private currentFrameMs = 16.67;
  private tier: QualityTier;
  private adaptiveEnabled: boolean;
  private degradeElapsedSec = 0;
  private recoverElapsedSec = 0;
  private readonly isSoftwareGl: boolean;

  constructor(options?: {
    initialTier?: QualityTier;
    windowSize?: number;
    adaptiveEnabled?: boolean;
    isSoftwareGl?: boolean;
  }) {
    this.windowSize = options?.windowSize ?? 60;
    this.samples = new Float32Array(this.windowSize);
    this.tier = options?.initialTier ?? 'high';
    this.adaptiveEnabled = options?.adaptiveEnabled ?? true;
    this.isSoftwareGl = options?.isSoftwareGl ?? false;
  }

  public getQualityTier(): QualityTier {
    return this.tier;
  }

  public setManualQualityTier(tier: QualityTier): void {
    this.tier = tier;
    this.adaptiveEnabled = false;
    this.degradeElapsedSec = 0;
    this.recoverElapsedSec = 0;
  }

  public enableAdaptiveQuality(enabled: boolean): void {
    this.adaptiveEnabled = enabled;
    this.degradeElapsedSec = 0;
    this.recoverElapsedSec = 0;
  }

  /**
   * Records one rendered frame duration in milliseconds and evaluates
   * whether quality tier should adapt based on sustained performance evidence.
   * Returns true if quality tier changed.
   */
  public recordFrame(frameMs: number): boolean {
    // Ignore huge pause outliers (e.g. tab backgrounded)
    if (!Number.isFinite(frameMs) || frameMs <= 0 || frameMs > 250) {
      return false;
    }

    this.currentFrameMs = frameMs;
    this.samples[this.sampleIndex] = frameMs;
    this.sampleIndex = (this.sampleIndex + 1) % this.windowSize;
    if (this.sampleCount < this.windowSize) {
      this.sampleCount++;
    }

    // Do not downgrade quality automatically on paced software WebGL or when disabled
    if (!this.adaptiveEnabled || this.isSoftwareGl || this.sampleCount < 30) {
      return false;
    }

    const avgMs = this.computeAverageFrameMs();
    const dtSec = frameMs / 1000;

    // Hysteresis thresholds: only step down after 3.0s sustained > 21.5ms (< ~46 FPS)
    if (avgMs > 21.5) {
      this.degradeElapsedSec += dtSec;
      this.recoverElapsedSec = 0;
      if (this.degradeElapsedSec >= 3.0) {
        this.degradeElapsedSec = 0;
        if (this.tier === 'high') {
          this.tier = 'balanced';
          this.resetSamples();
          return true;
        }
        if (this.tier === 'balanced') {
          this.tier = 'performance';
          this.resetSamples();
          return true;
        }
      }
    } else if (avgMs < 14.5) {
      // Only step back up after 6.0s of strong headroom (< 14.5ms)
      this.recoverElapsedSec += dtSec;
      this.degradeElapsedSec = 0;
      if (this.recoverElapsedSec >= 6.0) {
        this.recoverElapsedSec = 0;
        if (this.tier === 'performance') {
          this.tier = 'balanced';
          this.resetSamples();
          return true;
        }
        if (this.tier === 'balanced') {
          this.tier = 'high';
          this.resetSamples();
          return true;
        }
      }
    } else {
      // In healthy band: slowly decay both accumulators
      this.degradeElapsedSec = Math.max(0, this.degradeElapsedSec - dtSec * 0.5);
      this.recoverElapsedSec = Math.max(0, this.recoverElapsedSec - dtSec * 0.5);
    }

    return false;
  }

  private resetSamples(): void {
    this.sampleIndex = 0;
    this.sampleCount = 0;
  }

  private computeAverageFrameMs(): number {
    if (this.sampleCount === 0) return 16.67;
    let sum = 0;
    for (let i = 0; i < this.sampleCount; i++) {
      sum += this.samples[i];
    }
    return sum / this.sampleCount;
  }

  public getSnapshot(audioActive: boolean): PerformanceSnapshot {
    const avgMs = this.computeAverageFrameMs();
    const fps = avgMs > 0 ? Math.min(240, 1000 / avgMs) : 60;

    // Stability: 100% minus normalized standard deviation of frame times
    let varianceSum = 0;
    for (let i = 0; i < this.sampleCount; i++) {
      const diff = this.samples[i] - avgMs;
      varianceSum += diff * diff;
    }
    const stdDev = this.sampleCount > 1 ? Math.sqrt(varianceSum / this.sampleCount) : 0;
    const stabilityPercent = Math.max(0, Math.min(100, 100 - (stdDev / Math.max(8, avgMs)) * 100));

    return {
      fps: Math.round(fps),
      frameTimeMs: Number(this.currentFrameMs.toFixed(1)),
      avgFrameTimeMs: Number(avgMs.toFixed(1)),
      stabilityPercent: Math.round(stabilityPercent),
      qualityTier: this.tier,
      audioActive,
      adaptiveEnabled: this.adaptiveEnabled,
    };
  }
}
