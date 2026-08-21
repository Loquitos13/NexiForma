"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, Save } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { useTenantEntitlements } from "@/lib/client/use-tenant-entitlements";
import { canAccessFaturacaoPortal } from "@nexiforma/shared";
import { parseApiError } from "@/lib/ui/backoffice";
import { FaturaTemplatePreview } from "@/components/crm/fatura-template-preview";
import { Alert, Button, Dialog, DialogContent, Input, PageHeader, Textarea } from "@/components/ui";
import { publicTenantLogoUrl } from "@/lib/client/tenant-logo-url";

type TemplateCores = {
  headerMode: "solid" | "gradient";
  headerFrom: string;
  headerVia: string;
  headerTo: string;
  accent: string;
  surface: string;
  border: string;
};

const TEMPLATE_CORES_DEFAULT: TemplateCores = {
  headerMode: "gradient",
  headerFrom: "#6d28d9",
  headerVia: "#9333ea",
  headerTo: "#6366f1",
  accent: "#7c3aed",
  surface: "#f5f3ff",
  border: "#ddd6fe",
};

function normalizeTemplateCores(raw?: Partial<TemplateCores> | null): TemplateCores {
  return {
    headerFrom: raw?.headerFrom?.trim() || TEMPLATE_CORES_DEFAULT.headerFrom,
    headerVia: raw?.headerVia?.trim() || TEMPLATE_CORES_DEFAULT.headerVia,
    headerTo: raw?.headerTo?.trim() || TEMPLATE_CORES_DEFAULT.headerTo,
    accent: raw?.accent?.trim() || TEMPLATE_CORES_DEFAULT.accent,
    surface: raw?.surface?.trim() || TEMPLATE_CORES_DEFAULT.surface,
    border: raw?.border?.trim() || TEMPLATE_CORES_DEFAULT.border,
    headerMode: raw?.headerMode === "solid" ? "solid" : "gradient",
  };
}

function templateCoresKey(c: TemplateCores): string {
  return [
    c.headerMode,
    c.headerFrom,
    c.headerVia,
    c.headerTo,
    c.accent,
    c.surface,
    c.border,
  ].join("|");
}

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
  templateCores?: TemplateCores | null;
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

/** Exemplos válidos para sandbox / demonstração (formato PT). */
const EXEMPLO_IBAN = "PT50000201231234567890154";
const EXEMPLO_BIC = "BBPIPTPL";

export default function CrmFaturacaoConfigPage() {
  const { role, writeDisabled } = useTenantRole();
  const { entitlements } = useTenantEntitlements();
  const canAccessFaturacao = canAccessFaturacaoPortal(role, entitlements);
  const [config, setConfig] = useState<Config | null>(null);
  const [series, setSeries] = useState<Serie[]>([]);
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
  const [serieCodigos, setSerieCodigos] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [comunicarTodasOpen, setComunicarTodasOpen] = useState(false);
  const [templateCores, setTemplateCores] = useState<TemplateCores>(TEMPLATE_CORES_DEFAULT);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [coresReady, setCoresReady] = useState(false);
  const coresReadyRef = useRef(false);
  const savedCoresKeyRef = useRef<string>("");
  const coresPersistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const templateCoresRef = useRef(templateCores);
  templateCoresRef.current = templateCores;

  const applyPayload = useCallback(
    (data: { config: Config; series?: Serie[] }) => {
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
      const cores = normalizeTemplateCores(c.templateCores);
      setTemplateCores(cores);
      savedCoresKeyRef.current = templateCoresKey(cores);
      coresReadyRef.current = true;
      setCoresReady(true);
      if (data.series) {
        setSeries(data.series);
        setSerieCodigos(
          Object.fromEntries(
            data.series.map((s) => [s.id, s.codigoValidacaoAt ?? ""]),
          ),
        );
      }
    },
    [],
  );

  const persistTemplateCores = useCallback(
    async (cores: TemplateCores) => {
      if (writeDisabled) return;
      const payload = normalizeTemplateCores(cores);
      const key = templateCoresKey(payload);
      if (key === savedCoresKeyRef.current) return;

      const res = await bffFetch("/api/v1/crm/config/faturacao", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({ templateCores: payload }),
      });
      if (!res.ok) {
        setError(await parseApiError(res));
        return;
      }
      const body = (await res.json()) as { config?: Config };
      const saved = normalizeTemplateCores(body.config?.templateCores ?? payload);
      savedCoresKeyRef.current = templateCoresKey(saved);
      setTemplateCores(saved);
      setConfig((prev) => (prev ? { ...prev, templateCores: saved } : prev));
      setMsg("Cores do template guardadas.");
    },
    [writeDisabled],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [res, tenantRes, brandingRes] = await Promise.all([
      bffFetch("/api/v1/crm/config/faturacao", {
        headers: { accept: "application/json" },
      }),
      bffFetch("/api/v1/portal/tenant-info", { headers: { accept: "application/json" } }),
      bffFetch("/api/v1/portal/tenant/branding", { headers: { accept: "application/json" } }),
    ]);
    setLoading(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    const body = (await res.json()) as {
      config: Config;
      series: Serie[];
    };
    applyPayload(body);
    const tenant = tenantRes.ok
      ? ((await tenantRes.json()) as { slug?: string })
      : null;
    const branding = brandingRes.ok
      ? ((await brandingRes.json()) as { logoUrl?: string })
      : null;
    setLogoUrl(
      tenant?.slug?.trim() && branding?.logoUrl
        ? publicTenantLogoUrl(tenant.slug, Date.now())
        : null,
    );

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

  // Persiste modo (sólido/gradiente) e cores ao alterar - não depende só do «Guardar».
  useEffect(() => {
    if (!coresReady || writeDisabled || loading) return;
    const key = templateCoresKey(templateCores);
    if (key === savedCoresKeyRef.current) return;
    if (coresPersistTimer.current) clearTimeout(coresPersistTimer.current);
    coresPersistTimer.current = setTimeout(() => {
      void persistTemplateCores(templateCoresRef.current);
    }, 450);
    return () => {
      if (coresPersistTimer.current) {
        clearTimeout(coresPersistTimer.current);
        coresPersistTimer.current = null;
      }
    };
  }, [templateCores, coresReady, writeDisabled, loading, persistTemplateCores]);

  // Flush pendente ao sair da página (só depois do load inicial).
  useEffect(() => {
    return () => {
      if (coresPersistTimer.current) {
        clearTimeout(coresPersistTimer.current);
        coresPersistTimer.current = null;
      }
      if (!coresReadyRef.current || writeDisabled) return;
      const latest = templateCoresRef.current;
      if (templateCoresKey(latest) !== savedCoresKeyRef.current) {
        void persistTemplateCores(latest);
      }
    };
  }, [persistTemplateCores, writeDisabled]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (coresPersistTimer.current) {
      clearTimeout(coresPersistTimer.current);
      coresPersistTimer.current = null;
    }
    setBusy(true);
    setError(null);
    setMsg(null);
    const coresPayload = normalizeTemplateCores(templateCores);
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
      templateCores: coresPayload,
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
    const body = (await res.json()) as { serie?: Serie };
    if (body.serie) {
      setSeries((prev) => prev.map((s) => (s.id === serieId ? body.serie! : s)));
    }
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
    setComunicarTodasOpen(false);
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

  if (!canAccessFaturacao) {
    return (
      <div className="max-w-3xl space-y-4">
        <h1 className="text-2xl font-bold text-slate-50">Faturação</h1>
        <p className="text-sm text-slate-400">
          Módulo de faturação AT reservado ao gestor. Active o add-on <strong>faturacao_at</strong> na
          subscrição para configurar séries e comunicação AT.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-5">
      <PageHeader
        title="Dados de faturação"
        description="Emitente legal, séries, IVA e aparência do documento. A integração AT é configurada pelo superadmin."
        actions={
          <Link href="/portal/crm/faturas">
            <Button size="sm" variant="secondary">
              <ArrowLeft className="h-3.5 w-3.5" />
              Faturas
            </Button>
          </Link>
        }
      />

      <Alert variant="warning">
        Em desenvolvimento… Brevemente - a faturação AT está a ser preparada para disponibilização completa.
      </Alert>

      {error ? <Alert variant="error">{error}</Alert> : null}
      {msg ? <Alert variant="success">{msg}</Alert> : null}

      {loading ? (
        <p className="text-sm text-slate-400">A carregar…</p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-6">
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
            <h2 className="text-sm font-semibold text-slate-200">Cores do template da fatura</h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              Aplicam-se ao PDF/HTML da fatura e à pré-visualização abaixo. O modo (sólido ou
              gradiente) e as cores são guardados automaticamente ao alterar.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs text-slate-400">Cabeçalho</span>
              <div className="inline-flex rounded-lg border border-slate-600/60 p-0.5 bg-slate-950/50">
                <button
                  type="button"
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    templateCores.headerMode === "solid"
                      ? "bg-slate-700 text-slate-100"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                  onClick={() => setTemplateCores((c) => ({ ...c, headerMode: "solid" }))}
                >
                  Cor sólida
                </button>
                <button
                  type="button"
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    templateCores.headerMode === "gradient"
                      ? "bg-slate-700 text-slate-100"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                  onClick={() => setTemplateCores((c) => ({ ...c, headerMode: "gradient" }))}
                >
                  Gradiente
                </button>
              </div>
            </div>

            <div
              className="h-14 border border-slate-700/40"
              style={{
                background:
                  templateCores.headerMode === "solid"
                    ? templateCores.headerFrom
                    : `linear-gradient(135deg, ${templateCores.headerFrom} 0%, ${templateCores.headerVia} 45%, ${templateCores.headerTo} 100%)`,
              }}
              aria-hidden
            />
            <div className="grid gap-3 sm:grid-cols-3">
              {(
                templateCores.headerMode === "solid"
                  ? ([
                      ["headerFrom", "Cor do cabeçalho"],
                      ["accent", "Cor de destaque"],
                      ["surface", "Fundos suaves"],
                      ["border", "Bordas"],
                    ] as const)
                  : ([
                      ["headerFrom", "Gradiente (início)"],
                      ["headerVia", "Gradiente (meio)"],
                      ["headerTo", "Gradiente (fim)"],
                      ["accent", "Cor de destaque"],
                      ["surface", "Fundos suaves"],
                      ["border", "Bordas"],
                    ] as const)
              ).map(([key, label]) => (
                <label key={key} className="grid gap-1 text-xs text-slate-400">
                  {label}
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={templateCores[key]}
                      onChange={(e) =>
                        setTemplateCores((c) => ({ ...c, [key]: e.target.value }))
                      }
                      className="h-9 w-12 cursor-pointer rounded border border-slate-600 bg-transparent"
                    />
                    <Input
                      value={templateCores[key]}
                      onChange={(e) =>
                        setTemplateCores((c) => ({ ...c, [key]: e.target.value }))
                      }
                      className="font-mono text-xs"
                      maxLength={7}
                    />
                  </div>
                </label>
              ))}
            </div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setTemplateCores(TEMPLATE_CORES_DEFAULT)}
            >
              Repor cores padrão
            </Button>

            <FaturaTemplatePreview
              cores={templateCores}
              emitenteNome={nomeEmpresa.trim() || "A sua empresa"}
              emitenteNif={nifEmitente.trim() || "500000000"}
              logoUrl={logoUrl}
            />
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
                    disabled={busy || writeDisabled}
                    onClick={() => setComunicarTodasOpen(true)}
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
                      disabled={busy || writeDisabled}
                      onClick={() => void comunicarSerieAt(s.id)}
                    >
                      Registar AT
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={busy || writeDisabled}
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

          <Alert variant="info">
            A certificação do software e as credenciais AT (WFA, licença Anexo II, comunicação) são
            configuradas pelo superadmin na plataforma NexiForma. Preencha o emitente e as séries;
            quando a integração estiver activa poderá emitir e comunicar faturas.
          </Alert>

          <Button type="submit" disabled={busy || writeDisabled}>
            <Save className="h-3.5 w-3.5" />
            Guardar configuração
          </Button>
          {config ? (
            <p className="text-xs text-slate-500">
              Faturas emitidas incluem assinatura RSA-SHA1 (com chave AT), ATCUD e QR conforme Portaria
              195/2020.
            </p>
          ) : null}
        </form>
      )}

      <Dialog open={comunicarTodasOpen} onOpenChange={setComunicarTodasOpen}>
        <DialogContent
          title="Comunicar séries à AT"
          description="Todas as séries configuradas serão registadas no webservice da Autoridade Tributária. Confirma que os códigos e credenciais estão correctos?"
        >
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setComunicarTodasOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={busy} onClick={() => void comunicarTodasSeriesAt()}>
              Confirmar comunicação
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
