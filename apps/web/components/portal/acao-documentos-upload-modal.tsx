"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Circle, Loader2, Upload } from "lucide-react";
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

type DocRow = { id: string; nome: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  acaoId: string;
  docs: DocRow[];
  onUploaded: () => void | Promise<void>;
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

  const presentes = useMemo(() => {
    const set = new Set<string>();
    for (const rec of recomendados) {
      if (docs.some((d) => docMatchesRecomendado(d.nome, rec.id, rec.label))) {
        set.add(rec.id);
      }
    }
    return set;
  }, [docs, recomendados]);

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      if (!list.length) return;
      setBusy(true);
      setError(null);
      for (const file of list) {
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
    },
    [acaoId, onOpenChange, onUploaded],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Adicionar documentos à acção" className="max-w-lg">
        <div className="space-y-4">
          <div>
            <p className="text-xs text-slate-400">
              Referência dos ficheiros que devem existir em cada acção formativa. Marque o que já
              anexou nesta edição e importe os restantes.
            </p>
          </div>

          <ul className="max-h-52 space-y-1.5 overflow-y-auto rounded-lg border border-slate-700/40 bg-slate-950/40 p-2">
            {recomendados.map((rec) => {
              const ok = presentes.has(rec.id);
              return (
                <li
                  key={rec.id}
                  className="flex items-start gap-2 rounded-md px-2 py-1.5 text-xs text-slate-300"
                >
                  {ok ? (
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  ) : (
                    <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-600" />
                  )}
                  <span>
                    <span className={cn("font-medium", ok ? "text-emerald-200/90" : "text-slate-200")}>
                      {rec.label}
                    </span>
                    {rec.ajuda ? (
                      <span className="mt-0.5 block text-[10px] text-slate-500">{rec.ajuda}</span>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>

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
              if (e.dataTransfer.files?.length) void uploadFiles(e.dataTransfer.files);
            }}
            onClick={() => fileRef.current?.click()}
            className={cn(
              "cursor-pointer rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors",
              dragOver
                ? "border-blue-500/60 bg-blue-950/20"
                : "border-slate-600/50 bg-slate-900/30 hover:border-slate-500/60",
            )}
          >
            <Upload className="mx-auto mb-2 h-8 w-8 text-slate-500" />
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
                if (list?.length) void uploadFiles(list);
              }}
            />
          </div>

          {error ? <p className="text-xs text-red-300">{error}</p> : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              {busy ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  A enviar…
                </>
              ) : (
                <>
                  <Upload className="h-3.5 w-3.5" />
                  Escolher ficheiros
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
