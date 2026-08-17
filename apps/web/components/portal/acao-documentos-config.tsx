"use client";

import { useCallback, useEffect, useState } from "react";
import { Eye, Pencil, Upload } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { parseApiError } from "@/lib/ui/backoffice";
import { Badge, Button, Dialog, DialogContent } from "@/components/ui";

type Cfg = {
  version: 1;
  inscricaoObrigatorios: string[];
  notas?: string;
  templatesConteudo?: Record<string, string>;
};

type TemplateRow = {
  categoria: string;
  templateCategoria: string;
  label: string;
  obrigatorio: boolean;
  conteudoHtml: string | null;
  documento: {
    id: string;
    nome: string;
    mimeType: string;
    tamanhoBytes: number;
    createdAt: string;
  } | null;
};

export type TurmaConsentimentoResumo = {
  turmaId: string;
  codigo: string;
  nome: string;
  matriculas: number;
  consentimentosCompletos: number;
  percentagem: number;
};

type Props = {
  acaoId: string;
  cargaHoras?: number;
  initial?: unknown;
  turmasConsentimento?: TurmaConsentimentoResumo[];
  onSaved?: (cfg: Cfg | null) => void;
};

function parseCfg(raw: unknown): Cfg {
  const o = (raw ?? {}) as Partial<Cfg & { universaisObrigatorios?: string[] }>;
  return {
    version: 1,
    inscricaoObrigatorios: Array.isArray(o.inscricaoObrigatorios)
      ? o.inscricaoObrigatorios.filter((x): x is string => typeof x === "string")
      : ["declaracao_inscricao", "contrato_formacao", "regulamento_formacao"],
    notas: typeof o.notas === "string" ? o.notas : "",
    templatesConteudo:
      o.templatesConteudo && typeof o.templatesConteudo === "object"
        ? o.templatesConteudo
        : undefined,
  };
}

export function AcaoDocumentosConfig({
  acaoId,
  cargaHoras,
  initial,
  turmasConsentimento = [],
  onSaved,
}: Props) {
  const [cfg, setCfg] = useState<Cfg>(() => parseCfg(initial));
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewUrl, setViewUrl] = useState<string | null>(null);
  const [viewTitle, setViewTitle] = useState("");
  const [editCat, setEditCat] = useState<string | null>(null);
  const [editHtml, setEditHtml] = useState("");
  const [editBusy, setEditBusy] = useState(false);

  const loadTemplates = useCallback(async () => {
    const r = await bffFetch(`/api/v1/acoes-formacao/${acaoId}/templates`, {
      headers: { accept: "application/json" },
    });
    if (r.ok) setTemplates((await r.json()) as TemplateRow[]);
  }, [acaoId]);

  useEffect(() => {
    setCfg(parseCfg(initial));
  }, [initial]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    return () => {
      if (viewUrl) URL.revokeObjectURL(viewUrl);
    };
  }, [viewUrl]);

  const toggleInscricao = useCallback((id: string) => {
    setCfg((c) => ({
      ...c,
      inscricaoObrigatorios: c.inscricaoObrigatorios.includes(id)
        ? c.inscricaoObrigatorios.filter((x) => x !== id)
        : [...c.inscricaoObrigatorios, id],
    }));
  }, []);

  async function save() {
    setBusy(true);
    setError(null);
    setMsg(null);
    const body: Cfg = {
      version: 1,
      inscricaoObrigatorios: cfg.inscricaoObrigatorios,
      notas: cfg.notas?.trim() || undefined,
      ...(cfg.templatesConteudo ? { templatesConteudo: cfg.templatesConteudo } : {}),
    };
    const r = await bffFetch(`/api/v1/acoes-formacao/${acaoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ configuracaoMatricula: body }),
    });
    setBusy(false);
    if (!r.ok) {
      setError("Erro ao guardar configuração documental.");
      return;
    }
    setMsg("Configuração documental da acção guardada.");
    onSaved?.(body);
    await loadTemplates();
  }

  async function verDocumento(cat: string, label: string) {
    setError(null);
    const r = await bffFetch(`/api/v1/acoes-formacao/${acaoId}/templates/${cat}/download`);
    if (!r.ok) {
      setError(await parseApiError(r));
      return;
    }
    const blob = await r.blob();
    if (viewUrl) URL.revokeObjectURL(viewUrl);
    setViewUrl(URL.createObjectURL(blob));
    setViewTitle(label);
  }

  async function uploadTemplate(cat: string, file: File) {
    setError(null);
    setMsg(null);
    const form = new FormData();
    form.append("file", file);
    const r = await bffFetch(
      `/api/v1/acoes-formacao/${acaoId}/templates/upload?categoria=${encodeURIComponent(cat)}`,
      { method: "POST", body: form },
    );
    if (!r.ok) {
      setError(await parseApiError(r));
      return;
    }
    setMsg("Template PDF carregado.");
    await loadTemplates();
  }

  function openEdit(row: TemplateRow) {
    setEditCat(row.categoria);
    setEditHtml(
      row.conteudoHtml ??
        `<h1>${row.label}</h1>\n<p>Edite o conteúdo deste documento. Ao guardar, é gerado um novo PDF.</p>`,
    );
  }

  async function gerarPdf() {
    if (!editCat) return;
    setEditBusy(true);
    setError(null);
    const r = await bffFetch(`/api/v1/acoes-formacao/${acaoId}/templates/gerar`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ categoria: editCat, html: editHtml }),
    });
    setEditBusy(false);
    if (!r.ok) {
      setError(await parseApiError(r));
      return;
    }
    const data = (await r.json()) as { conteudoHtml: string };
    setCfg((c) => ({
      ...c,
      templatesConteudo: { ...(c.templatesConteudo ?? {}), [editCat]: data.conteudoHtml },
    }));
    setMsg("PDF regenerado a partir do conteúdo editado.");
    setEditCat(null);
    await loadTemplates();
  }

  const rows =
    templates.length > 0
      ? templates
      : cfg.inscricaoObrigatorios.map((id) => ({
          categoria: id,
          label: id,
          obrigatorio: true,
          conteudoHtml: null,
          documento: null,
          templateCategoria: id,
        }));

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-100">Documentos desta edição</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Obrigatórios na inscrição
          {cargaHoras != null ? ` · ${cargaHoras}h` : ""}. PDF autenticado (login obrigatório).
        </p>
      </div>

      {turmasConsentimento.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {turmasConsentimento.map((t) => (
            <Badge
              key={t.turmaId}
              variant={t.percentagem >= 100 ? "green" : t.percentagem > 0 ? "yellow" : "default"}
              className="text-[11px]"
            >
              {t.codigo}: {t.percentagem}% consentimento ({t.consentimentosCompletos}/{t.matriculas})
            </Badge>
          ))}
        </div>
      ) : null}

      {error ? <p className="text-xs text-red-300">{error}</p> : null}
      {msg ? <p className="text-xs text-green-300">{msg}</p> : null}

      <div className="space-y-1.5">
        <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">
          Obrigatórios na inscrição
        </p>
        {rows.map((row) => (
          <div
            key={row.categoria}
            className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-slate-700/40 bg-slate-900/40 px-2 py-1.5"
          >
            <label className="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-slate-200">
              <input
                type="checkbox"
                className="shrink-0"
                checked={cfg.inscricaoObrigatorios.includes(row.categoria)}
                onChange={() => toggleInscricao(row.categoria)}
              />
              <span className="truncate font-medium">{row.label}</span>
            </label>
            <span className="hidden sm:inline text-[10px] text-slate-500 truncate max-w-[140px]">
              {row.documento ? row.documento.nome : "Sem PDF"}
            </span>
            <div className="flex shrink-0 items-center gap-0.5">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-7 px-1.5 text-[10px]"
                disabled={!row.documento}
                onClick={() => void verDocumento(row.categoria, row.label)}
              >
                <Eye className="h-3 w-3" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-7 px-1.5 text-[10px]"
                onClick={() => openEdit(row)}
              >
                <Pencil className="h-3 w-3" />
              </Button>
              <label className="inline-flex">
                <input
                  type="file"
                  accept="application/pdf"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) void uploadTemplate(row.categoria, f);
                  }}
                />
                <span className="inline-flex h-7 cursor-pointer items-center gap-0.5 rounded-lg border border-slate-600 px-1.5 text-[10px] font-semibold text-slate-300 hover:bg-slate-800">
                  <Upload className="h-3 w-3" />
                </span>
              </label>
            </div>
          </div>
        ))}
      </div>

      <label className="block">
        <span className="text-[10px] text-slate-500 mb-0.5 block">Notas internas</span>
        <textarea
          rows={2}
          className="w-full rounded-lg border border-slate-600/60 bg-slate-900/80 px-2 py-1.5 text-xs text-slate-200"
          value={cfg.notas ?? ""}
          onChange={(e) => setCfg((c) => ({ ...c, notas: e.target.value }))}
          placeholder="Ex.: Contrato com 200h e valor X€"
        />
      </label>

      <Button type="button" size="sm" disabled={busy} onClick={() => void save()}>
        {busy ? "A guardar…" : "Guardar documentos da acção"}
      </Button>

      <Dialog open={!!viewUrl} onOpenChange={(open) => !open && setViewUrl(null)}>
        <DialogContent title={viewTitle} className="max-w-4xl">
          {viewUrl ? (
            <iframe title={viewTitle} src={viewUrl} className="h-[70vh] w-full rounded-lg bg-white" />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editCat} onOpenChange={(open) => !open && setEditCat(null)}>
        <DialogContent title="Editar conteúdo do documento" className="max-w-3xl">
          <textarea
            rows={16}
            className="w-full rounded-lg border border-slate-600/60 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-200"
            value={editHtml}
            onChange={(e) => setEditHtml(e.target.value)}
          />
          <div className="flex gap-2 mt-3">
            <Button type="button" disabled={editBusy} onClick={() => void gerarPdf()}>
              {editBusy ? "A gerar…" : "Gerar novo PDF"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setEditCat(null)}>
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
