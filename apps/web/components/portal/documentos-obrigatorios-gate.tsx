"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, FileWarning, Loader2, Upload } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { getAccessToken } from "@/lib/client/access-token";
import { decodeJwtPayload, decodeJwtRole, isFormandoRole } from "@/lib/client/jwt-role";
import { parseApiError } from "@/lib/ui/backoffice";
import { Button } from "@/components/ui/button";
import type { DocObrigatorioResumo } from "@/lib/formando/documentos-obrigatorios";
import type { FormadorDocObrigatorioResumo } from "@/lib/formador/documentos-obrigatorios";

const EVENT_NAME = "documentos-obrigatorios-updated";

export function notifyDocumentosObrigatoriosUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  }
}

type GateItem = {
  id: string;
  label: string;
  completo: boolean;
  detalhe: string;
};

/**
 * Alerta bloqueante (sem timer) quando faltam documentos universais / do cargo.
 * Formador: universais compatíveis + cópia do CCP.
 * Formando: universais da política do tenant.
 */
export function DocumentosObrigatoriosGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [required, setRequired] = useState(false);
  const [items, setItems] = useState<GateItem[]>([]);
  const [roleKind, setRoleKind] = useState<"formador" | "formando" | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const check = useCallback(async () => {
    const token = getAccessToken();
    const payload = decodeJwtPayload(token);
    const role = decodeJwtRole(token);

    if (!role || role === "super_admin" || payload?.impersonating) {
      setRequired(false);
      setRoleKind(null);
      setReady(true);
      return;
    }

    if (role === "formador") {
      const r = await bffFetch("/api/v1/formadores/me/documentos/obrigatorios", {
        headers: { accept: "application/json" },
      });
      if (!r.ok) {
        setRequired(false);
        setRoleKind("formador");
        setReady(true);
        return;
      }
      const data = (await r.json()) as FormadorDocObrigatorioResumo;
      setItems(data.items);
      setRequired(!data.completo);
      setRoleKind("formador");
      setReady(true);
      return;
    }

    if (isFormandoRole(role)) {
      const r = await bffFetch("/api/v1/formando-portal/documentos/obrigatorios", {
        headers: { accept: "application/json" },
      });
      if (!r.ok) {
        setRequired(false);
        setRoleKind("formando");
        setReady(true);
        return;
      }
      const data = (await r.json()) as DocObrigatorioResumo;
      setItems(data.items);
      setRequired(!data.completo);
      setRoleKind("formando");
      setReady(true);
      return;
    }

    setRequired(false);
    setRoleKind(null);
    setReady(true);
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  useEffect(() => {
    const onUpdated = () => void check();
    window.addEventListener(EVENT_NAME, onUpdated);
    return () => window.removeEventListener(EVENT_NAME, onUpdated);
  }, [check]);

  async function uploadFormador(categoria: string, file: File) {
    setUploadingId(categoria);
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    const r = await bffFetch(
      `/api/v1/formadores/me/documentos?categoria=${encodeURIComponent(categoria)}`,
      { method: "POST", body: fd },
    );
    if (!r.ok) {
      setError(await parseApiError(r));
      setUploadingId(null);
      return;
    }
    setUploadingId(null);
    notifyDocumentosObrigatoriosUpdated();
    await check();
  }

  async function uploadFormando(categoria: string, file: File) {
    setUploadingId(categoria);
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    const r = await bffFetch(
      `/api/v1/formando-portal/documentos?categoria=${encodeURIComponent(categoria)}&lado=unico`,
      { method: "POST", body: fd },
    );
    if (!r.ok) {
      setError(await parseApiError(r));
      setUploadingId(null);
      return;
    }
    setUploadingId(null);
    notifyDocumentosObrigatoriosUpdated();
    await check();
  }

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500">
        A verificar documentos…
      </div>
    );
  }

  const emFalta = items.filter((i) => !i.completo);

  return (
    <>
      {required && roleKind ? (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="docs-obrigatorios-title"
          aria-describedby="docs-obrigatorios-desc"
        >
          <div className="flex w-full max-w-lg max-h-[min(90dvh,720px)] flex-col overflow-hidden rounded-2xl border border-amber-500/40 bg-slate-900 shadow-2xl">
            <div className="shrink-0 border-b border-slate-700/50 px-6 py-5">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-lg bg-amber-500/15 p-2 text-amber-300">
                  <FileWarning className="h-5 w-5" aria-hidden />
                </div>
                <div className="min-w-0">
                  <h2
                    id="docs-obrigatorios-title"
                    className="text-base font-semibold text-slate-100"
                  >
                    Documentos obrigatórios em falta
                  </h2>
                  <p id="docs-obrigatorios-desc" className="mt-1 text-sm text-slate-400">
                    {roleKind === "formador"
                      ? "Antes de usar o portal, envie o Cartão de Cidadão, CCP, certificados das formações, currículo e a ficha DGERT assinada."
                      : "Antes de usar o portal, envie os documentos universais obrigatórios da entidade formadora (inclui CC, habilitações e comprovativo de IBAN)."}
                  </p>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-4">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-700/50 bg-slate-950/50 px-3 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-100">{item.label}</p>
                    <p className="text-xs text-slate-500">{item.detalhe}</p>
                  </div>
                  {item.completo ? (
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-green-400">
                      <Check className="h-4 w-4" aria-hidden />
                      OK
                    </span>
                  ) : (
                    <>
                      <input
                        ref={(el) => {
                          fileRefs.current[item.id] = el;
                        }}
                        type="file"
                        accept="application/pdf,image/jpeg,image/png"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          e.target.value = "";
                          if (!f) return;
                          if (roleKind === "formador") void uploadFormador(item.id, f);
                          else void uploadFormando(item.id, f);
                        }}
                      />
                      <Button
                        size="sm"
                        disabled={uploadingId === item.id}
                        onClick={() => fileRefs.current[item.id]?.click()}
                      >
                        {uploadingId === item.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Upload className="h-3.5 w-3.5" />
                        )}
                        Enviar
                      </Button>
                    </>
                  )}
                </div>
              ))}
              {error ? <p className="text-sm text-red-400">{error}</p> : null}
            </div>

            <div className="shrink-0 border-t border-slate-700/50 px-6 py-3 text-xs text-slate-500">
              {emFalta.length === 1
                ? "Falta 1 documento para continuar."
                : `Faltam ${emFalta.length} documentos para continuar.`}
            </div>
          </div>
        </div>
      ) : null}
      {children}
    </>
  );
}
