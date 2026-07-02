"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, CheckCircle2, Circle, ExternalLink, Save, Shield } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { parseApiError } from "@/lib/ui/backoffice";
import { AT_DOC_LINKS } from "@/lib/crm/at-doc-links";
import { Alert, Badge, Button, Input, PageHeader, Textarea } from "@/components/ui";

type Config = {
  nomeEmpresa: string;
  moradaFiscal: string | null;
  nifEmitente: string;
  iban: string | null;
  bicSwift: string | null;
  emailGestor: string | null;
  capitalSocial: string | null;
  consRegCom: string | null;
  regimeIva: string;
  seriePadraoCodigo: string;
  taxaIvaPadrao: number | string;
  atSubutilizador: string | null;
  atWfaPasswordConfigured?: boolean;
  atCertificadoRef: string | null;
  softwareCertificado: string | null;
  softwareCertificadoEfectivo?: string | null;
  comunicacaoAtiva: boolean;
  comunicacaoAutomatica?: boolean;
};

type Serie = {
  id: string;
  codigo: string;
  tipo: string;
  codigoValidacaoAt: string | null;
  proximoNumero: number;
  estadoAt?: string;
  mensagemAtSerie?: string | null;
};

type CertItem = {
  id: string;
  label: string;
  ok: boolean;
  detalhe?: string;
  bloqueante?: boolean;
};

type Certificacao = {
  prontaProducao: boolean;
  prontaSandbox?: boolean;
  softwareCertificado: string | null;
  softwareCertificadoOrigem: "tenant" | "plataforma" | null;
  modoServidor: string;
  items: CertItem[];
  avisoLegal: string;
};

type Integracao = {
  mode: string;
  configured: boolean;
  softwareCertificado: string | null;
  sandboxSimulado?: boolean;
  sandboxReal?: boolean;
  endpoint?: string | null;
};

/** Exemplos válidos para sandbox / demonstração (formato PT). */
const EXEMPLO_IBAN = "PT50000201231234567890154";
const EXEMPLO_BIC = "BBPIPTPL";

export default function CrmFaturacaoConfigPage() {
  const { canManage } = useTenantRole();
  const [config, setConfig] = useState<Config | null>(null);
  const [series, setSeries] = useState<Serie[]>([]);
  const [certificacao, setCertificacao] = useState<Certificacao | null>(null);
  const [integracao, setIntegracao] = useState<Integracao | null>(null);
  const [nomeEmpresa, setNomeEmpresa] = useState("");
  const [moradaFiscal, setMoradaFiscal] = useState("");
  const [nifEmitente, setNifEmitente] = useState("");
  const [iban, setIban] = useState("");
  const [bicSwift, setBicSwift] = useState("");
  const [emailGestor, setEmailGestor] = useState("");
  const [capitalSocial, setCapitalSocial] = useState("");
  const [consRegCom, setConsRegCom] = useState("");
  const [taxaIvaPadrao, setTaxaIvaPadrao] = useState("23");
  const [seriePadrao, setSeriePadrao] = useState("");
  const [atSubutilizador, setAtSubutilizador] = useState("");
  const [atWfaPassword, setAtWfaPassword] = useState("");
  const [atWfaPasswordConfigured, setAtWfaPasswordConfigured] = useState(false);
  const [atCertificadoRef, setAtCertificadoRef] = useState("");
  const [softwareCertificado, setSoftwareCertificado] = useState("");
  const [comunicacaoAtiva, setComunicacaoAtiva] = useState(false);
  const [comunicacaoAutomatica, setComunicacaoAutomatica] = useState(false);
  const [serieCodigos, setSerieCodigos] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const applyPayload = useCallback(
    (data: {
      config: Config;
      series?: Serie[];
      certificacao?: Certificacao;
      integracao?: Integracao;
    }) => {
      const c = data.config;
      setConfig(c);
      setNomeEmpresa(c.nomeEmpresa);
      setMoradaFiscal(c.moradaFiscal ?? "");
      setNifEmitente(c.nifEmitente);
      setIban(c.iban ?? "");
      setBicSwift(c.bicSwift ?? "");
      setEmailGestor(c.emailGestor ?? "");
      setCapitalSocial(c.capitalSocial ?? "");
      setConsRegCom(c.consRegCom ?? "");
      setTaxaIvaPadrao(String(Number(c.taxaIvaPadrao)));
      setSeriePadrao(c.seriePadraoCodigo);
      setAtSubutilizador(c.atSubutilizador ?? "");
      setAtWfaPassword("");
      setAtWfaPasswordConfigured(!!c.atWfaPasswordConfigured);
      setAtCertificadoRef(c.atCertificadoRef ?? "");
      setSoftwareCertificado(c.softwareCertificado ?? "");
      setComunicacaoAtiva(c.comunicacaoAtiva);
      setComunicacaoAutomatica(!!c.comunicacaoAutomatica);
      if (data.series) {
        setSeries(data.series);
        setSerieCodigos(
          Object.fromEntries(
            data.series.map((s) => [s.id, s.codigoValidacaoAt ?? ""]),
          ),
        );
      }
      if (data.certificacao) setCertificacao(data.certificacao);
      if (data.integracao) setIntegracao(data.integracao);
    },
    [],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await bffFetch("/api/v1/crm/config/faturacao", {
      headers: { accept: "application/json" },
    });
    setLoading(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    const body = (await res.json()) as {
      config: Config;
      series: Serie[];
      certificacao: Certificacao;
      integracao: Integracao;
    };
    applyPayload(body);

    if (!body.config.emailGestor?.trim()) {
      const meRes = await bffFetch("/api/auth/me", { headers: { accept: "application/json" } });
      if (meRes.ok) {
        const me = (await meRes.json()) as { email?: string };
        if (me.email?.trim()) {
          setEmailGestor(me.email.trim());
        }
      }
    }
  }, [applyPayload]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMsg(null);
    const payload = {
      nomeEmpresa: nomeEmpresa.trim(),
      moradaFiscal: moradaFiscal.trim() || null,
      nifEmitente: nifEmitente.trim(),
      iban: iban.trim() || null,
      bicSwift: bicSwift.trim() || null,
      emailGestor: emailGestor.trim() || null,
      capitalSocial: capitalSocial.trim() || null,
      consRegCom: consRegCom.trim() || null,
      taxaIvaPadrao: Number.parseFloat(taxaIvaPadrao.replace(",", ".")),
      seriePadraoCodigo: seriePadrao.trim(),
      atSubutilizador: atSubutilizador.trim() || null,
      ...(atWfaPassword.trim() ? { atWfaPassword: atWfaPassword.trim() } : {}),
      atCertificadoRef: atCertificadoRef.trim() || null,
      softwareCertificado: softwareCertificado.trim() || null,
      comunicacaoAtiva,
      comunicacaoAutomatica,
    };
    const res = await bffFetch("/api/v1/crm/config/faturacao", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    setMsg("Dados de faturação guardados.");
    applyPayload(await res.json());
  }

  async function guardarCodigoSerie(serieId: string) {
    setBusy(true);
    setError(null);
    const res = await bffFetch(`/api/v1/crm/config/faturacao/series/${serieId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        codigoValidacaoAt: serieCodigos[serieId]?.trim().toUpperCase() || null,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    const body = (await res.json()) as { certificacao?: Certificacao; serie?: Serie };
    if (body.serie) {
      setSeries((prev) => prev.map((s) => (s.id === serieId ? body.serie! : s)));
    }
    if (body.certificacao) setCertificacao(body.certificacao);
    setMsg("Código de validação AT actualizado.");
  }

  async function comunicarSerieAt(serieId: string) {
    setBusy(true);
    setError(null);
    setMsg(null);
    const res = await bffFetch(`/api/v1/crm/config/faturacao/series/${serieId}/comunicar-at`, {
      method: "POST",
      headers: { accept: "application/json" },
    });
    setBusy(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    const body = (await res.json()) as { serie?: Serie; resultado?: { mensagemAt?: string } };
    if (body.serie) {
      setSeries((prev) => prev.map((s) => (s.id === serieId ? body.serie! : s)));
      setSerieCodigos((prev) => ({
        ...prev,
        [serieId]: body.serie!.codigoValidacaoAt ?? prev[serieId] ?? "",
      }));
    }
    setMsg(body.resultado?.mensagemAt ?? "Série comunicada à AT.");
    void load();
  }

  async function comunicarTodasSeriesAt() {
    setBusy(true);
    setError(null);
    setMsg(null);
    const res = await bffFetch("/api/v1/crm/config/faturacao/series/comunicar-todas", {
      method: "POST",
      headers: { accept: "application/json" },
    });
    setBusy(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    setMsg("Séries comunicadas à AT.");
    void load();
  }

  async function testarAt() {
    setBusy(true);
    setError(null);
    setMsg(null);

    if (!atSubutilizador.trim()) {
      setBusy(false);
      setError("Preencha o subutilizador WFA antes de testar.");
      return;
    }
    if (!atWfaPassword.trim() && !atWfaPasswordConfigured) {
      setBusy(false);
      setError("Preencha a password WFA antes de testar (ou guarde-a primeiro).");
      return;
    }

    const saveRes = await bffFetch("/api/v1/crm/config/faturacao", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        nomeEmpresa: nomeEmpresa.trim(),
        moradaFiscal: moradaFiscal.trim() || null,
        nifEmitente: nifEmitente.trim(),
        iban: iban.trim() || null,
        bicSwift: bicSwift.trim() || null,
        emailGestor: emailGestor.trim() || null,
        capitalSocial: capitalSocial.trim() || null,
        consRegCom: consRegCom.trim() || null,
        taxaIvaPadrao: Number.parseFloat(taxaIvaPadrao.replace(",", ".")),
        seriePadraoCodigo: seriePadrao.trim(),
        atSubutilizador: atSubutilizador.trim() || null,
        ...(atWfaPassword.trim() ? { atWfaPassword: atWfaPassword.trim() } : {}),
        atCertificadoRef: atCertificadoRef.trim() || null,
        softwareCertificado: softwareCertificado.trim() || null,
        comunicacaoAtiva,
        comunicacaoAutomatica,
      }),
    });
    if (!saveRes.ok) {
      setBusy(false);
      setError(await parseApiError(saveRes));
      return;
    }
    applyPayload(await saveRes.json());

    const res = await bffFetch("/api/v1/crm/config/faturacao/testar-at", {
      method: "POST",
      headers: { accept: "application/json" },
    });
    setBusy(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    const body = (await res.json()) as {
      sucesso: boolean;
      mensagemAt: string | null;
      mode: string;
    };
    if (body.sucesso) {
      setMsg(body.mensagemAt ?? `Ligação AT OK (modo ${body.mode}).`);
    } else {
      setError(body.mensagemAt ?? "Teste AT falhou.");
    }
  }

  const modoSandbox = integracao?.mode === "sandbox";
  const sandboxMock = integracao?.sandboxSimulado === true;
  const sandboxReal = integracao?.sandboxReal === true;
  const producaoBloqueada =
    integracao?.mode === "production" && !certificacao?.prontaProducao;
  const comunicacaoBloqueada = producaoBloqueada && !modoSandbox;

  if (!canManage) {
    return (
      <div className="max-w-3xl space-y-4">
        <h1 className="text-2xl font-bold text-slate-50">Faturação</h1>
        <p className="text-sm text-slate-400">Apenas o gestor pode configurar dados de faturação.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-5">
      <PageHeader
        title="Dados de faturação"
        description="Emitente legal, integração AT e certificação do software."
        actions={
          <Link href="/portal/crm/faturas">
            <Button size="sm" variant="secondary">
              <ArrowLeft className="h-3.5 w-3.5" />
              Faturas
            </Button>
          </Link>
        }
      />

      {error ? <Alert variant="error">{error}</Alert> : null}
      {msg ? <Alert variant="success">{msg}</Alert> : null}

      {loading ? (
        <p className="text-sm text-slate-400">A carregar…</p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-6">
          {certificacao ? (
            <section className="rounded-xl border border-blue-500/25 bg-blue-500/5 p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-blue-400" />
                  <h2 className="text-sm font-semibold text-slate-200">Certificação software AT</h2>
                </div>
                <Badge variant={certificacao.prontaProducao || certificacao.prontaSandbox ? "green" : "default"}>
                  {modoSandbox
                    ? certificacao.prontaSandbox
                      ? "Sandbox pronto"
                      : "Sandbox em preparação"
                    : certificacao.prontaProducao
                      ? "Pronto produção"
                      : "Em preparação"}
                </Badge>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">{certificacao.avisoLegal}</p>
              <ul className="space-y-2">
                {certificacao.items.map((item) => (
                  <li key={item.id} className="flex gap-2 text-sm">
                    {item.ok ? (
                      <CheckCircle2 className="h-4 w-4 text-teal-400 shrink-0 mt-0.5" />
                    ) : (
                      <Circle className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className={item.ok ? "text-slate-200" : "text-slate-400"}>{item.label}</p>
                      {item.detalhe ? (
                        <p className="text-xs text-slate-500 mt-0.5">{item.detalhe}</p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-slate-500">
                Modo servidor: <span className="font-mono text-slate-300">{integracao?.mode ?? "-"}</span>
                {certificacao.softwareCertificado ? (
                  <>
                    {" "}
                    · Certificado efectivo:{" "}
                    <span className="font-mono text-slate-300">{certificacao.softwareCertificado}</span>
                  </>
                ) : null}
              </p>
              <a
                href={AT_DOC_LINKS.programaCertificacao}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
              >
                Programa de faturação certificada (gov.pt)
                <ExternalLink className="h-3 w-3" />
              </a>
            </section>
          ) : null}

          <section className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-200">Emitente (obrigatório)</h2>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Nome comercial completo *</label>
              <Input value={nomeEmpresa} onChange={(e) => setNomeEmpresa(e.target.value)} required />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Morada fiscal *</label>
              <Textarea
                value={moradaFiscal}
                onChange={(e) => setMoradaFiscal(e.target.value)}
                rows={3}
                required
                placeholder="Rua, código postal, localidade"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Número de contribuinte (NIF) *</label>
              <Input value={nifEmitente} onChange={(e) => setNifEmitente(e.target.value)} required />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-slate-400">IBAN *</label>
                <Input
                  value={iban}
                  onChange={(e) => setIban(e.target.value.toUpperCase())}
                  required
                  placeholder={EXEMPLO_IBAN}
                  className="font-mono"
                />
                <p className="mt-1 text-[10px] text-slate-500">Exemplo: {EXEMPLO_IBAN}</p>
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">BIC/SWIFT *</label>
                <Input
                  value={bicSwift}
                  onChange={(e) => setBicSwift(e.target.value.toUpperCase())}
                  required
                  placeholder={EXEMPLO_BIC}
                  className="font-mono"
                />
                <p className="mt-1 text-[10px] text-slate-500">Exemplo: {EXEMPLO_BIC}</p>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Email do gestor *</label>
              <Input
                type="email"
                value={emailGestor}
                onChange={(e) => setEmailGestor(e.target.value)}
                required
                placeholder="gestor@empresa.pt"
              />
              <p className="mt-1 text-[10px] text-slate-500">
                Preenchido automaticamente com o email da sua conta; pode alterar.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-slate-400">Capital social *</label>
                <Input
                  value={capitalSocial}
                  onChange={(e) => setCapitalSocial(e.target.value)}
                  required
                  placeholder="5.000,00 €"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">
                  Conservatória do Registo Comercial *
                </label>
                <Input
                  value={consRegCom}
                  onChange={(e) => setConsRegCom(e.target.value)}
                  required
                  placeholder="Ex.: Conservatória do Registo Comercial do Porto"
                />
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-200">Série e IVA</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-slate-400">Série padrão</label>
                <Input value={seriePadrao} onChange={(e) => setSeriePadrao(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Taxa IVA padrão (%)</label>
                <Input value={taxaIvaPadrao} onChange={(e) => setTaxaIvaPadrao(e.target.value)} />
              </div>
            </div>
            {series.length > 0 ? (
              <div className="space-y-3 pt-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-slate-500">
                    Códigos de validação AT por série (webservice ou manual)
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void comunicarTodasSeriesAt()}
                  >
                    Registar todas na AT
                  </Button>
                </div>
                {series.map((s) => (
                  <div key={s.id} className="flex flex-wrap items-end gap-2">
                    <div className="min-w-[120px]">
                      <label className="mb-1 block text-xs text-slate-400">
                        {s.tipo} {s.codigo}
                        {s.estadoAt ? (
                          <span className="ml-1 text-slate-600">({s.estadoAt})</span>
                        ) : null}
                      </label>
                      <Input
                        value={serieCodigos[s.id] ?? ""}
                        onChange={(e) =>
                          setSerieCodigos((prev) => ({ ...prev, [s.id]: e.target.value.toUpperCase() }))
                        }
                        placeholder="ABCD1234"
                        maxLength={8}
                        className="font-mono uppercase"
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => void comunicarSerieAt(s.id)}
                    >
                      Registar AT
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => void guardarCodigoSerie(s.id)}
                    >
                      Guardar manual
                    </Button>
                    <span className="text-xs text-slate-500 pb-2">Próx. n.º {s.proximoNumero}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          <section className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-200">Integração AT</h2>
              {integracao ? (
                <Badge variant={modoSandbox ? "default" : integracao.configured ? "green" : "default"}>
                  Modo: {integracao.mode}
                  {sandboxMock ? " (mock local)" : sandboxReal ? " (AT real)" : ""}
                </Badge>
              ) : null}
            </div>
            {sandboxMock ? (
              <p className="text-xs text-amber-400/90 leading-relaxed">
                Sandbox mock (offline): respostas simuladas localmente. Remova{" "}
                <code className="text-amber-200">AT_FATURAS_SANDBOX_MOCK=1</code> para usar a sandbox
                real da AT.
              </p>
            ) : sandboxReal ? (
              <p className="text-xs text-teal-400/90 leading-relaxed">
                Sandbox AT real: comunicação via webservice de testes (
                {integracao.endpoint ?? "porta 700/722"}). Requer certificado TesteWebservices.pfx e
                credenciais WFA/WSE válidas.
              </p>
            ) : null}
            <div>
              <label className="mb-1 block text-xs text-slate-400">N.º certificação software AT</label>
              <Input
                value={softwareCertificado}
                onChange={(e) => setSoftwareCertificado(e.target.value)}
                placeholder={
                  config?.softwareCertificadoEfectivo && !config.softwareCertificado
                    ? `Plataforma: ${config.softwareCertificadoEfectivo}`
                    : "Após aprovação no programa AT"
                }
              />
              {config?.softwareCertificadoEfectivo && !softwareCertificado ? (
                <p className="text-xs text-slate-500 mt-1">
                  A plataforma usa certificado global: {config.softwareCertificadoEfectivo}
                </p>
              ) : null}
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Referência certificado SSL AT</label>
              <Input
                value={atCertificadoRef}
                onChange={(e) => setAtCertificadoRef(e.target.value)}
                placeholder="Identificador do certificado de adesão"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Subutilizador WFA</label>
              <Input
                value={atSubutilizador}
                onChange={(e) => setAtSubutilizador(e.target.value)}
                placeholder="Ex.: 1 ou 123456789/1"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Password WFA</label>
              <Input
                type="password"
                value={atWfaPassword}
                onChange={(e) => setAtWfaPassword(e.target.value)}
                placeholder={
                  atWfaPasswordConfigured
                    ? "•••••••• (configurada - deixe vazio para manter)"
                    : "Password do subutilizador AT"
                }
                autoComplete="new-password"
              />
              {atWfaPasswordConfigured ? (
                <p className="text-xs text-slate-500 mt-1">Password guardada de forma encriptada.</p>
              ) : null}
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={comunicacaoAtiva}
                onChange={(e) => setComunicacaoAtiva(e.target.checked)}
                disabled={comunicacaoBloqueada}
                className="rounded border-slate-600"
              />
              Comunicação AT activa{modoSandbox ? " (sandbox)" : " (produção)"}
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={comunicacaoAutomatica}
                onChange={(e) => setComunicacaoAutomatica(e.target.checked)}
                disabled={!comunicacaoAtiva || comunicacaoBloqueada}
                className="rounded border-slate-600"
              />
              Comunicar automaticamente ao emitir fatura
            </label>
            {producaoBloqueada ? (
              <p className="text-xs text-amber-400/90">
                Complete a checklist de certificação antes de activar comunicação em produção.
              </p>
            ) : null}
            {(modoSandbox || integracao?.configured) && !comunicacaoBloqueada ? (
              <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => void testarAt()}>
                Testar ligação AT
              </Button>
            ) : null}
            <div className="rounded-lg border border-slate-700/40 bg-slate-950/30 p-3 space-y-2">
              <p className="text-xs font-medium text-slate-300">Documentação oficial AT</p>
              <p className="text-xs text-slate-500 leading-relaxed">
                Links antigos do Portal das Finanças (ex. <span className="font-mono">/faturas/Pages/faqs-…</span>)
                podem responder «página não encontrada». Use estes endereços actualizados:
              </p>
              <ul className="space-y-1.5 text-xs">
                <li>
                  <a
                    href={AT_DOC_LINKS.comunicacao2022}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300"
                  >
                    Webservice faturas 2022+ (WSDL e manuais)
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </li>
                <li>
                  <a
                    href={AT_DOC_LINKS.seriesAtcud}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300"
                  >
                    Comunicação de séries e ATCUD
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </li>
                <li>
                  <a
                    href={AT_DOC_LINKS.qrCode}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300"
                  >
                    Código QR (Portaria 195/2020)
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </li>
                <li>
                  <a
                    href={AT_DOC_LINKS.safTpt}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300"
                  >
                    SAF-T (PT) 1.04_01 - estrutura e validadores XSD
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </li>
                <li>
                  <a
                    href={AT_DOC_LINKS.certificacaoSoftware}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300"
                  >
                    Certificação de software de faturação
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </li>
                <li>
                  <a
                    href={AT_DOC_LINKS.svat}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300"
                  >
                    SVAT - selo de validação (programas de contabilidade)
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </li>
                <li>
                  <a
                    href={AT_DOC_LINKS.programasCertificados}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300"
                  >
                    Lista de programas certificados (Modelo 24)
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </li>
                <li>
                  <a
                    href={AT_DOC_LINKS.faqsWebservice}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300"
                  >
                    FAQs webservice e multidocumento
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </li>
                <li>
                  <a
                    href={AT_DOC_LINKS.portalFinancas}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300"
                  >
                    Portal das Finanças (subutilizador WFA e séries)
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </li>
              </ul>
              <p className="text-xs text-slate-600">
                O endpoint WSDL (<span className="font-mono">servicos.portaldasfinancas.gov.pt:400</span>) só responde
                com certificado SSL de produtor - não abre num browser normal.
              </p>
            </div>
          </section>

          <Button type="submit" disabled={busy}>
            <Save className="h-3.5 w-3.5" />
            Guardar configuração
          </Button>
          {config ? (
            <p className="text-xs text-slate-500">
              Faturas emitidas incluem assinatura RSA-SHA1 (com chave AT), ATCUD e QR conforme Portaria 195/2020.
              {modoSandbox
                ? " Em sandbox a comunicação AT é simulada."
                : " Comunicação real só após certificação AT."}
            </p>
          ) : null}
        </form>
      )}
    </div>
  );
}
