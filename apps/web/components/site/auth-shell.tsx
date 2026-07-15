"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { NexiFormaBrandTitle } from "@/components/brand/NexiFormaBrandTitle";
import { NexiFormaLogoAnimated } from "@/components/brand/NexiFormaLogoAnimated";
import { InteractiveBackground } from "@/components/site/interactive-background";
import { cn } from "@/lib/ui/cn";
type AuthShellProps = {
  children: ReactNode;
  title: string;
  subtitle?: string;
  variant?: "tenant" | "platform";
  footer?: ReactNode;
};

export function AuthShell({
  children,
  title,
  subtitle,
  variant = "tenant",
  footer,
}: AuthShellProps) {
  const isPlatform = variant === "platform";

  return (
    <div className="relative isolate flex min-h-screen items-center justify-center overflow-hidden p-6">
      <InteractiveBackground variant={isPlatform ? "platform" : "login"} fixed={false} />

      <div className="relative z-10 flex w-full max-w-[440px] flex-col items-center">
        <Link href="/" className="mb-8 flex flex-col items-center gap-4 group w-full">
          <NexiFormaLogoAnimated size={128} variant="reveal" loop className="drop-shadow-[0_0_28px_rgba(255,71,171,0.35)]" />
          <NexiFormaBrandTitle subtitle={isPlatform ? "Plataforma" : undefined} />
        </Link>

        <div
          className={cn(
            "w-full overflow-hidden rounded-2xl shadow-2xl ring-1",
            isPlatform
              ? "bg-[#0f0b1a]/90 ring-purple-500/15 shadow-purple-500/5"
              : "bg-[#0f172a]/90 ring-slate-700/30 shadow-blue-500/5",
          )}
        >
          <div
            aria-hidden
            className={cn(
              "h-1 w-full",
              isPlatform ? "bg-gradient-to-r from-purple-600 to-violet-500" : "bg-gradient-to-r from-blue-600 to-teal-500",
            )}
          />

          <div className="px-7 py-7 backdrop-blur-sm">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-slate-50 tracking-tight">{title}</h2>
              {subtitle ? (
                <p className="mt-1.5 text-sm text-slate-400 leading-relaxed">{subtitle}</p>
              ) : null}
            </div>

            {children}
          </div>
        </div>

        {footer !== undefined ? (
          footer
        ) : (
          <p className="mt-5 text-center text-sm text-slate-500">
            <Link href="/" className="text-slate-400 hover:text-slate-200 transition-colors">
              Página inicial
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
