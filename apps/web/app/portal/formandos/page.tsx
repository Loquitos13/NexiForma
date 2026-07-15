"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { PlusCircle, Pencil, Trash2, Users } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { parseApiError } from "@/lib/ui/backoffice";
import {
  Alert, Badge, Button, Card, CardContent, CardHeader, CardTitle,
  DataTable, Dialog, DialogContent, Input, PageHeader, type Column,
} from "@/components/ui";

type Formando = {
  id: string; nome: string; nif: string;
  email: string | null; emailPresenca: string | null;
  emailConta: string | null; emailPresencaEfectivo: string | null;
  telefone: string | null;
  contaEstado?: "activa" | "convite_pendente" | "sem_conta";
  nifProvisorio?: boolean;
  _count?: { matriculas: number };
};

const EMPTY = { nome: "", nif: "", email: "", emailPresenca: "", telefone: "" };

export default function FormandosPage() {
  const { canManage } = useTenantRole();
  const [formandos, setFormandos] = useState<Formando[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Formando | null>(null);
  const [form, setForm] = useState(EMPTY);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await bffFetch("/api/v1/formandos", { headers: { accept: "application/json" } });
    if (!res.ok) setError(await parseApiError(res));
    else setFormandos((await res.json()) as Formando[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  function openCreate() { setEditId(null); setForm(EMPTY); setDialogOpen(true); }
  function openEdit(f: Formando) {
    setEditId(f.id);
    setForm({ nome: f.nome, nif: f.nif, email: f.email ?? "", emailPresenca: f.emailPresenca ?? "", telefone: f.telefone ?? "" });
    setDialogOpen(true);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    setBusy(true); setMsg(null); setError(null);
    const body = {
      nome: form.nome.trim(),
      nif: form.nif.trim(),
      email: form.email.trim() || undefined,
      emailPresenca: form.emailPresenca.trim() || undefined,
      telefone: form.telefone.trim() || undefined,
    };
    const res = await bffFetch(editId ? `/api/v1/formandos/${editId}` : "/api/v1/formandos", {
      method: editId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) { setError(await parseApiError(res)); }
    else { setMsg(editId ? "Formando actualizado." : "Formando criado."); setDialogOpen(false); await load(); }
    setBusy(false);
  }

  async function confirmDelete() {
    if (!canManage || !deleteTarget) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    const res = await bffFetch(`/api/v1/formandos/${deleteTarget.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    const data = (await res.json()) as { matriculasRemovidas?: number; contaDesactivada?: boolean };
    const parts = ["Formando eliminado."];
    if ((data.matriculasRemovidas ?? 0) > 0) {
      parts.push(`${data.matriculasRemovidas} matrícula(s) removida(s).`);
    }
    if (data.contaDesactivada) {
      parts.push("Conta de utilizador desactivada.");
    }
    setMsg(parts.join(" "));
    setDeleteTarget(null);
    await load();
  }

  const COLUMNS: Column<Formando>[] = [
    { key: "nome", header: "Nome", cell: (f) => <span className="font-medium text-slate-100">{f.nome}</span> },
    {
      key: "contaEstado",
      header: "Conta",
      cell: (f) => (
        <Badge
          variant={
            f.contaEstado === "activa" ? "green" : f.contaEstado === "convite_pendente" ? "yellow" : "default"
          }
        >
          {f.contaEstado === "activa"
            ? "Activa"
            : f.contaEstado === "convite_pendente"
              ? "Convite pendente"
              : "Sem conta"}
        </Badge>
      ),
    },
    {
      key: "nif",
      header: "NIF",
      cell: (f) => (
        <span className="font-mono text-sm text-slate-300">
          {f.nif}
          {f.nifProvisorio ? (
            <span className="block text-[10px] text-amber-500/90 font-sans">provisório — actualizar</span>
          ) : null}
        </span>
      ),
    },
    { key: "email", header: "Email contacto", cell: (f) => <span className="text-slate-400 text-sm">{f.email ?? "–"}</span> },
    {
      key: "emailPresencaEfectivo",
      header: "Email reunião",
      cell: (f) => (
        <span className="text-slate-300 text-sm">
            {f.emailPresencaEfectivo ?? "–"}
          {f.emailPresencaEfectivo ? (
            f.emailPresenca ? (
              <span className="block text-[10px] text-teal-500/80">definido pelo gestor</span>
            ) : f.emailConta ? (
              <span className="block text-[10px] text-slate-500">conta do tenant</span>
            ) : null
          ) : (
            <span className="block text-[10px] text-amber-500/90">obrigatório p/ online</span>
          )}
        </span>
      ),
    },
    { key: "telefone", header: "Telefone", cell: (f) => <span className="text-slate-400 text-sm">{f.telefone ?? "–"}</span> },
    {
      key: "_count", header: "Matrículas",
      cell: (f) => <Badge variant="default">{f._count?.matriculas ?? 0}</Badge>,
      className: "text-center", headerClassName: "text-center",
    },
  ];

  return (
    <>
      <PageHeader
        title="Formandos"
        description="Registo de participantes – NIF válido exigido para compliance SIGO/DGERT."
        actions={canManage ? <Button onClick={openCreate}><PlusCircle className="h-4 w-4" />Novo formando</Button> : null}
      />

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}
      {msg && <Alert variant="success" className="mb-4">{msg}</Alert>}

      {!loading && formandos.length === 0 ? (
        <Card className="py-16 text-center">
          <Users className="mx-auto mb-3 h-10 w-10 text-slate-600" />
          <p className="text-slate-400">Ainda não há formandos registados.</p>
          {canManage && <Button className="mt-4" onClick={openCreate}><PlusCircle className="h-4 w-4" />Registar primeiro formando</Button>}
        </Card>
      ) : (
        <DataTable
          columns={COLUMNS}
          data={formandos}
          keyField="id"
          loading={loading}
          rowActions={canManage ? (f) => (
            <div className="flex items-center gap-0.5">
              <Button size="sm" variant="ghost" onClick={() => openEdit(f)} aria-label="Editar">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(f)} aria-label="Eliminar">
                <Trash2 className="h-3.5 w-3.5 text-red-400" />
              </Button>
            </div>
          ) : undefined}
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          title={editId ? "Editar formando" : "Novo formando"}
          description="NIF obrigatório e único por tenant."
        >
          <form onSubmit={(e) => void submit(e)} className="grid gap-4">
            <Input label="Nome *" required value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
            <Input label="NIF *" required minLength={9} maxLength={9} value={form.nif} onChange={(e) => setForm((f) => ({ ...f, nif: e.target.value }))} placeholder="123456789" />
            <Input label="Email de contacto" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            <Input
              label="Email para presença na reunião"
              type="email"
              value={form.emailPresenca}
              onChange={(e) => setForm((f) => ({ ...f, emailPresenca: e.target.value }))}
              placeholder="Opcional - sobrepõe o email da conta"
            />
            <p className="text-[11px] text-slate-500 -mt-2 leading-snug">
              Se vazio, o formando deve entrar no Zoom/Teams com o email da conta NexiForma. Se preenchido, só esse
              endereço conta na assiduidade da reunião.
            </p>
            <Input label="Telefone" value={form.telefone} onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))} />
            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={busy}>{busy ? "A guardar…" : editId ? "Guardar" : "Criar"}</Button>
              <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent
          title="Eliminar formando"
          description={
            deleteTarget
              ? `Eliminar ${deleteTarget.nome}? As matrículas (${deleteTarget._count?.matriculas ?? 0}) e documentos associados são removidos.` +
                (deleteTarget.contaEstado === "activa"
                  ? " A conta de utilizador fica desactivada."
                  : deleteTarget.contaEstado === "convite_pendente"
                    ? " O convite pendente é cancelado."
                    : "")
              : undefined
          }
        >
          <div className="flex gap-2 pt-2">
            <Button variant="danger" disabled={busy} onClick={() => void confirmDelete()}>
              {busy ? "A eliminar…" : "Eliminar"}
            </Button>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
