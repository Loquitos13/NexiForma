export type PaginatedList<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  countsByEstado?: Record<string, number>;
};

/** Interpreta resposta paginada da API (compatível com arrays legados). */
export function parsePaginatedList<T>(payload: unknown): PaginatedList<T> {
  if (
    payload &&
    typeof payload === "object" &&
    "items" in payload &&
    Array.isArray((payload as PaginatedList<T>).items)
  ) {
    return payload as PaginatedList<T>;
  }
  const items = Array.isArray(payload) ? (payload as T[]) : [];
  return {
    items,
    total: items.length,
    page: 1,
    pageSize: items.length || 50,
  };
}
