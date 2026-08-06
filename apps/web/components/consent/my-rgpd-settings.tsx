"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Shield } from "lucide-react";
import { buildRgpdConsentText, RGPD_TERMS_VERSION } from "@nexiforma/shared";
import { bffFetch } from "@/lib/client/bff-fetch";
import { useConsentSettings } from "@/components/consent/consent-gate";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { formatDatePt } from "@/lib/calendar-date";

type ConsentMe = {
  exempt?: boolean;
  required?: boolean;
  termsVersion?: string;
  consentText?: string;
  tenantLegalName?: string | null;
  userAccepted?: boolean | null;
  userDecidedAt?: string | null;
};

type ExportFormat = "json" | "csv" | "txt";

const FORMAT_OPTIONS: Array<{ id: ExportFormat; label: string; hint: string }> = [
  { id: "json", label: "JSON", hint: "Estrutura completa, ideal para arquivo técnico" },
  { id: "csv", label: "CSV", hint: "Tabela chave/valor, abre no Excel" },
  { id: "txt", label: "TXT", hint: "Texto legível (JSON formatado)" },
];

export function MyRgpdSettings() {
  const consent = useConsentSettings();
  const [data, setData] = useState<ConsentMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [format, setFormat] = useState<ExportFormat>("json");
  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await bffFetch("/api/v1/consent/me", { headers: { accept: "application/json" } });
    if (r.ok) setData((await r.json()) as ConsentMe);
    else setData(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onUpdated = () => void load();
    window.addEventListener("consent-updated", onUpdated);
    return () => window.removeEventListener("consent-updated", onUpdated);
  }, [load]);

  async function exportData() {
    setExportBusy(true);
    setExportError(null);
    try {
      const res = await bffFetch("/api/v1/rgpd/me/export", {
        method: "POST",
        headers: { "Content-Type": "application/json", accept: "*/*" },
        body: JSON.stringify({ format }),
      });
      if (!res.ok) {
        setExportError("Não foi possível gerar a exportação dos seus dados.");
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/i);
      const filename = match?.[1] ?? `rgpd-export-${Date.now()}.${format}`;
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
      setPickerOpen(false);
    } catch {
      setExportError("Não foi possível descarregar o ficheiro.");
    } finally {
      setExportBusy(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500">A carregar definições RGPD…</p>;
  }

  if (data?.exempt) {
    return (
      <p className="text-sm text-slate-400">
        Conta de administração da plataforma - isenta de consentimento RGPD de tenant.
      </p>
    );
  }

  if (!data) {
    return (
      <p className="text-sm text-amber-400/90">
        Definições RGPD indisponíveis. Verifica se a API está actualizada e as migrações aplicadas.
      </p>
    );
  }

  const decisionLabel =
    data.userAccepted === true
      ? "Aceite"
      : data.userAccepted === false
        ? "Recusado"
        : "Pendente";

  const decisionClass =
    data.userAccepted === true
      ? "text-teal-400"
      : data.userAccepted === false
        ? "text-amber-400"
        : "text-slate-400";

  const policyText = buildRgpdConsentText(data.tenantLegalName ?? "a entidade formadora");
  const termsVersion = data.termsVersion ?? RGPD_TERMS_VERSION;

  return (
    <div className="space-y-4">
      {consent.modal}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/20 text-blue-400 shrink-0">
            <Shield className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-100">Privacidade e consentimento</h2>
            {data.tenantLegalName ? (
              <p className="text-xs text-slate-500 mt-0.5">
                Entidade formadora: <span className="text-slate-300">{data.tenantLegalName}</span>
              </p>
            ) : null}
          </div>
        </div>
        {consent.canUse ? (
          <Button type="button" size="sm" variant="secondary" onClick={consent.openSettings}>
            Alterar decisão
          </Button>
        ) : null}
      </div>

      <dl className="grid gap-3 sm:grid-cols-2 text-sm">
        <div className="rounded-xl border border-slate-700/40 bg-slate-900/50 px-3 py-2.5">
          <dt className="text-[11px] uppercase tracking-wide text-slate-500">Decisão actual</dt>
          <dd className={`mt-1 font-medium ${decisionClass}`}>{decisionLabel}</dd>
        </div>
        <div className="rounded-xl border border-slate-700/40 bg-slate-900/50 px-3 py-2.5">
          <dt className="text-[11px] uppercase tracking-wide text-slate-500">Registada em</dt>
          <dd className="mt-1 text-slate-200">
            {data.userDecidedAt ? formatDatePt(data.userDecidedAt) : "-"}
          </dd>
        </div>
        <div className="rounded-xl border border-slate-700/40 bg-slate-900/50 px-3 py-2.5 sm:col-span-2">
          <dt className="text-[11px] uppercase tracking-wide text-slate-500">Versão do aviso</dt>
          <dd className="mt-1 text-slate-300 font-mono text-xs">{termsVersion}</dd>
        </div>
      </dl>

      <div>
        <h3 className="text-sm font-medium text-slate-200 mb-2">Política de privacidade (RGPD)</h3>
        <div className="rounded-xl border border-slate-700/40 bg-slate-900/60 p-4 text-sm text-slate-300 leading-relaxed whitespace-pre-line max-h-[min(60vh,36rem)] overflow-y-auto">
          {policyText}
        </div>
      </div>

      <p className="text-xs text-slate-500 leading-relaxed">
        Apenas tu decides se aceitas ou recusas o tratamento de dados. A decisão fica registada para
        efeitos de conformidade e podes alterá-la a qualquer momento.
      </p>

      <div className="pt-2 border-t border-slate-700/30 space-y-2">
        <p className="text-xs text-slate-500">
          Descarrega os teus dados pessoais (identificação, contactos e consentimento). Não inclui
          histórico operacional, pedagógico, comercial nem faturação.
        </p>
        {exportError ? <p className="text-sm text-red-400">{exportError}</p> : null}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => {
            setExportError(null);
            setPickerOpen(true);
          }}
        >
          <Download className="h-3.5 w-3.5 mr-1.5" aria-hidden />
          Download dos meus dados
        </Button>
      </div>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent
          title="Formato do ficheiro"
          description="Escolhe o formato do ficheiro com os teus dados pessoais."
          className="max-w-sm"
          onPointerDownOutside={() => undefined}
          onInteractOutside={() => undefined}
          onEscapeKeyDown={() => undefined}
        >
          <div className="space-y-3" role="radiogroup" aria-label="Formato de exportação">
            {FORMAT_OPTIONS.map((opt) => {
              const selected = format === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setFormat(opt.id)}
                  className={
                    selected
                      ? "w-full rounded-xl border border-blue-500/50 bg-blue-600/15 px-3 py-2.5 text-left"
                      : "w-full rounded-xl border border-slate-700/50 bg-slate-950/40 px-3 py-2.5 text-left hover:border-slate-600"
                  }
                >
                  <span className="block text-sm font-medium text-slate-100">{opt.label}</span>
                  <span className="mt-0.5 block text-xs text-slate-500">{opt.hint}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={exportBusy}
              onClick={() => setPickerOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="button" size="sm" disabled={exportBusy} onClick={() => void exportData()}>
              {exportBusy ? "A preparar…" : `Descarregar ${format.toUpperCase()}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
