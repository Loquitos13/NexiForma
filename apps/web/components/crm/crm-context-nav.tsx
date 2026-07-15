"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/ui/cn";

export type CrmContextNavTab = {
  href: string;
  label: string;
  exact?: boolean;
};

type Props = {
  tabs: CrmContextNavTab[];
  ariaLabel: string;
};

function tabActive(tab: CrmContextNavTab, pathname: string) {
  if (tab.exact) return pathname === tab.href;
  return pathname === tab.href || pathname.startsWith(`${tab.href}/`);
}

export function CrmContextNav({ tabs, ariaLabel }: Props) {
  const pathname = usePathname();

  return (
    <nav
      className="mb-6 inline-flex w-fit max-w-full flex-wrap gap-2 rounded-xl border border-slate-700/50 bg-slate-900/40 p-1.5"
      aria-label={ariaLabel}
    >
      {tabs.map((tab) => {
        const active = tabActive(tab, pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "relative inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-violet-600/25 text-violet-200 ring-1 ring-violet-500/40"
                : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

export const LEADS_NAV: CrmContextNavTab[] = [
  { href: "/portal/crm/leads", label: "Leads", exact: true },
  { href: "/portal/crm/leads/clientes", label: "Clientes" },
];

export const NOTAS_NAV: CrmContextNavTab[] = [
  { href: "/portal/crm/interaccoes", label: "Notas", exact: true },
  { href: "/portal/crm/interaccoes/clientes", label: "Clientes" },
];

export const SUGESTOES_NAV: CrmContextNavTab[] = [
  { href: "/portal/crm/sugestoes-ia", label: "Sugestões", exact: true },
  { href: "/portal/crm/sugestoes-ia/clientes", label: "Clientes" },
];

export const PROPOSTAS_NAV: CrmContextNavTab[] = [
  { href: "/portal/propostas", label: "Propostas", exact: true },
  { href: "/portal/propostas/clientes", label: "Clientes" },
];
