"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { parseApiError } from "@/lib/ui/backoffice";
import { CrmContextNav, NOTAS_NAV } from "@/components/crm/crm-context-nav";
import {
  CrmListFilters,
  crmListFiltersToParams,
  emptyCrmListFilters,
  type CrmListFiltersValue,
} from "@/components/crm/crm-list-filters";
import { ListPagination } from "@/components/crm/list-pagination";
import { parsePaginatedList } from "@/lib/crm/paginated-list";
import { withPortalFrom } from "@/lib/ui/portal-back-nav";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  PageHeader,
  Select,
  Textarea,
} from "@/components/ui";
import { fmtDate } from "@/lib/crm/shared";

type ClienteOpt = { id: string; nome: string; nif: string };
type LeadOpt = { id: string; codigo: string; empresaNome: string };
type UserOpt = { id: string; displayName: string; email: string; role: string };

const AUDIENCIA_ROLES = ["COMERCIAL", "FORMADOR", "FINANCEIRO", "COORDENADOR"] as const;
const AUDIENCIA_LABELS: Record<(typeof AUDIENCIA_ROLES)[number], string> = {
  COMERCIAL: "Comerciais",
  FORMADOR: "Formadores",
  FINANCEIRO: "Financeiro",
  COORDENADOR: "Coordenação",
};

type Interaccao = {
  id: string;
  tipo: string;
  titulo: string | null;
  resumoIa: string | null;
  processamentoEstado: string;
  processamentoEngine: string | null;
  createdAt: string;
  entidadeCliente: { id: string; nome: string } | null;
  leadComercial: { id: string; codigo: string; empresaNome: string } | null;
  criadoPor?: { displayName: string } | null;
  sugestoesIa: Array<{ id: string; titulo: string; estado: string }>;
};

const TIPOS = ["REUNIAO", "TELEFONE", "EMAIL", "NOTA", "OUTRO"] as const;

const emptyForm = {
  tipo: "REUNIAO" as (typeof TIPOS)[number],
  titulo: "",
  contexto: "",
  situacaoActual: "",
  dorNecessidade: "",
  orcamentoTiming: "",
  decisor: "",
  proximoPassoNota: "",
  notasLivres: "",
  entidadeClienteId: "",
  leadComercialId: "",
  agendadoPara: "",
  agendadoFim: "",
  audienciaRoles: [] as string[],
  participantesIds: [] as string[],
};

export default function CrmInteraccoesPage() {
  const pathname = usePathname();
  const { canManageCrm, canManage } = useTenantRole();
  const [items, setItems] = useState<Interaccao[]>([]);
  const [clientes, setClientes] = useState<ClienteOpt[]>([]);
  const [leads, setLeads] = useState<LeadOpt[]>([]);
  const [staff, setStaff] = useState<UserOpt[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [listFilters, setListFilters] = useState<CrmListFiltersValue>(emptyCrmListFilters);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 50;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = crmListFiltersToParams(listFilters, canManage, {
      page: String(page),
      pageSize: String(pageSize),
    });
    const q = params.toString() ? `?${params}` : "";
    const [iRes, cRes, lRes, uRes] = await Promise.all([
      bffFetch(`/api/v1/crm/interaccoes${q}`, { headers: { accept: "application/json" } }),
      bffFetch("/api/v1/entidades-cliente", { headers: { accept: "application/json" } }),
      bffFetch("/api/v1/crm/leads?pageSize=100", { headers: { accept: "application/json" } }),
      canManage
        ? bffFetch("/api/v1/users", { headers: { accept: "application/json" } })
        : Promise.resolve(null),
    ]);
    setLoading(false);
    if (iRes.ok) {
      const data = parsePaginatedList<Interaccao>(await iRes.json());
      setItems(data.items);
      setTotal(data.total);
    } else setError(await parseApiError(iRes));
    if (cRes.ok) setClientes((await cRes.json()) as ClienteOpt[]);
    if (lRes.ok) {
      const leadsData = parsePaginatedList<LeadOpt>(await lRes.json());
      setLeads(leadsData.items);
    }
    if (uRes?.ok) setStaff((await uRes.json()) as UserOpt[]);
  }, [listFilters, canManage, page]);

  useEffect(() => {
    setPage(1);
  }, [listFilters]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canManageCrm) return;
    if (!form.entidadeClienteId && !form.leadComercialId) {
      setError("Seleccione um cliente ou um lead.");
      return;
    }
    setBusy(true);
    setError(null);
    setMsg(null);
    const res = await bffFetch("/api/v1/crm/interaccoes", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        tipo: form.tipo,
        titulo: form.titulo.trim() || undefined,
        contexto: form.contexto.trim() || undefined,
        situacaoActual: form.situacaoActual.trim() || undefined,
        dorNecessidade: form.dorNecessidade.trim() || undefined,
        orcamentoTiming: form.orcamentoTiming.trim() || undefined,
        decisor: form.decisor.trim() || undefined,
        proximoPassoNota: form.proximoPassoNota.trim() || undefined,
        notasLivres: form.notasLivres.trim() || undefined,
        entidadeClienteId: form.entidadeClienteId || undefined,
        leadComercialId: form.leadComercialId || undefined,
        agendadoPara: form.agendadoPara ? new Date(form.agendadoPara).toISOString() : undefined,
        agendadoFim: form.agendadoFim ? new Date(form.agendadoFim).toISOString() : undefined,
        ...(form.tipo === "REUNIAO" && canManage
          ? {
              audienciaRoles: form.audienciaRoles.length ? form.audienciaRoles : undefined,
              participantesIds: form.participantesIds.length ? form.participantesIds : undefined,
            }
          : {}),
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    setForm(emptyForm);
    setFormOpen(false);
    setMsg("Nota registada - a análise e sugestões aparecem em breve.");
    void load();
  }

  async function reprocessar(id: string) {
    setBusy(true);
    const res = await bffFetch(`/api/v1/crm/interaccoes/${id}/reprocessar`, {
      method: "POST",
      headers: { accept: "application/json" },
    });
    setBusy(false);
    if (!res.ok) setError(await parseApiError(res));
    else void load();
  }

  return (
    <>
      <CrmContextNav tabs={NOTAS_NAV} ariaLabel="Secções Notas comerciais" />

      <PageHeader
        title="Notas comerciais"
        description="Todos os registos de reuniões e contactos comerciais do tenant."
        actions={
          canManageCrm ? (
            <Button size="sm" onClick={() => setFormOpen((v) => !v)}>
              <Sparkles className="h-3.5 w-3.5" />
              {formOpen ? "Fechar formulário" : "Nova nota"}
            </Button>
          ) : null
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

      <div className="space-y-3 mb-8 mt-5">
        {loading ? (
          <p className="text-sm text-slate-500">A carregar…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-slate-500">Sem notas comerciais registadas.</p>
        ) : (
          items.map((item) => {
            const clienteHref = item.entidadeCliente
              ? withPortalFrom(
                  `/portal/clientes/${item.entidadeCliente.id}?tab=notas-comerciais`,
                  pathname,
                )
              : null;
            return (
              <Card key={item.id}>
                <CardContent className="pt-5 space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-100">
                        {item.titulo || item.tipo}{" "}
                        <span className="text-slate-500 font-normal">· {fmtDate(item.createdAt)}</span>
                      </p>
                      {clienteHref ? (
                        <Link href={clienteHref} className="text-sm text-violet-400 hover:underline">
                          {item.entidadeCliente!.nome}
                        </Link>
                      ) : (
                        <p className="text-sm text-slate-400">
                          {item.leadComercial?.empresaNome ?? "-"}
                        </p>
                      )}
                      {item.criadoPor ? (
                        <p className="text-xs text-slate-500">
                          Registado por {item.criadoPor.displayName}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge
                        variant={
                          item.processamentoEstado === "PROCESSADO"
                            ? "green"
                            : item.processamentoEstado === "ERRO"
                              ? "red"
                              : "yellow"
                        }
                      >
                        {item.processamentoEstado}
                      </Badge>
                      {canManageCrm ? (
                        <Button size="sm" variant="ghost" disabled={busy} onClick={() => void reprocessar(item.id)}>
                          <RefreshCw className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  {item.resumoIa ? (
                    <p className="text-sm text-slate-300 border-l-2 border-violet-500/50 pl-3">{item.resumoIa}</p>
                  ) : null}
                  {item.sugestoesIa.length > 0 ? (
                    <p className="text-xs text-violet-400">
                      {item.sugestoesIa.filter((s) => s.estado === "PENDENTE").length} sugestão(ões) IA ·{" "}
                      <Link href="/portal/crm/sugestoes-ia" className="underline">
                        ver sugestões
                      </Link>
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <ListPagination
        className="mb-8"
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
      />

      {canManageCrm && formOpen ? (
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Cliente</label>
                  <Select
                    value={form.entidadeClienteId}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, entidadeClienteId: e.target.value, leadComercialId: "" }))
                    }
                  >
                    <option value="">- seleccionar -</option>
                    {clientes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome} ({c.nif})
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Ou lead</label>
                  <Select
                    value={form.leadComercialId}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, leadComercialId: e.target.value, entidadeClienteId: "" }))
                    }
                  >
                    <option value="">- seleccionar -</option>
                    {leads.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.codigo} - {l.empresaNome}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Tipo</label>
                  <Select
                    value={form.tipo}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, tipo: e.target.value as (typeof TIPOS)[number] }))
                    }
                  >
                    {TIPOS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Título</label>
                  <Input
                    value={form.titulo}
                    onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                    placeholder="Ex.: Follow-up formação Q3"
                  />
                </div>
              </div>
              {form.tipo === "REUNIAO" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs text-slate-400">Agendada para</label>
                    <Input
                      type="datetime-local"
                      value={form.agendadoPara}
                      onChange={(e) => setForm((f) => ({ ...f, agendadoPara: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-400">Fim (opcional)</label>
                    <Input
                      type="datetime-local"
                      value={form.agendadoFim}
                      onChange={(e) => setForm((f) => ({ ...f, agendadoFim: e.target.value }))}
                    />
                  </div>
                </div>
              ) : null}
              {form.tipo === "REUNIAO" && canManage ? (
                <div className="space-y-3 rounded-lg border border-slate-700/60 bg-slate-900/40 p-3">
                  <p className="text-xs font-medium text-slate-300">Convidados da reunião</p>
                  <div className="flex flex-wrap gap-3">
                    {AUDIENCIA_ROLES.map((role) => (
                      <label key={role} className="flex items-center gap-2 text-xs text-slate-400">
                        <input
                          type="checkbox"
                          checked={form.audienciaRoles.includes(role)}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              audienciaRoles: e.target.checked
                                ? [...f.audienciaRoles, role]
                                : f.audienciaRoles.filter((r) => r !== role),
                            }))
                          }
                          className="rounded border-slate-600"
                        />
                        {AUDIENCIA_LABELS[role]}
                      </label>
                    ))}
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-400">
                      Ou seleccione pessoas específicas
                    </label>
                    <select
                      multiple
                      value={form.participantesIds}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          participantesIds: Array.from(e.target.selectedOptions).map((o) => o.value),
                        }))
                      }
                      className="min-h-[88px] w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200"
                    >
                      {staff
                        .filter((u) => u.role !== "FORMANDO")
                        .map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.displayName} ({u.role})
                          </option>
                        ))}
                    </select>
                    <p className="mt-1 text-[10px] text-slate-500">
                      Se não seleccionar perfis nem pessoas, notificam-se os comerciais por defeito.
                    </p>
                  </div>
                </div>
              ) : null}
              {(
                [
                  ["contexto", "Contexto (participantes, tipo de reunião)"],
                  ["situacaoActual", "Situação actual do cliente"],
                  ["dorNecessidade", "Dor / necessidade"],
                  ["orcamentoTiming", "Orçamento / timing"],
                  ["decisor", "Decisor / influenciadores"],
                  ["proximoPassoNota", "Próximo passo acordado"],
                  ["notasLivres", "Notas livres / transcrição"],
                ] as const
              ).map(([key, label]) => (
                <div key={key}>
                  <label className="mb-1 block text-xs text-slate-400">{label}</label>
                  <Textarea
                    rows={key === "notasLivres" ? 4 : 2}
                    value={form[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}
              <Button type="submit" disabled={busy}>
                <Sparkles className="h-4 w-4" />
                Guardar e processar com IA
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
