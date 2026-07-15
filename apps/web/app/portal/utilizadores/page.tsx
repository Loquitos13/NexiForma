"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { UserPlus, Shield, ShieldOff, ShieldCheck, Mail, ShieldAlert } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { formatDatePt } from "@/lib/calendar-date";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { parseApiError } from "@/lib/ui/backoffice";
import { mfaAppDisplayLabel } from "@nexiforma/shared";
import {
  Alert, Badge, Button, Card, CardContent, CardHeader, CardTitle,
  DataTable, Dialog, DialogContent, Input, PageHeader, Select, type Column,
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
};
type InviteRow = { id: string; email: string; role: string; expiresAt: string };
type AcaoOpt = { id: string; codigoInterno: string; titulo: string };
type TurmaOpt = { id: string; codigo: string; nome: string };

const ROLES = ["ADMIN", "COORDENADOR", "FORMADOR", "FORMANDO", "FINANCEIRO", "COMERCIAL"];
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
  ADMIN: "purple", COORDENADOR: "blue", FORMADOR: "teal", FORMANDO: "orange", FINANCEIRO: "yellow", COMERCIAL: "green",
};
const ROLE_HIERARCHY_RANK: Record<string, number> = {
  ADMIN: 0,
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
  const [acoes, setAcoes] = useState<AcaoOpt[]>([]);
  const [turmas, setTurmas] = useState<TurmaOpt[]>([]);
  const [busy, setBusy] = useState(false);
  const [mfaSelectMode, setMfaSelectMode] = useState(false);
  const [mfaDisableConfirmOpen, setMfaDisableConfirmOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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
    setBusy(true); setError(null);
    const body: Record<string, string> = {
      email: invite.email.trim(),
      displayName: invite.displayName.trim(),
      role: invite.role,
    };
    if (invite.role === "FORMANDO") {
      body.nif = invite.nif.trim();
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
    const data = (await res.json()) as { inviteUrl?: string; matriculaId?: string };
    const parts = [
      data.inviteUrl ? `Convite criado (dev: ${data.inviteUrl})` : "Convite enviado por email.",
      data.matriculaId ? "Formando já inscrito na turma seleccionada." : null,
      invite.role === "FORMANDO" && !invite.turmaId
        ? "Ficha de formando criada — podes inscrevê-lo em Inscrições quando quiseres."
        : null,
    ].filter(Boolean);
    setMsg(parts.join(" "));
    setInvite(EMPTY_INVITE);
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
    else await load();
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
      cell: (u) => <span className="text-sm text-slate-400">{u.email}</span>,
    },
    {
      key: "role",
      header: "Cargo",
      sortable: true,
      sortValue: (u) => ROLE_HIERARCHY_RANK[u.role] ?? 99,
      cell: (u) => <Badge variant={ROLE_VARIANT[u.role] ?? "default"}>{u.role}</Badge>,
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
                Utilizadores seleccionados com <strong>MFA activo</strong> — podes desactivar a verificação.
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

      <DataTable
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
          <Button size="sm" variant={u.active ? "danger" : "secondary"} onClick={() => void toggleActive(u.id, !u.active)}>
            {u.active ? <ShieldOff className="h-3.5 w-3.5" /> : <Shield className="h-3.5 w-3.5" />}
            {u.active ? "Desactivar" : "Activar"}
          </Button>
        ) : undefined}
      />

      {invites.length > 0 && (
        <Card className="mt-6">
          <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><Mail className="h-4 w-4 text-yellow-400" />Convites pendentes</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {invites.map((i) => (
                <div key={i.id} className="flex items-center justify-between rounded-lg bg-slate-800/50 px-3 py-2">
                  <span className="text-sm text-slate-300">{i.email}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant={ROLE_VARIANT[i.role] ?? "default"}>{i.role}</Badge>
                    <span className="text-xs text-slate-500">expira {formatDatePt(i.expiresAt)}</span>
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
              ? "Cria a ficha de formando (NIF) e envia convite. Opcionalmente inscreve já numa turma."
              : "O utilizador receberá um email com link de activação."
          }
        >
          <form onSubmit={(e) => void sendInvite(e)} className="grid gap-4">
            <Input label="Email *" type="email" required value={invite.email} onChange={(e) => setInvite((i) => ({ ...i, email: e.target.value }))} />
            <Input label="Nome *" required value={invite.displayName} onChange={(e) => setInvite((i) => ({ ...i, displayName: e.target.value }))} />
            <Select label="Cargo" value={invite.role} onChange={(e) => setInvite((i) => ({ ...i, role: e.target.value, nif: "", turmaId: "" }))}>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </Select>
            {invite.role === "FORMANDO" ? (
              <>
                <Input
                  label="NIF *"
                  required
                  minLength={9}
                  maxLength={9}
                  value={invite.nif}
                  onChange={(e) => setInvite((i) => ({ ...i, nif: e.target.value.replace(/\D/g, "").slice(0, 9) }))}
                  placeholder="123456789"
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
                  <option value="">— Mais tarde em Inscrições —</option>
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
              <Button type="submit" disabled={busy}>{busy ? "A enviar…" : "Enviar convite"}</Button>
              <Button type="button" variant="secondary" onClick={() => setInviteDialogOpen(false)}>Cancelar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
