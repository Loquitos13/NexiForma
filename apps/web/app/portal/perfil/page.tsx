"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  CircleAlert,
  GraduationCap,
  KeyRound,
  Lock,
  Palette,
  QrCode,
  Shield,
  ShieldCheck,
  Smartphone,
  User,
  UserCheck,
  Building2,
  Calendar,
  Mail,
  RefreshCw,
  X,
} from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { parseApiError } from "@/lib/ui/backoffice";
import { cn } from "@/lib/ui/cn";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
} from "@/components/ui";
import { PasswordInput } from "@/components/ui/password-input";
import { UI_THEMES, type UiThemeId } from "@/lib/ui/ui-themes";
import { useUiThemeOptional } from "@/components/theme/ui-theme-provider";

type TabId = "dados" | "seguranca" | "preferencias" | "rgpd";

type UserProfile = {
  id: string;
  sub: string;
  email: string;
  displayName: string | null;
  role: string;
  kind: string;
  tenantId: string | null;
  tenantSlug: string | null;
  tenantLegalName: string | null;
  tenantLogoUrl: string | null;
  mfaEnabled: boolean;
  mfaRequired: boolean;
  mfaApp: string | null;
  mfaAppLabel: string | null;
  emailVerifiedAt: string | null;
  createdAt: string | null;
  uiTheme: string | null;
};

type MfaSetupResponse = {
  secret: string;
  qrCodeDataUrl: string;
  otpauthUrl: string;
  mfaApp?: string | null;
};

const TABS: Array<{ id: TabId; label: string; icon: typeof User }> = [
  { id: "dados", label: "Dados e Conta", icon: User },
  { id: "seguranca", label: "Segurança e 2FA", icon: Lock },
  { id: "preferencias", label: "Aparência e Tema", icon: Palette },
  { id: "rgpd", label: "Privacidade e RGPD", icon: Shield },
];

function roleLabel(role?: string): string {
  switch (role) {
    case "tenant_manager":
      return "Gestor da Entidade";
    case "coordenador_pedagogico":
      return "Coordenador Pedagógico";
    case "coordenador_comercial":
      return "Coordenador Comercial";
    case "coordenador_financeiro":
      return "Coordenador Financeiro";
    case "comercial":
      return "Gestor Comercial";
    case "formador":
      return "Formador";
    case "formando":
      return "Formando";
    case "super_admin":
      return "Super Administrador";
    default:
      return role || "Utilizador";
  }
}

function roleBadgeVariant(
  role?: string,
): "default" | "blue" | "green" | "purple" | "teal" | "orange" {
  switch (role) {
    case "tenant_manager":
    case "super_admin":
      return "blue";
    case "coordenador_pedagogico":
      return "purple";
    case "coordenador_comercial":
    case "comercial":
      return "orange";
    case "coordenador_financeiro":
      return "teal";
    case "formando":
      return "green";
    default:
      return "default";
  }
}

function initials(name?: string | null, email?: string): string {
  const raw = (name || email || "U").trim();
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return raw.slice(0, 2).toUpperCase() || "U";
}

export default function PortalPerfilPage() {
  const { role, isFormador, isFormando } = useTenantRole();
  const uiTheme = useUiThemeOptional();

  const [tab, setTab] = useState<TabId>("dados");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // Form Dados
  const [displayName, setDisplayName] = useState("");

  // Form Password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);

  // MFA Setup
  const [mfaSetupOpen, setMfaSetupOpen] = useState(false);
  const [mfaSetupData, setMfaSetupData] = useState<MfaSetupResponse | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaBusy, setMfaBusy] = useState(false);
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [mfaMsg, setMfaMsg] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await bffFetch("/api/auth/me", { headers: { accept: "application/json" } });
      if (!res.ok) {
        setError("Não foi possível carregar as informações de perfil.");
        return;
      }
      const data = (await res.json()) as UserProfile;
      setProfile(data);
      setDisplayName(data.displayName || "");
    } catch {
      setError("Falha de comunicação com o servidor.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const res = await bffFetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName }),
      });
      if (!res.ok) {
        setError(await parseApiError(res, "Não foi possível guardar as alterações."));
        return;
      }
      setMsg("Perfil actualizado com sucesso.");
      await loadProfile();
    } catch {
      setError("Erro ao comunicar com o servidor.");
    } finally {
      setBusy(false);
    }
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    setPwError(null);
    setPwMsg(null);

    if (newPassword.length < 8) {
      setPwError("A nova palavra-passe deve ter pelo menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("A confirmação da palavra-passe não coincide.");
      return;
    }

    setPwBusy(true);
    try {
      const res = await bffFetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) {
        setPwError(await parseApiError(res, "Não foi possível alterar a palavra-passe."));
        return;
      }
      setPwMsg("Palavra-passe alterada com sucesso.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setPwError("Erro ao comunicar com o servidor.");
    } finally {
      setPwBusy(false);
    }
  }

  async function handleStartMfaSetup() {
    setMfaError(null);
    setMfaMsg(null);
    setMfaCode("");
    setMfaBusy(true);
    try {
      const res = await bffFetch("/api/auth/mfa/setup", { method: "POST" });
      if (!res.ok) {
        setMfaError(await parseApiError(res, "Não foi possível iniciar a configuração de MFA."));
        return;
      }
      const data = (await res.json()) as MfaSetupResponse;
      setMfaSetupData(data);
      setMfaSetupOpen(true);
    } catch {
      setMfaError("Erro ao comunicar com o servidor.");
    } finally {
      setMfaBusy(false);
    }
  }

  async function handleConfirmMfa(e: FormEvent) {
    e.preventDefault();
    if (!mfaCode.trim() || mfaCode.trim().length !== 6) {
      setMfaError("Insira o código de 6 dígitos gerado pela sua aplicação.");
      return;
    }

    setMfaBusy(true);
    setMfaError(null);
    try {
      const res = await bffFetch("/api/auth/mfa/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: mfaCode.trim() }),
      });
      if (!res.ok) {
        setMfaError(await parseApiError(res, "Código inválido ou expirado. Tente novamente."));
        return;
      }
      setMfaMsg("Autenticação de dois fatores (2FA) ativada com sucesso!");
      setMfaSetupOpen(false);
      setMfaSetupData(null);
      setMfaCode("");
      await loadProfile();
    } catch {
      setMfaError("Erro ao validar o código.");
    } finally {
      setMfaBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      {/* Mensagens de feedback de topo */}
      {error && (
        <div className="flex items-center justify-between rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          <div className="flex items-center gap-2">
            <CircleAlert className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError(null)} className="text-rose-400 hover:text-rose-200">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {msg && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>{msg}</span>
          </div>
          <button type="button" onClick={() => setMsg(null)} className="text-emerald-400 hover:text-emerald-200">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Hero Card de Identificação */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900/90 to-slate-950 p-6 shadow-xl">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-xl font-bold text-white shadow-lg shadow-blue-500/20 ring-4 ring-blue-500/10">
              {initials(profile?.displayName, profile?.email)}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-100">
                  {profile?.displayName || profile?.email || "O meu perfil"}
                </h1>
                <Badge variant={roleBadgeVariant(profile?.role)}>
                  {roleLabel(profile?.role)}
                </Badge>
                {profile?.emailVerifiedAt ? (
                  <Badge variant="green">
                    <CheckCircle2 className="mr-1 h-3 w-3 inline" /> Verificado
                  </Badge>
                ) : (
                  <Badge variant="yellow">
                    Email Pendente
                  </Badge>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-slate-500" />
                  {profile?.email}
                </span>
                {profile?.tenantLegalName && (
                  <span className="flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-slate-500" />
                    {profile.tenantLegalName}
                  </span>
                )}
                {profile?.createdAt && (
                  <span className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Calendar className="h-3.5 w-3.5" />
                    Membro desde {new Date(profile.createdAt).toLocaleDateString("pt-PT")}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Atalhos para perfis com vista específica (Formador / Formando) */}
          <div className="flex flex-wrap gap-2">
            {isFormador && (
              <Button asChild variant="secondary" size="sm" className="gap-1.5 border-slate-700 bg-slate-800/60 hover:bg-slate-800">
                <Link href="/portal/formador/perfil">
                  <UserCheck className="h-4 w-4 text-indigo-400" />
                  Ficha de Formador
                </Link>
              </Button>
            )}
            {isFormando && (
              <Button asChild variant="secondary" size="sm" className="gap-1.5 border-slate-700 bg-slate-800/60 hover:bg-slate-800">
                <Link href="/portal/formando/perfil">
                  <GraduationCap className="h-4 w-4 text-emerald-400" />
                  Ficha de Formando
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Navegação por Abas */}
      <div className="flex border-b border-slate-800 gap-2 overflow-x-auto pb-px">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTab(t.id);
                setError(null);
                setMsg(null);
              }}
              className={cn(
                "flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap",
                active
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-slate-400 hover:border-slate-700 hover:text-slate-200",
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Conteúdo da Aba 1: Dados e Conta */}
      {tab === "dados" && (
        <Card className="border-slate-800 bg-slate-900/60">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-100 flex items-center gap-2">
              <User className="h-5 w-5 text-blue-400" />
              Identificação do Utilizador
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void handleSaveProfile(e)} className="space-y-4 max-w-xl">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Nome de Apresentação
                </label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Seu nome completo ou profissional"
                  disabled={busy}
                  className="bg-slate-950/70 border-slate-800 text-slate-100"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Nome visível nas notificações, relatórios e registos da plataforma.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Email de Conta
                </label>
                <Input
                  value={profile?.email || ""}
                  disabled
                  className="bg-slate-950/40 border-slate-800/80 text-slate-400 cursor-not-allowed"
                />
                <p className="mt-1 text-xs text-slate-500">
                  O email é a chave única de autenticação da sua conta.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Papel e Permissões
                </label>
                <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-sm text-slate-300">
                  <ShieldCheck className="h-4 w-4 text-indigo-400 flex-shrink-0" />
                  <div>
                    <span className="font-medium text-slate-200">{roleLabel(profile?.role)}</span>
                    <p className="text-xs text-slate-500">
                      Nível de acesso atribuído pela entidade formadora.
                    </p>
                  </div>
                </div>
              </div>

              {profile?.tenantLegalName && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Entidade Formadora
                  </label>
                  <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-sm text-slate-300">
                    <Building2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                    <div>
                      <span className="font-medium text-slate-200">{profile.tenantLegalName}</span>
                      {profile.tenantSlug && (
                        <p className="text-xs text-slate-500">
                          Slug: <span className="font-mono text-slate-400">{profile.tenantSlug}</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-2">
                <Button type="submit" disabled={busy} className="bg-blue-600 hover:bg-blue-500 text-white gap-2">
                  {busy && <RefreshCw className="h-4 w-4 animate-spin" />}
                  Guardar alterações
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Conteúdo da Aba 2: Segurança e 2FA */}
      {tab === "seguranca" && (
        <div className="space-y-6">
          {/* Card Alterar Password */}
          <Card className="border-slate-800 bg-slate-900/60">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-indigo-400" />
                Alterar Palavra-passe
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pwError && (
                <div className="mb-4 flex items-center justify-between rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                  <div className="flex items-center gap-2">
                    <CircleAlert className="h-4 w-4 shrink-0 text-rose-400" />
                    <span>{pwError}</span>
                  </div>
                  <button type="button" onClick={() => setPwError(null)} className="text-rose-400 hover:text-rose-200">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
              {pwMsg && (
                <div className="mb-4 flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                    <span>{pwMsg}</span>
                  </div>
                  <button type="button" onClick={() => setPwMsg(null)} className="text-emerald-400 hover:text-emerald-200">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              <form onSubmit={(e) => void handleChangePassword(e)} className="space-y-4 max-w-xl">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Palavra-passe Actual
                  </label>
                  <PasswordInput
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    disabled={pwBusy}
                    className="bg-slate-950/70 border-slate-800 text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Nova Palavra-passe
                  </label>
                  <PasswordInput
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    required
                    disabled={pwBusy}
                    className="bg-slate-950/70 border-slate-800 text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Confirmar Nova Palavra-passe
                  </label>
                  <PasswordInput
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita a nova palavra-passe"
                    required
                    disabled={pwBusy}
                    className="bg-slate-950/70 border-slate-800 text-slate-100"
                  />
                </div>

                <div className="pt-2">
                  <Button type="submit" disabled={pwBusy} className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2">
                    {pwBusy && <RefreshCw className="h-4 w-4 animate-spin" />}
                    Actualizar Palavra-passe
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Card 2FA / MFA */}
          <Card className="border-slate-800 bg-slate-900/60">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-slate-100 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5 text-emerald-400" />
                  Autenticação de Dois Fatores (2FA / TOTP)
                </span>
                {profile?.mfaEnabled ? (
                  <Badge variant="green">
                    <CheckCircle2 className="mr-1 h-3 w-3 inline" /> Activado
                  </Badge>
                ) : (
                  <Badge variant="default">
                    Desactivado
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {mfaError && (
                <div className="mb-4 flex items-center justify-between rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                  <div className="flex items-center gap-2">
                    <CircleAlert className="h-4 w-4 shrink-0 text-rose-400" />
                    <span>{mfaError}</span>
                  </div>
                  <button type="button" onClick={() => setMfaError(null)} className="text-rose-400 hover:text-rose-200">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
              {mfaMsg && (
                <div className="mb-4 flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                    <span>{mfaMsg}</span>
                  </div>
                  <button type="button" onClick={() => setMfaMsg(null)} className="text-emerald-400 hover:text-emerald-200">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              <div className="space-y-4 max-w-xl text-sm text-slate-300">
                <p>
                  A autenticação de dois fatores protege a sua conta exigindo um código de verificação
                  gerado pela sua aplicação (Google Authenticator, Microsoft Authenticator, 1Password, etc.)
                  sempre que iniciar sessão.
                </p>

                {profile?.mfaEnabled && (
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 text-emerald-200">
                    <div className="flex items-center gap-2 font-medium">
                      <ShieldCheck className="h-5 w-5 text-emerald-400" />
                      Proteção MFA Activa
                    </div>
                    {profile.mfaAppLabel && (
                      <p className="mt-1 text-xs text-emerald-300/80">
                        Aplicação configurada: <strong className="text-emerald-100">{profile.mfaAppLabel}</strong>
                      </p>
                    )}
                  </div>
                )}

                {!mfaSetupOpen ? (
                  <Button
                    type="button"
                    onClick={() => void handleStartMfaSetup()}
                    disabled={mfaBusy}
                    variant={profile?.mfaEnabled ? "secondary" : "default"}
                    className={cn(
                      "gap-2",
                      profile?.mfaEnabled
                        ? "border-slate-700 hover:bg-slate-800"
                        : "bg-emerald-600 hover:bg-emerald-500 text-white",
                    )}
                  >
                    <QrCode className="h-4 w-4" />
                    {profile?.mfaEnabled ? "Reconfigurar Aplicação Authenticator" : "Configurar 2FA com Authenticator"}
                  </Button>
                ) : (
                  <div className="rounded-xl border border-slate-700 bg-slate-950 p-5 space-y-4 mt-4">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <h4 className="font-semibold text-slate-100 flex items-center gap-2">
                        <QrCode className="h-4 w-4 text-blue-400" />
                        Configurar Authenticator
                      </h4>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setMfaSetupOpen(false);
                          setMfaSetupData(null);
                        }}
                        className="text-xs text-slate-400 hover:text-slate-200"
                      >
                        Cancelar
                      </Button>
                    </div>

                    <p className="text-xs text-slate-400">
                      1. Abra a sua aplicação de autenticação (Google Authenticator ou Microsoft Authenticator) e digitalize o código QR abaixo:
                    </p>

                    {mfaSetupData?.qrCodeDataUrl && (
                      <div className="flex flex-col items-center justify-center p-3 bg-white rounded-lg max-w-[200px] mx-auto shadow-inner">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={mfaSetupData.qrCodeDataUrl}
                          alt="Código QR MFA TOTP"
                          className="h-44 w-44 object-contain"
                        />
                      </div>
                    )}

                    {mfaSetupData?.secret && (
                      <div className="text-center">
                        <span className="text-xs text-slate-400 block mb-1">Ou insira a chave manualmente:</span>
                        <code className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-xs font-mono text-blue-300 select-all">
                          {mfaSetupData.secret}
                        </code>
                      </div>
                    )}

                    <form onSubmit={(e) => void handleConfirmMfa(e)} className="space-y-3 pt-2">
                      <label className="block text-xs font-semibold text-slate-300">
                        2. Insira o código de 6 dígitos gerado pela aplicação:
                      </label>
                      <div className="flex gap-2">
                        <Input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={6}
                          value={mfaCode}
                          onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                          placeholder="000000"
                          className="bg-slate-900 border-slate-800 text-center tracking-widest text-lg font-mono text-slate-100 max-w-[160px]"
                          disabled={mfaBusy}
                          required
                        />
                        <Button
                          type="submit"
                          disabled={mfaBusy || mfaCode.length !== 6}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white"
                        >
                          {mfaBusy ? "A validar…" : "Validar e Activar"}
                        </Button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Conteúdo da Aba 3: Preferências e Tema Visual */}
      {tab === "preferencias" && (
        <Card className="border-slate-800 bg-slate-900/60">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-100 flex items-center gap-2">
              <Palette className="h-5 w-5 text-amber-400" />
              Tema e Estilo Visual da Interface
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-400 mb-6">
              Escolha a sua paleta de cores preferida para o portal. A preferência é guardada
              automaticamente na sua conta e sincronizada em todos os seus dispositivos.
            </p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {UI_THEMES.map((th) => {
                const isSelected = (uiTheme?.themeId ?? profile?.uiTheme ?? "midnight") === th.id;
                return (
                  <button
                    key={th.id}
                    type="button"
                    onClick={() => {
                      uiTheme?.setThemeId(th.id as UiThemeId);
                      setMsg(`Tema alterado para "${th.label}".`);
                    }}
                    className={cn(
                      "relative flex flex-col rounded-xl border p-4 text-left transition-all hover:scale-[1.02]",
                      isSelected
                        ? "border-blue-500 bg-slate-900 ring-2 ring-blue-500/20 shadow-lg"
                        : "border-slate-800 bg-slate-950/60 hover:border-slate-700 hover:bg-slate-900/40",
                    )}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-semibold text-sm text-slate-200">{th.label}</span>
                      <span
                        className="h-4 w-4 rounded-full border border-white/20 shadow-sm"
                        style={{ backgroundColor: th.accent }}
                      />
                    </div>
                    <p className="text-xs text-slate-400 mb-3">{th.description}</p>
                    <div className="flex items-center gap-1.5 mt-auto">
                      <span
                        className="h-3 w-8 rounded"
                        style={{ backgroundColor: th.bg }}
                        title="Fundo"
                      />
                      <span
                        className="h-3 w-8 rounded"
                        style={{ backgroundColor: th.panel }}
                        title="Painel"
                      />
                      <span
                        className="h-3 w-8 rounded"
                        style={{ backgroundColor: th.accent }}
                        title="Destaque"
                      />
                      {isSelected && (
                        <span className="ml-auto flex items-center text-xs font-semibold text-blue-400">
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Activo
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Conteúdo da Aba 4: Privacidade e RGPD */}
      {tab === "rgpd" && (
        <Card className="border-slate-800 bg-slate-900/60">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-100 flex items-center gap-2">
              <Shield className="h-5 w-5 text-indigo-400" />
              Privacidade, Proteção de Dados e RGPD
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 max-w-2xl text-sm text-slate-300">
            <p>
              Os seus dados pessoais são tratados em estrito cumprimento com o Regulamento Geral sobre
              a Proteção de Dados (RGPD) e a legislação nacional aplicável à atividade formativa.
            </p>

            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-2">
              <h4 className="font-semibold text-slate-100 text-sm">Direitos do Titular dos Dados:</h4>
              <ul className="list-disc list-inside text-xs text-slate-400 space-y-1">
                <li>Direito de acesso e consulta dos seus dados pessoais.</li>
                <li>Direito de retificação e atualização dos registos.</li>
                <li>Direito à portabilidade e exportação de ficheiros formativos.</li>
                <li>Direito de limitação ou oposição ao tratamento para finalidades não essenciais.</li>
              </ul>
            </div>

            <div className="pt-2 flex flex-wrap gap-3">
              <Button asChild variant="secondary" className="border-slate-700 bg-slate-800 hover:bg-slate-700">
                <Link href="/portal/rgpd">
                  <Shield className="mr-2 h-4 w-4 text-blue-400" />
                  Abrir Central de RGPD e Consentimentos
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
