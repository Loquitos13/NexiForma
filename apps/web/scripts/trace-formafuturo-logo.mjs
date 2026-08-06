/**
 * Gera SVG vetorial a partir do PNG FormaFuturo.
 * Uso: node scripts/trace-formafuturo-logo.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import ImageTracer from "imagetracerjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const srcPng = path.join(root, "public", "brand", "formafuturo-logo.png");
const tmpPng = path.join(root, "public", "brand", "formafuturo-logo-trace-input.png");
const outSvg = path.join(root, "public", "brand", "formafuturo-logo.svg");
const outTs = path.join(root, "components", "brand", "formafuturo-logo-traced.ts");

async function preparePng() {
  // Upscale for cleaner tracing of thin network lines + text.
  const { data, info } = await sharp(srcPng)
    .resize({ width: 852, height: 636, fit: "fill", kernel: "lanczos3" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // fundo preto → transparente
    if (r < 28 && g < 28 && b < 28) {
      data[i + 3] = 0;
    }
  }

  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toFile(tmpPng);

  return { width: info.width, height: info.height };
}

async function loadImageData(pngPath) {
  const { data, info } = await sharp(pngPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return {
    width: info.width,
    height: info.height,
    data: new Uint8ClampedArray(data),
  };
}

function parsePaths(svgRaw) {
  const paths = [];
  for (const m of svgRaw.matchAll(/<path\s([^>]+)\/>/g)) {
    const attrs = m[1];
    const d = attrs.match(/\bd="([^"]+)"/)?.[1];
    const fill = attrs.match(/fill="([^"]+)"/)?.[1] ?? "#888888";
    const opacity = Number(attrs.match(/opacity="([^"]+)"/)?.[1] ?? 1);
    if (!d || opacity < 0.05) continue;

    const nums = d.match(/-?\d+\.?\d*/g)?.map(Number) ?? [];
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < nums.length - 1; i += 2) {
      minX = Math.min(minX, nums[i]);
      maxX = Math.max(maxX, nums[i]);
      minY = Math.min(minY, nums[i + 1]);
      maxY = Math.max(maxY, nums[i + 1]);
    }
    const area = Math.max(0, maxX - minX) * Math.max(0, maxY - minY);
    const rgb = fill.match(/rgb\((\d+),(\d+),(\d+)\)/);
    const hex = rgb
      ? `#${[rgb[1], rgb[2], rgb[3]].map((n) => Number(n).toString(16).padStart(2, "0")).join("")}`
      : fill;
    const r = rgb ? Number(rgb[1]) : 128;
    const g = rgb ? Number(rgb[2]) : 128;
    const b = rgb ? Number(rgb[3]) : 128;
    const lum = r * 0.299 + g * 0.587 + b * 0.114;
    paths.push({ d, fill: hex, lum, area, r, g, b });
  }
  return paths.sort((a, b) => b.area - a.area);
}

function classifyRole(p) {
  // azul do polígono
  if (p.b > 140 && p.b > p.r + 40 && p.b > p.g) return "blue";
  // verde "Futuro"
  if (p.g > 60 && p.g > p.r + 20 && p.g >= p.b) return "green";
  // branco / linhas claras
  if (p.lum > 180) return "white";
  // ciano claro das linhas
  if (p.b > 150 && p.g > 120 && p.r < 200) return "line";
  return "other";
}

function buildSvg(paths, srcW, srcH) {
  const layers = paths
    .map(
      (p, i) =>
        `    <path id="layer-${i}" d="${p.d}" fill="${p.fill}" data-role="${p.role}" />`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${srcW} ${srcH}" width="${srcW}" height="${srcH}" role="img" aria-label="FormaFuturo">
  <g>
${layers}
  </g>
</svg>`;
}

async function main() {
  const { width, height } = await preparePng();
  const imgd = await loadImageData(tmpPng);

  const raw = ImageTracer.imagedataToSVG(imgd, {
    ltres: 0.8,
    qtres: 0.8,
    pathomit: 4,
    colorsampling: 0,
    numberofcolors: 8,
    mincolorratio: 0.01,
    colorquantcycles: 3,
    blurradius: 0,
    blurdelta: 20,
    strokewidth: 0,
    linefilter: false,
    scale: 1,
    roundcoords: 1,
    viewbox: true,
    desc: false,
  });

  const allPaths = parsePaths(raw)
    .filter((p) => p.area > 80)
    .map((p) => ({ ...p, role: classifyRole(p) }))
    .filter((p) => p.role !== "other" || p.area > 2000);

  // Ordenar: azul (fundo) → verde → branco/linhas
  const order = { blue: 0, green: 1, white: 2, line: 3, other: 4 };
  allPaths.sort((a, b) => (order[a.role] ?? 9) - (order[b.role] ?? 9) || b.area - a.area);

  const svg = buildSvg(allPaths, width, height);
  fs.writeFileSync(outSvg, svg);

  // Paths para animação de energia: contorno do azul + contornos grandes do texto
  const energyCandidates = allPaths
    .filter((p) => p.role === "blue" || p.role === "green" || (p.role === "white" && p.area > 800))
    .slice(0, 4);

  const ts = `/** Gerado por scripts/trace-formafuturo-logo.mjs - não editar à mão. */
export const FORMAFUTURO_TRACED_VIEWBOX = { width: ${width}, height: ${height} } as const;
export const FORMAFUTURO_TRACE_DURATION = 2;

export type FormaFuturoTracedLayer = {
  id: string;
  d: string;
  fill: string;
  role: "blue" | "green" | "white" | "line" | "other";
};

export const FORMAFUTURO_TRACED_LAYERS: FormaFuturoTracedLayer[] = ${JSON.stringify(
    allPaths.map((p, i) => ({
      id: `layer-${i}`,
      d: p.d,
      fill: p.fill,
      role: p.role,
    })),
    null,
    2,
  )};

/** Contornos usados pelo vetor de energia animado. */
export const FORMAFUTURO_ENERGY_PATHS: string[] = ${JSON.stringify(
    energyCandidates.map((p) => p.d),
    null,
    2,
  )};
`;

  fs.writeFileSync(outTs, ts);
  console.log(
    `SVG: ${allPaths.length} layers (energy: ${energyCandidates.length}) ${width}x${height}`,
  );
  console.log(
    "roles:",
    allPaths.reduce((acc, p) => {
      acc[p.role] = (acc[p.role] || 0) + 1;
      return acc;
    }, {}),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
