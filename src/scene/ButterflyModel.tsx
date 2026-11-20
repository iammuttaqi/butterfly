/**
 * Articulated 3D Butterfly Hero Component.
 *
 * Hierarchy:
 * - rootGroupRef (receives GSAP choreographed entrance transform ONLY — never fights useFrame)
 *   - flightGroupRef (receives continuous organic hovering, drifting, banking in useFrame)
 *     - Sculpted body (thorax, shoulder collars, segmented abdomen, head, glossy eyes, proboscis, 6 legs)
 *     - Left & Right Antenna pivots (subtle sensory sway)
 *     - Left Forewing Pivot  (attached at thorax left anterior root)
 *     - Right Forewing Pivot (attached at thorax right anterior root)
 *     - Left Hindwing Pivot  (attached at thorax left posterior root)
 *     - Right Hindwing Pivot (attached at thorax right posterior root)
 *     - Soft radial luminous halo aura (optional, disabled in performance tier)
 */

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import {
  createAbdomenGeometry,
  createAntennaGeometry,
  createLegsGeometry,
  createProboscisGeometry,
  createThoraxGeometry,
  createWingGeometry,
} from './butterflyGeometry';
import { createWingTextureSet } from './wingTextureGenerator';
import { createWingShaderMaterial } from './butterflyShaders';
import type { ButterflyKinematicState } from '../engine/butterflyKinematics';

export interface ButterflyModelProps {
  kinematicsRef: React.MutableRefObject<ButterflyKinematicState>;
  entranceOffsetRef: React.MutableRefObject<{
    posY: number;
    posZ: number;
    scale: number;
    rotX: number;
    rotY: number;
  }>;
  shaderDetail: number;
  enableHaloGlow: boolean;
}

const HALO_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const HALO_FRAGMENT_SHADER = /* glsl */ `
  precision mediump float;
  uniform float uIntensity;
  uniform float uColorShift;
  varying vec2 vUv;

  void main() {
    float d = length((vUv - 0.5) * 2.0);
    float core = exp(-d * d * 3.4);
    float outer = exp(-d * d * 1.45) * 0.42;
    float alpha = (core + outer) * (0.16 + uIntensity * 0.18);
    vec3 colA = vec3(0.38, 0.34, 0.92);
    vec3 colB = vec3(0.24, 0.78, 0.88);
    vec3 colC = vec3(0.82, 0.44, 0.78);
    vec3 col = mix(colA, mix(colB, colC, clamp(uColorShift, 0.0, 1.0)), 0.45);
    gl_FragColor = vec4(col, alpha * smoothstep(1.0, 0.25, d));
  }
`;

export function ButterflyModel({
  kinematicsRef,
  entranceOffsetRef,
  shaderDetail,
  enableHaloGlow,
}: ButterflyModelProps) {
  const { gl } = useThree();

  const rootGroupRef = useRef<THREE.Group>(null);
  const flightGroupRef = useRef<THREE.Group>(null);
  const leftForePivotRef = useRef<THREE.Group>(null);
  const rightForePivotRef = useRef<THREE.Group>(null);
  const leftHindPivotRef = useRef<THREE.Group>(null);
  const rightHindPivotRef = useRef<THREE.Group>(null);
  const leftAntennaRef = useRef<THREE.Group>(null);
  const rightAntennaRef = useRef<THREE.Group>(null);

  // Build procedural 3D geometries once and dispose on unmount
  const geometries = useMemo(() => {
    const leftFore = createWingGeometry('forewing', 'left', 28, 22);
    const rightFore = createWingGeometry('forewing', 'right', 28, 22);
    const leftHind = createWingGeometry('hindwing', 'left', 24, 20);
    const rightHind = createWingGeometry('hindwing', 'right', 24, 20);
    const thorax = createThoraxGeometry();
    const abdomen = createAbdomenGeometry();
    const head = new THREE.SphereGeometry(0.088, 20, 16);
    head.scale(1.18, 0.94, 0.95);
    const eye = new THREE.SphereGeometry(0.048, 16, 14);
    const shoulder = new THREE.SphereGeometry(0.055, 12, 10);
    shoulder.scale(0.85, 0.72, 1.55);
    const leftAnt = createAntennaGeometry('left');
    const rightAnt = createAntennaGeometry('right');
    const proboscis = createProboscisGeometry();
    const legs = createLegsGeometry();
    const haloPlane = new THREE.PlaneGeometry(5.6, 5.6);

    return {
      leftFore,
      rightFore,
      leftHind,
      rightHind,
      thorax,
      abdomen,
      head,
      eye,
      shoulder,
      leftAnt,
      rightAnt,
      proboscis,
      legs,
      haloPlane,
    };
  }, []);

  // Build procedural high-res wing textures and shaders once
  const resources = useMemo(() => {
    const maxAniso = Math.min(8, gl.capabilities.getMaxAnisotropy?.() || 4);
    const textures = createWingTextureSet(maxAniso);

    const foreMat = createWingShaderMaterial(textures.foreColor, textures.foreData);
    const hindMat = createWingShaderMaterial(textures.hindColor, textures.hindData);

    // Distinct roughness/metalness contrast across body parts (>= 0.25 roughness delta)
    const velvetBodyMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#0f0a21'),
      roughness: 0.80,
      metalness: 0.08,
      sheen: 0.9,
      sheenRoughness: 0.42,
      sheenColor: new THREE.Color('#6d4aff'),
    });

    const chitinAccentMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#181036'),
      roughness: 0.34,
      metalness: 0.48,
      iridescence: 0.72,
      iridescenceIOR: 1.38,
    });

    const eyeMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#070412'),
      roughness: 0.08,
      metalness: 0.18,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      iridescence: 0.55,
      iridescenceIOR: 1.45,
    });

    const goldClubMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#e0b76c'),
      roughness: 0.28,
      metalness: 0.82,
      emissive: new THREE.Color('#3a250e'),
      emissiveIntensity: 0.3,
    });

    const haloMat = new THREE.ShaderMaterial({
      uniforms: {
        uIntensity: { value: 0.25 },
        uColorShift: { value: 0.0 },
      },
      vertexShader: HALO_VERTEX_SHADER,
      fragmentShader: HALO_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    return {
      textures,
      foreMat,
      hindMat,
      velvetBodyMat,
      chitinAccentMat,
      eyeMat,
      goldClubMat,
      haloMat,
    };
  }, [gl]);

  // Clean up GPU geometries, textures, and materials on unmount
  useEffect(() => {
    return () => {
      geometries.leftFore.dispose();
      geometries.rightFore.dispose();
      geometries.leftHind.dispose();
      geometries.rightHind.dispose();
      geometries.thorax.dispose();
      geometries.abdomen.dispose();
      geometries.head.dispose();
      geometries.eye.dispose();
      geometries.shoulder.dispose();
      geometries.leftAnt.shaft.dispose();
      geometries.leftAnt.club.dispose();
      geometries.rightAnt.shaft.dispose();
      geometries.rightAnt.club.dispose();
      geometries.proboscis.dispose();
      geometries.legs.forEach((g) => g.dispose());
      geometries.haloPlane.dispose();

      resources.textures.dispose();
      resources.foreMat.dispose();
      resources.hindMat.dispose();
      resources.velvetBodyMat.dispose();
      resources.chitinAccentMat.dispose();
      resources.eyeMat.dispose();
      resources.goldClubMat.dispose();
      resources.haloMat.dispose();
    };
  }, [geometries, resources]);

  // Keep shader detail uniform synced with adaptive quality tier
  useEffect(() => {
    resources.foreMat.uniforms.uShaderDetail.value = shaderDetail;
    resources.hindMat.uniforms.uShaderDetail.value = shaderDetail;
  }, [shaderDetail, resources]);

  // Apply kinematic state + entrance offset directly to Three.js refs (zero React re-renders!)
  useFrame(() => {
    const k = kinematicsRef.current;
    const ent = entranceOffsetRef.current;

    if (rootGroupRef.current) {
      rootGroupRef.current.position.set(0, ent.posY, ent.posZ);
      rootGroupRef.current.rotation.set(ent.rotX, ent.rotY, 0);
      rootGroupRef.current.scale.setScalar(ent.scale);
    }

    if (flightGroupRef.current) {
      flightGroupRef.current.position.set(k.posX, k.posY, k.posZ);
      flightGroupRef.current.rotation.set(k.rotX, k.rotY, k.rotZ);
    }

    // Independent wing root articulation around vertical thorax hinges (Y-axis)
    if (leftForePivotRef.current) {
      leftForePivotRef.current.rotation.y = k.leftForewingAngle;
      leftForePivotRef.current.rotation.x = k.wingTwist;
    }
    if (rightForePivotRef.current) {
      rightForePivotRef.current.rotation.y = -k.rightForewingAngle;
      rightForePivotRef.current.rotation.x = k.wingTwist;
    }
    if (leftHindPivotRef.current) {
      leftHindPivotRef.current.rotation.y = k.leftHindwingAngle;
      leftHindPivotRef.current.rotation.x = k.wingTwist * 0.7;
    }
    if (rightHindPivotRef.current) {
      rightHindPivotRef.current.rotation.y = -k.rightHindwingAngle;
      rightHindPivotRef.current.rotation.x = k.wingTwist * 0.7;
    }

    if (leftAntennaRef.current) {
      leftAntennaRef.current.rotation.x = k.antennaSway;
      leftAntennaRef.current.rotation.z = k.antennaSway * 0.65;
    }
    if (rightAntennaRef.current) {
      rightAntennaRef.current.rotation.x = -k.antennaSway * 0.85;
      rightAntennaRef.current.rotation.z = -k.antennaSway * 0.65;
    }

    // Update custom GLSL iridescent wing uniforms directly
    const fU = resources.foreMat.uniforms;
    fU.uTime.value = k.flightTime;
    fU.uFlex.value = k.forewingFlex;
    fU.uTwist.value = k.wingTwist;
    fU.uEdgeGlow.value = k.edgeGlow;
    fU.uColorShift.value = k.colorShift;
    fU.uShimmer.value = k.shimmer;
    fU.uPulse.value = k.pulseAccent;

    const hU = resources.hindMat.uniforms;
    hU.uTime.value = k.flightTime;
    hU.uFlex.value = k.hindwingFlex;
    hU.uTwist.value = k.wingTwist * 0.75;
    hU.uEdgeGlow.value = k.edgeGlow;
    hU.uColorShift.value = k.colorShift;
    hU.uShimmer.value = k.shimmer;
    hU.uPulse.value = k.pulseAccent;

    resources.haloMat.uniforms.uIntensity.value = k.edgeGlow * 0.7 + k.pulseAccent * 0.5;
    resources.haloMat.uniforms.uColorShift.value = k.colorShift;
  });

  return (
    <group ref={rootGroupRef} name="butterfly-entrance-root">
      <group ref={flightGroupRef} name="butterfly-flight-rig">
        {/* Soft atmospheric backlight halo behind butterfly */}
        {enableHaloGlow && (
          <mesh
            geometry={geometries.haloPlane}
            material={resources.haloMat}
            position={[0, 0.05, -0.75]}
            renderOrder={-1}
          />
        )}

        {/* Sculpted Anatomical Body (upright +Y head, +Z dorsal) */}
        <group name="butterfly-body">
          <mesh geometry={geometries.thorax} material={resources.velvetBodyMat} />
          <mesh geometry={geometries.abdomen} material={resources.velvetBodyMat} />

          {/* Patagia shoulder collars hiding wing root hinges seamlessly */}
          <mesh
            geometry={geometries.shoulder}
            material={resources.chitinAccentMat}
            position={[-0.068, 0.14, 0.042]}
            rotation={[Math.PI / 2, 0, 0]}
          />
          <mesh
            geometry={geometries.shoulder}
            material={resources.chitinAccentMat}
            position={[0.068, 0.14, 0.042]}
            rotation={[Math.PI / 2, 0, 0]}
          />

          {/* Head + Compound Eyes + Coiled Proboscis */}
          <mesh
            geometry={geometries.head}
            material={resources.velvetBodyMat}
            position={[0, 0.40, 0.02]}
          />
          <mesh
            geometry={geometries.eye}
            material={resources.eyeMat}
            position={[-0.072, 0.425, 0.028]}
          />
          <mesh
            geometry={geometries.eye}
            material={resources.eyeMat}
            position={[0.072, 0.425, 0.028]}
          />
          <mesh geometry={geometries.proboscis} material={resources.chitinAccentMat} />

          {/* Delicate Antennae with golden clubbed tips */}
          <group ref={leftAntennaRef} name="antenna-left">
            <mesh geometry={geometries.leftAnt.shaft} material={resources.chitinAccentMat} />
            <mesh geometry={geometries.leftAnt.club} material={resources.goldClubMat} />
          </group>
          <group ref={rightAntennaRef} name="antenna-right">
            <mesh geometry={geometries.rightAnt.shaft} material={resources.chitinAccentMat} />
            <mesh geometry={geometries.rightAnt.club} material={resources.goldClubMat} />
          </group>

          {/* Six delicate folded flight legs */}
          {geometries.legs.map((legGeo, idx) => (
            <mesh key={idx} geometry={legGeo} material={resources.chitinAccentMat} />
          ))}
        </group>

        {/* Independently Articulated Wing Pivots anchored at anatomical thorax hinges */}
        <group ref={leftForePivotRef} position={[-0.056, 0.15, 0.025]} name="wing-left-fore">
          <mesh geometry={geometries.leftFore} material={resources.foreMat} renderOrder={2} />
        </group>
        <group ref={rightForePivotRef} position={[0.056, 0.15, 0.025]} name="wing-right-fore">
          <mesh geometry={geometries.rightFore} material={resources.foreMat} renderOrder={2} />
        </group>
        <group ref={leftHindPivotRef} position={[-0.050, -0.02, 0.005]} name="wing-left-hind">
          <mesh geometry={geometries.leftHind} material={resources.hindMat} renderOrder={1} />
        </group>
        <group ref={rightHindPivotRef} position={[0.050, -0.02, 0.005]} name="wing-right-hind">
          <mesh geometry={geometries.rightHind} material={resources.hindMat} renderOrder={1} />
        </group>
      </group>
    </group>
  );
}
