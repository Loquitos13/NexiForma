const GENERIC_BASE =
  /^(documento|scan|image|img|foto|file|download|attachment|cam|dsc|photo)[\d_\-.]*$/i;

export function buildDocumentoDisplayName(input: {
  nome: string;
  originalFilename: string;
  mimeType: string;
}): string {
  const raw = input.nome.trim().replace(/\s+/g, " ");
  if (raw.length < 3) {
    throw new Error("Nome do documento demasiado curto (mínimo 3 caracteres).");
  }
  if (raw.length > 120) {
    throw new Error("Nome do documento demasiado longo (máximo 120 caracteres).");
  }

  const sanitized = raw.replace(/[/\\?%*:|"<>]/g, "-").trim();
  const base = sanitized.replace(/\.[^.]+$/i, "").trim();
  if (!base || GENERIC_BASE.test(base)) {
    throw new Error("Indique um nome descritivo para o documento.");
  }

  return ensureExtension(sanitized, input.mimeType, input.originalFilename);
}

function ensureExtension(name: string, mimeType: string, originalFilename: string): string {
  if (/\.[a-z0-9]{2,5}$/i.test(name)) return name;

  const fromOriginal = originalFilename.match(/(\.[a-z0-9]+)$/i)?.[1]?.toLowerCase();
  if (fromOriginal) return `${name}${fromOriginal}`;

  if (mimeType === "application/pdf") return `${name}.pdf`;
  if (mimeType === "image/png") return `${name}.png`;
  return `${name}.jpg`;
}
