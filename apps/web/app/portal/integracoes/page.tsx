"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { PluginDetailPanel } from "@/components/integracoes/plugin-detail-panel";
import { PluginStoreCard } from "@/components/integracoes/plugin-store-card";
import { EmptyState, LoadingBlock, PageShell } from "@/components/portal/page-shell";
import { RateLimitRetryBanner } from "@/components/portal/rate-limit-retry";
import { PageHeader } from "@/components/ui";
import { bffFetch } from "@/lib/client/bff-fetch";
import { useRateLimitCooldown } from "@/lib/client/use-rate-limit-cooldown";
import { useTenantEntitlements } from "@/lib/client/use-tenant-entitlements";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { bo, parseApiError } from "@/lib/ui/backoffice";
import {
  INTEGRATION_PLUGINS,
  isIntegrationPluginAllowed,
  type IntegrationPluginId,
} from "@nexiforma/shared";

type Integracao = {
  provider: string;
  mode: string;
  configured: boolean;
  config: Record<string, unknown> | null;
  provisionedByPlatform?: boolean;
};

type OAuthReadiness = {
  provider: string;
  mode: string;
  ready: boolean;
  missing: string[];
  source: string;
};

const OAUTH_FIELD_KEYS: Record<string, string[]> = {
  ZOOM: ["accountId", "clientId", "clientSecret", "userId"],
  TEAMS: ["tenantId", "organizerId"],
};

export default function IntegracoesPage() {
  const { canManageFormacao: canManage } = useTenantRole();
  const { entitlements, loading: entLoading } = useTenantEntitlements();

  const [rows, setRows] = useState<Integracao[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [moodlePreview, setMoodlePreview] = useState<string | null>(null);
  const [oauthDraft, setOauthDraft] = useState<Record<string, Record<string, string>>>({});
  const [busy, setBusy] = useState(false);
  const [oauthStatus, setOauthStatus] = useState<{ zoom: OAuthReadiness; teams: OAuthReadiness } | null>(null);
  const [rateLimited, setRateLimited] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"Todos" | "Salas" | "LMS">("Todos");
  const [selectedId, setSelectedId] = useState<IntegrationPluginId | null>(null);
  const { remainingSec, isCoolingDown, applyFromResponse, clearCooldown } = useRateLimitCooldown();

  const hasSalasOnline = Boolean(entitlements && isIntegrationPluginAllowed("salas_online", entitlements));
  const hasMoodle = Boolean(entitlements && isIntegrationPluginAllowed("moodle", entitlements));

  const handleApiError = useCallback(
    async (res: Response) => {
      if (res.status === 429) {
        setRateLimited(true);
        applyFromResponse(res);
      }
      setError(await parseApiError(res));
    },
    [applyFromResponse],
  );

  const loadOAuthStatus = useCallback(async () => {
    const res = await bffFetch("/api/v1/integracoes/oauth/status", { headers: { accept: "application/json" } });
    if (res.ok) {
      setOauthStatus((await res.json()) as { zoom: OAuthReadiness; teams: OAuthReadiness });
      return true;
    }
    await handleApiError(res);
    return false;
  }, [handleApiError]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await bffFetch("/api/v1/integracoes", { headers: { accept: "application/json" } });
    if (!res.ok) {
      await handleApiError(res);
      setLoading(false);
      return false;
    }
    const data = (await res.json()) as Integracao[];
    setRows(data);
    setRateLimited(false);
    clearCooldown();
    const draft: Record<string, Record<string, string>> = {};
    for (const r of data) {
      if (r.provider === "ZOOM" || r.provider === "TEAMS") {
        draft[r.provider] = Object.fromEntries(
          Object.entries(r.config ?? {}).map(([k, v]) => [k, String(v ?? "")]),
        );
      }
    }
    setOauthDraft(draft);
    setLoading(false);
    return true;
  }, [clearCooldown, handleApiError]);

  const reloadAll = useCallback(async () => {
    if (isCoolingDown) return;
    setRetrying(true);
    setError(null);
    const okList = await load();
    let okOAuth = true;
    if (hasSalasOnline) okOAuth = await loadOAuthStatus();
    if (okList && (!hasSalasOnline || okOAuth)) {
      setRateLimited(false);
      clearCooldown();
    }
    setRetrying(false);
  }, [clearCooldown, hasSalasOnline, isCoolingDown, load, loadOAuthStatus]);

  useEffect(() => {
    if (entLoading) return;
    void (async () => {
      await load();
      if (hasSalasOnline) await loadOAuthStatus();
    })();
  }, [entLoading, hasSalasOnline, load, loadOAuthStatus]);

  function oauthDraftDirty(provider: string): boolean {
    const keys = OAUTH_FIELD_KEYS[provider];
    if (!keys) return false;
    const saved = rows.find((r) => r.provider === provider)?.config ?? {};
    const draft = oauthDraft[provider] ?? {};
    return keys.some((k) => (draft[k] ?? "").trim() !== String(saved[k] ?? "").trim());
  }

  async function activarOAuthReal() {
    if (!canManage || !hasSalasOnline) return;
    setBusy(true);
    setMsg(null);
    setError(null);
    const res = await bffFetch("/api/v1/integracoes/oauth/activar?provider=ALL", {
      method: "POST",
      headers: { accept: "application/json" },
    });
    setBusy(false);
    if (!res.ok) await handleApiError(res);
    else {
      const data = (await res.json()) as { message?: string };
      setMsg(data.message ?? "OAuth activo.");
      await Promise.all([load(), loadOAuthStatus()]);
    }
  }

  async function setMode(provider: string, mode: string, config?: Record<string, unknown>) {
    if (!canManage) return;
    if ((provider === "ZOOM" || provider === "TEAMS") && !hasSalasOnline) return;
    if (provider === "MOODLE" && !hasMoodle) return;
    setMsg(null);
    setError(null);
    const res = await bffFetch("/api/v1/integracoes", {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ provider, mode, config: config ?? {} }),
    });
    if (!res.ok) await handleApiError(res);
    else {
      setMsg(`${provider} actualizado para ${mode}.`);
      await load();
    }
  }

  async function saveOAuth(provider: string) {
    const draft = oauthDraft[provider] ?? {};
    const row = rows.find((r) => r.provider === provider);
    const config =
      provider === "TEAMS"
        ? { tenantId: draft.tenantId?.trim() ?? "", organizerId: draft.organizerId?.trim() ?? "" }
        : draft;
    const mode = row?.mode === "OAUTH" ? "OAUTH" : "DISABLED";
    await setMode(provider, mode, config);
  }

  async function testar(provider: "ZOOM" | "TEAMS") {
    if (!hasSalasOnline) return;
    setMsg(null);
    setError(null);
    setBusy(true);
    const res = await bffFetch(`/api/v1/integracoes/testar?provider=${provider}`, {
      method: "POST",
      headers: { accept: "application/json" },
    });
    setBusy(false);
    if (!res.ok) await handleApiError(res);
    else {
      const data = (await res.json()) as { message?: string };
      setMsg(data.message ?? `${provider} OK.`);
    }
  }

  async function syncMoodle(e: FormEvent) {
    e.preventDefault();
    if (!hasMoodle) return;
    setMoodlePreview(null);
    const res = await bffFetch("/api/v1/integracoes/moodle/sync", { headers: { accept: "application/json" } });
    if (!res.ok) setError(await parseApiError(res));
    else setMoodlePreview(JSON.stringify(await res.json(), null, 2));
  }

  const pluginCards = useMemo(() => {
    return INTEGRATION_PLUGINS.filter((p) => {
      if (category !== "Todos" && p.category !== category) return false;
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.tagline.toLowerCase().includes(q)
      );
    });
  }, [category, query]);

  function pluginStatus(pluginId: IntegrationPluginId): { label: string; tone: "active" | "idle" | "locked" } {
    const unlocked = Boolean(entitlements && isIntegrationPluginAllowed(pluginId, entitlements));
    if (!unlocked) return { label: "Plano necessário", tone: "locked" };

    if (pluginId === "salas_online") {
      const zoom = rows.find((r) => r.provider === "ZOOM")?.mode ?? "DISABLED";
      const teams = rows.find((r) => r.provider === "TEAMS")?.mode ?? "DISABLED";
      if (zoom === "OAUTH" || teams === "OAUTH") return { label: "Instalado", tone: "active" };
      if (oauthStatus?.teams.ready || oauthStatus?.zoom.ready) return { label: "Configurar", tone: "idle" };
      return { label: "Disponível", tone: "idle" };
    }

    const moodle = rows.find((r) => r.provider === "MOODLE")?.mode ?? "DISABLED";
    if (moodle === "OAUTH") return { label: "Instalado", tone: "active" };
    return { label: "Disponível", tone: "idle" };
  }

  const selectedPlugin = selectedId ? INTEGRATION_PLUGINS.find((p) => p.id === selectedId) : null;

  if (entLoading) {
    return (
      <PageShell title="Plugins" subtitle="Catálogo de integrações disponíveis na plataforma.">
        <LoadingBlock />
      </PageShell>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Loja de plugins"
        description="Descobre, instala e configura integrações - como na Chrome Web Store."
      />

      {rateLimited && error ? (
        <RateLimitRetryBanner
          message={error}
          remainingSec={remainingSec}
          onRetry={() => void reloadAll()}
          retrying={retrying}
        />
      ) : error ? (
        <p style={bo.alert}>{error}</p>
      ) : null}
      {msg ? <p style={bo.ok}>{msg}</p> : null}

      {selectedPlugin ? (
        <PluginDetailPanel
          plugin={selectedPlugin}
          unlocked={Boolean(entitlements && isIntegrationPluginAllowed(selectedPlugin.id, entitlements))}
          canManage={canManage}
          loading={loading}
          busy={busy}
          rows={rows}
          oauthStatus={oauthStatus}
          oauthDraft={oauthDraft}
          moodlePreview={moodlePreview}
          onBack={() => setSelectedId(null)}
          onOauthDraftChange={(provider, draft) =>
            setOauthDraft((prev) => ({ ...prev, [provider]: draft }))
          }
          onSaveOAuth={(p) => void saveOAuth(p)}
          oauthDraftDirty={oauthDraftDirty}
          onSetMode={(p, m, c) => void setMode(p, m, c)}
          onTest={(p) => void testar(p)}
          onActivateOAuth={() => void activarOAuthReal()}
          onSyncMoodle={(e) => void syncMoodle(e)}
        />
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="search"
                placeholder="Pesquisar plugins..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-700/60 bg-slate-900/80 py-2.5 pl-10 pr-3 text-sm text-slate-200 outline-none focus:border-violet-500/40"
              />
            </div>
            <div className="flex rounded-xl border border-slate-700/50 p-0.5">
              {(["Todos", "Salas", "LMS"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    category === c ? "bg-violet-600/30 text-violet-200" : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {loading && !rows.length ? (
            <LoadingBlock />
          ) : pluginCards.length === 0 ? (
            <EmptyState message="Nenhum plugin corresponde à pesquisa." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {pluginCards.map((plugin) => {
                const unlocked = Boolean(entitlements && isIntegrationPluginAllowed(plugin.id, entitlements));
                const status = pluginStatus(plugin.id);
                return (
                  <PluginStoreCard
                    key={plugin.id}
                    plugin={plugin}
                    unlocked={unlocked}
                    statusLabel={status.label}
                    statusTone={status.tone}
                    onSelect={() => setSelectedId(plugin.id)}
                  />
                );
              })}
            </div>
          )}

          <p className="text-sm text-slate-500">
            Precisas de mais integrações?{" "}
            <Link href="/portal/billing" className="text-violet-400 hover:text-violet-300 underline">
              Gerir subscrição
            </Link>
            {" · "}
            <Link href="/portal/enterprise" className="text-violet-400 hover:text-violet-300 underline">
              API & SSO Enterprise
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
