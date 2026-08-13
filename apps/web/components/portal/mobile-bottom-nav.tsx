"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Award,
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  Calendar,
  Circle,
  CreditCard,
  FileCheck,
  FileText,
  FolderOpen,
  Globe,
  GraduationCap,
  Handshake,
  LayoutDashboard,
  Library,
  LifeBuoy,
  Lock,
  MessageSquare,
  PieChart,
  Plug,
  Receipt,
  Settings,
  ShieldCheck,
  Sparkles,
  Upload,
  UserCheck,
  UserCog,
  UserPlus,
  Users,
  Video,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import {
  NAV_GROUPS,
  filterGroupsForMobileBottomNav,
  navGroupTitle,
  type NavGroup,
} from "@/lib/ui/nav-items";
import { cn } from "@/lib/ui/cn";
import type { JwtRole, TenantEntitlements } from "@nexiforma/shared";

/** Protótipo: menu mobile no rodapé. Activar/desactivar aqui. */
export const MOBILE_BOTTOM_NAV_TEST = true;

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  Workflow,
  Calendar,
  LifeBuoy,
  PieChart,
  UserPlus,
  MessageSquare,
  Sparkles,
  Building2,
  Handshake,
  FileText,
  FileCheck,
  Receipt,
  Settings,
  BarChart3,
  Bell,
  GraduationCap,
  BookOpen,
  Globe,
  Library,
  Users,
  UserCheck,
  ShieldCheck,
  FolderOpen,
  Award,
  Upload,
  Plug,
  Video,
  Lock,
  UserCog,
  CreditCard,
  Circle,
};

const SHORT_LABEL: Record<string, string> = {
  Geral: "Geral",
  CRM: "CRM",
  "CRM Comercial": "CRM",
  Faturação: "Faturação",
  "Faturação AT": "Faturação",
  Inteligência: "IA",
  "Inteligência & IA": "IA",
  Comunicacao: "Avisos",
  Comunicação: "Avisos",
  Formação: "Formação",
  "Formação Core": "Formação",
  "Formação Teams": "Teams",
  Conta: "Conta",
  Administracao: "Config",
  Configurações: "Config",
};

function groupIcon(group: NavGroup): LucideIcon {
  if (group.icon && ICONS[group.icon]) return ICONS[group.icon]!;
  const first = group.items[0]?.icon;
  if (first && ICONS[first]) return ICONS[first]!;
  return Circle;
}

function itemIcon(name?: string): LucideIcon {
  return (name && ICONS[name]) || Circle;
}

function groupKey(group: NavGroup) {
  return group.module ?? group.moduleLabel ?? group.label;
}

function shortLabel(group: NavGroup) {
  const title = navGroupTitle(group);
  return SHORT_LABEL[title] ?? SHORT_LABEL[group.label] ?? title.slice(0, 8);
}

function pathActive(pathname: string, href: string) {
  if (href === "/portal") return pathname === "/portal";
  return pathname === href || pathname.startsWith(`${href}/`);
}

type Phase = "idle" | "enter" | "open" | "exit";

type Props = {
  pathname: string;
  role: JwtRole | null;
  entitlements?: TenantEntitlements | null;
};

/**
 * Bottom nav mobile: ícones por grupo + sheet em grelha com animações.
 */
export function MobileBottomNav({ pathname, role, entitlements }: Props) {
  const groups = useMemo(
    () => filterGroupsForMobileBottomNav(NAV_GROUPS, role, entitlements),
    [role, entitlements],
  );

  const [openKey, setOpenKey] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const exitTimer = useRef<number | null>(null);

  const visibleKey = openKey;
  const activeGroup = groups.find((g) => groupKey(g) === visibleKey) ?? null;
  const sheetVisible = phase === "enter" || phase === "open" || phase === "exit";

  useEffect(() => {
    return () => {
      if (exitTimer.current) window.clearTimeout(exitTimer.current);
    };
  }, []);

  useEffect(() => {
    setOpenKey(null);
    setPendingKey(null);
    setPhase("idle");
  }, [pathname]);

  function clearExitTimer() {
    if (exitTimer.current) {
      window.clearTimeout(exitTimer.current);
      exitTimer.current = null;
    }
  }

  function openGroup(key: string) {
    clearExitTimer();
    setOpenKey(key);
    setPendingKey(null);
    setPhase("enter");
    // Dois frames: 1.º pinta em translateY(110%), 2.º anima para aberto.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setPhase((p) => (p === "enter" ? "open" : p)));
    });
  }

  function closeSheet(nextKey: string | null = null) {
    if (phase === "idle" || phase === "exit") {
      if (nextKey) openGroup(nextKey);
      return;
    }
    setPendingKey(nextKey);
    setPhase("exit");
    clearExitTimer();
    exitTimer.current = window.setTimeout(() => {
      setOpenKey(null);
      setPhase("idle");
      const pending = nextKey;
      setPendingKey(null);
      if (pending) openGroup(pending);
    }, 280);
  }

  function onNavTap(key: string) {
    if (openKey === key && (phase === "open" || phase === "enter")) {
      closeSheet(null);
      return;
    }
    if (openKey && openKey !== key && (phase === "open" || phase === "enter")) {
      closeSheet(key);
      return;
    }
    openGroup(key);
  }

  if (!MOBILE_BOTTOM_NAV_TEST) return null;

  return (
    <div
      className={cn(
        "portal-mobile-bottom-nav lg:hidden",
        sheetVisible && "has-sheet",
      )}
      data-testid="mobile-bottom-nav-test"
    >
      {sheetVisible ? (
        <button
          type="button"
          className="portal-mobile-bottom-overlay"
          aria-label="Fechar menu"
          onClick={() => closeSheet(null)}
        />
      ) : null}

      <div className="portal-mobile-bottom-stack">
        {activeGroup && sheetVisible ? (
          <div
            className={cn(
              "portal-mobile-bottom-sheet",
              phase === "enter" && "is-enter",
              phase === "open" && "is-open",
              phase === "exit" && "is-exit",
            )}
            role="dialog"
            aria-label={navGroupTitle(activeGroup)}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="portal-mobile-bottom-sheet-handle" aria-hidden />
            <div className="mb-3 flex items-center gap-2.5 px-1">
              {(() => {
                const Icon = groupIcon(activeGroup);
                return (
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[color:var(--ui-border)] bg-[color:color-mix(in_srgb,var(--ui-accent)_12%,transparent)] text-[color:var(--ui-accent)]">
                    <Icon className="h-4 w-4" />
                  </span>
                );
              })()}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[color:var(--ui-fg)]">
                  {navGroupTitle(activeGroup)}
                </p>
                <p className="text-[11px] text-[color:var(--ui-muted)]">
                  {activeGroup.items.length}{" "}
                  {activeGroup.items.length === 1 ? "secção" : "secções"}
                </p>
              </div>
            </div>
            <ul className="portal-mobile-bottom-grid">
              {activeGroup.items.map((item) => {
                const Icon = itemIcon(item.icon);
                const active = pathActive(pathname, item.href);
                return (
                  <li key={`${item.href}-${item.label}`}>
                    <Link
                      href={item.href}
                      onClick={() => closeSheet(null)}
                      className={cn(
                        "portal-mobile-bottom-card",
                        active ? "is-active" : "is-dim",
                      )}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      <span className="min-w-0 truncate text-sm font-medium">{item.label}</span>
                      {active ? (
                        <span className="portal-mobile-bottom-card-dot" aria-hidden />
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        <nav className="portal-mobile-bottom-bar" aria-label="Navegação mobile">
          {groups.map((group) => {
            const key = groupKey(group);
            const Icon = groupIcon(group);
            const selected = openKey === key && phase !== "idle" && phase !== "exit";
            const groupActive = group.items.some((item) => pathActive(pathname, item.href));
            const dimOthers = sheetVisible && !selected;
            return (
              <button
                key={key}
                type="button"
                title={navGroupTitle(group)}
                aria-label={navGroupTitle(group)}
                aria-pressed={selected}
                onClick={() => onNavTap(key)}
                className={cn(
                  "portal-mobile-bottom-item",
                  (selected || (!sheetVisible && groupActive)) && "is-active",
                  dimOthers && "is-blurred",
                )}
              >
                <span className="portal-mobile-bottom-item-icon">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="portal-mobile-bottom-item-label">{shortLabel(group)}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
