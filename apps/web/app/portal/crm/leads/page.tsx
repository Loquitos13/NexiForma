"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  Building2,
  FileText,
  Plus,
  UserPlus,
  X,
  Sparkles,
} from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { parseApiError } from "@/lib/ui/backoffice";
import { LeadEstadoBadge } from "@/components/crm/lead-estado-badge";
import {
  Alert,
  Badge,
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
  type Column,
} from "@/components/ui";
import {
  fmtEuro,
  fmtCrmAutor,
  generateLeadCodigo,
  leadEstadoLabel,
  leadOrigemLabel,
  type LeadEstado,
  type LeadOrigem,
} from "@/lib/crm/shared";
import { ContextSugestoesBadge, CrmSugestoesPanel } from "@/components/crm/crm-sugestoes-panel";
import { CrmContextNav, LEADS_NAV } from "@/components/crm/crm-context-nav";
import {
  CrmListFilters,
  crmListFiltersToParams,
  emptyCrmListFilters,
  type CrmListFiltersValue,
} from "@/components/crm/crm-list-filters";
import { withPortalFrom } from "@/lib/ui/portal-back-nav";
import { CrmContextInsights, useSugestoesPendentesPorLead } from "@/components/crm/entidade-crm-insights";
import { ListPagination } from "@/components/crm/list-pagination";
import { parsePaginatedList } from "@/lib/crm/paginated-list";
import { KanbanHelpLink, LeadsKanbanBoard } from "@/components/crm/leads-kanban";
import { LayoutGrid, List } from "lucide-react";

type Lead = {
  id: string;
  codigo: string;
  empresaNome: string;
  contactoNome: string | null;
  email: string | null;
  telefone: string | null;
  nif: string | null;
  origem: string;
  estado: string;
  valorEstimadoCentavos: number;
  notas: string | null;
  motivoPerda: string | null;
  entidadeCliente: { id: string; nome: string; nif: string } | null;
  criadoPor: { displayName: string } | null;
  atribuido: { displayName: string } | null;
  updatedAt: string;
};

function leadTemNifValido(nif: string | null | undefined): boolean {
  const digits = (nif ?? "").replace(/\D/g, "");
  if (digits.length !== 9) return false;
  let soma = 0;
  for (let i = 0; i < 8; i++) {
    soma += parseInt(digits[i]!, 10) * (9 - i);
  }
  const checkDigit = 11 - (soma % 11);
  const expectedDigit = checkDigit === 10 || checkDigit === 11 ? 0 : checkDigit;
  return parseInt(digits[8]!, 10) === expectedDigit;
}

function leadPodeCriarProposta(l: Lead): boolean {
  if (l.estado === "PERDIDO") return false;
  if (l.estado === "CONVERTIDO") return !!l.entidadeCliente;
  return leadTemNifValido(l.nif);
}

const ESTADOS: (LeadEstado | "TODAS")[] = [
  "TODAS",
  "NOVO",
  "CONTACTADO",
  "QUALIFICADO",
  "CONVERTIDO",
  "PERDIDO",
];

const ORIGENS: LeadOrigem[] = [
  "WEBSITE",
  "REFERRAL",
  "FEIRA",
  "LINKEDIN",
  "TELEFONE",
  "IA",
  "OUTRO",
];

const emptyForm = {
  codigo: "",
  entidadeClienteId: "",
  empresaNome: "",
  contactoNome: "",
  email: "",
  telefone: "",
  nif: "",
  origem: "OUTRO" as LeadOrigem,
  valorEuros: "",
  notas: "",
};

type ClienteOpt = {
  id: string;
  nome: string;
  nif: string;
  email: string | null;
  telefone: string | null;
};

const MANUAL_CLIENTE = "__manual__";

export default function CrmLeadsPage() {
  const pathname = usePathname();
  const { canManageCrm, canManage } = useTenantRole();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [estadoFilter, setEstadoFilter] = useState<LeadEstado | "TODAS">("TODAS");
  const [listFilters, setListFilters] = useState<CrmListFiltersValue>(emptyCrmListFilters);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({ TODAS: 0 });
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const pageSize = viewMode === "kanban" ? 200 : 50;
  const [createOpen, setCreateOpen] = useState(false);
  const [perdidoOpen, setPerdidoOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [notasOpen, setNotasOpen] = useState(false);
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const sugestoesPorLead = useSugestoesPendentesPorLead();
  const [motivoPerda, setMotivoPerda] = useState("");
  const [convertNif, setConvertNif] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [clientes, setClientes] = useState<ClienteOpt[]>([]);

  const loadClientes = useCallback(async () => {
    const res = await bffFetch("/api/v1/entidades-cliente", { headers: { accept: "application/json" } });
    if (res.ok) setClientes((await res.json()) as ClienteOpt[]);
  }, []);

  useEffect(() => {
    if (createOpen) void loadClientes();
  }, [createOpen, loadClientes]);

  function seleccionarCliente(clienteId: string) {
    if (!clienteId) {
      setForm((f) => ({
        ...f,
        entidadeClienteId: "",
        empresaNome: "",
        email: "",
        telefone: "",
        nif: "",
      }));
      return;
    }
    if (clienteId === MANUAL_CLIENTE) {
      setForm((f) => ({
        ...f,
        entidadeClienteId: MANUAL_CLIENTE,
        empresaNome: "",
        email: "",
        telefone: "",
        nif: "",
      }));
      return;
    }
    const c = clientes.find((x) => x.id === clienteId);
    if (!c) return;
    setForm((f) => ({
      ...f,
      entidadeClienteId: c.id,
      empresaNome: c.nome,
      email: c.email ?? "",
      telefone: c.telefone ?? "",
      nif: c.nif,
    }));
  }

  const empresaManual =
    form.entidadeClienteId === MANUAL_CLIENTE || form.entidadeClienteId === "";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = crmListFiltersToParams(listFilters, canManage, {
      estado: estadoFilter !== "TODAS" ? estadoFilter : undefined,
      page: String(page),
      pageSize: String(pageSize),
    });
    const q = params.toString() ? `?${params}` : "";
    const res = await bffFetch(`/api/v1/crm/leads${q}`, {
      headers: { accept: "application/json" },
    });
    setLoading(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      setLeads([]);
      setTotal(0);
      return;
    }
    const data = parsePaginatedList<Lead>(await res.json());
    setLeads(data.items);
    setTotal(data.total);
    if (data.countsByEstado) setCounts(data.countsByEstado);
  }, [estadoFilter, listFilters, canManage, page, viewMode]);

  useEffect(() => {
    setPage(1);
  }, [estadoFilter, listFilters]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("nova") === "1" && canManageCrm) {
      setForm({ ...emptyForm, codigo: generateLeadCodigo() });
      setCreateOpen(true);
    }
  }, [canManageCrm]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!form.empresaNome.trim()) {
      setError("Seleccione um cliente ou indique o nome da empresa.");
      return;
    }
    setBusy(true);
    setError(null);
    const valorCentavos = form.valorEuros
      ? Math.round(parseFloat(form.valorEuros.replace(",", ".")) * 100)
      : 0;
    const entidadeId =
      form.entidadeClienteId &&
      form.entidadeClienteId !== MANUAL_CLIENTE
        ? form.entidadeClienteId
        : undefined;
    const res = await bffFetch("/api/v1/crm/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        codigo: form.codigo || undefined,
        entidadeClienteId: entidadeId,
        empresaNome: form.empresaNome,
        contactoNome: form.contactoNome || undefined,
        email: form.email || undefined,
        telefone: form.telefone || undefined,
        nif: form.nif || undefined,
        origem: form.origem,
        valorEstimadoCentavos: Number.isFinite(valorCentavos) ? valorCentavos : 0,
        notas: form.notas || undefined,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    setCreateOpen(false);
    setForm(emptyForm);
    setMsg("Lead registado.");
    await load();
  }

  async function avancarEstado(lead: Lead, estado: LeadEstado) {
    setBusy(true);
    const res = await bffFetch(`/api/v1/crm/leads/${lead.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ estado }),
    });
    setBusy(false);
    if (!res.ok) setError(await parseApiError(res));
    else await load();
  }

  async function confirmarPerdido() {
    if (!activeLead) return;
    setBusy(true);
    const res = await bffFetch(`/api/v1/crm/leads/${activeLead.id}/perdido`, {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ motivo: motivoPerda || undefined }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    setPerdidoOpen(false);
    setMotivoPerda("");
    setActiveLead(null);
    setMsg("Lead marcado como perdido.");
    await load();
  }

  async function confirmarConverter() {
    if (!activeLead) return;
    setBusy(true);
    const res = await bffFetch(`/api/v1/crm/leads/${activeLead.id}/converter`, {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        nif: convertNif || activeLead.nif || undefined,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    const data = (await res.json()) as { entidade: { id: string; nome: string } };
    setConvertOpen(false);
    setConvertNif("");
    setActiveLead(null);
    setMsg(`Convertido em entidade «${data.entidade.nome}».`);
    await load();
  }

  async function criarProposta(lead: Lead) {
    setBusy(true);
    const res = await bffFetch(`/api/v1/crm/leads/${lead.id}/proposta`, {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({}),
    });
    setBusy(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    const data = (await res.json()) as { proposta: { id: string; codigo: string } };
    setMsg(`Proposta ${data.proposta.codigo} criada.`);
    await load();
  }

  const COLS: Column<Lead>[] = [
    {
      key: "empresa",
      header: "Empresa / contacto",
      cell: (l) => (
        <div>
          <span className="font-medium text-slate-100">{l.empresaNome}</span>
          <ContextSugestoesBadge count={sugestoesPorLead[l.id] ?? 0} />
          <p className="text-xs text-slate-500 mt-0.5">{l.codigo}</p>
          {l.contactoNome ? (
            <p className="text-xs text-slate-400">{l.contactoNome}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: "contacto",
      header: "Contacto",
      cell: (l) => (
        <div className="text-sm text-slate-300">
          {l.email ? <p>{l.email}</p> : null}
          {l.telefone ? <p className="text-slate-500">{l.telefone}</p> : null}
          {!l.email && !l.telefone ? <span className="text-slate-600">-</span> : null}
        </div>
      ),
    },
    {
      key: "origem",
      header: "Origem",
      cell: (l) => (
        <span className="text-sm text-slate-400">{leadOrigemLabel(l.origem)}</span>
      ),
    },
    {
      key: "valor",
      header: "Valor est.",
      cell: (l) => (
        <span className="tabular-nums text-slate-200">
          {l.valorEstimadoCentavos > 0 ? fmtEuro(l.valorEstimadoCentavos) : "-"}
        </span>
      ),
    },
    {
      key: "criadoPor",
      header: "Registado por",
      cell: (l) => (
        <span className="text-sm text-slate-300">{fmtCrmAutor(l.criadoPor)}</span>
      ),
    },
    {
      key: "atribuido",
      header: "Responsável",
      cell: (l) => (
        <span className="text-sm text-slate-400">{fmtCrmAutor(l.atribuido)}</span>
      ),
    },
    {
      key: "estado",
      header: "Estado",
      cell: (l) => (
        <div>
          <LeadEstadoBadge estado={l.estado} />
          {l.entidadeCliente ? (
            <Link
              href={withPortalFrom(`/portal/clientes/${l.entidadeCliente.id}?tab=leads`, pathname)}
              className="text-[10px] text-blue-400/90 mt-1 block hover:underline"
            >
              {l.entidadeCliente.nome}
            </Link>
          ) : null}
        </div>
      ),
    },
  ];

  if (!canManageCrm) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold text-slate-50">Leads</h1>
        <p className="text-sm text-slate-400 mt-2">Sem permissão para o módulo CRM.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <CrmContextNav tabs={LEADS_NAV} ariaLabel="Secções Leads" />
      <PageHeader
        title="Leads comerciais"
        description="Oportunidades antes de se tornarem entidades cliente e propostas."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={viewMode === "list" ? "secondary" : "ghost"}
              onClick={() => setViewMode("list")}
              aria-pressed={viewMode === "list"}
            >
              <List className="h-3.5 w-3.5" /> Lista
            </Button>
            <Button
              size="sm"
              variant={viewMode === "kanban" ? "secondary" : "ghost"}
              onClick={() => {
                setViewMode("kanban");
                setEstadoFilter("TODAS");
              }}
              aria-pressed={viewMode === "kanban"}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Kanban
            </Button>
            <Button size="sm" onClick={() => {
            setForm({ ...emptyForm, codigo: generateLeadCodigo() });
            setCreateOpen(true);
          }}>
            <Plus className="h-3.5 w-3.5" />
            Novo lead
          </Button>
          </div>
        }
      />

      <CrmSugestoesPanel context="leads" />

      {error ? <Alert variant="error">{error}</Alert> : null}
      {msg ? <Alert variant="success">{msg}</Alert> : null}

      <div className="flex flex-wrap gap-3 items-center">
        <CrmListFilters
          value={listFilters}
          onChange={setListFilters}
          gestor={canManage}
          searchPlaceholder="Pesquisar NIF, empresa, email ou código…"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {viewMode === "list"
          ? ESTADOS.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => setEstadoFilter(e)}
            className={`rounded-xl px-3 py-1.5 text-sm border transition-colors ${
              estadoFilter === e
                ? "border-blue-500/40 bg-blue-500/10 text-blue-300"
                : "border-slate-700/50 text-slate-400 hover:border-slate-600"
            }`}
          >
            {e === "TODAS" ? "Todas" : leadEstadoLabel(e)}{" "}
            <Badge variant="default" className="ml-1 text-[10px]">
              {counts[e] ?? 0}
            </Badge>
          </button>
        ))
          : null}
      </div>

      {viewMode === "kanban" ? (
        <>
          <KanbanHelpLink />
          <LeadsKanbanBoard
            leads={leads}
            onMoved={() => void load()}
            onSelect={(l) => {
              setActiveLead(l as Lead);
              setNotasOpen(true);
            }}
          />
        </>
      ) : (
      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={COLS}
            data={leads}
            keyField="id"
            loading={loading}
            emptyMessage="Sem leads - registe a primeira oportunidade comercial."
            rowActions={(l) => (
              <div className="flex flex-wrap justify-end gap-1">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => {
                    setActiveLead(l);
                    setNotasOpen(true);
                  }}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Notas & IA
                </Button>
                {l.estado === "NOVO" ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => void avancarEstado(l, "CONTACTADO")}
                  >
                    Contactado
                  </Button>
                ) : null}
                {l.estado === "CONTACTADO" ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => void avancarEstado(l, "QUALIFICADO")}
                  >
                    Qualificar
                  </Button>
                ) : null}
                {l.estado !== "CONVERTIDO" && l.estado !== "PERDIDO" ? (
                  <>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => {
                        setActiveLead(l);
                        setConvertNif(l.nif ?? "");
                        setConvertOpen(true);
                      }}
                    >
                      <Building2 className="h-3.5 w-3.5" />
                      Converter
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => {
                        setActiveLead(l);
                        setPerdidoOpen(true);
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </>
                ) : null}
                {leadPodeCriarProposta(l) ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void criarProposta(l)}
                    title={
                      l.estado !== "CONVERTIDO"
                        ? "A conversão em cliente ocorre automaticamente quando o cliente aceitar a proposta"
                        : undefined
                    }
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Proposta
                  </Button>
                ) : null}
              </div>
            )}
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
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent title="Novo lead">
          <form onSubmit={(e) => void onCreate(e)} className="space-y-3">
            <Select
              label="Cliente *"
              value={form.entidadeClienteId}
              onChange={(e) => seleccionarCliente(e.target.value)}
              required
            >
              <option value="">- Seleccionar cliente -</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome} (NIF {c.nif})
                </option>
              ))}
              <option value={MANUAL_CLIENTE}>Outra empresa (manual)</option>
            </Select>
            {empresaManual ? (
              <Input
                label="Empresa *"
                value={form.empresaNome}
                onChange={(e) => setForm((f) => ({ ...f, empresaNome: e.target.value }))}
                required
              />
            ) : (
              <p className="text-sm text-slate-400 rounded-lg bg-slate-800/50 px-3 py-2">
                <span className="text-slate-200 font-medium">{form.empresaNome}</span>
                {form.nif ? <span className="text-slate-500"> · NIF {form.nif}</span> : null}
              </p>
            )}
            <Input
              label="Contacto"
              value={form.contactoNome}
              onChange={(e) => setForm((f) => ({ ...f, contactoNome: e.target.value }))}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
              <Input
                label="Telefone"
                value={form.telefone}
                onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="NIF (opcional)"
                value={form.nif}
                onChange={(e) =>
                  setForm((f) => ({ ...f, nif: e.target.value.replace(/\D/g, "").slice(0, 9) }))
                }
                maxLength={9}
              />
              <Select
                label="Origem"
                value={form.origem}
                onChange={(e) =>
                  setForm((f) => ({ ...f, origem: e.target.value as LeadOrigem }))
                }
              >
                {ORIGENS.map((o) => (
                  <option key={o} value={o}>
                    {leadOrigemLabel(o)}
                  </option>
                ))}
              </Select>
            </div>
            <Input
              label="Valor estimado (€)"
              value={form.valorEuros}
              onChange={(e) => setForm((f) => ({ ...f, valorEuros: e.target.value }))}
              placeholder="0,00"
            />
            <Textarea
              label="Notas"
              value={form.notas}
              onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
              rows={3}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={busy}>
                Guardar lead
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={perdidoOpen} onOpenChange={setPerdidoOpen}>
        <DialogContent title="Marcar como perdido">
          <Textarea
            label="Motivo (opcional)"
            value={motivoPerda}
            onChange={(e) => setMotivoPerda(e.target.value)}
            rows={3}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setPerdidoOpen(false)}>
              Cancelar
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => void confirmarPerdido()}>
              Confirmar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={convertOpen} onOpenChange={setConvertOpen}>
        <DialogContent title="Converter em entidade cliente">
          <p className="text-sm text-slate-400 mb-3">
            Cria ou actualiza uma entidade B2B a partir deste lead. O NIF é obrigatório.
          </p>
          <Input
            label="NIF *"
            value={convertNif}
            onChange={(e) => setConvertNif(e.target.value.replace(/\D/g, "").slice(0, 9))}
            maxLength={9}
            required
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setConvertOpen(false)}>
              Cancelar
            </Button>
            <Button disabled={busy || convertNif.length !== 9} onClick={() => void confirmarConverter()}>
              <UserPlus className="h-3.5 w-3.5" />
              Converter
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={notasOpen} onOpenChange={setNotasOpen}>
        <DialogContent
          title={activeLead ? `Notas & sugestões - ${activeLead.empresaNome}` : "Notas comerciais"}
          description="Regista a reunião; a IA gera sugestões automaticamente neste lead."
          className="max-w-3xl max-h-[90vh] overflow-y-auto"
        >
          {activeLead ? (
            <CrmContextInsights
              leadComercialId={activeLead.id}
              contextoNome={activeLead.empresaNome}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
