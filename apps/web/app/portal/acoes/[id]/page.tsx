"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ClipboardList,
  FileText,
  GraduationCap,
  ListTodo,
  Users,
} from "lucide-react";
import { PortalEnrollmentSection } from "@/app/_components/portal-enrollment-section";
import { PortalScheduleSection } from "@/app/_components/portal-schedule-section";
import { ActionResumoCard } from "@/components/portal/action-resumo-card";
import { AcaoDocumentosOverview } from "@/components/portal/acao-documentos-overview";
import { AcaoLibertarConteudos } from "@/components/portal/acao-libertar-conteudos";
import { AcaoPauta } from "@/components/portal/acao-pauta";
import {
  DgertRequisitoBanner,
  useDgertRequisitoId,
} from "@/components/portal/dgert-requisito-banner";
import { bffFetch } from "@/lib/client/bff-fetch";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import {
  DGERT_REQUISITO_PARAM,
  resolveDgertRequisitoHref,
} from "@/lib/dossie/dgert-requisito";
import { parseApiError } from "@/lib/ui/backoffice";
import { cn } from "@/lib/ui/cn";
import {
  Alert,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  estadoBadge,
  PageHeader,
} from "@/components/ui";
import { PageContentSkeleton } from "@/components/ui/page-skeleton";

type AcaoDetail = {
  id: string;
  codigoInterno: string;
  titulo: string;
  estado: string;
  dataInicio: string;
  dataFim: string;
  prazoConclusaoLms?: string | null;
  configuracaoMatricula?: unknown;
  curso: {
    id: string;
    designacao: string;
    codigoUfcd: string | null;
    cargaHoras: number;
    configuracaoMatricula?: unknown;
  };
  turmas: Array<{ id: string; codigo: string; _count?: { matriculas: number } }>;
  cronogramas: Array<{ id: string; versao: number; aprovadoEm: string | null; _count?: { sessoes: number } }>;
};

type ComplianceDetail = {
  checklist: {
    scoreObrigatorioPercent: number;
    prontoInspecao: boolean;
    grupos: Array<{ id: string; label: string; concluidos: number; total: number }>;
    items: Array<{
      id: string;
      label: string;
      ok: boolean;
      severidade: string;
      grupo: string;
      detalhe?: string;
      accaoSugerida?: string;
    }>;
  };
  pendencias: Array<{ id?: string; label: string; severidade: string; accaoSugerida?: string }>;
  sessoesResumo?: Array<{
    id: string;
    numeroSessao: number;
    data: string;
    horaInicio: string;
    horaFim: string;
    estado: string;
    iniciadaEm: string | null;
    terminadaEm: string | null;
    formadorPresente: boolean | null;
    formador: { nomeCompleto: string; nif: string } | null;
    folhas: Array<{ total: number; presentes: number; validada: boolean }>;
  }>;
};

type ConclusaoProntidao = {
  ready: boolean;
  blockers: Array<{ id: string; label: string }>;
};

const ALL_TABS = [
  { id: "resumo", label: "Resumo", icon: FileText },
  { id: "documentos", label: "Documentos", icon: ClipboardList },
  { id: "turmas", label: "Turmas", icon: Users },
  { id: "cronograma", label: "Sessões & assiduidade", icon: Calendar },
  { id: "libertar", label: "Tarefas", icon: ListTodo },
  { id: "pauta", label: "Pauta", icon: GraduationCap },
  { id: "compliance", label: "Compliance", icon: CheckCircle2 },
] as const;

type Tab = (typeof ALL_TABS)[number]["id"];

function scoreColor(score: number) {
  if (score >= 80) return "text-green-400";
  if (score >= 50) return "text-yellow-400";
  return "text-red-400";
}

function normalizeAcaoTabParam(raw: string | null): string | null {
  if (!raw) return null;
  return raw === "sessoes" ? "cronograma" : raw;
}

export default function AcaoDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const acaoId = String(params.id ?? "");
  const { canManageFormacao: canManage, isFormador, writeDisabled } = useTenantRole();
  const canEditSessoes = canManage || isFormador;
  const [formadorProfileId, setFormadorProfileId] = useState<string | null>(null);
  const tabs = ALL_TABS.filter((t) => {
    if (canManage) return true;
    if (isFormador) return ["resumo", "cronograma", "libertar", "pauta"].includes(t.id);
    return t.id === "resumo";
  });
  const defaultTab: Tab = isFormador ? "cronograma" : "resumo";
  const tabFromUrl = normalizeAcaoTabParam(searchParams.get("tab"));
  const tab: Tab = useMemo(() => {
    if (tabFromUrl && tabs.some((x) => x.id === tabFromUrl)) return tabFromUrl as Tab;
    return defaultTab;
  }, [tabFromUrl, tabs, defaultTab]);

  const setTab = useCallback(
    (next: Tab) => {
      const q = new URLSearchParams(searchParams.toString());
      q.set("tab", next);
      // Remove deep-link de requisito ao mudar de tab na UI, para não
      // «bloquear» o painel (ex.: abrir nova sessão) após um salto da checklist.
      // Mantém sessaoId/focus para o cronograma recuperar o contexto.
      q.delete(DGERT_REQUISITO_PARAM);
      const qs = q.toString();
      router.replace(qs ? `/portal/acoes/${acaoId}?${qs}` : `/portal/acoes/${acaoId}`, {
        scroll: false,
      });
    },
    [acaoId, router, searchParams],
  );

  // Se a URL pede uma tab sem permissão, corrige o query param.
  useEffect(() => {
    if (!tabFromUrl) return;
    if (tabs.some((x) => x.id === tabFromUrl)) return;
    setTab(defaultTab);
  }, [tabFromUrl, tabs, defaultTab, setTab]);

  const dgertRequisito = useDgertRequisitoId();

  // Destaca e faz scroll ao alvo do deep-link DGERT (checklist → ecrã correcto).
  useEffect(() => {
    if (!dgertRequisito) return;
    const t = window.setTimeout(() => {
      const el = document.querySelector(`[data-dgert-target="${dgertRequisito}"]`);
      if (el instanceof HTMLElement) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 320);
    return () => window.clearTimeout(t);
  }, [dgertRequisito, tab]);

  const [acao, setAcao] = useState<AcaoDetail | null>(null);
  const [compliance, setCompliance] = useState<ComplianceDetail | null>(null);
  const [conclusao, setConclusao] = useState<ConclusaoProntidao | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!acaoId) return;
    setLoading(true);
    setError(null);
    const [acaoRes, compRes, conclRes] = await Promise.all([
      bffFetch(`/api/v1/acoes-formacao/${acaoId}`, { headers: { accept: "application/json" } }),
      canManage
        ? bffFetch(`/api/v1/compliance/acoes-formacao/${acaoId}`, { headers: { accept: "application/json" } })
        : Promise.resolve(null),
      canManage
        ? bffFetch(`/api/v1/acoes-formacao/${acaoId}/conclusao-prontidao`, {
            headers: { accept: "application/json" },
          })
        : Promise.resolve(null),
    ]);
    if (!acaoRes.ok) {
      setError(await parseApiError(acaoRes));
      setAcao(null);
    } else {
      const data = (await acaoRes.json()) as AcaoDetail;
      setAcao(data);
    }
    if (compRes && compRes.ok) setCompliance((await compRes.json()) as ComplianceDetail);
    if (conclRes && conclRes.ok) setConclusao((await conclRes.json()) as ConclusaoProntidao);
    else if (canManage) setConclusao(null);
    setLoading(false);
  }, [acaoId, canManage]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!isFormador) {
      setFormadorProfileId(null);
      return;
    }
    void bffFetch("/api/v1/formadores/me", { headers: { accept: "application/json" } }).then(
      async (r) => {
        if (!r.ok) return;
        const me = (await r.json()) as { id?: string };
        setFormadorProfileId(me.id ?? null);
      },
    );
  }, [isFormador]);

  async function concluirAcao() {
    if (!canManage || writeDisabled) return;
    if (!window.confirm("Confirmar conclusão desta acção? Requer sessões efectuadas, tarefas LMS e compliance DGERT.")) return;
    setBusy(true);
    setMsg(null);
    setError(null);
    const res = await bffFetch(`/api/v1/acoes-formacao/${acaoId}/concluir`, {
      method: "POST",
      headers: { accept: "application/json" },
    });
    if (!res.ok) setError(await parseApiError(res));
    else {
      setMsg("Acção marcada como Concluída.");
      await load();
    }
    setBusy(false);
  }

  async function saveAcao(data: {
    titulo: string;
    estado: string;
    dataInicio: string;
    dataFim: string;
    prazoConclusaoLms: string;
  }) {
    if (!canManage) return;
    setBusy(true);
    setMsg(null);
    const res = await bffFetch(`/api/v1/acoes-formacao/${acaoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        ...data,
        prazoConclusaoLms: data.prazoConclusaoLms.trim() ? data.prazoConclusaoLms : null,
      }),
    });
    if (!res.ok) setError(await parseApiError(res));
    else {
      setMsg("Acção actualizada.");
      await load();
    }
    setBusy(false);
  }

  if (loading && !acao) {
    return <PageContentSkeleton variant="detail" />;
  }

  if (!acao) {
    return (
      <div className="space-y-4">
        <Alert variant="error">{error ?? "Acção não encontrada."}</Alert>
            <Link href="/portal/acoes" className="inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-slate-600 text-sm font-semibold text-slate-300 hover:bg-slate-800">
              <ArrowLeft className="h-4 w-4" />
              Voltar às acções
            </Link>
      </div>
    );
  }

  const acaoOpt = [{ id: acao.id, codigoInterno: acao.codigoInterno, titulo: acao.titulo }];
  const score = compliance?.checklist.scoreObrigatorioPercent ?? 0;
  const matriculasTotal = acao.turmas.reduce((s, t) => s + (t._count?.matriculas ?? 0), 0);
  /** Conta a versão com sessões (não a mais recente se estiver vazia). */
  const sessoesCount = acao.cronogramas.reduce(
    (best, c) => Math.max(best, c._count?.sessoes ?? 0),
    0,
  );

  return (
    <>
      <div className="mb-4">
        <Link href="/portal/acoes" className="inline-flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300">
          <ArrowLeft className="h-3.5 w-3.5" />
          Acções de formação
        </Link>
      </div>

      <PageHeader
        title={acao.codigoInterno}
        description={`${acao.titulo} · ${acao.curso.designacao}${acao.curso.codigoUfcd ? ` · UFCD ${acao.curso.codigoUfcd}` : ""}`}
        actions={
          canManage ? (
            <div className="flex items-center gap-2">
              {acao.estado === "EM_CURSO" && conclusao?.ready ? (
                <button
                  type="button"
                  disabled={busy || writeDisabled}
                  onClick={() => void concluirAcao()}
                  className="inline-flex items-center h-7 px-3 text-xs font-semibold rounded-lg border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50"
                >
                  Marcar como concluída
                </button>
              ) : null}
              <Link
                href={`/portal/dossie?acao=${acaoId}`}
                className="inline-flex items-center h-7 px-3 text-xs font-semibold rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800"
              >
                Dossiê & exports
              </Link>
            </div>
          ) : null
        }
      />

      {/* KPI strip */}
      <div className="grid gap-3 sm:grid-cols-4 mb-6">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-slate-500 mb-1">Estado</p>
            {estadoBadge(acao.estado)}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-slate-500 mb-1">Período</p>
            <p className="text-sm text-slate-200 tabular-nums">
              {String(acao.dataInicio).slice(0, 10)} – {String(acao.dataFim).slice(0, 10)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-slate-500 mb-1">Turmas / matrículas</p>
            <p className="text-sm font-semibold text-slate-100">
              {acao.turmas.length} / {matriculasTotal}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-slate-500 mb-1">Sessões</p>
            <p className="text-sm font-semibold text-slate-100">{sessoesCount}</p>
          </CardContent>
        </Card>
      </div>

      {compliance ? (
        <Card className="mb-6 border-slate-700/40">
          <CardContent className="py-4 flex flex-wrap items-center gap-3">
            <span className="text-sm text-slate-400">Compliance DGERT:</span>
            <strong className={`text-xl font-bold ${scoreColor(score)}`}>{score}%</strong>
            {compliance.checklist.prontoInspecao ? (
              <Badge variant="green">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Pronta para inspecção
              </Badge>
            ) : (
              <button type="button" onClick={() => setTab("compliance")} className="inline-flex">
                <Badge variant="red">
                  {compliance.pendencias.filter((p) => p.severidade === "obrigatorio").length}{" "}
                  pendências
                </Badge>
              </button>
            )}
          </CardContent>
        </Card>
      ) : null}

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}
      {msg && <Alert variant="success" className="mb-4">{msg}</Alert>}

      <DgertRequisitoBanner backHref={`/portal/dossie?acao=${acaoId}`} />

      {/* Tabs */}
      <div className="mb-6 flex flex-wrap gap-1 border-b border-slate-700/40">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
                tab === t.id
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-slate-500 hover:text-slate-300"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "resumo" ? (
        <ActionResumoCard
          acao={{
            titulo: acao.titulo,
            estado: acao.estado,
            dataInicio: acao.dataInicio,
            dataFim: acao.dataFim,
            prazoConclusaoLms: acao.prazoConclusaoLms,
            curso: acao.curso,
          }}
          canEdit={canManage}
          busy={busy}
          onSave={saveAcao}
          focusRequisito={dgertRequisito}
        />
      ) : null}

      {tab === "documentos" && canManage ? (
        <AcaoDocumentosOverview
          acaoId={acao.id}
          cargaHoras={acao.curso.cargaHoras}
          initial={acao.configuracaoMatricula}
          onSaved={(cfg) =>
            setAcao((a) => (a ? { ...a, configuracaoMatricula: cfg } : a))
          }
        />
      ) : null}

      {tab === "turmas" ? (
        <PortalEnrollmentSection acoes={acaoOpt} canManage={canManage} />
      ) : null}

      {tab === "cronograma" ? (
        <PortalScheduleSection
          acoes={acaoOpt}
          canManageAssiduidade={canEditSessoes}
          canIniciarSessao={isFormador || canManage}
          canApproveCronograma={canManage}
          canApprovePresencasFolha={canManage}
          formadorProfileId={formadorProfileId}
          fixedAcaoId={acao.id}
          cursoId={acao.curso.id}
          embedded
        />
      ) : null}

      {tab === "libertar" && canEditSessoes ? (
        <AcaoLibertarConteudos acaoId={acao.id} canManage={canManage} />
      ) : null}

      {tab === "pauta" && canEditSessoes ? <AcaoPauta acaoId={acao.id} /> : null}

            {tab === "compliance" && compliance ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Pendências em aberto</CardTitle>
            </CardHeader>
            <CardContent>
              {compliance.pendencias.length === 0 ? (
                <p className="text-sm text-emerald-300/90">Sem pendências  checklist completo.</p>
              ) : (
                <ul className="space-y-2">
                  {compliance.pendencias.map((p, idx) => {
                    const itemId = p.id ?? compliance.checklist.items.find((i) => i.label === p.label)?.id;
                    const href = itemId
                      ? resolveDgertRequisitoHref(itemId, {
                          acaoId,
                          cursoId: acao.curso.id,
                        })
                      : null;
                    return (
                      <li
                        key={itemId ?? `${p.label}-${idx}`}
                        className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-slate-700/40 bg-slate-950/40 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="text-sm text-slate-100">{p.label}</p>
                          {p.accaoSugerida ? (
                            <p className="text-xs text-slate-500 mt-0.5">{p.accaoSugerida}</p>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant={p.severidade === "obrigatorio" ? "red" : "yellow"}>
                            {p.severidade}
                          </Badge>
                          {href ? (
                            <Link
                              href={href}
                              className="text-xs font-semibold text-blue-400 hover:text-blue-300"
                            >
                              Resolver →
                            </Link>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              {conclusao && !conclusao.ready && conclusao.blockers.length > 0 ? (
                <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-950/20 p-3">
                  <p className="text-xs font-semibold text-amber-200 mb-2">
                    Bloqueios para marcar como concluída
                  </p>
                  <ul className="space-y-1">
                    {conclusao.blockers.slice(0, 12).map((b) => (
                      <li key={b.id} className="text-xs text-amber-100/90">
                        • {b.label}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </CardContent>
          </Card>
          {compliance.sessoesResumo && compliance.sessoesResumo.length > 0 ? (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Sessões e assiduidade</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto -mx-1">
                  <table className="w-full text-sm min-w-[640px]">
                    <thead>
                      <tr className="text-left text-xs text-slate-500 uppercase tracking-wider border-b border-slate-700/40">
                        <th className="py-2 px-2">Sessão</th>
                        <th className="py-2 px-2">Data</th>
                        <th className="py-2 px-2">Início / Fim</th>
                        <th className="py-2 px-2">Formador</th>
                        <th className="py-2 px-2">Presenças</th>
                        <th className="py-2 px-2">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {compliance.sessoesResumo.map((s) => {
                        const folha = s.folhas[0];
                        return (
                          <tr key={s.id}>
                            <td className="py-2 px-2 font-medium text-slate-200">S{s.numeroSessao}</td>
                            <td className="py-2 px-2 text-slate-400">{String(s.data).slice(0, 10)}</td>
                            <td className="py-2 px-2 text-slate-400 text-xs">
                              <div>{s.horaInicio}–{s.horaFim}</div>
                              {s.iniciadaEm ? (
                                <div className="text-slate-500">
                                  ↳ {new Date(s.iniciadaEm).toLocaleString("pt-PT")}
                                  {s.terminadaEm
                                    ? ` – ${new Date(s.terminadaEm).toLocaleString("pt-PT")}`
                                    : ""}
                                </div>
                              ) : null}
                            </td>
                            <td className="py-2 px-2 text-slate-400 text-xs">
                              {s.formador?.nomeCompleto ?? "-"}
                              {s.formadorPresente === true ? (
                                <span className="text-green-400/80"> · presente</span>
                              ) : s.formadorPresente === false ? (
                                <span className="text-slate-500"> · ausente</span>
                              ) : null}
                            </td>
                            <td className="py-2 px-2 text-slate-400 text-xs">
                              {folha
                                ? `${folha.presentes}/${folha.total}`
                                : "-"}
                            </td>
                            <td className="py-2 px-2">
                              {folha?.validada ? (
                                <Badge variant="green">Validada</Badge>
                              ) : s.estado === "REALIZADA" || s.terminadaEm ? (
                                <Badge variant="yellow">Por validar</Badge>
                              ) : (
                                <Badge variant="default">{s.estado}</Badge>
                              )}
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
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Por grupo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {compliance.checklist.grupos.map((g) => (
                <div key={g.id} className="flex justify-between items-center text-sm">
                  <span className="text-slate-200">{g.label}</span>
                  <Badge variant={g.concluidos === g.total ? "green" : "yellow"}>
                    {g.concluidos}/{g.total}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Checklist completo</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {compliance.checklist.items.map((item) => {
                  const href = !item.ok
                    ? resolveDgertRequisitoHref(item.id, {
                        acaoId,
                        cursoId: acao.curso.id,
                      })
                    : null;
                  const body = (
                    <div className="flex items-start gap-2">
                      <span className={item.ok ? "text-green-400" : "text-amber-400"}>
                        {item.ok ? "✓" : "○"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className="text-slate-200">{item.label}</span>
                        <Badge variant="default" className="ml-2 text-[10px]">{item.severidade}</Badge>
                        {dgertRequisito === item.id && !item.ok ? (
                          <Badge variant="yellow" className="ml-1 text-[10px]">
                            Em foco
                          </Badge>
                        ) : null}
                        {item.detalhe ? (
                          <p className="text-xs text-slate-500 mt-0.5">{item.detalhe}</p>
                        ) : null}
                        {!item.ok && item.accaoSugerida ? (
                          <p className="text-xs text-slate-400 mt-1">→ {item.accaoSugerida}</p>
                        ) : null}
                        {href ? (
                          <p className="text-xs font-medium text-blue-400 mt-1">Ir resolver →</p>
                        ) : null}
                      </div>
                    </div>
                  );
                  return (
                    <li
                      key={item.id}
                      data-dgert-target={item.id}
                      className={cn(
                        "text-sm border-b border-slate-800 pb-2 last:border-0 rounded-lg px-2 -mx-2",
                        dgertRequisito === item.id &&
                          "ring-2 ring-amber-400/55 bg-amber-500/10 border-transparent py-2",
                        !item.ok && href && "hover:bg-violet-600/15 transition-colors",
                      )}
                    >
                      {href ? (
                        <Link href={href} className="block focus:outline-none">
                          {body}
                        </Link>
                      ) : (
                        body
                      )}
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </>
  );
}
