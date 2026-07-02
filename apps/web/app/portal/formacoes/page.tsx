"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Globe, PlusCircle, RefreshCw, Upload } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { parseApiError } from "@/lib/ui/backoffice";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  Input,
  PageHeader,
  Textarea,
} from "@/components/ui";
import { FormacaoAcoesPanel } from "@/components/portal/formacao-acoes-panel";

type Formacao = {
  uuid: string;
  id: number | string;
  codigoPublico: number | null;
  titulo: string;
  horas: number;
  ufcd: string | null;
  publicado: boolean;
  capaUrl: string | null;
  totalAcoes?: number;
};

type WebsiteConfig = {
  enabled: boolean;
  webhookUrl: string;
  hasSecret: boolean;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastSyncError: string | null;
};

const EMPTY = {
  titulo: "",
  horas: "25",
  ufcd: "",
  enquadramento: "",
  objetivos: "",
  metodoEnsino: "",
  modalidade: "presencial",
  publicado: false,
};

export default function FormacoesWebsitePage() {
  const { canManage } = useTenantRole();
  const [items, setItems] = useState<Formacao[]>([]);
  const [webConfig, setWebConfig] = useState<WebsiteConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [webForm, setWebForm] = useState({ enabled: false, webhookUrl: "", webhookSecret: "" });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [fRes, wRes] = await Promise.all([
      bffFetch("/api/v1/formacoes", { headers: { accept: "application/json" } }),
      canManage
        ? bffFetch("/api/v1/formacoes/website/config", { headers: { accept: "application/json" } })
        : Promise.resolve(null),
    ]);
    if (!fRes.ok) setError(await parseApiError(fRes));
    else setItems((await fRes.json()) as Formacao[]);
    if (wRes?.ok) {
      const w = (await wRes.json()) as WebsiteConfig;
      setWebConfig(w);
      setWebForm({ enabled: w.enabled, webhookUrl: w.webhookUrl, webhookSecret: "" });
    }
    setLoading(false);
  }, [canManage]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveWebsite(e: FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    setBusy(true);
    setMsg(null);
    const body: Record<string, unknown> = {
      enabled: webForm.enabled,
      webhookUrl: webForm.webhookUrl,
    };
    if (webForm.webhookSecret.trim()) body.webhookSecret = webForm.webhookSecret.trim();
    const r = await bffFetch("/api/v1/formacoes/website/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!r.ok) {
      setError(await parseApiError(r));
      return;
    }
    setMsg("Configuração do website guardada.");
    void load();
  }

  async function syncWebsite() {
    setBusy(true);
    setMsg(null);
    const r = await bffFetch("/api/v1/formacoes/website/sync", {
      method: "POST",
      headers: { accept: "application/json" },
    });
    setBusy(false);
    if (!r.ok) {
      setError("Sync falhou.");
      return;
    }
    const d = (await r.json()) as { ok?: boolean; error?: string };
    setMsg(d.ok ? "Catálogo enviado para o website." : `Sync: ${d.error ?? "erro"}`);
    void load();
  }

  async function createFormacao(e: FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    setBusy(true);
    setError(null);
    const r = await bffFetch("/api/v1/formacoes", {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        titulo: form.titulo.trim(),
        horas: Number(form.horas),
        ufcd: form.ufcd.trim() || undefined,
        enquadramento: form.enquadramento.trim() || undefined,
        objetivos: form.objetivos.trim() || undefined,
        metodoEnsino: form.metodoEnsino.trim() || undefined,
        modalidade: form.modalidade,
        publicado: form.publicado,
      }),
    });
    setBusy(false);
    if (!r.ok) {
      setError(await parseApiError(r));
      return;
    }
    setDialogOpen(false);
    setForm(EMPTY);
    setMsg(
      form.publicado
        ? "Formação criada e publicada no catálogo (sync website se activo)."
        : "Formação criada com sucesso.",
    );
    void load();
  }

  async function deleteFormacao(f: Formacao) {
    if (!canManage) return;
    if (!window.confirm(`Eliminar «${f.titulo}»? Só é possível sem acções associadas.`)) return;
    setBusy(true);
    setError(null);
    const r = await bffFetch(`/api/v1/formacoes/${f.uuid}`, { method: "DELETE" });
    setBusy(false);
    if (!r.ok) {
      setError(await parseApiError(r));
      return;
    }
    setMsg(`Formação «${f.titulo}» eliminada do catálogo.`);
    void load();
  }

  async function togglePublicado(f: Formacao) {
    if (!canManage) return;
    setBusy(true);
    const r = await bffFetch(`/api/v1/formacoes/${f.uuid}/publicar`, {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ publicado: !f.publicado }),
    });
    setBusy(false);
    if (!r.ok) {
      setError(await parseApiError(r));
      return;
    }
    setMsg(
      f.publicado
        ? `«${f.titulo}» despublicada - removida do website.`
        : `«${f.titulo}» publicada - sync enviado ao website.`,
    );
    void load();
  }

  async function uploadCapa(f: Formacao, file: File) {
    if (!canManage) return;
    const fd = new FormData();
    fd.append("file", file);
    setBusy(true);
    const r = await bffFetch(`/api/v1/formacoes/${f.uuid}/capa`, { method: "POST", body: fd });
    setBusy(false);
    if (!r.ok) setError("Upload da capa falhou.");
    else {
      setMsg("Capa actualizada.");
      void load();
    }
  }

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        title="Formações - website"
        description="Publica o catálogo na NexiForma e sincroniza automaticamente com o website do tenant via webhook."
      />

      {error ? <Alert variant="error">{error}</Alert> : null}
      {msg ? <Alert variant="success">{msg}</Alert> : null}

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="h-4 w-4" /> Sync com website do tenant
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void saveWebsite(e)} className="space-y-3 max-w-xl">
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={webForm.enabled}
                  onChange={(e) => setWebForm((p) => ({ ...p, enabled: e.target.checked }))}
                />
                Activar publicação automática (webhook)
              </label>
              <Input
                placeholder="https://seu-site.pt/api/nexiforma/webhook"
                value={webForm.webhookUrl}
                onChange={(e) => setWebForm((p) => ({ ...p, webhookUrl: e.target.value }))}
              />
              <Input
                type="password"
                placeholder={webConfig?.hasSecret ? "Novo segredo (opcional)" : "Segredo HMAC (opcional)"}
                value={webForm.webhookSecret}
                onChange={(e) => setWebForm((p) => ({ ...p, webhookSecret: e.target.value }))}
              />
              {webConfig?.lastSyncAt ? (
                <p className="text-xs text-slate-500">
                  Último sync: {new Date(webConfig.lastSyncAt).toLocaleString("pt-PT")} -{" "}
                  <span className={webConfig.lastSyncStatus === "ok" ? "text-green-400" : "text-red-400"}>
                    {webConfig.lastSyncStatus}
                  </span>
                  {webConfig.lastSyncError ? ` (${webConfig.lastSyncError})` : ""}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={busy}>
                  Guardar
                </Button>
                <Button type="button" variant="secondary" disabled={busy} onClick={() => void syncWebsite()}>
                  <RefreshCw className="h-4 w-4 mr-1" /> Sync completo agora
                </Button>
                <Button type="button" variant="ghost" asChild>
                  <a
                    href={`${process.env.NEXT_PUBLIC_API_DOCS_URL ?? "http://localhost:4001"}/formacoes`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Swagger API
                  </a>
                </Button>
                <Button type="button" variant="ghost" asChild>
                  <a
                    href="/api/v1/docs/tenant-website-sync.openapi.json"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    OpenAPI (webhook)
                  </a>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex justify-between items-center">
        <h2 className="text-sm font-semibold text-slate-200">Catálogo</h2>
        {canManage ? (
          <Button onClick={() => setDialogOpen(true)}>
            <PlusCircle className="h-4 w-4 mr-1" /> Nova formação
          </Button>
        ) : null}
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">A carregar…</p>
      ) : (
        <div className="space-y-3">
          {items.map((f) => (
            <Card key={f.uuid}>
              <CardContent className="py-4 flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-100">
                      #{f.codigoPublico ?? f.id} - {f.titulo}
                    </p>
                    <p className="text-xs text-slate-500">
                      {f.horas}h · {f.ufcd ?? "sem UFCD"} · {f.totalAcoes ?? 0} acções
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={f.publicado ? "success" : "secondary"}>
                      {f.publicado ? "Publicado" : "Rascunho"}
                    </Badge>
                    {canManage ? (
                      <>
                        <label className="cursor-pointer text-xs text-blue-400 hover:underline flex items-center gap-1">
                          <Upload className="h-3 w-3" /> Capa
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) void uploadCapa(f, file);
                            }}
                          />
                        </label>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={busy}
                          onClick={() => void togglePublicado(f)}
                        >
                          {f.publicado ? "Despublicar" : "Publicar"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          className="text-red-400"
                          onClick={() => void deleteFormacao(f)}
                        >
                          Eliminar
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
                <FormacaoAcoesPanel
                  cursoUuid={f.uuid}
                  cursoTitulo={f.titulo}
                  canManage={canManage}
                  onChanged={() => void load()}
                />
              </CardContent>
            </Card>
          ))}
          {!items.length ? <p className="text-sm text-slate-500">Sem formações.</p> : null}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent title="Nova formação">
          <form onSubmit={(e) => void createFormacao(e)} className="space-y-3">
            <Input
              placeholder="Título"
              value={form.titulo}
              onChange={(e) => setForm((p) => ({ ...p, titulo: e.target.value }))}
              required
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                min={1}
                placeholder="Horas"
                value={form.horas}
                onChange={(e) => setForm((p) => ({ ...p, horas: e.target.value }))}
                required
              />
              <Input
                placeholder="UFCD (opcional)"
                value={form.ufcd}
                onChange={(e) => setForm((p) => ({ ...p, ufcd: e.target.value }))}
              />
            </div>
            <Textarea
              placeholder="Enquadramento"
              value={form.enquadramento}
              onChange={(e) => setForm((p) => ({ ...p, enquadramento: e.target.value }))}
              rows={2}
            />
            <Textarea
              placeholder="Objectivos"
              value={form.objetivos}
              onChange={(e) => setForm((p) => ({ ...p, objetivos: e.target.value }))}
              rows={2}
            />
            <Input
              placeholder="Método de ensino"
              value={form.metodoEnsino}
              onChange={(e) => setForm((p) => ({ ...p, metodoEnsino: e.target.value }))}
            />
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={form.publicado}
                onChange={(e) => setForm((p) => ({ ...p, publicado: e.target.checked }))}
              />
              Publicar no website
            </label>
            <Button type="submit" disabled={busy} className="w-full">
              Criar
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
