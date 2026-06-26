import { PageContentSkeleton } from "@/components/ui/page-skeleton";
import { Skeleton, SkeletonCircle } from "@/components/ui/skeleton";

export function PlataformaShellSkeleton() {
  return (
    <div className="flex h-screen overflow-hidden bg-[#0c0a14]">
      <aside className="flex w-[220px] flex-shrink-0 flex-col border-r border-purple-500/15 bg-[#0c0a14]/95">
        <div className="flex items-center gap-2.5 px-4 py-5">
          <SkeletonCircle className="h-7 w-7" />
          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-2.5 w-16" />
          </div>
        </div>
        <nav className="flex-1 space-y-1.5 px-2 pb-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-9 rounded-lg" />
          ))}
        </nav>
      </aside>
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex h-11 shrink-0 items-center justify-end gap-3 border-b border-purple-500/10 bg-[#0c0a14]/95 px-4">
          <Skeleton className="hidden h-3 w-32 sm:block" />
          <SkeletonCircle className="h-7 w-7" />
          <Skeleton className="h-8 w-20 rounded-lg" />
        </div>
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl px-6 py-6">
            <PageContentSkeleton variant="table" />
          </div>
        </main>
      </div>
    </div>
  );
}
