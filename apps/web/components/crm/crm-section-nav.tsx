"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { useCrmStats } from "@/lib/crm/crm-stats-context";
import { Badge } from "@/components/ui";
import { cn } from "@/lib/ui/cn";

type Tab = {
  href: string;
  label: string;
  exact?: boolean;
  managerOnly?: boolean;
  badgeFromStats?: boolean;
};

const CRM_TABS: Tab[] = [
  { href: "/portal/crm", label: "Dashboard", exact: true },
  { href: "/portal/crm/leads", label: "Leads" },
  { href: "/portal/crm/interaccoes", label: "Notas comerciais" },
  { href: "/portal/crm/sugestoes-ia", label: "Sugestões IA", badgeFromStats: true },
  { href: "/portal/crm/faturas", label: "Faturas", managerOnly: true },
  { href: "/portal/crm/faturacao", label: "Dados faturação", managerOnly: true },
  { href: "/portal/crm/config", label: "Configuração", managerOnly: true },
  { href: "/portal/crm/audit", label: "Audit", managerOnly: true },
];

function tabActive(tab: Tab, pathname: string) {
  if (tab.exact) return pathname === tab.href;
  return pathname === tab.href || pathname.startsWith(`${tab.href}/`);
}

export function CrmSectionNav() {
  const pathname = usePathname();
  const { canManage } = useTenantRole();
  const { stats } = useCrmStats();
  const pendentes = stats.sugestoesIaPendentes;

  const tabs = CRM_TABS.filter((t) => !t.managerOnly || canManage);

  return (
    <nav
      className="mb-6 flex flex-wrap gap-1 rounded-xl border border-slate-700/50 bg-slate-900/40 p-1"
      aria-label="Secções CRM"
    >
      {tabs.map((tab) => {
        const active = tabActive(tab, pathname);
        const badge = tab.badgeFromStats && pendentes > 0 ? pendentes : null;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            prefetch
            className={cn(
              "relative inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-violet-600/25 text-violet-200 ring-1 ring-violet-500/40"
                : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200",
            )}
          >
            {tab.label}
            {badge ? (
              <Badge variant="purple" className="min-w-[1.25rem] justify-center px-1.5 py-0 text-[10px]">
                {badge}
              </Badge>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

/** Banner compacto para páginas CRM quando há sugestões pendentes. */
export function CrmSugestoesPendentesBanner() {
  const { stats } = useCrmStats();
  const pendentes = stats.sugestoesIaPendentes;

  if (pendentes <= 0) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-500/30 bg-violet-950/30 px-4 py-3">
      <p className="text-sm text-violet-100">
        <span className="font-semibold">{pendentes}</span> sugestão(ões) IA aguardam a tua validação.
      </p>
      <Link
        href="/portal/crm/sugestoes-ia"
        prefetch
        className="text-sm font-medium text-violet-300 underline-offset-2 hover:underline"
      >
        Abrir inbox →
      </Link>
    </div>
  );
}

export function useCrmSugestoesPendentes() {
  const { stats, refresh } = useCrmStats();
  return { pendentes: stats.sugestoesIaPendentes, refresh };
}

