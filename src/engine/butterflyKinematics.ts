/**
 * Pure, zero-allocation organic butterfly flight and wing articulation kinematics.
 *
 * Principle: Music gently modulates the butterfly's natural biological motion—never
 * hijacking it or producing mechanical visualizer snaps.
 */

import type { AudioFeatures } from '../audio/audioAnalysis';

export interface PointerInput {
  /** Normalized cursor X in [-1, 1] */
  x: number;
  /** Normalized cursor Y in [-1, 1] */
  y: number;
  /** 0..1 smooth presence indicator */
  active: number;
}

export interface ButterflyKinematicState {
  /** Accumulated wingbeat phase (radians) */
  wingPhase: number;
  /** Accumulated organic flight clock (seconds) */
  flightTime: number;
  /** Current glide modulation factor (0 = full flap, 1 = brief serene glide) */
  glideBlend: number;
  /** Left & right forewing flap angles (radians around longitudinal wing root) */
  leftForewingAngle: number;
  rightForewingAngle: number;
  /** Left & right hindwing flap angles (natural phase lag + softer arc) */
  leftHindwingAngle: number;
  rightHindwingAngle: number;
  /** Aeroelastic wingtip flex (-1..1) fed to wing vertex shader */
  forewingFlex: number;
  hindwingFlex: number;
  /** Subtle wing pitch twist (pronation/supination during downstroke vs upstroke) */
  wingTwist: number;
  /** Body 3D flight offset */
  posX: number;
  posY: number;
  posZ: number;
  /** Body Euler orientation (radians) */
  rotX: number;
  rotY: number;
  rotZ: number;
  /** Subtle antenna sway */
  antennaSway: number;
  /** Smoothly blended visual reactivity signals (0..1) */
  edgeGlow: number;
  colorShift: number;
  shimmer: number;
  pulseAccent: number;
  /** Internal smoothers */
  _prevForewingAngle: number;
  _prevHindwingAngle: number;
  _smoothFreq: number;
  _smoothAmp: number;
  _smoothPointerX: number;
  _smoothPointerY: number;
}

export function createButterflyKinematicState(): ButterflyKinematicState {
  return {
    wingPhase: 0.35,
    flightTime: 0,
    glideBlend: 0,
    leftForewingAngle: 0.2,
    rightForewingAngle: 0.2,
    leftHindwingAngle: 0.14,
    rightHindwingAngle: 0.14,
    forewingFlex: 0,
    hindwingFlex: 0,
    wingTwist: 0,
    posX: 0,
    posY: 0,
    posZ: 0,
    rotX: 0.24,
    rotY: -0.18,
    rotZ: 0,
    antennaSway: 0,
    edgeGlow: 0.22,
    colorShift: 0,
    shimmer: 0.15,
    pulseAccent: 0,
    _prevForewingAngle: 0.2,
    _prevHindwingAngle: 0.14,
    _smoothFreq: 1.55,
    _smoothAmp: 0.68,
    _smoothPointerX: 0,
    _smoothPointerY: 0,
  };
}

function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/**
 * Computes an asymmetric organic wingbeat wave:
 * Slightly brisker power downstroke, lingering buoyant upstroke.
 */
export function evaluateOrganicWingWave(phase: number): number {
  // Asymmetric harmonic blend mimicking real Morpho/Swallowtail stroke mechanics
  return Math.sin(phase) + 0.17 * Math.sin(2 * phase - 0.55) + 0.04 * Math.sin(3 * phase + 0.4);
}

/**
 * Advances butterfly kinematics in-place with zero heap allocations.
 */
export function stepButterflyKinematics(
  state: ButterflyKinematicState,
  dt: number,
  audio: AudioFeatures,
  pointer: PointerInput,
  reducedMotion: boolean
): ButterflyKinematicState {
  const safeDt = clamp(dt, 0.001, 0.05);
  const motionScale = reducedMotion ? 0.32 : 1.0;

  state.flightTime += safeDt * (reducedMotion ? 0.45 : 1.0);
  const t = state.flightTime;

  // Smooth cursor input with gentle damping
  const targetPtrX = clamp(pointer.x, -1, 1) * pointer.active;
  const targetPtrY = clamp(pointer.y, -1, 1) * pointer.active;
  state._smoothPointerX = damp(state._smoothPointerX, targetPtrX, 2.8, safeDt);
  state._smoothPointerY = damp(state._smoothPointerY, targetPtrY, 2.8, safeDt);

  // Occasional serene gliding window (slow biological rhythm, damped during energetic music)
  const glideCycle = Math.sin(t * 0.27) * Math.sin(t * 0.13 + 1.1);
  const rawGlide = clamp((glideCycle - 0.52) * 2.2, 0, 1) * (1 - audio.intensity * 0.72);
  state.glideBlend = damp(state.glideBlend, reducedMotion ? 0.5 : rawGlide, 1.4, safeDt);

  // Target wingbeat frequency (Hz): calm ~1.35-1.65 Hz idle, gently rises up to ~2.25 Hz with music
  const naturalTempoVariation = Math.sin(t * 0.41) * 0.12 + Math.cos(t * 0.19) * 0.07;
  const targetFreq =
    (1.48 + naturalTempoVariation + audio.intensity * 0.46 + audio.bass * 0.22 + audio.transient * 0.18) *
    (1 - state.glideBlend * 0.42) *
    (reducedMotion ? 0.52 : 1.0);
  state._smoothFreq = damp(state._smoothFreq, clamp(targetFreq, 0.65, 2.45), 3.2, safeDt);

  // Advance continuous wingbeat phase (never resets or jumps!)
  state.wingPhase += safeDt * state._smoothFreq * Math.PI * 2;
  if (state.wingPhase > Math.PI * 200) {
    state.wingPhase -= Math.PI * 200;
  }

  // Wing stroke amplitude: full graceful arc with subtle music expressiveness
  const targetAmp =
    (0.66 + audio.intensity * 0.14 + audio.bass * 0.08 + audio.transient * 0.07) *
    (1 - state.glideBlend * 0.52) *
    (reducedMotion ? 0.55 : 1.0);
  state._smoothAmp = damp(state._smoothAmp, clamp(targetAmp, 0.26, 0.94), 3.6, safeDt);

  // Resting dihedral bias (wings sit gracefully open with gentle upward V when gliding)
  const dihedralBias = 0.24 + state.glideBlend * 0.14;

  // Forewing primary stroke
  const foreWave = evaluateOrganicWingWave(state.wingPhase);
  const baseForeAngle = dihedralBias + foreWave * state._smoothAmp;

  // Hindwing lags slightly behind forewing (~0.24 rad) with slightly softer arc (0.86x)
  const hindWave = evaluateOrganicWingWave(state.wingPhase - 0.24);
  const baseHindAngle = dihedralBias * 0.85 + hindWave * state._smoothAmp * 0.86;

  // Gentle left/right asymmetry from organic banking and micro-variation
  const bankDrift = Math.sin(t * 0.48) * 0.032 + state._smoothPointerX * 0.04;
  state.leftForewingAngle = clamp(baseForeAngle + bankDrift, -0.78, 1.24);
  state.rightForewingAngle = clamp(baseForeAngle - bankDrift, -0.78, 1.24);
  state.leftHindwingAngle = clamp(baseHindAngle + bankDrift * 0.85, -0.68, 1.08);
  state.rightHindwingAngle = clamp(baseHindAngle - bankDrift * 0.85, -0.68, 1.08);

  // Aeroelastic wingtip flex derived from angular velocity (lagging behind wing root)
  const foreVel = (baseForeAngle - state._prevForewingAngle) / safeDt;
  const hindVel = (baseHindAngle - state._prevHindwingAngle) / safeDt;
  state._prevForewingAngle = baseForeAngle;
  state._prevHindwingAngle = baseHindAngle;

  state.forewingFlex = damp(state.forewingFlex, clamp(-foreVel * 0.14, -1, 1), 10.0, safeDt);
  state.hindwingFlex = damp(state.hindwingFlex, clamp(-hindVel * 0.12, -1, 1), 10.0, safeDt);
  state.wingTwist = damp(state.wingTwist, clamp(foreVel * 0.028, -0.18, 0.18), 9.0, safeDt);

  // Aerodynamic lift bobbing coupled gently to downstroke (downstroke lifts body upward!)
  const strokeLift = -Math.sin(state.wingPhase - 0.38) * (0.048 + audio.bass * 0.025) * motionScale;

  // Graceful multi-harmonic hovering & drifting flight path
  const driftX =
    (Math.sin(t * 0.34) * 0.34 + Math.sin(t * 0.71 + 1.4) * 0.09) * motionScale +
    state._smoothPointerX * 0.26 * motionScale;
  const driftY =
    (Math.sin(t * 0.52 + 0.6) * 0.17 + Math.cos(t * 0.23) * 0.09) * motionScale +
    strokeLift +
    state._smoothPointerY * 0.18 * motionScale +
    audio.bass * 0.06 * motionScale;
  // Subtle depth movement toward and away from the camera
  const driftZ =
    (Math.sin(t * 0.26 + 0.9) * 0.28 + Math.cos(t * 0.59) * 0.08) * motionScale +
    audio.intensity * 0.14 * motionScale;

  state.posX = damp(state.posX, driftX, 2.6, safeDt);
  state.posY = damp(state.posY, driftY, 3.2, safeDt);
  state.posZ = damp(state.posZ, driftZ, 2.2, safeDt);

  // Natural flight orientation: upright graceful showcase attitude tilted slightly to catch light
  // across the 3D wing camber while banking organically into drift and cursor proximity.
  const velXApprox = Math.cos(t * 0.34) * 0.34;
  const targetRotX =
    -0.22 +
    Math.sin(t * 0.44) * 0.08 * motionScale +
    strokeLift * 0.85 +
    state._smoothPointerY * 0.16 * motionScale +
    audio.mid * 0.05 * motionScale;
  const targetRotY =
    -0.14 +
    Math.sin(t * 0.29 + 0.5) * 0.22 * motionScale +
    state._smoothPointerX * 0.26 * motionScale +
    Math.sin(t * 0.7) * audio.mid * 0.07 * motionScale;
  const targetRotZ =
    -velXApprox * 0.28 * motionScale -
    state._smoothPointerX * 0.10 * motionScale;

  state.rotX = damp(state.rotX, targetRotX, 3.0, safeDt);
  state.rotY = damp(state.rotY, targetRotY, 2.6, safeDt);
  state.rotZ = damp(state.rotZ, targetRotZ, 3.0, safeDt);

  // Delicate antennae micro-sway
  state.antennaSway =
    (Math.sin(t * 2.1) * 0.04 + Math.cos(t * 3.7) * 0.02 + audio.high * 0.05) * motionScale;

  // Smoothly blended music-reactive shader/lighting parameters (never jerky)
  state.edgeGlow = damp(
    state.edgeGlow,
    clamp(0.24 + audio.bass * 0.52 + audio.transient * 0.35, 0.2, 1.0),
    5.5,
    safeDt
  );
  state.colorShift = damp(
    state.colorShift,
    clamp(audio.mid * 0.75 + Math.sin(t * 0.35) * 0.12, -0.2, 1.0),
    3.5,
    safeDt
  );
  state.shimmer = damp(
    state.shimmer,
    clamp(0.18 + audio.high * 0.72 + audio.transient * 0.25, 0.15, 1.0),
    7.0,
    safeDt
  );
  state.pulseAccent = damp(state.pulseAccent, clamp(audio.transient, 0, 1), 8.5, safeDt);

  return state;
}
