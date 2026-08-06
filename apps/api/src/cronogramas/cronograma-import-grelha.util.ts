import {
  normalizarData,
  normalizarHora,
  normalizarImportDraft,
  type CronogramaImportDraft,
  type ModuloRef,
} from "./cronograma-import-ia.util";

export type PdfLayoutItem = { s: string; x: number; y: number };

const LAYOUT_START = "@@NEXIFORMA_PDF_LAYOUT_V1@@";
const LAYOUT_END = "@@END_LAYOUT@@";

const MESES_PT: Record<string, number> = {
  janeiro: 1,
  fevereiro: 2,
  marco: 3,
  março: 3,
  abril: 4,
  maio: 5,
  junho: 6,
  julho: 7,
  agosto: 8,
  setembro: 9,
  outubro: 10,
  novembro: 11,
  dezembro: 12,
};

const CODE_RE = /\b(M\d+(?:\/M\d+)?|M\d+M\d+)\b/gi;
const HORARIO_RE = /das\s+(\d{1,2}:\d{2})\s+[àa]s\s+(\d{1,2}:\d{2})/i;

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Embute itens de layout no texto enviado à API (compatível com textoFonte). */
export function embedPdfLayout(texto: string, items: PdfLayoutItem[]): string {
  if (!items.length) return texto;
  const compact = items.map((i) => ({ s: i.s, x: +i.x.toFixed(1), y: +i.y.toFixed(1) }));
  return `${LAYOUT_START}\n${JSON.stringify({ items: compact })}\n${LAYOUT_END}\n${texto}`;
}

export function extractPdfLayoutFromTexto(texto: string): {
  items: PdfLayoutItem[] | null;
  textoPlano: string;
} {
  const start = texto.indexOf(LAYOUT_START);
  const end = texto.indexOf(LAYOUT_END);
  if (start < 0 || end < 0 || end <= start) {
    return { items: null, textoPlano: texto };
  }
  const jsonRaw = texto.slice(start + LAYOUT_START.length, end).trim();
  const textoPlano = texto.slice(end + LAYOUT_END.length).replace(/^\n/, "");
  try {
    const parsed = JSON.parse(jsonRaw) as { items?: PdfLayoutItem[] };
    const items = Array.isArray(parsed.items)
      ? parsed.items.filter(
          (i) => i && typeof i.s === "string" && Number.isFinite(i.x) && Number.isFinite(i.y),
        )
      : [];
    return { items: items.length ? items : null, textoPlano };
  } catch {
    return { items: null, textoPlano };
  }
}

type DayCol = { day: number; month: number; year: number; x: number; iso: string };
type LegendEntry = { code: string; parts: string[]; titulo: string; presencial: boolean };

function isoDate(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    return null;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseLegend(items: PdfLayoutItem[], legendY: number): LegendEntry[] {
  const below = items.filter((i) => i.y < legendY - 2).sort((a, b) => b.y - a.y || a.x - b.x);
  const entries: LegendEntry[] = [];

  for (const it of below) {
    const code = it.s.trim();
    if (!/^M\d+(?:\/M\d+)?$/i.test(code)) continue;
    // Descrição na mesma faixa Y, à direita do código
    const desc = below
      .filter((o) => Math.abs(o.y - it.y) < 8 && o.x > it.x + 5 && o.s.length > 4)
      .sort((a, b) => a.x - b.x)[0];
    const titulo = (desc?.s ?? `Módulo ${code}`).replace(/\s+/g, " ").trim();
    const parts = code.toUpperCase().split("/");
    entries.push({
      code: code.toUpperCase(),
      parts,
      titulo,
      presencial: /presencial/i.test(titulo),
    });
  }

  return entries;
}

function findLegendY(items: PdfLayoutItem[]): number {
  const hit = items.find((i) => /^legenda\s*:?\s*$/i.test(i.s.trim()) || /^legenda:/i.test(i.s.trim()));
  return hit?.y ?? Math.min(...items.map((i) => i.y)) + 40;
}

function findYear(items: PdfLayoutItem[]): number {
  const blob = items.map((i) => i.s).join(" ");
  const m = blob.match(/\b(20\d{2})\b/);
  return m ? Number(m[1]) : new Date().getFullYear();
}

function findStartEnd(items: PdfLayoutItem[]): { inicio: string | null; fim: string | null } {
  const blob = items.map((i) => i.s).join(" ");
  const inicio =
    blob.match(/Data de in[ií]cio\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{4})/i)?.[1] ??
    blob.match(/in[ií]cio\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{4})/i)?.[1] ??
    null;
  // "Data de fim: 17" + "/09/2026" partidos
  let fim = blob.match(/Data de fim\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{4})/i)?.[1] ?? null;
  if (!fim) {
    const split = blob.match(/Data de fim\s*:?\s*(\d{1,2})\s*\/(\d{1,2})\/(\d{4})/i);
    if (split) fim = `${split[1]}/${split[2]}/${split[3]}`;
  }
  return { inicio: normalizarData(inicio), fim: normalizarData(fim) };
}

function findDayRow(items: PdfLayoutItem[], legendY: number): PdfLayoutItem[] {
  const above = items.filter((i) => i.y > legendY + 10);
  // Agrupa por Y arredondado; escolhe a linha com mais inteiros 1–31
  const buckets = new Map<number, PdfLayoutItem[]>();
  for (const it of above) {
    if (!/^\d{1,2}$/.test(it.s.trim())) continue;
    const n = Number(it.s);
    if (n < 1 || n > 31) continue;
    const y = Math.round(it.y);
    const arr = buckets.get(y) ?? [];
    arr.push(it);
    buckets.set(y, arr);
  }
  let best: PdfLayoutItem[] = [];
  for (const row of buckets.values()) {
    if (row.length > best.length) best = row;
  }
  return best.sort((a, b) => a.x - b.x);
}

function monthAtX(items: PdfLayoutItem[], dayY: number, x: number, fallbackMonth: number): number {
  const monthItems = items.filter((i) => {
    const key = norm(i.s);
    return i.y > dayY && i.y < dayY + 40 && key in MESES_PT;
  });
  if (!monthItems.length) return fallbackMonth;
  // Etiquetas de mês ficam centradas no bloco - usa a mais próxima em X.
  let best = monthItems[0]!;
  let bestDist = Math.abs(best.x - x);
  for (const m of monthItems) {
    const d = Math.abs(m.x - x);
    if (d < bestDist) {
      best = m;
      bestDist = d;
    }
  }
  return MESES_PT[norm(best.s)] ?? fallbackMonth;
}

function buildDayColumns(
  dayCells: PdfLayoutItem[],
  items: PdfLayoutItem[],
  year: number,
  startIso: string | null,
): DayCol[] {
  if (!dayCells.length) return [];
  const dayY = dayCells[0]!.y;
  const startMonth = startIso ? Number(startIso.slice(5, 7)) : monthAtX(items, dayY, dayCells[0]!.x, 1);
  let yearCursor = startIso ? Number(startIso.slice(0, 4)) : year;
  let prevDay = 0;
  let prevMonth = startMonth;
  const cols: DayCol[] = [];

  for (const cell of dayCells) {
    const day = Number(cell.s);
    let month = monthAtX(items, dayY, cell.x, prevMonth || startMonth);
    // Fallback: 31→1 sem etiquetas fiáveis
    if (prevDay >= 28 && day <= 10 && month <= prevMonth) {
      month = prevMonth >= 12 ? 1 : prevMonth + 1;
      if (month === 1 && prevMonth === 12) yearCursor += 1;
    } else if (month < prevMonth && prevDay > 0) {
      yearCursor += 1;
    }
    const iso = isoDate(yearCursor, month, day);
    if (iso) {
      cols.push({ day, month, year: yearCursor, x: cell.x, iso });
    }
    prevDay = day;
    prevMonth = month;
  }
  return cols;
}

function nearestDay(cols: DayCol[], x: number): DayCol | null {
  if (!cols.length) return null;
  let best = cols[0]!;
  let bestDist = Math.abs(best.x - x);
  for (const c of cols) {
    const d = Math.abs(c.x - x);
    if (d < bestDist) {
      best = c;
      bestDist = d;
    }
  }
  // Meia coluna tipicamente ~10px; rejeita outliers
  if (bestDist > 18) return null;
  return best;
}

function parseHorarios(items: PdfLayoutItem[], legendY: number): Array<{ y: number; inicio: string; fim: string }> {
  const out: Array<{ y: number; inicio: string; fim: string }> = [];
  for (const it of items) {
    if (it.y <= legendY) continue;
    const m = it.s.match(HORARIO_RE);
    if (!m) continue;
    const inicio = normalizarHora(m[1]);
    const fim = normalizarHora(m[2]);
    if (inicio && fim && inicio < fim) out.push({ y: it.y, inicio, fim });
  }
  return out;
}

type GridKind = "presencial" | "sincrona" | "auto";

type GridBands = {
  autoY: number | null;
  syncY: number | null;
  /** Y mínimo da faixa presencial (horários “das …” acima do online). */
  presencialFloorY: number | null;
};

/** Âncoras verticais da grelha pela coluna esquerda + horários presenciais. */
function buildGridBands(items: PdfLayoutItem[], legendY: number): GridBands {
  const left = items.filter((i) => i.x < 130 && i.y > legendY);
  let autoY: number | null = null;
  let syncY: number | null = null;
  let presencialLabelY: number | null = null;

  for (const i of left) {
    const n = norm(i.s);
    if (n.includes("auto") || n === "aprendizagem" || n.includes("e-learning")) {
      autoY = autoY == null ? i.y : Math.max(autoY, i.y);
    }
    if (n.includes("online video") || n.includes("conferencia")) {
      syncY = syncY == null ? i.y : Math.max(syncY, i.y);
    }
    if (n.includes("presenc")) {
      presencialLabelY = presencialLabelY == null ? i.y : Math.max(presencialLabelY, i.y);
    }
  }

  const horarios = parseHorarios(items, legendY);
  const presencialHorarios = horarios.filter((h) => {
    if (syncY != null) return h.y > syncY + 4;
    if (autoY != null) return h.y > autoY + 4;
    return true;
  });
  const presencialFloorY =
    presencialHorarios.length > 0
      ? Math.min(...presencialHorarios.map((h) => h.y))
      : presencialLabelY;

  return { autoY, syncY, presencialFloorY };
}

/**
 * Classifica a faixa da grelha.
 * Auto-aprendizagem / e-learning e datas limite (vermelho) NÃO são sessões de consolidação.
 */
function kindForY(bands: GridBands, y: number): GridKind {
  const { autoY, syncY, presencialFloorY } = bands;

  if (presencialFloorY != null && y >= presencialFloorY - 6) {
    return "presencial";
  }
  if (syncY != null && autoY != null) {
    const mid = (syncY + autoY) / 2;
    if (y >= mid) return "sincrona";
    return "auto";
  }
  if (syncY != null) {
    // Sem faixa auto explícita: perto do rótulo sync → síncrona; acima → presencial
    if (presencialFloorY != null && y >= (syncY + presencialFloorY) / 2) return "presencial";
    if (y >= syncY - 10) return "sincrona";
    return "auto";
  }
  if (autoY != null && y <= autoY + 14) return "auto";
  return "presencial";
}

function nearestHorario(
  horarios: Array<{ y: number; inicio: string; fim: string }>,
  y: number,
  assincrona: boolean,
): { inicio: string; fim: string } {
  if (!horarios.length) {
    return assincrona ? { inicio: "09:00", fim: "18:00" } : { inicio: "09:00", fim: "13:00" };
  }
  // Preferir horário na mesma faixa ou imediatamente acima
  let best = horarios[0]!;
  let bestScore = Infinity;
  for (const h of horarios) {
    const dy = y - h.y;
    // código tipicamente ligeiramente acima ou ao lado do rótulo de horário
    const score = dy >= -8 && dy <= 40 ? dy : Math.abs(dy) + 100;
    if (score < bestScore) {
      bestScore = score;
      best = h;
    }
  }
  if (assincrona && bestScore > 50) {
    return { inicio: "09:00", fim: "18:00" };
  }
  return { inicio: best.inicio, fim: best.fim };
}

function expandCodes(raw: string): string[] {
  const u = raw.toUpperCase().replace(/\s+/g, "");
  if (/^M\d+\/M\d+$/.test(u)) return u.split("/");
  const concat = u.match(/^M(\d+)M(\d+)$/);
  if (concat) return [`M${concat[1]}`, `M${concat[2]}`];
  if (/^M\d+$/.test(u)) return [u];
  return [];
}

function legendForParts(legend: LegendEntry[], parts: string[]): LegendEntry | null {
  const key = parts.join("/");
  const exact = legend.find((l) => l.code === key || l.parts.join("/") === key);
  if (exact) return exact;
  if (parts.length === 1) {
    return (
      legend.find((l) => l.parts.includes(parts[0]!)) ??
      legend.find((l) => l.code === parts[0]) ??
      null
    );
  }
  // M3+M4 → M3/M4
  return legend.find(
    (l) =>
      l.parts.length === parts.length &&
      parts.every((p) => l.parts.includes(p)),
  ) ?? null;
}

type RawCell = {
  iso: string;
  x: number;
  y: number;
  codes: string[];
  horaInicio: string;
  horaFim: string;
  kind: GridKind;
};

/**
 * Parser de cronogramas em grelha horizontal (dias × códigos M1/M2… + legenda).
 * Formato típico ENA / Laboral manhã / blended.
 *
 * Sessões = consolidação (presencial em sala + síncronas vídeo).
 * E-learning/auto-aprendizagem e datas limite (vermelho na legenda) não viram sessão.
 */
export function extrairSessoesDeGrelhaPdf(
  items: PdfLayoutItem[],
  opts: { modulos: ModuloRef[]; horarioInicio?: string | null; horarioFim?: string | null },
): CronogramaImportDraft {
  const avisos: string[] = [];
  if (items.length < 20) {
    return normalizarImportDraft(
      { sessoes: [], avisos: ["Layout PDF insuficiente para grelha."], legendaResumo: null },
      { modulos: opts.modulos, formadores: [] },
    );
  }

  const legendY = findLegendY(items);
  const legend = parseLegend(items, legendY);
  const year = findYear(items);
  const { inicio, fim } = findStartEnd(items);
  const dayCells = findDayRow(items, legendY);
  const cols = buildDayColumns(dayCells, items, year, inicio);
  const horarios = parseHorarios(items, legendY);
  const bands = buildGridBands(items, legendY);

  if (!cols.length) {
    avisos.push("Grelha: não foi possível ler a linha de dias do calendário.");
  }

  const gridItems = items.filter((i) => i.y > legendY + 5 && i.x > 100);
  const cells: RawCell[] = [];
  /** Faixa auto / datas limite: códigos por dia (último dia = prazo LMS do módulo). */
  const autoByCode = new Map<string, string[]>();

  for (const it of gridItems) {
    CODE_RE.lastIndex = 0;
    const matches = [...it.s.matchAll(CODE_RE)].map((m) => m[1]!);
    const isSyncLabel = /^sess[aã]o$/i.test(it.s.trim()) || /^s[ií]ncrona$/i.test(it.s.trim());
    if (!matches.length && !/^M\d/i.test(it.s.trim()) && !isSyncLabel) continue;

    const kind = kindForY(bands, it.y);

    if (isSyncLabel && !matches.length) {
      if (kind !== "sincrona") continue;
      const day = nearestDay(cols, it.x);
      if (!day) continue;
      const h = nearestHorario(horarios, it.y, false);
      const dup = cells.some(
        (c) => c.kind === "sincrona" && c.iso === day.iso && Math.abs(c.x - it.x) < 12,
      );
      if (!dup) {
        cells.push({
          iso: day.iso,
          x: it.x,
          y: it.y,
          codes: [],
          horaInicio: h.inicio,
          horaFim: h.fim,
          kind: "sincrona",
        });
      }
      continue;
    }

    const tokens = matches.length ? matches : [it.s.trim()];
    for (const tok of tokens) {
      const parts = expandCodes(tok);
      if (!parts.length) continue;
      const day = nearestDay(cols, it.x);
      if (!day) continue;

      // Auto-aprendizagem / datas limite (vermelho): prazo LMS, não sessão.
      if (kind === "auto") {
        for (const code of parts) {
          const days = autoByCode.get(code) ?? [];
          days.push(day.iso);
          autoByCode.set(code, days);
        }
        continue;
      }

      const h = nearestHorario(horarios, it.y, false);
      cells.push({
        iso: day.iso,
        x: it.x,
        y: it.y,
        codes: parts,
        horaInicio: h.inicio,
        horaFim: h.fim,
        kind,
      });
    }
  }

  // Agrupa no mesmo dia+hora+coluna (M3 empilhado com M4 → uma sessão M3/M4)
  type GroupKey = string;
  const groups = new Map<GroupKey, RawCell[]>();

  for (const c of cells) {
    const key = `${c.kind}|${c.iso}|${c.horaInicio}|${c.horaFim}|${Math.round(c.x / 8)}`;
    const arr = groups.get(key) ?? [];
    arr.push(c);
    groups.set(key, arr);
  }

  const rawSessoes: Array<Record<string, unknown>> = [];

  for (const group of groups.values()) {
    const codes = [...new Set(group.flatMap((g) => g.codes))];
    const sample = group[0]!;
    const leg = legendForParts(legend, codes);
    const isSync = sample.kind === "sincrona";
    rawSessoes.push({
      data: sample.iso,
      horaInicio: sample.horaInicio,
      horaFim: sample.horaFim,
      modalidade: isSync ? "online" : "presencial",
      assincrona: false,
      moduloCodigo: codes[0] ?? null,
      moduloTitulo: isSync
        ? "Aula em vídeo-conferência"
        : (leg?.titulo ?? (codes.length > 1 ? codes.join("/") : codes[0] ?? null)),
      notas: codes.length ? codes.join("/") : "Sessão síncrona",
    });
  }

  // Último dia da faixa auto/vermelho = data limite de entrega LMS desse módulo.
  const prazosRaw: Array<Record<string, unknown>> = [];
  for (const [code, days] of autoByCode) {
    const uniq = [...new Set(days)].sort();
    const last = uniq[uniq.length - 1];
    if (!last) continue;
    const leg = legendForParts(legend, [code]);
    prazosRaw.push({
      data: last,
      moduloCodigo: code,
      moduloTitulo: leg?.titulo ?? `Módulo ${code}`,
    });
  }
  // Módulos só presenciais (sem faixa auto): prazo = última sessão desse código.
  const lastSessaoByCode = new Map<string, string>();
  for (const s of rawSessoes) {
    const notas = String(s.notas ?? "");
    const codes = notas.split("/").map((c) => c.trim()).filter((c) => /^M\d+$/i.test(c));
    for (const code of codes) {
      const prev = lastSessaoByCode.get(code.toUpperCase());
      const data = String(s.data);
      if (!prev || data > prev) lastSessaoByCode.set(code.toUpperCase(), data);
    }
  }
  for (const [code, data] of lastSessaoByCode) {
    if (autoByCode.has(code)) continue;
    const leg = legendForParts(legend, [code]);
    prazosRaw.push({
      data,
      moduloCodigo: code,
      moduloTitulo: leg?.titulo ?? `Módulo ${code}`,
    });
  }

  const legendaResumo = legend.length
    ? legend.map((l) => `${l.code}: ${l.titulo}`).join(" | ").slice(0, 400)
    : "Grelha PDF (codigos M* + legenda)";

  if (autoByCode.size > 0) {
    avisos.push(
      "Faixa e-learning/auto-aprendizagem: usada só para datas limite LMS por módulo (não cria sessões).",
    );
  }

  if (!rawSessoes.length) {
    avisos.push("Grelha PDF: sem sessões presenciais/síncronas nas células.");
  } else {
    avisos.push(
      `Sessões de consolidação lidas da grelha (${rawSessoes.length}). Revise antes de aplicar.`,
    );
  }
  if (prazosRaw.length) {
    avisos.push(
      `${prazosRaw.length} prazo(s) LMS por módulo detectados (data limite de avaliação/tarefas).`,
    );
  }

  const draft = normalizarImportDraft(
    {
      sessoes: rawSessoes,
      prazoConclusaoLms: fim,
      prazosModulos: prazosRaw,
      legendaResumo,
      avisos,
    },
    { modulos: opts.modulos, formadores: [] },
  );

  return {
    ...draft,
    legendaResumo: draft.legendaResumo ?? legendaResumo.slice(0, 400),
    avisos: [...new Set([...avisos, ...draft.avisos])].slice(0, 12),
  };
}
