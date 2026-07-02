/** Datas de calendário em fuso local (evita deslocamento UTC com toISOString). */

export function formatLocalDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function toDateKey(value: string): string {
  return value.includes("T") ? value.split("T")[0]! : value.slice(0, 10);
}

export function dayFromDateKey(key: string): number {
  return Number(key.slice(8, 10));
}

/** Data em DD/MM/YYYY (aceita ISO, YYYY-MM-DD ou Date). */
export function formatDatePt(value: string | Date | null | undefined): string {
  if (value == null || value === "") return "-";
  if (value instanceof Date) {
    const day = String(value.getDate()).padStart(2, "0");
    const month = String(value.getMonth() + 1).padStart(2, "0");
    return `${day}/${month}/${value.getFullYear()}`;
  }
  if (value.includes("T")) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return formatDatePt(parsed);
    }
  }
  const key = toDateKey(value);
  return `${key.slice(8, 10)}/${key.slice(5, 7)}/${key.slice(0, 4)}`;
}

/** Alias para chaves YYYY-MM-DD ou ISO. */
export function formatDateKeyPt(key: string): string {
  return formatDatePt(key);
}

/** Células do mês: null = vazio antes do dia 1; string = YYYY-MM-DD local. */
export function buildMonthGridCells(year: number, month: number): (string | null)[] {
  const firstWeekday = new Date(year, month, 1).getDay();
  const leadingBlanks = firstWeekday === 0 ? 6 : firstWeekday - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < leadingBlanks; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(formatLocalDateKey(new Date(year, month, d)));
  }
  return cells;
}

export function monthLoadRange(year: number, month: number): { inicio: string; fim: string } {
  return {
    inicio: formatLocalDateKey(new Date(year, month - 1, 1)),
    fim: formatLocalDateKey(new Date(year, month + 2, 0)),
  };
}

export function isDateKeyInRange(key: string, inicio: string, fim: string): boolean {
  return key >= inicio && key <= fim;
}
