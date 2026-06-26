"use client";

import Link from "next/link";
import { MicrosoftSetupWizard } from "@/components/integracoes/MicrosoftSetupWizard";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { EmptyState, LoadingBlock, PageShell, StatusBadge } from "@/components/portal/page-shell";
import { bo, parseApiError } from "@/lib/ui/backoffice";

type Integracao = {
  provider: string;
  mode: string;
  configured: boolean;
  config: Record<string, unknown> | null;
  provisionedByPlatform?: boolean;
};

type SessaoOpt = { id: string; numeroSessao: number; lmsAtivo: boolean };

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

export default function IntegracoesPage() {
  const { canManage, isStaff } = useTenantRole();
  const [rows, setRows] = useState<Integracao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [moodlePreview, setMoodlePreview] = useState<string | null>(null);
  const [oauthDraft, setOauthDraft] = useState<Record<string, Record<string, string>>>({});
  const [sessoes, setSessoes] = useState<SessaoOpt[]>([]);
  const [testSessaoId, setTestSessaoId] = useState("");
  const [busy, setBusy] = useState(false);
  const [oauthStatus, setOauthStatus] = useState<{ zoom: OAuthReadiness; teams: OAuthReadiness } | null>(
    null,
  );

  const loadOAuthStatus = useCallback(async () => {
    const res = await bffFetch("/api/v1/integracoes/oauth/status", { headers: { accept: "application/json" } });
    if (res.ok) setOauthStatus((await res.json()) as { zoom: OAuthReadiness; teams: OAuthReadiness });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await bffFetch("/api/v1/integracoes", { headers: { accept: "application/json" } });
    if (!res.ok) setError(await parseApiError(res));
    else {
      const data = (await res.json()) as Integracao[];
      setRows(data);
      const draft: Record<string, Record<string, string>> = {};
      for (const r of data) {
        if (r.provider === "ZOOM" || r.provider === "TEAMS") {
          draft[r.provider] = Object.fromEntries(
            Object.entries(r.config ?? {}).map(([k, v]) => [k, String(v ?? "")]),
          );
        }
      }
      setOauthDraft(draft);
    }
    setLoading(false);
  }, []);

  const loadSessoes = useCallback(async () => {
    const acoesRes = await bffFetch("/api/v1/acoes-formacao", { headers: { accept: "application/json" } });
    if (!acoesRes.ok) return;
    const acoes = (await acoesRes.json()) as { id: string }[];
    const first = acoes[0];
    if (!first) return;
    const cronRes = await bffFetch(`/api/v1/cronogramas?acaoFormacaoId=${encodeURIComponent(first.id)}`, {
      headers: { accept: "application/json" },
    });
    if (!cronRes.ok) return;
    const crons = (await cronRes.json()) as { id: string }[];
    const cron = crons[0];
    if (!cron) return;
    const sessRes = await bffFetch(`/api/v1/sessoes-formacao?cronogramaId=${encodeURIComponent(cron.id)}`, {
      headers: { accept: "application/json" },
    });
    if (!sessRes.ok) return;
    const list = (await sessRes.json()) as SessaoOpt[];
    setSessoes(list);
    if (list.length && !testSessaoId) setTestSessaoId(list.find((s) => s.numeroSessao === 2)?.id ?? list[0].id);
  }, [testSessaoId]);

  useEffect(() => {
    void load();
    void loadSessoes();
    void loadOAuthStatus();
  }, [load, loadSessoes, loadOAuthStatus]);

  async function activarOAuthReal() {
    if (!canManage) return;
    setBusy(true);
    setMsg(null);
    setError(null);
    const res = await bffFetch("/api/v1/integracoes/oauth/activar?provider=ALL", {
      method: "POST",
      headers: { accept: "application/json" },
    });
    setBusy(false);
    if (!res.ok) setError(await parseApiError(res));
    else {
      const data = (await res.json()) as { message?: string };
      setMsg(data.message ?? "OAuth activo.");
      await Promise.all([load(), loadOAuthStatus()]);
    }
  }

  async function setMode(provider: string, mode: string, config?: Record<string, unknown>) {
    if (!canManage) return;
    setMsg(null);
    setError(null);
    const res = await bffFetch("/api/v1/integracoes", {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        provider,
        mode,
        config: config ?? {},
      }),
    });
    if (!res.ok) setError(await parseApiError(res));
    else {
      setMsg(`${provider} actualizado para ${mode}.`);
      await load();
    }
  }

  async function saveOAuth(provider: string) {
    const draft = oauthDraft[provider] ?? {};
    await setMode(provider, "OAUTH", draft);
  }

  async function testar(provider: "ZOOM" | "TEAMS") {
    setMsg(null);
    setError(null);
    setBusy(true);
    const res = await bffFetch(`/api/v1/integracoes/testar?provider=${provider}`, {
      method: "POST",
      headers: { accept: "application/json" },
    });
    setBusy(false);
    if (!res.ok) setError(await parseApiError(res));
    else {
      const data = (await res.json()) as { message?: string };
      setMsg(data.message ?? `${provider} OK.`);
    }
  }

  async function criarSalaTeste(provider: "ZOOM" | "TEAMS") {
    if (!testSessaoId) {
      setError("Selecciona uma sessão para teste.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await bffFetch(
      `/api/v1/integracoes/sessoes/${testSessaoId}/reuniao?provider=${provider}`,
      { method: "POST", headers: { accept: "application/json" } },
    );
    setBusy(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    const data = (await res.json()) as { joinUrl: string; mode?: string; provider: string };
    setMsg(`Sala ${data.provider} criada – entra com a tua conta ${data.provider === "TEAMS" ? "Microsoft" : "Zoom"}.`);
    window.open(data.joinUrl, "_blank", "noopener,noreferrer");
  }

  async function syncMoodle(e: FormEvent) {
    e.preventDefault();
    setMoodlePreview(null);
    const res = await bffFetch("/api/v1/integracoes/moodle/sync", { headers: { accept: "application/json" } });
    if (!res.ok) setError(await parseApiError(res));
    else setMoodlePreview(JSON.stringify(await res.json(), null, 2));
  }

  const modeColor = (m: string) => (m === "OAUTH" ? "#4ade80" : "#94a3b8");

  const zoomMode = rows.find((r) => r.provider === "ZOOM")?.mode ?? "DISABLED";
  const teamsMode = rows.find((r) => r.provider === "TEAMS")?.mode ?? "DISABLED";
  const oauthReady = oauthStatus?.zoom.ready || oauthStatus?.teams.ready;
  const realActive = zoomMode === "OAUTH" || teamsMode === "OAUTH";

  return (
    <PageShell
      title="Integrações"
      subtitle="Zoom, Teams e Moodle – salas online e sincronização LMS."
    >
      {error ? <p style={bo.alert}>{error}</p> : null}
      {msg ? <p style={bo.ok}>{msg}</p> : null}

      {canManage ? (
        <MicrosoftSetupWizard
          teamsDraft={oauthDraft.TEAMS ?? {}}
          onTeamsDraftChange={(d) => setOauthDraft((prev) => ({ ...prev, TEAMS: d }))}
          onSaveTeams={() => saveOAuth("TEAMS")}
          onTestTeams={() => testar("TEAMS")}
          onActivateOAuth={() => activarOAuthReal()}
          busy={busy}
        />
      ) : null}

      <div style={{ ...bo.card, marginBottom: "1rem", border: "1px solid rgba(74,222,128,0.35)" }}>
        <h2 style={bo.h2}>Salas reais (Zoom / Teams)</h2>
        <p style={{ color: "#94a3b8", fontSize: "0.88rem", margin: "0 0 0.75rem", lineHeight: 1.55 }}>
          Formador e formandos entram com <strong>conta Microsoft ou Zoom</strong> no link da reunião.
          <strong> Teams:</strong> preenche só tenant M365 + email do organizador (a app Microsoft é da NexiForma).
          <strong> Zoom:</strong> credenciais da conta Zoom do cliente. Depois activa OAUTH e cria a sala.
        </p>
        {oauthStatus ? (
          <ul style={{ color: "#cbd5e1", fontSize: "0.85rem", margin: "0 0 0.75rem", paddingLeft: "1.2rem" }}>
            <li>
              <strong>Zoom</strong> – {oauthStatus.zoom.ready ? "OAuth configurado" : oauthStatus.zoom.missing.join(", ")}
            </li>
            <li>
              <strong>Teams</strong> – {oauthStatus.teams.ready ? "OAuth configurado" : oauthStatus.teams.missing.join(", ")}
            </li>
          </ul>
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
            <StatusBadge label="Credenciais em falta no .env" color="#f87171" />
          )}
        </div>
        {!canManage && !realActive ? (
          <p style={{ color: "#64748b", fontSize: "0.82rem", margin: "0.65rem 0 0" }}>
            Pede ao gestor para preencher o `.env` e activar OAUTH.
          </p>
        ) : null}
      </div>

      {loading ? (
        <LoadingBlock />
      ) : (
        <div style={{ display: "grid", gap: "0.85rem" }}>
          {rows.map((r) => (
            <div key={r.provider} style={bo.card}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "0.5rem",
                }}
              >
                <h2 style={bo.h2}>{r.provider}</h2>
                <StatusBadge label={r.mode} color={modeColor(r.mode)} />
              </div>
              <p style={{ color: "#94a3b8", fontSize: "0.85rem", margin: "0 0 0.75rem" }}>
                {r.provider === "MOODLE"
                  ? "Sincronização de cursos via Web Services (LTI em roadmap)."
                  : r.provider === "TEAMS"
                    ? "OAUTH = reuniões reais via Microsoft Graph."
                    : "OAUTH = reuniões reais Zoom Server-to-Server."}
              </p>
              {canManage ? (
                <>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.65rem" }}>
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
                    {r.provider === "ZOOM" || r.provider === "TEAMS" ? (
                      <button
                        type="button"
                        style={bo.btnSecondary}
                        disabled={busy || r.mode === "DISABLED"}
                        onClick={() => void testar(r.provider as "ZOOM" | "TEAMS")}
                      >
                        Testar ligação
                      </button>
                    ) : null}
                  </div>
                  {r.mode === "OAUTH" && (r.provider === "ZOOM" || r.provider === "TEAMS") ? (
                    <div style={{ display: "grid", gap: "0.45rem", maxWidth: 420, marginTop: "0.5rem" }}>
                      {r.provisionedByPlatform ? (
                        <p style={{ color: "#fde047", fontSize: "0.82rem", margin: 0, lineHeight: 1.45 }}>
                          Integração configurada pela NexiForma – usa «Testar ligação» e «Criar sala Teams real» abaixo.
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
                          {r.provider === "TEAMS" ? (
                            <p style={{ color: "#64748b", fontSize: "0.78rem", margin: 0, lineHeight: 1.45 }}>
                              App Client ID e Secret são geridos pela plataforma NexiForma – não precisas de os preencher.
                            </p>
                          ) : null}
                          <button type="button" style={bo.btnSecondary} onClick={() => void saveOAuth(r.provider)}>
                            Guardar credenciais OAuth
                          </button>
                        </>
                      )}
                    </div>
                  ) : null}
                </>
              ) : r.provider === "ZOOM" || r.provider === "TEAMS" ? (
                <button
                  type="button"
                  style={bo.btnSecondary}
                  disabled={busy || r.mode === "DISABLED"}
                  onClick={() => void testar(r.provider as "ZOOM" | "TEAMS")}
                >
                  Testar ligação
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <div style={{ ...bo.card, marginTop: "1rem" }}>
        <h2 style={bo.h2}>Moodle – sincronizar cursos</h2>
        <form onSubmit={syncMoodle}>
          <button type="submit" style={bo.btnTeal}>
            Executar sync
          </button>
        </form>
        {moodlePreview ? (
          <pre style={{ marginTop: "0.75rem", fontSize: "0.78rem", color: "#cbd5e1", overflow: "auto" }}>
            {moodlePreview}
          </pre>
        ) : (
          <EmptyState message="Active integração Moodle (OAUTH) e execute sync para ver cursos." />
        )}
      </div>
    </PageShell>
  );
}
