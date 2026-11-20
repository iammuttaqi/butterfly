/**
 * Main React Three Fiber 3D Canvas & Coordinated Single-Loop Animation Orchestrator.
 *
 * - Runs ONE continuous useFrame loop (zero competing loops).
 * - Uses GSAP strictly for the choreographed entrance / exit transition on dedicated
 *   offset refs so GSAP and useFrame NEVER mutate the same properties.
 * - Adapts rendering resolution and visual effects via AdaptivePerformanceMonitor.
 * - Handles software WebGL cleanly with fenceSync afterDraw() pacing on demand,
 *   and pauses continuous rendering automatically when the browser tab is hidden.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import gsap from 'gsap';
import { ButterflyModel } from './ButterflyModel';
import { AtmosphericEnvironment } from './AtmosphericEnvironment';
import {
  createButterflyKinematicState,
  stepButterflyKinematics,
  type PointerInput,
} from '../engine/butterflyKinematics';
import {
  QUALITY_PRESETS,
  type AdaptivePerformanceMonitor,
  type PerformanceSnapshot,
  type QualityTier,
} from '../engine/performanceMonitor';
import type { LocalAudioEngine } from '../audio/audioEngine';

export interface ButterflySceneProps {
  entered: boolean;
  audioEngine: LocalAudioEngine;
  perfMonitor: AdaptivePerformanceMonitor;
  qualityTier: QualityTier;
  onQualityTierChange: (tier: QualityTier) => void;
  onPerfSnapshot?: (snap: PerformanceSnapshot) => void;
  showPerfOverlay: boolean;
  isSoftwareGl: boolean;
  reducedMotion: boolean;
  onContextLost?: () => void;
  onReady?: () => void;
}

const _camTarget = new THREE.Vector3(0, 0.05, 0);

interface SceneControllerProps {
  entered: boolean;
  audioEngine: LocalAudioEngine;
  perfMonitor: AdaptivePerformanceMonitor;
  qualityTier: QualityTier;
  onQualityTierChange: (tier: QualityTier) => void;
  onPerfSnapshot?: (snap: PerformanceSnapshot) => void;
  showPerfOverlay: boolean;
  isSoftwareGl: boolean;
  reducedMotion: boolean;
  pointerRef: React.MutableRefObject<PointerInput>;
  onReady?: () => void;
}

function SceneController({
  entered,
  audioEngine,
  perfMonitor,
  qualityTier,
  onQualityTierChange,
  onPerfSnapshot,
  showPerfOverlay,
  isSoftwareGl,
  reducedMotion,
  pointerRef,
  onReady,
}: SceneControllerProps) {
  const { gl, scene, camera, invalidate, size } = useThree();

  const kinematicsRef = useRef(createButterflyKinematicState());
  const entranceOffsetRef = useRef({
    posY: entered ? 0.14 : 0.78,
    posZ: entered ? 0 : -1.45,
    scale: entered ? 1 : 0.78,
    rotX: entered ? 0 : -0.10,
    rotY: entered ? 0 : 0.22,
  });

  const lastPerfReportRef = useRef(0);
  const lastFrameNowRef = useRef(performance.now());
  const camPosRef = useRef({ x: 0, y: 0.32, z: 5.75 });
  const preset = QUALITY_PRESETS[qualityTier];

  // Pre-warm shaders once on GPU before reveal
  useEffect(() => {
    if (!isSoftwareGl) {
      try {
        gl.compile(scene, camera);
      } catch {
        // Non-fatal shader pre-warm guard
      }
    }
    onReady?.();
  }, [gl, scene, camera, isSoftwareGl, onReady]);

  // Software WebGL fenceSync afterDraw() loop pacing (never starves Chromium main thread)
  useEffect(() => {
    if (!isSoftwareGl) return;

    let cancelled = false;
    let timerId = 0;

    const scheduleNext = () => {
      if (cancelled) return;
      if (document.hidden) {
        timerId = window.setTimeout(scheduleNext, 250);
        return;
      }

      const ctx = gl.getContext();
      if ('fenceSync' in ctx) {
        const gl2 = ctx as WebGL2RenderingContext;
        const sync = gl2.fenceSync(gl2.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl2.flush();
        const poll = () => {
          if (cancelled) {
            if (sync) gl2.deleteSync(sync);
            return;
          }
          const status = sync ? gl2.getSyncParameter(sync, gl2.SYNC_STATUS) : gl2.SIGNALED;
          if (status === gl2.UNSIGNALED) {
            timerId = window.setTimeout(poll, 8);
          } else {
            if (sync) gl2.deleteSync(sync);
            timerId = window.setTimeout(() => {
              if (!cancelled) {
                invalidate();
                scheduleNext();
              }
            }, 80);
          }
        };
        timerId = window.setTimeout(poll, 8);
      } else {
        timerId = window.setTimeout(() => {
          if (!cancelled) {
            invalidate();
            scheduleNext();
          }
        }, 90);
      }
    };

    invalidate();
    scheduleNext();

    return () => {
      cancelled = true;
      window.clearTimeout(timerId);
    };
  }, [gl, invalidate, isSoftwareGl]);

  // GSAP choreographed entrance / exit transition on dedicated offset ref
  useEffect(() => {
    const target = entranceOffsetRef.current;
    gsap.killTweensOf(target);

    const duration = reducedMotion ? 0.45 : entered ? 2.1 : 1.3;
    gsap.to(target, {
      posY: entered ? 0.14 : 0.78,
      posZ: entered ? 0 : -1.45,
      scale: entered ? 1 : 0.78,
      rotX: entered ? 0 : -0.10,
      rotY: entered ? 0 : 0.22,
      duration,
      ease: entered ? 'power3.out' : 'power2.inOut',
      onUpdate: () => {
        if (isSoftwareGl) invalidate();
      },
    });

    return () => {
      gsap.killTweensOf(target);
    };
  }, [entered, reducedMotion, isSoftwareGl, invalidate]);

  // Adjust camera framing smoothly for narrow portrait mobile vs wide desktop viewports
  const baseCameraZ = useMemo(() => {
    const aspect = size.width / Math.max(1, size.height);
    if (aspect < 0.62) return 8.6;
    if (aspect < 0.85) return 7.4;
    if (aspect < 1.15) return 6.4;
    return 5.65;
  }, [size.width, size.height]);

  // Single unified per-frame simulation & camera parallax update
  useFrame((_, rawDelta) => {
    const now = performance.now();
    const measuredFrameMs = now - lastFrameNowRef.current;
    lastFrameNowRef.current = now;

    // Clamped dt so animation never explodes after tab switch or software-GL pacing
    const dt = isSoftwareGl ? 0.032 : Math.min(rawDelta, 0.05);

    // 1. Sample real-time Web Audio API features (zero allocations)
    const audioFeatures = audioEngine.sampleFrame(dt);

    // 2. Advance organic butterfly kinematics
    stepButterflyKinematics(kinematicsRef.current, dt, audioFeatures, pointerRef.current, reducedMotion);

    // 3. Subtle, silky camera parallax driven by mouse / touch
    const ptr = pointerRef.current;
    const parallaxScale = reducedMotion ? 0.25 : entered ? 1.0 : 0.45;
    const targetCamX = ptr.x * ptr.active * 0.56 * parallaxScale;
    const targetCamY = (entered ? 0.34 : 0.24) + ptr.y * ptr.active * 0.36 * parallaxScale;
    const targetCamZ = baseCameraZ - audioFeatures.intensity * 0.16 * parallaxScale;

    const dampFactor = 1 - Math.exp(-3.4 * dt);
    camPosRef.current.x += (targetCamX - camPosRef.current.x) * dampFactor;
    camPosRef.current.y += (targetCamY - camPosRef.current.y) * dampFactor;
    camPosRef.current.z += (targetCamZ - camPosRef.current.z) * dampFactor;

    camera.position.set(camPosRef.current.x, camPosRef.current.y, camPosRef.current.z);
    _camTarget.set(
      kinematicsRef.current.posX * 0.16,
      0.06 + kinematicsRef.current.posY * 0.16 + (entered ? 0 : 0.22),
      0
    );
    camera.lookAt(_camTarget);

    // 4. Record frame timing & evaluate adaptive quality
    const tierChanged = perfMonitor.recordFrame(measuredFrameMs);
    if (tierChanged) {
      onQualityTierChange(perfMonitor.getQualityTier());
    }

    // Throttle React perf HUD updates to ~4 Hz only when visible
    if (showPerfOverlay && onPerfSnapshot && now - lastPerfReportRef.current >= 250) {
      lastPerfReportRef.current = now;
      onPerfSnapshot(perfMonitor.getSnapshot(audioFeatures.active));
    }
  });

  return (
    <>
      <AtmosphericEnvironment
        kinematicsRef={kinematicsRef}
        particleCount={preset.particleCount}
        bokehCount={preset.bokehCount}
        enableExtraAccentLight={preset.enableExtraAccentLight}
      />
      <ButterflyModel
        kinematicsRef={kinematicsRef}
        entranceOffsetRef={entranceOffsetRef}
        shaderDetail={preset.shaderDetail}
        enableHaloGlow={preset.enableHaloGlow}
      />
    </>
  );
}

export function ButterflyScene(props: ButterflySceneProps) {
  const [tabHidden, setTabHidden] = useState(() =>
    typeof document !== 'undefined' ? document.hidden : false
  );
  const pointerRef = useRef<PointerInput>({ x: 0, y: 0, active: 0 });
  const preset = QUALITY_PRESETS[props.qualityTier];

  // Pause continuous rendering when browser tab is backgrounded
  useEffect(() => {
    const onVisChange = () => setTabHidden(document.hidden);
    document.addEventListener('visibilitychange', onVisChange);
    return () => document.removeEventListener('visibilitychange', onVisChange);
  }, []);

  // Smooth desktop mouse & mobile touch parallax listeners
  useEffect(() => {
    const updateFromClient = (clientX: number, clientY: number) => {
      const w = Math.max(1, window.innerWidth);
      const h = Math.max(1, window.innerHeight);
      pointerRef.current.x = (clientX / w) * 2 - 1;
      pointerRef.current.y = -((clientY / h) * 2 - 1);
      pointerRef.current.active = 1;
    };

    const onPointerMove = (e: PointerEvent) => {
      updateFromClient(e.clientX, e.clientY);
    };
    const onPointerLeave = () => {
      pointerRef.current.active = 0;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        updateFromClient(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerleave', onPointerLeave, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerleave', onPointerLeave);
      window.removeEventListener('touchmove', onTouchMove);
    };
  }, []);

  const dpr: [number, number] = props.isSoftwareGl ? [1, 1] : [1, preset.maxDpr];
  const frameloop: 'always' | 'demand' | 'never' = tabHidden
    ? 'never'
    : props.isSoftwareGl
      ? 'demand'
      : 'always';

  return (
    <div
      className="fixed inset-0 w-full h-full select-none"
      data-testid="butterfly-canvas-container"
    >
      <Canvas
        dpr={dpr}
        frameloop={frameloop}
        camera={{ fov: 40, near: 0.1, far: 60, position: [0, 0.32, 5.65] }}
        gl={{
          antialias: !props.isSoftwareGl,
          alpha: false,
          powerPreference: 'high-performance',
          stencil: false,
          depth: true,
        }}
        onCreated={({ gl }) => {
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.12;

          const domEl = gl.domElement;
          const handleLost = (e: Event) => {
            e.preventDefault();
            props.onContextLost?.();
          };
          domEl.addEventListener('webglcontextlost', handleLost, false);
        }}
      >
        <color attach="background" args={['#050816']} />
        <fogExp2 attach="fog" args={['#06091b', 0.042]} />
        <SceneController
          entered={props.entered}
          audioEngine={props.audioEngine}
          perfMonitor={props.perfMonitor}
          qualityTier={props.qualityTier}
          onQualityTierChange={props.onQualityTierChange}
          onPerfSnapshot={props.onPerfSnapshot}
          showPerfOverlay={props.showPerfOverlay}
          isSoftwareGl={props.isSoftwareGl}
          reducedMotion={props.reducedMotion}
          pointerRef={pointerRef}
          onReady={props.onReady}
        />
      </Canvas>
    </div>
  );
}
