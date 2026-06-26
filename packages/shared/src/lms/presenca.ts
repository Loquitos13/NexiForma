export type LmsEventoPresenca = {
  evento: string;
  ocorridoEm: Date | string;
  duracaoSegundos?: number | null;
};

export type EstadoPresencaLms = {
  emSessao: boolean;
  joinDesde: string | null;
  /** Soma dos intervalos join→leave já fechados. */
  segundosFechados: number;
  /** segundosFechados + intervalo actual (se em sessão). */
  segundosTotais: number;
  /** Apenas o intervalo join actual (0 se fora de sessão). */
  segundosIntervaloAtual: number;
};

function eventosOrdenados(eventos: LmsEventoPresenca[]): LmsEventoPresenca[] {
  return [...eventos].sort(
    (a, b) => new Date(a.ocorridoEm).getTime() - new Date(b.ocorridoEm).getTime(),
  );
}

/** Timestamp ISO do último join ainda sem leave, ou null. */
export function ultimoJoinAberto(eventos: LmsEventoPresenca[]): string | null {
  let joinIso: string | null = null;
  for (const ev of eventosOrdenados(eventos)) {
    const kind = ev.evento.toLowerCase();
    if (kind === "heartbeat") continue;
    if (kind === "join") {
      joinIso = new Date(ev.ocorridoEm).toISOString();
    } else if (kind === "leave") {
      joinIso = null;
    }
  }
  return joinIso;
}

/** Só intervalos join→leave já fechados (ignora join aberto). */
export function calcularSegundosFechados(eventos: LmsEventoPresenca[]): number {
  const sorted = eventosOrdenados(eventos);
  let total = 0;
  let joinAt: number | null = null;

  for (const ev of sorted) {
    const kind = ev.evento.toLowerCase();
    if (kind === "heartbeat") continue;
    const t = new Date(ev.ocorridoEm).getTime();
    if (kind === "join") {
      if (joinAt === null) joinAt = t;
    } else if (kind === "leave" && joinAt !== null) {
      const secs =
        ev.duracaoSegundos != null && ev.duracaoSegundos > 0
          ? ev.duracaoSegundos
          : Math.max(0, Math.round((t - joinAt) / 1000));
      total += secs;
      joinAt = null;
    }
  }

  return total;
}

/** Formato HH:MM:SS (suporta durações > 24h). */
export function formatarDuracaoHhMmSs(totalSegundos: number): string {
  const s = Math.max(0, Math.floor(totalSegundos));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, "0")).join(":");
}

/** Estado derivado dos eventos - usar `ate` ou relógio cliente para tempo ao vivo. */
export function resolverEstadoPresenca(
  eventos: LmsEventoPresenca[],
  ate: Date = new Date(),
): EstadoPresencaLms {
  const joinDesde = ultimoJoinAberto(eventos);
  const segundosFechados = calcularSegundosFechados(eventos);
  const segundosIntervaloAtual = joinDesde
    ? Math.max(0, Math.round((ate.getTime() - new Date(joinDesde).getTime()) / 1000))
    : 0;

  return {
    emSessao: joinDesde != null,
    joinDesde,
    segundosFechados,
    segundosTotais: segundosFechados + segundosIntervaloAtual,
    segundosIntervaloAtual,
  };
}

/** Segundos desde o último join ainda aberto (sem leave posterior). */
export function segundosDesdeUltimoJoin(
  eventos: LmsEventoPresenca[],
  ate: Date,
): number | null {
  const sorted = [...eventos].sort(
    (a, b) => new Date(a.ocorridoEm).getTime() - new Date(b.ocorridoEm).getTime(),
  );

  let joinAt: number | null = null;
  for (const ev of sorted) {
    const kind = ev.evento.toLowerCase();
    if (kind === "heartbeat") continue;
    const t = new Date(ev.ocorridoEm).getTime();
    if (kind === "join") {
      joinAt = t;
    } else if (kind === "leave") {
      joinAt = null;
    }
  }

  if (joinAt === null) return null;
  return Math.max(0, Math.round((ate.getTime() - joinAt) / 1000));
}

/**
 * Soma intervalos [join → leave] por ordem cronológica.
 * Joins duplicados ignoram-se até haver leave; heartbeats legados ignoram-se.
 */
export function calcularSegundosPresencaJoinLeave(
  eventos: LmsEventoPresenca[],
  opts?: { ate?: Date; sessaoFim?: Date },
): number {
  const sorted = [...eventos].sort(
    (a, b) => new Date(a.ocorridoEm).getTime() - new Date(b.ocorridoEm).getTime(),
  );

  let total = 0;
  let joinAt: number | null = null;
  const cap = opts?.ate?.getTime() ?? Date.now();

  for (const ev of sorted) {
    const kind = ev.evento.toLowerCase();
    if (kind === "heartbeat") continue;

    const t = new Date(ev.ocorridoEm).getTime();
    if (kind === "join") {
      if (joinAt === null) joinAt = t;
    } else if (kind === "leave") {
      if (joinAt !== null) {
        const secs =
          ev.duracaoSegundos != null && ev.duracaoSegundos > 0
            ? ev.duracaoSegundos
            : Math.max(0, Math.round((t - joinAt) / 1000));
        total += secs;
        joinAt = null;
      }
    }
  }

  if (joinAt !== null) {
    const endAt = opts?.sessaoFim
      ? Math.min(cap, opts.sessaoFim.getTime())
      : cap;
    total += Math.max(0, Math.round((endAt - joinAt) / 1000));
  }

  return total;
}
