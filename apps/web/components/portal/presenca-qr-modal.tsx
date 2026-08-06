"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, QrCode, RefreshCw, Users } from "lucide-react";
import { labelOrigemPresenca, origemPresencaBadgeVariant } from "@nexiforma/shared";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { bffFetch } from "@/lib/client/bff-fetch";
import { parseApiError } from "@/lib/ui/backoffice";
import { cn } from "@/lib/ui/cn";

const QR_TTL_FALLBACK_MS = 60_000;
const FOLHA_POLL_MS = 2_000;

type SessaoInfo = {
  numeroSessao: number;
  data?: string;
  horaInicio?: string;
  horaFim?: string;
  titulo?: string | null;
};

type PresencaLinha = {
  id: string;
  presente: boolean;
  estado: string | null;
  origem: string | null;
  matricula: { formando: { nome: string; nif: string } };
};

type FolhaDetalhe = {
  id: string;
  presencas: PresencaLinha[];
};

type QrPayload = {
  token: string;
  checkinPath: string;
  expiresAt?: string;
  ttlSeconds?: number;
  ttlMs?: number;
};

type Props = {
  open: boolean;
  sessaoId: string | null;
  folhaId: string | null;
  sessao: SessaoInfo | null;
  onClose: () => void;
  onFolhaUpdated?: (folha: FolhaDetalhe) => void;
};

function formatCountdown(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function isPresente(p: PresencaLinha): boolean {
  return p.presente || p.estado === "PRESENTE";
}

function resolveExpiresMs(data: QrPayload): number {
  const fromIso = data.expiresAt ? Date.parse(data.expiresAt) : NaN;
  if (Number.isFinite(fromIso) && fromIso > Date.now()) return fromIso;
  const ttlSec =
    typeof data.ttlSeconds === "number" && data.ttlSeconds > 0
      ? data.ttlSeconds
      : typeof data.ttlMs === "number" && data.ttlMs > 0
        ? Math.ceil(data.ttlMs / 1000)
        : QR_TTL_FALLBACK_MS / 1000;
  return Date.now() + ttlSec * 1000;
}

export function PresencaQrModal({
  open,
  sessaoId,
  folhaId,
  sessao,
  onClose,
  onFolhaUpdated,
}: Props) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [checkinUrl, setCheckinUrl] = useState<string | null>(null);
  const [expiresAtIso, setExpiresAtIso] = useState<string | null>(null);
  const [remainingSec, setRemainingSec] = useState<number | null>(null);
  const [folha, setFolha] = useState<FolhaDetalhe | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const qrInflightRef = useRef(false);
  const hasQrRef = useRef(false);
  const openRef = useRef(open);
  const onFolhaUpdatedRef = useRef(onFolhaUpdated);
  const sessaoIdRef = useRef(sessaoId);
  const folhaIdRef = useRef(folhaId);

  openRef.current = open;
  onFolhaUpdatedRef.current = onFolhaUpdated;
  sessaoIdRef.current = sessaoId;
  folhaIdRef.current = folhaId;

  const clearQrTimers = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const scheduleQrRefresh = useCallback(
    (expiresMs: number, reload: () => void) => {
      clearQrTimers();
      const updateRemaining = () => {
        const left = Math.max(0, Math.ceil((expiresMs - Date.now()) / 1000));
        setRemainingSec(left);
      };
      updateRemaining();
      tickRef.current = setInterval(updateRemaining, 1000);

      const delay = Math.max(8_000, expiresMs - Date.now() - 2_000);
      if (!Number.isFinite(delay)) return;
      refreshTimerRef.current = setTimeout(() => {
        if (openRef.current) reload();
      }, delay);
    },
    [clearQrTimers],
  );

  const loadQr = useCallback(async (opts?: { force?: boolean }) => {
    const id = sessaoIdRef.current;
    if (!id || !openRef.current) return;
    if (opts?.force) {
      qrInflightRef.current = false;
    } else if (qrInflightRef.current) {
      return;
    }
    qrInflightRef.current = true;
    setQrLoading(true);
    try {
      const origin = window.location.origin;
      const qs = opts?.force ? "?force=1" : "";
      const res = await bffFetch(`/api/v1/sessoes-formacao/${id}/presenca-qr${qs}`, {
        headers: { accept: "application/json" },
      });
      if (!openRef.current) return;

      if (res.status === 429) {
        setErr("Demasiados pedidos. O QR actual mantém-se; nova tentativa em breve.");
        // Mantém o QR actual; tenta outra vez dentro de 20s.
        clearQrTimers();
        refreshTimerRef.current = setTimeout(() => {
          if (openRef.current) void loadQr();
        }, 20_000);
        setRemainingSec(20);
        return;
      }

      if (!res.ok) {
        setErr(await parseApiError(res));
        if (!hasQrRef.current) {
          setQrDataUrl(null);
          setCheckinUrl(null);
        }
        clearQrTimers();
        refreshTimerRef.current = setTimeout(() => {
          if (openRef.current) void loadQr();
        }, 15_000);
        return;
      }

      const data = (await res.json()) as QrPayload;
      if (!data.checkinPath && !data.token) {
        setErr("Resposta inválida ao gerar o QR.");
        return;
      }
      const path = data.checkinPath || `/presenca/${data.token}`;
      const absolute = `${origin}${path}`;
      const { default: QRCode } = await import("qrcode");
      const url = await QRCode.toDataURL(absolute, {
        width: 360,
        margin: 2,
        errorCorrectionLevel: "M",
      });
      if (!openRef.current) return;

      const expiresMs = resolveExpiresMs(data);
      hasQrRef.current = true;
      setQrDataUrl(url);
      setCheckinUrl(absolute);
      setExpiresAtIso(new Date(expiresMs).toISOString());
      setErr(null);
      scheduleQrRefresh(expiresMs, () => {
        void loadQr();
      });
    } catch {
      if (openRef.current) {
        setErr("Não foi possível gerar o código QR.");
      }
    } finally {
      qrInflightRef.current = false;
      setQrLoading(false);
    }
  }, [clearQrTimers, scheduleQrRefresh]);

  const loadFolha = useCallback(async () => {
    const id = folhaIdRef.current;
    if (!id || !openRef.current) return;
    try {
      const res = await bffFetch(`/api/v1/folhas-presenca/${id}`, {
        headers: { accept: "application/json" },
        // Evita toast/cooldown agressivo em polling silencioso.
        authRetry401: true,
      });
      if (!res.ok || res.status === 429) return;
      const data = (await res.json()) as FolhaDetalhe;
      if (!openRef.current) return;
      setFolha(data);
      onFolhaUpdatedRef.current?.(data);
    } catch {
      /* polling silencioso */
    }
  }, []);

  useEffect(() => {
    if (!open) {
      clearQrTimers();
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      qrInflightRef.current = false;
      return;
    }

    setErr(null);
    hasQrRef.current = false;
    setQrDataUrl(null);
    setCheckinUrl(null);
    setRemainingSec(null);
    void loadQr();
    void loadFolha();
    pollRef.current = setInterval(() => {
      void loadFolha();
    }, FOLHA_POLL_MS);

    return () => {
      clearQrTimers();
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
    // Intencional: só reage a open / ids, não a callbacks do pai.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadQr/loadFolha estáveis via refs
  }, [open, sessaoId, folhaId, clearQrTimers]);

  const presentes = useMemo(
    () => (folha?.presencas ?? []).filter(isPresente),
    [folha],
  );
  const pendentes = useMemo(
    () => (folha?.presencas ?? []).filter((p) => !isPresente(p)),
    [folha],
  );
  const total = folha?.presencas.length ?? 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        title="QR de presença"
        description={
          sessao
            ? `${sessao.titulo?.trim() || `Sessão ${sessao.numeroSessao}`}${
                sessao.horaInicio ? ` · ${sessao.horaInicio}–${sessao.horaFim}` : ""
              }`
            : "O código renova automaticamente."
        }
        className="max-w-4xl"
      >
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 text-teal-300 text-sm font-medium">
              <QrCode className="h-4 w-4" />
              Código para os formandos
            </div>

            {err ? (
              <div className="rounded-xl border border-amber-500/35 bg-amber-950/30 px-3 py-3 space-y-2 text-left">
                <p className="text-sm text-amber-100">{err}</p>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={qrLoading}
                  onClick={() => void loadQr({ force: true })}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Tentar novamente
                </Button>
              </div>
            ) : null}

            {qrLoading && !qrDataUrl ? (
              <p className="text-sm text-slate-500">A gerar código QR…</p>
            ) : null}

            {qrDataUrl ? (
              <div className="rounded-xl bg-white p-4 flex flex-col items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrDataUrl} alt="QR de presença" className="w-full max-w-[320px]" />
                <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-slate-600">
                  {remainingSec != null && Number.isFinite(remainingSec) ? (
                    <span
                      className={cn(
                        "tabular-nums font-semibold",
                        remainingSec <= 8 ? "text-amber-600" : "text-slate-800",
                      )}
                    >
                      Renova em {formatCountdown(remainingSec)}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-teal-700 hover:underline disabled:opacity-50"
                    disabled={qrLoading}
                    onClick={() => void loadQr({ force: true })}
                  >
                    <RefreshCw className={cn("h-3.5 w-3.5", qrLoading && "animate-spin")} />
                    Renovar
                  </button>
                </div>
                {expiresAtIso ? (
                  <p className="text-[10px] text-slate-400">
                    Válido até {new Date(expiresAtIso).toLocaleTimeString("pt-PT")} · ciclo 60s
                  </p>
                ) : null}
              </div>
            ) : null}

            {checkinUrl ? (
              <p className="text-[10px] text-slate-500 break-all font-mono leading-snug">
                {checkinUrl}
              </p>
            ) : null}
          </div>

          <div className="space-y-3 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex items-center gap-2 text-sm font-medium text-slate-200">
                <Users className="h-4 w-4 text-teal-300" />
                Presenças em tempo real
              </div>
              {total > 0 ? (
                <Badge variant="teal">
                  {presentes.length}/{total}
                </Badge>
              ) : null}
            </div>

            {!folhaId ? (
              <p className="text-sm text-slate-500">
                A carregar inscritos da turma…
              </p>
            ) : total === 0 ? (
              <p className="text-sm text-slate-500">
                Esta turma ainda não tem formandos inscritos na folha.
              </p>
            ) : (
              <div className="space-y-3 max-h-[min(55vh,480px)] overflow-y-auto pr-1">
                <section className="space-y-1.5">
                  <p className="text-[11px] uppercase tracking-wide text-teal-400/90">
                    Já confirmaram ({presentes.length})
                  </p>
                  {presentes.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">
                      À espera do primeiro check-in por QR…
                    </p>
                  ) : (
                    <ul className="space-y-1">
                      {presentes.map((p) => (
                        <li
                          key={p.id}
                          className="flex items-center gap-2 rounded-lg border border-teal-500/20 bg-teal-950/25 px-2.5 py-1.5 text-sm"
                        >
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-teal-400" />
                          <span className="min-w-0 truncate text-slate-100">
                            {p.matricula.formando.nome}
                          </span>
                          <Badge variant={origemPresencaBadgeVariant(p.origem)} className="ml-auto shrink-0">
                            {labelOrigemPresenca(p.origem, { online: true })}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="space-y-1.5">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">
                    Por confirmar ({pendentes.length})
                  </p>
                  <ul className="space-y-1">
                    {pendentes.map((p) => (
                      <li
                        key={p.id}
                        className="rounded-lg border border-slate-700/40 bg-slate-950/40 px-2.5 py-1.5 text-sm text-slate-400 truncate"
                      >
                        {p.matricula.formando.nome}
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
