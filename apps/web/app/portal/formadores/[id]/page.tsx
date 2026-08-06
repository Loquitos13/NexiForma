"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { FileText, Upload } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { formatDatePt } from "@/lib/calendar-date";
import { parseApiError } from "@/lib/ui/backoffice";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PageHeader,
} from "@/components/ui";
import { DocumentPreviewModal } from "@/components/ui/document-preview-modal";
import { PortalBackButton } from "@/components/ui/portal-back-button";
import { PageContentSkeleton } from "@/components/ui/page-skeleton";
import { FormadorFichaDados } from "@/components/portal/formador-ficha-dados";
import { AVISO_NOME_DOCUMENTO_OUTROS } from "@/lib/documentos/nome-ficheiro-aviso";

type Documento = {
  id: string;
  nome: string;
  categoria: string | null;
  mimeType: string;
  tamanhoBytes: number;
  createdAt: string;
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
  _count?: { sessoesFormacao: number };
};

const DOC_CATEGORIAS = [
  { value: "documento_identificacao", label: "Cartão de Cidadão" },
  { value: "ccp", label: "CCP" },
  { value: "cv", label: "Curriculum Vitae" },
  { value: "certificados_formacao", label: "Certificados das formações" },
  { value: "ficha_dgert", label: "Ficha DGERT preenchida e assinada" },
  { value: "carta_conducao", label: "Carta de condução" },
  { value: "outros", label: "Outros documentos" },
];

export default function FormadorFichaPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { canManageFormacao: canManage } = useTenantRole();
  const fileRef = useRef<HTMLInputElement>(null);
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState("");
  const [categoria, setCategoria] = useState("cv");
  const [uploading, setUploading] = useState(false);

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

  async function onUpload(file: File) {
    if (!canManage || !ficha) return;
    setUploading(true);
    setError(null);
    setMsg(null);
    const fd = new FormData();
    fd.append("file", file);
    const r = await bffFetch(
      `/api/v1/documentos/upload?formadorId=${encodeURIComponent(ficha.id)}&categoria=${encodeURIComponent(categoria)}`,
      { method: "POST", body: fd },
    );
    setUploading(false);
    if (!r.ok) {
      setError(await parseApiError(r));
      return;
    }
    setMsg("Documento enviado.");
    await load({ silent: true });
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
      {msg ? (
        <Alert variant="success" className="mb-4">
          {msg}
        </Alert>
      ) : null}

      <PageHeader
        title={ficha.nomeCompleto}
        description={`Contribuinte ${ficha.nif} · ${ficha.email}`}
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

      <Card>
        <CardHeader className="border-b border-slate-700/40 flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-amber-400" />
            Documentos ({ficha.documentos.length})
          </CardTitle>
          {canManage ? (
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="h-9 rounded-lg border border-slate-600 bg-slate-900 px-2 text-sm text-slate-200"
              >
                {DOC_CATEGORIAS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void onUpload(f);
                }}
              />
              <Button size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                <Upload className="h-3.5 w-3.5" />
                {uploading ? "A enviar…" : "Enviar"}
              </Button>
            </div>
          ) : null}
        </CardHeader>
        <CardContent className="pt-4 space-y-3">
          {categoria === "outros" ? (
            <Alert variant="warning">{AVISO_NOME_DOCUMENTO_OUTROS}</Alert>
          ) : null}
          {ficha.documentos.length === 0 ? (
            <p className="text-sm text-slate-500">Ainda sem documentos associados.</p>
          ) : (
            <ul className="space-y-2">
              {ficha.documentos.map((d) => (
                <li
                  key={d.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-700/30 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-slate-100 truncate">{d.nome}</p>
                    <p className="text-[11px] text-slate-500">
                      {formatDatePt(d.createdAt)}
                      {d.categoria ? ` · ${d.categoria}` : ""}
                    </p>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => void verDocumento(d)}>
                    Ver
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

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
