"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function ConsentResult() {
  const params = useSearchParams();
  const adminConsent = params.get("admin_consent");
  const tenant = params.get("tenant");
  const error = params.get("error");
  const ok = adminConsent === "True";

  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: "3rem 1.35rem", color: "#e2e8f0" }}>
      <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: ok ? "#86efac" : "#fca5a5" }}>
        {ok ? "Microsoft 365 autorizado" : "Consentimento Microsoft"}
      </h1>
      {ok ? (
        <p style={{ lineHeight: 1.55, color: "#cbd5e1" }}>
          O administrador M365 autorizou a app NexiForma no tenant{" "}
          <code style={{ color: "#c4b5fd" }}>{tenant ?? "–"}</code>. Volta à plataforma, guarda este
          Tenant ID no cliente e activa OAUTH.
        </p>
      ) : (
        <p style={{ lineHeight: 1.55, color: "#cbd5e1" }}>
          {error ? `Erro: ${error}` : "Consentimento cancelado ou incompleto."}
        </p>
      )}
      <Link href="/plataforma/tenantes" style={{ color: "#c4b5fd", fontSize: "0.9rem" }}>
        ← Voltar aos tenants
      </Link>
    </main>
  );
}

export default function MicrosoftConsentPage() {
  return (
    <Suspense fallback={<main style={{ padding: "2rem", color: "#94a3b8" }}>A processar…</main>}>
      <ConsentResult />
    </Suspense>
  );
}
