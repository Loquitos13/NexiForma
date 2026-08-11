"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  Coins,
  FileCheck2,
  FilePlus,
  FileText,
  Loader2,
  Receipt,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { parseApiError } from "@/lib/ui/backoffice";
import { fmtDate, fmtEuro, fmtFaturaRef } from "@/lib/crm/shared";
import { FaturaEstadoBadge } from "@/components/crm/fatura-estado-badge";
import { Alert, Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";

export type PropostaAEmitir = {
  id: string;
  codigo: string;
  titulo: string;
  valorCentavos: number;
  moeda: string;
  aceiteEm: string | null;
  updatedAt: string;
  entidadeCliente: {
    id: string;
    nome: string;
    nif: string;
    email: string | null;
  };
  fatura: {
    id: string;
    numero: number | null;
    estado: string;
  } | null;
};

export type UltimaFatura = {
  id: string;
  numero: number | null;
  codigoAtcud: string | null;
  estado: string;
  dataEmissao: string | null;
  valorCentavos: number;
  ivaCentavos: number;
  destinatarioNome: string;
  destinatarioNif: string;
  serie: { codigo: string; tipo: string };
};

export type DashboardFinanceiroData = {
  faturasEmitidasTotal: number;
  faturasEmitidasMesAtual: number;
  faturasTotalMesAtual: number;
  ivaAcumuladoMesAtualCentavos: number;
  receitaMesAtualCentavos: number;
  totalFaturadoMesAtualCentavos: number;
  receitaTotalCentavos: number;
  ivaTotalCentavos: number;
  mesAtualLabel: string;
  faturasAEmitir: PropostaAEmitir[];
  ultimasFaturas: UltimaFatura[];
};

export function CoordenadorFinanceiroDashboard({
  legalName,
}: {
  legalName?: string;
}) {
  const router = useRouter();
  const [data, setData] = useState<DashboardFinanceiroData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [faturarBusyId, setFaturarBusyId] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await bffFetch("/api/v1/faturas/dashboard-financeiro", {
        headers: { accept: "application/json" },
      });
      if (!res.ok) {
        setError(await parseApiError(res));
        return;
      }
      const json = (await res.json()) as DashboardFinanceiroData;
      setData(json);
    } catch {
      setError("Erro ao carregar dados do painel financeiro.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleFaturarProposta(proposta: PropostaAEmitir) {
    if (proposta.fatura?.id) {
      router.push(`/portal/crm/faturas/${proposta.fatura.id}`);
      return;
    }

    setFaturarBusyId(proposta.id);
    setActionSuccessMsg(null);
    setError(null);

    try {
      const res = await bffFetch(`/api/v1/propostas/${proposta.id}/faturar`, {
        method: "POST",
        headers: { accept: "application/json" },
      });

      if (!res.ok) {
        setError(await parseApiError(res));
        setFaturarBusyId(null);
        return;
      }

      const faturaCriada = (await res.json()) as { id: string };
      setActionSuccessMsg(`Fatura em rascunho criada com sucesso para a proposta ${proposta.codigo}!`);
      router.push(`/portal/crm/faturas/${faturaCriada.id}`);
    } catch {
      setError("Não foi possível gerar a fatura para esta proposta.");
      setFaturarBusyId(null);
    }
  }

  if (loading && !data) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
          A carregar painel financeiro…
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="space-y-4">
        <Alert variant="error">{error}</Alert>
        <Button size="sm" variant="secondary" onClick={() => void loadData()}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Tentar novamente
        </Button>
      </div>
    );
  }

  const faturasAEmitir = data?.faturasAEmitir ?? [];
  const ultimasFaturas = data?.ultimasFaturas ?? [];

  return (
    <div className="space-y-6">
      {/* Banner Principal de Boas-Vindas e Ações */}
      <div className="rounded-2xl border border-emerald-700/25 bg-gradient-to-r from-emerald-950/40 via-slate-900/50 to-slate-900/60 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-emerald-400">
              <Sparkles className="h-3.5 w-3.5" />
              Coordenação Financeira
            </div>
            <h1 className="mt-2 text-2xl font-bold text-slate-100">
              {legalName ?? "Departamento Financeiro"}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-400">
              Acompanhamento operacional de faturação, receita acumulada e emissão de faturas a partir de propostas aceites.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/portal/crm/faturas">
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white">
                <FilePlus className="h-3.5 w-3.5 mr-1.5" />
                Nova Fatura
              </Button>
            </Link>
            <Link href="/portal/crm/faturas">
              <Button size="sm" variant="secondary">
                <FileText className="h-3.5 w-3.5 mr-1.5" />
                Todas as Faturas
              </Button>
            </Link>
            <Link href="/portal/clientes">
              <Button size="sm" variant="secondary">
                <Building2 className="h-3.5 w-3.5 mr-1.5" />
                Clientes
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {error ? <Alert variant="error">{error}</Alert> : null}
      {actionSuccessMsg ? <Alert variant="success">{actionSuccessMsg}</Alert> : null}

      {/* Grid com 4 Indicadores Essenciais (Sem Gráficos/Métricas) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Faturas Emitidas */}
        <Card className="border-slate-800/80 bg-slate-900/60 p-4 transition-colors hover:border-slate-700/80">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-slate-400">Faturas Emitidas</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-slate-100 tabular-nums">
                {data?.faturasEmitidasTotal ?? 0}
              </p>
              <p className="mt-1 text-[11px] text-emerald-400/90 font-medium">
                {data?.faturasEmitidasMesAtual ?? 0} emitidas em {data?.mesAtualLabel ?? "mês atual"}
              </p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
              <FileCheck2 className="h-5 w-5" />
            </div>
          </div>
        </Card>

        {/* Card 2: Total de Faturas no Mês Atual */}
        <Card className="border-slate-800/80 bg-slate-900/60 p-4 transition-colors hover:border-slate-700/80">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-slate-400">Faturas no Mês Atual</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-slate-100 tabular-nums">
                {data?.faturasTotalMesAtual ?? 0}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                Total registado em {data?.mesAtualLabel ?? "mês atual"}
              </p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-400">
              <CalendarDays className="h-5 w-5" />
            </div>
          </div>
        </Card>

        {/* Card 3: IVA Acumulado no Mês Atual */}
        <Card className="border-slate-800/80 bg-slate-900/60 p-4 transition-colors hover:border-slate-700/80">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-slate-400">IVA Acumulado (Mês)</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-amber-300 tabular-nums">
                {fmtEuro(data?.ivaAcumuladoMesAtualCentavos ?? 0)}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                Imposto liquidado ({data?.mesAtualLabel ?? "mês atual"})
              </p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-400">
              <Receipt className="h-5 w-5" />
            </div>
          </div>
        </Card>

        {/* Card 4: Receita no Mês Atual */}
        <Card className="border-slate-800/80 bg-slate-900/60 p-4 transition-colors hover:border-slate-700/80">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-slate-400">Receita no Mês Atual</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-emerald-400 tabular-nums">
                {fmtEuro(data?.receitaMesAtualCentavos ?? 0)}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                Total bruto c/ IVA: {fmtEuro(data?.totalFaturadoMesAtualCentavos ?? 0)}
              </p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
              <Coins className="h-5 w-5" />
            </div>
          </div>
        </Card>
      </div>

      {/* Secção Faturas a Emitir (Propostas Aceites no CRM) */}
      <Card className="border-slate-800 bg-slate-900/60">
        <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800/70 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-semibold text-slate-100">
                Faturas a emitir
              </CardTitle>
              {faturasAEmitir.length > 0 ? (
                <Badge variant="blue" className="px-2 py-0.5 text-xs font-semibold">
                  {faturasAEmitir.length} pendente{faturasAEmitir.length === 1 ? "" : "s"}
                </Badge>
              ) : null}
            </div>
            <p className="text-xs text-slate-400">
              Propostas comerciais aceites por clientes no CRM prontas a faturar.
            </p>
          </div>
          {faturasAEmitir.length > 0 ? (
            <span className="text-xs font-medium text-emerald-400">
              Total a faturar:{" "}
              {fmtEuro(faturasAEmitir.reduce((acc, p) => acc + (p.valorCentavos || 0), 0))}
            </span>
          ) : null}
        </CardHeader>
        <CardContent className="pt-4">
          {faturasAEmitir.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 mb-3">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-slate-200">Sem propostas pendentes de faturação</p>
              <p className="mt-1 max-w-sm text-xs text-slate-400">
                Todas as propostas comerciais aceites pelos clientes no CRM já foram devidamente convertidas em fatura.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-400">
                    <th className="pb-3 pr-4">Cliente</th>
                    <th className="pb-3 pr-4">Proposta</th>
                    <th className="pb-3 pr-4">Aceite em</th>
                    <th className="pb-3 pr-4 text-right">Valor</th>
                    <th className="pb-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {faturasAEmitir.map((p) => {
                    const isBusy = faturarBusyId === p.id;
                    const temRascunho = Boolean(p.fatura?.id);

                    return (
                      <tr key={p.id} className="transition-colors hover:bg-slate-800/30">
                        <td className="py-3 pr-4">
                          <div className="font-medium text-slate-200">{p.entidadeCliente.nome}</div>
                          <div className="text-[11px] text-slate-500">NIF: {p.entidadeCliente.nif}</div>
                        </td>
                        <td className="py-3 pr-4">
                          <div className="font-semibold text-blue-400">{p.codigo}</div>
                          <div className="max-w-xs truncate text-[11px] text-slate-400">{p.titulo}</div>
                        </td>
                        <td className="py-3 pr-4 whitespace-nowrap text-slate-300">
                          {p.aceiteEm ? fmtDate(p.aceiteEm) : fmtDate(p.updatedAt)}
                        </td>
                        <td className="py-3 pr-4 whitespace-nowrap text-right font-semibold text-slate-100 tabular-nums">
                          {fmtEuro(p.valorCentavos)}
                        </td>
                        <td className="py-3 text-right whitespace-nowrap">
                          <Button
                            size="sm"
                            disabled={isBusy}
                            onClick={() => void handleFaturarProposta(p)}
                            variant={temRascunho ? "secondary" : "default"}
                            className={temRascunho ? undefined : "bg-emerald-600 hover:bg-emerald-500 text-white"}
                          >
                            {isBusy ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                                A criar…
                              </>
                            ) : temRascunho ? (
                              <>
                                <FileText className="h-3.5 w-3.5 mr-1.5" />
                                Ver Rascunho
                              </>
                            ) : (
                              <>
                                <Receipt className="h-3.5 w-3.5 mr-1.5" />
                                Emitir Fatura
                              </>
                            )}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Secção Faturas Recentes */}
      {ultimasFaturas.length > 0 ? (
        <Card className="border-slate-800 bg-slate-900/60">
          <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800/70 pb-4">
            <div>
              <CardTitle className="text-base font-semibold text-slate-100">
                Faturas Recentes
              </CardTitle>
              <p className="text-xs text-slate-400">
                Últimos documentos emitidos e registados no sistema.
              </p>
            </div>
            <Link
              href="/portal/crm/faturas"
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300"
            >
              Ver todas as faturas <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-400">
                    <th className="pb-3 pr-4">Documento</th>
                    <th className="pb-3 pr-4">Cliente</th>
                    <th className="pb-3 pr-4">Data</th>
                    <th className="pb-3 pr-4 text-right">Valor Total</th>
                    <th className="pb-3 pr-4 text-center">Estado</th>
                    <th className="pb-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {ultimasFaturas.map((f) => {
                    const ref = fmtFaturaRef(f.serie, f.numero);
                    const totalComIva = f.valorCentavos + f.ivaCentavos;

                    return (
                      <tr key={f.id} className="transition-colors hover:bg-slate-800/30">
                        <td className="py-3 pr-4">
                          <span className="font-semibold text-slate-200">{ref}</span>
                          {f.codigoAtcud ? (
                            <span className="block text-[10px] text-slate-500 font-mono">
                              ATCUD: {f.codigoAtcud}
                            </span>
                          ) : null}
                        </td>
                        <td className="py-3 pr-4">
                          <div className="font-medium text-slate-200">{f.destinatarioNome}</div>
                          <div className="text-[11px] text-slate-500">NIF: {f.destinatarioNif}</div>
                        </td>
                        <td className="py-3 pr-4 whitespace-nowrap text-slate-300">
                          {fmtDate(f.dataEmissao)}
                        </td>
                        <td className="py-3 pr-4 whitespace-nowrap text-right font-semibold text-slate-100 tabular-nums">
                          {fmtEuro(totalComIva)}
                        </td>
                        <td className="py-3 pr-4 text-center whitespace-nowrap">
                          <FaturaEstadoBadge estado={f.estado as never} />
                        </td>
                        <td className="py-3 text-right whitespace-nowrap">
                          <Link href={`/portal/crm/faturas/${f.id}`}>
                            <Button size="sm" variant="ghost" className="h-7 text-xs">
                              Abrir
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
