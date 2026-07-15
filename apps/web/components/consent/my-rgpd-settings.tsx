"use client";

import { useCallback, useEffect, useState } from "react";
import { Shield } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { decodeJwtRole } from "@/lib/client/jwt-role";
import { getAccessToken } from "@/lib/client/access-token";
import { useConsentSettings } from "@/components/consent/consent-gate";
import { Button } from "@/components/ui/button";
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

export function MyRgpdSettings() {
  const consent = useConsentSettings();
  const role = decodeJwtRole(getAccessToken());
  const [data, setData] = useState<ConsentMe | null>(null);
  const [loading, setLoading] = useState(true);
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
    const res = await bffFetch("/api/v1/rgpd/me/export", { method: "POST" });
    setExportBusy(false);
    if (!res.ok) {
      setExportError("Não foi possível gerar a exportação dos seus dados.");
      return;
    }
    const payload = (await res.json()) as { downloadUrl?: string };
    if (payload.downloadUrl) window.open(payload.downloadUrl, "_blank", "noopener,noreferrer");
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

  return (
    <div className="space-y-4">
      {consent.modal}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/20 text-blue-400 shrink-0">
            <Shield className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-100">O meu consentimento</h2>
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
        {data.termsVersion ? (
          <div className="rounded-xl border border-slate-700/40 bg-slate-900/50 px-3 py-2.5 sm:col-span-2">
            <dt className="text-[11px] uppercase tracking-wide text-slate-500">Versão do aviso</dt>
            <dd className="mt-1 text-slate-300 font-mono text-xs">{data.termsVersion}</dd>
          </div>
        ) : null}
      </dl>

      {data.consentText ? (
        <div className="rounded-xl border border-slate-700/40 bg-slate-900/60 p-4 text-sm text-slate-300 leading-relaxed whitespace-pre-line max-h-72 overflow-y-auto">
          {data.consentText}
        </div>
      ) : null}

      <p className="text-xs text-slate-500 leading-relaxed">
        Apenas tu decides se aceitas ou recusas o tratamento de dados. A decisão fica registada para
        efeitos de conformidade e podes alterá-la a qualquer momento.
      </p>

      {role === "formando" ? (
        <div className="pt-2 border-t border-slate-700/30 space-y-2">
          <p className="text-xs text-slate-500">
            Podes solicitar uma cópia dos dados pessoais associados ao teu perfil de formando.
          </p>
          {exportError ? <p className="text-sm text-red-400">{exportError}</p> : null}
          <Button type="button" variant="secondary" size="sm" disabled={exportBusy} onClick={() => void exportData()}>
            {exportBusy ? "A gerar exportação…" : "Exportar os meus dados"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
