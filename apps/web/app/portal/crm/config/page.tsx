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
import { resolveCrmLeadWebhookUrls } from "@/lib/crm/public-api-url";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  Input,
  PageHeader,
  Select,
  Textarea,
} from "@/components/ui";

function uid() {
  return crypto.randomUUID?.() ?? `id-${Date.now()}`;
}

export default function CrmConfigPage() {
  const { canManage, writeDisabled, loading: roleLoading, sessionExpired } = useTenantRole();
  const [config, setConfig] = useState<(CrmTenantConfig & { tenantSlug?: string }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [rotateOpen, setRotateOpen] = useState(false);
  const [deleteFieldId, setDeleteFieldId] = useState<string | null>(null);

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
        emailSync: config.emailSync
          ? { ...config.emailSync, enabled: false }
          : undefined,
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
    setRotateOpen(false);
    setBusy(true);
    const res = await bffFetch("/api/v1/crm/config/webhook-secret/rotate", { method: "POST" });
    setBusy(false);
    if (res.ok) {
      const data = (await res.json()) as { leadWebhookSecret: string };
      setConfig((c) => (c ? { ...c, leadWebhookSecret: data.leadWebhookSecret } : c));
      setMsg("Novo secret de webhook gerado.");
    }
  }

  function confirmDeleteField() {
    if (!deleteFieldId || !config) return;
    setConfig({
      ...config,
      customFieldDefs: config.customFieldDefs.filter((x) => x.id !== deleteFieldId),
    });
    setDeleteFieldId(null);
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
    return (
      <>
        <PageHeader title="Configuração CRM" description="Campos custom, webhooks, automações e email sync." />
        <p className="text-slate-400">A carregar…</p>
      </>
    );
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

  const webhookUrls = resolveCrmLeadWebhookUrls(config.tenantSlug ?? "seu-tenant");
  const webhookUrl = webhookUrls.directUrl ?? webhookUrls.bffUrl ?? "";

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
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setRotateOpen(true)}
              disabled={busy || writeDisabled}
            >
              <RefreshCw className="h-3.5 w-3.5" /> Rotacionar secret
            </Button>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {webhookUrls.missingEnv ? (
              <Alert variant="warning">
                Defina <code>NEXT_PUBLIC_API_URL</code> (ou use a URL via app abaixo) para integrações externas
                correctas em produção.
              </Alert>
            ) : null}
            <p className="text-slate-400">
              POST directo API:{" "}
              <code className="text-violet-300 break-all">{webhookUrl || "-"}</code>
            </p>
            {webhookUrls.bffUrl && webhookUrls.directUrl ? (
              <p className="text-slate-500 text-xs">
                Alternativa via app (mesmo domínio):{" "}
                <code className="text-violet-300/80 break-all">{webhookUrls.bffUrl}</code>
              </p>
            ) : null}
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
            <Button type="button" variant="secondary" size="sm" onClick={addCustomField} disabled={busy || writeDisabled}>
              <Plus className="h-3.5 w-3.5" /> Campo
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {config.customFieldDefs.map((f, i) => (
              <div key={f.id} className="grid gap-2 sm:grid-cols-4 items-end">
                <Input
                  placeholder="Chave"
                  value={f.key}
                  disabled={busy || writeDisabled}
                  onChange={(e) => {
                    const defs = [...config.customFieldDefs];
                    defs[i] = { ...f, key: e.target.value };
                    setConfig({ ...config, customFieldDefs: defs });
                  }}
                />
                <Input
                  placeholder="Etiqueta"
                  value={f.label}
                  disabled={busy || writeDisabled}
                  onChange={(e) => {
                    const defs = [...config.customFieldDefs];
                    defs[i] = { ...f, label: e.target.value };
                    setConfig({ ...config, customFieldDefs: defs });
                  }}
                />
                <Select
                  value={f.entity}
                  disabled={busy || writeDisabled}
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
                  aria-label="Remover campo"
                  disabled={busy || writeDisabled}
                  onClick={() => setDeleteFieldId(f.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {!config.customFieldDefs.length ? (
              <p className="text-sm text-slate-500">Sem campos custom - adicione para leads, clientes ou propostas.</p>
            ) : (
              <p className="text-xs text-slate-500">
                Campos de entidade <strong>lead</strong> aparecem no formulário de criação de leads.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Webhooks outbound (Zapier/Make)</CardTitle>
            <Button type="button" variant="secondary" size="sm" onClick={addWebhook} disabled={busy || writeDisabled}>
              <Plus className="h-3.5 w-3.5" /> Webhook
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {config.outboundWebhooks.map((w, i) => (
              <div key={w.id} className="space-y-2 rounded-lg border border-slate-700/40 p-3">
                <Input
                  placeholder="URL"
                  value={w.url}
                  disabled={busy || writeDisabled}
                  onChange={(e) => {
                    const hooks = [...config.outboundWebhooks];
                    hooks[i] = { ...w, url: e.target.value };
                    setConfig({ ...config, outboundWebhooks: hooks });
                  }}
                />
                <select
                  multiple
                  value={w.events}
                  disabled={busy || writeDisabled}
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
            <Button type="button" variant="secondary" size="sm" onClick={addAutomation} disabled={busy || writeDisabled}>
              <Plus className="h-3.5 w-3.5" /> Regra
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {config.automations.map((a, i) => (
              <div key={a.id} className="grid gap-2 sm:grid-cols-4">
                <Input
                  value={a.name}
                  disabled={busy || writeDisabled}
                  onChange={(e) => {
                    const rules = [...config.automations];
                    rules[i] = { ...a, name: e.target.value };
                    setConfig({ ...config, automations: rules });
                  }}
                />
                <Select
                  value={a.trigger}
                  disabled={busy || writeDisabled}
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
                  disabled={busy || writeDisabled}
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
                    disabled={busy || writeDisabled}
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
            <CardTitle className="text-base">Email sync (Gmail / M365) - indisponível</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Alert variant="warning">
              Sincronização OAuth Gmail/M365 ainda não está disponível. Esta secção ficará activa numa
              actualização futura - não afecta leads, propostas nem webhooks.
            </Alert>
            <p className="text-xs text-slate-500">
              Provider preferido: {config.emailSync?.provider ?? "GMAIL"}
              {config.emailSync?.mailbox ? ` · ${config.emailSync.mailbox}` : ""}
            </p>
            <p className="text-xs text-slate-600 italic">
              Os campos de configuração de email sync não são editáveis nesta versão.
            </p>
          </CardContent>
        </Card>

        <Button type="submit" disabled={busy || writeDisabled}>
          Guardar configuração
        </Button>
      </form>

      <Dialog open={rotateOpen} onOpenChange={setRotateOpen}>
        <DialogContent
          title="Rotacionar secret de webhook"
          description="Integrações externas que usam o secret actual deixarão de funcionar até actualizar a assinatura HMAC."
        >
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setRotateOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={busy} onClick={() => void rotateSecret()}>
              Confirmar rotação
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteFieldId} onOpenChange={(o) => !o && setDeleteFieldId(null)}>
        <DialogContent
          title="Remover campo personalizado"
          description="O campo deixará de aparecer nos formulários. Dados já guardados não são apagados automaticamente."
        >
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setDeleteFieldId(null)}>
              Cancelar
            </Button>
            <Button type="button" variant="secondary" disabled={busy} onClick={confirmDeleteField}>
              Remover
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
