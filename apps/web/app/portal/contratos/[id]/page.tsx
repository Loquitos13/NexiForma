"use client";

import { Suspense, use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FileText, Save } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { downloadResponseAsFile } from "@/lib/client/download-response";
import { openHtmlForPrint } from "@/lib/client/open-html-for-print";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { parseApiError } from "@/lib/ui/backoffice";
import { fmtDate, fmtEuro } from "@/lib/crm/shared";
import { Alert, Button, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { PortalBackButton } from "@/components/ui/portal-back-button";
import { DocumentPagePreview } from "@/components/settings/document-page-preview";
import {
  RichTemplateEditor,
  type RichTemplateEditorHandle,
} from "@/components/settings/rich-template-editor";
import type { DocumentOrientacao, DocumentVerticalAlign } from "@nexiforma/shared";

type Contrato = {
  id: string;
  codigo: string;
  titulo: string;
  estado: string;
  valorCentavos: number;
  dataInicio: string | null;
  dataFim: string | null;
  bodyHtml: string | null;
  templateId: string | null;
  notasInternas: string | null;
  entidadeCliente: { id: string; nome: string; nif: string; email: string | null };
  proposta?: { id: string; codigo: string } | null;
};

function ContratoEditorInner({ contratoId }: { contratoId: string }) {
  const router = useRouter();
  const { canManageCrm, writeDisabled } = useTenantRole();
  const [contrato, setContrato] = useState<Contrato | null>(null);
  const [titulo, setTitulo] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [valorEuros, setValorEuros] = useState("");
  const [estado, setEstado] = useState("RASCUNHO");
  const [notasInternas, setNotasInternas] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const [orientacao, setOrientacao] = useState<DocumentOrientacao>("portrait");
  const [alinhamentoVertical, setAlinhamentoVertical] =
    useState<DocumentVerticalAlign>("top");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const editorRef = useRef<RichTemplateEditorHandle>(null);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bodyEditedRef = useRef(false);

  const refreshPreview = useCallback(async () => {
    if (!contratoId) return;
    setPreviewLoading(true);
    const r = await bffFetch(`/api/v1/contratos/${contratoId}/preview`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(bodyEditedRef.current ? { bodyHtml } : {}),
    });
    setPreviewLoading(false);
    if (!r.ok) {
      setError(await parseApiError(r));
      return;
    }
    const data = (await r.json()) as {
      html: string;
      bodyHtml: string;
      orientacao?: DocumentOrientacao;
      alinhamentoVertical?: DocumentVerticalAlign;
    };
    setPreviewHtml(data.html);
    if (!bodyEditedRef.current && data.bodyHtml) {
      setBodyHtml(data.bodyHtml);
    }
    if (data.orientacao) setOrientacao(data.orientacao);
    if (data.alinhamentoVertical) setAlinhamentoVertical(data.alinhamentoVertical);
  }, [contratoId, bodyHtml]);

  const load = useCallback(async () => {
    if (!contratoId) return;
    setLoading(true);
    setError(null);
    bodyEditedRef.current = false;
    const r = await bffFetch(`/api/v1/contratos/${contratoId}`, {
      headers: { accept: "application/json" },
    });
    if (!r.ok) {
      setLoading(false);
      setError(await parseApiError(r));
      return;
    }
    const c = (await r.json()) as Contrato;
    setContrato(c);
    setTitulo(c.titulo);
    setDataInicio(c.dataInicio?.slice(0, 10) ?? "");
    setDataFim(c.dataFim?.slice(0, 10) ?? "");
    setValorEuros(c.valorCentavos > 0 ? (c.valorCentavos / 100).toFixed(2).replace(".", ",") : "");
    setEstado(c.estado);
    setNotasInternas(c.notasInternas ?? "");
    if (c.bodyHtml?.trim()) {
      setBodyHtml(c.bodyHtml);
      bodyEditedRef.current = true;
    }
    setLoading(false);
    void refreshPreview();
  }, [contratoId, refreshPreview]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (loading || !contrato) return;
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    previewTimerRef.current = setTimeout(() => {
      void refreshPreview();
    }, 500);
    return () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    };
  }, [loading, contrato, bodyHtml, refreshPreview]);

  async function guardar(): Promise<boolean> {
    if (!contratoId) return false;
    setBusy(true);
    setError(null);
    setMsg(null);
    const valorCentavos = Math.round(
      parseFloat(valorEuros.replace(",", ".").replace(/[^\d.]/g, "") || "0") * 100,
    );
    const res = await bffFetch(`/api/v1/contratos/${contratoId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        titulo: titulo.trim(),
        dataInicio: dataInicio || null,
        dataFim: dataFim || null,
        valorCentavos: Number.isFinite(valorCentavos) ? valorCentavos : 0,
        estado,
        notasInternas: notasInternas.trim() || null,
        bodyHtml: bodyEditedRef.current ? bodyHtml : undefined,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return false;
    }
    setMsg("Contrato guardado.");
    await load();
    return true;
  }

  async function descarregarPdf() {
    if (!contratoId) return;
    setBusy(true);
    const r = await bffFetch(`/api/v1/contratos/${contratoId}/pdf`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/pdf" },
      body: JSON.stringify(bodyEditedRef.current ? { bodyHtml } : {}),
    });
    setBusy(false);
    if (!r.ok) {
      setError(await parseApiError(r));
      return;
    }
    await downloadResponseAsFile(r, `${contrato?.codigo ?? "contrato"}.pdf`);
  }

  if (!canManageCrm) {
    return (
      <div className="max-w-3xl">
        <PageHeader title="Contrato" />
        <Alert variant="warning">Sem permissão para editar contratos.</Alert>
      </div>
    );
  }

  if (loading) {
    return <p className="text-sm text-slate-500">A carregar contrato…</p>;
  }

  if (!contrato) {
    return (
      <div className="max-w-3xl">
        <PortalBackButton fallbackHref="/portal/contratos" />
        <Alert variant="error" className="mt-4">{error ?? "Contrato não encontrado."}</Alert>
      </div>
    );
  }

  return (
    <>
      <PortalBackButton fallbackHref="/portal/contratos" />
      <PageHeader
        title={contrato.codigo}
        description={`${contrato.entidadeCliente.nome} · NIF ${contrato.entidadeCliente.nif}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => void openHtmlForPrint(`/api/v1/contratos/${contratoId}/contrato.html`)}
            >
              <FileText className="h-4 w-4" />
              Imprimir
            </Button>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => void descarregarPdf()}>
              <Download className="h-4 w-4" />
              PDF
            </Button>
            <Button size="sm" disabled={busy || writeDisabled} onClick={() => void guardar()}>
              <Save className="h-4 w-4" />
              Guardar
            </Button>
          </div>
        }
      />

      {error ? <Alert variant="error" className="mb-4">{error}</Alert> : null}
      {msg ? <Alert variant="success" className="mb-4">{msg}</Alert> : null}

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <Input label="Título" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Início"
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
            />
            <Input
              label="Fim"
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
            />
          </div>
          <Input
            label="Valor (€)"
            value={valorEuros}
            onChange={(e) => setValorEuros(e.target.value)}
            placeholder="0,00"
          />
          <Select label="Estado" value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="RASCUNHO">Rascunho</option>
            <option value="VIGENTE">Vigente</option>
            <option value="CANCELADO">Cancelado</option>
          </Select>
          <Textarea
            label="Notas internas"
            value={notasInternas}
            onChange={(e) => setNotasInternas(e.target.value)}
            rows={3}
          />
          {contrato.proposta ? (
            <p className="text-xs text-slate-500">
              Proposta associada:{" "}
              <button
                type="button"
                className="text-violet-400 underline"
                onClick={() => router.push(`/portal/propostas/${contrato.proposta!.id}`)}
              >
                {contrato.proposta.codigo}
              </button>
            </p>
          ) : null}
          {contrato.templateId ? (
            <p className="text-xs text-slate-600">Template base: {contrato.templateId}</p>
          ) : (
            <p className="text-xs text-slate-600">Documento personalizado (sem template base)</p>
          )}
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 text-sm text-slate-400">
          <p>
            <span className="text-slate-500">Cliente:</span> {contrato.entidadeCliente.nome}
          </p>
          <p className="mt-1">
            <span className="text-slate-500">Vigência:</span> {fmtDate(dataInicio || null)} -{" "}
            {fmtDate(dataFim || null)}
          </p>
          <p className="mt-1">
            <span className="text-slate-500">Valor:</span> {fmtEuro(contrato.valorCentavos)}
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="min-w-0 space-y-2">
          <h2 className="text-sm font-medium text-slate-200">Texto do contrato</h2>
          <p className="text-xs text-slate-500">
            Variáveis como {"{{cliente.nome}}"} e {"{{contrato.numero}}"} são aplicadas na
            pré-visualização.
          </p>
          <RichTemplateEditor
            ref={editorRef}
            value={bodyHtml}
            onChange={(html) => {
              bodyEditedRef.current = true;
              setBodyHtml(html);
            }}
            formato="html"
            pageLayout="a4"
            orientacao={orientacao}
            verticalAlign={alinhamentoVertical}
          />
        </div>
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-slate-200">
            Pré-visualização {previewLoading ? "…" : ""}
          </h2>
          <DocumentPagePreview
            srcDoc={previewHtml}
            orientacao={orientacao}
            title={titulo || contrato.codigo}
            maxWidth={640}
            lazy
          />
        </div>
      </div>
    </>
  );
}

export default function ContratoEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">A carregar…</p>}>
      <ContratoEditorInner contratoId={id} />
    </Suspense>
  );
}
