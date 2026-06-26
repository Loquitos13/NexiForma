"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { bffFetch } from "@/lib/client/bff-fetch";
import { PageContentSkeleton } from "@/components/ui/page-skeleton";

type TenantDetail = {
  id: string; slug: string; legalName: string; nif: string; status: string;
  _count: { users: number; acoesFormacao: number; formandos: number; sessoesFormacao: number };
  subscriptions: { status: string; plan: { name: string; code: string } }[];
  subscriptionKeys: { id: string; keyPrefix: string; status: string; expiresAt: string | null }[];
};

type TenantUser = { id: string; email: string; displayName: string | null; role: string };

const inputClass = "w-full px-3 py-2 rounded-lg bg-[#0c0a14] border border-purple-500/15 text-sm text-slate-200 placeholder:text-slate-600 outline-none focus:border-purple-500/40 transition-colors";
const btnPrimaryClass = "px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium transition-colors";
const btnSecondaryClass = "px-3.5 py-2 rounded-lg border border-purple-500/20 text-purple-300 hover:bg-purple-500/10 disabled:opacity-50 text-sm font-medium transition-colors";

export default function TenantDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [impersonateUserId, setImpersonateUserId] = useState("");
  const [impersonateReason, setImpersonateReason] = useState("Suporte tecnico");
  const [impersonateReadOnly, setImpersonateReadOnly] = useState(true);
  const [impBusy, setImpBusy] = useState(false);
  const [intRows, setIntRows] = useState<{ provider: string; mode: string; config: Record<string, string> | null }[]>([]);
  const [intStatus, setIntStatus] = useState<{
    zoom: { ready: boolean; missing: string[] };
    teams: { ready: boolean; missing: string[]; m365TenantId?: string | null };
    platformTeamsAppConfigured?: boolean;
  } | null>(null);
  const [teamsDraft, setTeamsDraft] = useState({ tenantId: "", organizerId: "" });
  const [zoomDraft, setZoomDraft] = useState({ accountId: "", clientId: "", clientSecret: "", userId: "" });
  const [intBusy, setIntBusy] = useState(false);
  const [consentUrl, setConsentUrl] = useState<string | null>(null);

  const loadIntegracoes = useCallback(async () => {
    const [listR, statusR] = await Promise.all([
      bffFetch(`/api/v1/control-plane/tenants/${id}/integracoes`, { headers: { accept: "application/json" } }),
      bffFetch(`/api/v1/control-plane/tenants/${id}/integracoes/oauth/status`, { headers: { accept: "application/json" } }),
    ]);
    if (listR.ok) {
      const list = (await listR.json()) as { provider: string; mode: string; config: Record<string, string> | null }[];
      setIntRows(list);
      const teams = list.find((r) => r.provider === "TEAMS")?.config ?? {};
      const zoom = list.find((r) => r.provider === "ZOOM")?.config ?? {};
      setTeamsDraft({ tenantId: String(teams.tenantId ?? ""), organizerId: String(teams.organizerId ?? "") });
      setZoomDraft({ accountId: String(zoom.accountId ?? ""), clientId: String(zoom.clientId ?? ""), clientSecret: "", userId: String(zoom.userId ?? "") });
    }
    if (statusR.ok) setIntStatus((await statusR.json()) as typeof intStatus);
  }, [id]);

  const load = useCallback(async () => {
    const [tenantR, usersR] = await Promise.all([
      bffFetch(`/api/v1/control-plane/tenants/${id}`, { headers: { accept: "application/json" } }),
      bffFetch(`/api/v1/control-plane/tenants/${id}/users`, { headers: { accept: "application/json" } }),
    ]);
    if (!tenantR.ok) { setError(`HTTP ${tenantR.status}`); return; }
    setTenant((await tenantR.json()) as TenantDetail);
    if (usersR.ok) {
      const list = (await usersR.json()) as TenantUser[];
      setUsers(list);
      if (list.length) setImpersonateUserId((prev) => prev || list[0].id);
    }
    await loadIntegracoes();
  }, [id, loadIntegracoes]);

  useEffect(() => { void load(); }, [load]);

  async function setStatus(status: string) {
    const r = await bffFetch(`/api/v1/control-plane/tenants/${id}/status`, {
      method: "PATCH", headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!r.ok) { setError(`HTTP ${r.status}`); return; }
    setMsg(`Estado actualizado para ${status}.`);
    await load();
  }

  async function personificar() {
    if (!impersonateUserId || !impersonateReason.trim()) return;
    setImpBusy(true); setError(null);
    const r = await bffFetch("/api/auth/impersonation/start", {
      method: "POST", headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ tenantId: id, targetUserId: impersonateUserId, reason: impersonateReason.trim(), readOnly: impersonateReadOnly }),
    });
    setImpBusy(false);
    if (!r.ok) { const d = (await r.json().catch(() => null)) as { message?: string } | null; setError(d?.message ?? `HTTP ${r.status}`); return; }
    router.push("/portal"); router.refresh();
  }

  async function saveTeamsIntegracao() {
    setIntBusy(true); setError(null);
    const r = await bffFetch(`/api/v1/control-plane/tenants/${id}/integracoes`, {
      method: "POST", headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ provider: "TEAMS", mode: "OAUTH", config: teamsDraft }),
    });
    setIntBusy(false);
    if (!r.ok) { const d = (await r.json().catch(() => null)) as { message?: string } | null; setError(d?.message ?? `Integracao Teams: HTTP ${r.status}`); return; }
    setMsg("Microsoft 365 ligado a este tenant.");
    await loadIntegracoes();
  }

  async function saveZoomIntegracao() {
    setIntBusy(true); setError(null);
    const cfg = { ...zoomDraft }; if (!cfg.clientSecret) delete (cfg as { clientSecret?: string }).clientSecret;
    const r = await bffFetch(`/api/v1/control-plane/tenants/${id}/integracoes`, {
      method: "POST", headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ provider: "ZOOM", mode: "OAUTH", config: cfg }),
    });
    setIntBusy(false);
    if (!r.ok) { const d = (await r.json().catch(() => null)) as { message?: string } | null; setError(d?.message ?? `Integracao Zoom: HTTP ${r.status}`); return; }
    setMsg("Zoom ligado a este tenant.");
    await loadIntegracoes();
  }

  async function testarIntegracao(provider: "ZOOM" | "TEAMS") {
    setIntBusy(true); setError(null);
    const r = await bffFetch(`/api/v1/control-plane/tenants/${id}/integracoes/testar?provider=${provider}`, { method: "POST", headers: { accept: "application/json" } });
    setIntBusy(false);
    if (!r.ok) { const d = (await r.json().catch(() => null)) as { message?: string } | null; setError(d?.message ?? `HTTP ${r.status}`); return; }
    setMsg(((await r.json()) as { message?: string }).message ?? `${provider} OK`);
  }

  async function gerarConsentUrl() {
    if (!teamsDraft.tenantId.trim()) { setError("Indica o Azure Tenant ID do cliente."); return; }
    const r = await bffFetch(`/api/v1/control-plane/tenants/${id}/integracoes/microsoft/admin-consent-url?m365TenantId=${encodeURIComponent(teamsDraft.tenantId.trim())}`, { headers: { accept: "application/json" } });
    if (!r.ok) { setError(`Consent URL: HTTP ${r.status}`); return; }
    setConsentUrl(((await r.json()) as { url: string }).url);
  }

  async function gerarChave() {
    const r = await bffFetch(`/api/v1/control-plane/tenants/${id}/subscription-keys`, {
      method: "POST", headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ expiresInDays: 365 }),
    });
    if (!r.ok) { setError(`HTTP ${r.status}`); return; }
    const data = (await r.json()) as { key?: string };
    setNewKey(data.key ?? null);
    setMsg("Chave de subscricao criada.");
    await load();
  }

  if (!tenant && !error) {
    return <PageContentSkeleton variant="detail" />;
  }

  return (
    <div className="max-w-4xl space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-50">{tenant?.legalName ?? "..."}</h1>
        <p className="text-sm text-slate-500 mt-1">
          <code className="text-purple-300">{tenant?.slug}</code> · NIF {tenant?.nif} ·{" "}
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-purple-500/10 text-purple-300 border border-purple-500/20">
            {tenant?.status}
          </span>
        </p>
      </div>

      {error ? <div className="flex items-start gap-2.5 rounded-xl bg-red-950/40 border border-red-500/25 px-4 py-3"><p className="text-sm text-red-300">{error}</p></div> : null}
      {msg ? <div className="flex items-start gap-2.5 rounded-xl bg-green-950/30 border border-green-500/25 px-4 py-3"><p className="text-sm text-green-300">{msg}</p></div> : null}
      {newKey ? (
        <div className="rounded-xl bg-yellow-500/10 border border-yellow-500/20 px-4 py-3">
          <p className="text-sm font-medium text-yellow-200">Chave (copiar agora):</p>
          <code className="text-xs text-yellow-300 break-all mt-1 block">{newKey}</code>
        </div>
      ) : null}

      {tenant ? (
        <>
          {/* Metrics */}
          <div className="rounded-2xl bg-[#0c0a14]/80 border border-purple-500/10 p-5">
            <h2 className="text-sm font-semibold text-purple-200 mb-3">Metricas</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <MiniStat label="Utilizadores" value={tenant._count.users} />
              <MiniStat label="Accoes" value={tenant._count.acoesFormacao} />
              <MiniStat label="Formandos" value={tenant._count.formandos} />
              <MiniStat label="Sessoes" value={tenant._count.sessoesFormacao} />
            </div>
            <p className="text-xs text-slate-500 mt-3">
              Subscricao: {tenant.subscriptions[0]?.plan.name ?? "–"} ({tenant.subscriptions[0]?.status ?? "–"})
            </p>
          </div>

          {/* Status */}
          <div className="rounded-2xl bg-[#0c0a14]/80 border border-purple-500/10 p-5">
            <h2 className="text-sm font-semibold text-purple-200 mb-3">Estado do tenant</h2>
            <div className="flex flex-wrap gap-2">
              {["ACTIVE", "TRIAL", "SUSPENDED", "ARCHIVED"].map((s) => (
                <button key={s} type="button" onClick={() => void setStatus(s)}
                  className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    tenant.status === s
                      ? "bg-purple-600/30 border border-purple-500/40 text-purple-200"
                      : "border border-purple-500/15 text-slate-400 hover:bg-purple-500/10"
                  }`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Impersonation */}
          <div className="rounded-2xl bg-[#0c0a14]/80 border border-yellow-500/15 p-5">
            <h2 className="text-sm font-semibold text-yellow-200 mb-2">Personificacao</h2>
            <p className="text-xs text-slate-500 mb-4">Entrar no portal do tenant como utilizador seleccionado (auditado, read-only por defeito).</p>
            <div className="space-y-3 max-w-md">
              <select value={impersonateUserId} onChange={(e) => setImpersonateUserId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#0c0a14] border border-yellow-500/20 text-sm text-slate-200 outline-none focus:border-yellow-500/40 transition-colors">
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.email} ({u.role})</option>
                ))}
              </select>
              <input value={impersonateReason} onChange={(e) => setImpersonateReason(e.target.value)} placeholder="Motivo (obrigatorio)"
                className={inputClass} />
              <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
                <input type="checkbox" checked={impersonateReadOnly} onChange={(e) => setImpersonateReadOnly(e.target.checked)}
                  className="rounded border-purple-500/30 bg-[#0c0a14] accent-yellow-500" />
                Read-only
              </label>
              <button type="button" disabled={impBusy || users.length === 0} onClick={() => void personificar()}
                className="px-4 py-2 rounded-lg bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors">
                {impBusy ? "A iniciar..." : "Personificar utilizador"}
              </button>
            </div>
          </div>

          {/* Integrations */}
          <div className="rounded-2xl bg-[#0c0a14]/80 border border-emerald-500/15 p-5">
            <h2 className="text-sm font-semibold text-emerald-200 mb-2">Salas reais – Microsoft Teams & Zoom</h2>
            <p className="text-xs text-slate-500 mb-4">Configuracao por cliente. A app Microsoft e unica da NexiForma; ligas o tenant M365 do cliente.</p>

            {intStatus ? (
              <div className="flex flex-wrap gap-3 text-[11px] mb-4">
                <span className={`px-2 py-1 rounded-md ${intStatus.platformTeamsAppConfigured ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                  App Teams: {intStatus.platformTeamsAppConfigured ? "OK" : "falta .env"}
                </span>
                <span className={`px-2 py-1 rounded-md ${intStatus.teams.ready ? "bg-emerald-500/10 text-emerald-400" : "bg-yellow-500/10 text-yellow-400"}`}>
                  Tenant Teams: {intStatus.teams.ready ? "pronto" : intStatus.teams.missing.join(", ")}
                </span>
                <span className={`px-2 py-1 rounded-md ${intStatus.zoom.ready ? "bg-emerald-500/10 text-emerald-400" : "bg-yellow-500/10 text-yellow-400"}`}>
                  Zoom: {intStatus.zoom.ready ? "pronto" : intStatus.zoom.missing.join(", ")}
                </span>
              </div>
            ) : null}

            {/* Teams */}
            <div className="mb-5">
              <h3 className="text-sm font-medium text-slate-300 mb-2.5">Microsoft 365 (por tenant cliente)</h3>
              <div className="space-y-2.5 max-w-md">
                <input placeholder="Azure Tenant ID do cliente" value={teamsDraft.tenantId}
                  onChange={(e) => setTeamsDraft((p) => ({ ...p, tenantId: e.target.value }))} className={inputClass} />
                <input placeholder="Organizador (email M365)" value={teamsDraft.organizerId}
                  onChange={(e) => setTeamsDraft((p) => ({ ...p, organizerId: e.target.value }))} className={inputClass} />
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={btnPrimaryClass} disabled={intBusy} onClick={() => void saveTeamsIntegracao()}>Guardar Teams</button>
                  <button type="button" className={btnSecondaryClass} disabled={intBusy} onClick={() => void gerarConsentUrl()}>Link consentimento</button>
                  <button type="button" className={btnSecondaryClass} disabled={intBusy} onClick={() => void testarIntegracao("TEAMS")}>Testar</button>
                </div>
              </div>
              {consentUrl ? (
                <p className="mt-2 text-xs text-yellow-200 break-all">
                  Enviar ao IT do cliente:{" "}
                  <a href={consentUrl} target="_blank" rel="noopener noreferrer" className="text-purple-400 underline">{consentUrl}</a>
                </p>
              ) : null}
            </div>

            {/* Zoom */}
            <div>
              <h3 className="text-sm font-medium text-slate-300 mb-2.5">Zoom (conta do cliente)</h3>
              <div className="space-y-2.5 max-w-md">
                {(["accountId", "clientId", "clientSecret", "userId"] as const).map((k) => (
                  <input key={k} type={k === "clientSecret" ? "password" : "text"}
                    placeholder={k === "userId" ? "Email anfitriao Zoom" : k} value={zoomDraft[k]}
                    onChange={(e) => setZoomDraft((p) => ({ ...p, [k]: e.target.value }))} className={inputClass} />
                ))}
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={btnPrimaryClass} disabled={intBusy} onClick={() => void saveZoomIntegracao()}>Guardar Zoom</button>
                  <button type="button" className={btnSecondaryClass} disabled={intBusy} onClick={() => void testarIntegracao("ZOOM")}>Testar</button>
                </div>
              </div>
            </div>

            <p className="mt-4 text-[11px] text-slate-600">
              Modo actual: TEAMS {intRows.find((r) => r.provider === "TEAMS")?.mode ?? "–"} · ZOOM {intRows.find((r) => r.provider === "ZOOM")?.mode ?? "–"}
            </p>
          </div>

          {/* Subscription keys */}
          <div className="rounded-2xl bg-[#0c0a14]/80 border border-purple-500/10 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-purple-200">Subscription keys</h2>
              <button type="button" onClick={() => void gerarChave()}
                className="px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors">
                Gerar chave
              </button>
            </div>
            {tenant.subscriptionKeys.length === 0 ? (
              <p className="text-xs text-slate-600">Sem chaves geradas.</p>
            ) : (
              <div className="space-y-1.5">
                {tenant.subscriptionKeys.map((k) => (
                  <div key={k.id} className="flex items-center gap-3 text-xs text-slate-400">
                    <code className="text-purple-300">{k.keyPrefix}...</code>
                    <span className="text-slate-500">{k.status}</span>
                    {k.expiresAt ? <span className="text-slate-600">· expira {new Date(k.expiresAt).toLocaleDateString("pt-PT")}</span> : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
      <p className="text-[11px] text-slate-500 uppercase tracking-wider">{label}</p>
      <p className="text-lg font-bold text-slate-100 mt-0.5">{value}</p>
    </div>
  );
}
