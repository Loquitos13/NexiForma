"use client";

import { useCallback, useEffect, useState } from "react";
import type { RelatorioDashboard } from "@nexiforma/shared";
import { bffFetch } from "@/lib/client/bff-fetch";
import { useTenantEntitlements } from "@/lib/client/use-tenant-entitlements";
import { parseApiError } from "@/lib/ui/backoffice";
import { Alert } from "@/components/ui";
import { GestorExecutiveDashboard } from "@/components/dashboard/gestor-dashboard-slides";
import type { DashboardPortalContext } from "@/components/dashboard/dashboard-panels";

export function GestorRelatoriosDashboardBlock({
  portalContext,
}: {
  portalContext?: DashboardPortalContext;
}) {
  const { entitlements, loading: entLoading } = useTenantEntitlements();
  const [data, setData] = useState<RelatorioDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canDashboard = entitlements?.canAccessRelatoriosDashboard ?? false;
  const enterprise = entitlements?.canAccessRelatoriosInsights ?? false;

  const load = useCallback(async () => {
    if (!canDashboard) return;
    setLoading(true);
    setError(null);
    try {
      const res = await bffFetch("/api/v1/relatorios/dashboard", {
        headers: { accept: "application/json" },
      });
      if (!res.ok) {
        setError(await parseApiError(res));
        return;
      }
      setData((await res.json()) as RelatorioDashboard);
    } catch {
      setError("Não foi possível carregar os indicadores executivos.");
    } finally {
      setLoading(false);
    }
  }, [canDashboard]);

  useEffect(() => {
    if (!entLoading && canDashboard) void load();
  }, [entLoading, canDashboard, load]);

  if (entLoading || loading) {
    return <p className="text-sm text-slate-500">A carregar indicadores executivos…</p>;
  }

  if (!canDashboard) {
    return null;
  }

  if (error) return <Alert variant="error">{error}</Alert>;
  if (!data) return null;

  return (
    <GestorExecutiveDashboard
      data={data}
      enterprise={enterprise}
      portalContext={portalContext}
    />
  );
}
