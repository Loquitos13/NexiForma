"use client";

import { useCallback, useEffect, useState } from "react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { parseApiError } from "@/lib/ui/backoffice";
import { Badge } from "@/components/ui/badge";

export type ConsentRow = {
  id: string;
  userId: string;
  email: string;
  displayName: string;
  role: string;
  active: boolean;
  userAccepted: boolean | null;
  userDecidedAt: string | null;
  termsVersion: string;
  tenantSlug?: string;
  tenantLegalName?: string;
};

type Props = {
  mode: "tenant" | "platform";
};

/** Registo consultável das decisões RGPD - apenas o utilizador decide aceitar ou recusar. */
export function ConsentAdminPanel({ mode }: Props) {
  const [rows, setRows] = useState<ConsentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const url =
      mode === "platform" ? "/api/v1/consent/platform" : "/api/v1/consent/tenant";
    const r = await bffFetch(url, { headers: { accept: "application/json" } });
    if (!r.ok) {
      setError(await parseApiError(r));
      setRows([]);
    } else {
      setRows((await r.json()) as ConsentRow[]);
    }
    setLoading(false);
  }, [mode]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <p className="text-sm text-slate-500">A carregar consentimentos…</p>;
  if (error) return <p className="text-sm text-red-400">{error}</p>;
  if (!rows.length) return <p className="text-sm text-slate-500">Sem registos de consentimento.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[560px]">
        <thead>
          <tr className="border-b border-slate-700/40 text-left text-xs text-slate-500 uppercase">
            {mode === "platform" ? <th className="py-2 pr-3">Tenant</th> : null}
            <th className="py-2 pr-3">Utilizador</th>
            <th className="py-2 pr-3">Papel</th>
            <th className="py-2 pr-3">Decisão</th>
            <th className="py-2 pr-3">Data</th>
            <th className="py-2">Versão aviso</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/50">
          {rows.map((row) => (
            <tr key={row.id}>
              {mode === "platform" ? (
                <td className="py-2.5 pr-3 text-slate-400 text-xs">
                  {row.tenantLegalName ?? row.tenantSlug}
                </td>
              ) : null}
              <td className="py-2.5 pr-3">
                <p className="text-slate-200">{row.displayName}</p>
                <p className="text-xs text-slate-500">{row.email}</p>
              </td>
              <td className="py-2.5 pr-3 text-slate-400 text-xs">{row.role}</td>
              <td className="py-2.5 pr-3">
                {row.userAccepted === null ? (
                  <Badge variant="yellow">Pendente</Badge>
                ) : row.userAccepted ? (
                  <Badge variant="green">Aceite</Badge>
                ) : (
                  <Badge variant="red">Recusado</Badge>
                )}
              </td>
              <td className="py-2.5 pr-3 text-slate-400 text-xs whitespace-nowrap">
                {row.userDecidedAt
                  ? new Date(row.userDecidedAt).toLocaleString("pt-PT")
                  : "-"}
              </td>
              <td className="py-2.5 text-slate-500 text-xs">{row.termsVersion}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
