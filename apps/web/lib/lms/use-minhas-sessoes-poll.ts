"use client";

import { useCallback, useEffect, useRef } from "react";
import { bffFetch } from "@/lib/client/bff-fetch";

const DEFAULT_POLL_MS = 2_000;

type Options = {
  /** Intervalo entre refreshes (ms). */
  pollMs?: number;
  /** Se false, não faz poll (ex.: página em background). Default: true. */
  enabled?: boolean;
};

/**
 * Mantém a lista de sessões do formando actualizada (início/fim de sessão)
 * sem precisar de refresh manual da página.
 */
export function useMinhasSessoesPoll(
  onData: (blocks: unknown) => void,
  opts: Options = {},
) {
  const { pollMs = DEFAULT_POLL_MS, enabled = true } = opts;
  const onDataRef = useRef(onData);
  onDataRef.current = onData;
  const inflightRef = useRef(false);

  const refresh = useCallback(async () => {
    if (inflightRef.current) return;
    inflightRef.current = true;
    try {
      const r = await bffFetch("/api/v1/lms/minhas-sessoes", {
        headers: { accept: "application/json" },
        authRetry401: true,
      });
      if (!r.ok || r.status === 429) return;
      onDataRef.current(await r.json());
    } catch {
      /* silencioso */
    } finally {
      inflightRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    const id = setInterval(() => void refresh(), pollMs);

    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [enabled, pollMs, refresh]);

  return { refresh };
}
