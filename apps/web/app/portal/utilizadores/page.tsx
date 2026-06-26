"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { UserPlus, Shield, ShieldOff, ShieldCheck, Mail } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { parseApiError } from "@/lib/ui/backoffice";
import {
  Alert, Badge, Button, Card, CardContent, CardHeader, CardTitle,
  DataTable, Dialog, DialogContent, Input, PageHeader, Select, type Column,
} from "@/components/ui";

type UserRow = { id: string; email: string; displayName: string; role: string; active: boolean; mfaEnabled: boolean };
type InviteRow = { id: string; email: string; role: string; expiresAt: string };

const ROLES = ["ADMIN", "COORDENADOR", "FORMADOR", "FINANCEIRO", "COMERCIAL"];
const ROLE_VARIANT: Record<string, "purple" | "blue" | "teal" | "yellow" | "green"> = {
  ADMIN: "purple", COORDENADOR: "blue", FORMADOR: "teal", FINANCEIRO: "yellow", COMERCIAL: "green",
};

export default function UtilizadoresPage() {
  const { canManage } = useTenantRole();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [mfaDialogOpen, setMfaDialogOpen] = useState(false);
  const [invite, setInvite] = useState({ email: "", displayName: "", role: "FORMADOR" });
  const [mfaCode, setMfaCode] = useState("");
  const [mfaSetup, setMfaSetup] = useState<{ qrDataUrl: string; secret: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [uRes, iRes] = await Promise.all([
      bffFetch("/api/v1/users", { headers: { accept: "application/json" } }),
      bffFetch("/api/v1/users/invites", { headers: { accept: "application/json" } }),
    ]);
    if (uRes.ok) setUsers((await uRes.json()) as UserRow[]);
    else setError(await parseApiError(uRes));
    if (iRes.ok) setInvites((await iRes.json()) as InviteRow[]);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function sendInvite(e: FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    setBusy(true); setError(null);
    const res = await bffFetch("/api/v1/users/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify(invite),
    });
    setBusy(false);
    if (!res.ok) { setError(await parseApiError(res)); return; }
    const data = (await res.json()) as { inviteUrl?: string };
    setMsg(data.inviteUrl ? `Convite criado (dev: ${data.inviteUrl})` : "Convite enviado por email.");
    setInvite({ email: "", displayName: "", role: "FORMADOR" });
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

  async function setupMfa() {
    setBusy(true);
    setError(null);
    setMfaCode("");
    const res = await bffFetch("/api/auth/mfa/setup", { method: "POST", headers: { accept: "application/json" } });
    setBusy(false);
    if (!res.ok) { setError(await parseApiError(res)); return; }
    const data = (await res.json()) as { qrDataUrl?: string; secret?: string };
    if (!data.qrDataUrl || !data.secret) {
      setError("Resposta MFA inválida. Tenta novamente.");
      return;
    }
    setMfaSetup({ qrDataUrl: data.qrDataUrl, secret: data.secret });
    setMfaDialogOpen(true);
  }

  async function confirmMfa(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const res = await bffFetch("/api/auth/mfa/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ code: mfaCode }),
    });
    setBusy(false);
    if (!res.ok) { setError(await parseApiError(res)); return; }
    setMsg("MFA activado com sucesso.");
    setMfaCode("");
    setMfaSetup(null);
    setMfaDialogOpen(false);
    await load();
  }

  function closeMfaDialog(open: boolean) {
    setMfaDialogOpen(open);
    if (!open) {
      setMfaCode("");
      setMfaSetup(null);
    }
  }

  const USER_COLS: Column<UserRow>[] = [
    { key: "displayName", header: "Nome", cell: (u) => <span className="font-medium text-slate-100">{u.displayName}</span> },
    { key: "email", header: "Email", cell: (u) => <span className="text-sm text-slate-400">{u.email}</span> },
    {
      key: "role", header: "Papel",
      cell: (u) => <Badge variant={ROLE_VARIANT[u.role] ?? "default"}>{u.role}</Badge>,
    },
    {
      key: "mfaEnabled", header: "MFA",
      cell: (u) => u.mfaEnabled
        ? <span className="flex items-center gap-1 text-green-400 text-xs"><ShieldCheck className="h-3.5 w-3.5" />Activo</span>
        : <span className="text-xs text-slate-500">–</span>,
    },
    {
      key: "active", header: "Estado",
      cell: (u) => <Badge variant={u.active ? "green" : "default"}>{u.active ? "Activo" : "Inactivo"}</Badge>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Utilizadores"
        description="Gestão de equipa, convites por email e autenticação MFA (TOTP) para gestores."
        actions={
          canManage ? (
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => void setupMfa()}>
                <Shield className="h-3.5 w-3.5" />Configurar MFA
              </Button>
              <Button onClick={() => setInviteDialogOpen(true)}>
                <UserPlus className="h-4 w-4" />Convidar
              </Button>
            </div>
          ) : null
        }
      />

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}
      {msg && <Alert variant="success" className="mb-4">{msg}</Alert>}

      <DataTable
        columns={USER_COLS}
        data={users}
        keyField="id"
        loading={false}
        emptyMessage="Sem utilizadores."
        rowActions={canManage ? (u) => (
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
                    <span className="text-xs text-slate-500">expira {new Date(i.expiresAt).toLocaleDateString("pt-PT")}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invite dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent title="Convidar utilizador" description="O utilizador receberá um email com link de activação.">
          <form onSubmit={(e) => void sendInvite(e)} className="grid gap-4">
            <Input label="Email *" type="email" required value={invite.email} onChange={(e) => setInvite((i) => ({ ...i, email: e.target.value }))} />
            <Input label="Nome *" required value={invite.displayName} onChange={(e) => setInvite((i) => ({ ...i, displayName: e.target.value }))} />
            <Select label="Papel" value={invite.role} onChange={(e) => setInvite((i) => ({ ...i, role: e.target.value }))}>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </Select>
            <div className="flex gap-2 pt-1">
              <Button type="submit" disabled={busy}>{busy ? "A enviar…" : "Enviar convite"}</Button>
              <Button type="button" variant="secondary" onClick={() => setInviteDialogOpen(false)}>Cancelar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* MFA dialog */}
      <Dialog open={mfaDialogOpen} onOpenChange={closeMfaDialog}>
        <DialogContent
          title="Activar MFA"
          description="Compatível com Microsoft Authenticator, Google Authenticator e outras apps TOTP."
        >
          <form onSubmit={(e) => void confirmMfa(e)} className="grid gap-4">
            {mfaSetup ? (
              <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-4 space-y-3">
                <p className="text-sm text-slate-300">
                  1. Abre a app (ex.: <strong className="text-slate-100">Microsoft Authenticator</strong> → Adicionar conta → Outra conta).
                </p>
                <p className="text-sm text-slate-300">2. Lê o QR code ou introduz a chave manualmente.</p>
                <div className="flex justify-center rounded-lg bg-white p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={mfaSetup.qrDataUrl} alt="QR code MFA NexiForma" width={220} height={220} />
                </div>
                <div className="rounded-md bg-slate-800/80 px-3 py-2">
                  <p className="text-xs text-slate-500 mb-1">Chave manual (se não conseguires ler o QR)</p>
                  <p className="font-mono text-sm text-slate-200 break-all select-all">{mfaSetup.secret}</p>
                </div>
              </div>
            ) : null}
            <Input
              label="Código de 6 dígitos *"
              required
              minLength={6}
              maxLength={6}
              inputMode="numeric"
              autoComplete="one-time-code"
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
            />
            <div className="flex gap-2">
              <Button type="submit" disabled={busy || mfaCode.length !== 6}>{busy ? "A verificar…" : "Activar MFA"}</Button>
              <Button type="button" variant="secondary" onClick={() => closeMfaDialog(false)}>Cancelar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
