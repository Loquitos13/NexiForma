"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { DOSSIE_DGERT_DOCUMENTOS, DOSSIE_DGERT_TOTAL } from "@nexiforma/shared";
import { bffFetch } from "@/lib/client/bff-fetch";
import { formatDatePt } from "@/lib/calendar-date";
import { downloadResponseAsFile } from "@/lib/client/download-response";
import { openHtmlForPrint } from "@/lib/client/open-html-for-print";

type AcaoOption = { id: string; codigoInterno: string; titulo: string };
type ChecklistItem = { id: string; label: string; ok: boolean; detalhe?: string; grupo?: string; severidade?: string; accaoSugerida?: string };
type SigoValidationMessage = { codigo: string; mensagem: string; campo?: string };
type SigoValidacao = { validadoEm: string; prontoParaImportacaoSigo?: boolean; prontoParaExportacao?: boolean; erros: SigoValidationMessage[]; avisos: SigoValidationMessage[]; checklistSigo?: { items?: ChecklistItem[]; scorePercent?: number } };
type ArquivoExport = { id: string; tipo: "DOSSIE_JSON" | "SIGO_JSON" | "DOSSIE_HTML" | "INSPECAO_ZIP"; nomeFicheiro: string; mimeType: string; tamanhoBytes: number; createdAt: string; expiresAt: string | null; createdBy?: { email: string; displayName: string | null } };
type DossiePayload = {
  geradoEm: string; acaoFormacao: Record<string, unknown>; curso: Record<string, unknown>;
  turmas: Array<{ codigo: string; nome: string; matriculas: Array<{ formando: { nome: string; nif: string } }> }>;
  cronograma: { sessoes: Array<{
    id: string;
    numeroSessao: number;
    data: string;
    horaInicio?: string;
    horaFim?: string;
    estado: string;
    iniciadaEm?: string | null;
    terminadaEm?: string | null;
    formadorPresente?: boolean | null;
    formador?: { nomeCompleto: string } | null;
    sumarios: Array<{ id: string; conteudo: string; imutavel: boolean; assinadoEm?: string | null }>;
    folhasPresenca: Array<{
      fechadaEm: string | null;
      validadaFormadorEm?: string | null;
      presentes: number;
      totalPresencas: number;
    }>;
  }> } | null;
  formadores: Array<{ nomeCompleto: string; nif: string }>;
  assiduidade: { taxaPresenca: number | null; presencasMarcadas: number; presencasRegistadas: number };
  checklist: { items: ChecklistItem[]; grupos?: Array<{ id: string; label: string; concluidos: number; total: number }>; scorePercent: number; scoreObrigatorioPercent?: number; prontoInspecao?: boolean; concluidosObrigatorios?: number; totalObrigatorios?: number; concluidos: number; total: number };
};

const inputClass = "w-full px-3 py-2 rounded-lg bg-slate-900/80 border border-slate-700/60 text-sm text-slate-200 placeholder:text-slate-500 outline-none focus:border-blue-500/40 transition-colors";
const selectClass = "w-full max-w-md px-3 py-2 rounded-lg bg-slate-900/80 border border-slate-700/60 text-sm text-slate-200 outline-none focus:border-blue-500/40 transition-colors";

export default function DossiePedagogicoPage() {
  const [acaoFromUrl, setAcaoFromUrl] = useState("");
  const [acoes, setAcoes] = useState<AcaoOption[]>([]);
  const [selectedAcaoId, setSelectedAcaoId] = useState("");
  const [dossie, setDossie] = useState<DossiePayload | null>(null);
  const [validacaoSigo, setValidacaoSigo] = useState<SigoValidacao | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [sigoApiMode, setSigoApiMode] = useState<string>("disabled");
  const [arquivos, setArquivos] = useState<ArquivoExport[]>([]);
  const [lastSumarioId, setLastSumarioId] = useState("");
  const [cmdMode, setCmdMode] = useState<string>("disabled");
  const [sessaoSumarioId, setSessaoSumarioId] = useState("");
  const [sumarioTexto, setSumarioTexto] = useState("");

  const loadAcoes = useCallback(async () => {
    const res = await bffFetch("/api/v1/acoes-formacao", { headers: { accept: "application/json" } });
    if (!res.ok) return [];
    return (await res.json()) as AcaoOption[];
  }, []);

  const loadDossie = useCallback(async (acaoId: string) => {
    if (!acaoId) { setDossie(null); setValidacaoSigo(null); setArquivos([]); return; }
    setLoading(true); setError(null);
    try {
      const [dossieRes, validacaoRes, arquivosRes] = await Promise.all([
        bffFetch(`/api/v1/dossie-pedagogico/acoes-formacao/${acaoId}`, { headers: { accept: "application/json" } }),
        bffFetch(`/api/v1/dossie-pedagogico/acoes-formacao/${acaoId}/validacao-sigo`, { headers: { accept: "application/json" } }),
        bffFetch(`/api/v1/dossie-pedagogico/acoes-formacao/${acaoId}/arquivos`, { headers: { accept: "application/json" } }),
      ]);
      if (!dossieRes.ok) { setError(`HTTP ${dossieRes.status}`); setDossie(null); setValidacaoSigo(null); setArquivos([]); return; }
      const data = (await dossieRes.json()) as DossiePayload;
      setDossie(data);
      if (validacaoRes.ok) setValidacaoSigo((await validacaoRes.json()) as SigoValidacao); else setValidacaoSigo(null);
      if (arquivosRes.ok) setArquivos((await arquivosRes.json()) as ArquivoExport[]); else setArquivos([]);
      const sessoes = data.cronograma?.sessoes ?? [];
      if (sessoes.length) setSessaoSumarioId((prev) => sessoes.some((s) => s.id === prev) ? prev : sessoes[0].id);
    } catch { setError("Falha de rede."); setDossie(null); setValidacaoSigo(null); setArquivos([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void bffFetch("/api/v1/cmd/config", { headers: { accept: "application/json" } }).then(async (r) => { if (r.ok) { const cfg = (await r.json()) as { mode?: string }; setCmdMode(cfg.mode ?? "disabled"); } }); }, []);
  useEffect(() => { void bffFetch("/api/v1/sigo/config", { headers: { accept: "application/json" } }).then(async (r) => { if (r.ok) { const cfg = (await r.json()) as { mode?: string; configured?: boolean }; setSigoApiMode(cfg.configured ? (cfg.mode ?? "http") : "disabled"); } }); }, []);
  useEffect(() => { const acao = new URLSearchParams(window.location.search).get("acao"); if (acao) setAcaoFromUrl(acao); }, []);
  useEffect(() => { void (async () => { const list = await loadAcoes(); setAcoes(list); if (list.length) { const pick = acaoFromUrl && list.some((a) => a.id === acaoFromUrl) ? acaoFromUrl : list[0].id; setSelectedAcaoId(pick); } })(); }, [loadAcoes, acaoFromUrl]);
  useEffect(() => { if (selectedAcaoId) void loadDossie(selectedAcaoId); }, [selectedAcaoId, loadDossie]);

  async function parseErr(res: Response) { const d = (await res.json().catch(() => null)) as { message?: string | string[] } | null; if (Array.isArray(d?.message)) return d.message.join(", "); if (typeof d?.message === "string") return d.message; return `HTTP ${res.status}`; }

  async function guardarSumario(e: FormEvent) {
    e.preventDefault(); if (!sessaoSumarioId || sumarioTexto.trim().length < 10) return;
    setBusy(true); setMsg(null); setError(null);
    const res = await bffFetch(`/api/v1/sumarios/sessao/${sessaoSumarioId}`, { method: "POST", headers: { "Content-Type": "application/json", accept: "application/json" }, body: JSON.stringify({ conteudo: sumarioTexto.trim() }) });
    if (!res.ok) { setError(await parseErr(res)); setBusy(false); return; }
    const created = (await res.json()) as { id: string };
    setMsg("Sumario guardado."); setLastSumarioId(created.id); setSumarioTexto("");
    await loadDossie(selectedAcaoId); setBusy(false);
  }

  async function assinarSumarioInterno() {
    if (!lastSumarioId) return; setBusy(true); setError(null); setMsg(null);
    const res = await bffFetch(`/api/v1/sumarios/${lastSumarioId}/assinar`, { method: "POST", headers: { accept: "application/json" } });
    if (!res.ok) { setError(await parseErr(res)); setBusy(false); return; }
    setMsg("Sumario assinado (interna)."); setLastSumarioId("");
    await loadDossie(selectedAcaoId); setBusy(false);
  }

  async function assinarSumarioCmd() {
    if (!lastSumarioId) return; setBusy(true); setError(null); setMsg(null);
    const res = await bffFetch(`/api/v1/sumarios/${lastSumarioId}/assinar-cmd`, { method: "POST", headers: { accept: "application/json" } });
    if (!res.ok) { setError(await parseErr(res)); setBusy(false); return; }
    const data = (await res.json()) as { authorizeUrl?: string; message?: string };
    if (data.authorizeUrl) window.open(data.authorizeUrl, "_blank", "noopener,noreferrer");
    setMsg(data.message ?? "Assinatura CMD iniciada."); setBusy(false);
  }

  async function exportar(tipo: string) {
    if (!selectedAcaoId) return; setBusy(true); setError(null); setMsg(null);
    const map: Record<string, [string, string, string]> = {
      inspecao: ["export/pacote-inspecao.zip", "application/zip", "zip"],
      json: ["export", "application/json", "json"],
      sigo: ["export/sigo", "application/json", "json"],
      html: ["export/dossie.html", "text/html", "html"],
      csv: ["export/sigo/formandos.csv", "text/csv", "csv"],
    };
    const [path, accept, ext] = map[tipo];
    const res = await bffFetch(`/api/v1/dossie-pedagogico/acoes-formacao/${selectedAcaoId}/${path}`, { headers: { accept } });
    if (!res.ok) { setError(await parseErr(res)); setBusy(false); return; }
    const acao = acoes.find((a) => a.id === selectedAcaoId);
    if (tipo === "html") {
      const html = await res.text();
      const opened = openHtmlForPrint(html);
      if (!opened.ok) {
        setError(opened.error);
        setBusy(false);
        return;
      }
      setMsg("Documento aberto para impressao.");
    } else {
      await downloadResponseAsFile(res, `dossie-${acao?.codigoInterno ?? "export"}.${ext}`);
      setMsg(`Export ${tipo.toUpperCase()} concluido.`);
    }
    setBusy(false);
  }

  async function submeterSigoApi() {
    if (!selectedAcaoId) return; setBusy(true); setError(null); setMsg(null);
    const res = await bffFetch(`/api/v1/sigo/acoes-formacao/${selectedAcaoId}/submit`, { method: "POST", headers: { accept: "application/json" } });
    if (!res.ok) { setError(await parseErr(res)); setBusy(false); return; }
    const data = (await res.json()) as { referenceId?: string; message?: string };
    setMsg(data.message ?? `Submissao SIGO: ${data.referenceId ?? "ok"}`); setBusy(false);
  }

  async function certificarSigoApi() {
    if (!selectedAcaoId) return; setBusy(true); setError(null); setMsg(null);
    const res = await bffFetch(`/api/v1/sigo/acoes-formacao/${selectedAcaoId}/certificar`, { method: "POST", headers: { accept: "application/json" } });
    if (!res.ok) { setError(await parseErr(res)); setBusy(false); return; }
    const data = (await res.json()) as {
      estado?: string;
      certificados?: { transferidos?: number; disponiveis?: number };
    };
    const certs = data.certificados;
    setMsg(
      `Certificacao SIGO: ${data.estado ?? "ok"}` +
        (certs ? ` – ${certs.transferidos ?? 0} PDF(s), ${certs.disponiveis ?? 0} disponiveis.` : "."),
    );
    setBusy(false);
  }

  async function arquivarExport(tipo: ArquivoExport["tipo"]) {
    if (!selectedAcaoId) return; setBusy(true); setError(null); setMsg(null);
    const res = await bffFetch(`/api/v1/dossie-pedagogico/acoes-formacao/${selectedAcaoId}/arquivos`, { method: "POST", headers: { "Content-Type": "application/json", accept: "application/json" }, body: JSON.stringify({ tipo }) });
    if (!res.ok) { setError(await parseErr(res)); setBusy(false); return; }
    setMsg(`Export ${tipo} arquivado.`); await loadDossie(selectedAcaoId); setBusy(false);
  }

  async function abrirArquivo(arquivoId: string) {
    setBusy(true); setError(null);
    const res = await bffFetch(`/api/v1/dossie-pedagogico/arquivos/${arquivoId}/url`, { headers: { accept: "application/json" } });
    if (!res.ok) { setError(await parseErr(res)); setBusy(false); return; }
    const data = (await res.json()) as { downloadUrl: string };
    window.open(data.downloadUrl, "_blank", "noopener,noreferrer"); setBusy(false);
  }

  function formatBytes(n: number) { if (n < 1024) return `${n} B`; if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`; return `${(n / (1024 * 1024)).toFixed(1)} MB`; }
  function labelTipo(tipo: ArquivoExport["tipo"]) { const m: Record<string, string> = { DOSSIE_JSON: "Dossie JSON", SIGO_JSON: "SIGO JSON", DOSSIE_HTML: "Dossie HTML", INSPECAO_ZIP: "Pacote inspecao" }; return m[tipo] ?? tipo; }

  const score = dossie?.checklist.scoreObrigatorioPercent ?? dossie?.checklist.scorePercent ?? 0;
  const scoreColor = score >= 85 ? "#4ade80" : score >= 50 ? "#fbbf24" : "#f87171";
  const sigoPronto = validacaoSigo?.prontoParaImportacaoSigo ?? validacaoSigo?.prontoParaExportacao ?? false;
  const prontoInspecao = dossie?.checklist.prontoInspecao ?? false;
  const pendenciasObrigatorias = (dossie?.checklist.totalObrigatorios ?? DOSSIE_DGERT_TOTAL) - (dossie?.checklist.concluidosObrigatorios ?? 0);

  const documentosStatus = useMemo(() => {
    if (!dossie?.checklist.items.length) return DOSSIE_DGERT_DOCUMENTOS.map((d) => ({ ...d, ok: false }));
    const byId = new Map(dossie.checklist.items.map((i) => [i.id, i]));
    return DOSSIE_DGERT_DOCUMENTOS.map((d) => ({
      ...d,
      ok: byId.get(d.checklistId)?.ok ?? false,
      detalhe: byId.get(d.checklistId)?.detalhe,
    }));
  }, [dossie?.checklist.items]);

  async function gerarDossieTecnico() {
    if (!selectedAcaoId || !prontoInspecao) return;
    setBusy(true); setError(null); setMsg(null);
    const res = await bffFetch(`/api/v1/dossie-pedagogico/acoes-formacao/${selectedAcaoId}/gerar-dossie`, {
      method: "POST",
      headers: { accept: "application/json" },
    });
    if (!res.ok) { setError(await parseErr(res)); setBusy(false); return; }
    const data = (await res.json()) as { message?: string; arquivo?: { downloadUrl?: string } };
    setMsg(data.message ?? "Dossiê gerado.");
    if (data.arquivo?.downloadUrl) window.open(data.arquivo.downloadUrl, "_blank", "noopener,noreferrer");
    await loadDossie(selectedAcaoId);
    setBusy(false);
  }

  return (
    <div className="max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-50">Dossiê técnico-pedagógico</h1>
        <p className="text-sm text-slate-500 mt-1 max-w-3xl">
          {DOSSIE_DGERT_TOTAL} documentos automatizados para auditorias DGERT - o pacote só é gerado quando
          todos os requisitos obrigatórios estão cumpridos. Processos que costumam levar semanas ou meses
          ficam prontos num clique.
        </p>
      </div>

      {error ? <div className="flex items-start gap-2.5 rounded-xl bg-red-950/40 border border-red-500/25 px-4 py-3"><p className="text-sm text-red-300">{error}</p></div> : null}
      {msg ? <div className="flex items-start gap-2.5 rounded-xl bg-green-950/30 border border-green-500/25 px-4 py-3"><p className="text-sm text-green-300">{msg}</p></div> : null}

      {acoes.length === 0 ? (
        <p className="text-sm text-slate-500">Sem accoes de formacao. Corre o seed ou cria na API.</p>
      ) : (
        <>
          {/* Geracao do dossie */}
          <div className="rounded-2xl bg-gradient-to-br from-slate-900/80 to-slate-900/40 border border-slate-700/30 p-5">
            <div className="flex flex-wrap items-end gap-3 mb-5">
              <div className="flex-1 min-w-[240px]">
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Acção de formação</label>
                <select value={selectedAcaoId} onChange={(e) => setSelectedAcaoId(e.target.value)} className={selectClass}>
                  {acoes.map((a) => <option key={a.id} value={a.id}>{a.codigoInterno} – {a.titulo}</option>)}
                </select>
              </div>
              <button
                type="button"
                disabled={busy || !selectedAcaoId || !dossie || !prontoInspecao}
                onClick={() => void gerarDossieTecnico()}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 disabled:opacity-50 disabled:from-slate-700 disabled:to-slate-700 text-white text-sm font-semibold transition-all shadow-lg shadow-amber-900/20"
              >
                Gerar dossiê ({DOSSIE_DGERT_TOTAL} documentos)
              </button>
              {selectedAcaoId ? (
                <Link href={`/portal/acoes/${selectedAcaoId}?tab=compliance`} className="px-3.5 py-2 rounded-lg border border-slate-600/40 text-sm font-medium text-slate-300 hover:bg-slate-800/40 transition-colors">
                  Ver requisitos
                </Link>
              ) : null}
            </div>

            {dossie ? (
              <>
                <p className={`text-sm font-medium mb-4 ${prontoInspecao ? "text-green-400" : "text-amber-400"}`}>
                  {prontoInspecao
                    ? `Requisitos cumpridos - pode gerar o dossiê com ${DOSSIE_DGERT_TOTAL} documentos.`
                    : `Faltam ${pendenciasObrigatorias} requisito(s) obrigatório(s) - complete o checklist antes de gerar.`}
                </p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {documentosStatus.map((doc) => (
                    <div
                      key={doc.checklistId}
                      className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${
                        doc.ok
                          ? "border-green-500/25 bg-green-500/5 text-slate-200"
                          : "border-slate-700/40 bg-slate-800/30 text-slate-500"
                      }`}
                    >
                      <span className={`mt-0.5 shrink-0 ${doc.ok ? "text-green-400" : "text-red-400"}`}>
                        {doc.ok ? "✓" : "○"}
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{String(doc.ordem).padStart(2, "0")}. {doc.label}</p>
                        <p className="text-[10px] text-slate-600 truncate">{doc.filename}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </div>

          {/* Exports avancados */}
          <div className="rounded-2xl bg-slate-900/50 border border-slate-700/30 p-5">
            <h2 className="text-sm font-semibold text-slate-200 mb-1">Exports avançados</h2>
            <p className="text-xs text-slate-500 mb-3">Downloads individuais (requerem requisitos cumpridos para o pacote ZIP).</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={busy || !selectedAcaoId || !dossie || !prontoInspecao} onClick={() => void exportar("inspecao")} className="px-3.5 py-2 rounded-lg bg-amber-700/80 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-medium transition-colors">Pacote ZIP</button>
              <button type="button" disabled={busy || !selectedAcaoId || !dossie} onClick={() => void exportar("json")} className="px-3.5 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-medium transition-colors">JSON</button>
              <button type="button" disabled={busy || !selectedAcaoId || !dossie} onClick={() => void exportar("sigo")} className="px-3.5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-medium transition-colors">SIGO JSON</button>
              <button type="button" disabled={busy || !selectedAcaoId || !dossie} onClick={() => void exportar("html")} className="px-3.5 py-2 rounded-lg bg-slate-600 hover:bg-slate-500 disabled:opacity-50 text-white text-sm font-medium transition-colors">HTML / PDF</button>
              <button type="button" disabled={busy || !selectedAcaoId || !dossie} onClick={() => void exportar("csv")} className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium transition-colors">SIGO CSV</button>
              {sigoApiMode !== "disabled" ? (
                <>
                  <button type="button" disabled={busy || !selectedAcaoId || !sigoPronto} onClick={() => void submeterSigoApi()} className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium transition-colors">Submeter SIGO API</button>
                  <button type="button" disabled={busy || !selectedAcaoId || !sigoPronto} onClick={() => void certificarSigoApi()} className="px-3.5 py-2 rounded-lg bg-emerald-800 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium transition-colors">Certificar (SIGO completo)</button>
                </>
              ) : null}
            </div>
          </div>

          {/* Archived files */}
          {dossie ? (
            <div className="rounded-2xl bg-slate-900/50 border border-slate-700/30 p-5">
              <h2 className="text-sm font-semibold text-slate-200 mb-1">Arquivos exportados (storage)</h2>
              <p className="text-xs text-slate-500 mb-4">Gera versoes persistidas do dossie/SIGO/HTML para auditoria e download posterior.</p>
              <div className="flex flex-wrap gap-2 mb-4">
                <button type="button" disabled={busy || !prontoInspecao} onClick={() => void arquivarExport("INSPECAO_ZIP")} className="px-3 py-1.5 rounded-lg bg-amber-700/60 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-medium transition-colors">Arquivar dossiê (ZIP)</button>
                <button type="button" disabled={busy} onClick={() => void arquivarExport("DOSSIE_JSON")} className="px-3 py-1.5 rounded-lg bg-teal-600/60 hover:bg-teal-600 disabled:opacity-50 text-white text-xs font-medium transition-colors">Arquivar JSON</button>
                <button type="button" disabled={busy} onClick={() => void arquivarExport("SIGO_JSON")} className="px-3 py-1.5 rounded-lg bg-purple-600/60 hover:bg-purple-600 disabled:opacity-50 text-white text-xs font-medium transition-colors">Arquivar SIGO</button>
                <button type="button" disabled={busy} onClick={() => void arquivarExport("DOSSIE_HTML")} className="px-3 py-1.5 rounded-lg bg-slate-600/60 hover:bg-slate-600 disabled:opacity-50 text-white text-xs font-medium transition-colors">Arquivar HTML</button>
              </div>
              {arquivos.length === 0 ? (
                <p className="text-xs text-slate-600">Sem arquivos ainda.</p>
              ) : (
                <div className="space-y-1.5">
                  {arquivos.map((a) => (
                    <div key={a.id} className="flex flex-wrap items-center gap-3 px-3 py-2 rounded-lg bg-slate-800/40 text-xs">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-500/15 text-indigo-400">{labelTipo(a.tipo)}</span>
                      <span className="text-slate-300 truncate max-w-[200px]">{a.nomeFicheiro}</span>
                      <span className="text-slate-500">{formatBytes(a.tamanhoBytes)}</span>
                      <span className="text-slate-600">{new Date(a.createdAt).toLocaleString("pt-PT")}</span>
                      {a.expiresAt ? <span className="text-slate-600">expira {formatDatePt(a.expiresAt)}</span> : null}
                      <button type="button" disabled={busy} onClick={() => void abrirArquivo(a.id)} className="ml-auto px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-[11px] font-medium transition-colors">Download</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {loading && !dossie ? <p className="text-sm text-slate-500 text-center py-4">A carregar...</p> : null}
        </>
      )}

      {dossie ? (
        <>
          {/* SIGO Validation */}
          {validacaoSigo ? (
            <div className="rounded-2xl bg-slate-900/50 border border-slate-700/30 p-5">
              <h2 className="text-sm font-semibold text-slate-200 mb-2">Validacao SIGO</h2>
              <p className={`text-sm font-semibold mb-3 ${sigoPronto ? "text-green-400" : "text-red-400"}`}>
                {sigoPronto ? "Pronto para exportacao SIGO (sem erros bloqueantes)." : `${validacaoSigo.erros.length} erro(s) bloqueante(s) – corrige antes de submeter.`}
              </p>
              {validacaoSigo.erros.length > 0 ? (
                <div className="mb-3 space-y-1">
                  {validacaoSigo.erros.map((e) => (
                    <div key={e.codigo} className="flex items-start gap-2 text-sm text-red-400">
                      <span className="text-red-500 mt-0.5">✕</span>
                      <span>[{e.codigo}] {e.mensagem}{e.campo ? ` (${e.campo})` : ""}</span>
                    </div>
                  ))}
                </div>
              ) : null}
              {validacaoSigo.avisos.length > 0 ? (
                <div className="mb-3 space-y-1">
                  <p className="text-xs font-medium text-yellow-400 mb-1">Avisos</p>
                  {validacaoSigo.avisos.map((a) => (
                    <div key={a.codigo} className="flex items-start gap-2 text-xs text-yellow-300">
                      <span className="text-yellow-500 mt-0.5">⚠</span>
                      <span>[{a.codigo}] {a.mensagem}</span>
                    </div>
                  ))}
                </div>
              ) : null}
              <p className="text-[11px] text-slate-600">Validado: {new Date(validacaoSigo.validadoEm).toLocaleString("pt-PT")}</p>
            </div>
          ) : null}

          {/* Checklist DGERT */}
          <div className="rounded-2xl bg-slate-900/50 border border-slate-700/30 p-5">
            <h2 className="text-sm font-semibold text-slate-200 mb-3">Completude (checklist DGERT)</h2>
            <p className="text-3xl font-bold mb-1" style={{ color: scoreColor }}>{score}%</p>
            <p className="text-xs text-slate-500 mb-4">
              obrigatorios ({dossie.checklist.concluidosObrigatorios ?? dossie.checklist.concluidos}/{dossie.checklist.totalObrigatorios ?? dossie.checklist.total})
            </p>
            {dossie.checklist.prontoInspecao != null ? (
              <p className={`text-sm font-medium mb-3 ${dossie.checklist.prontoInspecao ? "text-green-400" : "text-red-400"}`}>
                {dossie.checklist.prontoInspecao ? "Todos os criterios obrigatorios cumpridos." : "Ainda existem criterios obrigatorios por cumprir."}
              </p>
            ) : null}
            {dossie.checklist.grupos?.length ? (
              <div className="flex flex-wrap gap-2 mb-4">
                {dossie.checklist.grupos.map((g) => (
                  <span key={g.id} className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${g.concluidos === g.total ? "bg-green-500/10 text-green-400" : "bg-yellow-500/10 text-yellow-400"}`}>
                    {g.label}: {g.concluidos}/{g.total}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="space-y-2">
              {dossie.checklist.items.map((item) => (
                <div key={item.id} className={`flex items-start gap-2 text-sm ${item.ok ? "text-slate-200" : "text-slate-500"}`}>
                  <span className={`mt-0.5 flex-shrink-0 ${item.ok ? "text-green-400" : "text-red-400"}`}>{item.ok ? "✓" : "○"}</span>
                  <div>
                    <span>{item.label}</span>
                    {item.detalhe ? <span className="text-slate-600 text-xs ml-1">({item.detalhe})</span> : null}
                    {!item.ok && item.accaoSugerida ? <p className="text-slate-600 text-xs mt-0.5 ml-0">→ {item.accaoSugerida}</p> : null}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Curso / accao */}
          <div className="rounded-2xl bg-slate-900/50 border border-slate-700/30 p-5">
            <h2 className="text-sm font-semibold text-slate-200 mb-2">Curso / accao</h2>
            <p className="text-sm text-slate-200">
              <strong>{String(dossie.curso.designacao)}</strong>
              {dossie.curso.codigoUfcd ? ` · UFCD ${String(dossie.curso.codigoUfcd)}` : null}
              {" · "}{String(dossie.curso.cargaHoras)}h · {String(dossie.curso.modalidade)}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {String(dossie.acaoFormacao.codigoInterno)} – {String(dossie.acaoFormacao.titulo)} [{String(dossie.acaoFormacao.estado)}]
            </p>
            {dossie.curso.objetivos ? <p className="text-xs text-slate-400 mt-2 line-clamp-2">{String(dossie.curso.objetivos)}</p> : null}
          </div>

          {/* Formandos e assiduidade */}
          <div className="rounded-2xl bg-slate-900/50 border border-slate-700/30 p-5">
            <h2 className="text-sm font-semibold text-slate-200 mb-3">Formandos e assiduidade</h2>
            <div className="space-y-3">
              {dossie.turmas.map((t) => (
                <div key={t.codigo}>
                  <p className="text-sm font-semibold text-slate-200">{t.codigo} – {t.nome}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-slate-400">
                    {t.matriculas.map((m, i) => (
                      <span key={i}>{m.formando.nome} <span className="text-slate-600">(NIF {m.formando.nif})</span></span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-3">
              Taxa presenca global:{" "}
              {dossie.assiduidade.taxaPresenca != null
                ? `${dossie.assiduidade.taxaPresenca}% (${dossie.assiduidade.presencasMarcadas}/${dossie.assiduidade.presencasRegistadas})`
                : "–"}
            </p>
          </div>

          {/* Sessoes, sumarios e presencas */}
          <div className="rounded-2xl bg-slate-900/50 border border-slate-700/30 p-5">
            <h2 className="text-sm font-semibold text-slate-200 mb-3">Sessoes, sumarios e presencas</h2>
            {!dossie.cronograma?.sessoes.length ? (
              <p className="text-sm text-slate-500">Sem cronograma/sessoes.</p>
            ) : (
              <div className="divide-y divide-slate-700/20 mb-4">
                {dossie.cronograma.sessoes.map((s) => {
                  const folha = s.folhasPresenca[0];
                  const folhaEstado = folha
                    ? folha.validadaFormadorEm || folha.fechadaEm
                      ? "validada"
                      : "aberta"
                    : null;
                  return (
                  <div key={s.id} className="py-2.5 text-sm border-b border-slate-800/40 last:border-0">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="font-semibold text-slate-200">S{s.numeroSessao}</span>
                      <span className="text-slate-400">
                        {String(s.data).slice(0, 10)} · {s.horaInicio}–{s.horaFim} · [{s.estado}]
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {s.formador?.nomeCompleto ? `Formador: ${s.formador.nomeCompleto}` : "Sem formador"}
                      {s.iniciadaEm
                        ? ` · Início: ${new Date(s.iniciadaEm).toLocaleString("pt-PT")}`
                        : ""}
                      {s.terminadaEm
                        ? ` · Fim: ${new Date(s.terminadaEm).toLocaleString("pt-PT")}`
                        : ""}
                      {s.formadorPresente === true
                        ? " · Formador presente"
                        : s.formadorPresente === false
                          ? " · Formador ausente"
                          : ""}
                    </p>
                    <p className="text-xs mt-0.5">
                      {s.sumarios.length ? (
                        <span className={s.sumarios[0].imutavel ? "text-green-400" : "text-yellow-400"}>
                          {s.sumarios[0].imutavel ? "Sumário assinado" : "Sumário rascunho"}
                        </span>
                      ) : (
                        <span className="text-yellow-400">Sem sumário</span>
                      )}
                      {folha ? (
                        <span className="text-slate-500">
                          {" · "}
                          Presenças {folha.presentes}/{folha.totalPresencas}{" "}
                          {folhaEstado === "validada" ? "(validada)" : "(em edição)"}
                        </span>
                      ) : (
                        <span className="text-slate-600"> · Sem folha de presença</span>
                      )}
                    </p>
                  </div>
                  );
                })}
              </div>
            )}

            {dossie.cronograma?.sessoes.length ? (
              <form onSubmit={(e) => void guardarSumario(e)} className="space-y-3 max-w-lg">
                <p className="text-sm font-medium text-slate-400">Registar sumario</p>
                <select value={sessaoSumarioId} onChange={(e) => setSessaoSumarioId(e.target.value)} className={selectClass}>
                  {dossie.cronograma.sessoes.map((s) => (
                    <option key={s.id} value={s.id}>Sessao {s.numeroSessao} ({String(s.data).slice(0, 10)})</option>
                  ))}
                </select>
                <textarea value={sumarioTexto} onChange={(e) => setSumarioTexto(e.target.value)} placeholder="Conteudos abordados, metodologia, observacoes... (min. 10 caracteres)" required minLength={10} rows={4} className={`${inputClass} resize-y`} />
                <div className="flex flex-wrap gap-2">
                  <button type="submit" disabled={busy} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium transition-colors">Guardar sumario</button>
                  {lastSumarioId ? (
                    <>
                      <button type="button" disabled={busy} onClick={() => void assinarSumarioInterno()} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium transition-colors">Assinar (interna)</button>
                      {cmdMode !== "disabled" ? (
                        <button type="button" disabled={busy} onClick={() => void assinarSumarioCmd()} className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-medium transition-colors">Assinar com CMD</button>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </form>
            ) : null}
          </div>

          {/* Formadores */}
          {dossie.formadores.length > 0 ? (
            <div className="rounded-2xl bg-slate-900/50 border border-slate-700/30 p-5">
              <h2 className="text-sm font-semibold text-slate-200 mb-2">Formadores</h2>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                {dossie.formadores.map((f, i) => (
                  <span key={i}>{f.nomeCompleto} <span className="text-slate-600">· NIF {f.nif}</span></span>
                ))}
              </div>
            </div>
          ) : null}

          <p className="text-[11px] text-slate-600">Gerado: {new Date(dossie.geradoEm).toLocaleString("pt-PT")}</p>
        </>
      ) : null}
    </div>
  );
}
