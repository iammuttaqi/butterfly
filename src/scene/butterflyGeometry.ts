/**
 * Procedural high-craft 3D butterfly geometry builders.
 *
 * Coordinate convention:
 * - Spine along Y (upright hero pose): head at +Y, abdomen extending toward -Y.
 * - Dorsal surface faces +Z (toward the viewer for an iconic, majestic full-wingspan view),
 *   while gentle 3D pitch/yaw flight turns reveal depth, camber, antennae, and ventral shimmer.
 * - Right wings extend along +X, Left wings mirrored along -X with corrected triangle winding.
 * - Wing geometries are rooted at x = 0 so their parent pivot groups sit directly
 *   at the anatomical thorax attachment points and flap naturally around the Y-axis!
 */

import * as THREE from 'three';

export interface WingOutlineSample {
  yLead: number;
  yTrail: number;
  camber: number;
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/**
 * Evaluates anatomical Forewing chord bounds along normalized span u in [0, 1].
 * Sculpted Morpho / Swallowtail hybrid: sweeping curved costal arch, graceful rounded
 * upper-outer apex, softly scalloped outer margin curving smoothly into the inner margin.
 */
export function sampleForewingSpan(u: number): WingOutlineSample {
  // Costal leading edge rises boldly upward from thorax (+0.18) to a graceful arched apex (+1.34)
  // then rounds organically at the outer tip (u -> 1)
  const arch = Math.sin(Math.pow(u, 0.72) * Math.PI * 0.68);
  const tipRound = Math.pow(Math.max(0, (u - 0.78) / 0.22), 2.15) * 0.66;
  const yLead = 0.18 + arch * 1.18 - tipRound;

  // Inner / posterior edge leaves thorax near -0.22, sweeps softly downward then curves
  // cleanly upward along the outer margin to meet the rounded apex smoothly
  const innerDip = -0.20 - Math.sin(Math.min(1, u * 1.35) * Math.PI * 0.75) * 0.26;
  const outerCurve = Math.pow(Math.max(0, (u - 0.36) / 0.64), 2.1) * 1.12;
  const scallop = u > 0.55 ? Math.sin((u - 0.55) * Math.PI * 8.0) * 0.018 * (1 - u) : 0;
  const yTrail = Math.min(yLead - 0.015, innerDip + outerCurve + scallop);

  // Subtle biological airfoil arch across wing span
  const camber = Math.sin(u * Math.PI) * 0.085;
  return { yLead, yTrail, camber };
}

/**
 * Evaluates anatomical Hindwing chord bounds along normalized span u in [0, 1].
 * Rounded fan silhouette tucked neatly beneath forewing with scalloped rear margin
 * and a delicate swallowtail lobe.
 */
export function sampleHindwingSpan(u: number): WingOutlineSample {
  // Leading edge tucks smoothly behind forewing inner edge
  const yLead = 0.04 - Math.pow(u, 1.3) * 0.34 + Math.sin(u * Math.PI) * 0.08;

  // Trailing edge hugs abdomen then opens into a rich rounded scalloped fan with subtle swallowtail
  const fan = -0.34 - Math.sin(Math.pow(u, 0.55) * Math.PI * 0.92) * 0.94;
  // Subtle elegant swallowtail accent near u = 0.42
  const tailLobe = Math.exp(-Math.pow((u - 0.40) / 0.085, 2)) * 0.24;
  const scallop = Math.sin(u * Math.PI * 6.0) * 0.024 * Math.sin(u * Math.PI);
  const outerClose = Math.pow(Math.max(0, (u - 0.68) / 0.32), 2.0) * 0.92;

  const yTrail = Math.min(yLead - 0.015, fan - tailLobe + scallop + outerClose);
  const camber = Math.sin(u * Math.PI) * 0.06;
  return { yLead, yTrail, camber };
}

/**
 * Builds a cambered, vein-corrugated 3D wing BufferGeometry rooted at x = 0.
 * Dorsal face points toward +Z; wings spread along +X (right) and -X (left).
 */
export function createWingGeometry(
  kind: 'forewing' | 'hindwing',
  side: 'left' | 'right',
  spanSegments = 30,
  chordSegments = 24
): THREE.BufferGeometry {
  const isLeft = side === 'left';
  const sign = isLeft ? -1 : 1;
  const maxSpan = kind === 'forewing' ? 2.12 : 1.44;
  // Offset hindwing slightly behind forewing along -Z so they layer cleanly without Z-fighting
  const zOffset = kind === 'forewing' ? 0.018 : -0.022;

  const cols = spanSegments + 1;
  const rows = chordSegments + 1;
  const vertCount = cols * rows;

  const positions = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);
  const spans = new Float32Array(vertCount);
  const chords = new Float32Array(vertCount);

  let ptr3 = 0;
  let ptr2 = 0;
  let ptr1 = 0;

  for (let i = 0; i <= spanSegments; i++) {
    const u = i / spanSegments;
    const sample = kind === 'forewing' ? sampleForewingSpan(u) : sampleHindwingSpan(u);

    // Smooth elliptical outer rounding so the tip never pinches into a sharp needle
    const xBase = Math.pow(u, 0.94) * maxSpan;

    for (let j = 0; j <= chordSegments; j++) {
      const v = j / chordSegments; // 0 = trailing edge, 1 = leading costal edge

      // Graceful convex bow along the outer margin
      const outerBow = Math.sin(v * Math.PI) * 0.14 * smoothstep(0.35, 1.0, u);
      const x = (xBase + outerBow) * sign;

      const y = sample.yTrail + (sample.yLead - sample.yTrail) * v;

      // 3D airfoil camber (+Z dorsal arch) + delicate vein corrugation
      const chordArch = Math.sin(v * Math.PI) * sample.camber;
      const costalSpar = Math.pow(v, 2.4) * 0.045 * Math.sin(u * Math.PI * 0.9);
      const veinRipple =
        Math.sin((v * 7.0 + u * 0.5) * Math.PI) * 0.009 * Math.sin(u * Math.PI) * Math.sin(v * Math.PI);
      const z = zOffset + chordArch + costalSpar + veinRipple;

      positions[ptr3++] = x;
      positions[ptr3++] = y;
      positions[ptr3++] = z;

      uvs[ptr2++] = u;
      uvs[ptr2++] = v;

      spans[ptr1] = u;
      chords[ptr1] = v;
      ptr1++;
    }
  }

  const indices: number[] = [];
  for (let i = 0; i < spanSegments; i++) {
    for (let j = 0; j < chordSegments; j++) {
      const a = i * rows + j;
      const b = (i + 1) * rows + j;
      const c = (i + 1) * rows + (j + 1);
      const d = i * rows + (j + 1);

      // Keep dorsal normals consistently facing +Z on both right (+X) and left (-X) wings
      if (isLeft) {
        indices.push(a, c, b, a, d, c);
      } else {
        indices.push(a, b, c, a, c, d);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setAttribute('aSpan', new THREE.BufferAttribute(spans, 1));
  geometry.setAttribute('aChord', new THREE.BufferAttribute(chords, 1));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Sculpted anatomical thorax aligned vertically along Y (head up).
 */
export function createThoraxGeometry(): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [];
  const steps = 20;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps; // 0 = waist, 1 = neck
    const y = (t - 0.5) * 0.52;
    const profile = Math.sin(t * Math.PI);
    const radius = 0.028 + Math.pow(profile, 0.72) * 0.105 * (1 - 0.1 * t);
    pts.push(new THREE.Vector2(radius, y));
  }
  const geo = new THREE.LatheGeometry(pts, 24);
  geo.scale(0.9, 1.0, 1.06); // Slight dorsal arch in Z
  geo.translate(0, 0.08, 0.01);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Sculpted 8-segment tapered butterfly abdomen extending gracefully downward along -Y.
 */
export function createAbdomenGeometry(): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [];
  const steps = 36;
  const length = 0.96;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps; // 0 = slender tail tip, 1 = waist
    const y = t * length;
    const baseEnvelope = Math.sin(Math.pow(t, 0.75) * Math.PI);
    const segmentRings = 1 + Math.sin(t * Math.PI * 16) * 0.042 * Math.sin(t * Math.PI);
    const radius = Math.max(0.004, (0.011 + baseEnvelope * 0.070) * segmentRings);
    pts.push(new THREE.Vector2(radius, y));
  }
  const geo = new THREE.LatheGeometry(pts, 22);
  // Subtle organic curve backward (-Z ventral curve) toward tail tip
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const norm = 1 - y / length;
    const curveBack = -norm * norm * 0.095;
    pos.setZ(i, z + curveBack);
  }
  geo.translate(0, -length - 0.13, -0.01);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Delicate curved antenna shaft + sculpted clubbed sensory tip reaching gracefully upward.
 */
export function createAntennaGeometry(side: 'left' | 'right'): {
  shaft: THREE.BufferGeometry;
  club: THREE.BufferGeometry;
} {
  const s = side === 'left' ? -1 : 1;
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.024 * s, 0.42, 0.03),
    new THREE.Vector3(0.095 * s, 0.62, 0.14),
    new THREE.Vector3(0.21 * s, 0.84, 0.24),
    new THREE.Vector3(0.34 * s, 1.03, 0.29),
    new THREE.Vector3(0.41 * s, 1.11, 0.26),
  ]);
  const shaft = new THREE.TubeGeometry(curve, 24, 0.0075, 7, false);

  const clubPts = [
    new THREE.Vector2(0.006, 0),
    new THREE.Vector2(0.014, 0.026),
    new THREE.Vector2(0.018, 0.062),
    new THREE.Vector2(0.012, 0.095),
    new THREE.Vector2(0.002, 0.11),
  ];
  const club = new THREE.LatheGeometry(clubPts, 10);
  const tipPos = curve.getPoint(1);
  const tipTan = curve.getTangent(1).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tipTan);
  club.applyQuaternion(q);
  club.translate(tipPos.x, tipPos.y, tipPos.z);

  return { shaft, club };
}

/**
 * Coiled proboscis spiral nestled beneath the butterfly's head (-Z ventral side).
 */
export function createProboscisGeometry(): THREE.BufferGeometry {
  const points: THREE.Vector3[] = [];
  const turns = 1.6;
  const count = 26;
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    const angle = t * Math.PI * 2 * turns;
    const r = 0.048 * (1 - t * 0.65);
    const y = 0.44 + Math.sin(angle) * r;
    const z = -0.04 - (1 - Math.cos(angle)) * r * 0.9 - t * 0.015;
    points.push(new THREE.Vector3(0, y, z));
  }
  const curve = new THREE.CatmullRomCurve3(points);
  return new THREE.TubeGeometry(curve, 26, 0.0055, 6, false);
}

/**
 * Three pairs of slender folded flight legs tucked gracefully against the ventral thorax (-Z).
 */
export function createLegsGeometry(): THREE.BufferGeometry[] {
  const legs: THREE.BufferGeometry[] = [];
  const yOffsets = [0.20, 0.08, -0.05];
  const spreads = [0.085, 0.11, 0.125];

  for (let pair = 0; pair < 3; pair++) {
    for (const s of [-1, 1]) {
      const y0 = yOffsets[pair];
      const sp = spreads[pair];
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.032 * s, y0, -0.055),
        new THREE.Vector3(sp * s, y0 - 0.03, -0.16),
        new THREE.Vector3((sp + 0.035) * s, y0 - 0.13, -0.24),
        new THREE.Vector3(sp * 0.65 * s, y0 - 0.24, -0.29),
      ]);
      legs.push(new THREE.TubeGeometry(curve, 12, 0.006, 5, false));
    }
  }
  return legs;
}
