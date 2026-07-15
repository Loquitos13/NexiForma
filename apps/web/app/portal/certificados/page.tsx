"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { openHtmlForPrint } from "@/lib/client/open-html-for-print";
import { useTenantRole } from "@/lib/client/use-tenant-role";

type AcaoOpt = { id: string; codigoInterno: string; titulo: string };
type FormandoCert = {
  matriculaId: string;
  formando: { nome: string; nif: string };
  turmaCodigo: string;
  taxaPresenca: number | null;
  elegivelCertificado: boolean;
  codigoVerificacao?: string | null;
  certificadoSigo?: {
    id: string;
    numeroCertificado: string | null;
    emitidoEm: string | null;
    temFicheiro: boolean;
    referencia: string;
  } | null;
};

export default function CertificadosPage() {
  const { canManage } = useTenantRole();
  const [acoes, setAcoes] = useState<AcaoOpt[]>([]);
  const [acaoId, setAcaoId] = useState("");
  const [formandos, setFormandos] = useState<FormandoCert[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [notifyBusy, setNotifyBusy] = useState(false);

  useEffect(() => {
    void bffFetch("/api/v1/acoes-formacao", { headers: { accept: "application/json" } }).then(async (r) => {
      if (!r.ok) return;
      const rows = (await r.json()) as AcaoOpt[];
      setAcoes(rows);
      if (rows.length) setAcaoId(rows[0].id);
    });
  }, []);

  const load = useCallback(async (id: string) => {
    if (!id) return;
    setLoading(true);
    setError(null);
    const r = await bffFetch(`/api/v1/certificados/acoes-formacao/${id}`, { headers: { accept: "application/json" } });
    setLoading(false);
    if (!r.ok) { setError("Erro ao carregar certificados."); setFormandos([]); return; }
    const data = (await r.json()) as { formandos: FormandoCert[] };
    setFormandos(data.formandos);
  }, []);

  useEffect(() => { if (acaoId) void load(acaoId); }, [acaoId, load]);

  function downloadSigo(certificadoId: string) {
    window.open(`/api/v1/sigo/certificados/${certificadoId}/download`, "_blank", "noopener,noreferrer");
  }

  async function imprimir(matriculaId: string) {
    const r = await bffFetch(`/api/v1/certificados/matricula/${matriculaId}/certificado.html`, { headers: { accept: "text/html" } });
    if (!r.ok) { setError("Erro ao gerar certificado."); return; }
    const html = await r.text();
    const opened = openHtmlForPrint(html);
    if (!opened.ok) {
      setError(opened.error);
      return;
    }
  }

  async function notificarElegiveis() {
    if (!acaoId) return;
    setNotifyBusy(true); setMsg(null); setError(null);
    const r = await bffFetch(`/api/v1/notificacoes/certificados/acoes-formacao/${acaoId}`, {
      method: "POST", headers: { accept: "application/json" },
    });
    setNotifyBusy(false);
    if (!r.ok) { setError("Erro ao notificar."); return; }
    const data = (await r.json()) as { elegiveis: number; enviados: number };
    setMsg(`${data.enviados} email(s) enviado(s) a formandos elegiveis (${data.elegiveis} total).`);
  }

  if (!canManage) {
    return (
      <div className="max-w-3xl space-y-4">
        <h1 className="text-2xl font-bold text-slate-50">Certificados</h1>
        <p className="text-sm text-slate-400">Acede pelo portal formando ao teu certificado quando disponivel.</p>
        <Link href="/portal/formando" className="text-blue-400 hover:text-blue-300 text-sm transition-colors">Portal formando →</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-50">Certificados de formacao</h1>
        <p className="text-sm text-slate-500 mt-1">Emissao de certificados com base na assiduidade registada – imprimir ou guardar como PDF.</p>
      </div>

      {error ? <div className="flex items-start gap-2.5 rounded-xl bg-red-950/40 border border-red-500/25 px-4 py-3"><p className="text-sm text-red-300">{error}</p></div> : null}
      {msg ? <div className="flex items-start gap-2.5 rounded-xl bg-green-950/30 border border-green-500/25 px-4 py-3"><p className="text-sm text-green-300">{msg}</p></div> : null}

      {/* Acao selector + notify */}
      <div className="rounded-2xl bg-slate-900/50 border border-slate-700/30 p-5 space-y-3">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Accao de formacao</label>
          <select value={acaoId} onChange={(e) => setAcaoId(e.target.value)}
            className="w-full max-w-md px-3.5 py-2 rounded-xl bg-slate-900/80 border border-slate-700/60 text-sm text-slate-200 outline-none focus:border-blue-500/40 transition-colors">
            {acoes.map((a) => (
              <option key={a.id} value={a.id}>{a.codigoInterno} – {a.titulo}</option>
            ))}
          </select>
        </div>
        <button type="button" disabled={notifyBusy || !acaoId}
          onClick={() => void notificarElegiveis()}
          className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-medium transition-colors">
          {notifyBusy ? "A notificar..." : "Notificar formandos elegiveis"}
        </button>
      </div>

      {/* Formandos table */}
      <div className="rounded-2xl bg-slate-900/50 border border-slate-700/30 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-700/30">
          <h2 className="text-sm font-semibold text-slate-200">Formandos ({formandos.length})</h2>
        </div>
        {loading ? (
          <div className="p-5 text-sm text-slate-500">A carregar...</div>
        ) : formandos.length === 0 ? (
          <div className="p-5 text-sm text-slate-500">Sem matriculas activas nesta accao.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/30">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Formando</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Turma</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Presenca</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Verificacao</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">SIGO</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/20">
              {formandos.map((f) => (
                <tr key={f.matriculaId} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-slate-200 font-medium">{f.formando.nome}</p>
                    <p className="text-xs text-slate-500">NIF {f.formando.nif}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{f.turmaCodigo}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-200">{f.taxaPresenca != null ? `${f.taxaPresenca}%` : "–"}</span>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        f.elegivelCertificado ? "bg-green-500/10 text-green-400" : "bg-yellow-500/10 text-yellow-400"
                      }`}>
                        {f.elegivelCertificado ? "Elegivel" : "Abaixo limiar"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {f.codigoVerificacao ? (
                      <code className="text-xs text-blue-300">{f.codigoVerificacao}</code>
                    ) : (
                      <span className="text-slate-600 text-xs">–</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {f.certificadoSigo ? (
                      <div className="space-y-1">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-500/10 text-purple-300">
                          Oficial SIGO
                        </span>
                        {f.certificadoSigo.numeroCertificado ? (
                          <p className="text-[10px] text-slate-500">{f.certificadoSigo.numeroCertificado}</p>
                        ) : null}
                        {f.certificadoSigo.temFicheiro ? (
                          <button
                            type="button"
                            onClick={() => downloadSigo(f.certificadoSigo!.id)}
                            className="block text-[11px] text-teal-400 hover:text-teal-300"
                          >
                            Descarregar PDF
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-600">PDF pendente</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-600 text-xs">–</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button type="button"
                      onClick={() => void imprimir(f.matriculaId)}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white transition-colors">
                      Imprimir / PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
