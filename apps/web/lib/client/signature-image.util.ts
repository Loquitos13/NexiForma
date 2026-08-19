export type SignatureProcessOptions = {
  /** 0–255; só usar para ajuste fino manual. Omitir = detecção automática. */
  threshold?: number;
  /** Reforço de contraste da tinta (1 = sem alteração). */
  contrast?: number;
  paddingPx?: number;
};

export type SignatureProcessResult = {
  blob: Blob;
  /** Limiar estimado (útil para ajuste fino opcional). -1 = PNG já transparente. */
  autoThreshold: number;
  /** Imagem importada já tinha canal alpha (ex.: PNG exportado). */
  alreadyTransparent?: boolean;
};

type Rgb = { r: number; g: number; b: number };

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível ler a imagem."));
    };
    img.src = url;
  });
}

function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function pixelAt(data: Uint8ClampedArray, width: number, x: number, y: number): Rgb {
  const i = (y * width + x) * 4;
  return { r: data[i]!, g: data[i + 1]!, b: data[i + 2]! };
}

function colorDistance(a: Rgb, b: Rgb): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

/** Estima a cor do papel/fundo a partir das bordas da imagem. */
function estimateBackgroundColor(data: Uint8ClampedArray, width: number, height: number): Rgb {
  const strip = Math.max(2, Math.min(14, Math.floor(Math.min(width, height) * 0.05)));
  const samples: Rgb[] = [];

  for (let y = 0; y < strip; y++) {
    for (let x = 0; x < width; x++) {
      samples.push(pixelAt(data, width, x, y));
      samples.push(pixelAt(data, width, x, height - 1 - y));
    }
  }
  for (let x = 0; x < strip; x++) {
    for (let y = 0; y < height; y++) {
      samples.push(pixelAt(data, width, x, y));
      samples.push(pixelAt(data, width, width - 1 - x, y));
    }
  }

  return {
    r: median(samples.map((s) => s.r)),
    g: median(samples.map((s) => s.g)),
    b: median(samples.map((s) => s.b)),
  };
}

/** Tolerância de cor adaptada à variação do fundo (sombras, iluminação). */
function estimateColorTolerance(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  bg: Rgb,
): number {
  const strip = Math.max(2, Math.min(14, Math.floor(Math.min(width, height) * 0.05)));
  const dists: number[] = [];

  for (let y = 0; y < strip; y++) {
    for (let x = 0; x < width; x++) {
      dists.push(colorDistance(pixelAt(data, width, x, y), bg));
      dists.push(colorDistance(pixelAt(data, width, x, height - 1 - y), bg));
    }
  }

  dists.sort((a, b) => a - b);
  const p85 = dists[Math.floor(dists.length * 0.85)] ?? 22;
  return Math.max(20, Math.min(58, p85 + 14));
}

function isSimilarToBackground(p: Rgb, bg: Rgb, tolerance: number): boolean {
  const dist = colorDistance(p, bg);
  if (dist <= tolerance) return true;
  const lum = luminance(p.r, p.g, p.b);
  const bgLum = luminance(bg.r, bg.g, bg.b);
  return lum >= bgLum - 10 && dist <= tolerance * 1.75;
}

/** Flood fill a partir das bordas: remove fundo ligado ao exterior (inclui sombras). */
function buildBorderBackgroundMask(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  bg: Rgb,
  tolerance: number,
): Uint8Array {
  const mask = new Uint8Array(width * height);
  const queue = new Int32Array(width * height * 2);
  let head = 0;
  let tail = 0;

  const enqueue = (x: number, y: number) => {
    const idx = y * width + x;
    if (mask[idx]) return;
    if (!isSimilarToBackground(pixelAt(data, width, x, y), bg, tolerance)) return;
    mask[idx] = 1;
    queue[tail++] = x;
    queue[tail++] = y;
  };

  for (let x = 0; x < width; x++) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }

  while (head < tail) {
    const x = queue[head++]!;
    const y = queue[head++]!;
    if (x > 0) enqueue(x - 1, y);
    if (x < width - 1) enqueue(x + 1, y);
    if (y > 0) enqueue(x, y - 1);
    if (y < height - 1) enqueue(x, y + 1);
  }

  return mask;
}

function estimateInkThreshold(bg: Rgb, tolerance: number): number {
  const bgLum = luminance(bg.r, bg.g, bg.b);
  return Math.max(95, bgLum - Math.max(38, tolerance * 0.85));
}

/** 0 = papel; 1 = tinta densa - preserva anti-alias nas bordas. */
function computeInkStrength(lum: number, bgLum: number, inkThreshold: number): number {
  if (lum >= bgLum - 4) return 0;
  const range = Math.max(24, bgLum - inkThreshold);
  return Math.max(0, Math.min(1, (bgLum - lum) / range));
}

/** Mantém a cor original (caneta azul/preta) com escurecimento leve opcional. */
function preserveForegroundPixel(
  data: Uint8ClampedArray,
  i: number,
  inkStrength: number,
  contrast: number,
): void {
  if (inkStrength < 0.05) {
    data[i + 3] = 0;
    return;
  }

  const r = data[i]!;
  const g = data[i + 1]!;
  const b = data[i + 2]!;

  const darken = Math.min(0.28, Math.max(0, (contrast - 1) * inkStrength * 0.45));
  data[i] = Math.round(r * (1 - darken));
  data[i + 1] = Math.round(g * (1 - darken));
  data[i + 2] = Math.round(b * (1 - darken));
  data[i + 3] = Math.round(Math.min(255, 255 * inkStrength));
}

/** Suaviza bordas (alpha) para reduzir aspecto serrilhado/pixelizado. */
function featherAlphaChannel(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  radius = 1,
): void {
  const alphas = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    alphas[i] = data[i * 4 + 3]!;
  }

  const blurred = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          sum += alphas[ny * width + nx]!;
          count++;
        }
      }
      blurred[y * width + x] = count ? sum / count : 0;
    }
  }

  for (let i = 0; i < width * height; i++) {
    data[i * 4 + 3] = Math.round(blurred[i]!);
  }
}

/** Evita assinaturas minúsculas que ficam pixelizadas ao ampliar no PDF. */
function upscaleCanvasIfSmall(canvas: HTMLCanvasElement, minLongEdge = 520): HTMLCanvasElement {
  const long = Math.max(canvas.width, canvas.height);
  if (long >= minLongEdge) return canvas;

  const scale = minLongEdge / long;
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(canvas.width * scale));
  out.height = Math.max(1, Math.round(canvas.height * scale));
  const ctx = out.getContext("2d", { alpha: true });
  if (!ctx) return canvas;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(canvas, 0, 0, out.width, out.height);
  return out;
}

function removeBackgroundAutomatic(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  contrast: number,
): number {
  const bg = estimateBackgroundColor(data, width, height);
  const tolerance = estimateColorTolerance(data, width, height, bg);
  const borderBg = buildBorderBackgroundMask(data, width, height, bg, tolerance);
  const inkThreshold = estimateInkThreshold(bg, tolerance);
  const bgLum = luminance(bg.r, bg.g, bg.b);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const i = idx * 4;
      const p = pixelAt(data, width, x, y);
      const lum = luminance(p.r, p.g, p.b);
      const dist = colorDistance(p, bg);
      const strength = computeInkStrength(lum, bgLum, inkThreshold);
      const isBorderBg = borderBg[idx] === 1;
      const isPaper =
        isBorderBg ||
        (lum >= inkThreshold && dist <= tolerance * 1.35) ||
        (lum >= bgLum - 6 && dist <= tolerance);
      const isInk = lum < inkThreshold || dist > tolerance * 2.2;

      if (isPaper && !isInk && strength < 0.08) {
        data[i + 3] = 0;
        continue;
      }

      preserveForegroundPixel(data, i, strength, contrast);
    }
  }

  return Math.round(inkThreshold);
}

function removeBackgroundManual(
  data: Uint8ClampedArray,
  threshold: number,
  contrast: number,
): void {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    const lum = luminance(r, g, b);
    const strength = Math.max(0, Math.min(1, (threshold - lum) / Math.max(18, threshold * 0.42)));

    if (strength < 0.05) {
      data[i + 3] = 0;
      continue;
    }

    preserveForegroundPixel(data, i, strength, contrast);
  }
}

/** PNG/ficheiro já com transparência significativa - evita reprocessar a tinta. */
function hasSignificantTransparency(data: Uint8ClampedArray, width: number, height: number): boolean {
  const total = width * height;
  if (total === 0) return false;
  let soft = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i]! < 235) soft++;
  }
  return soft / total > 0.06;
}

const ACCEPTED_SIGNATURE_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);

export function isAcceptedSignatureImageFile(file: File): boolean {
  return ACCEPTED_SIGNATURE_MIME.has(file.type);
}

/** Remove fundo e exporta PNG transparente (assinatura + nome). */
export async function processSignatureImageFile(
  file: File,
  opts: SignatureProcessOptions = {},
): Promise<Blob> {
  const result = await processSignatureImageFileDetailed(file, opts);
  return result.blob;
}

export async function processSignatureImageFileDetailed(
  file: File,
  opts: SignatureProcessOptions = {},
): Promise<SignatureProcessResult> {
  const img = await loadImageFromFile(file);
  return processSignatureImageElementDetailed(img, opts);
}

export async function processSignatureImageElement(
  img: HTMLImageElement,
  opts: SignatureProcessOptions = {},
): Promise<Blob> {
  const result = await processSignatureImageElementDetailed(img, opts);
  return result.blob;
}

export async function processSignatureImageElementDetailed(
  img: HTMLImageElement,
  opts: SignatureProcessOptions = {},
): Promise<SignatureProcessResult> {
  const contrast = opts.contrast ?? 1.05;
  const paddingPx = opts.paddingPx ?? 8;

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) throw new Error("Canvas indisponível.");

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data, width, height } = imageData;

  const alreadyTransparent =
    opts.threshold == null && hasSignificantTransparency(data, width, height);

  let autoThreshold: number;
  if (alreadyTransparent) {
    autoThreshold = -1;
  } else if (opts.threshold != null) {
    removeBackgroundManual(data, opts.threshold, contrast);
    featherAlphaChannel(data, width, height, 1);
    autoThreshold = opts.threshold;
  } else {
    autoThreshold = removeBackgroundAutomatic(data, width, height, contrast);
    featherAlphaChannel(data, width, height, 1);
  }

  ctx.putImageData(imageData, 0, 0);
  let trimmed = trimTransparentCanvas(canvas, paddingPx);
  trimmed = upscaleCanvasIfSmall(trimmed);
  const blob = await canvasToPngBlob(trimmed);
  return { blob, autoThreshold, alreadyTransparent };
}

function trimTransparentCanvas(source: HTMLCanvasElement, padding: number): HTMLCanvasElement {
  const ctx = source.getContext("2d");
  if (!ctx) return source;
  const { width, height } = source;
  const pixels = ctx.getImageData(0, 0, width, height).data;

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = pixels[(y * width + x) * 4 + 3]!;
      if (alpha > 12) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX < minX || maxY < minY) return source;

  const cropW = maxX - minX + 1 + padding * 2;
  const cropH = maxY - minY + 1 + padding * 2;
  const out = document.createElement("canvas");
  out.width = cropW;
  out.height = cropH;
  const outCtx = out.getContext("2d");
  if (!outCtx) return source;
  outCtx.imageSmoothingEnabled = true;
  outCtx.imageSmoothingQuality = "high";
  outCtx.drawImage(
    source,
    minX,
    minY,
    maxX - minX + 1,
    maxY - minY + 1,
    padding,
    padding,
    maxX - minX + 1,
    maxY - minY + 1,
  );
  return out;
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Falha ao exportar PNG."))),
      "image/png",
    );
  });
}

/** Pré-visualização com remoção automática de fundo. */
export async function previewSignatureDataUrl(
  file: File,
  opts: SignatureProcessOptions = {},
): Promise<string> {
  const blob = await processSignatureImageFile(file, opts);
  return URL.createObjectURL(blob);
}
