"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, CalendarDays, GraduationCap, LayoutGrid, UserCircle } from "lucide-react";
import { cn } from "@/lib/ui/cn";

const ITEMS = [
  { href: "/portal/formando", label: "Aprendizagem", icon: GraduationCap, match: (p: string) => p === "/portal/formando" || p.startsWith("/portal/formando/aprendizagem") },
  { href: "/portal/formando/calendario", label: "Calendário", icon: CalendarDays },
  { href: "/portal/formando/catalogo", label: "Catálogo", icon: LayoutGrid },
  { href: "/portal/formando/inscricoes", label: "Inscrições", icon: BookOpen },
  { href: "/portal/formando/perfil", label: "Perfil", icon: UserCircle },
] as const;

function isActive(pathname: string, href: string, match?: (p: string) => boolean) {
  if (match) return match(pathname);
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function FormandoNav() {
  const pathname = usePathname();

  return (
    <nav
      className="sticky top-0 z-20 border-b border-slate-700/30 bg-slate-950/95 backdrop-blur-md"
      aria-label="Menu do formando"
    >
      <div className="max-w-4xl mx-auto px-3 sm:px-5">
        <ul className="flex gap-0.5 overflow-x-auto scrollbar-none py-2 -mx-1">
          {ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href, "match" in item ? item.match : undefined);
            return (
              <li key={item.href} className="flex-shrink-0">
                <Link
                  href={item.href}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors",
                    active
                      ? "bg-blue-600/20 text-blue-300 ring-1 ring-blue-500/30"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
