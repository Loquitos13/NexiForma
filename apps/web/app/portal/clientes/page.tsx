"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Building2, Plus, Search } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { parseApiError } from "@/lib/ui/backoffice";
import { withPortalFrom } from "@/lib/ui/portal-back-nav";
import { ClienteRowActions } from "@/components/crm/cliente-row-actions";
import { ListPagination } from "@/components/crm/list-pagination";
import { ContextSugestoesBadge, CrmSugestoesPanel } from "@/components/crm/crm-sugestoes-panel";
import { useSugestoesPendentesPorEntidade } from "@/components/crm/entidade-crm-insights";
import {
  Alert,
  Button,
  Card,
  CardContent,
  DataTable,
  Dialog,
  DialogContent,
  Input,
  PageHeader,
  Textarea,
  type Column,
} from "@/components/ui";

type Cliente = {
  id: string;
  nif: string;
  nome: string;
  moradaFiscal: string | null;
  email: string | null;
  telefone: string | null;
  isParceiro?: boolean;
  descontoPercent?: number | string | null;
  _count?: { propostas: number };
};

const emptyForm = { nif: "", nome: "", moradaFiscal: "", email: "", telefone: "" };

export default function ClientesPage() {
  const router = useRouter();
  const { canManageCrm, canManage } = useTenantRole();
  const canGerirClientes = canManageCrm || canManage;
  const sugestoesPorEntidade = useSugestoesPendentesPorEntidade();
  const [rows, setRows] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 25;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    const q = params.toString() ? `?${params}` : "";
    const res = await bffFetch(`/api/v1/entidades-cliente${q}`, { headers: { accept: "application/json" } });
    if (!res.ok) setError(await parseApiError(res));
    else {
      const data = await res.json();
      if (Array.isArray(data)) {
        setRows(data as Cliente[]);
        setTotal(data.length);
      } else {
        const paginated = data as { items: Cliente[]; total: number };
        setRows(paginated.items);
        setTotal(paginated.total);
      }
    }
    setLoading(false);
  }, [search, page]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    const t = setTimeout(() => void load(), search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("nova") === "1" && canGerirClientes) {
      openCreate();
    }
  }, [canGerirClientes]);

  function openCreate() {
    setEditId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canGerirClientes) return;
    setBusyId("form");
    setMsg(null);
    setError(null);
    const body = {
      nif: form.nif.trim(),
      nome: form.nome.trim(),
      moradaFiscal: form.moradaFiscal.trim(),
      email: form.email.trim() || undefined,
      telefone: form.telefone.trim() || undefined,
    };
    const res = await bffFetch(
      editId ? `/api/v1/entidades-cliente/${editId}` : "/api/v1/entidades-cliente",
      {
        method: editId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify(
          editId
            ? {
                nome: body.nome,
                moradaFiscal: body.moradaFiscal,
                email: body.email,
                telefone: body.telefone,
              }
            : body,
        ),
      },
    );
    if (!res.ok) setError(await parseApiError(res));
    else {
      const data = (await res.json()) as Cliente;
      setMsg(editId ? "Cliente actualizado." : "Cliente criado.");
      setDialogOpen(false);
      setForm(emptyForm);
      setEditId(null);
      await load();

      if (!editId) {
        const params = new URLSearchParams(window.location.search);
        const returnTo = params.get("return")?.trim();
        if (returnTo?.startsWith("/portal/")) {
          const sep = returnTo.includes("?") ? "&" : "?";
          router.push(`${returnTo}${sep}nova=1&entidade=${data.id}`);
          return;
        }
      }
    }
    setBusyId(null);
  }

  async function emitirFatura(cliente: Cliente) {
    setBusyId(cliente.id);
    setError(null);
    setMsg(null);
    const res = await bffFetch("/api/v1/crm/faturas", {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        entidadeClienteId: cliente.id,
        linhas: [{ descricao: "Prestação de serviços", quantidade: 1, precoUnitCentavos: 0 }],
      }),
    });
    setBusyId(null);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    const data = (await res.json()) as { id: string };
    router.push(`/portal/crm/faturas/${data.id}`);
  }

  async function tornarParceiro(cliente: Cliente) {
    setBusyId(cliente.id);
    setError(null);
    setMsg(null);
    const res = await bffFetch(`/api/v1/entidades-cliente/${cliente.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ isParceiro: true }),
    });
    setBusyId(null);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    router.push(`/portal/parceiros?entidade=${cliente.id}`);
  }

  const filtered = rows;

  const COLS: Column<Cliente>[] = [
    {
      key: "nome",
      header: "Cliente",
      cell: (c) => (
        <div>
          <Link href={withPortalFrom(`/portal/clientes/${c.id}`, "/portal/clientes")} className="font-medium text-slate-100 hover:text-violet-300">
            {c.nome}
          </Link>
          {canManageCrm ? (
            <ContextSugestoesBadge count={sugestoesPorEntidade[c.id] ?? 0} />
          ) : null}
          <p className="text-xs text-slate-500 mt-0.5">
            NIF {c.nif}
            {c.isParceiro ? (
              <span className="ml-2 rounded bg-teal-950/60 px-1.5 py-0.5 text-[10px] font-medium text-teal-300">
                Parceiro
              </span>
            ) : null}
          </p>
        </div>
      ),
    },
    {
      key: "email",
      header: "Contacto",
      cell: (c) => (
        <div className="text-sm">
          <p className="text-slate-300">{c.email ?? "-"}</p>
          {c.telefone && <p className="text-xs text-slate-500">{c.telefone}</p>}
        </div>
      ),
    },
    {
      key: "propostas",
      header: "Propostas",
      cell: (c) => (
        <Link
          href={`/portal/propostas?entidade=${c.id}`}
          className="text-blue-400 hover:text-blue-300 text-sm font-medium"
          onClick={(ev) => ev.stopPropagation()}
        >
          {c._count?.propostas ?? 0}
        </Link>
      ),
    },
  ];

  return (
    <>
      {canManageCrm ? (
        <CrmSugestoesPanel context="clientes" />
      ) : null}

      <PageHeader
        title="Clientes"
        description="Empresas e organizações a quem emite faturas, propostas e formação corporativa."
        actions={
          canGerirClientes ? (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Novo cliente
            </Button>
          ) : null
        }
      />

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}
      {msg && <Alert variant="success" className="mb-4">{msg}</Alert>}

      <Card className="mb-4">
        <CardContent className="pt-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="search"
              placeholder="Pesquisar por nome, NIF ou email…"
              value={search}
              onChange={(ev) => setSearch(ev.target.value)}
              className="h-9 w-full rounded-lg border border-slate-600/60 bg-slate-900/80 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/60"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={COLS}
            data={filtered}
            keyField="id"
            loading={loading}
            emptyMessage={
              search
                ? "Nenhum cliente corresponde à pesquisa."
                : "Sem clientes - clique em «Novo cliente» para registar o primeiro."
            }
            onRowClick={(c) => router.push(withPortalFrom(`/portal/clientes/${c.id}`, "/portal/clientes"))}
            rowActions={
              canGerirClientes
                ? (c) => (
                    <ClienteRowActions
                      isParceiro={Boolean(c.isParceiro)}
                      busy={busyId === c.id}
                      showFaturacao={canManage}
                      onEmitirFatura={() => void emitirFatura(c)}
                      onTornarParceiro={() => void tornarParceiro(c)}
                    />
                  )
                : undefined
            }
          />
          <ListPagination
            className="border-t border-slate-700/40 px-4 py-3"
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          title={editId ? "Editar cliente" : "Novo cliente"}
          description="Dados obrigatórios para faturação e propostas comerciais."
        >
          <form onSubmit={(e) => void submit(e)} className="grid gap-4">
            {!editId && (
              <Input
                label="Número de contribuinte (NIF) *"
                required
                minLength={9}
                maxLength={9}
                value={form.nif}
                onChange={(ev) => setForm((f) => ({ ...f, nif: ev.target.value.replace(/\D/g, "").slice(0, 9) }))}
                placeholder="123456789"
              />
            )}
            {editId && (
              <div className="rounded-lg bg-slate-800/60 px-3 py-2 text-sm text-slate-400">
                <Building2 className="inline h-4 w-4 mr-1.5 text-slate-500" />
                NIF {form.nif} (não editável)
              </div>
            )}
            <Input
              label="Nome comercial completo *"
              required
              value={form.nome}
              onChange={(ev) => setForm((f) => ({ ...f, nome: ev.target.value }))}
            />
            <Textarea
              label="Morada fiscal *"
              required
              rows={3}
              value={form.moradaFiscal}
              onChange={(ev) => setForm((f) => ({ ...f, moradaFiscal: ev.target.value }))}
              placeholder="Rua, código postal, localidade"
            />
            <Input
              label="Email comercial"
              type="email"
              value={form.email}
              onChange={(ev) => setForm((f) => ({ ...f, email: ev.target.value }))}
            />
            <Input
              label="Telefone"
              value={form.telefone}
              onChange={(ev) => setForm((f) => ({ ...f, telefone: ev.target.value }))}
            />
            <div className="flex gap-2 pt-1">
              <Button type="submit" disabled={busyId === "form"}>
                {busyId === "form" ? "A guardar…" : editId ? "Guardar alterações" : "Criar cliente"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
