"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { formatDatePt } from "@/lib/calendar-date";
import { openMeetingUrl } from "@/lib/client/open-meeting-url";
import { syncAccessTokenToLocalStorage } from "@/lib/client/access-token";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { lerPresencaAtiva, guardarPresencaAtiva } from "@/lib/lms/presenca-storage";
import {
  usePresencaAtivaRemota,
  usePresencaSessao,
  resolverPresencaAtiva,
  type SessaoPresencaAtiva,
} from "@/lib/lms/use-presenca-sessao";
import { TempoPresencaAoVivo } from "@/components/lms/tempo-presenca-ao-vivo";
import { SessaoLiveHero } from "@/components/formando/sessao-live-hero";
import { Alert } from "@/components/ui";

type PresencaResumo = {
  emSessao: boolean;
  joinDesde: string | null;
  segundosFechados: number;
  segundosTotais: number;
  tempoFormatado: string;
  sessaoEncerrada?: boolean;
};

type SessaoItem = {
  id: string;
  numeroSessao: number;
  data: string;
  horaInicio: string;
  horaFim: string;
  modalidade: string;
  iniciadaEm?: string | null;
  terminadaEm?: string | null;
  presenca?: PresencaResumo;
  salaOnline?: { provider: "ZOOM" | "TEAMS"; joinUrl: string } | null;
  requerSalaOnline?: boolean;
};

type MinhasSessoes = {
  matriculaId: string;
  cursoId: string;
  turma: string;
  acao: string;
  emailPresencaReuniao?: string | null;
  emailPresencaDefinidoPeloGestor?: boolean;
  sessoes: SessaoItem[];
};

type ModuloItem = {
  id: string;
  titulo: string;
  tipo: string;
  ordem: number;
  moduloUnidadeId?: string | null;
  duracaoMin: number | null;
  notaMinima?: number | null;
  pontuacao: number | null;
  percentual: number;
  concluido: boolean;
  desbloqueado: boolean;
};

type UnidadeItem = {
  id: string;
  titulo: string;
  ordem: number;
  notaMinima: number | null;
  pontuacao: number | null;
  desbloqueado: boolean;
  notaMinimaAnterior: number | null;
  tituloModuloAnterior: string | null;
};

type PercursoBlock = {
  unidades: UnidadeItem[];
  tarefas: ModuloItem[];
  prazoLms?: {
    limite: string;
    diasRestantes: number | null;
    percentualConclusao: number;
    emAtraso: boolean;
    cumpridoNoPrazo: boolean;
    completo: boolean;
  } | null;
};

const tipoIcon: Record<string, string> = {
  VIDEO: "M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 2.25z",
  PDF: "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z",
  SCORM: "M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25",
  QUIZ: "M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z",
  TEXTO: "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z",
  WEBINAR: "M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 2.25z",
};

function ModuloRow({
  mod,
  matriculaId,
  cursoId,
}: {
  mod: ModuloItem;
  matriculaId: string;
  cursoId: string;
}) {
  const pct = mod.percentual;
  const done = mod.concluido;
  const locked = !mod.desbloqueado;

  const actionClass = locked
    ? "px-3 py-1.5 rounded-lg bg-slate-700/50 text-xs font-medium text-slate-500 cursor-not-allowed"
    : mod.tipo === "QUIZ"
      ? "px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-xs font-medium text-white transition-colors"
      : mod.tipo === "SCORM"
        ? "px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-xs font-medium text-white transition-colors"
        : mod.tipo === "VIDEO"
          ? "px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white transition-colors"
          : "px-3 py-1.5 rounded-lg border border-slate-600/40 text-xs font-medium text-slate-300 hover:bg-slate-700/40 transition-colors";

  const href =
    mod.tipo === "QUIZ"
      ? `/portal/formando/quiz/${mod.id}?matriculaId=${encodeURIComponent(matriculaId)}`
      : mod.tipo === "SCORM"
        ? `/portal/formando/scorm/${mod.id}?matriculaId=${encodeURIComponent(matriculaId)}`
        : `/portal/formando/conteudo/${mod.id}?matriculaId=${encodeURIComponent(matriculaId)}&cursoId=${encodeURIComponent(cursoId)}`;

  const label = mod.tipo === "QUIZ" ? "Quiz" : mod.tipo === "SCORM" ? "SCORM" : mod.tipo === "VIDEO" ? "Ver" : "Abrir";

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border transition-colors ${
        locked
          ? "bg-slate-900/30 border-slate-700/15 opacity-70"
          : done
            ? "bg-teal-500/5 border-teal-500/15"
            : "bg-slate-800/40 border-slate-700/20"
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span
          className={`flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0 ${
            locked
              ? "bg-slate-800/80 text-slate-600"
              : done
                ? "bg-teal-500/15 text-teal-400"
                : "bg-slate-700/50 text-slate-400"
          }`}
        >
          {locked ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d={done ? "M4.5 12.75l6 6 9-13.5" : tipoIcon[mod.tipo] ?? tipoIcon.TEXTO}
              />
            </svg>
          )}
        </span>
        <div className="min-w-0">
          <p className="text-sm text-slate-200 font-medium truncate">{mod.titulo}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-[11px] text-slate-500">{mod.tipo}</span>
            {mod.pontuacao != null ? (
              <span className={`text-[11px] font-medium ${done ? "text-teal-400" : "text-slate-400"}`}>
                Score: {mod.pontuacao}%
              </span>
            ) : locked ? (
              <span className="text-[11px] text-amber-500/80">Bloqueado</span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2.5 flex-shrink-0">
        <div className="w-20 h-1.5 rounded-full bg-slate-700 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${done ? "bg-teal-500" : "bg-blue-500"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-[11px] text-slate-500 w-8 text-right tabular-nums">{pct}%</span>

        {locked ? (
          <span className={actionClass} title="Conclui o módulo anterior com a nota mínima exigida">
            Bloqueado
          </span>
        ) : (
          <Link href={href} className={actionClass}>
            {label}
          </Link>
        )}
      </div>
    </div>
  );
}

type Props = {
  matriculaId: string;
};

export function FormandoAprendizagemView({ matriculaId }: Props) {
  const { isStaff } = useTenantRole();
  const [block, setBlock] = useState<MinhasSessoes | null>(null);
  const [percurso, setPercurso] = useState<PercursoBlock | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [active, setActive] = useState<SessaoPresencaAtiva | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const r = await bffFetch("/api/v1/lms/minhas-sessoes", { headers: { accept: "application/json" } });
    if (r.status === 403) {
      setError("Esta área é reservada a formandos. Inicia sessão com uma conta de formando.");
      setBlock(null);
      return;
    }
    if (!r.ok) {
      setError("Erro ao carregar sessoes.");
      return;
    }
    const blocks = (await r.json()) as MinhasSessoes[];
    const found = blocks.find((b) => b.matriculaId === matriculaId) ?? null;
    if (!found) {
      setError("Inscrição não encontrada ou já não está activa.");
      setBlock(null);
      return;
    }
    setBlock(found);

    const pRes = await bffFetch(
      `/api/v1/conteudos-lms/percurso?cursoId=${encodeURIComponent(found.cursoId)}&matriculaId=${encodeURIComponent(matriculaId)}`,
      { headers: { accept: "application/json" } },
    );
    if (pRes.ok) {
      setPercurso((await pRes.json()) as PercursoBlock);
    } else {
      setPercurso({ unidades: [], tarefas: [] });
    }
  }, [matriculaId]);

  const { relogio, syncing } = usePresencaSessao(active, {
    onSessaoEncerrada: () => {
      setActive(null);
      setMsg("O formador terminou a sessão - o contador parou automaticamente.");
      void load();
    },
  });

  usePresencaAtivaRemota(() => {
    const stored = lerPresencaAtiva();
    if (stored?.matriculaId === matriculaId) {
      setActive({ matriculaId: stored.matriculaId, sessaoId: stored.sessaoId });
    }
    void load();
  });

  useEffect(() => {
    const sessaoLive = block?.sessoes.some((s) => s.iniciadaEm && !s.terminadaEm);
    if (!sessaoLive) return;
    const id = setInterval(() => void load(), 3000);
    return () => clearInterval(id);
  }, [block, load]);

  useEffect(() => {
    void load();
    const stored = lerPresencaAtiva();
    if (stored?.matriculaId === matriculaId) {
      setActive({ matriculaId: stored.matriculaId, sessaoId: stored.sessaoId });
    } else {
      void resolverPresencaAtiva().then(({ active: a }) => {
        if (a?.matriculaId === matriculaId) setActive(a);
      });
    }
  }, [load, matriculaId]);

  useEffect(() => {
    if (active || !block) return;
    for (const s of block.sessoes) {
      if (s.presenca?.emSessao && !s.presenca.sessaoEncerrada) {
        setActive({
          matriculaId: block.matriculaId,
          sessaoId: s.id,
          salaOnline: s.salaOnline,
        });
        return;
      }
    }
  }, [block, active]);

  useEffect(() => {
    if (!active || !block) return;
    const stored = lerPresencaAtiva();
    if (stored?.sessaoId === active.sessaoId) return;
    const sessao = block.sessoes.find((s) => s.id === active.sessaoId);
    if (sessao && !sessao.presenca?.emSessao) setActive(null);
  }, [block, active]);

  const pendingTasks = useMemo(
    () => percurso?.tarefas.filter((t) => t.desbloqueado && !t.concluido) ?? [],
    [percurso],
  );

  useEffect(() => {
    if (pendingTasks.length > 0) setDetailsOpen(true);
  }, [pendingTasks.length]);

  function abrirReuniao(sessao: SessaoItem) {
    if (!block) return;
    setError(null);
    setMsg(null);

    if (sessao.terminadaEm || sessao.presenca?.sessaoEncerrada) {
      setError("Esta sessão já terminou.");
      return;
    }
    if (!sessao.iniciadaEm) {
      setError("O formador ainda não iniciou esta sessão.");
      return;
    }

    syncAccessTokenToLocalStorage();
    guardarPresencaAtiva({ matriculaId: block.matriculaId, sessaoId: sessao.id });

    if (sessao.salaOnline?.joinUrl) {
      openMeetingUrl(sessao.salaOnline.joinUrl);
    }

    const q = new URLSearchParams({ matriculaId: block.matriculaId, sessaoId: sessao.id });
    const reuniaoUrl = `/portal/formando/reuniao?${q.toString()}`;
    const popup = window.open(reuniaoUrl, "nexiforma_reuniao", "noopener,width=520,height=720");
    if (!popup) {
      window.location.href = reuniaoUrl;
    } else {
      setActive({ matriculaId: block.matriculaId, sessaoId: sessao.id, salaOnline: sessao.salaOnline });
    }
    setMsg(
      sessao.salaOnline?.joinUrl
        ? "Sala aberta - o contador corre nesta janela."
        : "Contador aberto - aguarda o formador abrir a sala Teams.",
    );
    window.setTimeout(() => void load(), 1500);
  }

  const totalMods = percurso?.tarefas.length ?? 0;
  const doneMods = percurso?.tarefas.filter((t) => t.concluido).length ?? 0;
  const progressPct = totalMods > 0 ? Math.round((doneMods / totalMods) * 100) : 0;

  return (
    <div className="max-w-4xl mx-auto px-5 py-8 space-y-8">
      {isStaff ? (
        <Link href="/portal" className="text-sm text-blue-400 hover:text-blue-300 transition-colors inline-flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Backoffice
        </Link>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/portal/formando" className="text-xs text-slate-500 hover:text-slate-300 mb-2 inline-block">
            ← Escolher outra inscrição
          </Link>
          <h1 className="text-2xl font-bold text-slate-50 mb-1">Aprendizagem</h1>
          {block ? (
            <>
              <p className="text-sm font-medium text-slate-200">{block.acao}</p>
              <p className="text-xs text-slate-500">{block.turma}</p>
            </>
          ) : null}
          <p className="text-sm text-slate-400 mt-2">
            Entra na reunião para a presença ser registada automaticamente (entrada, contador e saída).
          </p>
        </div>
      </div>

      {error ? <Alert variant="error">{error}</Alert> : null}
      {msg ? <Alert variant="success">{msg}</Alert> : null}

      {block ? <SessaoLiveHero blocks={[block]} /> : null}

      {active && relogio ? (
        <div className="rounded-2xl bg-teal-500/10 border border-teal-500/20 px-5 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex h-2.5 w-2.5 rounded-full bg-teal-400 animate-pulse flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-teal-300">Em sessão</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Tempo na sessão{" "}
                <span className="text-teal-200 font-mono tabular-nums text-sm">{relogio.tempoTotalFormatado}</span>
                {syncing ? " · a sincronizar…" : null}
              </p>
            </div>
          </div>
          {active.salaOnline ? (
            <a
              href={active.salaOnline.joinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-teal-400 hover:text-teal-300 underline underline-offset-2"
            >
              Abrir {active.salaOnline.provider}
            </a>
          ) : null}
        </div>
      ) : null}

      {totalMods > 0 ? (
        <div className="rounded-2xl bg-slate-900/50 border border-slate-700/30 p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-3">Progresso</h2>
          <div className="flex items-center gap-4">
            <div className="flex-1 h-2.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-teal-500 transition-all duration-700"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="text-sm font-bold text-slate-200 tabular-nums">
              {doneMods}/{totalMods}
            </span>
          </div>
          {pendingTasks.length > 0 ? (
            <p className="text-xs text-amber-400/90 mt-2">
              Tens {pendingTasks.length} tarefa(s) por concluir nesta formação.
            </p>
          ) : null}
        </div>
      ) : null}

      {!block ? (
        <p className="text-slate-500 text-sm text-center py-8">A carregar...</p>
      ) : (
        <div className="rounded-2xl bg-slate-900/50 border border-slate-700/30 overflow-hidden">
          <button
            type="button"
            onClick={() => setDetailsOpen((v) => !v)}
            className="w-full px-5 py-4 flex items-center justify-between gap-3 text-left hover:bg-slate-800/30 transition-colors"
          >
            <div className="min-w-0">
              <h3 className="font-semibold text-slate-100 truncate">Sessões e conteúdos</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {block.sessoes.length} sessão(ões) · {doneMods}/{totalMods} módulos
              </p>
            </div>
            <svg
              className={`w-5 h-5 text-slate-500 transition-transform duration-200 shrink-0 ${detailsOpen ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>

          {detailsOpen ? (
            <div className="px-5 pb-5 space-y-5 border-t border-slate-700/30 pt-4">
              {block.sessoes.length > 0 ? (
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Sessoes</h4>
                  <div className="space-y-2">
                    {block.sessoes.map((s) => (
                      <div
                        key={s.id}
                        className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-800/40 border border-slate-700/20"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-700/50 text-xs font-bold text-slate-300 flex-shrink-0">
                            {s.numeroSessao}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm text-slate-200 truncate">
                              {formatDatePt(s.data)}
                              {" · "}
                              {s.horaInicio}–{s.horaFim}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <span className="text-[11px] text-slate-500">{s.modalidade}</span>
                              {s.terminadaEm ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-500/10 text-slate-400">
                                  terminada
                                </span>
                              ) : s.iniciadaEm ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-teal-500/10 text-teal-400">
                                  em curso
                                </span>
                              ) : null}
                              {s.iniciadaEm && !s.terminadaEm && block.emailPresencaReuniao ? (
                                <span className="text-[10px] text-amber-400/90 truncate max-w-[12rem]" title={block.emailPresencaReuniao}>
                                  Zoom/Teams: {block.emailPresencaReuniao}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {s.presenca && (s.presenca.segundosTotais > 0 || s.presenca.emSessao) ? (
                            <span className="text-xs font-mono tabular-nums text-slate-400">
                              {active?.sessaoId === s.id && relogio
                                ? relogio.tempoTotalFormatado
                                : s.presenca.emSessao && s.presenca.joinDesde
                                  ? (
                                    <TempoPresencaAoVivo
                                      segundosFechados={s.presenca.segundosFechados}
                                      emSessao
                                      joinDesde={s.presenca.joinDesde}
                                      className="text-teal-400"
                                    />
                                  )
                                  : s.presenca.tempoFormatado}
                            </span>
                          ) : null}
                          <button
                            type="button"
                            disabled={!!active || !!s.terminadaEm || !!s.presenca?.sessaoEncerrada || !s.iniciadaEm}
                            onClick={() => abrirReuniao(s)}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors disabled:opacity-50 bg-teal-600 hover:bg-teal-500 disabled:hover:bg-teal-600"
                          >
                            {s.presenca?.emSessao ? "Na reunião" : "Entrar na reunião"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-600">Sem sessoes disponiveis.</p>
              )}

              {percurso?.tarefas.length ? (
                <div>
                  {percurso.prazoLms ? (
                    <div
                      className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
                        percurso.prazoLms.emAtraso
                          ? "border-red-500/30 bg-red-950/30 text-red-200"
                          : percurso.prazoLms.cumpridoNoPrazo
                            ? "border-emerald-500/30 bg-emerald-950/25 text-emerald-200"
                            : "border-slate-600/40 bg-slate-900/50 text-slate-300"
                      }`}
                    >
                      <p className="font-medium">Prazo de conclusão LMS: {percurso.prazoLms.limite}</p>
                      <p className="text-xs mt-1 opacity-90">
                        Progresso: {percurso.prazoLms.percentualConclusao}% ·{" "}
                        {percurso.prazoLms.completo
                          ? percurso.prazoLms.cumpridoNoPrazo
                            ? "Concluído dentro do prazo"
                            : "Concluído fora do prazo"
                          : percurso.prazoLms.emAtraso
                            ? "Prazo ultrapassado - conclui os módulos pendentes"
                            : percurso.prazoLms.diasRestantes != null && percurso.prazoLms.diasRestantes >= 0
                              ? `${percurso.prazoLms.diasRestantes} dias restantes`
                              : "Prazo ultrapassado"}
                      </p>
                    </div>
                  ) : null}
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                    Conteudos ({doneMods}/{totalMods})
                  </h4>
                  {percurso.unidades.length > 0 ? (
                    <div className="space-y-5">
                      {percurso.unidades.map((unidade) => {
                        const items = percurso.tarefas
                          .filter((m) => m.moduloUnidadeId === unidade.id)
                          .sort((a, b) => a.ordem - b.ordem);
                        return (
                          <div key={unidade.id} className={!unidade.desbloqueado ? "opacity-80" : undefined}>
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pl-3 border-l-2 border-teal-500/50">
                              <h5 className="text-sm font-semibold text-teal-400">{unidade.titulo}</h5>
                              {!unidade.desbloqueado && unidade.tituloModuloAnterior ? (
                                <span className="text-[11px] text-amber-500/90">
                                  Requer {unidade.notaMinimaAnterior ?? 60}% em «{unidade.tituloModuloAnterior}»
                                </span>
                              ) : null}
                            </div>
                            {items.length === 0 ? (
                              <p className="text-xs text-slate-600 italic pl-3">Sem tarefas neste módulo.</p>
                            ) : (
                              <div className="space-y-2">
                                {items.map((mod) => (
                                  <ModuloRow
                                    key={mod.id}
                                    mod={mod}
                                    matriculaId={block.matriculaId}
                                    cursoId={block.cursoId}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {[...percurso.tarefas]
                        .sort((a, b) => a.ordem - b.ordem)
                        .map((mod) => (
                          <ModuloRow
                            key={mod.id}
                            mod={mod}
                            matriculaId={block.matriculaId}
                            cursoId={block.cursoId}
                          />
                        ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
