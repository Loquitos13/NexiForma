"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ClipboardCheck, X } from "lucide-react";
import {
  DGERT_REQUISITO_PARAM,
  getDgertRequisitoGuide,
  readDgertRequisitoFromSearch,
  type DgertRequisitoGuide,
} from "@/lib/dossie/dgert-requisito";
import { cn } from "@/lib/ui/cn";
import { Alert } from "@/components/ui";

function useDgertRequisitoState(): DgertRequisitoGuide | null {
  const [guide, setGuide] = useState<DgertRequisitoGuide | null>(null);

  useEffect(() => {
    const sync = () => {
      setGuide(getDgertRequisitoGuide(readDgertRequisitoFromSearch(window.location.search)));
    };
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  return guide;
}

export function useDgertRequisito(): DgertRequisitoGuide | null {
  return useDgertRequisitoState();
}

export function useDgertRequisitoId(): string | null {
  return useDgertRequisito()?.id ?? null;
}

type BannerProps = {
  /** Link de regresso ao dossiê (com acção se conhecida). */
  backHref?: string;
  className?: string;
};

export function DgertRequisitoBanner({ backHref, className }: BannerProps) {
  const guide = useDgertRequisito();
  const router = useRouter();
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(false);
  }, [guide?.id]);

  useEffect(() => {
    if (!guide?.target || dismissed) return;
    const t = window.setTimeout(() => {
      const el = document.querySelector(`[data-dgert-target="${guide.target}"]`);
      if (el instanceof HTMLElement) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 180);
    return () => window.clearTimeout(t);
  }, [guide?.target, dismissed]);

  const clearRequisito = useCallback(() => {
    const next = new URLSearchParams(window.location.search);
    next.delete(DGERT_REQUISITO_PARAM);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    setDismissed(true);
  }, [pathname, router]);

  if (!guide || dismissed) return null;

  return (
    <Alert variant="warning" className={cn("mb-4 flex items-start gap-3", className)}>
      <ClipboardCheck className="h-5 w-5 shrink-0 mt-0.5 text-amber-400" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-500/90 mb-0.5">
          Pendência do dossiê DGERT
        </p>
        <p className="font-semibold text-amber-100">{guide.label}</p>
        <p className="text-sm text-amber-200/90 mt-1 leading-relaxed">{guide.instruction}</p>
        <div className="mt-2 flex flex-wrap gap-3 text-xs">
          {backHref ? (
            <Link
              href={backHref}
              className="font-medium text-amber-300 underline underline-offset-2 hover:text-amber-200"
            >
              Voltar ao dossiê
            </Link>
          ) : null}
          <button
            type="button"
            onClick={clearRequisito}
            className="font-medium text-amber-400/80 hover:text-amber-200"
          >
            Ocultar aviso
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={clearRequisito}
        className="shrink-0 rounded-lg p-1 text-amber-400/70 hover:bg-amber-500/10 hover:text-amber-200"
        aria-label="Ocultar aviso"
      >
        <X className="h-4 w-4" />
      </button>
    </Alert>
  );
}

type TargetProps = {
  /** Id do requisito ou do target em DGERT_REQUISITO_GUIDE.target */
  id: string;
  children: ReactNode;
  className?: string;
  /** Se true, activa quando o requisito activo tem este target (não só id igual). */
  matchTarget?: boolean;
};

/** Destaca visualmente a zona onde o gestor deve actuar. */
export function DgertTarget({ id, children, className, matchTarget = false }: TargetProps) {
  const guide = useDgertRequisito();
  const active = matchTarget
    ? guide?.target === id
    : guide?.id === id || guide?.target === id;

  return (
    <div
      data-dgert-target={id}
      className={cn(
        className,
        active &&
          "rounded-xl ring-2 ring-amber-400/55 ring-offset-2 ring-offset-slate-950 bg-amber-500/[0.06] shadow-[0_0_0_1px_rgba(251,191,36,0.15)]",
      )}
    >
      {children}
    </div>
  );
}
