import { safeFetch } from "../common/safe-fetch.util";

export type FeriadoNacional = {
  date: string; // YYYY-MM-DD
  localName: string;
  name: string;
};

/** Fallback PT se a API externa falhar. */
const FALLBACK_PT: Record<number, FeriadoNacional[]> = {
  2025: [
    { date: "2025-01-01", localName: "Ano Novo", name: "New Year's Day" },
    { date: "2025-04-18", localName: "Sexta-feira Santa", name: "Good Friday" },
    { date: "2025-04-20", localName: "Páscoa", name: "Easter Sunday" },
    { date: "2025-04-25", localName: "Dia da Liberdade", name: "Freedom Day" },
    { date: "2025-05-01", localName: "Dia do Trabalhador", name: "Labour Day" },
    { date: "2025-06-10", localName: "Dia de Portugal", name: "Portugal Day" },
    { date: "2025-06-19", localName: "Corpo de Deus", name: "Corpus Christi" },
    { date: "2025-08-15", localName: "Assunção de Nossa Senhora", name: "Assumption Day" },
    { date: "2025-10-05", localName: "Implantação da República", name: "Republic Day" },
    { date: "2025-11-01", localName: "Todos os Santos", name: "All Saints' Day" },
    { date: "2025-12-01", localName: "Restauração da Independência", name: "Restoration of Independence" },
    { date: "2025-12-08", localName: "Imaculada Conceição", name: "Immaculate Conception" },
    { date: "2025-12-25", localName: "Natal", name: "Christmas Day" },
  ],
  2026: [
    { date: "2026-01-01", localName: "Ano Novo", name: "New Year's Day" },
    { date: "2026-04-03", localName: "Sexta-feira Santa", name: "Good Friday" },
    { date: "2026-04-05", localName: "Páscoa", name: "Easter Sunday" },
    { date: "2026-04-25", localName: "Dia da Liberdade", name: "Freedom Day" },
    { date: "2026-05-01", localName: "Dia do Trabalhador", name: "Labour Day" },
    { date: "2026-06-04", localName: "Corpo de Deus", name: "Corpus Christi" },
    { date: "2026-06-10", localName: "Dia de Portugal", name: "Portugal Day" },
    { date: "2026-08-15", localName: "Assunção de Nossa Senhora", name: "Assumption Day" },
    { date: "2026-10-05", localName: "Implantação da República", name: "Republic Day" },
    { date: "2026-11-01", localName: "Todos os Santos", name: "All Saints' Day" },
    { date: "2026-12-01", localName: "Restauração da Independência", name: "Restoration of Independence" },
    { date: "2026-12-08", localName: "Imaculada Conceição", name: "Immaculate Conception" },
    { date: "2026-12-25", localName: "Natal", name: "Christmas Day" },
  ],
  2027: [
    { date: "2027-01-01", localName: "Ano Novo", name: "New Year's Day" },
    { date: "2027-03-26", localName: "Sexta-feira Santa", name: "Good Friday" },
    { date: "2027-03-28", localName: "Páscoa", name: "Easter Sunday" },
    { date: "2027-04-25", localName: "Dia da Liberdade", name: "Freedom Day" },
    { date: "2027-05-01", localName: "Dia do Trabalhador", name: "Labour Day" },
    { date: "2027-05-27", localName: "Corpo de Deus", name: "Corpus Christi" },
    { date: "2027-06-10", localName: "Dia de Portugal", name: "Portugal Day" },
    { date: "2027-08-15", localName: "Assunção de Nossa Senhora", name: "Assumption Day" },
    { date: "2027-10-05", localName: "Implantação da República", name: "Republic Day" },
    { date: "2027-11-01", localName: "Todos os Santos", name: "All Saints' Day" },
    { date: "2027-12-01", localName: "Restauração da Independência", name: "Restoration of Independence" },
    { date: "2027-12-08", localName: "Imaculada Conceição", name: "Immaculate Conception" },
    { date: "2027-12-25", localName: "Natal", name: "Christmas Day" },
  ],
};

type CacheEntry = { at: number; items: FeriadoNacional[] };

const cache = new Map<string, CacheEntry>();
const TTL_MS = 24 * 60 * 60 * 1000;

function yearsInRange(start: Date, end: Date): number[] {
  const years: number[] = [];
  for (let y = start.getUTCFullYear(); y <= end.getUTCFullYear(); y += 1) {
    years.push(y);
  }
  return years;
}

async function fetchYearPt(year: number): Promise<FeriadoNacional[]> {
  const key = `PT-${year}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.items;

  try {
    const url = `https://date.nager.at/api/v3/PublicHolidays/${year}/PT`;
    const res = await safeFetch(url, {
      requireHttps: true,
      headers: { accept: "application/json" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = (await res.json()) as Array<{
      date?: string;
      localName?: string;
      name?: string;
    }>;
    const items = raw
      .filter((r) => typeof r.date === "string" && r.date.length >= 10)
      .map((r) => ({
        date: r.date!.slice(0, 10),
        localName: (r.localName || r.name || "Feriado").trim(),
        name: (r.name || r.localName || "Holiday").trim(),
      }));
    if (items.length) {
      cache.set(key, { at: Date.now(), items });
      return items;
    }
  } catch {
    /* fallback abaixo */
  }

  const fallback = FALLBACK_PT[year] ?? [];
  cache.set(key, { at: Date.now(), items: fallback });
  return fallback;
}

/** Feriados nacionais PT no intervalo [start, end] (datas inclusivas). */
export async function listFeriadosNacionaisPt(
  start: Date,
  end: Date,
): Promise<FeriadoNacional[]> {
  const startKey = start.toISOString().slice(0, 10);
  const endKey = end.toISOString().slice(0, 10);
  const all: FeriadoNacional[] = [];
  for (const year of yearsInRange(start, end)) {
    all.push(...(await fetchYearPt(year)));
  }
  return all.filter((f) => f.date >= startKey && f.date <= endKey);
}
