"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { parseApiError } from "@/lib/ui/backoffice";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import {
  Alert,
  Badge,
  PageHeader,
} from "@/components/ui";
import { DocumentPreviewModal } from "@/components/ui/document-preview-modal";
import { PortalBackButton } from "@/components/ui/portal-back-button";
import { PageContentSkeleton } from "@/components/ui/page-skeleton";
import { FormandoFichaDados } from "@/components/portal/formando-ficha-dados";
import { FormandoFichaInscricoes, type FormandoInscricao } from "@/components/portal/formando-ficha-inscricoes";
import { FormandoDocumentosGestor } from "@/components/portal/formando-documentos-gestor";
import {
  DgertRequisitoBanner,
  useDgertRequisitoId,
} from "@/components/portal/dgert-requisito-banner";

type Documento = {
  id: string;
  nome: string;
  categoria: string | null;
  mimeType: string;
  tamanhoBytes: number;
  visivelFormando?: boolean;
  createdAt: string;
  acaoFormacao?: { codigoInterno: string; titulo: string } | null;
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
  nome: string;
  nif: string;
  email: string | null;
  emailPresenca: string | null;
  telefone: string | null;
  morada: string | null;
  entidadeCliente: { id: string; nome: string; nif: string } | null;
  sigo: {
    tipoDocIdentificacao?: string;
    numDocIdentificacao?: string;
    dataNascimento?: string;
    nacionalidade?: string;
    habilitacaoLiteraria?: string;
  };
  sigoPronto: boolean;
  documentos: Documento[];
  requisicoes: Requisicao[];
  inscricoes: FormandoInscricao[];
};

export default function FormandoFichaPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { canManageFormacao: canManage } = useTenantRole();
  const dgertRequisito = useDgertRequisitoId();
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState("");

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setError(null);
    const fichaRes = await bffFetch(`/api/v1/formandos/${id}`, {
      headers: { accept: "application/json" },
    });
    if (!fichaRes.ok) {
      setError(await parseApiError(fichaRes));
      setFicha(null);
      if (!opts?.silent) setLoading(false);
      return;
    }
    setFicha((await fichaRes.json()) as Ficha);
    if (!opts?.silent) setLoading(false);
  }, [id]);

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
        <PortalBackButton fallbackHref="/portal/formandos" fallbackLabel="Formandos" />
        <Alert variant="error">{error ?? "Formando não encontrado."}</Alert>
      </>
    );
  }

  return (
    <>
      <PortalBackButton fallbackHref="/portal/formandos" fallbackLabel="Formandos" />
      {error ? (
        <Alert variant="error" className="mb-4">
          {error}
        </Alert>
      ) : null}

      <PageHeader
        title={ficha.nome}
        description={`Contribuinte ${ficha.nif}${ficha.email ? ` · ${ficha.email}` : ""}`}
        actions={
          <Badge variant={ficha.sigoPronto ? "green" : "yellow"}>
            SIGO {ficha.sigoPronto ? "completo" : "incompleto"}
          </Badge>
        }
      />

      <DgertRequisitoBanner backHref="/portal/dossie" />

      <FormandoFichaDados
        ficha={{
          id: ficha.id,
          nome: ficha.nome,
          nif: ficha.nif,
          email: ficha.email,
          emailPresenca: ficha.emailPresenca,
          telefone: ficha.telefone,
          morada: ficha.morada,
          entidadeCliente: ficha.entidadeCliente,
          sigo: ficha.sigo ?? {},
          sigoPronto: ficha.sigoPronto,
        }}
        canManage={canManage}
        focusRequisito={dgertRequisito}
        onSaved={() => load({ silent: true })}
      />

      <FormandoFichaInscricoes
        formandoId={ficha.id}
        inscricoes={ficha.inscricoes}
        canManage={canManage}
        onChanged={() => load({ silent: true })}
      />

      <FormandoDocumentosGestor
        formandoId={ficha.id}
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
