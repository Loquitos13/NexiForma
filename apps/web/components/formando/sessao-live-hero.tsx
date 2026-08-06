"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ClipboardCheck, Radio, Video } from "lucide-react";
import { formatDatePt } from "@/lib/calendar-date";
import { bffFetch } from "@/lib/client/bff-fetch";
import { PresencaConsentModal } from "@/components/formando/presenca-consent-modal";
import { PresencaQrScanModal } from "@/components/formando/presenca-qr-scan-modal";
import { useMobileDevice } from "@/lib/formando/use-mobile-device";
import { cn } from "@/lib/ui/cn";

type SessaoLive = {
  id: string;
  numeroSessao: number;
  data: string;
  horaInicio: string;
  horaFim: string;
  iniciadaEm?: string | null;
  terminadaEm?: string | null;
  lmsAtivo?: boolean;
  presenca?: { emSessao?: boolean; sessaoEncerrada?: boolean };
};

type Block = {
  matriculaId: string;
  acao: string;
  turma: string;
  emailPresencaReuniao?: string | null;
  emailPresencaDefinidoPeloGestor?: boolean;
  sessoes: SessaoLive[];
};

const STATUS_POLL_MS = 2_000;

export function findSessaoLive(blocks: Block[]): (SessaoLive & {
  matriculaId: string;
  acao: string;
  turma: string;
  emailPresencaReuniao?: string | null;
  emailPresencaDefinidoPeloGestor?: boolean;
}) | null {
  for (const block of blocks) {
    for (const s of block.sessoes) {
      // Só quando a sessão foi iniciada e ainda não terminou.
      if (s.iniciadaEm && !s.terminadaEm && !s.presenca?.sessaoEncerrada) {
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
  const [alreadyPresent, setAlreadyPresent] = useState(false);
  const [statusLoaded, setStatusLoaded] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  /** Esconde o banner assim que a API confirma o fim da sessão (antes do poll da lista). */
  const [sessaoEncerrada, setSessaoEncerrada] = useState(false);
  const liveIdRef = useRef<string | null>(null);
  const isMobile = useMobileDevice();

  const loadStatus = useCallback(async (sessaoId: string) => {
    const res = await bffFetch(
      `/api/v1/presenca-checkin/sessao/${encodeURIComponent(sessaoId)}`,
      { headers: { accept: "application/json" }, authRetry401: true },
    );
    // Ignora resposta se a sessão ao vivo já mudou entretanto.
    if (liveIdRef.current !== sessaoId) return;
    if (!res.ok) {
      setStatusLoaded(true);
      return;
    }
    const data = (await res.json()) as {
      alreadyPresent?: boolean;
      sessao?: { terminadaEm?: string | null; iniciadaEm?: string | null };
    };
    if (liveIdRef.current !== sessaoId) return;
    if (data.sessao?.terminadaEm) {
      setSessaoEncerrada(true);
      setScanOpen(false);
      return;
    }
    setAlreadyPresent(Boolean(data.alreadyPresent));
    setStatusLoaded(true);
  }, []);

  useEffect(() => {
    const id = live?.id ?? null;
    liveIdRef.current = id;
    setMsg(null);
    setScanOpen(false);
    setSessaoEncerrada(false);
    setAlreadyPresent(false);
    setStatusLoaded(false);
    if (!id) return;

    void loadStatus(id);
    const timer = setInterval(() => void loadStatus(id), STATUS_POLL_MS);
    return () => clearInterval(timer);
  }, [live?.id, loadStatus]);

  if (!live || sessaoEncerrada) return null;

  const reuniaoHref = `/portal/formando/reuniao?matriculaId=${encodeURIComponent(live.matriculaId)}&sessaoFormacaoId=${encodeURIComponent(live.id)}`;
  const dataFmt = formatDatePt(live.data);
  const showEntrarReuniao = Boolean(live.lmsAtivo);
  const showPresente = statusLoaded && alreadyPresent;

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl border border-teal-500/35 bg-gradient-to-br from-teal-950/70 via-slate-900/90 to-slate-950 p-5 shadow-lg shadow-teal-950/30">
        <div className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full bg-teal-500/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-teal-300">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-400" />
          </span>
          Ao vivo
        </div>

        <div className="flex flex-col gap-4 pr-16 sm:flex-row sm:items-center">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-600/20 text-teal-300">
            <Video className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-xs font-medium uppercase tracking-wider text-teal-400/90">
              Sessão {live.numeroSessao} em curso
            </p>
            <h2 className="truncate text-lg font-bold text-slate-50">{live.acao}</h2>
            <p className="text-sm text-slate-400">
              {live.turma} · {dataFmt} · {live.horaInicio}–{live.horaFim}
            </p>
            {live.presenca?.emSessao ? (
              <p className="flex items-center gap-1 text-xs text-teal-300">
                <Radio className="h-3 w-3" />
                Já estás na sessão - o contador LMS está activo
              </p>
            ) : (
              <p className="text-xs text-slate-500">
                Lê o QR do formador para marcar a presença na folha.{" "}
                {showEntrarReuniao
                  ? "Se a sessão for online, entra também na reunião para o contador."
                  : null}
                {live.emailPresencaReuniao ? (
                  <span className="mt-1 block text-amber-300/90">
                    No Zoom/Teams usa o email{" "}
                    <strong className="font-semibold">{live.emailPresencaReuniao}</strong>
                    {live.emailPresencaDefinidoPeloGestor
                      ? " (definido pelo gestor)"
                      : " (conta NexiForma)"}
                    .
                  </span>
                ) : null}
              </p>
            )}
            {msg ? <p className="text-xs text-teal-300">{msg}</p> : null}
          </div>

          <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto">
            <button
              type="button"
              disabled={showPresente}
              onClick={() => {
                if (!showPresente) setScanOpen(true);
              }}
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-colors",
                showPresente
                  ? "cursor-default border border-teal-500/40 bg-teal-950/50 text-teal-200"
                  : "bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-md shadow-amber-900/30",
              )}
            >
              {showPresente ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Presença registada
                </>
              ) : (
                <>
                  <ClipboardCheck className="h-4 w-4" />
                  Marcar presença
                </>
              )}
            </button>
            {showEntrarReuniao ? (
              <Link
                href={reuniaoHref}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-teal-500/40 bg-teal-600/20 px-5 py-2.5 text-sm font-semibold text-teal-100 transition-colors hover:bg-teal-600/35"
              >
                {live.presenca?.emSessao ? "Voltar à reunião" : "Entrar na reunião"}
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      {isMobile ? (
        <PresencaQrScanModal
          open={scanOpen}
          onClose={() => setScanOpen(false)}
          onSuccess={(r) => {
            setAlreadyPresent(true);
            setStatusLoaded(true);
            setMsg(
              r.alreadyPresent
                ? "A tua presença já estava registada."
                : "Presença registada com sucesso.",
            );
          }}
        />
      ) : (
        <PresencaConsentModal
          open={scanOpen}
          sessaoId={live.id}
          onClose={() => setScanOpen(false)}
          onSuccess={(r) => {
            setAlreadyPresent(true);
            setStatusLoaded(true);
            setMsg(
              r.alreadyPresent
                ? "A tua presença já estava registada."
                : "Presença registada com sucesso.",
            );
          }}
        />
      )}
    </>
  );
}
