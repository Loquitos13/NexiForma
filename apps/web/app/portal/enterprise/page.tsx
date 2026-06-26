"use client";

import { useCallback, useEffect, useState } from "react";
import { Key, Shield, ExternalLink, Copy, Trash2 } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { Alert, Button, Card, CardContent, CardHeader, CardTitle, PageHeader } from "@/components/ui";

type ApiKeyRow = {
  id: string;
  status: string;
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
};

type SsoConfig = {
  enabled: boolean;
  providerLabel?: string;
  issuer?: string;
  clientId?: string;
  scopes?: string[];
  hasClientSecret?: boolean;
};

const inputClass =
  "w-full px-3 py-2 rounded-lg bg-slate-900/80 border border-slate-700/60 text-sm text-slate-200 outline-none focus:border-blue-500/40";

export default function EnterprisePage() {
  const { canManage } = useTenantRole();
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [sso, setSso] = useState<SsoConfig | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [ssoForm, setSsoForm] = useState({
    enabled: false,
    providerLabel: "Azure AD",
    issuer: "",
    clientId: "",
    clientSecret: "",
  });

  const load = useCallback(async () => {
    const [kRes, sRes] = await Promise.all([
      bffFetch("/api/v1/enterprise/api-keys", { headers: { accept: "application/json" } }),
      bffFetch("/api/v1/enterprise/sso", { headers: { accept: "application/json" } }),
    ]);
    if (kRes.ok) setKeys((await kRes.json()) as ApiKeyRow[]);
    if (sRes.ok) {
      const data = (await sRes.json()) as SsoConfig;
      setSso(data);
      setSsoForm((f) => ({
        ...f,
        enabled: data.enabled,
        providerLabel: data.providerLabel ?? "Azure AD",
        issuer: data.issuer ?? "",
        clientId: data.clientId ?? "",
        clientSecret: "",
      }));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createKey() {
    setBusy(true);
    setError(null);
    setNewKey(null);
    const r = await bffFetch("/api/v1/enterprise/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ expiresInDays: 365 }),
    });
    setBusy(false);
    if (!r.ok) {
      setError("Não foi possível criar a chave API.");
      return;
    }
    const data = (await r.json()) as { key: string };
    setNewKey(data.key);
    await load();
  }

  async function revokeKey(id: string) {
    setBusy(true);
    const r = await bffFetch(`/api/v1/enterprise/api-keys/${id}`, { method: "DELETE" });
    setBusy(false);
    if (!r.ok) setError("Erro ao revogar chave.");
    else await load();
  }

  async function saveSso(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMsg(null);
    const r = await bffFetch("/api/v1/enterprise/sso", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify(ssoForm),
    });
    setBusy(false);
    if (!r.ok) {
      setError("Erro ao guardar SSO - verifique issuer, client ID e secret.");
      return;
    }
    setMsg("Configuração SSO guardada.");
    await load();
  }

  if (!canManage) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold text-slate-50">Enterprise</h1>
        <p className="text-sm text-slate-400 mt-2">Apenas gestores podem configurar integrações enterprise.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Enterprise"
        description="API pública, SSO OpenID Connect (Azure AD) e integrações ERP."
      />

      {error ? <Alert variant="error">{error}</Alert> : null}
      {msg ? <Alert variant="success">{msg}</Alert> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="h-4 w-4 text-blue-400" />
            Chaves API
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-400">
            Use no header <code className="text-blue-300">X-Api-Key: nf_live_...</code> em{" "}
            <code className="text-slate-300">/v1/public/v1/*</code>.
          </p>
          <a
            href="/api/v1/docs/openapi.json"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300"
          >
            OpenAPI spec <ExternalLink className="h-3.5 w-3.5" />
          </a>

          {newKey ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
              <p className="text-amber-200 font-medium mb-1">Chave criada - copie agora:</p>
              <code className="break-all text-xs text-slate-200">{newKey}</code>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="mt-2"
                onClick={() => void navigator.clipboard.writeText(newKey)}
              >
                <Copy className="h-3.5 w-3.5" /> Copiar
              </Button>
            </div>
          ) : null}

          <ul className="space-y-2">
            {keys.map((k) => (
              <li
                key={k.id}
                className="flex items-center justify-between rounded-lg border border-slate-700/50 px-3 py-2 text-sm"
              >
                <div>
                  <span className="text-slate-200">{k.status}</span>
                  <span className="text-slate-500 ml-2 text-xs">
                    {new Date(k.createdAt).toLocaleDateString("pt-PT")}
                  </span>
                </div>
                {k.status === "ACTIVE" ? (
                  <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void revokeKey(k.id)}>
                    <Trash2 className="h-3.5 w-3.5" /> Revogar
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>

          <Button type="button" size="sm" disabled={busy} onClick={() => void createKey()}>
            Gerar nova chave
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-violet-400" />
            SSO OpenID Connect
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void saveSso(e)} className="space-y-3">
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={ssoForm.enabled}
                onChange={(e) => setSsoForm((f) => ({ ...f, enabled: e.target.checked }))}
              />
              Activar SSO para este tenant
            </label>
            <input
              className={inputClass}
              placeholder="Nome do provider (ex. Azure AD)"
              value={ssoForm.providerLabel}
              onChange={(e) => setSsoForm((f) => ({ ...f, providerLabel: e.target.value }))}
            />
            <input
              className={inputClass}
              placeholder="Issuer URL (OpenID)"
              value={ssoForm.issuer}
              onChange={(e) => setSsoForm((f) => ({ ...f, issuer: e.target.value }))}
            />
            <input
              className={inputClass}
              placeholder="Client ID"
              value={ssoForm.clientId}
              onChange={(e) => setSsoForm((f) => ({ ...f, clientId: e.target.value }))}
            />
            <input
              className={inputClass}
              type="password"
              placeholder={sso?.hasClientSecret ? "Client secret (deixe vazio para manter)" : "Client secret"}
              value={ssoForm.clientSecret}
              onChange={(e) => setSsoForm((f) => ({ ...f, clientSecret: e.target.value }))}
            />
            <p className="text-xs text-slate-500">
              Redirect URI no IdP: <code>{process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/v1/auth/sso/callback</code>
            </p>
            <Button type="submit" size="sm" disabled={busy}>
              Guardar SSO
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
