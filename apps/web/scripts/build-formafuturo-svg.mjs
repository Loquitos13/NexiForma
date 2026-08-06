/**
 * SVG FormaFuturo: imagem PNG + contorno vectorial limpo para animação de energia.
 * Uso: node scripts/build-formafuturo-svg.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import ImageTracer from "imagetracerjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const srcPng = path.join(root, "public", "brand", "formafuturo-logo.png");
const outSvg = path.join(root, "public", "brand", "formafuturo-logo.svg");
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
  };
}

async function traceSilhouette() {
  // Upscale + flatten logo pixels to solid white on transparent for clean outer contour.
  const { data, info } = await sharp(srcPng)
    .resize({ width: 852, kernel: "lanczos3" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const out = Buffer.from(data);
  for (let i = 0; i < out.length; i += 4) {
    const r = out[i];
    const g = out[i + 1];
    const b = out[i + 2];
    const a = out[i + 3];
    const isLogo = a > 40 && r + g + b > 50;
    if (isLogo) {
      out[i] = 255;
      out[i + 1] = 255;
      out[i + 2] = 255;
      out[i + 3] = 255;
    } else {
      out[i] = 0;
      out[i + 1] = 0;
      out[i + 2] = 0;
      out[i + 3] = 0;
    }
  }

  // Small blur + rethreshold to merge thin gaps before tracing.
  const blurred = await sharp(out, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .blur(0.8)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const solid = Buffer.from(blurred.data);
  for (let i = 0; i < solid.length; i += 4) {
    const a = solid[i + 3];
    const lum = solid[i] + solid[i + 1] + solid[i + 2];
    if (a > 80 && lum > 200) {
      solid[i] = 255;
      solid[i + 1] = 255;
      solid[i + 2] = 255;
      solid[i + 3] = 255;
    } else {
      solid[i] = 0;
      solid[i + 1] = 0;
      solid[i + 2] = 0;
      solid[i + 3] = 0;
    }
  }

  const imgd = {
    width: info.width,
    height: info.height,
    data: new Uint8ClampedArray(solid),
  };

  const raw = ImageTracer.imagedataToSVG(imgd, {
    ltres: 0.6,
    qtres: 0.6,
    pathomit: 20,
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

  const paths = [...raw.matchAll(/\bd="([^"]+)"/g)].map((m) => m[1]);
  const ranked = paths
    .map((d) => ({ d, ...pathArea(d) }))
    .sort((a, b) => b.area - a.area);

  if (!ranked[0]) throw new Error("Silhueta não encontrada.");

  // Escala de volta para o tamanho do PNG fonte (213×159).
  const srcMeta = await sharp(srcPng).metadata();
  const srcW = srcMeta.width ?? 213;
  const srcH = srcMeta.height ?? 159;
  const sx = srcW / info.width;
  const sy = srcH / info.height;

  const outline = scalePathXY(ranked[0].d, sx, sy);
  return { outline, width: srcW, height: srcH, area: ranked[0].area * sx * sy };
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

async function main() {
  const { outline, width, height } = await traceSilhouette();

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="FormaFuturo">
  <image href="/brand/formafuturo-logo.png" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet"/>
  <path id="ff-outline" d="${outline}" fill="none" stroke="#38BDF8" stroke-width="1.5"/>
</svg>
`;
  fs.writeFileSync(outSvg, svg);

  const ts = `/** Gerado por scripts/build-formafuturo-svg.mjs - contorno para animação de energia. */
export const FORMAFUTURO_TRACED_VIEWBOX = { width: ${width}, height: ${height} } as const;
export const FORMAFUTURO_TRACE_DURATION = 2;

/** Contorno exterior do logo (vetor) - usado pelo stroke de energia. */
export const FORMAFUTURO_OUTLINE_PATH = ${JSON.stringify(outline)};

export const FORMAFUTURO_LOGO_SRC = "/brand/formafuturo-logo.png";
`;

  fs.writeFileSync(outTs, ts);
  console.log(`OK ${width}x${height}, outline chars=${outline.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
