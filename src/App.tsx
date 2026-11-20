/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ButterflyScene } from './scene/ButterflyScene';
import { EntryOverlay } from './components/EntryOverlay';
import { PlaybackDock } from './components/PlaybackDock';
import { PerfMonitorOverlay } from './components/PerfMonitorOverlay';
import { WebGLFallback } from './components/WebGLFallback';
import { LocalAudioEngine, type AudioTrackMeta } from './audio/audioEngine';
import {
  AdaptivePerformanceMonitor,
  type PerformanceSnapshot,
  type QualityTier,
} from './engine/performanceMonitor';
import { detectWebGLCapabilities, prefersReducedMotion } from './utils/webglDetect';

export default function App() {
  const capabilities = useMemo(() => detectWebGLCapabilities(), []);

  const initialParams = useMemo(() => {
    if (typeof window === 'undefined') {
      return { autostart: false, perf: false };
    }
    const params = new URLSearchParams(window.location.search);
    return {
      autostart: params.get('autostart') === '1',
      perf: params.get('perf') === '1',
    };
  }, []);

  const initialTier: QualityTier = capabilities.isMobileViewport ? 'balanced' : 'high';

  const audioEngine = useMemo(() => new LocalAudioEngine(), []);
  const perfMonitor = useMemo(
    () =>
      new AdaptivePerformanceMonitor({
        initialTier,
        adaptiveEnabled: true,
        isSoftwareGl: capabilities.isSoftwareGl,
      }),
    [initialTier, capabilities.isSoftwareGl]
  );

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [entered, setEntered] = useState(initialParams.autostart);
  const [sceneReady, setSceneReady] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [qualityTier, setQualityTier] = useState<QualityTier>(initialTier);
  const [showPerfOverlay, setShowPerfOverlay] = useState(initialParams.perf);
  const [reducedMotion, setReducedMotion] = useState(() => prefersReducedMotion());

  const [track, setTrack] = useState<AudioTrackMeta>(() => audioEngine.getMeta());
  const [perfSnap, setPerfSnap] = useState<PerformanceSnapshot>(() =>
    perfMonitor.getSnapshot(false)
  );

  // Subscribe to audio engine metadata updates and dispose cleanly on unmount
  useEffect(() => {
    const unsubscribe = audioEngine.subscribe(setTrack);
    return () => {
      unsubscribe();
      audioEngine.dispose();
    };
  }, [audioEngine]);

  // Listen for OS prefers-reduced-motion changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Keyboard shortcuts: H = hide/show controls, P = dev perf monitor, Space = play/pause when entered
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === 'h' || e.key === 'H') {
        if (entered) setDockCollapsed((prev) => !prev);
      } else if (e.key === 'p' || e.key === 'P') {
        setShowPerfOverlay((prev) => !prev);
      } else if (e.key === ' ' && entered && audioEngine.hasTrack()) {
        e.preventDefault();
        void audioEngine.togglePlay();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [entered, audioEngine]);

  const handlePickAudio = useCallback(() => {
    audioEngine.clearError();
    fileInputRef.current?.click();
  }, [audioEngine]);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      // Reset input value so selecting the same file again still triggers onChange
      e.target.value = '';
      if (!file) return;

      // If already inside the experience, begin playing immediately upon user file selection
      await audioEngine.loadLocalFile(file, entered);
    },
    [audioEngine, entered]
  );

  const handleEnter = useCallback(async () => {
    setEntered(true);
    setDockCollapsed(false);
    // Start playback cleanly within this explicit user gesture if a track was pre-selected
    if (audioEngine.hasTrack()) {
      await audioEngine.play();
    }
  }, [audioEngine]);

  const handleLeave = useCallback(() => {
    audioEngine.pause();
    setEntered(false);
  }, [audioEngine]);

  const handleSelectQuality = useCallback(
    (selection: QualityTier | 'auto') => {
      if (selection === 'auto') {
        perfMonitor.enableAdaptiveQuality(true);
      } else {
        perfMonitor.setManualQualityTier(selection);
        setQualityTier(selection);
      }
      setPerfSnap(perfMonitor.getSnapshot(audioEngine.getFeatures().active));
    },
    [perfMonitor, audioEngine]
  );

  if (!capabilities.supported || contextLost) {
    return (
      <WebGLFallback
        reason={contextLost ? 'context-lost' : 'unsupported'}
        onRetry={contextLost ? () => window.location.reload() : undefined}
      />
    );
  }

  return (
    <main
      className="relative w-full h-full overflow-hidden bg-[#050816]"
      data-experience-state={entered ? 'entered' : 'intro'}
      data-quality-tier={qualityTier}
    >
      {/* Hidden local audio file picker */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.ogg,.oga,.m4a,.aac,.flac,.webm,.opus"
        onChange={handleFileChange}
        className="sr-only"
        aria-label="Choose local audio file"
        data-testid="audio-file-input"
      />

      {/* Full-viewport 3D Butterfly Canvas */}
      <ButterflyScene
        entered={entered}
        audioEngine={audioEngine}
        perfMonitor={perfMonitor}
        qualityTier={qualityTier}
        onQualityTierChange={setQualityTier}
        onPerfSnapshot={setPerfSnap}
        showPerfOverlay={showPerfOverlay}
        isSoftwareGl={capabilities.isSoftwareGl}
        reducedMotion={reducedMotion}
        onContextLost={() => setContextLost(true)}
        onReady={() => setSceneReady(true)}
      />

      {/* Graceful initial shader/scene warm-up veil */}
      <div
        aria-hidden="true"
        className={`pointer-events-none fixed inset-0 z-30 bg-[#050816] transition-opacity duration-700 ${
          sceneReady ? 'opacity-0' : 'opacity-100'
        }`}
      />

      {/* Minimal Entry Overlay */}
      <EntryOverlay
        visible={!entered}
        trackName={track.name}
        audioError={track.error}
        onEnter={handleEnter}
        onPickAudio={handlePickAudio}
      />

      {/* Minimal Collapsible Bottom Playback Dock */}
      <PlaybackDock
        visible={entered}
        collapsed={dockCollapsed}
        onToggleCollapsed={() => setDockCollapsed((c) => !c)}
        track={track}
        onTogglePlay={() => void audioEngine.togglePlay()}
        onToggleMute={() => audioEngine.toggleMute()}
        onVolumeChange={(v) => audioEngine.setVolume(v)}
        onSeek={(sec) => audioEngine.seek(sec)}
        onPickAudio={handlePickAudio}
        onLeave={handleLeave}
      />

      {/* Development-only Performance Monitor (press P or pass ?perf=1) */}
      <PerfMonitorOverlay
        visible={showPerfOverlay}
        snapshot={perfSnap}
        isSoftwareGl={capabilities.isSoftwareGl}
        onSelectTier={handleSelectQuality}
        onClose={() => setShowPerfOverlay(false)}
      />
    </main>
  );
}
