"use client";

import { useEffect, useState, type FormEvent } from "react";
import { KeyRound, LogOut, ShieldAlert } from "lucide-react";
import { getAccessToken, setAccessToken } from "@/lib/client/access-token";
import { decodeJwtPayload } from "@/lib/client/jwt-role";
import { PasswordInput } from "@/components/ui/password-input";
import { logoutSession } from "@/lib/client/logout";
import { parseApiError } from "@/lib/ui/backoffice";

export function MustChangePasswordModal() {
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const check = () => {
      const token = getAccessToken();
      const payload = decodeJwtPayload(token);
      if (payload?.mustChangePassword && payload.kind === "tenant") {
        setOpen(true);
      } else {
        setOpen(false);
      }
    };
    check();
    const interval = setInterval(check, 3000);
    return () => clearInterval(interval);
  }, []);

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!currentPassword) {
      setError("Introduza a sua palavra-passe atual (temporária).");
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      setError("A nova palavra-passe deve ter pelo menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("As palavras-passe introduzidas não coincidem.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const token = getAccessToken();
      const res = await fetch("/api/auth/tenant/change-required-password", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      if (!res.ok) {
        setError(await parseApiError(res));
        return;
      }

      const data = (await res.json()) as { accessToken?: string };
      if (data.accessToken) {
        setAccessToken(data.accessToken);
      }
      setOpen(false);
      window.location.reload();
    } catch {
      setError("Falha de rede ao alterar a palavra-passe.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-purple-500/25 shadow-2xl p-6 space-y-5 text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3 border-b border-purple-500/15 pb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/30">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-50">Definir nova palavra-passe</h2>
            <p className="text-xs text-slate-400">Credenciais temporárias detetadas</p>
          </div>
        </div>

        <div className="rounded-xl bg-purple-950/30 border border-purple-500/20 p-3 flex items-start gap-2.5">
          <ShieldAlert className="h-4 w-4 text-purple-400 mt-0.5 shrink-0" />
          <p className="text-xs text-purple-200 leading-relaxed">
            A sua conta foi configurada com uma <strong>palavra-passe temporária</strong>. Por motivos de segurança, é obrigatório definir uma nova palavra-passe definitiva antes de aceder às funcionalidades do portal.
          </p>
        </div>

        {error ? (
          <div className="rounded-xl bg-red-950/40 border border-red-500/25 p-3 text-xs text-red-300">
            {error}
          </div>
        ) : null}

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Palavra-passe atual (temporária) *
            </label>
            <PasswordInput
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Palavra-passe temporária"
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-sm placeholder:text-slate-500 outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Nova palavra-passe *
            </label>
            <PasswordInput
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              required
              minLength={8}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-sm placeholder:text-slate-500 outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Confirmar nova palavra-passe *
            </label>
            <PasswordInput
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repita a nova palavra-passe"
              required
              minLength={8}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-sm placeholder:text-slate-500 outline-none focus:border-purple-500"
            />
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <button
              type="submit"
              disabled={busy || !currentPassword || newPassword.length < 8 || newPassword !== confirmPassword}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-sm disabled:opacity-50 transition-all shadow-lg shadow-purple-600/25"
            >
              {busy ? "A gravar nova palavra-passe…" : "Gravar nova palavra-passe e continuar"}
            </button>

            <button
              type="button"
              onClick={async () => {
                await logoutSession();
                window.location.href = "/login";
              }}
              className="w-full py-2 rounded-xl border border-slate-700/60 hover:bg-slate-800 text-slate-400 text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
            >
              <LogOut className="h-3.5 w-3.5" />
              Terminar sessão
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
