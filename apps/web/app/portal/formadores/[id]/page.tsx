"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { bffFetch } from "@/lib/client/bff-fetch";
import { formatDatePt } from "@/lib/calendar-date";
import { parseApiError } from "@/lib/ui/backoffice";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { Alert, PageHeader } from "@/components/ui";
import { DocumentPreviewModal } from "@/components/ui/document-preview-modal";
import { PortalBackButton } from "@/components/ui/portal-back-button";
import { PageContentSkeleton } from "@/components/ui/page-skeleton";
import { FormadorFichaDados } from "@/components/portal/formador-ficha-dados";
import { FormadorDocumentosGestor } from "@/components/portal/formador-documentos-gestor";

type Documento = {
  id: string;
  nome: string;
  categoria: string | null;
  mimeType: string;
  tamanhoBytes: number;
  visivelFormador?: boolean;
  createdAt: string;
};

type Requisicao = {
  id: string;
  titulo: string;
  descricao: string | null;
  estado: string;
  createdAt: string;
  submetidoEm: string | null;
  documentoAnexo?: { id: string; nome: string } | null;
};

type Ficha = {
  id: string;
  nomeCompleto: string;
  nif: string;
  email: string;
  emailPresenca: string | null;
  telefone: string | null;
  morada: string | null;
  ccNumero: string | null;
  ccpNumero: string | null;
  ccValidade: string | null;
  ccpValidade: string | null;
  documentos: Documento[];
  requisicoes: Requisicao[];
  _count?: { sessoesFormacao: number };
};

export default function FormadorFichaPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { canManageFormacao: canManage } = useTenantRole();
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState("");

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      setError(null);
      const res = await bffFetch(`/api/v1/formadores/${id}`, {
        headers: { accept: "application/json" },
      });
      if (!res.ok) {
        setError(await parseApiError(res));
        setFicha(null);
        if (!opts?.silent) setLoading(false);
        return;
      }
      setFicha((await res.json()) as Ficha);
      if (!opts?.silent) setLoading(false);
    },
    [id],
  );

  useEffect(() => {
    if (id) void load();
  }, [id, load]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function verDocumento(doc: Documento) {
    setError(null);
    const r = await bffFetch(`/api/v1/documentos/${doc.id}/download`);
    if (!r.ok) {
      setError(await parseApiError(r));
      return;
    }
    const blob = await r.blob();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(blob));
    setPreviewTitle(doc.nome);
  }

  if (loading) return <PageContentSkeleton variant="detail" />;

  if (!ficha) {
    return (
      <>
        <PortalBackButton fallbackHref="/portal/formadores" fallbackLabel="Formadores" />
        <Alert variant="error">{error ?? "Formador não encontrado."}</Alert>
      </>
    );
  }

  return (
    <>
      <PortalBackButton fallbackHref="/portal/formadores" fallbackLabel="Formadores" />
      {error ? (
        <Alert variant="error" className="mb-4">
          {error}
        </Alert>
      ) : null}

      <PageHeader
        title={ficha.nomeCompleto}
        description={`NIF ${ficha.nif} · ${ficha.email}${ficha.telefone ? ` · ${ficha.telefone}` : ""}`}
      />

      <FormadorFichaDados
        ficha={{
          id: ficha.id,
          nomeCompleto: ficha.nomeCompleto,
          nif: ficha.nif,
          email: ficha.email,
          emailPresenca: ficha.emailPresenca,
          telefone: ficha.telefone,
          morada: ficha.morada,
          ccNumero: ficha.ccNumero,
          ccpNumero: ficha.ccpNumero,
          ccValidade: ficha.ccValidade,
          ccpValidade: ficha.ccpValidade,
        }}
        canManage={canManage}
        onSaved={() => load({ silent: true })}
      />

      <FormadorDocumentosGestor
        formadorId={ficha.id}
        documentos={ficha.documentos}
        requisicoes={ficha.requisicoes ?? []}
        canManage={canManage}
        onPreview={(doc) => void verDocumento(doc)}
        onRefresh={() => load({ silent: true })}
      />

      <DocumentPreviewModal
        open={!!previewUrl}
        title={previewTitle}
        url={previewUrl}
        onClose={() => {
          if (previewUrl) URL.revokeObjectURL(previewUrl);
          setPreviewUrl(null);
        }}
      />
    </>
  );
}
