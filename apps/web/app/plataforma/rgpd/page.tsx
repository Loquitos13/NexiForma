"use client";

import { ConsentAdminPanel } from "@/components/consent/consent-admin-panel";
import { PageShell } from "@/components/portal/page-shell";

export default function PlataformaRgpdPage() {
  return (
    <PageShell
      title="Consentimentos RGPD"
      subtitle="Consulta das decisões de privacidade registadas pelos utilizadores em todos os tenants."
    >
      <div className="rounded-xl border border-purple-500/15 bg-purple-500/5 p-4">
        <ConsentAdminPanel mode="platform" />
      </div>
    </PageShell>
  );
}
