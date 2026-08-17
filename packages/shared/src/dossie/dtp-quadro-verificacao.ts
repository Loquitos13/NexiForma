export type TipoFinanciamentoDtp = "FINANCIADA" | "AUTO_FINANCIADA";

export type DtpItemDef = {
  id: string;
  label: string;
  /** Só aplicável a acções financiadas. */
  soFinanciada?: boolean;
};

export type DtpSecaoDef = {
  ordem: number;
  titulo: string;
  itens: DtpItemDef[];
};

/** Quadro de verificação DTP — presencial (financiada vs autofinanciada). */
export const DTP_QUADRO_SECOES: Record<TipoFinanciamentoDtp, DtpSecaoDef[]> = {
  FINANCIADA: [
    {
      ordem: 1,
      titulo: "Enquadramento da ação",
      itens: [
        { id: "notificacao_aprovacao", label: "Notificação da decisão de aprovação da candidatura", soFinanciada: true },
        { id: "comunicacao_arranque", label: "Comunicação de arranque do projeto", soFinanciada: true },
        { id: "cronograma", label: "Cronograma" },
        { id: "programa", label: "Programa" },
        { id: "regulamento_atividade", label: "Regulamento da atividade formativa" },
        { id: "regulamento_formando", label: "Regulamento do formando" },
      ],
    },
    {
      ordem: 5,
      titulo: "Formandos",
      itens: [
        { id: "processo_selecao_formandos", label: "Processo de seleção dos formandos" },
        { id: "listagem_formandos", label: "Listagem de formandos" },
        { id: "ficha_inscricao", label: "Ficha de inscrição dos formandos" },
        { id: "rgpd_contratos", label: "Declaração RGPD + Contratos de formação" },
        { id: "doc_cc", label: "Cartão de cidadão" },
        { id: "doc_habilitacoes", label: "Certificado de habilitações" },
        { id: "doc_patronal", label: "Declaração da entidade patronal" },
        { id: "doc_morada", label: "Comprovativo de morada" },
        { id: "doc_iban", label: "IBAN nominativo" },
        { id: "seguro_acidentes", label: "Lista de formandos com seguro de acidentes pessoais", soFinanciada: true },
        { id: "mapa_pagamento", label: "Mapa de ordem de pagamento aos formandos (validado)", soFinanciada: true },
      ],
    },
    {
      ordem: 13,
      titulo: "Articulação com Academia Digital",
      itens: [
        {
          id: "reporte_apd",
          label: "Reporte retirado do Portal Academia Portugal Digital",
          soFinanciada: true,
        },
      ],
    },
  ],
  AUTO_FINANCIADA: [
    {
      ordem: 1,
      titulo: "Enquadramento da ação",
      itens: [
        { id: "cronograma", label: "Cronograma" },
        { id: "programa", label: "Programa" },
        { id: "regulamento_atividade", label: "Regulamento da atividade formativa" },
        { id: "regulamento_formando", label: "Regulamento do formando" },
      ],
    },
    {
      ordem: 5,
      titulo: "Formandos",
      itens: [
        { id: "processo_selecao_formandos", label: "Processo de seleção dos formandos" },
        { id: "listagem_formandos", label: "Listagem de formandos" },
        { id: "doc_cc", label: "Cartão de cidadão" },
        { id: "ficha_inscricao", label: "Ficha de inscrição dos formandos" },
        { id: "rgpd_contratos", label: "Declaração RGPD + Contratos de formação" },
      ],
    },
  ],
};

export function listarDtpItens(tipo: TipoFinanciamentoDtp): DtpItemDef[] {
  return DTP_QUADRO_SECOES[tipo].flatMap((s) => s.itens);
}
