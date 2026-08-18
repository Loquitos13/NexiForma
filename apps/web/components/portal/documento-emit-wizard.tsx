"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, FileDown, Loader2 } from "lucide-react";
import type {
  DocumentLogoPlacement,
  DocumentOrientacao,
  DocumentVerticalAlign,
  ModuleLogoAsset,
} from "@nexiforma/shared";
import { bffFetch } from "@/lib/client/bff-fetch";
import { downloadResponseAsFile } from "@/lib/client/download-response";
import { parseApiError } from "@/lib/ui/backoffice";
import { Button } from "@/components/ui";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DocumentPagePreview } from "@/components/settings/document-page-preview";
import {
  RichTemplateEditor,
  type RichTemplateEditorHandle,
} from "@/components/settings/rich-template-editor";
import { TemplateLogoPresets } from "@/components/settings/template-logo-presets";

type PreviewPayload = {
  html: string;
  bodyHtml: string;
  label: string;
  logoPlacements: DocumentLogoPlacement[];
  moduleLogos: ModuleLogoAsset[];
  orientacao?: DocumentOrientacao;
  alinhamentoVertical?: DocumentVerticalAlign;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matriculaId: string;
  templateId: string;
  templateLabel: string;
  onSuccess?: (msg: string) => void;
  onError?: (msg: string) => void;
};

export function DocumentoEmitWizard({
  open,
  onOpenChange,
  matriculaId,
  templateId,
  templateLabel,
  onSuccess,
  onError,
}: Props) {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [bodyHtml, setBodyHtml] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const [logoPlacements, setLogoPlacements] = useState<DocumentLogoPlacement[]>([]);
  const [moduleLogos, setModuleLogos] = useState<ModuleLogoAsset[]>([]);
  const [orientacao, setOrientacao] = useState<DocumentOrientacao>("portrait");
  const [alinhamentoVertical, setAlinhamentoVertical] = useState<DocumentVerticalAlign>("top");
  const [anexar, setAnexar] = useState(true);
  const editorRef = useRef<RichTemplateEditorHandle>(null);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshPreview = useCallback(async () => {
    setPreviewLoading(true);
    const r = await bffFetch(
      `/api/v1/matriculas/${encodeURIComponent(matriculaId)}/documentos/${encodeURIComponent(templateId)}/preview`,
      {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          bodyHtml,
          logoPlacements,
          orientacao,
          alinhamentoVertical,
        }),
      },
    );
    setPreviewLoading(false);
    if (!r.ok) {
      onError?.(await parseApiError(r));
      return null;
    }
    const data = (await r.json()) as PreviewPayload;
    setPreviewHtml(data.html);
    setModuleLogos(data.moduleLogos ?? []);
    if (data.orientacao) setOrientacao(data.orientacao);
    if (data.alinhamentoVertical) setAlinhamentoVertical(data.alinhamentoVertical);
    if (!bodyHtml && data.bodyHtml) setBodyHtml(data.bodyHtml);
    if (!logoPlacements.length && data.logoPlacements?.length) {
      setLogoPlacements(data.logoPlacements);
    }
    return data;
  }, [matriculaId, templateId, bodyHtml, logoPlacements, orientacao, alinhamentoVertical, onError]);

  useEffect(() => {
    if (!open) {
      setStep(0);
      setBodyHtml("");
      setPreviewHtml("");
      setLogoPlacements([]);
      return;
    }
    void (async () => {
      setLoading(true);
      const r = await bffFetch(
        `/api/v1/matriculas/${encodeURIComponent(matriculaId)}/documentos/${encodeURIComponent(templateId)}/preview`,
        { headers: { accept: "application/json" } },
      );
      setLoading(false);
      if (!r.ok) {
        onError?.(await parseApiError(r));
        onOpenChange(false);
        return;
      }
      const data = (await r.json()) as PreviewPayload;
      setBodyHtml(data.bodyHtml);
      setPreviewHtml(data.html);
      setLogoPlacements(data.logoPlacements ?? []);
      setModuleLogos(data.moduleLogos ?? []);
      if (data.orientacao) setOrientacao(data.orientacao);
      if (data.alinhamentoVertical) setAlinhamentoVertical(data.alinhamentoVertical);
    })();
  }, [open, matriculaId, templateId, onError, onOpenChange]);

  useEffect(() => {
    if (!open || loading) return;
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    previewTimerRef.current = setTimeout(() => {
      void refreshPreview();
    }, 400);
    return () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    };
  }, [open, loading, bodyHtml, logoPlacements, orientacao, alinhamentoVertical, refreshPreview]);

  async function nextStep() {
    if (step === 0 || step === 1) {
      const ok = await refreshPreview();
      if (!ok) return;
    }
    setStep((s) => Math.min(2, s + 1));
  }

  async function emitir() {
    setBusy(true);
    const r = await bffFetch(
      `/api/v1/matriculas/${encodeURIComponent(matriculaId)}/documentos/${encodeURIComponent(templateId)}/pdf`,
      {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/pdf" },
        body: JSON.stringify({
          bodyHtml,
          logoPlacements,
          anexar,
          download: true,
          orientacao,
          alinhamentoVertical,
        }),
      },
    );
    setBusy(false);
    if (!r.ok) {
      onError?.(await parseApiError(r));
      return;
    }
    await downloadResponseAsFile(r, `${templateId}.pdf`);
    onSuccess?.(
      anexar
        ? `«${templateLabel}» emitido, descarregado e anexado à ficha do formando.`
        : `«${templateLabel}» descarregado.`,
    );
    onOpenChange(false);
  }

  const steps = ["Texto do documento", "Logótipos", "Confirmar"];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={`Emitir: ${templateLabel}`} className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <div className="mb-4 flex flex-wrap gap-2">
          {steps.map((label, i) => (
            <span
              key={label}
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${
                i === step
                  ? "bg-blue-950/50 text-blue-200"
                  : i < step
                    ? "bg-emerald-950/40 text-emerald-300"
                    : "bg-slate-800 text-slate-500"
              }`}
            >
              {i + 1}. {label}
            </span>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-12 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            A preparar documento…
          </div>
        ) : null}

        {!loading && step === 0 ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,420px)]">
            <div className="space-y-3 min-w-0">
              <p className="text-xs text-slate-500">
                Revise o texto com os dados do formando já aplicados. A formatação mantém-se no PDF
                final.
              </p>
              <RichTemplateEditor
                ref={editorRef}
                value={bodyHtml}
                onChange={setBodyHtml}
                formato="html"
                pageLayout="a4"
                orientacao={orientacao}
                verticalAlign={alinhamentoVertical}
                onVerticalAlignChange={setAlinhamentoVertical}
              />
            </div>
            <div className="space-y-2">
              {previewLoading ? (
                <p className="flex items-center gap-2 text-xs text-slate-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  A actualizar pré-visualização…
                </p>
              ) : null}
              <DocumentPagePreview
                srcDoc={previewHtml}
                orientacao={orientacao}
                title={templateLabel}
                maxWidth={420}
                lazy
              />
            </div>
          </div>
        ) : null}

        {!loading && step === 1 ? (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              Posicione os logótipos (entidade, DGERT, etc.). Use marca d&apos;água para fundo sem
              comprometer a legibilidade do texto.
            </p>
            <TemplateLogoPresets
              modulo="formacao"
              logos={moduleLogos}
              placements={logoPlacements}
              onChange={setLogoPlacements}
              previewHtml={bodyHtml}
              orientacao={orientacao}
              verticalAlign={alinhamentoVertical}
            />
          </div>
        ) : null}

        {!loading && step === 2 ? (
          <div className="space-y-3">
            <DocumentPagePreview
              srcDoc={previewHtml}
              orientacao={orientacao}
              title={templateLabel}
              maxWidth={640}
              lazy
            />
            <label className="flex items-center gap-2 text-xs text-slate-400">
              <input
                type="checkbox"
                checked={anexar}
                onChange={(e) => setAnexar(e.target.checked)}
              />
              Anexar à ficha do formando (disponível na secção Documentos)
            </label>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap justify-between gap-2 border-t border-slate-800 pt-4">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={step === 0 || busy}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Anterior
          </Button>
          {step < 2 ? (
            <Button type="button" size="sm" disabled={loading || busy} onClick={() => void nextStep()}>
              Seguinte
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button type="button" size="sm" disabled={busy || !previewHtml} onClick={() => void emitir()}>
              <FileDown className="h-3.5 w-3.5" />
              {busy ? "A emitir…" : "Confirmar e emitir PDF"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
