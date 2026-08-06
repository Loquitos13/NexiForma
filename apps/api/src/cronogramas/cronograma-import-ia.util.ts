export type CronogramaImportSessaoDraft = {
  numeroSessao: number;
  data: string;
  horaInicio: string;
  horaFim: string;
  modalidade: string;
  moduloUnidadeId: string | null;
  formadorId: string | null;
  tituloModulo?: string | null;
  notas?: string | null;
  assincrona?: boolean;
};

export type CronogramaImportPrazoModuloDraft = {
  data: string;
  moduloCodigo: string | null;
  moduloTitulo: string | null;
  moduloUnidadeId: string | null;
};

export type CronogramaImportDraft = {
  sessoes: CronogramaImportSessaoDraft[];
  prazoConclusaoLms: string | null;
  /** Datas limite de entrega LMS por módulo (avaliação / tarefas). */
  prazosModulos: CronogramaImportPrazoModuloDraft[];
  avisos: string[];
  legendaResumo: string | null;
};

export type ModuloRef = { id: string; codigo: string | null; titulo: string };
export type FormadorRef = { id: string; nomeCompleto: string };

const HHMM = /^\d{2}:\d{2}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizarModalidade(raw: unknown): string {
  const m = norm(String(raw ?? "presencial"));
  if (
    m.includes("assincron") ||
    m.includes("autonom") ||
    m.includes("trabalho individual") ||
    m === "e-learning" ||
    m === "elearning"
  ) {
    return "online";
  }
  if (m.includes("b-learning") || m.includes("blearning") || m.includes("b learning") || m.includes("hibrid")) {
    return "b-learning";
  }
  if (
    m.includes("online") ||
    m.includes("sincron") ||
    m.includes("distancia") ||
    m.includes("teams") ||
    m.includes("zoom") ||
    m.includes("webinar")
  ) {
    return "online";
  }
  return "presencial";
}

export function isSessaoAssincronaHint(raw: unknown, notas?: unknown): boolean {
  const blob = norm(`${String(raw ?? "")} ${String(notas ?? "")}`);
  return (
    blob.includes("assincron") ||
    blob.includes("autonom") ||
    blob.includes("trabalho individual") ||
    (blob.includes("tarefa") && blob.includes("prazo"))
  );
}

export function normalizarHora(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  const m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export function normalizarData(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  if (ISO_DATE.test(s)) return s;
  const pt = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (pt) {
    const d = Number(pt[1]);
    const m = Number(pt[2]);
    const y = Number(pt[3]);
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  return null;
}

/** Extrai o nome da matéria a partir do título IA («Módulo 1 - Higiene» → «Higiene»). */
export function materiaFromTituloModulo(titulo: string | null | undefined): string | null {
  const t = String(titulo ?? "").trim();
  if (!t) return null;
  const m = t.match(/^m[oó]dulo\s*\d+\s*[-–:]\s*(.+)$/i);
  if (m?.[1]?.trim()) return m[1].trim().slice(0, 200);
  return t.slice(0, 200);
}

/** Título canónico: «Módulo {n} - {matéria}». */
export function tituloModuloCanonico(ordem: number, materia: string): string {
  const n = Math.max(1, Math.floor(ordem));
  const mat = materia.trim() || `Matéria ${n}`;
  return `Módulo ${n} - ${mat}`.slice(0, 280);
}

/**
 * Planeia módulos a criar/associar: ordem cronológica da 1.ª sessão de cada matéria.
 * Devolve chave de matéria → índice 0-based para o título «Módulo x - …».
 */
export function planearModulosImport(
  sessoes: Array<{
    data: string;
    horaInicio: string;
    tituloModulo?: string | null;
    moduloCodigo?: string | null;
    moduloUnidadeId?: string | null;
  }>,
): Array<{ key: string; materia: string; codigo: string | null }> {
  const sorted = [...sessoes].sort((a, b) => {
    const byDate = a.data.localeCompare(b.data);
    if (byDate !== 0) return byDate;
    return a.horaInicio.localeCompare(b.horaInicio);
  });
  const seen = new Map<string, { key: string; materia: string; codigo: string | null }>();
  for (const s of sorted) {
    if (s.moduloUnidadeId) continue;
    const materia = materiaFromTituloModulo(s.tituloModulo);
    const codigo = s.moduloCodigo?.trim() || null;
    if (!materia && !codigo) continue;
    const key = codigo
      ? `cod:${codigo.toLowerCase()}`
      : `mat:${materia!.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.set(key, { key, materia: materia || codigo || "Módulo", codigo });
  }
  return [...seen.values()];
}

export function matchModulo(
  modulos: ModuloRef[],
  codigo?: unknown,
  titulo?: unknown,
): ModuloRef | null {
  const cod = norm(String(codigo ?? ""));
  const tit = norm(String(titulo ?? ""));
  if (cod) {
    const byCod = modulos.find((m) => m.codigo && norm(m.codigo) === cod);
    if (byCod) return byCod;
    const byCodLoose = modulos.find(
      (m) => m.codigo && (norm(m.codigo).includes(cod) || cod.includes(norm(m.codigo))),
    );
    if (byCodLoose) return byCodLoose;
    // M1 / M01 → módulo com código ou título “módulo 1”
    const num = cod.match(/^m0*(\d+)$/)?.[1];
    if (num) {
      const byNum = modulos.find((m) => {
        const mc = m.codigo ? norm(m.codigo) : "";
        const mt = norm(m.titulo);
        return (
          mc === `m${num}` ||
          mc === num ||
          new RegExp(`\\bm0*${num}\\b`).test(mc) ||
          new RegExp(`modulo\\s*0*${num}\\b`).test(mt)
        );
      });
      if (byNum) return byNum;
    }
  }
  if (tit) {
    const exact = modulos.find((m) => norm(m.titulo) === tit);
    if (exact) return exact;
    const loose = modulos.find(
      (m) => norm(m.titulo).includes(tit) || tit.includes(norm(m.titulo)),
    );
    if (loose) return loose;
    const numFromTit = tit.match(/modulo\s*0*(\d+)/)?.[1];
    if (numFromTit) {
      const byNum = modulos.find((m) =>
        new RegExp(`modulo\\s*0*${numFromTit}\\b`).test(norm(m.titulo)),
      );
      if (byNum) return byNum;
    }
  }
  return null;
}

export function matchFormador(formadores: FormadorRef[], nome?: unknown): FormadorRef | null {
  const n = norm(String(nome ?? ""));
  if (!n) return null;
  const exact = formadores.find((f) => norm(f.nomeCompleto) === n);
  if (exact) return exact;
  return (
    formadores.find(
      (f) => norm(f.nomeCompleto).includes(n) || n.includes(norm(f.nomeCompleto)),
    ) ?? null
  );
}

type RawSessao = Record<string, unknown>;

export function normalizarImportDraft(
  raw: unknown,
  ctx: { modulos: ModuloRef[]; formadores: FormadorRef[] },
): CronogramaImportDraft {
  const avisos: string[] = [];
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const lista = Array.isArray(obj.sessoes) ? obj.sessoes : [];
  const sessoes: CronogramaImportSessaoDraft[] = [];

  for (let i = 0; i < lista.length; i++) {
    const item = (lista[i] && typeof lista[i] === "object" ? lista[i] : {}) as RawSessao;
    const data = normalizarData(item.data);
    const horaInicio = normalizarHora(item.horaInicio ?? item.hora_inicio);
    const horaFim = normalizarHora(item.horaFim ?? item.hora_fim);
    if (!data || !horaInicio || !horaFim) {
      avisos.push(`Sessão #${i + 1} ignorada: data/horas inválidas.`);
      continue;
    }
    if (horaInicio >= horaFim) {
      avisos.push(`Sessão em ${data} ignorada: horaFim deve ser depois de horaInicio.`);
      continue;
    }

    const modalidade = normalizarModalidade(item.modalidade ?? item.tipo);
    const assincrona =
      Boolean(item.assincrona) ||
      isSessaoAssincronaHint(item.modalidade ?? item.tipo, item.notas ?? item.conteudo);

    const mod = matchModulo(
      ctx.modulos,
      item.moduloCodigo ?? item.codigoModulo ?? item.codigo,
      item.moduloTitulo ?? item.tituloModulo ?? item.modulo ?? item.conteudo,
    );
    const formador = matchFormador(ctx.formadores, item.formadorNome ?? item.formador);

    const numRaw = Number(item.numeroSessao ?? item.numero ?? sessoes.length + 1);
    const numeroSessao = Number.isFinite(numRaw) && numRaw >= 1 ? Math.floor(numRaw) : sessoes.length + 1;

    const tituloBruto = mod?.titulo ?? (item.moduloTitulo ? String(item.moduloTitulo) : null);
    const notasBruto = item.notas != null ? String(item.notas).slice(0, 500) : null;
    sessoes.push({
      numeroSessao,
      data,
      horaInicio,
      horaFim,
      modalidade: assincrona && modalidade === "presencial" ? "online" : modalidade,
      moduloUnidadeId: mod?.id ?? null,
      formadorId: formador?.id ?? null,
      tituloModulo: sanitizarCampoTexto(tituloBruto),
      notas: sanitizarCampoTexto(notasBruto),
      assincrona,
    });
  }

  sessoes.sort((a, b) => {
    const byDate = a.data.localeCompare(b.data);
    if (byDate !== 0) return byDate;
    return a.horaInicio.localeCompare(b.horaInicio);
  });

  // Renumerar sequencialmente para evitar colisões
  sessoes.forEach((s, idx) => {
    s.numeroSessao = idx + 1;
  });

  const prazo = normalizarData(
    obj.prazoConclusaoLms ?? obj.prazo_conclusao_lms ?? obj.prazoTarefasAssincronas,
  );

  const prazosRaw = Array.isArray(obj.prazosModulos) ? obj.prazosModulos : [];
  const prazosModulos: CronogramaImportPrazoModuloDraft[] = [];
  const prazoSeen = new Set<string>();
  for (const item of prazosRaw) {
    const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const data = normalizarData(row.data ?? row.prazoConclusao ?? row.prazo);
    if (!data) continue;
    const mod = matchModulo(
      ctx.modulos,
      row.moduloCodigo ?? row.codigoModulo ?? row.codigo,
      row.moduloTitulo ?? row.tituloModulo ?? row.modulo,
    );
    const codigo =
      mod?.codigo ??
      (row.moduloCodigo != null ? String(row.moduloCodigo).slice(0, 32) : null);
    const titulo =
      sanitizarCampoTexto(
        mod?.titulo ?? (row.moduloTitulo != null ? String(row.moduloTitulo) : null),
        120,
      ) ?? null;
    const key = `${mod?.id ?? codigo ?? titulo ?? "?"}|${data}`;
    if (prazoSeen.has(key)) continue;
    prazoSeen.add(key);
    prazosModulos.push({
      data,
      moduloCodigo: codigo,
      moduloTitulo: titulo,
      moduloUnidadeId: mod?.id ?? null,
    });
  }
  prazosModulos.sort((a, b) => a.data.localeCompare(b.data) || (a.moduloCodigo ?? "").localeCompare(b.moduloCodigo ?? ""));

  if (!sessoes.length) {
    avisos.push("A IA não extraiu nenhuma sessão válida do documento.");
  }

  const legendaBruta =
    typeof obj.legendaResumo === "string"
      ? obj.legendaResumo.slice(0, 800)
      : typeof obj.legenda === "string"
        ? obj.legenda.slice(0, 800)
        : null;

  // Prazo global da acção = o mais tarde entre prazos de módulo e o prazo explícito.
  let prazoFinal = prazo;
  for (const p of prazosModulos) {
    if (!prazoFinal || p.data > prazoFinal) prazoFinal = p.data;
  }

  return {
    sessoes,
    prazoConclusaoLms: prazoFinal,
    prazosModulos,
    avisos,
    legendaResumo: sanitizarCampoTexto(legendaBruta, 400),
  };
}

/** Rejeita lixo típico de extracção PDF (ex.: wo+ueousngui+sdngs). */
export function sanitizarCampoTexto(
  raw: string | null | undefined,
  max = 200,
): string | null {
  if (!raw) return null;
  const s = raw.replace(/\s+/g, " ").trim();
  if (s.length < 2) return null;
  if ((s.match(/\+/g) ?? []).length >= 2 || /\w{2,}\+\w{2,}/.test(s)) return null;
  const letters = s.replace(/[^a-zA-ZÀ-ÿ]/g, "");
  if (letters.length >= 6) {
    const vowels = (letters.match(/[aeiouáéíóúàâêôãõAEIOUÁÉÍÓÚÀÂÊÔÃÕ]/g) ?? []).length;
    if (vowels / letters.length < 0.22) return null;
  }
  const weird = (s.match(/[^a-zA-ZÀ-ÿ0-9\s:.,()\-\/=]/g) ?? []).length;
  if (weird >= 2) return null;
  return s.slice(0, max);
}

export function stripHtmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(tr|p|div|h\d|li|table)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function assertValidHhMm(value: string): boolean {
  return HHMM.test(value);
}

/** Extrai JSON de respostas LLM (markdown, trailing commas, arrays soltos). */
export function parseLlmJsonResponse(raw: string): unknown | null {
  let text = raw.trim();
  if (!text) return null;

  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) text = fence[1].trim();

  const tryParse = (s: string): unknown | null => {
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  };

  let parsed = tryParse(text);
  if (parsed != null) return wrapIfSessoesArray(parsed);

  // Remove vírgulas finais comuns em JSON “quase válido”
  const noTrailing = text.replace(/,\s*([}\]])/g, "$1");
  parsed = tryParse(noTrailing);
  if (parsed != null) return wrapIfSessoesArray(parsed);

  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) {
    parsed = tryParse(objMatch[0]) ?? tryParse(objMatch[0].replace(/,\s*([}\]])/g, "$1"));
    if (parsed != null) return wrapIfSessoesArray(parsed);
  }

  const arrMatch = text.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    parsed = tryParse(arrMatch[0]) ?? tryParse(arrMatch[0].replace(/,\s*([}\]])/g, "$1"));
    if (parsed != null) return wrapIfSessoesArray(parsed);
  }

  return null;
}

function wrapIfSessoesArray(parsed: unknown): unknown {
  if (Array.isArray(parsed)) {
    return { sessoes: parsed };
  }
  if (parsed && typeof parsed === "object") {
    const o = parsed as Record<string, unknown>;
    if (!Array.isArray(o.sessoes) && Array.isArray(o.sessions)) {
      return { ...o, sessoes: o.sessions };
    }
  }
  return parsed;
}

const DATE_IN_TEXT =
  /\b(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{4}|\d{4}-\d{2}-\d{2})\b/g;
const TIME_IN_TEXT = /\b(\d{1,2}:\d{2})\b/g;
const CODE_HOURS = /\b([A-ZÁÉÍÓÚÂÊÔÃÕ]{2,8})\s*\(\s*(\d+(?:[.,]\d+)?)\s*h\s*\)/gi;

/** Reduz PDF/HTML ruidoso às linhas úteis (legenda, datas, horários, códigos). */
export function condensarTextoCronograma(texto: string, maxChars = 8_000): string {
  const lines = texto
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);

  const header = lines.slice(0, 40);
  const kept: string[] = [];
  for (const line of lines) {
    const interesting =
      /legenda|módulo|modulo|código|codigo|formador|hor[aá]rio|cronograma|presencial|online|ass[ií]ncron|prazo/i.test(
        line,
      ) ||
      DATE_IN_TEXT.test(line) ||
      (TIME_IN_TEXT.test(line) && line.length < 220) ||
      /\([0-9]+(?:[.,][0-9]+)?\s*h\)/i.test(line);
    // reset lastIndex after global regex .test
    DATE_IN_TEXT.lastIndex = 0;
    TIME_IN_TEXT.lastIndex = 0;
    if (interesting) kept.push(line);
  }

  const merged = [...header, ...kept];
  const uniq: string[] = [];
  const seen = new Set<string>();
  for (const l of merged) {
    const key = l.slice(0, 160);
    if (seen.has(key)) continue;
    seen.add(key);
    uniq.push(l);
  }
  return uniq.join("\n").slice(0, maxChars);
}

export function extrairHorarioPadrao(texto: string): { inicio: string; fim: string } | null {
  const m1 = texto.match(
    /in[ií]cio\s*[:=]?\s*(\d{1,2}:\d{2}).{0,40}?fim\s*[:=]?\s*(\d{1,2}:\d{2})/i,
  );
  if (m1) {
    const inicio = normalizarHora(m1[1]);
    const fim = normalizarHora(m1[2]);
    if (inicio && fim && inicio < fim) return { inicio, fim };
  }
  const m2 = texto.match(/\b(\d{1,2}:\d{2})\s*[–\--àa]+\s*(\d{1,2}:\d{2})\b/);
  if (m2) {
    const inicio = normalizarHora(m2[1]);
    const fim = normalizarHora(m2[2]);
    if (inicio && fim && inicio < fim) return { inicio, fim };
  }
  return null;
}

function addMinutesHhMm(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

/**
 * Extracção rápida sem LLM - cobre linhas com data+horas e células «CÓDIGO (Xh)» com horário padrão.
 */
export function extrairSessoesHeuristica(
  texto: string,
  opts: {
    horarioInicio?: string | null;
    horarioFim?: string | null;
    modulos: ModuloRef[];
  },
): CronogramaImportDraft {
  const avisos: string[] = [];
  const rawSessoes: Array<Record<string, unknown>> = [];
  const padraoDoc = extrairHorarioPadrao(texto);
  const inicioDef =
    normalizarHora(opts.horarioInicio) ?? padraoDoc?.inicio ?? "19:00";
  const fimDef = normalizarHora(opts.horarioFim) ?? padraoDoc?.fim ?? "23:00";

  const lines = texto.split(/\n/).map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    // Datas de cabeçalho (matrícula / início / fim / prazo) não são sessões.
    if (
      /matr[ií]cula|data de in[ií]cio|data de fim|data limite|prazo|instru[cç][oõ]es/i.test(
        line,
      )
    ) {
      continue;
    }

    DATE_IN_TEXT.lastIndex = 0;
    const dates = [...line.matchAll(DATE_IN_TEXT)].map((m) => m[1]!);
    if (!dates.length) continue;

    TIME_IN_TEXT.lastIndex = 0;
    const times = [...line.matchAll(TIME_IN_TEXT)].map((m) => normalizarHora(m[1])).filter(Boolean) as string[];

    CODE_HOURS.lastIndex = 0;
    const codes = [...line.matchAll(CODE_HOURS)];

    for (const dataRaw of dates) {
      const data = normalizarData(dataRaw);
      if (!data) continue;

      if (times.length >= 2) {
        const horaInicio = times[0]!;
        const horaFim = times[1]!;
        if (horaInicio >= horaFim) continue;
        const codigo = codes[0]?.[1] ?? undefined;
        rawSessoes.push({
          data,
          horaInicio,
          horaFim,
          modalidade: /online|teams|zoom|dist[aâ]ncia|ass[ií]ncron/i.test(line)
            ? "online"
            : "presencial",
          moduloCodigo: codigo,
          notas: line.slice(0, 200),
        });
        continue;
      }

      if (codes.length) {
        for (const c of codes) {
          const codigo = c[1]!;
          const horas = Number(String(c[2]).replace(",", "."));
          let horaInicio = inicioDef;
          let horaFim = fimDef;
          if (Number.isFinite(horas) && horas > 0 && horas <= 12) {
            horaFim = addMinutesHhMm(horaInicio, Math.round(horas * 60));
            if (horaFim <= horaInicio) horaFim = fimDef;
          }
          rawSessoes.push({
            data,
            horaInicio,
            horaFim,
            modalidade: "presencial",
            moduloCodigo: codigo,
            notas: `${codigo} (${c[2]}h)`,
          });
        }
        continue;
      }

      // Data + um horário → assume duração até fim padrão
      if (times.length === 1) {
        const horaInicio = times[0]!;
        const horaFim = fimDef > horaInicio ? fimDef : addMinutesHhMm(horaInicio, 240);
        rawSessoes.push({
          data,
          horaInicio,
          horaFim,
          modalidade: "presencial",
          notas: line.slice(0, 200),
        });
      }
    }
  }

  // Prazos LMS / tarefas assíncronas
  let prazo: string | null = null;
  const prazoMatch = texto.match(
    /prazo[^0-9]{0,40}(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{4}|\d{4}-\d{2}-\d{2})/i,
  );
  if (prazoMatch) prazo = normalizarData(prazoMatch[1]);

  if (!rawSessoes.length) {
    avisos.push("Extracção rápida não encontrou sessões com data/hora legíveis.");
  } else {
    avisos.push("Sessões extraídas automaticamente (modo rápido). Revise antes de aplicar.");
  }

  return normalizarImportDraft(
    {
      sessoes: rawSessoes,
      prazoConclusaoLms: prazo,
      legendaResumo: "Extracção heurística (sem LLM)",
      avisos,
    },
    { modulos: opts.modulos, formadores: [] },
  );
}
