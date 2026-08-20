"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Trash2, Type } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { parseApiError } from "@/lib/ui/backoffice";
import { Button, Dialog, DialogContent } from "@/components/ui";
import { INPUT_CLASS } from "@/components/portal/lms-modulos-shared";

type QuizTipo = "MULTIPLA" | "VF" | "ABERTA";
type Opcao = { id: string; texto: string; correta?: boolean };

type Pergunta = {
  id: string;
  enunciado: string;
  ordem: number;
  pontos: number;
  tipo: QuizTipo;
  opcoes: Opcao[];
  explicacao?: string | null;
};

function newOpcao(texto = ""): Opcao {
  return { id: crypto.randomUUID(), texto, correta: false };
}

function defaultOpcoes(tipo: QuizTipo): Opcao[] {
  if (tipo === "VF") {
    return [
      { id: crypto.randomUUID(), texto: "Verdadeiro", correta: true },
      { id: crypto.randomUUID(), texto: "Falso", correta: false },
    ];
  }
  if (tipo === "ABERTA") return [];
  const a = newOpcao("Opção A");
  const b = newOpcao("Opção B");
  a.correta = true;
  return [a, b];
}

const TIPO_BTNS: { id: QuizTipo; label: string }[] = [
  { id: "MULTIPLA", label: "Múltipla" },
  { id: "VF", label: "V/F" },
  { id: "ABERTA", label: "T Aberta" },
];

type Props = {
  moduloId: string;
  canEdit: boolean;
  embedded?: boolean;
};

export function QuizPerguntaEditor({ moduloId, canEdit, embedded }: Props) {
  const [perguntas, setPerguntas] = useState<Pergunta[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
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
    const rows = (await res.json()) as Pergunta[];
    setPerguntas(
      rows.map((p) => ({
        ...p,
        tipo: (p.tipo ?? "MULTIPLA") as QuizTipo,
        opcoes: Array.isArray(p.opcoes) ? p.opcoes : defaultOpcoes((p.tipo ?? "MULTIPLA") as QuizTipo),
      })),
    );
    if (!opts?.silent) setLoading(false);
  }, [moduloId]);

  useEffect(() => {
    void load();
  }, [load]);

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
        tipo: p.tipo,
        opcoes: p.opcoes,
        explicacao: p.explicacao ?? null,
      }),
    });
    setBusy(false);
    if (!res.ok) setError(await parseApiError(res));
  }

  async function addPergunta() {
    if (!canEdit) return;
    setBusy(true);
    setError(null);
    const opcoes = defaultOpcoes("MULTIPLA");
    const res = await bffFetch("/api/v1/quizzes/perguntas", {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        moduloId,
        enunciado: "Nova pergunta",
        ordem: perguntas.length,
        tipo: "MULTIPLA",
        opcoes,
        pontos: 10,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    const created = (await res.json()) as Pergunta;
    setPerguntas((prev) => [...prev, { ...created, tipo: created.tipo ?? "MULTIPLA", opcoes: created.opcoes ?? opcoes }]);
    addButtonRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  async function confirmRemovePergunta() {
    if (!canEdit || !deleteTargetId) return;
    const id = deleteTargetId;
    setDeleteTargetId(null);
    setBusy(true);
    const res = await bffFetch(`/api/v1/quizzes/perguntas/${id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    setPerguntas((prev) => prev.filter((p) => p.id !== id));
  }

  function updateLocal(id: string, patch: Partial<Pergunta>) {
    setPerguntas((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function changeTipo(p: Pergunta, tipo: QuizTipo) {
    const next = { ...p, tipo, opcoes: defaultOpcoes(tipo) };
    updateLocal(p.id, next);
    void savePergunta(next);
  }

  const totalPts = perguntas.reduce((s, p) => s + (p.pontos ?? 0), 0);
  const deleteTarget = deleteTargetId ? perguntas.find((p) => p.id === deleteTargetId) : null;

  if (loading) {
    return <p className="text-xs text-slate-500">A carregar perguntas…</p>;
  }

  return (
    <div className={embedded ? "space-y-3" : "space-y-3 rounded-lg border border-purple-500/20 bg-purple-950/10 p-3"}>
      {!embedded ? (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-purple-200">Perguntas ({perguntas.length})</p>
          <span className="rounded-md border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-[10px] font-bold text-green-300 tabular-nums">
            {totalPts} pts
          </span>
        </div>
      ) : null}
      {error ? <p className="text-xs text-red-400">{error}</p> : null}

      {perguntas.map((p, idx) => (
        <div key={p.id} className="rounded-xl border border-slate-700/40 bg-slate-900/60 p-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-800 text-xs font-bold text-slate-400">
              {idx + 1}
            </span>
            <div className="flex rounded-lg border border-slate-700/40 p-0.5">
              {TIPO_BTNS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  disabled={!canEdit || busy}
                  onClick={() => changeTipo(p, t.id)}
                  className={`rounded-md px-2.5 py-1 text-[10px] font-semibold ${
                    p.tipo === t.id
                      ? t.id === "ABERTA"
                        ? "bg-violet-600/40 text-violet-200"
                        : t.id === "VF"
                          ? "bg-blue-600/30 text-blue-200"
                          : "bg-purple-600/30 text-purple-200"
                      : "text-slate-500"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <input
                type="number"
                min={1}
                disabled={!canEdit}
                value={p.pontos}
                onChange={(e) => updateLocal(p.id, { pontos: Number(e.target.value) || 1 })}
                onBlur={() => void savePergunta(p)}
                className="w-16 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] font-bold text-amber-300 tabular-nums"
              />
              <span className="text-[10px] text-amber-400/80">pts</span>
              {canEdit ? (
                <button type="button" className="text-red-400/70 hover:text-red-300" onClick={() => setDeleteTargetId(p.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          </div>

          <textarea
            className={`${INPUT_CLASS} min-h-[56px] text-sm`}
            value={p.enunciado}
            disabled={!canEdit}
            onChange={(e) => updateLocal(p.id, { enunciado: e.target.value })}
            onBlur={() => void savePergunta(p)}
          />

          {p.tipo === "ABERTA" ? (
            <div className="flex items-center gap-2 rounded-lg border border-slate-700/40 bg-slate-950/50 px-3 py-2.5 text-xs text-slate-500">
              <Type className="h-4 w-4 shrink-0" />
              Resposta livre - corrigida manualmente pelo formador.
            </div>
          ) : (
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wide text-slate-500">
                Opções - clica no círculo para marcar a correcta
              </p>
              {p.opcoes.map((o, oi) => (
                <label
                  key={o.id}
                  className="flex items-center gap-2 rounded-lg border border-slate-700/30 bg-slate-950/40 px-3 py-2"
                >
                  <input
                    type="radio"
                    name={`correta-${p.id}`}
                    checked={!!o.correta}
                    disabled={!canEdit}
                    onChange={() => {
                      const opcoes = p.opcoes.map((opt, j) => ({ ...opt, correta: j === oi }));
                      const next = { ...p, opcoes };
                      updateLocal(p.id, next);
                      void savePergunta(next);
                    }}
                    className="accent-teal-500"
                  />
                  {p.tipo === "VF" ? (
                    <span className="text-sm text-slate-200">{o.texto}</span>
                  ) : (
                    <input
                      className="flex-1 bg-transparent text-sm text-slate-200 outline-none"
                      value={o.texto}
                      disabled={!canEdit}
                      placeholder={`Opção ${oi + 1}`}
                      onChange={(e) => {
                        const opcoes = p.opcoes.map((opt, j) => (j === oi ? { ...opt, texto: e.target.value } : opt));
                        updateLocal(p.id, { opcoes });
                      }}
                      onBlur={() => void savePergunta(p)}
                    />
                  )}
                </label>
              ))}
              {p.tipo === "MULTIPLA" && canEdit ? (
                <button
                  type="button"
                  className="text-[10px] text-teal-400 hover:underline"
                  onClick={() => {
                    const opcoes = [...p.opcoes, newOpcao()];
                    const next = { ...p, opcoes };
                    updateLocal(p.id, next);
                    void savePergunta(next);
                  }}
                >
                  + Opção
                </button>
              ) : null}
            </div>
          )}

          <label className="block">
            <span className="text-[10px] uppercase tracking-wide text-slate-500">
              Explicação (mostrada após responder)
            </span>
            <input
              className={`${INPUT_CLASS} mt-1 text-xs`}
              value={p.explicacao ?? ""}
              disabled={!canEdit}
              onChange={(e) => updateLocal(p.id, { explicacao: e.target.value })}
              onBlur={() => void savePergunta(p)}
            />
          </label>
        </div>
      ))}

      {canEdit ? (
        <button
          ref={addButtonRef}
          type="button"
          disabled={busy}
          onClick={() => void addPergunta()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-orange-500/40 py-3 text-xs font-medium text-orange-300/90 hover:border-orange-400/60 hover:bg-orange-500/5"
        >
          <Plus className="h-4 w-4" /> Adicionar pergunta
        </button>
      ) : null}

      <Dialog open={!!deleteTargetId} onOpenChange={(open) => !open && setDeleteTargetId(null)}>
        <DialogContent title="Eliminar pergunta" description="Esta pergunta será eliminada permanentemente.">
          <div className="flex flex-wrap gap-2 pt-2">
            <Button variant="danger" disabled={busy} onClick={() => void confirmRemovePergunta()}>
              Eliminar
            </Button>
            <Button variant="secondary" onClick={() => setDeleteTargetId(null)}>
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
