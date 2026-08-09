"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import {
  PORTAL_FROM_PARAM,
  isValidPortalFrom,
  labelForPortalFrom,
  portalBackButtonClassName,
} from "@/lib/ui/portal-back-nav";

type Props = {
  /** Destino da view anterior no fluxo (ex.: `/portal/propostas`). */
  fallbackHref: string;
  fallbackLabel?: string;
  className?: string;
};

/**
 * Botão «voltar» do fluxo: navega sempre para uma rota conhecida.
 * Usa `?from=` quando presente; senão `fallbackHref`.
 * Não usa o histórico do browser (`router.back()`).
 */
export function PortalBackButton({ fallbackHref, fallbackLabel, className }: Props) {
  const searchParams = useSearchParams();
  const fromRaw = searchParams.get(PORTAL_FROM_PARAM);
  const from = isValidPortalFrom(fromRaw) ? fromRaw.split("?")[0]! : null;
  const href = from ?? fallbackHref;
  const label = from
    ? labelForPortalFrom(from)
    : (fallbackLabel ?? labelForPortalFrom(fallbackHref));

  return (
    <Link href={href} className={cn(portalBackButtonClassName, className)}>
      <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
      {label}
    </Link>
  );
}
