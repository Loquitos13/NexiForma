"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { FileText, PlusCircle, Upload } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { formatDatePt } from "@/lib/calendar-date";
import { parseApiError } from "@/lib/ui/backoffice";
import {
  FORMANDO_DOC_CATEGORIAS_UPLOAD,
  type DocObrigatorioResumo,
} from "@/lib/formando/documentos-obrigatorios";
import { AVISO_NOME_DOCUMENTO_OUTROS } from "@/lib/documentos/nome-ficheiro-aviso";
import { ChecklistDocumentalCard } from "@/components/portal/checklist-documental-card";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
} from "@/components/ui";

type Documento = {
  id: string;
  nome: string;
  categoria: string | null;
  mimeType: string;
  tamanhoBytes: number;
  visivelFormando?: boolean;
  createdAt: string;
  acaoFormacao?: { codigoInterno: string; titulo: string } | null;
};

type Requisicao = {
  id: string;
  titulo: string;
  descricao: string | null;
  estado: string;
  createdAt: string;
  submetidoEm: string | null;
  documentoAnexo?: {
    id: string;
    nome: string;
  } | null;
};

type Props = {
  formandoId: string;
  documentos: Documento[];
  requisicoes: Requisicao[];
  canManage: boolean;
  onPreview: (doc: Documento) => void;
  onRefresh: () => Promise<void>;
};

export function FormandoDocumentosGestor({
  formandoId,
  documentos,
  requisicoes,
  canManage,
  onPreview,
  onRefresh,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [categoria, setCategoria] = useState("documento_identificacao");
  const [partilharComFormando, setPartilharComFormando] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [obrigatorios, setObrigatorios] = useState<DocObrigatorioResumo | null>(null);
  const [reqTitulo, setReqTitulo] = useState("");
  const [reqDescricao, setReqDescricao] = useState("");
  const [reqBusy, setReqBusy] = useState(false);

  const loadObrigatorios = useCallback(async () => {
    const r = await bffFetch(`/api/v1/formandos/${formandoId}/documentos/obrigatorios`, {
      headers: { accept: "application/json" },
    });
    if (r.ok) setObrigatorios((await r.json()) as DocObrigatorioResumo);
  }, [formandoId]);

  useEffect(() => {
    void loadObrigatorios();
  }, [loadObrigatorios, documentos.length]);

  async function onUpload(file: File) {
    if (!canManage) return;
    setUploading(true);
    setError(null);
    setMsg(null);
    const fd = new FormData();
    fd.append("file", file);
    const qs = new URLSearchParams({
      formandoId,
      categoria,
      visivelFormando: partilharComFormando ? "true" : "false",
    });
    const r = await bffFetch(`/api/v1/documentos/upload?${qs}`, { method: "POST", body: fd });
    setUploading(false);
    if (!r.ok) {
      setError(await parseApiError(r));
      return;
    }
    setMsg("Documento enviado.");
    await onRefresh();
    await loadObrigatorios();
  }

  async function criarRequisicao(e: FormEvent) {
    e.preventDefault();
    if (!canManage || !reqTitulo.trim()) return;
    setReqBusy(true);
    setError(null);
    setMsg(null);
    const r = await bffFetch("/api/v1/documentos/requisicoes", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        titulo: reqTitulo.trim(),
        descricao: reqDescricao.trim() || undefined,
        formandoId,
      }),
    });
    setReqBusy(false);
    if (!r.ok) {
      setError(await parseApiError(r));
      return;
    }
    setReqTitulo("");
    setReqDescricao("");
    setMsg("Pedido de documento enviado ao formando.");
    await onRefresh();
  }

  return (
    <>
      {error ? <Alert variant="error" className="mb-4">{error}</Alert> : null}
      {msg ? <Alert variant="success" className="mb-4">{msg}</Alert> : null}

      <ChecklistDocumentalCard
        imponivelIds={[
          "cv",
          "documento_identificacao",
          "certificado_habilitacoes",
          "declaracao_entidade_patronal",
          "certidao_grau",
          "domicilio_fiscal",
          "comprovativo_iban",
        ]}
        canManageImposicao={canManage}
        loadChecklist={async () => {
          const r = await bffFetch(`/api/v1/formandos/${formandoId}/documentos/obrigatorios`, {
            headers: { accept: "application/json" },
          });
          if (!r.ok) return null;
          const data = (await r.json()) as DocObrigatorioResumo;
          setObrigatorios(data);
          return data.items;
        }}
        onSaved={() => void loadObrigatorios()}
      />

      <Card className="mb-6">
        <CardHeader className="border-b border-slate-700/40 flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-amber-400" />
            Documentos ({documentos.length})
          </CardTitle>
          {canManage ? (
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="h-9 rounded-lg border border-slate-600 bg-slate-900 px-2 text-sm text-slate-200"
              >
                {FORMANDO_DOC_CATEGORIAS_UPLOAD.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
              <label className="inline-flex items-center gap-1.5 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={partilharComFormando}
                  onChange={(e) => setPartilharComFormando(e.target.checked)}
                  className="rounded border-slate-600"
                />
                Partilhar com formando
              </label>
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
                {uploading ? "A enviar…" : "Atribuir ficheiro"}
              </Button>
            </div>
          ) : null}
        </CardHeader>
        <CardContent className="pt-4 space-y-3">
          {categoria === "outros" ? (
            <Alert variant="warning">{AVISO_NOME_DOCUMENTO_OUTROS}</Alert>
          ) : null}
          {!partilharComFormando && canManage ? (
            <p className="text-xs text-slate-500">
              Sem partilha: visível apenas para gestor e coordenação pedagógica.
            </p>
          ) : null}
          {documentos.length === 0 ? (
            <p className="text-sm text-slate-500">Ainda sem documentos associados.</p>
          ) : (
            <ul className="space-y-2">
              {documentos.map((d) => (
                <li
                  key={d.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-700/30 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-slate-100 truncate">{d.nome}</p>
                    <p className="text-[11px] text-slate-500">
                      {formatDatePt(d.createdAt)}
                      {d.categoria ? ` · ${d.categoria}` : ""}
                      {d.acaoFormacao ? ` · ${d.acaoFormacao.codigoInterno}` : ""}
                      {d.visivelFormando === false ? " · interno" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {d.visivelFormando === false ? (
                      <Badge variant="default">Interno</Badge>
                    ) : null}
                    <Button size="sm" variant="secondary" onClick={() => onPreview(d)}>
                      Ver
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {canManage ? (
        <Card>
          <CardHeader className="border-b border-slate-700/40">
            <CardTitle className="text-base flex items-center gap-2">
              <PlusCircle className="h-4 w-4 text-blue-400" />
              Pedir documento ao formando
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <form onSubmit={(e) => void criarRequisicao(e)} className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Título do documento *"
                value={reqTitulo}
                onChange={(e) => setReqTitulo(e.target.value)}
                required
                className="sm:col-span-2"
              />
              <Input
                label="Instruções (opcional)"
                value={reqDescricao}
                onChange={(e) => setReqDescricao(e.target.value)}
                className="sm:col-span-2"
              />
              <div className="sm:col-span-2">
                <Button type="submit" size="sm" disabled={reqBusy || !reqTitulo.trim()}>
                  {reqBusy ? "A enviar…" : "Impor submissão"}
                </Button>
              </div>
            </form>
            {requisicoes.length > 0 ? (
              <ul className="space-y-2 border-t border-slate-700/40 pt-3">
                {requisicoes.map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-800/40 px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="text-slate-100">{r.titulo}</p>
                      {r.descricao ? (
                        <p className="text-xs text-slate-500">{r.descricao}</p>
                      ) : null}
                    </div>
                    <Badge variant={r.estado === "submetido" ? "green" : "yellow"}>
                      {r.estado === "submetido" ? "Submetido" : "Pendente"}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
