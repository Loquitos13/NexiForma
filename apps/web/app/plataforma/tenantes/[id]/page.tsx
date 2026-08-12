"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Copy,
  Check,
  Key,
  KeyRound,
  ShieldCheck,
  ShieldAlert,
  Shield,
  UserCheck,
  Users,
  Search,
  Eye,
  EyeOff,
  X,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import type { BillingPlanCode } from "@nexiforma/shared";
import { BILLING_ADDON_LABELS, MODULAR_PLAN_CODE } from "@nexiforma/shared";
import { bffFetch } from "@/lib/client/bff-fetch";
import { persistAuthFromResponse } from "@/lib/client/auth-login";
import { formatDatePt } from "@/lib/calendar-date";
import { parseApiError } from "@/lib/ui/backoffice";
import { PageContentSkeleton } from "@/components/ui/page-skeleton";
import {
  TenantSubscriptionForm,
  parseCustomAddons,
  type TenantSubscriptionFormValue,
} from "@/components/plataforma/tenant-subscription-form";
import { SocialLoginSettings } from "@/components/settings/social-login-settings";

type TenantDetail = {
  id: string; slug: string; legalName: string; nif: string; status: string;
  _count: { users: number; acoesFormacao: number; formandos: number; sessoesFormacao: number };
  subscriptions: {
    status: string;
    customAddons?: unknown;
    plan: { name: string; code: string };
  }[];
  subscriptionKeys: { id: string; keyPrefix: string; status: string; expiresAt: string | null }[];
  branding?: {
    logoUrl?: string;
    hasLogo?: boolean;
    companyName?: string;
  };
};

type TenantUser = {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
  active?: boolean;
  mustChangePassword?: boolean;
  mfaEnabled?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

const inputClass = "w-full px-3 py-2 rounded-lg bg-[#0c0a14] border border-purple-500/15 text-sm text-slate-200 placeholder:text-slate-600 outline-none focus:border-purple-500/40 transition-colors";
const btnPrimaryClass = "px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium transition-colors cursor-pointer";
const btnSecondaryClass = "px-3.5 py-2 rounded-lg border border-purple-500/20 text-purple-300 hover:bg-purple-500/10 disabled:opacity-50 text-sm font-medium transition-colors cursor-pointer";

function renderRoleBadge(role: string) {
  switch (role) {
    case "super_admin":
      return (
        <span className="inline-flex items-center rounded-full bg-red-500/10 border border-red-500/30 px-2 py-0.5 text-[10px] font-semibold text-red-300">
          Super Admin
        </span>
      );
    case "tenant_manager":
      return (
        <span className="inline-flex items-center rounded-full bg-blue-500/10 border border-blue-500/30 px-2 py-0.5 text-[10px] font-semibold text-blue-300">
          Gestor de Entidade
        </span>
      );
    case "coordenador_pedagogico":
      return (
        <span className="inline-flex items-center rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
          Coord. Pedagógico
        </span>
      );
    case "coordenador_comercial":
      return (
        <span className="inline-flex items-center rounded-full bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
          Coord. Comercial
        </span>
      );
    case "coordenador_financeiro":
      return (
        <span className="inline-flex items-center rounded-full bg-teal-500/10 border border-teal-500/30 px-2 py-0.5 text-[10px] font-semibold text-teal-300">
          Coord. Financeiro
        </span>
      );
    case "comercial":
      return (
        <span className="inline-flex items-center rounded-full bg-yellow-500/10 border border-yellow-500/30 px-2 py-0.5 text-[10px] font-semibold text-yellow-300">
          Comercial
        </span>
      );
    case "formador":
      return (
        <span className="inline-flex items-center rounded-full bg-indigo-500/10 border border-indigo-500/30 px-2 py-0.5 text-[10px] font-semibold text-indigo-300">
          Formador
        </span>
      );
    case "formando":
      return (
        <span className="inline-flex items-center rounded-full bg-slate-700/50 border border-slate-600/40 px-2 py-0.5 text-[10px] font-medium text-slate-300">
          Formando
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center rounded-full bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 text-[10px] text-purple-300">
          {role}
        </span>
      );
  }
}

export default function TenantDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [impersonateUserId, setImpersonateUserId] = useState("");
  const [impersonateReason, setImpersonateReason] = useState("Suporte tecnico");
  const [impersonateReadOnly, setImpersonateReadOnly] = useState(true);
  const [impBusy, setImpBusy] = useState(false);
  const [intRows, setIntRows] = useState<{ provider: string; mode: string; config: Record<string, string> | null }[]>([]);
  const [intStatus, setIntStatus] = useState<{
    zoom: { ready: boolean; missing: string[] };
    teams: { ready: boolean; missing: string[]; m365TenantId?: string | null };
    platformTeamsAppConfigured?: boolean;
  } | null>(null);
  const [teamsDraft, setTeamsDraft] = useState({ tenantId: "", organizerId: "" });
  const [zoomDraft, setZoomDraft] = useState({ accountId: "", clientId: "", clientSecret: "", userId: "" });
  const [intBusy, setIntBusy] = useState(false);
  const [consentUrl, setConsentUrl] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ slug: "", legalName: "", nif: "" });
  const [editBusy, setEditBusy] = useState(false);
  const [subscriptionForm, setSubscriptionForm] = useState<TenantSubscriptionFormValue>({
    planCode: "starter",
    customAddons: [],
  });
  const [subBusy, setSubBusy] = useState(false);
  const [managerForm, setManagerForm] = useState({
    email: "",
    displayName: "",
    temporaryPassword: "",
    notifyEmail: true,
  });
  const [managerBusy, setManagerBusy] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{
    email: string;
    slug: string;
    temporaryPassword: string;
  } | null>(null);
  const [copiedTempPassword, setCopiedTempPassword] = useState(false);

  // Estados para Gestão e Revogação de Utilizadores
  const [userSearch, setUserSearch] = useState("");
  const [revokeTargetUser, setRevokeTargetUser] = useState<TenantUser | null>(null);
  const [revokeModalOpen, setRevokeModalOpen] = useState(false);
  const [revokeCustomPassword, setRevokeCustomPassword] = useState("");
  const [revokeNotifyEmail, setRevokeNotifyEmail] = useState(true);
  const [revokeForceChange, setRevokeForceChange] = useState(true);
  const [revokeBusy, setRevokeBusy] = useState(false);
  const [revokedResult, setRevokedResult] = useState<{
    email: string;
    displayName: string | null;
    slug: string;
    temporaryPassword: string;
    emailed: boolean;
  } | null>(null);
  const [showRevokedPass, setShowRevokedPass] = useState(false);
  const [copiedRevokedPass, setCopiedRevokedPass] = useState(false);
  const [copiedAllRevoked, setCopiedAllRevoked] = useState(false);

  const [lockoutForm, setLockoutForm] = useState({
    enabled: true,
    maxAttempts: 5,
    windowMinutes: 15,
    lockoutMinutes: 15,
  });
  const [lockoutDefaults, setLockoutDefaults] = useState({
    enabled: true,
    maxAttempts: 5,
    windowMinutes: 15,
    lockoutMinutes: 15,
  });
  const [lockoutHasCustom, setLockoutHasCustom] = useState(false);
  const [lockoutClearEmail, setLockoutClearEmail] = useState("");
  const [lockoutBusy, setLockoutBusy] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoBust, setLogoBust] = useState(0);

  const loadLockout = useCallback(async () => {
    const r = await bffFetch(`/api/v1/control-plane/tenants/${id}/login-lockout`, {
      headers: { accept: "application/json" },
    });
    if (!r.ok) return;
    const data = (await r.json()) as {
      config: {
        enabled?: boolean;
        maxAttempts?: number;
        windowMinutes?: number;
        lockoutMinutes?: number;
      } | null;
      effective: {
        enabled: boolean;
        maxAttempts: number;
        windowMinutes: number;
        lockoutMinutes: number;
      };
      platformDefaults: {
        enabled: boolean;
        maxAttempts: number;
        windowMinutes: number;
        lockoutMinutes: number;
      };
    };
    setLockoutDefaults(data.platformDefaults);
    setLockoutHasCustom(data.config != null);
    setLockoutForm(data.effective);
  }, [id]);

  const loadIntegracoes = useCallback(async () => {
    const [listR, statusR] = await Promise.all([
      bffFetch(`/api/v1/control-plane/tenants/${id}/integracoes`, { headers: { accept: "application/json" } }),
      bffFetch(`/api/v1/control-plane/tenants/${id}/integracoes/oauth/status`, { headers: { accept: "application/json" } }),
    ]);
    if (listR.ok) {
      const list = (await listR.json()) as { provider: string; mode: string; config: Record<string, string> | null }[];
      setIntRows(list);
      const teams = list.find((r) => r.provider === "TEAMS")?.config ?? {};
      const zoom = list.find((r) => r.provider === "ZOOM")?.config ?? {};
      setTeamsDraft({ tenantId: String(teams.tenantId ?? ""), organizerId: String(teams.organizerId ?? "") });
      setZoomDraft({ accountId: String(zoom.accountId ?? ""), clientId: String(zoom.clientId ?? ""), clientSecret: "", userId: String(zoom.userId ?? "") });
    }
    if (statusR.ok) setIntStatus((await statusR.json()) as typeof intStatus);
  }, [id]);

  const load = useCallback(async () => {
    const [tenantR, usersR] = await Promise.all([
      bffFetch(`/api/v1/control-plane/tenants/${id}`, { headers: { accept: "application/json" } }),
      bffFetch(`/api/v1/control-plane/tenants/${id}/users`, { headers: { accept: "application/json" } }),
    ]);
    if (!tenantR.ok) { setError(`HTTP ${tenantR.status}`); return; }
    const t = (await tenantR.json()) as TenantDetail;
    setTenant(t);
    setEditForm({ slug: t.slug, legalName: t.legalName, nif: t.nif });
    const sub = t.subscriptions[0];
    if (sub) {
      setSubscriptionForm({
        planCode: (sub.plan.code as BillingPlanCode) ?? "starter",
        customAddons: parseCustomAddons(sub.customAddons),
      });
    }
    if (usersR.ok) {
      const list = (await usersR.json()) as TenantUser[];
      setUsers(list);
      if (list.length) setImpersonateUserId((prev) => prev || list[0].id);
    }
    await Promise.all([loadIntegracoes(), loadLockout()]);
  }, [id, loadIntegracoes, loadLockout]);

  useEffect(() => { void load(); }, [load]);

  async function setStatus(status: string) {
    const r = await bffFetch(`/api/v1/control-plane/tenants/${id}/status`, {
      method: "PATCH", headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!r.ok) { setError(`HTTP ${r.status}`); return; }
    setMsg(`Estado actualizado para ${status}.`);
    await load();
  }

  async function guardarGestor(e: FormEvent) {
    e.preventDefault();
    if (!managerForm.email.trim()) return;
    setManagerBusy(true);
    setError(null);
    setMsg(null);
    try {
      const r = await bffFetch(`/api/v1/control-plane/tenants/${id}/manager`, {
        method: "POST",
        headers: { "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          email: managerForm.email.trim(),
          displayName: managerForm.displayName.trim() || undefined,
          temporaryPassword: managerForm.temporaryPassword.trim() || undefined,
          notifyEmail: managerForm.notifyEmail,
        }),
      });
      setManagerBusy(false);
      if (!r.ok) {
        setError(await parseApiError(r));
        return;
      }
      const data = (await r.json()) as {
        temporaryPassword?: string;
        email: string;
        slug: string;
      };
      setCreatedCredentials({
        email: data.email,
        slug: data.slug,
        temporaryPassword: data.temporaryPassword ?? managerForm.temporaryPassword.trim(),
      });
      setMsg("Gestor configurado com sucesso com credenciais temporárias.");
      setManagerForm({ email: "", displayName: "", temporaryPassword: "", notifyEmail: true });
      await load();
    } catch {
      setManagerBusy(false);
      setError("Falha de rede ao nomear gestor.");
    }
  }

  async function guardarSubscricao(e: FormEvent) {
    e.preventDefault();
    if (
      subscriptionForm.planCode === MODULAR_PLAN_CODE &&
      subscriptionForm.customAddons.length === 0
    ) {
      setError("Seleccione pelo menos um módulo para o plano só-módulos.");
      return;
    }
    setSubBusy(true);
    setError(null);
    const r = await bffFetch(`/api/v1/control-plane/tenants/${id}/subscription`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        planCode: subscriptionForm.planCode,
        customAddons: subscriptionForm.customAddons,
      }),
    });
    setSubBusy(false);
    if (!r.ok) {
      setError(await parseApiError(r));
      return;
    }
    setMsg("Plano e módulos actualizados.");
    await load();
  }

  async function guardarDados(e: FormEvent) {
    e.preventDefault();
    setEditBusy(true);
    setError(null);
    const r = await bffFetch(`/api/v1/control-plane/tenants/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        slug: editForm.slug.trim(),
        legalName: editForm.legalName.trim(),
        nif: editForm.nif.trim(),
      }),
    });
    setEditBusy(false);
    if (!r.ok) {
      setError(await parseApiError(r));
      return;
    }
    setMsg("Dados do tenant actualizados.");
    await load();
  }

  async function uploadLogo(file: File) {
    setLogoBusy(true);
    setError(null);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await bffFetch(`/api/v1/control-plane/tenants/${id}/logo`, {
        method: "POST",
        body: fd,
      });
      if (!r.ok) {
        setError(await parseApiError(r));
        return;
      }
      setLogoBust(Date.now());
      setMsg("Logótipo do tenant actualizado. Aparece nos documentos gerados pela entidade.");
      await load();
    } finally {
      setLogoBusy(false);
    }
  }

  async function guardarLockout(e: FormEvent) {
    e.preventDefault();
    setLockoutBusy(true);
    setError(null);
    const r = await bffFetch(`/api/v1/control-plane/tenants/${id}/login-lockout`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify(lockoutForm),
    });
    setLockoutBusy(false);
    if (!r.ok) {
      setError(await parseApiError(r));
      return;
    }
    setMsg("Política de lockout actualizada.");
    await loadLockout();
  }

  async function reporLockoutPlataforma() {
    setLockoutBusy(true);
    setError(null);
    const r = await bffFetch(`/api/v1/control-plane/tenants/${id}/login-lockout`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify(lockoutDefaults),
    });
    setLockoutBusy(false);
    if (!r.ok) {
      setError(await parseApiError(r));
      return;
    }
    setMsg("Lockout reposto aos valores globais da plataforma.");
    await loadLockout();
  }

  async function desbloquearUtilizador(e: FormEvent) {
    e.preventDefault();
    if (!lockoutClearEmail.trim()) return;
    setLockoutBusy(true);
    setError(null);
    const r = await bffFetch(`/api/v1/control-plane/tenants/${id}/login-lockout/clear`, {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ email: lockoutClearEmail.trim() }),
    });
    setLockoutBusy(false);
    if (!r.ok) {
      setError(await parseApiError(r));
      return;
    }
    setMsg(`Lockout removido para ${lockoutClearEmail.trim()}.`);
    setLockoutClearEmail("");
  }

  async function arquivarTenant() {
    if (!window.confirm("Arquivar este tenant? Utilizadores deixam de aceder (estado ARCHIVED).")) return;
    setEditBusy(true);
    setError(null);
    const r = await bffFetch(`/api/v1/control-plane/tenants/${id}`, { method: "DELETE" });
    setEditBusy(false);
    if (!r.ok) {
      setError(await parseApiError(r));
      return;
    }
    setMsg("Tenant arquivado.");
    await load();
  }

  async function eliminarPermanente() {
    if (!tenant) return;
    const empty =
      tenant._count.users === 0 &&
      tenant._count.acoesFormacao === 0 &&
      tenant._count.formandos === 0;
    if (!empty) {
      setError("Só é possível eliminar permanentemente tenants sem dados operacionais.");
      return;
    }
    if (!window.confirm("Eliminar permanentemente? Esta acção não pode ser revertida.")) return;
    setEditBusy(true);
    setError(null);
    const r = await bffFetch(`/api/v1/control-plane/tenants/${id}?permanent=true`, { method: "DELETE" });
    setEditBusy(false);
    if (!r.ok) {
      setError(await parseApiError(r));
      return;
    }
    router.push("/plataforma/tenantes");
  }

  async function execRevokePassword(e?: FormEvent) {
    if (e) e.preventDefault();
    if (!revokeTargetUser) return;
    setRevokeBusy(true);
    setError(null);
    try {
      const r = await bffFetch(`/api/v1/control-plane/tenants/${id}/users/${revokeTargetUser.id}/revoke-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          customPassword: revokeCustomPassword.trim() || undefined,
          notifyEmail: revokeNotifyEmail,
          forceChangeOnLogin: revokeForceChange,
        }),
      });
      if (!r.ok) {
        setError(await parseApiError(r));
        return;
      }
      const data = (await r.json()) as {
        ok: boolean;
        email: string;
        displayName?: string | null;
        tenantSlug: string;
        temporaryPassword?: string;
        emailed: boolean;
      };

      setRevokeModalOpen(false);
      setRevokedResult({
        email: data.email,
        displayName: data.displayName ?? revokeTargetUser.displayName,
        slug: data.tenantSlug || tenant?.slug || "",
        temporaryPassword: data.temporaryPassword || "",
        emailed: data.emailed,
      });
      setRevokeCustomPassword("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao revogar password.");
    } finally {
      setRevokeBusy(false);
    }
  }

  async function personificarUser(targetUserId: string) {
    setImpersonateUserId(targetUserId);
    setImpBusy(true);
    setError(null);
    const r = await bffFetch("/api/auth/impersonation/start", {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        tenantId: id,
        targetUserId,
        reason: impersonateReason.trim() || "Suporte tecnico",
        readOnly: impersonateReadOnly,
      }),
    });
    setImpBusy(false);
    if (!r.ok) {
      const d = (await r.json().catch(() => null)) as { message?: string } | null;
      setError(d?.message ?? `HTTP ${r.status}`);
      return;
    }
    await persistAuthFromResponse(r);
    router.push("/portal");
    router.refresh();
  }

  async function personificar() {
    if (!impersonateUserId || !impersonateReason.trim()) return;
    await personificarUser(impersonateUserId);
  }

  async function saveTeamsIntegracao() {
    setIntBusy(true); setError(null);
    const r = await bffFetch(`/api/v1/control-plane/tenants/${id}/integracoes`, {
      method: "POST", headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        provider: "TEAMS",
        mode: "DISABLED",
        config: {
          tenantId: teamsDraft.tenantId.trim(),
          organizerId: teamsDraft.organizerId.trim(),
        },
      }),
    });
    setIntBusy(false);
    if (!r.ok) { const d = (await r.json().catch(() => null)) as { message?: string } | null; setError(d?.message ?? `Integracao Teams: HTTP ${r.status}`); return; }
    setMsg("Microsoft 365 ligado a este tenant. Testa a ligação e activa OAuth quando estiver OK.");
    await loadIntegracoes();
  }

  async function saveZoomIntegracao() {
    setIntBusy(true); setError(null);
    const cfg = { ...zoomDraft }; if (!cfg.clientSecret) delete (cfg as { clientSecret?: string }).clientSecret;
    const r = await bffFetch(`/api/v1/control-plane/tenants/${id}/integracoes`, {
      method: "POST", headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ provider: "ZOOM", mode: "OAUTH", config: cfg }),
    });
    setIntBusy(false);
    if (!r.ok) { const d = (await r.json().catch(() => null)) as { message?: string } | null; setError(d?.message ?? `Integracao Zoom: HTTP ${r.status}`); return; }
    setMsg("Zoom ligado a este tenant.");
    await loadIntegracoes();
  }

  async function testarIntegracao(provider: "ZOOM" | "TEAMS") {
    setIntBusy(true); setError(null);
    const r = await bffFetch(`/api/v1/control-plane/tenants/${id}/integracoes/testar?provider=${provider}`, { method: "POST", headers: { accept: "application/json" } });
    setIntBusy(false);
    if (!r.ok) { const d = (await r.json().catch(() => null)) as { message?: string } | null; setError(d?.message ?? `HTTP ${r.status}`); return; }
    setMsg(((await r.json()) as { message?: string }).message ?? `${provider} OK`);
  }

  async function gerarConsentUrl() {
    if (!teamsDraft.tenantId.trim()) { setError("Indica o Azure Tenant ID do cliente."); return; }
    const r = await bffFetch(`/api/v1/control-plane/tenants/${id}/integracoes/microsoft/admin-consent-url?m365TenantId=${encodeURIComponent(teamsDraft.tenantId.trim())}`, { headers: { accept: "application/json" } });
    if (!r.ok) { setError(`Consent URL: HTTP ${r.status}`); return; }
    setConsentUrl(((await r.json()) as { url: string }).url);
  }

  async function gerarChave() {
    const r = await bffFetch(`/api/v1/control-plane/tenants/${id}/subscription-keys`, {
      method: "POST", headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ expiresInDays: 365 }),
    });
    if (!r.ok) { setError(`HTTP ${r.status}`); return; }
    const data = (await r.json()) as { key?: string };
    setNewKey(data.key ?? null);
    setMsg("Chave de subscricao criada.");
    await load();
  }

  if (!tenant && !error) {
    return <PageContentSkeleton variant="detail" />;
  }

  return (
    <div className="max-w-4xl space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-50">{tenant?.legalName ?? "..."}</h1>
        <p className="text-sm text-slate-500 mt-1">
          <code className="text-purple-300">{tenant?.slug}</code> · NIF {tenant?.nif} ·{" "}
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-purple-500/10 text-purple-300 border border-purple-500/20">
            {tenant?.status}
          </span>
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href={`/plataforma/tenantes/${id}/operacoes`}
            className="rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-500"
          >
            Centro de suporte do tenant
          </Link>
          <Link
            href={`/plataforma/tenantes/${id}/faturacao`}
            className="rounded-lg border border-purple-500/35 bg-purple-500/10 px-3 py-1.5 text-sm font-medium text-purple-200 hover:bg-purple-500/20"
          >
            Faturação AT
          </Link>
        </div>
      </div>

      {error ? <div className="flex items-start gap-2.5 rounded-xl bg-red-950/40 border border-red-500/25 px-4 py-3"><p className="text-sm text-red-300">{error}</p></div> : null}
      {msg ? <div className="flex items-start gap-2.5 rounded-xl bg-green-950/30 border border-green-500/25 px-4 py-3"><p className="text-sm text-green-300">{msg}</p></div> : null}
      {newKey ? (
        <div className="rounded-xl bg-yellow-500/10 border border-yellow-500/20 px-4 py-3">
          <p className="text-sm font-medium text-yellow-200">Chave (copiar agora):</p>
          <code className="text-xs text-yellow-300 break-all mt-1 block">{newKey}</code>
        </div>
      ) : null}

      {tenant ? (
        <>
          {/* Dados */}
          <div className="rounded-2xl bg-[#0c0a14]/80 border border-purple-500/10 p-5">
            <h2 className="text-sm font-semibold text-purple-200 mb-3">Dados do tenant</h2>
            <form onSubmit={(e) => void guardarDados(e)} className="grid gap-3 max-w-md">
              <label className="grid gap-1 text-xs text-slate-500">
                Razão social
                <input className={inputClass} required value={editForm.legalName}
                  onChange={(e) => setEditForm((f) => ({ ...f, legalName: e.target.value }))} />
              </label>
              <label className="grid gap-1 text-xs text-slate-500">
                Slug
                <input className={inputClass} required pattern="[a-z0-9]+(-[a-z0-9]+)*" value={editForm.slug}
                  onChange={(e) => setEditForm((f) => ({ ...f, slug: e.target.value.toLowerCase() }))} />
              </label>
              <label className="grid gap-1 text-xs text-slate-500">
                NIF
                <input className={inputClass} required pattern="\d{9}" value={editForm.nif}
                  onChange={(e) => setEditForm((f) => ({ ...f, nif: e.target.value.replace(/\D/g, "").slice(0, 9) }))} />
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={editBusy} className={btnPrimaryClass}>
                  {editBusy ? "A guardar…" : "Guardar alterações"}
                </button>
                {tenant.status !== "ARCHIVED" ? (
                  <button type="button" disabled={editBusy} onClick={() => void arquivarTenant()}
                    className="px-3.5 py-2 rounded-lg border border-yellow-500/30 text-yellow-300 text-sm hover:bg-yellow-500/10">
                    Arquivar
                  </button>
                ) : null}
                {tenant._count.users === 0 && tenant._count.acoesFormacao === 0 ? (
                  <button type="button" disabled={editBusy} onClick={() => void eliminarPermanente()}
                    className="px-3.5 py-2 rounded-lg border border-red-500/30 text-red-400 text-sm hover:bg-red-500/10">
                    Eliminar permanentemente
                  </button>
                ) : null}
              </div>
            </form>
          </div>

          {/* Logótipo da entidade */}
          <div className="rounded-2xl bg-[#0c0a14]/80 border border-purple-500/10 p-5">
            <h2 className="text-sm font-semibold text-purple-200 mb-1">Logótipo da entidade</h2>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Cada tenant tem o seu logo. Aparece em faturas, propostas, cronogramas, presenças,
              sumários, certificados e outros documentos gerados.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              {tenant.branding?.hasLogo || tenant.branding?.logoUrl ? (
                <img
                  src={`/api/v1/control-plane/tenants/${id}/logo${logoBust ? `?t=${logoBust}` : ""}`}
                  alt="Logótipo do tenant"
                  className="h-14 max-w-[180px] object-contain rounded-lg bg-white/95 px-2 py-1"
                />
              ) : (
                <div className="h-14 w-32 rounded-lg border border-dashed border-purple-500/25 flex items-center justify-center text-xs text-slate-500">
                  Sem logo
                </div>
              )}
              <div>
                <input
                  ref={logoRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadLogo(f);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  disabled={logoBusy}
                  onClick={() => logoRef.current?.click()}
                  className={btnSecondaryClass}
                >
                  {logoBusy ? "A carregar…" : "Carregar logo"}
                </button>
              </div>
            </div>
          </div>

          <SocialLoginSettings endpoint={`/api/v1/control-plane/tenants/${id}/social-login`} />

          {/* Lockout de login */}
          <div className="rounded-2xl bg-[#0c0a14]/80 border border-amber-500/15 p-5">
            <h2 className="text-sm font-semibold text-amber-200 mb-1">Lockout de login</h2>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Bloqueio temporário após tentativas falhadas no login deste tenant. Valores globais da plataforma:{" "}
              {lockoutDefaults.maxAttempts} tentativas / {lockoutDefaults.windowMinutes} min, bloqueio{" "}
              {lockoutDefaults.lockoutMinutes} min.
              {lockoutHasCustom ? (
                <span className="block mt-1 text-amber-400/90">Este tenant tem política personalizada.</span>
              ) : (
                <span className="block mt-1 text-slate-600">A usar valores globais (sem override guardado).</span>
              )}
            </p>
            <form onSubmit={(e) => void guardarLockout(e)} className="grid gap-3 max-w-md">
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={lockoutForm.enabled}
                  onChange={(e) => setLockoutForm((f) => ({ ...f, enabled: e.target.checked }))}
                  className="rounded border-purple-500/30"
                />
                Activar lockout após credenciais inválidas
              </label>
              <label className="grid gap-1 text-xs text-slate-500">
                Tentativas máximas (3–20)
                <input
                  type="number"
                  min={3}
                  max={20}
                  required
                  disabled={!lockoutForm.enabled}
                  className={inputClass}
                  value={lockoutForm.maxAttempts}
                  onChange={(e) =>
                    setLockoutForm((f) => ({ ...f, maxAttempts: Number(e.target.value) || f.maxAttempts }))
                  }
                />
              </label>
              <label className="grid gap-1 text-xs text-slate-500">
                Janela de contagem (minutos, 1–60)
                <input
                  type="number"
                  min={1}
                  max={60}
                  required
                  disabled={!lockoutForm.enabled}
                  className={inputClass}
                  value={lockoutForm.windowMinutes}
                  onChange={(e) =>
                    setLockoutForm((f) => ({ ...f, windowMinutes: Number(e.target.value) || f.windowMinutes }))
                  }
                />
              </label>
              <label className="grid gap-1 text-xs text-slate-500">
                Duração do bloqueio (minutos, 1–1440)
                <input
                  type="number"
                  min={1}
                  max={1440}
                  required
                  disabled={!lockoutForm.enabled}
                  className={inputClass}
                  value={lockoutForm.lockoutMinutes}
                  onChange={(e) =>
                    setLockoutForm((f) => ({ ...f, lockoutMinutes: Number(e.target.value) || f.lockoutMinutes }))
                  }
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={lockoutBusy} className={btnPrimaryClass}>
                  {lockoutBusy ? "A guardar…" : "Guardar política"}
                </button>
                <button
                  type="button"
                  disabled={lockoutBusy}
                  onClick={() => void reporLockoutPlataforma()}
                  className={btnSecondaryClass}
                >
                  Repor valores globais
                </button>
              </div>
            </form>
            <form onSubmit={(e) => void desbloquearUtilizador(e)} className="mt-5 pt-5 border-t border-amber-500/10 max-w-md space-y-2">
              <h3 className="text-sm font-medium text-slate-300">Desbloquear utilizador</h3>
              <p className="text-xs text-slate-500">
                Remove o bloqueio activo para um email neste tenant (suporte).
              </p>
              <input
                type="email"
                required
                placeholder="email@empresa.pt"
                className={inputClass}
                value={lockoutClearEmail}
                onChange={(e) => setLockoutClearEmail(e.target.value)}
              />
              <button type="submit" disabled={lockoutBusy} className={btnSecondaryClass}>
                Desbloquear agora
              </button>
            </form>
          </div>

          {/* Plano e módulos */}
          <div className="rounded-2xl bg-[#0c0a14]/80 border border-teal-500/15 p-5">
            <h2 className="text-sm font-semibold text-teal-200 mb-1">Plano e módulos</h2>
            <p className="text-xs text-slate-500 mb-4">
              Estado actual: {tenant.subscriptions[0]?.plan.name ?? "–"} ({tenant.subscriptions[0]?.status ?? "–"})
              {tenant.subscriptions[0]?.customAddons &&
              Array.isArray(tenant.subscriptions[0].customAddons) &&
              tenant.subscriptions[0].customAddons.length > 0 ? (
                <span className="block mt-1 text-teal-400/90">
                  Módulos:{" "}
                  {parseCustomAddons(tenant.subscriptions[0].customAddons)
                    .map((c) => BILLING_ADDON_LABELS[c])
                    .join(", ")}
                </span>
              ) : null}
            </p>
            <form onSubmit={(e) => void guardarSubscricao(e)} className="max-w-lg space-y-3">
              <TenantSubscriptionForm
                value={subscriptionForm}
                onChange={setSubscriptionForm}
                inputClass={inputClass}
                compact
              />
              <button type="submit" disabled={subBusy} className={btnPrimaryClass}>
                {subBusy ? "A guardar…" : "Actualizar plano e módulos"}
              </button>
            </form>
          </div>

          {/* Gestor da entidade (Nomear / Sobrepor) */}
          <div className="rounded-2xl bg-[#0c0a14]/80 border border-blue-500/15 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <h2 className="text-sm font-semibold text-blue-200 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-blue-400" />
                Gestor da entidade (Nomear / Sobrepor)
              </h2>
              {users.filter((u) => u.role === "ADMIN").length > 0 ? (
                <span className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                  Gestor atual: {users.filter((u) => u.role === "ADMIN").map((u) => u.email).join(", ")}
                </span>
              ) : (
                <span className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
                  Sem gestor atribuído
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Define ou sobrepõe o gestor desta entidade diretamente sem necessidade de link de convite.
              O sistema gera credenciais temporárias para o gestor aceder em <code className="text-purple-300">/login</code> com o slug <code className="text-purple-300">{tenant.slug}</code>.
              No primeiro acesso, ser-lhe-á solicitado que defina uma nova palavra-passe definitiva.
            </p>

            {createdCredentials ? (
              <div className="mb-5 p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <Key className="h-4 w-4" />
                    Credenciais Temporárias Criadas
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const text = `Slug: ${createdCredentials.slug}\nEmail: ${createdCredentials.email}\nPassword temporária: ${createdCredentials.temporaryPassword}`;
                      void navigator.clipboard.writeText(text);
                      setCopiedTempPassword(true);
                      setTimeout(() => setCopiedTempPassword(false), 2500);
                    }}
                    className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/40 text-emerald-100 transition-colors"
                  >
                    {copiedTempPassword ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-300" />
                        Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        Copiar credenciais
                      </>
                    )}
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono">
                  <div className="p-2 rounded bg-black/40 border border-emerald-500/20">
                    <span className="block text-[10px] text-emerald-400/70 font-sans">Slug</span>
                    <span className="text-emerald-100">{createdCredentials.slug}</span>
                  </div>
                  <div className="p-2 rounded bg-black/40 border border-emerald-500/20">
                    <span className="block text-[10px] text-emerald-400/70 font-sans">Email</span>
                    <span className="text-emerald-100">{createdCredentials.email}</span>
                  </div>
                  <div className="p-2 rounded bg-black/40 border border-emerald-500/20">
                    <span className="block text-[10px] text-emerald-400/70 font-sans">Password temporária</span>
                    <span className="text-emerald-300 font-bold">{createdCredentials.temporaryPassword}</span>
                  </div>
                </div>
                <p className="text-[11px] text-emerald-400/80">
                  O gestor já pode entrar no sistema com estas credenciais. No primeiro login, terá de definir a palavra-passe permanente.
                </p>
              </div>
            ) : null}

            <form onSubmit={(e) => void guardarGestor(e)} className="grid gap-3 max-w-md">
              <label className="grid gap-1 text-xs text-slate-400">
                Email do gestor *
                <input
                  type="email"
                  required
                  placeholder="gestor@empresa.pt"
                  className={inputClass}
                  value={managerForm.email}
                  onChange={(e) => setManagerForm((f) => ({ ...f, email: e.target.value }))}
                />
              </label>
              <label className="grid gap-1 text-xs text-slate-400">
                Nome a mostrar (opcional)
                <input
                  placeholder="Nome do gestor"
                  className={inputClass}
                  value={managerForm.displayName}
                  onChange={(e) => setManagerForm((f) => ({ ...f, displayName: e.target.value }))}
                />
              </label>
              <label className="grid gap-1 text-xs text-slate-400">
                Palavra-passe temporária personalizada (opcional)
                <input
                  type="password"
                  placeholder="Deixar vazio para gerar automaticamente"
                  className={inputClass}
                  value={managerForm.temporaryPassword}
                  onChange={(e) => setManagerForm((f) => ({ ...f, temporaryPassword: e.target.value }))}
                />
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={managerForm.notifyEmail}
                  onChange={(e) => setManagerForm((f) => ({ ...f, notifyEmail: e.target.checked }))}
                  className="rounded border-purple-500/30 bg-[#0c0a14] accent-blue-600"
                />
                Enviar email ao gestor com as credenciais temporárias
              </label>
              <div className="pt-2">
                <button type="submit" disabled={managerBusy} className={btnPrimaryClass}>
                  {managerBusy ? "A configurar…" : "Nomear / Sobrepor Gestor"}
                </button>
              </div>
            </form>
          </div>

          {/* Metrics */}
          <div className="rounded-2xl bg-[#0c0a14]/80 border border-purple-500/10 p-5">
            <h2 className="text-sm font-semibold text-purple-200 mb-3">Metricas</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <MiniStat label="Utilizadores" value={tenant._count.users} />
              <MiniStat label="Accoes" value={tenant._count.acoesFormacao} />
              <MiniStat label="Formandos" value={tenant._count.formandos} />
              <MiniStat label="Sessoes" value={tenant._count.sessoesFormacao} />
            </div>
            <p className="text-xs text-slate-500 mt-3">
              Subscricao: {tenant.subscriptions[0]?.plan.name ?? "–"} ({tenant.subscriptions[0]?.status ?? "–"})
            </p>
          </div>

          {/* Status */}
          <div className="rounded-2xl bg-[#0c0a14]/80 border border-purple-500/10 p-5">
            <h2 className="text-sm font-semibold text-purple-200 mb-3">Estado do tenant</h2>
            <div className="flex flex-wrap gap-2">
              {["ACTIVE", "TRIAL", "SUSPENDED", "ARCHIVED"].map((s) => (
                <button key={s} type="button" onClick={() => void setStatus(s)}
                  className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    tenant.status === s
                      ? "bg-purple-600/30 border border-purple-500/40 text-purple-200"
                      : "border border-purple-500/15 text-slate-400 hover:bg-purple-500/10"
                  }`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Utilizadores do Tenant & Revogação de Passwords */}
          <div className="rounded-2xl bg-[#0c0a14]/80 border border-purple-500/20 p-5 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-base font-semibold text-purple-200 flex items-center gap-2">
                  <Users className="h-4.5 w-4.5 text-purple-400" />
                  Utilizadores do Tenant
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Lista de todos os utilizadores deste inquilino. Pode revogar a palavra-passe, gerar credenciais temporárias ou personificar o utilizador.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-purple-950/60 border border-purple-500/30 px-3 py-1 text-xs font-semibold text-purple-300">
                  {users.length} {users.length === 1 ? "utilizador registado" : "utilizadores registados"}
                </span>
              </div>
            </div>

            {/* Barra de Pesquisa de Utilizadores */}
            <div className="mb-4">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Pesquisar por email, nome ou papel…"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-[#0c0a14] border border-purple-500/15 text-xs text-slate-200 placeholder:text-slate-600 outline-none focus:border-purple-500/40 transition-colors"
                />
              </div>
            </div>

            {/* Tabela de Utilizadores */}
            {users.length === 0 ? (
              <div className="rounded-xl border border-dashed border-purple-500/20 p-6 text-center text-xs text-slate-500">
                Nenhum utilizador registado neste tenant.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-purple-500/15">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-[#120e24] text-[11px] font-semibold text-slate-400 border-b border-purple-500/15">
                    <tr>
                      <th className="px-3.5 py-2.5">Utilizador</th>
                      <th className="px-3 py-2.5">Papel / Função</th>
                      <th className="px-3 py-2.5">Estado</th>
                      <th className="px-3 py-2.5 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-purple-500/10">
                    {users
                      .filter((u) => {
                        if (!userSearch.trim()) return true;
                        const term = userSearch.toLowerCase();
                        return (
                          u.email.toLowerCase().includes(term) ||
                          (u.displayName && u.displayName.toLowerCase().includes(term)) ||
                          u.role.toLowerCase().includes(term)
                        );
                      })
                      .map((u) => (
                        <tr key={u.id} className="hover:bg-purple-950/20 transition-colors">
                          <td className="px-3.5 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="h-7 w-7 rounded-full bg-purple-900/50 border border-purple-500/30 flex items-center justify-center text-[10px] font-bold text-purple-200">
                                {(u.displayName || u.email).slice(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <span className="font-medium text-slate-200 block truncate">
                                  {u.displayName || "Sem nome"}
                                </span>
                                <span className="text-[11px] text-slate-400 font-mono block truncate">
                                  {u.email}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            {renderRoleBadge(u.role)}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {u.mustChangePassword ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-[10px] text-amber-300 font-medium">
                                  <KeyRound className="h-2.5 w-2.5" /> A aguardar nova pass
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] text-emerald-300 font-medium">
                                  <Check className="h-2.5 w-2.5" /> Ativo
                                </span>
                              )}
                              {u.mfaEnabled ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 border border-blue-500/30 px-2 py-0.5 text-[10px] text-blue-300 font-medium" title="MFA / 2FA Ativo">
                                  <Shield className="h-2.5 w-2.5" /> 2FA
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setRevokeTargetUser(u);
                                  setRevokeCustomPassword("");
                                  setRevokeModalOpen(true);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-500/30 bg-red-950/30 hover:bg-red-900/40 text-red-200 text-xs font-medium transition-colors shadow-sm cursor-pointer"
                                title="Revogar palavra-passe e gerar credenciais temporárias"
                              >
                                <KeyRound className="h-3 w-3 text-red-400" />
                                <span>Revogar Password</span>
                              </button>
                              <button
                                type="button"
                                disabled={impBusy}
                                onClick={() => void personificarUser(u.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-yellow-500/30 bg-yellow-950/30 hover:bg-yellow-900/40 text-yellow-200 text-xs font-medium transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                                title="Personificar utilizador (Entrar como)"
                              >
                                <UserCheck className="h-3 w-3 text-yellow-400" />
                                <span>Entrar</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Modal de Confirmação de Revogação de Password */}
          {revokeModalOpen && revokeTargetUser ? (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
              <div className="w-full max-w-md rounded-2xl border border-red-500/30 bg-[#0c0a14] p-5 shadow-2xl text-slate-200 ring-1 ring-red-500/20">
                <div className="flex items-start justify-between gap-3 border-b border-red-500/20 pb-3 mb-4">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/20 text-red-400">
                      <ShieldAlert className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-red-100">Revogar Palavra-passe</h3>
                      <p className="text-xs text-slate-400 truncate">{revokeTargetUser.email}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRevokeModalOpen(false)}
                    className="text-slate-400 hover:text-slate-200 transition-colors p-1"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="rounded-xl bg-red-950/20 border border-red-500/20 p-3 mb-4 text-xs text-red-200/90 leading-relaxed">
                  <p className="font-semibold flex items-center gap-1.5 text-red-300 mb-1">
                    <AlertTriangle className="h-3.5 w-3.5" /> Atenção:
                  </p>
                  Esta ação irá <strong>revogar a palavra-passe atual</strong> e desconectar todas as sessões ativas deste utilizador. Será gerada uma nova palavra-passe temporária.
                </div>

                <form onSubmit={(e) => void execRevokePassword(e)} className="space-y-3">
                  <label className="grid gap-1 text-xs text-slate-400">
                    Palavra-passe temporária personalizada (opcional)
                    <input
                      type="password"
                      placeholder="Deixar vazio para gerar aleatória segura"
                      className={inputClass}
                      value={revokeCustomPassword}
                      onChange={(e) => setRevokeCustomPassword(e.target.value)}
                    />
                  </label>

                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={revokeForceChange}
                      onChange={(e) => setRevokeForceChange(e.target.checked)}
                      className="rounded border-purple-500/30 bg-[#0c0a14] accent-red-600"
                    />
                    Obrigar a definir nova palavra-passe no próximo início de sessão
                  </label>

                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={revokeNotifyEmail}
                      onChange={(e) => setRevokeNotifyEmail(e.target.checked)}
                      className="rounded border-purple-500/30 bg-[#0c0a14] accent-red-600"
                    />
                    Enviar email ao utilizador com a nova password temporária
                  </label>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-purple-500/15 mt-4">
                    <button
                      type="button"
                      disabled={revokeBusy}
                      onClick={() => setRevokeModalOpen(false)}
                      className={btnSecondaryClass}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={revokeBusy}
                      className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-md"
                    >
                      {revokeBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
                      <span>{revokeBusy ? "A revogar…" : "Confirmar e Revogar"}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : null}

          {/* Modal de Sucesso: Credenciais Temporárias Desencriptadas */}
          {revokedResult ? (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
              <div className="w-full max-w-lg rounded-2xl border border-emerald-500/40 bg-[#0c0a14] p-6 shadow-2xl text-slate-200 ring-1 ring-emerald-500/30">
                <div className="flex items-start justify-between gap-3 border-b border-emerald-500/20 pb-3 mb-4">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
                      <ShieldCheck className="h-6 w-6" />
                    </span>
                    <div>
                      <h3 className="text-base font-semibold text-emerald-100">Password Revogada com Sucesso</h3>
                      <p className="text-xs text-slate-400">Credenciais temporárias geradas</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRevokedResult(null)}
                    className="text-slate-400 hover:text-slate-200 transition-colors p-1"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <p className="text-xs text-slate-300 mb-4 leading-relaxed">
                  A palavra-passe do utilizador <strong className="text-emerald-300">{revokedResult.email}</strong> foi revogada com sucesso. Copie as credenciais abaixo para fornecer ao utilizador ou à equipa de suporte:
                </p>

                <div className="space-y-2.5 bg-black/50 rounded-xl border border-emerald-500/20 p-4 mb-4 font-mono text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-sans text-[11px]">Tenant Slug:</span>
                    <span className="text-emerald-200 font-semibold">{revokedResult.slug}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-sans text-[11px]">Email:</span>
                    <span className="text-emerald-200">{revokedResult.email}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                    <span className="text-slate-400 font-sans text-[11px]">Password Temporária:</span>
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-300 font-bold text-sm tracking-wide">
                        {showRevokedPass ? revokedResult.temporaryPassword : "••••••••••••"}
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowRevokedPass((v) => !v)}
                        className="text-slate-400 hover:text-slate-200 p-1 transition-colors"
                        title={showRevokedPass ? "Ocultar" : "Mostrar"}
                      >
                        {showRevokedPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard.writeText(revokedResult.temporaryPassword);
                          setCopiedRevokedPass(true);
                          setTimeout(() => setCopiedRevokedPass(false), 2000);
                        }}
                        className="inline-flex items-center gap-1 rounded bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/40 text-emerald-200 text-[11px] px-2 py-0.5 transition-colors"
                      >
                        {copiedRevokedPass ? <Check className="h-3 w-3 text-emerald-300" /> : <Copy className="h-3 w-3" />}
                        <span>{copiedRevokedPass ? "Copiado!" : "Copiar"}</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      const text = `Tenant: ${revokedResult.slug}\nEmail: ${revokedResult.email}\nPassword temporária: ${revokedResult.temporaryPassword}\nLogin: https://app.nexiforma.pt/login`;
                      void navigator.clipboard.writeText(text);
                      setCopiedAllRevoked(true);
                      setTimeout(() => setCopiedAllRevoked(false), 2000);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs text-purple-300 hover:text-purple-100 transition-colors"
                  >
                    {copiedAllRevoked ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copiedAllRevoked ? "Todas as credenciais copiadas!" : "Copiar resumo completo"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRevokedResult(null)}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
                  >
                    Concluir
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {/* Impersonation */}
          <div className="rounded-2xl bg-[#0c0a14]/80 border border-yellow-500/15 p-5">
            <h2 className="text-sm font-semibold text-yellow-200 mb-2">Personificação Global</h2>
            <p className="text-xs text-slate-500 mb-4">Entrar no portal do tenant como utilizador seleccionado (auditado, read-only por defeito).</p>
            <div className="space-y-3 max-w-md">
              <select value={impersonateUserId} onChange={(e) => setImpersonateUserId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#0c0a14] border border-yellow-500/20 text-sm text-slate-200 outline-none focus:border-yellow-500/40 transition-colors">
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.email} ({u.role})</option>
                ))}
              </select>
              <input value={impersonateReason} onChange={(e) => setImpersonateReason(e.target.value)} placeholder="Motivo (obrigatorio)"
                className={inputClass} />
              <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
                <input type="checkbox" checked={impersonateReadOnly} onChange={(e) => setImpersonateReadOnly(e.target.checked)}
                  className="rounded border-purple-500/30 bg-[#0c0a14] accent-yellow-500" />
                Read-only
              </label>
              <button type="button" disabled={impBusy || users.length === 0} onClick={() => void personificar()}
                className="px-4 py-2 rounded-lg bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors">
                {impBusy ? "A iniciar..." : "Personificar utilizador"}
              </button>
            </div>
          </div>

          {/* Integrations */}
          <div className="rounded-2xl bg-[#0c0a14]/80 border border-emerald-500/15 p-5">
            <h2 className="text-sm font-semibold text-emerald-200 mb-2">Salas reais – Microsoft Teams & Zoom</h2>
            <p className="text-xs text-slate-500 mb-4">Configuracao por cliente. A app Microsoft e unica da NexiForma; ligas o tenant M365 do cliente.</p>

            {intStatus ? (
              <div className="flex flex-wrap gap-3 text-[11px] mb-4">
                <span className={`px-2 py-1 rounded-md ${intStatus.platformTeamsAppConfigured ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                  App Teams: {intStatus.platformTeamsAppConfigured ? "OK" : "falta .env"}
                </span>
                <span className={`px-2 py-1 rounded-md ${intStatus.teams.ready ? "bg-emerald-500/10 text-emerald-400" : "bg-yellow-500/10 text-yellow-400"}`}>
                  Tenant Teams: {intStatus.teams.ready ? "pronto" : intStatus.teams.missing.join(", ")}
                </span>
                <span className={`px-2 py-1 rounded-md ${intStatus.zoom.ready ? "bg-emerald-500/10 text-emerald-400" : "bg-yellow-500/10 text-yellow-400"}`}>
                  Zoom: {intStatus.zoom.ready ? "pronto" : intStatus.zoom.missing.join(", ")}
                </span>
              </div>
            ) : null}

            {/* Teams */}
            <div className="mb-5">
              <h3 className="text-sm font-medium text-slate-300 mb-2.5">Microsoft 365 (por tenant cliente)</h3>
              <p className="text-xs text-slate-500 mb-2.5 leading-relaxed">
                Usa o <strong className="text-slate-400">ID do inquilino</strong> do Entra ID do cliente (portal Azure →
                Entra ID → Propriedades).{" "}
                <strong className="text-amber-400/90">Não</strong> uses o UUID desta página NexiForma (
                <code className="text-purple-300/80">{id.slice(0, 8)}…</code>).
              </p>
              <div className="space-y-2.5 max-w-md">
                <input placeholder="Azure Tenant ID do cliente" value={teamsDraft.tenantId}
                  onChange={(e) => setTeamsDraft((p) => ({ ...p, tenantId: e.target.value }))} className={inputClass} />
                <input placeholder="Organizador (email M365)" value={teamsDraft.organizerId}
                  onChange={(e) => setTeamsDraft((p) => ({ ...p, organizerId: e.target.value }))} className={inputClass} />
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={btnPrimaryClass} disabled={intBusy} onClick={() => void saveTeamsIntegracao()}>Guardar Teams</button>
                  <button type="button" className={btnSecondaryClass} disabled={intBusy} onClick={() => void gerarConsentUrl()}>Link consentimento</button>
                  <button type="button" className={btnSecondaryClass} disabled={intBusy} onClick={() => void testarIntegracao("TEAMS")}>Testar</button>
                </div>
              </div>
              {consentUrl ? (
                <p className="mt-2 text-xs text-yellow-200 break-all">
                  Enviar ao IT do cliente:{" "}
                  <a href={consentUrl} target="_blank" rel="noopener noreferrer" className="text-purple-400 underline">{consentUrl}</a>
                </p>
              ) : null}
            </div>

            {/* Zoom */}
            <div>
              <h3 className="text-sm font-medium text-slate-300 mb-2.5">Zoom (conta do cliente)</h3>
              <div className="space-y-2.5 max-w-md">
                {(["accountId", "clientId", "clientSecret", "userId"] as const).map((k) => (
                  <input key={k} type={k === "clientSecret" ? "password" : "text"}
                    placeholder={k === "userId" ? "Email anfitriao Zoom" : k} value={zoomDraft[k]}
                    onChange={(e) => setZoomDraft((p) => ({ ...p, [k]: e.target.value }))} className={inputClass} />
                ))}
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={btnPrimaryClass} disabled={intBusy} onClick={() => void saveZoomIntegracao()}>Guardar Zoom</button>
                  <button type="button" className={btnSecondaryClass} disabled={intBusy} onClick={() => void testarIntegracao("ZOOM")}>Testar</button>
                </div>
              </div>
            </div>

            <p className="mt-4 text-[11px] text-slate-600">
              Modo actual: TEAMS {intRows.find((r) => r.provider === "TEAMS")?.mode ?? "–"} · ZOOM {intRows.find((r) => r.provider === "ZOOM")?.mode ?? "–"}
            </p>
          </div>

          {/* Subscription keys */}
          <div className="rounded-2xl bg-[#0c0a14]/80 border border-purple-500/10 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-purple-200">Subscription keys</h2>
              <button type="button" onClick={() => void gerarChave()}
                className="px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors">
                Gerar chave
              </button>
            </div>
            {tenant.subscriptionKeys.length === 0 ? (
              <p className="text-xs text-slate-600">Sem chaves geradas.</p>
            ) : (
              <div className="space-y-1.5">
                {tenant.subscriptionKeys.map((k) => (
                  <div key={k.id} className="flex items-center gap-3 text-xs text-slate-400">
                    <code className="text-purple-300">{k.keyPrefix}...</code>
                    <span className="text-slate-500">{k.status}</span>
                    {k.expiresAt ? <span className="text-slate-600">· expira {formatDatePt(k.expiresAt)}</span> : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
      <p className="text-[11px] text-slate-500 uppercase tracking-wider">{label}</p>
      <p className="text-lg font-bold text-slate-100 mt-0.5">{value}</p>
    </div>
  );
}
