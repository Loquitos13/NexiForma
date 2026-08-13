"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, KeyRound, ShieldAlert, Building2, User } from "lucide-react";
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

type InviteInfo = {
  email: string;
  displayName?: string | null;
  role: string;
  tenantSlug: string;
  tenantLegalName?: string | null;
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Gestor da Entidade",
  COORDENADOR: "Coordenador Pedagógico",
  GESTOR_FORMACAO: "Gestor de Formação",
  ADMINISTRATIVO: "Administrativo",
  FORMADOR: "Formador",
  FORMANDO: "Formando",
  AUDITOR: "Auditor / DGERT",
};

export default function AcceptInvitePage() {
  const params = useParams();
  const router = useRouter();
  const token = String(params.token ?? "");

  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoadingInfo(false);
      return;
    }
    let isMounted = true;
    async function loadInfo() {
      try {
        const res = await fetch(
          `/api/public/users/invite-info/${encodeURIComponent(token)}`,
          {
          headers: { accept: "application/json" },
        },
        );
        if (!res.ok) {
          if (isMounted) {
            setLoadingInfo(false);
          }
          return;
        }
        const data = (await res.json()) as InviteInfo;
        if (isMounted) {
          setInviteInfo(data);
          setLoadingInfo(false);
        }
      } catch {
        if (isMounted) setLoadingInfo(false);
      }
    }
    void loadInfo();
    return () => {
      isMounted = false;
    };
  }, [token]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!password || password.length < 8) {
      setError("A palavra-passe deve ter no mínimo 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("As palavras-passe introduzidas não coincidem.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/public/users/accept-invite", {
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
        setError(
          res.status === 401
            ? "Sessão inválida interferiu no convite. Tente numa janela privada ou limpe cookies do site."
            : m ?? "Convite inválido ou expirado.",
        );
        return;
      }

      setSuccess(true);
      const slug = data?.tenantSlug ?? inviteInfo?.tenantSlug ?? "";
      const email = data?.email ?? inviteInfo?.email ?? "";

      if (slug) persistTenantSlug(slug);
      if (email) {
        setRememberLogin(true);
        persistLoginPreferences({
          remember: true,
          tenantSlug: slug,
          email,
        });
      }

      await new Promise((r) => setTimeout(r, 1200));
      const q = new URLSearchParams();
      if (slug) q.set("slug", slug);
      if (email) q.set("email", email);
      router.push(q.size ? `/login?${q.toString()}` : "/login");
    } catch {
      setError("Não foi possível ativar a conta. Verifique a ligação e tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  if (success) {
    return (
      <AuthShell title="Conta ativada" subtitle="A redirecionar para a página de início de sessão…">
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 ring-2 ring-emerald-500/30">
            <CheckCircle2 className="h-8 w-8 text-emerald-400" />
          </div>
          <p className="text-sm text-emerald-300 font-medium">
            A sua conta foi ativada e a palavra-passe gravada com sucesso!
          </p>
          <div className="h-1 w-32 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full w-full animate-pulse rounded-full bg-emerald-500/60" />
          </div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Ativar conta"
      subtitle="Defina a sua palavra-passe para confirmar o endereço de email e começar a usar a plataforma."
    >
      {inviteInfo ? (
        <div className="mb-5 rounded-xl bg-slate-900/90 border border-blue-500/20 p-3.5 space-y-2 text-xs w-full overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-slate-800/80 pb-2">
            <div className="flex items-center gap-2 text-slate-300 min-w-0">
              <Building2 className="h-4 w-4 text-blue-400 shrink-0" />
              <span className="text-slate-400 shrink-0">Entidade:</span>
              <strong className="text-slate-100 font-semibold truncate">
                {inviteInfo.tenantLegalName || inviteInfo.tenantSlug}
              </strong>
            </div>
            {inviteInfo.role ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/25 text-blue-300 text-[11px] font-medium shrink-0">
                {ROLE_LABELS[inviteInfo.role] ?? inviteInfo.role}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2 text-slate-300 min-w-0 pt-0.5">
            <User className="h-4 w-4 text-indigo-400 shrink-0" />
            <span className="text-slate-400 shrink-0">Conta:</span>
            <span className="text-slate-200 font-mono break-all truncate">{inviteInfo.email}</span>
          </div>
        </div>
      ) : null}

      <form onSubmit={(e) => void submit(e)} className="space-y-4">
        <div>
          <label className={labelClass}>Nova palavra-passe (mínimo 8 caracteres)</label>
          <PasswordInput
            className={inputClass}
            minLength={8}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            placeholder="Mínimo 8 caracteres"
          />
        </div>

        <div>
          <label className={labelClass}>Confirmar nova palavra-passe</label>
          <PasswordInput
            className={inputClass}
            minLength={8}
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            placeholder="Repita a palavra-passe"
          />
        </div>

        {error ? (
          <div className="flex items-start gap-2.5 rounded-xl bg-red-950/40 border border-red-500/25 px-4 py-3">
            <ShieldAlert className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
            <p className="text-sm text-red-300 leading-snug">{error}</p>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={busy || password.length < 8 || password !== confirmPassword}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold text-sm hover:shadow-lg hover:shadow-blue-500/20 hover:brightness-110 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {busy ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              A ativar conta…
            </>
          ) : (
            <>
              <KeyRound className="h-4 w-4" />
              Ativar conta e gravar palavra-passe
            </>
          )}
        </button>
      </form>
    </AuthShell>
  );
}
