"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { FileText, Fingerprint, Lock, Shield, User } from "lucide-react";
import { DocumentCaptureModule } from "@/components/formando/document-capture-module";
import { useConsentSettings } from "@/components/consent/consent-gate";
import { bffFetch } from "@/lib/client/bff-fetch";
import {
  DOCUMENTO_LAYOUTS,
  TIPOS_DOCUMENTO,
  labelDocumento,
  type LadoDocumento,
  type TipoDocumento,
} from "@/lib/formando/document-layouts";
import { parseApiError } from "@/lib/ui/backoffice";
import { Alert } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";

type Perfil = {
  id: string;
  nome: string;
  nif: string;
  telefone: string | null;
  email: string | null;
  emailEditavel: boolean;
  tenantLegalName: string | null;
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

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FormandoPerfilPage() {
  const consent = useConsentSettings();
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [nome, setNome] = useState("");
  const [nif, setNif] = useState("");
  const [telefone, setTelefone] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [tipoDocumento, setTipoDocumento] = useState<TipoDocumento | "">("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const [meRes, docsRes] = await Promise.all([
      bffFetch("/api/v1/formando-portal/me", { headers: { accept: "application/json" } }),
      bffFetch("/api/v1/formando-portal/documentos", { headers: { accept: "application/json" } }),
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
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
      setPerfil(updated);
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

  async function uploadDocumento(file: File, tipo: TipoDocumento, lado: LadoDocumento) {
    setUploading(true);
    setError(null);
    setMsg(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await bffFetch(
      `/api/v1/formando-portal/documentos?categoria=${encodeURIComponent(tipo)}&lado=${encodeURIComponent(lado)}`,
      { method: "POST", body: fd },
    );
    if (!res.ok) {
      setError(await parseApiError(res));
    } else {
      setMsg(`${labelDocumento(tipo, lado)} registado.`);
      await load();
    }
    setUploading(false);
  }

  const ladosPorTipo = useMemo(() => {
    const map: Record<string, LadoDocumento[]> = {};
    for (const d of documentos) {
      if (!d.categoria || !d.lado) continue;
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

  return (
    <div className="max-w-4xl mx-auto px-5 py-8 space-y-6">
      {consent.modal}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-50">O meu perfil</h1>
          <p className="text-sm text-slate-400 mt-1">
            Dados pessoais, privacidade e documentos de identificação para a entidade formadora.
          </p>
        </div>
        {consent.canUse ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={consent.openSettings}>
              Privacidade / RGPD
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                void (async () => {
                  setError(null);
                  const res = await bffFetch("/api/v1/rgpd/me/export", { method: "POST" });
                  if (!res.ok) {
                    setError("Não foi possível gerar a exportação dos seus dados.");
                    return;
                  }
                  const data = (await res.json()) as { downloadUrl?: string };
                  if (data.downloadUrl) window.open(data.downloadUrl, "_blank");
                })();
              }}
            >
              Exportar os meus dados
            </Button>
          </div>
        ) : null}
      </div>

      {msg ? <Alert variant="success">{msg}</Alert> : null}
      {error ? <Alert variant="error">{error}</Alert> : null}

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

      <Card className="border-slate-700/30 bg-slate-900/40 border-amber-500/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Fingerprint className="h-4 w-4 text-amber-400" />
            Documentos de identificação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-xl border border-slate-700/30 bg-slate-800/30 px-4 py-3 text-sm text-slate-300 leading-relaxed">
            <p>
              A <strong className="text-slate-100">NexiForma</strong> não utiliza estes ficheiros para fins
              próprios. Servem apenas para que{" "}
              <strong className="text-amber-300/90">
                {perfil?.tenantLegalName ?? "a entidade formadora"}
              </strong>{" "}
              possa validar a tua identidade (matrícula, certificação e requisitos legais da formação).
            </p>
            <p className="text-xs text-slate-500 mt-2">
              Escolhe o documento. Regista primeiro a frente e depois o verso (CC). Cada imagem é validada
              automaticamente.
            </p>
          </div>

          <Select
            label="Tipo de documento de identificação"
            value={tipoDocumento}
            onChange={(e) => setTipoDocumento(e.target.value as TipoDocumento | "")}
            disabled={uploading}
          >
            <option value="">Selecciona o documento…</option>
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
          ) : (
            <p className="text-sm text-slate-500 rounded-xl border border-dashed border-slate-700/40 px-4 py-6 text-center">
              Selecciona acima o documento que queres registar.
            </p>
          )}

          {documentos.length > 0 ? (
            <div className="pt-2 border-t border-slate-700/30">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                Ficheiros registados
              </p>
              <ul className="space-y-2">
                {documentos.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-700/25 bg-slate-800/30 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-slate-200 truncate">
                        {labelDocumento(doc.categoria ?? "", doc.lado)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {DOCUMENTO_LAYOUTS[doc.categoria as TipoDocumento]?.titulo ?? doc.categoria}
                        {doc.lado && doc.categoria === "cc" ? ` · ${doc.lado}` : ""} ·{" "}
                        {formatBytes(doc.tamanhoBytes)} ·{" "}
                        {new Date(doc.createdAt).toLocaleDateString("pt-PT")}
                      </p>
                    </div>
                    <Button type="button" size="sm" variant="ghost" onClick={() => void openDocumento(doc.id)}>
                      Ver
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
