/**
 * Logo FormaFuturo crisp: cristal da silhueta oficial + wordmark tipográfico.
 * Uso: node scripts/build-ff-crisp.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const src = path.join(root, "public", "brand", "formafuturo-logo-source.png");
const VB_W = 213;
const VB_H = 159;
const SCALE = 6;

function dilate(mask, w, h, passes) {
  let cur = mask;
  for (let p = 0; p < passes; p++) {
    const n = new Uint8Array(cur.length);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        let v = 0;
        for (let dy = -1; dy <= 1 && !v; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (cur[(y + dy) * w + (x + dx)]) v = 1;
          }
        }
        n[y * w + x] = v;
      }
    }
    cur = n;
  }
  return cur;
}

function erode(mask, w, h, passes) {
  let cur = mask;
  for (let p = 0; p < passes; p++) {
    const n = new Uint8Array(cur.length);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        let v = 1;
        for (let dy = -1; dy <= 1 && v; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (!cur[(y + dy) * w + (x + dx)]) v = 0;
          }
        }
        n[y * w + x] = v;
      }
    }
    cur = n;
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

function silhouette(mask, w, h, step = 2) {
  const left = [];
  const right = [];
  for (let y = 0; y < h; y += step) {
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
  const topY = left[0][1];
  const botY = left[left.length - 1][1];
  const top = [];
  const bot = [];
  for (let x = left[0][0]; x <= right[0][0]; x += step) {
    if (mask[topY * w + x]) top.push([x, topY]);
  }
  for (let x = right[right.length - 1][0]; x >= left[left.length - 1][0]; x -= step) {
    if (mask[botY * w + x]) bot.push([x, botY]);
  }
  return [...top, ...right.slice(1), ...bot.slice(1), ...left.slice(0, -1).reverse()];
}

function rdp(points, eps) {
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
    const d = Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
    if (d > maxD) {
      maxD = d;
      idx = i;
    }
  }
  if (maxD > eps) {
    const L = rdp(points.slice(0, idx + 1), eps);
    const R = rdp(points.slice(idx), eps);
    return L.slice(0, -1).concat(R);
  }
  return [points[0], points[points.length - 1]];
}

const { data, info } = await sharp(src)
  .resize({ width: VB_W * SCALE, height: VB_H * SCALE, kernel: "lanczos3" })
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const w = info.width;
const h = info.height;
const maxX = Math.floor(118 * SCALE);
const blue = new Uint8Array(w * h);
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a < 40 || x > maxX) continue;
    if (b > 130 && b > r + 25 && b >= g - 5 && r < 140 && g < 200) blue[y * w + x] = 1;
  }
}

const solid = fillHoles(erode(dilate(blue, w, h, 3), w, h, 2), w, h);
let pts = rdp(silhouette(solid, w, h, 2), 5);
const sx = VB_W / w;
const sy = VB_H / h;
const scaled = pts.map(([x, y]) => [Math.round(x * sx * 10) / 10, Math.round(y * sy * 10) / 10]);
if (
  scaled[0][0] !== scaled[scaled.length - 1][0] ||
  scaled[0][1] !== scaled[scaled.length - 1][1]
) {
  scaled.push([...scaled[0]]);
}
const crystal = `M ${scaled.map((p) => p.join(" ")).join(" L ")} Z`;

const raw = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = raw.info.width;
const H = raw.info.height;
let fMinX = W,
  fMaxX = 0,
  fMinY = H,
  fMaxY = 0;
let uMinX = W,
  uMaxX = 0,
  uMinY = H,
  uMaxY = 0;
for (let y = 45; y <= 95; y++) {
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    const r = raw.data[i];
    const g = raw.data[i + 1];
    const b = raw.data[i + 2];
    const a = raw.data[i + 3];
    if (a < 200) continue;
    if (r > 220 && g > 220 && b > 220) {
      fMinX = Math.min(fMinX, x);
      fMaxX = Math.max(fMaxX, x);
      fMinY = Math.min(fMinY, y);
      fMaxY = Math.max(fMaxY, y);
    } else if (g > 55 && r < 40 && b < 40) {
      uMinX = Math.min(uMinX, x);
      uMaxX = Math.max(uMaxX, x);
      uMinY = Math.min(uMinY, y);
      uMaxY = Math.max(uMaxY, y);
    }
  }
}

const fontSize = 34;
const baseline = 80;
const facets = [
  "M 34 18 L 98 88",
  "M 68 8 L 52 118",
  "M 28 55 L 105 62",
  "M 52 6 L 58 120",
  "M 18 78 L 108 48",
  "M 42 138 L 102 62",
];

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VB_W} ${VB_H}" role="img" aria-label="FormaFuturo">
  <defs>
    <linearGradient id="c" x1="8%" y1="0%" x2="92%" y2="100%">
      <stop offset="0%" stop-color="#2A84DC"/>
      <stop offset="50%" stop-color="#1974CD"/>
      <stop offset="100%" stop-color="#0C5CB0"/>
    </linearGradient>
  </defs>
  <path d="${crystal}" fill="url(#c)"/>
  <g fill="none" stroke="#F8FAFC" stroke-width="0.9" stroke-linecap="round" opacity="0.95">
    ${facets.map((d) => `<path d="${d}"/>`).join("\n    ")}
  </g>
  <g font-family="Arial Narrow, Helvetica Neue Condensed, Arial Black, Arial, sans-serif" font-weight="800" letter-spacing="-1">
    <text x="${fMinX}" y="${baseline}" font-size="${fontSize}" fill="#FFFFFF">Forma</text>
    <text x="${uMinX}" y="${baseline}" font-size="${fontSize}" fill="#005E00">Futuro</text>
  </g>
</svg>
`;

fs.writeFileSync(path.join(root, "public", "brand", "formafuturo-logo.svg"), svg);

await sharp(Buffer.from(svg), { density: 400 })
  .resize(1278, 954, { fit: "fill" })
  .png()
  .toFile(path.join(root, "public", "brand", "formafuturo-logo@2x.png"));

await sharp(Buffer.from(svg), { density: 300 })
  .resize(852, 636, { fit: "fill" })
  .png()
  .toFile(path.join(root, "public", "brand", "formafuturo-logo.png"));

await sharp(Buffer.from(svg), { density: 300 })
  .resize(720, Math.round((720 * VB_H) / VB_W), { fit: "fill" })
  .png()
  .toFile(path.join(root, "public", "brand", "formafuturo-logo-vector-preview.png"));

const ts = `/** Logo FormaFuturo vetorial (cristal da silhueta oficial + wordmark). */
export const FORMAFUTURO_TRACED_VIEWBOX = { width: ${VB_W}, height: ${VB_H} } as const;
export const FORMAFUTURO_TRACE_DURATION = 3.2;
export const FORMAFUTURO_LOGO_SRC = "/brand/formafuturo-logo.svg";
export const FORMAFUTURO_STRETCH_X = 1.42;
export const FORMAFUTURO_CRYSTAL_PATH = ${JSON.stringify(crystal)};
export const FORMAFUTURO_HEX_ENERGY_PATHS: string[] = [${JSON.stringify(crystal)}];
export const FORMAFUTURO_FACET_PATHS: string[] = ${JSON.stringify(facets)};
export const FORMAFUTURO_WORDMARK = {
  forma: { x: ${fMinX}, y: ${baseline}, fontSize: ${fontSize}, fill: "#FFFFFF" as const },
  futuro: { x: ${uMinX}, y: ${baseline}, fontSize: ${fontSize}, fill: "#005E00" as const },
};
export const FORMAFUTURO_LETTER_PATHS: string[] = [];
export const FORMAFUTURO_FUTURO_LETTER_PATHS: string[] = [];
export const FORMAFUTURO_ENERGY_PATHS: string[] = [...FORMAFUTURO_HEX_ENERGY_PATHS];
export const FORMAFUTURO_OUTLINE_PATH = FORMAFUTURO_HEX_ENERGY_PATHS[0] ?? "";
`;

fs.writeFileSync(path.join(root, "components", "brand", "formafuturo-logo-traced.ts"), ts);

console.log({
  crystalPts: scaled.length,
  forma: { fMinX, fMaxX, fMinY, fMaxY },
  futuro: { uMinX, uMaxX, uMinY, uMaxY },
});
