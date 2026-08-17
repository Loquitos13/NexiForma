"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, FileDown, Loader2 } from "lucide-react";
import type { DocumentLogoPlacement, ModuleLogoAsset } from "@nexiforma/shared";
import { bffFetch } from "@/lib/client/bff-fetch";
import { downloadResponseAsFile } from "@/lib/client/download-response";
import { parseApiError } from "@/lib/ui/backoffice";
import { Button } from "@/components/ui";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { RichTemplateEditor } from "@/components/settings/rich-template-editor";
import { TemplateLogoPresets } from "@/components/settings/template-logo-presets";

type PreviewPayload = {
  html: string;
  bodyHtml: string;
  label: string;
  logoPlacements: DocumentLogoPlacement[];
  moduleLogos: ModuleLogoAsset[];
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
  const [busy, setBusy] = useState(false);
  const [bodyHtml, setBodyHtml] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const [logoPlacements, setLogoPlacements] = useState<DocumentLogoPlacement[]>([]);
  const [moduleLogos, setModuleLogos] = useState<ModuleLogoAsset[]>([]);
  const [anexar, setAnexar] = useState(true);

  const refreshPreview = useCallback(async () => {
    setLoading(true);
    const r = await bffFetch(
      `/api/v1/matriculas/${encodeURIComponent(matriculaId)}/documentos/${encodeURIComponent(templateId)}/preview`,
      {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ bodyHtml, logoPlacements }),
      },
    );
    setLoading(false);
    if (!r.ok) {
      onError?.(await parseApiError(r));
      return null;
    }
    const data = (await r.json()) as PreviewPayload;
    setPreviewHtml(data.html);
    setModuleLogos(data.moduleLogos ?? []);
    if (!bodyHtml && data.bodyHtml) setBodyHtml(data.bodyHtml);
    if (!logoPlacements.length && data.logoPlacements?.length) {
      setLogoPlacements(data.logoPlacements);
    }
    return data;
  }, [matriculaId, templateId, bodyHtml, logoPlacements, onError]);

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
    })();
  }, [open, matriculaId, templateId, onError, onOpenChange]);

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
      <DialogContent title={`Emitir: ${templateLabel}`} className="max-w-5xl max-h-[90vh] overflow-y-auto">
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
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              Revise o texto com os dados do formando já aplicados. A formatação (negrito, fontes,
              tamanhos) mantém-se no PDF final.
            </p>
            <RichTemplateEditor value={bodyHtml} onChange={setBodyHtml} formato="html" />
          </div>
        ) : null}

        {!loading && step === 1 ? (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              Posicione os logótipos (entidade, DGERT, etc.). Use marca d&apos;água para fundo
              sem comprometer a legibilidade do texto.
            </p>
            <TemplateLogoPresets
              modulo="formacao"
              logos={moduleLogos}
              placements={logoPlacements}
              onChange={setLogoPlacements}
              previewHtml={bodyHtml}
            />
          </div>
        ) : null}

        {!loading && step === 2 ? (
          <div className="space-y-3">
            <section className="overflow-hidden rounded-xl border border-slate-700/50 bg-white">
              <iframe
                title="Pré-visualização final"
                srcDoc={previewHtml}
                className="block w-full min-h-[480px] border-0 bg-white"
                sandbox=""
                referrerPolicy="no-referrer"
              />
            </section>
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
