"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
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

export default function QuizPlayerPage() {
  const params = useParams<{ moduloId: string }>();
  const moduloId = params.moduloId;
  const search = useSearchParams();
  const matriculaId = search.get("matriculaId") ?? "";

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
      bffFetch(`/api/v1/quizzes/tentativas?matriculaId=${encodeURIComponent(matriculaId)}&moduloId=${moduloId}`, { headers: { accept: "application/json" } }),
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

  useEffect(() => { void load(); return () => { if (timerRef.current) clearInterval(timerRef.current); }; }, [load]);

  // Timer
  useEffect(() => {
    if (tempoRestante === null || resultado || perguntas.length === 0) return;
    if (tempoRestante <= 0) {
      void submeterQuiz();
      return;
    }
    timerRef.current = setInterval(() => {
      setTempoRestante((t) => (t !== null && t > 0 ? t - 1 : 0));
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [tempoRestante, resultado]);

  async function submeterQuiz(e?: FormEvent) {
    if (e) e.preventDefault();
    if (!matriculaId) { setError("matriculaId em falta na URL."); return; }
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
      void load();
    }
    setBusy(false);
  }

  function responder(perguntaId: string, opcaoId: string) {
    setRespostas((r) => ({ ...r, [perguntaId]: opcaoId }));
    if (currentIdx < perguntas.length - 1) {
      setTimeout(() => setCurrentIdx((i) => i + 1), 300);
    }
  }

  const fmtTempo = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const p = perguntas[currentIdx];

  function reiniciarQuiz() {
    setResultado(null);
    setRespostas({});
    setCurrentIdx(0);
    setTempoRestante(perguntas.length * 60);
    setError(null);
  }

  const aprendizagemHref = matriculaId
    ? `/portal/formando/aprendizagem/${matriculaId}`
    : "/portal/formando";

  return (
    <div className="max-w-2xl mx-auto px-5 py-8 space-y-6">
      <Link href={aprendizagemHref} className="text-sm text-blue-400 hover:text-blue-300 transition-colors inline-flex items-center gap-1">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Portal do formando
      </Link>

      {error ? (
        <div className="flex items-start gap-2.5 rounded-xl bg-red-950/40 border border-red-500/25 px-4 py-3">
          <p className="text-sm text-red-300">{error}</p>
        </div>
      ) : null}

      {/* Result screen */}
      {resultado ? (
        <div className="space-y-5">
          <div className={`rounded-2xl p-8 text-center ${resultado.aprovado ? "bg-teal-500/10 border border-teal-500/20" : "bg-red-500/5 border border-red-500/20"}`}>
            <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full mb-4 ${resultado.aprovado ? "bg-teal-500/20" : "bg-red-500/20"}`}>
              {resultado.aprovado ? (
                <svg className="w-10 h-10 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              ) : (
                <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
            <h2 className={`text-2xl font-bold mb-1 ${resultado.aprovado ? "text-teal-400" : "text-red-400"}`}>
              {resultado.aprovado ? "Aprovado!" : "Reprovado"}
            </h2>
            <p className="text-4xl font-black text-slate-100 mb-1">{resultado.pontuacao}%</p>
            <p className="text-sm text-slate-400 mb-3">
              Nota mínima: {resultado.notaMinima}%
            </p>
            <p className="text-sm text-slate-400">
              {resultado.aprovado
                ? "Quiz concluído - o progresso foi registado automaticamente."
                : `Não atingiste a nota mínima. Revê as respostas abaixo e repete o quiz.`}
            </p>
          </div>

          <div className="rounded-2xl bg-slate-900/50 border border-slate-700/30 p-5 space-y-3">
            <h3 className="text-sm font-semibold text-slate-300">Revisão das respostas</h3>
            <p className="text-xs text-slate-500">Indicamos se acertaste ou falhaste, sem revelar a opção correcta.</p>
            {resultado.feedback.map((f, idx) => {
              const pergunta = perguntas.find((p) => p.id === f.perguntaId);
              const opcao = pergunta?.opcoes.find((o) => o.id === f.opcaoEscolhidaId);
              return (
                <div
                  key={f.perguntaId}
                  className={`rounded-xl border px-4 py-3 ${
                    f.correto ? "border-teal-500/30 bg-teal-500/5" : "border-red-500/30 bg-red-500/5"
                  }`}
                >
                  <p className="text-sm font-medium text-slate-200 mb-1">
                    {idx + 1}. {f.enunciado}
                  </p>
                  <p className={`text-xs font-semibold ${f.correto ? "text-teal-400" : "text-red-400"}`}>
                    {f.correto ? "Resposta correcta" : "Resposta incorrecta"}
                  </p>
                  {opcao ? (
                    <p className="text-xs text-slate-400 mt-1">Escolheste: {opcao.texto}</p>
                  ) : (
                    <p className="text-xs text-slate-500 mt-1">Sem resposta</p>
                  )}
                </div>
              );
            })}
          </div>

          {tentativas.length > 1 ? (
            <div className="rounded-2xl bg-slate-900/50 border border-slate-700/30 p-5">
              <h3 className="text-sm font-semibold text-slate-300 mb-3">Historico de tentativas</h3>
              <div className="space-y-2">
                {tentativas.map((t, i) => (
                  <div key={t.id} className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">
                      Tentativa {tentativas.length - i} · {new Date(t.createdAt).toLocaleString("pt-PT")}
                    </span>
                    <span className={`font-semibold ${t.aprovado ? "text-teal-400" : "text-red-400"}`}>
                      {t.pontuacao}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex gap-3">
            <Link
              href={aprendizagemHref}
              className="flex-1 text-center px-4 py-2.5 rounded-xl border border-slate-600/40 text-sm font-medium text-slate-300 hover:bg-slate-800/40 transition-colors"
            >
              {resultado.aprovado ? "Voltar à aprendizagem" : "Sair (tentar mais tarde)"}
            </Link>
            {!resultado.aprovado ? (
              <button
                type="button"
                onClick={reiniciarQuiz}
                className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-sm font-medium text-white transition-colors"
              >
                Repetir quiz
              </button>
            ) : null}
          </div>
        </div>
      ) : perguntas.length === 0 ? (
        <div className="text-center py-12">
          <svg className="w-12 h-12 text-slate-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
          </svg>
          <p className="text-slate-500 text-sm">Sem perguntas configuradas.</p>
        </div>
      ) : (
        <>
          {/* Quiz header */}
          <div className="rounded-2xl bg-slate-900/50 border border-slate-700/30 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-100">
                  Pergunta {currentIdx + 1} de {perguntas.length}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {respondidas} de {perguntas.length} respondidas · {totalPontos} pts total
                </p>
              </div>
              {tempoRestante !== null ? (
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-mono font-bold ${
                  tempoRestante < 60 ? "bg-red-500/10 text-red-400" : "bg-slate-800 text-slate-300"
                }`}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {fmtTempo(tempoRestante)}
                </span>
              ) : null}
            </div>

            {/* Progress */}
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div className="h-full rounded-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${(respondidas / perguntas.length) * 100}%` }} />
              </div>
            </div>

            {/* Question dots */}
            <div className="flex gap-1.5 mt-3 flex-wrap">
              {perguntas.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentIdx(idx)}
                  className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors ${
                    idx === currentIdx
                      ? "bg-blue-600 text-white"
                      : respostas[perguntas[idx].id]
                        ? "bg-blue-500/20 text-blue-300"
                        : "bg-slate-800 text-slate-500 hover:bg-slate-700"
                  }`}
                >
                  {idx + 1}
                </button>
              ))}
            </div>
          </div>

          {/* Current question */}
          {p ? (
            <div className="rounded-2xl bg-slate-900/50 border border-slate-700/30 p-6">
              <p className="text-base font-semibold text-slate-100 mb-4">
                {currentIdx + 1}. {p.enunciado}
              </p>

              <div className="space-y-2.5">
                {p.opcoes.map((o) => {
                  const selected = respostas[p.id] === o.id;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => responder(p.id, o.id)}
                      className={`w-full text-left px-4 py-3 rounded-xl border transition-all text-sm ${
                        selected
                          ? "bg-blue-600/20 border-blue-500/40 text-blue-200"
                          : "bg-slate-800/40 border-slate-700/30 text-slate-300 hover:border-slate-600/40 hover:bg-slate-800/60"
                      }`}
                    >
                      <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full border text-xs mr-3 ${
                        selected ? "border-blue-400 bg-blue-500 text-white" : "border-slate-600"
                      }`}>
                        {selected ? "✓" : String.fromCharCode(65 + p.opcoes.indexOf(o))}
                      </span>
                      {o.texto}
                    </button>
                  );
                })}
              </div>

              {/* Nav buttons */}
              <div className="flex items-center justify-between mt-5">
                <button
                  type="button"
                  disabled={currentIdx === 0}
                  onClick={() => setCurrentIdx((i) => i - 1)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-600/40 text-sm text-slate-400 hover:bg-slate-800/40 transition-colors disabled:opacity-30"
                >
                  Anterior
                </button>

                {currentIdx < perguntas.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentIdx((i) => i + 1)}
                    className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium text-white transition-colors"
                  >
                    Seguinte
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void submeterQuiz()}
                    disabled={busy || respondidas < perguntas.length}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-green-600 to-teal-600 text-white font-semibold text-sm hover:shadow-lg disabled:opacity-50 transition-all"
                  >
                    {busy ? "A submeter..." : "Submeter quiz"}
                  </button>
                )}
              </div>
            </div>
          ) : null}

          {/* Previous attempts */}
          {tentativas.length > 0 && !resultado ? (
            <div className="rounded-2xl bg-slate-900/30 border border-slate-700/20 p-4">
              <p className="text-xs text-slate-500">
                {tentativas.length} tentativa{tentativas.length > 1 ? "s" : ""} anterior{tentativas.length > 1 ? "es" : ""}:{" "}
                {tentativas.map((t, i) => (
                  <span key={t.id} className={t.aprovado ? "text-teal-400" : "text-red-400"}>
                    {t.pontuacao}%{i < tentativas.length - 1 ? ", " : ""}
                  </span>
                ))}
              </p>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
