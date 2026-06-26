"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { AuthShell } from "@/components/site/auth-shell";
import { PasswordInput } from "@/components/ui/password-input";
import { setAccessToken } from "@/lib/client/access-token";
import { resolvePostLoginPath } from "@/lib/client/jwt-role";
import { isDevEnvironment } from "@/lib/ui/site";

const inputClass =
  "w-full px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700/60 text-slate-100 text-sm placeholder:text-slate-500 outline-none transition-all duration-200 focus:border-blue-500/70 focus:ring-2 focus:ring-blue-500/15";
const labelClass = "block text-sm font-medium text-slate-300 mb-1.5";

export default function LoginPage() {
  const router = useRouter();
  const [tenantSlug, setTenantSlug] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isDev = isDevEnvironment();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get("slug");
    const next = params.get("next");
    if (slug) setTenantSlug(slug);
    else if (isDev) setTenantSlug("demo");
    if (next) sessionStorage.setItem("nexiforma_login_next", next);
  }, [isDev]);

  async function finishLogin(accessToken?: string) {
    if (accessToken) setAccessToken(accessToken);
    const next = sessionStorage.getItem("nexiforma_login_next");
    sessionStorage.removeItem("nexiforma_login_next");
    router.push(resolvePostLoginPath(accessToken, next));
    router.refresh();
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

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const slug = tenantSlug.trim();
    const endpoint = slug ? "/api/auth/tenant/login" : "/api/auth/platform/login";
    const body = slug
      ? { tenantSlug: slug, email: email.trim(), password }
      : { email: email.trim(), password };

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
        mfaToken?: string;
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

      if (data.mfaRequired && data.mfaToken) {
        setMfaToken(data.mfaToken);
        return;
      }

      await finishLogin(data.accessToken);
    } catch {
      setError("Não foi possível contactar o servidor.");
    } finally {
      setBusy(false);
    }
  }

  async function onMfaSubmit(e: FormEvent) {
    e.preventDefault();
    if (!mfaToken) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/mfa/verify", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mfaToken, code: mfaCode }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string; accessToken?: string };
      if (!res.ok) {
        setError(typeof data.message === "string" ? data.message : "Código MFA inválido.");
        return;
      }
      await finishLogin(data.accessToken);
    } catch {
      setError("Falha na verificação MFA.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title={mfaToken ? "Verificação em dois passos" : "Entrar"}
      subtitle={
        mfaToken
          ? "Introduz o código de 6 dígitos da Microsoft Authenticator ou outra app TOTP."
          : "Acede à plataforma NexiForma com as tuas credenciais."
      }
    >
      {mfaToken ? (
        <form onSubmit={onMfaSubmit} className="space-y-5">
          <div>
            <label className={labelClass}>Código de verificação</label>
            <input
              value={mfaCode}
              onChange={(x) => setMfaCode(x.target.value)}
              required
              minLength={6}
              maxLength={6}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              className={`${inputClass} text-center text-lg tracking-[0.3em] font-mono`}
            />
          </div>

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
            {busy ? "A verificar…" : "Confirmar"}
          </button>

          <button
            type="button"
            onClick={() => { setMfaToken(null); setMfaCode(""); setError(null); }}
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
                  <p>Tenant: slug <code className="text-blue-300">demo</code></p>
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
                onChange={(x) => setTenantSlug(x.target.value)}
                autoComplete="organization"
                placeholder="ex.: minha-entidade (vazio = equipa NexiForma)"
                className={inputClass}
              />
              <p className="mt-1.5 text-xs text-slate-500">
                Utilizadores da entidade formadora preenchem o slug. A equipa NexiForma deixa este campo vazio.
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
                <Link href="/login/recuperar" className="text-xs text-blue-400 hover:text-blue-300">
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
              {busy ? "A entrar…" : "Entrar"}
            </button>
          </form>
        </>
      )}
    </AuthShell>
  );
}
