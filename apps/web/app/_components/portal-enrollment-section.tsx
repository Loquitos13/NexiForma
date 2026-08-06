"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Trash2, UserPlus, Users } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { readDgertRequisitoFromSearch } from "@/lib/dossie/dgert-requisito";
import { Alert } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { cn } from "@/lib/ui/cn";

type AcaoOption = { id: string; codigoInterno: string; titulo: string };

type TurmaRow = {
  id: string;
  codigo: string;
  nome: string;
  acaoFormacaoId: string;
  _count?: { matriculas: number };
};

type FormandoRow = {
  id: string;
  nome: string;
  nif: string;
  emailPresencaEfectivo?: string | null;
};

type MatriculaRow = {
  id: string;
  estado: string;
  formando: {
    id?: string;
    nome: string;
    nif: string;
    emailPresencaEfectivo?: string | null;
  };
};

type ProgressoModuloRow = {
  id: string;
  titulo: string;
  ordem: number;
  concluidos: number;
  total: number;
  percentual: number;
};

type ProgressoFormando = {
  percentual: number;
  concluidos: number;
  total: number;
  modulos: ProgressoModuloRow[];
};

type Props = {
  acoes: AcaoOption[];
  canManage: boolean;
};

const ESTADOS = ["ATIVA", "CONCLUSAO", "DESISTENCIA"] as const;

export function PortalEnrollmentSection({ acoes, canManage }: Props) {
  const [selectedAcaoId, setSelectedAcaoId] = useState("");
  const [selectedTurmaId, setSelectedTurmaId] = useState("");
  const [turmas, setTurmas] = useState<TurmaRow[]>([]);
  const [formandos, setFormandos] = useState<FormandoRow[]>([]);
  const [matriculas, setMatriculas] = useState<MatriculaRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [dgertHighlight, setDgertHighlight] = useState(false);
  const [showNovaTurma, setShowNovaTurma] = useState(false);
  const [confirmDeleteTurmaId, setConfirmDeleteTurmaId] = useState<string | null>(null);

  const [turmaCodigo, setTurmaCodigo] = useState("T-A");
  const [turmaNome, setTurmaNome] = useState("Turma A");
  const [matriculaFormandoId, setMatriculaFormandoId] = useState("");
  const [progressos, setProgressos] = useState<Record<string, ProgressoFormando>>({});
  const [loadingProg, setLoadingProg] = useState(false);

  useEffect(() => {
    const id = readDgertRequisitoFromSearch(window.location.search);
    setDgertHighlight(
      Boolean(id && ["turmas_formandos", "nifs_formandos", "documentos_matricula"].includes(id)),
    );
  }, []);

  useEffect(() => {
    if (acoes.length && !selectedAcaoId) setSelectedAcaoId(acoes[0]!.id);
  }, [acoes, selectedAcaoId]);

  const loadFormandos = useCallback(async () => {
    const res = await bffFetch("/api/v1/formandos", { headers: { accept: "application/json" } });
    if (res.ok) setFormandos((await res.json()) as FormandoRow[]);
  }, []);

  const loadTurmas = useCallback(async (acaoId: string) => {
    if (!acaoId) {
      setTurmas([]);
      return;
    }
    const res = await bffFetch(
      `/api/v1/turmas?acaoFormacaoId=${encodeURIComponent(acaoId)}`,
      { headers: { accept: "application/json" } },
    );
    if (res.ok) {
      const rows = (await res.json()) as TurmaRow[];
      setTurmas(rows);
      setSelectedTurmaId((prev) =>
        rows.length ? (rows.some((t) => t.id === prev) ? prev : rows[0]!.id) : "",
      );
    }
  }, []);

  const loadMatriculas = useCallback(async (turmaId: string) => {
    if (!turmaId) {
      setMatriculas([]);
      return;
    }
    const res = await bffFetch(
      `/api/v1/matriculas?turmaId=${encodeURIComponent(turmaId)}`,
      { headers: { accept: "application/json" } },
    );
    if (res.ok) setMatriculas((await res.json()) as MatriculaRow[]);
  }, []);

  useEffect(() => {
    void loadFormandos();
  }, [loadFormandos]);

  useEffect(() => {
    void loadTurmas(selectedAcaoId);
  }, [selectedAcaoId, loadTurmas]);

  useEffect(() => {
    void loadMatriculas(selectedTurmaId);
  }, [selectedTurmaId, loadMatriculas]);

  const loadProgressos = useCallback(async (rows: MatriculaRow[]) => {
    if (!rows.length) {
      setProgressos({});
      return;
    }
    setLoadingProg(true);
    const map: Record<string, ProgressoFormando> = {};
    await Promise.all(
      rows.map(async (m) => {
        try {
          const res = await bffFetch(
            `/api/v1/conteudos-lms/formador/progresso-detalhe?matriculaId=${encodeURIComponent(m.id)}`,
            { headers: { accept: "application/json" } },
          );
          if (!res.ok) {
            map[m.id] = { percentual: 0, concluidos: 0, total: 0, modulos: [] };
            return;
          }
          const d = (await res.json()) as {
            percurso?: {
              unidades?: Array<{ id: string; titulo: string; ordem: number }>;
              tarefas?: Array<{
                id: string;
                concluido: boolean;
                moduloUnidadeId?: string | null;
              }>;
              prazoLms?: {
                percentualConclusao?: number;
                concluidos?: number;
                total?: number;
              } | null;
            };
          };
          const tarefas = d.percurso?.tarefas ?? [];
          const unidades = [...(d.percurso?.unidades ?? [])].sort(
            (a, b) => a.ordem - b.ordem || a.titulo.localeCompare(b.titulo, "pt"),
          );
          const modulos: ProgressoModuloRow[] = unidades.map((u) => {
            const doModulo = tarefas.filter((t) => t.moduloUnidadeId === u.id);
            const concluidos = doModulo.filter((t) => t.concluido).length;
            const total = doModulo.length;
            const percentual =
              total > 0 ? Math.round((concluidos / total) * 1000) / 10 : 0;
            return {
              id: u.id,
              titulo: u.titulo,
              ordem: u.ordem,
              concluidos,
              total,
              percentual,
            };
          });
          const concluidos =
            d.percurso?.prazoLms?.concluidos ?? tarefas.filter((t) => t.concluido).length;
          const total = d.percurso?.prazoLms?.total ?? tarefas.length;
          const percentual =
            d.percurso?.prazoLms?.percentualConclusao ??
            (total > 0 ? Math.round((concluidos / total) * 1000) / 10 : 0);
          map[m.id] = { percentual, concluidos, total, modulos };
        } catch {
          map[m.id] = { percentual: 0, concluidos: 0, total: 0, modulos: [] };
        }
      }),
    );
    setProgressos(map);
    setLoadingProg(false);
  }, []);

  useEffect(() => {
    void loadProgressos(matriculas);
  }, [matriculas, loadProgressos]);

  const turmaAtiva = turmas.find((t) => t.id === selectedTurmaId) ?? null;
  const inscritosNifs = useMemo(() => new Set(matriculas.map((m) => m.formando.nif)), [matriculas]);
  const formandosDisponiveis = useMemo(
    () => formandos.filter((f) => !inscritosNifs.has(f.nif)),
    [formandos, inscritosNifs],
  );
  const totalInscritosAcao = turmas.reduce((n, t) => n + (t._count?.matriculas ?? 0), 0);

  async function parseError(res: Response): Promise<string> {
    const data = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
    if (Array.isArray(data?.message)) return data.message.join(", ");
    if (typeof data?.message === "string") return data.message;
    return `HTTP ${res.status}`;
  }

  async function updateMatriculaEstado(id: string, estado: string) {
    if (!canManage) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await bffFetch(`/api/v1/matriculas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({ estado }),
      });
      if (!res.ok) {
        setErr(await parseError(res));
        return;
      }
      setMsg("Matrícula actualizada.");
      await loadMatriculas(selectedTurmaId);
      await loadTurmas(selectedAcaoId);
    } finally {
      setBusy(false);
    }
  }

  async function submitTurma(e: FormEvent) {
    e.preventDefault();
    if (!canManage || !selectedAcaoId) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await bffFetch("/api/v1/turmas", {
        method: "POST",
        headers: { "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          acaoFormacaoId: selectedAcaoId,
          codigo: turmaCodigo,
          nome: turmaNome,
        }),
      });
      if (!res.ok) {
        setErr(await parseError(res));
        return;
      }
      setMsg("Turma criada.");
      setShowNovaTurma(false);
      await loadTurmas(selectedAcaoId);
    } catch {
      setErr("Falha ao criar turma.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteTurma(turmaId: string) {
    if (!canManage) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await bffFetch(`/api/v1/turmas/${encodeURIComponent(turmaId)}`, {
        method: "DELETE",
        headers: { accept: "application/json" },
      });
      if (!res.ok) {
        setErr(await parseError(res));
        return;
      }
      const data = (await res.json()) as { codigo?: string; matriculasRemovidas?: number };
      setMsg(
        data.codigo
          ? `Turma ${data.codigo} eliminada${
              data.matriculasRemovidas
                ? ` (${data.matriculasRemovidas} inscrição(ões) removida(s))`
                : ""
            }.`
          : "Turma eliminada.",
      );
      setConfirmDeleteTurmaId(null);
      if (selectedTurmaId === turmaId) {
        setSelectedTurmaId("");
        setMatriculas([]);
      }
      await loadTurmas(selectedAcaoId);
    } catch {
      setErr("Falha ao eliminar turma.");
    } finally {
      setBusy(false);
    }
  }

  async function submitMatricula(e: FormEvent) {
    e.preventDefault();
    if (!canManage || !selectedTurmaId || !matriculaFormandoId) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await bffFetch("/api/v1/matriculas", {
        method: "POST",
        headers: { "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          turmaId: selectedTurmaId,
          formandoId: matriculaFormandoId,
        }),
      });
      if (!res.ok) {
        setErr(await parseError(res));
        return;
      }
      setMsg("Formando inscrito na turma.");
      setMatriculaFormandoId("");
      await loadMatriculas(selectedTurmaId);
      await loadTurmas(selectedAcaoId);
    } catch {
      setErr("Falha na matrícula.");
    } finally {
      setBusy(false);
    }
  }

  if (!acoes.length) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-slate-500">
          Cria primeiro uma acção de formação para gerir turmas e inscritos.
        </CardContent>
      </Card>
    );
  }

  const formandoSeleccionado = formandos.find((f) => f.id === matriculaFormandoId);

  return (
    <div
      data-dgert-target="turmas_panel"
      className={cn(
        "space-y-4",
        dgertHighlight && "rounded-xl ring-2 ring-amber-400/55 ring-offset-2 ring-offset-slate-950 p-3 -m-1",
      )}
    >
      {msg ? <Alert variant="success">{msg}</Alert> : null}
      {err ? <Alert variant="error">{err}</Alert> : null}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-teal-400" />
                Inscritos na acção
              </CardTitle>
              <p className="mt-1 text-xs text-slate-500">
                {totalInscritosAcao} formando{totalInscritosAcao === 1 ? "" : "s"} · {turmas.length}{" "}
                turma{turmas.length === 1 ? "" : "s"}
              </p>
            </div>
            {acoes.length > 1 ? (
              <Select
                label="Acção"
                value={selectedAcaoId}
                onChange={(e) => setSelectedAcaoId(e.target.value)}
                className="min-w-[14rem]"
              >
                {acoes.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.codigoInterno} – {a.titulo}
                  </option>
                ))}
              </Select>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {turmas.length === 0 ? (
            <p className="text-sm text-slate-500">Ainda não há turmas nesta acção.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {turmas.map((t) => {
                const n = t._count?.matriculas ?? 0;
                const active = t.id === selectedTurmaId;
                const confirming = confirmDeleteTurmaId === t.id;
                return (
                  <div
                    key={t.id}
                    className={cn(
                      "group relative min-w-[10rem] overflow-hidden rounded-lg border text-left text-sm transition-colors",
                      confirming
                        ? "border-red-500/55 bg-red-950/45"
                        : active
                          ? "border-teal-500/50 bg-teal-500/10 text-teal-100"
                          : "border-slate-700/50 bg-slate-900/40 text-slate-300 hover:border-red-500/35 hover:bg-red-950/25",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (confirming) return;
                        setConfirmDeleteTurmaId(null);
                        setSelectedTurmaId(t.id);
                      }}
                      className="w-full px-3 py-2 pr-10 text-left"
                    >
                      <span className="font-medium">{t.codigo}</span>
                      <span className="text-slate-500"> · {t.nome}</span>
                      <span className="mt-0.5 block text-[11px] text-slate-500">
                        {n} inscrito{n === 1 ? "" : "s"}
                      </span>
                    </button>

                    {canManage && !confirming ? (
                      <button
                        type="button"
                        title="Eliminar turma"
                        aria-label={`Eliminar turma ${t.codigo}`}
                        disabled={busy}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTurmaId(t.id);
                          setConfirmDeleteTurmaId(t.id);
                        }}
                        className={cn(
                          "absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-md",
                          "border border-red-500/40 bg-red-950/50 text-red-400",
                          "opacity-0 transition-all duration-150",
                          "group-hover:opacity-100 group-focus-within:opacity-100",
                          "hover:border-red-400 hover:bg-red-500/25 hover:text-red-300",
                          "active:scale-95",
                        )}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    ) : null}

                    {canManage && confirming ? (
                      <div className="absolute inset-0 z-10 flex flex-col justify-center gap-2 bg-red-950/80 px-2.5 py-2 backdrop-blur-[1px]">
                        <p className="text-[11px] font-medium leading-snug text-red-100">
                          Eliminar {t.codigo}?
                          {n > 0 ? (
                            <span className="block font-normal text-red-200/80">
                              Remove também {n} inscrição(ões).
                            </span>
                          ) : null}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void deleteTurma(t.id)}
                            className="rounded-md bg-red-500/90 px-2 py-1 text-[11px] font-semibold text-white hover:bg-red-400 disabled:opacity-50"
                          >
                            Eliminar
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setConfirmDeleteTurmaId(null)}
                            className="rounded-md border border-red-400/40 px-2 py-1 text-[11px] font-medium text-red-100 hover:bg-red-900/50 disabled:opacity-50"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          {canManage ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setShowNovaTurma((v) => !v)}
              >
                <Plus className="h-4 w-4" />
                Nova turma
              </Button>
            </div>
          ) : null}

          {showNovaTurma && canManage ? (
            <form
              onSubmit={(e) => void submitTurma(e)}
              className="grid gap-2 rounded-lg border border-slate-700/40 bg-slate-950/40 p-3 sm:grid-cols-[8rem_1fr_auto]"
            >
              <Input
                value={turmaCodigo}
                onChange={(e) => setTurmaCodigo(e.target.value)}
                placeholder="Código"
                required
              />
              <Input
                value={turmaNome}
                onChange={(e) => setTurmaNome(e.target.value)}
                placeholder="Nome da turma"
                required
              />
              <Button type="submit" disabled={busy}>
                Criar
              </Button>
            </form>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {turmaAtiva
              ? `Inscritos em ${turmaAtiva.codigo} – ${turmaAtiva.nome}`
              : "Inscritos na turma"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!selectedTurmaId ? (
            <p className="text-sm text-slate-500">Selecciona uma turma acima.</p>
          ) : matriculas.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum formando inscrito nesta turma.</p>
          ) : (
            <div className="overflow-visible rounded-lg border border-slate-700/40 pb-2">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-800/60 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Formando</th>
                    <th className="px-3 py-2">NIF</th>
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2 min-w-[11rem]">Progresso de Tarefas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {matriculas.map((m) => {
                    const prog = progressos[m.id];
                    return (
                      <tr key={m.id}>
                        <td className="px-3 py-2 text-slate-100">{m.formando.nome}</td>
                        <td className="px-3 py-2 tabular-nums text-slate-400">{m.formando.nif}</td>
                        <td className="px-3 py-2">
                          {canManage ? (
                            <Select
                              value={m.estado}
                              disabled={busy}
                              className="h-8 max-w-[10rem] text-xs"
                              onChange={(e) => void updateMatriculaEstado(m.id, e.target.value)}
                            >
                              {ESTADOS.map((e) => (
                                <option key={e} value={e}>
                                  {e}
                                </option>
                              ))}
                            </Select>
                          ) : (
                            <Badge variant={m.estado === "ATIVA" ? "green" : "default"}>
                              {m.estado}
                            </Badge>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {loadingProg && !prog ? (
                            <span className="text-xs text-slate-600">A carregar…</span>
                          ) : !prog || prog.total === 0 ? (
                            <span className="text-xs text-slate-600">Sem tarefas LMS</span>
                          ) : (
                            <div className="group relative max-w-[14rem]">
                              <div
                                className={cn(
                                  "cursor-default space-y-1.5 rounded-lg border border-slate-700/40 bg-slate-950/40 px-2.5 py-2",
                                  "transition-colors group-hover:border-violet-500/45 group-hover:bg-violet-950/25",
                                )}
                              >
                                <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
                                  <span>Progresso LMS</span>
                                  <span className="tabular-nums text-slate-300">
                                    {prog.concluidos}/{prog.total} ({prog.percentual}%)
                                  </span>
                                </div>
                                <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                                  <div
                                    className={cn(
                                      "h-full transition-all",
                                      prog.percentual >= 100 ? "bg-teal-500" : "bg-violet-500",
                                    )}
                                    style={{ width: `${Math.min(100, prog.percentual)}%` }}
                                  />
                                </div>
                              </div>

                              <div
                                className={cn(
                                  "pointer-events-none absolute left-full top-1/2 z-30 h-fit w-[18rem] -translate-y-1/2",
                                  /* ponte invisível (pl-2) para o cursor chegar ao painel sem sair do group */
                                  "pl-2 opacity-0 transition-opacity duration-150",
                                  "group-hover:pointer-events-auto group-hover:opacity-100",
                                )}
                              >
                                <div className="h-fit rounded-xl border border-slate-600/60 bg-slate-900 p-3 shadow-xl shadow-black/40">
                                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                    Progresso por módulo
                                  </p>
                                  {prog.modulos.length === 0 ? (
                                    <p className="text-xs text-slate-500">Sem módulos nesta acção.</p>
                                  ) : (
                                    <ul className="h-fit space-y-2">
                                      {prog.modulos.map((mod) => (
                                        <li key={mod.id} className="space-y-1">
                                          <div className="flex items-center justify-between gap-2 text-[11px]">
                                            <span className="truncate font-medium text-slate-200">
                                              {mod.titulo}
                                            </span>
                                            <span className="shrink-0 tabular-nums text-slate-500">
                                              {mod.concluidos}/{mod.total}
                                              {mod.total > 0 && mod.concluidos >= mod.total ? (
                                                <span className="ml-1 text-teal-400">✓</span>
                                              ) : null}
                                            </span>
                                          </div>
                                          <div className="h-1 overflow-hidden rounded-full bg-slate-800">
                                            <div
                                              className={cn(
                                                "h-full",
                                                mod.percentual >= 100
                                                  ? "bg-teal-500"
                                                  : "bg-violet-500/80",
                                              )}
                                              style={{
                                                width: `${Math.min(100, mod.percentual)}%`,
                                              }}
                                            />
                                          </div>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {canManage && selectedTurmaId ? (
            <form
              onSubmit={(e) => void submitMatricula(e)}
              className="space-y-3 rounded-lg border border-dashed border-slate-700/50 p-3"
            >
              <p className="text-xs font-medium text-slate-400">Inscrever formando nesta turma</p>
              <div className="flex flex-wrap gap-2">
                <Select
                  value={matriculaFormandoId}
                  onChange={(e) => setMatriculaFormandoId(e.target.value)}
                  required
                  className="min-w-[16rem] flex-1"
                >
                  <option value="">Escolher formando…</option>
                  {formandosDisponiveis.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nome} ({f.nif})
                    </option>
                  ))}
                </Select>
                <Button type="submit" disabled={busy || !matriculaFormandoId}>
                  <UserPlus className="h-4 w-4" />
                  Inscrever
                </Button>
                <Button type="button" variant="secondary" asChild>
                  <Link href="/portal/formandos?novo=1">
                    <Plus className="h-4 w-4" />
                    Novo formando
                  </Link>
                </Button>
              </div>
              {formandoSeleccionado && !formandoSeleccionado.emailPresencaEfectivo ? (
                <p className="text-xs text-amber-400/90">
                  Este formando não tem email de reunião - necessário para sessões online.
                </p>
              ) : null}
              {formandosDisponiveis.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Todos os formandos do catálogo já estão nesta turma, ou ainda não há formandos
                  registados. Usa «Novo formando».
                </p>
              ) : null}
            </form>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
