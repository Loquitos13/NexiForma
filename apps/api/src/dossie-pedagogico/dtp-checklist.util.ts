import {
  DTP_QUADRO_SECOES,
  type TipoFinanciamentoDtp,
} from "@nexiforma/shared";
import { ACAO_TEMPLATE_CATEGORIAS } from "../formandos/matricula-documentos.util";

export type DtpChecklistItem = {
  id: string;
  label: string;
  ok: boolean;
  detalhe?: string;
  secaoOrdem: number;
  secaoTitulo: string;
  manual?: boolean;
  accaoSugerida?: string;
};

export type DtpChecklistInput = {
  tipoFinanciamento: TipoFinanciamentoDtp;
  cronograma: { versao: number; aprovadoEm: Date | null } | null;
  modulosCurso: number;
  /** Categorias de anexos na acção (templates PDF, etc.). */
  acaoDocumentos: Set<string>;
  /** Categorias de anexos DTP manuais (dtp_* ou id do item). */
  dtpAnexos: Set<string>;
  /** templateId ou categoria emitida por matrícula. */
  emitidosMatricula: Set<string>;
  totalMatriculas: number;
  totalFormandos: number;
  matriculasContratoOk: number;
  matriculasInscricaoOk: number;
  matriculasRegulamentoOk: number;
  formandosComCc: number;
  formandosComHabilitacoes: number;
  formandosComPatronal: number;
  formandosComMorada: number;
  formandosComIban: number;
};

function hasAnexo(categorias: Set<string>, ...keys: string[]): boolean {
  return keys.some((k) => categorias.has(k));
}

function ratioOk(presentes: number, total: number): boolean {
  return total > 0 && presentes >= total;
}

function checkDtpItem(id: string, input: DtpChecklistInput): {
  ok: boolean;
  detalhe?: string;
  manual?: boolean;
  accaoSugerida?: string;
} {
  const { acaoDocumentos, dtpAnexos, emitidosMatricula } = input;
  const manualAnexo = (itemId: string) =>
    hasAnexo(dtpAnexos, itemId, `dtp_${itemId}`);

  switch (id) {
    case "notificacao_aprovacao":
    case "comunicacao_arranque":
    case "processo_selecao_formandos":
    case "seguro_acidentes":
    case "mapa_pagamento":
    case "reporte_apd":
      return {
        ok: manualAnexo(id),
        manual: true,
        detalhe: manualAnexo(id) ? "Anexo registado" : "Anexar manualmente",
        accaoSugerida: "Carregar o documento na acção ou arquivo DTP.",
      };
    case "cronograma":
      return {
        ok: Boolean(input.cronograma),
        detalhe: input.cronograma ? `versão ${input.cronograma.versao}` : undefined,
        accaoSugerida: "Criar cronograma para a acção.",
      };
    case "programa":
      return {
        ok: input.modulosCurso > 0 || manualAnexo(id) || hasAnexo(acaoDocumentos, "programa"),
        detalhe:
          input.modulosCurso > 0
            ? `${input.modulosCurso} módulo(s) no curso`
            : undefined,
        accaoSugerida: "Definir módulos no curso ou anexar programa.",
      };
    case "regulamento_atividade":
      return {
        ok: manualAnexo(id) || hasAnexo(acaoDocumentos, "regulamento_atividade", "regulamento"),
        accaoSugerida: "Anexar regulamento da atividade formativa.",
      };
    case "regulamento_formando":
      return {
        ok:
          manualAnexo(id) ||
          hasAnexo(acaoDocumentos, ACAO_TEMPLATE_CATEGORIAS.regulamento_formacao) ||
          ratioOk(input.matriculasRegulamentoOk, input.totalMatriculas),
        detalhe: input.totalMatriculas
          ? `${input.matriculasRegulamentoOk}/${input.totalMatriculas} inscrições`
          : undefined,
        accaoSugerida: "Gerar regulamento por acção ou validar docs de inscrição.",
      };
    case "listagem_formandos":
      return {
        ok: input.totalMatriculas > 0,
        detalhe: `${input.totalMatriculas} inscrito(s)`,
        accaoSugerida: "Matricular formandos na turma.",
      };
    case "ficha_inscricao":
      return {
        ok:
          manualAnexo(id) ||
          ratioOk(input.matriculasInscricaoOk, input.totalMatriculas) ||
          hasAnexo(emitidosMatricula, "declaracao_inscricao"),
        detalhe: input.totalMatriculas
          ? `${input.matriculasInscricaoOk}/${input.totalMatriculas} declarações`
          : undefined,
        accaoSugerida: "Emitir declaração de inscrição ou validar checklist documental.",
      };
    case "rgpd_contratos":
      return {
        ok:
          manualAnexo(id) ||
          ratioOk(input.matriculasContratoOk, input.totalMatriculas) ||
          hasAnexo(emitidosMatricula, "contrato_formacao"),
        detalhe: input.totalMatriculas
          ? `${input.matriculasContratoOk}/${input.totalMatriculas} contratos`
          : undefined,
        accaoSugerida: "Contratos assinados / aceites nas inscrições.",
      };
    case "doc_cc":
      return {
        ok: manualAnexo(id) || ratioOk(input.formandosComCc, input.totalFormandos),
        detalhe: `${input.formandosComCc}/${input.totalFormandos} formandos`,
        accaoSugerida: "Documento de identificação na ficha de cada formando.",
      };
    case "doc_habilitacoes":
      return {
        ok: manualAnexo(id) || ratioOk(input.formandosComHabilitacoes, input.totalFormandos),
        detalhe: `${input.formandosComHabilitacoes}/${input.totalFormandos} formandos`,
        accaoSugerida: "Certificado de habilitações na ficha do formando.",
      };
    case "doc_patronal":
      return {
        ok: manualAnexo(id) || ratioOk(input.formandosComPatronal, input.totalFormandos),
        detalhe: `${input.formandosComPatronal}/${input.totalFormandos} formandos`,
        accaoSugerida: "Declaração patronal na ficha do formando.",
      };
    case "doc_morada":
      return {
        ok: manualAnexo(id) || ratioOk(input.formandosComMorada, input.totalFormandos),
        detalhe: `${input.formandosComMorada}/${input.totalFormandos} formandos`,
        accaoSugerida: "Comprovativo de morada na ficha do formando.",
      };
    case "doc_iban":
      return {
        ok: manualAnexo(id) || ratioOk(input.formandosComIban, input.totalFormandos),
        detalhe: `${input.formandosComIban}/${input.totalFormandos} formandos`,
        accaoSugerida: "IBAN nominativo na ficha do formando.",
      };
    default:
      return {
        ok: manualAnexo(id),
        manual: true,
        detalhe: manualAnexo(id) ? "Anexo registado" : undefined,
      };
  }
}

export function buildDtpChecklist(input: DtpChecklistInput): {
  tipoFinanciamento: TipoFinanciamentoDtp;
  tipoLabel: string;
  secoes: Array<{
    ordem: number;
    titulo: string;
    concluidos: number;
    total: number;
    itens: DtpChecklistItem[];
  }>;
  items: DtpChecklistItem[];
  concluidos: number;
  total: number;
  scorePercent: number;
} {
  const tipo = input.tipoFinanciamento;
  const tipoLabel = tipo === "FINANCIADA" ? "Financiada" : "Autofinanciada";
  const secoesDef = DTP_QUADRO_SECOES[tipo];
  const items: DtpChecklistItem[] = [];

  for (const sec of secoesDef) {
    for (const item of sec.itens) {
      if (item.soFinanciada && tipo !== "FINANCIADA") continue;
      const result = checkDtpItem(item.id, input);
      items.push({
        id: item.id,
        label: item.label,
        ok: result.ok,
        detalhe: result.detalhe,
        manual: result.manual,
        accaoSugerida: result.accaoSugerida,
        secaoOrdem: sec.ordem,
        secaoTitulo: sec.titulo,
      });
    }
  }

  const secoes = secoesDef.map((sec) => {
    const secItems = items.filter((i) => i.secaoOrdem === sec.ordem);
    return {
      ordem: sec.ordem,
      titulo: sec.titulo,
      concluidos: secItems.filter((i) => i.ok).length,
      total: secItems.length,
      itens: secItems,
    };
  }).filter((s) => s.total > 0);

  const concluidos = items.filter((i) => i.ok).length;
  const total = items.length;
  const scorePercent = total > 0 ? Math.round((concluidos / total) * 100) : 0;

  return { tipoFinanciamento: tipo, tipoLabel, secoes, items, concluidos, total, scorePercent };
}

export function dtpTipoFromAcao(raw: string | null | undefined): TipoFinanciamentoDtp {
  return raw === "FINANCIADA" ? "FINANCIADA" : "AUTO_FINANCIADA";
}
