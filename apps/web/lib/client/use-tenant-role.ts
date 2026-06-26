"use client";

import { useEffect, useState } from "react";
import type { JwtRole } from "@nexiforma/shared";
import { isComercial, isFormando, isTenantManager, isTenantStaff, canManageCrm } from "@nexiforma/shared";
import { getAccessToken, setAccessToken } from "@/lib/client/access-token";
import { bffFetch, refreshViaBffCookies } from "@/lib/client/bff-fetch";
import { decodeJwtRole } from "@/lib/client/jwt-role";

export function useTenantRole() {
  const [role, setRole] = useState<JwtRole | null>(() => decodeJwtRole(getAccessToken()));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      let token = getAccessToken();
      if (!token) {
        token = await refreshViaBffCookies();
      }
      if (!cancelled && token) {
        setRole(decodeJwtRole(token));
      }

      const res = await bffFetch("/api/auth/me", { headers: { accept: "application/json" } });
      if (!cancelled && res.ok) {
        const me = (await res.json()) as { role?: JwtRole; accessToken?: string };
        if (me.role) setRole(me.role);
        if (me.accessToken) setAccessToken(me.accessToken);
      }

      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    role,
    loading,
    canManage: isTenantManager(role ?? undefined),
    canManageCrm: canManageCrm(role ?? undefined),
    isComercial: isComercial(role ?? undefined),
    isFormador: role === "formador",
    isFormando: isFormando(role ?? undefined),
    isStaff: isTenantStaff(role ?? undefined),
    showBackofficeTools: loading || isTenantStaff(role ?? undefined),
  };
}
