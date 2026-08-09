"use client";

import type { ReactNode } from "react";
import { UiThemeProvider } from "@/components/theme/ui-theme-provider";
import { UiThemeShop } from "@/components/theme/ui-theme-shop";
import { SkipLink } from "./skip-link";
import { ToastProvider } from "./toast";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <UiThemeProvider>
        <SkipLink />
        {children}
        <UiThemeShop />
      </UiThemeProvider>
    </ToastProvider>
  );
}
