"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Lock, Shield, Upload, User } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { formatDatePt } from "@/lib/calendar-date";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { parseApiError } from "@/lib/ui/backoffice";
import { cn } from "@/lib/ui/cn";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Textarea,
} from "@/components/ui";
import { PasswordInput } from "@/components/ui/password-input";
import { DocumentPreviewModal } from "@/components/ui/document-preview-modal";
import { notifyDocumentosObrigatoriosUpdated } from "@/components/portal/documentos-obrigatorios-gate";
import { DocPendenteNeonDot } from "@/components/portal/doc-pendente-neon-dot";
import {
  PersonaIdVerification,
  usePersonaEnabled,
} from "@/components/persona/persona-id-verification";
import {
  FORMADOR_DOC_CATEGORIAS_UPLOAD,
  type FormadorDocObrigatorioResumo,
} from "@/lib/formador/documentos-obrigatorios";
import { AVISO_NOME_DOCUMENTO_OUTROS } from "@/lib/documentos/nome-ficheiro-aviso";

type TabId = "dados" | "seguranca" | "documentos";

type Perfil = {
  id: string;
  nomeCompleto: string;
  nif: string;
  email: string;
  emailPresenca: string | null;
  telefone: string | null;
  morada: string | null;
  ccNumero: string | null;
  ccpNumero: string | null;
  ccValidade: string | null;
  ccpValidade: string | null;
  tenantLegalName: string | null;
};

type Documento = {
  id: string;
  nome: string;
  categoria: string | null;
  mimeType: string;
  tamanhoBytes: number;
  createdAt: string;
};

type DocRequisicao = {
  id: string;
  titulo: string;
  descricao: string | null;
  estado: string;
  createdAt: string;
  submetidoEm: string | null;
  documentoAnexo?: {
    id: string;
    nome: string;
    tamanhoBytes: number;
  } | null;
};

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "dados", label: "Dados" },
  { id: "seguranca", label: "Segurança" },
  { id: "documentos", label: "Documentos" },
];

const DOC_CATEGORIAS = FORMADOR_DOC_CATEGORIAS_UPLOAD;

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FormadorPerfilPage() {
  const router = useRouter();
  const { role, loading: roleLoading, isFormador } = useTenantRole();
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<TabId>("dados");
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [docs, setDocs] = useState<Documento[]>([]);
  const [requisicoes, setRequisicoes] = useState<DocRequisicao[]>([]);
  const [obrigatorios, setObrigatorios] = useState<FormadorDocObrigatorioResumo | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [categoria, setCategoria] = useState("cv");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [form, setForm] = useState({
    nomeCompleto: "",
    emailPresenca: "",
    telefone: "",
    morada: "",
    ccNumero: "",
    ccpNumero: "",
    ccValidade: "",
    ccpValidade: "",
  });
  const { enabled: personaEnabled, ready: personaReady } = usePersonaEnabled();
  const idDocOk = obrigatorios?.items.find((i) => i.id === "documento_identificacao")?.completo;

  useEffect(() => {
    if (personaReady && personaEnabled && categoria === "documento_identificacao") {
      setCategoria("cv");
    }
  }, [personaReady, personaEnabled, categoria]);

  const load = useCallback(async () => {
    setError(null);
    const [meRes, docsRes, obrRes, reqRes] = await Promise.all([
      bffFetch("/api/v1/formadores/me", { headers: { accept: "application/json" } }),
      bffFetch("/api/v1/formadores/me/documentos", { headers: { accept: "application/json" } }),
      bffFetch("/api/v1/formadores/me/documentos/obrigatorios", {
        headers: { accept: "application/json" },
      }),
      bffFetch("/api/v1/formadores/me/documentos/requisicoes", {
        headers: { accept: "application/json" },
      }),
    ]);
    if (!meRes.ok) {
      setError(await parseApiError(meRes));
      return;
    }
    const me = (await meRes.json()) as Perfil;
    setPerfil(me);
    setForm({
      nomeCompleto: me.nomeCompleto,
      emailPresenca: me.emailPresenca ?? "",
      telefone: me.telefone ?? "",
      morada: me.morada ?? "",
      ccNumero: me.ccNumero ?? "",
      ccpNumero: me.ccpNumero ?? "",
      ccValidade: me.ccValidade ? me.ccValidade.slice(0, 10) : "",
      ccpValidade: me.ccpValidade ? me.ccpValidade.slice(0, 10) : "",
    });
    if (docsRes.ok) setDocs((await docsRes.json()) as Documento[]);
    if (reqRes.ok) setRequisicoes((await reqRes.json()) as DocRequisicao[]);
    if (obrRes.ok) {
      setObrigatorios((await obrRes.json()) as FormadorDocObrigatorioResumo);
    }
  }, []);

  useEffect(() => {
    if (roleLoading) return;
    if (!isFormador) {
      router.replace(role === "formando" ? "/portal/formando/perfil" : "/portal/rgpd");
      return;
    }
    void load();
  }, [load, roleLoading, isFormador, role, router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t === "documentos" || t === "dados" || t === "seguranca") setTab(t);
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const docsEmFalta = Boolean(obrigatorios && !obrigatorios.completo);

  async function savePerfil(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMsg(null);
    const res = await bffFetch("/api/v1/formadores/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        nomeCompleto: form.nomeCompleto.trim(),
        emailPresenca: form.emailPresenca.trim() || null,
        telefone: form.telefone.trim() || null,
        morada: form.morada.trim() || null,
        ccNumero: form.ccNumero.trim() || null,
        ccpNumero: form.ccpNumero.trim() || null,
        ccValidade: form.ccValidade || null,
        ccpValidade: form.ccpValidade || null,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    setMsg("Perfil actualizado.");
    await load();
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMsg(null);
    if (newPassword !== confirmPassword) {
      setError("As palavras-passe novas não coincidem.");
      return;
    }
    if (newPassword.length < 8) {
      setError("A nova palavra-passe deve ter pelo menos 8 caracteres.");
      return;
    }
    setBusy(true);
    const res = await bffFetch("/api/v1/formadores/me/password", {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    setMsg("Palavra-passe actualizada.");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  async function onUpload(file: File) {
    setUploading(true);
    setError(null);
    setMsg(null);
    const fd = new FormData();
    fd.append("file", file);
    const r = await bffFetch(
      `/api/v1/formadores/me/documentos?categoria=${encodeURIComponent(categoria)}`,
      { method: "POST", body: fd },
    );
    setUploading(false);
    if (!r.ok) {
      setError(await parseApiError(r));
      return;
    }
    setMsg("Documento enviado.");
    await load();
    notifyDocumentosObrigatoriosUpdated();
  }

  async function verDocumento(doc: Documento) {
    setError(null);
    const r = await bffFetch(`/api/v1/formadores/me/documentos/${doc.id}/download`);
    if (!r.ok) {
      setError(await parseApiError(r));
      return;
    }
    const blob = await r.blob();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(blob));
    setPreviewTitle(doc.nome);
  }

  if (roleLoading || !isFormador) {
    return (
      <div className="max-w-4xl mx-auto px-5 py-8">
        <p className="text-sm text-slate-500">A redireccionar…</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-5 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-50">O meu perfil</h1>
        <p className="text-sm text-slate-400 mt-1">
          Dados pessoais, segurança e documentos para a entidade formadora
          {perfil?.tenantLegalName ? ` (${perfil.tenantLegalName})` : ""}.
        </p>
      </div>

      {msg ? <Alert variant="success">{msg}</Alert> : null}
      {error ? <Alert variant="error">{error}</Alert> : null}
      {docsEmFalta ? (
        <Alert variant="warning">
          Faltam documentos obrigatórios:{" "}
          {obrigatorios!.items
            .filter((i) => !i.completo)
            .map((i) => i.label)
            .join(", ")}
          .{" "}
          <button
            type="button"
            className="underline font-medium"
            onClick={() => setTab("documentos")}
          >
            Ir para Documentos
          </button>
        </Alert>
      ) : null}

      <div
        role="tablist"
        aria-label="Secções do perfil"
        className="flex flex-wrap gap-1 rounded-xl border border-slate-700/40 bg-slate-900/50 p-1"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              tab === t.id
                ? "bg-slate-800 text-slate-50 shadow-sm"
                : "text-slate-400 hover:text-slate-200",
            )}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.id === "documentos" && docsEmFalta ? (
              <DocPendenteNeonDot className="ml-1.5 align-middle" />
            ) : null}
          </button>
        ))}
      </div>

      {tab === "dados" ? (
        <Card className="border-slate-700/30 bg-slate-900/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4 text-blue-400" />
              Dados pessoais
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!perfil ? (
              <p className="text-sm text-slate-500">A carregar…</p>
            ) : (
              <form onSubmit={(e) => void savePerfil(e)} className="grid gap-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    label="Nome completo *"
                    required
                    value={form.nomeCompleto}
                    onChange={(e) => setForm((f) => ({ ...f, nomeCompleto: e.target.value }))}
                  />
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">
                      Contribuinte (NIF)
                    </label>
                    <p className="h-9 flex items-center rounded-lg border border-slate-700/60 bg-slate-900/40 px-3 text-sm font-mono text-slate-400">
                      {perfil.nif}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="email"
                        value={perfil.email}
                        readOnly
                        disabled
                        className="flex-1 min-w-[200px] h-9 px-3 rounded-lg bg-slate-900/60 border border-slate-700/40 text-slate-500 text-sm cursor-not-allowed"
                      />
                      <Badge variant="default" className="gap-1 shrink-0">
                        <Lock className="h-3 w-3" />
                        Conta
                      </Badge>
                    </div>
                  </div>
                  <Input
                    label="Email para presença na reunião"
                    type="email"
                    value={form.emailPresenca}
                    onChange={(e) => setForm((f) => ({ ...f, emailPresenca: e.target.value }))}
                  />
                  <Input
                    label="Telefone"
                    value={form.telefone}
                    onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))}
                  />
                </div>
                <Textarea
                  label="Morada"
                  rows={2}
                  value={form.morada}
                  onChange={(e) => setForm((f) => ({ ...f, morada: e.target.value }))}
                  placeholder="Rua, código postal, localidade"
                />
                <div className="rounded-xl border border-slate-700/40 bg-slate-900/30 p-3 space-y-3">
                  <p className="text-xs font-semibold text-slate-400">Credenciais DGERT (CC / CCP)</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      label="CC n.º"
                      value={form.ccNumero}
                      onChange={(e) => setForm((f) => ({ ...f, ccNumero: e.target.value }))}
                    />
                    <Input
                      label="CC validade"
                      type="date"
                      value={form.ccValidade}
                      onChange={(e) => setForm((f) => ({ ...f, ccValidade: e.target.value }))}
                    />
                    <Input
                      label="CCP n.º"
                      value={form.ccpNumero}
                      onChange={(e) => setForm((f) => ({ ...f, ccpNumero: e.target.value }))}
                    />
                    <Input
                      label="CCP validade"
                      type="date"
                      value={form.ccpValidade}
                      onChange={(e) => setForm((f) => ({ ...f, ccpValidade: e.target.value }))}
                    />
                  </div>
                </div>
                <Button type="submit" disabled={busy}>
                  {busy ? "A guardar…" : "Guardar perfil"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      ) : null}

      {tab === "seguranca" ? (
        <Card className="border-slate-700/30 bg-slate-900/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4 text-teal-400" />
              Palavra-passe
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void savePassword(e)} className="grid gap-4 sm:grid-cols-2 max-w-lg">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Actual</label>
                <PasswordInput
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700/60 text-slate-100 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Nova</label>
                <PasswordInput
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700/60 text-slate-100 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Confirmar</label>
                <PasswordInput
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700/60 text-slate-100 text-sm"
                />
              </div>
              <p className="sm:col-span-2 text-xs text-slate-500">Mínimo 8 caracteres.</p>
              <div className="sm:col-span-2">
                <Button type="submit" variant="secondary" disabled={busy}>
                  Actualizar palavra-passe
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {tab === "documentos" ? (
        <div className="space-y-6">
          {requisicoes.length > 0 ? (
            <Card className="border-slate-700/30 bg-slate-900/40 border-sky-500/15">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-sky-400" />
                  Pedidos da entidade formadora
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-slate-400">
                  A entidade pediu documentos adicionais. Envie o ficheiro pedido (PDF, JPG ou PNG).
                </p>
                <ul className="space-y-3">
                  {requisicoes.map((r) => (
                    <li
                      key={r.id}
                      className="rounded-xl border border-slate-700/30 bg-slate-800/30 px-4 py-3 space-y-2"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-slate-100">{r.titulo}</p>
                          {r.descricao ? (
                            <p className="text-xs text-slate-500 mt-1">{r.descricao}</p>
                          ) : null}
                        </div>
                        <Badge variant={r.estado === "submetido" ? "green" : "yellow"}>
                          {r.estado === "submetido" ? "Enviado" : "Pendente"}
                        </Badge>
                      </div>
                      {r.documentoAnexo ? (
                        <p className="text-xs text-slate-500">
                          Ficheiro: {r.documentoAnexo.nome}
                          {r.documentoAnexo.tamanhoBytes
                            ? ` (${formatBytes(r.documentoAnexo.tamanhoBytes)})`
                            : ""}
                        </p>
                      ) : null}
                      {r.estado === "pendente" || r.estado === "submetido" ? (
                        <label className="inline-flex">
                          <input
                            type="file"
                            accept="application/pdf,image/jpeg,image/png"
                            className="sr-only"
                            disabled={uploading}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              e.target.value = "";
                              if (!file) return;
                              void (async () => {
                                setUploading(true);
                                setError(null);
                                setMsg(null);
                                const fd = new FormData();
                                fd.append("file", file);
                                const res = await bffFetch(
                                  `/api/v1/formadores/me/documentos/requisicoes/${r.id}`,
                                  { method: "POST", body: fd },
                                );
                                setUploading(false);
                                if (!res.ok) {
                                  setError(await parseApiError(res));
                                  return;
                                }
                                setMsg(`Documento «${r.titulo}» enviado.`);
                                await load();
                                notifyDocumentosObrigatoriosUpdated();
                              })();
                            }}
                          />
                          <Button size="sm" variant="secondary" disabled={uploading} asChild>
                            <span>{uploading ? "A enviar…" : "Enviar ficheiro"}</span>
                          </Button>
                        </label>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          <Card className="border-slate-700/30 bg-slate-900/40 border-sky-500/15">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-sky-400" />
                Documento de identificação
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PersonaIdVerification
                roleKind="formador"
                idCompleto={idDocOk}
                onSynced={load}
                enabled={personaEnabled}
                ready={personaReady}
              />
              {personaReady && personaEnabled ? (
                <p className="mt-2 text-xs text-slate-500">
                  Os restantes documentos obrigatórios podem ser enviados manualmente abaixo.
                </p>
              ) : null}
            </CardContent>
          </Card>

        <Card className="border-slate-700/30 bg-slate-900/40">
          <CardHeader className="border-b border-slate-700/40 flex flex-row flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-amber-400" />
              Documentos ({docs.length})
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="h-9 rounded-lg border border-slate-600 bg-slate-900 px-2 text-sm text-slate-200"
              >
                {DOC_CATEGORIAS.filter(
                  (c) =>
                    !(personaReady && personaEnabled && c.value === "documento_identificacao"),
                ).map((c) => {
                  const obr = obrigatorios?.items.find((i) => i.id === c.value);
                  const suffix = obr
                    ? obr.completo
                      ? " (obrigatório · OK)"
                      : " (obrigatório)"
                    : "";
                  return (
                    <option key={c.value} value={c.value}>
                      {c.label}
                      {suffix}
                    </option>
                  );
                })}
              </select>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void onUpload(f);
                }}
              />
              <Button size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                <Upload className="h-3.5 w-3.5" />
                {uploading ? "A enviar…" : "Enviar"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            <p className="text-sm text-slate-400">
              Obrigatórios: CV, CCP, documento de identificação e ficha curricular DGERT. Opcional:
              certificados de formação complementar (se existir) e outros documentos relevantes.
            </p>
            {categoria === "outros" ? (
              <Alert variant="warning">{AVISO_NOME_DOCUMENTO_OUTROS}</Alert>
            ) : null}
            {obrigatorios ? (
              <ul className="space-y-1.5 rounded-lg border border-slate-700/40 bg-slate-950/40 px-3 py-2">
                {obrigatorios.items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="text-slate-200">{item.label}</span>
                    <Badge variant={item.completo ? "green" : "yellow"}>
                      {item.completo ? "OK" : "Em falta"}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : null}
            {docs.length === 0 ? (
              <p className="text-sm text-slate-500">Ainda não enviou documentos.</p>
            ) : (
              <ul className="space-y-2">
                {docs.map((d) => (
                  <li
                    key={d.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-700/30 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-slate-100 truncate">{d.nome}</p>
                      <p className="text-[11px] text-slate-500">
                        {formatDatePt(d.createdAt)}
                        {d.categoria ? ` · ${d.categoria}` : ""}
                        {d.tamanhoBytes ? ` · ${formatBytes(d.tamanhoBytes)}` : ""}
                      </p>
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => void verDocumento(d)}>
                      Ver
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        </div>
      ) : null}

      <DocumentPreviewModal
        open={!!previewUrl}
        title={previewTitle}
        url={previewUrl}
        onClose={() => {
          if (previewUrl) URL.revokeObjectURL(previewUrl);
          setPreviewUrl(null);
        }}
      />
    </div>
  );
}
