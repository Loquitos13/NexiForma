"use client";

import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/ui/cn";

/* ──────────────────────────────────────────────
   Column definition
────────────────────────────────────────────── */
export interface Column<T> {
  key: keyof T | string;
  header: string;
  /** If omitted, renders row[key] as string */
  cell?: (row: T) => React.ReactNode;
  className?: string;
  headerClassName?: string;
  sortable?: boolean;
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
}: DataTableProps<T>) {
  const hasActions = Boolean(rowActions);

  return (
    <div className={cn("w-full overflow-auto rounded-xl border border-slate-700/50", className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700/50 bg-slate-800/60">
            {columns.map((col) => (
              <th
                key={String(col.key)}
                className={cn(
                  "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400",
                  col.headerClassName,
                )}
              >
                {col.header}
              </th>
            ))}
            {hasActions && (
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">
                Acções
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: 5 }).map((_, row) => (
              <tr key={row} className="border-b border-slate-700/30">
                {columns.map((col) => (
                  <td key={String(col.key)} className="px-4 py-3.5">
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
          ) : data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length + (hasActions ? 1 : 0)}
                className="py-12 text-center text-slate-500"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr
                key={String(row[keyField])}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  "border-b border-slate-700/30 transition-colors",
                  onRowClick && "cursor-pointer hover:bg-slate-800/40",
                )}
              >
                {columns.map((col) => (
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
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {rowActions!(row)}
                    </div>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
