import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createButterflyKinematicState,
  evaluateOrganicWingWave,
  stepButterflyKinematics,
} from './butterflyKinematics';
import { createAudioFeatures } from '../audio/audioAnalysis';

test('idle butterfly animation produces continuous organic wing movement with hindwing lag', () => {
  const state = createButterflyKinematicState();
  const audio = createAudioFeatures();
  const pointer = { x: 0, y: 0, active: 0 };

  let minFore = Infinity;
  let maxFore = -Infinity;
  let phaseDiffSeen = false;

  for (let i = 0; i < 120; i++) {
    stepButterflyKinematics(state, 1 / 60, audio, pointer, false);
    minFore = Math.min(minFore, state.leftForewingAngle);
    maxFore = Math.max(maxFore, state.leftForewingAngle);
    if (Math.abs(state.leftForewingAngle - state.leftHindwingAngle) > 0.05) {
      phaseDiffSeen = true;
    }
    assert.ok(state.leftForewingAngle >= -0.78 && state.leftForewingAngle <= 1.24);
    assert.ok(state.forewingFlex >= -1 && state.forewingFlex <= 1);
  }

  assert.ok(maxFore - minFore > 0.6, `Expected natural wingbeat arc > 0.6 rad, got ${maxFore - minFore}`);
  assert.equal(phaseDiffSeen, true, 'Expected independent hindwing phase articulation');
});

test('music reactivity gently enhances expressiveness without clipping or snapping', () => {
  const idleState = createButterflyKinematicState();
  const musicState = createButterflyKinematicState();
  const silentAudio = createAudioFeatures();
  const activeAudio = {
    bass: 0.72,
    mid: 0.65,
    high: 0.8,
    intensity: 0.75,
    waveformAmplitude: 0.6,
    transient: 0.8,
    active: true,
  };
  const pointer = { x: 0, y: 0, active: 0 };

  for (let i = 0; i < 90; i++) {
    stepButterflyKinematics(idleState, 1 / 60, silentAudio, pointer, false);
    stepButterflyKinematics(musicState, 1 / 60, activeAudio, pointer, false);
  }

  assert.ok(musicState.edgeGlow > idleState.edgeGlow + 0.2, 'Expected bass/transient to lift wing edge glow');
  assert.ok(musicState.shimmer > idleState.shimmer + 0.25, 'Expected highs to lift iridescent shimmer');
  assert.ok(musicState.wingPhase > idleState.wingPhase, 'Expected energetic music to gently quicken wingbeat');
});

test('reduced motion mode scales down displacement and tempo gracefully', () => {
  const normal = createButterflyKinematicState();
  const reduced = createButterflyKinematicState();
  const audio = createAudioFeatures();
  const pointer = { x: 0.8, y: 0.5, active: 1 };

  for (let i = 0; i < 120; i++) {
    stepButterflyKinematics(normal, 1 / 60, audio, pointer, false);
    stepButterflyKinematics(reduced, 1 / 60, audio, pointer, true);
  }

  assert.ok(reduced.wingPhase < normal.wingPhase, 'Reduced motion should slow wingbeat frequency');
  assert.ok(Math.abs(reduced.posX) < Math.abs(normal.posX) + 0.05);
});

test('evaluateOrganicWingWave stays bounded across full cycle', () => {
  for (let a = 0; a < Math.PI * 2; a += 0.1) {
    const val = evaluateOrganicWingWave(a);
    assert.ok(val > -1.35 && val < 1.35);
  }
});
