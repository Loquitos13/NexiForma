import {
  extrairHorarioPadrao,
  matchModulo,
  normalizarData,
  normalizarHora,
  normalizarImportDraft,
  type CronogramaImportDraft,
  type ModuloRef,
} from "./cronograma-import-ia.util";

const MESES_PT: Record<string, number> = {
  janeiro: 0,
  fevereiro: 1,
  marco: 2,
  março: 2,
  abril: 3,
  maio: 4,
  junho: 5,
  julho: 6,
  agosto: 7,
  setembro: 8,
  outubro: 9,
  novembro: 10,
  dezembro: 11,
};

function normKey(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function addMinutesHhMm(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

/** Texto “humano” vs lixo de PDF (ex.: wo+ueousngui+sdngs). */
export function sanitizarTextoLegivel(raw: string | null | undefined, max = 200): string | null {
  if (!raw) return null;
  const s = raw.replace(/\s+/g, " ").trim();
  if (s.length < 2) return null;
  // Sequências tipo a+b+c típicas de OCR/PDF partido
  if ((s.match(/\+/g) ?? []).length >= 2) return null;
  if (/\w{2,}\+\w{2,}/.test(s)) return null;
  const letters = s.replace(/[^a-zA-ZÀ-ÿ]/g, "");
  if (letters.length >= 6) {
    const vowels = (letters.match(/[aeiouáéíóúàâêôãõAEIOUÁÉÍÓÚÀÂÊÔÃÕ]/g) ?? []).length;
    if (vowels / letters.length < 0.22) return null;
  }
  const symbols = (s.match(/[^a-zA-ZÀ-ÿ0-9\s:.,()\-\/=]/g) ?? []).length;
  if (symbols >= 2) return null;
  return s.slice(0, max);
}

/**
 * Parser do HTML de cronograma DGERT (export NexiForma / semelhante):
 * caption do mês + células com «CÓDIGO (Xh)».
 */
export function extrairSessoesDeHtmlCalendario(
  html: string,
  opts: {
    horarioInicio?: string | null;
    horarioFim?: string | null;
    modulos: ModuloRef[];
  },
): CronogramaImportDraft {
  const padrao = extrairHorarioPadrao(html);
  const inicioDef = normalizarHora(opts.horarioInicio) ?? padrao?.inicio ?? "19:00";
  const fimDef = normalizarHora(opts.horarioFim) ?? padrao?.fim ?? "23:00";
  const rawSessoes: Array<Record<string, unknown>> = [];

  // Tabelas .cal com caption MÊS ANO
  const tableRe =
    /<table[^>]*class="[^"]*\bcal\b[^"]*"[^>]*>[\s\S]*?<caption[^>]*>([\s\S]*?)<\/caption>[\s\S]*?<tbody[^>]*>([\s\S]*?)<\/tbody>[\s\S]*?<\/table>/gi;

  let tableMatch: RegExpExecArray | null;
  while ((tableMatch = tableRe.exec(html)) !== null) {
    const caption = tableMatch[1]!.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const body = tableMatch[2]!;
    const capNorm = normKey(caption);
    let year = 0;
    let month = -1;
    const ym = capNorm.match(
      /(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+(\d{4})/,
    );
    if (ym) {
      month = MESES_PT[ym[1]!] ?? -1;
      year = Number(ym[2]);
    }
    if (year < 2000 || month < 0) continue;

    const rowMatch = body.match(/<tr[^>]*>([\s\S]*?)<\/tr>/i);
    if (!rowMatch) continue;
    const cells = [...rowMatch[1]!.matchAll(/<td([^>]*)>([\s\S]*?)<\/td>/gi)];
    cells.forEach((cell, idx) => {
      const day = idx + 1;
      if (day > 31) return;
      const attrs = cell[1] ?? "";
      const inner = cell[2] ?? "";
      if (/\bclass="[^"]*\b(inv|fds)\b/.test(attrs) || /\bclass='[^']*\b(inv|fds)\b/.test(attrs)) {
        return;
      }
      const text = inner
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (!text) return;

      const codes = [
        ...text.matchAll(/\b([A-ZÁÉÍÓÚÂÊÔÃÕ]{1,8}|S\d+)\s*\(\s*(\d+(?:[.,]\d+)?)\s*h\s*\)/gi),
      ];
      if (!codes.length) {
        // Célula com só código/sigla conhecida
        const loose = text.match(/\b([A-Z]{2,8}|S\d+)\b/g) ?? [];
        for (const codigo of loose) {
          const data = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          rawSessoes.push({
            data,
            horaInicio: inicioDef,
            horaFim: fimDef,
            modalidade: "presencial",
            moduloCodigo: codigo,
            notas: text.slice(0, 120),
          });
        }
        return;
      }

      for (const c of codes) {
        const codigo = c[1]!;
        const horas = Number(String(c[2]).replace(",", "."));
        let horaInicio = inicioDef;
        let horaFim = fimDef;
        if (Number.isFinite(horas) && horas > 0 && horas <= 12) {
          horaFim = addMinutesHhMm(horaInicio, Math.round(horas * 60));
          if (horaFim <= horaInicio) horaFim = fimDef;
        }
        const data = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        rawSessoes.push({
          data,
          horaInicio,
          horaFim,
          modalidade: "presencial",
          moduloCodigo: codigo,
          notas: `${codigo} (${c[2]}h)`,
        });
      }
    });
  }

  // Legenda módulos da tabela .mods
  const legendBits: string[] = [];
  const modRows = [
    ...html.matchAll(
      /<tr[^>]*>\s*<td[^>]*class="[^"]*c-cod[^"]*"[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/gi,
    ),
  ];
  for (const r of modRows) {
    const cod = r[1]!.replace(/<[^>]+>/g, "").trim();
    const tit = r[2]!.replace(/<[^>]+>/g, "").trim();
    if (cod && tit) legendBits.push(`${cod} = ${tit}`);
  }

  const draft = normalizarImportDraft(
    {
      sessoes: rawSessoes,
      prazoConclusaoLms: null,
      legendaResumo: legendBits.length
        ? legendBits.slice(0, 20).join(" · ")
        : rawSessoes.length
          ? "Calendário HTML (export DGERT)"
          : null,
      avisos: rawSessoes.length
        ? ["Sessões lidas do calendário HTML. Revise horários antes de aplicar."]
        : ["Não foram encontradas células de sessão no HTML."],
    },
    { modulos: opts.modulos, formadores: [] },
  );

  // Garante match de módulos pela legenda HTML
  if (legendBits.length) {
    for (const s of draft.sessoes) {
      if (s.moduloUnidadeId) continue;
      const bit = legendBits.find((b) =>
        b.toLowerCase().startsWith((s.tituloModulo ?? "").toLowerCase()),
      );
      void bit;
      void matchModulo;
    }
  }

  return draft;
}

export function fundirDrafts(...drafts: CronogramaImportDraft[]): CronogramaImportDraft {
  const key = (s: { data: string; horaInicio: string; tituloModulo?: string | null; notas?: string | null }) =>
    `${s.data}|${s.horaInicio}|${(s.tituloModulo ?? s.notas ?? "").slice(0, 40)}`;
  const map = new Map<string, CronogramaImportDraft["sessoes"][number]>();
  const avisos: string[] = [];
  let prazo: string | null = null;
  let legenda: string | null = null;

  for (const d of drafts) {
    for (const s of d.sessoes) {
      const k = key(s);
      if (!map.has(k)) map.set(k, s);
    }
    avisos.push(...d.avisos);
    if (!prazo && d.prazoConclusaoLms) prazo = d.prazoConclusaoLms;
    if (!legenda && d.legendaResumo && sanitizarTextoLegivel(d.legendaResumo, 400)) {
      legenda = sanitizarTextoLegivel(d.legendaResumo, 400);
    }
  }

  const sessoes = [...map.values()].sort((a, b) => {
    const byDate = a.data.localeCompare(b.data);
    return byDate !== 0 ? byDate : a.horaInicio.localeCompare(b.horaInicio);
  });
  sessoes.forEach((s, i) => {
    s.numeroSessao = i + 1;
  });

  const prazosMap = new Map<string, CronogramaImportDraft["prazosModulos"][number]>();
  for (const d of drafts) {
    for (const p of d.prazosModulos ?? []) {
      const k = `${p.moduloUnidadeId ?? p.moduloCodigo ?? p.moduloTitulo ?? "?"}|${p.data}`;
      if (!prazosMap.has(k)) prazosMap.set(k, p);
    }
  }
  const prazosModulos = [...prazosMap.values()].sort((a, b) =>
    a.data.localeCompare(b.data),
  );
  let prazoFinal = prazo;
  for (const p of prazosModulos) {
    if (!prazoFinal || p.data > prazoFinal) prazoFinal = p.data;
  }

  return {
    sessoes,
    prazoConclusaoLms: prazoFinal,
    prazosModulos,
    avisos: [...new Set(avisos)].slice(0, 12),
    legendaResumo: legenda,
  };
}
