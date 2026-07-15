"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { ConsentAdminPanel } from "@/components/consent/consent-admin-panel";
import { MyRgpdSettings } from "@/components/consent/my-rgpd-settings";
import { EmptyState, LoadingBlock, PageShell, StatusBadge } from "@/components/portal/page-shell";
import { bo, parseApiError } from "@/lib/ui/backoffice";

type Pedido = {
  id: string;
  subjectType: string;
  tipo: string;
  estado: string;
  createdAt: string;
  processedAt: string | null;
};

export default function RgpdPage() {
  const { canManage } = useTenantRole();
  const [rows, setRows] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState({ subjectId: "", subjectType: "formando", tipo: "EXPORT" });

  const load = useCallback(async () => {
    if (!canManage) return;
    setLoading(true);
    const res = await bffFetch("/api/v1/rgpd/pedidos", { headers: { accept: "application/json" } });
    if (!res.ok) setError(await parseApiError(res));
    else setRows((await res.json()) as Pedido[]);
    setLoading(false);
  }, [canManage]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canManage || !form.subjectId.trim()) return;
    setError(null);
    setMsg(null);
    const res = await bffFetch("/api/v1/rgpd/pedidos", {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) setError(await parseApiError(res));
    else {
      setMsg("Pedido RGPD processado.");
      setForm({ ...form, subjectId: "" });
      await load();
    }
  }

  const estadoColor = (e: string) =>
    e === "PROCESSADO" ? "#4ade80" : e === "REJEITADO" ? "#f87171" : "#fbbf24";

  return (
    <PageShell
      title="RGPD"
      subtitle={
        canManage
          ? "Consentimentos, exportação e anonimização de dados."
          : "Consulta e gere o teu consentimento sobre tratamento de dados pessoais."
      }
    >
      {error ? <p style={bo.alert}>{error}</p> : null}
      {msg ? <p style={bo.ok}>{msg}</p> : null}

      <div style={{ ...bo.card, marginBottom: "1rem" }}>
        <MyRgpdSettings />
      </div>

      {canManage ? (
        <div style={{ ...bo.card, marginBottom: "1rem" }}>
          <h2 style={bo.h2}>Registo de consentimentos</h2>
          <p style={{ fontSize: "0.875rem", color: "#94a3b8", marginBottom: "1rem" }}>
            Consulta as decisões RGPD registadas pelos utilizadores do teu tenant (somente leitura).
          </p>
          <ConsentAdminPanel mode="tenant" />
        </div>
      ) : null}

      {canManage ? (
        <form onSubmit={submit} style={{ ...bo.card, display: "grid", gap: "0.75rem", maxWidth: 480 }}>
          <h2 style={bo.h2}>Novo pedido</h2>
          <label style={bo.label}>
            ID do sujeito (UUID formando ou entidade)
            <input
              style={bo.input}
              value={form.subjectId}
              onChange={(e) => setForm({ ...form, subjectId: e.target.value })}
              required
            />
          </label>
          <label style={bo.label}>
            Tipo sujeito
            <select
              style={bo.input}
              value={form.subjectType}
              onChange={(e) => setForm({ ...form, subjectType: e.target.value })}
            >
              <option value="formando">formando</option>
              <option value="entidade_cliente">entidade_cliente</option>
            </select>
          </label>
          <label style={bo.label}>
            Operação
            <select
              style={bo.input}
              value={form.tipo}
              onChange={(e) => setForm({ ...form, tipo: e.target.value })}
            >
              <option value="EXPORT">EXPORT</option>
              <option value="DELETE">DELETE (anonimizar)</option>
            </select>
          </label>
          <button type="submit" style={bo.btn}>
            Submeter pedido
          </button>
        </form>
      ) : null}

      {canManage ? (
        <div style={{ ...bo.card, marginTop: "1rem" }}>
          <h2 style={bo.h2}>Histórico</h2>
          {loading ? (
            <LoadingBlock />
          ) : rows.length === 0 ? (
            <EmptyState message="Sem pedidos RGPD registados." />
          ) : (
            <table style={bo.table}>
              <thead>
                <tr>
                  <th style={bo.th}>Tipo</th>
                  <th style={bo.th}>Sujeito</th>
                  <th style={bo.th}>Estado</th>
                  <th style={bo.th}>Data</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td style={bo.td}>{r.tipo}</td>
                    <td style={bo.td}>{r.subjectType}</td>
                    <td style={bo.td}>
                      <StatusBadge label={r.estado} color={estadoColor(r.estado)} />
                    </td>
                    <td style={bo.td}>{new Date(r.createdAt).toLocaleString("pt-PT")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}
    </PageShell>
  );
}
