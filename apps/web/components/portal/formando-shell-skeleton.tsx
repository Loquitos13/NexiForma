import { PageContentSkeleton } from "@/components/ui/page-skeleton";
import { Skeleton, SkeletonCircle } from "@/components/ui/skeleton";

function SessionBarSkeleton() {
  return (
    <div className="flex h-11 shrink-0 items-center justify-end gap-3 border-b border-slate-700/30 bg-slate-950/80 px-4">
      <Skeleton className="hidden h-3 w-32 sm:block" />
      <SkeletonCircle className="h-7 w-7" />
      <Skeleton className="h-8 w-20 rounded-lg" />
    </div>
  );
}

export function FormandoShellSkeleton() {
  return (
    <div className="portal-app-shell bg-[#070b12]">
      <header className="border-b border-slate-700/30 bg-slate-950/90 px-5 py-3.5">
        <div className="mx-auto flex max-w-4xl items-center gap-2.5">
          <SkeletonCircle className="h-7 w-7" />
          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-2.5 w-24" />
          </div>
        </div>
      </header>
      <SessionBarSkeleton />
      <div className="mx-auto w-full max-w-4xl flex-1 px-5 py-6">
        <PageContentSkeleton variant="default" />
      </div>
    </div>
  );
}
