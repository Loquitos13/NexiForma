"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { PropostaEstadoBadge } from "@/components/crm/proposta-estado-badge";
import { buttonVariants, Card, CardContent, DataTable, type Column } from "@/components/ui";
import { cn } from "@/lib/ui/cn";
import { fmtDate, fmtEuro, fmtPropostaAutoria } from "@/lib/crm/shared";
import type { ClienteFichaProposta } from "@/components/crm/use-cliente-ficha-data";

type Props = {
  entidadeId: string;
  propostas: ClienteFichaProposta[];
  loading: boolean;
  showAutoria?: boolean;
};

export function ClienteFichaPropostas({ entidadeId, propostas, loading, showAutoria }: Props) {
  const COLS: Column<ClienteFichaProposta>[] = [
    {
      key: "codigo",
      header: "Proposta",
      cell: (p) => (
        <div>
          <Link href={`/portal/propostas?entidade=${entidadeId}`} className="font-medium text-blue-400 hover:underline">
            {p.codigo}
          </Link>
          <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{p.titulo}</p>
        </div>
      ),
    },
    {
      key: "estado",
      header: "Estado",
      cell: (p) => <PropostaEstadoBadge estado={p.estado as never} />,
    },
    {
      key: "valor",
      header: "Valor",
      cell: (p) => <span className="tabular-nums text-slate-200">{fmtEuro(p.valorCentavos)}</span>,
    },
    {
      key: "validade",
      header: "Validade",
      cell: (p) => (
        <span className="text-sm text-slate-500">
          {p.validadeAte ? fmtDate(p.validadeAte) : "-"}
        </span>
      ),
    },
    ...(showAutoria
      ? [
          {
            key: "autoria",
            header: "Equipa comercial",
            cell: (p: ClienteFichaProposta) => (
              <span className="text-sm text-slate-400">
                {fmtPropostaAutoria(p.criadoPor, p.enviadaPor)}
              </span>
            ),
          } as Column<ClienteFichaProposta>,
        ]
      : []),
  ];

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="mb-4 flex justify-end">
          <Link
            href={`/portal/propostas?entidade=${entidadeId}&nova=1`}
            className={cn(buttonVariants({ size: "sm" }))}
          >
            <Plus className="h-4 w-4" />
            Nova proposta
          </Link>
        </div>
        <DataTable
          columns={COLS}
          data={propostas}
          keyField="id"
          loading={loading}
          emptyMessage="Sem propostas para este cliente."
        />
      </CardContent>
    </Card>
  );
}
