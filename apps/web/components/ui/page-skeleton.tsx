import type { ReactNode } from "react";
import { Skeleton, SkeletonCircle, SkeletonText } from "@/components/ui/skeleton";
import { cn } from "@/lib/ui/cn";

function StatCardsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 rounded-xl border border-slate-700/40 bg-slate-900/40 p-4"
        >
          <SkeletonCircle className="h-10 w-10 shrink-0" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-7 w-12" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-700/50">
      <div className="flex gap-4 border-b border-slate-700/50 bg-slate-800/60 px-4 py-3">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      <div className="divide-y divide-slate-700/30">
        {Array.from({ length: rows }).map((_, row) => (
          <div key={row} className="flex items-center gap-4 px-4 py-3.5">
            {Array.from({ length: cols }).map((_, col) => (
              <Skeleton
                key={col}
                className={cn("h-3.5 flex-1", col === 0 && "max-w-[140px]")}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function CardSkeleton({
  titleWidth = "w-40",
  children,
}: {
  titleWidth?: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-700/40 bg-slate-900/40 p-5">
      <Skeleton className={cn("mb-4 h-4", titleWidth)} />
      {children ?? <SkeletonText lines={3} />}
    </div>
  );
}

type PageContentSkeletonProps = {
  variant?: "default" | "dashboard" | "table" | "detail";
  className?: string;
};

/** Esqueleto do conteúdo principal - título, cards e tabela. */
export function PageContentSkeleton({
  variant = "default",
  className,
}: PageContentSkeletonProps) {
  if (variant === "dashboard") {
    return (
      <div className={cn("space-y-6", className)}>
        <div className="rounded-2xl border border-blue-700/20 bg-gradient-to-r from-blue-900/20 to-slate-900/40 p-6">
          <Skeleton className="mb-3 h-8 w-64 max-w-full" />
          <Skeleton className="mb-5 h-4 w-96 max-w-full" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-8 w-28 rounded-lg" />
            <Skeleton className="h-8 w-24 rounded-lg" />
            <Skeleton className="h-8 w-32 rounded-lg" />
          </div>
        </div>
        <StatCardsSkeleton />
        <CardSkeleton titleWidth="w-56">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-3 p-4">
                <SkeletonCircle className="h-20 w-20" />
                <Skeleton className="h-6 w-10" />
                <Skeleton className="h-3 w-20" />
              </div>
            ))}
          </div>
        </CardSkeleton>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <CardSkeleton titleWidth="w-44">
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))}
              </div>
            </CardSkeleton>
            <CardSkeleton titleWidth="w-36">
              <TableSkeleton rows={4} cols={3} />
            </CardSkeleton>
          </div>
          <div className="space-y-4">
            <CardSkeleton titleWidth="w-32">
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-lg" />
                ))}
              </div>
            </CardSkeleton>
            <CardSkeleton titleWidth="w-28">
              <div className="grid grid-cols-2 gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 rounded-lg" />
                ))}
              </div>
            </CardSkeleton>
          </div>
        </div>
      </div>
    );
  }

  if (variant === "table") {
    return (
      <div className={cn("space-y-6", className)}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </div>
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>
        <TableSkeleton rows={8} cols={5} />
      </div>
    );
  }

  if (variant === "detail") {
    return (
      <div className={cn("space-y-6", className)}>
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-64 max-w-full" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
        <CardSkeleton titleWidth="w-32">
          <TableSkeleton rows={5} cols={4} />
        </CardSkeleton>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-52 max-w-full" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
      </div>
      <StatCardsSkeleton count={4} />
      <div className="grid gap-4 lg:grid-cols-2">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
}

export { StatCardsSkeleton, TableSkeleton, CardSkeleton };
