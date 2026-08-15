"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, CircleAlert, FileText, Fingerprint, Lock, Shield, User } from "lucide-react";
import { DocumentCaptureModule } from "@/components/formando/document-capture-module";
import { useConsentSettings } from "@/components/consent/consent-gate";
import { notifyDocumentosObrigatoriosUpdated } from "@/components/portal/documentos-obrigatorios-gate";
import { DocPendenteNeonDot } from "@/components/portal/doc-pendente-neon-dot";
import {
  PersonaIdVerification,
  usePersonaEnabled,
} from "@/components/persona/persona-id-verification";
import { bffFetch } from "@/lib/client/bff-fetch";
import { formatDatePt } from "@/lib/calendar-date";
import {
  DOCUMENTO_LAYOUTS,
  TIPOS_DOCUMENTO,
  type LadoDocumento,
  type TipoDocumento,
} from "@/lib/formando/document-layouts";
import {
  DOCS_OBRIGATORIOS_META,
  labelDocCategoria,
  type DocObrigatorioId,
  type DocObrigatorioResumo,
} from "@/lib/formando/documentos-obrigatorios";
import { AVISO_NOME_DOCUMENTO_OUTROS } from "@/lib/documentos/nome-ficheiro-aviso";
import { parseApiError } from "@/lib/ui/backoffice";
import { cn } from "@/lib/ui/cn";
import { Alert } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";

type TabId = "dados" | "seguranca" | "documentos";

type Perfil = {
  id: string;
  nome: string;
  nif: string;
  telefone: string | null;
  email: string | null;
  emailEditavel: boolean;
  tenantLegalName: string | null;
  documentosObrigatorios?: DocObrigatorioResumo;
};

type Documento = {
  id: string;
  nome: string;
  categoria: string | null;
  lado: string | null;
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
  acaoFormacao: { codigoInterno: string; titulo: string } | null;
  documentoAnexo: { id: string; nome: string; mimeType: string; tamanhoBytes: number } | null;
};

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "dados", label: "Dados" },
  { id: "seguranca", label: "Segurança" },
  { id: "documentos", label: "Documentos" },
];

export default function FormandoPerfilPage() {
  const consent = useConsentSettings();
  const [tab, setTab] = useState<TabId>("dados");
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [requisicoes, setRequisicoes] = useState<DocRequisicao[]>([]);
  const [obrigatorios, setObrigatorios] = useState<DocObrigatorioResumo | null>(null);
  const [nome, setNome] = useState("");
  const [nif, setNif] = useState("");
  const [telefone, setTelefone] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [tipoDocumento, setTipoDocumento] = useState<TipoDocumento | "">("");
  const [idLadoUpload, setIdLadoUpload] = useState<"unico" | "frente" | "verso">("unico");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { enabled: personaEnabled, ready: personaReady, environmentId: personaEnvironmentId } =
    usePersonaEnabled();

  const load = useCallback(async () => {
    setError(null);
    const [meRes, docsRes, obrRes, reqRes] = await Promise.all([
      bffFetch("/api/v1/formando-portal/me", { headers: { accept: "application/json" } }),
      bffFetch("/api/v1/formando-portal/documentos", { headers: { accept: "application/json" } }),
      bffFetch("/api/v1/formando-portal/documentos/obrigatorios", {
        headers: { accept: "application/json" },
      }),
      bffFetch("/api/v1/formando-portal/documentos/requisicoes", {
        headers: { accept: "application/json" },
      }),
    ]);
    if (!meRes.ok) {
      setError("Não foi possível carregar o perfil.");
      return;
    }
    const me = (await meRes.json()) as Perfil;
    setPerfil(me);
    setNome(me.nome);
    setNif(me.nif);
    setTelefone(me.telefone ?? "");
    if (docsRes.ok) {
      setDocumentos((await docsRes.json()) as Documento[]);
    }
    if (obrRes.ok) {
      setObrigatorios((await obrRes.json()) as DocObrigatorioResumo);
    } else if (me.documentosObrigatorios) {
      setObrigatorios(me.documentosObrigatorios);
    }
    if (reqRes.ok) {
      setRequisicoes((await reqRes.json()) as DocRequisicao[]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t === "documentos" || t === "seguranca" || t === "dados") {
      setTab(t as TabId);
    }
  }, []);

  async function savePerfil(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMsg(null);
    const res = await bffFetch("/api/v1/formando-portal/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        nome: nome.trim(),
        nif: nif.trim(),
        telefone: telefone.trim() || null,
      }),
    });
    if (!res.ok) {
      setError(await parseApiError(res));
    } else {
      const updated = (await res.json()) as Perfil;
      setPerfil((p) => ({ ...p, ...updated }));
      setMsg("Perfil actualizado.");
    }
    setBusy(false);
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
    const res = await bffFetch("/api/v1/formando-portal/me/password", {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    if (!res.ok) {
      setError(await parseApiError(res));
    } else {
      setMsg("Palavra-passe actualizada.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
    setBusy(false);
  }

  async function uploadFicheiro(
    file: File,
    categoria: string,
    lado: string,
  ) {
    setUploading(true);
    setError(null);
    setMsg(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await bffFetch(
      `/api/v1/formando-portal/documentos?categoria=${encodeURIComponent(categoria)}&lado=${encodeURIComponent(lado)}`,
      { method: "POST", body: fd },
    );
    if (!res.ok) {
      setError(await parseApiError(res));
    } else {
      setMsg(`${labelDocCategoria(categoria, lado)} registado.`);
      await load();
      notifyDocumentosObrigatoriosUpdated();
    }
    setUploading(false);
  }

  async function uploadDocumento(file: File, tipo: TipoDocumento, lado: LadoDocumento) {
    await uploadFicheiro(file, tipo, lado);
  }

  const ladosPorTipo = useMemo(() => {
    const map: Record<string, LadoDocumento[]> = {};
    for (const d of documentos) {
      if (!d.categoria || !d.lado) continue;
      if (d.lado !== "frente" && d.lado !== "verso") continue;
      const arr = map[d.categoria] ?? [];
      if (!arr.includes(d.lado as LadoDocumento)) {
        arr.push(d.lado as LadoDocumento);
      }
      map[d.categoria] = arr;
    }
    return map;
  }, [documentos]);

  async function openDocumento(id: string) {
    setError(null);
    const res = await bffFetch(`/api/v1/formando-portal/documentos/${id}/download`);
    if (!res.ok) {
      setError("Não foi possível abrir o documento.");
      return;
    }
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    const opened = window.open(objUrl, "_blank", "noopener,noreferrer");
    if (!opened) {
      const a = document.createElement("a");
      a.href = objUrl;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.click();
    }
    window.setTimeout(() => URL.revokeObjectURL(objUrl), 60_000);
  }

  const docsEmFalta = obrigatorios && !obrigatorios.completo;

  return (
    <div className="max-w-4xl mx-auto px-5 py-8 space-y-6">
      {consent.modal}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-50">O meu perfil</h1>
          <p className="text-sm text-slate-400 mt-1">
            Dados pessoais, segurança e documentos obrigatórios para a entidade formadora.
          </p>
        </div>
        {consent.canUse ? (
          <Button type="button" variant="secondary" size="sm" asChild>
            <Link href="/portal/formando/rgpd">Privacidade / RGPD</Link>
          </Button>
        ) : null}
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
            {...(t.id === "documentos" ? { "data-guided-flow-anchor": "documentos-formando" } : {})}
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
              <form onSubmit={(e) => void savePerfil(e)} className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Input
                    label="Nome completo"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    required
                    minLength={2}
                  />
                </div>
                <Input
                  label="NIF"
                  value={nif}
                  onChange={(e) => setNif(e.target.value.replace(/\D/g, "").slice(0, 9))}
                  required
                  minLength={9}
                  maxLength={9}
                  inputMode="numeric"
                  placeholder="123456789"
                />
                <Input
                  label="Telefone (opcional)"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  type="tel"
                  autoComplete="tel"
                />
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="email"
                      value={perfil.email ?? ""}
                      readOnly
                      disabled
                      className="flex-1 min-w-[200px] px-3.5 py-2.5 rounded-xl bg-slate-900/60 border border-slate-700/40 text-slate-500 text-sm cursor-not-allowed"
                    />
                    <Badge variant="default" className="gap-1 shrink-0">
                      <Lock className="h-3 w-3" />
                      Não editável
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-1.5">
                    Para alterar o email, contacta a entidade formadora.
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <Button type="submit" disabled={busy}>
                    Guardar perfil
                  </Button>
                </div>
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
                          {r.acaoFormacao ? (
                            <p className="text-[11px] text-slate-600 mt-1">
                              {r.acaoFormacao.codigoInterno} - {r.acaoFormacao.titulo}
                            </p>
                          ) : null}
                        </div>
                        <Badge variant={r.estado === "submetido" ? "green" : "yellow"}>
                          {r.estado === "submetido" ? "Enviado" : "Pendente"}
                        </Badge>
                      </div>
                      {r.documentoAnexo ? (
                        <p className="text-xs text-slate-500">
                          Ficheiro: {r.documentoAnexo.nome} ({formatBytes(r.documentoAnexo.tamanhoBytes)})
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
                                const form = new FormData();
                                form.append("file", file);
                                const res = await bffFetch(
                                  `/api/v1/formando-portal/documentos/requisicoes/${r.id}`,
                                  { method: "POST", body: form },
                                );
                                setUploading(false);
                                if (!res.ok) {
                                  setError(await parseApiError(res));
                                  return;
                                }
                                setMsg(`Documento «${r.titulo}» enviado.`);
                                await load();
                              })();
                            }}
                          />
                          <span className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-600 bg-transparent px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800">
                            {uploading
                              ? "A enviar…"
                              : r.estado === "submetido"
                                ? "Substituir ficheiro"
                                : "Carregar ficheiro"}
                          </span>
                        </label>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          <Card className="border-slate-700/30 bg-slate-900/40 border-amber-500/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-amber-400" />
                Documentos obrigatórios
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <p className="text-sm text-slate-300 leading-relaxed">
                A <strong className="text-slate-100">NexiForma</strong> não utiliza estes ficheiros para
                fins próprios. Servem para que{" "}
                <strong className="text-amber-300/90">
                  {perfil?.tenantLegalName ?? "a entidade formadora"}
                </strong>{" "}
                cumpra requisitos legais da formação (matrícula, certificação, dossiê).
              </p>

              <ul className="space-y-3">
                {(
                  obrigatorios?.items ??
                  DOCS_OBRIGATORIOS_META.filter((m) =>
                    (
                      [
                        "documento_identificacao",
                        "certificado_habilitacoes",
                        "declaracao_entidade_patronal",
                        "domicilio_fiscal",
                        "comprovativo_iban",
                      ] as DocObrigatorioId[]
                    ).includes(m.id),
                  ).map((m) => ({
                    id: m.id,
                    label: m.label,
                    completo: false,
                    detalhe: m.ajuda,
                  }))
                ).map((status) => {
                  const meta = DOCS_OBRIGATORIOS_META.find((m) => m.id === status.id);
                  const ok = status.completo;
                  const label = meta?.label ?? status.label;
                  const ajuda = meta?.ajuda ?? status.detalhe;
                  return (
                    <li
                      key={status.id}
                      className="rounded-xl border border-slate-700/30 bg-slate-800/30 px-4 py-3 space-y-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-slate-100 flex items-center gap-2">
                            {ok ? (
                              <CheckCircle2 className="h-4 w-4 text-teal-400 shrink-0" />
                            ) : (
                              <CircleAlert className="h-4 w-4 text-amber-400 shrink-0" />
                            )}
                            {label}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">{ajuda}</p>
                        </div>
                        <Badge variant={ok ? "green" : "yellow"}>{ok ? "OK" : "Em falta"}</Badge>
                      </div>

                      {status.id === "documento_identificacao" ? (
                        <>
                          <PersonaIdVerification
                            roleKind="formando"
                            idCompleto={ok}
                            onSynced={load}
                            enabled={personaEnabled}
                            ready={personaReady}
                            environmentId={personaEnvironmentId}
                          />
                          {personaReady && personaEnabled ? null : (
                            <Select
                              label="Modo de envio"
                              value={idLadoUpload}
                              onChange={(e) =>
                                setIdLadoUpload(e.target.value as "unico" | "frente" | "verso")
                              }
                              disabled={uploading}
                            >
                              <option value="unico">PDF único (frente e verso no mesmo ficheiro)</option>
                              <option value="frente">Frente (ficheiro separado)</option>
                              <option value="verso">Verso (ficheiro separado)</option>
                            </Select>
                          )}
                        </>
                      ) : null}

                      {status.id === "documento_identificacao" &&
                      personaReady &&
                      personaEnabled ? null : (
                        <label className="inline-flex">
                          <input
                            type="file"
                            accept={meta?.accept ?? "application/pdf,image/jpeg,image/png"}
                            className="sr-only"
                            disabled={uploading}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              e.target.value = "";
                              if (!file) return;
                              const lado =
                                status.id === "documento_identificacao" ? idLadoUpload : "unico";
                              void uploadFicheiro(file, status.id, lado);
                            }}
                          />
                          <span className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-600 bg-transparent px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800">
                            {uploading ? "A enviar…" : "Carregar ficheiro"}
                          </span>
                        </label>
                      )}
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>

          <Card className="border-slate-700/30 bg-slate-900/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-slate-400" />
                Ficheiros adicionais
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-slate-400">
                Documentos complementares que não fazem parte da checklist obrigatória.
              </p>
              <Alert variant="warning">{AVISO_NOME_DOCUMENTO_OUTROS}</Alert>
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
                    void uploadFicheiro(file, "outros", "unico");
                  }}
                />
                <span className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-600 bg-transparent px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800">
                  {uploading ? "A enviar…" : "Enviar ficheiro adicional"}
                </span>
              </label>
            </CardContent>
          </Card>

          {personaReady && personaEnabled ? null : (
            <Card className="border-slate-700/30 bg-slate-900/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Fingerprint className="h-4 w-4 text-teal-400" />
                  Captura de cartão (opcional)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-slate-500">
                  Alternativa à identificação: captura on-camera do CC (frente e verso). Conta para o
                  documento de identificação obrigatório.
                </p>
                <Select
                  label="Tipo de cartão"
                  value={tipoDocumento}
                  onChange={(e) => setTipoDocumento(e.target.value as TipoDocumento | "")}
                  disabled={uploading}
                >
                  <option value="">Selecciona…</option>
                  {TIPOS_DOCUMENTO.map((tipo) => {
                    const enviado =
                      tipo === "cc"
                        ? (ladosPorTipo[tipo]?.length ?? 0) >= 2
                        : Boolean(ladosPorTipo[tipo]?.includes("frente"));
                    return (
                      <option key={tipo} value={tipo}>
                        {DOCUMENTO_LAYOUTS[tipo].titulo}
                        {enviado ? " ✓" : ""}
                      </option>
                    );
                  })}
                </Select>
                {tipoDocumento ? (
                  <DocumentCaptureModule
                    key={tipoDocumento}
                    tipo={tipoDocumento}
                    disabled={uploading}
                    ladosEnviados={ladosPorTipo[tipoDocumento] ?? []}
                    onCapture={(file, lado) => void uploadDocumento(file, tipoDocumento, lado)}
                  />
                ) : null}
              </CardContent>
            </Card>
          )}

          {documentos.length > 0 ? (
            <Card className="border-slate-700/30 bg-slate-900/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-slate-400" />
                  Ficheiros registados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {documentos.map((doc) => (
                    <li
                      key={doc.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-700/25 bg-slate-800/30 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-sm text-slate-200 truncate">
                          {labelDocCategoria(doc.categoria ?? "", doc.lado)}
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatBytes(doc.tamanhoBytes)} · {formatDatePt(doc.createdAt)}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => void openDocumento(doc.id)}
                      >
                        Ver
                      </Button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
