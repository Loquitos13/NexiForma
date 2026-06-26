"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { setAccessToken } from "@/lib/client/access-token";

type MePayload = Record<string, unknown>;

export function BffSessionPanel() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meJson, setMeJson] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setBusy(true);
    setError(null);
    setMeJson(null);
    try {
      const res = await bffFetch("/api/auth/me", {
        method: "GET",
        headers: { accept: "application/json" },
      });

      const text = await res.text();
      if (!res.ok) {
        setError(text.trim() ? text.slice(0, 260) : `HTTP ${res.status}`);
        return;
      }

      try {
        const parsed = JSON.parse(text) as MePayload;
        setMeJson(JSON.stringify(parsed, null, 2));
      } catch {
        setMeJson(text.slice(0, 500));
      }
    } catch {
      setError("Falha de rede ao chamar /api/auth/me.");
    } finally {
      setBusy(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await bffFetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        authRetry401: false,
      });

      setAccessToken(null);
      setMeJson(null);

      if (!res.ok && res.status !== 204) {
        const t = await res.text().catch(() => "");
        setError(t.trim() ? t.slice(0, 200) : `Logout HTTP ${res.status}`);
      }
    } catch {
      setAccessToken(null);
      setMeJson(null);
      setError("Falha de rede no logout.");
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <section
      style={{
        marginTop: "2rem",
        padding: "1.25rem 1.35rem",
        borderRadius: 12,
        background: "rgba(15,23,42,0.75)",
        border: "1px solid rgba(56,189,248,0.35)",
      }}
      aria-labelledby="bff-session-heading"
    >
      <h2 id="bff-session-heading" style={{ margin: "0 0 0.75rem", fontSize: "1.05rem" }}>
        Sessão (BFF + refresh automático em 401)
      </h2>
      <p style={{ margin: "0 0 1rem", color: "#94a3b8", fontSize: "0.9rem" }}>
        Após login, carrega «Perfil»: usa <code>bffFetch</code> contra{" "}
        <code>/api/auth/me</code>. Se o access JWT expirar, um <code>POST /api/auth/refresh</code>{" "}
        (cookie HttpOnly) corre uma vez antes de repetir o pedido.
      </p>
      <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        <button
          type="button"
          disabled={busy}
          onClick={loadProfile}
          style={{
            padding: "0.5rem 0.95rem",
            borderRadius: 8,
            border: "none",
            background: busy ? "#475569" : "#0ea5e9",
            color: "#fff",
            fontWeight: 600,
            cursor: busy ? "not-allowed" : "pointer",
          }}
        >
          {busy ? "A comunicar…" : "Carregar perfil (/me)"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={logout}
          style={{
            padding: "0.5rem 0.95rem",
            borderRadius: 8,
            border: "1px solid rgba(248,113,113,0.6)",
            background: "transparent",
            color: "#fca5a5",
            fontWeight: 600,
            cursor: busy ? "not-allowed" : "pointer",
          }}
        >
          Logout (BFF)
        </button>
        <Link
          href="/login"
          style={{ alignSelf: "center", color: "#93c5fd", fontSize: "0.92rem", fontWeight: 600 }}
        >
          Login tenant
        </Link>
      </div>
      {error ? (
        <p role="alert" style={{ color: "#fca5a5", fontSize: "0.88rem", margin: "0 0 0.75rem" }}>
          {error}
        </p>
      ) : null}
      {meJson ? (
        <pre
          style={{
            margin: 0,
            overflow: "auto",
            fontSize: "0.8rem",
            lineHeight: 1.35,
            color: "#e2e8f0",
            maxHeight: 220,
          }}
        >
          {meJson}
        </pre>
      ) : (
        !error && (
          <p style={{ margin: 0, color: "#64748b", fontSize: "0.875rem" }}>
            Nenhum perfil carregado. Se não iniciaste sessão, vai a «Login tenant» primeiro.
          </p>
        )
      )}
    </section>
  );
}
