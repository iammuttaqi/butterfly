/**
 * Cinematic Midnight Atmospheric Environment:
 * - Studio RoomEnvironment PMREM reflections for crisp eye, chitin, and gold speculars.
 * - Deep velvety midnight-blue / twilight-violet / dark-navy celestial sky dome in linear space.
 * - Balanced 3-point lighting rig with subtle music-reactive ambient warmth.
 * - Single-draw-call GPU floating luminous dust motes & soft background bokeh orbs.
 */

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { ButterflyKinematicState } from '../engine/butterflyKinematics';

export interface AtmosphericEnvironmentProps {
  kinematicsRef: React.MutableRefObject<ButterflyKinematicState>;
  particleCount: number;
  bokehCount: number;
  enableExtraAccentLight: boolean;
}

const SKY_VERTEX_SHADER = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAGMENT_SHADER = /* glsl */ `
  precision mediump float;
  uniform float uTime;
  uniform float uWarmth;
  uniform float uPulse;
  varying vec3 vDir;

  void main() {
    float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);

    // True deep midnight-navy, dark indigo, and velvety violet in linear light space
    vec3 abyssNavy    = vec3(0.0025, 0.0045, 0.018);
    vec3 midnightBlue = vec3(0.007, 0.013, 0.048);
    vec3 deepViolet   = vec3(0.024, 0.010, 0.068);
    vec3 zenithDark   = vec3(0.004, 0.006, 0.026);

    vec3 col = mix(abyssNavy, midnightBlue, smoothstep(0.0, 0.48, h));
    col = mix(col, deepViolet, smoothstep(0.28, 0.72, h) * 0.85);
    col = mix(col, zenithDark, smoothstep(0.70, 1.0, h));

    // Delicate twilight nebula aura centered softly behind the floating butterfly
    float centerFocus = pow(max(0.0, dot(normalize(vDir), normalize(vec3(0.0, 0.04, -1.0)))), 3.6);
    float nebulaWave = sin(vDir.x * 3.4 + uTime * 0.12) * cos(vDir.y * 2.6 - uTime * 0.09) * 0.5 + 0.5;
    vec3 nebulaGlow = mix(vec3(0.055, 0.028, 0.16), vec3(0.018, 0.085, 0.14), nebulaWave);
    col += nebulaGlow * centerFocus * (0.55 + uWarmth * 0.45 + uPulse * 0.30);

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const PARTICLE_VERTEX_SHADER = /* glsl */ `
  attribute float aScale;
  attribute float aPhase;
  attribute vec3 aColor;

  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uShimmer;
  uniform float uPulse;
  uniform float uBaseSize;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vColor = aColor;

    vec3 pos = position;
    pos.x += sin(uTime * 0.24 + aPhase * 6.2831) * 0.34;
    pos.y += cos(uTime * 0.19 + aPhase * 4.7123) * 0.28 + mod(uTime * 0.045 + aPhase * 7.0, 7.0) - 3.5;
    pos.z += sin(uTime * 0.16 + aPhase * 3.1415) * 0.24;

    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPos;

    float twinkle = 0.52 + 0.48 * sin(uTime * (1.3 + aPhase * 2.1) + aPhase * 19.0);
    float sizeBoost = 1.0 + uShimmer * 0.30 + uPulse * 0.24;
    gl_PointSize = clamp((uBaseSize * aScale * sizeBoost * uPixelRatio) / max(1.5, -mvPos.z), 1.5, 92.0);

    float edgeFade = smoothstep(3.5, 2.0, abs(pos.y));
    vAlpha = twinkle * edgeFade * (0.48 + uShimmer * 0.45 + uPulse * 0.25);
  }
`;

const PARTICLE_FRAGMENT_SHADER = /* glsl */ `
  precision mediump float;
  uniform float uSoftness;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec2 centered = gl_PointCoord - 0.5;
    float r = length(centered) * 2.0;
    if (r > 1.0) discard;

    float falloff = mix(pow(1.0 - r, 2.5), smoothstep(1.0, 0.12, r) * 0.34, uSoftness);
    gl_FragColor = vec4(vColor, falloff * vAlpha);
  }
`;

function buildParticleGeometry(
  count: number,
  radiusMin: number,
  radiusMax: number,
  depthMin: number,
  depthMax: number,
  seedOffset: number
) {
  const positions = new Float32Array(count * 3);
  const scales = new Float32Array(count);
  const phases = new Float32Array(count);
  const colors = new Float32Array(count * 3);

  const palette = [
    new THREE.Color('#c4b5fd'),
    new THREE.Color('#67e8f9'),
    new THREE.Color('#93c5fd'),
    new THREE.Color('#f5b8df'),
    new THREE.Color('#fde68a'),
  ];

  let seed = 1337 + seedOffset * 7919;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let i = 0; i < count; i++) {
    const angle = rand() * Math.PI * 2;
    const rad = radiusMin + Math.pow(rand(), 0.7) * (radiusMax - radiusMin);
    positions[i * 3] = Math.cos(angle) * rad * 1.45;
    positions[i * 3 + 1] = (rand() - 0.5) * 6.8;
    positions[i * 3 + 2] = depthMin + rand() * (depthMax - depthMin);

    scales[i] = 0.55 + rand() * 1.15;
    phases[i] = rand();

    const col = palette[i % palette.length];
    colors[i * 3] = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
  return geo;
}

export function AtmosphericEnvironment({
  kinematicsRef,
  particleCount,
  bokehCount,
  enableExtraAccentLight,
}: AtmosphericEnvironmentProps) {
  const { gl, scene } = useThree();
  const accentLightRef = useRef<THREE.PointLight>(null);

  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const roomEnv = new RoomEnvironment();
    const envRT = pmrem.fromScene(roomEnv, 0.04);
    scene.environment = envRT.texture;
    scene.environmentIntensity = 0.45;
    roomEnv.dispose();
    pmrem.dispose();

    return () => {
      scene.environment = null;
      envRT.dispose();
    };
  }, [gl, scene]);

  const skyResources = useMemo(() => {
    const geo = new THREE.SphereGeometry(32, 32, 20);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uWarmth: { value: 0 },
        uPulse: { value: 0 },
      },
      vertexShader: SKY_VERTEX_SHADER,
      fragmentShader: SKY_FRAGMENT_SHADER,
      side: THREE.BackSide,
      depthWrite: false,
    });
    return { geo, mat };
  }, []);

  const moteResources = useMemo(() => {
    const geo = buildParticleGeometry(particleCount, 1.5, 7.8, -6.0, 2.5, 1);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
        uShimmer: { value: 0.2 },
        uPulse: { value: 0 },
        uBaseSize: { value: 26.0 },
        uSoftness: { value: 0.0 },
      },
      vertexShader: PARTICLE_VERTEX_SHADER,
      fragmentShader: PARTICLE_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { geo, mat };
  }, [particleCount]);

  const bokehResources = useMemo(() => {
    const geo = buildParticleGeometry(bokehCount, 2.2, 10.0, -10.5, -3.5, 2);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
        uShimmer: { value: 0.15 },
        uPulse: { value: 0 },
        uBaseSize: { value: 210.0 },
        uSoftness: { value: 1.0 },
      },
      vertexShader: PARTICLE_VERTEX_SHADER,
      fragmentShader: PARTICLE_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { geo, mat };
  }, [bokehCount]);

  useEffect(() => {
    return () => {
      skyResources.geo.dispose();
      skyResources.mat.dispose();
    };
  }, [skyResources]);

  useEffect(() => {
    return () => {
      moteResources.geo.dispose();
      moteResources.mat.dispose();
    };
  }, [moteResources]);

  useEffect(() => {
    return () => {
      bokehResources.geo.dispose();
      bokehResources.mat.dispose();
    };
  }, [bokehResources]);

  useFrame(() => {
    const k = kinematicsRef.current;

    skyResources.mat.uniforms.uTime.value = k.flightTime;
    skyResources.mat.uniforms.uWarmth.value = Math.max(0, k.colorShift);
    skyResources.mat.uniforms.uPulse.value = k.pulseAccent;

    moteResources.mat.uniforms.uTime.value = k.flightTime;
    moteResources.mat.uniforms.uShimmer.value = k.shimmer;
    moteResources.mat.uniforms.uPulse.value = k.pulseAccent;

    bokehResources.mat.uniforms.uTime.value = k.flightTime * 0.65;
    bokehResources.mat.uniforms.uShimmer.value = k.colorShift * 0.5 + 0.15;
    bokehResources.mat.uniforms.uPulse.value = k.pulseAccent * 0.7;

    if (accentLightRef.current) {
      accentLightRef.current.intensity = 1.4 + k.colorShift * 1.2 + k.pulseAccent * 1.0;
    }
  });

  return (
    <group name="atmospheric-environment">
      <mesh geometry={skyResources.geo} material={skyResources.mat} frustumCulled={false} />

      <hemisphereLight args={['#6366f1', '#050816', 0.72]} />
      <directionalLight position={[2.8, 4.5, 4.4]} intensity={1.75} color="#fff1df" />
      <directionalLight position={[-3.2, 2.0, -3.8]} intensity={1.15} color="#38bdf8" />

      {enableExtraAccentLight && (
        <pointLight
          ref={accentLightRef}
          position={[0.4, 0.8, 2.4]}
          intensity={1.5}
          distance={9}
          decay={2}
          color="#a855f7"
        />
      )}

      <points geometry={bokehResources.geo} material={bokehResources.mat} frustumCulled={false} />
      <points geometry={moteResources.geo} material={moteResources.mat} frustumCulled={false} />
    </group>
  );
}
