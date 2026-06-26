"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  Download,
  FileText,
  Mail,
  Plus,
  Receipt,
  Send,
  X,
} from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { downloadResponseAsFile } from "@/lib/client/download-response";
import { openHtmlForPrint } from "@/lib/client/open-html-for-print";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { parseApiError } from "@/lib/ui/backoffice";
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
  type Column,
} from "@/components/ui";
import { PropostaEstadoBadge } from "@/components/crm/proposta-estado-badge";
import {
  fmtDate,
  fmtEuro,
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
  entidadeCliente: { id: string; nome: string; nif: string; email: string | null };
  curso: { designacao: string } | null;
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

export default function PropostasPage() {
  const { canManageCrm } = useTenantRole();
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
  const [rejeitarOpen, setRejeitarOpen] = useState(false);
  const [activeProposta, setActiveProposta] = useState<Proposta | null>(null);
  const [enviarEmail, setEnviarEmail] = useState("");
  const [rejeitarMotivo, setRejeitarMotivo] = useState("");
  const [form, setForm] = useState({
    entidadeClienteId: "",
    codigo: "",
    titulo: "",
    descricao: "",
    valorEuros: "",
    validadeAte: "",
    cursoId: "",
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ent = params.get("entidade");
    const est = params.get("estado");
    const nova = params.get("nova");
    if (ent) setEntidadeFilter(ent);
    if (est && ESTADOS.includes(est as PropostaEstado | "TODAS")) setEstadoFilter(est);
    if (nova === "1" && canManageCrm) {
      setForm((f) => ({ ...f, codigo: generatePropostaCodigo() }));
      setCreateOpen(true);
    }
  }, [canManageCrm]);

  const load = useCallback(async () => {
    setLoading(true);
    const q = entidadeFilter ? `?entidadeClienteId=${entidadeFilter}` : "";
    const [pRes, eRes, cRes] = await Promise.all([
      bffFetch(`/api/v1/propostas${q}`, { headers: { accept: "application/json" } }),
      bffFetch("/api/v1/entidades-cliente", { headers: { accept: "application/json" } }),
      bffFetch("/api/v1/cursos", { headers: { accept: "application/json" } }),
    ]);
    if (!pRes.ok) setError(await parseApiError(pRes));
    else setPropostas((await pRes.json()) as Proposta[]);
    if (eRes.ok) {
      const ents = (await eRes.json()) as EntidadeOpt[];
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
    setLoading(false);
  }, [entidadeFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (estadoFilter === "TODAS") return propostas;
    return propostas.filter((p) => p.estado === estadoFilter);
  }, [propostas, estadoFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { TODAS: propostas.length };
    for (const e of ESTADOS) {
      if (e !== "TODAS") c[e] = propostas.filter((p) => p.estado === e).length;
    }
    return c;
  }, [propostas]);

  async function criar(e: FormEvent) {
    e.preventDefault();
    if (!canManageCrm) return;
    setBusy(true);
    setMsg(null);
    setError(null);
    const euros = Number(form.valorEuros.replace(",", ".")) || 0;
    const res = await bffFetch("/api/v1/propostas", {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        entidadeClienteId: form.entidadeClienteId,
        codigo: form.codigo.trim() || undefined,
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim() || undefined,
        valorCentavos: Math.round(euros * 100),
        validadeAte: form.validadeAte || undefined,
        cursoId: form.cursoId || undefined,
      }),
    });
    if (!res.ok) setError(await parseApiError(res));
    else {
      setMsg("Proposta criada em rascunho.");
      setCreateOpen(false);
      setForm((f) => ({
        ...f,
        codigo: generatePropostaCodigo(),
        titulo: "",
        descricao: "",
        valorEuros: "",
        validadeAte: "",
        cursoId: "",
      }));
      await load();
    }
    setBusy(false);
  }

  function openEnviar(p: Proposta) {
    setActiveProposta(p);
    setEnviarEmail(p.entidadeCliente.email ?? "");
    setEnviarOpen(true);
  }

  function openRejeitar(p: Proposta) {
    setActiveProposta(p);
    setRejeitarMotivo("");
    setRejeitarOpen(true);
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
    setMsg("Proposta enviada por email ao cliente.");
    setEnviarOpen(false);
    setActiveProposta(null);
    await load();
  }

  async function aceitarProposta(id: string) {
    setBusy(true);
    setError(null);
    const res = await bffFetch(`/api/v1/propostas/${id}/aceitar`, {
      method: "POST",
      headers: { accept: "application/json" },
    });
    setBusy(false);
    if (!res.ok) setError(await parseApiError(res));
    else {
      setMsg("Proposta marcada como aceite.");
      await load();
    }
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

  async function rejeitarProposta(e: FormEvent) {
    e.preventDefault();
    if (!activeProposta) return;
    setBusy(true);
    setError(null);
    const res = await bffFetch(`/api/v1/propostas/${activeProposta.id}/rejeitar`, {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ motivo: rejeitarMotivo.trim() || undefined }),
    });
    setBusy(false);
    if (!res.ok) setError(await parseApiError(res));
    else {
      setMsg("Proposta rejeitada.");
      setRejeitarOpen(false);
      setActiveProposta(null);
      await load();
    }
  }

  const COLS: Column<Proposta>[] = [
    {
      key: "codigo",
      header: "Proposta",
      cell: (p) => (
        <div>
          <span className="font-medium text-slate-100">{p.codigo}</span>
          <p className="text-xs text-slate-500 mt-0.5">{p.titulo}</p>
          {p.curso && (
            <p className="text-xs text-slate-600 mt-0.5">{p.curso.designacao}</p>
          )}
        </div>
      ),
    },
    {
      key: "entidadeCliente",
      header: "Entidade",
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
      cell: (p) => <span className="font-medium">{fmtEuro(p.valorCentavos)}</span>,
    },
    {
      key: "validadeAte",
      header: "Validade",
      cell: (p) => <span className="text-sm text-slate-400">{fmtDate(p.validadeAte)}</span>,
    },
    {
      key: "estado",
      header: "Estado",
      cell: (p) => <PropostaEstadoBadge estado={p.estado} />,
    },
  ];

  return (
    <>
      <PageHeader
        title="Propostas comerciais"
        description="Orçamentos B2B com envio por email, aceitação e registo de facturação pipeline."
        actions={
          canManageCrm && entidades.length ? (
            <Button
              onClick={() => {
                setForm((f) => ({ ...f, codigo: generatePropostaCodigo() }));
                setCreateOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Nova proposta
            </Button>
          ) : null
        }
      />

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}
      {msg && <Alert variant="success" className="mb-4">{msg}</Alert>}

      <div className="flex flex-wrap gap-2 mb-4">
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
        <CardContent className="p-0">
          <DataTable
            columns={COLS}
            data={filtered}
            keyField="id"
            loading={loading}
            emptyMessage="Sem propostas neste estado."
            rowActions={
              canManageCrm
                ? (p) => (
                    <div className="flex justify-end gap-1 flex-wrap">
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
                      {p.estado === "RASCUNHO" && (
                        <Button size="sm" onClick={() => openEnviar(p)} disabled={busy}>
                          <Send className="h-3.5 w-3.5" />
                          Enviar
                        </Button>
                      )}
                      {p.estado === "ENVIADA" && (
                        <>
                          <Button size="sm" variant="teal" onClick={() => void aceitarProposta(p.id)} disabled={busy}>
                            <Check className="h-3.5 w-3.5" />
                            Aceitar
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => openRejeitar(p)} disabled={busy}>
                            <X className="h-3.5 w-3.5" />
                            Rejeitar
                          </Button>
                        </>
                      )}
                      {p.estado === "ACEITE" && (
                        p.fatura ? (
                          <Button size="sm" variant="secondary" asChild>
                            <a href="/portal/crm/faturas">
                              <Receipt className="h-3.5 w-3.5" />
                              Ver fatura
                            </a>
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="teal"
                            onClick={() => void faturarProposta(p.id)}
                            disabled={busy}
                          >
                            <Receipt className="h-3.5 w-3.5" />
                            Faturar
                          </Button>
                        )
                      )}
                    </div>
                  )
                : undefined
            }
          />
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent title="Nova proposta" description="Criada em rascunho - envie ao cliente quando estiver pronta.">
          <form onSubmit={(e) => void criar(e)} className="grid gap-4">
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
            <div className="grid grid-cols-2 gap-3">
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
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Valor (€)"
                type="number"
                min={0}
                step={0.01}
                value={form.valorEuros}
                onChange={(ev) => setForm((f) => ({ ...f, valorEuros: ev.target.value }))}
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
            <div className="flex gap-2">
              <Button type="submit" disabled={busy}>{busy ? "A criar…" : "Criar rascunho"}</Button>
              <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={enviarOpen} onOpenChange={setEnviarOpen}>
        <DialogContent
          title="Enviar proposta"
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
              O cliente recebe um email com o resumo da proposta e o valor. O estado passa para «Enviada».
            </p>
            <div className="flex gap-2">
              <Button type="submit" disabled={busy}>
                <Send className="h-4 w-4" />
                {busy ? "A enviar…" : "Enviar proposta"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setEnviarOpen(false)}>Cancelar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={rejeitarOpen} onOpenChange={setRejeitarOpen}>
        <DialogContent title="Rejeitar proposta" description="Registe o motivo para histórico interno.">
          <form onSubmit={(e) => void rejeitarProposta(e)} className="grid gap-4">
            <Textarea
              label="Motivo (opcional)"
              value={rejeitarMotivo}
              onChange={(ev) => setRejeitarMotivo(ev.target.value)}
              placeholder="Orçamento acima do previsto, prazo incompatível…"
            />
            <div className="flex gap-2">
              <Button type="submit" variant="danger" disabled={busy}>Confirmar rejeição</Button>
              <Button type="button" variant="secondary" onClick={() => setRejeitarOpen(false)}>Cancelar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
