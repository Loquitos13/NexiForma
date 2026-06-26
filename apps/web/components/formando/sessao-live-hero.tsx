"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Radio, Video } from "lucide-react";

type SessaoLive = {
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

type Block = {
  matriculaId: string;
  acao: string;
  turma: string;
  emailPresencaReuniao?: string | null;
  emailPresencaDefinidoPeloGestor?: boolean;
  sessoes: SessaoLive[];
};

export function findSessaoLive(blocks: Block[]): (SessaoLive & {
  matriculaId: string;
  acao: string;
  turma: string;
  emailPresencaReuniao?: string | null;
  emailPresencaDefinidoPeloGestor?: boolean;
}) | null {
  for (const block of blocks) {
    for (const s of block.sessoes) {
      if (s.iniciadaEm && !s.terminadaEm && s.lmsAtivo) {
        return {
          ...s,
          matriculaId: block.matriculaId,
          acao: block.acao,
          turma: block.turma,
          emailPresencaReuniao: block.emailPresencaReuniao,
          emailPresencaDefinidoPeloGestor: block.emailPresencaDefinidoPeloGestor,
        };
      }
    }
  }
  return null;
}

export function SessaoLiveHero({ blocks }: { blocks: Block[] }) {
  const live = useMemo(() => findSessaoLive(blocks), [blocks]);

  if (!live) return null;

  const href = `/portal/formando/reuniao?matriculaId=${encodeURIComponent(live.matriculaId)}&sessaoFormacaoId=${encodeURIComponent(live.id)}`;
  const dataFmt = new Date(live.data).toLocaleDateString("pt-PT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="relative overflow-hidden rounded-2xl border border-teal-500/35 bg-gradient-to-br from-teal-950/70 via-slate-900/90 to-slate-950 p-5 shadow-lg shadow-teal-950/30">
      <div className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full bg-teal-500/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-teal-300">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-400" />
        </span>
        Ao vivo
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-4 pr-16">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-600/20 text-teal-300">
          <Video className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-teal-400/90">
            Sessão {live.numeroSessao} em curso
          </p>
          <h2 className="text-lg font-bold text-slate-50 truncate">{live.acao}</h2>
          <p className="text-sm text-slate-400">
            {live.turma} · {dataFmt} · {live.horaInicio}–{live.horaFim}
          </p>
          {live.presenca?.emSessao ? (
            <p className="text-xs text-teal-300 flex items-center gap-1">
              <Radio className="h-3 w-3" />
              Já estás na sessão - o contador está activo
            </p>
          ) : (
            <p className="text-xs text-slate-500">
              Entra pelo portal para registar a tua presença oficial (contador inicia ao juntares-te).
              {live.emailPresencaReuniao ? (
                <span className="block mt-1 text-amber-300/90">
                  No Zoom/Teams usa o email{" "}
                  <strong className="font-semibold">{live.emailPresencaReuniao}</strong>
                  {live.emailPresencaDefinidoPeloGestor ? " (definido pelo gestor)" : " (conta NexiForma)"}.
                </span>
              ) : null}
            </p>
          )}
        </div>
        <Link
          href={href}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-teal-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-teal-500"
        >
          {live.presenca?.emSessao ? "Voltar à reunião" : "Entrar na sessão"}
        </Link>
      </div>
    </div>
  );
}
