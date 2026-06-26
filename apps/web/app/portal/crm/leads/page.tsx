"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Building2,
  FileText,
  Plus,
  Search,
  UserPlus,
  X,
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
  generateLeadCodigo,
  leadEstadoLabel,
  leadOrigemLabel,
  type LeadEstado,
  type LeadOrigem,
} from "@/lib/crm/shared";

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
  atribuido: { displayName: string } | null;
  updatedAt: string;
};

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
  "OUTRO",
];

const emptyForm = {
  codigo: "",
  empresaNome: "",
  contactoNome: "",
  email: "",
  telefone: "",
  nif: "",
  origem: "OUTRO" as LeadOrigem,
  valorEuros: "",
  notas: "",
};

export default function CrmLeadsPage() {
  const { canManageCrm } = useTenantRole();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [estadoFilter, setEstadoFilter] = useState<LeadEstado | "TODAS">("TODAS");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [perdidoOpen, setPerdidoOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [motivoPerda, setMotivoPerda] = useState("");
  const [convertNif, setConvertNif] = useState("");
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (estadoFilter !== "TODAS") params.set("estado", estadoFilter);
    if (search.trim()) params.set("q", search.trim());
    const q = params.toString() ? `?${params}` : "";
    const res = await bffFetch(`/api/v1/crm/leads${q}`, {
      headers: { accept: "application/json" },
    });
    setLoading(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      setLeads([]);
      return;
    }
    setLeads((await res.json()) as Lead[]);
  }, [estadoFilter, search]);

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

  const counts = useMemo(() => {
    const c: Record<string, number> = { TODAS: leads.length };
    for (const e of ESTADOS) {
      if (e !== "TODAS") c[e] = leads.filter((l) => l.estado === e).length;
    }
    return c;
  }, [leads]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const valorCentavos = form.valorEuros
      ? Math.round(parseFloat(form.valorEuros.replace(",", ".")) * 100)
      : 0;
    const res = await bffFetch("/api/v1/crm/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        codigo: form.codigo || undefined,
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
      key: "estado",
      header: "Estado",
      cell: (l) => (
        <div>
          <LeadEstadoBadge estado={l.estado} />
          {l.entidadeCliente ? (
            <Link
              href={`/portal/entidades/${l.entidadeCliente.id}`}
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
      <PageHeader
        title="Leads comerciais"
        description="Oportunidades antes de se tornarem entidades cliente e propostas."
        actions={
          <Button size="sm" onClick={() => {
            setForm({ ...emptyForm, codigo: generateLeadCodigo() });
            setCreateOpen(true);
          }}>
            <Plus className="h-3.5 w-3.5" />
            Novo lead
          </Button>
        }
      />

      {error ? <Alert variant="error">{error}</Alert> : null}
      {msg ? <Alert variant="success">{msg}</Alert> : null}

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900/80 border border-slate-700/60 text-sm text-slate-200"
            placeholder="Pesquisar empresa, email, código…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {ESTADOS.map((e) => (
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
        ))}
      </div>

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
                {l.estado === "CONVERTIDO" && l.entidadeCliente ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void criarProposta(l)}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Proposta
                  </Button>
                ) : null}
              </div>
            )}
          />
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent title="Novo lead">
          <form onSubmit={(e) => void onCreate(e)} className="space-y-3">
            <Input
              label="Empresa *"
              value={form.empresaNome}
              onChange={(e) => setForm((f) => ({ ...f, empresaNome: e.target.value }))}
              required
            />
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
    </div>
  );
}
