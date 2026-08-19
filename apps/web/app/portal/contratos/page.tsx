"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Building2, FileCheck, Plus, Receipt } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { parseApiError } from "@/lib/ui/backoffice";
import { withPortalFrom } from "@/lib/ui/portal-back-nav";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  DataTable,
  PageHeader,
  Select,
  type Column,
  type SortState,
} from "@/components/ui";
import { CrmContextNav, CONTRATOS_NAV } from "@/components/crm/crm-context-nav";
import { NovoContratoModal } from "@/components/crm/novo-contrato-modal";
import {
  CrmListFilters,
  emptyCrmListFilters,
  type CrmListFiltersValue,
} from "@/components/crm/crm-list-filters";
import { parsePaginatedList } from "@/lib/crm/paginated-list";
import { fmtDate, fmtEuro } from "@/lib/crm/shared";

type ContratoEstado = "VIGENTE" | "A_EXPIRAR" | "EXPIRADO" | "RASCUNHO" | "CANCELADO";

type ContratoRow = {
  id: string;
  codigo: string;
  titulo: string;
  valorCentavos: number;
  dataInicio: string | null;
  dataFim: string | null;
  estado: string;
  templateId: string | null;
  createdAt: string;
  entidadeCliente: { id: string; nome: string; nif: string };
  proposta?: {
    id: string;
    codigo: string;
    fatura?: { id: string; estado: string } | null;
  } | null;
  contratoEstado: ContratoEstado;
};

const ESTADOS: (ContratoEstado | "TODOS")[] = [
  "TODOS",
  "RASCUNHO",
  "VIGENTE",
  "A_EXPIRAR",
  "EXPIRADO",
  "CANCELADO",
];

function computeContratoEstado(
  estado: string,
  dataFim: string | null,
): ContratoEstado {
  if (estado === "RASCUNHO") return "RASCUNHO";
  if (estado === "CANCELADO") return "CANCELADO";
  if (!dataFim) return "VIGENTE";
  const end = new Date(dataFim);
  if (Number.isNaN(end.getTime())) return "VIGENTE";
  const now = new Date();
  if (end < now) return "EXPIRADO";
  const days = (end.getTime() - now.getTime()) / 86_400_000;
  if (days <= 30) return "A_EXPIRAR";
  return "VIGENTE";
}

function contratoEstadoLabel(estado: ContratoEstado): string {
  const map: Record<ContratoEstado, string> = {
    RASCUNHO: "Rascunho",
    VIGENTE: "Vigente",
    A_EXPIRAR: "A expirar",
    EXPIRADO: "Expirado",
    CANCELADO: "Cancelado",
  };
  return map[estado];
}

function contratoEstadoVariant(estado: ContratoEstado): "green" | "yellow" | "default" | "blue" {
  if (estado === "VIGENTE") return "green";
  if (estado === "A_EXPIRAR") return "yellow";
  if (estado === "RASCUNHO") return "blue";
  return "default";
}

function matchesSearch(row: ContratoRow, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const hay = [row.codigo, row.titulo, row.entidadeCliente.nome, row.entidadeCliente.nif]
    .join(" ")
    .toLowerCase();
  return hay.includes(needle);
}

export default function ContratosPage() {
  const pathname = usePathname();
  const { canManageCrm, canManage, writeDisabled } = useTenantRole();
  const [contratos, setContratos] = useState<ContratoRow[]>([]);
  const [entidades, setEntidades] = useState<{ id: string; nome: string; nif: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [estadoFilter, setEstadoFilter] = useState<(ContratoEstado | "TODOS")>("TODOS");
  const [entidadeFilter, setEntidadeFilter] = useState("");
  const [listFilters, setListFilters] = useState<CrmListFiltersValue>(emptyCrmListFilters);
  const [sort, setSort] = useState<SortState | null>({ key: "createdAt", direction: "desc" });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [cRes, eRes] = await Promise.all([
      bffFetch("/api/v1/contratos?pageSize=200", {
        headers: { accept: "application/json" },
      }),
      bffFetch("/api/v1/entidades-cliente", { headers: { accept: "application/json" } }),
    ]);
    if (!cRes.ok) {
      setError(await parseApiError(cRes));
      setContratos([]);
    } else {
      const items = parsePaginatedList<Omit<ContratoRow, "contratoEstado">>(await cRes.json()).items;
      setContratos(
        items.map((c) => ({
          ...c,
          contratoEstado: computeContratoEstado(c.estado, c.dataFim),
        })),
      );
    }
    if (eRes.ok) {
      const raw = (await eRes.json()) as
        | { id: string; nome: string; nif: string }[]
        | { items?: { id: string; nome: string; nif: string }[] };
      const list = Array.isArray(raw) ? raw : (raw.items ?? []);
      setEntidades(list);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    return contratos.filter((c) => {
      if (estadoFilter !== "TODOS" && c.contratoEstado !== estadoFilter) return false;
      if (entidadeFilter && c.entidadeCliente.id !== entidadeFilter) return false;
      if (!matchesSearch(c, listFilters.q)) return false;
      return true;
    });
  }, [contratos, estadoFilter, entidadeFilter, listFilters.q]);

  const counts = useMemo(() => {
    const base: Record<string, number> = {
      TODOS: contratos.length,
      RASCUNHO: 0,
      VIGENTE: 0,
      A_EXPIRAR: 0,
      EXPIRADO: 0,
      CANCELADO: 0,
    };
    for (const c of contratos) base[c.contratoEstado] += 1;
    return base;
  }, [contratos]);

  const resumo = useMemo(() => {
    const vigentes = contratos.filter(
      (c) => c.contratoEstado !== "EXPIRADO" && c.contratoEstado !== "CANCELADO" && c.contratoEstado !== "RASCUNHO",
    );
    const expirados = contratos.filter((c) => c.contratoEstado === "EXPIRADO");
    const valorTotal = contratos.reduce((sum, c) => sum + c.valorCentavos, 0);
    return { vigentes: vigentes.length, expirados: expirados.length, valorTotal };
  }, [contratos]);

  async function faturarProposta(propostaId: string) {
    setBusy(true);
    setError(null);
    setMsg(null);
    const res = await bffFetch(`/api/v1/crm/propostas/${propostaId}/faturar`, {
      method: "POST",
      headers: { accept: "application/json" },
    });
    setBusy(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    const data = (await res.json()) as { id: string };
    setMsg("Fatura em rascunho criada.");
    await load();
    window.location.href = `/portal/crm/faturas/${data.id}`;
  }

  const COLS: Column<ContratoRow>[] = [
    {
      key: "codigo",
      header: "Contrato",
      sortable: true,
      sortValue: (c) => c.codigo,
      cell: (c) => (
        <Link
          href={withPortalFrom(`/portal/contratos/${c.id}`, pathname || "/portal/contratos")}
          className="block hover:text-violet-300"
        >
          <span className="font-medium text-slate-100">{c.codigo}</span>
          <p className="mt-0.5 text-xs text-slate-500">{c.titulo}</p>
        </Link>
      ),
    },
    {
      key: "entidadeCliente",
      header: "Cliente",
      sortable: true,
      sortValue: (c) => c.entidadeCliente.nome,
      cell: (c) => (
        <Link
          href={withPortalFrom(`/portal/clientes/${c.entidadeCliente.id}`, pathname || "/portal/contratos")}
          className="text-sm hover:text-violet-300"
        >
          <p className="text-slate-300">{c.entidadeCliente.nome}</p>
          <p className="text-xs text-slate-500">NIF {c.entidadeCliente.nif}</p>
        </Link>
      ),
    },
    {
      key: "valorCentavos",
      header: "Valor",
      sortable: true,
      hideOnMobile: true,
      sortValue: (c) => c.valorCentavos,
      cell: (c) => <span className="font-medium">{fmtEuro(c.valorCentavos)}</span>,
    },
    {
      key: "dataInicio",
      header: "Início",
      sortable: true,
      hideOnMobile: true,
      sortValue: (c) => {
        if (!c.dataInicio) return null;
        const t = new Date(c.dataInicio).getTime();
        return Number.isFinite(t) ? t : null;
      },
      cell: (c) => <span className="text-sm text-slate-400">{fmtDate(c.dataInicio)}</span>,
    },
    {
      key: "dataFim",
      header: "Fim",
      sortable: true,
      hideOnMobile: true,
      sortValue: (c) => {
        if (!c.dataFim) return null;
        const t = new Date(c.dataFim).getTime();
        return Number.isFinite(t) ? t : null;
      },
      cell: (c) => <span className="text-sm text-slate-400">{fmtDate(c.dataFim)}</span>,
    },
    {
      key: "contratoEstado",
      header: "Estado",
      sortable: true,
      mobilePriority: true,
      sortCycle: ["RASCUNHO", "VIGENTE", "A_EXPIRAR", "EXPIRADO", "CANCELADO"],
      sortValue: (c) => c.contratoEstado,
      cell: (c) => (
        <Badge variant={contratoEstadoVariant(c.contratoEstado)}>
          {contratoEstadoLabel(c.contratoEstado)}
        </Badge>
      ),
    },
  ];

  if (!canManageCrm) {
    return (
      <div className="max-w-3xl">
        <PageHeader title="Contratos" description="Gestão de contratos comerciais." />
        <Alert variant="warning">Sem permissão para aceder à gestão de contratos.</Alert>
      </div>
    );
  }

  return (
    <>
      <CrmContextNav tabs={CONTRATOS_NAV} ariaLabel="Secções Contratos" />
      <PageHeader
        title="Contratos"
        description="Contratos comerciais com clientes - vigência, documento e facturação associada."
        actions={
          canManageCrm ? (
            <Button disabled={writeDisabled} onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Novo contrato
            </Button>
          ) : null
        }
      />

      {error ? <Alert variant="error" className="mb-4">{error}</Alert> : null}
      {msg ? <Alert variant="success" className="mb-4">{msg}</Alert> : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-green-900/40 p-2">
              <FileCheck className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Vigentes</p>
              <p className="text-xl font-semibold text-slate-100">{loading ? "-" : resumo.vigentes}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-slate-800/80 p-2">
              <FileCheck className="h-5 w-5 text-slate-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Expirados</p>
              <p className="text-xl font-semibold text-slate-100">{loading ? "-" : resumo.expirados}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-violet-900/40 p-2">
              <Building2 className="h-5 w-5 text-violet-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Valor total</p>
              <p className="text-xl font-semibold text-slate-100">
                {loading ? "-" : fmtEuro(resumo.valorTotal)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <CrmListFilters
        value={listFilters}
        onChange={setListFilters}
        gestor={canManage}
        searchPlaceholder="Pesquisar código, cliente ou título…"
      />

      <div className="mb-4 mt-5 flex flex-wrap items-end gap-3">
        <Select
          label="Entidade"
          className="min-w-[200px]"
          value={entidadeFilter}
          onChange={(e) => setEntidadeFilter(e.target.value)}
        >
          <option value="">Todas as entidades</option>
          {entidades.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nome}
            </option>
          ))}
        </Select>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {ESTADOS.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => setEstadoFilter(e)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              estadoFilter === e
                ? "bg-violet-600 text-white"
                : "border border-slate-700/50 bg-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            {e === "TODOS" ? "Todos" : contratoEstadoLabel(e)}{" "}
            <span className="opacity-70">({counts[e] ?? 0})</span>
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
            fixedLayout
            sort={sort}
            onSortChange={setSort}
            getRowHref={(c) =>
              withPortalFrom(`/portal/contratos/${c.id}`, pathname || "/portal/contratos")
            }
            emptyMessage={
              contratos.length === 0
                ? "Sem contratos. Clique em «Novo contrato» para criar o primeiro."
                : "Sem contratos com estes filtros."
            }
            rowActions={(c) => (
              <>
                <Button size="sm" variant="secondary" asChild>
                  <Link href={withPortalFrom(`/portal/contratos/${c.id}`, pathname || "/portal/contratos")}>
                    Abrir
                  </Link>
                </Button>
                <Button size="sm" variant="ghost" asChild>
                  <Link
                    href={withPortalFrom(`/portal/clientes/${c.entidadeCliente.id}`, pathname || "/portal/contratos")}
                  >
                    <Building2 className="h-3.5 w-3.5" />
                    Cliente
                  </Link>
                </Button>
                {canManage && c.proposta && !c.proposta.fatura ? (
                  <Button
                    size="sm"
                    variant="teal"
                    disabled={busy}
                    onClick={() => void faturarProposta(c.proposta!.id)}
                  >
                    <Receipt className="h-3.5 w-3.5" />
                    Faturar
                  </Button>
                ) : null}
                {canManage && c.proposta?.fatura ? (
                  <Button size="sm" variant="secondary" asChild>
                    <Link href={`/portal/crm/faturas/${c.proposta.fatura.id}`}>
                      <Receipt className="h-3.5 w-3.5" />
                      Fatura
                    </Link>
                  </Button>
                ) : null}
              </>
            )}
          />
        </CardContent>
      </Card>

      <NovoContratoModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        entidades={entidades}
        onCreated={() => void load()}
      />
    </>
  );
}
