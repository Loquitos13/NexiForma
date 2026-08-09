"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, Circle, ExternalLink, Save, Shield } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
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
  atSubutilizador: string | null;
  atWfaPasswordConfigured?: boolean;
  atCertificadoRef: string | null;
  softwareCertificado: string | null;
  softwareCertificadoEfectivo?: string | null;
  comunicacaoAtiva: boolean;
  comunicacaoAutomatica?: boolean;
};

type LicencaAt = {
  versao: string;
  texto: string;
  aceite: boolean;
  aceiteEm: string | null;
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

export default function PlataformaTenantFaturacaoPage() {
  const params = useParams();
  const tenantId = params.id as string;

  const [tenantName, setTenantName] = useState<string>("");
  const [config, setConfig] = useState<Config | null>(null);
  const [certificacao, setCertificacao] = useState<Certificacao | null>(null);
  const [integracao, setIntegracao] = useState<Integracao | null>(null);
  const [licencaAt, setLicencaAt] = useState<LicencaAt | null>(null);
  const [softwareCertificado, setSoftwareCertificado] = useState("");
  const [atCertificadoRef, setAtCertificadoRef] = useState("");
  const [atSubutilizador, setAtSubutilizador] = useState("");
  const [atWfaPassword, setAtWfaPassword] = useState("");
  const [atWfaPasswordConfigured, setAtWfaPasswordConfigured] = useState(false);
  const [comunicacaoAtiva, setComunicacaoAtiva] = useState(false);
  const [comunicacaoAutomatica, setComunicacaoAutomatica] = useState(false);
  const [aceitarLicenca, setAceitarLicenca] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const applyPayload = useCallback(
    (data: {
      config: Config;
      certificacao?: Certificacao;
      integracao?: Integracao;
      licencaAt?: LicencaAt;
    }) => {
      const c = data.config;
      setConfig(c);
      setSoftwareCertificado(c.softwareCertificado ?? "");
      setAtCertificadoRef(c.atCertificadoRef ?? "");
      setAtSubutilizador(c.atSubutilizador ?? "");
      setAtWfaPassword("");
      setAtWfaPasswordConfigured(!!c.atWfaPasswordConfigured);
      setComunicacaoAtiva(c.comunicacaoAtiva);
      setComunicacaoAutomatica(!!c.comunicacaoAutomatica);
      if (data.licencaAt) {
        setLicencaAt(data.licencaAt);
        setAceitarLicenca(false);
      }
      if (data.certificacao) setCertificacao(data.certificacao);
      if (data.integracao) setIntegracao(data.integracao);
    },
    [],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [fatRes, tenantRes] = await Promise.all([
      bffFetch(`/api/v1/control-plane/tenants/${tenantId}/faturacao`, {
        headers: { accept: "application/json" },
      }),
      bffFetch(`/api/v1/control-plane/tenants/${tenantId}`, {
        headers: { accept: "application/json" },
      }),
    ]);
    setLoading(false);
    if (!fatRes.ok) {
      setError(await parseApiError(fatRes));
      return;
    }
    applyPayload(await fatRes.json());
    if (tenantRes.ok) {
      const t = (await tenantRes.json()) as { legalName?: string; slug?: string };
      setTenantName(t.legalName || t.slug || tenantId);
    }
  }, [applyPayload, tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMsg(null);
    const payload = {
      atSubutilizador: atSubutilizador.trim() || null,
      ...(atWfaPassword.trim() ? { atWfaPassword: atWfaPassword.trim() } : {}),
      atCertificadoRef: atCertificadoRef.trim() || null,
      softwareCertificado: softwareCertificado.trim() || null,
      comunicacaoAtiva,
      comunicacaoAutomatica,
      ...(aceitarLicenca && !licencaAt?.aceite ? { aceitarLicencaAtWs: true } : {}),
    };
    const res = await bffFetch(`/api/v1/control-plane/tenants/${tenantId}/faturacao`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    setMsg("Integração AT guardada.");
    applyPayload(await res.json());
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

    const saveRes = await bffFetch(`/api/v1/control-plane/tenants/${tenantId}/faturacao`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        atSubutilizador: atSubutilizador.trim() || null,
        ...(atWfaPassword.trim() ? { atWfaPassword: atWfaPassword.trim() } : {}),
        atCertificadoRef: atCertificadoRef.trim() || null,
        softwareCertificado: softwareCertificado.trim() || null,
        comunicacaoAtiva,
        comunicacaoAutomatica,
        ...(aceitarLicenca && !licencaAt?.aceite ? { aceitarLicencaAtWs: true } : {}),
      }),
    });
    if (!saveRes.ok) {
      setBusy(false);
      setError(await parseApiError(saveRes));
      return;
    }
    applyPayload(await saveRes.json());

    const res = await bffFetch(`/api/v1/control-plane/tenants/${tenantId}/faturacao/testar-at`, {
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

  const emitenteOk = Boolean(
    config?.nomeEmpresa?.trim() &&
      config?.nifEmitente?.trim() &&
      config?.moradaFiscal?.trim() &&
      config?.iban?.trim() &&
      config?.bicSwift?.trim() &&
      config?.emailGestor?.trim() &&
      config?.capitalSocial?.trim() &&
      config?.consRegCom?.trim(),
  );

  return (
    <div className="max-w-2xl space-y-5">
      <PageHeader
        title="Faturação AT"
        description={
          tenantName
            ? `Certificação e integração AT · ${tenantName}`
            : "Certificação e integração AT do tenant"
        }
        actions={
          <Link href={`/plataforma/tenantes/${tenantId}`}>
            <Button size="sm" variant="secondary">
              <ArrowLeft className="h-3.5 w-3.5" />
              Voltar ao tenant
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
          <Alert variant="info">
            O gestor preenche o emitente, séries e cores no portal. Aqui configura a certificação do
            software e as credenciais AT (WFA, licença, comunicação).
          </Alert>

          <section className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4 space-y-2">
            <h2 className="text-sm font-semibold text-slate-200">Emitente (gestor)</h2>
            {emitenteOk ? (
              <p className="text-xs text-emerald-400">
                Dados do emitente preenchidos pelo gestor · NIF {config?.nifEmitente} ·{" "}
                {config?.nomeEmpresa}
              </p>
            ) : (
              <p className="text-xs text-amber-400">
                Emitente incompleto - o gestor deve completar nome, NIF, morada, IBAN/BIC, email,
                capital social e Conservatória no portal (CRM → Faturação).
              </p>
            )}
          </section>

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
                {integracao?.endpoint ?? "porta 700/722"}). Requer certificado TesteWebservices.pfx e
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
            <div className="rounded-lg border border-amber-500/25 bg-amber-950/20 p-3 space-y-3">
              <p className="text-xs font-medium text-amber-200">
                Licença Anexo II - Serviços web AT
              </p>
              <p className="text-xs text-slate-400 leading-relaxed">
                O Contrato de adesão exige que o contribuinte aceite expressamente a licença de
                utilização antes de invocar os webservices de comunicação de faturas.
              </p>
              {licencaAt?.texto ? (
                <Textarea
                  readOnly
                  value={licencaAt.texto}
                  className="min-h-[180px] text-[11px] font-mono leading-relaxed text-slate-300"
                />
              ) : (
                <p className="text-xs text-slate-500">A carregar texto da licença…</p>
              )}
              {licencaAt?.aceite ? (
                <p className="text-xs text-emerald-400">
                  Licença aceite
                  {licencaAt.aceiteEm
                    ? ` em ${new Date(licencaAt.aceiteEm).toLocaleString("pt-PT")}`
                    : ""}
                  {licencaAt.versao ? ` · versão ${licencaAt.versao}` : ""}.
                </p>
              ) : (
                <label className="flex items-start gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={aceitarLicenca}
                    onChange={(e) => setAceitarLicenca(e.target.checked)}
                    disabled={busy}
                    className="mt-1 rounded border-slate-600"
                  />
                  <span>
                    Li e aceito a Licença de utilização dos serviços web da AT (Anexo II). Sem este
                    aceite não é possível activar a comunicação nem testar a ligação.
                  </span>
                </label>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={comunicacaoAtiva}
                onChange={(e) => setComunicacaoAtiva(e.target.checked)}
                disabled={comunicacaoBloqueada || (!licencaAt?.aceite && !aceitarLicenca)}
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
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={busy || !licencaAt?.aceite}
                onClick={() => void testarAt()}
              >
                Testar ligação AT
              </Button>
            ) : null}
            <div className="rounded-lg border border-slate-700/40 bg-slate-950/30 p-3 space-y-2">
              <p className="text-xs font-medium text-slate-300">Documentação oficial AT</p>
              <ul className="space-y-1.5 text-xs">
                <li>
                  <a
                    href={AT_DOC_LINKS.comunicacao2022}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300"
                  >
                    Webservice faturas 2022+
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
                    href={AT_DOC_LINKS.portalFinancas}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300"
                  >
                    Portal das Finanças (subutilizador WFA)
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </li>
              </ul>
            </div>
          </section>

          <Button type="submit" disabled={busy}>
            <Save className="h-3.5 w-3.5" />
            Guardar integração AT
          </Button>
        </form>
      )}
    </div>
  );
}
