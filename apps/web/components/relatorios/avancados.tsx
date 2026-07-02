"use client";

import type {
  RelatorioComercialAvancado,
  RelatorioEmpresarialAvancado,
  RelatorioFinanceiroAvancado,
  RelatorioFunilEtapa,
  RelatorioGargalo,
} from "@nexiforma/shared";
import { AlertTriangle, Clock, Layers, TrendingUp, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, DataTable, type Column } from "@/components/ui";
import { fmtEuro } from "@/lib/crm/shared";
import { AgingBarChart, FluxoCaixaChart, FunilEtapasChart } from "./charts";

export function FinanceiroAvancadoSection({ avancado }: { avancado: RelatorioFinanceiroAvancado }) {
  const margemCols: Column<(typeof avancado.margemPorServico)[0]>[] = [
    { key: "desc", header: "Serviço / linha", cell: (r) => <span className="text-slate-200">{r.descricao}</span> },
    {
      key: "fat",
      header: "Faturado",
      cell: (r) => <span className="tabular-nums text-emerald-400">{fmtEuro(r.faturadoCentavos)}</span>,
    },
    { key: "q", header: "Qtd.", cell: (r) => r.quantidade },
  ];

  return (
    <div className="space-y-6">
      <SectionTitle icon={<Wallet className="h-4 w-4 text-emerald-400" />} title="Análise avançada financeira" />

      <div className="grid gap-4 sm:grid-cols-3">
        <MiniStat
          label="Receita média mensal (12m)"
          value={fmtEuro(avancado.receitaMediaMensalCentavos)}
        />
        <MiniStat label="Total a receber" value={fmtEuro(avancado.aReceberTotalCentavos)} />
        <MiniStat
          label="Runway estimado (proxy)"
          value={
            avancado.runwayEstimadoMeses != null
              ? `${avancado.runwayEstimadoMeses} meses`
              : "-"
          }
          hint={avancado.notaBurnRate}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <FluxoCaixaChart fluxo={avancado.fluxoCaixaProjecao} />
        <AgingBarChart aging={avancado.agingRecebiveis} />
      </div>

      <p className="text-xs text-slate-500">{avancado.fluxoCaixaProjecao.nota}</p>

      <Card>
        <CardHeader>
          <CardTitle>Receita por serviço / linha de fatura</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            keyField="descricao"
            columns={margemCols}
            data={avancado.margemPorServico}
            emptyMessage="Sem linhas de fatura emitidas."
          />
          <p className="mt-3 text-xs text-slate-500">
            Margem de contribuição completa requer custos variáveis por serviço (módulo de despesas).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export function ComercialAvancadoSection({ avancado }: { avancado: RelatorioComercialAvancado }) {
  const cohortCols: Column<(typeof avancado.cohortClientes)[0]>[] = [
    { key: "mes", header: "Coorte", cell: (r) => r.cohortLabel },
    { key: "c", header: "Clientes", cell: (r) => r.clientes },
    {
      key: "f",
      header: "Faturado (1.º mês)",
      cell: (r) => fmtEuro(r.faturadoCentavos),
    },
    {
      key: "r",
      header: "Retenção M+1",
      cell: (r) => (r.retencaoPct != null ? `${r.retencaoPct}%` : "-"),
    },
  ];

  const tempo = avancado.tempoAceiteProposta;

  return (
    <div className="space-y-6">
      <SectionTitle icon={<TrendingUp className="h-4 w-4 text-blue-400" />} title="Análise avançada comercial" />

      <div className="grid gap-6 xl:grid-cols-2">
        <FunilEtapasChart title="Funil de leads - taxas por etapa" etapas={avancado.funilLeadsEtapas} />
        <FunilEtapasChart title="Funil de propostas - taxas por etapa" etapas={avancado.funilPropostasEtapas} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-400" />
            Tempo enviada → aceite (propostas)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tempo.amostras > 0 ? (
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Metric label="Amostras" value={String(tempo.amostras)} />
              <Metric label="Média" value={`${tempo.mediaDias} dias`} />
              <Metric label="Mediana" value={`${tempo.medianaDias} dias`} />
              <Metric label="Mínimo" value={tempo.minDias != null ? `${tempo.minDias} dias` : "-"} />
              <Metric label="Máximo" value={tempo.maxDias != null ? `${tempo.maxDias} dias` : "-"} />
            </dl>
          ) : (
            <p className="text-sm text-slate-500">
              Sem propostas aceites com timestamps de envio. Novos envios passam a registar automaticamente.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>LTV (Lifetime Value)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <dl className="grid gap-3 sm:grid-cols-2">
              <Metric label="LTV médio" value={fmtEuro(avancado.ltv.ltvMedioCentavos)} />
              <Metric label="LTV mediano" value={fmtEuro(avancado.ltv.ltvMedianoCentavos)} />
              <Metric label="Clientes com faturação" value={String(avancado.ltv.clientesComFaturacao)} />
              <Metric label="LTV : CAC" value="-" />
            </dl>
            <p className="text-xs text-slate-500">{avancado.ltv.notaCac}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cohort de clientes (últimos 6 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              keyField="cohortMes"
              columns={cohortCols}
              data={avancado.cohortClientes}
              emptyMessage="Sem clientes com primeira fatura."
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function EmpresarialAvancadoSection({ avancado }: { avancado: RelatorioEmpresarialAvancado }) {
  return (
    <div className="space-y-6">
      <SectionTitle icon={<Layers className="h-4 w-4 text-violet-400" />} title="Gargalos operacionais" />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {avancado.gargalosOperacionais.map((g) => (
          <GargaloCard key={g.id} gargalo={g} />
        ))}
      </div>

      <Card className="border-dashed border-slate-700/80">
        <CardContent className="flex items-start gap-3 pt-6">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <div className="text-sm text-slate-400">
            <p className="font-medium text-slate-300">OKRs e E-NPS</p>
            <p className="mt-1">{avancado.notaMetas}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-slate-800/80 pb-2">
      {icon}
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">{title}</h2>
    </div>
  );
}

function MiniStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-slate-800/80 bg-slate-950/40 px-4 py-3">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-slate-100">{value}</p>
      {hint ? <p className="mt-2 text-[10px] leading-snug text-slate-500">{hint}</p> : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800/80 bg-slate-950/40 px-3 py-2.5">
      <dt className="text-[10px] uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-base font-semibold tabular-nums text-slate-100">{value}</dd>
    </div>
  );
}

function GargaloCard({ gargalo }: { gargalo: RelatorioGargalo }) {
  const cor =
    gargalo.severidade === "alta"
      ? "border-red-500/40 bg-red-950/20"
      : gargalo.severidade === "media"
        ? "border-amber-500/30 bg-amber-950/15"
        : "border-slate-800/80 bg-slate-950/40";

  return (
    <div className={`rounded-lg border px-4 py-3 ${cor}`}>
      <p className="text-xs text-slate-400">{gargalo.label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-slate-100">{gargalo.valor}</p>
      {gargalo.detalhe ? <p className="mt-1 text-[10px] text-slate-500">{gargalo.detalhe}</p> : null}
    </div>
  );
}

export type { RelatorioFunilEtapa };
