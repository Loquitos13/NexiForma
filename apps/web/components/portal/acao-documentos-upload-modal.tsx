"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Circle,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { parseApiError } from "@/lib/ui/backoffice";
import { Button, Dialog, DialogContent } from "@/components/ui";
import { cn } from "@/lib/ui/cn";

/** Ficheiros recomendados no enquadramento de qualquer acção formativa. */
const FICHEIROS_ACAO_RECOMENDADOS = [
  { id: "cronograma", label: "Cronograma" },
  { id: "programa", label: "Programa" },
  { id: "regulamento_atividade", label: "Regulamento da atividade formativa" },
  { id: "regulamento_formando", label: "Regulamento do formando" },
] as const;

type DocRow = {
  id: string;
  nome: string;
  mimeType?: string;
  tamanhoBytes?: number;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  acaoId: string;
  docs: DocRow[];
  onUploaded: () => void | Promise<void>;
};

type PendingFile = {
  id: string;
  file: File;
};

type FileRef = { kind: "pending"; id: string } | { kind: "existing"; id: string };

type ExtTheme = {
  label: string;
  badge: string;
  badgeText: string;
  cardBorder: string;
  cardBg: string;
  tag: string;
  slotTag: string;
};

const EXT_THEMES: Record<string, ExtTheme> = {
  pdf: {
    label: "PDF",
    badge: "bg-red-500/90",
    badgeText: "text-white",
    cardBorder: "border-red-500/35",
    cardBg: "bg-red-950/25",
    tag: "bg-red-500/20 text-red-200 border-red-500/30",
    slotTag: "bg-red-500/15 text-red-300",
  },
  doc: {
    label: "DOC",
    badge: "bg-blue-500/90",
    badgeText: "text-white",
    cardBorder: "border-blue-500/35",
    cardBg: "bg-blue-950/25",
    tag: "bg-blue-500/20 text-blue-200 border-blue-500/30",
    slotTag: "bg-blue-500/15 text-blue-300",
  },
  docx: {
    label: "DOC",
    badge: "bg-blue-500/90",
    badgeText: "text-white",
    cardBorder: "border-blue-500/35",
    cardBg: "bg-blue-950/25",
    tag: "bg-blue-500/20 text-blue-200 border-blue-500/30",
    slotTag: "bg-blue-500/15 text-blue-300",
  },
  xls: {
    label: "XLS",
    badge: "bg-emerald-500/90",
    badgeText: "text-white",
    cardBorder: "border-emerald-500/35",
    cardBg: "bg-emerald-950/25",
    tag: "bg-emerald-500/20 text-emerald-200 border-emerald-500/30",
    slotTag: "bg-emerald-500/15 text-emerald-300",
  },
  xlsx: {
    label: "XLS",
    badge: "bg-emerald-500/90",
    badgeText: "text-white",
    cardBorder: "border-emerald-500/35",
    cardBg: "bg-emerald-950/25",
    tag: "bg-emerald-500/20 text-emerald-200 border-emerald-500/30",
    slotTag: "bg-emerald-500/15 text-emerald-300",
  },
  ppt: {
    label: "PPT",
    badge: "bg-orange-500/90",
    badgeText: "text-white",
    cardBorder: "border-orange-500/35",
    cardBg: "bg-orange-950/25",
    tag: "bg-orange-500/20 text-orange-200 border-orange-500/30",
    slotTag: "bg-orange-500/15 text-orange-300",
  },
  pptx: {
    label: "PPT",
    badge: "bg-orange-500/90",
    badgeText: "text-white",
    cardBorder: "border-orange-500/35",
    cardBg: "bg-orange-950/25",
    tag: "bg-orange-500/20 text-orange-200 border-orange-500/30",
    slotTag: "bg-orange-500/15 text-orange-300",
  },
};

const DEFAULT_EXT_THEME: ExtTheme = {
  label: "FILE",
  badge: "bg-slate-500/90",
  badgeText: "text-white",
  cardBorder: "border-slate-500/35",
  cardBg: "bg-slate-900/50",
  tag: "bg-slate-500/20 text-slate-200 border-slate-500/30",
  slotTag: "bg-slate-500/15 text-slate-300",
};

function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ");
}

function docMatchesRecomendado(nome: string, recId: string, recLabel: string): boolean {
  const n = normalizeName(nome);
  const id = recId.replace(/_/g, " ");
  const label = normalizeName(recLabel);
  return n.includes(id) || label.split(" ").filter((w) => w.length > 3).some((w) => n.includes(w));
}

function fileExtension(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

function extTheme(name: string): ExtTheme {
  const ext = fileExtension(name);
  return EXT_THEMES[ext] ?? {
    ...DEFAULT_EXT_THEME,
    label: ext ? ext.slice(0, 4).toUpperCase() : "FILE",
  };
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileRefKey(ref: FileRef): string {
  return `${ref.kind}:${ref.id}`;
}

function parseFileRefKey(key: string): FileRef | null {
  const [kind, id] = key.split(":");
  if ((kind === "pending" || kind === "existing") && id) return { kind, id };
  return null;
}

function newPendingId(): string {
  return `p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function AcaoDocumentosUploadModal({
  open,
  onOpenChange,
  acaoId,
  docs,
  onUploaded,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inscricaoOpts, setInscricaoOpts] = useState<Array<{ id: string; label: string; ajuda: string }>>(
    [],
  );
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  /** slotId -> fileRefKey */
  const [slotLinks, setSlotLinks] = useState<Record<string, string>>({});
  const [selectedFileKey, setSelectedFileKey] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      const r = await bffFetch("/api/v1/portal/tenant/documentos-politica", {
        headers: { accept: "application/json" },
      });
      if (!r.ok) return;
      const json = (await r.json()) as {
        opcoesInscricao?: Array<{ id: string; label: string; ajuda: string }>;
      };
      setInscricaoOpts(json.opcoesInscricao ?? []);
    })();
  }, [open]);

  const recomendados = useMemo(() => {
    const inscricao = inscricaoOpts.map((o) => ({
      id: o.id,
      label: o.label,
      ajuda: o.ajuda,
    }));
    return [
      ...FICHEIROS_ACAO_RECOMENDADOS.map((r) => ({ ...r, ajuda: undefined as string | undefined })),
      ...inscricao.map((o) => ({ id: o.id, label: o.label, ajuda: o.ajuda })),
    ];
  }, [inscricaoOpts]);

  const initSlotLinks = useCallback(() => {
    const next: Record<string, string> = {};
    for (const rec of recomendados) {
      const match = docs.find((d) => docMatchesRecomendado(d.nome, rec.id, rec.label));
      if (match) next[rec.id] = fileRefKey({ kind: "existing", id: match.id });
    }
    setSlotLinks(next);
  }, [docs, recomendados]);

  useEffect(() => {
    if (!open) {
      setPendingFiles([]);
      setSlotLinks({});
      setSelectedFileKey(null);
      setError(null);
      setDragOver(false);
      return;
    }
    initSlotLinks();
  }, [open, initSlotLinks]);

  const fileMeta = useMemo(() => {
    const map = new Map<
      string,
      { name: string; size: number; theme: ExtTheme; ref: FileRef }
    >();
    for (const d of docs) {
      const key = fileRefKey({ kind: "existing", id: d.id });
      map.set(key, {
        name: d.nome,
        size: d.tamanhoBytes ?? 0,
        theme: extTheme(d.nome),
        ref: { kind: "existing", id: d.id },
      });
    }
    for (const p of pendingFiles) {
      const key = fileRefKey({ kind: "pending", id: p.id });
      map.set(key, {
        name: p.file.name,
        size: p.file.size,
        theme: extTheme(p.file.name),
        ref: { kind: "pending", id: p.id },
      });
    }
    return map;
  }, [docs, pendingFiles]);

  const uploadedKeys = useMemo(() => Array.from(fileMeta.keys()), [fileMeta]);

  const slotLabelByFileKey = useMemo(() => {
    const out = new Map<string, string>();
    for (const [slotId, fileKey] of Object.entries(slotLinks)) {
      const rec = recomendados.find((r) => r.id === slotId);
      if (rec) out.set(fileKey, rec.label);
    }
    return out;
  }, [slotLinks, recomendados]);

  const associatedCount = useMemo(
    () => Object.keys(slotLinks).length,
    [slotLinks],
  );

  const addFiles = useCallback((files: FileList | File[]) => {
    const list = Array.from(files);
    if (!list.length) return;
    setPendingFiles((prev) => [
      ...prev,
      ...list.map((file) => ({ id: newPendingId(), file })),
    ]);
  }, []);

  function removeFile(key: string) {
    const ref = parseFileRefKey(key);
    if (!ref) return;
    if (ref.kind === "pending") {
      setPendingFiles((prev) => prev.filter((p) => p.id !== ref.id));
    }
    setSlotLinks((prev) => {
      const next = { ...prev };
      for (const [slotId, fileKey] of Object.entries(next)) {
        if (fileKey === key) delete next[slotId];
      }
      return next;
    });
    if (selectedFileKey === key) setSelectedFileKey(null);
  }

  function associateSlot(slotId: string) {
    if (!selectedFileKey) return;
    setSlotLinks((prev) => {
      const next = { ...prev };
      for (const [sid, fileKey] of Object.entries(next)) {
        if (fileKey === selectedFileKey) delete next[sid];
      }
      next[slotId] = selectedFileKey;
      return next;
    });
    setSelectedFileKey(null);
  }

  function clearSlot(slotId: string) {
    setSlotLinks((prev) => {
      const next = { ...prev };
      delete next[slotId];
      return next;
    });
  }

  const uploadFiles = useCallback(async () => {
    setBusy(true);
    setError(null);

    for (const pending of pendingFiles) {
      const key = fileRefKey({ kind: "pending", id: pending.id });
      let file = pending.file;
      const linkedSlotId = Object.entries(slotLinks).find(([, v]) => v === key)?.[0];
      if (linkedSlotId) {
        const slot = recomendados.find((r) => r.id === linkedSlotId);
        if (slot && !docMatchesRecomendado(file.name, slot.id, slot.label)) {
          const ext = fileExtension(file.name);
          const suffix = ext ? `.${ext}` : "";
          file = new File([file], `${slot.label}${suffix}`, { type: file.type, lastModified: file.lastModified });
        }
      }

      const fd = new FormData();
      fd.append("file", file);
      const qs = new URLSearchParams({
        acaoFormacaoId: acaoId,
        categoria: "acao_anexo",
        visivelFormando: "false",
        visivelFormador: "false",
      });
      const r = await bffFetch(`/api/v1/documentos/upload?${qs}`, { method: "POST", body: fd });
      if (!r.ok) {
        setError(await parseApiError(r));
        setBusy(false);
        return;
      }
    }

    setBusy(false);
    await onUploaded();
    onOpenChange(false);
  }, [acaoId, onOpenChange, onUploaded, pendingFiles, recomendados, slotLinks]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Adicionar documentos à acção" className="max-w-2xl">
        <div className="-mt-1 flex min-h-0 flex-col gap-4">
          <div>
            <p className="text-[11px] font-medium text-slate-400">
              {associatedCount}/{recomendados.length} documentos associados
            </p>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              Marque cada documento obrigatório e associe o ficheiro correspondente. Arraste
              ficheiros ou escolha no computador.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {recomendados.map((rec) => {
              const fileKey = slotLinks[rec.id];
              const meta = fileKey ? fileMeta.get(fileKey) : null;
              const linked = Boolean(meta);
              const pickable = Boolean(selectedFileKey);
              return (
                <div
                  key={rec.id}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if ((e.key === "Enter" || e.key === " ") && pickable) associateSlot(rec.id);
                  }}
                  onClick={() => {
                    if (pickable) associateSlot(rec.id);
                  }}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-left transition-colors",
                    linked
                      ? "border-blue-500/40 bg-blue-950/15"
                      : "border-slate-700/50 bg-slate-950/35",
                    pickable && "cursor-pointer ring-1 ring-blue-500/25 hover:border-blue-500/50",
                  )}
                >
                  <div className="flex items-start gap-2">
                    {linked ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
                    ) : (
                      <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "text-xs font-medium",
                          linked ? "text-slate-100" : "text-slate-400",
                        )}
                      >
                        {rec.label}
                      </p>
                      {rec.ajuda ? (
                        <p className="mt-0.5 text-[10px] text-slate-500">{rec.ajuda}</p>
                      ) : null}
                      {meta ? (
                        <div className="mt-2 flex items-center gap-1.5">
                          <span
                            className={cn(
                              "rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
                              meta.theme.badge,
                              meta.theme.badgeText,
                            )}
                          >
                            {meta.theme.label}
                          </span>
                          <span className="truncate text-[11px] text-slate-300">{meta.name}</span>
                          <button
                            type="button"
                            className="ml-auto shrink-0 rounded p-0.5 text-slate-500 hover:bg-slate-800 hover:text-slate-200"
                            aria-label="Remover associação"
                            onClick={(e) => {
                              e.stopPropagation();
                              clearSlot(rec.id);
                            }}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {uploadedKeys.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Ficheiros carregados - toque para associar
              </p>
              <div className="ui-themed-scroll flex gap-2 overflow-x-auto pb-1">
                {uploadedKeys.map((key) => {
                  const meta = fileMeta.get(key);
                  if (!meta) return null;
                  const slotLabel = slotLabelByFileKey.get(key);
                  const selected = selectedFileKey === key;
                  return (
                    <div
                      key={key}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          setSelectedFileKey(selected ? null : key);
                        }
                      }}
                      onClick={() => setSelectedFileKey(selected ? null : key)}
                      className={cn(
                        "relative flex w-[8.5rem] shrink-0 cursor-pointer flex-col rounded-xl border p-2.5 text-left transition-all",
                        meta.theme.cardBorder,
                        meta.theme.cardBg,
                        selected && "ring-2 ring-blue-400/70 ring-offset-1 ring-offset-slate-950",
                      )}
                    >
                      <button
                        type="button"
                        className="absolute right-1.5 top-1.5 rounded p-0.5 text-slate-500 hover:bg-black/20 hover:text-slate-200"
                        aria-label="Remover ficheiro"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(key);
                        }}
                      >
                        <X className="h-3 w-3" />
                      </button>
                      <span
                        className={cn(
                          "mb-3 inline-flex w-fit rounded-md px-2 py-1 text-[10px] font-bold",
                          meta.theme.badge,
                          meta.theme.badgeText,
                        )}
                      >
                        {meta.theme.label}
                      </span>
                      <p className="line-clamp-2 text-[11px] font-medium leading-snug text-slate-100">
                        {meta.name}
                      </p>
                      <p className="mt-1 text-[10px] text-slate-500">
                        {formatSize(meta.size)}
                      </p>
                      {slotLabel ? (
                        <span
                          className={cn(
                            "mt-2 inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-medium",
                            meta.theme.tag,
                          )}
                        >
                          <CheckCircle2 className="h-2.5 w-2.5" />
                          {slotLabel}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") fileRef.current?.click();
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
            }}
            onClick={() => fileRef.current?.click()}
            className={cn(
              "cursor-pointer rounded-xl border border-dashed px-4 py-7 text-center transition-colors",
              dragOver
                ? "border-blue-500/60 bg-blue-950/20"
                : "border-slate-600/50 bg-slate-900/25 hover:border-slate-500/60",
            )}
          >
            <Upload className="mx-auto mb-2 h-6 w-6 text-slate-500" />
            <p className="text-sm font-medium text-slate-200">Arraste ficheiros para aqui</p>
            <p className="mt-1 text-xs text-slate-500">ou clique para escolher no computador</p>
            <input
              ref={fileRef}
              type="file"
              multiple
              className="sr-only"
              onChange={(e) => {
                const list = e.target.files;
                e.target.value = "";
                if (list?.length) addFiles(list);
              }}
            />
          </div>

          {error ? <p className="text-xs text-red-300">{error}</p> : null}

          <div className="-mx-6 -mb-6 mt-1 flex shrink-0 justify-end gap-2 border-t border-slate-800/80 px-6 py-4">
            <Button type="button" variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => void uploadFiles()}
            >
              {busy ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  A guardar…
                </>
              ) : (
                <>
                  <Upload className="h-3.5 w-3.5" />
                  Guardar ({associatedCount}/{recomendados.length})
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
