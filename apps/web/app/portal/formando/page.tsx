"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, GraduationCap } from "lucide-react";
import { percentualProgressoPercurso } from "@nexiforma/shared";
import { bffFetch } from "@/lib/client/bff-fetch";
import { useMinhasSessoesPoll } from "@/lib/lms/use-minhas-sessoes-poll";
import { Card, CardContent } from "@/components/ui/card";
import { Alert } from "@/components/ui";
import { SessaoLiveHero } from "@/components/formando/sessao-live-hero";

type SessaoItem = {
  id: string;
  numeroSessao: number;
  data: string;
  horaInicio: string;
  horaFim: string;
  iniciadaEm?: string | null;
  terminadaEm?: string | null;
  lmsAtivo?: boolean;
  presenca?: { emSessao?: boolean };
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

type PercursoResumo = {
  total: number;
  concluidos: number;
  pendentes: number;
  pct: number;
  prazoLms?: {
    limite: string;
    diasRestantes: number | null;
    percentualConclusao: number;
    emAtraso: boolean;
    cumpridoNoPrazo: boolean;
    completo: boolean;
  } | null;
};

export default function FormandoPortalPage() {
  const [blocks, setBlocks] = useState<MinhasSessoes[] | null>(null);
  const [progresso, setProgresso] = useState<Record<string, PercursoResumo>>({});
  const [error, setError] = useState<string | null>(null);

  const loadProgresso = useCallback(async (data: MinhasSessoes[]) => {
    const next: Record<string, PercursoResumo> = {};
    await Promise.all(
      data.map(async (b) => {
        const pRes = await bffFetch(
          `/api/v1/conteudos-lms/percurso?cursoId=${encodeURIComponent(b.cursoId)}&matriculaId=${encodeURIComponent(b.matriculaId)}`,
          { headers: { accept: "application/json" } },
        );
        if (!pRes.ok) {
          next[b.matriculaId] = { total: 0, concluidos: 0, pendentes: 0, pct: 0 };
          return;
        }
        const p = (await pRes.json()) as {
          tarefas: Array<{ concluido: boolean; desbloqueado: boolean; percentual: number }>;
          prazoLms?: PercursoResumo["prazoLms"];
        };
        const total = p.tarefas.length;
        const concluidos = p.tarefas.filter((t) => t.concluido || t.percentual >= 100).length;
        const pctBackend = p.prazoLms?.percentualConclusao;
        const pct =
          pctBackend != null
            ? Math.min(100, Math.floor(pctBackend))
            : Math.floor(percentualProgressoPercurso(p.tarefas, { decimals: 0 }));
        const pendentes = p.tarefas.filter((t) => t.desbloqueado && !(t.concluido || t.percentual >= 100)).length;
        next[b.matriculaId] = {
          total,
          concluidos,
          pendentes,
          prazoLms: p.prazoLms ?? null,
          pct,
        };
      }),
    );
    setProgresso(next);
  }, []);

  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;
  const inscricoesKey = useMemo(
    () => (blocks ?? []).map((b) => b.matriculaId).sort().join("|"),
    [blocks],
  );

  // Sessões: poll frequente para o banner «ao vivo» / presença actualizarem sem refresh.
  useMinhasSessoesPoll((raw) => {
    const data = raw as MinhasSessoes[];
    setError(null);
    setBlocks(data);
  });

  // Progresso LMS: ao mudar de inscrições e a cada 60s (não a cada poll de sessão).
  useEffect(() => {
    if (!inscricoesKey) return;
    const tick = () => {
      const data = blocksRef.current;
      if (data?.length) void loadProgresso(data);
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [inscricoesKey, loadProgresso]);

  return (
    <div className="max-w-4xl mx-auto px-5 py-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-50">Aprendizagem</h1>
          <p className="text-sm text-slate-400 mt-1">
            Escolhe a inscrição em que queres continuar sessões e conteúdos.
          </p>
        </div>
        <Link
          href="/portal/fluxo"
          className="inline-flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 shrink-0"
        >
          Fluxo guiado
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {blocks && blocks.length > 0 ? <SessaoLiveHero blocks={blocks} /> : null}

      {error ? <Alert variant="error">{error}</Alert> : null}

      {blocks === null ? (
        <p className="text-sm text-slate-500 text-center py-10">A carregar inscrições…</p>
      ) : !error && blocks.length === 0 ? (
        <Card className="border-dashed border-slate-700/50">
          <CardContent className="py-12 text-center space-y-3">
            <GraduationCap className="h-10 w-10 text-slate-600 mx-auto" />
            <p className="text-sm text-slate-500">Não tens formações activas de momento.</p>
            <Link
              href="/portal/formando/catalogo"
              className="inline-flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300"
            >
              Ver catálogo disponível
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {blocks.map((block) => {
            const prog = progresso[block.matriculaId];
            const pct = prog?.pct ?? 0;
            const completo = prog?.prazoLms?.completo ?? (prog && prog.total > 0 && pct >= 100);
            return (
              <Card
                key={block.matriculaId}
                className="border-slate-700/30 bg-slate-900/40 hover:border-blue-500/30 transition-colors"
              >
                <CardContent className="py-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-base font-semibold text-slate-100">{block.acao}</h2>
                      <p className="text-sm text-slate-400">{block.turma}</p>
                      {prog && prog.total > 0 ? (
                        <p className="text-xs text-slate-500 mt-1">
                          {prog.concluidos}/{prog.total} conteúdos concluídos
                          {prog.pendentes > 0 ? (
                            <span className="text-amber-400/90"> · {prog.pendentes} por fazer</span>
                          ) : null}
                          {prog.prazoLms ? (
                            <span
                              className={
                                prog.prazoLms.emAtraso
                                  ? " text-red-400"
                                  : prog.prazoLms.cumpridoNoPrazo
                                    ? " text-emerald-400"
                                    : " text-slate-400"
                              }
                            >
                              {" "}
                              · Prazo LMS: {prog.prazoLms.limite}
                              {prog.prazoLms.completo
                                ? prog.prazoLms.cumpridoNoPrazo
                                  ? " (concluído no prazo)"
                                  : " (concluído fora do prazo)"
                                : prog.prazoLms.diasRestantes != null && prog.prazoLms.diasRestantes >= 0
                                  ? ` (${prog.prazoLms.diasRestantes} dias restantes)`
                                  : " (prazo ultrapassado)"}
                            </span>
                          ) : null}
                        </p>
                      ) : null}
                    </div>
                    <Link
                      href={`/portal/formando/aprendizagem/${block.matriculaId}`}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shrink-0"
                    >
                      {completo ? "Rever conteúdos" : "Continuar"}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                  {prog && prog.total > 0 ? (
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-teal-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-slate-400 tabular-nums">{pct}%</span>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
