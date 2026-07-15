"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { FaturaEstadoBadge } from "@/components/crm/fatura-estado-badge";
import { buttonVariants, Card, CardContent, DataTable, type Column } from "@/components/ui";
import { cn } from "@/lib/ui/cn";
import { fmtEuro, fmtFaturaRef, fmtDate } from "@/lib/crm/shared";
import type { ClienteFichaFatura } from "@/components/crm/use-cliente-ficha-data";

type Props = {
  entidadeId: string;
  faturas: ClienteFichaFatura[];
  loading: boolean;
  canCreate?: boolean;
};

export function ClienteFichaFaturas({ entidadeId, faturas, loading, canCreate }: Props) {
  const COLS: Column<ClienteFichaFatura>[] = [
    {
      key: "ref",
      header: "Referência",
      cell: (f) => (
        <Link href={`/portal/crm/faturas/${f.id}`} className="font-medium text-blue-400 hover:underline">
          {fmtFaturaRef(f.serie, f.numero)}
        </Link>
      ),
    },
    {
      key: "estado",
      header: "Estado",
      cell: (f) => <FaturaEstadoBadge estado={f.estado as never} />,
    },
    {
      key: "valor",
      header: "Valor",
      cell: (f) => <span className="tabular-nums text-slate-200">{fmtEuro(f.valorCentavos)}</span>,
    },
    {
      key: "proposta",
      header: "Proposta",
      cell: (f) => (
        <span className="text-sm text-slate-400">{f.proposta?.codigo ?? "-"}</span>
      ),
    },
    {
      key: "data",
      header: "Data",
      cell: (f) => <span className="text-sm text-slate-500">{fmtDate(f.createdAt)}</span>,
    },
  ];

  return (
    <Card>
      <CardContent className="pt-6">
        {canCreate ? (
          <div className="mb-4 flex justify-end">
            <Link
              href={`/portal/crm/faturas?entidade=${entidadeId}&nova=1`}
              className={cn(buttonVariants({ size: "sm" }))}
            >
              <Plus className="h-4 w-4" />
              Nova fatura
            </Link>
          </div>
        ) : null}
        <DataTable
          columns={COLS}
          data={faturas}
          keyField="id"
          loading={loading}
          emptyMessage="Sem faturas para este cliente."
        />
      </CardContent>
    </Card>
  );
}
