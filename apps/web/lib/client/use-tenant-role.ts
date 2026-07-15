"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { JwtRole } from "@nexiforma/shared";
import { isComercial, isFormando, isTenantManager, isTenantStaff, canManageCrm } from "@nexiforma/shared";
import { getAccessToken, setAccessToken } from "@/lib/client/access-token";
import { bffFetch, refreshViaBffCookies } from "@/lib/client/bff-fetch";
import { decodeJwtRole, tokenKindMismatchForPath } from "@/lib/client/jwt-role";
import {
  isAccessTokenExpired,
  isAuthenticatedAppPath,
  markSessionExpired,
  subscribeSessionExpired,
} from "@/lib/client/session-lifecycle";

export function useTenantRole() {
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  const [role, setRole] = useState<JwtRole | null>(() => {
    const token = getAccessToken();
    if (!token || isAccessTokenExpired(token)) return null;
    return decodeJwtRole(token);
  });
  const [loading, setLoading] = useState(() => {
    if (typeof window === "undefined") return true;
    return isAuthenticatedAppPath(window.location.pathname);
  });
  const [sessionExpired, setSessionExpired] = useState(false);

  const handleSessionDead = useCallback(() => {
    setAccessToken(null);
    setRole(null);
    setSessionExpired(true);
    setLoading(false);
    const path = pathnameRef.current;
    if (isAuthenticatedAppPath(path)) {
      markSessionExpired({ returnTo: path });
    }
  }, []);

  const applySessionDeadState = useCallback(() => {
    setAccessToken(null);
    setRole(null);
    setSessionExpired(true);
    setLoading(false);
  }, []);

  const verifySession = useCallback(async () => {
    const path = pathnameRef.current;
    if (!isAuthenticatedAppPath(path)) {
      setLoading(false);
      return;
    }

    let token = getAccessToken();
    if (!token || isAccessTokenExpired(token) || tokenKindMismatchForPath(path, token)) {
      if (tokenKindMismatchForPath(path, token)) {
        setAccessToken(null);
      }
      token = await refreshViaBffCookies();
      if (!token) {
        handleSessionDead();
        return;
      }
      setRole(decodeJwtRole(token));
    }

    const res = await bffFetch("/api/auth/me", {
      headers: { accept: "application/json" },
    });

    if (res.ok) {
      const me = (await res.json()) as { role?: JwtRole; accessToken?: string };
      if (me.role) setRole(me.role);
      if (me.accessToken) setAccessToken(me.accessToken);
      setSessionExpired(false);
      setLoading(false);
      return;
    }

    if (res.status === 401) {
      handleSessionDead();
      return;
    }

    setLoading(false);
  }, [handleSessionDead]);

  useEffect(() => {
    const token = getAccessToken();
    if (token && !isAccessTokenExpired(token)) {
      setLoading(false);
      return;
    }
    void verifySession();
  }, [pathname, verifySession]);

  useEffect(() => {
    const unsub = subscribeSessionExpired(applySessionDeadState);

    const onVisible = () => {
      if (document.visibilityState === "visible") void verifySession();
    };

    const interval = window.setInterval(() => {
      const token = getAccessToken();
      if (!token || isAccessTokenExpired(token)) {
        void verifySession();
      }
    }, 30_000);

    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      unsub();
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(interval);
    };
  }, [verifySession, applySessionDeadState]);

  return {
    role,
    loading,
    sessionExpired,
    authenticated: !loading && !sessionExpired && role !== null,
    canManage: isTenantManager(role ?? undefined),
    canManageCrm: canManageCrm(role ?? undefined),
    isComercial: isComercial(role ?? undefined),
    isFormador: role === "formador",
    isFormando: isFormando(role ?? undefined),
    isStaff: isTenantStaff(role ?? undefined),
    showBackofficeTools: loading || isTenantStaff(role ?? undefined),
  };
}
