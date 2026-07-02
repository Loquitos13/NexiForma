"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Plus, Search, Pencil, ExternalLink } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { parseApiError } from "@/lib/ui/backoffice";
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
  _count?: { formandos: number; propostas: number };
};

const emptyForm = { nif: "", nome: "", moradaFiscal: "", email: "", telefone: "" };

export default function ClientesPage() {
  const router = useRouter();
  const { canManageCrm, canManage } = useTenantRole();
  const canGerirClientes = canManageCrm || canManage;
  const [rows, setRows] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await bffFetch("/api/v1/entidades-cliente", { headers: { accept: "application/json" } });
    if (!res.ok) setError(await parseApiError(res));
    else setRows((await res.json()) as Cliente[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
    setBusy(true);
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
    setBusy(false);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (c) =>
        c.nome.toLowerCase().includes(q) ||
        c.nif.includes(q) ||
        (c.email?.toLowerCase().includes(q) ?? false),
    );
  }, [rows, search]);

  const COLS: Column<Cliente>[] = [
    {
      key: "nome",
      header: "Cliente",
      cell: (c) => (
        <div>
          <span className="font-medium text-slate-100">{c.nome}</span>
          <p className="text-xs text-slate-500 mt-0.5">NIF {c.nif}</p>
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
      key: "formandos",
      header: "Formandos",
      cell: (c) => <span className="text-slate-300">{c._count?.formandos ?? 0}</span>,
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
            onRowClick={(c) => router.push(`/portal/clientes/${c.id}`)}
            rowActions={
              canGerirClientes
                ? (c) => (
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          router.push(`/portal/clientes/${c.id}?editar=1`);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => router.push(`/portal/clientes/${c.id}`)}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )
                : undefined
            }
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
              <Button type="submit" disabled={busy}>
                {busy ? "A guardar…" : editId ? "Guardar alterações" : "Criar cliente"}
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
