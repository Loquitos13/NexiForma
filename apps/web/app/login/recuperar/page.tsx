"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useMemo, useState } from "react";
import { AuthShell } from "@/components/site/auth-shell";
import { PasswordInput } from "@/components/ui/password-input";
import { isDevEnvironment } from "@/lib/ui/site";

const inputClass =
  "w-full px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700/60 text-slate-100 text-sm placeholder:text-slate-500 outline-none transition-all duration-200 focus:border-blue-500/70 focus:ring-2 focus:ring-blue-500/15";
const labelClass = "block text-sm font-medium text-slate-300 mb-1.5";

function TenantForgotPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDev = isDevEnvironment();

  const token = searchParams.get("token")?.trim() ?? "";
  const slugFromUrl = searchParams.get("slug")?.trim() ?? "";

  const [tenantSlug, setTenantSlug] = useState(slugFromUrl || (isDev ? "demo" : ""));
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isResetStep = token.length >= 16;

  const subtitle = useMemo(() => {
    if (isResetStep) {
      return "Define uma nova palavra-passe segura para a tua conta.";
    }
    return "Indica o teu email. Enviaremos um link para redefinir a palavra-passe (válido cerca de 1 hora).";
  }, [isResetStep]);

  async function onRequestLink(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setBusy(true);

    const slug = tenantSlug.trim();
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

    setBusy(true);
    const slug = slugFromUrl || tenantSlug.trim();
    const endpoint = slug ? "/api/auth/tenant/reset-password" : "/api/auth/platform/reset-password";
    const body = slug
      ? { token, tenantSlug: slug, newPassword }
      : { token, newPassword };

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
      setTimeout(() => {
        router.push(slug ? `/login?slug=${encodeURIComponent(slug)}` : "/login");
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
          <Link href="/login" className="text-slate-400 hover:text-slate-200 transition-colors">
            Voltar ao login
          </Link>
        </p>
      }
    >
      {isResetStep ? (
        <form onSubmit={onResetPassword} className="space-y-4">
          {slugFromUrl ? (
            <p className="text-xs text-slate-500">
              Entidade: <span className="text-slate-300">{slugFromUrl}</span>
            </p>
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
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold text-sm hover:shadow-lg hover:shadow-blue-500/20 hover:brightness-110 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {busy ? "A guardar…" : "Guardar palavra-passe"}
          </button>
        </form>
      ) : (
        <form onSubmit={onRequestLink} className="space-y-4">
          <div>
            <label className={labelClass}>Identificador da entidade</label>
            <input
              value={tenantSlug}
              onChange={(x) => setTenantSlug(x.target.value)}
              autoComplete="organization"
              placeholder="ex.: minha-entidade (vazio = equipa NexiForma)"
              className={inputClass}
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
            Em desenvolvimento, o link também aparece no log do servidor API se o email estiver em modo{" "}
            <code className="text-slate-400">log</code>.
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
