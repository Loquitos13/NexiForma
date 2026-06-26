"use client";

import { useCallback, useEffect, useState } from "react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { decodeJwtRole } from "@/lib/client/jwt-role";
import { getAccessToken } from "@/lib/client/access-token";
import { ConsentModal } from "./consent-modal";

/** Bloqueia o portal até o utilizador (não super_admin) registar decisão RGPD. */
export function ConsentGate({ children }: { children: React.ReactNode }) {
  const [required, setRequired] = useState(false);
  const [exempt, setExempt] = useState(false);
  const [ready, setReady] = useState(false);

  const [consentUnavailable, setConsentUnavailable] = useState(false);

  const check = useCallback(async () => {
    const role = decodeJwtRole(getAccessToken());
    if (!role || role === "super_admin") {
      setExempt(true);
      setRequired(false);
      setConsentUnavailable(false);
      setReady(true);
      return;
    }

    const r = await bffFetch("/api/v1/consent/me", { headers: { accept: "application/json" } });
    if (!r.ok) {
      setConsentUnavailable(r.status === 404);
      setRequired(false);
      setReady(true);
      return;
    }
    setConsentUnavailable(false);
    const data = (await r.json()) as { exempt?: boolean; required?: boolean };
    setExempt(!!data.exempt);
    setRequired(!!data.required && !data.exempt);
    setReady(true);
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  useEffect(() => {
    const onUpdated = () => void check();
    window.addEventListener("consent-updated", onUpdated);
    return () => window.removeEventListener("consent-updated", onUpdated);
  }, [check]);

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500">
        A verificar consentimento…
      </div>
    );
  }

  return (
    <>
      {consentUnavailable ? (
        <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-200">
          Consentimento RGPD indisponível - reinicie a API após aplicar as migrações da base de dados.
        </div>
      ) : null}
      {required && !exempt ? (
        <ConsentModal blocking open onResolved={() => void check()} />
      ) : null}
      {children}
    </>
  );
}

export function useConsentSettings() {
  const [open, setOpen] = useState(false);
  const role = decodeJwtRole(getAccessToken());
  const canUse = role && role !== "super_admin";

  return {
    canUse,
    open,
    openSettings: () => setOpen(true),
    closeSettings: () => setOpen(false),
    modal: canUse ? (
      <ConsentModal
        open={open}
        onClose={() => setOpen(false)}
        onResolved={() => setOpen(false)}
        blocking={false}
      />
    ) : null,
  };
}
