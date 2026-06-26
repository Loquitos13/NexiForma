"use client";

import { ChevronDown } from "lucide-react";

export type MockupModulo = {
  id: string;
  titulo: string;
  tipo: string;
  ordem?: number;
  moduloUnidadeId?: string | null;
  urlOuRef?: string | null;
  conteudoHtml?: string | null;
  notaMinima?: number | null;
};

export type MockupUnidade = {
  id: string;
  titulo: string;
  ordem: number;
};

const TIPO_ICON: Record<string, string> = {
  VIDEO:
    "M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z",
  PDF: "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z",
  WEBINAR:
    "M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.121a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244",
  QUIZ: "M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z",
  TEXTO:
    "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z",
};

function ModuloIcon({ tipo, done }: { tipo: string; done?: boolean }) {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d={done ? "M4.5 12.75l6 6 9-13.5" : TIPO_ICON[tipo] ?? TIPO_ICON.TEXTO}
      />
    </svg>
  );
}

function actionButton(tipo: string) {
  if (tipo === "QUIZ") {
    return (
      <span className="px-2 py-1 rounded-md bg-purple-600 text-[9px] font-semibold text-white">Quiz</span>
    );
  }
  if (tipo === "VIDEO") {
    return (
      <span className="px-2 py-1 rounded-md bg-blue-600 text-[9px] font-semibold text-white">Ver</span>
    );
  }
  return (
    <span className="px-2 py-1 rounded-md border border-slate-600/40 text-[9px] font-semibold text-slate-300">
      Abrir
    </span>
  );
}

function ViewerMockup({
  modulo,
  onBack,
}: {
  modulo: MockupModulo;
  onBack: () => void;
}) {
  return (
    <div className="space-y-3 p-3">
      <button type="button" onClick={onBack} className="text-[9px] text-blue-400 hover:text-blue-300 inline-flex items-center gap-1">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Portal do formando
      </button>

      <div>
        <h2 className="text-sm font-bold text-slate-50 leading-tight">{modulo.titulo}</h2>
        <span className="inline-flex mt-1 px-1.5 py-0.5 rounded bg-slate-700/50 text-[8px] font-medium text-slate-400">
          {modulo.tipo}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
          <div className="h-full w-[35%] rounded-full bg-blue-500" />
        </div>
        <span className="text-[9px] text-slate-500 tabular-nums">35%</span>
      </div>

      <button type="button" className="w-full py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-teal-600 text-[9px] font-semibold text-white opacity-60 cursor-default">
        Conclusão automática
      </button>

      <div className="rounded-lg border border-slate-700/30 bg-slate-900/50 overflow-hidden min-h-[100px]">
        {modulo.tipo === "VIDEO" && modulo.urlOuRef ? (
          <div className="aspect-video bg-black flex items-center justify-center">
            <ModuloIcon tipo="VIDEO" />
            <span className="text-[8px] text-slate-500 ml-2">Vídeo</span>
          </div>
        ) : modulo.tipo === "PDF" && modulo.urlOuRef ? (
          <div className="h-24 bg-white flex items-center justify-center">
            <span className="text-[9px] text-slate-600">Documento PDF</span>
          </div>
        ) : modulo.tipo === "WEBINAR" && modulo.urlOuRef ? (
          <div className="aspect-video bg-black flex flex-col items-center justify-center gap-1">
            <ModuloIcon tipo="WEBINAR" />
            <span className="text-[8px] text-cyan-400">Webinar embebido</span>
          </div>
        ) : modulo.tipo === "TEXTO" && modulo.conteudoHtml ? (
          <div
            className="p-3 text-[9px] text-slate-300 leading-relaxed prose prose-invert prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: modulo.conteudoHtml }}
          />
        ) : modulo.tipo === "QUIZ" ? (
          <div className="p-4 text-center space-y-2">
            <p className="text-[10px] font-medium text-purple-300">Questionário</p>
            {modulo.notaMinima != null ? (
              <p className="text-[8px] text-slate-500">Nota mínima: {modulo.notaMinima}%</p>
            ) : null}
            <span className="inline-block px-3 py-1 rounded-md bg-purple-600 text-[9px] text-white">Iniciar</span>
          </div>
        ) : (
          <div className="p-6 text-center text-[9px] text-slate-500">Conteúdo por configurar</div>
        )}
      </div>
    </div>
  );
}

type Props = {
  cursoTitulo: string;
  acaoTitulo?: string;
  turmaNome?: string;
  unidades?: MockupUnidade[];
  modulos: MockupModulo[];
  highlightedModuloId?: string | null;
  viewerModulo?: MockupModulo | null;
  onModuloClick?: (id: string) => void;
  onOpenViewer?: (id: string) => void;
  onBackFromViewer?: () => void;
  className?: string;
};

function ConteudoRow({
  mod,
  highlighted,
  onModuloClick,
  onOpenViewer,
}: {
  mod: MockupModulo;
  highlighted: boolean;
  onModuloClick?: (id: string) => void;
  onOpenViewer?: (id: string) => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onModuloClick?.(mod.id)}
      onKeyDown={(e) => e.key === "Enter" && onModuloClick?.(mod.id)}
      className={`flex flex-wrap items-center justify-between gap-2 p-2 rounded-lg border transition-colors cursor-pointer ${
        highlighted
          ? "bg-blue-500/10 border-blue-500/30 ring-1 ring-blue-500/20"
          : "bg-slate-800/40 border-slate-700/20 hover:border-slate-600/40"
      }`}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-700/50 text-slate-400">
          <ModuloIcon tipo={mod.tipo} />
        </span>
        <div className="min-w-0">
          <p className="text-[9px] text-slate-200 font-medium truncate">{mod.titulo}</p>
          <span className="text-[8px] text-slate-500">{mod.tipo}</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <div className="w-12 h-1 rounded-full bg-slate-700 overflow-hidden">
          <div className="h-full w-0 rounded-full bg-blue-500" />
        </div>
        <span className="text-[8px] text-slate-500 w-6 text-right tabular-nums">0%</span>
        <button type="button" onClick={(e) => { e.stopPropagation(); onOpenViewer?.(mod.id); }}>
          {actionButton(mod.tipo)}
        </button>
      </div>
    </div>
  );
}

export function FormandoPortalMockup({
  cursoTitulo,
  acaoTitulo,
  turmaNome = "Turma A",
  unidades = [],
  modulos,
  highlightedModuloId,
  viewerModulo,
  onModuloClick,
  onOpenViewer,
  onBackFromViewer,
  className = "",
}: Props) {
  const acao = acaoTitulo ?? cursoTitulo;
  const total = modulos.length;
  const sortedUnidades = [...unidades].sort((a, b) => a.ordem - b.ordem);
  const orphan = modulos.filter((m) => !m.moduloUnidadeId);

  return (
    <div className={`flex flex-col h-full min-h-0 overflow-hidden bg-[#070b12] ${className}`}>
      <div className="shrink-0 flex items-center gap-2 px-2.5 py-2 bg-slate-800/90 border-b border-slate-700/50">
        <div className="flex gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500/80" />
          <span className="w-2 h-2 rounded-full bg-yellow-500/80" />
          <span className="w-2 h-2 rounded-full bg-green-500/80" />
        </div>
        <div className="flex-1 min-w-0 px-2 py-0.5 rounded-md bg-slate-900/80 border border-slate-700/40">
          <p className="text-[8px] text-slate-500 truncate text-center">
            {viewerModulo
              ? "nexiforma.pt/portal/formando/conteudo/…"
              : "nexiforma.pt/portal/formando"}
          </p>
        </div>
      </div>

      <header className="shrink-0 px-3 py-2 border-b border-slate-700/30 bg-slate-950/90">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-blue-600 to-teal-600 text-[9px] font-black text-white">
            N
          </span>
          <div>
            <p className="text-[10px] font-bold text-slate-100 leading-none">NexiForma</p>
            <p className="text-[8px] text-slate-500">Portal do formando</p>
          </div>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        {viewerModulo && onBackFromViewer ? (
          <ViewerMockup modulo={viewerModulo} onBack={onBackFromViewer} />
        ) : (
          <div className="p-3 space-y-3">
            <div>
              <h1 className="text-sm font-bold text-slate-50">Portal do Formando</h1>
              <p className="text-[9px] text-slate-500 mt-0.5 leading-snug">
                Acede às tuas sessões, conteúdos e quizzes.
              </p>
            </div>

            {total > 0 ? (
              <div className="rounded-xl bg-slate-900/50 border border-slate-700/30 p-2.5">
                <p className="text-[9px] font-semibold text-slate-300 mb-2">Progresso global</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full w-0 rounded-full bg-gradient-to-r from-blue-500 to-teal-500" />
                  </div>
                  <span className="text-[9px] font-bold text-slate-200 tabular-nums">0/{total}</span>
                </div>
              </div>
            ) : null}

            <div className="rounded-xl bg-slate-900/50 border border-slate-700/30 overflow-hidden">
              <div className="w-full px-3 py-2.5 flex items-center justify-between gap-2 border-b border-slate-700/20 bg-slate-800/20">
                <div className="min-w-0">
                  <h3 className="text-[10px] font-semibold text-slate-100 truncate">{acao}</h3>
                  <p className="text-[8px] text-slate-500">{turmaNome}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {total > 0 ? (
                    <span className="text-[8px] font-medium text-slate-400">0/{total} módulos</span>
                  ) : null}
                  <ChevronDown className="h-3.5 w-3.5 text-slate-500 rotate-180" />
                </div>
              </div>

              <div className="px-3 pb-3 pt-2 space-y-3">
                <div>
                  <h4 className="text-[8px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Sessões
                  </h4>
                  <div className="p-2 rounded-lg bg-slate-800/40 border border-slate-700/20 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-700/50 text-[9px] font-bold text-slate-300">
                        1
                      </span>
                      <div className="min-w-0">
                        <p className="text-[9px] text-slate-200 truncate">Seg, 15 set · 09:00–12:30</p>
                        <span className="text-[8px] text-slate-500">b-learning</span>
                      </div>
                    </div>
                    <span className="shrink-0 px-2 py-1 rounded-md bg-teal-600 text-[8px] font-semibold text-white">
                      Entrar
                    </span>
                  </div>
                </div>

                <div>
                  <h4 className="text-[8px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Conteúdos (0/{total})
                  </h4>
                  {modulos.length === 0 ? (
                    <p className="text-[9px] text-slate-600 py-4 text-center">Sem conteúdos publicados.</p>
                  ) : sortedUnidades.length > 0 ? (
                    <div className="space-y-3">
                      {sortedUnidades.map((u) => {
                        const items = modulos
                          .filter((m) => m.moduloUnidadeId === u.id)
                          .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
                        return (
                          <div key={u.id}>
                            <p className="text-[9px] font-semibold text-teal-400/90 mb-1.5 px-1 border-l-2 border-teal-500/50 pl-2">
                              {u.titulo}
                            </p>
                            {items.length === 0 ? (
                              <p className="text-[8px] text-slate-600 italic px-2 py-1">Sem conteúdos neste módulo</p>
                            ) : (
                              <div className="space-y-1.5">
                                {items.map((mod) => (
                                  <ConteudoRow
                                    key={mod.id}
                                    mod={mod}
                                    highlighted={highlightedModuloId === mod.id}
                                    onModuloClick={onModuloClick}
                                    onOpenViewer={onOpenViewer}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {orphan.length > 0 ? (
                        <div>
                          <p className="text-[9px] font-semibold text-slate-500 mb-1.5">Outros</p>
                          <div className="space-y-1.5">
                            {orphan.map((mod) => (
                              <ConteudoRow key={mod.id} mod={mod} highlighted={highlightedModuloId === mod.id}
                                onModuloClick={onModuloClick} onOpenViewer={onOpenViewer} />
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {[...modulos]
                        .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
                        .map((mod) => (
                        <ConteudoRow key={mod.id} mod={mod} highlighted={highlightedModuloId === mod.id}
                          onModuloClick={onModuloClick} onOpenViewer={onOpenViewer} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
