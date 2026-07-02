"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Download, Pencil, Plus, Building2, Search } from "lucide-react";
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
  Dialog,
  DialogContent,
  PageHeader,
  Select,
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

type EntidadeOpt = { id: string; nome: string; nif: string };

const ESTADOS: Array<FaturaEstado | "TODAS"> = [
  "TODAS",
  "RASCUNHO",
  "EMITIDA",
  "COMUNICADA_AT",
  "ANULADA",
];

const NOVA_ENTIDADE_RETURN = "/portal/crm/faturas";

export default function CrmFaturasPage() {
  const { canManageCrm } = useTenantRole();
  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [entidades, setEntidades] = useState<EntidadeOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [entidadeClienteId, setEntidadeClienteId] = useState("");
  const [estadoFilter, setEstadoFilter] = useState<FaturaEstado | "TODAS">("TODAS");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [exportAno, setExportAno] = useState(String(new Date().getFullYear()));
  const [exportMes, setExportMes] = useState(String(new Date().getMonth() + 1));

  useEffect(() => {
    const t = window.setTimeout(() => setSearchQuery(searchInput.trim()), 320);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(async (q: string, signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (estadoFilter !== "TODAS") params.set("estado", estadoFilter);
    if (q) params.set("q", q);
    const qs = params.toString();
    const res = await bffFetch(`/api/v1/crm/faturas${qs ? `?${qs}` : ""}`, {
      headers: { accept: "application/json" },
      signal,
    });
    if (signal?.aborted) return;
    setLoading(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      setFaturas([]);
      return;
    }
    setFaturas((await res.json()) as Fatura[]);
  }, [estadoFilter]);

  useEffect(() => {
    const ac = new AbortController();
    void load(searchQuery, ac.signal);
    return () => ac.abort();
  }, [load, searchQuery]);

  useEffect(() => {
    if (!canManageCrm) return;
    void (async () => {
      const res = await bffFetch("/api/v1/entidades-cliente", {
        headers: { accept: "application/json" },
      });
      if (!res.ok) return;
      const rows = (await res.json()) as EntidadeOpt[];
      setEntidades(rows);

      const params = new URLSearchParams(window.location.search);
      const entidadeId = params.get("entidade");
      if (entidadeId && rows.some((r) => r.id === entidadeId)) {
        setEntidadeClienteId(entidadeId);
      } else if (rows[0]) {
        setEntidadeClienteId(rows[0].id);
      }

      if (params.get("nova") === "1") {
        setCreateOpen(true);
        window.history.replaceState({}, "", NOVA_ENTIDADE_RETURN);
      }
    })();
  }, [canManageCrm]);

  async function criarFatura(e: FormEvent) {
    e.preventDefault();
    if (!entidadeClienteId) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    const res = await bffFetch("/api/v1/crm/faturas", {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        entidadeClienteId,
        linhas: [{ descricao: "Prestação de serviços", quantidade: 1, precoUnitCentavos: 0 }],
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    const data = (await res.json()) as { id: string };
    setCreateOpen(false);
    window.location.href = `/portal/crm/faturas/${data.id}`;
  }

  const filtered = useMemo(() => faturas, [faturas]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { TODAS: faturas.length };
    for (const e of ESTADOS) {
      if (e !== "TODAS") c[e] = faturas.filter((f) => f.estado === e).length;
    }
    return c;
  }, [faturas]);

  const countsLabel =
    searchQuery && !loading
      ? `${filtered.length} resultado${filtered.length === 1 ? "" : "s"}`
      : null;

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
            href={`/portal/clientes/${f.entidadeCliente.id}`}
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
        title="Faturação"
        description="Emissão de documentos, comunicação à AT e exportação SAF-T PT."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setCreateOpen(true)} disabled={busy}>
              <Plus className="h-3.5 w-3.5" />
              Nova fatura
            </Button>
            <Link href="/portal/crm/faturacao">
              <Button size="sm" variant="secondary">
                Configuração
              </Button>
            </Link>
          </div>
        }
      />

      {error ? <Alert variant="error">{error}</Alert> : null}
      {msg ? <Alert variant="success">{msg}</Alert> : null}

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

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
          <input
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900/80 border border-slate-700/60 text-sm text-slate-200 placeholder:text-slate-500"
            placeholder="NIF, cliente, valor (€), nº fatura (ex. 2026/2)…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Pesquisar faturas"
          />
        </div>
        {countsLabel ? (
          <span className="text-xs text-slate-500">{countsLabel}</span>
        ) : null}
      </div>

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
            emptyMessage={
              searchQuery
                ? "Nenhuma fatura corresponde à pesquisa."
                : "Sem faturas - clique em «Nova fatura» para começar."
            }
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent
          title="Nova fatura"
          description="Cria um rascunho para editar, emitir e enviar ao cliente."
          className="max-w-lg"
        >
          {entidades.length === 0 ? (
            <div className="space-y-3 text-sm text-slate-400">
              <p>Ainda não há clientes registados. Crie o primeiro em Clientes.</p>
              <Link
                href={`/portal/clientes?nova=1&return=${encodeURIComponent(NOVA_ENTIDADE_RETURN)}`}
              >
                <Button size="sm">
                  <Building2 className="h-3.5 w-3.5" />
                  Novo cliente
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={(e) => void criarFatura(e)} className="grid gap-4">
              <Select
                label="Cliente *"
                required
                value={entidadeClienteId}
                onChange={(ev) => setEntidadeClienteId(ev.target.value)}
              >
                {entidades.map((ent) => (
                  <option key={ent.id} value={ent.id}>
                    {ent.nome} (NIF {ent.nif})
                  </option>
                ))}
              </Select>
              <Link
                href={`/portal/clientes?nova=1&return=${encodeURIComponent(NOVA_ENTIDADE_RETURN)}`}
                className="inline-flex"
              >
                <Button type="button" size="sm" variant="secondary">
                  <Building2 className="h-3.5 w-3.5" />
                  Novo cliente
                </Button>
              </Link>
              <p className="text-xs text-slate-500">
                Pode também importar linhas a partir de uma proposta comercial, no módulo Propostas.
              </p>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={busy || !entidadeClienteId}>
                  Criar rascunho
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
