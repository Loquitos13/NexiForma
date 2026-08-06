/** Extrai texto legível de ficheiros de cronograma (HTML/TXT/CSV/PDF) no browser. */

export type PdfLayoutItem = { s: string; x: number; y: number };

const LAYOUT_START = "@@NEXIFORMA_PDF_LAYOUT_V1@@";
const LAYOUT_END = "@@END_LAYOUT@@";

function embedPdfLayout(texto: string, items: PdfLayoutItem[]): string {
  if (!items.length) return texto;
  const compact = items.map((i) => ({
    s: i.s,
    x: +i.x.toFixed(1),
    y: +i.y.toFixed(1),
  }));
  return `${LAYOUT_START}\n${JSON.stringify({ items: compact })}\n${LAYOUT_END}\n${texto}`;
}

async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const parts: string[] = [];
  const layoutItems: PdfLayoutItem[] = [];
  const maxPages = Math.min(doc.numPages, 12);
  for (let i = 1; i <= maxPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    // Agrupa por linha (Y) para preservar datas/horas em linhas distintas.
    const rows = new Map<number, string[]>();
    for (const it of content.items) {
      if (!("str" in it) || typeof it.str !== "string" || !it.str.trim()) continue;
      const x = Number(it.transform?.[4] ?? 0);
      const y = Number(it.transform?.[5] ?? 0);
      layoutItems.push({ s: it.str, x, y: y + (i - 1) * 1000 });
      const yKey = Math.round(y * 2) / 2;
      const arr = rows.get(yKey) ?? [];
      arr.push(it.str);
      rows.set(yKey, arr);
    }
    const sorted = [...rows.entries()].sort((a, b) => b[0] - a[0]);
    for (const [, words] of sorted) {
      const line = words.join(" ").replace(/\s+/g, " ").trim();
      if (line) parts.push(line);
    }
    parts.push("");
  }
  if (doc.numPages > maxPages) {
    parts.push(`[… ${doc.numPages - maxPages} páginas omitidas …]`);
  }
  return embedPdfLayout(parts.join("\n"), layoutItems);
}

export async function extractCronogramaTextFromFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    return extractPdfText(file);
  }
  const raw = await file.text();
  if (name.endsWith(".html") || name.endsWith(".htm") || file.type.includes("html")) {
    return raw;
  }
  return raw;
}
