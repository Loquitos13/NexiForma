"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  Bell,
  ChevronLeft,
  GraduationCap,
  Lock,
  LogOut,
  Palette,
  Settings2,
  ShieldAlert,
  UserRound,
  X,
} from "lucide-react";
import { PortalNotificationsBell } from "@/components/portal/portal-notifications-bell";
import { PortalBackgroundJobsList } from "@/components/portal/portal-background-jobs-center";
import { usePendenciasDocumentacaoConfirm } from "@/components/portal/pendencias-documentacao-dialog";
import { useUiThemeOptional } from "@/components/theme/ui-theme-provider";
import { usePortalNotifications } from "@/lib/client/use-portal-notifications";
import { bffFetch } from "@/lib/client/bff-fetch";
import { logoutSession } from "@/lib/client/logout";
import {
  avisarLogoutDocsObrigatorios,
  fetchDocsObrigatoriosLogoutInfo,
} from "@/lib/client/documentos-obrigatorios-logout";
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
  return "/portal/perfil";
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
 * Menu do avatar (mobile): desce do topo - perfil, notificações, alertas de ação, tema, RGPD, sair.
 */
export function PortalUserMenu({ open, onClose, user }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const uiTheme = useUiThemeOptional();
  const { unreadCount, alertas, dismissAlerta, hasActivity, totalBadgeCount, refresh: refreshNotifs } =
    usePortalNotifications();
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
      void refreshNotifs();
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

      if (user?.role === "formando" || user?.role === "formador") {
        try {
          const docsInfo = await fetchDocsObrigatoriosLogoutInfo(user.role);
          if (docsInfo?.sessoes.length) {
            setBusy(false);
            const ok = await confirmPendencias({
              title: "Documentos obrigatórios em falta",
              question: "Tens a certeza que queres sair (logout) na mesma?",
              sectionTitle: "Documentos por enviar",
              hint:
                "Clica num documento para o enviar. Se saíres na mesma, receberás um email de lembrete e a entidade formadora será notificada.",
              sessoes: docsInfo.sessoes,
              confirmLabel: "Sair na mesma",
              cancelLabel: "Ficar no portal",
            });
            if (!ok) return;
            setBusy(true);
            await avisarLogoutDocsObrigatorios(docsInfo.roleKind).catch(() => undefined);
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
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">O meu perfil</span>
                    <span className="block text-[11px] text-[color:var(--ui-muted)]">
                      Editar dados pessoais
                    </span>
                  </span>
                </Link>

                <Link
                  href="/portal/notificacoes"
                  onClick={requestClose}
                  className="portal-user-menu-item justify-between"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="portal-user-menu-icon relative">
                      <Bell className="h-4 w-4" />
                      {hasActivity ? (
                        <span className="pointer-events-none absolute -top-0.5 -right-0.5 flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pink-400 opacity-75" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-pink-500 shadow-[0_0_6px_rgba(244,63,94,0.9)]" />
                        </span>
                      ) : null}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">Notificações</span>
                      <span className="block text-[11px] text-[color:var(--ui-muted)]">
                        {unreadCount > 0
                          ? `${unreadCount} ${unreadCount === 1 ? "nova por ler" : "novas por ler"}`
                          : "Alertas e avisos do portal"}
                      </span>
                    </span>
                  </div>
                  {hasActivity ? (
                    <span className="flex items-center gap-1.5 rounded-full bg-pink-500/20 border border-pink-500/40 px-2 py-0.5 text-[10px] font-semibold text-pink-300">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-pink-500 shadow-[0_0_6px_rgba(244,63,94,0.9)]" />
                      </span>
                      {totalBadgeCount} nova{totalBadgeCount > 1 ? "s" : ""}
                    </span>
                  ) : null}
                </Link>

                <button
                  type="button"
                  className="portal-user-menu-item w-full text-left"
                  onClick={() => setPanel("prefs")}
                >
                  <span className="portal-user-menu-icon">
                    <Settings2 className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">Preferências</span>
                    <span className="block text-[11px] text-[color:var(--ui-muted)]">
                      Tema e RGPD
                    </span>
                  </span>
                </button>
              </nav>

              {/* Alertas Críticos de Ação em Mobile (integrados junto às notificações) */}
              {alertas.length > 0 ? (
                <div className="mx-2 my-2 rounded-xl border border-amber-500/40 bg-amber-950/40 p-3 shadow-lg ring-1 ring-amber-500/25">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-300">
                        {alertas[0]!.tipo === "inspecao" ? (
                          <ShieldAlert className="h-4 w-4" />
                        ) : alertas[0]!.tipo === "formador" ? (
                          <GraduationCap className="h-4 w-4 text-violet-300" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-red-300" />
                        )}
                      </span>
                      <div>
                        <p className="text-xs font-semibold text-amber-100">
                          {alertas[0]!.tipo === "inspecao"
                            ? "Prioridade DGERT"
                            : alertas[0]!.tipo === "formador"
                              ? "Formador em falta"
                              : "Alerta de ação"}
                        </p>
                        <p className="text-[10px] text-amber-200/70">
                          {alertas[0]!.severidade === "critico"
                            ? "Ação crítica pendente"
                            : "Aviso importante"}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="rounded p-1 text-amber-400/60 hover:text-amber-200"
                      aria-label="Dispensar alerta nesta sessão"
                      onClick={() => dismissAlerta(alertas[0]!.id)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-amber-100/90 leading-snug">
                    <span className="font-semibold text-amber-200">
                      {alertas[0]!.codigoInterno}
                    </span>{" "}
                    – {alertas[0]!.mensagem}
                  </p>
                  {alertas.length > 1 ? (
                    <p className="mt-1 text-[10px] text-amber-300/70">
                      +{alertas.length - 1} outro(s) alerta(s) prioritário(s)
                    </p>
                  ) : null}
                  <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-amber-500/20 pt-2">
                    <Link
                      href={alertas[0]!.accaoUrl}
                      onClick={requestClose}
                      className="inline-flex h-7 items-center justify-center rounded-lg bg-amber-500 px-3 text-xs font-semibold text-amber-950 hover:bg-amber-400 active:scale-95 transition-all"
                    >
                      Resolver agora
                    </Link>
                    <Link
                      href="/portal/notificacoes"
                      onClick={requestClose}
                      className="text-[11px] font-medium text-amber-300 underline hover:text-amber-100"
                    >
                      Ver todas
                    </Link>
                  </div>
                </div>
              ) : null}

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
                    <span className="portal-user-menu-icon mt-0.5 relative">
                      <Bell className="h-4 w-4" />
                      {hasActivity ? (
                        <span className="pointer-events-none absolute -top-0.5 -right-0.5 flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pink-400 opacity-75" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-pink-500" />
                        </span>
                      ) : null}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">Notificações</p>
                        {hasActivity ? (
                          <span className="flex items-center gap-1.5 rounded-full bg-pink-500/20 border border-pink-500/40 px-2 py-0.5 text-[10px] font-semibold text-pink-300">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-pink-500 shadow-[0_0_6px_rgba(244,63,94,0.9)]" />
                            </span>
                            {totalBadgeCount} nova{totalBadgeCount > 1 ? "s" : ""}
                          </span>
                        ) : null}
                      </div>
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
                      <div className="mt-2 empty:hidden">
                        <PortalBackgroundJobsList onAction={requestClose} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <Link
                    href="/portal/notificacoes"
                    onClick={requestClose}
                    className="portal-user-menu-item justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className="portal-user-menu-icon relative">
                        <Bell className="h-4 w-4" />
                        {hasActivity ? (
                          <span className="pointer-events-none absolute -top-0.5 -right-0.5 flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pink-400 opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-pink-500" />
                          </span>
                        ) : null}
                      </span>
                      <span className="text-sm font-medium">Notificações</span>
                    </div>
                    {hasActivity ? (
                      <span className="flex items-center gap-1.5 rounded-full bg-pink-500/20 border border-pink-500/40 px-2 py-0.5 text-[10px] font-semibold text-pink-300">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-pink-500 shadow-[0_0_6px_rgba(244,63,94,0.9)]" />
                        </span>
                        {totalBadgeCount} nova{totalBadgeCount > 1 ? "s" : ""}
                      </span>
                    ) : null}
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
