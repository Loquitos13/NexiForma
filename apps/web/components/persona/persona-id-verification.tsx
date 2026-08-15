"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { notifyDocumentosObrigatoriosUpdated } from "@/components/portal/documentos-obrigatorios-gate";
import { parseApiError } from "@/lib/ui/backoffice";
import { Button } from "@/components/ui/button";

type PersonaClient = {
  open: () => void;
};

declare global {
  interface Window {
    Persona?: {
      Client: new (opts: Record<string, unknown>) => PersonaClient;
    };
  }
}

export function usePersonaEnabled() {
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void bffFetch("/api/v1/persona/config", { headers: { accept: "application/json" } })
      .then(async (r) => {
        if (!r.ok) {
          setEnabled(false);
          return;
        }
        const data = (await r.json()) as { enabled?: boolean };
        setEnabled(Boolean(data.enabled));
      })
      .catch(() => setEnabled(false))
      .finally(() => setReady(true));
  }, []);

  return { enabled, ready };
}

type Props = {
  roleKind: "formando" | "formador";
  idCompleto?: boolean;
  onSynced?: () => void | Promise<void>;
  /** Estado partilhado do hook `usePersonaEnabled` na página (evita pedidos duplicados). */
  enabled: boolean;
  ready: boolean;
};

function loadPersonaScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if (window.Persona?.Client) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-persona-sdk="1"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Persona SDK")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.withpersona.com/dist/persona-v4.11.0.js";
    script.async = true;
    script.dataset.personaSdk = "1";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Falha a carregar Persona."));
    document.head.appendChild(script);
  });
}

/** Verificação de identidade via Persona; descarrega imagens para o dossiê ao concluir. */
export function PersonaIdVerification({ roleKind, idCompleto, onSynced, enabled, ready }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const start = useCallback(async () => {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      await loadPersonaScript();
      const res = await bffFetch("/api/v1/persona/inquiries", {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: "{}",
      });
      if (!res.ok) {
        setError(await parseApiError(res));
        return;
      }
      const data = (await res.json()) as {
        inquiryId?: string;
        sessionToken?: string | null;
      };
      if (!data.inquiryId || !window.Persona?.Client) {
        setError("Não foi possível iniciar a verificação Persona.");
        return;
      }

      await new Promise<void>((resolve, reject) => {
        const client = new window.Persona!.Client({
          inquiryId: data.inquiryId,
          sessionToken: data.sessionToken ?? undefined,
          onReady: () => client.open(),
          onComplete: async ({ inquiryId }: { inquiryId: string; status: string }) => {
            try {
              const syncRes = await bffFetch(
                `/api/v1/persona/inquiries/${encodeURIComponent(inquiryId)}/sync`,
                {
                  method: "POST",
                  headers: {
                    accept: "application/json",
                    "content-type": "application/json",
                  },
                  body: "{}",
                },
              );
              if (!syncRes.ok) {
                setError(await parseApiError(syncRes));
                reject(new Error("sync failed"));
                return;
              }
              const sync = (await syncRes.json()) as { synced?: boolean; reason?: string };
              if (sync.synced) {
                setMsg("Identidade verificada. Cópia do documento guardada no dossiê.");
                notifyDocumentosObrigatoriosUpdated();
                await onSynced?.();
                resolve();
              } else {
                setError(
                  sync.reason === "not_passed"
                    ? "Verificação não aprovada. Tente novamente."
                    : sync.reason === "no_files"
                      ? "Verificação concluída mas as imagens do documento ainda não estão disponíveis. Aguarde um momento e tente sincronizar novamente."
                      : "Verificação concluída mas o documento não foi sincronizado.",
                );
                reject(new Error("not synced"));
              }
            } catch (err) {
              reject(err instanceof Error ? err : new Error("sync error"));
            }
          },
          onCancel: () => {
            setMsg("Verificação cancelada.");
            resolve();
          },
          onError: (err: { message?: string }) => {
            setError(err.message ?? "Erro na verificação Persona.");
            reject(new Error(err.message ?? "persona error"));
          },
        });
      });
    } catch (e) {
      if (!error) {
        setError(e instanceof Error ? e.message : "Erro ao iniciar verificação.");
      }
    } finally {
      setBusy(false);
    }
  }, [error, onSynced]);

  if (!ready || !enabled) return null;

  if (idCompleto) {
    return (
      <p className="text-xs text-teal-400 flex items-center gap-1.5">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Documento de identificação verificado (Persona)
      </p>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-sky-500/30 bg-sky-950/25 px-3 py-3">
      <p className="text-xs text-sky-100/90 leading-relaxed">
        Use a câmara para verificar o seu documento de identificação. A NexiForma guarda a cópia
        no dossiê após aprovação.
      </p>
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
      {msg ? <p className="text-xs text-teal-400">{msg}</p> : null}
      <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => void start()}>
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <ShieldCheck className="h-3.5 w-3.5" />
        )}
        Verificar identidade
      </Button>
    </div>
  );
}
