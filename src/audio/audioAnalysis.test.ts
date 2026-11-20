import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeAudioFrame,
  computeBandEnergy,
  computeWaveformAmplitude,
  createAudioAnalysisScratch,
  createAudioFeatures,
  validateAudioFile,
} from './audioAnalysis';

test('validateAudioFile accepts common audio formats and rejects unsupported files', () => {
  assert.equal(validateAudioFile({ name: 'nocturne.mp3', type: 'audio/mpeg', size: 1024 }).valid, true);
  assert.equal(validateAudioFile({ name: 'ambient.wav', type: 'audio/wav', size: 4096 }).valid, true);
  assert.equal(validateAudioFile({ name: 'suite.ogg', type: 'audio/ogg', size: 2048 }).valid, true);
  assert.equal(validateAudioFile({ name: 'track.flac', type: '', size: 2048 }).valid, true);

  const empty = validateAudioFile({ name: 'empty.mp3', type: 'audio/mpeg', size: 0 });
  assert.equal(empty.valid, false);

  const badType = validateAudioFile({ name: 'photo.png', type: 'image/png', size: 5000 });
  assert.equal(badType.valid, false);
});

test('computeBandEnergy isolates bass, mid, and high frequency regions accurately', () => {
  const fftSize = 1024;
  const sampleRate = 48000;
  // Hz per bin = 46.875 Hz
  const bins = new Uint8Array(fftSize / 2);

  // Put energy only in bass bins (bins 1..4 => ~47Hz..187Hz)
  bins[2] = 255;
  bins[3] = 255;

  const bass = computeBandEnergy(bins, sampleRate, fftSize, 24, 240);
  const mid = computeBandEnergy(bins, sampleRate, fftSize, 240, 2400);
  const high = computeBandEnergy(bins, sampleRate, fftSize, 2400, 11500);

  assert.ok(bass > 0.25, `Expected noticeable bass energy, got ${bass}`);
  assert.equal(mid, 0);
  assert.equal(high, 0);
});

test('computeWaveformAmplitude returns 0 for silence and > 0 for active wave', () => {
  const silent = new Uint8Array(256).fill(128);
  assert.equal(computeWaveformAmplitude(silent), 0);

  const active = new Uint8Array(256);
  for (let i = 0; i < active.length; i++) {
    active[i] = Math.round(128 + Math.sin(i * 0.25) * 90);
  }
  const amp = computeWaveformAmplitude(active);
  assert.ok(amp > 0.5 && amp <= 1.0, `Expected normalized amplitude in (0.5, 1.0], got ${amp}`);
});

test('analyzeAudioFrame detects musical transient onset and smoothly decays when paused', () => {
  const fftSize = 1024;
  const sampleRate = 48000;
  const freq = new Uint8Array(fftSize / 2);
  const wave = new Uint8Array(fftSize).fill(128);
  const scratch = createAudioAnalysisScratch();
  const features = createAudioFeatures();

  // Start quiet
  analyzeAudioFrame(freq, wave, sampleRate, fftSize, 0.016, true, scratch, features);
  assert.equal(features.active, false);

  // Sudden bass + mid hit
  for (let i = 1; i <= 12; i++) freq[i] = 230;
  for (let i = 0; i < wave.length; i++) wave[i] = i % 2 === 0 ? 190 : 66;

  analyzeAudioFrame(freq, wave, sampleRate, fftSize, 0.016, true, scratch, features);
  assert.equal(features.active, true);
  assert.ok(features.transient > 0.3, `Expected onset transient pulse, got ${features.transient}`);
  assert.ok(features.bass > 0.1, `Expected bass rise, got ${features.bass}`);

  // When paused, values smoothly decay toward zero
  for (let step = 0; step < 60; step++) {
    analyzeAudioFrame(freq, wave, sampleRate, fftSize, 0.033, false, scratch, features);
  }
  assert.equal(features.active, false);
  assert.ok(features.bass < 0.01);
  assert.ok(features.transient < 0.01);
});
