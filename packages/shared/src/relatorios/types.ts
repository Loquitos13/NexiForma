/** Variação entre dois períodos (valor actual vs período de referência). */
export type RelatorioVariacao = {
  valor: number;
  referencia: number;
  deltaAbsoluto: number;
  deltaPct: number | null;
};

export type RelatorioComparacoes = {
  mesAnterior: RelatorioVariacao;
  trimestreAnterior: RelatorioVariacao;
  semestreAnterior: RelatorioVariacao;
  anoAnterior: RelatorioVariacao;
};

export type RelatorioKpi = {
  id: string;
  label: string;
  valor: number;
  formato: "numero" | "euro" | "percentagem";
  comparacoes: RelatorioComparacoes;
};

export type RelatorioSerieMensal = {
  mes: string;
  label: string;
  valor: number;
  valorSecundario?: number;
};

export type RelatorioFunil = {
  estado: string;
  label: string;
  quantidade: number;
  valorCentavos: number;
};

export type RelatorioTopCliente = {
  entidadeClienteId: string;
  nome: string;
  faturadoCentavos: number;
  numFaturas: number;
};

export type RelatorioOrigemLead = {
  origem: string;
  label: string;
  quantidade: number;
  valorCentavos: number;
};

export type RelatorioFinanceiro = {
  kpis: RelatorioKpi[];
  serieMensal: RelatorioSerieMensal[];
  serieIva: RelatorioSerieMensal[];
  topClientes: RelatorioTopCliente[];
  distribuicaoEstado: RelatorioFunil[];
  avancado: RelatorioFinanceiroAvancado;
};

export type RelatorioFluxoCaixaJanela = {
  receberCentavos: number;
  numDocumentos: number;
};

export type RelatorioFluxoCaixa = {
  dias30: RelatorioFluxoCaixaJanela;
  dias60: RelatorioFluxoCaixaJanela;
  dias90: RelatorioFluxoCaixaJanela;
  nota: string;
};

export type RelatorioAgingBucket = {
  id: string;
  label: string;
  valorCentavos: number;
  quantidade: number;
};

export type RelatorioMargemItem = {
  descricao: string;
  faturadoCentavos: number;
  quantidade: number;
};

export type RelatorioFinanceiroAvancado = {
  fluxoCaixaProjecao: RelatorioFluxoCaixa;
  agingRecebiveis: RelatorioAgingBucket[];
  margemPorServico: RelatorioMargemItem[];
  receitaMediaMensalCentavos: number;
  aReceberTotalCentavos: number;
  runwayEstimadoMeses: number | null;
  burnRateDisponivel: false;
  notaBurnRate: string;
};

export type RelatorioConversaoPropostas = {
  /** Propostas enviadas no período (coorte base do funil). */
  enviadas: number;
  /** Aceites dentro da coorte enviada no período. */
  aceites: number;
  /** Faturadas dentro da coorte (fatura emitida, independentemente da data). */
  faturadas: number;
  taxaAceitePct: number;
  taxaFaturacaoPct: number;
  taxaConversaoTotalPct: number;
  valorFaturadoCentavos: number;
  /** Faturas emitidas no período (propostas de qualquer mês). */
  faturasEmitidasPeriodo: number;
  valorFaturadoPeriodoCentavos: number;
};

export type RelatorioComercial = {
  kpis: RelatorioKpi[];
  /** Funil enviadas → aceites → faturação (mês actual). */
  conversaoPropostas: RelatorioConversaoPropostas;
  funilLeads: RelatorioFunil[];
  funilPropostas: RelatorioFunil[];
  origemLeads: RelatorioOrigemLead[];
  serieLeads: RelatorioSerieMensal[];
  seriePropostas: RelatorioSerieMensal[];
  seriePipeline: RelatorioSerieMensal[];
  avancado: RelatorioComercialAvancado;
};

export type RelatorioFunilEtapa = {
  etapa: string;
  label: string;
  quantidade: number;
  taxaConversaoPct: number | null;
  taxaAbandonoPct: number | null;
};

export type RelatorioTempoProposta = {
  mediaDias: number | null;
  medianaDias: number | null;
  amostras: number;
  minDias: number | null;
  maxDias: number | null;
};

export type RelatorioCohortLinha = {
  cohortMes: string;
  cohortLabel: string;
  clientes: number;
  faturadoCentavos: number;
  retencaoPct: number | null;
};

export type RelatorioLtvResumo = {
  ltvMedioCentavos: number;
  ltvMedianoCentavos: number;
  clientesComFaturacao: number;
  ratioLtvCac: number | null;
  cacDisponivel: false;
  notaCac: string;
};

export type RelatorioComercialAvancado = {
  funilLeadsEtapas: RelatorioFunilEtapa[];
  funilPropostasEtapas: RelatorioFunilEtapa[];
  tempoAceiteProposta: RelatorioTempoProposta;
  cohortClientes: RelatorioCohortLinha[];
  ltv: RelatorioLtvResumo;
};

export type RelatorioEmpresarial = {
  kpis: RelatorioKpi[];
  serieMatriculas: RelatorioSerieMensal[];
  acoesPorEstado: RelatorioFunil[];
  compliance: {
    formadoresCcExpirar30d: number;
    sigoPendentes: number;
    sigoRejeitadas: number;
    taxaAprovacaoQuiz: number | null;
    acoesEmCurso: number;
  };
  avancado: RelatorioEmpresarialAvancado;
};

export type RelatorioGargalo = {
  id: string;
  label: string;
  valor: number;
  severidade: "baixa" | "media" | "alta";
  detalhe?: string;
};

export type RelatorioEmpresarialAvancado = {
  gargalosOperacionais: RelatorioGargalo[];
  okrsDisponivel: false;
  enpsDisponivel: false;
  notaMetas: string;
};

export type RelatorioDashboard = {
  geradoEm: string;
  periodoReferencia: { inicio: string; fim: string };
  financeiro: RelatorioFinanceiro;
  comercial: RelatorioComercial;
  empresarial: RelatorioEmpresarial;
};

export type RelatorioInsightsRequest = {
  secao: "financeiro" | "comercial" | "empresarial";
  /** PDF completo com análise expandida e descrições de gráficos. */
  modoPdf?: boolean;
  /** Descrições IA por gráfico (Enterprise, sem gerar PDF). */
  incluirDescricoesGraficos?: boolean;
};

export type RelatorioDescricaoGrafico = {
  titulo: string;
  descricao: string;
};

export type RelatorioInsightsResponse = {
  secao: RelatorioInsightsRequest["secao"];
  titulo: string;
  resumo: string;
  pontos: string[];
  recomendacoes: string[];
  /** Interpretação de cada gráfico (modo PDF). */
  descricoesGraficos?: RelatorioDescricaoGrafico[];
  /** Texto analítico adicional (modo PDF). */
  analiseDetalhada?: string;
  engine: "llm" | "local";
  geradoEm: string;
};
