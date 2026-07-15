/** Converte strings ISO date (YYYY-MM-DD) num intervalo inclusivo para filtros Prisma. */
export function parseDateRangeFilter(
  dataInicio?: string,
  dataFim?: string,
): { gte?: Date; lte?: Date } | undefined {
  const range: { gte?: Date; lte?: Date } = {};

  if (dataInicio?.trim()) {
    const d = new Date(`${dataInicio.trim()}T00:00:00.000`);
    if (!Number.isNaN(d.getTime())) range.gte = d;
  }
  if (dataFim?.trim()) {
    const d = new Date(`${dataFim.trim()}T23:59:59.999`);
    if (!Number.isNaN(d.getTime())) range.lte = d;
  }

  return range.gte || range.lte ? range : undefined;
}
