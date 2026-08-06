"use client";

import type { ReactNode } from "react";
import { SkipLink } from "./skip-link";
import { ToastProvider } from "./toast";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <SkipLink />
      {children}
    </ToastProvider>
  );
}
