"use client";

import { useCallback, useEffect, useState } from "react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { bo } from "@/lib/ui/backoffice";

type OAuthReadiness = {
  provider: string;
  mode: string;
  ready: boolean;
  missing: string[];
  m365TenantId?: string | null;
};

type Props = {
  enabled?: boolean;
  teamsDraft: Record<string, string>;
  onTeamsDraftChange: (draft: Record<string, string>) => void;
  onSaveTeams: () => Promise<void>;
  onTestTeams: () => Promise<void>;
  onActivateOAuth: () => Promise<void>;
  busy: boolean;
};

const STEPS = [
  {
    id: "azure",
    title: "Registar app Microsoft no Azure",
    desc: "O administrador M365 do cliente regista a aplicação NexiForma no portal Azure (ou usa a app já publicada pela NexiForma).",
    manual: true,
  },
  {
    id: "consent",
    title: "Admin consent (permissões)",
    desc: "Conceder consentimento de administrador para OnlineMeetings.ReadWrite e Calendars.ReadWrite na app.",
    manual: true,
  },
  {
    id: "tenant",
    title: "Tenant M365 e organizador",
    desc: "Indica o Azure Tenant ID da organização e o email M365 do organizador das reuniões Teams.",
    manual: false,
  },
  {
    id: "test",
    title: "Testar ligação Graph",
    desc: "Valida credenciais e permissões antes de activar salas reais.",
    manual: false,
  },
  {
    id: "activate",
    title: "Activar salas Teams (OAUTH)",
    desc: "Passa a integração Teams para modo OAUTH - formadores podem criar salas nas sessões online.",
    manual: false,
  },
] as const;

export function MicrosoftSetupWizard({
  enabled = true,
  teamsDraft,
  onTeamsDraftChange,
  onSaveTeams,
  onTestTeams,
  onActivateOAuth,
  busy,
}: Props) {
  const [oauthStatus, setOauthStatus] = useState<{
    teams: OAuthReadiness;
    platformTeamsAppConfigured: boolean;
  } | null>(null);
  const [done, setDone] = useState<Record<string, boolean>>({
    azure: false,
    consent: false,
  });
  const [testOk, setTestOk] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    const res = await bffFetch("/api/v1/integracoes/oauth/status", { headers: { accept: "application/json" } });
    if (res.ok) {
      const data = (await res.json()) as { teams: OAuthReadiness; platformTeamsAppConfigured: boolean };
      setOauthStatus(data);
      if (data.teams.ready) setTestOk(true);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void loadStatus();
  }, [enabled, loadStatus]);

  if (!enabled) return null;

  const tenantFilled = Boolean(teamsDraft.tenantId?.trim() && teamsDraft.organizerId?.trim());
  const stepDone = (id: string) => {
    if (id === "azure") return done.azure || oauthStatus?.platformTeamsAppConfigured;
    if (id === "consent") return done.consent;
    if (id === "tenant") return tenantFilled || Boolean(oauthStatus?.teams.m365TenantId);
    if (id === "test") return testOk || oauthStatus?.teams.ready;
    if (id === "activate") return oauthStatus?.teams.mode === "OAUTH";
    return false;
  };

  async function runTest() {
    setMsg(null);
    await onTestTeams();
    await loadStatus();
    setTestOk(true);
    setMsg("Ligação Teams validada.");
  }

  return (
    <div style={{ ...bo.card, marginBottom: "1rem", border: "1px solid rgba(96,165,250,0.35)" }}>
      <h2 style={bo.h2}>Configuração Microsoft Teams - passo a passo</h2>
      <p style={{ color: "#94a3b8", fontSize: "0.88rem", marginBottom: "1rem", lineHeight: 1.55 }}>
        Segue estes passos para activar salas Teams reais. Cada passo fica marcado quando concluído.
      </p>

      <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.85rem" }}>
        {STEPS.map((step, idx) => {
          const completed = stepDone(step.id);
          return (
            <li
              key={step.id}
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr",
                gap: "0.75rem",
                padding: "0.85rem 1rem",
                borderRadius: 12,
                background: completed ? "rgba(74,222,128,0.06)" : "rgba(15,23,42,0.5)",
                border: `1px solid ${completed ? "rgba(74,222,128,0.25)" : "rgba(148,163,184,0.15)"}`,
              }}
            >
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  background: completed ? "rgba(74,222,128,0.2)" : "rgba(59,130,246,0.15)",
                  color: completed ? "#4ade80" : "#93c5fd",
                }}
              >
                {completed ? "✓" : idx + 1}
              </span>
              <div>
                <p style={{ margin: 0, fontWeight: 600, color: "#e2e8f0", fontSize: "0.92rem" }}>{step.title}</p>
                <p style={{ margin: "0.25rem 0 0", color: "#94a3b8", fontSize: "0.82rem", lineHeight: 1.45 }}>{step.desc}</p>

                {step.id === "azure" && !completed ? (
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.5rem", fontSize: "0.82rem", color: "#cbd5e1" }}>
                    <input type="checkbox" checked={done.azure} onChange={(e) => setDone((d) => ({ ...d, azure: e.target.checked }))} />
                    App Microsoft registada / NexiForma app disponível
                  </label>
                ) : null}

                {step.id === "consent" && !completed ? (
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.5rem", fontSize: "0.82rem", color: "#cbd5e1" }}>
                    <input type="checkbox" checked={done.consent} onChange={(e) => setDone((d) => ({ ...d, consent: e.target.checked }))} />
                    Admin consent concedido no tenant M365
                  </label>
                ) : null}

                {step.id === "tenant" ? (
                  <div style={{ display: "grid", gap: "0.45rem", maxWidth: 400, marginTop: "0.5rem" }}>
                    <label style={bo.label}>
                      Azure Tenant ID
                      <input
                        style={bo.input}
                        value={teamsDraft.tenantId ?? ""}
                        onChange={(e) => onTeamsDraftChange({ ...teamsDraft, tenantId: e.target.value })}
                      />
                    </label>
                    <label style={bo.label}>
                      Email organizador M365
                      <input
                        style={bo.input}
                        value={teamsDraft.organizerId ?? ""}
                        onChange={(e) => onTeamsDraftChange({ ...teamsDraft, organizerId: e.target.value })}
                      />
                    </label>
                    <button type="button" style={bo.btnSecondary} disabled={busy || !tenantFilled} onClick={() => void onSaveTeams()}>
                      Guardar credenciais Teams
                    </button>
                  </div>
                ) : null}

                {step.id === "test" ? (
                  <button
                    type="button"
                    style={{ ...bo.btnSecondary, marginTop: "0.5rem" }}
                    disabled={busy || !tenantFilled}
                    onClick={() => void runTest()}
                  >
                    Testar ligação Teams
                  </button>
                ) : null}

                {step.id === "activate" ? (
                  <button
                    type="button"
                    style={{ ...bo.btnTeal, marginTop: "0.5rem" }}
                    disabled={busy || !oauthStatus?.teams.ready}
                    onClick={() => void onActivateOAuth()}
                  >
                    Activar OAUTH Teams
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      {msg ? <p style={{ ...bo.ok, marginTop: "0.75rem" }}>{msg}</p> : null}
      {oauthStatus && !oauthStatus.platformTeamsAppConfigured ? (
        <p style={{ color: "#fbbf24", fontSize: "0.8rem", marginTop: "0.75rem" }}>
          Aviso: app Teams da plataforma NexiForma não detectada no servidor - confirma variáveis NEXIFORMA_TEAMS_* no .env.
        </p>
      ) : null}
    </div>
  );
}
