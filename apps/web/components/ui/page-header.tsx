"use client";

import * as React from "react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/ui/cn";
import { pushToast } from "./toast";

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

function alertMessage(children: React.ReactNode): string {
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(alertMessage).join("");
  return "";
}

export function Alert({ variant = "info", className, children, ...props }: AlertProps) {
  const lastToast = useRef<string | null>(null);

  useEffect(() => {
    if (variant !== "success" && variant !== "error") return;
    const message = alertMessage(children);
    if (!message || lastToast.current === message) return;
    lastToast.current = message;
    pushToast(variant, message);
  }, [variant, children]);

  if (variant === "success" || variant === "error") {
    return null;
  }

  const styles = {
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
