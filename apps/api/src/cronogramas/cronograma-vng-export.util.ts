export type VngFaixaTipo = "presencial" | "sincrona" | "auto";

/** Espelho leve de isModalidadeOnline (evita puxar @nexiforma/shared nos testes). */
function isModalidadeOnline(modalidade: string): boolean {
  const m = modalidade.toLowerCase();
  return m.includes("learning") || m.includes("online") || m === "e-learning" || m === "b-learning";
}

/**
 * YYYY-MM-DD estável:
 * - string → primeiros 10 chars
 * - Date @db.Date (UTC midnight) → componentes UTC
 * - Date local (addDays) → componentes locais
 */
export function toLocalDateKey(value: Date | string): string {
  if (typeof value === "string") {
    return value.includes("T") ? value.split("T")[0]! : value.slice(0, 10);
  }
  const isUtcMidnight =
    value.getUTCHours() === 0 &&
    value.getUTCMinutes() === 0 &&
    value.getUTCSeconds() === 0 &&
    value.getUTCMilliseconds() === 0;
  if (isUtcMidnight) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, "0");
    const d = String(value.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export type VngModuloRef = {
  id: string;
  codigo: string | null;
  titulo: string;
  ordem: number;
};

export type VngSessaoInput = {
  data: Date | string;
  horaInicio: string;
  horaFim: string;
  modalidade: string;
  titulo?: string | null;
  numeroSessao: number;
  modulo?: VngModuloRef | null;
};

export type VngPrazoInput = {
  data: Date | string;
  modulo: VngModuloRef;
};

export type VngColumn = {
  dateKey: string;
  day: number;
  weekday: string;
  monthIndex: number;
  year: number;
};

export type VngMonthSpan = {
  label: string;
  colSpan: number;
};

export type VngCell = {
  label: string;
  /** Data limite de tarefas LMS  célula a vermelho na faixa auto. */
  isPrazo?: boolean;
};

export type VngFaixa = {
  tipo: VngFaixaTipo;
  /** Rótulo da coluna esquerda (grupo). */
  grupoLabel: string;
  horaInicio: string | null;
  horaFim: string | null;
  /** Célula por dateKey */
  cells: Record<string, VngCell>;
};

export type VngLegendaItem = {
  codigo: string;
  titulo: string;
  tipo: VngFaixaTipo;
};

const WEEKDAYS_PT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"] as const;
const MESES_PT = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
] as const;

export const VNG_FAIXA_CORES: Record<VngFaixaTipo, string> = {
  presencial: "#cfe2f3",
  sincrona: "#d9ead3",
  auto: "#fff2cc",
};

/** Data limite de conclusão das tarefas (célula na faixa auto). */
export const VNG_PRAZO_COR = "#e53935";
export const VNG_PRAZO_TEXTO = "#ffffff";

function normalizeTitulo(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** Extrai números de «Módulo 3», «Módulos 5 e 6», etc. */
export function extractModuloNums(titulo: string | null | undefined): number[] {
  if (!titulo?.trim()) return [];
  const tit = normalizeTitulo(titulo);
  const block = tit.match(/modulos?\s*([\d\s,e\/.-]+)/);
  if (!block?.[1]) return [];
  const nums = [...block[1].matchAll(/\d+/g)]
    .map((m) => Number(m[0]))
    .filter((n) => Number.isFinite(n) && n > 0 && n < 100);
  return [...new Set(nums)];
}

function parseLocalDate(dateKey: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

function addDays(dateKey: string, days: number): string {
  const dt = parseLocalDate(dateKey);
  dt.setDate(dt.getDate() + days);
  return toLocalDateKey(dt);
}

function compareDateKey(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Código de célula: M1, M3/M4, Sessão Síncrona, … */
export function resolveCelulaCodigo(
  sessao: VngSessaoInput,
  modulosCurso: VngModuloRef[],
): string {
  const fromTitulo = extractModuloNums(sessao.titulo);
  if (fromTitulo.length >= 2) {
    return fromTitulo.map((n) => `M${n}`).join("/");
  }
  if (fromTitulo.length === 1) return `M${fromTitulo[0]}`;

  const mod = sessao.modulo;
  if (mod) {
    const cod = mod.codigo?.trim();
    if (cod && /^M\d+/i.test(cod)) return cod.toUpperCase().replace(/\s+/g, "");
    const fromModTitulo = extractModuloNums(mod.titulo);
    if (fromModTitulo.length) return fromModTitulo.map((n) => `M${n}`).join("/");
    if (cod) return cod;
    const byOrdem = modulosCurso.find((m) => m.id === mod.id);
    if (byOrdem) return `M${byOrdem.ordem + 1}`;
  }

  if (isModalidadeOnline(sessao.modalidade)) return "Sessão Síncrona";
  return `S${sessao.numeroSessao}`;
}

export function resolveModuloCodigo(mod: VngModuloRef, modulosCurso: VngModuloRef[]): string {
  const cod = mod.codigo?.trim();
  if (cod && /^M\d+/i.test(cod)) return cod.toUpperCase().replace(/\s+/g, "");
  const fromTitulo = extractModuloNums(mod.titulo);
  if (fromTitulo.length) return fromTitulo.map((n) => `M${n}`).join("/");
  if (cod) return cod;
  const idx = modulosCurso.findIndex((m) => m.id === mod.id);
  return `M${(idx >= 0 ? modulosCurso[idx]!.ordem : mod.ordem) + 1}`;
}

export function buildVngColumns(inicio: string, fim: string): VngColumn[] {
  if (!inicio || !fim || compareDateKey(inicio, fim) > 0) return [];
  const out: VngColumn[] = [];
  let cursor = inicio;
  while (compareDateKey(cursor, fim) <= 0) {
    const dt = parseLocalDate(cursor);
    out.push({
      dateKey: cursor,
      day: dt.getDate(),
      weekday: WEEKDAYS_PT[dt.getDay()]!,
      monthIndex: dt.getMonth(),
      year: dt.getFullYear(),
    });
    cursor = addDays(cursor, 1);
  }
  return out;
}

export function buildVngMonthSpans(columns: VngColumn[]): VngMonthSpan[] {
  const spans: VngMonthSpan[] = [];
  for (const col of columns) {
    const label = `${MESES_PT[col.monthIndex]} ${col.year}`;
    const last = spans[spans.length - 1];
    if (last && last.label === label) last.colSpan += 1;
    else spans.push({ label, colSpan: 1 });
  }
  return spans;
}

/** Normaliza "9:00", "09:00:00" → "09:00". */
export function normalizeHora(hora: string): string {
  const m = hora.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return hora.slice(0, 5);
  return `${m[1]!.padStart(2, "0")}:${m[2]}`;
}

function horarioKey(inicio: string, fim: string): string {
  return `${normalizeHora(inicio)}-${normalizeHora(fim)}`;
}

function formatHorarioLabel(inicio: string, fim: string): string {
  return `das ${normalizeHora(inicio)} às ${normalizeHora(fim)}`;
}

function sessaoTipo(modalidade: string): "presencial" | "sincrona" {
  return isModalidadeOnline(modalidade) ? "sincrona" : "presencial";
}

function moduloNumFromRef(mod: VngModuloRef): number | null {
  const fromCod = mod.codigo?.trim().match(/^M0*(\d+)/i)?.[1];
  if (fromCod) return Number(fromCod);
  const fromTitulo = extractModuloNums(mod.titulo)[0];
  if (fromTitulo != null) return fromTitulo;
  if (Number.isFinite(mod.ordem)) return mod.ordem + 1;
  return null;
}

/** Módulos cobertos por uma sessão (id + título «Módulos 5 e 6»). */
export function moduloIdsCoveredBySessao(
  sessao: VngSessaoInput,
  modulosCurso: VngModuloRef[],
): string[] {
  const nums = extractModuloNums(sessao.titulo);
  if (nums.length) {
    const ids = modulosCurso
      .filter((m) => {
        const n = moduloNumFromRef(m);
        return n != null && nums.includes(n);
      })
      .map((m) => m.id);
    if (ids.length) return ids;
  }
  if (sessao.modulo?.id) return [sessao.modulo.id];
  return [];
}

function mergeCellLabels(a: string, b: string): string {
  if (a === b) return a;
  const parts = new Set([...a.split(/[+/]/), ...b.split(/[+/]/)].filter(Boolean));
  const nums = [...parts]
    .map((c) => c.match(/^M(\d+)$/i)?.[1])
    .filter(Boolean)
    .map(Number)
    .sort((x, y) => x! - y!);
  if (nums.length === parts.size && nums.length > 0) {
    return nums.map((n) => `M${n}`).join("/");
  }
  return [...parts].join("+");
}

function mergeCodigoSet(codigos: Iterable<string>): string {
  let out = "";
  for (const c of codigos) {
    out = out ? mergeCellLabels(out, c) : c;
  }
  return out;
}

function putCell(
  cells: Record<string, VngCell>,
  dateKey: string,
  label: string,
  isPrazo = false,
) {
  const prev = cells[dateKey];
  if (!prev) {
    cells[dateKey] = { label, isPrazo };
    return;
  }
  cells[dateKey] = {
    label: mergeCellLabels(prev.label, label),
    isPrazo: Boolean(prev.isPrazo || isPrazo),
  };
}

/**
 * Acumula códigos de preenchimento vs prazo por dia.
 * Num dia que é data limite de algum módulo, o rótulo vermelho só inclui
 * esses módulos  não módulos cuja faixa auto apenas passa/começa nesse dia.
 */
type AutoDayAccum = {
  fill: Set<string>;
  prazo: Set<string>;
};

function finalizeAutoCells(byDay: Map<string, AutoDayAccum>): Record<string, VngCell> {
  const cells: Record<string, VngCell> = {};
  for (const [dateKey, day] of byDay) {
    if (day.prazo.size > 0) {
      cells[dateKey] = { label: mergeCodigoSet(day.prazo), isPrazo: true };
    } else if (day.fill.size > 0) {
      cells[dateKey] = { label: mergeCodigoSet(day.fill), isPrazo: false };
    }
  }
  return cells;
}

/**
 * Constrói faixas VNG a partir das sessões (+ prazos LMS opcionais para auto-aprendizagem).
 */
export function buildVngFaixas(
  sessoes: VngSessaoInput[],
  modulosCurso: VngModuloRef[],
  prazos: VngPrazoInput[] = [],
): VngFaixa[] {
  const presencialByHorario = new Map<string, VngFaixa>();
  const sincronaByHorario = new Map<string, VngFaixa>();

  for (const s of sessoes) {
    const tipo = sessaoTipo(s.modalidade);
    const hk = horarioKey(s.horaInicio, s.horaFim);
    const map = tipo === "presencial" ? presencialByHorario : sincronaByHorario;
    let faixa = map.get(hk);
    if (!faixa) {
      faixa = {
        tipo,
        grupoLabel:
          tipo === "presencial"
            ? "Horário das aulas presenciais"
            : "Online Video-conferência",
        horaInicio: normalizeHora(s.horaInicio),
        horaFim: normalizeHora(s.horaFim),
        cells: {},
      };
      map.set(hk, faixa);
    }
    const dateKey = toLocalDateKey(s.data);
    const codigo = resolveCelulaCodigo(s, modulosCurso);
    putCell(faixa.cells, dateKey, codigo);
  }

  const sortFaixas = (map: Map<string, VngFaixa>) =>
    [...map.values()].sort((a, b) =>
      `${a.horaInicio}${a.horaFim}`.localeCompare(`${b.horaInicio}${b.horaFim}`),
    );

  const faixas: VngFaixa[] = [
    ...sortFaixas(presencialByHorario),
    ...sortFaixas(sincronaByHorario),
  ];

  const autoFaixa = buildAutoFaixa(sessoes, modulosCurso, prazos);
  if (autoFaixa) faixas.push(autoFaixa);

  return faixas;
}

/**
 * Auto-aprendizagem: preenche todos os dias desde a 1.ª sessão do módulo
 * até ao prazo LMS das tarefas; a data limite fica marcada a vermelho.
 */
function buildAutoFaixa(
  sessoes: VngSessaoInput[],
  modulosCurso: VngModuloRef[],
  prazos: VngPrazoInput[],
): VngFaixa | null {
  if (!prazos.length) return null;

  const firstSessaoByModulo = new Map<string, string>();
  for (const s of sessoes) {
    const key = toLocalDateKey(s.data);
    for (const modId of moduloIdsCoveredBySessao(s, modulosCurso)) {
      const prev = firstSessaoByModulo.get(modId);
      if (!prev || compareDateKey(key, prev) < 0) {
        firstSessaoByModulo.set(modId, key);
      }
    }
  }

  const byDay = new Map<string, AutoDayAccum>();
  const dayOf = (key: string) => {
    let d = byDay.get(key);
    if (!d) {
      d = { fill: new Set(), prazo: new Set() };
      byDay.set(key, d);
    }
    return d;
  };

  for (const p of prazos) {
    const prazoKey = toLocalDateKey(p.data);
    const codigo = resolveModuloCodigo(p.modulo, modulosCurso);
    const start = firstSessaoByModulo.get(p.modulo.id) ?? prazoKey;
    if (compareDateKey(start, prazoKey) > 0) {
      // Prazo anterior à sessão: só marca a data limite.
      dayOf(prazoKey).prazo.add(codigo);
      continue;
    }
    let cursor = start;
    while (compareDateKey(cursor, prazoKey) <= 0) {
      if (cursor === prazoKey) dayOf(cursor).prazo.add(codigo);
      else dayOf(cursor).fill.add(codigo);
      cursor = addDays(cursor, 1);
    }
  }

  const cells = finalizeAutoCells(byDay);
  if (!Object.keys(cells).length) return null;

  return {
    tipo: "auto",
    grupoLabel: "Online Auto-aprendizagem",
    horaInicio: null,
    horaFim: null,
    cells,
  };
}

export function buildVngLegenda(
  sessoes: VngSessaoInput[],
  modulosCurso: VngModuloRef[],
  faixas: VngFaixa[],
): VngLegendaItem[] {
  const byCodigo = new Map<string, VngLegendaItem>();

  for (const s of sessoes) {
    const codigo = resolveCelulaCodigo(s, modulosCurso);
    if (byCodigo.has(codigo)) continue;
    const tipo = sessaoTipo(s.modalidade);
    const titulo =
      s.titulo?.trim() ||
      s.modulo?.titulo ||
      (tipo === "sincrona" ? "Aula em vídeo-conferência" : `Sessão ${s.numeroSessao}`);
    byCodigo.set(codigo, { codigo, titulo, tipo });
  }

  for (const f of faixas) {
    if (f.tipo !== "auto") continue;
    for (const cell of Object.values(f.cells)) {
      const codigo = cell.label;
      if (byCodigo.has(codigo)) continue;
      const nums = codigo.match(/M(\d+)/gi)?.map((c) => Number(c.replace(/\D/g, ""))) ?? [];
      const mods = nums
        .map((n) =>
          modulosCurso.find((m) => m.ordem + 1 === n || extractModuloNums(m.titulo)[0] === n),
        )
        .filter(Boolean) as VngModuloRef[];
      const titulo =
        mods.length > 0
          ? mods.map((m) => m.titulo).join(" / ")
          : `Auto-aprendizagem ${codigo}`;
      byCodigo.set(codigo, { codigo, titulo, tipo: "auto" });
    }
  }

  if ([...byCodigo.values()].some((i) => i.tipo === "sincrona") === false) {
    const hasSync = faixas.some((f) => f.tipo === "sincrona");
    if (hasSync && !byCodigo.has("Sessão Síncrona")) {
      byCodigo.set("Sessão Síncrona", {
        codigo: "Sessão Síncrona",
        titulo: "Aula em vídeo-conferência",
        tipo: "sincrona",
      });
    }
  }

  return [...byCodigo.values()].sort((a, b) => a.codigo.localeCompare(b.codigo, "pt"));
}

export function cronogramaTituloFuncionamento(
  funcionamento?: "laboral" | "pos_laboral" | "misto" | null,
): string {
  if (funcionamento === "pos_laboral") return "Cronograma Pós-laboral";
  if (funcionamento === "misto") return "Cronograma Misto";
  return "Cronograma Laboral";
}

export function formatHorarioFaixa(faixa: VngFaixa): string {
  if (!faixa.horaInicio || !faixa.horaFim) return "";
  return formatHorarioLabel(faixa.horaInicio, faixa.horaFim);
}

/** Agrupa faixas presenciais consecutivas para rowspan do rótulo de grupo. */
export function groupFaixasForRender(faixas: VngFaixa[]): Array<{
  faixa: VngFaixa;
  showGrupo: boolean;
  grupoRowSpan: number;
}> {
  return faixas.map((faixa, i) => {
    const prev = faixas[i - 1];
    const showGrupo = !prev || prev.grupoLabel !== faixa.grupoLabel;
    let grupoRowSpan = 1;
    if (showGrupo) {
      for (let j = i + 1; j < faixas.length; j++) {
        if (faixas[j]!.grupoLabel !== faixa.grupoLabel) break;
        grupoRowSpan++;
      }
    }
    return { faixa, showGrupo, grupoRowSpan };
  });
}
