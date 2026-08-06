"use client";

import { useTenantRole } from "@/lib/client/use-tenant-role";
import { ConsentAdminPanel } from "@/components/consent/consent-admin-panel";
import { MyRgpdSettings } from "@/components/consent/my-rgpd-settings";
import { PageShell } from "@/components/portal/page-shell";
import { bo } from "@/lib/ui/backoffice";

export default function RgpdPage() {
  const { canManage } = useTenantRole();

  return (
    <PageShell
      title="Privacidade / RGPD"
      subtitle="Política de privacidade, consentimento e download dos teus dados pessoais."
    >
      <div style={{ ...bo.card, marginBottom: "1rem" }}>
        <MyRgpdSettings />
      </div>

      {canManage ? (
        <div style={{ ...bo.card, marginBottom: "1rem" }}>
          <h2 style={bo.h2}>Registo de consentimentos</h2>
          <p style={{ fontSize: "0.875rem", color: "#94a3b8", marginBottom: "1rem" }}>
            Consulta as decisões RGPD registadas pelos utilizadores do teu tenant (somente leitura).
            A exportação de dados é pessoal - cada utilizador descarrega apenas os seus.
          </p>
          <ConsentAdminPanel mode="tenant" />
        </div>
      ) : null}
    </PageShell>
  );
}
