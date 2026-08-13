"use client";

import * as React from "react";
import type { ReactNode } from "react";
import { ListPaginationControls } from "@/components/crm/list-pagination";
import { DataTable, sortRows, type Column, type SortState } from "@/components/ui/data-table";
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
  /** Dados já ordenados no servidor — não reordena no cliente. */
  disableClientSort?: boolean;
  paginate?: boolean;
  defaultPageSize?: number;
  paginationClassName?: string;
};

/**
 * DataTable com paginação client-side. Ordena a lista completa antes de paginar.
 */
export function PaginatedDataTable<T>({
  paginate = true,
  defaultPageSize = 10,
  paginationClassName,
  data,
  columns,
  className,
  sort: controlledSort,
  onSortChange,
  disableClientSort = false,
  ...tableProps
}: Props<T>) {
  const [uncontrolledSort, setUncontrolledSort] = React.useState<SortState | null>(null);
  const sort = controlledSort !== undefined ? controlledSort : uncontrolledSort;

  const sortedData = React.useMemo(
    () => (disableClientSort ? data : sortRows(data, columns, sort)),
    [data, columns, sort, disableClientSort],
  );

  const { slice, setPage, page, pageSize, total, setPageSize } = useClientTablePaging(
    sortedData,
    defaultPageSize,
  );

  React.useEffect(() => {
    setPage(1);
  }, [sort?.key, sort?.direction, sort?.cycleIndex, setPage]);

  function handleSortChange(next: SortState) {
    setPage(1);
    if (onSortChange) onSortChange(next);
    else setUncontrolledSort(next);
  }

  if (!paginate) {
    return (
      <DataTable
        {...tableProps}
        columns={columns}
        data={sortedData}
        className={className}
        sort={sort}
        onSortChange={handleSortChange}
        disableClientSort
      />
    );
  }

  return (
    <div className={cn("paginated-data-table w-full", className)}>
      <DataTable
        {...tableProps}
        columns={columns}
        data={slice}
        sort={sort}
        onSortChange={handleSortChange}
        disableClientSort
      />
      {total > 0 ? (
        <ListPaginationControls
          className={cn(
            "paginated-data-table__pager mt-3 border-t border-slate-700/40 px-4 pt-4 pb-3",
            paginationClassName,
          )}
          page={page}
          pageSize={pageSize}
          total={total}
          numberedPages
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      ) : null}
    </div>
  );
}
