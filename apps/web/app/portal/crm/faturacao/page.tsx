"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, CheckCircle2, Circle, ExternalLink, Save, Shield } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { parseApiError } from "@/lib/ui/backoffice";
import { Alert, Badge, Button, Input, PageHeader, Textarea } from "@/components/ui";

type Config = {
  nomeEmpresa: string;
  moradaFiscal: string | null;
  nifEmitente: string;
  regimeIva: string;
  seriePadraoCodigo: string;
  taxaIvaPadrao: number | string;
  atSubutilizador: string | null;
  atWfaPasswordConfigured?: boolean;
  atCertificadoRef: string | null;
  softwareCertificado: string | null;
  softwareCertificadoEfectivo?: string | null;
  comunicacaoAtiva: boolean;
};

type Serie = {
  id: string;
  codigo: string;
  tipo: string;
  codigoValidacaoAt: string | null;
  proximoNumero: number;
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
};

export default function CrmFaturacaoConfigPage() {
  const { canManage } = useTenantRole();
  const [config, setConfig] = useState<Config | null>(null);
  const [series, setSeries] = useState<Serie[]>([]);
  const [certificacao, setCertificacao] = useState<Certificacao | null>(null);
  const [integracao, setIntegracao] = useState<Integracao | null>(null);
  const [nomeEmpresa, setNomeEmpresa] = useState("");
  const [moradaFiscal, setMoradaFiscal] = useState("");
  const [nifEmitente, setNifEmitente] = useState("");
  const [taxaIvaPadrao, setTaxaIvaPadrao] = useState("23");
  const [seriePadrao, setSeriePadrao] = useState("");
  const [atSubutilizador, setAtSubutilizador] = useState("");
  const [atWfaPassword, setAtWfaPassword] = useState("");
  const [atWfaPasswordConfigured, setAtWfaPasswordConfigured] = useState(false);
  const [atCertificadoRef, setAtCertificadoRef] = useState("");
  const [softwareCertificado, setSoftwareCertificado] = useState("");
  const [comunicacaoAtiva, setComunicacaoAtiva] = useState(false);
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
      setTaxaIvaPadrao(String(Number(c.taxaIvaPadrao)));
      setSeriePadrao(c.seriePadraoCodigo);
      setAtSubutilizador(c.atSubutilizador ?? "");
      setAtWfaPassword("");
      setAtWfaPasswordConfigured(!!c.atWfaPasswordConfigured);
      setAtCertificadoRef(c.atCertificadoRef ?? "");
      setSoftwareCertificado(c.softwareCertificado ?? "");
      setComunicacaoAtiva(c.comunicacaoAtiva);
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
    applyPayload((await res.json()) as {
      config: Config;
      series: Serie[];
      certificacao: Certificacao;
      integracao: Integracao;
    });
  }, [applyPayload]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMsg(null);
    const res = await bffFetch("/api/v1/crm/config/faturacao", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        nomeEmpresa: nomeEmpresa.trim(),
        moradaFiscal: moradaFiscal.trim() || null,
        nifEmitente: nifEmitente.trim(),
        taxaIvaPadrao: Number.parseFloat(taxaIvaPadrao.replace(",", ".")),
        seriePadraoCodigo: seriePadrao.trim(),
        atSubutilizador: atSubutilizador.trim() || null,
        ...(atWfaPassword.trim() ? { atWfaPassword: atWfaPassword.trim() } : {}),
        atCertificadoRef: atCertificadoRef.trim() || null,
        softwareCertificado: softwareCertificado.trim() || null,
        comunicacaoAtiva,
      }),
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

  const producaoBloqueada =
    integracao?.mode === "production" && !certificacao?.prontaProducao;

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
                <Badge variant={certificacao.prontaProducao ? "green" : "default"}>
                  {certificacao.prontaProducao ? "Pronto produção" : "Em preparação"}
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
                href="https://www.gov.pt/servicos/programa-de-faturacao-certificacao"
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
            <h2 className="text-sm font-semibold text-slate-200">Emitente (obrigatório por lei)</h2>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Nome da empresa *</label>
              <Input value={nomeEmpresa} onChange={(e) => setNomeEmpresa(e.target.value)} required />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Morada fiscal (sede) *</label>
              <Textarea
                value={moradaFiscal}
                onChange={(e) => setMoradaFiscal(e.target.value)}
                rows={3}
                required
                placeholder="Rua, código postal, localidade"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">NIF *</label>
              <Input value={nifEmitente} onChange={(e) => setNifEmitente(e.target.value)} required />
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
                <p className="text-xs text-slate-500">Códigos de validação AT por série (8 caracteres)</p>
                {series.map((s) => (
                  <div key={s.id} className="flex flex-wrap items-end gap-2">
                    <div className="min-w-[120px]">
                      <label className="mb-1 block text-xs text-slate-400">
                        {s.tipo} {s.codigo}
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
                      onClick={() => void guardarCodigoSerie(s.id)}
                    >
                      Guardar
                    </Button>
                    <span className="text-xs text-slate-500 pb-2">Próx. n.º {s.proximoNumero}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          <section className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-200">Integração AT</h2>
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
                disabled={producaoBloqueada}
                className="rounded border-slate-600"
              />
              Comunicação AT activa (produção)
            </label>
            {producaoBloqueada ? (
              <p className="text-xs text-amber-400/90">
                Complete a checklist de certificação antes de activar comunicação em produção.
              </p>
            ) : null}
          </section>

          <Button type="submit" disabled={busy}>
            <Save className="h-3.5 w-3.5" />
            Guardar configuração
          </Button>
          {config ? (
            <p className="text-xs text-slate-500">
              Faturas emitidas incluem hash de integridade SHA-256 e ATCUD. Comunicação real só após certificação AT.
            </p>
          ) : null}
        </form>
      )}
    </div>
  );
}
