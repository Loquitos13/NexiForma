"use client";

import { useCallback, useEffect, useState } from "react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { formatDatePt } from "@/lib/calendar-date";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { Alert, PageHeader } from "@/components/ui";
import { EmailSetupGuide } from "@/components/portal/email-setup-guide";

type EmailConfig = {
  enabled: boolean;
  provider: string;
  mode: string;
  sendsRealEmail: boolean;
  from: string;
  replyTo: string | null;
  aviso: string | null;
  dnsChecklist: string[];
  sesRegion: string | null;
  smtpHost: string | null;
};

type NotifConfig = {
  email: EmailConfig;
  sms: { enabled: boolean; provider: string };
  appPublicUrl: string;
};

type MailStats = {
  bounces30d: number;
  complaints30d: number;
  deliveries30d: number;
};

type MailEvento = {
  id: string;
  tipo: string;
  destinatario: string;
  motivo: string | null;
  ocorridoEm: string;
};

export default function NotificacoesPage() {
  const { canManage } = useTenantRole();
  const [config, setConfig] = useState<NotifConfig | null>(null);
  const [stats, setStats] = useState<MailStats | null>(null);
  const [eventos, setEventos] = useState<MailEvento[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [cRes, sRes, eRes] = await Promise.all([
      bffFetch("/api/v1/notificacoes/config", { headers: { accept: "application/json" } }),
      canManage
        ? bffFetch("/api/v1/mail/status", { headers: { accept: "application/json" } })
        : Promise.resolve(null),
      canManage
        ? bffFetch("/api/v1/mail/eventos", { headers: { accept: "application/json" } })
        : Promise.resolve(null),
    ]);
    if (cRes.ok) setConfig((await cRes.json()) as NotifConfig);
    if (sRes?.ok) {
      const s = (await sRes.json()) as { stats: MailStats };
      setStats(s.stats);
    }
    if (eRes?.ok) setEventos((await eRes.json()) as MailEvento[]);
  }, [canManage]);

  useEffect(() => {
    void load();
  }, [load]);

  async function enviarDigest() {
    if (!canManage) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    const r = await bffFetch("/api/v1/notificacoes/alertas/digest", {
      method: "POST",
      headers: { accept: "application/json" },
    });
    setBusy(false);
    if (!r.ok) {
      setError("Erro ao enviar digest.");
      return;
    }
    const d = (await r.json()) as { enviados?: number };
    setMsg(`Digest enviado${d.enviados ? ` (${d.enviados} destinatários)` : ""}.`);
  }

  async function enviarLembretes(acaoId: string) {
    if (!canManage || !acaoId) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    const r = await bffFetch("/api/v1/notificacoes/sessoes/lembretes", {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ acaoId }),
    });
    setBusy(false);
    if (!r.ok) {
      setError("Erro ao enviar lembretes.");
      return;
    }
    setMsg("Lembretes de sessão enviados.");
  }

  const email = config?.email;

  return (
    <div className="max-w-4xl space-y-5">
      <PageHeader
        title="Notificações por email"
        description="Convites, lembretes de sessão, alertas compliance e certificados. Configura SMTP (ex. Brevo/Resend) ou AWS SES - não uses SMTP do alojamento."
      />

      {error ? <Alert variant="error">{error}</Alert> : null}
      {msg ? <Alert variant="success">{msg}</Alert> : null}

      {canManage ? <EmailSetupGuide /> : null}

      {email ? (
        <div className="rounded-2xl border border-slate-700/30 bg-slate-900/50 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-200">Email transacional</h2>

          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
                email.sendsRealEmail
                  ? "bg-green-500/15 text-green-300 border border-green-500/30"
                  : "bg-amber-500/15 text-amber-300 border border-amber-500/30"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${email.sendsRealEmail ? "bg-green-400" : "bg-amber-400"}`}
              />
              {email.sendsRealEmail ? "Envio real activo" : "Modo log (dev)"}
            </span>
            <span className="text-xs text-slate-500">
              Provider: <strong className="text-slate-400">{email.provider}</strong>
              {email.sesRegion ? ` · ${email.sesRegion}` : ""}
            </span>
          </div>

          {email.aviso ? (
            <Alert variant={email.sendsRealEmail ? "info" : "warning"}>{email.aviso}</Alert>
          ) : null}

          <div className="grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
            <p>
              <span className="text-slate-500">De:</span> {email.from}
            </p>
            <p>
              <span className="text-slate-500">Reply-To:</span> {email.replyTo ?? "-"}
            </p>
          </div>

          {canManage ? (
            <>
              <div>
                <p className="text-xs font-medium text-slate-400 mb-2">Checklist DNS (entregabilidade)</p>
                <ul className="text-xs text-slate-500 space-y-1 list-disc pl-4">
                  {email.dnsChecklist.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>

              {stats ? (
                <div className="grid grid-cols-3 gap-3 text-center text-xs">
                  <div className="rounded-lg bg-slate-800/40 p-3">
                    <p className="text-lg font-bold text-green-400">{stats.deliveries30d}</p>
                    <p className="text-slate-500">Entregues (30d)</p>
                  </div>
                  <div className="rounded-lg bg-slate-800/40 p-3">
                    <p className="text-lg font-bold text-amber-400">{stats.bounces30d}</p>
                    <p className="text-slate-500">Bounces (30d)</p>
                  </div>
                  <div className="rounded-lg bg-slate-800/40 p-3">
                    <p className="text-lg font-bold text-red-400">{stats.complaints30d}</p>
                    <p className="text-slate-500">Spam reports (30d)</p>
                  </div>
                </div>
              ) : null}

              {eventos.length > 0 ? (
                <div>
                  <p className="text-xs font-medium text-slate-400 mb-2">Últimos eventos SES</p>
                  <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-700/40">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-800/50 text-slate-500">
                        <tr>
                          <th className="px-2 py-1.5 text-left">Tipo</th>
                          <th className="px-2 py-1.5 text-left">Destinatário</th>
                          <th className="px-2 py-1.5 text-left">Motivo</th>
                          <th className="px-2 py-1.5 text-right">Data</th>
                        </tr>
                      </thead>
                      <tbody>
                        {eventos
                          .filter((e) => e.tipo !== "DELIVERY")
                          .slice(0, 20)
                          .map((e) => (
                            <tr key={e.id} className="border-t border-slate-800/60">
                              <td className="px-2 py-1.5 text-slate-300">{e.tipo}</td>
                              <td className="px-2 py-1.5 text-slate-400">{e.destinatario}</td>
                              <td className="px-2 py-1.5 text-slate-500 truncate max-w-[140px]">
                                {e.motivo ?? "-"}
                              </td>
                              <td className="px-2 py-1.5 text-right text-slate-500">
                                {formatDatePt(e.ocorridoEm)}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      {canManage ? (
        <div className="rounded-2xl border border-slate-700/30 bg-slate-900/50 p-5">
          <h2 className="text-sm font-semibold text-slate-200 mb-2">Digest de alertas</h2>
          <p className="text-xs text-slate-500 mb-3">
            Resumo de compliance para administradores e formadores.
            {!email?.sendsRealEmail ? (
              <span className="text-amber-400/90"> Em modo log, o digest não chega por email.</span>
            ) : null}
          </p>
          <button
            type="button"
            onClick={() => void enviarDigest()}
            disabled={busy}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
          >
            {busy ? "A enviar…" : "Enviar digest de alertas"}
          </button>
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-700/30 bg-slate-900/50 p-5">
        <h2 className="text-sm font-semibold text-slate-200 mb-2">Lembretes de sessões</h2>
        <p className="text-xs text-slate-500 mb-3">Lembretes por email aos formandos (sessões de amanhã).</p>
        <SessaoReminderForm onSend={(id) => void enviarLembretes(id)} busy={busy} canManage={canManage} />
      </div>
    </div>
  );
}

function SessaoReminderForm({
  onSend,
  busy,
  canManage,
}: {
  onSend: (id: string) => void;
  busy: boolean;
  canManage: boolean;
}) {
  const [acoes, setAcoes] = useState<{ id: string; codigoInterno: string; titulo: string }[]>([]);
  const [acaoId, setAcaoId] = useState("");

  useEffect(() => {
    void bffFetch("/api/v1/acoes-formacao", { headers: { accept: "application/json" } }).then(
      async (r) => {
        if (r.ok) {
          const rows = (await r.json()) as { id: string; codigoInterno: string; titulo: string }[];
          setAcoes(rows);
          if (rows.length) setAcaoId(rows[0].id);
        }
      },
    );
  }, []);

  return (
    <div className="flex max-w-lg items-end gap-3">
      <div className="flex-1">
        <label className="mb-1 block text-xs font-medium text-slate-400">Acção de formação</label>
        <select
          value={acaoId}
          onChange={(e) => setAcaoId(e.target.value)}
          className="w-full rounded-lg border border-slate-700/60 bg-slate-900/80 px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500/40"
        >
          {acoes.map((a) => (
            <option key={a.id} value={a.id}>
              {a.codigoInterno} – {a.titulo}
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        onClick={() => onSend(acaoId)}
        disabled={busy || !canManage || !acaoId}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
      >
        Enviar lembretes
      </button>
    </div>
  );
}
