import type {
  RelatorioComercial,
  RelatorioDashboard,
  RelatorioEmpresarial,
  RelatorioFinanceiro,
  RelatorioFunil,
  RelatorioInsightsResponse,
  RelatorioKpi,
} from "@nexiforma/shared";

export type RelatorioPdfInput = {
  secao: "financeiro" | "comercial" | "empresarial";
  tenantNome: string;
  dashboard: RelatorioDashboard;
  insights: RelatorioInsightsResponse;
};

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtEuro(cents: number): string {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(cents / 100);
}

function fmtKpi(kpi: RelatorioKpi): string {
  if (kpi.formato === "euro") return fmtEuro(kpi.valor);
  if (kpi.formato === "percentagem") return `${kpi.valor}%`;
  return new Intl.NumberFormat("pt-PT").format(kpi.valor);
}

function fmtData(iso: string): string {
  return new Date(iso).toLocaleString("pt-PT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function kpiGrid(kpis: RelatorioKpi[]): string {
  return `<div class="kpis">${kpis
    .map(
      (k) => `<div class="kpi"><div class="kpi-label">${escapeHtml(k.label)}</div><div class="kpi-val">${escapeHtml(fmtKpi(k))}</div></div>`,
    )
    .join("")}</div>`;
}

function insightsBlock(insights: RelatorioInsightsResponse): string {
  const pontos = insights.pontos
    .map((p) => `<li>${escapeHtml(p)}</li>`)
    .join("");
  const recs = insights.recomendacoes
    .map((r) => `<li>${escapeHtml(r)}</li>`)
    .join("");
  const engine = insights.engine === "llm" ? "Análise IA" : "Análise automática";
  return `<div class="insights">
    <div class="insights-head"><strong>${escapeHtml(insights.titulo)}</strong> · ${engine}</div>
    <p class="insights-resumo">${escapeHtml(insights.resumo)}</p>
    ${pontos ? `<p class="subhead">Destaques</p><ul>${pontos}</ul>` : ""}
    ${recs ? `<p class="subhead">Recomendações</p><ul class="recs">${recs}</ul>` : ""}
  </div>`;
}

function svgLineChart(
  labels: string[],
  series: { name: string; color: string; values: number[] }[],
  width = 520,
  height = 200,
): string {
  const pad = { t: 22, r: 12, b: 36, l: 48 };
  const pw = width - pad.l - pad.r;
  const ph = height - pad.t - pad.b;
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const step = labels.length > 1 ? pw / (labels.length - 1) : pw;
  const y = (v: number) => pad.t + ph - (v / max) * ph;
  const x = (i: number) => pad.l + i * step;

  const grid = [0, 0.5, 1]
    .map((p) => {
      const gy = pad.t + ph * (1 - p);
      const label = Math.round(max * p).toString();
      return `<line x1="${pad.l}" y1="${gy}" x2="${pad.l + pw}" y2="${gy}" stroke="#e2e8f0" stroke-width="1"/>
        <text x="${pad.l - 4}" y="${gy + 3}" text-anchor="end" font-size="8" fill="#94a3b8">${label}</text>`;
    })
    .join("");

  const lines = series
    .map(
      (s) =>
        `<polyline fill="none" stroke="${s.color}" stroke-width="2.5" stroke-linejoin="round" points="${s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")}"/>`,
    )
    .join("");

  const dots = series
    .flatMap((s) =>
      s.values.map(
        (v, i) =>
          `<circle cx="${x(i)}" cy="${y(v)}" r="3" fill="${s.color}" stroke="#fff" stroke-width="1"/>`,
      ),
    )
    .join("");

  const xLabels = labels
    .map((lb, i) => {
      if (labels.length > 10 && i % 2 !== 0) return "";
      return `<text x="${x(i)}" y="${height - 10}" text-anchor="middle" font-size="7.5" fill="#64748b">${escapeHtml(lb)}</text>`;
    })
    .join("");

  const legend = series
    .map(
      (s, i) =>
        `<text x="${pad.l + i * 90}" y="12" font-size="9" fill="${s.color}">● ${escapeHtml(s.name)}</text>`,
    )
    .join("");

  return `<svg width="100%" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">${grid}${lines}${dots}${xLabels}${legend}</svg>`;
}

function svgVerticalBars(
  items: { label: string; value: number; color?: string }[],
  width = 520,
  height = 200,
): string {
  const pad = { t: 16, r: 12, b: 40, l: 12 };
  const pw = width - pad.l - pad.r;
  const ph = height - pad.t - pad.b;
  const max = Math.max(1, ...items.map((i) => i.value));
  const barW = Math.min(48, (pw / items.length) * 0.65);
  const gap = pw / items.length;

  const bars = items
    .map((item, i) => {
      const h = (item.value / max) * ph;
      const bx = pad.l + i * gap + (gap - barW) / 2;
      const by = pad.t + ph - h;
      const color = item.color ?? "#6366f1";
      return `<rect x="${bx}" y="${by}" width="${barW}" height="${h}" rx="3" fill="${color}"/>
        <text x="${bx + barW / 2}" y="${height - 8}" text-anchor="middle" font-size="7.5" fill="#64748b">${escapeHtml(item.label)}</text>
        <text x="${bx + barW / 2}" y="${by - 4}" text-anchor="middle" font-size="8" fill="#334155">${item.value}</text>`;
    })
    .join("");

  return `<svg width="100%" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">${bars}</svg>`;
}

function svgHorizontalBars(
  items: { label: string; value: number; suffix?: string }[],
  width = 520,
): string {
  const rowH = 28;
  const height = items.length * rowH + 16;
  const pad = { l: 120, r: 60 };
  const max = Math.max(1, ...items.map((i) => i.value));
  const barMaxW = width - pad.l - pad.r;

  const rows = items
    .map((item, i) => {
      const y = 12 + i * rowH;
      const w = (item.value / max) * barMaxW;
      return `<text x="0" y="${y + 14}" font-size="9" fill="#475569">${escapeHtml(item.label)}</text>
        <rect x="${pad.l}" y="${y + 4}" width="${w}" height="16" rx="3" fill="#6366f1"/>
        <text x="${pad.l + w + 6}" y="${y + 16}" font-size="9" fill="#334155">${escapeHtml(item.suffix ?? String(item.value))}</text>`;
    })
    .join("");

  return `<svg width="100%" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">${rows}</svg>`;
}

function chartIaLabel(engine: RelatorioInsightsResponse["engine"]): string {
  return engine === "llm" ? "Análise IA" : "Análise automática";
}

function formatDescricaoHtml(descricao: string): string {
  return descricao
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p class="chart-desc">${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`)
    .join("");
}

function chartIaAnalysisBlock(descricao: string, engine: RelatorioInsightsResponse["engine"]): string {
  return `<div class="chart-ia-analysis"><span class="chart-ia-label">${chartIaLabel(engine)}</span>${formatDescricaoHtml(descricao)}</div>`;
}

function chartBox(
  title: string,
  svg: string,
  descricao: string | undefined,
  engine: RelatorioInsightsResponse["engine"],
): string {
  const desc = descricao?.trim() ? chartIaAnalysisBlock(descricao, engine) : "";
  return `<div class="chart-box"><div class="chart-title">${escapeHtml(title)}</div>${svg}${desc}</div>`;
}

function descricaoGrafico(
  titulo: string,
  insights: RelatorioInsightsResponse,
  fallback?: string,
): string | undefined {
  const items = insights.descricoesGraficos ?? [];
  const tituloNorm = titulo.toLowerCase().trim();
  const exact = items.find((d) => d.titulo.toLowerCase().trim() === tituloNorm);
  if (exact?.descricao?.trim()) return exact.descricao;
  const fuzzy = items.find(
    (d) =>
      d.titulo.toLowerCase().includes(tituloNorm.slice(0, 12)) ||
      tituloNorm.includes(d.titulo.toLowerCase().slice(0, 12)),
  );
  return fuzzy?.descricao?.trim() ?? fallback;
}

function analiseExpandidaBlock(insights: RelatorioInsightsResponse): string {
  if (!insights.analiseDetalhada?.trim()) return "";
  return `<div class="analise-expandida"><div class="section-title">Análise detalhada</div>${formatDescricaoHtml(insights.analiseDetalhada)}</div>`;
}

function funilHorizontal(
  title: string,
  funil: RelatorioFunil[],
  insights: RelatorioInsightsResponse,
  euro = false,
): string {
  const items = funil
    .filter((f) => f.quantidade > 0)
    .map((f) => ({
      label: f.label,
      value: f.quantidade,
      suffix: euro ? `${f.quantidade} · ${fmtEuro(f.valorCentavos)}` : String(f.quantidade),
    }));
  if (!items.length) return "";
  return chartBox(title, svgHorizontalBars(items), descricaoGrafico(title, insights), insights.engine);
}

function topClientesTable(fin: RelatorioFinanceiro): string {
  if (!fin.topClientes.length) return "";
  const rows = fin.topClientes
    .map(
      (c) =>
        `<tr><td>${escapeHtml(c.nome)}</td><td>${escapeHtml(fmtEuro(c.faturadoCentavos))}</td><td>${c.numFaturas}</td></tr>`,
    )
    .join("");
  return `<div class="section-title">Top clientes (ano)</div>
    <table><thead><tr><th>Cliente</th><th>Faturado</th><th>Faturas</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function buildFinanceiro(fin: RelatorioFinanceiro, insights: RelatorioInsightsResponse): string {
  const labels = fin.serieMensal.map((s) => s.label);
  const faturacao = fin.serieMensal.map((s) => Math.round(s.valor / 100));
  const iva = fin.serieIva.map((s) => Math.round(s.valor / 100));
  const tituloSerie = "Evolução da faturação (12 meses)";
  const lineChart = chartBox(
    tituloSerie,
    svgLineChart(labels, [
      { name: "Faturação (€)", color: "#10b981", values: faturacao },
      { name: "IVA (€)", color: "#6366f1", values: iva },
    ]),
    descricaoGrafico(tituloSerie, insights),
    insights.engine,
  );
  const tituloEstado = "Faturas por estado";
  return `${kpiGrid(fin.kpis)}
    ${insightsBlock(insights)}
    ${analiseExpandidaBlock(insights)}
    ${lineChart}
    ${chartBox(tituloEstado, svgHorizontalBars(
      fin.distribuicaoEstado.filter((f) => f.quantidade > 0).map((f) => ({
        label: f.label,
        value: f.quantidade,
        suffix: `${f.quantidade} · ${fmtEuro(f.valorCentavos)}`,
      })),
    ), descricaoGrafico(tituloEstado, insights), insights.engine)}
    ${financeiroAvancadoBlock(fin, insights)}
    ${topClientesTable(fin)}`;
}

function conversaoPropostasBlock(c: RelatorioComercial["conversaoPropostas"]): string {
  const actividade =
    c.faturasEmitidasPeriodo > 0
      ? ` Faturação emitida no mês (todas as propostas): ${c.faturasEmitidasPeriodo} doc. · ${fmtEuro(c.valorFaturadoPeriodoCentavos)}.`
      : "";
  return `<div class="insights" style="background:#eff6ff;border-color:#bfdbfe">
    <div class="insights-head" style="color:#1d4ed8"><strong>Conversão comercial (coorte enviada no mês)</strong></div>
    <p class="insights-resumo">
      ${c.enviadas} enviadas → ${c.aceites} aceites (${c.taxaAceitePct}%) →
      ${c.faturadas} faturadas na coorte (${c.taxaFaturacaoPct}% das aceites, ${c.taxaConversaoTotalPct}% total).
      Valor faturado (coorte): ${escapeHtml(fmtEuro(c.valorFaturadoCentavos))}.${actividade}
    </p>
  </div>`;
}

function financeiroAvancadoBlock(fin: RelatorioFinanceiro, insights: RelatorioInsightsResponse): string {
  const av = fin.avancado;
  const tituloFluxo = "Fluxo de caixa projetado (30/60/90 dias)";
  const fluxo = chartBox(
    tituloFluxo,
    svgVerticalBars([
      { label: "30d", value: Math.round(av.fluxoCaixaProjecao.dias30.receberCentavos / 100), color: "#10b981" },
      { label: "60d", value: Math.round(av.fluxoCaixaProjecao.dias60.receberCentavos / 100), color: "#059669" },
      { label: "90d", value: Math.round(av.fluxoCaixaProjecao.dias90.receberCentavos / 100), color: "#047857" },
    ]),
    descricaoGrafico("Fluxo de caixa projetado", insights) ?? av.fluxoCaixaProjecao.nota,
    insights.engine,
  );
  const tituloAging = "Aging de recebíveis";
  const aging = chartBox(
    tituloAging,
    svgHorizontalBars(
      av.agingRecebiveis.map((b) => ({
        label: b.label,
        value: Math.round(b.valorCentavos / 100),
        suffix: `${fmtEuro(b.valorCentavos)} · ${b.quantidade} doc.`,
      })),
    ),
    descricaoGrafico(tituloAging, insights),
    insights.engine,
  );
  const margemRows = av.margemPorServico
    .map(
      (m) =>
        `<tr><td>${escapeHtml(m.descricao)}</td><td>${escapeHtml(fmtEuro(m.faturadoCentavos))}</td><td>${m.quantidade}</td></tr>`,
    )
    .join("");
  const margemDesc = descricaoGrafico("Receita por serviço", insights);
  const margem =
    margemRows.length > 0
      ? `<div class="section-title">Receita por serviço / linha</div>
    <table><thead><tr><th>Descrição</th><th>Faturado</th><th>Qtd.</th></tr></thead><tbody>${margemRows}</tbody></table>
    ${margemDesc?.trim() ? chartIaAnalysisBlock(margemDesc, insights.engine) : ""}`
      : "";
  const resumo = `<div class="compliance">
    <div class="section-title">Indicadores de liquidez</div>
    <ul>
      <li>Receita média mensal (12m): <strong>${escapeHtml(fmtEuro(av.receitaMediaMensalCentavos))}</strong></li>
      <li>Total a receber: <strong>${escapeHtml(fmtEuro(av.aReceberTotalCentavos))}</strong></li>
      <li>Runway estimado: <strong>${av.runwayEstimadoMeses != null ? `${av.runwayEstimadoMeses} meses` : "-"}</strong></li>
    </ul>
    <p class="chart-desc">${escapeHtml(av.notaBurnRate)}</p>
  </div>`;
  return `<div class="section-title">Análise financeira avançada</div>${resumo}${fluxo}${aging}${margem}`;
}

function empresarialAvancadoBlock(emp: RelatorioEmpresarial, insights: RelatorioInsightsResponse): string {
  const gargalos = emp.avancado.gargalosOperacionais
    .map(
      (g) =>
        `<tr><td>${escapeHtml(g.label)}</td><td>${g.valor}</td><td>${escapeHtml(g.severidade)}</td><td>${escapeHtml(g.detalhe ?? "-")}</td></tr>`,
    )
    .join("");
  const analiseGargalos = descricaoGrafico("Gargalos operacionais", insights);
  return `<div class="section-title">Gargalos operacionais</div>
    <table><thead><tr><th>Área</th><th>Valor</th><th>Severidade</th><th>Detalhe</th></tr></thead><tbody>${gargalos}</tbody></table>
    ${analiseGargalos?.trim() ? chartIaAnalysisBlock(analiseGargalos, insights.engine) : `<p class="chart-desc">${escapeHtml(emp.avancado.notaMetas)}</p>`}`;
}

function buildComercial(com: RelatorioComercial, insights: RelatorioInsightsResponse): string {
  const labels = com.serieLeads.map((s) => s.label);
  const tituloSerie = "Leads e propostas (12 meses)";
  const lineChart = chartBox(
    tituloSerie,
    svgLineChart(labels, [
      { name: "Leads", color: "#3b82f6", values: com.serieLeads.map((s) => s.valor) },
      { name: "Propostas", color: "#10b981", values: com.seriePropostas.map((s) => s.valor) },
    ]),
    descricaoGrafico(tituloSerie, insights),
    insights.engine,
  );
  const tituloPipe = "Pipeline estimado (12 meses, €)";
  const pipeline = chartBox(
    tituloPipe,
    svgLineChart(
      com.seriePipeline.map((s) => s.label),
      [
        {
          name: "Pipeline (€)",
          color: "#a78bfa",
          values: com.seriePipeline.map((s) => Math.round(s.valor / 100)),
        },
      ],
    ),
    descricaoGrafico("Pipeline estimado", insights),
    insights.engine,
  );
  const av = com.avancado;
  const tempo = av.tempoAceiteProposta;
  const tempoHtml =
    tempo.amostras > 0
      ? `<p>Tempo enviada→aceite: média ${tempo.mediaDias}d, mediana ${tempo.medianaDias}d (${tempo.amostras} propostas).</p>`
      : "";
  const avancadoHtml = `<div class="section-title">Análise comercial avançada</div>
    ${tempoHtml}
    <p>LTV médio: ${escapeHtml(fmtEuro(av.ltv.ltvMedioCentavos))}; mediano: ${escapeHtml(fmtEuro(av.ltv.ltvMedianoCentavos))}; clientes: ${av.ltv.clientesComFaturacao}.</p>
    <p class="chart-desc">${escapeHtml(av.ltv.notaCac)}</p>`;
  const origem = chartBox(
    "Leads por origem",
    svgVerticalBars(
      com.origemLeads.filter((o) => o.quantidade > 0).map((o) => ({ label: o.label, value: o.quantidade, color: "#3b82f6" })),
    ),
    descricaoGrafico("Leads por origem", insights),
    insights.engine,
  );
  return `${kpiGrid(com.kpis)}
    ${conversaoPropostasBlock(com.conversaoPropostas)}
    ${insightsBlock(insights)}
    ${analiseExpandidaBlock(insights)}
    ${lineChart}
    ${pipeline}
    ${funilHorizontal("Funil de leads", com.funilLeads, insights)}
    ${funilHorizontal("Funil de propostas", com.funilPropostas, insights, true)}
    ${origem}
    ${avancadoHtml}`;
}

function buildEmpresarial(emp: RelatorioEmpresarial, insights: RelatorioInsightsResponse): string {
  const tituloMat = "Novas matrículas (12 meses)";
  const matChart = chartBox(
    tituloMat,
    svgVerticalBars(
      emp.serieMatriculas.map((s) => ({ label: s.label, value: s.valor, color: "#14b8a6" })),
    ),
    descricaoGrafico(tituloMat, insights),
    insights.engine,
  );
  const tituloAcoes = "Acções formativas por estado";
  const acoes = chartBox(
    tituloAcoes,
    svgHorizontalBars(
      emp.acoesPorEstado.filter((a) => a.quantidade > 0).map((a) => ({
        label: a.label,
        value: a.quantidade,
      })),
    ),
    descricaoGrafico(tituloAcoes, insights),
    insights.engine,
  );
  const comp = emp.compliance;
  const complianceHtml = `<div class="compliance">
    <div class="section-title">Compliance e operação</div>
    <ul>
      <li>CC formadores a expirar (30 dias): <strong>${comp.formadoresCcExpirar30d}</strong></li>
      <li>SIGO pendentes: <strong>${comp.sigoPendentes}</strong></li>
      <li>SIGO rejeitadas: <strong>${comp.sigoRejeitadas}</strong></li>
      <li>Taxa aprovação quiz: <strong>${comp.taxaAprovacaoQuiz != null ? `${comp.taxaAprovacaoQuiz}%` : "-"}</strong></li>
      <li>Acções em curso: <strong>${comp.acoesEmCurso}</strong></li>
      <li>Matrículas activas: <strong>${emp.kpis.find((k) => k.id === "activas")?.valor ?? 0}</strong></li>
      <li>Taxa conclusão: <strong>${emp.kpis.find((k) => k.id === "taxa_conclusao")?.valor ?? 0}%</strong></li>
    </ul>
  </div>`;
  return `${kpiGrid(emp.kpis)}
    ${insightsBlock(insights)}
    ${analiseExpandidaBlock(insights)}
    ${matChart}
    ${acoes}
    ${complianceHtml}
    ${empresarialAvancadoBlock(emp, insights)}`;
}

const SECAO_TITULO: Record<RelatorioPdfInput["secao"], string> = {
  financeiro: "Relatório financeiro",
  comercial: "Relatório comercial (CRM)",
  empresarial: "Relatório empresarial",
};

export function buildRelatorioPdfHtml(input: RelatorioPdfInput): string {
  const { secao, tenantNome, dashboard, insights } = input;
  let body = "";
  if (secao === "financeiro") body = buildFinanceiro(dashboard.financeiro, insights);
  else if (secao === "comercial") body = buildComercial(dashboard.comercial, insights);
  else body = buildEmpresarial(dashboard.empresarial, insights);

  return `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(SECAO_TITULO[secao])} · NexiForma</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", system-ui, sans-serif; font-size: 11px; color: #1e293b; margin: 0; padding: 0; }
  .header { background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); color: #fff; padding: 20px 24px; }
  .header h1 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  .header .meta { color: #c4b5fd; font-size: 10px; }
  .content { padding: 20px 24px; }
  .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 18px; }
  .kpi { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; background: #f8fafc; }
  .kpi-label { font-size: 8.5px; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; }
  .kpi-val { font-size: 15px; font-weight: 700; color: #0f172a; margin-top: 4px; }
  .insights { background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 10px; padding: 14px 16px; margin-bottom: 18px; }
  .insights-head { font-size: 12px; color: #5b21b6; margin-bottom: 8px; }
  .insights-resumo { margin: 0 0 10px; line-height: 1.55; color: #334155; }
  .subhead { font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; color: #7c3aed; margin: 10px 0 4px; font-weight: 700; }
  .recs li { color: #475569; }
  .section-title { font-size: 12px; font-weight: 700; margin: 16px 0 8px; color: #334155; }
  .chart-box { border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; margin-bottom: 14px; page-break-inside: avoid; }
  .chart-title { font-size: 11px; font-weight: 600; color: #475569; margin-bottom: 8px; }
  .chart-ia-analysis { margin-top: 10px; padding-top: 10px; border-top: 1px solid #e2e8f0; }
  .chart-ia-label { display: block; font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #7c3aed; margin-bottom: 6px; }
  .chart-desc { font-size: 9.5px; line-height: 1.6; color: #475569; margin: 0 0 8px; text-align: justify; }
  .chart-desc:last-child { margin-bottom: 0; }
  .analise-expandida { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; margin-bottom: 14px; }
  .analise-expandida p { margin: 0 0 8px; line-height: 1.65; color: #334155; font-size: 10.5px; text-align: justify; }
  .analise-expandida p:last-child { margin-bottom: 0; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 14px; }
  th, td { border: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; }
  th { background: #f1f5f9; font-weight: 600; }
  ul { margin: 4px 0; padding-left: 18px; line-height: 1.5; }
  li { margin: 3px 0; }
  .compliance ul { list-style: none; padding: 0; }
  .compliance li { padding: 6px 0; border-bottom: 1px solid #e2e8f0; }
  .footer { text-align: center; font-size: 9px; color: #94a3b8; padding: 16px; border-top: 1px solid #e2e8f0; }
</style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(SECAO_TITULO[secao])}</h1>
    <div class="meta">${escapeHtml(tenantNome)} · Gerado em ${escapeHtml(fmtData(dashboard.geradoEm))}</div>
  </div>
  <div class="content">${body}</div>
  <div class="footer">NexiForma · Relatório gerado automaticamente com dados do tenant</div>
</body>
</html>`;
}
