"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/ui/cn";

export const DEFAULT_PAGE_SIZE_OPTIONS = [5, 10, 20, 50] as const;

type Props = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: readonly number[];
  numberedPages?: boolean;
  className?: string;
};

export function ListPagination({ page, pageSize, total, onPageChange, className }: Props) {
  if (total <= pageSize) return null;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 ${className ?? ""}`}>
      <p className="text-xs text-slate-500">
        {from}–{to} de {total}
      </p>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Anterior
        </Button>
        <span className="text-xs tabular-nums text-slate-400">
          {page} / {totalPages}
        </span>
        <Button
          size="sm"
          variant="secondary"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Seguinte
        </Button>
      </div>
    </div>
  );
}

/** Paginação completa com selector de tamanho de página. */
export function ListPaginationControls({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  numberedPages = false,
  className,
}: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const pageNumbers = (() => {
    if (!numberedPages || totalPages <= 1) return [];
    const maxVisible = 5;
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    const end = Math.min(totalPages, start + maxVisible - 1);
    start = Math.max(1, end - maxVisible + 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  })();

  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3", className)}>
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">Por página</span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
          className="h-8 min-w-[3rem] rounded-md border border-slate-600/60 bg-slate-900/80 px-2 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
          aria-label="Elementos por página"
        >
          {pageSizeOptions.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {total > 0 ? (
          <p className="text-xs tabular-nums text-slate-500">
            {from}–{to} de {total}
          </p>
        ) : null}
        {totalPages > 1 ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-700/60 bg-slate-900/60 text-slate-400 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Página anterior"
            >
              ‹
            </button>
            {numberedPages ? (
              pageNumbers.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => onPageChange(n)}
                  className={cn(
                    "inline-flex h-8 min-w-[2rem] items-center justify-center rounded-md border px-2 text-xs tabular-nums transition-colors",
                    n === page
                      ? "border-violet-500/50 bg-violet-900/40 font-semibold text-violet-200"
                      : "border-slate-700/60 bg-slate-900/60 text-slate-400 hover:bg-slate-800",
                  )}
                >
                  {n}
                </button>
              ))
            ) : (
              <span className="px-1 text-xs tabular-nums text-slate-400">
                {page} / {totalPages}
              </span>
            )}
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-700/60 bg-slate-900/60 text-slate-400 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Página seguinte"
            >
              ›
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
