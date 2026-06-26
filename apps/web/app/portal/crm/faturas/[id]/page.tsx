"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Ban, FileText, Mail, Plus, RefreshCw, Save, Send, Settings, Trash2, Upload } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { openHtmlForPrint } from "@/lib/client/open-html-for-print";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { parseApiError } from "@/lib/ui/backoffice";
import {
  calcularBaseLinhaCentavos,
  calcularTotaisLinhas,
  calcularValorIvaCentavos,
  formatarEurosInput,
  parseEurosInput,
} from "@/lib/crm/fatura-calculos";
import { fmtEuro, fmtFaturaRef, type FaturaEstado } from "@/lib/crm/shared";
import { FaturaEstadoBadge } from "@/components/crm/fatura-estado-badge";
import { Alert, Button, Input, PageHeader, Textarea } from "@/components/ui";

type LinhaEdit = {
  key: string;
  descricao: string;
  quantidade: string;
  precoEuros: string;
  taxaIva: string;
};

type FaturaDetalhe = {
  id: string;
  estado: FaturaEstado;
  numero: number | null;
  codigoAtcud: string | null;
  dataVencimento: string | null;
  notas: string | null;
  destinatarioNome: string;
  destinatarioNif: string;
  destinatarioMorada: string | null;
  valorCentavos: number;
  ivaCentavos: number;
  serie: { codigo: string; tipo: string };
  proposta: { codigo: string; titulo: string } | null;
  linhas: Array<{
    descricao: string;
    quantidade: number | string;
    precoUnitCentavos: number;
    taxaIva: number | string;
  }>;
  pedidosAnulacao?: Array<{
    id: string;
    estado: string;
    motivo: string;
    respostaMotivo: string | null;
    createdAt: string;
    solicitadoPor: { displayName: string; email: string };
  }>;
};

type ConfigFaturacao = {
  config: {
    nomeEmpresa: string;
    moradaFiscal: string | null;
    nifEmitente: string;
    taxaIvaPadrao: number | string;
  };
};

function novaLinha(taxaPadrao: number): LinhaEdit {
  return {
    key: crypto.randomUUID(),
    descricao: "",
    quantidade: "1",
    precoEuros: "0.00",
    taxaIva: String(taxaPadrao),
  };
}

function linhasFromApi(
  linhas: FaturaDetalhe["linhas"],
  taxaPadrao: number,
): LinhaEdit[] {
  if (linhas.length === 0) return [novaLinha(taxaPadrao)];
  return linhas.map((l) => ({
    key: crypto.randomUUID(),
    descricao: l.descricao,
    quantidade: String(Number(l.quantidade)),
    precoEuros: formatarEurosInput(l.precoUnitCentavos),
    taxaIva: String(Number(l.taxaIva)),
  }));
}

export default function FaturaEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { canManageCrm, canManage, isComercial } = useTenantRole();
  const [faturaId, setFaturaId] = useState<string | null>(null);
  const [fatura, setFatura] = useState<FaturaDetalhe | null>(null);
  const [config, setConfig] = useState<ConfigFaturacao["config"] | null>(null);
  const [destNome, setDestNome] = useState("");
  const [destNif, setDestNif] = useState("");
  const [destMorada, setDestMorada] = useState("");
  const [dataVencimento, setDataVencimento] = useState("");
  const [notas, setNotas] = useState("");
  const [linhas, setLinhas] = useState<LinhaEdit[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [motivoAnulacao, setMotivoAnulacao] = useState("");
  const [showAnularForm, setShowAnularForm] = useState(false);
  const [showSolicitarForm, setShowSolicitarForm] = useState(false);

  useEffect(() => {
    void params.then((p) => setFaturaId(p.id));
  }, [params]);

  const taxaPadrao = Number(config?.taxaIvaPadrao ?? 23);
  const editavel = fatura?.estado === "RASCUNHO";

  const totais = useMemo(() => {
    const parsed = linhas
      .filter((l) => l.descricao.trim())
      .map((l) => ({
        quantidade: Number.parseFloat(l.quantidade.replace(",", ".")) || 0,
        precoUnitCentavos: parseEurosInput(l.precoEuros),
        taxaIva: Number.parseFloat(l.taxaIva.replace(",", ".")) || 0,
      }));
    return calcularTotaisLinhas(parsed);
  }, [linhas]);

  const load = useCallback(async () => {
    if (!faturaId) return;
    setLoading(true);
    setError(null);
    const [fRes, cRes] = await Promise.all([
      bffFetch(`/api/v1/crm/faturas/${faturaId}`, { headers: { accept: "application/json" } }),
      bffFetch("/api/v1/crm/config/faturacao", { headers: { accept: "application/json" } }),
    ]);
    setLoading(false);
    if (!fRes.ok) {
      setError(await parseApiError(fRes));
      return;
    }
    const f = (await fRes.json()) as FaturaDetalhe;
    setFatura(f);
    setDestNome(f.destinatarioNome);
    setDestNif(f.destinatarioNif);
    setDestMorada(f.destinatarioMorada ?? "");
    setDataVencimento(f.dataVencimento?.slice(0, 10) ?? "");
    setNotas(f.notas ?? "");

    let tp = 23;
    if (cRes.ok) {
      const cfg = (await cRes.json()) as ConfigFaturacao;
      setConfig(cfg.config);
      tp = Number(cfg.config.taxaIvaPadrao);
    }
    setLinhas(linhasFromApi(f.linhas, tp));
  }, [faturaId]);

  useEffect(() => {
    void load();
  }, [load]);

  function buildPayload() {
    const linhasPayload = linhas
      .filter((l) => l.descricao.trim())
      .map((l) => ({
        descricao: l.descricao.trim(),
        quantidade: Number.parseFloat(l.quantidade.replace(",", ".")) || 1,
        precoUnitCentavos: parseEurosInput(l.precoEuros),
        taxaIva: Number.parseFloat(l.taxaIva.replace(",", ".")) || 0,
      }));
    return {
      destinatarioNome: destNome.trim(),
      destinatarioNif: destNif.trim(),
      destinatarioMorada: destMorada.trim() || null,
      dataVencimento: dataVencimento || null,
      notas: notas.trim() || null,
      linhas: linhasPayload,
    };
  }

  async function guardar(): Promise<boolean> {
    if (!faturaId || !editavel) return false;
    if (!destNome.trim() || !destNif.trim()) {
      setError("Nome e NIF do destinatário são obrigatórios.");
      return false;
    }
    const payload = buildPayload();
    if (payload.linhas.length === 0) {
      setError("Adicione pelo menos um produto/serviço.");
      return false;
    }
    setBusy(true);
    setError(null);
    setMsg(null);
    const res = await bffFetch(`/api/v1/crm/faturas/${faturaId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return false;
    }
    setMsg("Rascunho guardado.");
    await load();
    return true;
  }

  async function emitir() {
    if (!faturaId || !editavel) return;
    const ok = await guardar();
    if (!ok) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    const res = await bffFetch(`/api/v1/crm/faturas/${faturaId}/emitir`, {
      method: "POST",
      headers: { accept: "application/json" },
    });
    setBusy(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    setMsg("Fatura emitida com numeração e ATCUD.");
    await load();
  }

  async function comunicarAt() {
    if (!faturaId) return;
    setBusy(true);
    setError(null);
    const res = await bffFetch(`/api/v1/crm/faturas/${faturaId}/comunicar-at`, {
      method: "POST",
      headers: { accept: "application/json" },
    });
    setBusy(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    const body = (await res.json()) as { comunicacao?: { mensagemAt?: string } };
    setMsg(body.comunicacao?.mensagemAt ?? "Comunicada à AT.");
    await load();
  }

  async function reenviarAt() {
    if (!faturaId) return;
    setBusy(true);
    setError(null);
    const res = await bffFetch(`/api/v1/crm/faturas/${faturaId}/reenviar-at`, {
      method: "POST",
      headers: { accept: "application/json" },
    });
    setBusy(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    const body = (await res.json()) as { comunicacao?: { mensagemAt?: string } };
    setMsg(body.comunicacao?.mensagemAt ?? "Reenviada à AT.");
    await load();
  }

  async function enviarEmail() {
    if (!faturaId) return;
    setBusy(true);
    setError(null);
    const res = await bffFetch(`/api/v1/crm/faturas/${faturaId}/enviar-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({}),
    });
    setBusy(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    const body = (await res.json()) as { destinatario?: string };
    setMsg(`Fatura enviada por email para ${body.destinatario ?? "cliente"}.`);
  }

  async function imprimir() {
    if (!faturaId) return;
    setBusy(true);
    const res = await bffFetch(`/api/v1/crm/faturas/${faturaId}/documento.html`, {
      headers: { accept: "text/html" },
    });
    setBusy(false);
    if (!res.ok) {
      setError("Erro ao gerar documento.");
      return;
    }
    const opened = openHtmlForPrint(await res.text());
    if (!opened.ok) setError(opened.error);
  }

  async function solicitarAnulacao() {
    if (!faturaId) return;
    const motivo = motivoAnulacao.trim();
    if (!motivo) {
      setError("Indique o motivo do pedido de anulação.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await bffFetch(`/api/v1/crm/faturas/${faturaId}/solicitar-anulacao`, {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ motivo }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    setMsg("Pedido de anulação enviado ao gestor.");
    setShowSolicitarForm(false);
    setMotivoAnulacao("");
    await load();
  }

  async function anularFatura() {
    if (!faturaId) return;
    const motivo = motivoAnulacao.trim();
    if (!motivo) {
      setError("Indique o motivo da anulação.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await bffFetch(`/api/v1/crm/faturas/${faturaId}/anular`, {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ motivo }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    setMsg("Fatura anulada.");
    setShowAnularForm(false);
    setMotivoAnulacao("");
    await load();
  }

  async function rejeitarPedido() {
    if (!faturaId) return;
    setBusy(true);
    setError(null);
    const res = await bffFetch(`/api/v1/crm/faturas/${faturaId}/rejeitar-pedido-anulacao`, {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ respostaMotivo: motivoAnulacao.trim() || undefined }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    setMsg("Pedido de anulação rejeitado.");
    setShowAnularForm(false);
    setMotivoAnulacao("");
    await load();
  }

  if (!canManageCrm) {
    return (
      <div className="max-w-3xl space-y-4">
        <h1 className="text-2xl font-bold text-slate-50">Fatura</h1>
        <p className="text-sm text-slate-400">Sem permissão.</p>
      </div>
    );
  }

  if (loading || !fatura) {
    return <p className="text-slate-400 text-sm">A carregar fatura…</p>;
  }

  const titulo =
    fatura.estado === "RASCUNHO"
      ? "Editar fatura (rascunho)"
      : fmtFaturaRef(fatura.serie, fatura.numero);

  const pedidoPendente = fatura.pedidosAnulacao?.find((p) => p.estado === "PENDENTE");
  const podeAnular =
    fatura.estado === "EMITIDA" || fatura.estado === "COMUNICADA_AT";

  return (
    <div className="space-y-4 pb-10">
      <PageHeader
        title={titulo}
        description={
          editavel
            ? "Edite directamente no modelo da fatura. Guarde o rascunho e emita quando estiver correcto."
            : "Documento emitido - imprima ou comunique à AT."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => router.push("/portal/crm/faturas")}>
              <ArrowLeft className="h-3.5 w-3.5" />
              Lista
            </Button>
            {editavel ? (
              <>
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => void guardar()}>
                  <Save className="h-3.5 w-3.5" />
                  Guardar
                </Button>
                <Button size="sm" disabled={busy} onClick={() => void emitir()}>
                  <Send className="h-3.5 w-3.5" />
                  Emitir
                </Button>
              </>
            ) : (
              <>
                {fatura.estado === "EMITIDA" ? (
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => void comunicarAt()}>
                    <Upload className="h-3.5 w-3.5" />
                    Comunicar AT
                  </Button>
                ) : null}
                {fatura.estado === "EMITIDA" || fatura.estado === "COMUNICADA_AT" ? (
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => void reenviarAt()}>
                    <RefreshCw className="h-3.5 w-3.5" />
                    Reenviar AT
                  </Button>
                ) : null}
                {fatura.estado === "EMITIDA" || fatura.estado === "COMUNICADA_AT" ? (
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => void enviarEmail()}>
                    <Mail className="h-3.5 w-3.5" />
                    Email cliente
                  </Button>
                ) : null}
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => void imprimir()}>
                  <FileText className="h-3.5 w-3.5" />
                  PDF
                </Button>
                {isComercial && podeAnular && !pedidoPendente ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => {
                      setShowSolicitarForm(true);
                      setMotivoAnulacao("");
                    }}
                  >
                    <Ban className="h-3.5 w-3.5" />
                    Pedir anulação
                  </Button>
                ) : null}
                {canManage && podeAnular ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => {
                      setShowAnularForm(true);
                      setMotivoAnulacao(pedidoPendente?.motivo ?? "");
                    }}
                  >
                    <Ban className="h-3.5 w-3.5" />
                    Anular
                  </Button>
                ) : null}
              </>
            )}
          </div>
        }
      />

      {pedidoPendente ? (
        <Alert variant="warning">
          <strong>Pedido de anulação pendente</strong> por {pedidoPendente.solicitadoPor.displayName}:{" "}
          {pedidoPendente.motivo}
          {canManage ? (
            <span className="block mt-2 text-xs">
              Use «Anular» para aprovar ou abra o formulário de anulação para rejeitar.
            </span>
          ) : null}
        </Alert>
      ) : null}

      {showSolicitarForm ? (
        <div className="rounded-xl border border-slate-700/50 bg-slate-900/50 p-4 space-y-3 max-w-lg">
          <h3 className="text-sm font-semibold text-slate-200">Pedir anulação ao gestor</h3>
          <Textarea
            value={motivoAnulacao}
            onChange={(e) => setMotivoAnulacao(e.target.value)}
            rows={3}
            placeholder="Motivo da anulação (obrigatório)"
          />
          <div className="flex gap-2">
            <Button size="sm" disabled={busy} onClick={() => void solicitarAnulacao()}>
              Enviar pedido
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setShowSolicitarForm(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}

      {showAnularForm && canManage ? (
        <div className="rounded-xl border border-red-500/30 bg-red-950/20 p-4 space-y-3 max-w-lg">
          <h3 className="text-sm font-semibold text-red-200">Anular fatura (gestor)</h3>
          <Textarea
            value={motivoAnulacao}
            onChange={(e) => setMotivoAnulacao(e.target.value)}
            rows={3}
            placeholder="Motivo legal da anulação"
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={busy} onClick={() => void anularFatura()}>
              Confirmar anulação
            </Button>
            {pedidoPendente ? (
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => void rejeitarPedido()}>
                Rejeitar pedido
              </Button>
            ) : null}
            <Button size="sm" variant="secondary" onClick={() => setShowAnularForm(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}

      {error ? <Alert variant="error">{error}</Alert> : null}
      {msg ? <Alert variant="success">{msg}</Alert> : null}

      {!editavel ? (
        <div className="flex items-center gap-2">
          <FaturaEstadoBadge estado={fatura.estado} />
          {fatura.codigoAtcud ? (
            <span className="text-xs font-mono text-blue-400/90">{fatura.codigoAtcud}</span>
          ) : null}
        </div>
      ) : null}

      <article className="mx-auto max-w-4xl rounded-xl border border-slate-200 bg-white text-slate-900 shadow-2xl shadow-black/20">
        <header className="border-b border-slate-200 px-6 py-5 sm:px-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-800">
                {editavel ? "Rascunho" : "Fatura"} · {fatura.serie.tipo}
              </p>
              <h2 className="text-2xl font-bold text-slate-900">
                {editavel
                  ? `${fatura.serie.tipo} ${fatura.serie.codigo}`
                  : fmtFaturaRef(fatura.serie, fatura.numero)}
              </h2>
              {fatura.proposta ? (
                <p className="mt-1 text-sm text-slate-500">
                  Ref. proposta {fatura.proposta.codigo} - {fatura.proposta.titulo}
                </p>
              ) : null}
            </div>
            {editavel ? <FaturaEstadoBadge estado={fatura.estado} /> : null}
          </div>
        </header>

        <div className="grid gap-0 sm:grid-cols-2">
          <section className="border-b border-slate-200 p-6 sm:border-b-0 sm:border-r">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Emitente</h3>
              {canManage ? (
                <Link
                  href="/portal/crm/faturacao"
                  className="inline-flex items-center gap-1 text-xs text-blue-700 hover:underline"
                >
                  <Settings className="h-3 w-3" />
                  Configurar
                </Link>
              ) : null}
            </div>
            <p className="font-semibold text-slate-900">{config?.nomeEmpresa ?? "-"}</p>
            {config?.moradaFiscal ? (
              <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{config.moradaFiscal}</p>
            ) : (
              <p className="mt-1 text-sm text-amber-700">
                Morada fiscal não configurada.
                {canManage ? (
                  <>
                    {" "}
                    <Link href="/portal/crm/faturacao" className="underline">
                      Adicionar
                    </Link>
                  </>
                ) : null}
              </p>
            )}
            <p className="mt-2 text-sm">
              <span className="text-slate-500">NIF </span>
              <span className="font-medium">{config?.nifEmitente ?? "-"}</span>
            </p>
          </section>

          <section className="border-b border-slate-200 p-6">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Destinatário
            </h3>
            {editavel ? (
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs text-slate-500">Nome (empresa ou particular) *</label>
                  <Input
                    value={destNome}
                    onChange={(e) => setDestNome(e.target.value)}
                    className="bg-white text-slate-900 border-slate-300"
                    placeholder="Nome do cliente"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">NIF *</label>
                  <Input
                    value={destNif}
                    onChange={(e) => setDestNif(e.target.value)}
                    className="bg-white text-slate-900 border-slate-300"
                    placeholder="NIF"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">Morada fiscal (opcional)</label>
                  <Textarea
                    value={destMorada}
                    onChange={(e) => setDestMorada(e.target.value)}
                    rows={2}
                    className="bg-white text-slate-900 border-slate-300"
                    placeholder="Morada do cliente"
                  />
                </div>
              </div>
            ) : (
              <>
                <p className="font-semibold">{destNome}</p>
                {destMorada ? (
                  <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{destMorada}</p>
                ) : null}
                <p className="mt-2 text-sm">
                  <span className="text-slate-500">NIF </span>
                  <span className="font-medium">{destNif}</span>
                </p>
              </>
            )}
          </section>
        </div>

        {editavel ? (
          <div className="border-b border-slate-200 px-6 py-4 sm:px-8">
            <label className="mb-1 block text-xs text-slate-500">Data de vencimento (opcional)</label>
            <Input
              type="date"
              value={dataVencimento}
              onChange={(e) => setDataVencimento(e.target.value)}
              className="max-w-xs bg-white text-slate-900 border-slate-300"
            />
          </div>
        ) : null}

        <div className="overflow-x-auto px-4 py-4 sm:px-6">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-2 py-2 font-semibold">Produto / serviço</th>
                <th className="px-2 py-2 font-semibold text-right w-16">Qtd.</th>
                <th className="px-2 py-2 font-semibold text-right w-24">Preço s/ IVA</th>
                <th className="px-2 py-2 font-semibold text-right w-24">Base</th>
                <th className="px-2 py-2 font-semibold text-right w-16">IVA %</th>
                <th className="px-2 py-2 font-semibold text-right w-24">IVA</th>
                <th className="px-2 py-2 font-semibold text-right w-28">Total c/ IVA</th>
                {editavel ? <th className="w-10" /> : null}
              </tr>
            </thead>
            <tbody>
              {linhas.map((linha, idx) => {
                const q = Number.parseFloat(linha.quantidade.replace(",", ".")) || 0;
                const preco = parseEurosInput(linha.precoEuros);
                const taxa = Number.parseFloat(linha.taxaIva.replace(",", ".")) || 0;
                const base = calcularBaseLinhaCentavos({ quantidade: q, precoUnitCentavos: preco, taxaIva: taxa });
                const iva = calcularValorIvaCentavos({ quantidade: q, precoUnitCentavos: preco, taxaIva: taxa });
                const total = base + iva;

                return (
                  <tr key={linha.key} className="border-b border-slate-100">
                    <td className="px-2 py-2">
                      {editavel ? (
                        <Input
                          value={linha.descricao}
                          onChange={(e) => {
                            const next = [...linhas];
                            next[idx] = { ...linha, descricao: e.target.value };
                            setLinhas(next);
                          }}
                          className="bg-white text-slate-900 border-slate-300"
                          placeholder="Descrição"
                        />
                      ) : (
                        linha.descricao
                      )}
                    </td>
                    <td className="px-2 py-2 text-right">
                      {editavel ? (
                        <Input
                          value={linha.quantidade}
                          onChange={(e) => {
                            const next = [...linhas];
                            next[idx] = { ...linha, quantidade: e.target.value };
                            setLinhas(next);
                          }}
                          className="bg-white text-slate-900 border-slate-300 text-right"
                        />
                      ) : (
                        q
                      )}
                    </td>
                    <td className="px-2 py-2 text-right">
                      {editavel ? (
                        <Input
                          value={linha.precoEuros}
                          onChange={(e) => {
                            const next = [...linhas];
                            next[idx] = { ...linha, precoEuros: e.target.value };
                            setLinhas(next);
                          }}
                          className="bg-white text-slate-900 border-slate-300 text-right"
                        />
                      ) : (
                        fmtEuro(preco)
                      )}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-slate-600">{fmtEuro(base)}</td>
                    <td className="px-2 py-2 text-right">
                      {editavel ? (
                        <Input
                          value={linha.taxaIva}
                          onChange={(e) => {
                            const next = [...linhas];
                            next[idx] = { ...linha, taxaIva: e.target.value };
                            setLinhas(next);
                          }}
                          className="bg-white text-slate-900 border-slate-300 text-right"
                        />
                      ) : (
                        `${taxa}%`
                      )}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-slate-600">{fmtEuro(iva)}</td>
                    <td className="px-2 py-2 text-right tabular-nums font-medium">{fmtEuro(total)}</td>
                    {editavel ? (
                      <td className="px-1 py-2">
                        <button
                          type="button"
                          className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          onClick={() => setLinhas(linhas.filter((_, i) => i !== idx))}
                          disabled={linhas.length <= 1}
                          title="Remover linha"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {editavel ? (
            <Button
              size="sm"
              variant="secondary"
              className="mt-3"
              onClick={() => setLinhas([...linhas, novaLinha(taxaPadrao)])}
            >
              <Plus className="h-3.5 w-3.5" />
              Adicionar linha
            </Button>
          ) : null}
        </div>

        <div className="flex flex-col gap-4 border-t border-slate-200 px-6 py-5 sm:flex-row sm:justify-between sm:px-8">
          {editavel ? (
            <div className="flex-1">
              <label className="mb-1 block text-xs text-slate-500">Notas (opcional)</label>
              <Textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                rows={2}
                className="bg-white text-slate-900 border-slate-300"
              />
            </div>
          ) : notas ? (
            <p className="flex-1 text-sm text-slate-600">
              <strong>Notas:</strong> {notas}
            </p>
          ) : (
            <div className="flex-1" />
          )}

          <div className="w-full max-w-xs space-y-1 text-sm sm:text-right">
            <div className="flex justify-between gap-4 sm:justify-end">
              <span className="text-slate-500">Subtotal (s/ IVA)</span>
              <span className="font-medium tabular-nums">{fmtEuro(totais.valorCentavos)}</span>
            </div>
            <div className="flex justify-between gap-4 sm:justify-end">
              <span className="text-slate-500">IVA</span>
              <span className="font-medium tabular-nums">{fmtEuro(totais.ivaCentavos)}</span>
            </div>
            <div className="flex justify-between gap-4 border-t border-slate-200 pt-2 sm:justify-end">
              <span className="font-semibold text-blue-900">Total</span>
              <span className="text-lg font-bold tabular-nums text-blue-900">
                {fmtEuro(totais.valorCentavos + totais.ivaCentavos)}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 sm:text-right">
              Valores com IVA discriminado por linha
            </p>
          </div>
        </div>
      </article>
    </div>
  );
}
