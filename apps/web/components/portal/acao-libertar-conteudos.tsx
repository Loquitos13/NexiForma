"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ChevronRight, ListTodo } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { parseApiError } from "@/lib/ui/backoffice";
import { cn } from "@/lib/ui/cn";
import { Alert, Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";

type ProgressoFormandoModulo = {
  matriculaId: string;
  nome: string;
  nif: string;
  turmaCodigo: string;
  concluidos: number;
  total: number;
  percentual: number;
  libertado: boolean;
};

type ModuloTarefa = {
  id: string;
  titulo: string;
  codigo: string | null;
  ordem: number;
  lockManual: boolean;
  totalConteudos: number;
  totalFormandos: number;
  libertados: number;
  desbloqueado: boolean;
  prazoConclusao: string | null;
  prazoAtingido: boolean;
  podeOperar: boolean;
  podeDesbloquear: boolean;
  podeBloquear: boolean;
  podeDefinirPrazo: boolean;
  progressoFormandos?: ProgressoFormandoModulo[];
};

type LibertarEstado = {
  acaoId: string;
  cursoId: string;
  modulos: ModuloTarefa[];
};

type Props = {
  acaoId: string;
  canManage: boolean;
};

export function AcaoLibertarConteudos({ acaoId, canManage }: Props) {
  const [data, setData] = useState<LibertarEstado | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await bffFetch(`/api/v1/conteudos-lms/acoes/${acaoId}/libertar`, {
      headers: { accept: "application/json" },
    });
    if (!res.ok) {
      setError(await parseApiError(res));
      setData(null);
      setLoading(false);
      return;
    }
    setData((await res.json()) as LibertarEstado);
    setLoading(false);
  }, [acaoId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleModulo(modulo: ModuloTarefa, next: boolean) {
    if (next && !modulo.podeDesbloquear) {
      setError(
        modulo.prazoAtingido
          ? "O limite de conclusão já foi atingido. Altera ou remove o limite para desbloquear."
          : "Só podes desbloquear módulos das sessões que te estão atribuídas.",
      );
      return;
    }
    if (!next && !modulo.podeBloquear) {
      setError("Só o gestor pode voltar a bloquear o módulo.");
      return;
    }
    setBusyId(modulo.id);
    setError(null);
    setMsg(null);
    const res = await bffFetch(
      `/api/v1/conteudos-lms/acoes/${acaoId}/modulos/${modulo.id}/tarefas`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({ desbloqueado: next }),
      },
    );
    setBusyId(null);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    setData((await res.json()) as LibertarEstado);
    setMsg(
      next
        ? `«${modulo.titulo}» desbloqueado para os formandos.`
        : `«${modulo.titulo}» bloqueado.`,
    );
  }

  async function savePrazo(modulo: ModuloTarefa, value: string) {
    if (!canManage && !modulo.podeDefinirPrazo) return;
    setBusyId(`prazo:${modulo.id}`);
    setError(null);
    setMsg(null);
    const prazoConclusao = value.trim() ? value.trim() : null;
    const res = await bffFetch(
      `/api/v1/conteudos-lms/acoes/${acaoId}/modulos/${modulo.id}/prazo`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({ prazoConclusao }),
      },
    );
    setBusyId(null);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    setData((await res.json()) as LibertarEstado);
    setMsg(
      prazoConclusao
        ? `Limite de «${modulo.titulo}» definido para ${prazoConclusao} (válido até 23:59; bloqueio às 00:00 do dia seguinte).`
        : `Limite de «${modulo.titulo}» removido.`,
    );
  }

  async function libertarTodos() {
    if (!data) return;
    const alvos = data.modulos.filter((m) => !m.desbloqueado && m.podeDesbloquear);
    if (!alvos.length) {
      setMsg("Todos os módulos já estão desbloqueados (ou sem permissão).");
      return;
    }
    setBusyId("bulk");
    setError(null);
    setMsg(null);
    let ok = 0;
    let last: LibertarEstado | null = null;
    for (const m of alvos) {
      const res = await bffFetch(
        `/api/v1/conteudos-lms/acoes/${acaoId}/modulos/${m.id}/tarefas`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json", accept: "application/json" },
          body: JSON.stringify({ desbloqueado: true }),
        },
      );
      if (res.ok) {
        ok += 1;
        last = (await res.json()) as LibertarEstado;
      }
    }
    setBusyId(null);
    if (last) setData(last);
    else await load();
    setMsg(`Desbloqueados ${ok} de ${alvos.length} módulos.`);
  }

  if (loading && !data) {
    return <p className="text-sm text-slate-500">A carregar tarefas…</p>;
  }

  if (!data) {
    return <Alert variant="error">{error ?? "Não foi possível carregar os módulos."}</Alert>;
  }

  return (
    <div className="space-y-4">
      {error ? <Alert variant="error">{error}</Alert> : null}
      {msg ? <Alert variant="success">{msg}</Alert> : null}

      <Card>
        <CardHeader className="border-b border-slate-700/40">
          <CardTitle className="text-base flex items-center gap-2">
            <ListTodo className="h-4 w-4 text-violet-400" />
            Tarefas
          </CardTitle>
          <p className="text-xs text-slate-500 mt-1">
            O switch tem de estar verde (Desbloqueado) para o formando aceder - o ícone de cadeado
            no portal do formando segue estes switches. Clica no módulo para editar conteúdos LMS.
            {canManage
              ? " O limite de conclusão (só gestor) vale até às 23:59 desse dia; às 00:00 do dia seguinte o módulo bloqueia automaticamente (hora local)."
              : null}
          </p>
          {canManage || data.modulos.some((m) => m.podeDesbloquear && !m.desbloqueado) ? (
            <div className="mt-3">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={busyId === "bulk"}
                onClick={() => void libertarTodos()}
              >
                Libertar todos os módulos
              </Button>
            </div>
          ) : null}
        </CardHeader>
        <CardContent className="overflow-visible pt-2 pb-2">
          {data.modulos.length === 0 ? (
            <p className="py-6 text-sm text-slate-500 text-center">
              Ainda não existem módulos neste curso.
            </p>
          ) : (
            <ul className="divide-y divide-slate-800/60">
              {data.modulos.map((m) => {
                const canToggle = m.desbloqueado ? m.podeBloquear : m.podeDesbloquear;
                const busy = busyId === m.id || busyId === `prazo:${m.id}`;
                const href = `/portal/cursos/${data.cursoId}?tab=conteudos&unidade=${encodeURIComponent(m.id)}`;
                const showPrazoEditor = canManage || m.podeDefinirPrazo;
                const progressoFormandos = m.progressoFormandos ?? [];
                return (
                  <li key={m.id} className="px-1 py-2">
                    <div className="relative flex min-h-[4.25rem] items-center rounded-xl px-3 py-3">
                      <div className="group/mod relative z-0 min-w-0 max-w-[calc(50%-6rem)]">
                        <Link
                          href={href}
                          className={cn(
                            "flex min-w-0 items-center gap-3 rounded-xl px-3 py-2.5",
                            "text-left transition-colors hover:bg-slate-800/40 focus-visible:outline-none",
                            "focus-visible:ring-2 focus-visible:ring-blue-500/50",
                            "group-hover/mod:bg-slate-800/40",
                          )}
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-100 truncate group-hover/mod:text-blue-300 transition-colors">
                              {m.titulo}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5 truncate">
                              {m.totalConteudos} conteúdo{m.totalConteudos === 1 ? "" : "s"}
                              {m.codigo ? ` · ${m.codigo}` : ""}
                              {m.totalFormandos > 0
                                ? ` · ${m.libertados}/${m.totalFormandos} formandos com acesso`
                                : null}
                              {!m.podeOperar && !canManage ? " · sem permissão neste módulo" : null}
                              {m.prazoAtingido ? " · limite atingido" : null}
                            </p>
                          </div>
                          <ChevronRight className="h-4 w-4 shrink-0 text-slate-600 group-hover/mod:text-blue-400 transition-colors" />
                        </Link>

                        {progressoFormandos.length > 0 ? (
                          <div
                            className={cn(
                              "pointer-events-none absolute left-full top-1/2 z-40 h-fit w-[17.5rem] -translate-y-1/2",
                              "pl-2 opacity-0 transition-opacity duration-150",
                              "group-hover/mod:pointer-events-auto group-hover/mod:opacity-100",
                            )}
                          >
                            <div className="overflow-hidden rounded-xl border border-slate-600/60 bg-slate-900 shadow-xl shadow-black/40">
                              <p className="border-b border-slate-700/50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                Progresso · {m.titulo}
                              </p>
                              <ul className="max-h-56 space-y-2 overflow-y-auto overscroll-contain p-3">
                                {progressoFormandos.map((f) => (
                                  <li key={f.matriculaId} className="space-y-1">
                                    <div className="flex items-center justify-between gap-2 text-[11px]">
                                      <span className="min-w-0 truncate font-medium text-slate-200">
                                        {f.nome}
                                        <span className="ml-1 font-normal text-slate-500">
                                          ({f.turmaCodigo})
                                        </span>
                                      </span>
                                      <span className="shrink-0 tabular-nums text-slate-500">
                                        {f.total > 0
                                          ? `${f.concluidos}/${f.total} (${f.percentual}%)`
                                          : ""}
                                      </span>
                                    </div>
                                    <div className="h-1 overflow-hidden rounded-full bg-slate-800">
                                      <div
                                        className={cn(
                                          "h-full",
                                          f.percentual >= 100
                                            ? "bg-teal-500"
                                            : "bg-violet-500/80",
                                        )}
                                        style={{
                                          width: `${Math.min(100, f.percentual)}%`,
                                        }}
                                      />
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        ) : null}
                      </div>

                      <div
                        className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
                        aria-hidden={!showPrazoEditor && !m.prazoConclusao}
                      >
                        <div
                          className="pointer-events-auto"
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          {showPrazoEditor ? (
                            <label
                              className="flex w-[10.5rem] flex-col items-center gap-0.5 text-center text-[10px] uppercase tracking-wide text-slate-500"
                              onClick={(e) => e.stopPropagation()}
                              onMouseDown={(e) => e.stopPropagation()}
                            >
                              Limite conclusão
                              <input
                                type="date"
                                value={m.prazoConclusao ?? ""}
                                disabled={busy}
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                onChange={(e) => void savePrazo(m, e.target.value)}
                                className={cn(
                                  "w-full rounded-lg border border-slate-700/70 bg-slate-900/80 px-2 py-1.5",
                                  "text-center text-xs normal-case tracking-normal text-slate-200 tabular-nums",
                                  "focus:outline-none focus:ring-2 focus:ring-blue-500/40",
                                  "disabled:opacity-40",
                                )}
                              />
                            </label>
                          ) : m.prazoConclusao ? (
                            <span className="w-[10.5rem] text-center text-xs text-slate-500 tabular-nums">
                              Limite {m.prazoConclusao}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div
                        className="relative z-0 ml-auto flex shrink-0 items-center justify-end gap-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span
                          className={cn(
                            "text-xs font-semibold tracking-wide uppercase",
                            m.desbloqueado
                              ? "text-[#39ff14] drop-shadow-[0_0_8px_rgba(57,255,20,0.55)]"
                              : "text-[#b026ff] drop-shadow-[0_0_8px_rgba(176,38,255,0.55)]",
                          )}
                        >
                          {m.desbloqueado ? "Desbloqueado" : "Bloqueado"}
                        </span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={m.desbloqueado}
                          aria-label={`${m.titulo}: ${m.desbloqueado ? "Desbloqueado" : "Bloqueado"}`}
                          disabled={busy || !canToggle}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            void toggleModulo(m, !m.desbloqueado);
                          }}
                          className={cn(
                            "relative h-8 w-14 shrink-0 rounded-full border transition-all duration-200",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900",
                            "disabled:opacity-40 disabled:cursor-not-allowed",
                            m.desbloqueado
                              ? "bg-[#39ff14]/15 border-[#39ff14]/70 shadow-[0_0_16px_rgba(57,255,20,0.35)] focus-visible:ring-[#39ff14]/50"
                              : "bg-[#b026ff]/15 border-[#b026ff]/70 shadow-[0_0_16px_rgba(176,38,255,0.35)] focus-visible:ring-[#b026ff]/50",
                          )}
                        >
                          <span
                            className={cn(
                              "absolute top-0.5 left-0.5 h-6 w-6 rounded-full transition-transform duration-200",
                              m.desbloqueado
                                ? "translate-x-6 bg-[#39ff14] shadow-[0_0_10px_rgba(57,255,20,0.8)]"
                                : "translate-x-0 bg-[#b026ff] shadow-[0_0_10px_rgba(176,38,255,0.8)]",
                            )}
                          />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
