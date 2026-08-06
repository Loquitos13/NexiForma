/**
 * Perímetro exterior do cluster (convex hull da silhueta sólida).
 * Uso: node scripts/extract-ff-hex-paths.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const srcPng = path.join(root, "public", "brand", "formafuturo-logo.png");
const outTs = path.join(root, "components", "brand", "formafuturo-logo-traced.ts");

function dilate(mask, w, h, passes) {
  let cur = mask;
  for (let p = 0; p < passes; p++) {
    const next = new Uint8Array(cur.length);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        let v = 0;
        for (let dy = -1; dy <= 1 && !v; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (cur[(y + dy) * w + (x + dx)]) {
              v = 1;
              break;
            }
          }
        }
        next[y * w + x] = v;
      }
    }
    cur = next;
  }
  return cur;
}

function erode(mask, w, h, passes) {
  let cur = mask;
  for (let p = 0; p < passes; p++) {
    const next = new Uint8Array(cur.length);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        let v = 1;
        for (let dy = -1; dy <= 1 && v; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (!cur[(y + dy) * w + (x + dx)]) {
              v = 0;
              break;
            }
          }
        }
        next[y * w + x] = v;
      }
    }
    cur = next;
  }
  return cur;
}

function fillHoles(mask, w, h) {
  const exterior = new Uint8Array(w * h);
  const q = [];
  const push = (x, y) => {
    const i = y * w + x;
    if (exterior[i] || mask[i]) return;
    exterior[i] = 1;
    q.push(i);
  };
  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }
  while (q.length) {
    const i = q.pop();
    const x = i % w;
    const y = (i / w) | 0;
    if (x > 0) push(x - 1, y);
    if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < h - 1) push(x, y + 1);
  }
  const filled = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) filled[i] = mask[i] || (!exterior[i] ? 1 : 0);
  return filled;
}

function padMask(mask, w, h, pad) {
  const pw = w + pad * 2;
  const ph = h + pad * 2;
  const out = new Uint8Array(pw * ph);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      out[(y + pad) * pw + (x + pad)] = mask[y * w + x];
    }
  }
  return { mask: out, w: pw, h: ph, pad };
}

/** Pontos de fronteira (sólido com vizinho vazio). */
function boundaryPoints(mask, w, h, step = 2) {
  const pts = [];
  for (let y = 1; y < h - 1; y += step) {
    for (let x = 1; x < w - 1; x += step) {
      if (!mask[y * w + x]) continue;
      let edge = false;
      for (let dy = -1; dy <= 1 && !edge; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          if (!mask[(y + dy) * w + (x + dx)]) {
            edge = true;
            break;
          }
        }
      }
      if (edge) pts.push([x, y]);
    }
  }
  return pts;
}

/** Andrew's monotone chain convex hull. */
function convexHull(points) {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length <= 2) return pts;

  const cross = (o, a, b) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

  const lower = [];
  for (const p of pts) {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0
    ) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0
    ) {
      upper.pop();
    }
    upper.push(p);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

/**
 * Contorno de silhueta (não convexo): left/right extremes por scanline,
 * depois simplify - segue o perfil real sem entrar no X.
 */
function silhouetteOutline(mask, w, h, rowStep = 2) {
  const left = [];
  const right = [];
  for (let y = 0; y < h; y += rowStep) {
    let minX = -1;
    let maxX = -1;
    const row = y * w;
    for (let x = 0; x < w; x++) {
      if (!mask[row + x]) continue;
      if (minX < 0) minX = x;
      maxX = x;
    }
    if (minX < 0) continue;
    left.push([minX, y]);
    right.push([maxX, y]);
  }
  if (left.length < 4) throw new Error("Silhueta vazia.");

  // Top edge: left-to-right on first row
  const topY = left[0][1];
  const top = [];
  for (let x = left[0][0]; x <= right[0][0]; x += rowStep) {
    if (mask[topY * w + x]) top.push([x, topY]);
  }

  // Bottom edge: right-to-left on last row
  const botY = left[left.length - 1][1];
  const bot = [];
  for (let x = right[right.length - 1][0]; x >= left[left.length - 1][0]; x -= rowStep) {
    if (mask[botY * w + x]) bot.push([x, botY]);
  }

  // Clockwise: top → right-down → bottom → left-up
  return [
    ...top,
    ...right.slice(1),
    ...bot.slice(1),
    ...left.slice(0, -1).reverse(),
  ];
}

function rdp(points, epsilon) {
  if (points.length < 3) return points;
  const [x1, y1] = points[0];
  const [x2, y2] = points[points.length - 1];
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy || 1;
  let maxD = 0;
  let idx = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const [x, y] = points[i];
    const t = ((x - x1) * dx + (y - y1) * dy) / len2;
    const px = x1 + t * dx;
    const py = y1 + t * dy;
    const d = Math.hypot(x - px, y - py);
    if (d > maxD) {
      maxD = d;
      idx = i;
    }
  }
  if (maxD > epsilon) {
    const left = rdp(points.slice(0, idx + 1), epsilon);
    const right = rdp(points.slice(idx), epsilon);
    return left.slice(0, -1).concat(right);
  }
  return [points[0], points[points.length - 1]];
}

function pointsToPath(points, sx, sy, pad) {
  const scaled = points.map(([x, y]) => [
    Math.round((x - pad) * sx * 10) / 10,
    Math.round((y - pad) * sy * 10) / 10,
  ]);
  const clean = [];
  for (const p of scaled) {
    const last = clean[clean.length - 1];
    if (last && Math.hypot(last[0] - p[0], last[1] - p[1]) < 0.2) continue;
    clean.push(p);
  }
  if (clean.length < 8) throw new Error(`Contorno curto: ${clean.length}`);
  const f = clean[0];
  const l = clean[clean.length - 1];
  if (f[0] !== l[0] || f[1] !== l[1]) clean.push([...f]);
  return `M ${clean.map((p) => p.join(" ")).join(" L ")} Z`;
}

async function main() {
  const scale = 4;
  const { data, info } = await sharp(srcPng)
    .resize({ width: 213 * scale, kernel: "lanczos3" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const sx = 213 / w;
  const sy = 159 / h;
  const pad = 6;

  const blue = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (w * y + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a < 40) continue;
      // Fill azul + arestas claras (fecha o X na silhueta)
      if (b > 100 && b > r + 15 && r < 140 && g > 40 && g < 200) {
        blue[y * w + x] = 1;
      }
    }
  }

  // Fecha gaps do X sem expandir demais a silhueta
  const closed = erode(dilate(blue, w, h, 3), w, h, 2);
  const padded = padMask(closed, w, h, pad);
  const solid = fillHoles(padded.mask, padded.w, padded.h);

  // Silhouette scanline = perfil real exterior (não corta pelo meio)
  let contour = silhouetteOutline(solid, padded.w, padded.h, 2);
  contour = rdp(contour, 2.5);

  // Se ficar demasiado irregular, fallback hull
  if (contour.length < 10) {
    const edge = boundaryPoints(solid, padded.w, padded.h, 3);
    contour = convexHull(edge);
  }

  const outerPath = pointsToPath(contour, sx, sy, pad);

  // Bounds check
  const nums = outerPath.match(/-?\d+\.?\d*/g).map(Number);
  let minX = 1e9;
  let maxX = -1e9;
  let minY = 1e9;
  let maxY = -1e9;
  for (let i = 0; i < nums.length; i += 2) {
    minX = Math.min(minX, nums[i]);
    maxX = Math.max(maxX, nums[i]);
    minY = Math.min(minY, nums[i + 1]);
    maxY = Math.max(maxY, nums[i + 1]);
  }

  const prev = fs.readFileSync(outTs, "utf8");
  const letterMatch = prev.match(
    /export const FORMAFUTURO_LETTER_PATHS: string\[\] = (\[[\s\S]*?\]);/,
  );
  if (!letterMatch) throw new Error("LETTER_PATHS não encontradas.");
  const stretchMatch = prev.match(/FORMAFUTURO_STRETCH_X = ([0-9.]+)/);
  const stretchX = stretchMatch ? stretchMatch[1] : "1.42";

  const ts = `/** Contornos FormaFuturo - letras + perímetro exterior limpo do cristal. */
export const FORMAFUTURO_TRACED_VIEWBOX = { width: 213, height: 159 } as const;
export const FORMAFUTURO_TRACE_DURATION = 3.2;
export const FORMAFUTURO_LOGO_SRC = "/brand/formafuturo-logo.png";
/** Alargamento horizontal do logo (corrige proporção do cristal). */
export const FORMAFUTURO_STRETCH_X = ${stretchX};

/** Contornos das letras (Forma + Futuro), L→R. */
export const FORMAFUTURO_LETTER_PATHS: string[] = ${letterMatch[1]};

/** Só «Futuro» (sem «Forma» - o cristal já tem energia própria). */
export const FORMAFUTURO_FUTURO_LETTER_PATHS: string[] =
  FORMAFUTURO_LETTER_PATHS.slice(5);

/** Perímetro exterior limpo do cluster de hexágonos (sem atalhos internos). */
export const FORMAFUTURO_HEX_ENERGY_PATHS: string[] = ${JSON.stringify([outerPath], null, 2)};

/** @deprecated Preferir FUTURO_LETTER + HEX separados. */
export const FORMAFUTURO_ENERGY_PATHS: string[] = [
  ...FORMAFUTURO_FUTURO_LETTER_PATHS,
  ...FORMAFUTURO_HEX_ENERGY_PATHS,
];

export const FORMAFUTURO_OUTLINE_PATH = FORMAFUTURO_FUTURO_LETTER_PATHS.join(" ");
`;

  fs.writeFileSync(outTs, ts);
  console.log({
    points: contour.length,
    bounds: {
      minX: +minX.toFixed(1),
      maxX: +maxX.toFixed(1),
      minY: +minY.toFixed(1),
      maxY: +maxY.toFixed(1),
    },
    preview: outerPath.slice(0, 140),
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
