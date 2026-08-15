"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { BookOpen, CalendarDays, FileText, GraduationCap, LayoutGrid, Lock, UserCircle } from "lucide-react";
import { DocPendenteNeonDot } from "@/components/portal/doc-pendente-neon-dot";
import { useDocumentosObrigatorios } from "@/components/portal/documentos-obrigatorios-gate";
import { cn } from "@/lib/ui/cn";

const ITEMS = [
  { href: "/portal/formando", label: "Aprendizagem", icon: GraduationCap, match: (p: string) => p === "/portal/formando" || p.startsWith("/portal/formando/aprendizagem") },
  { href: "/portal/formando/calendario", label: "Calendário", icon: CalendarDays },
  { href: "/portal/formando/catalogo", label: "Catálogo", icon: LayoutGrid },
  { href: "/portal/formando/inscricoes", label: "Inscrições", icon: BookOpen },
  { href: "/portal/formando/perfil?tab=documentos", label: "Documentos", icon: FileText, match: (p: string) => p.startsWith("/portal/formando/perfil") },
  { href: "/portal/formando/rgpd", label: "Privacidade", icon: Lock },
  { href: "/portal/formando/perfil", label: "Perfil", icon: UserCircle, match: (p: string) => p.startsWith("/portal/formando/perfil") && !p.includes("tab=documentos") },
] as const;

function isActive(pathname: string, href: string, match?: (p: string) => boolean) {
  if (match) return match(pathname);
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function FormandoNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");
  const { emFaltaCount, roleKind } = useDocumentosObrigatorios();
  const docsPendentes = roleKind === "formando" && emFaltaCount > 0;
  const imersivo = /^\/portal\/formando\/aprendizagem\/[^/]+$/.test(pathname);
  if (imersivo) return null;

  function itemActive(href: string, match?: (p: string) => boolean) {
    if (href.includes("tab=documentos")) {
      return pathname.startsWith("/portal/formando/perfil") && tab === "documentos";
    }
    if (href === "/portal/formando/perfil") {
      return pathname.startsWith("/portal/formando/perfil") && tab !== "documentos";
    }
    return isActive(pathname, href, match);
  }

  return (
    <nav
      className="sticky top-0 z-20 border-b border-slate-700/30 bg-slate-950/95 backdrop-blur-md"
      aria-label="Menu do formando"
    >
      <div className="mx-auto w-full max-w-4xl px-3 sm:px-5">
        <ul className="flex gap-0.5 overflow-x-auto scrollbar-none py-2 -mx-1">
          {ITEMS.map((item) => {
            const Icon = item.icon;
            const active = itemActive(item.href, "match" in item ? item.match : undefined);
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
                  {item.label === "Documentos" && docsPendentes ? (
                    <DocPendenteNeonDot className="ml-0.5" />
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
