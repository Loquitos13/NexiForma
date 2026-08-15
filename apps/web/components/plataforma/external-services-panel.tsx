"use client";

import { useCallback, useState } from "react";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { cn } from "@/lib/ui/cn";

export type ExternalServiceHealth = {
  id: string;
  label: string;
  description: string;
  status: "UP" | "DOWN" | "NOT_CONFIGURED";
  configured: boolean;
  failureCount: number;
  tenantsAffected: number;
  lastFailureAt: string | null;
  lastFailureMessage: string | null;
  detail: string | null;
};

export type ExternalServicesStatus = {
  windowHours: number;
  evaluatedAt: string;
  rule: string;
  services: ExternalServiceHealth[];
};

type ExternalServiceLogEntry = {
  id: string;
  occurredAt: string;
  source: "audit" | "http_alert" | "domain";
  outcome: "success" | "error" | null;
  message: string;
  tenantId: string | null;
  email: string | null;
  nif: string | null;
  code: string | null;
  detail: string | null;
  resourceRef: string | null;
};

type ExternalServicesPanelProps = {
  data: ExternalServicesStatus;
  /** Layout compacto para secções secundárias (ex.: operações). */
  compact?: boolean;
};

const SOURCE_LABEL: Record<ExternalServiceLogEntry["source"], string> = {
  audit: "Auditoria",
  http_alert: "Alerta HTTP",
  domain: "Domínio",
};

export function ExternalServicesPanel({ data, compact }: ExternalServicesPanelProps) {
  const header = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 className="text-sm font-semibold text-slate-300">
          {compact ? "Serviços externos" : "Integrações externas"}
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Janela: {data.windowHours}h · {data.rule}
        </p>
      </div>
      <span className="text-[11px] text-slate-600">
        Actualizado {new Date(data.evaluatedAt).toLocaleString("pt-PT")}
      </span>
    </div>
  );

  const grid = (
    <div className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-3", compact ? "p-4" : "")}>
      {data.services.map((svc) => (
        <ExternalServiceCard key={svc.id} service={svc} windowHours={data.windowHours} />
      ))}
    </div>
  );

  if (compact) {
    return (
      <section className="rounded-2xl bg-[#0c0a14]/80 border border-purple-500/10">
        <div className="px-4 py-3 border-b border-purple-500/10">{header}</div>
        {grid}
      </section>
    );
  }

  return (
    <section className="space-y-3">
      {header}
      {grid}
    </section>
  );
}

function ExternalServiceCard({
  service,
  windowHours,
}: {
  service: ExternalServiceHealth;
  windowHours: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [logs, setLogs] = useState<ExternalServiceLogEntry[] | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);

  const statusStyles = {
    UP: "border-green-500/25 bg-green-950/20",
    DOWN: "border-red-500/30 bg-red-950/25",
    NOT_CONFIGURED: "border-slate-600/40 bg-slate-900/40",
  } as const;
  const statusLabel = {
    UP: "UP",
    DOWN: "DOWN",
    NOT_CONFIGURED: "Não configurado",
  } as const;
  const dotClass = {
    UP: "bg-green-400",
    DOWN: "bg-red-400",
    NOT_CONFIGURED: "bg-slate-500",
  } as const;

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    setLogsError(null);
    const r = await bffFetch(
      `/api/v1/control-plane/ops/external-services/${service.id}/logs?windowHours=${windowHours}&limit=30`,
      { headers: { accept: "application/json" } },
    );
    if (!r.ok) {
      setLogsError(r.status === 403 ? "Sem permissão." : `HTTP ${r.status}`);
      setLogs([]);
    } else {
      const d = (await r.json()) as { logs: ExternalServiceLogEntry[] };
      setLogs(d.logs);
    }
    setLogsLoading(false);
  }, [service.id, windowHours]);

  async function toggleLogs() {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (logs === null) await loadLogs();
  }

  return (
    <div className={cn("rounded-2xl border p-4 bg-[#0c0a14]/80", statusStyles[service.status])}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-100 truncate">{service.label}</h3>
          <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{service.description}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 shrink-0 text-xs font-medium text-slate-200">
          <span className={cn("w-2 h-2 rounded-full", dotClass[service.status])} />
          {statusLabel[service.status]}
        </span>
      </div>

      <p className="text-xs text-slate-400 mt-3">{service.detail}</p>

      {service.failureCount > 0 ? (
        <div className="mt-2 text-[11px] text-red-300/90">
          {service.failureCount} erro(s) · {service.tenantsAffected} tenant(s)
          {service.lastFailureAt ? (
            <span className="block text-slate-500 mt-1">
              Último: {new Date(service.lastFailureAt).toLocaleString("pt-PT")}
            </span>
          ) : null}
          {service.lastFailureMessage ? (
            <span className="block text-slate-500 mt-0.5 truncate" title={service.lastFailureMessage}>
              {service.lastFailureMessage}
            </span>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => void toggleLogs()}
        className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-purple-400 hover:text-purple-300"
      >
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {expanded ? "Ocultar logs" : "Ver logs de auditoria"}
      </button>

      {expanded ? (
        <div className="mt-3 border-t border-white/[0.06] pt-3 space-y-2">
          {logsLoading ? (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="h-3 w-3 animate-spin" />
              A carregar logs…
            </div>
          ) : logsError ? (
            <p className="text-xs text-red-400">{logsError}</p>
          ) : logs && logs.length === 0 ? (
            <p className="text-xs text-slate-500">Sem eventos na janela analisada.</p>
          ) : (
            logs?.map((log) => (
              <div
                key={log.id}
                className="rounded-lg bg-black/20 border border-white/[0.04] px-2.5 py-2 text-[11px]"
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-slate-500">
                  <time className="text-slate-400">
                    {new Date(log.occurredAt).toLocaleString("pt-PT")}
                  </time>
                  {log.outcome ? (
                    <span
                      className={cn(
                        "px-1 py-0.5 rounded text-[10px] font-medium",
                        log.outcome === "success"
                          ? "bg-green-500/15 text-green-400"
                          : "bg-red-500/15 text-red-300",
                      )}
                    >
                      {log.outcome === "success" ? "Sucesso" : "Erro"}
                    </span>
                  ) : null}
                  <span className="px-1 py-0.5 rounded bg-white/5 text-[10px]">
                    {SOURCE_LABEL[log.source]}
                  </span>
                  {log.code ? (
                    <span className="text-amber-400/90 font-mono text-[10px]">{log.code}</span>
                  ) : null}
                </div>
                <p className="text-slate-300 mt-1 leading-snug">{log.message}</p>
                {log.email ? (
                  <p className="text-slate-500 mt-1">
                    Email: <span className="text-slate-400">{log.email}</span>
                  </p>
                ) : null}
                {log.nif ? (
                  <p className="text-slate-500 mt-1">
                    NIF: <span className="text-slate-400">{log.nif}</span>
                  </p>
                ) : null}
                {log.resourceRef ? (
                  <p className="text-slate-600 mt-0.5 truncate" title={log.resourceRef}>
                    Ref: {log.resourceRef}
                  </p>
                ) : null}
                {log.tenantId ? (
                  <p className="text-slate-600 mt-0.5 truncate" title={log.tenantId}>
                    Tenant: {log.tenantId.slice(0, 8)}…
                  </p>
                ) : null}
                {log.detail ? (
                  <p className="text-slate-600 mt-0.5 truncate" title={log.detail}>
                    {log.detail}
                  </p>
                ) : null}
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
