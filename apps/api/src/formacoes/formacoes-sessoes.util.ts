/** Gera datas de sessão entre dataInicio e dataFim. */
export function gerarDatasSessoes(input: {
  dataInicio: Date;
  dataFim: Date;
  repete: boolean;
  diasRepete?: number[];
}): Date[] {
  const inicio = stripTime(input.dataInicio);
  const fim = stripTime(input.dataFim);
  if (fim.getTime() < inicio.getTime()) {
    return [];
  }

  if (!input.repete || !input.diasRepete?.length) {
    return [inicio];
  }

  const dias = new Set(
    input.diasRepete.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6),
  );
  const out: Date[] = [];
  const cur = new Date(inicio);
  while (cur.getTime() <= fim.getTime()) {
    if (dias.has(cur.getDay())) {
      out.push(new Date(cur));
    }
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

function stripTime(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function parsePgDate(raw: string, field: string): Date {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Data inválida (${field}).`);
  }
  return stripTime(d);
}

export function validarHorario(hhmm: string, field: string): void {
  if (!/^\d{2}:\d{2}$/.test(hhmm)) {
    throw new Error(`Horário inválido (${field}). Use HH:mm.`);
  }
  const [h, m] = hhmm.split(":").map(Number);
  if (h > 23 || m > 59) {
    throw new Error(`Horário inválido (${field}).`);
  }
}

export type AgendaTemplate = {
  dataInicio: string;
  dataFim: string;
  horaInicio: string;
  horaFim: string;
  repete: boolean;
  diasRepete?: number[];
  local?: string;
  inscricoes: "ABERTAS" | "FECHADAS";
};
