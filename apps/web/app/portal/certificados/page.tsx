"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CertificadosPainel } from "@/components/portal/certificados-painel";
import { DgertRequisitoBanner, DgertTarget } from "@/components/portal/dgert-requisito-banner";
import { bffFetch } from "@/lib/client/bff-fetch";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { PageHeader } from "@/components/ui";

type AcaoOpt = { id: string; codigoInterno: string; titulo: string };

export default function CertificadosPage() {
  const { canManageFormacao: canManage } = useTenantRole();
  const [acoes, setAcoes] = useState<AcaoOpt[]>([]);
  const [acaoId, setAcaoId] = useState("");

  useEffect(() => {
    void bffFetch("/api/v1/acoes-formacao", { headers: { accept: "application/json" } }).then(async (r) => {
      if (!r.ok) return;
      const rows = (await r.json()) as AcaoOpt[];
      setAcoes(rows);
      const fromUrl = new URLSearchParams(window.location.search).get("acao");
      const pick = fromUrl && rows.some((a) => a.id === fromUrl) ? fromUrl : rows[0]?.id ?? "";
      if (pick) setAcaoId(pick);
    });
  }, []);

  if (!canManage) {
    return (
      <>
        <PageHeader title="Certificados" description="Acede pelo portal formando ao teu certificado quando disponível." />
        <Link href="/portal/formando" className="text-sm text-blue-400 transition-colors hover:text-blue-300">
          Portal formando →
        </Link>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Certificados"
        description="Emissão de certificados com assiduidade, progresso LMS e avaliações - imprimir ou guardar como PDF."
      />

      <DgertRequisitoBanner backHref={acaoId ? `/portal/dossie?acao=${acaoId}` : "/portal/dossie"} />

      <DgertTarget id="certificados_lista">
        <CertificadosPainel acoes={acoes} acaoId={acaoId} onAcaoChange={setAcaoId} />
      </DgertTarget>
    </>
  );
}
