"use client";

import type { ReactNode } from "react";
import { ToastProvider } from "./toast";

export function AppProviders({ children }: { children: ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
