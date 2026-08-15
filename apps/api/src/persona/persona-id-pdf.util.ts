import { PDFDocument, type PDFImage } from "pdf-lib";

export type DownloadedIdPart = {
  buffer: Buffer;
  contentType: string;
};

const PAGE_ORDER = ["front", "back", "unico"];

/** A4 em points (72 dpi). */
export const A4_WIDTH_PT = 595.28;
export const A4_HEIGHT_PT = 841.89;
export const PDF_PAGE_MARGIN_PT = 40;

export function orderPersonaIdFiles<T extends { page: string }>(files: T[]): T[] {
  return [...files].sort((a, b) => {
    const ai = PAGE_ORDER.indexOf(a.page);
    const bi = PAGE_ORDER.indexOf(b.page);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
}

export function computeImageFitOnPage(input: {
  imageWidth: number;
  imageHeight: number;
  pageWidth?: number;
  pageHeight?: number;
  margin?: number;
}): { x: number; y: number; width: number; height: number } {
  const pageWidth = input.pageWidth ?? A4_WIDTH_PT;
  const pageHeight = input.pageHeight ?? A4_HEIGHT_PT;
  const margin = input.margin ?? PDF_PAGE_MARGIN_PT;
  const maxW = pageWidth - 2 * margin;
  const maxH = pageHeight - 2 * margin;
  const scale = Math.min(maxW / input.imageWidth, maxH / input.imageHeight);
  const width = input.imageWidth * scale;
  const height = input.imageHeight * scale;
  return {
    x: (pageWidth - width) / 2,
    y: (pageHeight - height) / 2,
    width,
    height,
  };
}

function drawImageOnA4Page(page: ReturnType<PDFDocument["addPage"]>, image: PDFImage) {
  const fit = computeImageFitOnPage({
    imageWidth: image.width,
    imageHeight: image.height,
  });
  page.drawImage(image, fit);
}

/** Junta imagens (ou PDFs) num único PDF A4 - frente, verso, etc. */
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

    const page = pdfDoc.addPage([A4_WIDTH_PT, A4_HEIGHT_PT]);
    drawImageOnA4Page(page, image);
  }

  return Buffer.from(await pdfDoc.save());
}
