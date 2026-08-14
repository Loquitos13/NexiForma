"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { useCompactTable } from "@/lib/client/use-compact-table";
import { Skeleton } from "@/components/ui/skeleton";
import { TableRowActions } from "@/components/ui/table-row-actions";
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
  /**
   * Ordenação por ciclo (ex. estados). Cada clique promove o próximo valor
   * da lista para o topo; não usa asc/desc.
   */
  sortCycle?: Array<string | number>;
  /** Label legível do valor actual do ciclo (ex. ACEITE → Aceite). */
  sortCycleLabel?: (value: string | number) => string;
  /** Clique no cabeçalho (ex.: filtro cíclico). Ignorado se `sortable`. */
  onHeaderClick?: () => void;
  /** Label do filtro activo mostrado ao lado do thead (com `onHeaderClick`). */
  headerFilterLabel?: string;
  /** Valor usado na ordenação (quando sortable). */
  sortValue?: (row: T) => string | number | boolean | null | undefined;
  /** Esconde a coluna em viewports compactos (mobile/tablet). */
  hideOnMobile?: boolean;
  /** Mostrar em mobile/tablet (por defeito só a 1.ª coluna + até 1 prioritária). */
  mobilePriority?: boolean;
}

export type SortState = {
  key: string;
  direction: SortDirection;
  /** Índice actual em `sortCycle` (quando aplicável). */
  cycleIndex?: number;
};

function compareSortValues(
  a: string | number | boolean | null | undefined,
  b: string | number | boolean | null | undefined,
): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "boolean" && typeof b === "boolean") {
    return Number(a) - Number(b);
  }
  if (typeof a === "number" && typeof b === "number") {
    return a - b;
  }
  return String(a).localeCompare(String(b), "pt", { sensitivity: "base" });
}

export function sortRows<T>(data: T[], columns: Column<T>[], sort: SortState | null): T[] {
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

  if (col.sortCycle?.length) {
    const cycle = col.sortCycle.map(String);
    const start = sort.cycleIndex ?? 0;
    const order = [...cycle.slice(start), ...cycle.slice(0, start)];
    return [...data].sort((rowA, rowB) => {
      const rank = (row: T) => {
        const idx = order.indexOf(String(getValue(row) ?? ""));
        return idx === -1 ? order.length : idx;
      };
      return rank(rowA) - rank(rowB);
    });
  }

  return [...data].sort((rowA, rowB) => {
    const va = getValue(rowA);
    const vb = getValue(rowB);
    // Valores vazios ficam sempre no fim (asc e desc).
    if (va == null && vb == null) return 0;
    if (va == null || va === "") return 1;
    if (vb == null || vb === "") return -1;
    const cmp = compareSortValues(va, vb);
    return sort.direction === "asc" ? cmp : -cmp;
  });
}

function compactVisibleColumnKeys<T>(columns: Column<T>[]): Set<string> {
  const eligible = columns.filter((c) => !c.hideOnMobile);
  const keys = new Set<string>();
  if (eligible[0]) keys.add(String(eligible[0].key));
  for (const col of eligible) {
    if (col.mobilePriority) keys.add(String(col.key));
  }
  if (keys.size < 2 && eligible[1]) keys.add(String(eligible[1].key));
  return keys;
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
  /** Navegação ao clicar na linha (alternativa a onRowClick). */
  getRowHref?: (row: T) => string | undefined;
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
  /** Ordenação controlada (ex.: sort no servidor + paginação). */
  sort?: SortState | null;
  onSortChange?: (sort: SortState) => void;
  /** Se true, não reordena `data` no cliente (o servidor já ordenou). */
  disableClientSort?: boolean;
}

export function DataTable<T>({
  columns,
  data,
  keyField,
  loading,
  emptyMessage = "Sem resultados.",
  onRowClick,
  getRowHref,
  className,
  rowActions,
  selection,
  fixedLayout = false,
  stickyHeader = false,
  sort: controlledSort,
  onSortChange,
  disableClientSort = false,
}: DataTableProps<T>) {
  const router = useRouter();
  const compact = useCompactTable();
  const hasActions = Boolean(rowActions);
  const hasSelection = Boolean(selection);
  const [uncontrolledSort, setUncontrolledSort] = React.useState<SortState | null>(null);
  const sort = controlledSort !== undefined ? controlledSort : uncontrolledSort;

  const visibleKeys = React.useMemo(
    () => (compact ? compactVisibleColumnKeys(columns) : null),
    [compact, columns],
  );

  const displayColumns = React.useMemo(
    () =>
      columns.filter((col) => {
        if (!compact) return true;
        if (col.hideOnMobile) return false;
        return visibleKeys?.has(String(col.key)) ?? false;
      }),
    [columns, compact, visibleKeys],
  );

  const sortedData = React.useMemo(
    () => (disableClientSort ? data : sortRows(data, columns, sort)),
    [data, columns, sort, disableClientSort],
  );

  const openRow = React.useCallback(
    (row: T) => {
      if (onRowClick) {
        onRowClick(row);
        return;
      }
      const href = getRowHref?.(row);
      if (href) router.push(href);
    },
    [getRowHref, onRowClick, router],
  );

  function toggleSort(col: Column<T>) {
    if (!col.sortable) return;
    const key = String(col.key);
    const cycleLen = col.sortCycle?.length ?? 0;
    const prev = sort;
    let next: SortState;
    if (cycleLen > 0) {
      next =
        prev?.key !== key
          ? { key, direction: "asc", cycleIndex: 0 }
          : {
              key,
              direction: "asc",
              cycleIndex: ((prev.cycleIndex ?? 0) + 1) % cycleLen,
            };
    } else if (prev?.key !== key) {
      next = { key, direction: "asc" };
    } else {
      next = { key, direction: prev.direction === "asc" ? "desc" : "asc" };
    }
    if (onSortChange) onSortChange(next);
    else setUncontrolledSort(next);
  }

  function headerLabel(col: Column<T>): string {
    if (col.headerText) return col.headerText;
    if (typeof col.header === "string") return col.header;
    return String(col.key);
  }

  const tableClass = cn(
    "w-full text-sm",
    fixedLayout ? "table-fixed" : compact ? "w-full" : "min-w-[640px]",
  );

  const headerRow = (
    <tr className="border-b border-slate-700/50 bg-slate-900">
      {displayColumns.map((col) => {
        const key = String(col.key);
        const active = sort?.key === key;
        const isCycle = Boolean(col.sortCycle?.length);
        const cycleIndex = active ? (sort?.cycleIndex ?? 0) : 0;
        const cyclePrimaryRaw =
          isCycle && active && col.sortCycle
            ? (col.sortCycle[cycleIndex] ?? null)
            : null;
        const cyclePrimaryLabel =
          cyclePrimaryRaw != null
            ? (col.sortCycleLabel?.(cyclePrimaryRaw) ?? String(cyclePrimaryRaw))
            : null;
        const pendingAsc = !active || sort?.direction === "desc";
        const SortIcon = isCycle
          ? ChevronsUpDown
          : active
            ? sort?.direction === "asc"
              ? ChevronUp
              : ChevronDown
            : pendingAsc
              ? ChevronUp
              : ChevronDown;

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
                  "group/sort inline-flex max-w-full items-center gap-1.5 transition-colors hover:text-slate-200",
                  active && "text-blue-300",
                )}
                aria-sort={
                  isCycle
                    ? active
                      ? "other"
                      : "none"
                    : active
                      ? sort?.direction === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                }
                aria-label={
                  isCycle
                    ? active && cyclePrimaryLabel
                      ? `Ordenar por ${headerLabel(col)} (prioridade ${cyclePrimaryLabel}). Clique para o próximo estado.`
                      : `Ordenar por ${headerLabel(col)} (ciclo de estados)`
                    : `Ordenar por ${headerLabel(col)}`
                }
                title={
                  isCycle && cyclePrimaryLabel
                    ? `Prioridade: ${cyclePrimaryLabel}`
                    : undefined
                }
              >
                <span className="min-w-0 truncate">{col.header}</span>
                {cyclePrimaryLabel ? (
                  <span className="shrink-0 rounded-md bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-blue-300">
                    {cyclePrimaryLabel}
                  </span>
                ) : null}
                <SortIcon
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 transition-opacity",
                    active ? "opacity-100" : "opacity-40 group-hover/sort:opacity-90",
                  )}
                  aria-hidden
                />
              </button>
            ) : col.onHeaderClick ? (
              <button
                type="button"
                onClick={col.onHeaderClick}
                className={cn(
                  "group/sort inline-flex max-w-full items-center gap-1.5 transition-colors hover:text-slate-200",
                  col.headerFilterLabel && "text-blue-300",
                )}
                aria-label={
                  col.headerFilterLabel
                    ? `Filtrar ${headerLabel(col)}: ${col.headerFilterLabel}. Clique para o próximo.`
                    : `Filtrar por ${headerLabel(col)}`
                }
                title={
                  col.headerFilterLabel
                    ? `Filtro: ${col.headerFilterLabel}`
                    : undefined
                }
              >
                <span className="min-w-0 truncate">{col.header}</span>
                {col.headerFilterLabel ? (
                  <span className="shrink-0 rounded-md bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-blue-300">
                    {col.headerFilterLabel}
                  </span>
                ) : null}
                <ChevronsUpDown
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 transition-opacity",
                    col.headerFilterLabel
                      ? "opacity-100"
                      : "opacity-40 group-hover/sort:opacity-90",
                  )}
                  aria-hidden
                />
              </button>
            ) : (
              col.header
            )}
          </th>
        );
      })}
      {hasActions && (
        <th
          className={cn(
            "sticky top-0 z-10 bg-slate-900 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400",
            compact ? "w-11 px-2" : "px-4",
          )}
        >
          <span className={compact ? "sr-only" : undefined}>Acções</span>
          {compact ? "···" : "Acções"}
        </th>
      )}
    </tr>
  );

  const bodyRows = loading ? (
    Array.from({ length: compact ? 3 : 5 }).map((_, row) => (
      <tr key={row} className="border-b border-slate-700/30">
        {displayColumns.map((col) => (
          <td key={String(col.key)} className={cn("px-4 py-3.5", col.className)}>
            <Skeleton className="h-3.5 w-full max-w-[120px]" />
          </td>
        ))}
        {hasActions ? (
          <td className={cn("py-3.5 text-right", compact ? "w-11 px-2" : "px-4")}>
            <Skeleton className="ml-auto h-7 w-7 rounded-md" />
          </td>
        ) : null}
      </tr>
    ))
  ) : sortedData.length === 0 ? (
    <tr>
      <td
        colSpan={displayColumns.length + (hasActions ? 1 : 0)}
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
      const rowClickable = hasSelection ? selectable : Boolean(onRowClick || getRowHref);

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
            if (rowClickable) openRow(row);
          }}
          onKeyDown={(e) => {
            if (!rowClickable) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (hasSelection && selectable) selection?.onToggle(rowId);
              else openRow(row);
            }
          }}
          className={cn(
            "group border-b border-slate-700/30 transition-colors duration-150",
            rowClickable && "cursor-pointer hover:bg-slate-800/40",
            hasSelection &&
              selectable && [
                "cursor-pointer",
                "hover:bg-violet-950/45",
                selected && "bg-violet-950/55 ring-1 ring-inset ring-violet-500/35",
              ],
            hasSelection && !selectable && "cursor-not-allowed opacity-45",
          )}
        >
          {displayColumns.map((col) => (
            <td
              key={String(col.key)}
              className={cn("px-4 py-3 text-slate-200", col.className)}
            >
              {col.cell
                ? col.cell(row)
                : String((row as Record<string, unknown>)[String(col.key)] ?? "–")}
            </td>
          ))}
          {hasActions && (
            <td
              className={cn("py-3 text-right", compact ? "w-11 px-2" : "px-3 sm:px-4")}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <TableRowActions>{rowActions!(row)}</TableRowActions>
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
          "table-scroll-shell flex h-full min-h-0 w-full flex-col overflow-hidden rounded-xl border border-slate-700/50",
          className,
        )}
      >
        <div
          className="table-body-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto"
          tabIndex={0}
          aria-label="Linhas da tabela"
        >
          <table className={tableClass}>
            <thead className="sticky top-0 z-20 isolate [&_th]:bg-slate-900 [&_th]:shadow-[inset_0_-1px_0_0_rgba(51,65,85,0.5)]">
              {headerRow}
            </thead>
            <tbody>{bodyRows}</tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "w-full rounded-xl border border-slate-700/50",
        fixedLayout ? "overflow-visible" : "table-scroll-shell",
        className,
      )}
    >
      <table className={tableClass}>
        <thead>{headerRow}</thead>
        <tbody>{bodyRows}</tbody>
      </table>
    </div>
  );
}
