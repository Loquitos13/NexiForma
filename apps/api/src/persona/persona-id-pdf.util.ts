import { PDFDocument } from "pdf-lib";

export type DownloadedIdPart = {
  buffer: Buffer;
  contentType: string;
};

const PAGE_ORDER = ["front", "back", "unico"];

export function orderPersonaIdFiles<T extends { page: string }>(files: T[]): T[] {
  return [...files].sort((a, b) => {
    const ai = PAGE_ORDER.indexOf(a.page);
    const bi = PAGE_ORDER.indexOf(b.page);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
}

/** Junta imagens (ou PDFs) num único PDF - frente, verso, etc. */
export async function buildPersonaIdPdf(parts: DownloadedIdPart[]): Promise<Buffer> {
  if (!parts.length) {
    throw new Error("Sem ficheiros para gerar PDF.");
  }

  if (parts.length === 1 && parts[0].contentType.toLowerCase().includes("pdf")) {
    return parts[0].buffer;
  }

  const pdfDoc = await PDFDocument.create();

  for (const part of parts) {
    const ct = part.contentType.toLowerCase();
    if (ct.includes("pdf")) {
      const existing = await PDFDocument.load(part.buffer);
      const copied = await pdfDoc.copyPages(existing, existing.getPageIndices());
      for (const page of copied) pdfDoc.addPage(page);
      continue;
    }

    const image = ct.includes("png")
      ? await pdfDoc.embedPng(part.buffer)
      : await pdfDoc.embedJpg(part.buffer);

    const { width, height } = image.scale(1);
    const page = pdfDoc.addPage([width, height]);
    page.drawImage(image, { x: 0, y: 0, width, height });
  }

  return Buffer.from(await pdfDoc.save());
}
