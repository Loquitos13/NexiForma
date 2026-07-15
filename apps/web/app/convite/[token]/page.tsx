"use client";

import { useParams, useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { AuthShell } from "@/components/site/auth-shell";
import { PasswordInput } from "@/components/ui/password-input";
import {
  persistLoginPreferences,
  persistTenantSlug,
  setRememberLogin,
} from "@/lib/client/login-preferences";

const inputClass =
  "w-full px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700/60 text-slate-100 text-sm placeholder:text-slate-500 outline-none transition-all duration-200 focus:border-blue-500/70 focus:ring-2 focus:ring-blue-500/15";
const labelClass = "block text-sm font-medium text-slate-300 mb-1.5";

export default function AcceptInvitePage() {
  const params = useParams();
  const router = useRouter();
  const token = String(params.token ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/users/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = (await res.json().catch(() => null)) as {
        message?: string | string[];
        tenantSlug?: string;
        email?: string;
      } | null;
      if (!res.ok) {
        const m = Array.isArray(data?.message) ? data.message.join(", ") : data?.message;
        setError(m ?? "Convite invalido ou expirado.");
        return;
      }
      const slug = data?.tenantSlug ?? "";
      if (slug) persistTenantSlug(slug);
      if (data?.email) {
        setRememberLogin(true);
        persistLoginPreferences({
          remember: true,
          tenantSlug: slug,
          email: data.email,
        });
      }
      const q = new URLSearchParams();
      if (slug) q.set("slug", slug);
      if (data?.email) q.set("email", data.email);
      router.push(q.size ? `/login?${q.toString()}` : "/login");
    } catch {
      setError("Nao foi possivel activar a conta. Tenta novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Activar conta"
      subtitle="Define a tua palavra-passe para confirmar o email e activar a conta."
    >
      <form onSubmit={(e) => void submit(e)} className="space-y-4">
        <div>
          <label className={labelClass}>Palavra-passe (min. 8 caracteres)</label>
          <PasswordInput
            className={inputClass}
            minLength={8}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            placeholder="••••••••"
          />
        </div>

        {error ? (
          <div className="flex items-start gap-2.5 rounded-xl bg-red-950/40 border border-red-500/25 px-4 py-3">
            <svg className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-red-300">{error}</p>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold text-sm hover:shadow-lg hover:shadow-blue-500/20 hover:brightness-110 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {busy ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              A activar…
            </>
          ) : (
            "Activar conta"
          )}
        </button>
      </form>
    </AuthShell>
  );
}
