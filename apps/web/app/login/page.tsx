"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { CheckCircle2, Shield } from "lucide-react";
import { mfaAppOpenHint, mfaVerificationSubtitle, MFA_APP_CODES, MFA_APP_LABELS, type MfaAppCode } from "@nexiforma/shared";
import { AuthShell } from "@/components/site/auth-shell";
import { PasswordInput } from "@/components/ui/password-input";
import { setAccessToken } from "@/lib/client/access-token";
import { refreshViaBffCookies } from "@/lib/client/bff-fetch";
import { resolvePostLoginPath } from "@/lib/client/jwt-role";
import {
  getRememberLogin,
  getSavedEmail,
  persistLoginPreferences,
  persistTenantSlug,
} from "@/lib/client/login-preferences";
import {
  isPlatformAuthMode,
  platformAuthHref,
  resolveTenantSlugForAuth,
} from "@/lib/client/platform-auth-mode";
import { isDevEnvironment } from "@/lib/ui/site";

const inputClass =
  "w-full px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700/60 text-slate-100 text-sm placeholder:text-slate-500 outline-none transition-all duration-200 focus:border-blue-500/70 focus:ring-2 focus:ring-blue-500/15";
const labelClass = "block text-sm font-medium text-slate-300 mb-1.5";

function TotpInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(6, " ").slice(0, 6).split("");

  function setDigit(index: number, char: string) {
    const clean = char.replace(/\D/g, "").slice(-1);
    const next = digits.map((d, i) => (i === index ? clean : d.trim())).join("").slice(0, 6);
    onChange(next);
    if (clean && index < 5) refs.current[index + 1]?.focus();
  }

  function onKeyDown(index: number, key: string) {
    if (key === "Backspace" && !digits[index]?.trim() && index > 0) {
      refs.current[index - 1]?.focus();
    }
  }

  function onPaste(text: string) {
    const clean = text.replace(/\D/g, "").slice(0, 6);
    onChange(clean);
    refs.current[Math.min(clean.length, 5)]?.focus();
  }

  return (
    <div className="flex justify-center gap-2 sm:gap-2.5">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          disabled={disabled}
          value={d.trim()}
          onChange={(e) => setDigit(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e.key)}
          onPaste={(e) => {
            e.preventDefault();
            onPaste(e.clipboardData.getData("text"));
          }}
          className="h-12 w-10 sm:h-14 sm:w-12 rounded-xl border border-slate-600/60 bg-slate-900/90 text-center text-xl font-mono font-semibold text-slate-100 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
        />
      ))}
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
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
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [platformMode, setPlatformMode] = useState(false);
  const isDev = isDevEnvironment();

  useEffect(() => {
    setRememberMe(getRememberLogin());
    const params = new URLSearchParams(window.location.search);
    const platform = isPlatformAuthMode(params);
    setPlatformMode(platform);
    const slug = params.get("slug");
    const next = params.get("next");
    const emailParam = params.get("email");
    setTenantSlug(
      resolveTenantSlugForAuth(params, { slugFromUrl: slug ?? undefined, isDev }),
    );
    if (emailParam) setEmail(emailParam);
    else {
      const savedEmail = getSavedEmail();
      if (savedEmail) setEmail(savedEmail);
    }
    if (next) sessionStorage.setItem("nexiforma_login_next", next);
    else sessionStorage.removeItem("nexiforma_login_next");
  }, [isDev]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await refreshViaBffCookies();
        if (!cancelled && token) {
          await finishLogin(token);
          return;
        }
      } catch {
        /* sem sessão activa */
      } finally {
        if (!cancelled) setCheckingSession(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function finishLogin(accessToken?: string) {
    if (accessToken) setAccessToken(accessToken);
    sessionStorage.removeItem("nexiforma_login_next");
    router.push(resolvePostLoginPath(accessToken, null));
    router.refresh();
  }

  function saveLoginPreferences() {
    const slug = tenantSlug.trim();
    if (slug) persistTenantSlug(slug);
    persistLoginPreferences({
      remember: rememberMe,
      tenantSlug: slug,
      email: email.trim(),
    });
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sso = params.get("sso");
    const token = params.get("token");
    if (sso === "ok" && token) {
      void finishLogin(token);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [router]);

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

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCredSuccess(false);
    setLoginSuccess(false);
    setBusy(true);
    const slug = tenantSlug.trim();
    const endpoint = slug ? "/api/auth/tenant/login" : "/api/auth/platform/login";
    const body = slug
      ? { tenantSlug: slug, email: email.trim(), password, rememberMe }
      : { email: email.trim(), password, rememberMe };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as {
        message?: string | string[];
        accessToken?: string;
        mfaRequired?: boolean;
        mfaEnrollmentRequired?: boolean;
        mfaToken?: string;
        user?: { mfaAppLabel?: string | null };
      };

      if (!res.ok) {
        const msg = Array.isArray(data.message)
          ? data.message.join(", ")
          : typeof data.message === "string"
            ? data.message
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

      setLoginSuccess(true);
      saveLoginPreferences();
      await new Promise((r) => setTimeout(r, 700));
      await finishLogin(data.accessToken);
    } catch {
      setError("Não foi possível contactar o servidor.");
    } finally {
      setBusy(false);
    }
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

  return (
    <AuthShell
      title={mfaEnrollmentMode ? "Configurar verificação" : mfaToken ? "Verificação em dois passos" : "Entrar"}
      subtitle={
        mfaEnrollmentMode
          ? "A tua conta exige autenticação em dois passos. Configura a app no telemóvel para continuar."
          : mfaToken
            ? mfaVerificationSubtitle(mfaAppLabel)
            : "Acede à plataforma NexiForma com as tuas credenciais."
      }
    >
      {mfaEnrollmentMode && mfaToken ? (
        <form onSubmit={onMfaEnrollSubmit} className="space-y-5">
          {credSuccess ? (
            <div className="rounded-xl bg-emerald-950/30 border border-emerald-500/25 px-4 py-3 flex items-start gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
              <p className="text-sm text-emerald-300">Palavra-passe correcta. Configura a verificação para entrar.</p>
            </div>
          ) : null}

          <label className={labelClass}>App no telemóvel</label>
          <select
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
            <div className="rounded-xl bg-red-950/40 border border-red-500/25 px-4 py-3">
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
            <div className="rounded-xl bg-red-950/40 border border-red-500/25 px-4 py-3">
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
          {isDev ? (
            <div className="mb-5 rounded-xl bg-slate-800/40 border border-dashed border-slate-600/40 overflow-hidden">
              <details>
                <summary className="px-4 py-2.5 text-xs text-slate-400 cursor-pointer select-none">
                  Credenciais de desenvolvimento
                </summary>
                <div className="px-4 pb-3 space-y-1 text-xs text-slate-400">
                  <p>
                    Tenant: slug <code className="text-blue-300">demo</code>
                  </p>
                  <p>Equipa NexiForma: deixa o slug vazio</p>
                  <p className="pt-1 text-slate-500">Ver README para credenciais demo por role.</p>
                </div>
              </details>
            </div>
          ) : null}

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className={labelClass}>Identificador da entidade</label>
              <input
                value={tenantSlug}
                onChange={(x) => {
                  setTenantSlug(x.target.value);
                  if (!platformMode) persistTenantSlug(x.target.value);
                }}
                autoComplete="organization"
                placeholder="ex.: minha-entidade (vazio = equipa NexiForma)"
                className={inputClass}
                readOnly={platformMode}
              />
              <p className="mt-1.5 text-xs text-slate-500">
                {platformMode
                  ? "Login da equipa NexiForma (Control Plane) - sem identificador de entidade."
                  : "Utilizadores da entidade formadora preenchem o slug. A equipa NexiForma deixa este campo vazio."}
              </p>
            </div>

            <div>
              <label className={labelClass}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(x) => setEmail(x.target.value)}
                required
                autoComplete="username"
                placeholder="nome@entidade.pt"
                className={inputClass}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className={labelClass}>Palavra-passe</label>
                <Link
                  href={platformMode ? platformAuthHref("/login/recuperar") : "/login/recuperar"}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  Esqueceu a palavra-passe?
                </Link>
              </div>
              <PasswordInput
                value={password}
                onChange={(x) => setPassword(x.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
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
                  Mantém o identificador da entidade e o email; sessão prolongada até 30 dias (cookie seguro).
                </span>
              </span>
            </label>

            {error ? (
              <div className="rounded-xl bg-red-950/40 border border-red-500/25 px-4 py-3">
                <p className="text-sm text-red-300">{error}</p>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold text-sm disabled:opacity-60"
            >
              {busy ? "A verificar credenciais…" : "Entrar"}
            </button>
          </form>
        </>
      )}
    </AuthShell>
  );
}
