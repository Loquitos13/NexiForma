"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { Download, RefreshCw, Upload } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { parseApiError } from "@/lib/ui/backoffice";
import { Alert, Button, Card, CardContent, PageHeader, TableScroll } from "@/components/ui";
import { SigoTenantConfigPanel } from "@/components/portal/sigo-tenant-config";

type SigoErro = { codigo?: string; mensagem: string; campo?: string };

type Submissao = {
  id: string;
  acaoFormacaoId: string;
  referenceId: string;
  estado: string;
  erros: SigoErro[] | null;
  submittedAt: string | null;
  reconciledAt: string | null;
  createdAt: string;
  acaoFormacao?: { codigoInterno: string; titulo: string };
  _count?: { sincronizacoesFormando: number };
};

type SyncFormando = {
  id: string;
  matriculaId: string;
  formandoNome: string;
  nif: string;
  operacao: string;
  transacaoId: string | null;
  estado: string;
  soapFaultCode: string | null;
  soapFaultString: string | null;
  responseResumo: string | null;
  updatedAt: string;
};

type SyncHistorico = {
  submissaoId: string;
  resumo: { total: number; sucesso: number; erro: number; duplicado: number; pendente: number };
  formandos: SyncFormando[];
};

type SigoConfig = {
  mode: string;
  configured: boolean;
  baseUrl?: string | null;
  payloadFormat?: string;
  platformBaseUrl?: string | null;
  tenant?: { prontoProducao?: boolean; integracaoAtiva?: boolean };
};

type CertificadoSigo = {
  id: string;
  matriculaId: string;
  formandoNome: string;
  nif: string | null;
  estado: string;
  numeroCertificado: string | null;
  emitidoEm: string | null;
  sincronizadoEm: string | null;
  temFicheiro: boolean;
};

type SyncResumo = {
  totalRemotos: number;
  associados: number;
  disponiveis: number;
  transferidos: number;
  pendentes: number;
  erros: number;
  certificados: CertificadoSigo[];
};

const estadoStyle: Record<string, string> = {
  ACEITE: "bg-green-500/10 text-green-400 border-green-500/20",
  REJEITADA: "bg-red-500/10 text-red-400 border-red-500/20",
  ERRO: "bg-red-500/10 text-red-400 border-red-500/20",
  SUBMETIDA: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  PENDENTE: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  SUCESSO: "bg-green-500/10 text-green-400 border-green-500/20",
  DUPLICADO: "bg-amber-500/10 text-amber-300 border-amber-500/20",
};

export default function SigoPage() {
  const { canManageFormacao: canManage } = useTenantRole();
  const [config, setConfig] = useState<SigoConfig | null>(null);
  const [rows, setRows] = useState<Submissao[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyCertId, setBusyCertId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [certificados, setCertificados] = useState<Record<string, CertificadoSigo[]>>({});
  const [syncHistorico, setSyncHistorico] = useState<Record<string, SyncHistorico>>({});
  const [expandedSyncId, setExpandedSyncId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [testBusy, setTestBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [c, s] = await Promise.all([
      bffFetch("/api/v1/sigo/config", { headers: { accept: "application/json" } }),
      bffFetch("/api/v1/sigo/submissoes", { headers: { accept: "application/json" } }),
    ]);
    if (c.ok) setConfig((await c.json()) as SigoConfig);
    if (!s.ok) setError(await parseApiError(s));
    else setRows((await s.json()) as Submissao[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function testarLigacao() {
    if (!canManage) return;
    setTestBusy(true);
    setMsg(null);
    setError(null);
    const res = await bffFetch("/api/v1/sigo/config/testar", { method: "POST" });
    setTestBusy(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    const data = (await res.json()) as { ok?: boolean; message?: string };
    setMsg(data.ok ? `Ligação OK: ${data.message ?? ""}` : `Falha: ${data.message ?? "erro"}`);
  }

  async function reconciliar(id: string) {
    if (!canManage) return;
    setBusy(true);
    setMsg(null);
    setError(null);
    const res = await bffFetch(`/api/v1/sigo/submissoes/${id}/reconciliar`, { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    setMsg("Submissão reconciliada.");
    await load();
  }

  async function sincronizarCertificados(id: string, force = false) {
    if (!canManage) return;
    setBusyCertId(id);
    setMsg(null);
    setError(null);
    const qs = force ? "?force=true" : "";
    const res = await bffFetch(`/api/v1/sigo/submissoes/${id}/certificados/sincronizar${qs}`, { method: "POST" });
    setBusyCertId(null);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    const data = (await res.json()) as SyncResumo;
    setCertificados((prev) => ({ ...prev, [id]: data.certificados }));
    setExpandedId(id);
    setMsg(
      `Certificados sincronizados: ${data.transferidos} PDF(s), ${data.disponiveis} disponíveis, ${data.pendentes} pendentes.`,
    );
  }

  async function carregarSincronizacoes(id: string) {
    if (syncHistorico[id]) {
      setExpandedSyncId(expandedSyncId === id ? null : id);
      return;
    }
    const res = await bffFetch(`/api/v1/sigo/submissoes/${id}/sincronizacoes`, {
      headers: { accept: "application/json" },
    });
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    const data = (await res.json()) as SyncHistorico;
    setSyncHistorico((prev) => ({ ...prev, [id]: data }));
    setExpandedSyncId(id);
  }

  async function carregarCertificados(id: string) {
    if (certificados[id]) {
      setExpandedId(expandedId === id ? null : id);
      return;
    }
    const res = await bffFetch(`/api/v1/sigo/submissoes/${id}/certificados`, { headers: { accept: "application/json" } });
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    const rows = (await res.json()) as Array<{
      id: string;
      matriculaId: string;
      estado: string;
      numeroCertificado: string | null;
      emitidoEm: string | null;
      sincronizadoEm: string | null;
      storageKey: string | null;
      matricula: { formando: { nome: string; nif: string | null } };
    }>;
    setCertificados((prev) => ({
      ...prev,
      [id]: rows.map((c) => ({
        id: c.id,
        matriculaId: c.matriculaId,
        formandoNome: c.matricula.formando.nome,
        nif: c.matricula.formando.nif,
        estado: c.estado,
        numeroCertificado: c.numeroCertificado,
        emitidoEm: c.emitidoEm,
        sincronizadoEm: c.sincronizadoEm,
        temFicheiro: Boolean(c.storageKey),
      })),
    }));
    setExpandedId(id);
  }

  function downloadCertificado(certId: string) {
    window.open(`/api/v1/sigo/certificados/${certId}/download`, "_blank", "noopener,noreferrer");
  }

  async function reenviar(id: string) {
    if (!canManage) return;
    setBusy(true);
    setMsg(null);
    setError(null);
    const res = await bffFetch(`/api/v1/sigo/submissoes/${id}/reenviar`, { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    setMsg("Nova submissão criada.");
    await load();
  }

  return (
    <>
      <PageHeader
        title="SIGO"
        description="Submissões, reconciliação e trilho de auditoria para importação oficial DGEEC."
      />

      {error ? <Alert variant="error" className="mb-4">{error}</Alert> : null}
      {msg ? <Alert variant="success" className="mb-4">{msg}</Alert> : null}

      {canManage ? <SigoTenantConfigPanel onSaved={() => void load()} /> : null}

      {config ? (
        <Card className="mb-6">
        <CardContent className="pt-5 space-y-3">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-slate-400">Modo API:</span>
            <span className="font-semibold text-slate-200">{config.mode}</span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${
                config.configured ? "bg-green-500/10 text-green-400" : "bg-slate-500/10 text-slate-500"
              }`}
            >
              {config.configured ? "API activa" : "Modo manual"}
            </span>
            {config.baseUrl ? (
              <span className="text-xs text-slate-500 font-mono truncate max-w-xs">{config.baseUrl}</span>
            ) : null}
          </div>
          {!config.configured || config.mode === "disabled" ? (
            <p className="text-xs text-amber-200/90">
              Configure credenciais SIGO acima (SOAP/WS-Security ou HTTP dev). Em produção cada entidade usa o seu
              acesso; a plataforma define o modo (
              <code className="text-amber-100">{config.mode}</code>
              ).
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-slate-500">
                Reconciliação actualiza estados (SUBMETIDA → ACEITE/REJEITADA) e sincroniza certificados PDF.
                {config.payloadFormat ? ` Payload: ${config.payloadFormat}.` : ""}
              </p>
              <Button type="button" size="sm" variant="secondary" disabled={testBusy} onClick={() => void testarLigacao()}>
                {testBusy ? "A testar…" : "Testar ligação SIGO"}
              </Button>
            </div>
          )}
        </CardContent>
        </Card>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-500">A carregar…</p>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Upload className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-500">Sem submissões SIGO.</p>
            <p className="text-xs text-slate-600 mt-1">Submeta uma acção a partir do dossiê pedagógico.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
        <TableScroll>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/30">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Acção</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Referência</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Estado</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase hidden md:table-cell">
                  Submetida
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/20">
              {rows.map((r) => {
                const erros = Array.isArray(r.erros) ? r.erros : [];
                const certs = certificados[r.id] ?? [];
                const sync = syncHistorico[r.id];
                const expanded = expandedId === r.id;
                const syncExpanded = expandedSyncId === r.id;
                return (
                  <Fragment key={r.id}>
                  <tr className="hover:bg-slate-800/30 align-top">
                    <td className="px-4 py-3">
                      <p className="text-slate-200 text-xs font-medium">
                        {r.acaoFormacao?.codigoInterno ?? r.acaoFormacaoId.slice(0, 8)}
                      </p>
                      {r.acaoFormacao?.titulo ? (
                        <p className="text-[11px] text-slate-500 truncate max-w-[180px]">{r.acaoFormacao.titulo}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-xs text-purple-300">{r.referenceId.slice(0, 14)}…</code>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${estadoStyle[r.estado] ?? estadoStyle.PENDENTE}`}
                      >
                        {r.estado}
                      </span>
                      {erros.length > 0 ? (
                        <ul className="mt-2 space-y-1">
                          {erros.slice(0, 3).map((e, i) => (
                            <li key={i} className="text-[10px] text-red-400/90 leading-snug">
                              {e.codigo ? `[${e.codigo}] ` : ""}
                              {e.mensagem}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400 hidden md:table-cell">
                      {r.submittedAt ? new Date(r.submittedAt).toLocaleString("pt-PT") : "–"}
                    </td>
                    <td className="px-4 py-3 text-right space-y-1">
                      {(r._count?.sincronizacoesFormando ?? 0) > 0 ? (
                        <button
                          type="button"
                          onClick={() => void carregarSincronizacoes(r.id)}
                          className="block ml-auto px-3 py-1.5 rounded-lg border border-purple-500/30 text-xs font-medium text-purple-300 hover:bg-purple-500/10"
                        >
                          {syncExpanded ? "Ocultar sync" : `Sync formandos (${r._count?.sincronizacoesFormando})`}
                        </button>
                      ) : null}
                      {canManage && r.estado === "SUBMETIDA" ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void reconciliar(r.id)}
                          className="block ml-auto px-3 py-1.5 rounded-lg border border-slate-600/40 text-xs font-medium text-slate-300 hover:bg-slate-700/40"
                        >
                          Reconciliar
                        </button>
                      ) : null}
                      {canManage && r.estado === "ACEITE" ? (
                        <>
                          <button
                            type="button"
                            disabled={busyCertId === r.id}
                            onClick={() => void sincronizarCertificados(r.id)}
                            className="flex items-center gap-1 ml-auto px-3 py-1.5 rounded-lg bg-teal-600/80 hover:bg-teal-500 text-xs font-medium text-white"
                          >
                            <RefreshCw className={`h-3 w-3 ${busyCertId === r.id ? "animate-spin" : ""}`} />
                            Sync certificados
                          </button>
                          <button
                            type="button"
                            disabled={busyCertId === r.id}
                            onClick={() => void carregarCertificados(r.id)}
                            className="block ml-auto px-3 py-1.5 rounded-lg border border-slate-600/40 text-xs font-medium text-slate-300 hover:bg-slate-700/40"
                          >
                            {expanded ? "Ocultar" : "Ver certificados"}
                          </button>
                        </>
                      ) : null}
                      {canManage && (r.estado === "REJEITADA" || r.estado === "ERRO") ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void reenviar(r.id)}
                          className="flex items-center gap-1 ml-auto px-3 py-1.5 rounded-lg border border-slate-600/40 text-xs font-medium text-slate-300 hover:bg-slate-700/40"
                        >
                          <RefreshCw className="h-3 w-3" />
                          Reenviar
                        </button>
                      ) : null}
                    </td>
                  </tr>
                  {syncExpanded && sync ? (
                    <tr key={`${r.id}-sync`} className="bg-purple-950/20">
                      <td colSpan={5} className="px-4 py-3">
                        <div className="text-xs text-slate-400 mb-2">
                          Histórico SOAP: {sync.resumo.sucesso} OK · {sync.resumo.erro} erro ·{" "}
                          {sync.resumo.duplicado} duplicado · {sync.resumo.pendente} pendente
                        </div>
                        <div className="table-scroll-shell rounded-xl border border-slate-700/40">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-slate-700/30 text-slate-500">
                                <th className="text-left px-3 py-2">Formando</th>
                                <th className="text-left px-3 py-2">Transacção</th>
                                <th className="text-left px-3 py-2">Estado</th>
                                <th className="text-left px-3 py-2">Mensagem</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/20">
                              {sync.formandos.map((s) => (
                                <tr key={s.id}>
                                  <td className="px-3 py-2 text-slate-300">
                                    {s.formandoNome}
                                    <span className="block font-mono text-[10px] text-slate-500">{s.nif}</span>
                                  </td>
                                  <td className="px-3 py-2 font-mono text-slate-400">
                                    {s.transacaoId?.slice(0, 12) ?? "–"}
                                  </td>
                                  <td className="px-3 py-2">
                                    <span
                                      className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${estadoStyle[s.estado] ?? estadoStyle.PENDENTE}`}
                                    >
                                      {s.estado}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 text-slate-400">
                                    {s.soapFaultString ?? s.responseResumo ?? "–"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                  {expanded && certs.length > 0 ? (
                    <tr key={`${r.id}-certs`} className="bg-slate-950/40">
                      <td colSpan={5} className="px-4 py-3">
                        <div className="table-scroll-shell rounded-xl border border-slate-700/40">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-slate-700/30 text-slate-500">
                                <th className="text-left px-3 py-2">Formando</th>
                                <th className="text-left px-3 py-2">N.º certificado</th>
                                <th className="text-left px-3 py-2">Estado</th>
                                <th className="px-3 py-2" />
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/20">
                              {certs.map((c) => (
                                <tr key={c.id}>
                                  <td className="px-3 py-2 text-slate-300">{c.formandoNome}</td>
                                  <td className="px-3 py-2 text-slate-400">{c.numeroCertificado ?? "–"}</td>
                                  <td className="px-3 py-2">
                                    <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${estadoStyle[c.estado] ?? estadoStyle.PENDENTE}`}>
                                      {c.estado}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    {c.temFicheiro ? (
                                      <button
                                        type="button"
                                        onClick={() => downloadCertificado(c.id)}
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-600/80 hover:bg-blue-500 text-white"
                                      >
                                        <Download className="h-3 w-3" />
                                        PDF
                                      </button>
                                    ) : (
                                      <span className="text-slate-600">Sem ficheiro</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </TableScroll>
        </Card>
      )}
    </>
  );
}
