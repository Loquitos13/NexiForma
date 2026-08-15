"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { notifyDocumentosObrigatoriosUpdated } from "@/components/portal/documentos-obrigatorios-gate";
import { parseApiError } from "@/lib/ui/backoffice";
import { Button } from "@/components/ui/button";

type PersonaClient = {
  open: () => void;
};

type SyncResult = { synced?: boolean; reason?: string };

type LatestInquiry = {
  personaInquiryId: string;
  status: string;
  personaStatus: string | null;
  syncedAt: string | null;
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
  const [environmentId, setEnvironmentId] = useState<string | null>(null);

  useEffect(() => {
    void bffFetch("/api/v1/persona/config", { headers: { accept: "application/json" } })
      .then(async (r) => {
        if (!r.ok) {
          setEnabled(false);
          setEnvironmentId(null);
          return;
        }
        const data = (await r.json()) as { enabled?: boolean; environmentId?: string | null };
        setEnabled(Boolean(data.enabled));
        setEnvironmentId(data.environmentId?.trim() || null);
      })
      .catch(() => {
        setEnabled(false);
        setEnvironmentId(null);
      })
      .finally(() => setReady(true));
  }, []);

  return { enabled, ready, environmentId };
}

type Props = {
  roleKind: "formando" | "formador";
  idCompleto?: boolean;
  onSynced?: () => void | Promise<void>;
  /** Estado partilhado do hook `usePersonaEnabled` na página (evita pedidos duplicados). */
  enabled: boolean;
  ready: boolean;
  environmentId?: string | null;
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

function syncErrorMessage(reason?: string): string {
  if (reason === "not_passed") {
    return "Verificação ainda não aprovada na Persona. Conclua o fluxo antes de gerar o PDF.";
  }
  if (reason === "no_files") {
    return "Não foi possível obter as imagens na Persona. Aguarde um momento e tente gerar o PDF novamente.";
  }
  if (reason === "pdf_failed") {
    return "As imagens foram obtidas mas falhou a geração do PDF. Tente novamente.";
  }
  return "Não foi possível gerar o PDF do documento.";
}

function inquiryLooksCompleted(inquiry: LatestInquiry): boolean {
  const persona = (inquiry.personaStatus ?? "").toLowerCase();
  const status = inquiry.status.toLowerCase();
  return (
    status === "completed" ||
    persona === "approved" ||
    persona === "completed" ||
    persona === "passed" ||
    persona === "needs_review" ||
    persona === "marked-for-review"
  );
}

function canShowResync(inquiry: LatestInquiry | null, idCompleto?: boolean): boolean {
  if (!inquiry?.personaInquiryId || idCompleto) return false;
  if (inquiry.status === "failed") return false;
  return inquiryLooksCompleted(inquiry) || !inquiry.syncedAt;
}

async function postSync(
  inquiryId: string,
  force = false,
): Promise<{ ok: true; sync: SyncResult } | { ok: false; error: string }> {
  const syncRes = await bffFetch(
    `/api/v1/persona/inquiries/${encodeURIComponent(inquiryId)}/sync`,
    {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify(force ? { force: true } : {}),
    },
  );
  if (!syncRes.ok) {
    return { ok: false, error: await parseApiError(syncRes) };
  }
  return { ok: true, sync: (await syncRes.json()) as SyncResult };
}

/** Verificação de identidade via Persona; descarrega imagens para o dossiê ao concluir. */
export function PersonaIdVerification({
  roleKind,
  idCompleto,
  onSynced,
  enabled,
  ready,
  environmentId,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [latestInquiry, setLatestInquiry] = useState<LatestInquiry | null>(null);

  const refreshLatestInquiry = useCallback(async () => {
    if (!enabled || idCompleto) {
      setLatestInquiry(null);
      return;
    }
    try {
      const res = await bffFetch("/api/v1/persona/inquiries/me", {
        headers: { accept: "application/json" },
      });
      if (!res.ok) {
        setLatestInquiry(null);
        return;
      }
      const data = (await res.json()) as LatestInquiry | null;
      setLatestInquiry(data?.personaInquiryId ? data : null);
    } catch {
      setLatestInquiry(null);
    }
  }, [enabled, idCompleto]);

  useEffect(() => {
    if (!ready || !enabled) return;
    void refreshLatestInquiry();
  }, [ready, enabled, idCompleto, refreshLatestInquiry]);

  const handleSyncSuccess = useCallback(
    async (regenerated = false) => {
      setMsg(
        regenerated
          ? "PDF do documento gerado novamente e anexado ao dossiê."
          : "PDF do documento gerado e anexado ao dossiê.",
      );
      setError(null);
      notifyDocumentosObrigatoriosUpdated();
      await onSynced?.();
      await refreshLatestInquiry();
    },
    [onSynced, refreshLatestInquiry],
  );

  const runSync = useCallback(
    async (inquiryId: string, force = false) => {
      const result = await postSync(inquiryId, force);
      if (!result.ok) {
        setError(result.error);
        return false;
      }
      if (result.sync.synced) {
        await handleSyncSuccess(force);
        return true;
      }
      setError(syncErrorMessage(result.sync.reason));
      await refreshLatestInquiry();
      return false;
    },
    [handleSyncSuccess, refreshLatestInquiry],
  );

  const resync = useCallback(async () => {
    if (!latestInquiry?.personaInquiryId) return;
    setSyncing(true);
    setError(null);
    setMsg("A gerar PDF a partir das imagens Persona…");
    try {
      await runSync(latestInquiry.personaInquiryId, true);
    } finally {
      setSyncing(false);
    }
  }, [latestInquiry, runSync]);

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

      setLatestInquiry({
        personaInquiryId: data.inquiryId,
        status: "created",
        personaStatus: "created",
        syncedAt: null,
      });

      await new Promise<void>((resolve, reject) => {
        const clientOpts: Record<string, unknown> = {
          inquiryId: data.inquiryId,
          sessionToken: data.sessionToken ?? undefined,
          frameWidth: "min(768px, 100vw)",
          frameHeight: "min(720px, 90vh)",
          onReady: () => client.open(),
          onComplete: async ({ inquiryId }: { inquiryId: string; status: string }) => {
            try {
              const ok = await runSync(inquiryId);
              if (ok) resolve();
              else reject(new Error("not synced"));
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
        };
        if (environmentId) {
          clientOpts.environmentId = environmentId;
        }
        const client = new window.Persona!.Client(clientOpts);
      });
    } catch (e) {
      if (!(e instanceof Error && e.message === "not synced")) {
        setError(e instanceof Error ? e.message : "Erro ao iniciar verificação.");
      }
    } finally {
      setBusy(false);
      await refreshLatestInquiry();
    }
  }, [environmentId, refreshLatestInquiry, runSync]);

  if (!ready || !enabled) return null;

  if (idCompleto) {
    return (
      <p className="text-xs text-teal-400 flex items-center gap-1.5">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Documento de identificação verificado (Persona)
      </p>
    );
  }

  const showResync = canShowResync(latestInquiry, idCompleto);

  return (
    <div className="space-y-2 rounded-xl border border-sky-500/30 bg-sky-950/25 px-3 py-3">
      <p className="text-xs text-sky-100/90 leading-relaxed">
        Use a câmara para verificar o seu documento de identificação. A NexiForma gera um PDF com
        as imagens capturadas e anexa-o ao dossiê após aprovação.
      </p>
      {showResync ? (
        <p className="text-xs text-sky-200/70 leading-relaxed">
          Já concluiu a verificação na Persona? Gere o PDF a partir das imagens capturadas e
          anexe-o ao dossiê.
        </p>
      ) : null}
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
      {msg ? <p className="text-xs text-teal-400">{msg}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="secondary" disabled={busy || syncing} onClick={() => void start()}>
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ShieldCheck className="h-3.5 w-3.5" />
          )}
          Verificar identidade
        </Button>
        {showResync ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy || syncing}
            onClick={() => void resync()}
          >
            {syncing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Sincronizar e gerar PDF
          </Button>
        ) : null}
      </div>
    </div>
  );
}
