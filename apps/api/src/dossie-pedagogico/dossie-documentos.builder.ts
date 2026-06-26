import type { DossieDgertDocumentoDef } from "@nexiforma/shared";
import { DOSSIE_DGERT_DOCUMENTOS } from "@nexiforma/shared";

type ChecklistItem = {
  id: string;
  ok: boolean;
  label: string;
  detalhe?: string;
};

type CompliancePayload = {
  geradoEm: string;
  entidade: { nif: string | null; legalName: string | null } | null;
  acao: {
    id: string;
    codigoInterno: string;
    titulo: string;
    estado: string;
    dataInicio?: Date | string;
    dataFim?: Date | string;
  };
  checklist: { items: ChecklistItem[]; prontoInspecao: boolean };
  sessoesResumo: Array<Record<string, unknown>>;
};

type DossieExportBody = Record<string, unknown>;

function csvCell(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  if (/[",;\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function checklistItem(checklist: ChecklistItem[], id: string) {
  return checklist.find((i) => i.id === id);
}

function buildDocumentoContent(
  def: DossieDgertDocumentoDef,
  compliance: CompliancePayload,
  dossieBody: DossieExportBody,
  presencasCsv: string,
): string {
  const { entidade, acao, checklist, sessoesResumo, geradoEm } = compliance;
  const curso = dossieBody.curso as Record<string, unknown> | undefined;
  const turmas = (dossieBody.turmas as Array<Record<string, unknown>>) ?? [];
  const formadores = (dossieBody.formadores as Array<Record<string, unknown>>) ?? [];
  const assiduidade = dossieBody.assiduidade as Record<string, unknown> | undefined;
  const item = checklistItem(checklist.items, def.checklistId);

  const meta = {
    schema: "nexiforma.dossie_documento.v1",
    documento: def.ordem,
    checklistId: def.checklistId,
    label: def.label,
    geradoEm,
    requisitoCumprido: item?.ok ?? false,
    acao: { codigoInterno: acao.codigoInterno, titulo: acao.titulo },
  };

  switch (def.checklistId) {
    case "entidade_nif":
      return JSON.stringify(
        { ...meta, entidade: { nif: entidade?.nif, legalName: entidade?.legalName } },
        null,
        2,
      );
    case "curso_ufcd":
      return JSON.stringify(
        { ...meta, codigoUfcd: curso?.codigoUfcd ?? null, designacao: curso?.designacao },
        null,
        2,
      );
    case "curso_objetivos":
      return JSON.stringify({ ...meta, objetivos: curso?.objetivos ?? null }, null, 2);
    case "curso_carga_horas":
      return JSON.stringify(
        {
          ...meta,
          cargaHoras: curso?.cargaHoras,
          modalidade: curso?.modalidade,
        },
        null,
        2,
      );
    case "acao_periodo":
      return JSON.stringify(
        {
          ...meta,
          estado: acao.estado,
          dataInicio: acao.dataInicio,
          dataFim: acao.dataFim,
        },
        null,
        2,
      );
    case "cronograma": {
      const cronograma = dossieBody.cronograma as Record<string, unknown> | null;
      return JSON.stringify(
        {
          ...meta,
          cronograma: cronograma
            ? {
                versao: cronograma.versao,
                aprovadoEm: cronograma.aprovadoEm,
                totalSessoes: Array.isArray(cronograma.sessoes) ? cronograma.sessoes.length : 0,
              }
            : null,
        },
        null,
        2,
      );
    }
    case "sessoes_planeadas":
      return JSON.stringify({ ...meta, sessoes: sessoesResumo }, null, 2);
    case "formadores":
      return JSON.stringify({ ...meta, formadores }, null, 2);
    case "turmas_formandos": {
      const header = "turma;formando;nif;estado";
      const lines = turmas.flatMap((t) => {
        const mats = (t.matriculas as Array<{ formando: { nome: string; nif: string } }>) ?? [];
        return mats.map((m) =>
          [csvCell(String(t.codigo)), csvCell(m.formando.nome), csvCell(m.formando.nif), "ATIVA"].join(
            ";",
          ),
        );
      });
      return [header, ...lines].join("\n");
    }
    case "nifs_formandos": {
      const formandos = turmas.flatMap((t) =>
        ((t.matriculas as Array<{ formando: { nome: string; nif: string } }>) ?? []).map((m) => ({
          turma: t.codigo,
          ...m.formando,
        })),
      );
      return JSON.stringify({ ...meta, formandos, total: formandos.length }, null, 2);
    }
    case "sumarios": {
      const cronograma = dossieBody.cronograma as {
        sessoes?: Array<{ numeroSessao: number; estado: string; sumarios: Array<{ imutavel: boolean }> }>;
      } | null;
      const sessoes = cronograma?.sessoes ?? [];
      return JSON.stringify(
        {
          ...meta,
          sessoes: sessoes.map((s) => ({
            numeroSessao: s.numeroSessao,
            estado: s.estado,
            temSumario: s.sumarios.length > 0,
            sumarioCompleto: s.sumarios.some((sum) => sum.imutavel || sum),
          })),
        },
        null,
        2,
      );
    }
    case "sumarios_assinados": {
      const cronograma = dossieBody.cronograma as {
        sessoes?: Array<{ numeroSessao: number; estado: string; sumarios: Array<{ imutavel: boolean; assinadoEm?: string | null }> }>;
      } | null;
      const realizadas = (cronograma?.sessoes ?? []).filter((s) => s.estado === "REALIZADA");
      return JSON.stringify(
        {
          ...meta,
          sessoes: realizadas.map((s) => ({
            numeroSessao: s.numeroSessao,
            assinado: s.sumarios.some((sum) => sum.imutavel && sum.assinadoEm),
          })),
        },
        null,
        2,
      );
    }
    case "assiduidade":
      return presencasCsv;
    case "folhas_fechadas":
      return JSON.stringify(
        {
          ...meta,
          assiduidade,
          sessoes: sessoesResumo.map((s) => ({
            numeroSessao: s.numeroSessao,
            folhas: s.folhas,
          })),
        },
        null,
        2,
      );
    default:
      return JSON.stringify(meta, null, 2);
  }
}

export function buildDossieDocumentosMap(
  compliance: CompliancePayload,
  dossieBody: DossieExportBody,
  presencasCsv: string,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const def of DOSSIE_DGERT_DOCUMENTOS) {
    map.set(`documentos/${def.filename}`, buildDocumentoContent(def, compliance, dossieBody, presencasCsv));
  }
  return map;
}

export function listDossieDocumentosStatus(checklistItems: ChecklistItem[]) {
  return DOSSIE_DGERT_DOCUMENTOS.map((def) => {
    const item = checklistItem(checklistItems, def.checklistId);
    return {
      ...def,
      ok: item?.ok ?? false,
      detalhe: item?.detalhe,
    };
  });
}
