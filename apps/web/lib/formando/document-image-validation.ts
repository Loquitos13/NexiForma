import { ID1_ASPECT } from "@/lib/formando/document-layouts";

export const DOC_ACCEPT_MIMES = ["image/jpeg", "image/png"] as const;
export const DOC_MAX_BYTES = 10 * 1024 * 1024;
export const DOC_MIN_BYTES = 15 * 1024;

/** Proporção ID-1 (ISO 7810) - margem para enquadramento imperfecto. */
const ID1_RATIO_MIN = 1.42;
const ID1_RATIO_MAX = 1.78;

const MIN_WIDTH = 480;
const MIN_HEIGHT = 300;

/** Nitidez mínima (variância Laplaciana normalizada). */
const MIN_SHARPNESS = 70;
const MIN_LUMINANCE_STD = 22;
const MIN_MEAN_LUMINANCE = 32;
const MAX_MEAN_LUMINANCE = 245;

export type ValidacaoDocumento = {
  ok: boolean;
  erros: string[];
};

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
      reject(new Error("decode"));
    };
    img.src = url;
  });
}

function sampleToCanvas(img: HTMLImageElement, maxWidth = 640): HTMLCanvasElement {
  const scale = Math.min(1, maxWidth / img.width);
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(img, 0, 0, w, h);
  return canvas;
}

/** Variância do Laplaciano - valor baixo indica imagem desfocada. */
function laplacianVariance(imageData: ImageData): number {
  const { data, width, height } = imageData;
  const gray = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    gray[i] = 0.299 * data[o]! + 0.587 * data[o + 1]! + 0.114 * data[o + 2]!;
  }
  let sum = 0;
  let sumSq = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const lap =
        -gray[i - width]! -
        gray[i - 1]! +
        4 * gray[i]! -
        gray[i + 1]! -
        gray[i + width]!;
      sum += lap;
      sumSq += lap * lap;
      count++;
    }
  }
  if (count === 0) return 0;
  const mean = sum / count;
  return sumSq / count - mean * mean;
}

function luminanceStats(imageData: ImageData): { mean: number; std: number } {
  const { data } = imageData;
  const n = data.length / 4;
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) {
    sum += 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
  }
  const mean = sum / n;
  let varSum = 0;
  for (let i = 0; i < data.length; i += 4) {
    const l = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
    varSum += (l - mean) ** 2;
  }
  return { mean, std: Math.sqrt(varSum / n) };
}

function validarFormatoFicheiro(file: File): string[] {
  const erros: string[] = [];
  const mime = file.type.toLowerCase();
  if (!DOC_ACCEPT_MIMES.includes(mime as (typeof DOC_ACCEPT_MIMES)[number])) {
    erros.push("Formato não suportado. Usa JPEG ou PNG.");
  }
  if (file.size > DOC_MAX_BYTES) {
    erros.push("Ficheiro demasiado grande (máximo 10 MB).");
  }
  if (file.size < DOC_MIN_BYTES) {
    erros.push("Ficheiro demasiado pequeno - a imagem pode estar corrompida ou ilegível.");
  }
  return erros;
}

function validarDimensoesEProporcao(
  width: number,
  height: number,
  validarProporcao: boolean,
): string[] {
  const erros: string[] = [];
  const w = Math.max(width, height);
  const h = Math.min(width, height);

  if (w < MIN_WIDTH || h < MIN_HEIGHT) {
    erros.push(
      `Resolução insuficiente (mínimo ${MIN_WIDTH}×${MIN_HEIGHT} px). Aproxima-te do documento ou usa uma câmara com melhor qualidade.`,
    );
  }

  if (validarProporcao) {
    const ratio = w / h;
    if (ratio < ID1_RATIO_MIN || ratio > ID1_RATIO_MAX) {
      erros.push(
        `Proporção incorrecta para cartão ID-1 (esperado ~${ID1_ASPECT.toFixed(2)}:1). Enquadra todo o documento em formato horizontal.`,
      );
    }
  }

  return erros;
}

function validarLegibilidade(imageData: ImageData): string[] {
  const erros: string[] = [];
  const sharpness = laplacianVariance(imageData);
  const { mean, std } = luminanceStats(imageData);

  if (sharpness < MIN_SHARPNESS) {
    erros.push("Imagem desfocada ou com pouca nitidez. Repete a fotografia com boa iluminação e mantém o telemóvel estável.");
  }
  if (mean < MIN_MEAN_LUMINANCE) {
    erros.push("Imagem demasiado escura. Aumenta a luz ambiente ou evita sombras sobre o documento.");
  }
  if (mean > MAX_MEAN_LUMINANCE) {
    erros.push("Imagem demasiado clara ou com reflexos. Evita flash directo e brilho sobre o cartão.");
  }
  if (std < MIN_LUMINANCE_STD) {
    erros.push("Contraste insuficiente - o documento não se distingue bem do fundo. Usa um fundo liso e escuro.");
  }

  return erros;
}

export type ValidarImagemOpcoes = {
  validarProporcao?: boolean;
};

/** Valida formato, dimensões, proporção ID-1 e legibilidade heurística. */
export async function validarImagemDocumento(
  file: File,
  opts: ValidarImagemOpcoes = {},
): Promise<ValidacaoDocumento> {
  const validarProporcao = opts.validarProporcao ?? true;
  const erros = validarFormatoFicheiro(file);
  if (erros.length > 0) {
    return { ok: false, erros };
  }

  let img: HTMLImageElement;
  try {
    img = await loadImageFromFile(file);
  } catch {
    return { ok: false, erros: ["Não foi possível ler a imagem. Tenta outro ficheiro JPEG ou PNG."] };
  }

  erros.push(...validarDimensoesEProporcao(img.width, img.height, validarProporcao));

  try {
    const canvas = sampleToCanvas(img);
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      erros.push(...validarLegibilidade(data));
    }
  } catch {
    /* análise opcional - não bloquear se canvas falhar */
  }

  const unique = [...new Set(erros)];
  return { ok: unique.length === 0, erros: unique };
}

/** @deprecated Usa validarImagemDocumento */
export async function validarProporcaoId1(file: File): Promise<{ ok: boolean; hint?: string }> {
  const r = await validarImagemDocumento(file, { validarProporcao: true });
  return { ok: r.ok, hint: r.erros[0] };
}
