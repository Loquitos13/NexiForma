"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { LeadEstadoBadge } from "@/components/crm/lead-estado-badge";
import { parsePaginatedList } from "@/lib/crm/paginated-list";
import { fmtDate, fmtEuro, fmtCrmAutor } from "@/lib/crm/shared";
import { Card, CardContent } from "@/components/ui";

type Lead = {
  id: string;
  codigo: string;
  empresaNome: string;
  estado: string;
  valorEstimadoCentavos: number;
  updatedAt: string;
  criadoPor?: { displayName: string } | null;
  atribuido?: { displayName: string } | null;
  entidadeCliente?: { id: string } | null;
};

type Props = {
  entidadeId: string;
};

export function ClienteFichaLeads({ entidadeId }: Props) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await bffFetch(
      `/api/v1/crm/leads?entidadeClienteId=${entidadeId}&pageSize=100`,
      { headers: { accept: "application/json" } },
    );
    setLoading(false);
    if (!res.ok) return;
    const data = parsePaginatedList<Lead>(await res.json());
    setLeads(data.items);
  }, [entidadeId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <p className="text-sm text-slate-500">A carregar leads…</p>;

  if (leads.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Sem leads associados a este cliente.{" "}
        <Link href="/portal/crm/leads" className="text-violet-400 underline">
          Ver pipeline
        </Link>
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {leads.map((l) => (
        <Card key={l.id}>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div>
              <p className="font-medium text-slate-100">{l.empresaNome}</p>
              <p className="text-xs text-slate-500">{l.codigo} · {fmtDate(l.updatedAt)}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Registado por {fmtCrmAutor(l.criadoPor)}
                {l.atribuido?.displayName && l.atribuido.displayName !== l.criadoPor?.displayName
                  ? ` · responsável ${l.atribuido.displayName}`
                  : ""}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {l.valorEstimadoCentavos > 0 ? (
                <span className="text-sm tabular-nums text-slate-300">
                  {fmtEuro(l.valorEstimadoCentavos)}
                </span>
              ) : null}
              <LeadEstadoBadge estado={l.estado} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
