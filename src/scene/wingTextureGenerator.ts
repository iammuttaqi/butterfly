/**
 * High-resolution procedural CanvasTexture generator for butterfly wing art & optical data maps.
 *
 * Art direction:
 * - Deep velvety midnight-obsidian outer borders & costal edges framing a jewel-like,
 *   luminous iridescent interior of royal violet, electric sapphire blue, radiant turquoise,
 *   ethereal lavender, soft rose-pink, and delicate gold dust highlights.
 * - Crisp branching anatomical wing venation & delicate pearlescent marginal lunules.
 * - Packed RGBA optical dataMap:
 *     R = vein skeleton mask
 *     G = iridescent photonic scale density (0 on dark velvet borders!)
 *     B = stained-glass membrane translucency
 *     A = crisp scalloped wing alpha mask
 */

import * as THREE from 'three';

export interface WingTextureSet {
  foreColor: THREE.CanvasTexture;
  foreData: THREE.CanvasTexture;
  hindColor: THREE.CanvasTexture;
  hindData: THREE.CanvasTexture;
  dispose: () => void;
}

interface CurveSpec {
  p0: [number, number];
  c1: [number, number];
  c2: [number, number];
  p1: [number, number];
  width: number;
}

function drawBezier(ctx: CanvasRenderingContext2D, c: CurveSpec, w: number, h: number): void {
  ctx.beginPath();
  ctx.moveTo(c.p0[0] * w, (1 - c.p0[1]) * h);
  ctx.bezierCurveTo(
    c.c1[0] * w,
    (1 - c.c1[1]) * h,
    c.c2[0] * w,
    (1 - c.c2[1]) * h,
    c.p1[0] * w,
    (1 - c.p1[1]) * h
  );
  ctx.lineWidth = c.width;
  ctx.stroke();
}

const FOREWING_VEINS: CurveSpec[] = [
  // Strong costal & subcostal spar
  { p0: [0.0, 0.78], c1: [0.30, 0.94], c2: [0.68, 0.96], p1: [0.97, 0.86], width: 12 },
  { p0: [0.0, 0.70], c1: [0.28, 0.85], c2: [0.62, 0.88], p1: [0.95, 0.78], width: 8 },
  // Discal cell upper & lower frame
  { p0: [0.0, 0.58], c1: [0.18, 0.67], c2: [0.38, 0.71], p1: [0.54, 0.69], width: 7.5 },
  { p0: [0.0, 0.44], c1: [0.18, 0.44], c2: [0.38, 0.47], p1: [0.53, 0.52], width: 7.0 },
  // Discal closure cross-vein
  { p0: [0.54, 0.69], c1: [0.56, 0.63], c2: [0.55, 0.57], p1: [0.53, 0.52], width: 6.0 },
  // Radiating radial & medial branches
  { p0: [0.46, 0.70], c1: [0.66, 0.78], c2: [0.83, 0.78], p1: [0.98, 0.73], width: 5.0 },
  { p0: [0.54, 0.69], c1: [0.72, 0.71], c2: [0.86, 0.68], p1: [0.99, 0.61], width: 4.8 },
  { p0: [0.55, 0.63], c1: [0.74, 0.61], c2: [0.87, 0.56], p1: [0.99, 0.49], width: 4.6 },
  { p0: [0.54, 0.57], c1: [0.73, 0.52], c2: [0.87, 0.44], p1: [0.99, 0.37], width: 4.5 },
  { p0: [0.53, 0.52], c1: [0.71, 0.43], c2: [0.85, 0.34], p1: [0.98, 0.25], width: 4.6 },
  // Cubital & anal veins
  { p0: [0.37, 0.46], c1: [0.58, 0.34], c2: [0.78, 0.24], p1: [0.96, 0.14], width: 4.8 },
  { p0: [0.22, 0.43], c1: [0.47, 0.25], c2: [0.72, 0.14], p1: [0.94, 0.06], width: 4.8 },
  { p0: [0.0, 0.26], c1: [0.26, 0.16], c2: [0.60, 0.07], p1: [0.90, 0.02], width: 5.5 },
];

const HINDWING_VEINS: CurveSpec[] = [
  { p0: [0.0, 0.86], c1: [0.34, 0.92], c2: [0.70, 0.90], p1: [0.97, 0.78], width: 9.0 },
  { p0: [0.0, 0.69], c1: [0.20, 0.74], c2: [0.40, 0.71], p1: [0.52, 0.63], width: 6.5 },
  { p0: [0.0, 0.52], c1: [0.20, 0.49], c2: [0.38, 0.45], p1: [0.49, 0.43], width: 6.2 },
  { p0: [0.52, 0.63], c1: [0.53, 0.56], c2: [0.51, 0.49], p1: [0.49, 0.43], width: 5.4 },
  { p0: [0.42, 0.72], c1: [0.66, 0.77], c2: [0.85, 0.74], p1: [0.98, 0.67], width: 4.8 },
  { p0: [0.52, 0.63], c1: [0.72, 0.63], c2: [0.88, 0.58], p1: [0.99, 0.51], width: 4.6 },
  { p0: [0.52, 0.54], c1: [0.72, 0.49], c2: [0.87, 0.42], p1: [0.98, 0.35], width: 4.6 },
  { p0: [0.49, 0.43], c1: [0.68, 0.34], c2: [0.83, 0.24], p1: [0.96, 0.19], width: 4.6 },
  { p0: [0.36, 0.46], c1: [0.49, 0.27], c2: [0.61, 0.13], p1: [0.75, 0.04], width: 5.2 },
  { p0: [0.22, 0.48], c1: [0.31, 0.26], c2: [0.37, 0.11], p1: [0.42, 0.02], width: 5.6 },
  { p0: [0.06, 0.38], c1: [0.13, 0.21], c2: [0.17, 0.09], p1: [0.23, 0.02], width: 4.6 },
];

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function paintWingTextures(
  kind: 'forewing' | 'hindwing',
  size = 1024,
  maxAnisotropy = 4
): { colorTex: THREE.CanvasTexture; dataTex: THREE.CanvasTexture } {
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const ctx = colorCanvas.getContext('2d')!;

  const dataCanvas = document.createElement('canvas');
  dataCanvas.width = size;
  dataCanvas.height = size;
  const dctx = dataCanvas.getContext('2d')!;

  // 1. Deep jewel-toned obsidian base
  ctx.fillStyle = '#090517';
  ctx.fillRect(0, 0, size, size);

  // Rich Morpho-inspired radial spectrum: deep violet -> electric blue -> turquoise -> lavender -> soft pink -> velvet border
  const mainGrad = ctx.createRadialGradient(
    size * 0.10,
    size * 0.48,
    size * 0.03,
    size * 0.44,
    size * 0.48,
    size * 0.80
  );
  if (kind === 'forewing') {
    mainGrad.addColorStop(0.0, '#140933'); // Deep obsidian violet root
    mainGrad.addColorStop(0.16, '#391ab8'); // Royal indigo-violet
    mainGrad.addColorStop(0.34, '#1b4ff2'); // Deep electric sapphire blue
    mainGrad.addColorStop(0.52, '#0fb8d6'); // Luminous jewel turquoise
    mainGrad.addColorStop(0.67, '#7c4cf0'); // Rich twilight lavender
    mainGrad.addColorStop(0.79, '#d65ca8'); // Soft glowing rose-pink band
    mainGrad.addColorStop(0.88, '#170a30'); // Deep velvety sub-margin
    mainGrad.addColorStop(1.0, '#080414'); // Obsidian velvet rim
  } else {
    mainGrad.addColorStop(0.0, '#12082e');
    mainGrad.addColorStop(0.18, '#461cc2');
    mainGrad.addColorStop(0.38, '#1d62f0');
    mainGrad.addColorStop(0.56, '#14c4cc');
    mainGrad.addColorStop(0.72, '#8d55f5');
    mainGrad.addColorStop(0.83, '#df6cb6');
    mainGrad.addColorStop(0.91, '#14092b');
    mainGrad.addColorStop(1.0, '#070412');
  }
  ctx.fillStyle = mainGrad;
  ctx.fillRect(0, 0, size, size);

  // Subtle golden photonic dust accent radiating along the discal cell
  const goldGrad = ctx.createRadialGradient(
    size * 0.50,
    size * 0.42,
    size * 0.02,
    size * 0.50,
    size * 0.42,
    size * 0.28
  );
  goldGrad.addColorStop(0.0, 'rgba(245, 198, 102, 0.55)');
  goldGrad.addColorStop(0.45, 'rgba(235, 168, 92, 0.20)');
  goldGrad.addColorStop(1.0, 'rgba(235, 168, 92, 0.0)');
  ctx.fillStyle = goldGrad;
  ctx.fillRect(0, 0, size, size);

  // Dramatic velvety dark obsidian-indigo outer & costal margin frame (iconic Morpho silhouette contrast)
  const outerBorder = ctx.createLinearGradient(size * 0.72, 0, size, 0);
  outerBorder.addColorStop(0.0, 'rgba(8, 4, 20, 0.0)');
  outerBorder.addColorStop(0.38, 'rgba(11, 6, 28, 0.78)');
  outerBorder.addColorStop(0.72, 'rgba(7, 4, 18, 0.96)');
  outerBorder.addColorStop(1.0, 'rgba(5, 3, 14, 1.0)');
  ctx.fillStyle = outerBorder;
  ctx.fillRect(size * 0.70, 0, size * 0.30, size);

  const costalBorder = ctx.createLinearGradient(0, 0, 0, size * 0.22);
  costalBorder.addColorStop(0.0, 'rgba(6, 3, 16, 0.98)');
  costalBorder.addColorStop(0.55, 'rgba(16, 9, 40, 0.68)');
  costalBorder.addColorStop(1.0, 'rgba(16, 9, 40, 0.0)');
  ctx.fillStyle = costalBorder;
  ctx.fillRect(0, 0, size, size * 0.24);

  // Delicate biological dark-velvet inner root shadowing
  const rootShade = ctx.createLinearGradient(0, 0, size * 0.16, 0);
  rootShade.addColorStop(0.0, 'rgba(8, 4, 20, 0.92)');
  rootShade.addColorStop(1.0, 'rgba(8, 4, 20, 0.0)');
  ctx.fillStyle = rootShade;
  ctx.fillRect(0, 0, size * 0.18, size);

  // Luminous marginal constellations, golden lunules, and hindwing eyespots
  if (kind === 'forewing') {
    const spots: Array<[number, number, number, string]> = [
      [0.84, 0.24, 0.024, '#f3ecff'],
      [0.88, 0.33, 0.020, '#9ef0ff'],
      [0.90, 0.43, 0.018, '#f9bce8'],
      [0.91, 0.54, 0.017, '#dcd2ff'],
      [0.90, 0.65, 0.016, '#8eeef5'],
      [0.88, 0.76, 0.015, '#ffd782'],
      [0.85, 0.86, 0.013, '#f7b3e0'],
    ];
    for (const [sx, sy, sr, col] of spots) {
      const gx = sx * size;
      const gy = sy * size;
      const r = sr * size;

      const glow = ctx.createRadialGradient(gx, gy, r * 0.1, gx, gy, r * 2.2);
      glow.addColorStop(0, col);
      glow.addColorStop(0.42, 'rgba(138, 98, 255, 0.35)');
      glow.addColorStop(1, 'rgba(138, 98, 255, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(gx, gy, r * 2.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.ellipse(gx, gy, r * 0.65, r * 1.15, -0.18, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // Jewelled iridescent eyespot ocelli (gold center -> turquoise ring -> violet halo)
    const ocelli: Array<[number, number, number]> = [
      [0.72, 0.34, 0.048],
      [0.74, 0.58, 0.056],
      [0.62, 0.80, 0.045],
    ];
    for (const [ox, oy, orad] of ocelli) {
      const cx = ox * size;
      const cy = oy * size;
      const r = orad * size;
      const ring = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
      ring.addColorStop(0.0, '#fff3d1');
      ring.addColorStop(0.24, '#f5ba56');
      ring.addColorStop(0.50, '#1ad4e6');
      ring.addColorStop(0.76, '#5c28d6');
      ring.addColorStop(1.0, 'rgba(10, 5, 26, 0)');
      ctx.fillStyle = ring;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Marginal rose-pink & turquoise-pearl crescents along scalloped hindwing rim
    for (let k = 0; k < 6; k++) {
      const t = (k + 0.5) / 6.2;
      const cx = (0.87 - Math.abs(t - 0.45) * 0.09) * size;
      const cy = (0.18 + t * 0.68) * size;
      ctx.fillStyle = k % 2 === 0 ? '#f6b3e0' : '#9cf2ff';
      ctx.beginPath();
      ctx.ellipse(cx, cy, size * 0.013, size * 0.026, 0.22, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Subtle concentric biological wing-scale rows
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.strokeStyle = '#bae6fd';
  ctx.lineWidth = 1.2;
  for (let r = 36; r < size * 1.1; r += 13) {
    ctx.beginPath();
    ctx.arc(size * 0.04, size * 0.52, r, -Math.PI * 0.46, Math.PI * 0.46);
    ctx.stroke();
  }
  ctx.restore();

  // Crisp branching anatomical veins with fine gold-dust rim highlights
  const veins = kind === 'forewing' ? FOREWING_VEINS : HINDWING_VEINS;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.strokeStyle = 'rgba(245, 196, 110, 0.34)';
  for (const v of veins) {
    drawBezier(ctx, { ...v, width: v.width * 1.6 }, size, size);
  }
  ctx.strokeStyle = 'rgba(9, 5, 22, 0.94)';
  for (const v of veins) {
    drawBezier(ctx, v, size, size);
  }

  // 2. Optical data map (R=veins, G=iridescence density, B=translucency, A=alpha)
  dctx.clearRect(0, 0, size, size);
  const dataGrad = dctx.createRadialGradient(
    size * 0.14,
    size * 0.48,
    size * 0.04,
    size * 0.44,
    size * 0.48,
    size * 0.78
  );
  dataGrad.addColorStop(0.0, 'rgb(30, 75, 50)');
  dataGrad.addColorStop(0.24, 'rgb(0, 230, 175)');
  dataGrad.addColorStop(0.64, 'rgb(0, 255, 210)');
  dataGrad.addColorStop(0.80, 'rgb(10, 120, 95)');
  dataGrad.addColorStop(0.90, 'rgb(25, 18, 22)'); // Matte velvet outer margin (no washout!)
  dataGrad.addColorStop(1.0, 'rgb(35, 10, 12)');
  dctx.fillStyle = dataGrad;
  dctx.fillRect(0, 0, size, size);

  // Darken iridescence along velvety costal border too
  const costalData = dctx.createLinearGradient(0, 0, 0, size * 0.18);
  costalData.addColorStop(0.0, 'rgba(20, 10, 12, 0.95)');
  costalData.addColorStop(1.0, 'rgba(20, 10, 12, 0.0)');
  dctx.fillStyle = costalData;
  dctx.fillRect(0, 0, size, size * 0.20);

  // Paint crisp veins into Red channel
  dctx.lineCap = 'round';
  dctx.lineJoin = 'round';
  dctx.strokeStyle = 'rgb(255, 25, 15)';
  for (const v of veins) {
    drawBezier(dctx, { ...v, width: v.width * 1.15 }, size, size);
  }

  // Smooth biological edge alpha fade at exact UV edges
  const imgData = dctx.getImageData(0, 0, size, size);
  const px = imgData.data;
  for (let y = 0; y < size; y++) {
    const vCoord = 1 - y / (size - 1);
    for (let x = 0; x < size; x++) {
      const uCoord = x / (size - 1);
      const idx = (y * size + x) * 4;

      const outerEdge = 1.0 - smoothstep(0.962, 0.998, uCoord);
      const leadEdge = 1.0 - smoothstep(0.972, 0.999, vCoord);
      const trailEdge = smoothstep(0.002, 0.028, vCoord);
      const rootEdge = smoothstep(0.0, 0.015, uCoord);

      px[idx + 3] = Math.round(outerEdge * leadEdge * trailEdge * rootEdge * 255);
    }
  }
  dctx.putImageData(imgData, 0, 0);

  const colorTex = new THREE.CanvasTexture(colorCanvas);
  colorTex.colorSpace = THREE.SRGBColorSpace;
  colorTex.anisotropy = maxAnisotropy;
  colorTex.needsUpdate = true;

  const dataTex = new THREE.CanvasTexture(dataCanvas);
  dataTex.colorSpace = THREE.NoColorSpace;
  dataTex.anisotropy = maxAnisotropy;
  dataTex.needsUpdate = true;

  return { colorTex, dataTex };
}

export function createWingTextureSet(maxAnisotropy = 4): WingTextureSet {
  const fore = paintWingTextures('forewing', 1024, maxAnisotropy);
  const hind = paintWingTextures('hindwing', 1024, maxAnisotropy);

  return {
    foreColor: fore.colorTex,
    foreData: fore.dataTex,
    hindColor: hind.colorTex,
    hindData: hind.dataTex,
    dispose: () => {
      fore.colorTex.dispose();
      fore.dataTex.dispose();
      hind.colorTex.dispose();
      hind.dataTex.dispose();
    },
  };
}
