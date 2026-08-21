import type { CronogramaImportSessaoDraft } from "./cronograma-import-ia.util";

export type ModuloCursoRef = {
  id: string;
  codigo: string | null;
  titulo: string;
  cargaHoras: number | null;
  cargaHorasTeoricas: number | null;
  cargaHorasPraticas: number | null;
  metodologia: string | null;
};

export type ConformidadeModuloLinha = {
  moduloId: string;
  titulo: string;
  metodologia: string | null;
  horasEsperadas: number;
  horasPlaneadas: number;
  sessoes: number;
  ok: boolean;
  nota: string | null;
};

export type ConformidadeCursoResult = {
  modulosCurso: number;
  modulosComSessao: number;
  modulosSemSessao: string[];
  referenciasSemModuloCurso: string[];
  porModulo: ConformidadeModuloLinha[];
  avisos: string[];
  requerConfirmacao: boolean;
};

export function minutosSessao(inicio: string, fim: string): number {
  const [h1, m1] = inicio.split(":").map(Number);
  const [h2, m2] = fim.split(":").map(Number);
  const start = (h1 ?? 0) * 60 + (m1 ?? 0);
  const end = (h2 ?? 0) * 60 + (m2 ?? 0);
  return Math.max(0, end - start);
}

export function horasEsperadasModulo(m: ModuloCursoRef): number {
  const t = m.cargaHorasTeoricas ?? 0;
  const p = m.cargaHorasPraticas ?? 0;
  if (t + p > 0) return t + p;
  return m.cargaHoras ?? 0;
}

function metodologiaEfectiva(m: ModuloCursoRef): string {
  return (m.metodologia ?? "presencial").toLowerCase();
}

function isAutoAprendizagem(metodologia: string): boolean {
  return metodologia.includes("b-learning") || metodologia.includes("e-learning");
}

/**
 * Valida rascunho de cronograma contra módulos configurados no curso (não na acção).
 */
export function validarCronogramaContraCurso(
  sessoes: CronogramaImportSessaoDraft[],
  modulos: ModuloCursoRef[],
): ConformidadeCursoResult {
  const avisos: string[] = [];
  const minutosPorModulo = new Map<string, number>();
  const sessoesPorModulo = new Map<string, number>();
  const referenciasSemModuloCurso = new Set<string>();

  for (const s of sessoes) {
    const mins = minutosSessao(s.horaInicio, s.horaFim);
    if (s.moduloUnidadeId) {
      minutosPorModulo.set(s.moduloUnidadeId, (minutosPorModulo.get(s.moduloUnidadeId) ?? 0) + mins);
      sessoesPorModulo.set(s.moduloUnidadeId, (sessoesPorModulo.get(s.moduloUnidadeId) ?? 0) + 1);
    } else if (s.tituloModulo?.trim()) {
      referenciasSemModuloCurso.add(s.tituloModulo.trim());
    }
  }

  const modulosSemSessao = modulos
    .filter((m) => !sessoesPorModulo.has(m.id))
    .map((m) => m.codigo ? `${m.codigo} – ${m.titulo}` : m.titulo);

  if (modulos.length === 0) {
    avisos.push("O curso ainda não tem módulos configurados - configure-os no curso antes de planear sessões.");
  } else if (modulosSemSessao.length > 0) {
    avisos.push(
      `${modulosSemSessao.length} módulo(s) do curso sem sessão no cronograma: ${modulosSemSessao.slice(0, 4).join("; ")}${modulosSemSessao.length > 4 ? "…" : ""}.`,
    );
  }

  if (referenciasSemModuloCurso.size > 0) {
    avisos.push(
      `${referenciasSemModuloCurso.size} referência(s) no import não correspondem a módulos do curso. ` +
        "Os módulos são definidos no curso - não serão criados automaticamente nesta acção.",
    );
  }

  const modulosComSessao = sessoesPorModulo.size;
  if (modulos.length > 0 && modulosComSessao !== modulos.length) {
    avisos.push(
      `O curso tem ${modulos.length} módulo(s) e o cronograma cobre ${modulosComSessao}.`,
    );
  }

  const porModulo: ConformidadeModuloLinha[] = modulos.map((m) => {
    const mins = minutosPorModulo.get(m.id) ?? 0;
    const horasPlaneadas = Math.round((mins / 60) * 10) / 10;
    const horasEsperadas = horasEsperadasModulo(m);
    const meta = metodologiaEfectiva(m);
    const sessCount = sessoesPorModulo.get(m.id) ?? 0;
    let ok = true;
    let nota: string | null = null;

    if (horasEsperadas <= 0) {
      if (sessCount > 0) nota = "Módulo sem horas configuradas no curso.";
      return { moduloId: m.id, titulo: m.titulo, metodologia: m.metodologia, horasEsperadas, horasPlaneadas, sessoes: sessCount, ok, nota };
    }

    const ratio = horasPlaneadas / horasEsperadas;

    if (isAutoAprendizagem(meta)) {
      if (ratio > 1.1) {
        ok = false;
        nota = `Horas síncronas (${horasPlaneadas}h) excedem o total do módulo (${horasEsperadas}h). Em b-learning/e-learning parte do tempo é auto-aprendizagem.`;
      } else if (ratio < 0.85 && sessCount > 0) {
        nota = `Horas síncronas (${horasPlaneadas}h) abaixo do total (${horasEsperadas}h) - normal em b-learning se o restante for LMS/auto-estudo.`;
      }
    } else if (sessCount > 0) {
      if (ratio < 0.85) {
        ok = false;
        nota = `Horas planeadas (${horasPlaneadas}h) abaixo das ${horasEsperadas}h configuradas no curso (presencial).`;
      } else if (ratio > 1.15) {
        ok = false;
        nota = `Horas planeadas (${horasPlaneadas}h) excedem as ${horasEsperadas}h do módulo.`;
      }
    }

    if (!ok && nota) avisos.push(`«${m.titulo}»: ${nota}`);

    return { moduloId: m.id, titulo: m.titulo, metodologia: m.metodologia, horasEsperadas, horasPlaneadas, sessoes: sessCount, ok, nota };
  });

  const requerConfirmacao =
    modulosSemSessao.length > 0 ||
    referenciasSemModuloCurso.size > 0 ||
    porModulo.some((p) => !p.ok) ||
    (modulos.length > 0 && modulosComSessao !== modulos.length);

  return {
    modulosCurso: modulos.length,
    modulosComSessao,
    modulosSemSessao,
    referenciasSemModuloCurso: [...referenciasSemModuloCurso],
    porModulo,
    avisos,
    requerConfirmacao,
  };
}
