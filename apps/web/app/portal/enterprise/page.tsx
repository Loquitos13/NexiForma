"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Key, Shield, ExternalLink, Copy, Trash2, Building2 } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { formatDatePt } from "@/lib/calendar-date";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { useTenantEntitlements } from "@/lib/client/use-tenant-entitlements";
import { Alert, Button, Card, CardContent, PageHeader } from "@/components/ui";
import { cn } from "@/lib/ui/cn";

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

type EnterpriseTab = "api" | "sso";

const inputClass =
  "w-full px-3 py-2 rounded-lg bg-slate-900/80 border border-slate-700/60 text-sm text-slate-200 outline-none focus:border-blue-500/40";

export default function EnterprisePage() {
  const { canManage } = useTenantRole();
  const { entitlements } = useTenantEntitlements();
  const hasEnterprise = entitlements?.canAccessEnterpriseFeatures === true;
  const [tab, setTab] = useState<EnterpriseTab>("api");
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
      setSsoForm({
        enabled: data.enabled,
        providerLabel: data.providerLabel ?? "Azure AD",
        issuer: data.issuer ?? "",
        clientId: data.clientId ?? "",
        clientSecret: "",
      });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const ssoDirty = useMemo(() => {
    if (!sso) return false;
    return (
      ssoForm.enabled !== sso.enabled ||
      ssoForm.providerLabel !== (sso.providerLabel ?? "Azure AD") ||
      ssoForm.issuer !== (sso.issuer ?? "") ||
      ssoForm.clientId !== (sso.clientId ?? "") ||
      ssoForm.clientSecret.trim() !== ""
    );
  }, [sso, ssoForm]);

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

  if (!hasEnterprise) {
    return (
      <div className="space-y-6 max-w-3xl">
        <PageHeader
          title="Enterprise"
          description="API pública e autenticação SSO para integrações externas."
        />
        <Card className="border-violet-500/20 bg-gradient-to-br from-violet-950/30 to-slate-900/40">
          <CardContent className="py-8 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/15">
                <Building2 className="h-5 w-5 text-violet-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-100">Plano Enterprise necessário</h2>
                <p className="text-sm text-slate-400 mt-1">
                  Chaves API, SSO OIDC e integrações avançadas estão incluídas no plano Enterprise.
                </p>
              </div>
            </div>
            <ul className="text-sm text-slate-400 space-y-1 list-disc pl-5">
              <li>Chaves API para integrações externas</li>
              <li>Single Sign-On (Azure AD, OIDC)</li>
              <li>Todos os módulos NexiForma incluídos</li>
            </ul>
            <Link href="/portal/billing">
              <Button>Ver planos e subscrição</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Enterprise"
        description="API pública e autenticação SSO para integrações externas."
      />

      {error ? <Alert variant="error">{error}</Alert> : null}
      {msg ? <Alert variant="success">{msg}</Alert> : null}

      <Card>
        <div className="flex border-b border-slate-700/40 px-2 pt-2">
          <button
            type="button"
            onClick={() => setTab("api")}
            className={cn(
              "inline-flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors",
              tab === "api"
                ? "border-b-2 border-violet-500 text-violet-200 bg-slate-900/50"
                : "text-slate-500 hover:text-slate-300",
            )}
          >
            <Key className="h-4 w-4" /> Chaves API
          </button>
          <button
            type="button"
            onClick={() => setTab("sso")}
            className={cn(
              "inline-flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors",
              tab === "sso"
                ? "border-b-2 border-violet-500 text-violet-200 bg-slate-900/50"
                : "text-slate-500 hover:text-slate-300",
            )}
          >
            <Shield className="h-4 w-4" /> SSO OpenID Connect
          </button>
        </div>

        <CardContent className="pt-6">
          {tab === "api" ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-400">
                Use no header <code className="text-blue-300">X-Api-Key: nf_live_...</code> em{" "}
                <code className="text-slate-300">/v1/public/v1/*</code>.
              </p>
              <div className="flex flex-wrap gap-3 text-sm">
                <a
                  href="/api/v1/docs/openapi.json"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300"
                >
                  OpenAPI enterprise <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <a
                  href={`${process.env.NEXT_PUBLIC_API_DOCS_URL ?? "http://localhost:4001"}/formacoes`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300"
                >
                  Swagger formações <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>

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
                      <span className="text-slate-500 ml-2 text-xs">{formatDatePt(k.createdAt)}</span>
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
            </div>
          ) : (
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
                Redirect URI no IdP:{" "}
                <code>{process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/v1/auth/sso/callback</code>
              </p>
              {ssoDirty ? (
                <Button type="submit" size="sm" disabled={busy}>
                  {busy ? "A guardar…" : "Guardar SSO"}
                </Button>
              ) : null}
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
