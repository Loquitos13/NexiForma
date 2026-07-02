export type PeriodoJanela = {
  inicio: Date;
  fim: Date;
};

export type ParPeriodos = {
  actual: PeriodoJanela;
  mesAnterior: PeriodoJanela;
  trimestreActual: PeriodoJanela;
  trimestreAnterior: PeriodoJanela;
  semestreActual: PeriodoJanela;
  semestreAnterior: PeriodoJanela;
  anoActual: PeriodoJanela;
  anoAnterior: PeriodoJanela;
};

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function startOfMonth(y: number, m: number): Date {
  return new Date(y, m, 1, 0, 0, 0, 0);
}

function endOfMonth(y: number, m: number): Date {
  return endOfDay(new Date(y, m + 1, 0));
}

function quarterOfMonth(m: number): number {
  return Math.floor(m / 3);
}

function quarterBounds(y: number, q: number): PeriodoJanela {
  const startM = q * 3;
  return {
    inicio: startOfMonth(y, startM),
    fim: endOfMonth(y, startM + 2),
  };
}

function semesterBounds(y: number, half: 0 | 1): PeriodoJanela {
  if (half === 0) {
    return { inicio: startOfMonth(y, 0), fim: endOfMonth(y, 5) };
  }
  return { inicio: startOfMonth(y, 6), fim: endOfMonth(y, 11) };
}

/** Períodos alinhados para comparações mês / trimestre / semestre / ano. */
export function buildPeriodPairs(ref = new Date()): ParPeriodos {
  const y = ref.getFullYear();
  const m = ref.getMonth();
  const q = quarterOfMonth(m);
  const half: 0 | 1 = m < 6 ? 0 : 1;

  const actual: PeriodoJanela = {
    inicio: startOfMonth(y, m),
    fim: endOfDay(ref),
  };

  const prevMonthDate = new Date(y, m - 1, 1);
  const mesAnterior: PeriodoJanela = {
    inicio: startOfMonth(prevMonthDate.getFullYear(), prevMonthDate.getMonth()),
    fim: endOfMonth(prevMonthDate.getFullYear(), prevMonthDate.getMonth()),
  };

  const trimestreActual = quarterBounds(y, q);
  const prevQ = q === 0 ? { y: y - 1, q: 3 } : { y, q: q - 1 };
  const trimestreAnterior = quarterBounds(prevQ.y, prevQ.q);

  const semestreActual = semesterBounds(y, half);
  const prevHalf: { y: number; h: 0 | 1 } =
    half === 0 ? { y: y - 1, h: 1 } : { y, h: 0 };
  const semestreAnterior = semesterBounds(prevHalf.y, prevHalf.h);

  const anoActual: PeriodoJanela = {
    inicio: startOfMonth(y, 0),
    fim: endOfDay(ref),
  };
  const anoAnterior: PeriodoJanela = {
    inicio: startOfMonth(y - 1, 0),
    fim: endOfMonth(y - 1, 11),
  };

  return {
    actual,
    mesAnterior,
    trimestreActual: { inicio: trimestreActual.inicio, fim: endOfDay(ref) },
    trimestreAnterior,
    semestreActual: { inicio: semestreActual.inicio, fim: endOfDay(ref) },
    semestreAnterior,
    anoActual,
    anoAnterior,
  };
}

export function mesKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function mesLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const names = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${names[(m ?? 1) - 1]} ${y}`;
}

export function last12MesesKeys(ref = new Date()): string[] {
  const keys: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
    keys.push(mesKey(d));
  }
  return keys;
}

export function buildVariacao(valor: number, referencia: number) {
  const deltaAbsoluto = valor - referencia;
  const deltaPct =
    referencia !== 0 ? Math.round((deltaAbsoluto / referencia) * 1000) / 10 : valor !== 0 ? 100 : null;
  return { valor, referencia, deltaAbsoluto, deltaPct };
}

export function buildComparacoes(
  actual: number,
  mesAnt: number,
  trimAnt: number,
  semAnt: number,
  anoAnt: number,
) {
  return {
    mesAnterior: buildVariacao(actual, mesAnt),
    trimestreAnterior: buildVariacao(actual, trimAnt),
    semestreAnterior: buildVariacao(actual, semAnt),
    anoAnterior: buildVariacao(actual, anoAnt),
  };
}

export function inPeriod(date: Date | null | undefined, p: PeriodoJanela): boolean {
  if (!date) return false;
  const t = date.getTime();
  return t >= p.inicio.getTime() && t <= p.fim.getTime();
}
