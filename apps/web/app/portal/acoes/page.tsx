"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { PlusCircle, Sparkles, Upload } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { extractCronogramaTextFromFile } from "@/lib/client/extract-cronograma-text";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { parseApiError } from "@/lib/ui/backoffice";
import { Alert, Badge, Button, Card, CardContent, CardHeader, CardTitle, PaginatedDataTable, estadoBadge, Input, PageHeader, Select, type Column } from "@/components/ui";

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
    sortable: true,
    sortValue: (a) => a.codigoInterno,
    cell: (a) => (
      <Link href={`/portal/acoes/${a.id}`} className="font-semibold text-blue-400 hover:text-blue-300">
        {a.codigoInterno}
      </Link>
    ),
  },
  {
    key: "titulo",
    header: "Título",
    sortable: true,
    sortValue: (a) => a.titulo,
    cell: (a) => <span className="text-slate-200">{a.titulo}</span>,
  },
  {
    key: "curso",
    header: "Curso",
    sortable: true,
    hideOnMobile: true,
    sortValue: (a) => a.curso?.designacao ?? "",
    cell: (a) => <span className="text-slate-400 text-sm">{a.curso?.designacao ?? "–"}</span>,
  },
  {
    key: "estado",
    header: "Estado",
    sortable: true,
    mobilePriority: true,
    sortCycle: ["EM_CURSO", "PLANEADA", "CONCLUIDA", "CANCELADA"],
    sortCycleLabel: (v) => String(v).replace("_", " "),
    sortValue: (a) => a.estado,
    cell: (a) => estadoBadge(a.estado),
  },
  {
    key: "dataInicio",
    header: "Período",
    sortable: true,
    hideOnMobile: true,
    sortValue: (a) => new Date(a.dataInicio).getTime(),
    cell: (a) => (
      <span className="text-slate-400 text-sm tabular-nums">
        {String(a.dataInicio).slice(0, 10)} – {String(a.dataFim).slice(0, 10)}
      </span>
    ),
  },
  {
    key: "_count",
    header: "Turmas",
    sortable: true,
    sortValue: (a) => a._count?.turmas ?? 0,
    cell: (a) => (
      <Badge variant="default">{a._count?.turmas ?? 0}</Badge>
    ),
    headerClassName: "text-center",
    className: "text-center",
  },
];

const ESTADO_OPTS = ["PLANEADA", "EM_CURSO", "CONCLUIDA", "CANCELADA"];

export default function AcoesPage() {
  const { canManageFormacao: canManage, isFormador } = useTenantRole();
  const fileRef = useRef<HTMLInputElement>(null);
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
    tipoFinanciamento: "AUTO_FINANCIADA" as "FINANCIADA" | "AUTO_FINANCIADA",
  });
  const [cronogramaFile, setCronogramaFile] = useState<File | null>(null);

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
      setForm((f) => ({ ...f, cursoId: cursos[0]!.id }));
    }
  }, [cursos, form.cursoId]);

  function resetForm() {
    setForm((f) => ({
      ...f,
      codigoInterno: "",
      titulo: "",
      dataInicio: "",
      dataFim: "",
      estado: "PLANEADA",
    }));
    setCronogramaFile(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canManage) return;

    const codigo = form.codigoInterno.trim();
    const titulo = form.titulo.trim();
    if (!form.cursoId) {
      setError("Seleccione um curso existente.");
      return;
    }
    if (!codigo) {
      setError("O código interno é obrigatório.");
      return;
    }
    if (!titulo) {
      setError("O título é obrigatório.");
      return;
    }

    setBusy(true);
    setMsg(null);
    setError(null);

    let textoCronograma: string | null = null;
    if (cronogramaFile) {
      try {
        textoCronograma = await extractCronogramaTextFromFile(cronogramaFile);
        if (!textoCronograma.trim() || textoCronograma.trim().length < 40) {
          setError(
            "Não foi possível ler texto suficiente do cronograma (PDF digitalizado sem OCR?).",
          );
          setBusy(false);
          return;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Falha ao ler o ficheiro do cronograma.");
        setBusy(false);
        return;
      }
    }

    const res = await bffFetch("/api/v1/acoes-formacao", {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        ...form,
        codigoInterno: codigo,
        titulo,
      }),
    });
    if (!res.ok) {
      setError(await parseApiError(res));
      setBusy(false);
      return;
    }

    const acao = (await res.json()) as { id: string };

    if (!textoCronograma) {
      setMsg("Acção criada com sucesso.");
      setShowForm(false);
      resetForm();
      await load();
      setBusy(false);
      return;
    }

    const cronRes = await bffFetch("/api/v1/cronogramas", {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ acaoFormacaoId: acao.id }),
    });
    if (!cronRes.ok) {
      setError(
        `Acção criada, mas falhou a criar o cronograma: ${await parseApiError(cronRes)}. Pode importar depois na ficha da acção.`,
      );
      setShowForm(false);
      resetForm();
      await load();
      setBusy(false);
      return;
    }

    const cronograma = (await cronRes.json()) as { id: string };
    const jobRes = await bffFetch(
      `/api/v1/cronogramas/${cronograma.id}/importar-ia/jobs`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({ texto: textoCronograma, nomeFicheiro: cronogramaFile?.name }),
      },
    );
    setShowForm(false);
    resetForm();
    if (jobRes.ok) {
      setMsg(
        "Acção criada. A IA está a analisar o cronograma em background - acompanhe pelo indicador junto às notificações.",
      );
    } else {
      setError(
        `Acção criada, mas falhou iniciar a análise do cronograma: ${await parseApiError(jobRes)}. Pode tentar importar depois na ficha da acção.`,
      );
    }
    await load();
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
            <Button onClick={() => setShowForm((v) => !v)} data-guided-flow-anchor="nova-acao">
              <PlusCircle className="h-4 w-4" />
              Nova acção
            </Button>
          ) : null
        }
      />

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}
      {msg && <Alert variant="success" className="mb-4">{msg}</Alert>}

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
              <div className="sm:col-span-2">
                <Select
                  label="Tipo de financiamento *"
                  required
                  value={form.tipoFinanciamento}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      tipoFinanciamento: e.target.value as "FINANCIADA" | "AUTO_FINANCIADA",
                    }))
                  }
                >
                  <option value="AUTO_FINANCIADA">Autofinanciada</option>
                  <option value="FINANCIADA">Financiada</option>
                </Select>
                <p className="mt-1 text-xs text-slate-500">
                  Define o quadro de verificação DTP e documentos do dossiê pedagógico aplicáveis.
                </p>
              </div>

              <div className="sm:col-span-2 space-y-2 rounded-xl border border-slate-700/50 bg-slate-900/40 p-4">
                <div className="flex items-start gap-2">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-200">
                      Cronograma existente (opcional)
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      Carregue um HTML/PDF/TXT com legenda. Após criar a acção, a IA propõe as
                      sessões presenciais/online e o prazo das tarefas assíncronas.
                    </p>
                  </div>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".html,.htm,.pdf,.txt,.csv,text/html,application/pdf,text/plain,text/csv"
                  className="hidden"
                  onChange={(e) => setCronogramaFile(e.target.files?.[0] ?? null)}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => fileRef.current?.click()}
                  >
                    <Upload className="h-4 w-4" />
                    {cronogramaFile ? "Trocar ficheiro" : "Carregar cronograma"}
                  </Button>
                  {cronogramaFile ? (
                    <span className="truncate text-xs text-slate-300" title={cronogramaFile.name}>
                      {cronogramaFile.name}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-500">Nenhum ficheiro seleccionado</span>
                  )}
                  {cronogramaFile ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => {
                        setCronogramaFile(null);
                        if (fileRef.current) fileRef.current.value = "";
                      }}
                    >
                      Remover
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="sm:col-span-2 flex gap-2 pt-1">
                <Button type="submit" disabled={busy || !cursos.length}>
                  {busy
                    ? "A criar…"
                    : cronogramaFile
                      ? "Criar acção e importar cronograma"
                      : "Criar acção"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <PaginatedDataTable
        columns={COLUMNS}
        data={acoes}
        keyField="id"
        loading={loading}
        getRowHref={(a) => `/portal/acoes/${a.id}`}
        emptyMessage="Ainda não há acções de formação. Crie a primeira acima."
      />
    </>
  );
}
