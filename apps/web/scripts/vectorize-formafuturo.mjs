/**
 * Vectoriza o logo oficial FormaFuturo (cristal + tipografia) via ImageTracer.
 * Uso: node scripts/vectorize-formafuturo.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import ImageTracer from "imagetracerjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const srcPng = path.join(root, "public", "brand", "formafuturo-logo-source.png");
const outSvg = path.join(root, "public", "brand", "formafuturo-logo.svg");
const outPng = path.join(root, "public", "brand", "formafuturo-logo.png");
const outPng2x = path.join(root, "public", "brand", "formafuturo-logo@2x.png");
const outTs = path.join(root, "components", "brand", "formafuturo-logo-traced.ts");
const previewPng = path.join(root, "public", "brand", "formafuturo-logo-vector-preview.png");

const VB_W = 213;
const VB_H = 159;
const SCALE = 6;

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

function pointsToPath(points) {
  const clean = [];
  for (const p of points) {
    const last = clean[clean.length - 1];
    if (last && Math.hypot(last[0] - p[0], last[1] - p[1]) < 0.15) continue;
    clean.push(p);
  }
  if (clean.length < 4) throw new Error("Contorno curto");
  const f = clean[0];
  const l = clean[clean.length - 1];
  if (f[0] !== l[0] || f[1] !== l[1]) clean.push([...f]);
  return `M ${clean.map((p) => p.join(" ")).join(" L ")} Z`;
}

function parsePaths(svgRaw) {
  const paths = [];
  for (const m of svgRaw.matchAll(/<path\s([^>/]*)\/>/g)) {
    const attrs = m[1];
    const d = attrs.match(/\bd="([^"]+)"/)?.[1];
    const fill = attrs.match(/fill="([^"]+)"/)?.[1] ?? "#000";
    if (!d) continue;
    paths.push({ d, fill });
  }
  return paths;
}

function scalePath(d, sx, sy) {
  let i = 0;
  return d.replace(/-?\d+\.?\d*/g, (n) => {
    const v = Number(n);
    const out = i % 2 === 0 ? v * sx : v * sy;
    i += 1;
    return String(Math.round(out * 100) / 100);
  });
}

function pathArea(d) {
  const nums = d.match(/-?\d+\.?\d*/g)?.map(Number) ?? [];
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (let i = 0; i < nums.length; i += 2) {
    minX = Math.min(minX, nums[i]);
    maxX = Math.max(maxX, nums[i]);
    minY = Math.min(minY, nums[i + 1]);
    maxY = Math.max(maxY, nums[i + 1]);
  }
  return Math.max(0, maxX - minX) * Math.max(0, maxY - minY);
}

async function layerToPaths(rgba, w, h, color, opts = {}) {
  const imgd = { width: w, height: h, data: new Uint8ClampedArray(rgba) };
  const svg = ImageTracer.imagedataToSVG(imgd, {
    ltres: opts.ltres ?? 0.4,
    qtres: opts.qtres ?? 0.4,
    pathomit: opts.pathomit ?? 8,
    colorsampling: 0,
    numberofcolors: 2,
    blurradius: 0,
    blurdelta: 0,
    scale: 1,
    strokewidth: 0,
    viewbox: true,
  });
  const paths = parsePaths(svg)
    .filter((p) => !/^#0{3,6}$/i.test(p.fill) && p.fill !== "none")
    .map((p) => ({
      d: scalePath(p.d, VB_W / w, VB_H / h),
      fill: color,
      area: pathArea(scalePath(p.d, VB_W / w, VB_H / h)),
    }))
    .filter((p) => p.area > (opts.minArea ?? 4))
    .sort((a, b) => b.area - a.area);
  return paths;
}

async function main() {
  const { data, info } = await sharp(srcPng)
    .resize({ width: VB_W * SCALE, height: VB_H * SCALE, kernel: "lanczos3" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const maxCrystalX = Math.floor(118 * SCALE);

  const blue = new Uint8Array(w * h);
  const white = Buffer.alloc(w * h * 4);
  const green = Buffer.alloc(w * h * 4);
  const blueLayer = Buffer.alloc(w * h * 4);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      // transparente por defeito
      white[i + 3] = 0;
      green[i + 3] = 0;
      blueLayer[i + 3] = 0;
      if (a < 40) continue;

      const isWhite = r > 210 && g > 210 && b > 210;
      const isGreen = g > 55 && r < 45 && b < 45 && g > r + 40;
      const isBlue =
        x <= maxCrystalX && b > 130 && b > r + 25 && b >= g - 5 && r < 140 && g < 200;

      if (isWhite && y > h * 0.25 && y < h * 0.65) {
        // tipografia Forma (faixa vertical das letras; evita facetas)
        white[i] = 255;
        white[i + 1] = 255;
        white[i + 2] = 255;
        white[i + 3] = 255;
      } else if (isGreen) {
        green[i] = 0;
        green[i + 1] = 94;
        green[i + 2] = 0;
        green[i + 3] = 255;
      } else if (isBlue) {
        blue[y * w + x] = 1;
      }
    }
  }

  const solid = fillHoles(erode(dilate(blue, w, h, 3), w, h, 2), w, h);
  for (let p = 0; p < w * h; p++) {
    if (!solid[p]) continue;
    const i = p * 4;
    blueLayer[i] = 25;
    blueLayer[i + 1] = 116;
    blueLayer[i + 2] = 205;
    blueLayer[i + 3] = 255;
  }

  // Cristal: silhueta limpa (não ImageTracer - mais estável)
  let contour = silhouette(solid, w, h, 2);
  contour = rdp(contour, 5);
  const sx = VB_W / w;
  const sy = VB_H / h;
  const crystalPts = contour.map(([x, y]) => [
    Math.round(x * sx * 10) / 10,
    Math.round(y * sy * 10) / 10,
  ]);
  const crystalPath = pointsToPath(crystalPts);

  const formaPaths = await layerToPaths(white, w, h, "#FFFFFF", {
    pathomit: 4,
    minArea: 8,
    ltres: 0.35,
  });
  const futuroPaths = await layerToPaths(green, w, h, "#005E00", {
    pathomit: 4,
    minArea: 8,
    ltres: 0.35,
  });

  // Facetas: linhas brancas no cristal (fora da faixa tipográfica)
  const facetLayer = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      facetLayer[i + 3] = 0;
      if (a < 40 || x > maxCrystalX) continue;
      const isWhiteLine = r > 200 && g > 200 && b > 200;
      const inTextBand = y > h * 0.28 && y < h * 0.62 && x > w * 0.05 && x < w * 0.52;
      if (isWhiteLine && !inTextBand && solid[y * w + x]) {
        facetLayer[i] = facetLayer[i + 1] = facetLayer[i + 2] = 255;
        facetLayer[i + 3] = 255;
      }
    }
  }
  // dilatar linhas finas para o tracer apanhar
  const facetMask = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) if (facetLayer[p * 4 + 3] > 0) facetMask[p] = 1;
  const fat = dilate(facetMask, w, h, 1);
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    if (fat[p]) {
      facetLayer[i] = facetLayer[i + 1] = facetLayer[i + 2] = 255;
      facetLayer[i + 3] = 255;
    }
  }
  const facetPaths = await layerToPaths(facetLayer, w, h, "#F8FAFC", {
    pathomit: 2,
    minArea: 2,
    ltres: 0.5,
  });

  const svgParts = [];
  svgParts.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  svgParts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VB_W} ${VB_H}" role="img" aria-label="FormaFuturo">`,
  );
  svgParts.push(`  <defs>
    <linearGradient id="ffCrystal" x1="8%" y1="0%" x2="92%" y2="100%">
      <stop offset="0%" stop-color="#2A84DC"/>
      <stop offset="50%" stop-color="#1974CD"/>
      <stop offset="100%" stop-color="#0C5CB0"/>
    </linearGradient>
  </defs>`);
  svgParts.push(`  <path d="${crystalPath}" fill="url(#ffCrystal)"/>`);
  for (const p of facetPaths.slice(0, 40)) {
    svgParts.push(`  <path d="${p.d}" fill="#F8FAFC" fill-opacity="0.92"/>`);
  }
  for (const p of formaPaths) {
    svgParts.push(`  <path d="${p.d}" fill="#FFFFFF"/>`);
  }
  for (const p of futuroPaths) {
    svgParts.push(`  <path d="${p.d}" fill="#005E00"/>`);
  }
  svgParts.push(`</svg>`);
  const svg = svgParts.join("\n");
  fs.writeFileSync(outSvg, svg);

  await sharp(Buffer.from(svg), { density: 400 })
    .resize(VB_W * 8, VB_H * 8, { fit: "fill" })
    .png({ compressionLevel: 9 })
    .toFile(outPng2x);

  await sharp(Buffer.from(svg), { density: 300 })
    .resize(VB_W * 4, VB_H * 4, { fit: "fill" })
    .png({ compressionLevel: 9 })
    .toFile(outPng);

  await sharp(Buffer.from(svg), { density: 300 })
    .resize(720, Math.round((720 * VB_H) / VB_W), { fit: "fill" })
    .png()
    .toFile(previewPng);

  const ts = `/** Logo FormaFuturo vectorizado a partir do PNG oficial. */
export const FORMAFUTURO_TRACED_VIEWBOX = { width: ${VB_W}, height: ${VB_H} } as const;
export const FORMAFUTURO_TRACE_DURATION = 3.2;
/** SVG vetorial - escala sem pixelizar. */
export const FORMAFUTURO_LOGO_SRC = "/brand/formafuturo-logo.svg";
export const FORMAFUTURO_STRETCH_X = 1.42;

export const FORMAFUTURO_CRYSTAL_PATH = ${JSON.stringify(crystalPath)};

export const FORMAFUTURO_HEX_ENERGY_PATHS: string[] = [
  ${JSON.stringify(crystalPath)},
];

export const FORMAFUTURO_LETTER_PATHS: string[] = [];
export const FORMAFUTURO_FUTURO_LETTER_PATHS: string[] = [];
export const FORMAFUTURO_ENERGY_PATHS: string[] = [...FORMAFUTURO_HEX_ENERGY_PATHS];
export const FORMAFUTURO_OUTLINE_PATH = FORMAFUTURO_HEX_ENERGY_PATHS[0] ?? "";
`;
  fs.writeFileSync(outTs, ts);

  console.log({
    crystalPts: crystalPts.length,
    formaPaths: formaPaths.length,
    futuroPaths: futuroPaths.length,
    facetPaths: facetPaths.length,
    svgBytes: svg.length,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
