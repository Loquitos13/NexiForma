"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  FileText,
  HelpCircle,
  Package,
  Plus,
  Search,
  Type,
  Video,
} from "lucide-react";
import { validarModuloConteudoCompleto } from "@nexiforma/shared";
import { bffFetch } from "@/lib/client/bff-fetch";
import { parseApiError } from "@/lib/ui/backoffice";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { cn } from "@/lib/ui/cn";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  Input,
  PageHeader,
  Select,
  Textarea,
} from "@/components/ui";

type CursoOpt = {
  id: string;
  designacao: string;
  codigoUfcd: string | null;
  cargaHoras?: number;
  modalidade?: string;
  _count?: { acoesFormacao?: number; modulosConteudo?: number };
};

type ModuloRow = {
  id: string;
  titulo: string;
  tipo: string;
  ordem: number;
  publicado: boolean;
  urlOuRef: string | null;
  duracaoMin: number | null;
};

const TIPOS = ["VIDEO", "PDF", "TEXTO", "QUIZ", "SCORM"] as const;

const TIPO_META: Record<
  string,
  { label: string; variant: "blue" | "red" | "default" | "purple" | "teal"; Icon: typeof Video }
> = {
  VIDEO: { label: "Vídeo", variant: "blue", Icon: Video },
  PDF: { label: "Documento", variant: "red", Icon: FileText },
  TEXTO: { label: "Texto", variant: "default", Icon: Type },
  QUIZ: { label: "Quiz", variant: "purple", Icon: HelpCircle },
  SCORM: { label: "SCORM", variant: "teal", Icon: Package },
};

export default function ConteudosPage() {
  const { canManageFormacao: canManage } = useTenantRole();
  const [cursos, setCursos] = useState<CursoOpt[]>([]);
  const [cursoId, setCursoId] = useState("");
  const [modulos, setModulos] = useState<ModuloRow[]>([]);
  const [loadingCursos, setLoadingCursos] = useState(true);
  const [loadingModulos, setLoadingModulos] = useState(false);
  const [cursoQuery, setCursoQuery] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState<string | "ALL">("ALL");
  const [addOpen, setAddOpen] = useState(false);
  const [addMode, setAddMode] = useState<"manual" | "scorm">("manual");
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState<(typeof TIPOS)[number]>("TEXTO");
  const [urlOuRef, setUrlOuRef] = useState("");
  const [conteudoHtml, setConteudoHtml] = useState("");
  const [scormTitulo, setScormTitulo] = useState("");
  const [scormFile, setScormFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mobileShowDetail, setMobileShowDetail] = useState(false);

  const loadCursos = useCallback(async () => {
    setLoadingCursos(true);
    const r = await bffFetch("/api/v1/cursos", { headers: { accept: "application/json" } });
    setLoadingCursos(false);
    if (!r.ok) {
      setError("Erro ao carregar cursos.");
      return;
    }
    const rows = (await r.json()) as CursoOpt[];
    setCursos(rows);
    setCursoId((prev) => prev || rows[0]?.id || "");
  }, []);

  useEffect(() => {
    void loadCursos();
  }, [loadCursos]);

  const loadModulos = useCallback(async (id: string) => {
    if (!id) {
      setModulos([]);
      return;
    }
    setLoadingModulos(true);
    const r = await bffFetch(`/api/v1/conteudos-lms/modulos?cursoId=${encodeURIComponent(id)}`, {
      headers: { accept: "application/json" },
    });
    setLoadingModulos(false);
    if (!r.ok) {
      setError("Erro ao carregar módulos.");
      return;
    }
    setModulos((await r.json()) as ModuloRow[]);
  }, []);

  useEffect(() => {
    void loadModulos(cursoId);
  }, [cursoId, loadModulos]);

  const cursoAtivo = useMemo(
    () => cursos.find((c) => c.id === cursoId) ?? null,
    [cursos, cursoId],
  );

  const cursosFiltrados = useMemo(() => {
    const q = cursoQuery.trim().toLowerCase();
    if (!q) return cursos;
    return cursos.filter(
      (c) =>
        c.designacao.toLowerCase().includes(q) ||
        (c.codigoUfcd ?? "").toLowerCase().includes(q),
    );
  }, [cursos, cursoQuery]);

  const modulosVisiveis = useMemo(() => {
    const sorted = [...modulos].sort((a, b) => a.ordem - b.ordem);
    if (tipoFiltro === "ALL") return sorted;
    return sorted.filter((m) => m.tipo === tipoFiltro);
  }, [modulos, tipoFiltro]);

  const publicados = modulos.filter((m) => m.publicado).length;
  const tipoCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const m of modulos) map[m.tipo] = (map[m.tipo] ?? 0) + 1;
    return map;
  }, [modulos]);

  function resetAddForm() {
    setTitulo("");
    setUrlOuRef("");
    setConteudoHtml("");
    setScormTitulo("");
    setScormFile(null);
    setTipo("TEXTO");
    setAddMode("manual");
  }

  function closeAdd() {
    setAddOpen(false);
    resetAddForm();
  }

  function selectCurso(id: string) {
    setCursoId(id);
    setTipoFiltro("ALL");
    closeAdd();
    setMobileShowDetail(true);
  }

  async function afterMutate() {
    await Promise.all([loadModulos(cursoId), loadCursos()]);
  }

  async function criarModulo(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage || !cursoId || !titulo.trim()) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    const draft = {
      tipo,
      urlOuRef: urlOuRef.trim() || null,
      conteudoHtml: conteudoHtml.trim() || null,
    };
    const check = validarModuloConteudoCompleto(draft);
    const r = await bffFetch("/api/v1/conteudos-lms/modulos", {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        cursoId,
        titulo: titulo.trim(),
        tipo,
        ordem: modulos.length,
        urlOuRef: draft.urlOuRef || undefined,
        conteudoHtml: draft.conteudoHtml || undefined,
        publicado: check.ok,
      }),
    });
    setBusy(false);
    if (!r.ok) {
      setError(await parseApiError(r));
      return;
    }
    setMsg("Módulo criado.");
    closeAdd();
    await afterMutate();
  }

  async function uploadScorm(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage || !cursoId || !scormTitulo.trim() || !scormFile) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    const form = new FormData();
    form.append("cursoId", cursoId);
    form.append("titulo", scormTitulo.trim());
    form.append("package", scormFile);
    const r = await bffFetch("/api/v1/conteudos-lms/scorm/upload", { method: "POST", body: form });
    setBusy(false);
    if (!r.ok) {
      setError("Erro ao carregar SCORM.");
      return;
    }
    setMsg("Pacote SCORM carregado e publicado.");
    closeAdd();
    await afterMutate();
  }

  return (
    <>
      <PageHeader
        title="Conteúdos LMS"
        description="Escolhe um curso e gere a sequência de módulos (vídeo, PDF, texto, quiz ou SCORM)."
        actions={
          canManage && cursoAtivo ? (
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" />
              Adicionar módulo
            </Button>
          ) : null
        }
      />

      {error ? <Alert variant="error" className="mb-4">{error}</Alert> : null}
      {msg ? <Alert variant="success" className="mb-4">{msg}</Alert> : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)] lg:items-start">
        {/* Lista de cursos */}
        <Card
          className={cn(
            "overflow-hidden lg:sticky lg:top-4",
            mobileShowDetail && "hidden lg:block",
          )}
        >
          <div className="border-b border-slate-700/40 px-4 py-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-200">Cursos</p>
              <span className="text-xs text-slate-500">{cursos.length}</span>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <Input
                className="pl-8"
                placeholder="Pesquisar UFCD ou nome…"
                value={cursoQuery}
                onChange={(e) => setCursoQuery(e.target.value)}
                aria-label="Pesquisar cursos"
              />
            </div>
          </div>
          <CardContent className="max-h-[min(70vh,640px)] space-y-1 overflow-y-auto p-2">
            {loadingCursos ? (
              <p className="px-2 py-6 text-center text-sm text-slate-500">A carregar cursos…</p>
            ) : cursosFiltrados.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-slate-500">Nenhum curso encontrado.</p>
            ) : (
              cursosFiltrados.map((c) => {
                const active = c.id === cursoId;
                const count = c._count?.modulosConteudo ?? (active ? modulos.length : undefined);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => selectCurso(c.id)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                      active
                        ? "bg-blue-500/15 ring-1 ring-blue-400/40"
                        : "hover:bg-slate-800/60",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                        active ? "bg-blue-500/25 text-blue-300" : "bg-slate-800 text-slate-400",
                      )}
                    >
                      <BookOpen className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-100">
                        {c.designacao}
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                        <span>{c.codigoUfcd || "Sem UFCD"}</span>
                        <span aria-hidden>·</span>
                        <span>
                          {count === undefined
                            ? "-"
                            : `${count} módulo${count === 1 ? "" : "s"}`}
                        </span>
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Detalhe do curso / módulos */}
        <div className={cn(!mobileShowDetail && cursoAtivo && "hidden lg:block")}>
          {!cursoAtivo ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
                <BookOpen className="h-8 w-8 text-slate-600" />
                <p className="text-sm font-medium text-slate-300">Selecciona um curso</p>
                <p className="max-w-sm text-sm text-slate-500">
                  Os conteúdos LMS estão organizados por curso. Escolhe um à esquerda para ver e
                  editar a sequência de módulos.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <Card>
                <CardContent className="flex flex-col gap-3 pt-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <button
                      type="button"
                      className="mb-2 text-xs font-medium text-blue-400 hover:text-blue-300 lg:hidden"
                      onClick={() => setMobileShowDetail(false)}
                    >
                      ← Voltar aos cursos
                    </button>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {cursoAtivo.codigoUfcd || "Curso"}
                    </p>
                    <h2 className="mt-0.5 text-lg font-semibold text-slate-50">
                      {cursoAtivo.designacao}
                    </h2>
                    <p className="mt-1 text-sm text-slate-400">
                      {modulos.length} módulo{modulos.length === 1 ? "" : "s"}
                      {modulos.length > 0 ? ` · ${publicados} publicado${publicados === 1 ? "" : "s"}` : null}
                      {cursoAtivo.cargaHoras ? ` · ${cursoAtivo.cargaHoras}h` : null}
                    </p>
                  </div>
                  {canManage ? (
                    <Button className="shrink-0 lg:hidden" onClick={() => setAddOpen(true)}>
                      <Plus className="h-4 w-4" />
                      Adicionar
                    </Button>
                  ) : null}
                </CardContent>
              </Card>

              {modulos.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  <FilterChip
                    active={tipoFiltro === "ALL"}
                    onClick={() => setTipoFiltro("ALL")}
                    label={`Todos (${modulos.length})`}
                  />
                  {TIPOS.map((t) => {
                    const n = tipoCounts[t] ?? 0;
                    if (!n) return null;
                    return (
                      <FilterChip
                        key={t}
                        active={tipoFiltro === t}
                        onClick={() => setTipoFiltro(t)}
                        label={`${TIPO_META[t]?.label ?? t} (${n})`}
                      />
                    );
                  })}
                </div>
              ) : null}

              {loadingModulos ? (
                <Card>
                  <CardContent className="py-12 text-center text-sm text-slate-500">
                    A carregar módulos…
                  </CardContent>
                </Card>
              ) : modulos.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center gap-3 px-6 py-14 text-center">
                    <LayersEmpty />
                    <p className="text-sm font-medium text-slate-300">Ainda sem conteúdos</p>
                    <p className="max-w-md text-sm text-slate-500">
                      Este curso ainda não tem módulos LMS. Adiciona vídeo, documento, texto, quiz
                      ou um pacote SCORM para começar o percurso.
                    </p>
                    {canManage ? (
                      <Button onClick={() => setAddOpen(true)}>
                        <Plus className="h-4 w-4" />
                        Criar primeiro módulo
                      </Button>
                    ) : null}
                  </CardContent>
                </Card>
              ) : modulosVisiveis.length === 0 ? (
                <Card>
                  <CardContent className="py-10 text-center text-sm text-slate-500">
                    Nenhum módulo deste tipo.
                  </CardContent>
                </Card>
              ) : (
                <ol className="space-y-2">
                  {modulosVisiveis.map((m, idx) => {
                    const meta = TIPO_META[m.tipo] ?? TIPO_META.TEXTO!;
                    const Icon = meta.Icon;
                    return (
                      <li key={m.id}>
                        <Card className="transition-colors hover:border-slate-600/60">
                          <CardContent className="flex items-start gap-3 py-3.5 sm:gap-4">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-slate-400">
                              {m.ordem + 1 || idx + 1}
                            </span>
                            <span
                              className={cn(
                                "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                                m.tipo === "VIDEO" && "bg-blue-500/15 text-blue-300",
                                m.tipo === "PDF" && "bg-red-500/15 text-red-300",
                                m.tipo === "TEXTO" && "bg-slate-700/60 text-slate-300",
                                m.tipo === "QUIZ" && "bg-purple-500/15 text-purple-300",
                                m.tipo === "SCORM" && "bg-teal-500/15 text-teal-300",
                              )}
                            >
                              <Icon className="h-4 w-4" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate text-sm font-medium text-slate-100">
                                  {m.titulo}
                                </p>
                                <Badge variant={meta.variant}>{meta.label}</Badge>
                                <Badge variant={m.publicado ? "green" : "yellow"}>
                                  {m.publicado ? "Publicado" : "Rascunho"}
                                </Badge>
                              </div>
                              <p className="mt-1 truncate text-xs text-slate-500">
                                {m.urlOuRef
                                  ? m.urlOuRef
                                  : m.duracaoMin
                                    ? `${m.duracaoMin} min`
                                    : "Sem referência externa"}
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          )}
        </div>
      </div>

      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          if (!open) closeAdd();
          else setAddOpen(true);
        }}
      >
        <DialogContent
          title="Adicionar módulo"
          description={
            cursoAtivo
              ? `Curso: ${cursoAtivo.codigoUfcd ? `${cursoAtivo.codigoUfcd} - ` : ""}${cursoAtivo.designacao}`
              : undefined
          }
          className="max-w-xl"
        >
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={addMode === "manual" ? "default" : "secondary"}
                onClick={() => setAddMode("manual")}
              >
                Conteúdo manual
              </Button>
              <Button
                size="sm"
                variant={addMode === "scorm" ? "teal" : "secondary"}
                onClick={() => setAddMode("scorm")}
              >
                Pacote SCORM
              </Button>
            </div>

            {addMode === "manual" ? (
              <form onSubmit={(e) => void criarModulo(e)} className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Input
                    label="Título *"
                    placeholder="Nome do módulo"
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    required
                  />
                </div>
                <Select
                  label="Tipo"
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value as typeof tipo)}
                >
                  {TIPOS.filter((t) => t !== "SCORM").map((t) => (
                    <option key={t} value={t}>
                      {TIPO_META[t]?.label ?? t}
                    </option>
                  ))}
                </Select>
                <Input
                  label="URL ou referência"
                  placeholder="Opcional"
                  value={urlOuRef}
                  onChange={(e) => setUrlOuRef(e.target.value)}
                />
                {tipo === "TEXTO" ? (
                  <div className="sm:col-span-2">
                    <Textarea
                      label="Conteúdo HTML"
                      placeholder="Opcional"
                      value={conteudoHtml}
                      onChange={(e) => setConteudoHtml(e.target.value)}
                      rows={4}
                    />
                  </div>
                ) : null}
                <div className="flex gap-2 sm:col-span-2">
                  <Button type="submit" disabled={busy}>
                    {busy ? "A guardar…" : "Criar módulo"}
                  </Button>
                  <Button type="button" variant="secondary" onClick={closeAdd}>
                    Cancelar
                  </Button>
                </div>
              </form>
            ) : (
              <form onSubmit={(e) => void uploadScorm(e)} className="grid gap-3">
                <Input
                  label="Título *"
                  placeholder="Título do módulo SCORM"
                  value={scormTitulo}
                  onChange={(e) => setScormTitulo(e.target.value)}
                  required
                />
                <Input
                  label="Ficheiro .zip *"
                  type="file"
                  accept=".zip,application/zip"
                  onChange={(e) => setScormFile(e.target.files?.[0] ?? null)}
                  required
                />
                <div className="flex gap-2">
                  <Button type="submit" variant="teal" disabled={busy}>
                    {busy ? "A carregar…" : "Carregar SCORM"}
                  </Button>
                  <Button type="button" variant="secondary" onClick={closeAdd}>
                    Cancelar
                  </Button>
                </div>
              </form>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-blue-500/20 text-blue-200 ring-1 ring-blue-400/40"
          : "bg-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200",
      )}
    >
      {label}
    </button>
  );
}

function LayersEmpty() {
  return (
    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800 text-slate-500">
      <Package className="h-6 w-6" />
    </span>
  );
}
