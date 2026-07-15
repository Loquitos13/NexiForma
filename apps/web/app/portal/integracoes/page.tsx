"use client";

import Link from "next/link";
import { MicrosoftSetupWizard } from "@/components/integracoes/MicrosoftSetupWizard";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { useTenantEntitlements } from "@/lib/client/use-tenant-entitlements";
import { EmptyState, LoadingBlock, PageShell, StatusBadge } from "@/components/portal/page-shell";
import { RateLimitRetryBanner } from "@/components/portal/rate-limit-retry";
import { bo, parseApiError } from "@/lib/ui/backoffice";
import { useRateLimitCooldown } from "@/lib/client/use-rate-limit-cooldown";
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

const OAUTH_FIELDS: Record<string, { key: string; label: string; secret?: boolean }[]> = {
  ZOOM: [
    { key: "accountId", label: "Account ID" },
    { key: "clientId", label: "Client ID" },
    { key: "clientSecret", label: "Client Secret", secret: true },
    { key: "userId", label: "Email Zoom do anfitrião (ZOOM_USER_ID)" },
  ],
  TEAMS: [
    { key: "tenantId", label: "Azure Tenant ID (M365 do cliente)" },
    { key: "organizerId", label: "Organizador M365 (email)" },
  ],
};

const PLUGIN_BADGE: Record<IntegrationPluginId, string> = {
  salas_online: "Formação Teams",
  moodle: "Formação Core",
};

export default function IntegracoesPage() {
  const { canManage } = useTenantRole();
  const { entitlements, loading: entLoading } = useTenantEntitlements();

  const hasSalasOnline = Boolean(
    entitlements && isIntegrationPluginAllowed("salas_online", entitlements),
  );
  const hasMoodle = Boolean(entitlements && isIntegrationPluginAllowed("moodle", entitlements));

  const visiblePlugins = useMemo(
    () =>
      entitlements
        ? INTEGRATION_PLUGINS.filter((p) => isIntegrationPluginAllowed(p.id, entitlements))
        : [],
    [entitlements],
  );

  const [rows, setRows] = useState<Integracao[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [moodlePreview, setMoodlePreview] = useState<string | null>(null);
  const [oauthDraft, setOauthDraft] = useState<Record<string, Record<string, string>>>({});
  const [busy, setBusy] = useState(false);
  const [oauthStatus, setOauthStatus] = useState<{ zoom: OAuthReadiness; teams: OAuthReadiness } | null>(
    null,
  );
  const [rateLimited, setRateLimited] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const { remainingSec, isCoolingDown, applyFromResponse, clearCooldown } = useRateLimitCooldown();

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
    if (entLoading || visiblePlugins.length === 0) return;
    void (async () => {
      await load();
      if (hasSalasOnline) await loadOAuthStatus();
    })();
  }, [entLoading, hasSalasOnline, visiblePlugins.length, load, loadOAuthStatus]);

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
      if (provider === "TEAMS" && mode === "DISABLED") {
        setMsg("Credenciais Teams guardadas. Testa a ligação e depois activa OAuth.");
      } else {
        setMsg(`${provider} actualizado para ${mode}.`);
      }
      await load();
    }
  }

  async function saveOAuth(provider: string) {
    const draft = oauthDraft[provider] ?? {};
    const row = rows.find((r) => r.provider === provider);
    const config =
      provider === "TEAMS"
        ? {
            tenantId: draft.tenantId?.trim() ?? "",
            organizerId: draft.organizerId?.trim() ?? "",
          }
        : draft;
    // Guardar credenciais; OAuth activa-se no passo «Activar OAUTH Teams»
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

  const modeColor = (m: string) => (m === "OAUTH" ? "#4ade80" : "#94a3b8");
  const salasRows = rows.filter((r) => r.provider === "ZOOM" || r.provider === "TEAMS");
  const moodleRow = rows.find((r) => r.provider === "MOODLE");
  const zoomMode = salasRows.find((r) => r.provider === "ZOOM")?.mode ?? "DISABLED";
  const teamsMode = salasRows.find((r) => r.provider === "TEAMS")?.mode ?? "DISABLED";
  const oauthReady = oauthStatus?.zoom.ready || oauthStatus?.teams.ready;
  const realActive = zoomMode === "OAUTH" || teamsMode === "OAUTH";

  if (entLoading) {
    return (
      <PageShell title="Plugins" subtitle="Catálogo de integrações disponíveis na plataforma.">
        <LoadingBlock />
      </PageShell>
    );
  }

  if (!visiblePlugins.length) {
    return (
      <PageShell title="Loja de plugins" subtitle="Integrações activas na tua subscrição.">
        <EmptyState message="Nenhum plugin disponível no plano actual. Active Formação Core ou Formação Teams em Facturação." />
        <Link href="/portal/billing" className="text-sm text-blue-400 hover:underline">
          Ver subscrição
        </Link>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Loja de plugins"
      subtitle="Integrações incluídas no teu plano. Configura e activa cada plugin."
    >
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

      <div
        style={{
          display: "grid",
          gap: "1.25rem",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        }}
      >
        {visiblePlugins.map((plugin) => {
          const unlocked = true;
          return (
          <section
            key={plugin.id}
            style={{
              ...bo.card,
              border: "1px solid rgba(148,163,184,0.25)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                flexWrap: "wrap",
                gap: "0.5rem",
                marginBottom: "0.75rem",
              }}
            >
              <div>
                <h2 style={{ ...bo.h2, marginBottom: "0.25rem" }}>{plugin.title}</h2>
                <p style={{ color: "#94a3b8", fontSize: "0.88rem", margin: 0, lineHeight: 1.5 }}>
                  {plugin.description}
                </p>
              </div>
              <StatusBadge label={PLUGIN_BADGE[plugin.id]} color="#38bdf8" />
            </div>

            {plugin.id === "salas_online" ? (
              <>
                {canManage && unlocked ? (
                  <MicrosoftSetupWizard
                    enabled
                    teamsDraft={oauthDraft.TEAMS ?? {}}
                    onTeamsDraftChange={(d) => setOauthDraft((prev) => ({ ...prev, TEAMS: d }))}
                    onSaveTeams={() => saveOAuth("TEAMS")}
                    onTestTeams={() => testar("TEAMS")}
                    onActivateOAuth={() => activarOAuthReal()}
                    busy={busy}
                  />
                ) : null}

                {unlocked ? (
                <div style={{ ...bo.card, marginTop: "0.75rem", border: "1px solid rgba(74,222,128,0.35)" }}>
                  <h3 style={{ ...bo.h2, fontSize: "1rem" }}>Salas online – Microsoft Teams</h3>
                  <p style={{ color: "#94a3b8", fontSize: "0.85rem", margin: "0 0 0.75rem", lineHeight: 1.55 }}>
                    As formações online criam reuniões Teams no cronograma. Formador e formandos entram com conta
                    Microsoft no link da sessão.
                  </p>
                  {oauthStatus ? (
                    <ul style={{ color: "#cbd5e1", fontSize: "0.85rem", margin: "0 0 0.75rem", paddingLeft: "1.2rem" }}>
                      <li>
                        <strong>Zoom</strong> –{" "}
                        {oauthStatus.zoom.ready ? "OAuth configurado" : oauthStatus.zoom.missing.join(", ")}
                      </li>
                      <li>
                        <strong>Teams</strong> –{" "}
                        {oauthStatus.teams.ready ? "OAuth configurado" : oauthStatus.teams.missing.join(", ")}
                      </li>
                    </ul>
                  ) : loading ? (
                    <LoadingBlock />
                  ) : null}
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                    {canManage ? (
                      <button
                        type="button"
                        style={bo.btnTeal}
                        disabled={busy || !oauthReady}
                        onClick={() => void activarOAuthReal()}
                      >
                        Activar salas reais (OAUTH)
                      </button>
                    ) : null}
                    {realActive ? (
                      <StatusBadge label="Salas reais activas" color="#4ade80" />
                    ) : oauthReady ? (
                      <StatusBadge label="Credenciais detectadas" color="#4ade80" />
                    ) : (
                      <StatusBadge label="Credenciais em falta" color="#f87171" />
                    )}
                  </div>
                </div>
                ) : null}

                {loading && unlocked ? (
                  <LoadingBlock />
                ) : unlocked ? (
                  <div style={{ display: "grid", gap: "0.75rem", marginTop: "0.75rem" }}>
                    {salasRows.map((r) => (
                      <div key={r.provider} style={{ ...bo.card, background: "rgba(15,23,42,0.45)" }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            flexWrap: "wrap",
                            gap: "0.5rem",
                          }}
                        >
                          <h3 style={{ ...bo.h2, fontSize: "1rem" }}>{r.provider}</h3>
                          <StatusBadge label={r.mode} color={modeColor(r.mode)} />
                        </div>
                        {canManage ? (
                          <>
                            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", margin: "0.65rem 0" }}>
                              {(["DISABLED", "OAUTH"] as const).map((m) => (
                                <button
                                  key={m}
                                  type="button"
                                  style={r.mode === m ? bo.btn : bo.btnSecondary}
                                  onClick={() => void setMode(r.provider, m, oauthDraft[r.provider])}
                                >
                                  {m}
                                </button>
                              ))}
                              <button
                                type="button"
                                style={bo.btnSecondary}
                                disabled={busy || r.mode === "DISABLED"}
                                onClick={() => void testar(r.provider as "ZOOM" | "TEAMS")}
                              >
                                Testar ligação
                              </button>
                            </div>
                            {r.mode === "OAUTH" ? (
                              <div style={{ display: "grid", gap: "0.45rem", maxWidth: 420 }}>
                                {r.provisionedByPlatform ? (
                                  <p style={{ color: "#fde047", fontSize: "0.82rem", margin: 0 }}>
                                    Integração configurada pela NexiForma – usa «Testar ligação».
                                  </p>
                                ) : (
                                  <>
                                    {OAUTH_FIELDS[r.provider].map((f) => (
                                      <label key={f.key} style={bo.label}>
                                        {f.label}
                                        <input
                                          style={bo.input}
                                          type={f.secret ? "password" : "text"}
                                          value={oauthDraft[r.provider]?.[f.key] ?? ""}
                                          onChange={(e) =>
                                            setOauthDraft((prev) => ({
                                              ...prev,
                                              [r.provider]: { ...prev[r.provider], [f.key]: e.target.value },
                                            }))
                                          }
                                        />
                                      </label>
                                    ))}
                                    <button type="button" style={bo.btnSecondary} onClick={() => void saveOAuth(r.provider)}>
                                      Guardar credenciais OAuth
                                    </button>
                                  </>
                                )}
                              </div>
                            ) : null}
                          </>
                        ) : (
                          <button
                            type="button"
                            style={bo.btnSecondary}
                            disabled={busy || r.mode === "DISABLED"}
                            onClick={() => void testar(r.provider as "ZOOM" | "TEAMS")}
                          >
                            Testar ligação
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: "0.75rem", marginTop: "0.75rem" }}>
                    {(["ZOOM", "TEAMS"] as const).map((provider) => (
                      <div key={provider} style={{ ...bo.card, background: "rgba(15,23,42,0.45)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <h3 style={{ ...bo.h2, fontSize: "1rem" }}>{provider}</h3>
                          <StatusBadge label="DISABLED" color="#94a3b8" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : null}

            {plugin.id === "moodle" ? (
              <div>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.65rem" }}>
                  <h3 style={{ ...bo.h2, fontSize: "1rem", margin: 0 }}>Moodle</h3>
                  <StatusBadge
                    label={unlocked ? (moodleRow?.mode ?? "DISABLED") : "DISABLED"}
                    color={modeColor(unlocked ? (moodleRow?.mode ?? "DISABLED") : "DISABLED")}
                  />
                </div>
                {unlocked ? (
                  <>
                    {canManage ? (
                      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.65rem" }}>
                        {(["DISABLED", "OAUTH"] as const).map((m) => (
                          <button
                            key={m}
                            type="button"
                            style={(moodleRow?.mode ?? "DISABLED") === m ? bo.btn : bo.btnSecondary}
                            onClick={() => void setMode("MOODLE", m)}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    <form onSubmit={syncMoodle}>
                      <button
                        type="submit"
                        style={bo.btnTeal}
                        disabled={!canManage && (moodleRow?.mode ?? "DISABLED") === "DISABLED"}
                      >
                        Executar sync
                      </button>
                    </form>
                    {moodlePreview ? (
                      <pre style={{ marginTop: "0.75rem", fontSize: "0.78rem", color: "#cbd5e1", overflow: "auto" }}>
                        {moodlePreview}
                      </pre>
                    ) : (
                      <EmptyState message="Active o plugin Moodle (OAUTH) e execute sync para ver cursos." />
                    )}
                  </>
                ) : (
                  <>
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.65rem" }}>
                      {(["DISABLED", "OAUTH"] as const).map((m) => (
                        <button key={m} type="button" style={m === "DISABLED" ? bo.btn : bo.btnSecondary} disabled>
                          {m}
                        </button>
                      ))}
                    </div>
                    <button type="button" style={bo.btnTeal} disabled>
                      Executar sync
                    </button>
                    <EmptyState message="Active o plugin Moodle (OAUTH) e execute sync para ver cursos." />
                  </>
                )}
              </div>
            ) : null}
          </section>
          );
        })}
      </div>

      <p style={{ color: "#64748b", fontSize: "0.82rem", marginTop: "1.25rem" }}>
        Precisa de mais integrações?{" "}
        <Link href="/portal/billing" className="underline hover:text-slate-300">
          Gerir subscrição
        </Link>
      </p>
    </PageShell>
  );
}
