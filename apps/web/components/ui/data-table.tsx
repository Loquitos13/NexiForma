"use client";

import * as React from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/ui/cn";

/* ──────────────────────────────────────────────
   Column definition
────────────────────────────────────────────── */
export type SortDirection = "asc" | "desc";

export interface Column<T> {
  key: keyof T | string;
  header: React.ReactNode;
  /** Texto acessível do cabeçalho (obrigatório se `header` não for string). */
  headerText?: string;
  /** If omitted, renders row[key] as string */
  cell?: (row: T) => React.ReactNode;
  className?: string;
  headerClassName?: string;
  sortable?: boolean;
  /** Clique no cabeçalho (ex.: filtro cíclico). Ignorado se `sortable`. */
  onHeaderClick?: () => void;
  /** Valor usado na ordenação (quando sortable). */
  sortValue?: (row: T) => string | number | boolean;
}

type SortState = {
  key: string;
  direction: SortDirection;
};

function compareSortValues(a: string | number | boolean, b: string | number | boolean): number {
  if (typeof a === "boolean" && typeof b === "boolean") {
    return Number(a) - Number(b);
  }
  if (typeof a === "number" && typeof b === "number") {
    return a - b;
  }
  return String(a).localeCompare(String(b), "pt", { sensitivity: "base" });
}

function sortRows<T>(data: T[], columns: Column<T>[], sort: SortState | null): T[] {
  if (!sort) return data;
  const col = columns.find((c) => String(c.key) === sort.key);
  if (!col?.sortable) return data;

  const getValue =
    col.sortValue ??
    ((row: T) => {
      const raw = (row as Record<string, unknown>)[String(col.key)];
      if (typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean") return raw;
      return String(raw ?? "");
    });

  return [...data].sort((rowA, rowB) => {
    const cmp = compareSortValues(getValue(rowA), getValue(rowB));
    return sort.direction === "asc" ? cmp : -cmp;
  });
}

/* ──────────────────────────────────────────────
   DataTable
────────────────────────────────────────────── */
interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField: keyof T;
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  className?: string;
  /** Renders action buttons at the end of each row */
  rowActions?: (row: T) => React.ReactNode;
  /** Seleção múltipla por clique na linha (ex.: impor MFA) */
  selection?: {
    selectedIds: Set<string>;
    onToggle: (id: string) => void;
    isSelectable?: (row: T) => boolean;
  };
  /** Colunas com larguras estáveis (evita saltos no thead ao filtrar). */
  fixedLayout?: boolean;
  /**
   * Thead fora do scroll; overflow só no tbody.
   * Barra personalizada: só o botão (thumb), sem track.
   */
  stickyHeader?: boolean;
}

export function DataTable<T>({
  columns,
  data,
  keyField,
  loading,
  emptyMessage = "Sem resultados.",
  onRowClick,
  className,
  rowActions,
  selection,
  fixedLayout = false,
  stickyHeader = false,
}: DataTableProps<T>) {
  const hasActions = Boolean(rowActions);
  const hasSelection = Boolean(selection);
  const [sort, setSort] = React.useState<SortState | null>(null);

  const sortedData = React.useMemo(() => sortRows(data, columns, sort), [data, columns, sort]);

  function toggleSort(col: Column<T>) {
    if (!col.sortable) return;
    const key = String(col.key);
    setSort((prev) => {
      if (prev?.key !== key) return { key, direction: "asc" };
      return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
    });
  }

  function headerLabel(col: Column<T>): string {
    if (col.headerText) return col.headerText;
    if (typeof col.header === "string") return col.header;
    return String(col.key);
  }

  const tableClass = cn("w-full min-w-[640px] text-sm", fixedLayout && "table-fixed");

  const headerRow = (
    <tr className="border-b border-slate-700/50 bg-slate-900">
      {columns.map((col) => {
        const key = String(col.key);
        const active = sort?.key === key;
        const SortIcon = active
          ? sort.direction === "asc"
            ? ChevronUp
            : ChevronDown
          : ChevronsUpDown;

        return (
          <th
            key={key}
            className={cn(
              "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400",
              col.headerClassName,
            )}
          >
            {col.sortable ? (
              <button
                type="button"
                onClick={() => toggleSort(col)}
                className={cn(
                  "inline-flex max-w-full items-center gap-1.5 transition-colors hover:text-slate-200",
                  active && "text-violet-300",
                )}
                aria-sort={
                  active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"
                }
                aria-label={`Ordenar por ${headerLabel(col)}`}
              >
                <span className="min-w-0 truncate">{col.header}</span>
                <SortIcon className={cn("h-3.5 w-3.5 shrink-0", !active && "opacity-40")} aria-hidden />
              </button>
            ) : col.onHeaderClick ? (
              <button
                type="button"
                onClick={col.onHeaderClick}
                className="inline-flex max-w-full items-center gap-1.5 transition-colors hover:text-slate-200"
                aria-label={headerLabel(col)}
              >
                <span className="min-w-0 truncate">{col.header}</span>
              </button>
            ) : (
              col.header
            )}
          </th>
        );
      })}
      {hasActions && (
        <th className="bg-slate-900 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">
          Acções
        </th>
      )}
    </tr>
  );

  const bodyRows = loading ? (
    Array.from({ length: 5 }).map((_, row) => (
      <tr key={row} className="border-b border-slate-700/30">
        {columns.map((col) => (
          <td key={String(col.key)} className={cn("px-4 py-3.5", col.className)}>
            <Skeleton className="h-3.5 w-full max-w-[120px]" />
          </td>
        ))}
        {hasActions ? (
          <td className="px-4 py-3.5 text-right">
            <Skeleton className="ml-auto h-7 w-16 rounded-md" />
          </td>
        ) : null}
      </tr>
    ))
  ) : sortedData.length === 0 ? (
    <tr>
      <td
        colSpan={columns.length + (hasActions ? 1 : 0)}
        className="py-12 text-center text-slate-500"
      >
        {emptyMessage}
      </td>
    </tr>
  ) : (
    sortedData.map((row) => {
      const rowId = String(row[keyField]);
      const selectable = selection?.isSelectable?.(row) ?? true;
      const selected = selection?.selectedIds.has(rowId) ?? false;
      const rowClickable = hasSelection ? selectable : Boolean(onRowClick);

      return (
        <tr
          key={rowId}
          role={rowClickable ? "button" : undefined}
          tabIndex={rowClickable ? 0 : undefined}
          aria-pressed={hasSelection ? selected : undefined}
          aria-disabled={hasSelection && !selectable ? true : undefined}
          onClick={() => {
            if (hasSelection) {
              if (selectable) selection?.onToggle(rowId);
              return;
            }
            onRowClick?.(row);
          }}
          onKeyDown={(e) => {
            if (!rowClickable) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (hasSelection && selectable) selection?.onToggle(rowId);
              else onRowClick?.(row);
            }
          }}
          className={cn(
            "group border-b border-slate-700/30 transition-colors duration-150",
            hasActions && !hasSelection && !onRowClick && "hover:bg-slate-800/40",
            hasSelection &&
              selectable && [
                "cursor-pointer",
                "hover:bg-violet-950/45",
                selected && "bg-violet-950/55 ring-1 ring-inset ring-violet-500/35",
              ],
            hasSelection && !selectable && "cursor-not-allowed opacity-45",
            !hasSelection && onRowClick && "cursor-pointer hover:bg-slate-800/40",
          )}
        >
          {columns.map((col) => (
            <td key={String(col.key)} className={cn("px-4 py-3 text-slate-200", col.className)}>
              {col.cell
                ? col.cell(row)
                : String((row as Record<string, unknown>)[String(col.key)] ?? "–")}
            </td>
          ))}
          {hasActions && (
            <td
              className="px-4 py-3 text-right"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-end gap-2">{rowActions!(row)}</div>
            </td>
          )}
        </tr>
      );
    })
  );

  if (stickyHeader) {
    return (
      <div
        className={cn(
          "table-scroll-shell table-scroll-shell--body-scroll flex h-full min-h-0 w-full flex-col overflow-hidden rounded-xl border border-slate-700/50",
          className,
        )}
      >
        <div className="table-head-fixed shrink-0 overflow-x-hidden border-b border-slate-700/50 bg-slate-900">
          <table className={tableClass}>
            <thead>{headerRow}</thead>
          </table>
        </div>
        <div
          className="table-body-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto"
          tabIndex={0}
          aria-label="Linhas da tabela"
        >
          <table className={tableClass}>
            <tbody>{bodyRows}</tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("table-scroll-shell w-full rounded-xl border border-slate-700/50", className)}>
      <table className={tableClass}>
        <thead>{headerRow}</thead>
        <tbody>{bodyRows}</tbody>
      </table>
    </div>
  );
}
