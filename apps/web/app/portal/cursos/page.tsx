"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { PlusCircle, Pencil, Eye } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { parseApiError } from "@/lib/ui/backoffice";
import {
  Alert, Badge, Button, Card, CardContent, CardHeader, CardTitle,
  DataTable, Dialog, DialogContent, Input, PageHeader, Select, Textarea, type Column,
} from "@/components/ui";

type Curso = {
  id: string; codigoUfcd: string | null; designacao: string;
  cargaHoras: number; modalidade: string; _count?: { acoesFormacao: number };
};

const EMPTY = { codigoUfcd: "", designacao: "", cargaHoras: "50", modalidade: "presencial", objetivos: "" };

const MODALIDADE_LABEL: Record<string, string> = {
  presencial: "Presencial", "b-learning": "B-learning", "e-learning": "E-learning",
};

export default function CursosPage() {
  const { canManage } = useTenantRole();
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const res = await bffFetch("/api/v1/cursos", { headers: { accept: "application/json" } });
    if (!res.ok) setError(await parseApiError(res));
    else setCursos((await res.json()) as Curso[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  function openCreate() { setEditId(null); setForm(EMPTY); setDialogOpen(true); }
  async function openEdit(c: Curso) {
    setEditId(c.id);
    setDialogOpen(true);
    const res = await bffFetch(`/api/v1/cursos/${c.id}`, { headers: { accept: "application/json" } });
    if (res.ok) {
      const full = (await res.json()) as Curso & { objetivos?: string | null };
      setForm({
        codigoUfcd: full.codigoUfcd ?? "",
        designacao: full.designacao,
        cargaHoras: String(full.cargaHoras),
        modalidade: full.modalidade,
        objetivos: full.objetivos ?? "",
      });
    } else {
      setForm({ codigoUfcd: c.codigoUfcd ?? "", designacao: c.designacao, cargaHoras: String(c.cargaHoras), modalidade: c.modalidade, objetivos: "" });
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    setBusy(true); setMsg(null); setError(null);
    const body = {
      codigoUfcd: form.codigoUfcd.trim() || undefined,
      designacao: form.designacao.trim(),
      cargaHoras: Number(form.cargaHoras),
      modalidade: form.modalidade,
      objetivos: form.objetivos.trim() || undefined,
    };
    const res = await bffFetch(editId ? `/api/v1/cursos/${editId}` : "/api/v1/cursos", {
      method: editId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) setError(await parseApiError(res));
    else { setMsg(editId ? "Curso actualizado." : "Curso criado."); setDialogOpen(false); await load(); }
    setBusy(false);
  }

  const COLUMNS: Column<Curso>[] = [
    {
      key: "codigoUfcd", header: "UFCD",
      cell: (c) => c.codigoUfcd
        ? <Badge variant="blue">{c.codigoUfcd}</Badge>
        : <span className="text-slate-600">–</span>,
    },
    { key: "designacao", header: "Designação", cell: (c) => (
      <Link href={`/portal/cursos/${c.id}`} className="font-medium text-blue-400 hover:text-blue-300">
        {c.designacao}
      </Link>
    ) },
    {
      key: "cargaHoras", header: "Horas",
      cell: (c) => <span className="font-mono text-sm tabular-nums text-slate-300">{c.cargaHoras}h</span>,
    },
    {
      key: "modalidade", header: "Modalidade",
      cell: (c) => <Badge variant="default">{MODALIDADE_LABEL[c.modalidade] ?? c.modalidade}</Badge>,
    },
    {
      key: "_count", header: "Acções",
      cell: (c) => <Badge variant="default">{c._count?.acoesFormacao ?? 0}</Badge>,
      className: "text-center", headerClassName: "text-center",
    },
  ];

  return (
    <>
      <PageHeader
        title="Cursos"
        description="Catálogo formativo – UFCD, carga horária e objectivos (critério DGERT)."
        actions={canManage ? <Button onClick={openCreate}><PlusCircle className="h-4 w-4" />Novo curso</Button> : null}
      />

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}
      {msg && <Alert variant="success" className="mb-4">{msg}</Alert>}

      <DataTable
        columns={COLUMNS}
        data={cursos}
        keyField="id"
        loading={loading}
        emptyMessage="Sem cursos no catálogo. Crie o primeiro."
        rowActions={(c) => (
          <div className="flex gap-1">
            <Link
              href={`/portal/cursos/${c.id}`}
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-100"
            >
              <Eye className="h-3.5 w-3.5" />
            </Link>
            {canManage ? (
              <Button size="sm" variant="ghost" onClick={() => void openEdit(c)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            ) : null}
          </div>
        )}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          title={editId ? "Editar curso" : "Novo curso"}
          description="UFCD opcional – obrigatório para acções financiadas e SIGO."
        >
          <form onSubmit={(e) => void submit(e)} className="grid gap-4">
            <Input label="Código UFCD / CNQ" value={form.codigoUfcd} onChange={(e) => setForm((f) => ({ ...f, codigoUfcd: e.target.value }))} placeholder="7834" />
            <Input label="Designação *" required value={form.designacao} onChange={(e) => setForm((f) => ({ ...f, designacao: e.target.value }))} />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Carga horária *" type="number" min={1} required value={form.cargaHoras} onChange={(e) => setForm((f) => ({ ...f, cargaHoras: e.target.value }))} />
              <Select label="Modalidade" value={form.modalidade} onChange={(e) => setForm((f) => ({ ...f, modalidade: e.target.value }))}>
                <option value="presencial">Presencial</option>
                <option value="b-learning">B-learning</option>
                <option value="e-learning">E-learning</option>
              </Select>
            </div>
            <Textarea label="Objectivos de aprendizagem" rows={3} value={form.objetivos} onChange={(e) => setForm((f) => ({ ...f, objetivos: e.target.value }))} />
            <div className="flex gap-2 pt-1">
              <Button type="submit" disabled={busy}>{busy ? "A guardar…" : editId ? "Guardar" : "Criar curso"}</Button>
              <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
