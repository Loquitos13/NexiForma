"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { ArrowLeft, Building2, FileText, Mail, Pencil, Phone, Users } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { parseApiError } from "@/lib/ui/backoffice";
import {
  Alert,
  Badge,
  Button,
  buttonVariants,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  Input,
  PageHeader,
  Textarea,
} from "@/components/ui";
import { PageContentSkeleton } from "@/components/ui/page-skeleton";
import { cn } from "@/lib/ui/cn";

type Cliente = {
  id: string;
  nif: string;
  nome: string;
  moradaFiscal: string | null;
  email: string | null;
  telefone: string | null;
  _count?: { formandos: number; propostas: number };
};

export default function ClienteDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { canManageCrm, canManage } = useTenantRole();
  const canGerirClientes = canManageCrm || canManage;

  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    nif: "",
    nome: "",
    moradaFiscal: "",
    email: "",
    telefone: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    const res = await bffFetch(`/api/v1/entidades-cliente/${id}`, {
      headers: { accept: "application/json" },
    });
    if (!res.ok) setError(await parseApiError(res));
    else setCliente((await res.json()) as Cliente);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    if (id) void load();
  }, [load, id]);

  function fillForm(c: Cliente) {
    setForm({
      nif: c.nif,
      nome: c.nome,
      moradaFiscal: c.moradaFiscal ?? "",
      email: c.email ?? "",
      telefone: c.telefone ?? "",
    });
  }

  function openEditDialog() {
    if (!cliente) return;
    fillForm(cliente);
    setDialogOpen(true);
  }

  useEffect(() => {
    if (!cliente || !canGerirClientes) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("editar") === "1") {
      fillForm(cliente);
      setDialogOpen(true);
      window.history.replaceState({}, "", `/portal/clientes/${cliente.id}`);
    }
  }, [cliente, canGerirClientes]);

  function closeEditDialog() {
    setDialogOpen(false);
    if (window.location.search.includes("editar=1")) {
      window.history.replaceState({}, "", `/portal/clientes/${id}`);
    }
  }

  async function submitEdit(e: FormEvent) {
    e.preventDefault();
    if (!canGerirClientes || !cliente) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    const body = {
      nome: form.nome.trim(),
      moradaFiscal: form.moradaFiscal.trim(),
      email: form.email.trim() || undefined,
      telefone: form.telefone.trim() || undefined,
    };
    const res = await bffFetch(`/api/v1/entidades-cliente/${cliente.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    setMsg("Cliente actualizado.");
    setDialogOpen(false);
    await load();
  }

  if (loading) {
    return <PageContentSkeleton variant="detail" />;
  }

  if (error && !cliente) {
    return (
      <>
        <Link href="/portal/clientes" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-4")}>
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
        <Alert variant="error">{error ?? "Cliente não encontrado."}</Alert>
      </>
    );
  }

  if (!cliente) {
    return (
      <>
        <Link href="/portal/clientes" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-4")}>
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
        <Alert variant="error">Cliente não encontrado.</Alert>
      </>
    );
  }

  return (
    <>
      <Link href="/portal/clientes" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-4")}>
        <ArrowLeft className="h-4 w-4" /> Clientes
      </Link>

      {error ? <Alert variant="error" className="mb-4">{error}</Alert> : null}
      {msg ? <Alert variant="success" className="mb-4">{msg}</Alert> : null}

      <PageHeader
        title={cliente.nome}
        description={`NIF ${cliente.nif}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {canGerirClientes ? (
              <Button size="sm" variant="secondary" onClick={openEditDialog}>
                <Pencil className="h-4 w-4" />
                Editar
              </Button>
            ) : null}
            <Link
              href={`/portal/propostas?entidade=${cliente.id}&nova=1`}
              className={cn(buttonVariants({ size: "sm" }))}
            >
              <FileText className="h-4 w-4" />
              Nova proposta
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <CardContent className="pt-5 flex items-center gap-3">
            <Users className="h-8 w-8 text-amber-400/80" />
            <div>
              <p className="text-2xl font-bold text-slate-100">{cliente._count?.formandos ?? 0}</p>
              <p className="text-xs text-slate-500">Formandos associados</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 flex items-center gap-3">
            <FileText className="h-8 w-8 text-violet-400/80" />
            <div>
              <p className="text-2xl font-bold text-slate-100">{cliente._count?.propostas ?? 0}</p>
              <p className="text-xs text-slate-500">Propostas comerciais</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Morada fiscal</p>
            <p className="text-sm text-slate-300 whitespace-pre-line">
              {cliente.moradaFiscal?.trim() || "- Em falta (obrigatório para faturação)"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Contacto</p>
            {cliente.email && (
              <p className="text-sm text-slate-300 flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-slate-500" />
                {cliente.email}
              </p>
            )}
            {cliente.telefone && (
              <p className="text-sm text-slate-300 flex items-center gap-2 mt-1">
                <Phone className="h-3.5 w-3.5 text-slate-500" />
                {cliente.telefone}
              </p>
            )}
            {!cliente.email && !cliente.telefone && (
              <Badge variant="default">Sem contacto registado</Badge>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Acções</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Link
            href={`/portal/propostas?entidade=${cliente.id}`}
            className={cn(buttonVariants({ variant: "secondary" }))}
          >
            Ver propostas
          </Link>
          <Button variant="secondary" disabled title="Ligação a formandos corporativos - próxima fase">
            Gerir formandos B2B
          </Button>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => (open ? setDialogOpen(true) : closeEditDialog())}>
        <DialogContent
          title="Editar cliente"
          description="Dados obrigatórios para faturação e propostas comerciais."
        >
          <form onSubmit={(e) => void submitEdit(e)} className="grid gap-4">
            <div className="rounded-lg bg-slate-800/60 px-3 py-2 text-sm text-slate-400">
              <Building2 className="inline h-4 w-4 mr-1.5 text-slate-500" />
              NIF {form.nif} (não editável)
            </div>
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
                {busy ? "A guardar…" : "Guardar alterações"}
              </Button>
              <Button type="button" variant="secondary" onClick={closeEditDialog}>
                Cancelar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
