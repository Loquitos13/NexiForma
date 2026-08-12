"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { CheckCircle2, Shield } from "lucide-react";
import { mfaAppOpenHint, mfaVerificationSubtitle, MFA_APP_CODES, MFA_APP_LABELS, type MfaAppCode } from "@nexiforma/shared";
import { AuthShell } from "@/components/site/auth-shell";
import { TotpInput } from "@/components/auth/totp-input";
import { PasswordInput } from "@/components/ui/password-input";
import { getAccessToken, setAccessToken } from "@/lib/client/access-token";
import { refreshViaBffCookies, bffFetch } from "@/lib/client/bff-fetch";
import { resolvePostLoginPath, decodeJwtPayload } from "@/lib/client/jwt-role";
import type { TenantEntitlements } from "@nexiforma/shared";
import {
  getRememberLogin,
  getSavedEmail,
  persistLoginPreferences,
  clearPersistedTenantContext,
  setRememberLogin,
} from "@/lib/client/login-preferences";
import { purgeStaleAuthSession } from "@/lib/client/logout";
import {
  isPlatformAuthMode,
  platformAuthHref,
} from "@/lib/client/platform-auth-mode";
import { SocialLoginButtons } from "@/components/auth/social-login-buttons";
import {
  TenantAuthPickModal,
  type TenantAuthPickOption,
} from "@/components/auth/tenant-auth-pick-modal";
import type { OAuthProviders } from "@/lib/client/oauth-login-url";
import { syncUiThemeFromServer } from "@/lib/client/ui-theme-sync";
import {
  parseTenantAmbiguousResponse,
  normalizeTenantPickList,
  tenantAmbiguousInfoMessage,
} from "@/lib/client/tenant-auth-ambiguous";
import { isDevEnvironment } from "@/lib/ui/site";

const inputClass =
  "w-full px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700/60 text-slate-100 text-sm placeholder:text-slate-500 outline-none transition-all duration-200 focus:border-blue-500/70 focus:ring-2 focus:ring-blue-500/15";
const labelClass = "block text-sm font-medium text-slate-300 mb-1.5";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const platformMode = isPlatformAuthMode(searchParams);
  const [tenantSlug, setTenantSlug] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaAppLabel, setMfaAppLabel] = useState<string | null>(null);
  const [mfaEnrollmentMode, setMfaEnrollmentMode] = useState(false);
  const [mfaEnrollSetup, setMfaEnrollSetup] = useState<{ qrDataUrl: string } | null>(null);
  const [mfaApp, setMfaApp] = useState<MfaAppCode>("microsoft_authenticator");
  const [credSuccess, setCredSuccess] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [mustChangePasswordMode, setMustChangePasswordMode] = useState(false);
  const [currentTempPassword, setCurrentTempPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [tempAccessToken, setTempAccessToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [emailNotVerified, setEmailNotVerified] = useState<{
    email: string;
    tenantSlug: string;
  } | null>(null);
  const [resendConfirmMsg, setResendConfirmMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [oauthProviders, setOauthProviders] = useState<OAuthProviders | null>(null);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [ambiguousTenants, setAmbiguousTenants] = useState<TenantAuthPickOption[]>([]);
  const [oauthPickToken, setOauthPickToken] = useState<string | null>(null);
  const [oauthPickOptions, setOauthPickOptions] = useState<TenantAuthPickOption[]>([]);
  const [oauthPickEmail, setOauthPickEmail] = useState("");
  const [slugFromUrl, setSlugFromUrl] = useState("");
  const [pickedTenantSlug, setPickedTenantSlug] = useState("");
  const [tenantPickModalOpen, setTenantPickModalOpen] = useState(false);
  const [tenantPickMode, setTenantPickMode] = useState<"password" | "oauth" | null>(null);
  const isDev = isDevEnvironment();

  const hasOAuthCallbackParams =
    !!searchParams.get("sso") ||
    !!searchParams.get("token") ||
    !!searchParams.get("x") ||
    !!searchParams.get("pick") ||
    !!searchParams.get("error") ||
    !!searchParams.get("error_description") ||
    !!searchParams.get("message");

  useEffect(() => {
    clearPersistedTenantContext();
    setRememberMe(getRememberLogin());
    const slug = searchParams.get("slug")?.trim() ?? "";
    const next = searchParams.get("next");
    const emailParam = searchParams.get("email");
    setSlugFromUrl(slug);
    setTenantSlug(slug);
    setPickedTenantSlug("");
    if (emailParam) setEmail(emailParam);
    else {
      const savedEmail = getSavedEmail();
      if (savedEmail) setEmail(savedEmail);
    }
    if (next) sessionStorage.setItem("nexiforma_login_next", next);
    else sessionStorage.removeItem("nexiforma_login_next");
  }, [searchParams, isDev]);

  useEffect(() => {
    if (hasOAuthCallbackParams) {
      setCheckingSession(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const token = await refreshViaBffCookies();
        if (!cancelled && token) {
          await finishLogin(token);
          return;
        }
        if (!cancelled) {
          await purgeStaleAuthSession({ resetThemePaint: true });
          clearPersistedTenantContext();
        }
      } catch {
        if (!cancelled) {
          await purgeStaleAuthSession({ resetThemePaint: true });
          clearPersistedTenantContext();
        }
      } finally {
        if (!cancelled) setCheckingSession(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasOAuthCallbackParams]);

  async function finishLogin(accessToken?: string) {
    let activeToken: string | null = accessToken ?? null;
    if (activeToken) {
      setAccessToken(activeToken);
    } else {
      activeToken = getAccessToken();
    }

    if (!activeToken) {
      activeToken = await refreshViaBffCookies();
    }

    if (!activeToken) {
      setError("Não foi possível concluir a sessão. Tente novamente.");
      return;
    }

    clearPersistedTenantContext();
    const nextRaw = sessionStorage.getItem("nexiforma_login_next");
    sessionStorage.removeItem("nexiforma_login_next");

    // Tema do utilizador ANTES de navegar → skeleton já com as cores certas.
    await syncUiThemeFromServer().catch(() => undefined);

    let entitlements: TenantEntitlements | null = null;
    const payload = decodeJwtPayload(activeToken);
    if (
      payload?.role &&
      payload.role !== "super_admin" &&
      !(payload.kind === "platform" && !payload.impersonating)
    ) {
      const res = await bffFetch("/api/v1/billing/entitlements", {
        headers: { accept: "application/json" },
        authRetry401: false,
      });
      if (res.ok) {
        entitlements = (await res.json()) as TenantEntitlements;
      }
    }

    const dest = resolvePostLoginPath(activeToken, nextRaw, entitlements);
    window.location.replace(dest);
  }

  function saveLoginPreferences(overrideEmail?: string) {
    const nextEmail = (overrideEmail ?? email).trim();
    persistLoginPreferences({
      remember: rememberMe,
      email: nextEmail,
    });
    if (rememberMe && nextEmail) setEmail(nextEmail);
  }

  /** Após OAuth: grava o email da conta social (não o último digitado no form). */
  function saveOAuthLoginPreferences(accessToken?: string, fallbackEmail?: string) {
    const fromJwt = decodeJwtPayload(accessToken)?.email?.trim() ?? "";
    const nextEmail = fromJwt || fallbackEmail?.trim() || "";
    if (!nextEmail) return;
    // Lê do storage: o estado React perde-se no redirect OAuth.
    const remember = getRememberLogin();
    persistLoginPreferences({ remember, email: nextEmail });
    if (remember) setEmail(nextEmail);
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sso = params.get("sso");
    const token = params.get("token");
    const exchange = params.get("x");
    const ssoError =
      params.get("message") ||
      params.get("error_description") ||
      params.get("error");
    if (sso === "error" || ssoError) {
      setError(ssoError ? decodeURIComponent(ssoError) : "Falha no login social.");
      const slugParam = params.get("slug");
      if (slugParam) setTenantSlug(slugParam);
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }
    if (sso === "pick") {
      const pick = params.get("pick");
      if (!pick) {
        setError("Seleção de entidade OAuth inválida.");
        window.history.replaceState({}, "", window.location.pathname);
        return;
      }
      void (async () => {
        setBusy(true);
        setError(null);
        try {
          const res = await fetch(
            `/api/v1/auth/oauth/pick-options?pick=${encodeURIComponent(pick)}`,
            { headers: { accept: "application/json" } },
          );
          const data = (await res.json().catch(() => ({}))) as {
            message?: string | string[];
            email?: string;
            tenants?: TenantAuthPickOption[];
          };
          if (!res.ok) {
            const msg = Array.isArray(data.message)
              ? data.message.join(", ")
              : typeof data.message === "string"
                ? data.message
                : "Seleção OAuth expirada. Tente entrar novamente.";
            setError(msg);
            return;
          }
          const tenants = normalizeTenantPickList(Array.isArray(data.tenants) ? data.tenants : []);
          if (!tenants.length) {
            setError("Não há entidades disponíveis para este email.");
            return;
          }
          setOauthPickToken(pick);
          const pickEmail = typeof data.email === "string" ? data.email.trim() : "";
          setOauthPickEmail(pickEmail);
          if (pickEmail) setEmail(pickEmail);
          setOauthPickOptions(tenants);
          const defaultSlug = tenants[0]?.slug ?? "";
          setTenantSlug(defaultSlug);
          setPickedTenantSlug(defaultSlug);
          setTenantPickMode("oauth");
          setTenantPickModalOpen(true);
          window.history.replaceState({}, "", window.location.pathname);
        } catch {
          setError("Não foi possível carregar as entidades disponíveis.");
        } finally {
          setBusy(false);
        }
      })();
      return;
    }
    if (sso === "exchange" && exchange) {
      void (async () => {
        setBusy(true);
        setLoginSuccess(true);
        setError(null);
        try {
          const res = await fetch("/api/auth/oauth/complete", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ exchange }),
          });
          const data = (await res.json().catch(() => ({}))) as {
            message?: string | string[];
            accessToken?: string;
          };
          if (!res.ok) {
            setLoginSuccess(false);
            const msg = Array.isArray(data.message)
              ? data.message.join(", ")
              : typeof data.message === "string"
                ? data.message
                : "Não foi possível concluir o login social.";
            setError(msg);
            return;
          }
          window.history.replaceState({}, "", window.location.pathname);
          saveOAuthLoginPreferences(data.accessToken);
          await finishLogin(data.accessToken);
        } catch {
          setLoginSuccess(false);
          setError("Não foi possível concluir o login social.");
        } finally {
          setBusy(false);
        }
      })();
      return;
    }
    if (sso === "ok" && token) {
      setLoginSuccess(true);
      saveOAuthLoginPreferences(token);
      window.history.replaceState({}, "", window.location.pathname);
      void finishLogin(token);
    }
  }, [router]);

  useEffect(() => {
    if (platformMode) {
      setOauthProviders(null);
      return;
    }
    const oauthHintSlug =
      slugFromUrl || (ambiguousTenants.length > 0 ? tenantSlug.trim() : "");
    let cancelled = false;
    setOauthLoading(true);
    void (async () => {
      try {
        const url = oauthHintSlug
          ? `/api/v1/auth/oauth/providers?slug=${encodeURIComponent(oauthHintSlug)}`
          : "/api/v1/auth/oauth/providers";
        const res = await fetch(url, {
          headers: { accept: "application/json" },
        });
        if (!res.ok || cancelled) return;
        setOauthProviders((await res.json()) as OAuthProviders);
      } catch {
        if (!cancelled) setOauthProviders(null);
      } finally {
        if (!cancelled) setOauthLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [platformMode, slugFromUrl, ambiguousTenants.length, tenantSlug]);

  useEffect(() => {
    if (!mfaEnrollmentMode || !mfaToken || mfaEnrollSetup) return;
    void (async () => {
      const res = await fetch("/api/auth/mfa/enroll/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mfaToken }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string | string[] };
        const msg = Array.isArray(err.message)
          ? err.message.join(", ")
          : typeof err.message === "string"
            ? err.message
            : "Não foi possível iniciar a configuração MFA.";
        setError(msg);
        return;
      }
      const data = (await res.json()) as { qrDataUrl?: string };
      if (data.qrDataUrl) {
        setMfaEnrollSetup({ qrDataUrl: data.qrDataUrl });
      }
    })();
  }, [mfaEnrollmentMode, mfaToken, mfaEnrollSetup]);

  function resetMfaFlow() {
    setMfaToken(null);
    setMfaCode("");
    setMfaAppLabel(null);
    setMfaEnrollmentMode(false);
    setMfaEnrollSetup(null);
    setMfaApp("microsoft_authenticator");
    setCredSuccess(false);
    setError(null);
  }

  function resetMustChangePasswordFlow() {
    setMustChangePasswordMode(false);
    setTempAccessToken(null);
    setCurrentTempPassword("");
    setNewPassword("");
    setConfirmNewPassword("");
    setCredSuccess(false);
    setError(null);
  }

  async function onSubmitChangeRequiredPassword(e: FormEvent) {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      setError("A nova palavra-passe deve ter pelo menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError("As palavras-passe introduzidas não coincidem.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const authHeaders: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (tempAccessToken) {
        authHeaders["Authorization"] = `Bearer ${tempAccessToken}`;
      }
      const res = await fetch("/api/auth/tenant/change-required-password", {
        method: "POST",
        credentials: "include",
        headers: authHeaders,
        body: JSON.stringify({
          currentPassword: currentTempPassword || password,
          newPassword,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        message?: string | string[];
        accessToken?: string;
      };
      if (!res.ok) {
        const msg = Array.isArray(data.message)
          ? data.message.join(", ")
          : typeof data.message === "string"
            ? data.message
            : "Não foi possível alterar a palavra-passe.";
        setError(msg);
        return;
      }
      setMustChangePasswordMode(false);
      setLoginSuccess(true);
      saveLoginPreferences();
      await new Promise((r) => setTimeout(r, 700));
      await finishLogin(data.accessToken);
    } catch {
      setError("Falha de rede ao gravar nova palavra-passe.");
    } finally {
      setBusy(false);
    }
  }

  function onTenantPickChange(slug: string) {
    setTenantSlug(slug);
    setPickedTenantSlug(slug);
  }

  function openPasswordTenantPickModal(tenants: TenantAuthPickOption[]) {
    const defaultSlug = pickedTenantSlug.trim() || tenantSlug.trim() || tenants[0]?.slug || "";
    if (defaultSlug) {
      setTenantSlug(defaultSlug);
      setPickedTenantSlug(defaultSlug);
    }
    setTenantPickMode("password");
    setTenantPickModalOpen(true);
  }

  function cancelTenantPickModal() {
    setTenantPickModalOpen(false);
    if (tenantPickMode === "oauth") {
      setOauthPickToken(null);
      setOauthPickOptions([]);
      setOauthPickEmail("");
    }
    setTenantPickMode(null);
  }

  async function submitPasswordLogin(forcedSlug?: string) {
    setError(null);
    setEmailNotVerified(null);
    setResendConfirmMsg(null);
    setCredSuccess(false);
    setLoginSuccess(false);
    setBusy(true);
    const slugForLogin = platformMode
      ? ""
      : slugFromUrl || forcedSlug?.trim() || "";
    if (slugForLogin || ambiguousTenants.length > 0) {
      await purgeStaleAuthSession();
    }
    const endpoint = platformMode ? "/api/auth/platform/login" : "/api/auth/tenant/login";
    const body = platformMode
      ? { email: email.trim(), password, rememberMe }
      : {
          email: email.trim(),
          password,
          rememberMe,
          ...(slugForLogin ? { tenantSlug: slugForLogin } : {}),
        };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as {
        message?: string | string[] | { message?: string; code?: string; tenants?: TenantAuthPickOption[] };
        code?: string;
        email?: string;
        tenantSlug?: string;
        accessToken?: string;
        passwordChangeRequired?: boolean;
        mfaRequired?: boolean;
        mfaEnrollmentRequired?: boolean;
        mfaToken?: string;
        user?: { mfaAppLabel?: string | null; tenantSlug?: string | null };
      };

      if (!res.ok) {
        const ambiguous = parseTenantAmbiguousResponse(data);
        if (ambiguous?.length) {
          setAmbiguousTenants(ambiguous);
          await purgeStaleAuthSession();
          setError(null);
          openPasswordTenantPickModal(ambiguous);
          return;
        }
        if (data.code === "EMAIL_NOT_VERIFIED") {
          const slug =
            (typeof data.tenantSlug === "string" && data.tenantSlug) ||
            slugForLogin ||
            pickedTenantSlug ||
            tenantSlug;
          setEmailNotVerified({
            email: (typeof data.email === "string" && data.email) || email.trim(),
            tenantSlug: slug,
          });
        }
        const rawMessage = data.message;
        const msg = Array.isArray(rawMessage)
          ? rawMessage.join(", ")
          : typeof rawMessage === "string"
            ? rawMessage
            : "Credenciais inválidas.";
        setError(msg);
        return;
      }

      if (data.mfaEnrollmentRequired && data.mfaToken) {
        setCredSuccess(true);
        setMfaToken(data.mfaToken);
        setMfaEnrollmentMode(true);
        return;
      }

      if (data.mfaRequired && data.mfaToken) {
        setCredSuccess(true);
        setMfaToken(data.mfaToken);
        setMfaAppLabel(data.user?.mfaAppLabel ?? null);
        return;
      }

      setTenantPickModalOpen(false);
      setTenantPickMode(null);

      const payload = decodeJwtPayload(data.accessToken);
      const isPasswordChangeRequired = Boolean(
        data.passwordChangeRequired || payload?.mustChangePassword,
      );

      if (isPasswordChangeRequired && data.accessToken) {
        setCredSuccess(true);
        setTempAccessToken(data.accessToken);
        setCurrentTempPassword(password);
        setNewPassword("");
        setConfirmNewPassword("");
        setMustChangePasswordMode(true);
        if (data.user?.tenantSlug) {
          setTenantSlug(data.user.tenantSlug);
          setPickedTenantSlug(data.user.tenantSlug);
        }
        return;
      }

      setLoginSuccess(true);
      if (data.user?.tenantSlug) {
        setTenantSlug(data.user.tenantSlug);
        setPickedTenantSlug(data.user.tenantSlug);
      }
      saveLoginPreferences();
      await new Promise((r) => setTimeout(r, 700));
      await finishLogin(data.accessToken);
    } catch {
      setError("Não foi possível contactar o servidor.");
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await submitPasswordLogin();
  }

  async function executeOAuthPick(slug: string) {
    if (!oauthPickToken || !slug.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/oauth/pick-tenant", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pick: oauthPickToken, tenantSlug: slug.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        message?: string | string[];
        accessToken?: string;
      };
      if (!res.ok) {
        const msg = Array.isArray(data.message)
          ? data.message.join(", ")
          : typeof data.message === "string"
            ? data.message
            : "Não foi possível concluir o login social.";
        setError(msg);
        setTenantPickModalOpen(true);
        return;
      }
      setTenantPickModalOpen(false);
      setTenantPickMode(null);
      setLoginSuccess(true);
      clearPersistedTenantContext();
      saveOAuthLoginPreferences(data.accessToken, oauthPickEmail);
      await new Promise((r) => setTimeout(r, 700));
      await finishLogin(data.accessToken);
    } catch {
      setError("Não foi possível concluir o login social.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmTenantPickModal() {
    const slug = pickedTenantSlug.trim() || tenantSlug.trim();
    if (!slug) return;
    setTenantPickModalOpen(false);
    if (tenantPickMode === "oauth") {
      await executeOAuthPick(slug);
    } else {
      await submitPasswordLogin(slug);
    }
  }

  function resetOAuthPickFlow() {
    setOauthPickToken(null);
    setOauthPickOptions([]);
    setOauthPickEmail("");
    setTenantPickModalOpen(false);
    setTenantPickMode(null);
    setError(null);
  }

  async function onMfaSubmit(e: FormEvent) {
    e.preventDefault();
    if (!mfaToken || mfaCode.length !== 6) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/mfa/verify", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mfaToken, code: mfaCode, rememberMe }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string; accessToken?: string };
      if (!res.ok) {
        setError(typeof data.message === "string" ? data.message : "Código MFA inválido.");
        return;
      }
      const payload = decodeJwtPayload(data.accessToken);
      if (payload?.mustChangePassword && data.accessToken) {
        setCredSuccess(true);
        setTempAccessToken(data.accessToken);
        setCurrentTempPassword(password);
        setNewPassword("");
        setConfirmNewPassword("");
        setMustChangePasswordMode(true);
        setMfaToken(null);
        return;
      }
      setLoginSuccess(true);
      saveLoginPreferences();
      await new Promise((r) => setTimeout(r, 700));
      await finishLogin(data.accessToken);
    } catch {
      setError("Falha na verificação MFA.");
    } finally {
      setBusy(false);
    }
  }

  async function onMfaEnrollSubmit(e: FormEvent) {
    e.preventDefault();
    if (!mfaToken || mfaCode.length !== 6) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/mfa/enroll/confirm", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mfaToken, code: mfaCode, mfaApp, rememberMe }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string; accessToken?: string };
      if (!res.ok) {
        setError(typeof data.message === "string" ? data.message : "Código MFA inválido.");
        return;
      }
      const payload = decodeJwtPayload(data.accessToken);
      if (payload?.mustChangePassword && data.accessToken) {
        setCredSuccess(true);
        setTempAccessToken(data.accessToken);
        setCurrentTempPassword(password);
        setNewPassword("");
        setConfirmNewPassword("");
        setMustChangePasswordMode(true);
        setMfaToken(null);
        setMfaEnrollmentMode(false);
        return;
      }
      setLoginSuccess(true);
      saveLoginPreferences();
      await new Promise((r) => setTimeout(r, 700));
      await finishLogin(data.accessToken);
    } catch {
      setError("Falha na configuração MFA.");
    } finally {
      setBusy(false);
    }
  }

  if (checkingSession && !loginSuccess) {
    return (
      <AuthShell title="Entrar" subtitle="A verificar sessão…">
        <div className="py-8 text-center text-sm text-slate-500">A carregar…</div>
      </AuthShell>
    );
  }

  if (loginSuccess) {
    return (
      <AuthShell title="Sessão iniciada" subtitle="A redirecionar para o portal…">
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 ring-2 ring-emerald-500/30">
            <CheckCircle2 className="h-8 w-8 text-emerald-400" />
          </div>
          <p className="text-sm text-emerald-300">Credenciais correctas. Bem-vindo!</p>
          <div className="h-1 w-32 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full w-full animate-pulse rounded-full bg-emerald-500/60" />
          </div>
        </div>
      </AuthShell>
    );
  }

  const tenantPickOptions =
    tenantPickMode === "oauth" ? oauthPickOptions : ambiguousTenants;
  const tenantPickSubtitle =
    tenantPickMode === "oauth" && oauthPickEmail
      ? `Conta ${oauthPickEmail} - escolha onde entrar.`
      : email.trim()
        ? `Conta ${email.trim()} - escolha onde entrar.`
        : tenantAmbiguousInfoMessage();

  return (
    <>
    <AuthShell
      title={
        mustChangePasswordMode
          ? "Definir nova palavra-passe"
          : mfaEnrollmentMode
            ? "Configurar verificação"
            : mfaToken
              ? "Verificação em dois passos"
              : "Entrar"
      }
      subtitle={
        mustChangePasswordMode
          ? "Credenciais temporárias validadas. Por segurança, introduza a sua nova palavra-passe definitiva."
          : mfaEnrollmentMode
            ? "A tua conta exige autenticação em dois passos. Configura a app no telemóvel para continuar."
            : mfaToken
              ? mfaVerificationSubtitle(mfaAppLabel)
              : "Acede à plataforma NexiForma com as tuas credenciais."
      }
    >
      {mustChangePasswordMode ? (
        <form onSubmit={onSubmitChangeRequiredPassword} className="space-y-4">
          <div className="rounded-xl bg-blue-950/30 border border-blue-500/25 px-4 py-3 flex items-start gap-2.5">
            <Shield className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
            <p className="text-sm text-blue-200 leading-relaxed">
              Conta configurada com <strong>credenciais temporárias</strong>. Por motivos de segurança, defina agora a sua nova palavra-passe definitiva para aceder à plataforma.
            </p>
          </div>

          <div>
            <label htmlFor="login-new-password" className={labelClass}>
              Nova palavra-passe
            </label>
            <PasswordInput
              id="login-new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              placeholder="Mínimo 8 caracteres"
              className={inputClass}
              autoComplete="new-password"
            />
          </div>

          <div>
            <label htmlFor="login-confirm-password" className={labelClass}>
              Confirmar nova palavra-passe
            </label>
            <PasswordInput
              id="login-confirm-password"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              required
              minLength={8}
              placeholder="Repita a nova palavra-passe"
              className={inputClass}
              autoComplete="new-password"
            />
          </div>

          {error ? (
            <div role="alert" className="rounded-xl bg-red-950/40 border border-red-500/25 px-4 py-3">
              <p className="text-sm text-red-300">{error}</p>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={busy || newPassword.length < 8 || newPassword !== confirmNewPassword}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold text-sm disabled:opacity-60 transition-all hover:brightness-110 shadow-lg shadow-blue-600/20"
          >
            {busy ? "A gravar nova palavra-passe…" : "Gravar nova palavra-passe e entrar"}
          </button>

          <button
            type="button"
            onClick={resetMustChangePasswordFlow}
            className="w-full text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            Cancelar e voltar ao login
          </button>
        </form>
      ) : mfaEnrollmentMode && mfaToken ? (
        <form onSubmit={onMfaEnrollSubmit} className="space-y-5">
          {credSuccess ? (
            <div className="rounded-xl bg-emerald-950/30 border border-emerald-500/25 px-4 py-3 flex items-start gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
              <p className="text-sm text-emerald-300">Palavra-passe correcta. Configura a verificação para entrar.</p>
            </div>
          ) : null}

          <label htmlFor="login-mfa-app" className={labelClass}>App no telemóvel</label>
          <select
            id="login-mfa-app"
            value={mfaApp}
            onChange={(e) => setMfaApp(e.target.value as MfaAppCode)}
            className={inputClass}
          >
            {MFA_APP_CODES.map((code) => (
              <option key={code} value={code}>{MFA_APP_LABELS[code]}</option>
            ))}
          </select>

          {mfaEnrollSetup ? (
            <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-4 space-y-3">
              <p className="text-sm text-slate-300">
                Lê o QR code com <strong className="text-slate-100">{MFA_APP_LABELS[mfaApp]}</strong> e introduz o código de 6 dígitos.
              </p>
              <div className="flex justify-center rounded-lg bg-white p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mfaEnrollSetup.qrDataUrl} alt="QR code MFA" width={220} height={220} />
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">A preparar QR code…</p>
          )}

          <div className="rounded-xl border border-slate-700/40 bg-slate-800/30 px-4 py-5">
            <TotpInput value={mfaCode} onChange={setMfaCode} disabled={busy} />
          </div>

          {error ? (
            <div role="alert" className="rounded-xl bg-red-950/40 border border-red-500/25 px-4 py-3">
              <p className="text-sm text-red-300">{error}</p>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={busy || mfaCode.length !== 6 || !mfaEnrollSetup}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold text-sm disabled:opacity-60"
          >
            {busy ? "A activar…" : "Ativar e entrar"}
          </button>

          <button type="button" onClick={resetMfaFlow} className="w-full text-sm text-slate-400 hover:text-slate-200">
            Voltar ao login
          </button>
        </form>
      ) : mfaToken ? (
        <form onSubmit={onMfaSubmit} className="space-y-5">
          {credSuccess ? (
            <div className="rounded-xl bg-emerald-950/30 border border-emerald-500/25 px-4 py-3 flex items-start gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
              <p className="text-sm text-emerald-300">
                Palavra-passe correcta. {mfaAppOpenHint(mfaAppLabel)}
              </p>
            </div>
          ) : null}

          <div className="rounded-xl border border-slate-700/40 bg-slate-800/30 px-4 py-5">
            <div className="flex items-center justify-center gap-2 mb-4 text-slate-400">
              <Shield className="h-4 w-4 text-blue-400" />
              <span className="text-xs font-medium uppercase tracking-wider">Código de verificação</span>
            </div>
            <TotpInput value={mfaCode} onChange={setMfaCode} disabled={busy} />
            <p className="mt-3 text-center text-xs text-slate-500">
              {mfaAppLabel ? `Em ${mfaAppLabel}` : "Na app autenticadora"} · 6 dígitos
            </p>
          </div>

          {error ? (
            <div role="alert" className="rounded-xl bg-red-950/40 border border-red-500/25 px-4 py-3">
              <p className="text-sm text-red-300">{error}</p>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={busy || mfaCode.length !== 6}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold text-sm disabled:opacity-60"
          >
            {busy ? "A verificar…" : "Confirmar código"}
          </button>

          <button
            type="button"
            onClick={resetMfaFlow}
            className="w-full text-sm text-slate-400 hover:text-slate-200"
          >
            Voltar ao login
          </button>
        </form>
      ) : (
        <>
          <form onSubmit={onSubmit} className="space-y-4">
            {platformMode ? (
              <p className="rounded-xl border border-purple-500/25 bg-purple-950/20 px-3 py-2 text-xs text-purple-200/90">
                Login da equipa NexiForma (Control Plane).
              </p>
            ) : null}

            <div>
              <label htmlFor="login-email" className={labelClass}>Email</label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(x) => {
                  setEmail(x.target.value);
                  setAmbiguousTenants([]);
                  setPickedTenantSlug("");
                  if (!slugFromUrl) setTenantSlug("");
                  setTenantPickModalOpen(false);
                  setTenantPickMode(null);
                  setError(null);
                  clearPersistedTenantContext();
                }}
                required
                autoComplete="username"
                placeholder="nome@entidade.pt"
                className={inputClass}
              />
            </div>

            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                <label htmlFor="login-password" className={labelClass}>Palavra-passe</label>
                <Link
                  href={platformMode ? platformAuthHref("/login/recuperar") : "/login/recuperar"}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  Esqueceu a palavra-passe?
                </Link>
              </div>
              <PasswordInput
                id="login-password"
                value={password}
                onChange={(x) => setPassword(x.target.value)}
                required
                autoComplete="current-password"
                placeholder="Palavra-passe"
                className={inputClass}
              />
            </div>

            <label className="flex items-start gap-2.5 cursor-pointer rounded-xl border border-slate-700/40 bg-slate-800/20 px-3.5 py-3">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="mt-0.5 rounded border-slate-600 bg-slate-900 accent-blue-500"
              />
              <span className="text-sm text-slate-300">
                Memorizar sessão
                <span className="block text-xs text-slate-500 mt-0.5">
                  Guarda só o email neste dispositivo; a sessão pode durar até 30 dias (cookie
                  seguro). A entidade não fica memorizada.
                </span>
              </span>
            </label>

            {error ? (
              <div role="alert" className="rounded-xl bg-red-950/40 border border-red-500/25 px-4 py-3">
                <p className="text-sm text-red-300">{error}</p>
                {emailNotVerified && !platformMode ? (
                  <button
                    type="button"
                    disabled={busy || !emailNotVerified.tenantSlug}
                    className="mt-3 text-xs font-medium text-blue-300 hover:text-blue-200 underline disabled:opacity-50"
                    onClick={() => {
                      void (async () => {
                        setBusy(true);
                        setResendConfirmMsg(null);
                        try {
                          const res = await fetch("/api/v1/auth/tenant/resend-email-confirmation", {
                            method: "POST",
                            headers: {
                              "Content-Type": "application/json",
                              accept: "application/json",
                            },
                            body: JSON.stringify({
                              email: emailNotVerified.email,
                              tenantSlug: emailNotVerified.tenantSlug,
                            }),
                          });
                          const data = (await res.json().catch(() => ({}))) as { message?: string };
                          setResendConfirmMsg(
                            data.message ??
                              "Se a conta existir e estiver por confirmar, enviámos um novo email.",
                          );
                        } catch {
                          setResendConfirmMsg("Não foi possível pedir o reenvio. Tente mais tarde.");
                        } finally {
                          setBusy(false);
                        }
                      })();
                    }}
                  >
                    Reenviar email de confirmação
                  </button>
                ) : null}
                {resendConfirmMsg ? (
                  <p className="mt-2 text-xs text-slate-400">{resendConfirmMsg}</p>
                ) : null}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={busy}
              className="ui-holographic-btn ui-holographic-btn--solid w-full py-2.5 rounded-xl font-semibold text-sm disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-accent,#2563eb)]/50"
            >
              <span className="ui-holographic-label">
                {busy ? "A verificar credenciais…" : "Entrar"}
              </span>
            </button>

            {!platformMode ? (
              <SocialLoginButtons
                slug={slugFromUrl || (ambiguousTenants.length > 0 ? tenantSlug : "")}
                providers={oauthProviders}
                loading={oauthLoading}
                disabled={busy}
                onError={setError}
                onBeforeStart={() => {
                  // Sobrevive ao redirect OAuth (estado React perde-se).
                  setRememberLogin(rememberMe);
                }}
              />
            ) : null}

            <p className="text-center text-xs text-slate-500">
              {platformMode ? (
                <Link href="/login" className="text-blue-400 hover:text-blue-300">
                  Login de entidade formadora
                </Link>
              ) : (
                <Link href={platformAuthHref("/login")} className="text-blue-400 hover:text-blue-300">
                  Equipa NexiForma
                </Link>
              )}
            </p>
          </form>
        </>
      )}
    </AuthShell>

    <TenantAuthPickModal
      open={tenantPickModalOpen && tenantPickOptions.length > 0}
      options={tenantPickOptions}
      value={pickedTenantSlug || tenantSlug}
      onChange={onTenantPickChange}
      onConfirm={() => void confirmTenantPickModal()}
      onCancel={cancelTenantPickModal}
      busy={busy}
      subtitle={tenantPickSubtitle}
      confirmLabel={tenantPickMode === "oauth" ? "Continuar" : "Entrar"}
    />
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
