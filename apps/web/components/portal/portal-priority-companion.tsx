"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, GraduationCap, ShieldAlert, X } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { cn } from "@/lib/ui/cn";
import { usePortalNotifications } from "@/lib/client/use-portal-notifications";

/**
 * Acompanha o gestor fora da dashboard (em ecrãs desktop): prioridades DGERT e sessões sem formador.
 * Em mobile fica integrado no menu de notificações/avatar para garantir responsividade total.
 */
export function PortalPriorityCompanion() {
  const pathname = usePathname();
  const { alertas, dismissAlerta, loading } = usePortalNotifications();
  const [collapsed, setCollapsed] = useState(false);

  const onDashboard = pathname === "/portal" || pathname === "/portal/";

  if (loading || onDashboard || alertas.length === 0) return null;

  const top = alertas[0]!;
  const isDgert = top.tipo === "inspecao";
  const isFormador = top.tipo === "formador";

  return (
    <div
      className={cn(
        "fixed bottom-5 left-4 z-40 hidden lg:block w-[min(100%-2rem,22rem)]",
        "rounded-2xl border shadow-2xl backdrop-blur-md transition-all duration-200",
        isDgert
          ? "border-amber-500/45 bg-amber-950/90 text-amber-100"
          : isFormador
            ? "border-violet-500/45 bg-violet-950/90 text-violet-100"
            : "border-red-500/40 bg-red-950/90 text-red-100",
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-2 px-3 py-2.5">
        <span className="mt-0.5 shrink-0 text-amber-200">
          {isDgert ? (
            <ShieldAlert className="h-5 w-5" />
          ) : isFormador ? (
            <GraduationCap className="h-5 w-5 text-violet-200" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-red-200" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-100">
              {isDgert ? "Prioridade DGERT" : isFormador ? "Formador em falta" : "Alerta crítico"}
            </p>
            <Badge variant={top.severidade === "critico" ? "red" : "yellow"}>
              {top.severidade === "critico" ? "Crítico" : "Aviso"}
            </Badge>
          </div>
          {!collapsed ? (
            <>
              <p className="mt-1 text-sm text-slate-200">
                <span className="font-medium">{top.codigoInterno}</span> - {top.mensagem}
              </p>
              {alertas.length > 1 ? (
                <p className="mt-1 text-[11px] text-slate-400">
                  +{alertas.length - 1} outro(s) alerta(s) prioritário(s)
                </p>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-2">
                <Link href={top.accaoUrl}>
                  <Button size="sm" className="h-7 text-xs">
                    Resolver
                  </Button>
                </Link>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => setCollapsed(true)}
                >
                  Minimizar
                </Button>
              </div>
            </>
          ) : (
            <button
              type="button"
              className="mt-0.5 text-left text-xs text-slate-300 hover:text-white"
              onClick={() => setCollapsed(false)}
            >
              Expandir aviso prioritário
            </button>
          )}
        </div>
        <button
          type="button"
          className="rounded-md p-1 text-slate-400 hover:text-slate-100"
          aria-label="Dispensar aviso nesta sessão"
          onClick={() => dismissAlerta(top.id)}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
