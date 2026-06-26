"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { bo, parseApiError } from "@/lib/ui/backoffice";

type Entidade = {
  id: string;
  nif: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  _count?: { formandos: number; propostas: number };
};

export function CrmDashboard() {
  const [entidades, setEntidades] = useState<Entidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await bffFetch("/api/v1/entidades-cliente", { headers: { accept: "application/json" } });
    if (!res.ok) setError(await parseApiError(res));
    else setEntidades((await res.json()) as Entidade[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      {error ? <p style={bo.alert}>{error}</p> : null}
      {loading ? (
        <p style={{ color: "#64748b" }}>A carregar…</p>
      ) : (
        <table style={bo.table}>
          <thead>
            <tr>
              <th style={bo.th}>Entidade</th>
              <th style={bo.th}>Contacto</th>
              <th style={bo.th}>Formandos</th>
              <th style={bo.th}>Propostas</th>
              <th style={bo.th}></th>
            </tr>
          </thead>
          <tbody>
            {entidades.map((e) => (
              <tr key={e.id}>
                <td style={bo.td}>
                  {e.nome}
                  <span style={{ display: "block", color: "#64748b", fontSize: "0.8rem" }}>NIF {e.nif}</span>
                </td>
                <td style={bo.td}>
                  {e.email ?? "–"}
                  {e.telefone ? (
                    <span style={{ display: "block", color: "#64748b", fontSize: "0.8rem" }}>{e.telefone}</span>
                  ) : null}
                </td>
                <td style={bo.td}>{e._count?.formandos ?? 0}</td>
                <td style={bo.td}>
                  <Link href={`/portal/propostas?entidade=${e.id}`} style={{ color: "#93c5fd" }}>
                    {e._count?.propostas ?? 0}
                  </Link>
                </td>
                <td style={bo.td}>
                  <Link href={`/portal/propostas?entidade=${e.id}`} style={{ ...bo.btnSecondary, textDecoration: "none" }}>
                    Propostas
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
