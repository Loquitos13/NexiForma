"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Receipt, Download } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { parseApiError } from "@/lib/ui/backoffice";
import {
  fmtEuro,
  fmtFaturaRef,
  faturaEstadoLabel,
  type FaturaEstado,
} from "@/lib/crm/shared";
import { FaturaEstadoBadge } from "@/components/crm/fatura-estado-badge";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  DataTable,
  PageHeader,
  type Column,
} from "@/components/ui";

type Fatura = {
  id: string;
  estado: FaturaEstado;
  numero: number | null;
  codigoAtcud: string | null;
  valorCentavos: number;
  ivaCentavos: number;
  dataVencimento: string | null;
  createdAt: string;
  entidadeCliente: { id: string; nome: string; nif: string };
  proposta: { id: string; codigo: string; titulo: string } | null;
  serie: { codigo: string; tipo: string };
  comunicacoesAt?: Array<{
    sucesso: boolean;
    codigoResposta: string | null;
    mensagemAt: string | null;
    tentativaEm: string;
  }>;
};

const ESTADOS: Array<FaturaEstado | "TODAS"> = [
  "TODAS",
  "RASCUNHO",
  "EMITIDA",
  "COMUNICADA_AT",
  "ANULADA",
];

export default function CrmFaturasPage() {
  const { canManageCrm } = useTenantRole();
  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [estadoFilter, setEstadoFilter] = useState<FaturaEstado | "TODAS">("TODAS");
  const [exportAno, setExportAno] = useState(String(new Date().getFullYear()));
  const [exportMes, setExportMes] = useState(String(new Date().getMonth() + 1));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const q = estadoFilter !== "TODAS" ? `?estado=${estadoFilter}` : "";
    const res = await bffFetch(`/api/v1/crm/faturas${q}`, {
      headers: { accept: "application/json" },
    });
    setLoading(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      setFaturas([]);
      return;
    }
    setFaturas((await res.json()) as Fatura[]);
  }, [estadoFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => faturas, [faturas]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { TODAS: faturas.length };
    for (const e of ESTADOS) {
      if (e !== "TODAS") c[e] = faturas.filter((f) => f.estado === e).length;
    }
    return c;
  }, [faturas]);

  const COLS: Column<Fatura>[] = [
    {
      key: "ref",
      header: "Documento",
      cell: (f) => (
        <div>
          <Link
            href={`/portal/crm/faturas/${f.id}`}
            className="font-medium text-slate-100 hover:text-blue-300"
          >
            {fmtFaturaRef(f.serie, f.numero)}
          </Link>
          {f.codigoAtcud ? (
            <p className="text-xs text-blue-400/80 mt-0.5 font-mono">{f.codigoAtcud}</p>
          ) : null}
          {f.proposta ? (
            <p className="text-xs text-slate-500 mt-0.5">Proposta {f.proposta.codigo}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: "entidade",
      header: "Cliente",
      cell: (f) => (
        <div className="text-sm">
          <Link
            href={`/portal/entidades/${f.entidadeCliente.id}`}
            className="text-slate-300 hover:text-blue-300"
          >
            {f.entidadeCliente.nome}
          </Link>
          <p className="text-xs text-slate-500">NIF {f.entidadeCliente.nif}</p>
        </div>
      ),
    },
    {
      key: "valor",
      header: "Valor (s/ IVA)",
      cell: (f) => <span className="font-medium tabular-nums">{fmtEuro(f.valorCentavos)}</span>,
    },
    {
      key: "iva",
      header: "IVA",
      cell: (f) => (
        <span className="text-slate-400 tabular-nums text-sm">{fmtEuro(f.ivaCentavos)}</span>
      ),
    },
    {
      key: "estado",
      header: "Estado",
      cell: (f) => (
        <div>
          <FaturaEstadoBadge estado={f.estado} />
          {f.estado === "EMITIDA" && f.comunicacoesAt?.[0] && !f.comunicacoesAt[0].sucesso ? (
            <p className="text-[10px] text-amber-400/90 mt-1 max-w-[140px]">
              AT: {f.comunicacoesAt[0].mensagemAt ?? "falhou"}
            </p>
          ) : null}
        </div>
      ),
    },
  ];

  if (!canManageCrm) {
    return (
      <div className="max-w-3xl space-y-4">
        <h1 className="text-2xl font-bold text-slate-50">Faturas</h1>
        <p className="text-sm text-slate-400">Sem permissão para o módulo CRM.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Faturas comerciais"
        description="Edite no modelo da fatura, emita e comunique à AT."
        actions={
          <div className="flex gap-2">
            <Link href="/portal/propostas?estado=ACEITE">
              <Button size="sm" variant="secondary">
                <Receipt className="h-3.5 w-3.5" />
                Propostas aceites
              </Button>
            </Link>
          </div>
        }
      />

      {error ? <Alert variant="error">{error}</Alert> : null}

      <Card>
        <CardContent className="pt-5 flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs text-slate-500 block mb-1">Export SAF-T PT</label>
            <div className="flex gap-2">
              <input
                type="number"
                className="w-20 px-2 py-1.5 rounded-lg bg-slate-900/80 border border-slate-700/60 text-sm"
                value={exportAno}
                onChange={(e) => setExportAno(e.target.value)}
                min={2000}
                max={2100}
              />
              <input
                type="number"
                className="w-16 px-2 py-1.5 rounded-lg bg-slate-900/80 border border-slate-700/60 text-sm"
                value={exportMes}
                onChange={(e) => setExportMes(e.target.value)}
                min={1}
                max={12}
              />
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => {
              void (async () => {
                const res = await bffFetch(
                  `/api/v1/crm/faturas/export/saft?ano=${exportAno}&mes=${exportMes}`,
                );
                if (!res.ok) return;
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `SAFT-PT_${exportAno}-${exportMes.padStart(2, "0")}.xml`;
                a.click();
                URL.revokeObjectURL(url);
              })();
            }}
          >
            <Download className="h-3.5 w-3.5" />
            Descarregar XML
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {ESTADOS.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => setEstadoFilter(e)}
            className={`rounded-xl px-3 py-1.5 text-sm border transition-colors ${
              estadoFilter === e
                ? "border-blue-500/40 bg-blue-500/10 text-blue-300"
                : "border-slate-700/50 text-slate-400 hover:border-slate-600"
            }`}
          >
            {e === "TODAS" ? "Todas" : faturaEstadoLabel(e)}{" "}
            <Badge variant="default" className="ml-1 text-[10px]">
              {counts[e] ?? 0}
            </Badge>
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={COLS}
            data={filtered}
            keyField="id"
            loading={loading}
            emptyMessage="Sem faturas - cria uma a partir de uma proposta aceite."
            rowActions={(f) => (
              <div className="flex justify-end">
                <Link href={`/portal/crm/faturas/${f.id}`}>
                  <Button size="sm" variant="secondary">
                    <Pencil className="h-3.5 w-3.5" />
                    {f.estado === "RASCUNHO" ? "Editar" : "Abrir"}
                  </Button>
                </Link>
              </div>
            )}
          />
        </CardContent>
      </Card>
    </div>
  );
}
