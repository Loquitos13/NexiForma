"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Mail, Pencil, RefreshCw, Shield, ShieldAlert, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { formatDatePt } from "@/lib/calendar-date";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { parseApiError } from "@/lib/ui/backoffice";
import { labelSigoRole, mfaAppDisplayLabel, type TenantUserRole } from "@nexiforma/shared";
import { NifStatusField, type NifStatus } from "@/components/crm/nif-status-field";
import {
  Alert, Badge, Button, Card, CardContent, CardHeader, CardTitle,
  PaginatedDataTable, Dialog, DialogContent, Input, PageHeader, Select, type Column,
} from "@/components/ui";

type UserRow = {
  id: string;
  email: string;
  displayName: string;
  role: string;
  active: boolean;
  mfaEnabled: boolean;
  mfaRequired: boolean;
  mfaSetupPending?: boolean;
  mfaApp?: string | null;
  emailVerifiedAt?: string | null;
};
type InviteRow = { id: string; email: string; role: string; expiresAt: string };
type AcaoOpt = { id: string; codigoInterno: string; titulo: string };
type TurmaOpt = { id: string; codigo: string; nome: string };

const ROLES = ["ADMIN", "COORDENADOR_COMERCIAL", "COORDENADOR_PEDAGOGICO", "COORDENADOR_FINANCEIRO", "FORMADOR", "FORMANDO", "COMERCIAL"];
const EMPTY_INVITE = {
  email: "",
  displayName: "",
  role: "FORMADOR",
  nif: "",
  telefone: "",
  acaoId: "",
  turmaId: "",
};
const ROLE_VARIANT: Record<string, "purple" | "blue" | "teal" | "yellow" | "green" | "orange"> = {
  ADMIN: "purple", COORDENADOR_COMERCIAL: "green", COORDENADOR_PEDAGOGICO: "blue", COORDENADOR_FINANCEIRO: "yellow", COORDENADOR: "blue", FORMADOR: "teal", FORMANDO: "orange", FINANCEIRO: "yellow", COMERCIAL: "green",
};
const EMPTY_EDIT = { displayName: "", role: "FORMADOR", mfaRequired: false, nif: "" };

function roleLabel(role: string): string {
  return labelSigoRole(role as TenantUserRole);
}

const ROLE_HIERARCHY_RANK: Record<string, number> = {
  ADMIN: 0,
  COORDENADOR_PEDAGOGICO: 1,
  COORDENADOR_COMERCIAL: 1,
  COORDENADOR_FINANCEIRO: 1,
  COORDENADOR: 1,
  FINANCEIRO: 2,
  COMERCIAL: 3,
  FORMADOR: 4,
  FORMANDO: 5,
};

function mfaSortRank(u: UserRow): number {
  if (u.mfaEnabled) return 0;
  if (u.mfaRequired) return 1;
  if (u.mfaSetupPending) return 2;
  return 3;
}

function MfaStatusCell({ user }: { user: UserRow }) {
  if (user.mfaEnabled) {
    return (
      <span className="flex flex-col gap-0.5 text-green-400 text-xs">
        <span className="flex items-center gap-1">
          <ShieldCheck className="h-3.5 w-3.5" />
          Ativo
        </span>
        <span className="text-slate-500">{mfaAppDisplayLabel(user.mfaApp)}</span>
      </span>
    );
  }
  if (user.mfaRequired) {
    return (
      <span className="flex items-center gap-1 text-xs text-amber-400">
        <ShieldAlert className="h-3.5 w-3.5" />
        Obrigatório no login
      </span>
    );
  }
  if (user.mfaSetupPending) {
    return <span className="text-xs text-violet-300">Configuração pendente</span>;
  }
  return <span className="text-xs text-slate-500">–</span>;
}

function parseUserRow(raw: Record<string, unknown>): UserRow {
  return {
    id: String(raw.id),
    email: String(raw.email),
    displayName: String(raw.displayName),
    role: String(raw.role),
    active: Boolean(raw.active),
    mfaEnabled: Boolean(raw.mfaEnabled),
    mfaRequired: Boolean(raw.mfaRequired),
    mfaSetupPending: Boolean(raw.mfaSetupPending),
    mfaApp: raw.mfaApp != null ? String(raw.mfaApp) : null,
    emailVerifiedAt: raw.emailVerifiedAt != null ? String(raw.emailVerifiedAt) : null,
  };
}

export default function UtilizadoresPage() {
  const { canManage } = useTenantRole();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [invite, setInvite] = useState(EMPTY_INVITE);
  const [nifStatus, setNifStatus] = useState<NifStatus>("idle");
  const [acoes, setAcoes] = useState<AcaoOpt[]>([]);
  const [turmas, setTurmas] = useState<TurmaOpt[]>([]);
  const [busy, setBusy] = useState(false);
  const [mfaSelectMode, setMfaSelectMode] = useState(false);
  const [mfaDisableConfirmOpen, setMfaDisableConfirmOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_EDIT);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [manageMode, setManageMode] = useState<"menu" | "purge">("menu");
  const [purgeConfirmEmail, setPurgeConfirmEmail] = useState("");
  const [cancelInviteTarget, setCancelInviteTarget] = useState<InviteRow | null>(null);

  const load = useCallback(async () => {
    const [uRes, iRes] = await Promise.all([
      bffFetch("/api/v1/users", { headers: { accept: "application/json" } }),
      bffFetch("/api/v1/users/invites", { headers: { accept: "application/json" } }),
    ]);
    if (uRes.ok) {
      const raw = (await uRes.json()) as Record<string, unknown>[];
      setUsers(raw.map(parseUserRow));
    } else setError(await parseApiError(uRes));
    if (iRes.ok) setInvites((await iRes.json()) as InviteRow[]);
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!inviteDialogOpen || invite.role !== "FORMANDO") return;
    void bffFetch("/api/v1/acoes-formacao", { headers: { accept: "application/json" } }).then(async (r) => {
      if (r.ok) {
        const rows = (await r.json()) as AcaoOpt[];
        setAcoes(rows);
        if (rows.length && !invite.acaoId) {
          setInvite((i) => ({ ...i, acaoId: rows[0]!.id }));
        }
      }
    });
  }, [inviteDialogOpen, invite.role, invite.acaoId]);

  useEffect(() => {
    if (!inviteDialogOpen || invite.role !== "FORMANDO" || !invite.acaoId) {
      setTurmas([]);
      return;
    }
    void bffFetch(`/api/v1/turmas?acaoFormacaoId=${encodeURIComponent(invite.acaoId)}`, {
      headers: { accept: "application/json" },
    }).then(async (r) => {
      if (r.ok) {
        const rows = (await r.json()) as TurmaOpt[];
        setTurmas(rows);
        setInvite((i) => ({ ...i, turmaId: rows[0]?.id ?? "" }));
      }
    });
  }, [inviteDialogOpen, invite.role, invite.acaoId]);

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function cancelMfaSelect() {
    setMfaSelectMode(false);
    setSelectedIds(new Set());
  }

  async function sendInvite(e: FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    const needsNif = invite.role === "FORMANDO" || invite.role === "FORMADOR";
    if (needsNif && nifStatus !== "valid") {
      setError("NIF inválido. Tente novamente.");
      return;
    }
    setBusy(true); setError(null);
    // Confirmação NIF só no backend ao criar o convite.
    const body: Record<string, string> = {
      email: invite.email.trim(),
      displayName: invite.displayName.trim(),
      role: invite.role,
    };
    if (invite.role === "FORMANDO" || invite.role === "FORMADOR") {
      body.nif = invite.nif.trim();
    }
    if (invite.role === "FORMANDO") {
      if (invite.telefone.trim()) body.telefone = invite.telefone.trim();
      if (invite.turmaId) body.turmaId = invite.turmaId;
    }
    const res = await bffFetch("/api/v1/users/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) { setError(await parseApiError(res)); return; }
    const data = (await res.json()) as {
      inviteUrl?: string;
      resetUrl?: string;
      reactivated?: boolean;
      matriculaId?: string;
    };
    const parts = [
      data.reactivated
        ? data.resetUrl
          ? `Conta reactivada (dev: ${data.resetUrl})`
          : "Conta reactivada - enviámos email para definir nova palavra-passe."
        : data.inviteUrl
          ? `Convite criado (dev: ${data.inviteUrl})`
          : "Convite enviado por email.",
      data.matriculaId ? "Formando já inscrito na turma seleccionada." : null,
      invite.role === "FORMANDO" && !invite.turmaId
        ? "Ficha de formando criada - podes inscrevê-lo em Inscrições quando quiseres."
        : null,
    ].filter(Boolean);
    setMsg(parts.join(" "));
    setInvite(EMPTY_INVITE);
    setNifStatus("idle");
    setInviteDialogOpen(false);
    await load();
  }

  async function toggleActive(id: string, active: boolean) {
    const res = await bffFetch(`/api/v1/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ active }),
    });
    if (!res.ok) setError(await parseApiError(res));
    else {
      setMsg(active ? "Utilizador activado." : "Utilizador desactivado.");
      await load();
    }
  }

  async function removePermanent(id: string) {
    setBusy(true);
    setError(null);
    const res = await bffFetch(`/api/v1/users/${id}`, {
      method: "DELETE",
      headers: { accept: "application/json" },
    });
    setBusy(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    setMsg("Utilizador eliminado permanentemente.");
    setDeleteTarget(null);
    setPurgeConfirmEmail("");
    await load();
  }

  function openManageUser(u: UserRow, mode: "menu" | "purge") {
    setDeleteTarget(u);
    setPurgeConfirmEmail("");
    setManageMode(mode);
  }

  function closeManageUser() {
    setDeleteTarget(null);
    setPurgeConfirmEmail("");
    setManageMode("menu");
  }

  function openEdit(u: UserRow) {
    setEditUser(u);
    setEditForm({
      displayName: u.displayName,
      role: u.role,
      mfaRequired: u.mfaRequired,
      nif: "",
    });
    setNifStatus("idle");
    setEditDialogOpen(true);
  }

  async function submitEdit(e: FormEvent) {
    e.preventDefault();
    if (!canManage || !editUser) return;
    const becomingFormador =
      editForm.role === "FORMADOR" && editUser.role !== "FORMADOR";
    if (becomingFormador && nifStatus !== "valid") {
      setError("NIF inválido. Necessário para criar o perfil de formador.");
      return;
    }
    if (
      editForm.role === "FORMADOR" &&
      editForm.nif.trim() &&
      nifStatus !== "valid"
    ) {
      setError("NIF inválido.");
      return;
    }
    setBusy(true);
    setError(null);
    const body: Record<string, unknown> = {
      displayName: editForm.displayName.trim(),
      role: editForm.role,
      mfaRequired: editForm.mfaRequired,
    };
    if (editForm.role === "FORMADOR" && editForm.nif.trim()) {
      body.nif = editForm.nif.trim();
    }
    const res = await bffFetch(`/api/v1/users/${editUser.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    setMsg(
      editForm.role === "FORMADOR"
        ? "Utilizador actualizado. Perfil de formador disponível para associar a acções."
        : "Utilizador actualizado.",
    );
    setEditDialogOpen(false);
    setEditUser(null);
    await load();
  }

  async function resendEmailConfirmation(userId: string) {
    if (!canManage) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    const res = await bffFetch(`/api/v1/users/${userId}/resend-email-confirmation`, {
      method: "POST",
      headers: { accept: "application/json" },
    });
    setBusy(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    const data = (await res.json()) as { alreadyVerified?: boolean; sent?: boolean };
    setMsg(
      data.alreadyVerified
        ? "Este email já está confirmado."
        : data.sent
          ? "Email de confirmação reenviado."
          : "Pedido processado.",
    );
    await load();
  }

  async function resendInvite(inviteId: string) {
    setBusy(true);
    setError(null);
    const res = await bffFetch(`/api/v1/users/invites/${inviteId}/resend`, {
      method: "POST",
      headers: { accept: "application/json" },
    });
    setBusy(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    const data = (await res.json()) as { inviteUrl?: string };
    setMsg(
      data.inviteUrl
        ? `Convite reenviado (dev: ${data.inviteUrl})`
        : "Convite reenviado por email.",
    );
    await load();
  }

  async function confirmCancelInvite() {
    if (!cancelInviteTarget) return;
    setBusy(true);
    setError(null);
    const res = await bffFetch(`/api/v1/users/invites/${cancelInviteTarget.id}`, {
      method: "DELETE",
      headers: { accept: "application/json" },
    });
    setBusy(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    setMsg("Convite cancelado.");
    setCancelInviteTarget(null);
    await load();
  }

  const selectedUsers = useMemo(
    () => users.filter((u) => selectedIds.has(u.id)),
    [users, selectedIds],
  );
  const selectedWithMfa = useMemo(
    () => selectedUsers.filter((u) => u.mfaEnabled),
    [selectedUsers],
  );
  const selectedWithoutMfa = useMemo(
    () => selectedUsers.filter((u) => !u.mfaEnabled),
    [selectedUsers],
  );

  async function confirmMfaEnforcement() {
    if (selectedWithoutMfa.length === 0) {
      setError("Selecciona utilizadores sem MFA activo.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await bffFetch("/api/v1/users/mfa/require", {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ userIds: selectedWithoutMfa.map((u) => u.id) }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    const data = (await res.json()) as { updated?: number };
    setMsg(
      `${data.updated ?? selectedWithoutMfa.length} utilizador(es) devem configurar MFA no próximo início de sessão.`,
    );
    cancelMfaSelect();
    await load();
  }

  async function confirmMfaDisable() {
    if (selectedWithMfa.length === 0) {
      setError("Selecciona utilizadores com MFA activo.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await bffFetch("/api/v1/users/mfa/disable", {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ userIds: selectedWithMfa.map((u) => u.id) }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    const data = (await res.json()) as { updated?: number };
    setMsg(`${data.updated ?? selectedWithMfa.length} utilizador(es) com MFA desactivado.`);
    cancelMfaSelect();
    await load();
  }

  const USER_COLS: Column<UserRow>[] = useMemo(() => [
    {
      key: "displayName",
      header: "Nome",
      sortable: true,
      sortValue: (u) => u.displayName.trim().toLocaleLowerCase("pt"),
      cell: (u) => <span className="font-medium text-slate-100">{u.displayName}</span>,
    },
    {
      key: "email",
      header: "Email",
      sortable: true,
      sortValue: (u) => u.email.trim().toLocaleLowerCase("pt"),
      cell: (u) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-sm text-slate-400">{u.email}</span>
          {u.active && !u.emailVerifiedAt ? (
            <Badge variant="yellow">Por confirmar</Badge>
          ) : u.emailVerifiedAt ? (
            <span className="text-[10px] text-slate-500">Confirmado</span>
          ) : null}
        </div>
      ),
    },
    {
      key: "role",
      header: "Cargo",
      sortable: true,
      sortValue: (u) => ROLE_HIERARCHY_RANK[u.role] ?? 99,
      cell: (u) => <Badge variant={ROLE_VARIANT[u.role] ?? "default"}>{roleLabel(u.role)}</Badge>,
    },
    {
      key: "mfaEnabled",
      header: "Verificação 2 passos",
      sortable: true,
      sortValue: (u) => mfaSortRank(u),
      cell: (u) => <MfaStatusCell user={u} />,
    },
    {
      key: "active",
      header: "Estado",
      sortable: true,
      sortValue: (u) => (u.active ? 0 : 1),
      cell: (u) => <Badge variant={u.active ? "green" : "default"}>{u.active ? "Activo" : "Inactivo"}</Badge>,
    },
  ], []);

  return (
    <>
      <PageHeader
        title="Utilizadores"
        description="Gestão de equipa, convites por email e verificação em dois passos para gestores."
        actions={
          canManage ? (
            <div className="flex gap-2">
              <Button
                variant={mfaSelectMode ? "default" : "secondary"}
                size="sm"
                onClick={() => {
                  if (mfaSelectMode) cancelMfaSelect();
                  else setMfaSelectMode(true);
                }}
              >
                <Shield className="h-3.5 w-3.5" />
                {mfaSelectMode ? "Cancelar selecção" : "Ativar verificação"}
              </Button>
              <Button onClick={() => setInviteDialogOpen(true)}>
                <UserPlus className="h-4 w-4" />Convidar
              </Button>
            </div>
          ) : null
        }
      />

      {mfaSelectMode ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-500/30 bg-violet-950/25 px-4 py-3">
          <p className="text-sm text-violet-100">
            {selectedWithMfa.length > 0 && selectedWithoutMfa.length === 0 ? (
              <>
                Utilizadores seleccionados com <strong>MFA activo</strong> - podes desactivar a verificação.
              </>
            ) : selectedWithMfa.length > 0 ? (
              <>
                Seleccionados com MFA activo podem ser <strong>desactivados</strong>; os restantes podem ser
                obrigados a configurar no próximo login.
              </>
            ) : (
              <>
                Clica nas linhas dos utilizadores que devem <strong>configurar MFA no próximo login</strong>.
              </>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            {selectedWithoutMfa.length > 0 ? (
              <Button
                size="sm"
                onClick={() => void confirmMfaEnforcement()}
                disabled={busy || selectedWithoutMfa.length === 0}
              >
                {busy ? "A aplicar…" : `Impor MFA (${selectedWithoutMfa.length})`}
              </Button>
            ) : null}
            {selectedWithMfa.length > 0 ? (
              <Button
                size="sm"
                variant="danger"
                onClick={() => setMfaDisableConfirmOpen(true)}
                disabled={busy}
              >
                {busy ? "A aplicar…" : `Desativar MFA (${selectedWithMfa.length})`}
              </Button>
            ) : null}
            <Button size="sm" variant="secondary" onClick={cancelMfaSelect}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}
      {msg && <Alert variant="success" className="mb-4">{msg}</Alert>}

      <PaginatedDataTable
        columns={USER_COLS}
        data={users}
        keyField="id"
        loading={false}
        emptyMessage="Sem utilizadores."
        selection={
          mfaSelectMode
            ? {
                selectedIds,
                onToggle: toggleSelected,
                isSelectable: (u) => u.active,
              }
            : undefined
        }
        rowActions={canManage && !mfaSelectMode ? (u) => (
          <div
            className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <Button
              size="sm"
              variant="ghost"
              onClick={() => openEdit(u)}
              aria-label={`Editar ${u.displayName}`}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            {u.active && !u.emailVerifiedAt ? (
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => void resendEmailConfirmation(u.id)}
                aria-label={`Reenviar confirmação de email a ${u.displayName}`}
                title="Reenviar confirmação de email"
              >
                <Mail className="h-3.5 w-3.5 text-yellow-400" />
              </Button>
            ) : null}
            {u.active ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => openManageUser(u, "menu")}
                aria-label={`Gerir conta de ${u.displayName}`}
              >
                <Trash2 className="h-3.5 w-3.5 text-red-400" />
              </Button>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void toggleActive(u.id, true)}
                  aria-label={`Activar ${u.displayName}`}
                >
                  <Shield className="h-3.5 w-3.5 text-green-400" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => openManageUser(u, "purge")}
                  aria-label={`Eliminar permanentemente ${u.displayName}`}
                >
                  <Trash2 className="h-3.5 w-3.5 text-red-400" />
                </Button>
              </>
            )}
          </div>
        ) : undefined}
      />

      {invites.length > 0 && (
        <Card className="mt-6">
          <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><Mail className="h-4 w-4 text-yellow-400" />Convites pendentes</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {invites.map((i) => (
                <div key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-800/50 px-3 py-2">
                  <span className="text-sm text-slate-300">{i.email}</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={ROLE_VARIANT[i.role] ?? "default"}>{roleLabel(i.role)}</Badge>
                    <span className="text-xs text-slate-500">expira {formatDatePt(i.expiresAt)}</span>
                    {canManage ? (
                      <>
                        <Button size="sm" variant="secondary" disabled={busy} onClick={() => void resendInvite(i.id)}>
                          <RefreshCw className="h-3.5 w-3.5" />
                          Reenviar
                        </Button>
                        <Button size="sm" variant="danger" disabled={busy} onClick={() => setCancelInviteTarget(i)}>
                          <Trash2 className="h-3.5 w-3.5" />
                          Cancelar
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={mfaDisableConfirmOpen} onOpenChange={setMfaDisableConfirmOpen}>
        <DialogContent
          title="Desativar MFA"
          description={`Confirma a desactivação do MFA para ${selectedWithMfa.length} utilizador(es)? Deixarão de precisar de código no login.`}
        >
          <div className="flex gap-2 pt-2">
            <Button
              variant="danger"
              disabled={busy}
              onClick={() => {
                setMfaDisableConfirmOpen(false);
                void confirmMfaDisable();
              }}
            >
              Desativar MFA
            </Button>
            <Button variant="secondary" onClick={() => setMfaDisableConfirmOpen(false)}>
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent
          title="Convidar utilizador"
          description={
            invite.role === "FORMANDO"
              ? "Cria a ficha de formando (NIF confirmado) e envia convite. Opcionalmente inscreve já numa turma."
              : invite.role === "FORMADOR"
                ? "NIF confirmado obrigatório; o perfil de formador é criado de imediato para poderes associá-lo a acções."
                : "O utilizador receberá um email com link de activação."
          }
        >
          <form onSubmit={(e) => void sendInvite(e)} className="grid gap-4">
            <Input label="Email *" type="email" required value={invite.email} onChange={(e) => setInvite((i) => ({ ...i, email: e.target.value }))} />
            <Input label="Nome *" required value={invite.displayName} onChange={(e) => setInvite((i) => ({ ...i, displayName: e.target.value }))} />
            <Select
              label="Cargo"
              value={invite.role}
              onChange={(e) => {
                setInvite((i) => ({ ...i, role: e.target.value, nif: "", turmaId: "" }));
                setNifStatus("idle");
              }}
            >
              {ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
            </Select>
            {invite.role === "FORMADOR" ? (
              <NifStatusField
                label="NIF *"
                value={invite.nif}
                onChange={(nif) => setInvite((i) => ({ ...i, nif }))}
                tipo="pessoa"
                onStatusChange={setNifStatus}
              />
            ) : null}
            {invite.role === "FORMANDO" ? (
              <>
                <NifStatusField
                  label="NIF *"
                  value={invite.nif}
                  onChange={(nif) => setInvite((i) => ({ ...i, nif }))}
                  tipo="pessoa"
                  onStatusChange={setNifStatus}
                />
                <Input
                  label="Telefone"
                  value={invite.telefone}
                  onChange={(e) => setInvite((i) => ({ ...i, telefone: e.target.value }))}
                />
                <Select
                  label="Inscrever na acção (opcional)"
                  value={invite.acaoId}
                  onChange={(e) => setInvite((i) => ({ ...i, acaoId: e.target.value, turmaId: "" }))}
                >
                  <option value="">- Mais tarde em Inscrições -</option>
                  {acoes.map((a) => (
                    <option key={a.id} value={a.id}>{a.codigoInterno} – {a.titulo}</option>
                  ))}
                </Select>
                {invite.acaoId ? (
                  <Select
                    label="Turma"
                    value={invite.turmaId}
                    onChange={(e) => setInvite((i) => ({ ...i, turmaId: e.target.value }))}
                  >
                    {turmas.length === 0 ? (
                      <option value="">Sem turmas nesta acção</option>
                    ) : (
                      turmas.map((t) => (
                        <option key={t.id} value={t.id}>{t.codigo} – {t.nome}</option>
                      ))
                    )}
                  </Select>
                ) : null}
              </>
            ) : null}
            <div className="flex gap-2 pt-1">
              <Button
                type="submit"
                disabled={
                  busy ||
                  ((invite.role === "FORMANDO" || invite.role === "FORMADOR") &&
                    (nifStatus === "checking" || nifStatus !== "valid"))
                }
              >
                {busy ? "A enviar…" : "Enviar convite"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setInviteDialogOpen(false)}>Cancelar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent
          title="Editar utilizador"
          description={editUser ? editUser.email : undefined}
        >
          <form onSubmit={(e) => void submitEdit(e)} className="grid gap-4">
            <Input
              label="Nome *"
              required
              value={editForm.displayName}
              onChange={(e) => setEditForm((f) => ({ ...f, displayName: e.target.value }))}
            />
            <Select
              label="Cargo"
              value={editForm.role}
              onChange={(e) =>
                setEditForm((f) => ({ ...f, role: e.target.value, nif: "" }))
              }
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>{roleLabel(r)}</option>
              ))}
            </Select>
            {editForm.role === "FORMADOR" ? (
              <NifStatusField
                label={
                  editUser?.role === "FORMADOR"
                    ? "NIF (só se ainda não existir perfil de formador)"
                    : "NIF * (cria perfil de formador)"
                }
                value={editForm.nif}
                onChange={(nif) => setEditForm((f) => ({ ...f, nif }))}
                tipo="pessoa"
                onStatusChange={setNifStatus}
              />
            ) : null}
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={editForm.mfaRequired}
                onChange={(e) => setEditForm((f) => ({ ...f, mfaRequired: e.target.checked }))}
                className="rounded border-slate-600 bg-slate-900"
              />
              Exigir verificação em dois passos no próximo login
            </label>
            <div className="flex gap-2 pt-1">
              <Button
                type="submit"
                disabled={
                  busy ||
                  nifStatus === "checking" ||
                  (editForm.role === "FORMADOR" &&
                    editUser?.role !== "FORMADOR" &&
                    nifStatus !== "valid") ||
                  (editForm.role === "FORMADOR" &&
                    Boolean(editForm.nif.trim()) &&
                    nifStatus !== "valid")
                }
              >
                {busy ? "A guardar…" : "Guardar"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && closeManageUser()}>
        <DialogContent
          title={
            manageMode === "purge"
              ? "Eliminar permanentemente"
              : "Gerir conta"
          }
          description={
            deleteTarget
              ? manageMode === "purge"
                ? `Esta acção remove ${deleteTarget.displayName} (${deleteTarget.email}) da base de dados. O email fica disponível para novo convite. Escreve o email para confirmar.`
                : `Como queres proceder com ${deleteTarget.displayName}?`
              : undefined
          }
        >
          {deleteTarget && manageMode === "menu" ? (
            <div className="grid gap-3 pt-1">
              <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-3">
                <p className="text-sm font-medium text-slate-200">Desactivar conta</p>
                <p className="mt-1 text-xs text-slate-400">
                  Mantém o histórico e dados associados. A conta deixa de iniciar sessão. Podes reactivar ou convidar de novo o mesmo email.
                </p>
                <Button
                  className="mt-3"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => {
                    const id = deleteTarget.id;
                    closeManageUser();
                    if (id) void toggleActive(id, false);
                  }}
                >
                  Desactivar conta
                </Button>
              </div>
              <div className="rounded-lg border border-red-900/50 bg-red-950/20 p-3">
                <p className="text-sm font-medium text-red-200">Eliminar permanentemente</p>
                <p className="mt-1 text-xs text-slate-400">
                  Remove o registo por completo. As interacções CRM mantêm o autor original (auditoria). Esta acção não pode ser revertida.
                </p>
                <Button
                  className="mt-3"
                  variant="danger"
                  disabled={busy}
                  onClick={() => setManageMode("purge")}
                >
                  Eliminar permanentemente
                </Button>
              </div>
              <Button variant="secondary" onClick={closeManageUser}>Cancelar</Button>
            </div>
          ) : deleteTarget && manageMode === "purge" ? (
            <div className="grid gap-4 pt-1">
              <Input
                label="Confirmar email"
                type="email"
                value={purgeConfirmEmail}
                onChange={(e) => setPurgeConfirmEmail(e.target.value)}
                placeholder={deleteTarget.email}
                autoComplete="off"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="danger"
                  disabled={busy || purgeConfirmEmail.trim().toLowerCase() !== deleteTarget.email.toLowerCase()}
                  onClick={() => {
                    const id = deleteTarget.id;
                    if (id) void removePermanent(id);
                  }}
                >
                  {busy ? "A eliminar…" : "Confirmar eliminação"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    if (deleteTarget.active) {
                      setManageMode("menu");
                      setPurgeConfirmEmail("");
                    } else {
                      closeManageUser();
                    }
                  }}
                >
                  {deleteTarget.active ? "Voltar" : "Cancelar"}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(cancelInviteTarget)} onOpenChange={(open) => !open && setCancelInviteTarget(null)}>
        <DialogContent
          title="Cancelar convite"
          description={
            cancelInviteTarget
              ? `Remover o convite para ${cancelInviteTarget.email}? O link de activação deixa de funcionar.`
              : undefined
          }
        >
          <div className="flex gap-2 pt-2">
            <Button variant="danger" disabled={busy} onClick={() => void confirmCancelInvite()}>
              Cancelar convite
            </Button>
            <Button variant="secondary" onClick={() => setCancelInviteTarget(null)}>Voltar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
