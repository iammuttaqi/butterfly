import test from 'node:test';
import assert from 'node:assert/strict';
import { AdaptivePerformanceMonitor } from './performanceMonitor';

test('AdaptivePerformanceMonitor remains on high tier under steady 60 FPS', () => {
  const monitor = new AdaptivePerformanceMonitor({ initialTier: 'high' });

  for (let i = 0; i < 240; i++) {
    const changed = monitor.recordFrame(16.6);
    assert.equal(changed, false);
  }

  const snap = monitor.getSnapshot(false);
  assert.equal(snap.qualityTier, 'high');
  assert.ok(snap.fps >= 59 && snap.fps <= 61);
  assert.ok(snap.stabilityPercent >= 95);
});

test('AdaptivePerformanceMonitor does not downgrade on brief spikes, only on sustained lag', () => {
  const monitor = new AdaptivePerformanceMonitor({ initialTier: 'high' });

  // Warm up with 40 healthy frames
  for (let i = 0; i < 40; i++) monitor.recordFrame(16.5);

  // Brief 0.5s spike should NOT downgrade quality
  for (let i = 0; i < 15; i++) {
    const changed = monitor.recordFrame(32);
    assert.equal(changed, false);
  }
  assert.equal(monitor.getQualityTier(), 'high');

  // Sustained slow frames (~33ms = 30fps) for > 4 seconds should step down to balanced
  let downgraded = false;
  for (let i = 0; i < 180; i++) {
    if (monitor.recordFrame(33)) {
      downgraded = true;
      break;
    }
  }
  assert.equal(downgraded, true);
  assert.equal(monitor.getQualityTier(), 'balanced');
});

test('AdaptivePerformanceMonitor recovers quality tier after sustained headroom', () => {
  const monitor = new AdaptivePerformanceMonitor({ initialTier: 'balanced' });

  let upgraded = false;
  for (let i = 0; i < 600; i++) {
    if (monitor.recordFrame(12.0)) {
      upgraded = true;
      break;
    }
  }
  assert.equal(upgraded, true);
  assert.equal(monitor.getQualityTier(), 'high');
});
