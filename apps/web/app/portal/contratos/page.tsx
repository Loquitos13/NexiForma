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
import { CrmListFilters,
  emptyCrmListFilters,
  type CrmListFiltersValue,
} from "@/components/crm/crm-list-filters";
import { parsePaginatedList } from "@/lib/crm/paginated-list";
import { fmtDate, fmtEuro } from "@/lib/crm/shared";

type ContratoEstado = "VIGENTE" | "A_EXPIRAR" | "EXPIRADO";

type PropostaAceite = {
  id: string;
  codigo: string;
  titulo: string;
  valorCentavos: number;
  validadeAte: string | null;
  aceiteEm: string | null;
  createdAt: string;
  entidadeCliente: { id: string; nome: string; nif: string };
  curso: { designacao: string } | null;
  fatura?: { id: string; estado: string } | null;
};

type ContratoRow = PropostaAceite & { contratoEstado: ContratoEstado };

const ESTADOS: (ContratoEstado | "TODOS")[] = ["TODOS", "VIGENTE", "A_EXPIRAR", "EXPIRADO"];

function computeContratoEstado(validadeAte: string | null): ContratoEstado {
  if (!validadeAte) return "VIGENTE";
  const end = new Date(validadeAte);
  if (Number.isNaN(end.getTime())) return "VIGENTE";
  const now = new Date();
  if (end < now) return "EXPIRADO";
  const days = (end.getTime() - now.getTime()) / 86_400_000;
  if (days <= 30) return "A_EXPIRAR";
  return "VIGENTE";
}

function contratoEstadoLabel(estado: ContratoEstado): string {
  const map: Record<ContratoEstado, string> = {
    VIGENTE: "Vigente",
    A_EXPIRAR: "A expirar",
    EXPIRADO: "Expirado",
  };
  return map[estado];
}

function contratoEstadoVariant(estado: ContratoEstado): "green" | "yellow" | "default" {
  if (estado === "VIGENTE") return "green";
  if (estado === "A_EXPIRAR") return "yellow";
  return "default";
}

function matchesSearch(row: ContratoRow, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const hay = [
    row.codigo,
    row.titulo,
    row.entidadeCliente.nome,
    row.entidadeCliente.nif,
    row.curso?.designacao ?? "",
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(needle);
}

export default function ContratosPage() {
  const pathname = usePathname();
  const { canManageCrm, canManage, writeDisabled } = useTenantRole();
  const [contratos, setContratos] = useState<ContratoRow[]>([]);
  const [entidades, setEntidades] = useState<{ id: string; nome: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [estadoFilter, setEstadoFilter] = useState<(ContratoEstado | "TODOS")>("TODOS");
  const [entidadeFilter, setEntidadeFilter] = useState("");
  const [listFilters, setListFilters] = useState<CrmListFiltersValue>(emptyCrmListFilters);
  const [sort, setSort] = useState<SortState | null>({ key: "aceiteEm", direction: "desc" });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [pRes, eRes] = await Promise.all([
      bffFetch("/api/v1/propostas?estado=ACEITE&pageSize=200", {
        headers: { accept: "application/json" },
      }),
      bffFetch("/api/v1/entidades-cliente", { headers: { accept: "application/json" } }),
    ]);
    if (!pRes.ok) {
      setError(await parseApiError(pRes));
      setContratos([]);
    } else {
      const items = parsePaginatedList<PropostaAceite>(await pRes.json()).items;
      setContratos(
        items.map((p) => ({
          ...p,
          contratoEstado: computeContratoEstado(p.validadeAte),
        })),
      );
    }
    if (eRes.ok) {
      const raw = (await eRes.json()) as { id: string; nome: string }[] | { items?: { id: string; nome: string }[] };
      setEntidades(Array.isArray(raw) ? raw : (raw.items ?? []));
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
    const base = { TODOS: contratos.length, VIGENTE: 0, A_EXPIRAR: 0, EXPIRADO: 0 };
    for (const c of contratos) base[c.contratoEstado] += 1;
    return base;
  }, [contratos]);

  const resumo = useMemo(() => {
    const vigentes = contratos.filter((c) => c.contratoEstado !== "EXPIRADO");
    const expirados = contratos.filter((c) => c.contratoEstado === "EXPIRADO");
    const valorTotal = contratos.reduce((sum, c) => sum + c.valorCentavos, 0);
    return { vigentes: vigentes.length, expirados: expirados.length, valorTotal };
  }, [contratos]);

  async function faturarContrato(id: string) {
    setBusy(true);
    setError(null);
    setMsg(null);
    const res = await bffFetch(`/api/v1/crm/propostas/${id}/faturar`, {
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
          href={withPortalFrom(`/portal/propostas/${c.id}`, pathname || "/portal/contratos")}
          className="block hover:text-violet-300"
        >
          <span className="font-medium text-slate-100">{c.codigo}</span>
          <p className="mt-0.5 text-xs text-slate-500">{c.titulo}</p>
          {c.curso ? <p className="mt-0.5 text-xs text-slate-600">{c.curso.designacao}</p> : null}
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
      key: "aceiteEm",
      header: "Aceite em",
      sortable: true,
      hideOnMobile: true,
      sortValue: (c) => {
        const iso = c.aceiteEm ?? c.createdAt;
        const t = new Date(iso).getTime();
        return Number.isFinite(t) ? t : null;
      },
      cell: (c) => <span className="text-sm text-slate-400">{fmtDate(c.aceiteEm ?? c.createdAt)}</span>,
    },
    {
      key: "validadeAte",
      header: "Validade",
      sortable: true,
      sortValue: (c) => {
        if (!c.validadeAte) return null;
        const t = new Date(c.validadeAte).getTime();
        return Number.isFinite(t) ? t : null;
      },
      cell: (c) => <span className="text-sm text-slate-400">{fmtDate(c.validadeAte)}</span>,
    },
    {
      key: "contratoEstado",
      header: "Estado",
      sortable: true,
      sortCycle: ["VIGENTE", "A_EXPIRAR", "EXPIRADO"],
      sortValue: (c) => c.contratoEstado,
      cell: (c) => (
        <Badge variant={contratoEstadoVariant(c.contratoEstado)}>{contratoEstadoLabel(c.contratoEstado)}</Badge>
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
        description="Propostas aceites pelo cliente — contratos vigentes, validade e facturação."
        actions={
          canManageCrm ? (
            <Button asChild disabled={writeDisabled}>
              <Link href="/portal/propostas?nova=1">
                <Plus className="h-4 w-4" />
                Nova proposta
              </Link>
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
              <p className="text-xl font-semibold text-slate-100">{loading ? "—" : resumo.vigentes}</p>
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
              <p className="text-xl font-semibold text-slate-100">{loading ? "—" : resumo.expirados}</p>
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
                {loading ? "—" : fmtEuro(resumo.valorTotal)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <CrmListFilters
        value={listFilters}
        onChange={setListFilters}
        gestor={canManage}
        searchPlaceholder="Pesquisar código, cliente ou curso…"
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
            emptyMessage={
              contratos.length === 0
                ? "Sem contratos. Crie uma proposta comercial e aguarde a aceitação pelo cliente."
                : "Sem contratos com estes filtros."
            }
            rowActions={(c) => (
              <div className="flex flex-wrap justify-end gap-1">
                <Button size="sm" variant="secondary" asChild>
                  <Link href={withPortalFrom(`/portal/propostas/${c.id}`, pathname || "/portal/contratos")}>
                    Ver proposta
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
                {canManage && !c.fatura ? (
                  <Button size="sm" variant="teal" disabled={busy} onClick={() => void faturarContrato(c.id)}>
                    <Receipt className="h-3.5 w-3.5" />
                    Faturar
                  </Button>
                ) : null}
                {canManage && c.fatura ? (
                  <Button size="sm" variant="secondary" asChild>
                    <Link href={`/portal/crm/faturas/${c.fatura.id}`}>
                      <Receipt className="h-3.5 w-3.5" />
                      Fatura
                    </Link>
                  </Button>
                ) : null}
              </div>
            )}
          />
          {!loading && contratos.length === 0 ? (
            <div className="border-t border-slate-700/30 px-4 py-6 text-center text-sm text-slate-500">
              <Link href="/portal/propostas" className="font-medium text-violet-400 underline">
                Ir para Propostas
              </Link>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </>
  );
}
