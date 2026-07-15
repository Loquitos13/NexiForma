import { PageContentSkeleton } from "@/components/ui/page-skeleton";
import { Skeleton, SkeletonCircle } from "@/components/ui/skeleton";

function SidebarSkeleton() {
  return (
    <aside className="hidden h-full min-h-0 w-64 flex-shrink-0 flex-col border-r border-slate-700/40 bg-slate-950/90 lg:flex">
      <div className="flex items-center gap-2.5 px-4 py-5">
        <SkeletonCircle className="h-8 w-8" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-2.5 w-28" />
        </div>
      </div>
      <nav className="flex-1 space-y-4 px-2 pb-4">
        {Array.from({ length: 3 }).map((_, group) => (
          <div key={group} className="space-y-1.5">
            <Skeleton className="mx-2 h-2 w-16" />
            {Array.from({ length: group === 0 ? 4 : 3 }).map((_, item) => (
              <Skeleton key={item} className="mx-1 h-9 rounded-lg" />
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}

function SessionBarSkeleton() {
  return (
    <div className="flex h-11 shrink-0 items-center justify-end gap-3 border-b border-slate-700/30 bg-slate-950/80 px-4">
      <Skeleton className="hidden h-3 w-32 sm:block" />
      <SkeletonCircle className="h-7 w-7" />
      <Skeleton className="h-8 w-20 rounded-lg" />
    </div>
  );
}

export function BackofficeShellSkeleton() {
  return (
    <div className="portal-app-shell flex-row bg-[#070b12]">
      <SidebarSkeleton />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <SessionBarSkeleton />
        <main className="portal-main portal-scroll-main">
          <div className="mx-auto max-w-6xl px-3 py-4 sm:px-6 sm:py-6">
            <PageContentSkeleton variant="default" />
          </div>
        </main>
      </div>
    </div>
  );
}
