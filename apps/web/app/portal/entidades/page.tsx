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
  type Column,
} from "@/components/ui";

type Entidade = {
  id: string;
  nif: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  _count?: { formandos: number; propostas: number };
};

const emptyForm = { nif: "", nome: "", email: "", telefone: "" };

export default function EntidadesClientePage() {
  const router = useRouter();
  const { canManageCrm } = useTenantRole();
  const [rows, setRows] = useState<Entidade[]>([]);
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
    else setRows((await res.json()) as Entidade[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("nova") === "1" && canManageCrm) {
      openCreate();
    }
  }, [canManageCrm]);

  function openCreate() {
    setEditId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(e: Entidade) {
    setEditId(e.id);
    setForm({
      nif: e.nif,
      nome: e.nome,
      email: e.email ?? "",
      telefone: e.telefone ?? "",
    });
    setDialogOpen(true);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canManageCrm) return;
    setBusy(true);
    setMsg(null);
    setError(null);
    const body = {
      nif: form.nif.trim(),
      nome: form.nome.trim(),
      email: form.email.trim() || undefined,
      telefone: form.telefone.trim() || undefined,
    };
    const res = await bffFetch(
      editId ? `/api/v1/entidades-cliente/${editId}` : "/api/v1/entidades-cliente",
      {
        method: editId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify(editId ? { nome: body.nome, email: body.email, telefone: body.telefone } : body),
      },
    );
    if (!res.ok) setError(await parseApiError(res));
    else {
      setMsg(editId ? "Entidade actualizada." : "Entidade criada.");
      setDialogOpen(false);
      setForm(emptyForm);
      setEditId(null);
      await load();
    }
    setBusy(false);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (e) =>
        e.nome.toLowerCase().includes(q) ||
        e.nif.includes(q) ||
        (e.email?.toLowerCase().includes(q) ?? false),
    );
  }, [rows, search]);

  const COLS: Column<Entidade>[] = [
    {
      key: "nome",
      header: "Entidade",
      cell: (e) => (
        <div>
          <span className="font-medium text-slate-100">{e.nome}</span>
          <p className="text-xs text-slate-500 mt-0.5">NIF {e.nif}</p>
        </div>
      ),
    },
    {
      key: "email",
      header: "Contacto",
      cell: (e) => (
        <div className="text-sm">
          <p className="text-slate-300">{e.email ?? "-"}</p>
          {e.telefone && <p className="text-xs text-slate-500">{e.telefone}</p>}
        </div>
      ),
    },
    {
      key: "formandos",
      header: "Formandos",
      cell: (e) => <span className="text-slate-300">{e._count?.formandos ?? 0}</span>,
    },
    {
      key: "propostas",
      header: "Propostas",
      cell: (e) => (
        <Link
          href={`/portal/propostas?entidade=${e.id}`}
          className="text-blue-400 hover:text-blue-300 text-sm font-medium"
          onClick={(ev) => ev.stopPropagation()}
        >
          {e._count?.propostas ?? 0}
        </Link>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Entidades cliente"
        description="Empresas e organizações contratantes - base do CRM B2B para propostas e formandos corporativos."
        actions={
          canManageCrm ? (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Nova entidade
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
                ? "Nenhuma entidade corresponde à pesquisa."
                : "Sem entidades - registe a primeira empresa cliente."
            }
            onRowClick={(e) => router.push(`/portal/entidades/${e.id}`)}
            rowActions={
              canManageCrm
                ? (e) => (
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="secondary" onClick={() => openEdit(e)}>
                        <Pencil className="h-3.5 w-3.5" />
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => router.push(`/portal/entidades/${e.id}`)}
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
          title={editId ? "Editar entidade" : "Nova entidade cliente"}
          description="Dados da empresa contratante para facturação e propostas comerciais."
        >
          <form onSubmit={(e) => void submit(e)} className="grid gap-4">
            {!editId && (
              <Input
                label="NIF *"
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
              label="Nome / Razão social *"
              required
              value={form.nome}
              onChange={(ev) => setForm((f) => ({ ...f, nome: ev.target.value }))}
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
                {busy ? "A guardar…" : editId ? "Guardar alterações" : "Criar entidade"}
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
