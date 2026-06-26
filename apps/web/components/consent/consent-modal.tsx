"use client";

import { useCallback, useEffect, useState } from "react";
import { Shield } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { parseApiError } from "@/lib/ui/backoffice";
import { Button } from "@/components/ui/button";

type ConsentState = {
  exempt?: boolean;
  required: boolean;
  consentText: string;
  tenantLegalName: string | null;
  userAccepted: boolean | null;
};

type Props = {
  /** Modal bloqueante no primeiro acesso */
  blocking?: boolean;
  /** Fechar após guardar (modo definições) */
  onClose?: () => void;
  /** Actualizar estado do portal após decisão */
  onResolved?: () => void;
  open?: boolean;
};

export function ConsentModal({ blocking = false, onClose, onResolved, open = true }: Props) {
  const [data, setData] = useState<ConsentState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await bffFetch("/api/v1/consent/me", { headers: { accept: "application/json" } });
    if (!r.ok) return;
    setData((await r.json()) as ConsentState);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(accepted: boolean) {
    setBusy(true);
    setError(null);
    const r = await bffFetch("/api/v1/consent/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ accepted }),
    });
    if (!r.ok) {
      setError(await parseApiError(r));
      setBusy(false);
      return;
    }
    await load();
    setBusy(false);
    onClose?.();
    onResolved?.();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("consent-updated"));
    }
  }

  if (!open || !data || data.exempt) return null;
  if (blocking && !data.required) return null;
  if (!blocking && !data.required && data.userAccepted !== null && !onClose) return null;

  const visible = blocking ? data.required : open;

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 ${
        blocking && data.required ? "bg-black/70 backdrop-blur-sm" : "bg-black/50"
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-title"
    >
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-700/50 bg-slate-950 shadow-2xl">
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/20 text-blue-400 shrink-0">
              <Shield className="h-5 w-5" />
            </span>
            <div>
              <h2 id="consent-title" className="text-lg font-semibold text-slate-100">
                Tratamento de dados pessoais (RGPD)
              </h2>
              {data.tenantLegalName ? (
                <p className="text-xs text-slate-500 mt-1">
                  Entidade formadora: <span className="text-slate-300">{data.tenantLegalName}</span>
                </p>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border border-slate-700/40 bg-slate-900/60 p-4 text-sm text-slate-300 leading-relaxed whitespace-pre-line max-h-64 overflow-y-auto">
            {data.consentText}
          </div>

          {data.userAccepted !== null && !data.required ? (
            <p className="text-xs text-slate-500">
              Decisão actual:{" "}
              <strong className={data.userAccepted ? "text-teal-400" : "text-amber-400"}>
                {data.userAccepted ? "Aceite" : "Recusado"}
              </strong>
            </p>
          ) : null}

          {error ? (
            <p className="text-sm text-red-400 bg-red-950/30 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          ) : null}

          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <Button
              type="button"
              className="flex-1"
              disabled={busy}
              onClick={() => void decide(true)}
            >
              Aceito o tratamento descrito
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              disabled={busy}
              onClick={() => void decide(false)}
            >
              Não aceito
            </Button>
          </div>

          {!blocking && onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="w-full text-center text-xs text-slate-500 hover:text-slate-300 pt-2"
            >
              Fechar
            </button>
          ) : null}

          <p className="text-[11px] text-slate-600 leading-relaxed">
            A decisão de aceitar ou recusar é exclusivamente tua. Podes alterá-la em qualquer momento
            em Privacidade / RGPD no portal.
          </p>
        </div>
      </div>
    </div>
  );
}
