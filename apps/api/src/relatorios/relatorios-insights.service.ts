import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type {
  RelatorioComercial,
  RelatorioComparacoes,
  RelatorioDashboard,
  RelatorioDescricaoGrafico,
  RelatorioEmpresarial,
  RelatorioFinanceiro,
  RelatorioInsightsRequest,
  RelatorioInsightsResponse,
  RelatorioKpi,
  RelatorioVariacao,
} from "@nexiforma/shared";

type LlmInsightsJson = {
  resumo?: string;
  pontos?: string[];
  recomendacoes?: string[];
  descricoesGraficos?: RelatorioDescricaoGrafico[];
  analiseDetalhada?: string;
};

@Injectable()
export class RelatoriosInsightsService {
  private readonly logger = new Logger(RelatoriosInsightsService.name);
  private readonly enabled: boolean;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(private readonly config: ConfigService) {
    this.enabled = this.config.get<string>("NEXIGUIA_LLM_ENABLED") === "true";
    this.baseUrl = (this.config.get<string>("NEXIGUIA_LLM_URL") ?? "http://127.0.0.1:11434").replace(
      /\/$/,
      "",
    );
    this.model = this.config.get<string>("NEXIGUIA_LLM_MODEL") ?? "qwen2.5:3b-instruct";
    this.timeoutMs = Number(this.config.get<string>("NEXIGUIA_LLM_TIMEOUT_MS") ?? "20000");
  }

  async gerar(
    dto: RelatorioInsightsRequest,
    dashboard: RelatorioDashboard,
  ): Promise<RelatorioInsightsResponse> {
    const snapshot = this.snapshotFor(dto.secao, dashboard);
    const titulo = this.tituloSecao(dto.secao);
    const pdf = dto.modoPdf === true;

    if (this.enabled) {
      const llm = await this.callLlm(dto.secao, this.snapshotForLlm(dto.secao, snapshot, pdf), pdf);
      if (llm) {
        return {
          secao: dto.secao,
          titulo,
          resumo: llm.resumo ?? "",
          pontos: llm.pontos ?? [],
          recomendacoes: llm.recomendacoes ?? [],
          descricoesGraficos: llm.descricoesGraficos,
          analiseDetalhada: llm.analiseDetalhada,
          engine: "llm",
          geradoEm: new Date().toISOString(),
        };
      }
    }

    return this.localInsights(dto.secao, snapshot, titulo, pdf);
  }

  private tituloSecao(secao: RelatorioInsightsRequest["secao"]): string {
    switch (secao) {
      case "financeiro":
        return "Análise financeira";
      case "comercial":
        return "Análise comercial (CRM)";
      case "empresarial":
        return "Análise empresarial";
    }
  }

  private snapshotFor(
    secao: RelatorioInsightsRequest["secao"],
    dashboard: RelatorioDashboard,
  ): RelatorioFinanceiro | RelatorioComercial | RelatorioEmpresarial {
    switch (secao) {
      case "financeiro":
        return dashboard.financeiro;
      case "comercial":
        return dashboard.comercial;
      case "empresarial":
        return dashboard.empresarial;
    }
  }

  /** Converte cêntimos para texto em euros - evita erros de escala no LLM. */
  private fmtEuro(centavos: number): string {
    return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(
      centavos / 100,
    );
  }

  private fmtVariacaoPct(pct: number | null): string | null {
    if (pct == null) return null;
    return `${pct > 0 ? "+" : ""}${pct}%`;
  }

  private fmtKpiValor(kpi: RelatorioKpi, valor: number): string | number {
    if (kpi.formato === "euro") return this.fmtEuro(valor);
    if (kpi.formato === "percentagem") return `${valor}%`;
    return valor;
  }

  private variacaoForLlm(kpi: RelatorioKpi, v: RelatorioVariacao) {
    return {
      valor: this.fmtKpiValor(kpi, v.valor),
      referencia: this.fmtKpiValor(kpi, v.referencia),
      variacaoPct: this.fmtVariacaoPct(v.deltaPct),
    };
  }

  private kpiForLlm(kpi: RelatorioKpi) {
    const cmp = kpi.comparacoes as RelatorioComparacoes;
    return {
      id: kpi.id,
      label: kpi.label,
      valor: this.fmtKpiValor(kpi, kpi.valor),
      comparacoes: {
        mesAnterior: this.variacaoForLlm(kpi, cmp.mesAnterior),
        trimestreAnterior: this.variacaoForLlm(kpi, cmp.trimestreAnterior),
        semestreAnterior: this.variacaoForLlm(kpi, cmp.semestreAnterior),
        anoAnterior: this.variacaoForLlm(kpi, cmp.anoAnterior),
      },
    };
  }

  /** Snapshot legível para o LLM - valores monetários já em euros formatados. */
  private snapshotForLlm(
    secao: RelatorioInsightsRequest["secao"],
    snapshot: RelatorioFinanceiro | RelatorioComercial | RelatorioEmpresarial,
    pdf = false,
  ): unknown {
    const nota =
      "Valores monetários já estão em euros (€) formatados. Usa-os tal como aparecem, sem dividir nem multiplicar.";

    if (secao === "financeiro") {
      const fin = snapshot as RelatorioFinanceiro;
      const av = fin.avancado;
      return {
        nota,
        modoPdf: pdf,
        kpis: fin.kpis.map((k) => this.kpiForLlm(k)),
        serieMensal: fin.serieMensal.map((s) => ({
          mes: s.label,
          faturacao: this.fmtEuro(s.valor),
        })),
        serieIva: fin.serieIva.map((s) => ({ mes: s.label, iva: this.fmtEuro(s.valor) })),
        topClientes: fin.topClientes.map((c) => ({
          nome: c.nome,
          faturado: this.fmtEuro(c.faturadoCentavos),
          numFaturas: c.numFaturas,
        })),
        distribuicaoEstado: fin.distribuicaoEstado.map((d) => ({
          estado: d.label,
          quantidade: d.quantidade,
          valor: this.fmtEuro(d.valorCentavos),
        })),
        avancado: {
          fluxoCaixa30d: this.fmtEuro(av.fluxoCaixaProjecao.dias30.receberCentavos),
          fluxoCaixa60d: this.fmtEuro(av.fluxoCaixaProjecao.dias60.receberCentavos),
          fluxoCaixa90d: this.fmtEuro(av.fluxoCaixaProjecao.dias90.receberCentavos),
          aReceberTotal: this.fmtEuro(av.aReceberTotalCentavos),
          receitaMediaMensal: this.fmtEuro(av.receitaMediaMensalCentavos),
          runwayEstimadoMeses: av.runwayEstimadoMeses,
          agingRecebiveis: av.agingRecebiveis.map((b) => ({
            faixa: b.label,
            valor: this.fmtEuro(b.valorCentavos),
            documentos: b.quantidade,
          })),
          margemPorServico: av.margemPorServico.map((m) => ({
            descricao: m.descricao,
            faturado: this.fmtEuro(m.faturadoCentavos),
            quantidade: m.quantidade,
          })),
          notaBurnRate: av.notaBurnRate,
        },
      };
    }

    if (secao === "comercial") {
      const com = snapshot as RelatorioComercial;
      const cp = com.conversaoPropostas;
      return {
        nota,
        conversaoPropostas: {
          nota: "Funil por coorte enviada no mês; faturasEmitidasPeriodo inclui documentos emitidos no mês de propostas de meses anteriores.",
          enviadas: cp.enviadas,
          aceites: cp.aceites,
          faturadas: cp.faturadas,
          taxaAceitePct: `${cp.taxaAceitePct}%`,
          taxaFaturacaoPct: `${cp.taxaFaturacaoPct}%`,
          taxaConversaoTotalPct: `${cp.taxaConversaoTotalPct}%`,
          valorFaturadoCoorte: this.fmtEuro(cp.valorFaturadoCentavos),
          faturasEmitidasPeriodo: cp.faturasEmitidasPeriodo,
          valorFaturadoPeriodo: this.fmtEuro(cp.valorFaturadoPeriodoCentavos),
        },
        kpis: com.kpis.map((k) => this.kpiForLlm(k)),
        funilLeads: com.funilLeads.map((f) => ({
          estado: f.label,
          quantidade: f.quantidade,
          valorEstimado: this.fmtEuro(f.valorCentavos),
        })),
        funilPropostas: com.funilPropostas.map((f) => ({
          estado: f.label,
          quantidade: f.quantidade,
          valor: this.fmtEuro(f.valorCentavos),
        })),
        origemLeads: com.origemLeads.map((o) => ({
          origem: o.label,
          quantidade: o.quantidade,
          valorEstimado: this.fmtEuro(o.valorCentavos),
        })),
        avancado: {
          tempoAceiteMediaDias: com.avancado.tempoAceiteProposta.mediaDias,
          tempoAceiteMedianaDias: com.avancado.tempoAceiteProposta.medianaDias,
          ltvMedio: this.fmtEuro(com.avancado.ltv.ltvMedioCentavos),
          funilLeadsEtapas: com.avancado.funilLeadsEtapas.map((e) => ({
            etapa: e.label,
            quantidade: e.quantidade,
            conversaoPct: e.taxaConversaoPct,
          })),
          funilPropostasEtapas: com.avancado.funilPropostasEtapas.map((e) => ({
            etapa: e.label,
            quantidade: e.quantidade,
            conversaoPct: e.taxaConversaoPct,
          })),
        },
      };
    }

    const emp = snapshot as RelatorioEmpresarial;
    return {
      nota: "Contagens e percentagens - não há valores monetários nesta secção.",
      modoPdf: pdf,
      kpis: emp.kpis.map((k) => this.kpiForLlm(k)),
      compliance: emp.compliance,
      acoesPorEstado: emp.acoesPorEstado.map((a) => ({
        estado: a.label,
        quantidade: a.quantidade,
      })),
      serieMatriculas: emp.serieMatriculas.map((s) => ({ mes: s.label, matriculas: s.valor })),
      gargalosOperacionais: emp.avancado.gargalosOperacionais.map((g) => ({
        label: g.label,
        valor: g.valor,
        severidade: g.severidade,
        detalhe: g.detalhe,
      })),
      notaMetas: emp.avancado.notaMetas,
    };
  }

  private async callLlm(
    secao: RelatorioInsightsRequest["secao"],
    snapshot: unknown,
    pdf = false,
  ): Promise<LlmInsightsJson | null> {
    const pdfExtra = pdf
      ? ` Inclui também "descricoesGraficos":[{"titulo":"...","descricao":"..."}] (uma entrada por gráfico presente no relatório, 2-4 frases cada) e "analiseDetalhada" (3-6 frases integrando KPIs, avançado e tendências).`
      : "";
    const system = `És analista financeiro/comercial da plataforma NexiForma (formação profissional em Portugal).
Responde APENAS em JSON válido: {"resumo":"...","pontos":["..."],"recomendacoes":["..."]${pdf ? ',"descricoesGraficos":[{"titulo":"...","descricao":"..."}],"analiseDetalhada":"..."' : ""}}
Regras: usa SOMENTE os valores do snapshot; não inventes dados; português de Portugal; 4-7 pontos e 3-5 recomendações; valores monetários já vêm formatados em euros (ex.: «6800,00 €») - repete-os exactamente, sem converter.${pdfExtra}`;

    const limit = pdf ? 18000 : 12000;
    const user = `Secção: ${secao}\nSnapshot JSON:\n${JSON.stringify(snapshot, null, 0).slice(0, limit)}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          stream: false,
          format: "json",
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
        signal: controller.signal,
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { message?: { content?: string } };
      const raw = data.message?.content?.trim();
      if (!raw) return null;
      const parsed = JSON.parse(raw) as LlmInsightsJson;
      if (!parsed.resumo?.trim()) return null;
      return parsed;
    } catch (err) {
      this.logger.warn(`Insights LLM: ${err instanceof Error ? err.message : "erro"}`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  private localInsights(
    secao: RelatorioInsightsRequest["secao"],
    snapshot: RelatorioFinanceiro | RelatorioComercial | RelatorioEmpresarial,
    titulo: string,
    pdf = false,
  ): RelatorioInsightsResponse {
    const pontos: string[] = [];
    const recomendacoes: string[] = [];

    const deltaLabel = (pct: number | null) =>
      pct == null ? "sem histórico" : `${pct > 0 ? "+" : ""}${pct}% vs mês anterior`;

    if (secao === "financeiro") {
      const fin = snapshot as RelatorioFinanceiro;
      const fat = fin.kpis.find((k) => k.id === "faturado");
      if (fat) {
        pontos.push(
          `Faturação do mês: ${this.fmtEuro(fat.valor)} (${deltaLabel(fat.comparacoes.mesAnterior.deltaPct)}).`,
        );
      }
      const top = fin.topClientes[0];
      if (top) {
        pontos.push(`Maior cliente no ano: ${top.nome} com ${this.fmtEuro(top.faturadoCentavos)}.`);
      }
      const ultimos = fin.serieMensal.slice(-3);
      if (ultimos.length >= 2) {
        const tend = ultimos[ultimos.length - 1]!.valor - ultimos[ultimos.length - 2]!.valor;
        pontos.push(
          tend >= 0
            ? "Tendência recente de faturação positiva nos últimos meses."
            : "Queda de faturação face ao mês anterior na série mensal.",
        );
      }
      recomendacoes.push("Reveja clientes com faturação concentrada para diversificar receita.");
      recomendacoes.push("Confirme comunicações AT pendentes antes do fecho mensal.");
    }

    if (secao === "comercial") {
      const com = snapshot as RelatorioComercial;
      const cp = com.conversaoPropostas;
      const leads = com.kpis.find((k) => k.id === "leads");
      const conv = com.kpis.find((k) => k.id === "taxa_conv");
      if (leads) {
        pontos.push(`Novos leads este mês: ${leads.valor} (${deltaLabel(leads.comparacoes.mesAnterior.deltaPct)}).`);
      }
      if (conv) pontos.push(`Taxa de conversão de leads: ${conv.valor}%.`);
      pontos.push(
        `Propostas enviadas no mês (coorte): ${cp.enviadas}; aceites: ${cp.aceites} (${cp.taxaAceitePct}%); faturadas na coorte: ${cp.faturadas}.`,
      );
      if (cp.faturasEmitidasPeriodo > 0) {
        pontos.push(
          `Faturação emitida no mês (todas as propostas): ${cp.faturasEmitidasPeriodo} doc. · ${this.fmtEuro(cp.valorFaturadoPeriodoCentavos)}.`,
        );
      }
      if (cp.valorFaturadoCentavos > 0) {
        pontos.push(`Valor faturado da coorte enviada no mês: ${this.fmtEuro(cp.valorFaturadoCentavos)}.`);
      }
      recomendacoes.push("Priorize leads qualificados com maior valor estimado no pipeline.");
      if (cp.aceites > cp.faturadas) {
        recomendacoes.push("Emita faturas para propostas aceites ainda sem documento fiscal.");
      }
      recomendacoes.push("Analise origens de leads com melhor taxa de conversão.");
    }

    if (secao === "empresarial") {
      const emp = snapshot as RelatorioEmpresarial;
      const mat = emp.kpis.find((k) => k.id === "matriculas");
      if (mat) {
        pontos.push(`Novas matrículas: ${mat.valor} (${deltaLabel(mat.comparacoes.mesAnterior.deltaPct)}).`);
      }
      pontos.push(`Matrículas activas: ${emp.kpis.find((k) => k.id === "activas")?.valor ?? 0}.`);
      pontos.push(
        `Taxa de conclusão global: ${emp.kpis.find((k) => k.id === "taxa_conclusao")?.valor ?? 0}%.`,
      );
      if (emp.compliance.formadoresCcExpirar30d > 0) {
        recomendacoes.push(
          `${emp.compliance.formadoresCcExpirar30d} CC de formadores expiram em 30 dias - renovar.`,
        );
      }
      if (emp.compliance.sigoPendentes > 0) {
        recomendacoes.push(`Tratar ${emp.compliance.sigoPendentes} submissões SIGO pendentes.`);
      }
    }

    if (secao === "financeiro" && pdf) {
      const fin = snapshot as RelatorioFinanceiro;
      const av = fin.avancado;
      pontos.push(
        `Recebíveis 30/60/90 dias: ${this.fmtEuro(av.fluxoCaixaProjecao.dias30.receberCentavos)} / ${this.fmtEuro(av.fluxoCaixaProjecao.dias60.receberCentavos)} / ${this.fmtEuro(av.fluxoCaixaProjecao.dias90.receberCentavos)}.`,
      );
      if (av.runwayEstimadoMeses != null) {
        pontos.push(`Runway estimado (proxy): ${av.runwayEstimadoMeses} meses.`);
      }
    }

    if (secao === "empresarial" && pdf) {
      const emp = snapshot as RelatorioEmpresarial;
      const topG = emp.avancado.gargalosOperacionais.filter((g) => g.severidade !== "baixa").slice(0, 3);
      for (const g of topG) {
        pontos.push(`${g.label}: ${g.valor}${g.detalhe ? ` (${g.detalhe})` : ""}.`);
      }
    }

    const descricoesGraficos = pdf ? this.descricoesGraficosLocal(secao, snapshot) : undefined;
    const analiseDetalhada = pdf
      ? `Relatório ${secao} gerado automaticamente com KPIs, séries temporais e indicadores avançados. ${pontos.slice(0, 3).join(" ")}`
      : undefined;

    return {
      secao,
      titulo,
      resumo: `Análise automática (${secao}) com base nos dados actuais do tenant.`,
      pontos,
      recomendacoes,
      descricoesGraficos,
      analiseDetalhada,
      engine: "local",
      geradoEm: new Date().toISOString(),
    };
  }

  private descricoesGraficosLocal(
    secao: RelatorioInsightsRequest["secao"],
    snapshot: RelatorioFinanceiro | RelatorioComercial | RelatorioEmpresarial,
  ): RelatorioDescricaoGrafico[] {
    if (secao === "financeiro") {
      const fin = snapshot as RelatorioFinanceiro;
      const av = fin.avancado;
      return [
        {
          titulo: "Evolução da faturação (12 meses)",
          descricao:
            "Mostra a tendência mensal de faturação bruta e IVA facturado. Permite identificar sazonalidade e meses atípicos.",
        },
        {
          titulo: "Faturas por estado",
          descricao:
            "Distribuição do volume de documentos por estado (rascunho, emitida, comunicada AT, anulada).",
        },
        {
          titulo: "Fluxo de caixa projetado",
          descricao: `Recebíveis com vencimento nos próximos 30 (${this.fmtEuro(av.fluxoCaixaProjecao.dias30.receberCentavos)}), 60 e 90 dias. ${av.fluxoCaixaProjecao.nota}`,
        },
        {
          titulo: "Aging de recebíveis",
          descricao: av.agingRecebiveis
            .map((b) => `${b.label}: ${this.fmtEuro(b.valorCentavos)} (${b.quantidade} doc.)`)
            .join("; "),
        },
        {
          titulo: "Receita por serviço",
          descricao:
            "Ranking das linhas de fatura mais relevantes. Útil para identificar produtos/serviços com maior peso na receita.",
        },
      ];
    }
    if (secao === "comercial") {
      return [
        { titulo: "Leads e propostas (12 meses)", descricao: "Volume mensal de entrada comercial e criação de propostas." },
        { titulo: "Pipeline estimado", descricao: "Valor estimado dos leads criados por mês." },
        { titulo: "Funil de leads", descricao: "Estado actual dos leads no CRM." },
        { titulo: "Funil de propostas", descricao: "Estado actual das propostas comerciais." },
        { titulo: "Leads por origem", descricao: "Canal de aquisição dos leads registados." },
      ];
    }
    const emp = snapshot as RelatorioEmpresarial;
    return [
      { titulo: "Novas matrículas (12 meses)", descricao: "Entradas de formandos por mês." },
      { titulo: "Acções formativas por estado", descricao: "Capacidade operacional planeada, em curso e concluída." },
      {
        titulo: "Gargalos operacionais",
        descricao: emp.avancado.gargalosOperacionais
          .slice(0, 4)
          .map((g) => `${g.label}: ${g.valor}`)
          .join("; "),
      },
    ];
  }
}
