"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Ban, FileText, Mail, RefreshCw, Save, Send, Upload } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { downloadResponseAsFile } from "@/lib/client/download-response";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { useTenantEntitlements } from "@/lib/client/use-tenant-entitlements";
import { canAccessFaturacaoPortal } from "@nexiforma/shared";
import { parseApiError } from "@/lib/ui/backoffice";
import {
  calcularTotaisLinhas,
  formatarEurosInput,
  parseEurosInput,
  parsePercentInput,
} from "@/lib/crm/fatura-calculos";
import { fmtFaturaRef, fmtEuro, type FaturaEstado } from "@/lib/crm/shared";
import { FaturaEstadoBadge } from "@/components/crm/fatura-estado-badge";
import {
  FaturaInlineEditor,
  linhasFromApi,
  type FaturaLinhaEdit,
  type FaturaTemplateCoresUi,
} from "@/components/crm/fatura-inline-editor";
import { AT_MOTIVO_ISENCAO_DEFAULT } from "@nexiforma/shared";
import { Alert, Button, Dialog, DialogContent, Input, PageHeader, Textarea } from "@/components/ui";
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
  entidadeCliente?: { id: string; nome: string; nif: string; email?: string | null };
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
    templateCores?: FaturaTemplateCoresUi | null;
  };
};

type TenantBranding = { logoUrl?: string | null };

export default function FaturaEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { canManageFaturacao: canManage, role, writeDisabled } = useTenantRole();
  const { entitlements } = useTenantEntitlements();
  const canAccessFaturacao = canAccessFaturacaoPortal(role, entitlements);
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
  const [confirmAction, setConfirmAction] = useState<
    "emitir" | "comunicar" | "reenviar" | "nota-credito" | null
  >(null);
  const [enviarOpen, setEnviarOpen] = useState(false);
  const [enviarEmailTo, setEnviarEmailTo] = useState("");

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
    setConfirmAction(null);
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
    setConfirmAction(null);
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
    setConfirmAction(null);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    const body = (await res.json()) as { comunicacao?: { mensagemAt?: string } };
    setMsg(body.comunicacao?.mensagemAt ?? "Reenviada à AT.");
    await load();
  }

  function abrirEnviarEmail() {
    const sugerido = fatura?.entidadeCliente?.email?.trim() ?? "";
    setEnviarEmailTo(sugerido);
    setEnviarOpen(true);
  }

  async function enviarEmail(e?: FormEvent) {
    e?.preventDefault();
    if (!faturaId) return;
    const email = enviarEmailTo.trim();
    if (!email) {
      setError("Indique o email do destinatário.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await bffFetch(`/api/v1/crm/faturas/${faturaId}/enviar-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ email }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    const body = (await res.json()) as { destinatario?: string };
    setEnviarOpen(false);
    setMsg(`Fatura ORIGINAL enviada por email para ${body.destinatario ?? email}.`);
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
    setConfirmAction(null);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    const nc = (await res.json()) as { id: string };
    router.push(`/portal/crm/faturas/${nc.id}`);
  }

  async function confirmarAccaoFiscal() {
    if (confirmAction === "emitir") await emitir();
    else if (confirmAction === "comunicar") await comunicarAt();
    else if (confirmAction === "reenviar") await reenviarAt();
    else if (confirmAction === "nota-credito") await criarNotaCredito();
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

  if (!canAccessFaturacao) {
    return (
      <div className="max-w-3xl space-y-4">
        <h1 className="text-2xl font-bold text-slate-50">Fatura</h1>
        <p className="text-sm text-slate-400">Módulo de faturação AT reservado ao gestor.</p>
      </div>
    );
  }

  if (loading || !fatura) {
    return (
      <div className="space-y-4">
        <PortalBackButton fallbackHref="/portal/crm/faturas" fallbackLabel="Faturas" />
        <PageHeader title="Fatura" description="A carregar documento…" />
        <p className="text-slate-400 text-sm" role="status">
          A carregar fatura…
        </p>
      </div>
    );
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
  const mutacaoBloqueada = busy || writeDisabled;

  const confirmTitles: Record<NonNullable<typeof confirmAction>, string> = {
    emitir: "Confirmar emissão",
    comunicar: "Comunicar à Autoridade Tributária",
    reenviar: "Reenviar comunicação à AT",
    "nota-credito": "Criar nota de crédito",
  };
  const confirmDescriptions: Record<NonNullable<typeof confirmAction>, string> = {
    emitir:
      "A emissão atribui numeração definitiva e ATCUD. Esta acção é irreversível.",
    comunicar: "Vai enviar os dados deste documento ao webservice da AT.",
    reenviar: "Vai reenviar a comunicação deste documento à AT.",
    "nota-credito":
      "Será criado um rascunho de nota de crédito referenciando esta fatura.",
  };

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
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={mutacaoBloqueada}
                  onClick={() => void guardar()}
                >
                  <Save className="h-3.5 w-3.5" />
                  Guardar
                </Button>
                <Button
                  size="sm"
                  disabled={mutacaoBloqueada}
                  onClick={() => setConfirmAction("emitir")}
                >
                  <Send className="h-3.5 w-3.5" />
                  Emitir
                </Button>
              </>
            ) : (
              <>
                {fatura.estado === "EMITIDA" ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={mutacaoBloqueada}
                    onClick={() => setConfirmAction("comunicar")}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Comunicar AT
                  </Button>
                ) : null}
                {fatura.estado === "EMITIDA" || fatura.estado === "COMUNICADA_AT" ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={mutacaoBloqueada}
                    onClick={() => setConfirmAction("reenviar")}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Reenviar AT
                  </Button>
                ) : null}
                {fatura.estado === "EMITIDA" || fatura.estado === "COMUNICADA_AT" ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={mutacaoBloqueada}
                    onClick={() => abrirEnviarEmail()}
                  >
                    <Mail className="h-3.5 w-3.5" />
                    Email cliente
                  </Button>
                ) : null}
                {podeNotaCredito && canManage ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={mutacaoBloqueada}
                    onClick={() => setConfirmAction("nota-credito")}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Nota de crédito
                  </Button>
                ) : null}
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => void downloadPdf()}>
                  <FileText className="h-3.5 w-3.5" />
                  PDF
                </Button>
                {canManage && podeAnular ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={mutacaoBloqueada}
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

      {writeDisabled ? (
        <Alert variant="warning">Personificação read-only - alterações fiscais desactivadas.</Alert>
      ) : null}

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

      {showAnularForm && canManage ? (
        <div className="rounded-xl border border-red-500/30 bg-red-950/20 p-4 space-y-3 max-w-lg">
          <h3 className="text-sm font-semibold text-red-200">Anular fatura (gestor)</h3>
          <Textarea
            value={motivoAnulacao}
            onChange={(e) => setMotivoAnulacao(e.target.value)}
            rows={3}
            placeholder="Motivo legal da anulação"
            disabled={writeDisabled}
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={mutacaoBloqueada} onClick={() => void anularFatura()}>
              Confirmar anulação
            </Button>
            {pedidoPendente ? (
              <Button
                size="sm"
                variant="secondary"
                disabled={mutacaoBloqueada}
                onClick={() => void rejeitarPedido()}
              >
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
        editavel={editavel && !writeDisabled}
        canManageConfig={canManage && !writeDisabled}
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
        templateCores={config?.templateCores}
      />

      <Dialog open={enviarOpen} onOpenChange={setEnviarOpen}>
        <DialogContent
          title="Enviar fatura ao cliente"
          description={
            fatura
              ? `${fmtFaturaRef(fatura.serie, fatura.numero)} - ${fatura.destinatarioNome}`
              : undefined
          }
        >
          <form onSubmit={(e) => void enviarEmail(e)} className="grid gap-4">
            <Input
              label="Email do destinatário *"
              type="email"
              required
              value={enviarEmailTo}
              onChange={(ev) => setEnviarEmailTo(ev.target.value)}
              placeholder="cliente@empresa.pt"
            />
            <p className="text-xs text-slate-500 flex items-start gap-2">
              <Mail className="h-4 w-4 shrink-0 mt-0.5" />
              O cliente recebe o PDF ORIGINAL. O email interno do tenant recebe o DUPLICADO na
              emissão.
            </p>
            <div className="flex gap-2">
              <Button type="submit" disabled={busy || mutacaoBloqueada}>
                <Send className="h-4 w-4" />
                {busy ? "A enviar…" : "Enviar fatura"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setEnviarOpen(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmAction} onOpenChange={(o) => !o && setConfirmAction(null)}>
        <DialogContent
          title={confirmAction ? confirmTitles[confirmAction] : "Confirmar"}
          description={confirmAction ? confirmDescriptions[confirmAction] : undefined}
        >
          <div className="space-y-3 text-sm text-slate-300">
            <dl className="grid gap-2 rounded-lg border border-slate-700/50 bg-slate-900/50 p-3">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Cliente</dt>
                <dd className="text-right font-medium text-slate-100">
                  {fatura.destinatarioNome}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Série</dt>
                <dd className="text-right font-mono text-slate-100">
                  {fmtFaturaRef(fatura.serie, fatura.numero)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Valor (s/ IVA)</dt>
                <dd className="text-right tabular-nums text-slate-100">
                  {fmtEuro(editavel ? totais.valorCentavos : fatura.valorCentavos)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Total líquido</dt>
                <dd className="text-right tabular-nums font-semibold text-slate-50">
                  {fmtEuro(totalLiquido)}
                </dd>
              </div>
            </dl>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => setConfirmAction(null)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={mutacaoBloqueada}
                onClick={() => void confirmarAccaoFiscal()}
              >
                Confirmar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
