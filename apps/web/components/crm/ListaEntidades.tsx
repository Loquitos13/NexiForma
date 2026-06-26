"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { bffFetch } from "@/lib/client/bff-fetch";
import { bo, parseApiError } from "@/lib/ui/backoffice";

type Entidade = {
  id: string;
  nif: string;
  nome: string;
  email: string | null;
  telefone: string | null;
};

interface ListaEntidadesProps {
  onSelect?: (id: string) => void;
}

export function ListaEntidades({ onSelect }: ListaEntidadesProps) {
  const [entidades, setEntidades] = useState<Entidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const q = busca ? `?nome=${encodeURIComponent(busca)}` : "";
    const res = await bffFetch(`/api/v1/entidades-cliente${q}`, { headers: { accept: "application/json" } });
    if (!res.ok) setError(await parseApiError(res));
    else setEntidades((await res.json()) as Entidade[]);
    setLoading(false);
  }, [busca]);

  useEffect(() => {
    void load();
  }, [load]);

  function handleBusca(e: FormEvent) {
    e.preventDefault();
    void load();
  }

  return (
    <div>
      <form onSubmit={handleBusca} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
        <input
          style={bo.input}
          placeholder="Buscar por nome…"
          value={busca}
          onChange={(ev) => setBusca(ev.target.value)}
        />
        <button type="submit" style={bo.btnSecondary}>
          Buscar
        </button>
      </form>

      {error ? <p style={bo.alert}>{error}</p> : null}

      {loading ? (
        <p style={{ color: "#64748b" }}>A carregar…</p>
      ) : entidades.length === 0 ? (
        <p style={{ color: "#64748b" }}>
          Nenhuma entidade encontrada.{" "}
          <Link href="/portal/entidades" style={{ color: "#93c5fd" }}>
            Criar entidade
          </Link>
        </p>
      ) : (
        <table style={bo.table}>
          <thead>
            <tr>
              <th style={bo.th}>Nome</th>
              <th style={bo.th}>NIF</th>
              <th style={bo.th}>Email</th>
              <th style={bo.th}></th>
            </tr>
          </thead>
          <tbody>
            {entidades.map((e) => (
              <tr key={e.id}>
                <td style={bo.td}>{e.nome}</td>
                <td style={bo.td}>{e.nif}</td>
                <td style={bo.td}>{e.email ?? "–"}</td>
                <td style={bo.td}>
                  {onSelect ? (
                    <button type="button" style={bo.btnSecondary} onClick={() => onSelect(e.id)}>
                      Selecionar
                    </button>
                  ) : (
                    <Link href={`/portal/propostas?entidade=${e.id}`} style={{ color: "#93c5fd" }}>
                      Ver propostas
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
