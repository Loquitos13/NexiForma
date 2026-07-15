export type TarefaPercurso = {
  id: string;
  titulo: string;
  tipo: string;
  ordem: number;
  moduloUnidadeId?: string | null;
  duracaoMin: number | null;
  notaMinima?: number | null;
  urlOuRef?: string | null;
  conteudoHtml?: string | null;
  metadata?: Record<string, unknown> | null;
  pontuacao: number | null;
  percentual: number;
  concluido: boolean;
  desbloqueado: boolean;
};

export type UnidadePercurso = {
  id: string;
  titulo: string;
  ordem: number;
  notaMinima: number | null;
  pontuacao: number | null;
  desbloqueado: boolean;
  notaMinimaAnterior: number | null;
  tituloModuloAnterior: string | null;
};

export type PercursoFormando = {
  unidades: UnidadePercurso[];
  tarefas: TarefaPercurso[];
  prazoLms?: {
    limite: string;
    diasRestantes: number | null;
    percentualConclusao: number;
    emAtraso: boolean;
    cumpridoNoPrazo: boolean;
    completo: boolean;
  } | null;
};

export function isFlashcardTarefa(t: TarefaPercurso): boolean {
  if (t.metadata && typeof t.metadata === "object" && t.metadata.flashcard === true) return true;
  if (t.metadata && typeof t.metadata === "object" && (t.metadata.frente || t.metadata.verso)) return true;
  return false;
}

export const UNIDADE_FLAT_ID = "__flat__";

export function tarefasDaUnidade(tarefas: TarefaPercurso[], unidadeId: string): TarefaPercurso[] {
  const items =
    unidadeId === UNIDADE_FLAT_ID
      ? tarefas.filter((t) => !t.moduloUnidadeId)
      : tarefas.filter((t) => t.moduloUnidadeId === unidadeId);
  return [...items].sort((a, b) => a.ordem - b.ordem);
}
