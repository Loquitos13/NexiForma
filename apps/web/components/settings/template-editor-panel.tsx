"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Plus, Save } from "lucide-react";
import {
  TEMPLATE_TYPES,
  groupVariables,
  variableToken,
  variablesForModulo,
  type TemplateModulo,
  type TemplateTypeDef,
} from "@nexiforma/shared";
import { bffFetch } from "@/lib/client/bff-fetch";
import { Button } from "@/components/ui";
import { cn } from "@/lib/ui/cn";

type SavedEntry = { conteudo: string; nome?: string; updatedAt?: string };

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
  const [conteudo, setConteudo] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeType = types.find((t) => t.id === activeId) ?? types[0];

  const load = useCallback(async () => {
    const r = await bffFetch(
      `/api/v1/portal/tenant/document-templates?modulo=${encodeURIComponent(modulo)}`,
      { headers: { accept: "application/json" } },
    );
    if (!r.ok) return;
    const data = (await r.json()) as { templates?: Record<string, SavedEntry> };
    setSaved(data.templates ?? {});
  }, [modulo]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!activeType) return;
    const entry = saved[activeType.id];
    setConteudo(entry?.conteudo ?? activeType.conteudoDefault ?? "");
  }, [activeId, activeType, saved]);

  function insertVariable(key: string) {
    const token = variableToken(key);
    const el = textareaRef.current;
    if (!el) {
      setConteudo((c) => c + token);
      return;
    }
    const start = el.selectionStart ?? conteudo.length;
    const end = el.selectionEnd ?? start;
    const next = conteudo.slice(0, start) + token + conteudo.slice(end);
    setConteudo(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  }

  async function guardar() {
    if (!activeType) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    const next = {
      ...saved,
      [activeType.id]: {
        conteudo,
        nome: activeType.label,
        updatedAt: new Date().toISOString(),
      },
    };
    const r = await bffFetch("/api/v1/portal/tenant/document-templates", {
      method: "PUT",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ modulo, templates: next }),
    });
    setBusy(false);
    if (!r.ok) {
      setError("Não foi possível guardar o template.");
      return;
    }
    setSaved(next);
    setMsg(`Template «${activeType.label}» guardado.`);
  }

  function restaurarDefault() {
    if (!activeType?.conteudoDefault) return;
    setConteudo(activeType.conteudoDefault);
  }

  if (!types.length) {
    return (
      <p className="text-sm text-slate-500">Sem tipos de template para este módulo.</p>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-700/30 bg-slate-900/50 p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-100">
          {title ?? "Templates com variáveis"}
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          {description ??
            "Escreva o texto do documento e insira campos dinâmicos com os botões abaixo. Na emissão, cada {{variável}} é substituída pelos dados reais."}
        </p>
      </div>

      {error ? <p className="text-xs text-red-300">{error}</p> : null}
      {msg ? <p className="text-xs text-green-300">{msg}</p> : null}

      <div className="flex flex-wrap gap-2">
        {types.map((t) => (
          <TemplateTypeButton
            key={t.id}
            type={t}
            active={t.id === activeId}
            hasContent={Boolean(saved[t.id]?.conteudo?.trim())}
            onClick={() => setActiveId(t.id)}
          />
        ))}
      </div>

      {activeType?.descricao ? (
        <p className="text-[11px] text-slate-500">{activeType.descricao}</p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_14rem]">
        <div className="min-w-0 space-y-2">
          <label className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
            Conteúdo do template (HTML permitido)
          </label>
          <textarea
            ref={textareaRef}
            rows={16}
            value={conteudo}
            onChange={(e) => setConteudo(e.target.value)}
            className="w-full rounded-lg border border-slate-600/60 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-200 leading-relaxed"
            spellCheck={false}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={busy} onClick={() => void guardar()}>
              <Save className="h-3.5 w-3.5" />
              {busy ? "A guardar…" : "Guardar template"}
            </Button>
            {activeType?.conteudoDefault ? (
              <Button type="button" size="sm" variant="secondary" onClick={restaurarDefault}>
                Restaurar modelo
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
  type,
  active,
  hasContent,
  onClick,
}: {
  type: TemplateTypeDef;
  active: boolean;
  hasContent: boolean;
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
      )}
    >
      <span className="font-medium">{type.label}</span>
      {hasContent ? (
        <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" title="Guardado" />
      ) : null}
    </button>
  );
}
