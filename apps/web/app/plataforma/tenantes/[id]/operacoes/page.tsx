"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { bffFetch } from "@/lib/client/bff-fetch";
import { persistAuthFromResponse } from "@/lib/client/auth-login";
import { parseApiError } from "@/lib/ui/backoffice";
import { PageContentSkeleton } from "@/components/ui/page-skeleton";

type UserRow = {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
  active: boolean;
  mustChangePassword: boolean;
  formandoProfile: { id: string; nome: string } | null;
};

type AccessKeyRow = {
  id: string;
  keyPrefix: string;
  label: string | null;
  status: "ACTIVE" | "REVOKED" | "EXPIRED";
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  revokedAt: string | null;
};

const KEY_REFRESH_MS = 30_000;

const keyStatusStyle: Record<AccessKeyRow["status"], string> = {
  ACTIVE: "text-emerald-400 bg-emerald-500/10",
  REVOKED: "text-red-400 bg-red-500/10",
  EXPIRED: "text-slate-500 bg-slate-500/10",
};

const keyStatusLabel: Record<AccessKeyRow["status"], string> = {
  ACTIVE: "Activa",
  REVOKED: "Revogada",
  EXPIRED: "Expirada",
};

const inputClass =
  "w-full rounded-lg border border-purple-500/15 bg-[#0c0a14] px-3 py-2 text-sm text-slate-200 outline-none focus:border-purple-500/40";

export default function TenantOperacoesPage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = params.id as string;

  const [tenant, setTenant] = useState<{ slug: string; legalName: string } | null>(null);
  const [searchQ, setSearchQ] = useState("");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [forceChange, setForceChange] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [accessKeys, setAccessKeys] = useState<AccessKeyRow[]>([]);
  /** Chave em texto claro - mostrada uma única vez após geração. */
  const [revealedKeyOnce, setRevealedKeyOnce] = useState<string | null>(null);
  const [keyCopied, setKeyCopied] = useState(false);
  const [redeemKey, setRedeemKey] = useState("");
  const [diagnosis, setDiagnosis] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadKeys = useCallback(async () => {
    const keysR = await bffFetch(`/api/v1/control-plane/tenants/${tenantId}/access-keys`, {
      headers: { accept: "application/json" },
    });
    if (keysR.ok) setAccessKeys((await keysR.json()) as AccessKeyRow[]);
  }, [tenantId]);

  const load = useCallback(async () => {
    const tenantR = await bffFetch(`/api/v1/control-plane/tenants/${tenantId}`, {
      headers: { accept: "application/json" },
    });
    if (tenantR.ok) {
      const t = (await tenantR.json()) as { slug: string; legalName: string };
      setTenant(t);
    }
    await loadKeys();
    setLoading(false);
  }, [tenantId, loadKeys]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = setInterval(() => void loadKeys(), KEY_REFRESH_MS);
    return () => clearInterval(id);
  }, [loadKeys]);

  async function searchUsers(e?: FormEvent) {
    e?.preventDefault();
    if (searchQ.trim().length < 2) return;
    setBusy(true);
    setError(null);
    const r = await bffFetch(
      `/api/v1/control-plane/tenants/${tenantId}/users/search?q=${encodeURIComponent(searchQ.trim())}`,
      { headers: { accept: "application/json" } },
    );
    setBusy(false);
    if (!r.ok) {
      setError(`HTTP ${r.status}`);
      return;
    }
    const list = (await r.json()) as UserRow[];
    setUsers(list);
    if (list[0]) setSelectedUser(list[0]);
  }

  async function resetPassword() {
    if (!selectedUser) return;
    setBusy(true);
    setError(null);
    setTempPassword(null);
    const r = await bffFetch(
      `/api/v1/control-plane/tenants/${tenantId}/users/${selectedUser.id}/reset-password`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({ forceChangeOnLogin: forceChange, notifyEmail }),
      },
    );
    setBusy(false);
    if (!r.ok) {
      setError(await parseApiError(r));
      return;
    }
    const data = (await r.json()) as { temporaryPassword: string };
    setTempPassword(data.temporaryPassword);
    setMsg("Password temporária gerada.");
  }

  async function diagnoseFormando() {
    const formando = selectedUser?.formandoProfile;
    if (!formando) {
      setError("Utilizador seleccionado não é formando.");
      return;
    }
    setBusy(true);
    const r = await bffFetch(
      `/api/v1/control-plane/tenants/${tenantId}/formandos/${formando.id}/diagnose-access`,
      { headers: { accept: "application/json" } },
    );
    setBusy(false);
    if (!r.ok) {
      setError(`HTTP ${r.status}`);
      return;
    }
    setDiagnosis((await r.json()) as Record<string, unknown>);
  }

  async function fixAccess() {
    const formando = selectedUser?.formandoProfile;
    if (!formando) return;
    setBusy(true);
    const r = await bffFetch(
      `/api/v1/control-plane/tenants/${tenantId}/formandos/${formando.id}/fix-access`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          linkUserId: selectedUser?.id,
        }),
      },
    );
    setBusy(false);
    if (!r.ok) {
      setError(await parseApiError(r));
      return;
    }
    setMsg("Correcções aplicadas.");
    await diagnoseFormando();
  }

  async function createAccessKey() {
    setBusy(true);
    setRevealedKeyOnce(null);
    setKeyCopied(false);
    const r = await bffFetch(`/api/v1/control-plane/tenants/${tenantId}/access-keys`, {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ label: "Suporte NexiForma" }),
    });
    setBusy(false);
    if (!r.ok) {
      setError(await parseApiError(r));
      return;
    }
    const data = (await r.json()) as { key: string };
    setRevealedKeyOnce(data.key);
    setMsg("Chave gerada - copie agora; não voltará a ser mostrada.");
    await loadKeys();
  }

  function dismissRevealedKey() {
    setRevealedKeyOnce(null);
    setKeyCopied(false);
  }

  async function copyRevealedKey() {
    if (!revealedKeyOnce) return;
    try {
      await navigator.clipboard.writeText(revealedKeyOnce);
      setKeyCopied(true);
    } catch {
      setError("Não foi possível copiar para a área de transferência.");
    }
  }

  async function revokeAccessKey(keyId: string) {
    if (!confirm("Revogar esta chave? Deixará de funcionar imediatamente.")) return;
    setBusy(true);
    setError(null);
    const r = await bffFetch(`/api/v1/control-plane/tenants/${tenantId}/access-keys/${keyId}`, {
      method: "DELETE",
      headers: { accept: "application/json" },
    });
    setBusy(false);
    if (!r.ok) {
      setError(await parseApiError(r));
      return;
    }
    setMsg("Chave revogada.");
    await loadKeys();
  }

  async function enterViaKey(explicitKey?: string) {
    const key = explicitKey ?? redeemKey.trim();
    if (!key) return;
    setBusy(true);
    const r = await bffFetch("/api/auth/tenant-access/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ key }),
    });
    setBusy(false);
    if (!r.ok) {
      setError(await parseApiError(r));
      return;
    }
    await persistAuthFromResponse(r);
    dismissRevealedKey();
    router.push("/portal/crm");
    router.refresh();
  }

  async function enterCrmAsAdmin() {
    const admin = users.find((u) => u.role === "ADMIN") ?? users.find((u) => u.role !== "FORMANDO");
    if (!admin) {
      setError("Sem gestor ADMIN encontrado - pesquise utilizadores primeiro.");
      return;
    }
    setBusy(true);
    const r = await bffFetch("/api/auth/impersonation/start", {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        tenantId,
        targetUserId: admin.id,
        reason: "Suporte CRM e faturação",
        readOnly: false,
      }),
    });
    setBusy(false);
    if (!r.ok) {
      setError(await parseApiError(r));
      return;
    }
    await persistAuthFromResponse(r);
    router.push("/portal/crm/faturas");
    router.refresh();
  }

  if (loading) return <PageContentSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={`/plataforma/tenantes/${tenantId}`} className="text-xs text-purple-400 hover:underline">
            ← Tenant
          </Link>
          <h1 className="text-2xl font-bold text-slate-50">Operações - {tenant?.legalName}</h1>
          <p className="text-sm text-slate-500">{tenant?.slug}</p>
        </div>
        <button
          type="button"
          onClick={() => void enterCrmAsAdmin()}
          disabled={busy}
          className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500 disabled:opacity-50"
        >
          Entrar no CRM (faturação)
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/25 bg-red-950/40 px-4 py-3 text-sm text-red-300">{error}</div>
      ) : null}
      {msg ? (
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-300">{msg}</div>
      ) : null}

      <section className="rounded-2xl border border-purple-500/10 bg-[#0c0a14]/80 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-300">Pesquisar utilizador</h2>
        <form onSubmit={searchUsers} className="flex gap-2">
          <input
            className={inputClass}
            placeholder="Email ou nome"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
          />
          <button type="submit" disabled={busy} className="rounded-lg bg-purple-600 px-4 py-2 text-sm text-white">
            Pesquisar
          </button>
        </form>
        {users.length ? (
          <select
            className={inputClass}
            value={selectedUser?.id ?? ""}
            onChange={(e) => setSelectedUser(users.find((u) => u.id === e.target.value) ?? null)}
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.email} ({u.role}){u.formandoProfile ? ` - ${u.formandoProfile.nome}` : ""}
              </option>
            ))}
          </select>
        ) : null}
      </section>

      {selectedUser ? (
        <section className="rounded-2xl border border-purple-500/10 bg-[#0c0a14]/80 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-300">Password temporária</h2>
          <label className="flex items-center gap-2 text-sm text-slate-400">
            <input type="checkbox" checked={forceChange} onChange={(e) => setForceChange(e.target.checked)} />
            Obrigar redefinição após primeiro login
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-400">
            <input type="checkbox" checked={notifyEmail} onChange={(e) => setNotifyEmail(e.target.checked)} />
            Enviar password por email ao utilizador
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => void resetPassword()}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-500"
          >
            Emitir password temporária
          </button>
          {tempPassword ? (
            <p className="font-mono text-sm text-amber-300">Password: {tempPassword}</p>
          ) : null}
        </section>
      ) : null}

      {selectedUser?.formandoProfile ? (
        <section className="rounded-2xl border border-purple-500/10 bg-[#0c0a14]/80 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-300">Acesso a conteúdos (formando)</h2>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => void diagnoseFormando()} className="rounded-lg border border-purple-500/20 px-3 py-2 text-sm text-purple-300">
              Diagnosticar
            </button>
            <button type="button" disabled={busy} onClick={() => void fixAccess()} className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white">
              Corrigir acesso
            </button>
          </div>
          {diagnosis ? (
            <pre className="max-h-64 overflow-auto rounded-lg bg-black/40 p-3 text-xs text-slate-400">
              {JSON.stringify(diagnosis, null, 2)}
            </pre>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-2xl border border-purple-500/10 bg-[#0c0a14]/80 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-300">Chave de acesso ao tenant</h2>
        <p className="text-xs text-slate-500">
          Chave válida <strong className="text-slate-400">10 horas</strong>. Mostrada uma única vez após
          geração. Pode ser revogada a qualquer momento.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void createAccessKey()}
          className="rounded-lg bg-purple-600 px-4 py-2 text-sm text-white hover:bg-purple-500 disabled:opacity-50"
        >
          Gerar chave (10 horas)
        </button>

        {revealedKeyOnce ? (
          <div className="space-y-3 rounded-xl border border-amber-500/30 bg-amber-950/20 p-4">
            <p className="text-xs font-medium text-amber-200">
              Copie agora - esta chave não voltará a aparecer neste ecrã.
            </p>
            <p className="break-all rounded-lg bg-black/40 p-3 font-mono text-xs text-amber-300">
              {revealedKeyOnce}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void copyRevealedKey()}
                className="rounded-lg border border-amber-500/30 px-3 py-1.5 text-xs text-amber-200 hover:bg-amber-500/10"
              >
                {keyCopied ? "Copiada ✓" : "Copiar chave"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void enterViaKey(revealedKeyOnce)}
                className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs text-white hover:bg-purple-500 disabled:opacity-50"
              >
                Entrar agora
              </button>
              <button
                type="button"
                onClick={dismissRevealedKey}
                className="rounded-lg border border-slate-600/40 px-3 py-1.5 text-xs text-slate-400 hover:bg-white/5"
              >
                Já copiei - fechar
              </button>
            </div>
          </div>
        ) : null}

        {accessKeys.length ? (
          <ul className="space-y-2">
            {accessKeys.map((k) => (
              <li
                key={k.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs"
              >
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-300">{k.label ?? "Chave de acesso"}</span>
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${keyStatusStyle[k.status] ?? keyStatusStyle.EXPIRED}`}
                    >
                      {keyStatusLabel[k.status] ?? k.status}
                    </span>
                  </div>
                  <p className="text-slate-600">
                    {k.keyPrefix}••••
                    {k.expiresAt
                      ? ` · expira ${new Date(k.expiresAt).toLocaleString("pt-PT")}`
                      : ""}
                    {k.lastUsedAt
                      ? ` · usada ${new Date(k.lastUsedAt).toLocaleString("pt-PT")}`
                      : ""}
                    {k.revokedAt
                      ? ` · revogada ${new Date(k.revokedAt).toLocaleString("pt-PT")}`
                      : ""}
                  </p>
                </div>
                {k.status === "ACTIVE" ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void revokeAccessKey(k.id)}
                    className="shrink-0 rounded-lg border border-red-500/25 px-2.5 py-1 text-[11px] text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                  >
                    Revogar
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-slate-600">Nenhuma chave gerada para este tenant.</p>
        )}

        <div className="flex gap-2 border-t border-purple-500/10 pt-4">
          <input
            className={inputClass}
            placeholder="Colar chave nf_access_..."
            value={redeemKey}
            onChange={(e) => setRedeemKey(e.target.value)}
          />
          <button
            type="button"
            disabled={busy || !redeemKey.trim()}
            onClick={() => void enterViaKey()}
            className="rounded-lg border border-purple-500/20 px-4 py-2 text-sm text-purple-300 disabled:opacity-50"
          >
            Entrar
          </button>
        </div>
      </section>
    </div>
  );
}
