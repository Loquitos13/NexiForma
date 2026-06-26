/**
 * Gera SVG vetorial a partir do PNG oficial NexiForma.
 * Uso: node scripts/trace-nexiforma-logo.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import ImageTracer from "imagetracerjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const srcPng = path.join(root, "public", "nexiforma-logo-source.png");
const tmpPng = path.join(root, "public", "nexiforma-logo-trace-input.png");
const outSvg = path.join(root, "public", "nexiforma-logo.svg");
const outTs = path.join(root, "components", "brand", "nexiforma-logo-traced.ts");

async function preparePng() {
  const { data, info } = await sharp(srcPng).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
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
    const area = (maxX - minX) * (maxY - minY);
    const rgb = fill.match(/rgb\((\d+),(\d+),(\d+)\)/);
    const hex = rgb
      ? `#${[rgb[1], rgb[2], rgb[3]].map((n) => Number(n).toString(16).padStart(2, "0")).join("")}`
      : fill;
    const lum = rgb
      ? Number(rgb[1]) * 0.299 + Number(rgb[2]) * 0.587 + Number(rgb[3]) * 0.114
      : 128;
    paths.push({ d, fill: hex, lum, area });
  }
  return paths.sort((a, b) => b.area - a.area);
}

function buildSvg(paths, srcW, srcH) {
  const layers = paths
    .map(
      (p, i) =>
        `    <path id="layer-${i}" d="${p.d}" fill="${p.fill}" data-lum="${Math.round(p.lum)}" />`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${srcW} ${srcH}" width="${srcW}" height="${srcH}" role="img" aria-label="NexiForma NF">
  <g>
${layers}
  </g>
</svg>`;
}

function groupLayers(paths) {
  const layers = paths.filter((p) => p.area > 1000).sort((a, b) => a.lum - b.lum);
  return {
    renderPaths: layers,
    darkPath: layers[0] ?? null,
    midPath: layers[1] ?? null,
    lightPath: layers[2] ?? null,
  };
}

async function main() {
  const { width, height } = await preparePng();
  const imgd = await loadImageData(tmpPng);

  const raw = ImageTracer.imagedataToSVG(imgd, "posterized3");

  const allPaths = parsePaths(raw);
  const grouped = groupLayers(allPaths);
  const svg = buildSvg(grouped.renderPaths, width, height);

  fs.writeFileSync(outSvg, svg);

  const ts = `/** Gerado por scripts/trace-nexiforma-logo.mjs - não editar à mão. */
export const NEXIFORM_TRACED_VIEWBOX = { width: ${width}, height: ${height} } as const;

export type NexiformTracedLayer = { id: string; d: string; fill: string; role: "dark" | "mid" | "light" };

export const NEXIFORM_TRACED_LAYERS: NexiformTracedLayer[] = ${JSON.stringify(
    grouped.renderPaths.map((p, i) => ({
      id: `layer-${i}`,
      d: p.d,
      fill: p.fill,
      role: i === 0 ? "dark" : i === grouped.renderPaths.length - 1 ? "light" : "mid",
    })),
    null,
    2,
  )};
`;

  fs.writeFileSync(outTs, ts);
  console.log(`SVG: ${grouped.renderPaths.length} layers (${allPaths.length} raw paths)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
