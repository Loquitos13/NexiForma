"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, FilePlus, FileUp, Plus, Save, Trash2 } from "lucide-react";
import {
  TEMPLATE_TYPES,
  buildDocumentPreviewHtml,
  groupVariables,
  isCustomTemplateId,
  normalizeLogoPlacement,
  plainTextToEditorHtml,
  sanitizeImportedDocxHtml,
  slugifyTemplateId,
  variableToken,
  variablesForModulo,
  type DocumentLogoPlacement,
  type DocumentOrientacao,
  type DocumentVerticalAlign,
  type ModuleLogoAsset,
  type TemplateFormato,
  type TemplateModulo,
} from "@nexiforma/shared";
import { bffFetch } from "@/lib/client/bff-fetch";
import { Button } from "@/components/ui";
import { cn } from "@/lib/ui/cn";
import {
  RichTemplateEditor,
  type RichTemplateEditorHandle,
} from "@/components/settings/rich-template-editor";
import { TemplateLogoPresets } from "@/components/settings/template-logo-presets";
import { convertDocxFileToHtml } from "@/lib/client/docx-to-html";

type SavedEntry = {
  conteudo: string;
  nome?: string;
  updatedAt?: string;
  custom?: boolean;
  formato?: TemplateFormato;
  logos?: DocumentLogoPlacement[];
  orientacao?: DocumentOrientacao;
  alinhamentoVertical?: DocumentVerticalAlign;
};

type Props = {
  modulo: TemplateModulo;
  title?: string;
  description?: string;
};

export function TemplateEditorPanel({ modulo, title, description }: Props) {
  const types = TEMPLATE_TYPES[modulo];
  const vars = variablesForModulo(modulo);
  const grouped = groupVariables(vars);

  const [saved, setSaved] = useState<Record<string, SavedEntry>>({});
  const [activeId, setActiveId] = useState(types[0]?.id ?? "");
  const [nome, setNome] = useState("");
  const [formato, setFormato] = useState<TemplateFormato>("html");
  const [orientacao, setOrientacao] = useState<DocumentOrientacao>("portrait");
  const [alinhamentoVertical, setAlinhamentoVertical] = useState<DocumentVerticalAlign>("top");
  const [conteudo, setConteudo] = useState("");
  const [logoPlacements, setLogoPlacements] = useState<DocumentLogoPlacement[]>([]);
  const [moduleLogos, setModuleLogos] = useState<ModuleLogoAsset[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [showNewForm, setShowNewForm] = useState(false);
  const [newNome, setNewNome] = useState("");
  const [newFormato, setNewFormato] = useState<TemplateFormato>("html");
  const docxInputRef = useRef<HTMLInputElement>(null);
  const richEditorRef = useRef<RichTemplateEditorHandle>(null);
  const [importandoDocx, setImportandoDocx] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [showLogos, setShowLogos] = useState(false);

  useEffect(() => {
    const body = formato === "texto" ? plainTextToEditorHtml(conteudo) : conteudo;
    const t = window.setTimeout(() => {
      setPreviewHtml(
        buildDocumentPreviewHtml(body, {
          title: nome || "Template",
          orientacao,
          verticalAlign: alinhamentoVertical,
        }),
      );
    }, 450);
    return () => window.clearTimeout(t);
  }, [conteudo, formato, nome, orientacao, alinhamentoVertical]);

  const catalogById = useMemo(
    () => new Map(types.map((t) => [t.id, t] as const)),
    [types],
  );

  const customTemplates = useMemo(
    () =>
      Object.entries(saved)
        .filter(([id, e]) => isCustomTemplateId(id) || e.custom)
        .map(([id, e]) => ({ id, label: e.nome?.trim() || id })),
    [saved],
  );

  const activeCatalog = catalogById.get(activeId);
  const isCustomActive = isCustomTemplateId(activeId) || Boolean(saved[activeId]?.custom);

  const load = useCallback(async () => {
    const r = await bffFetch(
      `/api/v1/portal/tenant/document-templates?modulo=${encodeURIComponent(modulo)}`,
      { headers: { accept: "application/json" } },
    );
    if (!r.ok) return;
    const data = (await r.json()) as {
      templates?: Record<string, SavedEntry>;
      moduleLogos?: ModuleLogoAsset[];
    };
    setSaved(data.templates ?? {});
    setModuleLogos(data.moduleLogos ?? []);
  }, [modulo]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const entry = saved[activeId];
    const catalog = catalogById.get(activeId);
    let raw = entry?.conteudo ?? catalog?.conteudoDefault ?? "";
    if (raw && !/<[a-z][\s\S]*>/i.test(raw)) {
      raw = plainTextToEditorHtml(raw);
    }
    setConteudo(raw);
    setNome(entry?.nome ?? catalog?.label ?? "");
    setFormato("html");
    setOrientacao(entry?.orientacao ?? "portrait");
    setAlinhamentoVertical(entry?.alinhamentoVertical ?? "top");
    setLogoPlacements(entry?.logos ?? []);
  }, [activeId, saved, catalogById]);

  function insertVariable(key: string) {
    const token = variableToken(key);
    richEditorRef.current?.insertToken(token);
  }

  async function persistTemplates(next: Record<string, SavedEntry>, successMsg: string) {
    setBusy(true);
    setError(null);
    setMsg(null);
    const r = await bffFetch("/api/v1/portal/tenant/document-templates", {
      method: "PUT",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ modulo, templates: next }),
    });
    setBusy(false);
    if (!r.ok) {
      setError("Não foi possível guardar o template.");
      return false;
    }
    setSaved(next);
    setMsg(successMsg);
    return true;
  }

  async function guardar() {
    if (!activeId) return;
    const latestConteudo = richEditorRef.current?.getContent() ?? conteudo;
    const label = nome.trim() || activeCatalog?.label || activeId;
    const logosNorm = logoPlacements.map((p, i) => normalizeLogoPlacement(p, i));
    const next = {
      ...saved,
      [activeId]: {
        conteudo: latestConteudo,
        nome: label,
        ...(isCustomActive ? { custom: true as const } : {}),
        formato: "html" as const,
        orientacao,
        alinhamentoVertical,
        ...(logosNorm.length ? { logos: logosNorm } : {}),
        updatedAt: new Date().toISOString(),
      },
    };
    const ok = await persistTemplates(next, `Template «${label}» guardado.`);
    if (!ok) return;
    if (latestConteudo !== conteudo) setConteudo(latestConteudo);
    window.dispatchEvent(
      new CustomEvent("nexiforma:document-templates-updated", {
        detail: { modulo, templateId: activeId },
      }),
    );
  }

  async function eliminarTemplate() {
    if (!isCustomActive || !activeId) return;
    const label = nome.trim() || activeId;
    if (!window.confirm(`Eliminar o template «${label}»? Esta acção não pode ser desfeita.`)) {
      return;
    }
    const { [activeId]: _removed, ...rest } = saved;
    const ok = await persistTemplates(rest, `Template «${label}» eliminado.`);
    if (!ok) return;
    const fallback = types[0]?.id ?? Object.keys(rest)[0] ?? "";
    setActiveId(fallback);
    setShowNewForm(false);
  }

  async function criarTemplate() {
    const label = newNome.trim();
    if (!label) {
      setError("Indique um nome para o template.");
      return;
    }
    setError(null);
    const id = slugifyTemplateId(label);
    const entry: SavedEntry = {
      conteudo: "",
      nome: label,
      custom: true,
      formato: newFormato,
      updatedAt: new Date().toISOString(),
    };
    const next = { ...saved, [id]: entry };
    const ok = await persistTemplates(next, `Template «${label}» criado. Escreva o conteúdo e guarde.`);
    if (!ok) return;
    setActiveId(id);
    setNome(label);
    setFormato(newFormato);
    setConteudo("");
    setShowNewForm(false);
    setNewNome("");
    setNewFormato("html");
  }

  function restaurarDefault() {
    if (!activeCatalog?.conteudoDefault) return;
    setConteudo(activeCatalog.conteudoDefault);
  }

  async function importarDocx(file: File) {
    setImportandoDocx(true);
    setError(null);
    setMsg(null);
    try {
      const { html, warnings } = await convertDocxFileToHtml(file);
      const clean = sanitizeImportedDocxHtml(html);
      setConteudo(clean);
      setFormato("html");
      setMsg(
        warnings.length
          ? `DOCX importado (${warnings.length} aviso(s) de conversão). Revise o texto e substitua campos fixos por {{variáveis}}.`
          : "DOCX importado. Revise o texto e substitua campos fixos por {{variáveis}}.",
      );
    } catch {
      setError("Não foi possível ler o ficheiro DOCX.");
    } finally {
      setImportandoDocx(false);
    }
  }

  if (!types.length && customTemplates.length === 0) {
    return (
      <p className="text-sm text-slate-500">Sem tipos de template para este módulo.</p>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-700/30 bg-slate-900/50 p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">
            {title ?? "Templates com variáveis"}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {description ??
              "Escreva o texto do documento e insira campos dinâmicos com os botões abaixo. Na emissão, cada {{variável}} é substituída pelos dados reais."}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => {
            setShowNewForm((v) => !v);
            setError(null);
          }}
        >
          <FilePlus className="h-3.5 w-3.5" />
          Novo template
        </Button>
      </div>

      {error ? <p className="text-xs text-red-300">{error}</p> : null}
      {msg ? <p className="text-xs text-green-300">{msg}</p> : null}

      {showNewForm ? (
        <div className="rounded-lg border border-blue-500/30 bg-blue-950/20 p-3 space-y-3">
          <p className="text-xs font-medium text-blue-200">Criar template personalizado</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                Nome do template
              </span>
              <input
                type="text"
                value={newNome}
                onChange={(e) => setNewNome(e.target.value)}
                placeholder="Ex.: Certificado de conclusão"
                className="w-full rounded-lg border border-slate-600/60 bg-slate-950 px-3 py-2 text-xs text-slate-200"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                Formato
              </span>
              <select
                value={newFormato}
                onChange={(e) => setNewFormato(e.target.value as TemplateFormato)}
                className="w-full rounded-lg border border-slate-600/60 bg-slate-950 px-3 py-2 text-xs text-slate-200"
              >
                <option value="html">HTML (com formatação)</option>
                <option value="texto">Texto simples</option>
              </select>
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={() => void criarTemplate()}>
              Criar
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setShowNewForm(false)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {types.map((t) => (
          <TemplateTypeButton
            key={t.id}
            label={saved[t.id]?.nome?.trim() || t.label}
            active={t.id === activeId}
            hasContent={Boolean(saved[t.id]?.conteudo?.trim())}
            custom={false}
            onClick={() => setActiveId(t.id)}
          />
        ))}
        {customTemplates.map((t) => (
          <TemplateTypeButton
            key={t.id}
            label={t.label}
            active={t.id === activeId}
            hasContent={Boolean(saved[t.id]?.conteudo?.trim())}
            custom
            onClick={() => setActiveId(t.id)}
          />
        ))}
      </div>

      {activeCatalog?.descricao && !isCustomActive ? (
        <p className="text-[11px] text-slate-500">{activeCatalog.descricao}</p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block space-y-1 sm:col-span-2">
          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
            Nome do template
          </span>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="w-full rounded-lg border border-slate-600/60 bg-slate-950 px-3 py-2 text-xs text-slate-200"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
            Orientação
          </span>
          <select
            value={orientacao}
            onChange={(e) => setOrientacao(e.target.value as DocumentOrientacao)}
            className="w-full rounded-lg border border-slate-600/60 bg-slate-950 px-3 py-2 text-xs text-slate-200"
          >
            <option value="portrait">Vertical (A4)</option>
            <option value="landscape">Horizontal (A4)</option>
          </select>
        </label>
        {isCustomActive ? (
          <label className="block space-y-1 sm:col-span-3 sm:max-w-xs">
            <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
              Formato de armazenamento
            </span>
            <select
              value={formato}
              onChange={(e) => setFormato(e.target.value as TemplateFormato)}
              className="w-full rounded-lg border border-slate-600/60 bg-slate-950 px-3 py-2 text-xs text-slate-200"
            >
              <option value="html">HTML (com formatação)</option>
              <option value="texto">Texto simples</option>
            </select>
          </label>
        ) : null}
      </div>

      <div className="space-y-2">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-700/40 bg-slate-950/40 px-3 py-2 text-left"
          onClick={() => setShowLogos((v) => !v)}
        >
          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
            Logótipos predefinidos neste template
          </span>
          <ChevronDown className={cn("h-4 w-4 text-slate-500 transition-transform", showLogos && "rotate-180")} />
        </button>
        {showLogos ? (
          <TemplateLogoPresets
            modulo={modulo}
            logos={moduleLogos}
            placements={logoPlacements}
            onChange={setLogoPlacements}
            previewSrcDoc={previewHtml}
            orientacao={orientacao}
            verticalAlign={alinhamentoVertical}
          />
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_14rem]">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
              Documento A4 (WYSIWYG)
            </label>
            <div className="flex items-center gap-2">
              <input
                ref={docxInputRef}
                type="file"
                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void importarDocx(f);
                  e.target.value = "";
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={busy || importandoDocx}
                onClick={() => docxInputRef.current?.click()}
              >
                <FileUp className="h-3.5 w-3.5" />
                {importandoDocx ? "A importar…" : "Importar DOCX"}
              </Button>
            </div>
          </div>
          <RichTemplateEditor
            key={activeId}
            ref={richEditorRef}
            value={conteudo}
            onChange={setConteudo}
            formato="html"
            pageLayout="a4"
            orientacao={orientacao}
            verticalAlign={alinhamentoVertical}
            onVerticalAlignChange={setAlinhamentoVertical}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={busy} onClick={() => void guardar()}>
              <Save className="h-3.5 w-3.5" />
              {busy ? "A guardar…" : "Guardar template"}
            </Button>
            {activeCatalog?.conteudoDefault ? (
              <Button type="button" size="sm" variant="secondary" onClick={restaurarDefault}>
                Restaurar modelo
              </Button>
            ) : null}
            {isCustomActive ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => void eliminarTemplate()}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Eliminar
              </Button>
            ) : null}
          </div>
        </div>

        <aside className="space-y-2">
          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
            Inserir variável
          </p>
          <div className="max-h-[420px] overflow-y-auto rounded-lg border border-slate-700/40 bg-slate-950/60 p-2 space-y-1">
            {[...grouped.entries()].map(([grupo, items]) => {
              const open = openGroups[grupo] !== false;
              return (
                <div key={grupo}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-1 rounded px-1.5 py-1 text-[11px] font-semibold text-slate-400 hover:bg-slate-800/60"
                    onClick={() =>
                      setOpenGroups((g) => ({ ...g, [grupo]: !open }))
                    }
                  >
                    {grupo}
                    <ChevronDown
                      className={cn("h-3 w-3 transition-transform", open ? "rotate-180" : "")}
                    />
                  </button>
                  {open ? (
                    <ul className="pb-2 space-y-0.5">
                      {items.map((v) => (
                        <li key={v.key}>
                          <button
                            type="button"
                            title={v.exemplo ? `Ex.: ${v.exemplo}` : variableToken(v.key)}
                            className="flex w-full items-start gap-1 rounded px-1.5 py-1 text-left text-[10px] text-slate-300 hover:bg-blue-950/40 hover:text-blue-200"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => insertVariable(v.key)}
                          >
                            <Plus className="h-3 w-3 shrink-0 mt-0.5 opacity-60" />
                            <span>
                              <span className="block font-medium">{v.label}</span>
                              <code className="text-[9px] text-slate-500">{variableToken(v.key)}</code>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              );
            })}
          </div>
        </aside>
      </div>
    </section>
  );
}

function TemplateTypeButton({
  label,
  active,
  hasContent,
  custom,
  onClick,
}: {
  label: string;
  active: boolean;
  hasContent: boolean;
  custom: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors",
        active
          ? "border-blue-500/50 bg-blue-950/30 text-blue-200"
          : "border-slate-700/40 text-slate-400 hover:border-slate-600 hover:text-slate-200",
        custom && !active && "border-dashed",
      )}
    >
      <span className="font-medium">{label}</span>
      {custom ? (
        <span className="ml-1 text-[9px] uppercase text-slate-500">custom</span>
      ) : null}
      {hasContent ? (
        <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" title="Guardado" />
      ) : null}
    </button>
  );
}
