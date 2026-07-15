"use client";

import { Badge } from "@/components/ui";
import { cn } from "@/lib/ui/cn";

export type ClienteFichaTab =
  | "dados"
  | "faturas"
  | "propostas"
  | "leads"
  | "notas-comerciais"
  | "sugestoes-ia";

type TabDef = {
  id: ClienteFichaTab;
  label: string;
  badgeKey?: keyof ClienteFichaBadges;
  crmOnly?: boolean;
  managerOnly?: boolean;
};

export type ClienteFichaBadges = {
  faturas?: number;
  propostas?: number;
  leads?: number;
  notas?: number;
  sugestoes?: number;
};

const TABS: TabDef[] = [
  { id: "dados", label: "Dados" },
  { id: "faturas", label: "Faturas", badgeKey: "faturas", managerOnly: true },
  { id: "propostas", label: "Propostas", badgeKey: "propostas", crmOnly: true },
  { id: "leads", label: "Leads", badgeKey: "leads", crmOnly: true },
  { id: "notas-comerciais", label: "Notas Comerciais", badgeKey: "notas", crmOnly: true },
  { id: "sugestoes-ia", label: "Sugestões IA", badgeKey: "sugestoes", crmOnly: true },
];

type Props = {
  active: ClienteFichaTab;
  onChange: (tab: ClienteFichaTab) => void;
  badges?: ClienteFichaBadges;
  showCrmTabs?: boolean;
  showFaturacaoTabs?: boolean;
};

export function ClienteFichaNav({
  active,
  onChange,
  badges,
  showCrmTabs = true,
  showFaturacaoTabs = true,
}: Props) {
  const visible = TABS.filter(
    (t) =>
      (!t.crmOnly || showCrmTabs) && (!t.managerOnly || showFaturacaoTabs),
  );

  return (
    <nav
      className="mb-6 flex flex-wrap gap-1 rounded-xl border border-slate-700/50 bg-slate-900/40 p-1"
      aria-label="Secções da ficha de cliente"
    >
      {visible.map((tab) => {
        const isActive = active === tab.id;
        const count = tab.badgeKey ? badges?.[tab.badgeKey] : undefined;
        const showBadge = (count ?? 0) > 0;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              "relative inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-violet-600/25 text-violet-200 ring-1 ring-violet-500/40"
                : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200",
            )}
          >
            {tab.label}
            {showBadge && tab.badgeKey === "sugestoes" ? (
              <Badge variant="purple" className="min-w-[1.25rem] justify-center px-1.5 py-0 text-[10px]">
                {count}
              </Badge>
            ) : showBadge ? (
              <span className="text-[10px] tabular-nums text-slate-500">({count})</span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}

export function parseClienteFichaTab(value: string | null): ClienteFichaTab {
  if (
    value === "faturas" ||
    value === "propostas" ||
    value === "leads" ||
    value === "notas-comerciais" ||
    value === "sugestoes-ia"
  ) {
    return value;
  }
  if (value === "notas") return "notas-comerciais";
  return "dados";
}
