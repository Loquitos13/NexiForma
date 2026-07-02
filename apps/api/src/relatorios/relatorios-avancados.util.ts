import type {
  RelatorioAgingBucket,
  RelatorioCohortLinha,
  RelatorioComercialAvancado,
  RelatorioEmpresarialAvancado,
  RelatorioFinanceiroAvancado,
  RelatorioFluxoCaixa,
  RelatorioFunilEtapa,
  RelatorioGargalo,
  RelatorioLtvResumo,
  RelatorioMargemItem,
  RelatorioSerieMensal,
  RelatorioTempoProposta,
} from "@nexiforma/shared";
import { mesKey, mesLabel } from "./relatorios-period.util";

const FATURA_VALIDA = ["EMITIDA", "COMUNICADA_AT"] as const;

const MS_DIA = 86_400_000;

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * MS_DIA);
}

function pctRatio(num: number, den: number): number | null {
  return den > 0 ? Math.round((num / den) * 1000) / 10 : null;
}

function pctAbandono(num: number, den: number): number | null {
  const conv = pctRatio(num, den);
  return conv != null ? Math.round((100 - conv) * 10) / 10 : null;
}

function mediana(nums: number[]): number | null {
  if (!nums.length) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function media(nums: number[]): number | null {
  if (!nums.length) return null;
  return Math.round((nums.reduce((s, n) => s + n, 0) / nums.length) * 10) / 10;
}

export type FaturaRecebivelRow = {
  valorCentavos: number;
  dataVencimento: Date | null;
  dataEmissao: Date | null;
  estado: string;
  entidadeClienteId: string;
};

export type FaturaLinhaRow = {
  descricao: string;
  precoUnitCentavos: number;
  quantidade: { toNumber(): number } | number;
  fatura: { estado: string; dataEmissao: Date | null };
};

export type PropostaTimingRow = {
  estado: string;
  enviadaEm: Date | null;
  aceiteEm: Date | null;
  updatedAt: Date;
  createdAt: Date;
  fatura: { estado: string } | null;
};

export function buildFluxoCaixaProjecao(
  faturas: FaturaRecebivelRow[],
  ref: Date,
): RelatorioFluxoCaixa {
  const valid = faturas.filter((f) =>
    FATURA_VALIDA.includes(f.estado as (typeof FATURA_VALIDA)[number]),
  );

  function janela(dias: number) {
    const fim = addDays(ref, dias);
    let receberCentavos = 0;
    let numDocumentos = 0;
    for (const f of valid) {
      const due = f.dataVencimento ?? f.dataEmissao;
      if (!due || due < ref || due > fim) continue;
      receberCentavos += f.valorCentavos;
      numDocumentos++;
    }
    return { receberCentavos, numDocumentos };
  }

  return {
    dias30: janela(30),
    dias60: janela(60),
    dias90: janela(90),
    nota: "Projeção de recebíveis com vencimento nos próximos 30/60/90 dias. Não inclui despesas nem pagamentos efectuados.",
  };
}

export function buildAgingRecebiveis(faturas: FaturaRecebivelRow[], ref: Date): RelatorioAgingBucket[] {
  const valid = faturas.filter((f) =>
    FATURA_VALIDA.includes(f.estado as (typeof FATURA_VALIDA)[number]),
  );
  const buckets: RelatorioAgingBucket[] = [
    { id: "vencido", label: "Vencido", valorCentavos: 0, quantidade: 0 },
    { id: "0-30", label: "0–30 dias", valorCentavos: 0, quantidade: 0 },
    { id: "31-60", label: "31–60 dias", valorCentavos: 0, quantidade: 0 },
    { id: "61+", label: "61+ dias", valorCentavos: 0, quantidade: 0 },
  ];

  for (const f of valid) {
    const due = f.dataVencimento ?? f.dataEmissao;
    if (!due) continue;
    const diff = Math.floor((due.getTime() - ref.getTime()) / MS_DIA);
    let idx = 3;
    if (diff < 0) idx = 0;
    else if (diff <= 30) idx = 1;
    else if (diff <= 60) idx = 2;
    buckets[idx]!.valorCentavos += f.valorCentavos;
    buckets[idx]!.quantidade++;
  }
  return buckets;
}

export function buildMargemPorServico(linhas: FaturaLinhaRow[]): RelatorioMargemItem[] {
  const map = new Map<string, { total: number; qty: number }>();
  for (const l of linhas) {
    if (
      !FATURA_VALIDA.includes(l.fatura.estado as (typeof FATURA_VALIDA)[number]) ||
      !l.fatura.dataEmissao
    ) {
      continue;
    }
    const desc = l.descricao.trim().slice(0, 120) || "Sem descrição";
    const qty =
      typeof l.quantidade === "number" ? l.quantidade : l.quantidade.toNumber();
    const valor = Math.round(l.precoUnitCentavos * qty);
    const cur = map.get(desc) ?? { total: 0, qty: 0 };
    cur.total += valor;
    cur.qty += qty;
    map.set(desc, cur);
  }
  return [...map.entries()]
    .map(([descricao, v]) => ({
      descricao,
      faturadoCentavos: v.total,
      quantidade: Math.round(v.qty * 100) / 100,
    }))
    .sort((a, b) => b.faturadoCentavos - a.faturadoCentavos)
    .slice(0, 10);
}

export function buildFinanceiroAvancado(
  faturas: FaturaRecebivelRow[],
  linhas: FaturaLinhaRow[],
  serieMensal: RelatorioSerieMensal[],
  ref: Date,
): RelatorioFinanceiroAvancado {
  const fluxoCaixaProjecao = buildFluxoCaixaProjecao(faturas, ref);
  const agingRecebiveis = buildAgingRecebiveis(faturas, ref);
  const margemPorServico = buildMargemPorServico(linhas);

  const mesesComValor = serieMensal.filter((s) => s.valor > 0);
  const receitaMediaMensalCentavos =
    mesesComValor.length > 0
      ? Math.round(
          mesesComValor.reduce((s, m) => s + m.valor, 0) / mesesComValor.length,
        )
      : 0;

  const aReceberTotalCentavos = agingRecebiveis.reduce((s, b) => s + b.valorCentavos, 0);
  const runwayEstimadoMeses =
    receitaMediaMensalCentavos > 0
      ? Math.round((aReceberTotalCentavos / receitaMediaMensalCentavos) * 10) / 10
      : null;

  return {
    fluxoCaixaProjecao,
    agingRecebiveis,
    margemPorServico,
    receitaMediaMensalCentavos,
    aReceberTotalCentavos,
    runwayEstimadoMeses,
    burnRateDisponivel: false,
    notaBurnRate:
      "Burn rate e runway real requerem registo de despesas. O runway estimado usa recebíveis ÷ receita média mensal como proxy de liquidez.",
  };
}

export function buildFunilLeadsEtapas(
  leads: Array<{ estado: string }>,
): RelatorioFunilEtapa[] {
  const total = leads.length;
  const contactados = leads.filter((l) =>
    ["CONTACTADO", "QUALIFICADO", "CONVERTIDO"].includes(l.estado),
  ).length;
  const qualificados = leads.filter((l) =>
    ["QUALIFICADO", "CONVERTIDO"].includes(l.estado),
  ).length;
  const convertidos = leads.filter((l) => l.estado === "CONVERTIDO").length;

  return [
    {
      etapa: "entrada",
      label: "Leads totais",
      quantidade: total,
      taxaConversaoPct: null,
      taxaAbandonoPct: null,
    },
    {
      etapa: "contacto",
      label: "Contactados+",
      quantidade: contactados,
      taxaConversaoPct: pctRatio(contactados, total),
      taxaAbandonoPct: pctAbandono(contactados, total),
    },
    {
      etapa: "qualificacao",
      label: "Qualificados+",
      quantidade: qualificados,
      taxaConversaoPct: pctRatio(qualificados, contactados),
      taxaAbandonoPct: pctAbandono(qualificados, contactados),
    },
    {
      etapa: "convertido",
      label: "Convertidos",
      quantidade: convertidos,
      taxaConversaoPct: pctRatio(convertidos, qualificados),
      taxaAbandonoPct: pctAbandono(convertidos, qualificados),
    },
  ];
}

export function buildFunilPropostasEtapas(propostas: PropostaTimingRow[]): RelatorioFunilEtapa[] {
  const enviadas = propostas.filter((p) => p.estado !== "RASCUNHO").length;
  const aceites = propostas.filter((p) => p.estado === "ACEITE").length;
  const faturadas = propostas.filter(
    (p) =>
      p.estado === "ACEITE" &&
      p.fatura &&
      FATURA_VALIDA.includes(p.fatura.estado as (typeof FATURA_VALIDA)[number]),
  ).length;
  const rejeitadas = propostas.filter((p) => p.estado === "REJEITADA").length;

  return [
    {
      etapa: "enviada",
      label: "Enviadas",
      quantidade: enviadas,
      taxaConversaoPct: null,
      taxaAbandonoPct: null,
    },
    {
      etapa: "aceite",
      label: "Aceites",
      quantidade: aceites,
      taxaConversaoPct: pctRatio(aceites, enviadas),
      taxaAbandonoPct: pctAbandono(aceites, enviadas),
    },
    {
      etapa: "faturada",
      label: "Faturadas",
      quantidade: faturadas,
      taxaConversaoPct: pctRatio(faturadas, aceites),
      taxaAbandonoPct: pctAbandono(faturadas, aceites),
    },
    {
      etapa: "rejeitada",
      label: "Rejeitadas",
      quantidade: rejeitadas,
      taxaConversaoPct: pctRatio(rejeitadas, enviadas),
      taxaAbandonoPct: pctAbandono(rejeitadas, enviadas),
    },
  ];
}

export function buildTempoAceiteProposta(propostas: PropostaTimingRow[]): RelatorioTempoProposta {
  const dias: number[] = [];
  for (const p of propostas) {
    if (p.estado !== "ACEITE") continue;
    const enviada = p.enviadaEm ?? null;
    const aceite = p.aceiteEm ?? p.updatedAt;
    if (!enviada || !aceite) continue;
    const diff = (aceite.getTime() - enviada.getTime()) / MS_DIA;
    if (diff >= 0 && diff <= 730) dias.push(Math.round(diff * 10) / 10);
  }
  return {
    mediaDias: media(dias),
    medianaDias: mediana(dias),
    amostras: dias.length,
    minDias: dias.length ? Math.min(...dias) : null,
    maxDias: dias.length ? Math.max(...dias) : null,
  };
}

export function buildCohortClientes(
  faturas: FaturaRecebivelRow[],
  ref: Date,
): RelatorioCohortLinha[] {
  const valid = faturas.filter(
    (f) =>
      f.dataEmissao &&
      FATURA_VALIDA.includes(f.estado as (typeof FATURA_VALIDA)[number]),
  );

  const firstInvoice = new Map<string, Date>();
  for (const f of valid) {
    if (!f.dataEmissao) continue;
    const cur = firstInvoice.get(f.entidadeClienteId);
    if (!cur || f.dataEmissao < cur) firstInvoice.set(f.entidadeClienteId, f.dataEmissao);
  }

  const cohortKeys: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
    cohortKeys.push(mesKey(d));
  }

  const clientesPorMes = new Map<string, Set<string>>();
  const faturadoPorMesCliente = new Map<string, Map<string, number>>();

  for (const f of valid) {
    if (!f.dataEmissao) continue;
    const k = mesKey(f.dataEmissao);
    if (!faturadoPorMesCliente.has(k)) faturadoPorMesCliente.set(k, new Map());
    const m = faturadoPorMesCliente.get(k)!;
    m.set(f.entidadeClienteId, (m.get(f.entidadeClienteId) ?? 0) + f.valorCentavos);
  }

  for (const [clienteId, first] of firstInvoice) {
    const ck = mesKey(first);
    if (!clientesPorMes.has(ck)) clientesPorMes.set(ck, new Set());
    clientesPorMes.get(ck)!.add(clienteId);
  }

  return cohortKeys.map((cohortMes) => {
    const clientesSet = clientesPorMes.get(cohortMes) ?? new Set<string>();
    const clientes = clientesSet.size;
    let faturadoCentavos = 0;
    const fatMes = faturadoPorMesCliente.get(cohortMes);
    if (fatMes) {
      for (const id of clientesSet) faturadoCentavos += fatMes.get(id) ?? 0;
    }

    const [y, m] = cohortMes.split("-").map(Number);
    const nextMes = mesKey(new Date(y!, m!, 1));
    let retidos = 0;
    if (clientes > 0) {
      const nextFat = faturadoPorMesCliente.get(nextMes);
      if (nextFat) {
        for (const id of clientesSet) {
          if ((nextFat.get(id) ?? 0) > 0) retidos++;
        }
      }
    }

    return {
      cohortMes,
      cohortLabel: mesLabel(cohortMes),
      clientes,
      faturadoCentavos,
      retencaoPct: clientes > 0 ? pctRatio(retidos, clientes) : null,
    };
  });
}

export function buildLtvResumo(faturas: FaturaRecebivelRow[]): RelatorioLtvResumo {
  const valid = faturas.filter((f) =>
    FATURA_VALIDA.includes(f.estado as (typeof FATURA_VALIDA)[number]),
  );
  const porCliente = new Map<string, number>();
  for (const f of valid) {
    porCliente.set(
      f.entidadeClienteId,
      (porCliente.get(f.entidadeClienteId) ?? 0) + f.valorCentavos,
    );
  }
  const valores = [...porCliente.values()];
  return {
    ltvMedioCentavos:
      valores.length > 0
        ? Math.round(valores.reduce((s, v) => s + v, 0) / valores.length)
        : 0,
    ltvMedianoCentavos: mediana(valores) != null ? Math.round(mediana(valores)!) : 0,
    clientesComFaturacao: valores.length,
    ratioLtvCac: null,
    cacDisponivel: false,
    notaCac:
      "CAC requer registo de custos de marketing/campanhas. Quando disponível, o ratio ideal LTV:CAC é ≥ 3:1.",
  };
}

export function buildComercialAvancado(
  leads: Array<{ estado: string }>,
  propostas: PropostaTimingRow[],
  faturas: FaturaRecebivelRow[],
  ref: Date,
): RelatorioComercialAvancado {
  return {
    funilLeadsEtapas: buildFunilLeadsEtapas(leads),
    funilPropostasEtapas: buildFunilPropostasEtapas(propostas),
    tempoAceiteProposta: buildTempoAceiteProposta(propostas),
    cohortClientes: buildCohortClientes(faturas, ref),
    ltv: buildLtvResumo(faturas),
  };
}

export type GargalosInput = {
  sigoPendentes: number;
  sigoRejeitadas: number;
  ccExpirar: number;
  propostasAguardando: number;
  leadsParados: number;
  faturasRascunho: number;
  pedidosAnulacaoPendentes: number;
  acoesPlaneadas: number;
};

function severidade(valor: number, media: number, alta: number): RelatorioGargalo["severidade"] {
  if (valor >= alta) return "alta";
  if (valor >= media) return "media";
  return "baixa";
}

export function buildGargalosOperacionais(input: GargalosInput): RelatorioGargalo[] {
  const items: RelatorioGargalo[] = [
    {
      id: "sigo_pendentes",
      label: "Submissões SIGO pendentes",
      valor: input.sigoPendentes,
      severidade: severidade(input.sigoPendentes, 2, 5),
      detalhe: "Formações aguardam validação externa",
    },
    {
      id: "cc_expirar",
      label: "CC formadores a expirar (30d)",
      valor: input.ccExpirar,
      severidade: severidade(input.ccExpirar, 1, 3),
      detalhe: "Risco de indisponibilidade de formadores",
    },
    {
      id: "propostas_aguardando",
      label: "Propostas enviadas sem resposta",
      valor: input.propostasAguardando,
      severidade: severidade(input.propostasAguardando, 3, 8),
      detalhe: "Estado ENVIADA - follow-up comercial recomendado",
    },
    {
      id: "leads_parados",
      label: "Leads novos parados (+14 dias)",
      valor: input.leadsParados,
      severidade: severidade(input.leadsParados, 5, 15),
      detalhe: "Leads em NOVO sem avanço de etapa",
    },
    {
      id: "faturas_rascunho",
      label: "Faturas em rascunho",
      valor: input.faturasRascunho,
      severidade: severidade(input.faturasRascunho, 2, 6),
      detalhe: "Documentos por emitir/comunicar",
    },
    {
      id: "anulacao_pendente",
      label: "Pedidos de anulação pendentes",
      valor: input.pedidosAnulacaoPendentes,
      severidade: severidade(input.pedidosAnulacaoPendentes, 1, 3),
    },
    {
      id: "sigo_rejeitadas",
      label: "SIGO rejeitadas",
      valor: input.sigoRejeitadas,
      severidade: severidade(input.sigoRejeitadas, 1, 3),
    },
    {
      id: "acoes_planeadas",
      label: "Acções formativas planeadas",
      valor: input.acoesPlaneadas,
      severidade: "baixa",
      detalhe: "Capacidade operacional futura",
    },
  ];
  return items.sort((a, b) => {
    const ord = { alta: 0, media: 1, baixa: 2 };
    const d = ord[a.severidade] - ord[b.severidade];
    return d !== 0 ? d : b.valor - a.valor;
  });
}

export function buildEmpresarialAvancado(input: GargalosInput): RelatorioEmpresarialAvancado {
  return {
    gargalosOperacionais: buildGargalosOperacionais(input),
    okrsDisponivel: false,
    enpsDisponivel: false,
    notaMetas:
      "OKRs e E-NPS estarão disponíveis quando o módulo de metas estratégicas e inquéritos internos for activado.",
  };
}
