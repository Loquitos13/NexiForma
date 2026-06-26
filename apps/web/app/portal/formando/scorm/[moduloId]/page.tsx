"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { bffFetch } from "@/lib/client/bff-fetch";
import { bo, parseApiError } from "@/lib/ui/backoffice";

type LaunchCtx = {
  moduloId: string;
  matriculaId: string;
  titulo: string;
  scormVersion: string;
  launchUrl: string;
  requiresAssetSession?: boolean;
  cmi: Record<string, string>;
  percentual: number;
};

/** API SCORM 1.2 mínima – proxy para o backend NexiForma. */
function createScormApi(
  ctx: LaunchCtx,
  store: Record<string, string>,
  onCommit: (cmi: Record<string, string>) => Promise<void>,
) {
  let initialized = false;
  return {
    LMSInitialize: () => {
      initialized = true;
      return "true";
    },
    LMSFinish: () => {
      initialized = false;
      void onCommit({ ...store });
      return "true";
    },
    LMSGetValue: (key: string) => (initialized ? (store[key] ?? "") : ""),
    LMSSetValue: (key: string, value: string) => {
      if (!initialized) return "false";
      store[key] = value;
      return "true";
    },
    LMSCommit: () => {
      void onCommit({ ...store });
      return "true";
    },
    LMSGetLastError: () => "0",
    LMSGetErrorString: () => "No error",
    LMSGetDiagnostic: () => "",
  };
}

export default function ScormPlayerPage() {
  const params = useParams();
  const search = useSearchParams();
  const moduloId = params.moduloId as string;
  const matriculaId = search.get("matriculaId") ?? "";
  const [ctx, setCtx] = useState<LaunchCtx | null>(null);
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const storeRef = useRef<Record<string, string>>({});
  const apiMounted = useRef(false);

  const commit = useCallback(
    async (cmi: Record<string, string>) => {
      const r = await bffFetch(
        `/api/v1/conteudos-lms/scorm/${moduloId}/cmi?matriculaId=${encodeURIComponent(matriculaId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", accept: "application/json" },
          body: JSON.stringify({ cmi }),
        },
      );
      if (!r.ok) {
        setError(await parseApiError(r));
        return;
      }
      setMsg("Progresso SCORM guardado.");
    },
    [matriculaId, moduloId],
  );

  useEffect(() => {
    if (!matriculaId) {
      setError("matriculaId em falta na URL.");
      return;
    }
    void bffFetch(
      `/api/v1/conteudos-lms/scorm/${moduloId}/launch?matriculaId=${encodeURIComponent(matriculaId)}`,
      { headers: { accept: "application/json" } },
    ).then(async (r) => {
      if (!r.ok) {
        setError(await parseApiError(r));
        return;
      }
      const data = (await r.json()) as LaunchCtx;
      storeRef.current = { ...data.cmi };
      setCtx(data);
      if (data.requiresAssetSession) {
        const sess = await bffFetch(
          `/api/v1/conteudos-lms/scorm/${moduloId}/asset-session?matriculaId=${encodeURIComponent(matriculaId)}`,
          { method: "POST", credentials: "include" },
        );
        if (!sess.ok) {
          setError(await parseApiError(sess));
          return;
        }
      }
      setIframeSrc(data.launchUrl);
    });
  }, [matriculaId, moduloId]);

  useEffect(() => {
    if (!ctx || apiMounted.current) return;
    const api = createScormApi(ctx, storeRef.current, commit);
    (window as unknown as { API?: typeof api }).API = api;
    apiMounted.current = true;
    return () => {
      delete (window as unknown as { API?: typeof api }).API;
      apiMounted.current = false;
    };
  }, [ctx, commit]);

  return (
    <main style={{ ...bo.main, maxWidth: 960, display: "flex", flexDirection: "column", minHeight: "80vh" }}>
      <p style={{ marginBottom: "0.5rem" }}>
        <Link href="/portal/formando" style={{ color: "#93c5fd", fontSize: "0.88rem" }}>
          ← Portal formando
        </Link>
      </p>
      <h1 style={bo.h1}>{ctx?.titulo ?? "SCORM"}</h1>
      {error ? <p style={bo.alert}>{error}</p> : null}
      {msg ? <p style={bo.ok}>{msg}</p> : null}
      {iframeSrc ? (
        <iframe
          title={ctx?.titulo ?? "SCORM"}
          src={iframeSrc}
          style={{
            flex: 1,
            minHeight: 420,
            width: "100%",
            border: "1px solid rgba(148,163,184,0.25)",
            borderRadius: 12,
            background: "#fff",
          }}
        />
      ) : (
        !error && <p style={{ color: "#64748b" }}>A carregar player SCORM…</p>
      )}
    </main>
  );
}
