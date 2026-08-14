"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Download,
  FileText,
  Mail,
  Plus,
  Receipt,
  Send,
  Trash2,
} from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { downloadResponseAsFile } from "@/lib/client/download-response";
import { openHtmlForPrint } from "@/lib/client/open-html-for-print";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { parseApiError } from "@/lib/ui/backoffice";
import { roleSatisfies } from "@nexiforma/shared";
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
  Select,
  Textarea,
  pushToast,
  type Column,
  type SortState,
} from "@/components/ui";
import { PropostaEstadoBadge } from "@/components/crm/proposta-estado-badge";
import { CrmContextNav, PROPOSTAS_NAV } from "@/components/crm/crm-context-nav";
import {
  CrmListFilters,
  crmListFiltersToParams,
  emptyCrmListFilters,
  type CrmListFiltersValue,
} from "@/components/crm/crm-list-filters";
import { ListPaginationControls } from "@/components/crm/list-pagination";
import { parsePaginatedList } from "@/lib/crm/paginated-list";
import { withPortalFrom } from "@/lib/ui/portal-back-nav";
import {
  PropostaLinhasEditor,
  buildLinhasCreateFromModal,
  novaPropostaLinha,
  type PropostaLinhaForm,
} from "@/components/crm/PropostaLinhasEditor";
import {
  fmtDate,
  fmtEuro,
  fmtPropostaAutoria,
  generatePropostaCodigo,
  propostaEstadoLabel,
  type PropostaEstado,
} from "@/lib/crm/shared";

type EntidadeOpt = { id: string; nome: string; nif: string; email: string | null };
type CursoOpt = { id: string; designacao: string; codigoUfcd: string | null };
type Proposta = {
  id: string;
  codigo: string;
  titulo: string;
  estado: string;
  valorCentavos: number;
  validadeAte: string | null;
  enviadaEm?: string | null;
  entidadeCliente: { id: string; nome: string; nif: string; email: string | null };
  curso: { designacao: string } | null;
  criadoPor?: { displayName: string } | null;
  enviadaPor?: { displayName: string } | null;
  fatura?: { id: string; estado: string } | null;
};

const ESTADOS: (PropostaEstado | "TODAS")[] = [
  "TODAS",
  "RASCUNHO",
  "ENVIADA",
  "ACEITE",
  "REJEITADA",
  "CANCELADA",
];

function podeEnviarProposta(estado: string): boolean {
  return estado !== "CANCELADA";
}

function podeFaturarProposta(p: Proposta): boolean {
  return !p.fatura && p.estado === "ACEITE";
}

export default function PropostasPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { canManageCrm, canManage, writeDisabled, role } = useTenantRole();
  const canEditModeloPropostas = roleSatisfies(role, "coordenador_comercial");
  /** Só gestor e coordenador comercial podem eliminar propostas. */
  const canDeleteProposta = roleSatisfies(role, "coordenador_comercial");
  const [estadoFilter, setEstadoFilter] = useState<string>("TODAS");
  const [entidadeFilter, setEntidadeFilter] = useState("");
  const [entidades, setEntidades] = useState<EntidadeOpt[]>([]);
  const [cursos, setCursos] = useState<CursoOpt[]>([]);
  const [propostas, setPropostas] = useState<Proposta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [enviarOpen, setEnviarOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Proposta | null>(null);
  const [activeProposta, setActiveProposta] = useState<Proposta | null>(null);
  const [enviarEmail, setEnviarEmail] = useState("");
  const [pendingEnviarId, setPendingEnviarId] = useState<string | null>(null);
  const [form, setForm] = useState({
    entidadeClienteId: "",
    codigo: "",
    titulo: "",
    descricao: "",
    valorEuros: "",
    validadeAte: "",
    cursoId: "",
  });
  const [linhas, setLinhas] = useState<PropostaLinhaForm[]>([novaPropostaLinha()]);
  const [listFilters, setListFilters] = useState<CrmListFiltersValue>(emptyCrmListFilters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({ TODAS: 0 });
  const [sort, setSort] = useState<SortState | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const initialLoadDoneRef = useRef(false);
  const pinTableScrollRef = useRef(false);
  const pinnedScrollTopRef = useRef(0);

  function portalScrollEl(): HTMLElement | null {
    return document.querySelector<HTMLElement>(".portal-scroll-main");
  }

  function pinTableInView() {
    pinTableScrollRef.current = true;
    pinnedScrollTopRef.current = portalScrollEl()?.scrollTop ?? window.scrollY;
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ent = params.get("entidade");
    const est = params.get("estado");
    const nova = params.get("nova");
    const enviarId = params.get("enviar");
    if (ent) setEntidadeFilter(ent);
    if (est && ESTADOS.includes(est as PropostaEstado | "TODAS")) setEstadoFilter(est);
    if (nova === "1" && canManageCrm) {
      setForm((f) => ({ ...f, codigo: generatePropostaCodigo() }));
      setCreateOpen(true);
    }
    if (enviarId) {
      setPendingEnviarId(enviarId);
    }
  }, [canManageCrm]);

  const load = useCallback(async () => {
    const soft = initialLoadDoneRef.current;
    if (soft) setRefreshing(true);
    else setLoading(true);
    const params = crmListFiltersToParams(listFilters, canManage, {
      entidadeClienteId: entidadeFilter || undefined,
      estado: estadoFilter !== "TODAS" ? estadoFilter : undefined,
      page: String(page),
      pageSize: String(pageSize),
      sortBy: sort?.key && sort.key !== "estado" ? sort.key : undefined,
      sortDir: sort?.key && sort.key !== "estado" ? sort.direction : undefined,
    });
    const q = params.toString() ? `?${params}` : "";
    const [pRes, eRes, cRes] = await Promise.all([
      bffFetch(`/api/v1/propostas${q}`, { headers: { accept: "application/json" } }),
      bffFetch("/api/v1/entidades-cliente", { headers: { accept: "application/json" } }),
      bffFetch("/api/v1/cursos", { headers: { accept: "application/json" } }),
    ]);
    if (!pRes.ok) setError(await parseApiError(pRes));
    else {
      const data = parsePaginatedList<Proposta>(await pRes.json());
      setPropostas(data.items);
      setTotal(data.total);
      if (data.countsByEstado) setCounts(data.countsByEstado);
    }
    if (eRes.ok) {
      const raw = (await eRes.json()) as EntidadeOpt[] | { items?: EntidadeOpt[] };
      const ents = Array.isArray(raw) ? raw : (raw.items ?? []);
      setEntidades(ents);
      setForm((f) => {
        if (f.entidadeClienteId) return f;
        const pick =
          entidadeFilter && ents.some((x) => x.id === entidadeFilter)
            ? entidadeFilter
            : ents[0]?.id ?? "";
        return { ...f, entidadeClienteId: pick };
      });
    }
    if (cRes.ok) setCursos((await cRes.json()) as CursoOpt[]);
    initialLoadDoneRef.current = true;
    setLoading(false);
    setRefreshing(false);
  }, [entidadeFilter, listFilters, canManage, estadoFilter, page, pageSize, sort]);

  useEffect(() => {
    setPage(1);
  }, [entidadeFilter, listFilters, estadoFilter, pageSize]);

  useEffect(() => {
    void load();
  }, [load]);

  useLayoutEffect(() => {
    if (!pinTableScrollRef.current || loading || refreshing) return;
    pinTableScrollRef.current = false;
    const scroller = portalScrollEl();
    if (scroller) {
      scroller.scrollTop = pinnedScrollTopRef.current;
      return;
    }
    window.scrollTo({ top: pinnedScrollTopRef.current });
  }, [propostas, page, pageSize, loading, refreshing]);

  useEffect(() => {
    if (!pendingEnviarId || loading) return;
    void (async () => {
      let p = propostas.find((x) => x.id === pendingEnviarId) ?? null;
      if (!p) {
        const res = await bffFetch(`/api/v1/propostas/${pendingEnviarId}`, {
          headers: { accept: "application/json" },
        });
        if (res.ok) {
          p = (await res.json()) as Proposta;
        }
      }
      if (p && podeEnviarProposta(p.estado)) {
        setActiveProposta(p);
        setEnviarEmail(p.entidadeCliente.email ?? "");
        setEnviarOpen(true);
      }
      setPendingEnviarId(null);
      router.replace("/portal/propostas", { scroll: false });
    })();
  }, [pendingEnviarId, loading, propostas, router]);

  async function criar(e: FormEvent) {
    e.preventDefault();
    if (!canManageCrm) return;
    setBusy(true);
    setMsg(null);
    setError(null);
    const built = buildLinhasCreateFromModal({
      linhas,
      valorEuros: form.valorEuros,
      titulo: form.titulo,
    });
    if (built.error) {
      setError(built.error);
      setBusy(false);
      return;
    }
    const body: Record<string, unknown> = {
      entidadeClienteId: form.entidadeClienteId,
      codigo: form.codigo.trim() || undefined,
      titulo: form.titulo.trim(),
      descricao: form.descricao.trim() || undefined,
      validadeAte: form.validadeAte || undefined,
      cursoId: form.cursoId || undefined,
    };
    if (built.linhas.length > 0) {
      // Sempre gravar como linhas para a personalização herdar produtos/valores.
      body.linhas = built.linhas;
    } else {
      body.valorCentavos = 0;
    }
    const res = await bffFetch("/api/v1/propostas", {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      setError(await parseApiError(res));
      setBusy(false);
      return;
    }

    const created = (await res.json()) as { id?: string };
    const id = typeof created.id === "string" ? created.id.trim() : "";
    if (!id) {
      setError("Proposta criada, mas a resposta não trouxe o identificador.");
      setBusy(false);
      return;
    }

    // Navegação imediata para o editor - sem setState extra na lista
    // (evita re-render com Dialog/Alert a meio do soft-nav, que podia
    // disparar "Rendered more hooks than during the previous render").
    // Filtros/ordenação da tabela e «Modelo padrão» não entram neste fluxo.
    pushToast("success", "Proposta criada - personalize o conteúdo.");
    const href = withPortalFrom(`/portal/propostas/${id}`, pathname || "/portal/propostas");
    window.location.assign(href);
  }

  function openEnviar(p: Proposta) {
    setActiveProposta(p);
    setEnviarEmail(p.entidadeCliente.email ?? "");
    setEnviarOpen(true);
  }

  async function eliminarProposta() {
    if (!deleteTarget || !canDeleteProposta) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    const res = await bffFetch(`/api/v1/propostas/${deleteTarget.id}`, {
      method: "DELETE",
      headers: { accept: "application/json" },
    });
    setBusy(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    setMsg(`Proposta ${deleteTarget.codigo} eliminada.`);
    setDeleteTarget(null);
    await load();
  }

  async function enviarProposta(e: FormEvent) {
    e.preventDefault();
    if (!activeProposta) return;
    setBusy(true);
    setError(null);
    const res = await bffFetch(`/api/v1/propostas/${activeProposta.id}/enviar`, {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ destinatario: enviarEmail.trim() || undefined }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    setMsg(
      activeProposta.estado === "RASCUNHO"
        ? "Proposta enviada por email. O cliente recebe links para aceitar ou recusar - a conversão em cliente ocorre automaticamente ao aceitar."
        : "Proposta reenviada por email ao cliente.",
    );
    setEnviarOpen(false);
    setActiveProposta(null);
    await load();
  }

  async function imprimirProposta(id: string) {
    setBusy(true);
    setError(null);
    const r = await bffFetch(`/api/v1/propostas/${id}/proposta.html`, { headers: { accept: "text/html" } });
    setBusy(false);
    if (!r.ok) {
      setError("Erro ao gerar documento da proposta.");
      return;
    }
    const html = await r.text();
    const opened = openHtmlForPrint(html);
    if (!opened.ok) {
      setError(opened.error);
      return;
    }
  }

  async function descarregarProposta(id: string, codigo: string) {
    setBusy(true);
    setError(null);
    const r = await bffFetch(`/api/v1/propostas/${id}/proposta.html?download=1`, {
      headers: { accept: "text/html" },
    });
    setBusy(false);
    if (!r.ok) {
      setError("Erro ao descarregar proposta.");
      return;
    }
    await downloadResponseAsFile(r, `proposta-${codigo.toLowerCase()}.html`);
  }

  async function faturarProposta(id: string) {
    setBusy(true);
    setError(null);
    setMsg(null);
    const res = await bffFetch(`/api/v1/crm/propostas/${id}/faturar`, {
      method: "POST",
      headers: { accept: "application/json" },
    });
    setBusy(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    const data = (await res.json()) as { id: string };
    setMsg("Fatura em rascunho criada.");
    await load();
    window.location.href = `/portal/crm/faturas/${data.id}`;
  }

  const COLS: Column<Proposta>[] = [
    {
      key: "codigo",
      header: "Proposta",
      sortable: true,
      sortValue: (p) => p.codigo,
      cell: (p) => (
        <Link href={withPortalFrom(`/portal/propostas/${p.id}`, pathname)} className="block hover:text-blue-300">
          <span className="font-medium text-slate-100">{p.codigo}</span>
          <p className="text-xs text-slate-500 mt-0.5">{p.titulo}</p>
          {p.curso && (
            <p className="text-xs text-slate-600 mt-0.5">{p.curso.designacao}</p>
          )}
        </Link>
      ),
    },
    {
      key: "entidadeCliente",
      header: "Entidade",
      sortable: true,
      sortValue: (p) => p.entidadeCliente.nome,
      cell: (p) => (
        <div className="text-sm">
          <p className="text-slate-300">{p.entidadeCliente.nome}</p>
          <p className="text-xs text-slate-500">NIF {p.entidadeCliente.nif}</p>
        </div>
      ),
    },
    {
      key: "valorCentavos",
      header: "Valor",
      sortable: true,
      hideOnMobile: true,
      sortValue: (p) => p.valorCentavos,
      cell: (p) => <span className="font-medium">{fmtEuro(p.valorCentavos)}</span>,
    },
    {
      key: "validadeAte",
      header: "Validade",
      sortable: true,
      hideOnMobile: true,
      sortValue: (p) => {
        if (!p.validadeAte) return null;
        const t = new Date(p.validadeAte).getTime();
        return Number.isFinite(t) ? t : null;
      },
      cell: (p) => <span className="text-sm text-slate-400">{fmtDate(p.validadeAte)}</span>,
    },
    {
      key: "estado",
      header: "Estado",
      headerText: "Estado",
      mobilePriority: true,
      headerFilterLabel:
        estadoFilter !== "TODAS" &&
        (["ACEITE", "REJEITADA", "ENVIADA", "RASCUNHO"] as const).includes(
          estadoFilter as "ACEITE" | "REJEITADA" | "ENVIADA" | "RASCUNHO",
        )
          ? propostaEstadoLabel(estadoFilter)
          : undefined,
      onHeaderClick: () => {
        const cycle = ["ACEITE", "REJEITADA", "ENVIADA", "RASCUNHO"] as const;
        pinTableInView();
        setPage(1);
        setEstadoFilter((prev) => {
          const idx = cycle.indexOf(prev as (typeof cycle)[number]);
          if (idx < 0) return cycle[0];
          return cycle[(idx + 1) % cycle.length];
        });
        setSort((prev) => (prev?.key === "estado" ? null : prev));
      },
      cell: (p) => <PropostaEstadoBadge estado={p.estado} />,
    },
    {
      key: "autoria",
      header: "Equipa comercial",
      sortable: true,
      hideOnMobile: true,
      sortValue: (p) =>
        p.criadoPor?.displayName?.trim() ||
        p.enviadaPor?.displayName?.trim() ||
        "",
      cell: (p) => (
        <span className="text-sm text-slate-300">{fmtPropostaAutoria(p.criadoPor, p.enviadaPor)}</span>
      ),
    },
  ];

  return (
    <>
      <CrmContextNav tabs={PROPOSTAS_NAV} ariaLabel="Secções Propostas" />
      <PageHeader
        title="Propostas comerciais"
        description={
          canManage
            ? "Orçamentos B2B com envio por email, aceitação e registo de facturação pipeline."
            : "Orçamentos B2B com envio por email e aceitação pelo cliente."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {canEditModeloPropostas ? (
              <Link href="/portal/propostas/config">
                <Button size="sm" variant="secondary">
                  Modelo padrão
                </Button>
              </Link>
            ) : null}
            {canManageCrm ? (
              <Button
                onClick={() => {
                  setForm((f) => ({ ...f, codigo: generatePropostaCodigo() }));
                  setCreateOpen(true);
                }}
                disabled={writeDisabled}
              >
                <Plus className="h-4 w-4" />
                Nova proposta
              </Button>
            ) : null}
          </div>
        }
      />

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}
      {msg && <Alert variant="success" className="mb-4">{msg}</Alert>}

      <CrmListFilters
        value={listFilters}
        onChange={setListFilters}
        gestor={canManage}
        searchPlaceholder="Pesquisar NIF ou nome da empresa…"
      />

      <div className="flex flex-wrap gap-2 mb-4 mt-5">
        {ESTADOS.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => setEstadoFilter(e)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              estadoFilter === e
                ? "bg-blue-600 text-white"
                : "bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700/50"
            }`}
          >
            {e === "TODAS" ? "Todas" : propostaEstadoLabel(e)}{" "}
            <span className="opacity-70">({counts[e] ?? 0})</span>
          </button>
        ))}
      </div>

      {entidadeFilter && (
        <Alert variant="info" className="mb-4">
          Filtro activo: entidade seleccionada.{" "}
          <button
            type="button"
            className="underline ml-1"
            onClick={() => {
              setEntidadeFilter("");
              window.history.replaceState({}, "", "/portal/propostas");
            }}
          >
            Limpar filtro
          </button>
        </Alert>
      )}

      <Card>
        <CardContent
          className={`p-0 transition-opacity ${refreshing ? "opacity-70 pointer-events-none" : ""}`}
        >
          <DataTable
            columns={COLS}
            data={propostas}
            keyField="id"
            loading={loading}
            fixedLayout
            sort={sort}
            disableClientSort
            getRowHref={(p) => withPortalFrom(`/portal/propostas/${p.id}`, pathname || "/portal/propostas")}
            onSortChange={(next) => {
              pinTableInView();
              setPage(1);
              setSort(next);
            }}
            emptyMessage="Sem propostas neste estado."
            rowActions={
              canManageCrm
                ? (p) => (
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void descarregarProposta(p.id, p.codigo)}
                        disabled={busy}
                        title="Descarregar documento HTML"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void imprimirProposta(p.id)}
                        disabled={busy}
                        title="Imprimir ou guardar PDF"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        PDF
                      </Button>
                      {podeEnviarProposta(p.estado) && (
                        <Button size="sm" onClick={() => openEnviar(p)} disabled={busy}>
                          <Send className="h-3.5 w-3.5" />
                          {p.estado === "RASCUNHO" ? "Enviar" : "Reenviar"}
                        </Button>
                      )}
                      {canManage && p.fatura ? (
                        <Button size="sm" variant="secondary" asChild>
                          <Link href={`/portal/crm/faturas/${p.fatura.id}`}>
                            <Receipt className="h-3.5 w-3.5" />
                            Ver fatura
                          </Link>
                        </Button>
                      ) : null}
                      {canManage && podeFaturarProposta(p) ? (
                        <Button
                          size="sm"
                          variant="teal"
                          onClick={() => void faturarProposta(p.id)}
                          disabled={busy}
                        >
                          <Receipt className="h-3.5 w-3.5" />
                          Faturar
                        </Button>
                      ) : null}
                      {canDeleteProposta ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy || writeDisabled}
                          onClick={() => setDeleteTarget(p)}
                          aria-label={`Eliminar proposta ${p.codigo}`}
                          title="Eliminar proposta"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-red-400" />
                        </Button>
                      ) : null}
                    </>
                  )
                : undefined
            }
          />
          <ListPaginationControls
            className="border-t border-slate-700/40 px-4 py-3"
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={(next) => {
              pinTableInView();
              setPage(next);
            }}
            onPageSizeChange={(next) => {
              pinTableInView();
              setPageSize(next);
            }}
            numberedPages
          />
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent
          title="Nova proposta"
          description="Criada em rascunho - envie ao cliente quando estiver pronta."
          className="max-w-2xl"
        >
          <form onSubmit={(e) => void criar(e)} className="grid min-w-0 gap-4">
            {entidades.length === 0 ? (
              <Alert variant="info">
                Registe primeiro um{" "}
                <Link href="/portal/clientes" className="font-medium text-blue-400 underline">
                  cliente B2B
                </Link>{" "}
                para associar à proposta.
              </Alert>
            ) : (
              <Select
                label="Entidade cliente *"
                required
                value={form.entidadeClienteId}
                onChange={(ev) => setForm((f) => ({ ...f, entidadeClienteId: ev.target.value }))}
              >
                {entidades.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nome} (NIF {e.nif})
                  </option>
                ))}
              </Select>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="Código"
                value={form.codigo}
                onChange={(ev) => setForm((f) => ({ ...f, codigo: ev.target.value }))}
                placeholder="Auto-gerado se vazio"
              />
              <Input
                label="Validade"
                type="date"
                value={form.validadeAte}
                onChange={(ev) => setForm((f) => ({ ...f, validadeAte: ev.target.value }))}
              />
            </div>
            <Input
              label="Título *"
              required
              value={form.titulo}
              onChange={(ev) => setForm((f) => ({ ...f, titulo: ev.target.value }))}
              placeholder="Formação em segurança no trabalho - 20 formandos"
            />
            <Textarea
              label="Descrição"
              value={form.descricao}
              onChange={(ev) => setForm((f) => ({ ...f, descricao: ev.target.value }))}
              rows={3}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="Valor global (€) - se não usar itens"
                type="number"
                min={0}
                step={0.01}
                value={form.valorEuros}
                onChange={(ev) => setForm((f) => ({ ...f, valorEuros: ev.target.value }))}
                placeholder="Opcional com linhas abaixo"
              />
              <Select
                label="Curso (opcional)"
                value={form.cursoId}
                onChange={(ev) => setForm((f) => ({ ...f, cursoId: ev.target.value }))}
              >
                <option value="">-</option>
                {cursos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.designacao}
                    {c.codigoUfcd ? ` · UFCD ${c.codigoUfcd}` : ""}
                  </option>
                ))}
              </Select>
            </div>
            <PropostaLinhasEditor compact linhas={linhas} onChange={setLinhas} />
            <div className="flex gap-2">
              <Button type="submit" disabled={busy || writeDisabled || !entidades.length}>
                {busy ? "A criar…" : "Criar rascunho"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={enviarOpen} onOpenChange={setEnviarOpen}>
        <DialogContent
          title={
            activeProposta?.estado === "RASCUNHO" ? "Enviar proposta" : "Reenviar proposta"
          }
          description={
            activeProposta
              ? `${activeProposta.codigo} - ${activeProposta.titulo}`
              : undefined
          }
        >
          <form onSubmit={(e) => void enviarProposta(e)} className="grid gap-4">
            <Input
              label="Email do destinatário *"
              type="email"
              required
              value={enviarEmail}
              onChange={(ev) => setEnviarEmail(ev.target.value)}
              placeholder="comercial@empresa.pt"
            />
            <p className="text-xs text-slate-500 flex items-start gap-2">
              <Mail className="h-4 w-4 shrink-0 mt-0.5" />
              {activeProposta?.estado === "RASCUNHO"
                ? "O cliente recebe um email com resumo e o documento da proposta em PDF. O estado passa para «Enviada»."
                : "O cliente recebe novamente o email com resumo e o PDF em anexo. O estado da proposta mantém-se."}
            </p>
            <div className="flex gap-2">
              <Button type="submit" disabled={busy}>
                <Send className="h-4 w-4" />
                {busy
                  ? "A enviar…"
                  : activeProposta?.estado === "RASCUNHO"
                    ? "Enviar proposta"
                    : "Reenviar proposta"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setEnviarOpen(false)}>Cancelar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent
          title="Eliminar proposta"
          description={
            deleteTarget
              ? `Eliminar «${deleteTarget.codigo} - ${deleteTarget.titulo}»? Esta acção é permanente.`
              : undefined
          }
        >
          <div className="space-y-4">
            {deleteTarget?.fatura ? (
              <Alert variant="error">
                Esta proposta tem fatura associada e não pode ser eliminada.
              </Alert>
            ) : (
              <p className="text-sm text-slate-400">
                O documento e o histórico desta proposta deixam de estar disponíveis na lista.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setDeleteTarget(null)}>
                Cancelar
              </Button>
              <Button
                type="button"
                variant="danger"
                disabled={busy || writeDisabled || Boolean(deleteTarget?.fatura)}
                onClick={() => void eliminarProposta()}
              >
                {busy ? "A eliminar…" : "Eliminar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
