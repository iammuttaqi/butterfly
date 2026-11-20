/**
 * Custom GLSL iridescent, translucent, aeroelastic butterfly wing shader.
 *
 * Calibrated in linear light space for ACES Filmic tone mapping so jewel colors
 * (lavender, royal violet, electric blue, turquoise, soft pink, and gold glints)
 * remain rich, luminous, and saturated without washing out to white.
 */

import * as THREE from 'three';

const WING_VERTEX_SHADER = /* glsl */ `
  attribute float aSpan;
  attribute float aChord;

  uniform float uFlex;
  uniform float uTwist;
  uniform float uTime;

  varying vec2 vUv;
  varying float vSpan;
  varying float vChord;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;

  void main() {
    vUv = uv;
    vSpan = aSpan;
    vChord = aChord;

    vec3 pos = position;

    // Aeroelastic bending perpendicular to the dorsal (+Z) wing surface
    float flexCurve = aSpan * aSpan;
    float trailingLag = (1.0 - aChord) * 0.45 + 0.55;
    pos.z += uFlex * flexCurve * 0.30 * trailingLag;

    // Subtle aerodynamic camber twist along chord
    pos.z += uTwist * aSpan * (aChord - 0.5) * 0.36;

    // Delicate organic trailing-edge micro-flutter
    float microFlutter = sin(uTime * 4.8 + aSpan * 6.0 - aChord * 4.0) * 0.010 * flexCurve * (1.0 - aChord * 0.6);
    pos.z += microFlutter;

    // Perturb normal smoothly to reflect wing flex curvature for lifelike iridescence
    vec3 nrm = normal;
    float dFlex = 2.0 * aSpan * uFlex * 0.28 * trailingLag;
    nrm.x -= sign(position.x + 0.0001) * dFlex;
    nrm = normalize(nrm);

    vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
    vWorldPos = worldPosition.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * nrm);

    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const WING_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  uniform sampler2D uColorMap;
  uniform sampler2D uDataMap;
  uniform float uTime;
  uniform float uEdgeGlow;
  uniform float uColorShift;
  uniform float uShimmer;
  uniform float uPulse;
  uniform float uShaderDetail;
  uniform vec3 uKeyLightDir;
  uniform vec3 uRimLightDir;

  varying vec2 vUv;
  varying float vSpan;
  varying float vChord;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;

  // Jewel-like thin-film interference spectrum in linear RGB space
  vec3 iridescentSpectrum(float t) {
    vec3 cViolet    = vec3(0.24, 0.07, 0.72);
    vec3 cBlue      = vec3(0.03, 0.24, 0.92);
    vec3 cTurquoise = vec3(0.02, 0.62, 0.72);
    vec3 cLavender  = vec3(0.46, 0.22, 0.88);
    vec3 cRoseGold  = vec3(0.84, 0.28, 0.56);

    float p = fract(t) * 5.0;
    if (p < 1.0) return mix(cViolet, cBlue, smoothstep(0.0, 1.0, p));
    if (p < 2.0) return mix(cBlue, cTurquoise, smoothstep(0.0, 1.0, p - 1.0));
    if (p < 3.0) return mix(cTurquoise, cLavender, smoothstep(0.0, 1.0, p - 2.0));
    if (p < 4.0) return mix(cLavender, cRoseGold, smoothstep(0.0, 1.0, p - 3.0));
    return mix(cRoseGold, cViolet, smoothstep(0.0, 1.0, p - 4.0));
  }

  void main() {
    vec4 baseTex = texture2D(uColorMap, vUv);
    vec4 dataTex = texture2D(uDataMap, vUv);

    float veinMask     = dataTex.r;
    float iridDensity  = dataTex.g;
    float translucency = dataTex.b;
    float alphaMask    = dataTex.a;

    if (alphaMask < 0.05) discard;

    // Convert sRGB canvas paint cleanly to linear light space so colors stay rich & saturated
    vec3 baseLinear = pow(max(baseTex.rgb, vec3(0.0001)), vec3(2.2));

    // Flip normal for ventral underside so both wing surfaces light gracefully
    vec3 N = normalize(vWorldNormal) * (gl_FrontFacing ? 1.0 : -1.0);
    vec3 V = normalize(cameraPosition - vWorldPos);
    float ndotv = clamp(dot(N, V), 0.0, 1.0);

    vec3 Lkey = normalize(uKeyLightDir);
    vec3 Lrim = normalize(uRimLightDir);

    // 1. Sculpted directional diffuse + crisp glossy scale specular
    float ndotl = max(dot(N, Lkey), 0.0);
    float diffuse = 0.34 + ndotl * 0.76;
    vec3 Hkey = normalize(Lkey + V);
    float spec = pow(max(dot(N, Hkey), 0.0), 48.0) * (0.14 + iridDensity * 0.42);

    // 2. View-dependent thin-film iridescence sweeping across the photonic wing scales
    float opticalPath = (1.0 - ndotv) * 1.25 + vSpan * 0.55 + vChord * 0.24 + uColorShift * 0.38;
    vec3 iridLinear = iridescentSpectrum(opticalPath);

    // Keep velvet outer borders rich & dark while inner scales shimmer vividly
    float dorsalBoost = gl_FrontFacing ? 1.0 : 0.72;
    vec3 surfaceColor = mix(baseLinear, mix(baseLinear, iridLinear, 0.56), iridDensity * dorsalBoost);

    // 3. Micro-scale photonic crystal glint (reacts gently to high frequencies)
    float scaleGlint = 0.0;
    if (uShaderDetail > 0.4) {
      float scaleGrid = sin(vSpan * 165.0 + vChord * 22.0) * sin(vChord * 150.0 - vSpan * 16.0);
      float glintAngle = pow(max(dot(N, normalize(Lkey + V * 0.75)), 0.0), 16.0);
      scaleGlint = smoothstep(0.55, 0.98, scaleGrid) * glintAngle * iridDensity * (0.16 + uShimmer * 0.75);
    }

    // 4. Controlled Fresnel edge illumination & golden rim hint (boosted subtly by bass)
    float fresnel = pow(1.0 - ndotv, 3.0);
    float outerRim = smoothstep(0.76, 0.96, vSpan) * (1.0 - smoothstep(0.96, 1.0, vSpan));
    vec3 fresnelTint = mix(vec3(0.18, 0.42, 0.95), vec3(0.88, 0.42, 0.78), 0.35 + uColorShift * 0.45);
    vec3 goldTint = vec3(0.95, 0.68, 0.24);
    vec3 rimGlow = mix(fresnelTint, goldTint, outerRim * 0.42) *
                   (fresnel * (0.28 + uEdgeGlow * 0.55) + outerRim * (0.08 + uEdgeGlow * 0.30));

    // 5. Stained-glass backlit translucency through thin inner cells
    float backLit = pow(clamp(dot(V, -Lrim), 0.0, 1.0), 2.0);
    float sssAmount = (0.16 + backLit * 0.48) * translucency * (1.0 - veinMask * 0.90);
    vec3 sssGlow = mix(baseLinear, iridLinear, 0.5) * sssAmount * (0.55 + uColorShift * 0.35 + uPulse * 0.40);

    // 6. Combine in energy-conserving linear space
    vec3 color = surfaceColor * diffuse + sssGlow + rimGlow * (1.0 - veinMask * 0.65);
    color += mix(iridLinear, vec3(1.0, 0.86, 0.55), 0.42) * (spec + scaleGlint);
    color += iridLinear * uPulse * iridDensity * 0.22;

    // Sculptural dark chitin veins with subtle golden sheen edge
    vec3 veinColor = vec3(0.015, 0.008, 0.045) + goldTint * (spec * 0.35);
    color = mix(color, veinColor, veinMask * 0.78);

    // Controlled membrane translucency: opaque velvet borders & veins, glowing semi-translucent cells
    float cellAlpha = mix(0.97, 0.80, translucency * (1.0 - veinMask) * (1.0 - outerRim));
    float finalAlpha = clamp(alphaMask * cellAlpha, 0.0, 1.0);

    gl_FragColor = vec4(color, finalAlpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export interface WingShaderUniforms {
  [uniform: string]: THREE.IUniform<unknown>;
  uColorMap: THREE.IUniform<THREE.Texture>;
  uDataMap: THREE.IUniform<THREE.Texture>;
  uTime: THREE.IUniform<number>;
  uFlex: THREE.IUniform<number>;
  uTwist: THREE.IUniform<number>;
  uEdgeGlow: THREE.IUniform<number>;
  uColorShift: THREE.IUniform<number>;
  uShimmer: THREE.IUniform<number>;
  uPulse: THREE.IUniform<number>;
  uShaderDetail: THREE.IUniform<number>;
  uKeyLightDir: THREE.IUniform<THREE.Vector3>;
  uRimLightDir: THREE.IUniform<THREE.Vector3>;
}

export function createWingShaderMaterial(
  colorMap: THREE.Texture,
  dataMap: THREE.Texture
): THREE.ShaderMaterial {
  const uniforms: WingShaderUniforms = {
    uColorMap: { value: colorMap },
    uDataMap: { value: dataMap },
    uTime: { value: 0 },
    uFlex: { value: 0 },
    uTwist: { value: 0 },
    uEdgeGlow: { value: 0.24 },
    uColorShift: { value: 0 },
    uShimmer: { value: 0.18 },
    uPulse: { value: 0 },
    uShaderDetail: { value: 1.0 },
    uKeyLightDir: { value: new THREE.Vector3(2.2, 3.6, 3.8).normalize() },
    uRimLightDir: { value: new THREE.Vector3(-2.4, 1.4, -3.5).normalize() },
  };

  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: WING_VERTEX_SHADER,
    fragmentShader: WING_FRAGMENT_SHADER,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: true,
    toneMapped: true,
  });
}
