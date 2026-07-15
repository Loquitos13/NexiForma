export type CrmProximoPassoIa = {
  accao: string;
  responsavel: "vendedor" | "cliente" | "interno";
  prazoSugerido: string | null;
  prioridade: "alta" | "media" | "baixa";
};

export type CrmGatilhoVendaIa = {
  tipo: "upsell" | "cross_sell" | "renovacao" | "novo_servico";
  descricao: string;
  confianca: number;
  produtoSugerido: string | null;
};

export type CrmDadosExtraidosIa = {
  orcamentoReferidoEur: number | null;
  decisorNome: string | null;
  prazoDecisao: string | null;
};

export type CrmNotaInsightsJson = {
  resumo_situacao: string;
  sentimento: "positivo" | "neutro" | "preocupado" | "urgente";
  proximos_passos: CrmProximoPassoIa[];
  gatilhos_venda: CrmGatilhoVendaIa[];
  sinais_risco: string[];
  dados_extraidos: CrmDadosExtraidosIa;
};

export type CrmInsightsEngine = "llm" | "local";

export const CRM_SUGESTAO_REJEICAO_MOTIVOS = [
  "irrelevante",
  "timing_inadequado",
  "ja_contactado",
  "erro_ia",
  "outro",
] as const;

export type CrmSugestaoRejeicaoMotivo = (typeof CRM_SUGESTAO_REJEICAO_MOTIVOS)[number];
