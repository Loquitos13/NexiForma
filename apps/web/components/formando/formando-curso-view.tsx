"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Menu, X } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { FormandoPercursoSidebar } from "./formando-percurso-sidebar";
import { FormandoPercursoFooter } from "./formando-percurso-footer";
import { FormandoTarefaBlock } from "./formando-tarefa-block";
import { FormandoModuloTransition } from "./formando-modulo-transition";
import type { PercursoFormando } from "./formando-percurso-types";
import { tarefasDaUnidade, UNIDADE_FLAT_ID } from "./formando-percurso-types";

type Props = {
  matriculaId: string;
  cursoId: string;
  tituloCurso: string;
  percurso: PercursoFormando;
  onRefresh: () => Promise<void>;
  topSlot?: React.ReactNode;
};

type SlidePhase = "idle" | "exit" | "enter";

export function FormandoCursoView({
  matriculaId,
  cursoId,
  tituloCurso,
  percurso,
  onRefresh,
  topSlot,
}: Props) {
  const searchParams = useSearchParams();
  const unidades = useMemo(
    () => [...percurso.unidades].sort((a, b) => a.ordem - b.ordem),
    [percurso.unidades],
  );

  const unidadesComConteudo = useMemo(() => {
    const flatTarefas = percurso.tarefas.filter((t) => !t.moduloUnidadeId);
    const sorted = [...unidades].sort((a, b) => a.ordem - b.ordem);
    if (sorted.length === 0) {
      if (flatTarefas.length === 0) return sorted;
      return [
        {
          id: UNIDADE_FLAT_ID,
          titulo: "Conteúdos",
          ordem: 0,
          desbloqueado: true,
          notaMinima: null,
          pontuacao: null,
          notaMinimaAnterior: null,
          tituloModuloAnterior: null,
        },
      ];
    }
    if (flatTarefas.length === 0) return sorted;
    return [
      ...sorted,
      {
        id: UNIDADE_FLAT_ID,
        titulo: "Percurso directo",
        ordem: sorted.length,
        desbloqueado: true,
        notaMinima: null,
        pontuacao: null,
        notaMinimaAnterior: null,
        tituloModuloAnterior: null,
      },
    ];
  }, [unidades, percurso.tarefas]);

  const [activeUnidadeId, setActiveUnidadeId] = useState(() => {
    const first = unidadesComConteudo.find((u) => u.desbloqueado);
    return first?.id ?? unidadesComConteudo[0]?.id ?? "";
  });
  const [activeTarefaId, setActiveTarefaId] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [avancarBusy, setAvancarBusy] = useState(false);
  const [slidePhase, setSlidePhase] = useState<SlidePhase>("idle");
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [overlayMeta, setOverlayMeta] = useState<{ atual: string; proximo?: string; nextId: string } | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const prevAllDoneRef = useRef(false);
  const autoAdvanceRef = useRef(false);

  const sortedUnidades = useMemo(
    () => unidadesComConteudo,
    [unidadesComConteudo],
  );

  const progressoPct = useMemo(() => {
    const total = percurso.tarefas.length;
    if (total === 0) return 0;
    const done = percurso.tarefas.filter((t) => t.concluido).length;
    return Math.round((done / total) * 100);
  }, [percurso.tarefas]);

  const tarefasActivas = useMemo(() => tarefasDaUnidade(percurso.tarefas, activeUnidadeId), [percurso.tarefas, activeUnidadeId]);

  const unidadeTitulo = unidadesComConteudo.find((u) => u.id === activeUnidadeId)?.titulo ?? "";

  const proximaUnidade = useCallback(
    (fromId: string) => {
      const idx = sortedUnidades.findIndex((u) => u.id === fromId);
      return sortedUnidades.slice(idx + 1).find((u) => u.desbloqueado) ?? null;
    },
    [sortedUnidades],
  );

  const scrollParaTarefa = useCallback((tarefaId: string) => {
    setActiveTarefaId(tarefaId);
    const el = document.getElementById(`tarefa-${tarefaId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const marcarUnidadeConcluida = useCallback(
    async (unidadeId: string) => {
      const items =
        unidadeId === UNIDADE_FLAT_ID
          ? percurso.tarefas.filter((t) => !t.moduloUnidadeId && !t.concluido && t.desbloqueado)
          : percurso.tarefas.filter((t) => t.moduloUnidadeId === unidadeId && !t.concluido && t.desbloqueado);
      await Promise.all(
        items.map((t) =>
          bffFetch(`/api/v1/conteudos-lms/progresso/${t.id}?matriculaId=${encodeURIComponent(matriculaId)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", accept: "application/json" },
            body: JSON.stringify({ percentual: 100, pontuacao: 100 }),
          }),
        ),
      );
    },
    [matriculaId, percurso.tarefas],
  );

  const aplicarProximoModulo = useCallback(
    async (nextId: string) => {
      setActiveUnidadeId(nextId);
      setActiveTarefaId(null);
      setSlidePhase("enter");
      contentRef.current?.scrollTo({ top: 0 });
      await new Promise((r) => setTimeout(r, 350));
      setSlidePhase("idle");
    },
    [],
  );

  const avancarModulo = useCallback(
    async (opts?: { animar?: boolean }) => {
      const next = proximaUnidade(activeUnidadeId);
      if (!next || avancarBusy) return;
      setAvancarBusy(true);
      try {
        if (opts?.animar !== false) {
          setOverlayMeta({ atual: unidadeTitulo, proximo: next.titulo, nextId: next.id });
          setOverlayOpen(true);
          setSlidePhase("exit");
          await new Promise((r) => setTimeout(r, 400));
        }
        await marcarUnidadeConcluida(activeUnidadeId);
        await onRefresh();
        if (opts?.animar === false) {
          await aplicarProximoModulo(next.id);
        }
      } finally {
        setAvancarBusy(false);
      }
    },
    [activeUnidadeId, aplicarProximoModulo, avancarBusy, marcarUnidadeConcluida, onRefresh, proximaUnidade, unidadeTitulo],
  );

  const handleOverlayDone = useCallback(() => {
    setOverlayOpen(false);
    if (overlayMeta?.nextId) void aplicarProximoModulo(overlayMeta.nextId);
    setOverlayMeta(null);
  }, [aplicarProximoModulo, overlayMeta]);

  useEffect(() => {
    prevAllDoneRef.current = false;
    autoAdvanceRef.current = false;
  }, [activeUnidadeId]);

  useEffect(() => {
    const items = tarefasActivas.filter((t) => t.desbloqueado);
    const allDone = items.length > 0 && items.every((t) => t.concluido);
    const next = proximaUnidade(activeUnidadeId);

    if (allDone && !prevAllDoneRef.current && next && !avancarBusy && !autoAdvanceRef.current) {
      autoAdvanceRef.current = true;
      const t = setTimeout(() => void avancarModulo({ animar: true }), 600);
      return () => clearTimeout(t);
    }
    prevAllDoneRef.current = allDone;
  }, [tarefasActivas, activeUnidadeId, proximaUnidade, avancarBusy, avancarModulo]);

  useEffect(() => {
    const root = contentRef.current;
    if (!root) return;
    const sections = root.querySelectorAll<HTMLElement>("section[id^='tarefa-']");
    if (!sections.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => (b.intersectionRatio ?? 0) - (a.intersectionRatio ?? 0))[0];
        if (visible?.target?.id) {
          setActiveTarefaId(visible.target.id.replace("tarefa-", ""));
        }
      },
      { root, threshold: [0.35, 0.55] },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [tarefasActivas, activeUnidadeId]);

  useEffect(() => {
    const tarefaId = searchParams.get("tarefa");
    if (!tarefaId) return;
    const tarefa = percurso.tarefas.find((t) => t.id === tarefaId);
    if (!tarefa) return;
    setActiveUnidadeId(tarefa.moduloUnidadeId ?? UNIDADE_FLAT_ID);
    const t = setTimeout(() => scrollParaTarefa(tarefaId), 400);
    return () => clearTimeout(t);
  }, [searchParams, percurso.tarefas, scrollParaTarefa]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#070b12]">
      {topSlot ? (
        <div className="portal-card-shell max-h-[38dvh] shrink-0 overflow-x-hidden overflow-y-auto">
          {topSlot}
        </div>
      ) : null}

      <FormandoModuloTransition
        visible={overlayOpen}
        tituloAtual={overlayMeta?.atual ?? ""}
        tituloProximo={overlayMeta?.proximo}
        onDone={handleOverlayDone}
      />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <FormandoPercursoSidebar
          tituloCurso={tituloCurso}
          progressoPct={progressoPct}
          unidades={unidadesComConteudo}
          tarefas={percurso.tarefas}
          activeUnidadeId={activeUnidadeId}
          activeTarefaId={activeTarefaId}
          collapsed={sidebarCollapsed}
          mobileOpen={mobileNavOpen}
          onMobileClose={() => setMobileNavOpen(false)}
          onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
          onSelectUnidade={(id) => {
            setActiveUnidadeId(id);
            setActiveTarefaId(null);
            setSlidePhase("enter");
            contentRef.current?.scrollTo({ top: 0 });
            setTimeout(() => setSlidePhase("idle"), 300);
          }}
          onSelectTarefa={(_u, tarefaId) => scrollParaTarefa(tarefaId)}
        />

        <div className="flex min-w-0 flex-1 flex-col bg-[#070b12]">
          <div className="portal-mobile-bar grid shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 border-b border-slate-700/30 bg-slate-950/90 px-3 py-2 sm:px-4">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-800/50 lg:hidden"
                aria-label="Abrir módulos e tópicos"
              >
                <Menu className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => setSidebarCollapsed((v) => !v)}
                className="hidden rounded-lg p-2 text-slate-400 hover:bg-slate-800/50 lg:inline-flex"
                aria-label="Recolher menu lateral"
              >
                {sidebarCollapsed ? <Menu className="h-5 w-5" /> : <X className="h-5 w-5" />}
              </button>
            </div>
            <span className="truncate text-center text-xs font-semibold uppercase tracking-wide text-slate-400">
              {unidadeTitulo}
            </span>
            <Link
              href="/portal/formando"
              className="shrink-0 text-xs font-medium text-slate-500 hover:text-blue-400"
            >
              Sair
            </Link>
          </div>

          <div ref={contentRef} className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 sm:px-8 sm:py-6">
            <div
              className={`portal-card-shell mx-auto w-full max-w-3xl rounded-2xl border border-slate-700/30 bg-slate-900/40 shadow-xl transition-all duration-400 ease-out ${
                slidePhase === "exit"
                  ? "translate-x-[-28px] opacity-0"
                  : slidePhase === "enter"
                    ? "translate-x-[28px] opacity-0"
                    : "translate-x-0 opacity-100"
              }`}
            >
              {tarefasActivas.length === 0 ? (
                <p className="p-12 text-center text-sm text-slate-500">Sem tópicos neste módulo.</p>
              ) : (
                tarefasActivas.map((t) => (
                  <FormandoTarefaBlock
                    key={t.id}
                    tarefa={t}
                    matriculaId={matriculaId}
                    cursoId={cursoId}
                    onConcluido={() => void onRefresh()}
                  />
                ))
              )}
            </div>
          </div>

          <FormandoPercursoFooter
            unidades={unidadesComConteudo}
            activeUnidadeId={activeUnidadeId}
            busy={avancarBusy}
            onAvancar={() => void avancarModulo({ animar: true })}
          />
        </div>
      </div>
    </div>
  );
}
