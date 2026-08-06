"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PortalNotificationsBell } from "@/components/portal/portal-notifications-bell";
import { CronogramaImportIaJobsChip } from "@/components/portal/cronograma-import-ia-jobs-chip";
import { usePendenciasDocumentacaoConfirm } from "@/components/portal/pendencias-documentacao-dialog";
import { bffFetch } from "@/lib/client/bff-fetch";
import { logoutSession } from "@/lib/client/logout";
import { subscribeSessionExpired } from "@/lib/client/session-lifecycle";
import { sessionGoodbyeHref } from "@/components/site/session-goodbye";
import {
  buildPendenciaSessaoHref,
  resolvePendenciaItemFocus,
} from "@/lib/client/pendencias-documentacao-href";

type MeUser = {
  email?: string;
  role?: string;
  kind?: string;
  tenantSlug?: string | null;
  displayName?: string | null;
};

type UserSessionBarProps = {
  area: "portal" | "plataforma";
};

export function UserSessionBar({ area }: UserSessionBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<MeUser | null>(null);
  const [busy, setBusy] = useState(false);
  const { dialog: pendenciasDialog, confirm: confirmPendencias } =
    usePendenciasDocumentacaoConfirm();

  const loadMe = useCallback(async () => {
    const res = await bffFetch("/api/auth/me", { headers: { accept: "application/json" } });
    if (!res.ok) {
      setUser(null);
      return res.status;
    }
    setUser((await res.json()) as MeUser);
    return res.status;
  }, []);

  useEffect(() => {
    void loadMe();
    return subscribeSessionExpired(() => setUser(null));
  }, [loadMe]);

  async function performLogout() {
    const returnTo =
      pathname.startsWith("/portal") || pathname.startsWith("/plataforma")
        ? pathname
        : area === "plataforma"
          ? "/plataforma"
          : "/portal";
    router.push(sessionGoodbyeHref(returnTo, "logout"));
    await logoutSession();
  }

  async function avisarPedagogicoLogout() {
    const avisoRes = await bffFetch(
      "/api/v1/sessoes-formacao/pendencias-documentacao/avisar-pedagogico",
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: "{}",
        // Sobrevive à navegação para a página Adeus.
        keepalive: true,
      },
    );
    if (!avisoRes.ok) {
      console.warn(
        "[logout] aviso pedagógico falhou:",
        avisoRes.status,
        await avisoRes.text().catch(() => ""),
      );
      return;
    }
    const data = (await avisoRes.json().catch(() => null)) as {
      avisado?: boolean;
      emails?: number;
    } | null;
    if (data && data.avisado && (data.emails ?? 0) === 0) {
      console.warn(
        "[logout] aviso pedagógico sem emails entregues (verifica MAIL_REPLY_TO / emails dos gestores)",
      );
    }
  }

  async function onLogout() {
    if (busy) return;
    setBusy(true);
    try {
      if (area === "portal" && user?.role === "formador") {
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
                  const href = buildPendenciaSessaoHref({
                    acaoId: s.acaoId,
                    sessaoId: s.sessaoId,
                    focus,
                  });
                  return {
                    acaoLabel: s.acaoLabel,
                    numeroSessao: s.numeroSessao,
                    href,
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
              // Avisa dep. pedagógico ANTES de revogar a sessão / navegar.
              try {
                await avisarPedagogicoLogout();
              } catch (err) {
                console.warn("[logout] aviso pedagógico erro de rede:", err);
              }
            }
          }
        } catch {
          // Rede/API indisponível - não bloqueia o logout.
        }
      }

      await performLogout();
    } finally {
      setBusy(false);
    }
  }

  const roleLabel = formatRole(user?.role);
  const isPlatform = area === "plataforma";
  const isSuperAdmin = user?.role === "super_admin" && user?.kind === "platform";
  const showStaffPortalTools =
    area === "portal" &&
    (user?.role === "tenant_manager" ||
      user?.role === "comercial" ||
      user?.role === "formador" ||
      user?.role === "coordenador_pedagogico" ||
      user?.role === "coordenador_comercial" ||
      user?.role === "coordenador_financeiro");
  /** Import IA: só roles com acesso à API (formador/comercial recebem 403). */
  const showImportIaJobsChip =
    area === "portal" &&
    (user?.role === "tenant_manager" || user?.role === "coordenador_pedagogico");

  return (
    <>
      <div
        className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-3 py-2 text-xs backdrop-blur-sm sm:px-5 ${
          isPlatform
            ? "bg-[#0c0a14]/90 border-purple-500/15"
            : "bg-[#0f172a]/85 border-slate-700/30"
        } border-b`}
      >
        <div className="flex min-w-0 flex-1 basis-[12rem] items-center gap-2 sm:gap-3">
          <span className="flex min-w-0 items-center gap-1.5 truncate text-slate-400">
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
            </svg>
            <span className="truncate">
              {user?.displayName || user?.email || "A carregar…"}
            </span>
          </span>
          {user?.tenantSlug ? (
            <span className="inline-flex max-w-[8rem] items-center gap-1 truncate text-slate-600 sm:max-w-none">
              <span className="hidden w-1 h-1 rounded-full bg-slate-600 sm:inline-block" />
              <span className="truncate">{user.tenantSlug}</span>
            </span>
          ) : null}
          {roleLabel ? (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
              isPlatform ? "bg-purple-500/10 text-purple-400" : "bg-blue-500/10 text-blue-400"
            }`}>
              {roleLabel}
            </span>
          ) : null}
        </div>

        <div className="portal-action-row flex-shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-3">
          {showImportIaJobsChip ? <CronogramaImportIaJobsChip /> : null}
          {showStaffPortalTools ? <PortalNotificationsBell /> : null}
          {isSuperAdmin && isPlatform ? (
            <Link
              href="/plataforma/conta"
              className="text-slate-400 hover:text-slate-200 transition-colors text-[11px] font-medium"
            >
              Conta
            </Link>
          ) : null}
          <Link
            href={isPlatform ? "/plataforma" : "/portal"}
            className="text-slate-400 hover:text-slate-200 transition-colors text-[11px] font-medium"
          >
            Início
          </Link>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              void onLogout();
            }}
            className="px-2.5 py-1 rounded-md border border-red-500/30 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
          >
            {busy ? "A sair…" : "Sair"}
          </button>
        </div>
      </div>
      {pendenciasDialog}
    </>
  );
}

function formatRole(role?: string): string | null {
  switch (role) {
    case "super_admin": return "Super admin";
    case "tenant_manager": return "Gestor";
    case "coordenador_comercial": return "Coord. Comercial";
    case "coordenador_pedagogico": return "Coord. Pedagógico";
    case "coordenador_financeiro": return "Coord. Financeiro";
    case "comercial": return "Comercial";
    case "formador": return "Formador";
    case "formando": return "Formando";
    default: return role ?? null;
  }
}
