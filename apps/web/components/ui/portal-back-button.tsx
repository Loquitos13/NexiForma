"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import {
  PORTAL_FROM_PARAM,
  isValidPortalFrom,
  labelForPortalFrom,
  portalBackButtonClassName,
} from "@/lib/ui/portal-back-nav";

type Props = {
  /** Destino quando não há `from` nem histórico utilizável. */
  fallbackHref: string;
  fallbackLabel?: string;
  className?: string;
};

/**
 * Botão «voltar» contextual: usa `?from=` quando presente; caso contrário tenta
 * `router.back()` e recorre ao fallback (ex.: URL directa ou bookmark).
 */
export function PortalBackButton({ fallbackHref, fallbackLabel, className }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromRaw = searchParams.get(PORTAL_FROM_PARAM);
  const from = isValidPortalFrom(fromRaw) ? fromRaw.split("?")[0]! : null;
  const label = from
    ? labelForPortalFrom(from)
    : (fallbackLabel ?? labelForPortalFrom(fallbackHref));

  if (from) {
    return (
      <Link href={from} className={cn(portalBackButtonClassName, className)}>
        <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
        {label}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={cn(portalBackButtonClassName, className)}
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) {
          router.back();
          return;
        }
        router.push(fallbackHref);
      }}
    >
      <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
      {label}
    </button>
  );
}
