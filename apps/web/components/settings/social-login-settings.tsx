"use client";

import { useCallback, useEffect, useState } from "react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { Button } from "@/components/ui";

type SocialLoginConfig = {
  slug?: string;
  google?: { platformConfigured: boolean; enabled: boolean; tenantEnabled: boolean };
  microsoft?: { platformConfigured: boolean; enabled: boolean; tenantEnabled: boolean };
  redirectUri?: string;
};

type Props = {
  /** Endpoint GET/PATCH (default: control-plane exige tenantId na página). */
  endpoint: string;
};

export function SocialLoginSettings({ endpoint }: Props) {
  const [socialLogin, setSocialLogin] = useState<SocialLoginConfig | null>(null);
  const [socialForm, setSocialForm] = useState({ google: true, microsoft: true });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await bffFetch(endpoint, {
      headers: { accept: "application/json" },
    });
    if (!r.ok) return;
    const data = (await r.json()) as SocialLoginConfig;
    setSocialLogin(data);
    setSocialForm({
      google: data.google?.tenantEnabled !== false,
      microsoft: data.microsoft?.tenantEnabled !== false,
    });
  }, [endpoint]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMsg(null);
    const r = await bffFetch(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify(socialForm),
    });
    setBusy(false);
    if (!r.ok) {
      setError("Erro ao guardar login social.");
      return;
    }
    setMsg("Login Google/Microsoft actualizado.");
    await load();
  }

  const anyConfigured =
    socialLogin?.google?.platformConfigured || socialLogin?.microsoft?.platformConfigured;

  return (
    <section className="rounded-2xl bg-slate-900/50 border border-slate-700/30 p-5 space-y-4">
      <div>
        <h2 className="text-base font-semibold text-slate-100">Login Google / Microsoft</h2>
        <p className="text-sm text-slate-400 mt-1">
          Permite entrar com conta Google ou Microsoft (email igual ao da conta NexiForma).
          Configuração reservada ao superadmin da plataforma.
        </p>
      </div>

      {!anyConfigured ? (
        <p className="text-xs text-amber-300/90 rounded-lg border border-amber-500/25 bg-amber-950/20 px-3 py-2">
          A plataforma ainda não tem apps OAuth configuradas. Defina{" "}
          <code className="text-amber-200">AUTH_GOOGLE_*</code> e{" "}
          <code className="text-amber-200">AUTH_MICROSOFT_*</code> no servidor.
        </p>
      ) : null}

      {socialLogin?.redirectUri ? (
        <p className="text-xs text-slate-500">
          Redirect URI (Google Cloud / Azure):{" "}
          <code className="text-slate-300 break-all">{socialLogin.redirectUri}</code>
        </p>
      ) : null}

      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {msg ? <p className="text-sm text-emerald-300">{msg}</p> : null}

      <form onSubmit={(e) => void save(e)} className="space-y-3">
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            className="rounded border-slate-600 bg-slate-900 accent-blue-500"
            checked={socialForm.google}
            disabled={!socialLogin?.google?.platformConfigured}
            onChange={(e) => setSocialForm((f) => ({ ...f, google: e.target.checked }))}
          />
          Google
          {!socialLogin?.google?.platformConfigured ? (
            <span className="text-xs text-slate-500">(não configurado na plataforma)</span>
          ) : null}
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            className="rounded border-slate-600 bg-slate-900 accent-blue-500"
            checked={socialForm.microsoft}
            disabled={!socialLogin?.microsoft?.platformConfigured}
            onChange={(e) => setSocialForm((f) => ({ ...f, microsoft: e.target.checked }))}
          />
          Microsoft
          {!socialLogin?.microsoft?.platformConfigured ? (
            <span className="text-xs text-slate-500">(não configurado na plataforma)</span>
          ) : null}
        </label>
        <Button type="submit" size="sm" disabled={busy || !anyConfigured}>
          Guardar login social
        </Button>
      </form>
    </section>
  );
}
