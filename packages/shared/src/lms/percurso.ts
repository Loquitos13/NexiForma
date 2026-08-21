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
  prerequisitoModuloId?: string | null;
};

export type ModuloPercurso = {
  id: string;
  ordem: number;
  notaMinima?: number | null;
  /** Se true, o módulo entra no fluxo de libertação em Tarefas. */
  lockManual?: boolean | null;
  prerequisitoUnidadeId?: string | null;
};

export type PercursoDesbloqueioOpts = {
  /** IDs de ModuloUnidade já desbloqueados manualmente para a matrícula. */
  desbloqueiosManuais?: ReadonlySet<string>;
  /** Progressão sequencial entre módulos (curso.lmsProgressaoSequencial). */
  progressaoSequencial?: boolean;
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

/** Pré-requisito efectivo: em progressão sequencial usa sempre o módulo anterior na ordem. */
export function prerequisitoUnidadeEfectivo(
  unidades: ModuloPercurso[],
  unidadeId: string,
  progressaoSequencial?: boolean,
): string | null {
  const sorted = unidadesOrdenadas(unidades);
  const idx = sorted.findIndex((u) => u.id === unidadeId);
  if (idx <= 0) return null;

  if (progressaoSequencial !== false) {
    return sorted[idx - 1]!.id;
  }

  return sorted[idx]!.prerequisitoUnidadeId ?? null;
}

/** Módulo concluído: sem conteúdos publicados ou todas as tarefas feitas com nota mínima. */
export function unidadeConcluida(
  unidade: ModuloPercurso,
  tarefas: TarefaPercurso[],
  progressos: ProgressoPercurso[],
): boolean {
  const items = tarefas.filter((t) => t.moduloUnidadeId === unidade.id && t.publicado !== false);
  if (items.length === 0) return true;

  for (const t of items) {
    const prog = progressos.find((p) => p.moduloId === t.id);
    if (!prog?.concluidoEm) return false;
  }

  const pont = pontuacaoModulo(tarefas, progressos, unidade.id);
  const minima = notaMinimaParaDesbloquearProximo(unidade);
  if (pont == null || pont < minima) return false;

  return true;
}

/**
 * Controlo de acesso ao módulo (secção):
 * - Exige libertação explícita em Tarefas (MatriculaUnidadeDesbloqueio)
 * - Com progressão sequencial, exige conclusão do módulo anterior
 */
export function moduloDesbloqueado(
  unidades: ModuloPercurso[],
  tarefas: TarefaPercurso[],
  progressos: ProgressoPercurso[],
  unidadeId: string,
  opts?: PercursoDesbloqueioOpts,
): boolean {
  const actual = unidades.find((u) => u.id === unidadeId);
  if (!actual) return false;

  const libertadoExplicitamente = opts?.desbloqueiosManuais?.has(unidadeId) === true;
  if (!libertadoExplicitamente) {
    return false;
  }

  const prereqId = prerequisitoUnidadeEfectivo(unidades, unidadeId, opts?.progressaoSequencial);
  if (!prereqId) return true;

  const prereq = unidades.find((u) => u.id === prereqId);
  if (!prereq) return true;

  return unidadeConcluida(prereq, tarefas, progressos);
}

/** Pré-requisito concluído (progresso + nota mínima quando aplicável). */
function prerequisitoConcluido(
  tarefas: TarefaPercurso[],
  progressos: ProgressoPercurso[],
  prerequisitoId: string,
): boolean {
  const prereq = tarefas.find((t) => t.id === prerequisitoId);
  if (!prereq) return true;

  const prog = progressos.find((p) => p.moduloId === prerequisitoId);
  if (!prog?.concluidoEm) return false;

  if (prereq.notaMinima != null) {
    const pont = pontuacaoTarefa(prog, prereq);
    if (pont == null || pont < prereq.notaMinima) return false;
  }

  return true;
}

/** Tarefa acessível se o módulo (secção) estiver desbloqueado e o pré-requisito cumprido. */
export function tarefaDesbloqueada(
  unidades: ModuloPercurso[],
  tarefas: TarefaPercurso[],
  progressos: ProgressoPercurso[],
  tarefaId: string,
  opts?: PercursoDesbloqueioOpts,
): boolean {
  const tarefa = tarefas.find((t) => t.id === tarefaId);
  if (!tarefa || tarefa.publicado === false) return false;

  if (tarefa.moduloUnidadeId) {
    if (!moduloDesbloqueado(unidades, tarefas, progressos, tarefa.moduloUnidadeId, opts)) {
      return false;
    }
  }

  if (tarefa.prerequisitoModuloId) {
    if (!prerequisitoConcluido(tarefas, progressos, tarefa.prerequisitoModuloId)) {
      return false;
    }
  }

  return true;
}

export function notaMinimaParaDesbloquearProximo(unidade: ModuloPercurso): number {
  return unidade.notaMinima ?? DEFAULT_NOTA_MINIMA_MODULO;
}

/** Tarefa concluída para UI/progresso (concluidoEm ou percentual completo). */
export type TarefaProgressoUi = {
  concluido: boolean;
  percentual: number;
};

export function tarefaConcluidaEfectiva(t: TarefaProgressoUi): boolean {
  return t.concluido || t.percentual >= 100;
}

/**
 * Percentagem sobre todas as tarefas publicadas (inclui bloqueadas no total).
 * 2 concluídas em 4 (2 bloqueadas) → 50%.
 */
export function percentualProgressoPercurso(
  tarefas: TarefaProgressoUi[],
  opts?: { decimals?: 0 | 1 },
): number {
  const total = tarefas.length;
  if (total === 0) return 0;
  const done = tarefas.filter(tarefaConcluidaEfectiva).length;
  const raw = (done / total) * 100;
  return opts?.decimals === 0 ? Math.round(raw) : Math.round(raw * 10) / 10;
}
