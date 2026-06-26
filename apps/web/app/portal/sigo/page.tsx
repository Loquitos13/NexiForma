"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Upload } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { parseApiError } from "@/lib/ui/backoffice";
import { Alert, Button } from "@/components/ui";

type SigoErro = { codigo?: string; mensagem: string; campo?: string };

type Submissao = {
  id: string;
  acaoFormacaoId: string;
  referenceId: string;
  estado: string;
  erros: SigoErro[] | null;
  submittedAt: string | null;
  reconciledAt: string | null;
  createdAt: string;
  acaoFormacao?: { codigoInterno: string; titulo: string };
};

type SigoConfig = { mode: string; configured: boolean; baseUrl?: string | null };

const estadoStyle: Record<string, string> = {
  ACEITE: "bg-green-500/10 text-green-400 border-green-500/20",
  REJEITADA: "bg-red-500/10 text-red-400 border-red-500/20",
  ERRO: "bg-red-500/10 text-red-400 border-red-500/20",
  SUBMETIDA: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  PENDENTE: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
};

export default function SigoPage() {
  const { canManage } = useTenantRole();
  const [config, setConfig] = useState<SigoConfig | null>(null);
  const [rows, setRows] = useState<Submissao[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [c, s] = await Promise.all([
      bffFetch("/api/v1/sigo/config", { headers: { accept: "application/json" } }),
      bffFetch("/api/v1/sigo/submissoes", { headers: { accept: "application/json" } }),
    ]);
    if (c.ok) setConfig((await c.json()) as SigoConfig);
    if (!s.ok) setError(await parseApiError(s));
    else setRows((await s.json()) as Submissao[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function reconciliar(id: string) {
    if (!canManage) return;
    setBusy(true);
    setMsg(null);
    setError(null);
    const res = await bffFetch(`/api/v1/sigo/submissoes/${id}/reconciliar`, { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    setMsg("Submissão reconciliada.");
    await load();
  }

  async function reenviar(id: string) {
    if (!canManage) return;
    setBusy(true);
    setMsg(null);
    setError(null);
    const res = await bffFetch(`/api/v1/sigo/submissoes/${id}/reenviar`, { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    setMsg("Nova submissão criada.");
    await load();
  }

  return (
    <div className="max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-50">SIGO</h1>
        <p className="text-sm text-slate-500 mt-1">
          Submissões, reconciliação e trilho de auditoria para importação oficial DGEEC.
        </p>
      </div>

      {error ? <Alert variant="error">{error}</Alert> : null}
      {msg ? <Alert variant="success">{msg}</Alert> : null}

      {config ? (
        <div className="rounded-2xl bg-slate-900/50 border border-slate-700/30 p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-slate-400">Modo API:</span>
            <span className="font-semibold text-slate-200">{config.mode}</span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${
                config.configured ? "bg-green-500/10 text-green-400" : "bg-slate-500/10 text-slate-500"
              }`}
            >
              {config.configured ? "Configurado" : "Desactivado"}
            </span>
            {config.baseUrl ? (
              <span className="text-xs text-slate-500 font-mono truncate max-w-xs">{config.baseUrl}</span>
            ) : null}
          </div>
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-500">A carregar…</p>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 rounded-2xl bg-slate-900/50 border border-slate-700/30">
          <Upload className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-500">Sem submissões SIGO.</p>
          <p className="text-xs text-slate-600 mt-1">Submeta uma acção a partir do dossiê pedagógico.</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-slate-900/50 border border-slate-700/30 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/30">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Acção</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Referência</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Estado</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase hidden md:table-cell">
                  Submetida
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/20">
              {rows.map((r) => {
                const erros = Array.isArray(r.erros) ? r.erros : [];
                return (
                  <tr key={r.id} className="hover:bg-slate-800/30 align-top">
                    <td className="px-4 py-3">
                      <p className="text-slate-200 text-xs font-medium">
                        {r.acaoFormacao?.codigoInterno ?? r.acaoFormacaoId.slice(0, 8)}
                      </p>
                      {r.acaoFormacao?.titulo ? (
                        <p className="text-[11px] text-slate-500 truncate max-w-[180px]">{r.acaoFormacao.titulo}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-xs text-purple-300">{r.referenceId.slice(0, 14)}…</code>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${estadoStyle[r.estado] ?? estadoStyle.PENDENTE}`}
                      >
                        {r.estado}
                      </span>
                      {erros.length > 0 ? (
                        <ul className="mt-2 space-y-1">
                          {erros.slice(0, 3).map((e, i) => (
                            <li key={i} className="text-[10px] text-red-400/90 leading-snug">
                              {e.codigo ? `[${e.codigo}] ` : ""}
                              {e.mensagem}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400 hidden md:table-cell">
                      {r.submittedAt ? new Date(r.submittedAt).toLocaleString("pt-PT") : "–"}
                    </td>
                    <td className="px-4 py-3 text-right space-y-1">
                      {canManage && r.estado === "SUBMETIDA" ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void reconciliar(r.id)}
                          className="block ml-auto px-3 py-1.5 rounded-lg border border-slate-600/40 text-xs font-medium text-slate-300 hover:bg-slate-700/40"
                        >
                          Reconciliar
                        </button>
                      ) : null}
                      {canManage && (r.estado === "REJEITADA" || r.estado === "ERRO") ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void reenviar(r.id)}
                          className="flex items-center gap-1 ml-auto px-3 py-1.5 rounded-lg border border-slate-600/40 text-xs font-medium text-slate-300 hover:bg-slate-700/40"
                        >
                          <RefreshCw className="h-3 w-3" />
                          Reenviar
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
