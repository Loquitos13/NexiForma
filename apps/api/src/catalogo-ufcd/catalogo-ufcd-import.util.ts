import * as XLSX from "xlsx";

/** Fontes oficiais para exportar listagens UFCD (CNQ / ANQEP). */
export const CATALOGO_UFCD_FONTES = {
  cnqUfcdPesquisa: "https://catalogo.anqep.gov.pt/ufcdPesquisa",
  cnqUfcdPesquisaAlt: "https://catalogo.snq.gov.pt/ufcdPesquisa",
  anqepHome: "https://www.anqep.gov.pt/",
  contactoCatalogo: "catalogo@anqep.gov.pt",
  instrucoes:
    "No Catálogo Nacional de Qualificações (pesquisa UFCD), use «Descarregar Listagem»  o download é em Excel (.xlsx). " +
    "Importe esse ficheiro directamente no NexiForma (também aceita CSV/TSV). " +
    "Se o portal CNQ estiver indisponível, a ANQEP pode disponibilizar listagens na pasta pública CNQ_Referenciais_Competencias (ver anqep.gov.pt).",
} as const;

export type UfcdImportRow = {
  codigo: string;
  designacao: string;
  area?: string | null;
  cargaHoras?: number | null;
  nivelQnq?: string | null;
};

export type UfcdImportParseResult = {
  rows: UfcdImportRow[];
  skipped: Array<{ line: number; reason: string }>;
  delimiter: string;
  headers: string[];
  format: "csv" | "xlsx";
};

/**
 * Cabeçalhos da listagem CNQ (ListaUFCDs_*.xlsx):
 * Código UFCD | UFCD | Carga Horária UFCD | … | Designação Área de Formação | Nível QNQ
 * Nota: a coluna «UFCD» é a designação, não o código.
 */
const HEADER_MAP: Record<string, keyof UfcdImportRow> = {
  codigo: "codigo",
  código: "codigo",
  code: "codigo",
  "codigo ufcd": "codigo",
  "código ufcd": "codigo",
  "codigo da ufcd": "codigo",
  "código da ufcd": "codigo",
  // CNQ: coluna «UFCD» = designação textual
  ufcd: "designacao",
  designacao: "designacao",
  designação: "designacao",
  designacao_ufcd: "designacao",
  "designacao ufcd": "designacao",
  "designação ufcd": "designacao",
  nome: "designacao",
  titulo: "designacao",
  título: "designacao",
  area: "area",
  área: "area",
  "area de educacao e formacao": "area",
  "área de educação e formação": "area",
  "areas de educacao e formacao": "area",
  "áreas de educação e formação": "area",
  "designacao area de formacao": "area",
  "designação área de formação": "area",
  aef: "area",
  cargahoras: "cargaHoras",
  "carga horas": "cargaHoras",
  "carga horaria": "cargaHoras",
  "carga horária": "cargaHoras",
  "carga horaria ufcd": "cargaHoras",
  "carga horária ufcd": "cargaHoras",
  horas: "cargaHoras",
  duracao: "cargaHoras",
  duração: "cargaHoras",
  ch: "cargaHoras",
  nivelqnq: "nivelQnq",
  "nivel qnq": "nivelQnq",
  "nível qnq": "nivelQnq",
  nivel: "nivelQnq",
  nível: "nivelQnq",
  qnq: "nivelQnq",
};

export function isValidUfcdImportCode(codigo: string): boolean {
  return /^\d{3,5}$/.test(codigo.trim());
}

function normalizeHeader(h: string): string {
  return h
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[_/]+/g, " ")
    .replace(/\s+/g, " ");
}

function detectDelimiter(headerLine: string): string {
  const counts = [
    { d: ";", n: (headerLine.match(/;/g) ?? []).length },
    { d: "\t", n: (headerLine.match(/\t/g) ?? []).length },
    { d: ",", n: (headerLine.match(/,/g) ?? []).length },
  ];
  counts.sort((a, b) => b.n - a.n);
  return counts[0]!.n > 0 ? counts[0]!.d : ";";
}

/** Split CSV/TSV line respecting double quotes. */
export function splitDelimitedLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === delimiter && !inQuotes) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function cellToString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "number") {
    // Evitar notação científica; zeros à esquerda do código UFCD tratam-se na coluna codigo
    if (Number.isInteger(value)) return String(value);
    return String(value);
  }
  if (typeof value === "boolean") return value ? "1" : "0";
  return String(value).trim();
}

function parseHoras(raw: string): number | null {
  const t = raw.trim().replace(",", ".");
  if (!t) return null;
  const m = t.match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = Math.round(Number(m[1]));
  return Number.isFinite(n) && n > 0 && n <= 1000 ? n : null;
}

function parseNivel(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const m = t.match(/\d/);
  return m ? m[0]! : t.slice(0, 8);
}

/** Interpreta matriz de células (CSV ou Excel) com cabeçalhos flexíveis CNQ. */
export function parseUfcdImportMatrix(
  matrix: string[][],
  meta: { delimiter: string; format: "csv" | "xlsx" },
): UfcdImportParseResult {
  const lines = matrix.filter((row) => row.some((c) => c.trim().length > 0));
  if (lines.length < 1) {
    throw new Error("Ficheiro vazio.");
  }

  const rawHeaders = lines[0]!.map((c) => c.trim());
  const headers = rawHeaders.map(normalizeHeader);

  const idx: Partial<Record<keyof UfcdImportRow, number>> = {};
  for (let i = 0; i < headers.length; i++) {
    const key = HEADER_MAP[headers[i]!];
    if (key && idx[key] === undefined) idx[key] = i;
  }

  let startLine = 1;
  let mappedHeaders = rawHeaders;
  if (idx.codigo === undefined || idx.designacao === undefined) {
    const firstCodigo = rawHeaders[0] ?? "";
    if (!isValidUfcdImportCode(firstCodigo) || (rawHeaders[1]?.length ?? 0) < 2) {
      throw new Error(
        "Cabeçalhos não reconhecidos. Esperado p.ex. «Código UFCD» e «UFCD» (listagem CNQ) " +
          `ou «Código»/«Designação». Encontrado: ${rawHeaders.filter(Boolean).slice(0, 8).join(" | ") || "(vazio)"}.`,
      );
    }
    idx.codigo = 0;
    idx.designacao = 1;
    idx.area = 2;
    idx.cargaHoras = 3;
    idx.nivelQnq = 4;
    startLine = 0;
    mappedHeaders = ["codigo", "designacao", "area", "cargaHoras", "nivelQnq"];
  }

  const rows: UfcdImportRow[] = [];
  const skipped: Array<{ line: number; reason: string }> = [];
  const seen = new Set<string>();

  for (let li = startLine; li < lines.length; li++) {
    const cells = lines[li]!;
    let codigo = (cells[idx.codigo!] ?? "").trim();
    // Excel por vezes guarda o código como número e perde zeros à esquerda (0113 → 113)
    if (meta.format === "xlsx" && /^\d{1,3}$/.test(codigo)) {
      codigo = codigo.padStart(4, "0");
    }
    const designacao = (cells[idx.designacao!] ?? "").trim();
    if (!codigo && !designacao) continue;

    if (!isValidUfcdImportCode(codigo)) {
      skipped.push({ line: li + 1, reason: `Código inválido «${codigo}» (esperado 3–5 dígitos).` });
      continue;
    }
    if (designacao.length < 2) {
      skipped.push({ line: li + 1, reason: `Designação em falta para ${codigo}.` });
      continue;
    }
    if (seen.has(codigo)) {
      skipped.push({ line: li + 1, reason: `Código duplicado no ficheiro: ${codigo}.` });
      continue;
    }
    seen.add(codigo);

    const areaRaw = idx.area !== undefined ? (cells[idx.area] ?? "").trim() : "";
    const horasRaw = idx.cargaHoras !== undefined ? (cells[idx.cargaHoras] ?? "") : "";
    const nivelRaw = idx.nivelQnq !== undefined ? (cells[idx.nivelQnq] ?? "") : "";

    rows.push({
      codigo,
      designacao: designacao.slice(0, 500),
      area: areaRaw ? areaRaw.slice(0, 200) : null,
      cargaHoras: parseHoras(horasRaw),
      nivelQnq: parseNivel(nivelRaw),
    });
  }

  if (rows.length === 0) {
    throw new Error("Nenhuma linha UFCD válida encontrada no ficheiro.");
  }

  return {
    rows,
    skipped,
    delimiter: meta.delimiter,
    headers: mappedHeaders,
    format: meta.format,
  };
}

/**
 * Interpreta CSV/TSV (UTF-8) da listagem CNQ ou ficheiro compatível.
 * Colunas mínimas: código + designação (cabeçalhos flexíveis em PT/EN).
 */
export function parseUfcdImportCsv(text: string): UfcdImportParseResult {
  const cleaned = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = cleaned.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length < 1) {
    throw new Error("Ficheiro vazio.");
  }
  const delimiter = detectDelimiter(lines[0]!);
  const matrix = lines.map((line) => splitDelimitedLine(line, delimiter));
  return parseUfcdImportMatrix(matrix, { delimiter, format: "csv" });
}

/** Lê a primeira folha de um .xlsx/.xls (listagem CNQ «Descarregar Listagem»). */
export function parseUfcdImportXlsx(buffer: Buffer): UfcdImportParseResult {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, {
      type: "buffer",
      cellDates: false,
      dense: false,
    });
  } catch {
    throw new Error("Ficheiro Excel inválido ou corrompido.");
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("O Excel não contém folhas.");
  }
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error("Folha Excel vazia.");
  }

  const raw = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
    header: 1,
    defval: "",
    raw: true,
    blankrows: false,
  });

  const matrix = raw.map((row) => {
    const arr = Array.isArray(row) ? row : [];
    return arr.map((cell) => cellToString(cell));
  });

  return parseUfcdImportMatrix(matrix, { delimiter: "xlsx", format: "xlsx" });
}

export function isExcelUpload(name: string, mime: string, buf: Buffer): boolean {
  const n = name.toLowerCase();
  const m = mime.toLowerCase();
  if (/\.(xlsx|xls)$/.test(n)) return true;
  if (m === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") return true;
  // application/vnd.ms-excel por vezes é CSV mal rotulado  só tratar como Excel com assinatura binária
  const isZip = buf.length >= 2 && buf[0] === 0x50 && buf[1] === 0x4b;
  const isOle =
    buf.length >= 4 && buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0;
  return m === "application/vnd.ms-excel" && (isZip || isOle);
}

export function parseUfcdImportJson(body: unknown): UfcdImportRow[] {
  if (!body || typeof body !== "object") {
    throw new Error("Body JSON inválido.");
  }
  const arr = Array.isArray(body)
    ? body
    : Array.isArray((body as { rows?: unknown }).rows)
      ? (body as { rows: unknown[] }).rows
      : null;
  if (!arr) {
    throw new Error("Envie um array de UFCDs ou { rows: [...] }.");
  }

  const rows: UfcdImportRow[] = [];
  const seen = new Set<string>();
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const codigo = String(o.codigo ?? o.código ?? o.code ?? "").trim();
    const designacao = String(o.designacao ?? o.designação ?? o.nome ?? "").trim();
    if (!isValidUfcdImportCode(codigo) || designacao.length < 2) continue;
    if (seen.has(codigo)) continue;
    seen.add(codigo);
    const carga =
      typeof o.cargaHoras === "number"
        ? o.cargaHoras
        : parseHoras(String(o.cargaHoras ?? o.horas ?? ""));
    rows.push({
      codigo,
      designacao: designacao.slice(0, 500),
      area: o.area != null ? String(o.area).slice(0, 200) : null,
      cargaHoras: carga,
      nivelQnq: o.nivelQnq != null ? parseNivel(String(o.nivelQnq)) : null,
    });
  }
  if (rows.length === 0) {
    throw new Error("Nenhuma UFCD válida no JSON.");
  }
  return rows;
}
