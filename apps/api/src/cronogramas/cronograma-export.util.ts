/** Cores de fundo para formadores no cronograma DGERT (estilo documento oficial). */
export const CRONOGRAMA_FORMADOR_CORES = [
  "#b8d4f0",
  "#fff59d",
  "#a8e6a3",
  "#f8bbd0",
  "#ffcc80",
  "#d1c4e9",
  "#80deea",
  "#ffe082",
] as const;

export function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function horasEntre(inicio: string, fim: string): number {
  const [hi, mi] = inicio.split(":").map(Number);
  const [hf, mf] = fim.split(":").map(Number);
  const mins = hf * 60 + mf - (hi * 60 + mi);
  return Math.max(0, Math.round((mins / 60) * 10) / 10);
}

export function codigoModuloFallback(titulo: string): string {
  const words = titulo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "MOD";
  if (words.length === 1) return words[0]!.slice(0, 4).toUpperCase();
  return words
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 6);
}

export function toDateKey(value: Date | string): string {
  if (typeof value === "string") {
    return value.includes("T") ? value.split("T")[0]! : value.slice(0, 10);
  }
  return value.toISOString().slice(0, 10);
}

const MESES_PT = [
  "JANEIRO",
  "FEVEREIRO",
  "MARÇO",
  "ABRIL",
  "MAIO",
  "JUNHO",
  "JULHO",
  "AGOSTO",
  "SETEMBRO",
  "OUTUBRO",
  "NOVEMBRO",
  "DEZEMBRO",
] as const;

export function mesLabelPt(year: number, monthIndex: number): string {
  return `${MESES_PT[monthIndex]} ${year}`;
}

export function diasNoMes(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function diaSemana(year: number, monthIndex: number, day: number): number {
  return new Date(year, monthIndex, day).getDay();
}

export function atribuirCoresFormadores(ids: string[]): Map<string, string> {
  const sorted = [...new Set(ids.filter(Boolean))].sort();
  const map = new Map<string, string>();
  sorted.forEach((id, i) => {
    map.set(id, CRONOGRAMA_FORMADOR_CORES[i % CRONOGRAMA_FORMADOR_CORES.length]!);
  });
  return map;
}

export type CelulaCronograma = {
  tipo: "vazio" | "invalido" | "fds" | "sessao";
  label?: string;
  fds?: "S" | "D";
  bg?: string;
};

export function construirGrelhaMes(
  year: number,
  monthIndex: number,
  sessoesPorDia: Map<string, Array<{ label: string; bg: string }>>,
): CelulaCronograma[] {
  const totalDias = diasNoMes(year, monthIndex);
  const cells: CelulaCronograma[] = [];

  for (let day = 1; day <= 31; day++) {
    if (day > totalDias) {
      cells.push({ tipo: "invalido" });
      continue;
    }
    const dow = diaSemana(year, monthIndex, day);
    const key = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const sessoes = sessoesPorDia.get(key);
    if (sessoes?.length) {
      const bg = sessoes.length === 1 ? sessoes[0]!.bg : sessoes[0]!.bg;
      cells.push({
        tipo: "sessao",
        label: sessoes.map((s) => s.label).join("+"),
        bg,
      });
      continue;
    }
    if (dow === 0) {
      cells.push({ tipo: "fds", fds: "D" });
    } else if (dow === 6) {
      cells.push({ tipo: "fds", fds: "S" });
    } else {
      cells.push({ tipo: "vazio" });
    }
  }
  return cells;
}

export function iterarMeses(inicio: string, fim: string): Array<{ year: number; month: number }> {
  const start = new Date(inicio);
  const end = new Date(fim);
  const out: Array<{ year: number; month: number }> = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const limit = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor <= limit) {
    out.push({ year: cursor.getFullYear(), month: cursor.getMonth() });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return out;
}
