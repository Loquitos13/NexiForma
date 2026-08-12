"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { JwtRole } from "@nexiforma/shared";
import {
  canManageCrm,
  canManageFormacao,
  canManageFaturacao,
  isComercial,
  isCoordenadorFinanceiro,
  isCoordenadorPedagogico,
  isFormando,
  isTenantManager,
  isTenantStaff,
  roleLandingPath,
} from "@nexiforma/shared";
import { getAccessToken, setAccessToken } from "@/lib/client/access-token";
import { bffFetch, refreshViaBffCookies } from "@/lib/client/bff-fetch";
import { decodeJwtPayload, decodeJwtRole, tokenKindMismatchForPath } from "@/lib/client/jwt-role";
import {
  isAccessTokenExpired,
  isAuthenticatedAppPath,
  markSessionExpired,
  subscribeSessionExpired,
} from "@/lib/client/session-lifecycle";
import { clientRateLimitRemainingSec } from "@/lib/client/rate-limit-client";

let verifyInflight: Promise<void> | null = null;
let lastFocusVerifyMs = 0;
const FOCUS_VERIFY_DEBOUNCE_MS = 3_000;

export function useTenantRole() {
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  const [role, setRole] = useState<JwtRole | null>(() => {
    const token = getAccessToken();
    if (!token || isAccessTokenExpired(token)) return null;
    return decodeJwtRole(token);
  });
  const [impersonating, setImpersonating] = useState(false);
  const [readOnlyImpersonation, setReadOnlyImpersonation] = useState(false);
  const [loading, setLoading] = useState(() => {
    if (typeof window === "undefined") return true;
    return isAuthenticatedAppPath(window.location.pathname);
  });
  const [sessionExpired, setSessionExpired] = useState(false);

  const handleSessionDead = useCallback(() => {
    const currentTok = getAccessToken();
    if (currentTok && !isAccessTokenExpired(currentTok)) {
      return;
    }
    setAccessToken(null);
    setRole(null);
    setImpersonating(false);
    setReadOnlyImpersonation(false);
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
    setImpersonating(false);
    setReadOnlyImpersonation(false);
    setSessionExpired(true);
    setLoading(false);
  }, []);

  const verifySession = useCallback(async () => {
    if (verifyInflight) {
      await verifyInflight;
      return;
    }

    verifyInflight = (async () => {
    const path = pathnameRef.current;
    if (!isAuthenticatedAppPath(path)) {
      setLoading(false);
      return;
    }

    let token = getAccessToken();
    if (!token || isAccessTokenExpired(token)) {
      token = await refreshViaBffCookies();
      if (!token) {
        const retryAfterSec = clientRateLimitRemainingSec();
        if (retryAfterSec > 0) {
          setLoading(true);
          window.setTimeout(() => {
            void verifySession();
          }, Math.min(retryAfterSec * 1000, 5_000));
          return;
        }
        handleSessionDead();
        return;
      }
      setRole(decodeJwtRole(token));
    }

    if (tokenKindMismatchForPath(path, token)) {
      const payload = decodeJwtPayload(token);
      if (payload?.kind === "platform") {
        window.location.replace("/plataforma");
        return;
      }
      if (payload?.kind === "tenant") {
        window.location.replace(roleLandingPath(payload?.role, payload?.kind));
        return;
      }
    }

    const res = await bffFetch("/api/auth/me", {
      headers: { accept: "application/json" },
    });

    if (res.ok) {
      const me = (await res.json()) as {
        role?: JwtRole;
        accessToken?: string;
        impersonating?: boolean;
        readOnlyImpersonation?: boolean;
      };
      if (me.role) setRole(me.role);
      if (me.accessToken) setAccessToken(me.accessToken);
      setImpersonating(!!me.impersonating);
      setReadOnlyImpersonation(!!me.impersonating && !!me.readOnlyImpersonation);
      setSessionExpired(false);
      setLoading(false);
      return;
    }

    if (res.status === 401) {
      handleSessionDead();
      return;
    }

    setLoading(false);
  })().finally(() => {
      verifyInflight = null;
    });

    await verifyInflight;
  }, [handleSessionDead]);

  useEffect(() => {
    const token = getAccessToken();
    if (token && !isAccessTokenExpired(token)) {
      const decodedRole = decodeJwtRole(token);
      if (decodedRole) setRole(decodedRole);
      setSessionExpired(false);
      setLoading(false);
      return;
    }
    void verifySession();
  }, [pathname, verifySession]);

  useEffect(() => {
    const unsub = subscribeSessionExpired(applySessionDeadState);

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastFocusVerifyMs < FOCUS_VERIFY_DEBOUNCE_MS) return;
      lastFocusVerifyMs = now;
      void verifySession();
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
    impersonating,
    readOnlyImpersonation,
    /** True quando personificação read-only bloqueia escritas na UI. */
    writeDisabled: readOnlyImpersonation,
    canManage: isTenantManager(role ?? undefined),
    canManageFormacao: canManageFormacao(role ?? undefined),
    canManageCrm: canManageCrm(role ?? undefined),
    canManageFaturacao: canManageFaturacao(role ?? undefined),
    isCoordenadorFinanceiro: isCoordenadorFinanceiro(role ?? undefined),
    isCoordenadorPedagogico: isCoordenadorPedagogico(role ?? undefined),
    isComercial: isComercial(role ?? undefined),
    isFormador: role === "formador",
    isFormando: isFormando(role ?? undefined),
    isStaff: isTenantStaff(role ?? undefined),
    showBackofficeTools: loading || isTenantStaff(role ?? undefined),
  };
}
