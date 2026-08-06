import type { ReactNode } from "react";
import { cn } from "@/lib/ui/cn";

type TableScrollProps = {
  children: ReactNode;
  className?: string;
};

/** Wrapper responsivo para tabelas largas - scroll horizontal em viewports estreitos. */
export function TableScroll({ children, className }: TableScrollProps) {
  return <div className={cn("table-scroll-shell", className)}>{children}</div>;
}
