"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { QrCode, RefreshCw } from "lucide-react";
import { getAccessToken, syncAccessTokenToLocalStorage } from "@/lib/client/access-token";
import { bffFetch, refreshViaBffCookies } from "@/lib/client/bff-fetch";
import { formatDatePt } from "@/lib/calendar-date";
import { parseApiError } from "@/lib/ui/backoffice";
import { Alert, Card, CardContent } from "@/components/ui";

type QrPayload = {
  token: string;
  checkinPath: string;
  expiresAt: string;
  ttlSeconds: number;
  ttlMs: number;
  sessao: {
    id: string;
    numeroSessao: number;
    data: string;
    horaInicio: string;
    horaFim: string;
    iniciadaEm: string | null;
    acao: { codigoInterno: string; titulo: string };
  };
};

function formatCountdown(totalSec: number): string {
  const s = Math.max(0, totalSec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

export default function FormadorPresencaQrPage() {
  const params = useParams();
  const sessaoId = typeof params.sessaoId === "string" ? params.sessaoId : "";
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [checkinUrl, setCheckinUrl] = useState<string | null>(null);
  const [info, setInfo] = useState<QrPayload["sessao"] | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [remainingSec, setRemainingSec] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const loadQr = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!sessaoId) return;
      const silent = !!opts?.silent;
      if (silent) setRefreshing(true);
      else {
        setLoading(true);
        setErr(null);
      }

      try {
        syncAccessTokenToLocalStorage();
        if (!getAccessToken()) {
          await refreshViaBffCookies();
        }
        const res = await bffFetch(`/api/v1/sessoes-formacao/${sessaoId}/presenca-qr`, {
          headers: { accept: "application/json" },
        });
        if (!res.ok) {
          setErr(await parseApiError(res));
          setQrDataUrl(null);
          setCheckinUrl(null);
          clearTimers();
          return;
        }
        const data = (await res.json()) as QrPayload;
        const absolute = `${window.location.origin}${data.checkinPath}`;
        const { default: QRCode } = await import("qrcode");
        const url = await QRCode.toDataURL(absolute, {
          width: 420,
          margin: 2,
          errorCorrectionLevel: "M",
        });
        setQrDataUrl(url);
        setCheckinUrl(absolute);
        setInfo(data.sessao);
        setExpiresAt(data.expiresAt);
        setErr(null);

        clearTimers();
        const expiresMs = new Date(data.expiresAt).getTime();
        const updateRemaining = () => {
          const left = Math.max(0, Math.ceil((expiresMs - Date.now()) / 1000));
          setRemainingSec(left);
        };
        updateRemaining();
        tickRef.current = setInterval(updateRemaining, 1000);

        // Renova ~10s antes de expirar (mín. 15s).
        const delay = Math.max(15_000, expiresMs - Date.now() - 10_000);
        refreshTimerRef.current = setTimeout(() => {
          void loadQr({ silent: true });
        }, delay);
      } catch {
        setErr("Não foi possível gerar o código QR.");
        clearTimers();
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [sessaoId, clearTimers],
  );

  useEffect(() => {
    void loadQr();
    return () => clearTimers();
  }, [loadQr, clearTimers]);

  return (
    <div className="min-h-[100dvh] bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-5 text-center">
        <div className="inline-flex items-center gap-2 text-teal-300 text-sm font-medium">
          <QrCode className="h-4 w-4" />
          Código QR de presença
        </div>
        {info ? (
          <div>
            <p className="text-xl font-semibold text-slate-50">
              Sessão {info.numeroSessao} · {formatDatePt(info.data)}
            </p>
            <p className="text-sm text-slate-400 mt-1">
              {info.horaInicio} – {info.horaFim}
            </p>
            <p className="text-sm text-slate-300 mt-2">
              {info.acao.codigoInterno} – {info.acao.titulo}
            </p>
          </div>
        ) : null}

        {err ? (
          <div className="rounded-xl border border-red-500/40 bg-red-950/50 px-4 py-4 text-left space-y-2">
            <p className="text-sm font-semibold text-red-200">Não foi possível mostrar o QR</p>
            <Alert variant="error">{err}</Alert>
            <p className="text-xs text-red-200/80 leading-relaxed">
              Se a sessão já terminou, o QR em directo deixa de estar disponível. Podes marcar
              presenças manualmente na folha; para voltar a mostrar o QR, inicia a sessão outra vez.
            </p>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg bg-red-800/60 px-3 py-1.5 text-xs text-red-100 hover:bg-red-700/70"
              onClick={() => void loadQr()}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Tentar novamente
            </button>
          </div>
        ) : null}

        {loading ? (
          <p className="text-sm text-slate-500">A gerar código QR…</p>
        ) : null}

        {qrDataUrl ? (
          <Card className="border-slate-700/40 bg-white">
            <CardContent className="py-6 flex flex-col items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrDataUrl}
                alt="QR de presença da sessão"
                className="w-full max-w-[420px]"
              />
              <p className="text-xs text-slate-600 max-w-sm">
                Os formandos leem este código, iniciam sessão na plataforma e registam a presença
                nesta sessão.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-slate-500">
                {remainingSec != null ? (
                  <span className="tabular-nums font-medium text-slate-700">
                    Renova em {formatCountdown(remainingSec)}
                  </span>
                ) : null}
                {refreshing ? (
                  <span className="inline-flex items-center gap-1 text-teal-700">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />A renovar…
                  </span>
                ) : (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-teal-700 hover:underline"
                    onClick={() => void loadQr({ silent: true })}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Renovar agora
                  </button>
                )}
              </div>
              {expiresAt ? (
                <p className="text-[10px] text-slate-400">
                  Válido até {new Date(expiresAt).toLocaleTimeString("pt-PT")} · ciclo de 60s
                </p>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {checkinUrl ? (
          <p className="text-[11px] text-slate-500 break-all font-mono">{checkinUrl}</p>
        ) : null}
      </div>
    </div>
  );
}
