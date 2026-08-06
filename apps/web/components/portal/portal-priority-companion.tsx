"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, GraduationCap, ShieldAlert, X } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { useTenantEntitlements } from "@/lib/client/use-tenant-entitlements";
import { Badge, Button } from "@/components/ui";
import { cn } from "@/lib/ui/cn";

type ComplianceAlerta = {
  id: string;
  tipo: string;
  severidade: "critico" | "aviso";
  codigoInterno: string;
  mensagem: string;
  accaoUrl: string;
};

const DISMISS_KEY = "nexiforma-priority-companion-dismissed";

function loadDismissed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(DISMISS_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveDismissed(ids: Set<string>) {
  sessionStorage.setItem(DISMISS_KEY, JSON.stringify([...ids]));
}

function alertaRank(a: ComplianceAlerta): number {
  if (a.tipo === "inspecao" && a.severidade === "critico") return 0;
  if (a.tipo === "inspecao") return 1;
  if (a.tipo === "formador") return 2;
  if (a.severidade === "critico") return 3;
  return 4;
}

/**
 * Acompanha o gestor fora da dashboard: prioridades DGERT e sessões sem formador.
 * Na dashboard o aviso completo fica no painel; aqui só companion flutuante.
 */
export function PortalPriorityCompanion() {
  const pathname = usePathname();
  const { canManage, loading: roleLoading } = useTenantRole();
  const { entitlements, loading: entLoading } = useTenantEntitlements();
  const [alertas, setAlertas] = useState<ComplianceAlerta[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(() => loadDismissed());
  const [collapsed, setCollapsed] = useState(false);

  const coreFormation = Boolean(entitlements?.canAccessCoreFormation);
  const onDashboard = pathname === "/portal" || pathname === "/portal/";

  const load = useCallback(async () => {
    if (!canManage || !coreFormation) return;
    const res = await bffFetch("/api/v1/compliance/alertas", {
      headers: { accept: "application/json" },
    });
    if (!res.ok) return;
    const data = (await res.json()) as { alertas?: ComplianceAlerta[] };
    setAlertas(data.alertas ?? []);
  }, [canManage, coreFormation]);

  useEffect(() => {
    if (roleLoading || entLoading) return;
    void load();
  }, [roleLoading, entLoading, load, pathname]);

  const prioridade = useMemo(() => {
    return [...alertas]
      .filter((a) => a.tipo === "inspecao" || a.tipo === "formador" || a.severidade === "critico")
      .sort((a, b) => alertaRank(a) - alertaRank(b))
      .filter((a) => !dismissed.has(a.id))
      .slice(0, 3);
  }, [alertas, dismissed]);

  if (roleLoading || entLoading || !canManage || !coreFormation) return null;
  if (onDashboard) return null;
  if (prioridade.length === 0) return null;

  const top = prioridade[0]!;
  const isDgert = top.tipo === "inspecao";
  const isFormador = top.tipo === "formador";

  return (
    <div
      className={cn(
        "fixed bottom-5 left-4 z-40 w-[min(100%-2rem,22rem)]",
        "rounded-2xl border shadow-2xl backdrop-blur-md",
        isDgert
          ? "border-amber-500/45 bg-amber-950/90"
          : isFormador
            ? "border-violet-500/45 bg-violet-950/90"
            : "border-red-500/40 bg-red-950/90",
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
              {prioridade.length > 1 ? (
                <p className="mt-1 text-[11px] text-slate-400">
                  +{prioridade.length - 1} outro(s) alerta(s) prioritário(s)
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
          onClick={() => {
            const next = new Set(dismissed);
            next.add(top.id);
            setDismissed(next);
            saveDismissed(next);
          }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
