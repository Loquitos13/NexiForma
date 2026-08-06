const ALLOWED_MIME: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "image/gif": [".gif"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/vnd.ms-excel": [".xls"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "text/plain": [".txt"],
  "text/csv": [".csv"],
  "application/zip": [".zip"],
};

const MAGIC: Array<{ mime: string; check: (buf: Buffer) => boolean }> = [
  { mime: "application/pdf", check: (b) => b.subarray(0, 5).toString() === "%PDF-" },
  { mime: "image/png", check: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: "image/jpeg", check: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: "image/gif", check: (b) => b.subarray(0, 3).toString() === "GIF" },
  { mime: "application/zip", check: (b) => b[0] === 0x50 && b[1] === 0x4b },
];

export function assertAllowedUpload(file: Express.Multer.File, allowedMimes?: string[]): void {
  const name = file.originalname?.toLowerCase() ?? "";
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";
  const declared = file.mimetype?.toLowerCase() ?? "";

  const whitelist = allowedMimes ?? Object.keys(ALLOWED_MIME);
  if (!whitelist.includes(declared)) {
    throw new Error(`Tipo MIME não permitido: ${declared || "desconhecido"}.`);
  }

  const allowedExts = ALLOWED_MIME[declared];
  if (allowedExts && ext && !allowedExts.includes(ext)) {
    throw new Error(`Extensão ${ext} não corresponde ao MIME ${declared}.`);
  }

  const buf = file.buffer;
  if (!buf?.byteLength) {
    throw new Error("Ficheiro vazio.");
  }

  const magic = MAGIC.find((m) => m.mime === declared);
  if (magic && !magic.check(buf)) {
    throw new Error("Conteúdo do ficheiro não corresponde ao tipo declarado.");
  }
}

export const SCORM_ZIP_MAX_ENTRIES = 5000;
export const SCORM_ZIP_MAX_TOTAL_BYTES = 50 * 1024 * 1024;
