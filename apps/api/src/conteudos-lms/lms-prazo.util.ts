/** Timezone local da plataforma (sem timezone por tenant). */
export const LMS_PRAZO_TZ = "Europe/Lisbon";

/** YYYY-MM-DD no fuso indicado. */
export function ymdInTimeZone(date: Date, timeZone = LMS_PRAZO_TZ): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Normaliza Date (@db.Date) ou string para YYYY-MM-DD. */
export function prazoYmd(prazo: Date | string): string {
  if (typeof prazo === "string") return prazo.slice(0, 10);
  return prazo.toISOString().slice(0, 10);
}

/**
 * Limite atingido a partir das 00:00 locais do dia seguinte ao prazo.
 * Ex.: prazo 2026-08-23 → válido até 23:59 desse dia; bloqueado desde 2026-08-24 00:00.
 */
export function prazoConclusaoAtingido(
  prazo: Date | string,
  agora: Date = new Date(),
  timeZone = LMS_PRAZO_TZ,
): boolean {
  return ymdInTimeZone(agora, timeZone) > prazoYmd(prazo);
}
