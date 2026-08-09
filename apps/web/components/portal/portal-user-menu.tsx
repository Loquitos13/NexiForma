"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Bell,
  ChevronLeft,
  Lock,
  LogOut,
  Palette,
  Settings2,
  UserRound,
} from "lucide-react";
import { PortalNotificationsBell } from "@/components/portal/portal-notifications-bell";
import { usePendenciasDocumentacaoConfirm } from "@/components/portal/pendencias-documentacao-dialog";
import { useUiThemeOptional } from "@/components/theme/ui-theme-provider";
import { bffFetch } from "@/lib/client/bff-fetch";
import { logoutSession } from "@/lib/client/logout";
import {
  buildPendenciaSessaoHref,
  resolvePendenciaItemFocus,
} from "@/lib/client/pendencias-documentacao-href";
import { sessionGoodbyeHref } from "@/components/site/session-goodbye";
import { cn } from "@/lib/ui/cn";

type MeUser = {
  email?: string;
  role?: string;
  kind?: string;
  displayName?: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  user: MeUser | null;
};

function formatRole(role?: string): string | null {
  switch (role) {
    case "super_admin":
      return "Super admin";
    case "tenant_manager":
      return "Gestor";
    case "coordenador_comercial":
      return "Coord. Comercial";
    case "coordenador_pedagogico":
      return "Coord. Pedagógico";
    case "coordenador_financeiro":
      return "Coord. Financeiro";
    case "comercial":
      return "Comercial";
    case "formador":
      return "Formador";
    case "formando":
      return "Formando";
    default:
      return role ?? null;
  }
}

function profileHref(role?: string): string {
  if (role === "formador") return "/portal/formador/perfil";
  if (role === "formando") return "/portal/formando/perfil";
  return "/portal/configuracoes";
}

function initials(user: MeUser | null): string {
  const raw = (user?.displayName || user?.email || "N").trim();
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return raw.slice(0, 1).toUpperCase() || "N";
}

/**
 * Menu do avatar (mobile): desce do topo - perfil, preferências (tema + notificações), RGPD, sair.
 */
export function PortalUserMenu({ open, onClose, user }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const uiTheme = useUiThemeOptional();
  const [panel, setPanel] = useState<"root" | "prefs">("root");
  const [phase, setPhase] = useState<"closed" | "enter" | "open" | "exit">("closed");
  const [busy, setBusy] = useState(false);
  const { dialog: pendenciasDialog, confirm: confirmPendencias } =
    usePendenciasDocumentacaoConfirm();

  const showStaffNotifs =
    user?.role === "tenant_manager" ||
    user?.role === "comercial" ||
    user?.role === "formador" ||
    user?.role === "coordenador_pedagogico" ||
    user?.role === "coordenador_comercial" ||
    user?.role === "coordenador_financeiro";

  useEffect(() => {
    if (open) {
      setPanel("root");
      setPhase("enter");
      const id = requestAnimationFrame(() => setPhase("open"));
      return () => cancelAnimationFrame(id);
    }
    if (phase === "closed") return;
    setPhase("exit");
    const t = window.setTimeout(() => setPhase("closed"), 280);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só reage a `open`
  }, [open]);

  const requestClose = useCallback(() => {
    if (phase === "exit" || phase === "closed") return;
    onClose();
  }, [onClose, phase]);

  async function performLogout() {
    const returnTo = pathname.startsWith("/portal") ? pathname : "/portal";
    router.push(sessionGoodbyeHref(returnTo, "logout"));
    await logoutSession();
  }

  async function onLogout() {
    if (busy) return;
    setBusy(true);
    try {
      if (user?.role === "formador") {
        try {
          const res = await bffFetch("/api/v1/sessoes-formacao/pendencias-documentacao", {
            headers: { accept: "application/json" },
          });
          if (res.ok) {
            const data = (await res.json()) as {
              temPendencias?: boolean;
              sessoes?: Array<{
                sessaoId: string;
                acaoId: string;
                acaoLabel: string;
                numeroSessao: number;
                folhaPendente?: boolean;
                sumarioPendente?: boolean;
                itens: string[];
              }>;
            };
            if (data.temPendencias && data.sessoes?.length) {
              setBusy(false);
              const ok = await confirmPendencias({
                title: "Sair com pendências?",
                question: "Tens a certeza que queres sair (logout) na mesma?",
                hint:
                  "Clica numa pendência para a resolver. Se saíres na mesma, o departamento pedagógico será notificado por email.",
                sessoes: data.sessoes.map((s) => {
                  const focus =
                    s.folhaPendente && s.sumarioPendente
                      ? ("pendencias" as const)
                      : s.folhaPendente
                        ? ("folha" as const)
                        : ("sumario" as const);
                  return {
                    acaoLabel: s.acaoLabel,
                    numeroSessao: s.numeroSessao,
                    href: buildPendenciaSessaoHref({
                      acaoId: s.acaoId,
                      sessaoId: s.sessaoId,
                      focus,
                    }),
                    itens: s.itens.map((label) => ({
                      label,
                      href: buildPendenciaSessaoHref({
                        acaoId: s.acaoId,
                        sessaoId: s.sessaoId,
                        focus: resolvePendenciaItemFocus(label),
                      }),
                    })),
                  };
                }),
                confirmLabel: "Sair na mesma",
                cancelLabel: "Ficar no portal",
              });
              if (!ok) return;
              setBusy(true);
              await bffFetch(
                "/api/v1/sessoes-formacao/pendencias-documentacao/avisar-pedagogico",
                {
                  method: "POST",
                  headers: {
                    accept: "application/json",
                    "content-type": "application/json",
                  },
                  body: "{}",
                  keepalive: true,
                },
              ).catch(() => undefined);
            }
          }
        } catch {
          /* não bloqueia logout */
        }
      }
      await performLogout();
    } finally {
      setBusy(false);
    }
  }

  const roleLabel = formatRole(user?.role);
  const visible = phase === "open" || phase === "enter";

  if (phase === "closed") return pendenciasDialog;

  const menu = (
      <div
        className={cn(
          "portal-user-menu-root lg:hidden",
          visible ? "is-open" : "is-closing",
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Menu da conta"
      >
        <button
          type="button"
          className="portal-user-menu-overlay"
          aria-label="Fechar menu"
          onClick={requestClose}
        />
        <div className="portal-user-menu-panel">
          <div className="portal-user-menu-handle" aria-hidden />
          {panel === "root" ? (
            <>
              <div className="flex items-center gap-3 px-4 pb-3 pt-1">
                <span className="portal-user-avatar text-sm font-bold">{initials(user)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[color:var(--ui-fg)]">
                    {user?.displayName || user?.email || "Utilizador"}
                  </p>
                  {user?.email ? (
                    <p className="truncate text-xs text-[color:var(--ui-muted)]">{user.email}</p>
                  ) : null}
                  {roleLabel ? (
                    <span className="ui-session-role mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium">
                      {roleLabel}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="mx-3 border-t border-[color:var(--ui-border)]" />
              <nav className="flex flex-col gap-0.5 p-2">
                <Link
                  href={profileHref(user?.role)}
                  onClick={requestClose}
                  className="portal-user-menu-item"
                >
                  <span className="portal-user-menu-icon">
                    <UserRound className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">O meu perfil</span>
                    <span className="block text-[11px] text-[color:var(--ui-muted)]">
                      Editar dados pessoais
                    </span>
                  </span>
                </Link>
                <button
                  type="button"
                  className="portal-user-menu-item w-full text-left"
                  onClick={() => setPanel("prefs")}
                >
                  <span className="portal-user-menu-icon">
                    <Settings2 className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">Preferências</span>
                    <span className="block text-[11px] text-[color:var(--ui-muted)]">
                      Tema, notificações e RGPD
                    </span>
                  </span>
                </button>
              </nav>
              <div className="mx-3 border-t border-[color:var(--ui-border)]" />
              <div className="p-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onLogout()}
                  className="portal-user-menu-item portal-user-menu-item--danger w-full text-left disabled:opacity-50"
                >
                  <span className="portal-user-menu-icon">
                    <LogOut className="h-4 w-4" />
                  </span>
                  <span className="text-sm font-medium">
                    {busy ? "A sair…" : "Terminar sessão"}
                  </span>
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 px-3 pb-2 pt-1">
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[color:var(--ui-muted)] hover:bg-[color:color-mix(in_srgb,var(--ui-accent)_12%,transparent)] hover:text-[color:var(--ui-fg)]"
                  aria-label="Voltar"
                  onClick={() => setPanel("root")}
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <p className="text-sm font-semibold text-[color:var(--ui-fg)]">Preferências</p>
              </div>
              <nav className="flex flex-col gap-0.5 p-2">
                {uiTheme ? (
                  <button
                    type="button"
                    className="portal-user-menu-item w-full text-left"
                    onClick={() => {
                      uiTheme.openShop();
                      requestClose();
                    }}
                  >
                    <span className="portal-user-menu-icon">
                      <Palette className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">Tema</span>
                      <span className="block text-[11px] text-[color:var(--ui-muted)]">
                        Aparência da plataforma
                      </span>
                    </span>
                  </button>
                ) : null}
                {showStaffNotifs ? (
                  <div className="portal-user-menu-item items-start">
                    <span className="portal-user-menu-icon mt-0.5">
                      <Bell className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">Notificações</p>
                      <p className="mb-2 text-[11px] text-[color:var(--ui-muted)]">
                        Alertas do portal
                      </p>
                      <div className="flex items-center gap-2">
                        <PortalNotificationsBell />
                        <Link
                          href="/portal/notificacoes"
                          onClick={requestClose}
                          className="text-xs font-medium text-[color:var(--ui-accent)]"
                        >
                          Ver todas
                        </Link>
                      </div>
                    </div>
                  </div>
                ) : (
                  <Link
                    href="/portal/notificacoes"
                    onClick={requestClose}
                    className="portal-user-menu-item"
                  >
                    <span className="portal-user-menu-icon">
                      <Bell className="h-4 w-4" />
                    </span>
                    <span className="text-sm font-medium">Notificações</span>
                  </Link>
                )}
                <Link
                  href="/portal/rgpd"
                  onClick={requestClose}
                  className="portal-user-menu-item"
                >
                  <span className="portal-user-menu-icon">
                    <Lock className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">RGPD</span>
                    <span className="block text-[11px] text-[color:var(--ui-muted)]">
                      Privacidade e dados
                    </span>
                  </span>
                </Link>
              </nav>
            </>
          )}
        </div>
      </div>
  );

  return (
    <>
      {typeof document !== "undefined" ? createPortal(menu, document.body) : menu}
      {pendenciasDialog}
    </>
  );
}

export { initials as portalUserInitials };
