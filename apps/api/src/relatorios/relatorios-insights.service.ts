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
    this.timeoutMs = Math.min(
      Number(this.config.get<string>("NEXIGUIA_LLM_TIMEOUT_MS") ?? "20000") || 20_000,
      600_000,
    );
  }

  async gerar(
    dto: RelatorioInsightsRequest,
    dashboard: RelatorioDashboard,
  ): Promise<RelatorioInsightsResponse> {
    const snapshot = this.snapshotFor(dto.secao, dashboard);
    const titulo = this.tituloSecao(dto.secao);
    const pdf = dto.modoPdf === true;
    const chartDesc = pdf || dto.incluirDescricoesGraficos === true;

    if (this.enabled) {
      const llm = await this.callLlm(
        dto.secao,
        this.snapshotForLlm(dto.secao, snapshot, pdf),
        chartDesc,
      );
      if (llm) {
        return {
          secao: dto.secao,
          titulo,
          resumo: llm.resumo ?? "",
          pontos: llm.pontos ?? [],
          recomendacoes: llm.recomendacoes ?? [],
          descricoesGraficos:
            llm.descricoesGraficos ??
            (chartDesc ? this.descricoesGraficosLocal(dto.secao, snapshot, chartDesc) : undefined),
          analiseDetalhada: pdf ? llm.analiseDetalhada : undefined,
          engine: "llm",
          geradoEm: new Date().toISOString(),
        };
      }
    }

    return this.localInsights(dto.secao, snapshot, titulo, pdf, chartDesc);
  }

  private deltaLabel(pct: number | null): string {
    return pct == null ? "sem histórico comparável" : `${pct > 0 ? "+" : ""}${pct}% face ao mês anterior`;
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

  private chartTitlesForSecao(secao: RelatorioInsightsRequest["secao"]): string[] {
    if (secao === "financeiro") {
      return [
        "Evolução da faturação (12 meses)",
        "Faturas por estado",
        "Fluxo de caixa projetado",
        "Aging de recebíveis",
        "Receita por serviço",
      ];
    }
    if (secao === "comercial") {
      return [
        "Leads e propostas (12 meses)",
        "Pipeline estimado",
        "Funil de leads",
        "Funil de propostas",
        "Leads por origem",
      ];
    }
    return ["Novas matrículas (12 meses)", "Acções formativas por estado", "Gargalos operacionais"];
  }

  private async callLlm(
    secao: RelatorioInsightsRequest["secao"],
    snapshot: unknown,
    extended = false,
  ): Promise<LlmInsightsJson | null> {
    const chartTitles = this.chartTitlesForSecao(secao).map((t) => `«${t}»`).join(", ");
    const extendedChartRules = extended
      ? ` Inclui "descricoesGraficos":[{"titulo":"...","descricao":"..."}] com UMA entrada por cada gráfico: ${chartTitles}.
Para cada gráfico, a "descricao" deve ser uma análise interpretativa COMPLETA em português de Portugal, SEM limite de extensão: contextualiza o indicador, cita valores concretos do snapshot, explica tendências e variações, compara períodos quando existirem dados, identifica riscos e oportunidades e fecha com recomendações accionáveis para o gestor. Usa vários parágrafos quando necessário - nunca te limites a frases curtas.
Inclui também "analiseDetalhada" com síntese executiva transversal (também sem limite de extensão).`
      : "";
    const system = `És analista financeiro/comercial sénior da plataforma NexiForma (formação profissional em Portugal).
Responde APENAS em JSON válido: {"resumo":"...","pontos":["..."],"recomendacoes":["..."]${extended ? ',"descricoesGraficos":[{"titulo":"...","descricao":"..."}]' : ""}${extended ? ',"analiseDetalhada":"..."' : ""}}
Regras: usa SOMENTE os valores do snapshot; não inventes dados; português de Portugal (PT-PT); 4-7 pontos e 3-5 recomendações no resumo global; valores monetários já vêm formatados em euros - repete-os exactamente.${extendedChartRules}`;

    const snapshotJson = JSON.stringify(snapshot, null, 0);
    const user = `Secção: ${secao}\nSnapshot JSON:\n${snapshotJson}`;

    const timeoutMs = extended ? Math.max(this.timeoutMs, 120_000) : this.timeoutMs;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          stream: false,
          format: "json",
          options: {
            num_predict: extended ? 16_384 : 4_096,
            temperature: extended ? 0.35 : 0.3,
          },
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
    chartDesc = false,
  ): RelatorioInsightsResponse {
    const pontos: string[] = [];
    const recomendacoes: string[] = [];

    const deltaLabel = (pct: number | null) => this.deltaLabel(pct);

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

    const descricoesGraficos = chartDesc
      ? this.descricoesGraficosLocal(secao, snapshot, pdf || chartDesc)
      : undefined;
    const analiseDetalhada = pdf
      ? [
          `Este relatório ${secao} consolida os indicadores disponíveis no tenant e traduz-os em leitura executiva para apoio à decisão.`,
          pontos.join(" "),
          recomendacoes.length
            ? `Recomendações prioritárias: ${recomendacoes.join(" ")}`
            : "",
        ]
          .filter(Boolean)
          .join("\n\n")
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
    extended = false,
  ): RelatorioDescricaoGrafico[] {
    if (secao === "financeiro") {
      const fin = snapshot as RelatorioFinanceiro;
      const av = fin.avancado;
      const fat = fin.kpis.find((k) => k.id === "faturado");
      const serie = fin.serieMensal;
      const ultimo = serie[serie.length - 1];
      const penultimo = serie[serie.length - 2];
      const tendencia =
        ultimo && penultimo
          ? ultimo.valor >= penultimo.valor
            ? "acelerou ou manteve-se face ao mês anterior"
            : "recuou face ao mês anterior"
          : "evolui ao longo dos últimos meses";

      const serieTxt = extended
        ? [
            `Este gráfico mostra a evolução da faturação bruta e do IVA ao longo de ${serie.length} meses.`,
            fat
              ? `A faturação do mês corrente é ${this.fmtEuro(fat.valor)} (${this.deltaLabel(fat.comparacoes.mesAnterior.deltaPct)}).`
              : "",
            ultimo && penultimo
              ? `No último mês registado (${ultimo.label}) a faturação foi ${this.fmtEuro(ultimo.valor)}, enquanto no mês anterior (${penultimo.label}) foi ${this.fmtEuro(penultimo.valor)} - a série ${tendencia}.`
              : "",
            fin.topClientes[0]
              ? `A concentração de receita permanece relevante: o maior cliente (${fin.topClientes[0].nome}) representa ${this.fmtEuro(fin.topClientes[0].faturadoCentavos)} no acumulado anual.`
              : "",
            "Recomenda-se cruzar picos ou quebras com campanhas comerciais, calendário escolar e emissões AT para validar se a variação é estrutural ou pontual.",
          ]
            .filter(Boolean)
            .join("\n\n")
        : "Mostra a tendência mensal de faturação bruta e IVA facturado. Permite identificar sazonalidade e meses atípicos.";

      const estadosTxt = extended
        ? [
            "A distribuição por estado reflecte a maturidade do ciclo de faturação e o risco operacional/fiscal.",
            ...fin.distribuicaoEstado
              .filter((f) => f.quantidade > 0)
              .map(
                (f) =>
                  `${f.label}: ${f.quantidade} documento(s), ${this.fmtEuro(f.valorCentavos)}.`,
              ),
            "Estados com volume elevado em rascunho ou por comunicar à AT devem ser priorizados no fecho mensal.",
          ].join("\n\n")
        : "Distribuição do volume de documentos por estado (rascunho, emitida, comunicada AT, anulada).";

      const fluxoTxt = extended
        ? [
            `Projeção de recebíveis: ${this.fmtEuro(av.fluxoCaixaProjecao.dias30.receberCentavos)} (30 dias), ${this.fmtEuro(av.fluxoCaixaProjecao.dias60.receberCentavos)} (60 dias) e ${this.fmtEuro(av.fluxoCaixaProjecao.dias90.receberCentavos)} (90 dias).`,
            av.fluxoCaixaProjecao.nota,
            av.runwayEstimadoMeses != null
              ? `Com receita média mensal de ${this.fmtEuro(av.receitaMediaMensalCentavos)} e total a receber de ${this.fmtEuro(av.aReceberTotalCentavos)}, o runway estimado é de cerca de ${av.runwayEstimadoMeses} meses (proxy).`
              : "",
            av.notaBurnRate,
          ]
            .filter(Boolean)
            .join("\n\n")
        : `Recebíveis com vencimento nos próximos 30 (${this.fmtEuro(av.fluxoCaixaProjecao.dias30.receberCentavos)}), 60 e 90 dias. ${av.fluxoCaixaProjecao.nota}`;

      const agingTxt = extended
        ? [
            "O aging segmenta o risco de cobrança por antiguidade do saldo em aberto.",
            ...av.agingRecebiveis.map(
              (b) => `${b.label}: ${this.fmtEuro(b.valorCentavos)} em ${b.quantidade} documento(s).`,
            ),
            "Faixas mais antigas exigem follow-up comercial e reconciliação de pagamentos.",
          ].join("\n\n")
        : av.agingRecebiveis
            .map((b) => `${b.label}: ${this.fmtEuro(b.valorCentavos)} (${b.quantidade} doc.)`)
            .join("; ");

      const margemTxt = extended
        ? [
            "Ranking das linhas de fatura com maior peso na receita - útil para diversificação de oferta e pricing.",
            ...av.margemPorServico.slice(0, 5).map(
              (m) => `${m.descricao}: ${this.fmtEuro(m.faturadoCentavos)} (${m.quantidade} linha(s)).`,
            ),
            av.margemPorServico.length === 0
              ? "Sem linhas de fatura suficientes para ranking detalhado neste período."
              : "Avalie dependência de poucos produtos/serviços e oportunidades de cross-sell formativo.",
          ]
            .filter(Boolean)
            .join("\n\n")
        : "Ranking das linhas de fatura mais relevantes. Útil para identificar produtos/serviços com maior peso na receita.";

      return [
        { titulo: "Evolução da faturação (12 meses)", descricao: serieTxt },
        { titulo: "Faturas por estado", descricao: estadosTxt },
        { titulo: "Fluxo de caixa projetado", descricao: fluxoTxt },
        { titulo: "Aging de recebíveis", descricao: agingTxt },
        { titulo: "Receita por serviço", descricao: margemTxt },
      ];
    }

    if (secao === "comercial") {
      const com = snapshot as RelatorioComercial;
      const cp = com.conversaoPropostas;
      const leads = com.kpis.find((k) => k.id === "leads");
      const pipeline = com.kpis.find((k) => k.id === "pipeline");

      const serieLeadsTxt = extended
        ? [
            "Compara o volume mensal de leads criados com propostas comerciais - indicador de pressão comercial e conversão upstream.",
            leads
              ? `Este mês: ${leads.valor} leads (${this.deltaLabel(leads.comparacoes.mesAnterior.deltaPct)}).`
              : "",
            `Coorte de propostas enviadas no mês: ${cp.enviadas}; aceites: ${cp.aceites} (${cp.taxaAceitePct}%); faturadas: ${cp.faturadas}.`,
            cp.faturasEmitidasPeriodo > 0
              ? `Faturação emitida no mês (todas as propostas): ${cp.faturasEmitidasPeriodo} doc., ${this.fmtEuro(cp.valorFaturadoPeriodoCentavos)}.`
              : "",
          ]
            .filter(Boolean)
            .join("\n\n")
        : "Volume mensal de entrada comercial e criação de propostas.";

      const pipeTxt = extended
        ? [
            pipeline
              ? `Pipeline aberto estimado: ${this.fmtEuro(pipeline.valor)} (${this.deltaLabel(pipeline.comparacoes.mesAnterior.deltaPct)}).`
              : "",
            "A série mensal reflecte o valor dos leads criados - proxy do funil futuro.",
            ...com.seriePipeline.slice(-3).map((s) => `${s.label}: ${this.fmtEuro(s.valor)}.`),
            "Quedas prolongadas sinalizam necessidade de reforço de prospecção ou qualificação.",
          ]
            .filter(Boolean)
            .join("\n\n")
        : "Valor estimado dos leads criados por mês.";

      const funilLeadsTxt = extended
        ? [
            "Estado actual dos leads no CRM - identifica gargalos antes da proposta.",
            ...com.funilLeads
              .filter((f) => f.quantidade > 0)
              .map((f) => `${f.label}: ${f.quantidade} (${this.fmtEuro(f.valorCentavos)} estimados).`),
          ].join("\n\n")
        : "Estado actual dos leads no CRM.";

      const funilPropTxt = extended
        ? [
            "Distribuição das propostas por estado - liga directamente à conversão e faturação.",
            ...com.funilPropostas
              .filter((f) => f.quantidade > 0)
              .map(
                (f) =>
                  `${f.label}: ${f.quantidade} proposta(s), ${this.fmtEuro(f.valorCentavos)}.`,
              ),
            cp.aceites > cp.faturadas
              ? `Existem ${cp.aceites - cp.faturadas} proposta(s) aceite(s) por faturar - priorizar emissão fiscal.`
              : "",
          ]
            .filter(Boolean)
            .join("\n\n")
        : "Estado actual das propostas comerciais.";

      const origemTxt = extended
        ? [
            "Canal de aquisição dos leads - base para optimizar investimento comercial.",
            ...com.origemLeads
              .filter((o) => o.quantidade > 0)
              .map((o) => `${o.label}: ${o.quantidade} lead(s).`),
            "Canais dominantes devem ser replicados; canais fracos exigem teste ou descontinuação.",
          ].join("\n\n")
        : "Canal de aquisição dos leads registados.";

      return [
        { titulo: "Leads e propostas (12 meses)", descricao: serieLeadsTxt },
        { titulo: "Pipeline estimado", descricao: pipeTxt },
        { titulo: "Funil de leads", descricao: funilLeadsTxt },
        { titulo: "Funil de propostas", descricao: funilPropTxt },
        { titulo: "Leads por origem", descricao: origemTxt },
      ];
    }

    const emp = snapshot as RelatorioEmpresarial;
    const mat = emp.kpis.find((k) => k.id === "matriculas");
    const matSerie = emp.serieMatriculas;
    const ultMat = matSerie[matSerie.length - 1];

    const matTxt = extended
      ? [
          "Entradas de formandos por mês - proxy de procura formativa e sazonalidade.",
          mat
            ? `Matrículas no mês: ${mat.valor} (${this.deltaLabel(mat.comparacoes.mesAnterior.deltaPct)}).`
            : "",
          ultMat ? `Último mês (${ultMat.label}): ${ultMat.valor} matrícula(s).` : "",
          `Matrículas activas: ${emp.kpis.find((k) => k.id === "activas")?.valor ?? 0}; taxa de conclusão: ${emp.kpis.find((k) => k.id === "taxa_conclusao")?.valor ?? 0}%.`,
        ]
          .filter(Boolean)
          .join("\n\n")
      : "Entradas de formandos por mês.";

    const acoesTxt = extended
      ? [
          "Capacidade operacional por estado da acção formativa.",
          ...emp.acoesPorEstado
            .filter((a) => a.quantidade > 0)
            .map((a) => `${a.label}: ${a.quantidade} acção(ões).`),
          `Acções em curso: ${emp.compliance.acoesEmCurso}. Equilibre planeamento vs. execução para cumprir calendário DGERT.`,
        ].join("\n\n")
      : "Capacidade operacional planeada, em curso e concluída.";

    const gargalosTxt = extended
      ? [
          emp.avancado.notaMetas,
          ...emp.avancado.gargalosOperacionais.map(
            (g) =>
              `${g.label}: ${g.valor} (severidade ${g.severidade})${g.detalhe ? ` - ${g.detalhe}` : ""}.`,
          ),
          emp.compliance.formadoresCcExpirar30d > 0
            ? `${emp.compliance.formadoresCcExpirar30d} CC de formadores expiram em 30 dias.`
            : "",
          emp.compliance.sigoPendentes > 0
            ? `${emp.compliance.sigoPendentes} submissão(ões) SIGO pendente(s).`
            : "",
        ]
          .filter(Boolean)
          .join("\n\n")
      : emp.avancado.gargalosOperacionais
          .slice(0, 4)
          .map((g) => `${g.label}: ${g.valor}`)
          .join("; ");

    return [
      { titulo: "Novas matrículas (12 meses)", descricao: matTxt },
      { titulo: "Acções formativas por estado", descricao: acoesTxt },
      { titulo: "Gargalos operacionais", descricao: gargalosTxt },
    ];
  }
}
