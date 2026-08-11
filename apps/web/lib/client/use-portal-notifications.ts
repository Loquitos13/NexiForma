"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { useTenantEntitlements } from "@/lib/client/use-tenant-entitlements";

export type ComplianceAlerta = {
  id: string;
  tipo: string;
  severidade: "critico" | "aviso";
  codigoInterno: string;
  mensagem: string;
  accaoUrl: string;
};

const DISMISS_KEY = "nexiforma-priority-companion-dismissed";
export const NOTIF_UPDATE_EVENT = "nexiforma-notif-updated";
export const COMPLIANCE_UPDATE_EVENT = "nexiforma-compliance-updated";

export function notifyNotificationsUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(NOTIF_UPDATE_EVENT));
  }
}

export function notifyComplianceUpdated(acaoId?: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(COMPLIANCE_UPDATE_EVENT, { detail: { acaoId } }));
    window.dispatchEvent(new Event(NOTIF_UPDATE_EVENT));
  }
}

function loadDismissed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(DISMISS_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveDismissed(ids: Set<string>) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(DISMISS_KEY, JSON.stringify([...ids]));
}

function alertaRank(a: ComplianceAlerta): number {
  if (a.tipo === "inspecao" && a.severidade === "critico") return 0;
  if (a.tipo === "inspecao") return 1;
  if (a.tipo === "formador") return 2;
  if (a.severidade === "critico") return 3;
  return 4;
}

export function usePortalNotifications() {
  const { canManage, loading: roleLoading } = useTenantRole();
  const { entitlements, loading: entLoading } = useTenantEntitlements();
  const [unreadCount, setUnreadCount] = useState(0);
  const [rawAlertas, setRawAlertas] = useState<ComplianceAlerta[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(() => loadDismissed());
  const [loading, setLoading] = useState(true);

  const coreFormation = Boolean(entitlements?.canAccessCoreFormation);

  const loadUnreadCount = useCallback(async () => {
    try {
      const res = await bffFetch("/api/v1/notificacoes/portal/nao-lidas", {
        headers: { accept: "application/json" },
      });
      if (res.ok) {
        const data = (await res.json()) as { count?: number };
        setUnreadCount(data.count ?? 0);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const loadComplianceAlertas = useCallback(async () => {
    if (!canManage || !coreFormation) {
      setRawAlertas([]);
      return;
    }
    try {
      const res = await bffFetch("/api/v1/compliance/alertas", {
        headers: { accept: "application/json" },
      });
      if (res.ok) {
        const data = (await res.json()) as { alertas?: ComplianceAlerta[] };
        setRawAlertas(data.alertas ?? []);
      }
    } catch {
      /* ignore */
    }
  }, [canManage, coreFormation]);

  const refresh = useCallback(async () => {
    await Promise.all([loadUnreadCount(), loadComplianceAlertas()]);
    setLoading(false);
  }, [loadUnreadCount, loadComplianceAlertas]);

  useEffect(() => {
    if (roleLoading || entLoading) return;
    void refresh();
  }, [roleLoading, entLoading, refresh]);

  useEffect(() => {
    const onRefresh = () => {
      void refresh();
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") onRefresh();
    };

    const onSwMessage = (event: MessageEvent) => {
      if (
        event.data &&
        typeof event.data === "object" &&
        (event.data as { type?: string }).type === "NEXIFORMA_NOTIFICATIONS_REFRESH"
      ) {
        onRefresh();
      }
    };

    window.addEventListener(NOTIF_UPDATE_EVENT, onRefresh);
    document.addEventListener("visibilitychange", onVisibility);
    navigator.serviceWorker?.addEventListener("message", onSwMessage);

    const intervalMs = 25_000;
    const t = setInterval(onRefresh, intervalMs);

    return () => {
      window.removeEventListener(NOTIF_UPDATE_EVENT, onRefresh);
      document.removeEventListener("visibilitychange", onVisibility);
      navigator.serviceWorker?.removeEventListener("message", onSwMessage);
      clearInterval(t);
    };
  }, [refresh]);

  const alertas = useMemo(() => {
    return [...rawAlertas]
      .filter((a) => a.tipo === "inspecao" || a.tipo === "formador" || a.severidade === "critico")
      .sort((a, b) => alertaRank(a) - alertaRank(b))
      .filter((a) => !dismissed.has(a.id));
  }, [rawAlertas, dismissed]);

  const criticalAlertas = useMemo(() => {
    return alertas.filter((a) => a.severidade === "critico" || a.tipo === "inspecao");
  }, [alertas]);

  const dismissAlerta = useCallback((id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveDismissed(next);
      return next;
    });
  }, []);

  const hasUnread = unreadCount > 0;
  const hasCriticalAlerts = criticalAlertas.length > 0;
  const hasActivity = hasUnread || hasCriticalAlerts;
  const totalBadgeCount = unreadCount + criticalAlertas.length;

  return {
    unreadCount,
    alertas,
    criticalAlertas,
    hasUnread,
    hasCriticalAlerts,
    hasActivity,
    totalBadgeCount,
    loading,
    refresh,
    dismissAlerta,
  };
}
