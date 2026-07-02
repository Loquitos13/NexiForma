import { Injectable } from "@nestjs/common";
import type {
  RelatorioComercial,
  RelatorioConversaoPropostas,
  RelatorioDashboard,
  RelatorioEmpresarial,
  RelatorioFinanceiro,
  RelatorioFunil,
  RelatorioKpi,
  RelatorioSerieMensal,
} from "@nexiforma/shared";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "../common/tenant-scope";
import {
  buildComercialAvancado,
  buildEmpresarialAvancado,
  buildFinanceiroAvancado,
  type FaturaLinhaRow,
  type FaturaRecebivelRow,
  type PropostaTimingRow,
} from "./relatorios-avancados.util";
import {
  buildComparacoes,
  buildPeriodPairs,
  inPeriod,
  last12MesesKeys,
  mesKey,
  mesLabel,
  type ParPeriodos,
  type PeriodoJanela,
} from "./relatorios-period.util";

const FATURA_VALIDA = ["EMITIDA", "COMUNICADA_AT"] as const;
const LEAD_ABERTO = ["NOVO", "CONTACTADO", "QUALIFICADO"] as const;

const LEAD_ESTADO_LABEL: Record<string, string> = {
  NOVO: "Novos",
  CONTACTADO: "Contactados",
  QUALIFICADO: "Qualificados",
  CONVERTIDO: "Convertidos",
  PERDIDO: "Perdidos",
};

const PROPOSTA_ESTADO_LABEL: Record<string, string> = {
  RASCUNHO: "Rascunho",
  ENVIADA: "Enviadas",
  ACEITE: "Aceites",
  REJEITADA: "Rejeitadas",
  CANCELADA: "Canceladas",
};

type PropostaRow = {
  estado: string;
  valorCentavos: number;
  createdAt: Date;
  updatedAt: Date;
  enviadaEm: Date | null;
  aceiteEm: Date | null;
  fatura: {
    estado: string;
    dataEmissao: Date | null;
    valorCentavos: number;
  } | null;
};

const LEAD_ORIGEM_LABEL: Record<string, string> = {
  WEBSITE: "Website",
  REFERRAL: "Referência",
  FEIRA: "Feira",
  LINKEDIN: "LinkedIn",
  TELEFONE: "Telefone",
  OUTRO: "Outro",
};

const ACAO_ESTADO_LABEL: Record<string, string> = {
  PLANEADA: "Planeadas",
  EM_CURSO: "Em curso",
  CONCLUIDA: "Concluídas",
  CANCELADA: "Canceladas",
};

type PeriodosExt = ParPeriodos;

@Injectable()
export class RelatoriosDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(user: RequestUser): Promise<RelatorioDashboard> {
    const tenantId = requireTenantId(user);
    const ref = new Date();
    const periodos = buildPeriodPairs(ref) as PeriodosExt;

    const [
      faturas,
      faturaLinhas,
      faturasRascunho,
      leads,
      propostas,
      matriculas,
      acoes,
      quizRows,
      ccExpirar,
      sigoPend,
      sigoRej,
      pedidosAnulacao,
    ] = await Promise.all([
        this.prisma.faturaComercial.findMany({
          where: { tenantId, estado: { in: [...FATURA_VALIDA] } },
          select: {
            valorCentavos: true,
            ivaCentavos: true,
            retencaoCentavos: true,
            dataEmissao: true,
            dataVencimento: true,
            estado: true,
            entidadeClienteId: true,
            entidadeCliente: { select: { nome: true } },
          },
        }),
        this.prisma.faturaLinha.findMany({
          where: { fatura: { tenantId, estado: { in: [...FATURA_VALIDA] } } },
          select: {
            descricao: true,
            precoUnitCentavos: true,
            quantidade: true,
            fatura: { select: { estado: true, dataEmissao: true } },
          },
        }),
        this.prisma.faturaComercial.count({ where: { tenantId, estado: "RASCUNHO" } }),
        this.prisma.leadComercial.findMany({
          where: { tenantId },
          select: {
            estado: true,
            origem: true,
            valorEstimadoCentavos: true,
            createdAt: true,
            convertidoEm: true,
          },
        }),
        this.prisma.propostaComercial.findMany({
          where: { tenantId },
          select: {
            estado: true,
            valorCentavos: true,
            createdAt: true,
            updatedAt: true,
            enviadaEm: true,
            aceiteEm: true,
            fatura: {
              select: {
                estado: true,
                dataEmissao: true,
                valorCentavos: true,
              },
            },
          },
        }),
        this.prisma.matricula.findMany({
          where: { tenantId },
          select: { estado: true, dataInscricao: true },
        }),
        this.prisma.acaoFormacao.groupBy({
          by: ["estado"],
          where: { tenantId },
          _count: { id: true },
        }),
        this.prisma.quizTentativa.groupBy({
          by: ["aprovado"],
          where: { tenantId },
          _count: true,
        }),
        this.prisma.formadorProfile.count({
          where: {
            tenantId,
            ccValidade: { lte: new Date(ref.getTime() + 30 * 86_400_000), gte: ref },
          },
        }),
        this.prisma.sigoSubmissao.count({
          where: { tenantId, estado: { in: ["PENDENTE", "SUBMETIDA"] } },
        }),
        this.prisma.sigoSubmissao.count({ where: { tenantId, estado: "REJEITADA" } }),
        this.prisma.faturaPedidoAnulacao.count({
          where: { fatura: { tenantId }, estado: "PENDENTE" },
        }),
      ]);

    const limiteLeadsParados = new Date(ref.getTime() - 14 * 86_400_000);
    const leadsParados = leads.filter(
      (l) => l.estado === "NOVO" && l.createdAt <= limiteLeadsParados,
    ).length;
    const propostasAguardando = propostas.filter((p) => p.estado === "ENVIADA").length;
    const acoesPlaneadas = acoes.find((a) => a.estado === "PLANEADA")?._count.id ?? 0;

    const financeiro = this.buildFinanceiro(faturas, periodos, ref);
    const comercial = this.buildComercial(leads, propostas, periodos, ref);
    const empresarial = this.buildEmpresarial(
      matriculas,
      acoes,
      quizRows,
      ccExpirar,
      sigoPend,
      sigoRej,
      periodos,
      ref,
    );

    financeiro.avancado = buildFinanceiroAvancado(
      faturas as FaturaRecebivelRow[],
      faturaLinhas as FaturaLinhaRow[],
      financeiro.serieMensal,
      ref,
    );
    comercial.avancado = buildComercialAvancado(
      leads,
      propostas as PropostaTimingRow[],
      faturas as FaturaRecebivelRow[],
      ref,
    );
    empresarial.avancado = buildEmpresarialAvancado({
      sigoPendentes: sigoPend,
      sigoRejeitadas: sigoRej,
      ccExpirar,
      propostasAguardando,
      leadsParados,
      faturasRascunho,
      pedidosAnulacaoPendentes: pedidosAnulacao,
      acoesPlaneadas,
    });

    return {
      geradoEm: ref.toISOString(),
      periodoReferencia: {
        inicio: periodos.actual.inicio.toISOString(),
        fim: periodos.actual.fim.toISOString(),
      },
      financeiro,
      comercial,
      empresarial,
    };
  }

  private sumFaturas(
    faturas: Array<{
      valorCentavos: number;
      ivaCentavos: number;
      retencaoCentavos: number;
      dataEmissao: Date | null;
    }>,
    p: PeriodoJanela,
  ) {
    let bruto = 0;
    let iva = 0;
    let n = 0;
    for (const f of faturas) {
      if (!inPeriod(f.dataEmissao, p)) continue;
      bruto += f.valorCentavos;
      iva += f.ivaCentavos;
      n++;
    }
    return { bruto, iva, n };
  }

  private mkKpi(
    id: string,
    label: string,
    valor: number,
    fmt: RelatorioKpi["formato"],
    refs: [number, number, number, number],
  ): RelatorioKpi {
    return { id, label, valor, formato: fmt, comparacoes: buildComparacoes(valor, ...refs) };
  }

  private buildFinanceiro(
    faturas: Array<{
      valorCentavos: number;
      ivaCentavos: number;
      retencaoCentavos: number;
      dataEmissao: Date | null;
      estado: string;
      entidadeClienteId: string;
      entidadeCliente: { nome: string };
    }>,
    periodos: PeriodosExt,
    ref: Date,
  ): RelatorioFinanceiro {
    const actual = this.sumFaturas(faturas, periodos.actual);
    const mesAnt = this.sumFaturas(faturas, periodos.mesAnterior);
    const trimAnt = this.sumFaturas(faturas, periodos.trimestreAnterior);
    const semAnt = this.sumFaturas(faturas, periodos.semestreAnterior);
    const anoAnt = this.sumFaturas(faturas, periodos.anoAnterior);
    const trimActual = this.sumFaturas(faturas, periodos.trimestreActual);
    const anoActualSum = this.sumFaturas(faturas, periodos.anoActual);

    const ticket = actual.n > 0 ? Math.round(actual.bruto / actual.n) : 0;
    const ticketMesAnt = mesAnt.n > 0 ? Math.round(mesAnt.bruto / mesAnt.n) : 0;

    const kpis: RelatorioKpi[] = [
      this.mkKpi("faturado", "Faturação (mês actual)", actual.bruto, "euro", [
        mesAnt.bruto,
        trimAnt.bruto,
        semAnt.bruto,
        anoAnt.bruto,
      ]),
      this.mkKpi("iva", "IVA facturado", actual.iva, "euro", [
        mesAnt.iva,
        trimAnt.iva,
        semAnt.iva,
        anoAnt.iva,
      ]),
      this.mkKpi("faturas", "Faturas emitidas", actual.n, "numero", [
        mesAnt.n,
        trimAnt.n,
        semAnt.n,
        anoAnt.n,
      ]),
      this.mkKpi("ticket", "Ticket médio", ticket, "euro", [ticketMesAnt, 0, 0, 0]),
      this.mkKpi("trimestre", "Faturação trimestre", trimActual.bruto, "euro", [
        mesAnt.bruto,
        trimAnt.bruto,
        semAnt.bruto,
        anoAnt.bruto,
      ]),
      this.mkKpi("ano", "Faturação acumulada (ano)", anoActualSum.bruto, "euro", [
        mesAnt.bruto,
        trimAnt.bruto,
        semAnt.bruto,
        anoAnt.bruto,
      ]),
    ];

    const keys = last12MesesKeys(ref);
    const serieMap = new Map<string, { valor: number; iva: number }>();
    for (const k of keys) serieMap.set(k, { valor: 0, iva: 0 });
    for (const f of faturas) {
      if (!f.dataEmissao) continue;
      const k = mesKey(f.dataEmissao);
      const row = serieMap.get(k);
      if (!row) continue;
      row.valor += f.valorCentavos;
      row.iva += f.ivaCentavos;
    }

    const serieMensal: RelatorioSerieMensal[] = keys.map((k) => ({
      mes: k,
      label: mesLabel(k),
      valor: serieMap.get(k)?.valor ?? 0,
    }));
    const serieIva: RelatorioSerieMensal[] = keys.map((k) => ({
      mes: k,
      label: mesLabel(k),
      valor: serieMap.get(k)?.iva ?? 0,
    }));

    const byCliente = new Map<string, { nome: string; total: number; n: number }>();
    for (const f of faturas) {
      if (!inPeriod(f.dataEmissao, periodos.anoActual)) continue;
      const cur = byCliente.get(f.entidadeClienteId) ?? {
        nome: f.entidadeCliente.nome,
        total: 0,
        n: 0,
      };
      cur.total += f.valorCentavos;
      cur.n++;
      byCliente.set(f.entidadeClienteId, cur);
    }

    const topClientes = [...byCliente.entries()]
      .map(([entidadeClienteId, v]) => ({
        entidadeClienteId,
        nome: v.nome,
        faturadoCentavos: v.total,
        numFaturas: v.n,
      }))
      .sort((a, b) => b.faturadoCentavos - a.faturadoCentavos)
      .slice(0, 8);

    const estados = ["RASCUNHO", "EMITIDA", "COMUNICADA_AT", "ANULADA"] as const;
    const distribuicaoEstado: RelatorioFunil[] = estados.map((estado) => {
      const subset = faturas.filter((f) => f.estado === estado);
      return {
        estado,
        label: estado.replace("_", " "),
        quantidade: subset.length,
        valorCentavos: subset.reduce((s, f) => s + f.valorCentavos, 0),
      };
    });

    return {
      kpis,
      serieMensal,
      serieIva,
      topClientes,
      distribuicaoEstado,
      avancado: {
        fluxoCaixaProjecao: {
          dias30: { receberCentavos: 0, numDocumentos: 0 },
          dias60: { receberCentavos: 0, numDocumentos: 0 },
          dias90: { receberCentavos: 0, numDocumentos: 0 },
          nota: "",
        },
        agingRecebiveis: [],
        margemPorServico: [],
        receitaMediaMensalCentavos: 0,
        aReceberTotalCentavos: 0,
        runwayEstimadoMeses: null,
        burnRateDisponivel: false,
        notaBurnRate: "",
      },
    };
  }

  private countInPeriod<T extends { createdAt: Date }>(rows: T[], p: PeriodoJanela): number {
    return rows.filter((r) => inPeriod(r.createdAt, p)).length;
  }

  private pctRatio(num: number, den: number): number {
    return den > 0 ? Math.round((num / den) * 1000) / 10 : 0;
  }

  private isPropostaEnviada(estado: string): boolean {
    return estado !== "RASCUNHO";
  }

  private propostaEnviadaNoPeriodo(p: PropostaRow, periodo: PeriodoJanela): boolean {
    if (!this.isPropostaEnviada(p.estado)) return false;
    const ref = p.enviadaEm ?? p.updatedAt;
    return inPeriod(ref, periodo);
  }

  private propostaAceiteNoPeriodo(p: PropostaRow, periodo: PeriodoJanela): boolean {
    if (p.estado !== "ACEITE") return false;
    const ref = p.aceiteEm ?? p.updatedAt;
    return inPeriod(ref, periodo);
  }

  private propostaFaturadaNoPeriodo(p: PropostaRow, periodo: PeriodoJanela): boolean {
    if (p.estado !== "ACEITE" || !p.fatura?.dataEmissao) return false;
    if (!FATURA_VALIDA.includes(p.fatura.estado as (typeof FATURA_VALIDA)[number])) return false;
    return inPeriod(p.fatura.dataEmissao, periodo);
  }

  private propostaTemFaturaValida(p: PropostaRow): boolean {
    if (p.estado !== "ACEITE" || !p.fatura) return false;
    return FATURA_VALIDA.includes(p.fatura.estado as (typeof FATURA_VALIDA)[number]);
  }

  private buildConversaoPropostas(propostas: PropostaRow[], periodo: PeriodoJanela): RelatorioConversaoPropostas {
    const cohort = propostas.filter((p) => this.propostaEnviadaNoPeriodo(p, periodo));
    const enviadas = cohort.length;
    const aceites = cohort.filter((p) => p.estado === "ACEITE").length;
    const faturadasCohort = cohort.filter((p) => this.propostaTemFaturaValida(p));
    const valorFaturadoCentavos = faturadasCohort.reduce(
      (s, p) => s + (p.fatura?.valorCentavos ?? 0),
      0,
    );

    const faturadasActividade = propostas.filter((p) => this.propostaFaturadaNoPeriodo(p, periodo));
    const valorFaturadoPeriodoCentavos = faturadasActividade.reduce(
      (s, p) => s + (p.fatura?.valorCentavos ?? 0),
      0,
    );

    return {
      enviadas,
      aceites,
      faturadas: faturadasCohort.length,
      taxaAceitePct: this.pctRatio(aceites, enviadas),
      taxaFaturacaoPct: this.pctRatio(faturadasCohort.length, aceites),
      taxaConversaoTotalPct: this.pctRatio(faturadasCohort.length, enviadas),
      valorFaturadoCentavos,
      faturasEmitidasPeriodo: faturadasActividade.length,
      valorFaturadoPeriodoCentavos,
    };
  }

  private buildComercial(
    leads: Array<{
      estado: string;
      origem: string;
      valorEstimadoCentavos: number;
      createdAt: Date;
      convertidoEm: Date | null;
    }>,
    propostas: PropostaRow[],
    periodos: PeriodosExt,
    ref: Date,
  ): RelatorioComercial {
    const leadsActual = this.countInPeriod(leads, periodos.actual);
    const leadsMesAnt = this.countInPeriod(leads, periodos.mesAnterior);
    const leadsTrimAnt = this.countInPeriod(leads, periodos.trimestreAnterior);
    const leadsSemAnt = this.countInPeriod(leads, periodos.semestreAnterior);
    const leadsAnoAnt = this.countInPeriod(leads, periodos.anoAnterior);

    const convertidosActual = leads.filter(
      (l) => l.estado === "CONVERTIDO" && l.convertidoEm && inPeriod(l.convertidoEm, periodos.actual),
    ).length;
    const convertidosMesAnt = leads.filter(
      (l) => l.estado === "CONVERTIDO" && l.convertidoEm && inPeriod(l.convertidoEm, periodos.mesAnterior),
    ).length;

    const propostasAceites = propostas.filter((x) => x.estado === "ACEITE");
    const aceitesActual = propostas.filter((p) => this.propostaAceiteNoPeriodo(p, periodos.actual)).length;
    const aceitesMesAnt = propostas.filter((p) => this.propostaAceiteNoPeriodo(p, periodos.mesAnterior)).length;

    const enviadasActual = propostas.filter((p) => this.propostaEnviadaNoPeriodo(p, periodos.actual)).length;
    const enviadasMesAnt = propostas.filter((p) => this.propostaEnviadaNoPeriodo(p, periodos.mesAnterior)).length;

    const faturadasActual = propostas.filter((p) => this.propostaFaturadaNoPeriodo(p, periodos.actual)).length;
    const faturadasMesAnt = propostas.filter((p) => this.propostaFaturadaNoPeriodo(p, periodos.mesAnterior)).length;

    const conversaoActual = this.buildConversaoPropostas(propostas, periodos.actual);
    const conversaoMesAnt = this.buildConversaoPropostas(propostas, periodos.mesAnterior);

    const taxaAceiteProp = conversaoActual.taxaAceitePct;
    const taxaAceitePropMesAnt = conversaoMesAnt.taxaAceitePct;
    const taxaConvFat = conversaoActual.taxaFaturacaoPct;
    const taxaConvFatMesAnt = conversaoMesAnt.taxaFaturacaoPct;
    const taxaConvTotal = conversaoActual.taxaConversaoTotalPct;
    const taxaConvTotalMesAnt = conversaoMesAnt.taxaConversaoTotalPct;

    const pipelineActual = leads
      .filter((l) => LEAD_ABERTO.includes(l.estado as (typeof LEAD_ABERTO)[number]))
      .reduce((s, l) => s + l.valorEstimadoCentavos, 0);

    const taxaConv =
      leadsActual > 0 ? Math.round((convertidosActual / leadsActual) * 1000) / 10 : 0;
    const taxaConvMesAnt =
      leadsMesAnt > 0 ? Math.round((convertidosMesAnt / leadsMesAnt) * 1000) / 10 : 0;

    const propostasActual = this.countInPeriod(propostas, periodos.actual);
    const propostasMesAnt = this.countInPeriod(propostas, periodos.mesAnterior);

    const valorAceiteActual = propostasAceites
      .filter((x) => this.propostaAceiteNoPeriodo(x, periodos.actual))
      .reduce((s, x) => s + x.valorCentavos, 0);
    const valorAceiteMesAnt = propostasAceites
      .filter((x) => this.propostaAceiteNoPeriodo(x, periodos.mesAnterior))
      .reduce((s, x) => s + x.valorCentavos, 0);

    const valorFaturadoPropActual = conversaoActual.valorFaturadoCentavos;
    const valorFaturadoPropMesAnt = conversaoMesAnt.valorFaturadoCentavos;

    const kpis: RelatorioKpi[] = [
      this.mkKpi("leads", "Novos leads (mês)", leadsActual, "numero", [
        leadsMesAnt,
        leadsTrimAnt,
        leadsSemAnt,
        leadsAnoAnt,
      ]),
      this.mkKpi("convertidos", "Leads convertidos", convertidosActual, "numero", [
        convertidosMesAnt,
        leadsTrimAnt,
        leadsSemAnt,
        leadsAnoAnt,
      ]),
      this.mkKpi("taxa_conv", "Taxa conversão leads", taxaConv, "percentagem", [
        taxaConvMesAnt,
        0,
        0,
        0,
      ]),
      this.mkKpi("propostas", "Propostas criadas", propostasActual, "numero", [
        propostasMesAnt,
        0,
        0,
        0,
      ]),
      this.mkKpi("enviadas", "Propostas enviadas (mês)", enviadasActual, "numero", [
        enviadasMesAnt,
        0,
        0,
        0,
      ]),
      this.mkKpi("aceites", "Propostas aceites (mês)", aceitesActual, "numero", [aceitesMesAnt, 0, 0, 0]),
      this.mkKpi("taxa_aceite_prop", "Taxa aceite (enviadas → aceites)", taxaAceiteProp, "percentagem", [
        taxaAceitePropMesAnt,
        0,
        0,
        0,
      ]),
      this.mkKpi("faturadas", "Propostas faturadas (mês)", faturadasActual, "numero", [
        faturadasMesAnt,
        0,
        0,
        0,
      ]),
      this.mkKpi("taxa_conv_fat", "Taxa conversão (aceites → fatura)", taxaConvFat, "percentagem", [
        taxaConvFatMesAnt,
        0,
        0,
        0,
      ]),
      this.mkKpi("taxa_conv_total", "Taxa conversão total (enviadas → fatura)", taxaConvTotal, "percentagem", [
        taxaConvTotalMesAnt,
        0,
        0,
        0,
      ]),
      this.mkKpi("valor_aceite", "Valor propostas aceites", valorAceiteActual, "euro", [
        valorAceiteMesAnt,
        0,
        0,
        0,
      ]),
      this.mkKpi("valor_faturado_prop", "Valor faturado (propostas)", valorFaturadoPropActual, "euro", [
        valorFaturadoPropMesAnt,
        0,
        0,
        0,
      ]),
      this.mkKpi("pipeline", "Pipeline leads aberto", pipelineActual, "euro", [0, 0, 0, 0]),
    ];

    const funilLeads = Object.keys(LEAD_ESTADO_LABEL).map((estado) => {
      const subset = leads.filter((l) => l.estado === estado);
      return {
        estado,
        label: LEAD_ESTADO_LABEL[estado] ?? estado,
        quantidade: subset.length,
        valorCentavos: subset.reduce((s, l) => s + l.valorEstimadoCentavos, 0),
      };
    });

    const funilPropostas = Object.keys(PROPOSTA_ESTADO_LABEL).map((estado) => {
      const subset = propostas.filter((x) => x.estado === estado);
      return {
        estado,
        label: PROPOSTA_ESTADO_LABEL[estado] ?? estado,
        quantidade: subset.length,
        valorCentavos: subset.reduce((s, x) => s + x.valorCentavos, 0),
      };
    });

    const origemMap = new Map<string, { q: number; v: number }>();
    for (const l of leads) {
      const cur = origemMap.get(l.origem) ?? { q: 0, v: 0 };
      cur.q++;
      cur.v += l.valorEstimadoCentavos;
      origemMap.set(l.origem, cur);
    }
    const origemLeads = [...origemMap.entries()].map(([origem, v]) => ({
      origem,
      label: LEAD_ORIGEM_LABEL[origem] ?? origem,
      quantidade: v.q,
      valorCentavos: v.v,
    }));

    const keys = last12MesesKeys(ref);
    const leadSerie = new Map(keys.map((k) => [k, 0]));
    const propSerie = new Map(keys.map((k) => [k, 0]));
    const pipeSerie = new Map(keys.map((k) => [k, 0]));

    for (const l of leads) {
      const k = mesKey(l.createdAt);
      if (leadSerie.has(k)) leadSerie.set(k, (leadSerie.get(k) ?? 0) + 1);
    }
    for (const pr of propostas) {
      const k = mesKey(pr.createdAt);
      if (propSerie.has(k)) propSerie.set(k, (propSerie.get(k) ?? 0) + 1);
    }
    for (const l of leads) {
      const k = mesKey(l.createdAt);
      if (pipeSerie.has(k)) pipeSerie.set(k, (pipeSerie.get(k) ?? 0) + l.valorEstimadoCentavos);
    }

    const serieLeads: RelatorioSerieMensal[] = keys.map((k) => ({
      mes: k,
      label: mesLabel(k),
      valor: leadSerie.get(k) ?? 0,
    }));
    const seriePropostas: RelatorioSerieMensal[] = keys.map((k) => ({
      mes: k,
      label: mesLabel(k),
      valor: propSerie.get(k) ?? 0,
    }));
    const seriePipeline: RelatorioSerieMensal[] = keys.map((k) => ({
      mes: k,
      label: mesLabel(k),
      valor: pipeSerie.get(k) ?? 0,
    }));

    return {
      kpis,
      conversaoPropostas: conversaoActual,
      funilLeads,
      funilPropostas,
      origemLeads,
      serieLeads,
      seriePropostas,
      seriePipeline,
      avancado: {
        funilLeadsEtapas: [],
        funilPropostasEtapas: [],
        tempoAceiteProposta: {
          mediaDias: null,
          medianaDias: null,
          amostras: 0,
          minDias: null,
          maxDias: null,
        },
        cohortClientes: [],
        ltv: {
          ltvMedioCentavos: 0,
          ltvMedianoCentavos: 0,
          clientesComFaturacao: 0,
          ratioLtvCac: null,
          cacDisponivel: false,
          notaCac: "",
        },
      },
    };
  }

  private buildEmpresarial(
    matriculas: Array<{ estado: string; dataInscricao: Date }>,
    acoes: Array<{ estado: string; _count: { id: number } }>,
    quizRows: Array<{ aprovado: boolean; _count: number }>,
    ccExpirar: number,
    sigoPend: number,
    sigoRej: number,
    periodos: PeriodosExt,
    ref: Date,
  ): RelatorioEmpresarial {
    const matActual = matriculas.filter((m) => inPeriod(m.dataInscricao, periodos.actual)).length;
    const matMesAnt = matriculas.filter((m) => inPeriod(m.dataInscricao, periodos.mesAnterior)).length;
    const matTrimAnt = matriculas.filter((m) =>
      inPeriod(m.dataInscricao, periodos.trimestreAnterior),
    ).length;
    const matSemAnt = matriculas.filter((m) =>
      inPeriod(m.dataInscricao, periodos.semestreAnterior),
    ).length;
    const matAnoAnt = matriculas.filter((m) => inPeriod(m.dataInscricao, periodos.anoAnterior)).length;

    const conclusoes = matriculas.filter((m) => m.estado === "CONCLUSAO").length;
    const activas = matriculas.filter((m) => m.estado === "ATIVA").length;
    const taxaConclusao =
      activas + conclusoes > 0 ? Math.round((conclusoes / (activas + conclusoes)) * 1000) / 10 : 0;

    const totalQuiz = quizRows.reduce((s, r) => s + r._count, 0);
    const aprovados = quizRows.find((r) => r.aprovado)?._count ?? 0;
    const taxaQuiz = totalQuiz > 0 ? Math.round((aprovados / totalQuiz) * 1000) / 10 : null;

    const acoesEmCurso = acoes.find((a) => a.estado === "EM_CURSO")?._count.id ?? 0;

    const kpis: RelatorioKpi[] = [
      this.mkKpi("matriculas", "Novas matrículas (mês)", matActual, "numero", [
        matMesAnt,
        matTrimAnt,
        matSemAnt,
        matAnoAnt,
      ]),
      this.mkKpi("activas", "Matrículas activas", activas, "numero", [0, 0, 0, 0]),
      this.mkKpi("conclusoes", "Conclusões", conclusoes, "numero", [0, 0, 0, 0]),
      this.mkKpi("taxa_conclusao", "Taxa conclusão", taxaConclusao, "percentagem", [0, 0, 0, 0]),
      this.mkKpi("acoes_curso", "Acções em curso", acoesEmCurso, "numero", [0, 0, 0, 0]),
    ];

    const keys = last12MesesKeys(ref);
    const matSerie = new Map(keys.map((k) => [k, 0]));
    for (const m of matriculas) {
      const k = mesKey(m.dataInscricao);
      if (matSerie.has(k)) matSerie.set(k, (matSerie.get(k) ?? 0) + 1);
    }
    const serieMatriculas: RelatorioSerieMensal[] = keys.map((k) => ({
      mes: k,
      label: mesLabel(k),
      valor: matSerie.get(k) ?? 0,
    }));

    const acoesPorEstado: RelatorioFunil[] = Object.keys(ACAO_ESTADO_LABEL).map((estado) => {
      const row = acoes.find((a) => a.estado === estado);
      return {
        estado,
        label: ACAO_ESTADO_LABEL[estado] ?? estado,
        quantidade: row?._count.id ?? 0,
        valorCentavos: 0,
      };
    });

    return {
      kpis,
      serieMatriculas,
      acoesPorEstado,
      compliance: {
        formadoresCcExpirar30d: ccExpirar,
        sigoPendentes: sigoPend,
        sigoRejeitadas: sigoRej,
        taxaAprovacaoQuiz: taxaQuiz,
        acoesEmCurso,
      },
      avancado: {
        gargalosOperacionais: [],
        okrsDisponivel: false,
        enpsDisponivel: false,
        notaMetas: "",
      },
    };
  }
}
