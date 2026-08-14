"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Shield } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { auditActionLabel } from "@/lib/client/audit-labels";
import { parseApiError } from "@/lib/ui/backoffice";
import {
  Alert,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PaginatedDataTable,
  type Column,
} from "@/components/ui";

type AuditRow = {
  id: string;
  occurredAt: string;
  action: string;
  resourceType: string;
  resourceId: string;
  actorId: string;
  payload?: Record<string, unknown>;
};

type ActionPreset = { value: string; label: string };

type TenantAuditTrailProps = {
  apiPath: string;
  title?: string;
  description?: string;
  actionPresets?: readonly ActionPreset[];
  sinceDays?: number;
};

function formatPayload(payload: Record<string, unknown> | undefined): string {
  if (!payload || Object.keys(payload).length === 0) return "-";
  const parts: string[] = [];
  if (payload.filename != null) parts.push(String(payload.filename));
  if (payload.ano != null) {
    const mes = payload.mes != null ? `-${String(payload.mes).padStart(2, "0")}` : "";
    parts.push(`${payload.ano}${mes}`);
  }
  if (payload.tipo != null) parts.push(String(payload.tipo));
  if (payload.faturas != null) parts.push(`${payload.faturas} fatura(s)`);
  if (parts.length > 0) return parts.join(" · ");
  return Object.keys(payload).slice(0, 3).join(", ");
}

export function TenantAuditTrail({
  apiPath,
  title = "Trilho de auditoria",
  description = "Registo imutável de exports e operações sensíveis.",
  actionPresets,
  sinceDays = 90,
}: TenantAuditTrailProps) {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState("");
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      limit: "100",
      sinceDays: String(sinceDays),
    });
    if (action) params.set("action", action);
    if (qDebounced) params.set("q", qDebounced);
    const res = await bffFetch(`${apiPath}?${params}`, {
      headers: { accept: "application/json" },
    });
    setLoading(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      setRows([]);
      return;
    }
    setRows((await res.json()) as AuditRow[]);
  }, [action, apiPath, qDebounced, sinceDays]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns: Column<AuditRow>[] = useMemo(
    () => [
      {
        key: "occurredAt",
        header: "Data",
        sortable: true,
        sortValue: (r) => r.occurredAt,
        cell: (r) => (
          <span className="text-sm tabular-nums text-slate-300">
            {new Date(r.occurredAt).toLocaleString("pt-PT")}
          </span>
        ),
      },
      {
        key: "action",
        header: "Acção",
        sortable: true,
        sortValue: (r) => r.action,
        cell: (r) => (
          <div>
            <span className="text-sm text-slate-200">{auditActionLabel(r.action)}</span>
            <div className="font-mono text-[10px] text-slate-600">{r.action}</div>
          </div>
        ),
      },
      {
        key: "resourceType",
        header: "Recurso",
        sortable: true,
        hideOnMobile: true,
        sortValue: (r) => r.resourceType,
        cell: (r) => (
          <span className="text-xs text-slate-400">
            {r.resourceType}
            <span className="ml-1 font-mono text-slate-600">{r.resourceId.slice(0, 8)}…</span>
          </span>
        ),
      },
      {
        key: "payload",
        header: "Detalhe",
        hideOnMobile: true,
        cell: (r) => (
          <span className="text-xs text-slate-500">{formatPayload(r.payload)}</span>
        ),
      },
    ],
    [],
  );

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-teal-400" />
          {title}
        </CardTitle>
        {description ? (
          <p className="text-xs text-slate-500">{description}</p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {actionPresets ? (
            <select
              className="rounded-lg border border-slate-700/60 bg-slate-900/80 px-3 py-1.5 text-sm text-slate-200"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              aria-label="Filtrar por acção"
            >
              {actionPresets.map((p) => (
                <option key={p.value || "all"} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          ) : null}
          <input
            type="search"
            className="min-w-[180px] flex-1 rounded-lg border border-slate-700/60 bg-slate-900/80 px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-500"
            placeholder="Pesquisar acção, recurso…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Pesquisar auditoria"
          />
        </div>
        {error ? <Alert variant="error">{error}</Alert> : null}
        <PaginatedDataTable
          columns={columns}
          data={rows}
          keyField="id"
          loading={loading}
          emptyMessage="Sem eventos registados no período."
          defaultPageSize={10}
        />
      </CardContent>
    </Card>
  );
}
