"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
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

  const [tenantSlug, setTenantSlug] = useState(searchParams.get("slug") ?? (isDev ? "demo" : ""));
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword !== confirmPassword) {
      setError("As palavras-passe não coincidem.");
      return;
    }

    setBusy(true);
    const slug = tenantSlug.trim();
    const endpoint = slug ? "/api/auth/tenant/forgot-password" : "/api/auth/platform/forgot-password";
    const body = slug
      ? { tenantSlug: slug, email: email.trim(), newPassword }
      : { email: email.trim(), newPassword };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as {
        message?: string | string[];
      };

      if (!res.ok) {
        const msg = Array.isArray(data.message)
          ? data.message.join(", ")
          : typeof data.message === "string"
            ? data.message
            : "Não foi possível actualizar a palavra-passe.";
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
      title="Recuperar palavra-passe"
      subtitle="Define uma nova palavra-passe para a tua conta. A verificação por email estará disponível quando o SMTP estiver configurado."
      footer={
        <p className="mt-5 text-center text-sm text-slate-500">
          <Link href="/login" className="text-slate-400 hover:text-slate-200 transition-colors">
            Voltar ao login
          </Link>
        </p>
      }
    >
      <div className="mb-5 rounded-xl bg-amber-950/30 border border-amber-500/20 px-4 py-3">
        <p className="text-xs text-amber-200/90 leading-relaxed">
          Modo temporário: a palavra-passe é actualizada directamente com o email e o identificador da
          entidade, sem confirmação por email.
        </p>
      </div>

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
          {busy ? "A actualizar…" : "Actualizar palavra-passe"}
        </button>
      </form>
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
