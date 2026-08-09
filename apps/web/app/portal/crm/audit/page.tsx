"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { parseApiError } from "@/lib/ui/backoffice";
import { ListPaginationControls } from "@/components/crm/list-pagination";
import { Alert, Card, CardContent, DataTable, PageHeader, type Column } from "@/components/ui";

type AuditRow = {
  id: string;
  occurredAt: string;
  actorType: string;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  payload?: Record<string, unknown>;
};

export default function CrmAuditPage() {
  const { canManage, loading: roleLoading, sessionExpired } = useTenantRole();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const load = useCallback(async () => {
    if (!canManage) return;
    setLoading(true);
    const res = await bffFetch("/api/v1/crm/audit?limit=100", { headers: { accept: "application/json" } });
    setLoading(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    setRows((await res.json()) as AuditRow[]);
  }, [canManage]);

  useEffect(() => {
    void load();
  }, [load]);

  const pageRows = useMemo(
    () => rows.slice((page - 1) * pageSize, page * pageSize),
    [rows, page, pageSize],
  );

  const COLS: Column<AuditRow>[] = [
    {
      key: "occurredAt",
      header: "Data",
      cell: (r) => new Date(r.occurredAt).toLocaleString("pt-PT"),
    },
    { key: "action", header: "Acção", cell: (r) => r.action },
    { key: "resourceType", header: "Recurso", cell: (r) => r.resourceType },
    {
      key: "resourceId",
      header: "ID",
      cell: (r) => <span className="font-mono text-xs text-slate-400">{r.resourceId.slice(0, 8)}…</span>,
    },
    { key: "actorId", header: "Actor", cell: (r) => r.actorId.slice(0, 8) + "…" },
  ];

  if (sessionExpired || roleLoading) {
    return (
      <>
        <PageHeader
          title="Audit trail CRM"
          description="Registo de acções comerciais (leads, propostas, notas) - estilo Salesforce Event Monitoring."
        />
        <p className="text-slate-400">A carregar…</p>
      </>
    );
  }

  if (!canManage && !roleLoading) {
    return <Alert variant="error">Audit trail CRM disponível apenas para gestores.</Alert>;
  }

  return (
    <>
      <PageHeader
        title="Audit trail CRM"
        description="Registo de acções comerciais (leads, propostas, notas) - estilo Salesforce Event Monitoring."
      />
      {error ? <Alert variant="error" className="mb-4">{error}</Alert> : null}
      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={COLS}
            data={pageRows}
            keyField="id"
            loading={loading}
            emptyMessage="Sem eventos registados."
          />
        </CardContent>
      </Card>

      <ListPaginationControls
        page={page}
        pageSize={pageSize}
        total={rows.length}
        onPageChange={setPage}
        onPageSizeChange={(next) => {
          setPageSize(next);
          setPage(1);
        }}
        numberedPages
      />
    </>
  );
}
