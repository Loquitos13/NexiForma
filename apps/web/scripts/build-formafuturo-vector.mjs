/**
 * Logo FormaFuturo vetorial (cristal + tipografia) → SVG + PNG hi-DPI transparente.
 * Uso: node scripts/build-formafuturo-vector.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outSvg = path.join(root, "public", "brand", "formafuturo-logo.svg");
const outPng = path.join(root, "public", "brand", "formafuturo-logo.png");
const outPng2x = path.join(root, "public", "brand", "formafuturo-logo@2x.png");
const tracedTs = path.join(root, "components", "brand", "formafuturo-logo-traced.ts");

/** Perímetro geométrico do cristal - arestas longas (sem escadas de pixel). */
const CRYSTAL =
  "M 22.2 1 L 57.8 1 L 63.2 6.8 L 65.5 14.5 L 68.5 24 L 82 30.8 L 98.5 38.5 L 107.2 46 L 110.5 58 L 112.5 78 L 114 96 L 115.2 112 L 109.5 122.5 L 99.5 137 L 92.5 149 L 87 158 L 78.8 156.5 L 58.5 146 L 49.2 140.5 L 45.8 132.5 L 44.5 123.8 L 22.2 123.3 L 14.5 113 L 6.5 93 L 1.8 73 L 0.6 58.5 L 6.2 33 L 13.8 13 L 22.2 1 Z";

/** Energia: mesmo perímetro, ligeiramente expandido para o stroke ficar por fora. */
const CRYSTAL_ENERGY =
  "M 21.5 0.4 L 58.4 0.4 L 64.2 6.2 L 66.6 14.2 L 69.6 23.6 L 83 30.4 L 99.4 38.2 L 108.4 45.8 L 112 58 L 114 78 L 115.5 96 L 116.5 112.2 L 110.5 123.2 L 100.2 138 L 93 150 L 87.2 159 L 78.2 157.4 L 57.8 146.6 L 48.4 141 L 44.8 133 L 43.6 123.6 L 21.5 123 L 13.5 112.4 L 5.4 92.2 L 0.8 72.2 L -0.4 58 L 5.4 32.2 L 13.2 12 L 21.5 0.4 Z";

const FACETS = [
  "M 36 16 L 104 94",
  "M 70 6 L 46 120",
  "M 26 52 L 110 68",
  "M 54 3 L 54 122",
  "M 16 74 L 112 46",
  "M 40 142 L 108 58",
  "M 78 22 L 64 130",
];

const VB_W = 300;
const VB_H = 159;

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VB_W} ${VB_H}" role="img" aria-label="FormaFuturo">
  <defs>
    <linearGradient id="crystal" x1="6%" y1="0%" x2="94%" y2="100%">
      <stop offset="0%" stop-color="#2B86DE"/>
      <stop offset="40%" stop-color="#1974CD"/>
      <stop offset="100%" stop-color="#0A5AAD"/>
    </linearGradient>
  </defs>

  <path d="${CRYSTAL}" fill="url(#crystal)"/>
  <g fill="none" stroke="#F8FAFC" stroke-width="1.05" stroke-linecap="round" stroke-linejoin="round" opacity="0.9">
    ${FACETS.map((d) => `<path d="${d}"/>`).join("\n    ")}
  </g>

  <g font-family="Arial Black, Impact, Arial Narrow, Arial, Helvetica, sans-serif" font-weight="900" letter-spacing="-1.2">
    <text x="13" y="80" font-size="34" fill="#FFFFFF">Forma</text>
    <text x="122" y="80" font-size="34" fill="#005E00">Futuro</text>
  </g>
</svg>
`;

fs.writeFileSync(outSvg, svg);

const scale = 4;
await sharp(Buffer.from(svg), { density: 300 })
  .resize(VB_W * scale, VB_H * scale, { fit: "fill" })
  .png({ compressionLevel: 9 })
  .toFile(outPng2x);

await sharp(Buffer.from(svg), { density: 300 })
  .resize(VB_W * 2, VB_H * 2, { fit: "fill" })
  .png({ compressionLevel: 9 })
  .toFile(outPng);

const ts = `/** Contornos FormaFuturo - perímetro geométrico do cristal (sem energia nas letras). */
export const FORMAFUTURO_TRACED_VIEWBOX = { width: ${VB_W}, height: ${VB_H} } as const;
export const FORMAFUTURO_TRACE_DURATION = 3.2;
/** SVG vetorial - escala sem pixelizar. */
export const FORMAFUTURO_LOGO_SRC = "/brand/formafuturo-logo.svg";
/** Proporção nativa do wordmark. */
export const FORMAFUTURO_STRETCH_X = 1;

/** @deprecated Letras já não têm energia animada. */
export const FORMAFUTURO_LETTER_PATHS: string[] = [];
export const FORMAFUTURO_FUTURO_LETTER_PATHS: string[] = [];

/** Perímetro geométrico limpo do cristal (arestas longas). */
export const FORMAFUTURO_HEX_ENERGY_PATHS: string[] = [
  ${JSON.stringify(CRYSTAL_ENERGY)},
];

export const FORMAFUTURO_ENERGY_PATHS: string[] = [...FORMAFUTURO_HEX_ENERGY_PATHS];
export const FORMAFUTURO_OUTLINE_PATH = FORMAFUTURO_HEX_ENERGY_PATHS[0] ?? "";
export const FORMAFUTURO_CRYSTAL_PATH = ${JSON.stringify(CRYSTAL)};
`;

fs.writeFileSync(tracedTs, ts);

console.log({
  svg: path.relative(root, outSvg),
  png: path.relative(root, outPng),
  png2x: path.relative(root, outPng2x),
  traced: path.relative(root, tracedTs),
});
