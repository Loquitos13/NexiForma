/**
 * Extrai contornos limpos: letras (L→R) e depois o perímetro exterior do hexágono.
 * Uso: node scripts/extract-ff-energy-paths.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import ImageTracer from "imagetracerjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const srcPng = path.join(root, "public", "brand", "formafuturo-logo.png");
const outTs = path.join(root, "components", "brand", "formafuturo-logo-traced.ts");

function pathArea(d) {
  const nums = d.match(/-?\d+\.?\d*/g)?.map(Number) ?? [];
  let minX = 1e9;
  let maxX = -1e9;
  let minY = 1e9;
  let maxY = -1e9;
  for (let i = 0; i < nums.length - 1; i += 2) {
    minX = Math.min(minX, nums[i]);
    maxX = Math.max(maxX, nums[i]);
    minY = Math.min(minY, nums[i + 1]);
    maxY = Math.max(maxY, nums[i + 1]);
  }
  return {
    area: Math.max(0, maxX - minX) * Math.max(0, maxY - minY),
    minX,
    maxX,
    minY,
    maxY,
    d,
  };
}

/** Só o primeiro subpath (contorno exterior); ignora buracos. */
function outerSubpath(d) {
  const z = d.search(/[Zz]/);
  if (z < 0) return d.trim();
  return d.slice(0, z + 1).trim();
}

function scalePathXY(d, sx, sy) {
  const parts = d.match(/[A-Za-z]|-?\d+\.?\d*/g) ?? [];
  let isX = true;
  let cmd = "";
  const out = [];
  for (const p of parts) {
    if (/^[A-Za-z]$/.test(p)) {
      out.push(p);
      cmd = p;
      isX = true;
      continue;
    }
    const v = Number(p);
    if (cmd.toUpperCase() === "V") {
      out.push(String(Math.round(v * sy * 10) / 10));
      continue;
    }
    if (cmd.toUpperCase() === "H") {
      out.push(String(Math.round(v * sx * 10) / 10));
      continue;
    }
    out.push(String(Math.round(v * (isX ? sx : sy) * 10) / 10));
    isX = !isX;
  }
  return out.join(" ");
}

function parsePaths(svgRaw) {
  return [...svgRaw.matchAll(/\bd="([^"]+)"/g)].map((m) => m[1]);
}

/** Preenche buracos interiores (flood fill a partir das bordas). */
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
  for (let i = 0; i < w * h; i++) {
    // Mantém a máscara + preenche só buracos fechados (não o espaço entre glifos)
    filled[i] = mask[i] || (!exterior[i] ? 1 : 0);
  }
  return filled;
}

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

function maskToRgba(mask, w, h) {
  const rgba = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const on = mask[i];
    rgba[i * 4] = on ? 255 : 0;
    rgba[i * 4 + 1] = on ? 255 : 0;
    rgba[i * 4 + 2] = on ? 255 : 0;
    rgba[i * 4 + 3] = on ? 255 : 0;
  }
  return rgba;
}

async function loadRaw(scale = 4) {
  return sharp(srcPng)
    .resize({ width: 213 * scale, kernel: "lanczos3" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
}

async function traceMask(mask, w, h, opts = {}) {
  const rgba = maskToRgba(mask, w, h);
  const imgd = { width: w, height: h, data: new Uint8ClampedArray(rgba) };
  const raw = ImageTracer.imagedataToSVG(imgd, {
    ltres: opts.ltres ?? 0.7,
    qtres: opts.qtres ?? 0.7,
    pathomit: opts.pathomit ?? 8,
    numberofcolors: 2,
    colorsampling: 0,
    mincolorratio: 0.01,
    colorquantcycles: 2,
    blurradius: 0,
    strokewidth: 0,
    roundcoords: 1,
    viewbox: true,
    desc: false,
  });
  return parsePaths(raw)
    .map((d) => pathArea(outerSubpath(d)))
    .filter((p) => p.area > (opts.minArea ?? 400))
    .sort((a, b) => b.area - a.area);
}

async function main() {
  const scale = 4;
  const { data, info } = await loadRaw(scale);
  const w = info.width;
  const h = info.height;
  const srcW = 213;
  const srcH = 159;
  const sx = srcW / w;
  const sy = srcH / h;

  const blue = new Uint8Array(w * h);
  const letters = new Uint8Array(w * h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (w * y + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a < 40) continue;

      // Hexágono azul (linhas claras internas entram no fill de buracos)
      const isBlue = b > 130 && b > r + 30 && r < 100 && g < 160;
      // Forma (branco) + Futuro (verde)
      const isWhite = r > 200 && g > 200 && b > 200;
      const isGreen = g > 70 && g > r + 40 && g > b + 40 && r < 90;
      const idx = y * w + x;
      if (isBlue) blue[idx] = 1;
      if (isWhite || isGreen) letters[idx] = 1;
    }
  }

  // Letras: fecha gaps e preenche counters (o, a) → 1 contorno por glifo
  const lettersSolid = fillHoles(erode(dilate(letters, w, h, 1), w, h, 1), w, h);
  // Hexágono: sólido sem buracos das letras brancas
  const blueSolid = fillHoles(erode(dilate(blue, w, h, 2), w, h, 1), w, h);

  const canvasArea = w * h;

  let letterPaths = await traceMask(lettersSolid, w, h, {
    pathomit: 4,
    minArea: 200,
    ltres: 0.4,
    qtres: 0.4,
  });

  // Rejeita blobs enormes / ruído; mantém glifos do wordmark
  letterPaths = letterPaths
    .filter((p) => p.area < canvasArea * 0.25)
    .filter((p) => p.maxY - p.minY > 20)
    .filter((p) => p.maxX - p.minX > 8);

  letterPaths.sort((a, b) => a.minX - b.minX || a.minY - b.minY);

  // Deduplicar paths quase coincidentes (mesmo centro)
  const deduped = [];
  for (const p of letterPaths) {
    const cx = (p.minX + p.maxX) / 2;
    const cy = (p.minY + p.maxY) / 2;
    const dup = deduped.some((q) => {
      const qx = (q.minX + q.maxX) / 2;
      const qy = (q.minY + q.maxY) / 2;
      return Math.hypot(cx - qx, cy - qy) < 12;
    });
    if (!dup) deduped.push(p);
  }

  const bluePaths = await traceMask(blueSolid, w, h, {
    pathomit: 12,
    minArea: 5000,
    ltres: 0.8,
    qtres: 0.8,
  });
  const hexPath = bluePaths.find((p) => p.area < canvasArea * 0.85) ?? bluePaths[0];

  const lettersScaled = deduped.slice(0, 16).map((p) => scalePathXY(p.d, sx, sy));
  if (!lettersScaled.length) throw new Error("Sem paths de letras.");
  if (!hexPath) throw new Error("Sem path do hexágono.");

  // Hex paths: manter vetor geométrico próprio já no ficheiro (não sobrescrever)
  let existingHex = null;
  let stretchX = 1.42;
  if (fs.existsSync(outTs)) {
    const prev = fs.readFileSync(outTs, "utf8");
    const hexMatch = prev.match(
      /export const FORMAFUTURO_HEX_ENERGY_PATHS: string\[\] = (\[[\s\S]*?\]);/,
    );
    const stretchMatch = prev.match(/FORMAFUTURO_STRETCH_X = ([0-9.]+)/);
    if (hexMatch) existingHex = hexMatch[1];
    if (stretchMatch) stretchX = Number(stretchMatch[1]) || stretchX;
  }

  const hexBlock =
    existingHex ??
    JSON.stringify(
      [
        "M 22 2 L 58 2 L 63 12 L 78 28 L 100 42 L 108 55 L 112 75 L 114 100 L 110 112 L 100 124 L 72 131 L 48 131 L 28 124 L 16 112 L 6 92 L 0 68 L 1 52 L 8 32 L 16 14 Z",
        "M 22 2 L 58 2 L 64 14 L 46 28 L 18 12 Z",
        "M 8 32 L 18 12 L 46 28 L 40 58 L 12 70 L 0 52 Z",
        "M 64 14 L 100 42 L 112 75 L 96 88 L 58 70 L 46 28 Z",
        "M 40 58 L 58 70 L 96 88 L 110 112 L 100 124 L 72 131 L 48 131 L 28 124 L 16 112 L 12 70 Z",
        "M 58 6 L 110 78",
        "M 46 10 L 10 72",
      ],
      null,
      2,
    );

  const ts = `/** Contornos FormaFuturo - letras (trace) + hexágonos (vetor próprio). */
export const FORMAFUTURO_TRACED_VIEWBOX = { width: ${srcW}, height: ${srcH} } as const;
export const FORMAFUTURO_TRACE_DURATION = 3.2;
export const FORMAFUTURO_LOGO_SRC = "/brand/formafuturo-logo.png";
/** Alargamento horizontal do logo (corrige proporção do cristal). */
export const FORMAFUTURO_STRETCH_X = ${stretchX};

/** Contornos das letras (Forma + Futuro), L→R. */
export const FORMAFUTURO_LETTER_PATHS: string[] = ${JSON.stringify(lettersScaled, null, 2)};

/** Vetor próprio dos hexágonos / cristal (perímetro + facetas + X). */
export const FORMAFUTURO_HEX_ENERGY_PATHS: string[] = ${hexBlock};

/** @deprecated Preferir LETTER + HEX separados. */
export const FORMAFUTURO_ENERGY_PATHS: string[] = [
  ...FORMAFUTURO_LETTER_PATHS,
  ...FORMAFUTURO_HEX_ENERGY_PATHS,
];

export const FORMAFUTURO_OUTLINE_PATH = FORMAFUTURO_LETTER_PATHS.join(" ");
`;

  fs.writeFileSync(outTs, ts);
  console.log({
    letters: lettersScaled.length,
    hexArea: Math.round(hexPath.area * sx * sy),
    stretchX,
    letterBoxes: deduped.slice(0, 12).map((p) => ({
      x: Math.round(p.minX * sx),
      y: Math.round(p.minY * sy),
      w: Math.round((p.maxX - p.minX) * sx),
      h: Math.round((p.maxY - p.minY) * sy),
    })),
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
