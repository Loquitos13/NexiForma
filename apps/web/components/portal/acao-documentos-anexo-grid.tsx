"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Trash2, Upload } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { parseApiError } from "@/lib/ui/backoffice";
import { Button } from "@/components/ui";
import { cn } from "@/lib/ui/cn";

const ACAO_ANEXO_CATEGORIA = "acao_anexo";

type DocRow = {
  id: string;
  nome: string;
  mimeType: string;
  tamanhoBytes: number;
  createdAt: string;
};

type Props = {
  acaoId: string;
  canManage?: boolean;
};

export function AcaoDocumentosAnexoGrid({ acaoId, canManage = true }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await bffFetch(
      `/api/v1/documentos?acaoFormacaoId=${encodeURIComponent(acaoId)}&categoria=${ACAO_ANEXO_CATEGORIA}`,
      { headers: { accept: "application/json" } },
    );
    if (r.ok) setDocs((await r.json()) as DocRow[]);
  }, [acaoId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const sel = docs.find((d) => d.id === selectedId);
    setRenameDraft(sel?.nome ?? "");
  }, [selectedId, docs]);

  async function uploadFiles(files: FileList | File[]) {
    if (!canManage) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file);
      const qs = new URLSearchParams({
        acaoFormacaoId: acaoId,
        categoria: ACAO_ANEXO_CATEGORIA,
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
    setMsg(`${Array.from(files).length} ficheiro(s) adicionado(s).`);
    await load();
  }

  async function guardarNome() {
    if (!selectedId || !canManage) return;
    const nome = renameDraft.trim();
    if (!nome) return;
    setBusy(true);
    setError(null);
    const r = await bffFetch(`/api/v1/documentos/${selectedId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ nome }),
    });
    setBusy(false);
    if (!r.ok) {
      setError(await parseApiError(r));
      return;
    }
    setMsg("Nome actualizado.");
    await load();
  }

  async function eliminar(id: string) {
    if (!canManage) return;
    if (!window.confirm("Eliminar este ficheiro da acção?")) return;
    setBusy(true);
    setError(null);
    const r = await bffFetch(`/api/v1/documentos/${id}`, { method: "DELETE" });
    setBusy(false);
    if (!r.ok) {
      setError(await parseApiError(r));
      return;
    }
    if (selectedId === id) setSelectedId(null);
    setMsg("Ficheiro eliminado.");
    await load();
  }

  async function abrir(id: string) {
    const r = await bffFetch(`/api/v1/documentos/${id}/download`);
    if (!r.ok) {
      setError(await parseApiError(r));
      return;
    }
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">Documentos da acção</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Ficheiros específicos desta edição (gestor e coordenação pedagógica). Clique para
            renomear; duplo clique para abrir.
          </p>
        </div>
        {canManage ? (
          <>
            <input
              ref={fileRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                const list = e.target.files;
                e.target.value = "";
                if (list?.length) void uploadFiles(list);
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-3.5 w-3.5" />
              Adicionar ficheiros
            </Button>
          </>
        ) : null}
      </div>

      {error ? <p className="text-xs text-red-300">{error}</p> : null}
      {msg ? <p className="text-xs text-green-300">{msg}</p> : null}

      {docs.length === 0 ? (
        <p className="text-xs text-slate-500 rounded-lg border border-dashed border-slate-700/50 px-3 py-6 text-center">
          Sem documentos anexados a esta acção.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {docs.map((doc) => (
            <button
              key={doc.id}
              type="button"
              onClick={() => setSelectedId(doc.id)}
              onDoubleClick={() => void abrir(doc.id)}
              className={cn(
                "rounded-lg border px-2 py-2 text-left transition-colors",
                selectedId === doc.id
                  ? "border-blue-500/50 bg-blue-950/30 ring-1 ring-blue-500/30"
                  : "border-slate-700/40 bg-slate-900/40 hover:border-slate-600",
              )}
              title="Clique para seleccionar · duplo clique para abrir"
            >
              <FileText className="h-4 w-4 text-slate-400 mb-1" />
              <p className="text-[11px] font-medium text-slate-200 line-clamp-2">{doc.nome}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {(doc.tamanhoBytes / 1024).toFixed(0)} KB
              </p>
            </button>
          ))}
        </div>
      )}

      {selectedId && canManage ? (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-700/40 bg-slate-950/50 px-3 py-2">
          <label className="flex-1 min-w-[12rem]">
            <span className="text-[10px] uppercase tracking-wide text-slate-500">Nome do ficheiro</span>
            <input
              className="mt-0.5 w-full rounded-md border border-slate-600/60 bg-slate-900 px-2 py-1.5 text-xs text-slate-200"
              value={renameDraft}
              onChange={(e) => setRenameDraft(e.target.value)}
            />
          </label>
          <Button type="button" size="sm" disabled={busy} onClick={() => void guardarNome()}>
            Guardar nome
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() => void eliminar(selectedId)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Eliminar
          </Button>
        </div>
      ) : null}
    </div>
  );
}
