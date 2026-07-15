"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { parseApiError } from "@/lib/ui/backoffice";
import {
  CRM_WEBHOOK_EVENTS,
  type CrmAutomationRule,
  type CrmCustomFieldDef,
  type CrmOutboundWebhook,
  type CrmTenantConfig,
} from "@nexiforma/shared";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  PageHeader,
  Select,
  Textarea,
} from "@/components/ui";

function uid() {
  return crypto.randomUUID?.() ?? `id-${Date.now()}`;
}

export default function CrmConfigPage() {
  const { canManage, loading: roleLoading, sessionExpired } = useTenantRole();
  const [config, setConfig] = useState<(CrmTenantConfig & { tenantSlug?: string }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!canManage) return;
    setLoading(true);
    const res = await bffFetch("/api/v1/crm/config", { headers: { accept: "application/json" } });
    setLoading(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    setConfig((await res.json()) as CrmTenantConfig & { tenantSlug: string });
  }, [canManage]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!config) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    const res = await bffFetch("/api/v1/crm/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        customFieldDefs: config.customFieldDefs,
        outboundWebhooks: config.outboundWebhooks,
        automations: config.automations,
        emailSync: config.emailSync,
      }),
    });
    setBusy(false);
    if (!res.ok) setError(await parseApiError(res));
    else {
      setConfig(await res.json());
      setMsg("Configuração guardada.");
    }
  }

  async function rotateSecret() {
    setBusy(true);
    const res = await bffFetch("/api/v1/crm/config/webhook-secret/rotate", { method: "POST" });
    setBusy(false);
    if (res.ok) {
      const data = (await res.json()) as { leadWebhookSecret: string };
      setConfig((c) => (c ? { ...c, leadWebhookSecret: data.leadWebhookSecret } : c));
      setMsg("Novo secret de webhook gerado.");
    }
  }

  function addCustomField() {
    setConfig((c) =>
      c
        ? {
            ...c,
            customFieldDefs: [
              ...c.customFieldDefs,
              { id: uid(), entity: "lead", key: "", label: "", type: "text" } satisfies CrmCustomFieldDef,
            ],
          }
        : c,
    );
  }

  function addWebhook() {
    setConfig((c) =>
      c
        ? {
            ...c,
            outboundWebhooks: [
              ...c.outboundWebhooks,
              {
                id: uid(),
                url: "",
                events: ["lead.created"],
                active: true,
              } satisfies CrmOutboundWebhook,
            ],
          }
        : c,
    );
  }

  function addAutomation() {
    setConfig((c) =>
      c
        ? {
            ...c,
            automations: [
              ...c.automations,
              {
                id: uid(),
                name: "Nova regra",
                trigger: "LEAD_CREATED",
                action: "WEBHOOK",
                active: true,
              } satisfies CrmAutomationRule,
            ],
          }
        : c,
    );
  }

  if (sessionExpired || roleLoading) {
    return null;
  }

  if (!canManage) {
    return <Alert variant="error">Configuração CRM disponível apenas para gestores.</Alert>;
  }

  if (loading || !config) {
    return (
      <>
        <PageHeader title="Configuração CRM" description="Campos custom, webhooks, automações e email sync." />
        <p className="text-slate-400">A carregar…</p>
      </>
    );
  }

  const webhookUrl = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/public/v1/webhooks/leads/${config.tenantSlug ?? "seu-tenant"}`;

  return (
    <>
      <PageHeader
        title="Configuração CRM"
        description="Paridade HubSpot/Pipedrive: campos personalizados, webhooks outbound, sequências automáticas e email sync."
      />
      {error ? <Alert variant="error" className="mb-4">{error}</Alert> : null}
      {msg ? <Alert variant="success" className="mb-4">{msg}</Alert> : null}

      <form onSubmit={save} className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Webhook inbound (website)</CardTitle>
            <Button type="button" variant="secondary" size="sm" onClick={() => void rotateSecret()} disabled={busy}>
              <RefreshCw className="h-3.5 w-3.5" /> Rotacionar secret
            </Button>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-slate-400">
              POST <code className="text-violet-300">{webhookUrl}</code>
            </p>
            <p className="text-slate-500">
              Header <code>X-NexiForma-Signature</code>: HMAC-SHA256 de{" "}
              <code>empresaNome|email|telefone</code> com o secret abaixo.
            </p>
            {config.leadWebhookSecret ? (
              <Textarea readOnly value={config.leadWebhookSecret} rows={2} className="font-mono text-xs" />
            ) : (
              <p className="text-amber-400">Gere um secret para activar o webhook.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Campos personalizados</CardTitle>
            <Button type="button" variant="secondary" size="sm" onClick={addCustomField}>
              <Plus className="h-3.5 w-3.5" /> Campo
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {config.customFieldDefs.map((f, i) => (
              <div key={f.id} className="grid gap-2 sm:grid-cols-4 items-end">
                <Input
                  placeholder="Chave"
                  value={f.key}
                  onChange={(e) => {
                    const defs = [...config.customFieldDefs];
                    defs[i] = { ...f, key: e.target.value };
                    setConfig({ ...config, customFieldDefs: defs });
                  }}
                />
                <Input
                  placeholder="Etiqueta"
                  value={f.label}
                  onChange={(e) => {
                    const defs = [...config.customFieldDefs];
                    defs[i] = { ...f, label: e.target.value };
                    setConfig({ ...config, customFieldDefs: defs });
                  }}
                />
                <Select
                  value={f.entity}
                  onChange={(e) => {
                    const defs = [...config.customFieldDefs];
                    defs[i] = { ...f, entity: e.target.value as CrmCustomFieldDef["entity"] };
                    setConfig({ ...config, customFieldDefs: defs });
                  }}
                >
                  <option value="lead">Lead</option>
                  <option value="entidade">Cliente</option>
                  <option value="proposta">Proposta</option>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setConfig({
                      ...config,
                      customFieldDefs: config.customFieldDefs.filter((x) => x.id !== f.id),
                    })
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {!config.customFieldDefs.length ? (
              <p className="text-sm text-slate-500">Sem campos custom - adicione para leads, clientes ou propostas.</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Webhooks outbound (Zapier/Make)</CardTitle>
            <Button type="button" variant="secondary" size="sm" onClick={addWebhook}>
              <Plus className="h-3.5 w-3.5" /> Webhook
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {config.outboundWebhooks.map((w, i) => (
              <div key={w.id} className="space-y-2 rounded-lg border border-slate-700/40 p-3">
                <Input
                  placeholder="URL"
                  value={w.url}
                  onChange={(e) => {
                    const hooks = [...config.outboundWebhooks];
                    hooks[i] = { ...w, url: e.target.value };
                    setConfig({ ...config, outboundWebhooks: hooks });
                  }}
                />
                <select
                  multiple
                  value={w.events}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
                    const hooks = [...config.outboundWebhooks];
                    hooks[i] = { ...w, events: selected as CrmOutboundWebhook["events"] };
                    setConfig({ ...config, outboundWebhooks: hooks });
                  }}
                  className="min-h-[80px] w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
                >
                  {CRM_WEBHOOK_EVENTS.map((ev) => (
                    <option key={ev} value={ev}>
                      {ev}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Automações (marketing sequences MVP)</CardTitle>
            <Button type="button" variant="secondary" size="sm" onClick={addAutomation}>
              <Plus className="h-3.5 w-3.5" /> Regra
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {config.automations.map((a, i) => (
              <div key={a.id} className="grid gap-2 sm:grid-cols-4">
                <Input
                  value={a.name}
                  onChange={(e) => {
                    const rules = [...config.automations];
                    rules[i] = { ...a, name: e.target.value };
                    setConfig({ ...config, automations: rules });
                  }}
                />
                <Select
                  value={a.trigger}
                  onChange={(e) => {
                    const rules = [...config.automations];
                    rules[i] = { ...a, trigger: e.target.value as CrmAutomationRule["trigger"] };
                    setConfig({ ...config, automations: rules });
                  }}
                >
                  <option value="LEAD_CREATED">Lead criado</option>
                  <option value="LEAD_STALE">Lead parado</option>
                  <option value="PROPOSTA_SENT">Proposta enviada</option>
                </Select>
                <Select
                  value={a.action}
                  onChange={(e) => {
                    const rules = [...config.automations];
                    rules[i] = { ...a, action: e.target.value as CrmAutomationRule["action"] };
                    setConfig({ ...config, automations: rules });
                  }}
                >
                  <option value="WEBHOOK">Webhook</option>
                  <option value="CREATE_NOTA">Criar nota</option>
                  <option value="CREATE_SUGESTAO">Sugestão IA</option>
                </Select>
                {a.trigger === "LEAD_STALE" ? (
                  <Input
                    type="number"
                    placeholder="Dias"
                    value={a.daysAfter ?? 7}
                    onChange={(e) => {
                      const rules = [...config.automations];
                      rules[i] = { ...a, daysAfter: parseInt(e.target.value, 10) || 7 };
                      setConfig({ ...config, automations: rules });
                    }}
                  />
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Email sync (Gmail / M365)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4 items-center">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={config.emailSync?.enabled ?? false}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    emailSync: {
                      provider: config.emailSync?.provider ?? "GMAIL",
                      enabled: e.target.checked,
                      mailbox: config.emailSync?.mailbox,
                    },
                  })
                }
              />
              Activar sincronização
            </label>
            <Select
              value={config.emailSync?.provider ?? "GMAIL"}
              onChange={(e) =>
                setConfig({
                  ...config,
                  emailSync: {
                    enabled: config.emailSync?.enabled ?? false,
                    provider: e.target.value as "GMAIL" | "M365",
                    mailbox: config.emailSync?.mailbox,
                  },
                })
              }
            >
              <option value="GMAIL">Gmail</option>
              <option value="M365">Microsoft 365</option>
            </Select>
            <p className="text-xs text-slate-500 w-full">
              OAuth Gmail/M365: configure credenciais em Integrações. Última sync:{" "}
              {config.emailSync?.lastSyncAt
                ? new Date(config.emailSync.lastSyncAt).toLocaleString("pt-PT")
                : "nunca"}
            </p>
          </CardContent>
        </Card>

        <Button type="submit" disabled={busy}>
          Guardar configuração
        </Button>
      </form>
    </>
  );
}
