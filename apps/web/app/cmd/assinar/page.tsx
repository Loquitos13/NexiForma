"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function CmdAssinarContent() {
  const sp = useSearchParams();
  const processId = sp.get("processId") ?? "";
  const sumarioId = sp.get("sumarioId") ?? "";

  if (!processId || !sumarioId) {
    return (
      <p style={{ color: "#dc2626" }}>
        Link inválido - inicia a assinatura CMD a partir do portal (dossiê / sumários).
      </p>
    );
  }

  return (
    <div style={{ display: "grid", gap: "0.75rem", maxWidth: 480 }}>
      <p style={{ color: "#64748b", fontSize: "0.88rem", margin: 0 }}>
        A assinatura qualificada é concluída via Autenticação.gov.pt (Chave Móvel Digital). Após
        autenticação OAuth, o sumário fica imutável automaticamente.
      </p>
      <p style={{ color: "#64748b", fontSize: "0.85rem", margin: 0 }}>
        Processo: <code>{processId.slice(0, 12)}…</code>
      </p>
      <Link href="/portal/dossie" style={{ color: "#2563eb" }}>
        Voltar ao dossiê →
      </Link>
    </div>
  );
}

export default function CmdAssinarPage() {
  return (
    <main
      style={{
        maxWidth: 520,
        margin: "2rem auto",
        padding: "0 1.25rem",
        fontFamily: "system-ui, sans-serif",
        color: "#0f172a",
      }}
    >
      <p style={{ marginBottom: "0.5rem" }}>
        <Link href="/" style={{ color: "#2563eb", textDecoration: "none" }}>
          NexiForma
        </Link>
      </p>
      <h1 style={{ fontSize: "1.45rem", marginBottom: "0.25rem" }}>Assinatura CMD</h1>
      <p style={{ color: "#64748b", fontSize: "0.92rem", marginBottom: "1.25rem" }}>
        Chave Móvel Digital - assinatura qualificada de sumário pedagógico.
      </p>
      <Suspense fallback={<p style={{ color: "#64748b" }}>A carregar…</p>}>
        <CmdAssinarContent />
      </Suspense>
    </main>
  );
}
