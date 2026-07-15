"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { bffFetch } from "@/lib/client/bff-fetch";

type Pergunta = {
  id: string;
  enunciado: string;
  ordem: number;
  pontos: number;
  opcoes: Array<{ id: string; texto: string }>;
};

type QuizFeedback = {
  perguntaId: string;
  enunciado: string;
  correto: boolean;
  opcaoEscolhidaId: string | null;
};

type ResultadoQuiz = {
  pontuacao: number;
  aprovado: boolean;
  notaMinima: number;
  feedback: QuizFeedback[];
};

type Props = {
  moduloId: string;
  matriculaId: string;
  titulo?: string;
  embedded?: boolean;
  onComplete?: (aprovado: boolean) => void;
};

export function FormandoQuizInline({ moduloId, matriculaId, titulo, embedded, onComplete }: Props) {
  const [perguntas, setPerguntas] = useState<Pergunta[]>([]);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [resultado, setResultado] = useState<ResultadoQuiz | null>(null);
  const [tentativas, setTentativas] = useState<Array<{ id: string; pontuacao: number; aprovado: boolean; createdAt: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [tempoRestante, setTempoRestante] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalPontos = perguntas.reduce((s, p) => s + (p.pontos ?? 1), 0);
  const respondidas = Object.keys(respostas).length;

  const load = useCallback(async () => {
    const [pRes, tRes] = await Promise.all([
      bffFetch(`/api/v1/quizzes/modulos/${moduloId}/perguntas`, { headers: { accept: "application/json" } }),
      bffFetch(`/api/v1/quizzes/tentativas?matriculaId=${encodeURIComponent(matriculaId)}&moduloId=${moduloId}`, {
        headers: { accept: "application/json" },
      }),
    ]);
    if (pRes.ok) {
      const qs = (await pRes.json()) as Pergunta[];
      setPerguntas(qs);
      setTempoRestante(qs.length * 60);
    } else setError("Erro ao carregar perguntas.");
    if (tRes.ok) {
      setTentativas(
        (await tRes.json()) as Array<{ id: string; pontuacao: number; aprovado: boolean; createdAt: string }>,
      );
    }
  }, [moduloId, matriculaId]);

  useEffect(() => {
    void load();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [load]);

  const submeterQuiz = useCallback(
    async (e?: FormEvent) => {
      if (e) e.preventDefault();
      if (!matriculaId) {
        setError("matriculaId em falta.");
        return;
      }
      if (Object.keys(respostas).length < perguntas.length) {
        setError(`Responde a todas as perguntas (${respondidas}/${perguntas.length}).`);
        return;
      }
      setBusy(true);
      setError(null);
      const res = await bffFetch(
        `/api/v1/quizzes/modulos/${moduloId}/submeter?matriculaId=${encodeURIComponent(matriculaId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", accept: "application/json" },
          body: JSON.stringify({ respostas }),
        },
      );
      if (!res.ok) setError("Erro ao submeter quiz.");
      else {
        const r = (await res.json()) as ResultadoQuiz;
        setResultado(r);
        onComplete?.(r.aprovado);
        void load();
      }
      setBusy(false);
    },
    [matriculaId, moduloId, perguntas.length, respostas, respondidas, onComplete, load],
  );

  useEffect(() => {
    if (tempoRestante === null || resultado || perguntas.length === 0) return;
    if (tempoRestante <= 0) {
      void submeterQuiz();
      return;
    }
    timerRef.current = setInterval(() => {
      setTempoRestante((t) => (t !== null && t > 0 ? t - 1 : 0));
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [tempoRestante, resultado, perguntas.length, submeterQuiz]);

  function responder(perguntaId: string, opcaoId: string) {
    setRespostas((r) => ({ ...r, [perguntaId]: opcaoId }));
    if (currentIdx < perguntas.length - 1) {
      setTimeout(() => setCurrentIdx((i) => i + 1), 300);
    }
  }

  function reiniciarQuiz() {
    setResultado(null);
    setRespostas({});
    setCurrentIdx(0);
    setTempoRestante(perguntas.length * 60);
    setError(null);
  }

  const fmtTempo = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const p = perguntas[currentIdx];

  if (perguntas.length === 0 && !error) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-slate-500">Sem perguntas configuradas para este quiz.</p>
      </div>
    );
  }

  if (resultado) {
    return (
      <div className="space-y-4">
        <div
          className={`rounded-2xl p-6 text-center ${
            resultado.aprovado ? "bg-teal-500/10 border border-teal-500/20" : "bg-red-500/5 border border-red-500/20"
          }`}
        >
          <h4 className={`text-xl font-bold ${resultado.aprovado ? "text-teal-400" : "text-red-400"}`}>
            {resultado.aprovado ? "Aprovado!" : "Reprovado"}
          </h4>
          <p className="text-3xl font-black text-slate-100 mt-1">{resultado.pontuacao}%</p>
          <p className="text-xs text-slate-400 mt-2">Nota mínima: {resultado.notaMinima}%</p>
        </div>
        {!resultado.aprovado && !embedded ? (
          <button
            type="button"
            onClick={reiniciarQuiz}
            className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-500"
          >
            Repetir quiz
          </button>
        ) : null}
        {!resultado.aprovado && embedded ? (
          <button
            type="button"
            onClick={reiniciarQuiz}
            className="w-full rounded-xl border border-slate-600/40 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800/40"
          >
            Tentar novamente
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {titulo && embedded ? <p className="text-center text-xs text-slate-500 uppercase tracking-wide">{titulo}</p> : null}
      {error ? (
        <div className="rounded-xl border border-red-500/25 bg-red-950/40 px-4 py-3 text-sm text-red-300">{error}</div>
      ) : null}

      <div className="rounded-2xl border border-slate-700/30 bg-slate-900/50 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-bold text-slate-100">
              Pergunta {currentIdx + 1} de {perguntas.length}
            </h4>
            <p className="text-[11px] text-slate-500">
              {respondidas}/{perguntas.length} respondidas · {totalPontos} pts
            </p>
          </div>
          {tempoRestante !== null ? (
            <span
              className={`rounded-lg px-2.5 py-1 font-mono text-xs font-bold ${
                tempoRestante < 60 ? "bg-red-500/10 text-red-400" : "bg-slate-800 text-slate-300"
              }`}
            >
              {fmtTempo(tempoRestante)}
            </span>
          ) : null}
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-blue-500 transition-all duration-300"
            style={{ width: `${(respondidas / perguntas.length) * 100}%` }}
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {perguntas.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setCurrentIdx(idx)}
              className={`h-6 w-6 rounded text-[10px] font-bold ${
                idx === currentIdx
                  ? "bg-blue-600 text-white"
                  : respostas[perguntas[idx].id]
                    ? "bg-blue-500/20 text-blue-300"
                    : "bg-slate-800 text-slate-500"
              }`}
            >
              {idx + 1}
            </button>
          ))}
        </div>
      </div>

      {p ? (
        <div className="rounded-2xl border border-slate-700/30 bg-slate-900/50 p-5">
          <p className="mb-4 text-sm font-semibold text-slate-100">
            {currentIdx + 1}. {p.enunciado}
          </p>
          <div className="space-y-2">
            {p.opcoes.map((o, oi) => {
              const selected = respostas[p.id] === o.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => responder(p.id, o.id)}
                  className={`w-full rounded-xl border px-4 py-2.5 text-left text-sm transition-all ${
                    selected
                      ? "border-blue-500/40 bg-blue-600/20 text-blue-200"
                      : "border-slate-700/30 bg-slate-800/40 text-slate-300 hover:border-slate-600/40"
                  }`}
                >
                  <span
                    className={`mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px] ${
                      selected ? "border-blue-400 bg-blue-500 text-white" : "border-slate-600"
                    }`}
                  >
                    {selected ? "✓" : String.fromCharCode(65 + oi)}
                  </span>
                  {o.texto}
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex justify-between">
            <button
              type="button"
              disabled={currentIdx === 0}
              onClick={() => setCurrentIdx((i) => i - 1)}
              className="rounded-lg border border-slate-600/40 px-3 py-1.5 text-xs text-slate-400 disabled:opacity-30"
            >
              Anterior
            </button>
            {currentIdx < perguntas.length - 1 ? (
              <button
                type="button"
                onClick={() => setCurrentIdx((i) => i + 1)}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
              >
                Seguinte
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void submeterQuiz()}
                disabled={busy || respondidas < perguntas.length}
                className="rounded-xl bg-gradient-to-r from-green-600 to-teal-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                {busy ? "A submeter..." : "Submeter"}
              </button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
