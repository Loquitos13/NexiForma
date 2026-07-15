"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { bffFetch } from "@/lib/client/bff-fetch";
import { platformAuthHref } from "@/lib/client/platform-auth-mode";
import { parseApiError } from "@/lib/ui/backoffice";
import { Alert, Button, Card, CardContent, CardHeader, CardTitle, PageHeader } from "@/components/ui";

type PlatformAccount = {
  id: string;
  email: string;
  displayName: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

const inputClass =
  "w-full rounded-lg border border-purple-500/20 bg-slate-900/80 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 outline-none focus:border-purple-500/50";

export default function PlataformaContaPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [initialEmail, setInitialEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await bffFetch("/api/v1/control-plane/account", {
      headers: { accept: "application/json" },
    });
    setLoading(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    const data = (await res.json()) as PlatformAccount;
    setEmail(data.email);
    setInitialEmail(data.email);
    setDisplayName(data.displayName ?? "");
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMsg(null);

    const emailTrimmed = email.trim().toLowerCase();
    const emailChanged = emailTrimmed !== initialEmail.trim().toLowerCase();

    if (emailChanged && !currentPassword.trim()) {
      setBusy(false);
      setError("Indique a palavra-passe actual para alterar o email.");
      return;
    }

    const body: Record<string, string> = {
      email: emailTrimmed,
    };
    if (displayName.trim()) {
      body.displayName = displayName.trim();
    } else {
      body.displayName = "";
    }
    if (newPassword.trim()) {
      body.newPassword = newPassword;
      body.currentPassword = currentPassword;
    } else if (emailChanged) {
      body.currentPassword = currentPassword;
    }

    const res = await bffFetch("/api/v1/control-plane/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);

    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }

    const data = (await res.json()) as { account: PlatformAccount; reauthRequired: boolean };
    setEmail(data.account.email);
    setInitialEmail(data.account.email);
    setDisplayName(data.account.displayName ?? "");
    setCurrentPassword("");
    setNewPassword("");

    if (data.reauthRequired) {
      setMsg("Dados actualizados. Inicie sessão novamente para aplicar email ou palavra-passe.");
      setTimeout(() => router.push(platformAuthHref("/login")), 2500);
      return;
    }

    setMsg("Conta actualizada com sucesso.");
  }

  if (loading) {
    return <p className="text-sm text-slate-500">A carregar conta…</p>;
  }

  return (
    <>
      <PageHeader
        title="Conta"
        description="Actualize o email, nome de apresentação ou palavra-passe do super-admin."
      />

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}
      {msg && <Alert variant="success" className="mb-4">{msg}</Alert>}

      <Card className="border-purple-500/20">
        <CardHeader>
          <CardTitle>Dados da conta</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void save(e)} className="space-y-5 max-w-lg">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-slate-400">
                Email <span className="text-red-400">*</span>
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="displayName" className="mb-1.5 block text-xs font-medium text-slate-400">
                Nome de apresentação
              </label>
              <input
                id="displayName"
                type="text"
                autoComplete="name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Opcional"
                className={inputClass}
              />
            </div>

            <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-4 space-y-3">
              <p className="text-xs font-medium text-slate-400">
                Palavra-passe actual
                {email.trim().toLowerCase() !== initialEmail.trim().toLowerCase() ? (
                  <span className="text-red-400"> *</span>
                ) : null}
                {newPassword.trim() ? <span className="text-red-400"> *</span> : null}
              </p>
              <div>
                <label htmlFor="currentPassword" className="mb-1.5 block text-xs text-slate-500">
                  Obrigatória para alterar email ou palavra-passe
                </label>
                <input
                  id="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="newPassword" className="mb-1.5 block text-xs text-slate-500">
                  Nova palavra-passe (opcional)
                </label>
                <input
                  id="newPassword"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <Button type="submit" disabled={busy || !email.trim()}>
              {busy ? "A guardar…" : "Guardar alterações"}
            </Button>
            <p className="text-xs text-slate-500">
              Esqueceu a palavra-passe?{" "}
              <Link href={platformAuthHref("/login/recuperar")} className="text-purple-400 hover:underline">
                Recuperar acesso
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
