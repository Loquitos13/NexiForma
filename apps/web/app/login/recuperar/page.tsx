"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { Shield } from "lucide-react";
import { TotpInput } from "@/components/auth/totp-input";
import { AuthShell } from "@/components/site/auth-shell";
import { PasswordInput } from "@/components/ui/password-input";
import { getSavedTenantSlug, persistTenantSlug, clearTenantSlug } from "@/lib/client/login-preferences";
import {
  isPlatformAuthMode,
  platformAuthHref,
  resolveTenantSlugForAuth,
} from "@/lib/client/platform-auth-mode";
import { isDevEnvironment } from "@/lib/ui/site";
import { mfaAppOpenHint, mfaVerificationSubtitle } from "@nexiforma/shared";
import { consumeSensitiveUrlParams } from "@/lib/client/sensitive-url";

const inputClass =
  "w-full px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700/60 text-slate-100 text-sm placeholder:text-slate-500 outline-none transition-all duration-200 focus:border-blue-500/70 focus:ring-2 focus:ring-blue-500/15";
const labelClass = "block text-sm font-medium text-slate-300 mb-1.5";

type ResetPreview = {
  valid: boolean;
  mfaRequired: boolean;
  mfaAppLabel?: string;
  emailHint: string;
  tenantSlug?: string;
};

function TenantForgotPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDev = isDevEnvironment();

  const [urlSecrets, setUrlSecrets] = useState({ token: "", slug: "", u: "" });
  useEffect(() => {
    const consumed = consumeSensitiveUrlParams(["token", "slug", "u"]);
    setUrlSecrets((prev) => ({
      token: consumed.token ?? prev.token,
      slug: consumed.slug ?? prev.slug,
      u: consumed.u ?? prev.u,
    }));
  }, []);

  const token = urlSecrets.token;
  const slugFromUrl = urlSecrets.slug;
  const userRef = urlSecrets.u;
  const platformMode = isPlatformAuthMode(searchParams);

  const [tenantSlug, setTenantSlug] = useState(() =>
    resolveTenantSlugForAuth(searchParams, { slugFromUrl: slugFromUrl || undefined, isDev }),
  );
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [preview, setPreview] = useState<ResetPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (platformMode) {
      clearTenantSlug();
      setTenantSlug("");
      return;
    }
    if (slugFromUrl) persistTenantSlug(slugFromUrl);
    else {
      const saved = getSavedTenantSlug();
      if (saved) setTenantSlug(saved);
    }
  }, [slugFromUrl, platformMode]);

  const isResetStep = token.length >= 16;
  const resetSlug = slugFromUrl || preview?.tenantSlug || "";
  const isPlatformReset = isResetStep && !resetSlug;

  useEffect(() => {
    if (!isResetStep) return;
    let cancelled = false;
    setPreviewLoading(true);
    setPreviewError(null);
    (async () => {
      const endpoint = resetSlug || slugFromUrl
        ? "/api/auth/tenant/reset-password/preview"
        : "/api/auth/platform/reset-password/preview";
      const body: Record<string, string> = { token };
      if (userRef) body.userRef = userRef;
      const slugForPreview = resetSlug || slugFromUrl;
      if (slugForPreview) body.tenantSlug = slugForPreview;
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = (await res.json().catch(() => ({}))) as ResetPreview & { message?: string };
        if (!res.ok) {
          if (!cancelled) {
            setPreviewError(typeof data.message === "string" ? data.message : "Link inválido ou expirado.");
          }
          return;
        }
        if (!cancelled) setPreview(data);
      } catch {
        if (!cancelled) setPreviewError("Não foi possível validar o link.");
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isResetStep, token, userRef, slugFromUrl, resetSlug]);

  const subtitle = useMemo(() => {
    if (isResetStep) {
      if (preview?.mfaRequired) {
        return preview.mfaAppLabel
          ? `Confirma com o código em ${preview.mfaAppLabel} e define a nova palavra-passe.`
          : "Confirma com o código da app autenticadora e define a nova palavra-passe.";
      }
      return "Define uma nova palavra-passe segura para a tua conta.";
    }
    return "Indica o teu email. Enviaremos um link para redefinir a palavra-passe (válido cerca de 1 hora).";
  }, [isResetStep, preview?.mfaRequired]);

  async function onRequestLink(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setBusy(true);

    const slug = platformMode ? "" : tenantSlug.trim();
    const endpoint = slug ? "/api/auth/tenant/forgot-password" : "/api/auth/platform/forgot-password";
    const body = slug
      ? { tenantSlug: slug, email: email.trim() }
      : { email: email.trim() };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string | string[] };

      if (!res.ok) {
        const msg = Array.isArray(data.message)
          ? data.message.join(", ")
          : typeof data.message === "string"
            ? data.message
            : "Não foi possível processar o pedido.";
        setError(msg);
        return;
      }

      setSuccess(
        typeof data.message === "string"
          ? data.message
          : "Se existir uma conta com esse email, enviámos instruções. Verifica a caixa de entrada (e spam).",
      );
    } catch {
      setError("Não foi possível contactar o servidor.");
    } finally {
      setBusy(false);
    }
  }

  async function onResetPassword(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword !== confirmPassword) {
      setError("As palavras-passe não coincidem.");
      return;
    }

    if (preview?.mfaRequired && mfaCode.length !== 6) {
      setError("Introduz o código de 6 dígitos da app autenticadora.");
      return;
    }

    setBusy(true);
    const slug = resetSlug;
    const endpoint = slug ? "/api/auth/tenant/reset-password" : "/api/auth/platform/reset-password";
    const body: Record<string, string> = { token, newPassword };
    if (slug) body.tenantSlug = slug;
    if (userRef) body.userRef = userRef;
    if (preview?.mfaRequired) body.mfaCode = mfaCode;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string | string[] };

      if (!res.ok) {
        const msg = Array.isArray(data.message)
          ? data.message.join(", ")
          : typeof data.message === "string"
            ? data.message
            : "Link inválido ou expirado.";
        setError(msg);
        return;
      }

      const okMsg =
        typeof data.message === "string"
          ? data.message
          : "Palavra-passe actualizada. Podes iniciar sessão.";
      setSuccess(okMsg);
      if (slug) persistTenantSlug(slug);
      setTimeout(() => {
        router.push(slug ? `/login?slug=${encodeURIComponent(slug)}` : platformAuthHref("/login"));
      }, 1500);
    } catch {
      setError("Não foi possível contactar o servidor.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title={isResetStep ? "Nova palavra-passe" : "Recuperar palavra-passe"}
      subtitle={subtitle}
      footer={
        <p className="mt-5 text-center text-sm text-slate-500">
          <Link href={platformMode ? platformAuthHref("/login") : "/login"} className="text-slate-400 hover:text-slate-200 transition-colors">
            Voltar ao login
          </Link>
        </p>
      }
    >
      {isResetStep ? (
        previewLoading ? (
          <p className="text-sm text-slate-500 text-center py-6">A validar link…</p>
        ) : previewError ? (
          <div className="rounded-xl bg-red-950/40 border border-red-500/25 px-4 py-3">
            <p className="text-sm text-red-300">{previewError}</p>
          </div>
        ) : (
          <form onSubmit={onResetPassword} className="space-y-4">
            {preview?.emailHint ? (
              <p className="text-xs text-slate-500">
                Conta: <span className="text-slate-300">{preview.emailHint}</span>
                {resetSlug && !isPlatformReset ? (
                  <>
                    {" "}
                    · Entidade: <span className="text-slate-300">{resetSlug}</span>
                  </>
                ) : null}
              </p>
            ) : null}

            {preview?.mfaRequired ? (
              <div className="rounded-xl border border-slate-700/40 bg-slate-800/30 px-4 py-5">
                <div className="flex items-center justify-center gap-2 mb-4 text-slate-400">
                  <Shield className="h-4 w-4 text-blue-400" />
                  <span className="text-xs font-medium uppercase tracking-wider">Código de verificação</span>
                </div>
                <p className="text-sm text-slate-300 text-center mb-4">
                  {mfaAppOpenHint(preview.mfaAppLabel ?? null)}
                </p>
                <TotpInput value={mfaCode} onChange={setMfaCode} disabled={busy} />
              </div>
            ) : null}

            <div>
              <label className={labelClass}>Nova palavra-passe</label>
              <PasswordInput
                value={newPassword}
                onChange={(x) => setNewPassword(x.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="••••••••"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Confirmar palavra-passe</label>
              <PasswordInput
                value={confirmPassword}
                onChange={(x) => setConfirmPassword(x.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="••••••••"
                className={inputClass}
              />
            </div>

            {error ? (
              <div className="flex items-start gap-2.5 rounded-xl bg-red-950/40 border border-red-500/25 px-4 py-3">
                <p className="text-sm text-red-300">{error}</p>
              </div>
            ) : null}

            {success ? (
              <div className="flex items-start gap-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/25 px-4 py-3">
                <p className="text-sm text-emerald-300">{success}</p>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={busy || (preview?.mfaRequired && mfaCode.length !== 6)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold text-sm hover:shadow-lg hover:shadow-blue-500/20 hover:brightness-110 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {busy ? "A guardar…" : "Guardar palavra-passe"}
            </button>
          </form>
        )
      ) : (
        <form onSubmit={onRequestLink} className="space-y-4">
          {platformMode ? (
            <p className="rounded-xl border border-purple-500/25 bg-purple-950/20 px-3 py-2 text-xs text-purple-200/90">
              Recuperação da conta super-admin (equipa NexiForma).
            </p>
          ) : null}
          <div>
            <label className={labelClass}>Identificador da entidade</label>
            <input
              value={tenantSlug}
              onChange={(x) => setTenantSlug(x.target.value)}
              autoComplete="organization"
              placeholder="ex.: minha-entidade (vazio = equipa NexiForma)"
              className={inputClass}
              readOnly={platformMode}
            />
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

          {error ? (
            <div className="flex items-start gap-2.5 rounded-xl bg-red-950/40 border border-red-500/25 px-4 py-3">
              <p className="text-sm text-red-300">{error}</p>
            </div>
          ) : null}

          {success ? (
            <div className="flex items-start gap-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/25 px-4 py-3">
              <p className="text-sm text-emerald-300">{success}</p>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold text-sm hover:shadow-lg hover:shadow-blue-500/20 hover:brightness-110 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {busy ? "A enviar…" : "Enviar link de recuperação"}
          </button>

          <p className="text-xs text-slate-500 leading-relaxed">
            Contas com verificação em dois passos precisam do código da app registada ao usar o link.
          </p>
        </form>
      )}
    </AuthShell>
  );
}

export default function TenantForgotPasswordPage() {
  return (
    <Suspense>
      <TenantForgotPasswordForm />
    </Suspense>
  );
}
