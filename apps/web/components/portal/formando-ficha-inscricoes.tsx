"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { GraduationCap, FileText, Plus, UserPlus } from "lucide-react";
import { listEmitivelTemplateOptions, type TenantTemplateEntry } from "@nexiforma/shared";
import { bffFetch } from "@/lib/client/bff-fetch";
import { downloadResponseAsFile } from "@/lib/client/download-response";
import { formatDatePt } from "@/lib/calendar-date";
import { parseApiError } from "@/lib/ui/backoffice";
import { cn } from "@/lib/ui/cn";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui";
import { Select } from "@/components/ui/input";
import {
  UNIDADE_FLAT_ID,
  tarefasDaUnidade,
  type TarefaPercurso,
  type UnidadePercurso,
} from "@/components/formando/formando-percurso-types";

export type FormandoInscricao = {
  matriculaId: string;
  estado: string;
  dataInscricao: string;
  turma: { id: string; codigo: string; nome: string };
  acao: {
    id: string;
    codigoInterno: string;
    titulo: string;
    estado: string;
    dataInicio: string;
    dataFim: string;
    curso: { id: string; designacao: string };
  };
};

type AcaoOption = {
  id: string;
  codigoInterno: string;
  titulo: string;
  estado: string;
  _count?: { turmas: number };
};

type TurmaOption = {
  id: string;
  codigo: string;
  nome: string;
  _count?: { matriculas: number };
};

type ProgressoTarefa = Pick<
  TarefaPercurso,
  "id" | "titulo" | "concluido" | "percentual" | "moduloUnidadeId" | "ordem"
>;

type ProgressoUnidade = Pick<UnidadePercurso, "id" | "titulo" | "ordem">;

type ProgressoResumo = {
  matriculaId: string;
  total: number;
  concluidos: number;
  percentual: number;
  unidades: ProgressoUnidade[];
  tarefas: ProgressoTarefa[];
};

function modulosDoProgresso(prog: ProgressoResumo) {
  const unidades =
    prog.unidades.length > 0
      ? [...prog.unidades].sort((a, b) => a.ordem - b.ordem)
      : [];
  const temFlat = prog.tarefas.some((t) => !t.moduloUnidadeId);
  const grupos: Array<{
    id: string;
    titulo: string;
    tarefas: ProgressoTarefa[];
    concluidos: number;
    total: number;
  }> = [];

  for (const u of unidades) {
    const tarefas = tarefasDaUnidade(prog.tarefas as TarefaPercurso[], u.id) as ProgressoTarefa[];
    if (tarefas.length === 0) continue;
    grupos.push({
      id: u.id,
      titulo: u.titulo,
      tarefas,
      concluidos: tarefas.filter((t) => t.concluido).length,
      total: tarefas.length,
    });
  }

  if (temFlat || unidades.length === 0) {
    const tarefas =
      unidades.length === 0
        ? [...prog.tarefas].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
        : (tarefasDaUnidade(prog.tarefas as TarefaPercurso[], UNIDADE_FLAT_ID) as ProgressoTarefa[]);
    if (tarefas.length > 0) {
      grupos.push({
        id: UNIDADE_FLAT_ID,
        titulo: unidades.length === 0 ? "Tarefas" : "Outras tarefas",
        tarefas,
        concluidos: tarefas.filter((t) => t.concluido).length,
        total: tarefas.length,
      });
    }
  }

  return grupos;
}

type Props = {
  formandoId: string;
  inscricoes: FormandoInscricao[];
  canManage: boolean;
  onChanged: () => Promise<void> | void;
};

const ESTADOS = ["ATIVA", "CONCLUSAO", "DESISTENCIA"] as const;

const TEMPLATES_EMITIVEL_DEFAULT = [{ id: "declaracao_frequencia", label: "Declaração de frequência" }];

export function FormandoFichaInscricoes({
  formandoId,
  inscricoes,
  canManage,
  onChanged,
}: Props) {
  const router = useRouter();
  const [progressos, setProgressos] = useState<Record<string, ProgressoResumo>>({});
  const [loadingProg, setLoadingProg] = useState(false);
  const [acoes, setAcoes] = useState<AcaoOption[]>([]);
  const [turmas, setTurmas] = useState<TurmaOption[]>([]);
  const [acaoId, setAcaoId] = useState("");
  const [turmaId, setTurmaId] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [emitindo, setEmitindo] = useState<string | null>(null);
  const [templatePorMatricula, setTemplatePorMatricula] = useState<Record<string, string>>({});
  const [templatesEmitivel, setTemplatesEmitivel] = useState(TEMPLATES_EMITIVEL_DEFAULT);

  const sorted = useMemo(
    () =>
      [...inscricoes].sort(
        (a, b) => new Date(b.dataInscricao).getTime() - new Date(a.dataInscricao).getTime(),
      ),
    [inscricoes],
  );

  const turmaIdsInscritos = useMemo(
    () => new Set(inscricoes.map((i) => i.turma.id)),
    [inscricoes],
  );

  const turmasDisponiveis = useMemo(
    () => turmas.filter((t) => !turmaIdsInscritos.has(t.id)),
    [turmas, turmaIdsInscritos],
  );

  const matriculaIdsKey = useMemo(
    () =>
      [...inscricoes.map((i) => i.matriculaId)].sort().join(","),
    [inscricoes],
  );

  const loadProgressos = useCallback(async (rows: FormandoInscricao[]) => {
    if (!rows.length) {
      setProgressos({});
      return;
    }
    setLoadingProg(true);
    try {
      // Mesma fonte que /portal/progresso-lms (agregado fiável).
      const resumoRes = await bffFetch(
        "/api/v1/conteudos-lms/formador/progresso-resumo",
        { headers: { accept: "application/json" } },
      );
      const wanted = new Set(rows.map((r) => r.matriculaId));
      const map: Record<string, ProgressoResumo> = {};

      if (resumoRes.ok) {
        const resumo = (await resumoRes.json()) as {
          acoes: Array<{
            formandosDetalhe: Array<{
              matriculaId: string;
              percentual: number;
              concluidas: number;
              total: number;
            }>;
          }>;
        };
        for (const acao of resumo.acoes) {
          for (const f of acao.formandosDetalhe) {
            if (!wanted.has(f.matriculaId)) continue;
            map[f.matriculaId] = {
              matriculaId: f.matriculaId,
              total: f.total,
              concluidos: f.concluidas,
              percentual: f.percentual,
              unidades: [],
              tarefas: [],
            };
          }
        }
      }

      // Detalhe (lista de tarefas): best-effort; não apaga o resumo se falhar.
      await Promise.all(
        rows.slice(0, 20).map(async (ins) => {
          try {
            const r = await bffFetch(
              `/api/v1/conteudos-lms/formador/progresso-detalhe?matriculaId=${encodeURIComponent(ins.matriculaId)}`,
              { headers: { accept: "application/json" } },
            );
            if (!r.ok) return;
            const d = (await r.json()) as {
              percurso?: {
                unidades?: Array<{ id: string; titulo: string; ordem: number }>;
                tarefas?: Array<{
                  id: string;
                  titulo: string;
                  concluido: boolean;
                  percentual: number;
                  moduloUnidadeId?: string | null;
                  ordem?: number;
                }>;
                prazoLms?: {
                  percentualConclusao?: number;
                  concluidos?: number;
                  total?: number;
                } | null;
              };
            };
            const tarefas: ProgressoTarefa[] = (d.percurso?.tarefas ?? []).map((t) => ({
              id: t.id,
              titulo: t.titulo,
              concluido: t.concluido,
              percentual: t.percentual,
              moduloUnidadeId: t.moduloUnidadeId ?? null,
              ordem: t.ordem ?? 0,
            }));
            const unidades: ProgressoUnidade[] = (d.percurso?.unidades ?? []).map((u) => ({
              id: u.id,
              titulo: u.titulo,
              ordem: u.ordem,
            }));
            const base = map[ins.matriculaId];
            const concluidosDetalhe =
              d.percurso?.prazoLms?.concluidos ??
              (tarefas.length > 0
                ? tarefas.filter((t) => t.concluido).length
                : undefined);
            const totalDetalhe =
              d.percurso?.prazoLms?.total ??
              (tarefas.length > 0 ? tarefas.length : undefined);
            const percentualDetalhe =
              d.percurso?.prazoLms?.percentualConclusao ??
              (totalDetalhe != null &&
              totalDetalhe > 0 &&
              concluidosDetalhe != null
                ? Math.round((concluidosDetalhe / totalDetalhe) * 1000) / 10
                : undefined);
            map[ins.matriculaId] = {
              matriculaId: ins.matriculaId,
              total: totalDetalhe ?? base?.total ?? 0,
              concluidos: concluidosDetalhe ?? base?.concluidos ?? 0,
              percentual: percentualDetalhe ?? base?.percentual ?? 0,
              unidades,
              tarefas,
            };
          } catch {
            // Mantém só o resumo.
          }
        }),
      );

      // Inscrições sem entrada no resumo (ex.: sem módulos publicados) ficam a 0.
      for (const ins of rows) {
        if (!map[ins.matriculaId]) {
          map[ins.matriculaId] = {
            matriculaId: ins.matriculaId,
            total: 0,
            concluidos: 0,
            percentual: 0,
            unidades: [],
            tarefas: [],
          };
        }
      }

      setProgressos(map);
    } catch {
      setProgressos({});
    } finally {
      setLoadingProg(false);
    }
  }, []);

  useEffect(() => {
    if (!canManage) return;
    void (async () => {
      const r = await bffFetch(
        "/api/v1/portal/tenant/document-templates?modulo=formacao",
        { headers: { accept: "application/json" } },
      );
      if (!r.ok) return;
      const data = (await r.json()) as {
        templates?: Record<string, TenantTemplateEntry>;
      };
      setTemplatesEmitivel(listEmitivelTemplateOptions(data.templates ?? {}));
    })();
  }, [canManage]);

  useEffect(() => {
    if (!matriculaIdsKey) {
      setProgressos({});
      return;
    }
    const rows = inscricoes;
    void loadProgressos(rows);
  }, [matriculaIdsKey, inscricoes, loadProgressos]);

  useEffect(() => {
    if (!canManage || !showForm) return;
    void (async () => {
      const res = await bffFetch("/api/v1/acoes-formacao", {
        headers: { accept: "application/json" },
      });
      if (!res.ok) return;
      const rows = (await res.json()) as AcaoOption[];
      setAcoes(rows);
      setAcaoId((prev) =>
        rows.length ? (rows.some((a) => a.id === prev) ? prev : rows[0]!.id) : "",
      );
    })();
  }, [canManage, showForm]);

  useEffect(() => {
    if (!acaoId) {
      setTurmas([]);
      setTurmaId("");
      return;
    }
    void (async () => {
      const res = await bffFetch(
        `/api/v1/turmas?acaoFormacaoId=${encodeURIComponent(acaoId)}`,
        { headers: { accept: "application/json" } },
      );
      if (!res.ok) {
        setTurmas([]);
        setTurmaId("");
        return;
      }
      const rows = (await res.json()) as TurmaOption[];
      setTurmas(rows);
      const livres = rows.filter((t) => !turmaIdsInscritos.has(t.id));
      setTurmaId((prev) =>
        livres.length
          ? livres.some((t) => t.id === prev)
            ? prev
            : livres[0]!.id
          : "",
      );
    })();
  }, [acaoId, turmaIdsInscritos]);

  async function submitInscricao(e: FormEvent) {
    e.preventDefault();
    if (!canManage || !turmaId) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await bffFetch("/api/v1/matriculas", {
        method: "POST",
        headers: { "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({ turmaId, formandoId }),
      });
      if (!res.ok) {
        setErr(await parseApiError(res));
        return;
      }
      setMsg("Inscrição criada.");
      setShowForm(false);
      setTurmaId("");
      await onChanged();
    } catch {
      setErr("Falha ao criar inscrição.");
    } finally {
      setBusy(false);
    }
  }

  async function updateEstado(matriculaId: string, estado: string) {
    if (!canManage) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await bffFetch(`/api/v1/matriculas/${encodeURIComponent(matriculaId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({ estado }),
      });
      if (!res.ok) {
        setErr(await parseApiError(res));
        return;
      }
      setMsg("Estado da inscrição actualizado.");
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  function templateIdPara(matriculaId: string): string {
    return templatePorMatricula[matriculaId] ?? "declaracao_frequencia";
  }

  async function emitirDocumento(matriculaId: string) {
    if (!canManage) return;
    const templateId = templateIdPara(matriculaId);
    const label =
      templatesEmitivel.find((t) => t.id === templateId)?.label ?? "Documento";
    setEmitindo(matriculaId);
    setErr(null);
    setMsg(null);
    try {
      const res = await bffFetch(
        `/api/v1/matriculas/${encodeURIComponent(matriculaId)}/documentos/${encodeURIComponent(templateId)}/pdf?anexar=1&download=1`,
      );
      if (!res.ok) {
        setErr(await parseApiError(res));
        return;
      }
      await downloadResponseAsFile(res, `${templateId}.pdf`);
      setMsg(`«${label}» emitido e anexado à ficha.`);
      await onChanged();
    } catch {
      setErr(`Falha ao emitir «${label}».`);
    } finally {
      setEmitindo(null);
    }
  }

  return (
    <Card className="mb-6">
      <CardHeader className="border-b border-slate-700/40">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-violet-400" />
            Inscrições ({sorted.length})
          </CardTitle>
          {canManage ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                setShowForm((v) => !v);
                setErr(null);
                setMsg(null);
              }}
            >
              <Plus className="h-4 w-4" />
              Nova inscrição
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        {msg ? <Alert variant="success">{msg}</Alert> : null}
        {err ? <Alert variant="error">{err}</Alert> : null}

        {showForm && canManage ? (
          <form
            onSubmit={(e) => void submitInscricao(e)}
            className="space-y-3 rounded-xl border border-dashed border-slate-700/50 bg-slate-950/30 p-4"
          >
            <p className="text-sm font-medium text-slate-200 flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-teal-400" />
              Inscrever neste formando
            </p>
            <p className="text-xs text-slate-500">
              Escolhe a acção e a turma. Só aparecem turmas onde ainda não está inscrito.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Select
                label="Acção"
                value={acaoId}
                onChange={(e) => setAcaoId(e.target.value)}
                required
              >
                {acoes.length === 0 ? (
                  <option value="">Sem acções disponíveis…</option>
                ) : (
                  acoes.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.codigoInterno} – {a.titulo}
                      {a._count?.turmas != null ? ` (${a._count.turmas} turmas)` : ""}
                    </option>
                  ))
                )}
              </Select>
              <Select
                label="Turma"
                value={turmaId}
                onChange={(e) => setTurmaId(e.target.value)}
                required
                disabled={!acaoId}
              >
                {turmasDisponiveis.length === 0 ? (
                  <option value="">
                    {turmas.length === 0
                      ? "Esta acção não tem turmas…"
                      : "Já inscrito em todas as turmas…"}
                  </option>
                ) : (
                  turmasDisponiveis.map((t) => {
                    const n = t._count?.matriculas ?? 0;
                    return (
                      <option key={t.id} value={t.id}>
                        {t.codigo} – {t.nome} ({n} inscrito{n === 1 ? "" : "s"})
                      </option>
                    );
                  })
                )}
              </Select>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={busy || !turmaId}>
                Inscrever
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => setShowForm(false)}
              >
                Cancelar
              </Button>
            </div>
          </form>
        ) : null}

        {sorted.length === 0 ? (
          <p className="text-sm text-slate-500">
            Sem inscrições.
            {canManage ? " Usa «Nova inscrição» para associar a uma turma." : null}
          </p>
        ) : (
          sorted.map((ins) => {
            const prog = progressos[ins.matriculaId];
            const showTasks = !!expanded[ins.matriculaId];
            const modulos = prog ? modulosDoProgresso(prog) : [];
            const hrefAcao = `/portal/acoes/${ins.acao.id}`;
            return (
              <div
                key={ins.matriculaId}
                role="link"
                tabIndex={0}
                className="cursor-pointer rounded-xl border border-slate-700/40 bg-slate-900/40 px-4 py-3 space-y-3 transition-colors hover:border-sky-500/35 hover:bg-sky-950/25 has-[.inscricao-progresso:hover]:border-slate-700/40 has-[.inscricao-progresso:hover]:bg-slate-900/40"
                onClick={() => router.push(hrefAcao)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    router.push(hrefAcao);
                  }
                }}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <Link
                      href={hrefAcao}
                      onClick={(e) => e.stopPropagation()}
                      className="text-sm font-medium text-slate-100 hover:text-sky-300"
                    >
                      {ins.acao.codigoInterno} - {ins.acao.titulo}
                    </Link>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {ins.acao.curso.designacao} · Turma {ins.turma.codigo} – {ins.turma.nome} ·{" "}
                      {formatDatePt(ins.acao.dataInicio)} – {formatDatePt(ins.acao.dataFim)}
                    </p>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Inscrito em {formatDatePt(ins.dataInscricao)}
                    </p>
                  </div>
                  {canManage ? (
                    <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                      <Select
                        value={ins.estado}
                        disabled={busy}
                        className="h-8 max-w-[10rem] text-xs"
                        onChange={(e) => void updateEstado(ins.matriculaId, e.target.value)}
                      >
                        {ESTADOS.map((e) => (
                          <option key={e} value={e}>
                            {e}
                          </option>
                        ))}
                      </Select>
                    </div>
                  ) : (
                    <Badge variant="default">{ins.estado}</Badge>
                  )}
                </div>

                {loadingProg && !prog ? (
                  <p className="text-[11px] text-slate-600">A carregar progresso LMS…</p>
                ) : prog && prog.total > 0 ? (
                  <div
                    role="link"
                    tabIndex={0}
                    className="inscricao-progresso cursor-pointer space-y-2 rounded-lg border border-slate-700/30 bg-slate-950/40 px-3 py-2.5 transition-colors hover:border-violet-500/40 hover:bg-violet-950/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(
                        `/portal/progresso-lms?acao=${encodeURIComponent(ins.acao.id)}&matricula=${encodeURIComponent(ins.matriculaId)}`,
                      );
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        router.push(
                          `/portal/progresso-lms?acao=${encodeURIComponent(ins.acao.id)}&matricula=${encodeURIComponent(ins.matriculaId)}`,
                        );
                      }
                    }}
                  >
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Progresso das tarefas LMS</span>
                      <span className="tabular-nums">
                        {prog.concluidos}/{prog.total} ({prog.percentual}%)
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={cn(
                          "h-full transition-all",
                          prog.percentual >= 100 ? "bg-teal-500" : "bg-violet-500",
                        )}
                        style={{ width: `${Math.min(100, prog.percentual)}%` }}
                      />
                    </div>
                    {modulos.length > 0 ? (
                      <ul className="space-y-2">
                        {modulos.map((mod) => {
                          const pctMod =
                            mod.total > 0
                              ? Math.round((mod.concluidos / mod.total) * 1000) / 10
                              : 0;
                          return (
                            <li key={mod.id} className="space-y-1">
                              <div className="flex items-center justify-between gap-2 text-[11px]">
                                <span className="truncate font-medium text-slate-300">
                                  {mod.titulo}
                                </span>
                                <span className="shrink-0 tabular-nums text-slate-500">
                                  {mod.concluidos}/{mod.total}
                                  {mod.concluidos >= mod.total && mod.total > 0 ? (
                                    <span className="ml-1 text-teal-400">✓</span>
                                  ) : null}
                                </span>
                              </div>
                              <div className="h-1 rounded-full bg-slate-800 overflow-hidden">
                                <div
                                  className={cn(
                                    "h-full transition-all",
                                    pctMod >= 100 ? "bg-teal-500" : "bg-violet-500/80",
                                  )}
                                  style={{ width: `${Math.min(100, pctMod)}%` }}
                                />
                              </div>
                              {showTasks ? (
                                <ul className="mt-1 space-y-0.5 pl-1">
                                  {mod.tarefas.map((t) => (
                                    <li
                                      key={t.id}
                                      className="flex items-center gap-1.5 text-[11px] text-slate-500"
                                    >
                                      <span
                                        className={
                                          t.concluido ? "text-teal-400" : "text-slate-600"
                                        }
                                      >
                                        {t.concluido ? "✓" : "○"}
                                      </span>
                                      <span className="truncate">{t.titulo}</span>
                                    </li>
                                  ))}
                                </ul>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                    {prog.tarefas.length > 0 ? (
                      <button
                        type="button"
                        className="text-[11px] text-sky-400 hover:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpanded((prev) => ({
                            ...prev,
                            [ins.matriculaId]: !prev[ins.matriculaId],
                          }));
                        }}
                      >
                        {showTasks
                          ? "Ocultar tarefas"
                          : `Ver tarefas (${prog.tarefas.length})`}
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-600">
                    {prog
                      ? "Sem tarefas LMS publicadas nesta acção."
                      : "Sem dados de progresso LMS."}
                  </p>
                )}

                {canManage ? (
                  <div
                    className="flex flex-wrap items-end gap-2 pt-1"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <Select
                      label="Template"
                      value={templateIdPara(ins.matriculaId)}
                      disabled={busy || emitindo === ins.matriculaId}
                      className="h-8 max-w-[14rem] text-xs"
                      onChange={(e) =>
                        setTemplatePorMatricula((prev) => ({
                          ...prev,
                          [ins.matriculaId]: e.target.value,
                        }))
                      }
                    >
                      {templatesEmitivel.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label}
                        </option>
                      ))}
                    </Select>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={busy || emitindo === ins.matriculaId}
                      className="h-8 text-xs"
                      onClick={() => void emitirDocumento(ins.matriculaId)}
                    >
                      <FileText className="h-3.5 w-3.5" />
                      {emitindo === ins.matriculaId ? "A emitir…" : "Emitir PDF"}
                    </Button>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
