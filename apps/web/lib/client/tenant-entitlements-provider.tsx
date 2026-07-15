"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { TenantEntitlements } from "@nexiforma/shared";
import { bffFetch } from "@/lib/client/bff-fetch";
import { getAccessToken } from "@/lib/client/access-token";
import { decodeJwtRole } from "@/lib/client/jwt-role";
import { subscribeSessionExpired } from "@/lib/client/session-lifecycle";

type EntitlementsContextValue = {
  entitlements: TenantEntitlements | null;
  loading: boolean;
  reload: () => Promise<void>;
};

const TenantEntitlementsContext = createContext<EntitlementsContextValue | null>(null);

let inflightLoad: Promise<void> | null = null;

export function TenantEntitlementsProvider({ children }: { children: ReactNode }) {
  const [entitlements, setEntitlements] = useState<TenantEntitlements | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const role = decodeJwtRole(getAccessToken());
    if (!role || role === "super_admin") {
      setEntitlements(null);
      setLoading(false);
      return;
    }

    if (inflightLoad) {
      await inflightLoad;
      return;
    }

    setLoading(true);
    inflightLoad = (async () => {
      const res = await bffFetch("/api/v1/billing/entitlements", {
        headers: { accept: "application/json" },
      });
      if (res.ok) {
        setEntitlements((await res.json()) as TenantEntitlements);
      } else {
        setEntitlements(null);
      }
      setLoading(false);
    })().finally(() => {
      inflightLoad = null;
    });

    await inflightLoad;
  }, []);

  useEffect(() => {
    void load();
    return subscribeSessionExpired(() => {
      setEntitlements(null);
      setLoading(false);
      inflightLoad = null;
    });
  }, [load]);

  const value = useMemo(
    () => ({ entitlements, loading, reload: load }),
    [entitlements, loading, load],
  );

  return (
    <TenantEntitlementsContext.Provider value={value}>{children}</TenantEntitlementsContext.Provider>
  );
}

export function useTenantEntitlements(): EntitlementsContextValue {
  const ctx = useContext(TenantEntitlementsContext);
  if (!ctx) {
    throw new Error("useTenantEntitlements deve ser usado dentro de TenantEntitlementsProvider");
  }
  return ctx;
}
