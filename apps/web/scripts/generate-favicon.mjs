/**
 * Gera favicon SVG animado (logo NF) + PNGs PWA a partir do traçado oficial.
 * Uso: node scripts/generate-favicon.mjs
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const publicDir = path.join(root, "public");
const appDir = path.join(root, "app");
const tracedPath = path.join(root, "components", "brand", "nexiforma-logo-traced.ts");

const VIEWBOX = { width: 992, height: 706 };
const ICON_SIZE = 512;
const TRACE_DURATION = 2;

const ENERGY = {
  trailColor: "#EC4899",
  trailOpacity: 0.38,
  trailDash: "26 74",
  beamDash: "20 80",
  headColor: "#FFF1F5",
  headDash: "6 94",
  trailWidth: 12,
  beamWidth: 6,
  headWidth: 3.2,
  trailBlur: 5,
  glowBlur: 2.2,
};

async function loadLayers() {
  const ts = await readFile(tracedPath, "utf8");
  const layers = [];
  for (const m of ts.matchAll(
    /\{\s*"id": "([^"]+)",\s*"d": "([^"]+)",\s*"fill": "[^"]+",\s*"role": "([^"]+)"\s*\}/g,
  )) {
    layers.push({ id: m[1], d: m[2], role: m[3] });
  }
  if (layers.length < 2) throw new Error("Não foi possível ler NEXIFORM_TRACED_LAYERS.");
  return layers;
}

function logoTransform() {
  const pad = 0.84;
  const scale = Math.min((ICON_SIZE * pad) / VIEWBOX.width, (ICON_SIZE * pad) / VIEWBOX.height);
  const tx = ICON_SIZE / 2 - (VIEWBOX.width / 2) * scale;
  const ty = ICON_SIZE / 2 - (VIEWBOX.height / 2) * scale;
  return `translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${scale.toFixed(4)})`;
}

const EMBEDDED_CSS = `
  /* Logo sempre visível no favicon (CSS pode não correr na tab) */
  .nf-fill { opacity: 1; }
  .nf-trail, .nf-beam, .nf-head {
    stroke-dashoffset: 100;
    animation-duration: ${TRACE_DURATION}s;
    animation-timing-function: linear;
    animation-iteration-count: infinite;
  }
  .nf-trail--0 { animation-name: nf-trail-0; }
  .nf-beam--0 { animation-name: nf-beam-0; }
  .nf-head--0 { animation-name: nf-head-0; }
  .nf-trail--1 { animation-name: nf-trail-1; }
  .nf-beam--1 { animation-name: nf-beam-1; }
  .nf-head--1 { animation-name: nf-head-1; }
  @keyframes nf-trail-0 {
    0% { stroke-dashoffset: 100; opacity: 0; }
    3% { opacity: ${ENERGY.trailOpacity}; }
    52% { stroke-dashoffset: 0; opacity: ${ENERGY.trailOpacity}; }
    58%, 100% { stroke-dashoffset: 0; opacity: 0; }
  }
  @keyframes nf-beam-0 {
    0% { stroke-dashoffset: 100; opacity: 0; }
    2% { opacity: 1; }
    52% { stroke-dashoffset: 0; opacity: 1; }
    58%, 100% { stroke-dashoffset: 0; opacity: 0; }
  }
  @keyframes nf-head-0 {
    0% { stroke-dashoffset: 100; opacity: 0; }
    2% { opacity: 1; }
    50% { stroke-dashoffset: 0; opacity: 1; }
    56%, 100% { stroke-dashoffset: 0; opacity: 0; }
  }
  @keyframes nf-trail-1 {
    0%, 47% { stroke-dashoffset: 100; opacity: 0; }
    50% { opacity: ${ENERGY.trailOpacity}; }
    98% { stroke-dashoffset: 0; opacity: ${ENERGY.trailOpacity}; }
    100% { stroke-dashoffset: 0; opacity: 0; }
  }
  @keyframes nf-beam-1 {
    0%, 47% { stroke-dashoffset: 100; opacity: 0; }
    50% { opacity: 1; }
    98% { stroke-dashoffset: 0; opacity: 1; }
    100% { stroke-dashoffset: 0; opacity: 0; }
  }
  @keyframes nf-head-1 {
    0%, 47% { stroke-dashoffset: 100; opacity: 0; }
    50% { opacity: 1; }
    96% { stroke-dashoffset: 0; opacity: 1; }
    100% { stroke-dashoffset: 0; opacity: 0; }
  }
  @media (prefers-reduced-motion: reduce) {
    .nf-trail, .nf-beam, .nf-head { stroke-dashoffset: 0; opacity: 0; }
  }
`;

function fillRef(role) {
  if (role === "light") return "url(#nf-light)";
  if (role === "mid") return "url(#nf-mid)";
  return "url(#nf-dark)";
}

function buildDefs() {
  return `
    <linearGradient id="nf-dark" x1="4%" y1="96%" x2="96%" y2="8%">
      <stop offset="0%" stop-color="#1E1B4B"/>
      <stop offset="45%" stop-color="#4338CA"/>
      <stop offset="100%" stop-color="#6D28D9"/>
    </linearGradient>
    <linearGradient id="nf-mid" x1="10%" y1="90%" x2="90%" y2="10%">
      <stop offset="0%" stop-color="#5B21B6" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="#7C3AED" stop-opacity="0.75"/>
    </linearGradient>
    <linearGradient id="nf-light" x1="8%" y1="88%" x2="92%" y2="8%">
      <stop offset="0%" stop-color="#A78BFA" stop-opacity="0.9"/>
      <stop offset="55%" stop-color="#DDD6FE"/>
      <stop offset="100%" stop-color="#EDE9FE" stop-opacity="0.95"/>
    </linearGradient>
    <linearGradient id="nf-energy" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#BE185D" stop-opacity="0.15"/>
      <stop offset="55%" stop-color="#F472B6" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="#FDF2F8" stop-opacity="1"/>
    </linearGradient>
    <filter id="nf-trail-glow" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="${ENERGY.trailBlur}" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="nf-glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="${ENERGY.glowBlur}" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>`;
}

function buildFills(layers) {
  return layers
    .map(
      (layer) =>
        `<path d="${layer.d}" fill="${fillRef(layer.role)}" class="nf-fill"/>`,
    )
    .join("\n      ");
}

function buildEnergy(layers) {
  return layers
    .map(
      (layer, i) => `
      <g>
        <path class="nf-trail nf-trail--${i}" d="${layer.d}" fill="none" stroke="${ENERGY.trailColor}"
          stroke-width="${ENERGY.trailWidth}" stroke-linecap="round" stroke-linejoin="round"
          pathLength="100" stroke-dasharray="${ENERGY.trailDash}" opacity="${ENERGY.trailOpacity}"
          filter="url(#nf-trail-glow)"/>
        <path class="nf-beam nf-beam--${i}" d="${layer.d}" fill="none" stroke="url(#nf-energy)"
          stroke-width="${ENERGY.beamWidth}" stroke-linecap="round" stroke-linejoin="round"
          pathLength="100" stroke-dasharray="${ENERGY.beamDash}" filter="url(#nf-glow)"/>
        <path class="nf-head nf-head--${i}" d="${layer.d}" fill="none" stroke="${ENERGY.headColor}"
          stroke-width="${ENERGY.headWidth}" stroke-linecap="round" stroke-linejoin="round"
          pathLength="100" stroke-dasharray="${ENERGY.headDash}" filter="url(#nf-glow)"/>
      </g>`,
    )
    .join("");
}

function buildAnimatedIcon(layers) {
  const transform = logoTransform();
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ICON_SIZE} ${ICON_SIZE}" width="${ICON_SIZE}" height="${ICON_SIZE}" role="img" aria-label="NexiForma">
  <style>${EMBEDDED_CSS}</style>
  <defs>${buildDefs()}</defs>
  <g transform="${transform}">
    <g class="nf-reveal">
      ${buildFills(layers)}
      ${buildEnergy(layers)}
    </g>
  </g>
</svg>`;
}

function buildStaticIcon(layers) {
  const transform = logoTransform();
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ICON_SIZE} ${ICON_SIZE}" width="${ICON_SIZE}" height="${ICON_SIZE}" role="img" aria-label="NexiForma">
  <defs>${buildDefs()}</defs>
  <g transform="${transform}">
    ${buildFills(layers)}
  </g>
</svg>`;
}

async function rasterizePng(svg, size) {
  return sharp(Buffer.from(svg))
    .resize(size, size)
    .ensureAlpha()
    .png({ compressionLevel: 9, force: true })
    .toBuffer();
}

const layers = await loadLayers();
const animatedSvg = buildAnimatedIcon(layers);
const staticSvg = buildStaticIcon(layers);

await writeFile(path.join(appDir, "icon0.svg"), animatedSvg, "utf8");
await writeFile(path.join(publicDir, "nexiforma-favicon.svg"), animatedSvg, "utf8");
await writeFile(path.join(publicDir, "icon-static.svg"), staticSvg, "utf8");
console.log("Gerado app/icon0.svg (animado)");
console.log("Gerado public/nexiforma-favicon.svg (animado)");
console.log("Gerado public/icon-static.svg");

const png32 = await rasterizePng(staticSvg, 32);
await sharp(png32).toFile(path.join(appDir, "icon1.png"));
await sharp(png32).toFile(path.join(publicDir, "favicon-32.png"));
console.log("Gerado app/icon1.png (transparente)");
console.log("Gerado public/favicon-32.png (transparente)");

for (const size of [16, 192, 512]) {
  const out = path.join(publicDir, size === 16 ? "favicon-16.png" : `icon-${size}.png`);
  const buf = await rasterizePng(staticSvg, size);
  await sharp(buf).toFile(out);
  console.log(`Gerado ${out} (transparente)`);
}

await sharp(png32).toFile(path.join(appDir, "favicon.ico"));
console.log("Gerado app/favicon.ico");

const png180 = await rasterizePng(staticSvg, 180);
await sharp(png180).toFile(path.join(appDir, "apple-icon.png"));
console.log("Gerado app/apple-icon.png (transparente)");
