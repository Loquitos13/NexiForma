"use client";

import type { ReactNode } from "react";
import { ListPaginationControls } from "@/components/crm/list-pagination";
import { DataTable, type Column, type SortState } from "@/components/ui/data-table";
import { useClientTablePaging } from "@/lib/client/use-client-table-paging";
import { cn } from "@/lib/ui/cn";

type Props<T> = {
  columns: Column<T>[];
  data: T[];
  keyField: keyof T;
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  className?: string;
  rowActions?: (row: T) => ReactNode;
  selection?: {
    selectedIds: Set<string>;
    onToggle: (id: string) => void;
    isSelectable?: (row: T) => boolean;
  };
  fixedLayout?: boolean;
  stickyHeader?: boolean;
  sort?: SortState | null;
  onSortChange?: (sort: SortState) => void;
  disableClientSort?: boolean;
  /** Desliga a paginação client-side (ex.: preview na home CRM). */
  paginate?: boolean;
  defaultPageSize?: number;
  paginationClassName?: string;
};

/**
 * DataTable com paginação + selector de tamanho de página.
 * Mantém o scroll do portal ao mudar página (via ListPaginationControls).
 */
export function PaginatedDataTable<T>({
  paginate = true,
  defaultPageSize = 10,
  paginationClassName,
  data,
  className,
  ...tableProps
}: Props<T>) {
  const paging = useClientTablePaging(data, defaultPageSize);

  if (!paginate) {
    return <DataTable {...tableProps} data={data} className={className} />;
  }

  return (
    <div className={cn("paginated-data-table w-full", className)}>
      <DataTable {...tableProps} data={paging.slice} />
      {paging.total > 0 ? (
        <ListPaginationControls
          className={cn(
            "paginated-data-table__pager mt-3 border-t border-slate-700/40 px-4 pt-4 pb-3",
            paginationClassName,
          )}
          page={paging.page}
          pageSize={paging.pageSize}
          total={paging.total}
          numberedPages
          onPageChange={paging.setPage}
          onPageSizeChange={paging.setPageSize}
        />
      ) : null}
    </div>
  );
}
