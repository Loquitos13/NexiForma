"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { PlusCircle } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { parseApiError } from "@/lib/ui/backoffice";
import { Alert, Badge, Button, Card, CardContent, CardHeader, CardTitle, DataTable, estadoBadge, Input, PageHeader, Select, type Column } from "@/components/ui";

type CursoOpt = { id: string; designacao: string };
type Acao = {
  id: string;
  codigoInterno: string;
  titulo: string;
  estado: string;
  dataInicio: string;
  dataFim: string;
  curso?: { designacao?: string };
  _count?: { turmas: number };
};

const COLUMNS: Column<Acao>[] = [
  {
    key: "codigoInterno",
    header: "Código",
    cell: (a) => (
      <Link href={`/portal/acoes/${a.id}`} className="font-semibold text-blue-400 hover:text-blue-300">
        {a.codigoInterno}
      </Link>
    ),
  },
  {
    key: "titulo",
    header: "Título",
    cell: (a) => <span className="text-slate-200">{a.titulo}</span>,
  },
  {
    key: "curso",
    header: "Curso",
    cell: (a) => <span className="text-slate-400 text-sm">{a.curso?.designacao ?? "–"}</span>,
  },
  {
    key: "estado",
    header: "Estado",
    cell: (a) => estadoBadge(a.estado),
  },
  {
    key: "dataInicio",
    header: "Período",
    cell: (a) => (
      <span className="text-slate-400 text-sm tabular-nums">
        {String(a.dataInicio).slice(0, 10)} – {String(a.dataFim).slice(0, 10)}
      </span>
    ),
  },
  {
    key: "_count",
    header: "Turmas",
    cell: (a) => (
      <Badge variant="default">{a._count?.turmas ?? 0}</Badge>
    ),
    headerClassName: "text-center",
    className: "text-center",
  },
];

const ESTADO_OPTS = ["PLANEADA", "EM_CURSO", "CONCLUIDA", "CANCELADA"];

export default function AcoesPage() {
  const { canManage, isFormador } = useTenantRole();
  const [acoes, setAcoes] = useState<Acao[]>([]);
  const [cursos, setCursos] = useState<CursoOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    cursoId: "",
    codigoInterno: "",
    titulo: "",
    dataInicio: "",
    dataFim: "",
    estado: "PLANEADA",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [acoesRes, cursosRes] = await Promise.all([
      bffFetch("/api/v1/acoes-formacao", { headers: { accept: "application/json" } }),
      bffFetch("/api/v1/cursos", { headers: { accept: "application/json" } }),
    ]);
    if (!acoesRes.ok) setError(await parseApiError(acoesRes));
    else setAcoes((await acoesRes.json()) as Acao[]);
    if (cursosRes.ok) setCursos((await cursosRes.json()) as CursoOpt[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (cursos.length && !form.cursoId) {
      setForm((f) => ({ ...f, cursoId: cursos[0].id }));
    }
  }, [cursos, form.cursoId]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    setBusy(true);
    setMsg(null);
    setError(null);
    const res = await bffFetch("/api/v1/acoes-formacao", {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      setError(await parseApiError(res));
    } else {
      setMsg("Acção criada com sucesso.");
      setShowForm(false);
      setForm((f) => ({ ...f, codigoInterno: "", titulo: "", dataInicio: "", dataFim: "" }));
      await load();
    }
    setBusy(false);
  }

  return (
    <>
      <PageHeader
        title="Acções de formação"
        description={
          isFormador
            ? "Acções onde tens sessões atribuídas - edita conteúdos LMS em cada acção."
            : "Planeamento e execução – cada acção liga a turmas, cronograma e compliance DGERT."
        }
        actions={
          canManage && cursos.length > 0 ? (
            <Button onClick={() => setShowForm((v) => !v)}>
              <PlusCircle className="h-4 w-4" />
              Nova acção
            </Button>
          ) : null
        }
      />

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}
      {msg && <Alert variant="success" className="mb-4">{msg}</Alert>}

      {/* Create form */}
      {showForm && canManage && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Nova acção de formação</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void submit(e)} className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Select
                  label="Curso *"
                  required
                  value={form.cursoId}
                  onChange={(e) => setForm((f) => ({ ...f, cursoId: e.target.value }))}
                >
                  {cursos.map((c) => (
                    <option key={c.id} value={c.id}>{c.designacao}</option>
                  ))}
                </Select>
              </div>
              <Input
                label="Código interno *"
                required
                value={form.codigoInterno}
                onChange={(e) => setForm((f) => ({ ...f, codigoInterno: e.target.value }))}
                placeholder="NF-2025-AF02"
              />
              <Input
                label="Título *"
                required
                value={form.titulo}
                onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
              />
              <Input
                label="Data de início *"
                type="date"
                required
                value={form.dataInicio}
                onChange={(e) => setForm((f) => ({ ...f, dataInicio: e.target.value }))}
              />
              <Input
                label="Data de fim *"
                type="date"
                required
                value={form.dataFim}
                onChange={(e) => setForm((f) => ({ ...f, dataFim: e.target.value }))}
              />
              <div className="sm:col-span-2">
                <Select
                  label="Estado inicial"
                  value={form.estado}
                  onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value }))}
                >
                  {ESTADO_OPTS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </Select>
                 </div>
              <div className="sm:col-span-2 flex gap-2 pt-1">
                <Button type="submit" disabled={busy}>
                  {busy ? "A criar…" : "Criar acção"}
                </Button>
                <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <DataTable
        columns={COLUMNS}
        data={acoes}
        keyField="id"
        loading={loading}
        emptyMessage="Ainda não há acções de formação. Crie a primeira acima."
      />
    </>
  );
}
