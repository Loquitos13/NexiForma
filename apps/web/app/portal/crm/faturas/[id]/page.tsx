"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, FileText, Mail, RefreshCw, Save, Send, Upload } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { downloadResponseAsFile } from "@/lib/client/download-response";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { parseApiError } from "@/lib/ui/backoffice";
import {
  calcularTotaisLinhas,
  formatarEurosInput,
  parseEurosInput,
  parsePercentInput,
} from "@/lib/crm/fatura-calculos";
import { fmtFaturaRef, type FaturaEstado } from "@/lib/crm/shared";
import { FaturaEstadoBadge } from "@/components/crm/fatura-estado-badge";
import {
  FaturaInlineEditor,
  linhasFromApi,
  type FaturaLinhaEdit,
} from "@/components/crm/fatura-inline-editor";
import { AT_MOTIVO_ISENCAO_DEFAULT } from "@nexiforma/shared";
import { Alert, Button, PageHeader, Textarea } from "@/components/ui";
import { PortalBackButton } from "@/components/ui/portal-back-button";

type FaturaDetalhe = {
  id: string;
  estado: FaturaEstado;
  numero: number | null;
  codigoAtcud: string | null;
  dataEmissao: string | null;
  hashIntegridade?: string | null;
  dataVencimento: string | null;
  notas: string | null;
  destinatarioNome: string;
  destinatarioNif: string;
  destinatarioMorada: string | null;
  moradaCarga?: string | null;
  moradaDescarga?: string | null;
  entidadeCliente?: { id: string; nome: string; nif: string };
  valorCentavos: number;
  ivaCentavos: number;
  retencaoCentavos?: number;
  serie: { codigo: string; tipo: string };
  faturaReferencia?: {
    id: string;
    numero: number | null;
    serie: { codigo: string; tipo: string };
  } | null;
  proposta: { codigo: string; titulo: string } | null;
  linhas: Array<{
    descricao: string;
    quantidade: number | string;
    precoUnitCentavos: number;
    taxaIva: number | string;
    descontoPercent?: number | string | null;
    codigoIsencaoIva?: string | null;
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
    iban?: string | null;
    bicSwift?: string | null;
    emailGestor?: string | null;
    capitalSocial?: string | null;
    consRegCom?: string | null;
    taxaIvaPadrao: number | string;
    softwareCertificadoEfectivo?: string | null;
  };
};

type TenantBranding = { logoUrl?: string | null };

export default function FaturaEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { canManageCrm, canManage, isComercial } = useTenantRole();
  const [faturaId, setFaturaId] = useState<string | null>(null);
  const [fatura, setFatura] = useState<FaturaDetalhe | null>(null);
  const [config, setConfig] = useState<ConfigFaturacao["config"] | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [destNome, setDestNome] = useState("");
  const [destNif, setDestNif] = useState("");
  const [destMorada, setDestMorada] = useState("");
  const [moradaCarga, setMoradaCarga] = useState("");
  const [moradaDescarga, setMoradaDescarga] = useState("");
  const [dataVencimento, setDataVencimento] = useState("");
  const [notas, setNotas] = useState("");
  const [retencaoEuros, setRetencaoEuros] = useState("0.00");
  const [linhas, setLinhas] = useState<FaturaLinhaEdit[]>([]);
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
        descontoPercent: parsePercentInput(l.descontoPercent),
      }));
    return calcularTotaisLinhas(parsed);
  }, [linhas]);

  const load = useCallback(async () => {
    if (!faturaId) return;
    setLoading(true);
    setError(null);
    const [fRes, cRes, bRes] = await Promise.all([
      bffFetch(`/api/v1/crm/faturas/${faturaId}`, { headers: { accept: "application/json" } }),
      bffFetch("/api/v1/crm/config/faturacao", { headers: { accept: "application/json" } }),
      bffFetch("/api/v1/portal/tenant/branding", { headers: { accept: "application/json" } }),
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
    setMoradaCarga(f.moradaCarga ?? "");
    setMoradaDescarga(f.moradaDescarga ?? "");
    setDataVencimento(f.dataVencimento?.slice(0, 10) ?? "");
    setNotas(f.notas ?? "");
    setRetencaoEuros(formatarEurosInput(f.retencaoCentavos ?? 0));

    let tp = 23;
    if (cRes.ok) {
      const cfg = (await cRes.json()) as ConfigFaturacao;
      setConfig(cfg.config);
      tp = Number(cfg.config.taxaIvaPadrao);
    }
    if (bRes.ok) {
      const brand = (await bRes.json()) as TenantBranding;
      setLogoUrl(brand.logoUrl ?? null);
    }
    setLinhas(linhasFromApi(f.linhas, tp));
  }, [faturaId]);

  useEffect(() => {
    void load();
  }, [load]);

  function buildPayload() {
    const linhasPayload = linhas
      .filter((l) => l.descricao.trim())
      .map((l) => {
        const taxaIva = Number.parseFloat(l.taxaIva.replace(",", ".")) || 0;
        return {
          descricao: l.descricao.trim(),
          quantidade: Number.parseFloat(l.quantidade.replace(",", ".")) || 1,
          precoUnitCentavos: parseEurosInput(l.precoEuros),
          taxaIva,
          descontoPercent: parsePercentInput(l.descontoPercent),
          codigoIsencaoIva:
            taxaIva <= 0
              ? (l.codigoIsencaoIva.trim() || AT_MOTIVO_ISENCAO_DEFAULT)
              : null,
        };
      });
    return {
      moradaCarga: moradaCarga.trim() || null,
      moradaDescarga: moradaDescarga.trim() || null,
      dataVencimento: dataVencimento || null,
      notas: notas.trim() || null,
      retencaoCentavos: parseEurosInput(retencaoEuros),
      linhas: linhasPayload,
    };
  }

  async function guardar(): Promise<boolean> {
    if (!faturaId || !editavel) return false;
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

  async function downloadPdf() {
    if (!faturaId || !fatura) return;
    setBusy(true);
    const ref =
      fatura.numero != null
        ? `${fatura.serie.codigo}-${fatura.numero}`
        : faturaId.slice(0, 8);
    const res = await bffFetch(
      `/api/v1/crm/faturas/${faturaId}/documento.pdf?download=1`,
      { headers: { accept: "application/pdf" } },
    );
    setBusy(false);
    if (!res.ok) {
      setError("Erro ao gerar PDF.");
      return;
    }
    await downloadResponseAsFile(res, `fatura-${ref.toLowerCase()}.pdf`);
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

  async function criarNotaCredito() {
    if (!faturaId) return;
    setBusy(true);
    setError(null);
    const res = await bffFetch(`/api/v1/crm/faturas/${faturaId}/nota-credito`, {
      method: "POST",
      headers: { accept: "application/json" },
    });
    setBusy(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    const nc = (await res.json()) as { id: string };
    router.push(`/portal/crm/faturas/${nc.id}`);
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
  const podeNotaCredito =
    fatura.serie.tipo === "FT" && podeAnular;
  const retencaoCentavos = editavel
    ? parseEurosInput(retencaoEuros)
    : (fatura.retencaoCentavos ?? 0);
  const totalLiquido = Math.max(
    0,
    totais.valorCentavos + totais.ivaCentavos - retencaoCentavos,
  );

  return (
    <div className="space-y-4 pb-10">
      <PortalBackButton fallbackHref="/portal/crm/faturas" fallbackLabel="Faturas" />
      <PageHeader
        title={titulo}
        description={
          editavel
            ? "Edite directamente no modelo da fatura. Guarde o rascunho e emita quando estiver correcto."
            : "Documento emitido - imprima ou comunique à AT."
        }
        actions={
          <div className="flex flex-wrap gap-2">
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
                {podeNotaCredito && canManageCrm ? (
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => void criarNotaCredito()}>
                    <FileText className="h-3.5 w-3.5" />
                    Nota de crédito
                  </Button>
                ) : null}
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => void downloadPdf()}>
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

      {fatura.proposta ? (
        <p className="text-sm text-slate-400">
          Ref. proposta {fatura.proposta.codigo} - {fatura.proposta.titulo}
        </p>
      ) : null}

      <FaturaInlineEditor
        editavel={editavel}
        canManageConfig={canManage}
        logoUrl={logoUrl}
        emitente={{
          nomeEmpresa: config?.nomeEmpresa ?? "",
          moradaFiscal: config?.moradaFiscal ?? null,
          nifEmitente: config?.nifEmitente ?? "",
          iban: config?.iban ?? null,
          bicSwift: config?.bicSwift ?? null,
          emailGestor: config?.emailGestor ?? null,
          capitalSocial: config?.capitalSocial ?? null,
          consRegCom: config?.consRegCom ?? null,
        }}
        destNome={destNome}
        destNif={destNif}
        destMorada={destMorada}
        clienteId={fatura.entidadeCliente?.id}
        moradaCarga={moradaCarga}
        moradaDescarga={moradaDescarga}
        onMoradaCarga={setMoradaCarga}
        onMoradaDescarga={setMoradaDescarga}
        tipoDocumento={fatura.serie.tipo === "FT" ? "FATURA" : fatura.serie.tipo}
        tipoSerie={fatura.serie.tipo}
        numeroDocumento={
          fatura.numero != null
            ? `${fatura.serie.codigo}/${fatura.numero}`
            : `${fatura.serie.codigo}/-`
        }
        estadoDocumento={editavel ? "RASCUNHO" : "ORIGINAL"}
        codigoAtcud={fatura.codigoAtcud}
        dataEmissao={
          fatura.dataEmissao
            ? new Date(fatura.dataEmissao).toISOString().slice(0, 10)
            : editavel
              ? new Date().toISOString().slice(0, 10)
              : null
        }
        dataVencimento={dataVencimento}
        onDataVencimento={setDataVencimento}
        linhas={linhas}
        onLinhas={setLinhas}
        taxaPadrao={taxaPadrao}
        retencaoEuros={retencaoEuros}
        onRetencaoEuros={setRetencaoEuros}
        notas={notas}
        onNotas={setNotas}
        totalLiquidoCentavos={totalLiquido}
        totais={totais}
        softwareCertificado={config?.softwareCertificadoEfectivo ?? null}
        hashIntegridade={fatura.hashIntegridade}
      />
    </div>
  );
}
