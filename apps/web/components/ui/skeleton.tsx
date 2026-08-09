import type { HTMLAttributes } from "react";
import { cn } from "@/lib/ui/cn";

type SkeletonProps = HTMLAttributes<HTMLDivElement>;

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        "nexi-skeleton rounded-md bg-[color:color-mix(in_srgb,var(--ui-muted,#94a3b8)_22%,transparent)]",
        className,
      )}
      aria-hidden
      {...props}
    />
  );
}

export function SkeletonCircle({ className, ...props }: SkeletonProps) {
  return <Skeleton className={cn("rounded-full", className)} {...props} />;
}

export function SkeletonText({
  lines = 1,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn("h-3.5", i === lines - 1 && lines > 1 ? "w-4/5" : "w-full")}
        />
      ))}
    </div>
  );
}
