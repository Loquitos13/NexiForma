"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Shield, Save } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { parseApiError } from "@/lib/ui/backoffice";
import { Alert, Button, Input } from "@/components/ui";

type TenantUserRole = "ADMIN" | "COORDENADOR" | "FORMADOR" | "FORMANDO" | "FINANCEIRO" | "COMERCIAL";

type SigoAcaoAcesso =
  | "configurar"
  | "submeter"
  | "reconciliar"
  | "sincronizar"
  | "certificar"
  | "emitirCertificadoLocal"
  | "descarregarSigo"
  | "notificarFormandos";

type PerfisAcesso = Record<SigoAcaoAcesso, TenantUserRole[]>;

type TenantSigoConfig = {
  integracaoAtiva: boolean;
  protocolo: "soap" | "http";
  nifEntidade: string;
  codigoEntidade: string | null;
  denominacaoEntidade: string | null;
  baseUrlOverride: string | null;
  wsdlUrl: string | null;
  soapEndpoint: string | null;
  soapUsername: string | null;
  soapPasswordConfigured: boolean;
  ipAutorizado: string | null;
  regiaoPortal: "CONTINENTE" | "MADEIRA" | "ACORES";
  apiKeyConfigured: boolean;
  perfisAcesso: PerfisAcesso;
  ultimoTesteOkEm: string | null;
  ultimoTesteMsg: string | null;
  prontoProducao: boolean;
  avisos: string[];
};

const ROLES: TenantUserRole[] = ["ADMIN", "COORDENADOR", "FORMADOR", "FORMANDO", "FINANCEIRO", "COMERCIAL"];

const ACOES: { id: SigoAcaoAcesso; label: string }[] = [
  { id: "configurar", label: "Configurar integração" },
  { id: "submeter", label: "Submeter à SIGO" },
  { id: "reconciliar", label: "Reconciliar submissões" },
  { id: "sincronizar", label: "Sincronizar PDFs" },
  { id: "certificar", label: "Certificar (fluxo completo)" },
  { id: "emitirCertificadoLocal", label: "Emitir certificado local" },
  { id: "descarregarSigo", label: "Descarregar certificado SIGO" },
  { id: "notificarFormandos", label: "Notificar formandos" },
];

const ROLE_LABELS: Record<TenantUserRole, string> = {
  ADMIN: "Admin",
  COORDENADOR: "Coordenador",
  FORMADOR: "Formador",
  FORMANDO: "Formando",
  FINANCEIRO: "Financeiro",
  COMERCIAL: "Comercial",
};

type Props = {
  onSaved?: () => void;
};

export function SigoTenantConfigPanel({ onSaved }: Props) {
  const [cfg, setCfg] = useState<TenantSigoConfig | null>(null);
  const [integracaoAtiva, setIntegracaoAtiva] = useState(false);
  const [protocolo, setProtocolo] = useState<"soap" | "http">("soap");
  const [nifEntidade, setNifEntidade] = useState("");
  const [codigoEntidade, setCodigoEntidade] = useState("");
  const [denominacaoEntidade, setDenominacaoEntidade] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [baseUrlOverride, setBaseUrlOverride] = useState("");
  const [wsdlUrl, setWsdlUrl] = useState("");
  const [soapEndpoint, setSoapEndpoint] = useState("");
  const [soapUsername, setSoapUsername] = useState("");
  const [soapPassword, setSoapPassword] = useState("");
  const [ipAutorizado, setIpAutorizado] = useState("");
  const [regiaoPortal, setRegiaoPortal] = useState<"CONTINENTE" | "MADEIRA" | "ACORES">("CONTINENTE");
  const [perfis, setPerfis] = useState<PerfisAcesso | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [testBusy, setTestBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await bffFetch("/api/v1/sigo/tenant-config", { headers: { accept: "application/json" } });
    setLoading(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    const data = (await res.json()) as TenantSigoConfig;
    setCfg(data);
    setIntegracaoAtiva(data.integracaoAtiva);
    setProtocolo(data.protocolo ?? "soap");
    setNifEntidade(data.nifEntidade);
    setCodigoEntidade(data.codigoEntidade ?? "");
    setDenominacaoEntidade(data.denominacaoEntidade ?? "");
    setBaseUrlOverride(data.baseUrlOverride ?? "");
    setWsdlUrl(data.wsdlUrl ?? "");
    setSoapEndpoint(data.soapEndpoint ?? "");
    setSoapUsername(data.soapUsername ?? "");
    setIpAutorizado(data.ipAutorizado ?? "");
    setRegiaoPortal(data.regiaoPortal ?? "CONTINENTE");
    setPerfis(data.perfisAcesso);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function togglePerfil(acao: SigoAcaoAcesso, role: TenantUserRole) {
    if (!perfis) return;
    const cur = perfis[acao] ?? [];
    const next = cur.includes(role) ? cur.filter((r) => r !== role) : [...cur, role];
    setPerfis({ ...perfis, [acao]: next });
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMsg(null);
    const body: Record<string, unknown> = {
      integracaoAtiva,
      protocolo,
      nifEntidade,
      codigoEntidade: codigoEntidade || undefined,
      denominacaoEntidade: denominacaoEntidade || undefined,
      baseUrlOverride: baseUrlOverride.trim() || null,
      wsdlUrl: wsdlUrl.trim() || null,
      soapEndpoint: soapEndpoint.trim() || null,
      soapUsername: soapUsername.trim() || null,
      ipAutorizado: ipAutorizado.trim() || null,
      regiaoPortal,
      perfisAcesso: perfis ?? undefined,
    };
    if (apiKey.trim()) body.apiKey = apiKey.trim();
    if (soapPassword.trim()) body.soapPassword = soapPassword.trim();

    const res = await bffFetch("/api/v1/sigo/tenant-config", {
      method: "PUT",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    const data = (await res.json()) as TenantSigoConfig;
    setCfg(data);
    setApiKey("");
    setSoapPassword("");
    setMsg("Configuração SIGO guardada.");
    onSaved?.();
  }

  async function testar() {
    setTestBusy(true);
    setError(null);
    setMsg(null);
    const res = await bffFetch("/api/v1/sigo/config/testar", { method: "POST" });
    setTestBusy(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    const data = (await res.json()) as { ok?: boolean; message?: string };
    setMsg(data.ok ? `Teste OK: ${data.message ?? ""}` : `Teste falhou: ${data.message ?? ""}`);
    await load();
  }

  if (loading) {
    return <p className="text-sm text-slate-500">A carregar configuração SIGO…</p>;
  }

  return (
    <div className="rounded-2xl bg-slate-900/50 border border-slate-700/30 p-5 space-y-4">
      <div className="flex items-start gap-3">
        <Shield className="w-5 h-5 text-purple-400 mt-0.5 shrink-0" />
        <div>
          <h2 className="text-sm font-semibold text-slate-200">Acesso SIGO desta entidade</h2>
          <p className="text-xs text-slate-500 mt-1">
            Cada entidade formadora configura as credenciais DGEEC e define quem pode submeter, certificar e descarregar.
          </p>
        </div>
      </div>

      {error ? <Alert variant="error">{error}</Alert> : null}
      {msg ? <Alert variant="success">{msg}</Alert> : null}

      {cfg ? (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span
            className={`inline-flex px-2 py-0.5 rounded-md font-medium ${
              cfg.prontoProducao ? "bg-green-500/10 text-green-400" : "bg-amber-500/10 text-amber-300"
            }`}
          >
            {cfg.prontoProducao ? "Pronto para produção" : "Configuração incompleta"}
          </span>
          {cfg.soapPasswordConfigured || cfg.apiKeyConfigured ? (
            <span className="text-slate-500">Credenciais configuradas ({cfg.protocolo})</span>
          ) : (
            <span className="text-amber-400">Credenciais em falta</span>
          )}
          {cfg.ultimoTesteMsg ? (
            <span className="text-slate-500">Último teste: {cfg.ultimoTesteMsg}</span>
          ) : null}
        </div>
      ) : null}

      {cfg?.avisos.length ? (
        <ul className="text-xs text-amber-200/90 space-y-1 list-disc list-inside">
          {cfg.avisos.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      ) : null}

      <form onSubmit={(e) => void guardar(e)} className="space-y-4">
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={integracaoAtiva}
            onChange={(e) => setIntegracaoAtiva(e.target.checked)}
            className="rounded border-slate-600"
          />
          Integração SIGO activa
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Protocolo</label>
            <select
              value={protocolo}
              onChange={(e) => setProtocolo(e.target.value as "soap" | "http")}
              className="w-full rounded-lg bg-slate-800 border border-slate-600 text-sm text-slate-200 px-3 py-2"
            >
              <option value="soap">SOAP / WS-Security (DGEEC)</option>
              <option value="http">HTTP / JSON (dev)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Região SIGO</label>
            <select
              value={regiaoPortal}
              onChange={(e) => setRegiaoPortal(e.target.value as typeof regiaoPortal)}
              className="w-full rounded-lg bg-slate-800 border border-slate-600 text-sm text-slate-200 px-3 py-2"
            >
              <option value="CONTINENTE">Continente</option>
              <option value="MADEIRA">Madeira (RAM)</option>
              <option value="ACORES">Açores (RAA)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">NIF entidade formadora</label>
            <Input value={nifEntidade} onChange={(e) => setNifEntidade(e.target.value)} maxLength={9} required />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Código entidade (DGEEC)</label>
            <Input value={codigoEntidade} onChange={(e) => setCodigoEntidade(e.target.value)} placeholder="Opcional" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-400 mb-1">Denominação</label>
            <Input value={denominacaoEntidade} onChange={(e) => setDenominacaoEntidade(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-400 mb-1">IP público autorizado (whitelist DGEEC)</label>
            <Input
              value={ipAutorizado}
              onChange={(e) => setIpAutorizado(e.target.value)}
              placeholder="Ex: 203.0.113.10"
            />
          </div>
          {protocolo === "soap" ? (
            <>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-400 mb-1">URL WSDL</label>
                <Input value={wsdlUrl} onChange={(e) => setWsdlUrl(e.target.value)} placeholder="https://…/ServiceMatriculas?wsdl" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-400 mb-1">Endpoint SOAP</label>
                <Input value={soapEndpoint} onChange={(e) => setSoapEndpoint(e.target.value)} placeholder="https://…/ServiceMatriculas" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Utilizador WS-Security</label>
                <Input value={soapUsername} onChange={(e) => setSoapUsername(e.target.value)} autoComplete="off" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Password WS-Security</label>
                <Input
                  type="password"
                  value={soapPassword}
                  onChange={(e) => setSoapPassword(e.target.value)}
                  placeholder={cfg?.soapPasswordConfigured ? "•••••••• (deixar vazio para manter)" : "Password SIGO"}
                  autoComplete="off"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">API key SIGO</label>
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={cfg?.apiKeyConfigured ? "•••••••• (deixar vazio para manter)" : "Bearer token"}
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">URL base (override)</label>
                <Input
                  value={baseUrlOverride}
                  onChange={(e) => setBaseUrlOverride(e.target.value)}
                  placeholder="Opcional – usa URL da plataforma"
                />
              </div>
            </>
          )}
        </div>

        {perfis ? (
          <div className="rounded-xl border border-slate-700/40 overflow-x-auto">
            <table className="w-full text-xs min-w-[520px]">
              <thead>
                <tr className="border-b border-slate-700/30 text-slate-500">
                  <th className="text-left px-3 py-2">Acção</th>
                  {ROLES.map((r) => (
                    <th key={r} className="px-2 py-2 text-center">
                      {ROLE_LABELS[r]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/20">
                {ACOES.map((a) => (
                  <tr key={a.id}>
                    <td className="px-3 py-2 text-slate-300">{a.label}</td>
                    {ROLES.map((r) => (
                      <td key={r} className="px-2 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={(perfis[a.id] ?? []).includes(r)}
                          onChange={() => togglePerfil(a.id, r)}
                          className="rounded border-slate-600"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" disabled={busy}>
            <Save className="w-3.5 h-3.5 mr-1" />
            {busy ? "A guardar…" : "Guardar configuração"}
          </Button>
          <Button type="button" size="sm" variant="secondary" disabled={testBusy} onClick={() => void testar()}>
            {testBusy ? "A testar…" : "Testar ligação"}
          </Button>
        </div>
      </form>
    </div>
  );
}
