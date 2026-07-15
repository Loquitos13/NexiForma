export type PaginatedList<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  countsByEstado?: Record<string, number>;
};

export function parseListPagination(page?: string, pageSize?: string) {
  const parsedPage = Number.parseInt(page ?? "1", 10);
  const parsedSize = Number.parseInt(pageSize ?? "50", 10);
  const pageNum = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const pageSizeNum = Number.isFinite(parsedSize)
    ? Math.min(100, Math.max(1, parsedSize))
    : 50;
  return {
    page: pageNum,
    pageSize: pageSizeNum,
    skip: (pageNum - 1) * pageSizeNum,
    take: pageSizeNum,
  };
}

export function countsFromGroupBy(
  rows: Array<{ estado: string; _count: { _all: number } }>,
): Record<string, number> {
  const counts: Record<string, number> = { TODAS: 0 };
  for (const row of rows) {
    counts[row.estado] = row._count._all;
    counts.TODAS = (counts.TODAS ?? 0) + row._count._all;
  }
  return counts;
}
