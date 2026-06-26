import * as React from "react";
import { cn } from "@/lib/ui/cn";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("mb-6 flex items-start justify-between gap-4", className)}>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-100">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-slate-400">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </div>
  );
}

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "error" | "success" | "warning" | "info";
}

export function Alert({ variant = "info", className, children, ...props }: AlertProps) {
  const styles = {
    error: "border-red-700/40 bg-red-900/20 text-red-300",
    success: "border-green-700/40 bg-green-900/20 text-green-300",
    warning: "border-yellow-700/40 bg-yellow-900/20 text-yellow-300",
    info: "border-blue-700/40 bg-blue-900/20 text-blue-300",
  };
  return (
    <div
      role="alert"
      className={cn(
        "rounded-lg border px-4 py-3 text-sm",
        styles[variant],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
