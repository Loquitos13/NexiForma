"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DOSSIE_DGERT_DOCUMENTOS, DOSSIE_DGERT_TOTAL } from "@nexiforma/shared";
import { bffFetch } from "@/lib/client/bff-fetch";
import { formatDatePt } from "@/lib/calendar-date";
import { downloadResponseAsFile } from "@/lib/client/download-response";
import { openHtmlForPrint } from "@/lib/client/open-html-for-print";
import {
  isValidNifPtClient,
  resolveDgertRequisitoHref,
} from "@/lib/dossie/dgert-requisito";
import { Alert, Button, Card, CardContent, CardHeader, CardTitle, PageHeader, Select } from "@/components/ui";
import {
  SumarioAssinaturaModal,
  type SumarioAssinaturaConfirm,
} from "@/components/portal/sumario-assinatura-modal";

type AcaoOption = { id: string; codigoInterno: string; titulo: string };
type ChecklistItem = { id: string; label: string; ok: boolean; detalhe?: string; grupo?: string; severidade?: string; accaoSugerida?: string };
type SigoValidationMessage = { codigo: string; mensagem: string; campo?: string };
type SigoValidacao = { validadoEm: string; prontoParaImportacaoSigo?: boolean; prontoParaExportacao?: boolean; erros: SigoValidationMessage[]; avisos: SigoValidationMessage[]; checklistSigo?: { items?: ChecklistItem[]; scorePercent?: number } };
type ArquivoExport = { id: string; tipo: "DOSSIE_JSON" | "SIGO_JSON" | "DOSSIE_HTML" | "INSPECAO_ZIP"; nomeFicheiro: string; mimeType: string; tamanhoBytes: number; createdAt: string; expiresAt: string | null; createdBy?: { email: string; displayName: string | null } };
type DossiePayload = {
  geradoEm: string; acaoFormacao: Record<string, unknown>; curso: Record<string, unknown>;
  turmas: Array<{
    codigo: string;
    nome: string;
    matriculas: Array<{ formando: { id?: string; nome: string; nif: string } }>;
  }>;
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
    sumarios: Array<{
      id: string;
      conteudo: string;
      imutavel: boolean;
      assinadoEm?: string | null;
      assinaturaTipo?: string | null;
      pdfNomeFicheiro?: string | null;
      pdfStorageKey?: string | null;
    }>;
    folhasPresenca: Array<{
      fechadaEm: string | null;
      validadaFormadorEm?: string | null;
      aprovadaGestorEm?: string | null;
      presentes: number;
      totalPresencas: number;
    }>;
  }> } | null;
  formadores: Array<{ nomeCompleto: string; nif: string }>;
  assiduidade: { taxaPresenca: number | null; presencasMarcadas: number; presencasRegistadas: number };
  checklist: { items: ChecklistItem[]; grupos?: Array<{ id: string; label: string; concluidos: number; total: number }>; scorePercent: number; scoreObrigatorioPercent?: number; prontoInspecao?: boolean; concluidosObrigatorios?: number; totalObrigatorios?: number; concluidos: number; total: number };
  dtp?: {
    tipoFinanciamento: string;
    tipoLabel: string;
    scorePercent: number;
    concluidos: number;
    total: number;
    secoes: Array<{
      ordem: number;
      titulo: string;
      concluidos: number;
      total: number;
      itens: Array<{
        id: string;
        label: string;
        ok: boolean;
        detalhe?: string;
        manual?: boolean;
        accaoSugerida?: string;
      }>;
    }>;
    items: Array<{
      id: string;
      label: string;
      ok: boolean;
      detalhe?: string;
      manual?: boolean;
      accaoSugerida?: string;
      secaoTitulo: string;
    }>;
  };
};

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
  const [sessaoSumarioId, setSessaoSumarioId] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [sumarioModalOpen, setSumarioModalOpen] = useState(false);

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

  useEffect(() => { void bffFetch("/api/v1/sigo/config", { headers: { accept: "application/json" } }).then(async (r) => { if (r.ok) { const cfg = (await r.json()) as { mode?: string; configured?: boolean }; setSigoApiMode(cfg.configured ? (cfg.mode ?? "http") : "disabled"); } }); }, []);
  useEffect(() => { const acao = new URLSearchParams(window.location.search).get("acao"); if (acao) setAcaoFromUrl(acao); }, []);
  useEffect(() => { void (async () => { const list = await loadAcoes(); setAcoes(list); if (list.length) { const pick = acaoFromUrl && list.some((a) => a.id === acaoFromUrl) ? acaoFromUrl : list[0].id; setSelectedAcaoId(pick); } })(); }, [loadAcoes, acaoFromUrl]);
  useEffect(() => { if (selectedAcaoId) void loadDossie(selectedAcaoId); }, [selectedAcaoId, loadDossie]);

  async function parseErr(res: Response) { const d = (await res.json().catch(() => null)) as { message?: string | string[] } | null; if (Array.isArray(d?.message)) return d.message.join(", "); if (typeof d?.message === "string") return d.message; return `HTTP ${res.status}`; }

  const sessaoSumarioActiva = useMemo(
    () => dossie?.cronograma?.sessoes.find((s) => s.id === sessaoSumarioId) ?? null,
    [dossie, sessaoSumarioId],
  );
  const sumarioActivo = useMemo(() => {
    if (!sessaoSumarioActiva) return null;
    const signed = sessaoSumarioActiva.sumarios.find((s) => s.imutavel);
    if (signed) return signed;
    if (lastSumarioId) {
      return (
        sessaoSumarioActiva.sumarios.find((s) => s.id === lastSumarioId) ??
        sessaoSumarioActiva.sumarios.find((s) => !s.imutavel) ??
        null
      );
    }
    return sessaoSumarioActiva.sumarios.find((s) => !s.imutavel) ?? null;
  }, [sessaoSumarioActiva, lastSumarioId]);

  async function confirmarSumarioAssinatura(payload: SumarioAssinaturaConfirm) {
    if (!sessaoSumarioId) return;
    if (!sessaoSumarioActiva?.terminadaEm) {
      setError("O sumário só pode ser registado depois de a sessão ser terminada.");
      return;
    }
    if (sumarioActivo?.imutavel) {
      setError("Sumário já assinado - não editável.");
      return;
    }
    setBusy(true);
    setMsg(null);
    setError(null);
    try {
      let sumarioId = sumarioActivo?.id ?? (lastSumarioId || null);
      const saveRes = sumarioId
        ? await bffFetch(`/api/v1/sumarios/${sumarioId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", accept: "application/json" },
            body: JSON.stringify({ conteudo: payload.conteudo }),
          })
        : await bffFetch(`/api/v1/sumarios/sessao/${sessaoSumarioId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", accept: "application/json" },
            body: JSON.stringify({ conteudo: payload.conteudo }),
          });
      if (!saveRes.ok) {
        setError(await parseErr(saveRes));
        return;
      }
      if (!sumarioId) {
        const created = (await saveRes.json()) as { id: string };
        sumarioId = created.id;
      }
      const signRes = await bffFetch(`/api/v1/sumarios/${sumarioId}/assinar`, {
        method: "POST",
        headers: { "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({ nomeAssinatura: payload.nomeAssinatura }),
      });
      if (!signRes.ok) {
        setError(await parseErr(signRes));
        setLastSumarioId(sumarioId);
        await loadDossie(selectedAcaoId);
        return;
      }
      setSumarioModalOpen(false);
      setLastSumarioId("");
      setMsg("Sumário registado e assinado.");
      await loadDossie(selectedAcaoId);
    } finally {
      setBusy(false);
    }
  }

  async function uploadPdfAssinado() {
    const sumarioId = sumarioActivo?.id ?? lastSumarioId;
    if (!sumarioId || !pdfFile) return;
    if (!sessaoSumarioActiva?.terminadaEm) {
      setError("O sumário só pode ser registado depois de a sessão ser terminada.");
      return;
    }
    if (pdfFile.type !== "application/pdf" && !pdfFile.name.toLowerCase().endsWith(".pdf")) {
      setError("Apenas ficheiros PDF (.pdf) são aceites.");
      return;
    }
    setBusy(true);
    setError(null);
    setMsg(null);
    const form = new FormData();
    form.append("file", pdfFile);
    const res = await bffFetch(`/api/v1/sumarios/${sumarioId}/upload-pdf-assinado`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      setError(await parseErr(res));
      setBusy(false);
      return;
    }
    setMsg("PDF assinado carregado. Sumário fechado.");
    setLastSumarioId("");
    setPdfFile(null);
    await loadDossie(selectedAcaoId);
    setBusy(false);
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
      setMsg("Documento aberto para impressão.");
    } else {
      await downloadResponseAsFile(res, `dossie-${acao?.codigoInterno ?? "export"}.${ext}`);
      setMsg(`Export ${tipo.toUpperCase()} concluído.`);
    }
    setBusy(false);
  }

  async function submeterSigoApi() {
    if (!selectedAcaoId) return; setBusy(true); setError(null); setMsg(null);
    const res = await bffFetch(`/api/v1/sigo/acoes-formacao/${selectedAcaoId}/submit`, { method: "POST", headers: { accept: "application/json" } });
    if (!res.ok) { setError(await parseErr(res)); setBusy(false); return; }
    const data = (await res.json()) as { referenceId?: string; message?: string };
    setMsg(data.message ?? `Submissão SIGO: ${data.referenceId ?? "ok"}`); setBusy(false);
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
      `Certificação SIGO: ${data.estado ?? "ok"}` +
        (certs ? ` – ${certs.transferidos ?? 0} PDF(s), ${certs.disponiveis ?? 0} disponíveis.` : "."),
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
  function labelTipo(tipo: ArquivoExport["tipo"]) { const m: Record<string, string> = { DOSSIE_JSON: "Dossiê JSON", SIGO_JSON: "SIGO JSON", DOSSIE_HTML: "Dossiê HTML", INSPECAO_ZIP: "Pacote inspeção" }; return m[tipo] ?? tipo; }

  const score = dossie?.checklist.scoreObrigatorioPercent ?? dossie?.checklist.scorePercent ?? 0;
  const scoreColor = score >= 85 ? "#4ade80" : score >= 50 ? "#fbbf24" : "#f87171";
  const sigoPronto = validacaoSigo?.prontoParaImportacaoSigo ?? validacaoSigo?.prontoParaExportacao ?? false;
  const prontoInspecao = dossie?.checklist.prontoInspecao ?? false;
  const pendenciasObrigatorias = (dossie?.checklist.totalObrigatorios ?? DOSSIE_DGERT_TOTAL) - (dossie?.checklist.concluidosObrigatorios ?? 0);

  const formandoIdNifInvalido = useMemo(() => {
    if (!dossie?.turmas?.length) return undefined;
    for (const t of dossie.turmas) {
      for (const m of t.matriculas) {
        if (m.formando.id && !isValidNifPtClient(m.formando.nif)) {
          return m.formando.id;
        }
      }
    }
    return undefined;
  }, [dossie?.turmas]);

  const resolveCtx = useMemo(
    () => ({
      acaoId: selectedAcaoId,
      cursoId: typeof dossie?.curso?.id === "string" ? dossie.curso.id : undefined,
      formandoIdNifInvalido,
    }),
    [selectedAcaoId, dossie?.curso?.id, formandoIdNifInvalido],
  );

  const documentosStatus = useMemo(() => {
    if (!dossie?.checklist.items.length) {
      return DOSSIE_DGERT_DOCUMENTOS.map((d) => ({
        ...d,
        ok: false,
        href: resolveDgertRequisitoHref(d.checklistId, resolveCtx),
      }));
    }
    const byId = new Map(dossie.checklist.items.map((i) => [i.id, i]));
    return DOSSIE_DGERT_DOCUMENTOS.map((d) => ({
      ...d,
      ok: byId.get(d.checklistId)?.ok ?? false,
      detalhe: byId.get(d.checklistId)?.detalhe,
      href: resolveDgertRequisitoHref(d.checklistId, resolveCtx),
    }));
  }, [dossie?.checklist.items, resolveCtx]);

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
    <>
      <PageHeader
        title="Dossiê técnico-pedagógico"
        description={`${DOSSIE_DGERT_TOTAL} documentos automatizados para auditorias DGERT, com evidências de avaliações, certificados e documentos de matrícula no pacote ZIP. Só é gerado quando os requisitos obrigatórios estão cumpridos.`}
      />

      {error ? <Alert variant="error" className="mb-4">{error}</Alert> : null}
      {msg ? <Alert variant="success" className="mb-4">{msg}</Alert> : null}

      {acoes.length === 0 ? (
        <p className="text-sm text-slate-500">Sem acções de formação. Corre o seed ou cria na API.</p>
      ) : (
        <div className="space-y-6">
          {/* Geração do dossiê */}
          <Card className="bg-gradient-to-br from-slate-900/80 to-slate-900/40">
            <CardContent className="pt-5">
            <div className="flex flex-wrap items-end gap-3 mb-5">
              <div className="flex-1 min-w-[240px]">
                <Select label="Acção de formação" value={selectedAcaoId} onChange={(e) => setSelectedAcaoId(e.target.value)} className="max-w-md">
                  {acoes.map((a) => <option key={a.id} value={a.id}>{a.codigoInterno} – {a.titulo}</option>)}
                </Select>
              </div>
              <Button
                disabled={busy || !selectedAcaoId || !dossie || !prontoInspecao}
                onClick={() => void gerarDossieTecnico()}
                className="bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 shadow-lg shadow-amber-900/20"
              >
                Gerar dossiê ({DOSSIE_DGERT_TOTAL} documentos)
              </Button>
              {selectedAcaoId ? (
                <Button variant="secondary" asChild>
                  <Link href={`/portal/acoes/${selectedAcaoId}?tab=compliance`}>
                    Ver requisitos
                  </Link>
                </Button>
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
                  {documentosStatus.map((doc) => {
                    const className = `flex items-start gap-2 rounded-lg border px-3 py-2 text-xs transition-colors ${
                      doc.ok
                        ? "border-green-500/25 bg-green-500/5 text-slate-200"
                        : "border-amber-500/30 bg-amber-500/5 text-slate-300 hover:border-amber-400/50 hover:bg-amber-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                    }`;
                    const body = (
                      <>
                        <span className={`mt-0.5 shrink-0 ${doc.ok ? "text-green-400" : "text-amber-400"}`}>
                          {doc.ok ? "✓" : "○"}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">
                            {String(doc.ordem).padStart(2, "0")}. {doc.label}
                          </p>
                          <p className={`text-[10px] truncate ${doc.ok ? "text-slate-600" : "text-amber-500/80"}`}>
                            {doc.ok ? doc.filename : "Clique para concluir →"}
                          </p>
                        </div>
                      </>
                    );
                    if (!doc.ok && doc.href) {
                      return (
                        <Link
                          key={doc.checklistId}
                          href={doc.href}
                          className={className}
                          title={`Ir resolver: ${doc.label}`}
                        >
                          {body}
                        </Link>
                      );
                    }
                    return (
                      <div key={doc.checklistId} className={className}>
                        {body}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : null}
            </CardContent>
          </Card>

          {/* Exports avançados */}
          <Card>
            <CardHeader>
              <CardTitle>Exports para auditoria</CardTitle>
              <p className="text-xs text-slate-500">
                O pacote ZIP inclui documentos DGERT, SIGO, checklist, presenças, LMS, avaliações, certificados e documentos de matrícula.
                Downloads individuais também disponíveis.
              </p>
            </CardHeader>
            <CardContent className="pt-0">
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" className="bg-amber-700/80 text-white hover:bg-amber-600 border-0" disabled={busy || !selectedAcaoId || !dossie || !prontoInspecao} onClick={() => void exportar("inspecao")}>Pacote inspeção (ZIP)</Button>
              <Button variant="teal" disabled={busy || !selectedAcaoId || !dossie} onClick={() => void exportar("json")}>JSON</Button>
              <Button className="bg-purple-600 hover:bg-purple-500" disabled={busy || !selectedAcaoId || !dossie} onClick={() => void exportar("sigo")}>SIGO JSON</Button>
              <Button variant="secondary" disabled={busy || !selectedAcaoId || !dossie} onClick={() => void exportar("html")}>HTML / PDF</Button>
              <Button className="bg-indigo-600 hover:bg-indigo-500" disabled={busy || !selectedAcaoId || !dossie} onClick={() => void exportar("csv")}>SIGO CSV</Button>
              {sigoApiMode !== "disabled" ? (
                <>
                  <Button className="bg-emerald-600 hover:bg-emerald-500" disabled={busy || !selectedAcaoId || !sigoPronto} onClick={() => void submeterSigoApi()}>Submeter SIGO API</Button>
                  <Button className="bg-emerald-800 hover:bg-emerald-700" disabled={busy || !selectedAcaoId || !sigoPronto} onClick={() => void certificarSigoApi()}>Certificar (SIGO completo)</Button>
                </>
              ) : null}
            </div>
            </CardContent>
          </Card>

          {/* Archived files */}
          {dossie ? (
            <Card>
              <CardHeader>
                <CardTitle>Arquivos exportados (storage)</CardTitle>
                <p className="text-xs text-slate-500">Gera versões persistidas do dossiê/SIGO/HTML para auditoria e download posterior.</p>
              </CardHeader>
              <CardContent className="pt-0">
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
              </CardContent>
            </Card>
          ) : null}

          {loading && !dossie ? <p className="text-sm text-slate-500 text-center py-4">A carregar...</p> : null}
        </div>
      )}

      {dossie ? (
        <div className="mt-6 space-y-6">
          {/* SIGO Validation */}
          {validacaoSigo ? (
            <Card>
              <CardHeader>
                <CardTitle>Validação SIGO</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
              <p className={`text-sm font-semibold mb-3 ${sigoPronto ? "text-green-400" : "text-red-400"}`}>
                {sigoPronto ? "Pronto para exportação SIGO (sem erros bloqueantes)." : `${validacaoSigo.erros.length} erro(s) bloqueante(s) – corrige antes de submeter.`}
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
              </CardContent>
            </Card>
          ) : null}

          {/* Checklist DGERT */}
          <Card>
            <CardHeader>
              <CardTitle>Completude (checklist DGERT)</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
            <p className="text-3xl font-bold mb-1" style={{ color: scoreColor }}>{score}%</p>
            <p className="text-xs text-slate-500 mb-4">
              obrigatórios ({dossie.checklist.concluidosObrigatorios ?? dossie.checklist.concluidos}/{dossie.checklist.totalObrigatorios ?? dossie.checklist.total})
            </p>
            {dossie.checklist.prontoInspecao != null ? (
              <p className={`text-sm font-medium mb-3 ${dossie.checklist.prontoInspecao ? "text-green-400" : "text-red-400"}`}>
                {dossie.checklist.prontoInspecao ? "Todos os critérios obrigatórios cumpridos." : "Ainda existem critérios obrigatórios por cumprir."}
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
              {dossie.checklist.items.map((item) => {
                const href = !item.ok ? resolveDgertRequisitoHref(item.id, resolveCtx) : null;
                const rowClass = `flex items-start gap-2 text-sm rounded-lg px-2 py-1.5 -mx-2 ${
                  item.ok
                    ? "text-slate-200"
                    : "text-slate-300 hover:bg-amber-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                }`;
                const content = (
                  <>
                    <span className={`mt-0.5 flex-shrink-0 ${item.ok ? "text-green-400" : "text-amber-400"}`}>
                      {item.ok ? "✓" : "○"}
                    </span>
                    <div className="min-w-0">
                      <span className={!item.ok && href ? "underline decoration-amber-500/40 underline-offset-2" : undefined}>
                        {item.label}
                      </span>
                      {item.severidade === "obrigatorio" && !item.ok ? (
                        <span className="ml-1.5 text-[10px] font-medium uppercase tracking-wide text-amber-500">
                          obrigatório
                        </span>
                      ) : null}
                      {item.detalhe ? <span className="text-slate-600 text-xs ml-1">({item.detalhe})</span> : null}
                      {!item.ok && item.accaoSugerida ? (
                        <p className="text-slate-500 text-xs mt-0.5">→ {item.accaoSugerida}</p>
                      ) : null}
                    </div>
                  </>
                );
                if (href) {
                  return (
                    <Link key={item.id} href={href} className={rowClass} title={`Ir resolver: ${item.label}`}>
                      {content}
                    </Link>
                  );
                }
                return (
                  <div key={item.id} className={rowClass}>
                    {content}
                  </div>
                );
              })}
            </div>
            </CardContent>
          </Card>

          {dossie.dtp ? (
            <Card>
              <CardHeader>
                <CardTitle>
                  Quadro de verificação DTP ({dossie.dtp.tipoLabel})
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-3xl font-bold mb-1 text-sky-400">{dossie.dtp.scorePercent}%</p>
                <p className="text-xs text-slate-500 mb-4">
                  {dossie.dtp.concluidos}/{dossie.dtp.total} itens do quadro presencial
                </p>
                {dossie.dtp.secoes.map((sec) => (
                  <div key={sec.ordem} className="mb-4">
                    <p className="text-sm font-medium text-slate-200 mb-2">
                      {sec.titulo}{" "}
                      <span className="text-slate-500 font-normal">
                        ({sec.concluidos}/{sec.total})
                      </span>
                    </p>
                    <div className="space-y-1.5">
                      {sec.itens.map((item) => (
                        <div
                          key={item.id}
                          className={`flex items-start gap-2 text-sm rounded-lg px-2 py-1.5 -mx-2 ${
                            item.ok ? "text-slate-200" : "text-slate-300"
                          }`}
                        >
                          <span
                            className={`mt-0.5 flex-shrink-0 ${item.ok ? "text-green-400" : "text-amber-400"}`}
                          >
                            {item.ok ? "✓" : "○"}
                          </span>
                          <div className="min-w-0">
                            <span>{item.label}</span>
                            {item.manual && !item.ok ? (
                              <span className="ml-1.5 text-[10px] uppercase tracking-wide text-slate-500">
                                anexo manual
                              </span>
                            ) : null}
                            {item.detalhe ? (
                              <span className="text-slate-600 text-xs ml-1">({item.detalhe})</span>
                            ) : null}
                            {!item.ok && item.accaoSugerida ? (
                              <p className="text-slate-500 text-xs mt-0.5">→ {item.accaoSugerida}</p>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <p className="text-[11px] text-slate-600 mt-2">
                  Tipo de financiamento definido na acção. Itens manuais: anexar na acção com categoria{" "}
                  <code className="text-slate-400">dtp_&lt;id&gt;</code> (ex.:{" "}
                  <code className="text-slate-400">dtp_notificacao_aprovacao</code>).
                </p>
              </CardContent>
            </Card>
          ) : null}

          {/* Curso / acção */}
          <Card>
            <CardHeader>
              <CardTitle>Curso / acção</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
            <p className="text-sm text-slate-200">
              <strong>{String(dossie.curso.designacao)}</strong>
              {dossie.curso.codigoUfcd ? ` · UFCD ${String(dossie.curso.codigoUfcd)}` : null}
              {" · "}{String(dossie.curso.cargaHoras)}h · {String(dossie.curso.modalidade)}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {String(dossie.acaoFormacao.codigoInterno)} – {String(dossie.acaoFormacao.titulo)} [{String(dossie.acaoFormacao.estado)}]
            </p>
            {dossie.curso.objetivos ? <p className="text-xs text-slate-400 mt-2 line-clamp-2">{String(dossie.curso.objetivos)}</p> : null}
            </CardContent>
          </Card>

          {/* Formandos e assiduidade */}
          <Card>
            <CardHeader>
              <CardTitle>Formandos e assiduidade</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
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
              Taxa de presença global:{" "}
              {dossie.assiduidade.taxaPresenca != null
                ? `${dossie.assiduidade.taxaPresenca}% (${dossie.assiduidade.presencasMarcadas}/${dossie.assiduidade.presencasRegistadas})`
                : "–"}
            </p>
            </CardContent>
          </Card>

          {/* Sessões, sumários e presenças */}
          <Card>
            <CardHeader>
              <CardTitle>Sessões, sumários e presenças</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
            {!dossie.cronograma?.sessoes.length ? (
              <p className="text-sm text-slate-500">Sem cronograma/sessões.</p>
            ) : (
              <div className="divide-y divide-slate-700/20 mb-4">
                {dossie.cronograma.sessoes.map((s) => {
                  const folha = s.folhasPresenca[0];
                  const folhaEstado = folha
                    ? folha.fechadaEm || folha.aprovadaGestorEm
                      ? "aprovada"
                      : folha.validadaFormadorEm
                        ? "validada (aberta)"
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
                          {s.sumarios[0].imutavel
                            ? s.sumarios[0].assinaturaTipo === "pdf_upload" || s.sumarios[0].pdfStorageKey
                              ? "Sumário com PDF assinado"
                              : "Sumário assinado"
                            : "Sumário rascunho"}
                        </span>
                      ) : (
                        <span className="text-yellow-400">Sem sumário</span>
                      )}
                      {s.sumarios[0]?.pdfStorageKey ? (
                        <button
                          type="button"
                          className="ml-2 text-blue-400 hover:text-blue-300 underline"
                          onClick={() => {
                            void (async () => {
                              const res = await bffFetch(`/api/v1/sumarios/${s.sumarios[0].id}/pdf`, {
                                headers: { accept: "application/pdf" },
                              });
                              if (!res.ok) { setError(await parseErr(res)); return; }
                              await downloadResponseAsFile(
                                res,
                                s.sumarios[0].pdfNomeFicheiro ?? `sumario-${s.numeroSessao}.pdf`,
                              );
                            })();
                          }}
                        >
                          Ver PDF
                        </button>
                      ) : null}
                      {folha ? (
                        <span className="text-slate-500">
                          {" · "}
                          Presenças {folha.presentes}/{folha.totalPresencas}{" "}
                          {folhaEstado === "aprovada"
                            ? "(aprovada)"
                            : folhaEstado === "validada (aberta)"
                              ? "(validada)"
                              : "(em edição)"}
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
              <div className="space-y-3 max-w-lg">
                <p className="text-sm font-medium text-slate-400">Registar sumário</p>
                <Select
                  value={sessaoSumarioId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSessaoSumarioId(id);
                    const sessao = dossie.cronograma?.sessoes.find((s) => s.id === id);
                    const draft = sessao?.sumarios.find((s) => !s.imutavel);
                    setLastSumarioId(draft?.id ?? "");
                    setPdfFile(null);
                  }}
                >
                  {dossie.cronograma.sessoes.map((s) => (
                    <option key={s.id} value={s.id}>
                      Sessão {s.numeroSessao} ({String(s.data).slice(0, 10)})
                      {s.terminadaEm ? "" : " - por terminar"}
                    </option>
                  ))}
                </Select>
                {!sessaoSumarioActiva?.terminadaEm ? (
                  <p className="text-xs text-amber-200/90">
                    O sumário só pode ser preenchido depois de a sessão seleccionada ser terminada.
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2 items-center">
                  <Button
                    type="button"
                    disabled={
                      busy ||
                      !sessaoSumarioId ||
                      (!sumarioActivo?.imutavel && !sessaoSumarioActiva?.terminadaEm)
                    }
                    onClick={() => setSumarioModalOpen(true)}
                  >
                    {sumarioActivo?.imutavel
                      ? "Ver sumário"
                      : sumarioActivo?.id
                        ? "Continuar sumário"
                        : "Registar e assinar"}
                  </Button>
                  {sumarioActivo?.id && !sumarioActivo.imutavel && sessaoSumarioActiva?.terminadaEm ? (
                    <>
                      <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-600/60 text-sm text-slate-300 cursor-pointer hover:border-slate-500">
                        <span>{pdfFile ? pdfFile.name : "PDF assinado (.pdf)"}</span>
                        <input
                          type="file"
                          accept="application/pdf,.pdf"
                          className="sr-only"
                          onChange={(e) => {
                            const f = e.target.files?.[0] ?? null;
                            if (
                              f &&
                              f.type !== "application/pdf" &&
                              !f.name.toLowerCase().endsWith(".pdf")
                            ) {
                              setError("Apenas ficheiros PDF (.pdf) são aceites.");
                              setPdfFile(null);
                              e.target.value = "";
                              return;
                            }
                            setError(null);
                            setPdfFile(f);
                          }}
                        />
                      </label>
                      <Button
                        type="button"
                        className="bg-emerald-700 hover:bg-emerald-600"
                        disabled={busy || !pdfFile}
                        onClick={() => void uploadPdfAssinado()}
                      >
                        Carregar PDF assinado
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            ) : null}
            </CardContent>
          </Card>

          {/* Formadores */}
          {dossie.formadores.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Formadores</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                {dossie.formadores.map((f, i) => (
                  <span key={i}>{f.nomeCompleto} <span className="text-slate-600">· NIF {f.nif}</span></span>
                ))}
              </div>
              </CardContent>
            </Card>
          ) : null}

          <p className="text-[11px] text-slate-600">Gerado: {new Date(dossie.geradoEm).toLocaleString("pt-PT")}</p>
        </div>
      ) : null}

      <SumarioAssinaturaModal
        open={sumarioModalOpen}
        busy={busy}
        readOnly={!!sumarioActivo?.imutavel}
        documento={
          sessaoSumarioActiva
            ? {
                numeroSessao: sessaoSumarioActiva.numeroSessao,
                data: sessaoSumarioActiva.data,
                horaInicio: sessaoSumarioActiva.horaInicio,
                horaFim: sessaoSumarioActiva.horaFim,
                formadorNome: sessaoSumarioActiva.formador?.nomeCompleto ?? null,
                conteudo: sumarioActivo?.conteudo ?? "",
              }
            : null
        }
        onClose={() => {
          if (!busy) setSumarioModalOpen(false);
        }}
        onConfirm={(payload) => void confirmarSumarioAssinatura(payload)}
      />
    </>
  );
}
