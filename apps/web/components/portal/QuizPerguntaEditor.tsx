"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { parseApiError } from "@/lib/ui/backoffice";
import { Button, Dialog, DialogContent, Input } from "@/components/ui";

type Opcao = { id: string; texto: string; correta?: boolean };

type Pergunta = {
  id: string;
  enunciado: string;
  ordem: number;
  pontos: number;
  opcoes: Opcao[];
};

function newOpcao(): Opcao {
  return { id: crypto.randomUUID(), texto: "", correta: false };
}

type Props = {
  moduloId: string;
  canEdit: boolean;
};

export function QuizPerguntaEditor({ moduloId, canEdit }: Props) {
  const [perguntas, setPerguntas] = useState<Pergunta[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusPerguntaId, setFocusPerguntaId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const perguntaRefs = useRef(new Map<string, HTMLDivElement>());
  const addButtonRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    const res = await bffFetch(`/api/v1/quizzes/modulos/${moduloId}/perguntas`, {
      headers: { accept: "application/json" },
    });
    if (!res.ok) {
      setError(await parseApiError(res));
      if (!opts?.silent) setLoading(false);
      return;
    }
    setPerguntas((await res.json()) as Pergunta[]);
    if (!opts?.silent) setLoading(false);
  }, [moduloId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!focusPerguntaId) return;
    const id = focusPerguntaId;
    const timer = window.setTimeout(() => {
      const el = perguntaRefs.current.get(id);
      addButtonRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      el?.querySelector("textarea")?.focus({ preventScroll: true });
      setFocusPerguntaId(null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [focusPerguntaId, perguntas]);

  async function addPergunta() {
    if (!canEdit) return;
    setBusy(true);
    setError(null);
    const opcoes = [newOpcao(), newOpcao()];
    opcoes[0].correta = true;
    const res = await bffFetch("/api/v1/quizzes/perguntas", {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        moduloId,
        enunciado: "Nova pergunta",
        ordem: perguntas.length,
        opcoes,
        pontos: 1,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    const created = (await res.json()) as Pergunta;
    setPerguntas((prev) => [...prev, created]);
    setFocusPerguntaId(created.id);
  }

  async function savePergunta(p: Pergunta) {
    if (!canEdit) return;
    setBusy(true);
    const res = await bffFetch(`/api/v1/quizzes/perguntas/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        enunciado: p.enunciado,
        ordem: p.ordem,
        pontos: p.pontos,
        opcoes: p.opcoes,
      }),
    });
    setBusy(false);
    if (!res.ok) setError(await parseApiError(res));
  }

  async function confirmRemovePergunta() {
    if (!canEdit || !deleteTargetId) return;
    const id = deleteTargetId;
    setDeleteTargetId(null);
    setBusy(true);
    setError(null);
    const res = await bffFetch(`/api/v1/quizzes/perguntas/${id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    perguntaRefs.current.delete(id);
    setPerguntas((prev) => prev.filter((p) => p.id !== id));
  }

  const deleteTarget = deleteTargetId ? perguntas.find((p) => p.id === deleteTargetId) : null;

  function updateLocal(id: string, patch: Partial<Pergunta>) {
    setPerguntas((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function AddPerguntaButton({ label = "Adicionar pergunta" }: { label?: string }) {
    return (
      <button
        ref={addButtonRef}
        type="button"
        disabled={busy}
        onClick={() => void addPergunta()}
        className="group w-full flex items-center justify-center gap-2 rounded-lg border border-dashed border-purple-500/25 bg-purple-950/5 py-3 text-xs font-medium text-purple-300/70 transition-all hover:border-purple-400/45 hover:bg-purple-500/10 hover:text-purple-200 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Plus className="h-4 w-4 transition-transform group-hover:scale-110" />
        {label}
      </button>
    );
  }

  if (loading) {
    return <p className="text-xs text-slate-500">A carregar perguntas…</p>;
  }

  return (
    <div className="space-y-3 rounded-lg border border-purple-500/20 bg-purple-950/10 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-purple-200">Perguntas do quiz ({perguntas.length})</p>
      </div>
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
      {perguntas.length === 0 ? (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">Sem perguntas. Adiciona pelo menos uma para o formando poder responder.</p>
          {canEdit ? <AddPerguntaButton label="Adicionar primeira pergunta" /> : null}
        </div>
      ) : (
        <>
        {perguntas.map((p, idx) => (
          <div
            key={p.id}
            ref={(node) => {
              if (node) perguntaRefs.current.set(p.id, node);
              else perguntaRefs.current.delete(p.id);
            }}
            className="space-y-2 rounded-md border border-slate-700/50 bg-slate-900/50 p-2.5"
          >
            <div className="flex items-start gap-2">
              <span className="mt-2 text-[10px] font-mono text-slate-500">#{idx + 1}</span>
              <textarea
                className="min-h-[48px] flex-1 rounded border border-slate-600/60 bg-slate-900/80 px-2 py-1.5 text-xs text-slate-100"
                value={p.enunciado}
                disabled={!canEdit}
                onChange={(e) => updateLocal(p.id, { enunciado: e.target.value })}
                onBlur={() => void savePergunta(p)}
              />
              {canEdit ? (
                <button
                  type="button"
                  className="mt-1 text-red-400 hover:text-red-300"
                  onClick={() => setDeleteTargetId(p.id)}
                  aria-label="Eliminar pergunta"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
            <div className="space-y-1.5 pl-5">
              {canEdit ? (
                <p className="text-[10px] text-slate-500">Selecciona a opção correcta em cada pergunta.</p>
              ) : null}
              {p.opcoes.map((o, oi) => (
                <label key={o.id} className="flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="radio"
                    name={`correta-${p.id}`}
                    checked={!!o.correta}
                    disabled={!canEdit}
                    onChange={() => {
                      const opcoes = p.opcoes.map((opt, j) => ({ ...opt, correta: j === oi }));
                      updateLocal(p.id, { opcoes });
                      void savePergunta({ ...p, opcoes });
                    }}
                  />
                  <input
                    className="flex-1 rounded border border-slate-600/60 bg-slate-900/80 px-2 py-1 text-xs"
                    value={o.texto}
                    disabled={!canEdit}
                    placeholder={`Opção ${oi + 1}`}
                    onChange={(e) => {
                      const opcoes = p.opcoes.map((opt, j) =>
                        j === oi ? { ...opt, texto: e.target.value } : opt,
                      );
                      updateLocal(p.id, { opcoes });
                    }}
                    onBlur={() => void savePergunta(p)}
                  />
                </label>
              ))}
              {canEdit ? (
                <button
                  type="button"
                  className="text-[10px] text-cyan-400 hover:underline"
                  onClick={() => {
                    const opcoes = [...p.opcoes, newOpcao()];
                    updateLocal(p.id, { opcoes });
                    void savePergunta({ ...p, opcoes });
                  }}
                >
                  + opção
                </button>
              ) : null}
            </div>
            <div className="pl-5">
              <Input
                label="Pontos"
                type="number"
                min={1}
                className="h-7 text-xs"
                value={p.pontos}
                disabled={!canEdit}
                onChange={(e) => updateLocal(p.id, { pontos: Number(e.target.value) || 1 })}
                onBlur={() => void savePergunta(p)}
              />
            </div>
          </div>
        ))}
        {canEdit ? <AddPerguntaButton /> : null}
        </>
      )}

      <Dialog open={!!deleteTargetId} onOpenChange={(open) => !open && setDeleteTargetId(null)}>
        <DialogContent
          title="Eliminar pergunta"
          description={
            deleteTarget?.enunciado.trim()
              ? `«${deleteTarget.enunciado.trim().slice(0, 120)}${deleteTarget.enunciado.length > 120 ? "…" : ""}» será eliminada permanentemente.`
              : "Esta pergunta será eliminada permanentemente."
          }
        >
          <div className="flex flex-wrap gap-2 pt-2">
            <Button variant="danger" disabled={busy} onClick={() => void confirmRemovePergunta()}>
              Eliminar
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => setDeleteTargetId(null)}>
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
