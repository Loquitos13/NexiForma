"use client";

import { useEffect, useMemo, useState } from "react";

/** Paginação client-side para listas já carregadas (DataTable / tabelas HTML). */
export function useClientTablePaging<T>(items: readonly T[], defaultPageSize = 10) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  useEffect(() => {
    setPage(1);
  }, [pageSize]);

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const slice = useMemo(
    () => items.slice((page - 1) * pageSize, page * pageSize),
    [items, page, pageSize],
  );

  return {
    page,
    pageSize,
    setPage,
    setPageSize,
    slice,
    total,
  };
}
