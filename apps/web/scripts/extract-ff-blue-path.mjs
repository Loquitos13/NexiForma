import sharp from "sharp";
import ImageTracer from "imagetracerjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "public", "brand", "formafuturo-logo.png");

const { data, info } = await sharp(src)
  .resize({ width: 639, kernel: "lanczos3" })
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const W = info.width;
const H = info.height;
const mask = new Uint8Array(W * H);

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = (W * y + x) * 4;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    mask[y * W + x] = a > 40 && b > 120 && b > r + 15 ? 1 : 0;
  }
}

// Dilate + erode (close) to fill letter holes and thin gaps
function dilate(src, passes) {
  let cur = src;
  for (let p = 0; p < passes; p++) {
    const next = new Uint8Array(cur.length);
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        let v = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (cur[(y + dy) * W + (x + dx)]) v = 1;
          }
        }
        next[y * W + x] = v;
      }
    }
    cur = next;
  }
  return cur;
}
function erode(src, passes) {
  let cur = src;
  for (let p = 0; p < passes; p++) {
    const next = new Uint8Array(cur.length);
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        let v = 1;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (!cur[(y + dy) * W + (x + dx)]) v = 0;
          }
        }
        next[y * W + x] = v;
      }
    }
    cur = next;
  }
  return cur;
}

const closed = erode(dilate(mask, 3), 3);
const rgba = Buffer.alloc(W * H * 4);
for (let i = 0; i < W * H; i++) {
  const on = closed[i];
  rgba[i * 4] = on ? 30 : 0;
  rgba[i * 4 + 1] = on ? 115 : 0;
  rgba[i * 4 + 2] = on ? 190 : 0;
  rgba[i * 4 + 3] = on ? 255 : 0;
}

const imgd = { width: W, height: H, data: new Uint8ClampedArray(rgba) };
const raw = ImageTracer.imagedataToSVG(imgd, {
  ltres: 1,
  qtres: 1,
  pathomit: 30,
  numberofcolors: 2,
  colorsampling: 0,
  mincolorratio: 0.02,
  colorquantcycles: 2,
  roundcoords: 1,
  viewbox: true,
});

const paths = [...raw.matchAll(/\bd="([^"]+)"/g)].map((m) => m[1]);
function area(d) {
  const nums = d.match(/-?\d+\.?\d*/g)?.map(Number) ?? [];
  let minX = 1e9,
    maxX = -1e9,
    minY = 1e9,
    maxY = -1e9;
  for (let i = 0; i < nums.length - 1; i += 2) {
    minX = Math.min(minX, nums[i]);
    maxX = Math.max(maxX, nums[i]);
    minY = Math.min(minY, nums[i + 1]);
    maxY = Math.max(maxY, nums[i + 1]);
  }
  return (maxX - minX) * (maxY - minY);
}
paths.sort((a, b) => area(b) - area(a));
const best = paths[0];
const sx = 213 / W;
const sy = 159 / H;

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

const scaled = scalePathXY(best, sx, sy);
console.log(scaled);
fs.writeFileSync(path.join(root, "public", "brand", "ff-blue-path.txt"), scaled);
