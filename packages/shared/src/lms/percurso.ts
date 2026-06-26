export type ProgressoPercurso = {
  moduloId: string;
  percentual: number;
  pontuacao: number | null;
  concluidoEm?: string | Date | null;
};

export type TarefaPercurso = {
  id: string;
  moduloUnidadeId: string | null;
  ordem: number;
  publicado?: boolean;
  notaMinima?: number | null;
};

export type ModuloPercurso = {
  id: string;
  ordem: number;
  notaMinima?: number | null;
};

const DEFAULT_NOTA_MINIMA_MODULO = 60;

/** Pontuação efectiva de uma tarefa (0–100). */
export function pontuacaoTarefa(
  progresso: ProgressoPercurso | undefined,
  tarefa?: Pick<TarefaPercurso, "notaMinima">,
): number | null {
  if (!progresso) return null;
  if (progresso.pontuacao != null) return progresso.pontuacao;
  if (progresso.percentual >= 100) return 100;
  if (progresso.percentual > 0) return progresso.percentual;
  return null;
}

/** Média das pontuações das tarefas do módulo (tarefas sem nota contam como 0). */
export function pontuacaoModulo(
  tarefas: TarefaPercurso[],
  progressos: ProgressoPercurso[],
  unidadeId: string,
): number | null {
  const items = tarefas
    .filter((t) => t.moduloUnidadeId === unidadeId && t.publicado !== false)
    .sort((a, b) => a.ordem - b.ordem);
  if (items.length === 0) return null;

  let sum = 0;
  for (const t of items) {
    const p = progressos.find((pr) => pr.moduloId === t.id);
    sum += pontuacaoTarefa(p, t) ?? 0;
  }
  return Math.round(sum / items.length);
}

export function unidadesOrdenadas<T extends ModuloPercurso>(unidades: T[]): T[] {
  return [...unidades].sort((a, b) => a.ordem - b.ordem || a.id.localeCompare(b.id));
}

export function tarefasOrdenadas<T extends TarefaPercurso>(tarefas: T[], unidadeId?: string | null): T[] {
  return [...tarefas]
    .filter((t) => (unidadeId === undefined ? true : t.moduloUnidadeId === unidadeId))
    .filter((t) => t.publicado !== false)
    .sort((a, b) => a.ordem - b.ordem || a.id.localeCompare(b.id));
}

/** O módulo (secção) está desbloqueado se o anterior atingiu a nota mínima exigida. */
export function moduloDesbloqueado(
  unidades: ModuloPercurso[],
  tarefas: TarefaPercurso[],
  progressos: ProgressoPercurso[],
  unidadeId: string,
): boolean {
  const sorted = unidadesOrdenadas(unidades);
  const idx = sorted.findIndex((u) => u.id === unidadeId);
  if (idx <= 0) return true;

  const anterior = sorted[idx - 1];
  const tarefasAnterior = tarefasOrdenadas(tarefas, anterior.id);
  if (tarefasAnterior.length === 0) return true;

  const scoreAnterior = pontuacaoModulo(tarefas, progressos, anterior.id);
  const minima = anterior.notaMinima ?? DEFAULT_NOTA_MINIMA_MODULO;
  if (scoreAnterior === null) return false;
  return scoreAnterior >= minima;
}

/** Tarefa acessível se o módulo (secção) estiver desbloqueado. */
export function tarefaDesbloqueada(
  unidades: ModuloPercurso[],
  tarefas: TarefaPercurso[],
  progressos: ProgressoPercurso[],
  tarefaId: string,
): boolean {
  const tarefa = tarefas.find((t) => t.id === tarefaId);
  if (!tarefa || tarefa.publicado === false) return false;
  if (!tarefa.moduloUnidadeId) return true;
  return moduloDesbloqueado(unidades, tarefas, progressos, tarefa.moduloUnidadeId);
}

export function notaMinimaParaDesbloquearProximo(unidade: ModuloPercurso): number {
  return unidade.notaMinima ?? DEFAULT_NOTA_MINIMA_MODULO;
}
