"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MicrosoftSetupWizard } from "@/components/integracoes/MicrosoftSetupWizard";
import { EmptyState, LoadingBlock, StatusBadge } from "@/components/portal/page-shell";
import { Button } from "@/components/ui";
import { bo } from "@/lib/ui/backoffice";
import type { IntegrationPluginDef, IntegrationPluginId } from "@nexiforma/shared";
import type { FormEvent } from "react";

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

type Props = {
  plugin: IntegrationPluginDef;
  unlocked: boolean;
  canManage: boolean;
  loading: boolean;
  busy: boolean;
  rows: Integracao[];
  oauthStatus: { zoom: OAuthReadiness; teams: OAuthReadiness } | null;
  oauthDraft: Record<string, Record<string, string>>;
  moodlePreview: string | null;
  onBack: () => void;
  onOauthDraftChange: (provider: string, draft: Record<string, string>) => void;
  onSaveOAuth: (provider: string) => void;
  oauthDraftDirty: (provider: string) => boolean;
  onSetMode: (provider: string, mode: string, config?: Record<string, unknown>) => void;
  onTest: (provider: "ZOOM" | "TEAMS") => void;
  onActivateOAuth: () => void;
  onSyncMoodle: (e: FormEvent) => void;
};

export function PluginDetailPanel({
  plugin,
  unlocked,
  canManage,
  loading,
  busy,
  rows,
  oauthStatus,
  oauthDraft,
  moodlePreview,
  onBack,
  onOauthDraftChange,
  onSaveOAuth,
  oauthDraftDirty,
  onSetMode,
  onTest,
  onActivateOAuth,
  onSyncMoodle,
}: Props) {
  const modeColor = (m: string) => (m === "OAUTH" ? "#4ade80" : "#94a3b8");
  const salasRows = rows.filter((r) => r.provider === "ZOOM" || r.provider === "TEAMS");
  const moodleRow = rows.find((r) => r.provider === "MOODLE");
  const zoomMode = salasRows.find((r) => r.provider === "ZOOM")?.mode ?? "DISABLED";
  const teamsMode = salasRows.find((r) => r.provider === "TEAMS")?.mode ?? "DISABLED";
  const oauthReady = oauthStatus?.zoom.ready || oauthStatus?.teams.ready;
  const realActive = zoomMode === "OAUTH" || teamsMode === "OAUTH";

  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-950/60 overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-700/40 px-4 py-3 sm:px-6">
        <Button type="button" size="sm" variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> Voltar à loja
        </Button>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-slate-100">{plugin.title}</h2>
          <p className="text-sm text-slate-400">{plugin.description}</p>
        </div>
        <StatusBadge label={PLUGIN_BADGE[plugin.id]} color="#38bdf8" />
      </div>

      <div className="p-4 sm:p-6">
        {!unlocked ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-6 text-center">
            <p className="text-sm text-amber-200 mb-4">
              Este plugin não está incluído no teu plano. Faz upgrade para activar.
            </p>
            <Link
              href="/portal/billing"
              className="inline-flex rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
            >
              Ver subscrição
            </Link>
          </div>
        ) : null}

        {unlocked && plugin.id === "salas_online" ? (
          <>
            {canManage ? (
              <MicrosoftSetupWizard
                enabled
                teamsDraft={oauthDraft.TEAMS ?? {}}
                onTeamsDraftChange={(d) => onOauthDraftChange("TEAMS", d)}
                onSaveTeams={async () => {
                  onSaveOAuth("TEAMS");
                }}
                showSaveTeams={oauthDraftDirty("TEAMS")}
                onTestTeams={async () => {
                  onTest("TEAMS");
                }}
                onActivateOAuth={async () => {
                  onActivateOAuth();
                }}
                busy={busy}
              />
            ) : null}

            <div style={{ ...bo.card, marginTop: "0.75rem", border: "1px solid rgba(74,222,128,0.35)" }}>
              <h3 style={{ ...bo.h2, fontSize: "1rem" }}>Estado das salas</h3>
              {oauthStatus ? (
                <ul style={{ color: "#cbd5e1", fontSize: "0.85rem", margin: "0.5rem 0 0.75rem", paddingLeft: "1.2rem" }}>
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
                    onClick={() => void onActivateOAuth()}
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

            {loading ? (
              <LoadingBlock />
            ) : (
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
                              onClick={() => void onSetMode(r.provider, m, oauthDraft[r.provider])}
                            >
                              {m}
                            </button>
                          ))}
                          <button
                            type="button"
                            style={bo.btnSecondary}
                            disabled={busy || r.mode === "DISABLED"}
                            onClick={() => void onTest(r.provider as "ZOOM" | "TEAMS")}
                          >
                            Testar ligação
                          </button>
                        </div>
                        {r.mode === "OAUTH" && !r.provisionedByPlatform ? (
                          <div style={{ display: "grid", gap: "0.45rem", maxWidth: 420 }}>
                            {OAUTH_FIELDS[r.provider].map((f) => (
                              <label key={f.key} style={bo.label}>
                                {f.label}
                                <input
                                  style={bo.input}
                                  type={f.secret ? "password" : "text"}
                                  value={oauthDraft[r.provider]?.[f.key] ?? ""}
                                  onChange={(e) =>
                                    onOauthDraftChange(r.provider, {
                                      ...oauthDraft[r.provider],
                                      [f.key]: e.target.value,
                                    })
                                  }
                                />
                              </label>
                            ))}
                            {oauthDraftDirty(r.provider) ? (
                              <button
                                type="button"
                                style={bo.btnSecondary}
                                onClick={() => void onSaveOAuth(r.provider)}
                              >
                                Guardar credenciais OAuth
                              </button>
                            ) : null}
                          </div>
                        ) : r.mode === "OAUTH" && r.provisionedByPlatform ? (
                          <p style={{ color: "#fde047", fontSize: "0.82rem", margin: 0 }}>
                            Integração configurada pela NexiForma – usa «Testar ligação».
                          </p>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : null}

        {unlocked && plugin.id === "moodle" ? (
          <div>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.65rem" }}>
              <h3 style={{ ...bo.h2, fontSize: "1rem", margin: 0 }}>Moodle</h3>
              <StatusBadge label={moodleRow?.mode ?? "DISABLED"} color={modeColor(moodleRow?.mode ?? "DISABLED")} />
            </div>
            {canManage ? (
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.65rem" }}>
                {(["DISABLED", "OAUTH"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    style={(moodleRow?.mode ?? "DISABLED") === m ? bo.btn : bo.btnSecondary}
                    onClick={() => void onSetMode("MOODLE", m)}
                  >
                    {m}
                  </button>
                ))}
              </div>
            ) : null}
            <form onSubmit={onSyncMoodle}>
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
          </div>
        ) : null}
      </div>
    </div>
  );
}
