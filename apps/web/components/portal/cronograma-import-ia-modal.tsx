"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Sparkles, Upload } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { extractCronogramaTextFromFile } from "@/lib/client/extract-cronograma-text";
import { formatDatePt } from "@/lib/calendar-date";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type SessaoDraft = {
  numeroSessao: number;
  data: string;
  horaInicio: string;
  horaFim: string;
  modalidade: string;
  moduloUnidadeId: string | null;
  formadorId: string | null;
  tituloModulo?: string | null;
  notas?: string | null;
  assincrona?: boolean;
};

type PrazoModuloDraft = {
  data: string;
  moduloCodigo: string | null;
  moduloTitulo: string | null;
  moduloUnidadeId: string | null;
};

type ImportDraft = {
  sessoes: SessaoDraft[];
  prazoConclusaoLms: string | null;
  prazosModulos?: PrazoModuloDraft[];
  avisos: string[];
  legendaResumo: string | null;
  conformidadeCurso?: {
    modulosCurso: number;
    modulosComSessao: number;
    modulosSemSessao: string[];
    referenciasSemModuloCurso: string[];
    porModulo: Array<{
      moduloId: string;
      titulo: string;
      metodologia: string | null;
      horasEsperadas: number;
      horasPlaneadas: number;
      sessoes: number;
      ok: boolean;
      nota: string | null;
    }>;
    avisos: string[];
    requerConfirmacao: boolean;
  };
};

type JobStatus = "A_PROCESSAR" | "RASCUNHO" | "FALHA" | "APLICADO" | "DESCARTADO";

type ImportJob = {
  id: string;
  cronogramaId: string;
  acaoFormacaoId: string;
  status: JobStatus;
  nomeFicheiro: string | null;
  resultado: ImportDraft | null;
  erro: string | null;
};

type Step = "upload" | "processing" | "preview" | "error";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cronogramaId: string;
  hasSessoes: boolean;
  /** Turma destino das sessões importadas. */
  turmaId?: string | null;
  onApplied: () => void | Promise<void>;
  /** Texto já extraído (ex.: ao criar acção) - inicia a análise em background ao abrir. */
  seedTexto?: string | null;
  seedNomeFicheiro?: string | null;
  /** Esconde o passo de upload (só é usado para disparar a análise inicial ao criar a acção). */
  seedOnly?: boolean;
  /** Reabre o modal já ligado a um job existente (chip clicado / link com ?importJob=). */
  initialJobId?: string | null;
  /** Chamado quando um novo job é criado e o modal fecha - use para mostrar uma mensagem. */
  onJobStarted?: (job: { id: string }) => void;
  /** Chamado após descartar o rascunho (para refrescar chips/banner). */
  onDiscarded?: () => void | Promise<void>;
};

const POLL_MS = 4_000;

async function parseErr(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { message?: string | string[] };
    if (Array.isArray(j.message)) return j.message.join(" · ");
    if (j.message) return String(j.message);
  } catch {
    /* ignore */
  }
  return `Erro HTTP ${res.status}`;
}

export function CronogramaImportIaModal({
  open,
  onOpenChange,
  cronogramaId,
  hasSessoes,
  turmaId = null,
  onApplied,
  seedTexto = null,
  seedNomeFicheiro = null,
  seedOnly = false,
  initialJobId = null,
  onJobStarted,
  onDiscarded,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const seededRef = useRef<string | null>(null);
  const loadedJobRef = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [step, setStep] = useState<Step>(initialJobId ? "processing" : "upload");
  const [jobId, setJobId] = useState<string | null>(initialJobId ?? null);
  // Nota: os defaults acima só importam no 1º render (ex.: modal aberto directamente via ?importJob=);
  // qualquer reabertura subsequente é tratada pelo efeito abaixo + reset() ao fechar.
  const [draft, setDraft] = useState<ImportDraft | null>(null);
  const [dirty, setDirty] = useState(false);
  const [actualizarPrazo, setActualizarPrazo] = useState(true);
  const [actualizarPrazosModulos, setActualizarPrazosModulos] = useState(true);
  const [activarLockManual, setActivarLockManual] = useState(true);
  const [substituir, setSubstituir] = useState(true);
  const [confirmarDesalinhamento, setConfirmarDesalinhamento] = useState(false);
  const [paste, setPaste] = useState("");

  function reset() {
    setBusy(false);
    setSaving(false);
    setErr(null);
    setInfo(null);
    setStep("upload");
    setJobId(null);
    setDraft(null);
    setDirty(false);
    setPaste("");
    setActualizarPrazo(true);
    setActualizarPrazosModulos(true);
    setActivarLockManual(true);
    setSubstituir(true);
    setConfirmarDesalinhamento(false);
    seededRef.current = null;
    loadedJobRef.current = null;
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleOpenChange(next: boolean, opts: { skipAutoSave?: boolean } = {}) {
    if (!next) {
      // Melhor esforço: guarda alterações não gravadas antes de fechar.
      if (!opts.skipAutoSave && jobId && dirty && draft && step === "preview") {
        void guardarRascunho(jobId, draft, { silent: true });
      }
      reset();
    }
    onOpenChange(next);
  }

  const buildJobDraft = useCallback((job: ImportJob) => job.resultado, []);

  async function guardarRascunho(
    id: string,
    d: ImportDraft,
    opts: { silent?: boolean } = {},
  ) {
    if (!opts.silent) setSaving(true);
    try {
      const res = await bffFetch(`/api/v1/cronogramas/importar-ia/jobs/${id}/rascunho`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          sessoes: d.sessoes.map((s) => ({
            numeroSessao: s.numeroSessao,
            data: s.data,
            horaInicio: s.horaInicio,
            horaFim: s.horaFim,
            modalidade: s.modalidade,
            moduloUnidadeId: s.moduloUnidadeId,
            formadorId: s.formadorId,
            tituloModulo: s.tituloModulo ?? null,
          })),
          prazoConclusaoLms: d.prazoConclusaoLms,
          prazosModulos: d.prazosModulos ?? [],
          legendaResumo: d.legendaResumo,
          avisos: d.avisos,
        }),
      });
      if (!res.ok) {
        if (!opts.silent) setErr(await parseErr(res));
        return;
      }
      setDirty(false);
      if (!opts.silent) setInfo("Rascunho guardado.");
    } finally {
      if (!opts.silent) setSaving(false);
    }
  }

  const carregarJob = useCallback(async (id: string): Promise<boolean> => {
    const res = await bffFetch(`/api/v1/cronogramas/importar-ia/jobs/${id}`, {
      headers: { accept: "application/json" },
    });
    if (!res.ok) {
      setErr(await parseErr(res));
      setStep("error");
      return true;
    }
    const job = (await res.json()) as ImportJob;
    if (job.status === "A_PROCESSAR") {
      setStep("processing");
      return false;
    }
    if (job.status === "RASCUNHO") {
      const d = buildJobDraft(job);
      setDraft(d);
      setJobId(job.id);
      setDirty(false);
      if (d?.prazoConclusaoLms) setActualizarPrazo(true);
      setStep("preview");
      return true;
    }
    if (job.status === "FALHA") {
      setErr(job.erro ?? "A IA não conseguiu analisar este cronograma.");
      setJobId(job.id);
      setStep("error");
      return true;
    }
    // APLICADO / DESCARTADO - nada a mostrar
    setErr("Este rascunho já não está disponível (aplicado ou descartado).");
    setStep("error");
    return true;
  }, [buildJobDraft]);

  useEffect(() => {
    if (!open || !initialJobId) return;
    if (loadedJobRef.current === initialJobId) return;
    loadedJobRef.current = initialJobId;
    setJobId(initialJobId);
    setStep("processing");
    void carregarJob(initialJobId);
  }, [open, initialJobId, carregarJob]);

  useEffect(() => {
    if (!open || step !== "processing" || !jobId) return;
    const id = setInterval(() => void carregarJob(jobId), POLL_MS);
    return () => clearInterval(id);
  }, [open, step, jobId, carregarJob]);

  async function iniciarJobTexto(texto: string, nomeFicheiro?: string) {
    setBusy(true);
    setErr(null);
    try {
      const res = await bffFetch(`/api/v1/cronogramas/${cronogramaId}/importar-ia/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({ texto, nomeFicheiro }),
      });
      if (!res.ok) {
        setErr(await parseErr(res));
        return;
      }
      const job = (await res.json()) as { id: string };
      onJobStarted?.(job);
      handleOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!open || initialJobId || !seedTexto?.trim() || !cronogramaId) return;
    const key = `${cronogramaId}:${seedTexto.length}:${seedNomeFicheiro ?? ""}`;
    if (seededRef.current === key) return;
    seededRef.current = key;
    void iniciarJobTexto(seedTexto, seedNomeFicheiro ?? undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed dispara um único job por abertura
  }, [open, initialJobId, cronogramaId, seedTexto, seedNomeFicheiro]);

  async function onFile(file: File | null) {
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      const texto = await extractCronogramaTextFromFile(file);
      if (!texto.trim() || texto.trim().length < 40) {
        setErr("Não foi possível ler texto suficiente do ficheiro (PDF digitalizado sem OCR?).");
        return;
      }
      await iniciarJobTexto(texto, file.name);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao ler o ficheiro.");
    } finally {
      setBusy(false);
    }
  }

  async function descartarJob() {
    if (!jobId) {
      handleOpenChange(false, { skipAutoSave: true });
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await bffFetch(`/api/v1/cronogramas/importar-ia/jobs/${jobId}/descartar`, {
        method: "POST",
        headers: { accept: "application/json" },
      });
      if (!res.ok) {
        setErr(await parseErr(res));
        return;
      }
      handleOpenChange(false, { skipAutoSave: true });
      await onDiscarded?.();
    } finally {
      setBusy(false);
    }
  }

  async function aplicar() {
    if (!draft?.sessoes.length || !jobId) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await bffFetch(`/api/v1/cronogramas/importar-ia/jobs/${jobId}/aplicar`, {
        method: "POST",
        headers: { "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          sessoes: draft.sessoes.map((s) => ({
            numeroSessao: s.numeroSessao,
            data: s.data,
            horaInicio: s.horaInicio,
            horaFim: s.horaFim,
            modalidade: s.modalidade,
            moduloUnidadeId: s.moduloUnidadeId,
            formadorId: s.formadorId,
            tituloModulo: s.tituloModulo ?? null,
          })),
          prazoConclusaoLms: draft.prazoConclusaoLms,
          actualizarPrazoLms: Boolean(actualizarPrazo && draft.prazoConclusaoLms),
          prazosModulos: draft.prazosModulos ?? [],
          actualizarPrazosModulos: Boolean(
            actualizarPrazosModulos && (draft.prazosModulos?.length ?? 0) > 0,
          ),
          activarLockManualModulos: Boolean(
            activarLockManual && (draft.prazosModulos?.length ?? 0) > 0,
          ),
          substituirExistentes: hasSessoes ? substituir : true,
          confirmarDesalinhamento: confirmarDesalinhamento || !draft.conformidadeCurso?.requerConfirmacao,
          ...(turmaId ? { turmaId } : {}),
        }),
      });
      if (!res.ok) {
        setErr(await parseErr(res));
        return;
      }
      handleOpenChange(false, { skipAutoSave: true });
      await onApplied();
    } finally {
      setBusy(false);
    }
  }

  function updateSessao(idx: number, patch: Partial<SessaoDraft>) {
    setDraft((d) => {
      if (!d) return d;
      const sessoes = d.sessoes.map((s, i) => (i === idx ? { ...s, ...patch } : s));
      return { ...d, sessoes };
    });
    setDirty(true);
  }

  function removeSessao(idx: number) {
    setDraft((d) => {
      if (!d) return d;
      const sessoes = d.sessoes
        .filter((_, i) => i !== idx)
        .map((s, i) => ({ ...s, numeroSessao: i + 1 }));
      return { ...d, sessoes };
    });
    setDirty(true);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        title="Importar cronograma com IA"
        description="Carregue um cronograma existente (HTML, PDF com texto, TXT). A IA lê a legenda e propõe as sessões em background."
        className="max-h-[min(94dvh,960px)] max-w-5xl"
      >
        {err ? (
          <p className="mb-3 rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-red-200">
            {err}
          </p>
        ) : null}
        {info ? (
          <p className="mb-3 rounded-lg border border-emerald-500/40 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-200">
            {info}
          </p>
        ) : null}

        {step === "processing" ? (
          <div className="flex flex-col items-center gap-3 py-10 text-sm text-slate-300">
            <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
            A IA está a analisar o cronograma em background…
            <span className="text-xs text-slate-500">
              Pode fechar esta janela - avisamos quando o rascunho estiver pronto.
            </span>
            <Button type="button" variant="secondary" onClick={() => handleOpenChange(false)}>
              Fechar e continuar em background
            </Button>
          </div>
        ) : step === "error" ? (
          <div className="flex flex-wrap gap-2 py-6">
            <Button type="button" variant="secondary" onClick={() => handleOpenChange(false)}>
              Fechar
            </Button>
            {jobId ? (
              <Button type="button" variant="secondary" disabled={busy} onClick={() => void descartarJob()}>
                Descartar
              </Button>
            ) : null}
          </div>
        ) : step === "upload" && !seedOnly ? (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-600 bg-slate-800/40 px-4 py-8">
              <Upload className="h-8 w-8 text-slate-400" />
              <p className="text-sm text-slate-300 text-center max-w-md">
                Preferível o HTML do cronograma (botão Transferir na acção). PDFs digitalizados
                falham com frequência. A análise corre em background - pode continuar a trabalhar.
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".html,.htm,.pdf,.txt,.csv,text/html,application/pdf,text/plain,text/csv"
                className="hidden"
                onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
              />
              <Button
                type="button"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Escolher ficheiro
              </Button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-400">Ou colar texto do cronograma</label>
              <textarea
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
                rows={5}
                className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-200"
                placeholder="Cole aqui a legenda + grelha de dias/horas…"
              />
              <Button
                type="button"
                variant="secondary"
                disabled={busy || paste.trim().length < 40}
                onClick={() => void iniciarJobTexto(paste)}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Analisar em background
              </Button>
            </div>
          </div>
        ) : step === "preview" ? (
          draft ? (
          <div className="space-y-4">
            {draft.legendaResumo ? (
              <p className="text-xs text-slate-400 whitespace-pre-wrap">{draft.legendaResumo}</p>
            ) : null}
            {draft.avisos?.length ? (
              <ul className="text-xs text-amber-200/90 list-disc pl-4 space-y-0.5">
                {draft.avisos.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            ) : null}

            {draft.conformidadeCurso ? (
              <div className="rounded-lg border border-slate-700/50 bg-slate-900/50 px-3 py-3 space-y-2">
                <p className="text-xs font-medium text-slate-300">
                  Conformidade com o curso ({draft.conformidadeCurso.modulosComSessao}/
                  {draft.conformidadeCurso.modulosCurso} módulos com sessão)
                </p>
                {draft.conformidadeCurso.porModulo.length > 0 ? (
                  <ul className="text-xs text-slate-400 space-y-1 max-h-40 overflow-y-auto">
                    {draft.conformidadeCurso.porModulo.map((m) => (
                      <li key={m.moduloId} className={m.ok ? "" : "text-amber-200/90"}>
                        <span className="font-medium text-slate-300">{m.titulo}</span>
                        {" · "}
                        {m.horasPlaneadas}h planeadas / {m.horasEsperadas}h curso
                        {m.metodologia ? ` (${m.metodologia})` : ""}
                        {m.nota ? ` - ${m.nota}` : ""}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {draft.conformidadeCurso.requerConfirmacao ? (
                  <label className="flex items-start gap-2 text-xs text-amber-200/90">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={confirmarDesalinhamento}
                      onChange={(e) => setConfirmarDesalinhamento(e.target.checked)}
                    />
                    Confirmo que revi as diferenças face aos módulos e horas configurados no curso.
                  </label>
                ) : null}
              </div>
            ) : null}

            {draft.prazoConclusaoLms ? (
              <label className="flex items-center gap-2 text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={actualizarPrazo}
                  onChange={(e) => setActualizarPrazo(e.target.checked)}
                />
                Definir prazo LMS global da acção:{" "}
                <strong className="font-medium">{formatDatePt(draft.prazoConclusaoLms)}</strong>
              </label>
            ) : null}

            {(draft.prazosModulos?.length ?? 0) > 0 ? (
              <div className="space-y-2 rounded-lg border border-slate-700/50 bg-slate-900/40 px-3 py-3">
                <label className="flex items-center gap-2 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    checked={actualizarPrazosModulos}
                    onChange={(e) => setActualizarPrazosModulos(e.target.checked)}
                  />
                  Definir datas limite LMS por módulo ({draft.prazosModulos!.length})
                </label>
                <ul className="grid gap-1 text-xs text-slate-400 sm:grid-cols-2">
                  {draft.prazosModulos!.map((p) => (
                    <li key={`${p.moduloCodigo ?? p.moduloTitulo}-${p.data}`}>
                      <span className="font-medium text-slate-300">
                        {p.moduloCodigo ?? "Módulo"}
                      </span>
                      {p.moduloTitulo ? ` - ${p.moduloTitulo}` : ""}:{" "}
                      <span className="text-amber-200/90">{formatDatePt(p.data)}</span>
                    </li>
                  ))}
                </ul>
                <label className="flex items-start gap-2 text-xs text-slate-400">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={activarLockManual}
                    disabled={!actualizarPrazosModulos}
                    onChange={(e) => setActivarLockManual(e.target.checked)}
                  />
                  Activar bloqueio manual nesses módulos - o formador liberta o módulo seguinte
                  quando os formandos puderem avançar.
                </label>
              </div>
            ) : null}

            {hasSessoes ? (
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-400">Sessões já existentes</label>
                <Select
                  value={substituir ? "replace" : "append"}
                  onChange={(e) => setSubstituir(e.target.value === "replace")}
                >
                  <option value="replace">Substituir todas as sessões actuais</option>
                  <option value="append">Acrescentar às sessões actuais</option>
                </Select>
              </div>
            ) : null}

            <div className="overflow-x-auto rounded-lg border border-slate-700/50">
              <table className="w-full min-w-[52rem] text-left text-xs text-slate-300">
                <thead className="bg-slate-800/80 text-slate-400">
                  <tr>
                    <th className="px-2 py-2 w-8">#</th>
                    <th className="px-2 py-2">Data</th>
                    <th className="px-2 py-2">Início</th>
                    <th className="px-2 py-2">Fim</th>
                    <th className="px-2 py-2">Modalidade</th>
                    <th className="px-2 py-2">Módulo</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {draft.sessoes.map((s, idx) => (
                    <tr key={`${s.numeroSessao}-${s.data}-${idx}`} className="border-t border-slate-800">
                      <td className="px-2 py-1.5 tabular-nums">{s.numeroSessao}</td>
                      <td className="px-2 py-1.5">
                        <Input
                          type="date"
                          value={s.data}
                          className="h-8 min-w-[8.5rem] text-xs"
                          onChange={(e) => updateSessao(idx, { data: e.target.value })}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          type="time"
                          value={s.horaInicio}
                          className="h-8 w-[6.5rem] text-xs"
                          onChange={(e) => updateSessao(idx, { horaInicio: e.target.value })}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          type="time"
                          value={s.horaFim}
                          className="h-8 w-[6.5rem] text-xs"
                          onChange={(e) => updateSessao(idx, { horaFim: e.target.value })}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Select
                          value={s.modalidade}
                          className="h-8 min-w-[8.5rem] text-xs"
                          onChange={(e) => updateSessao(idx, { modalidade: e.target.value })}
                        >
                          <option value="presencial">Presencial</option>
                          <option value="online">Online</option>
                          <option value="b-learning">B-learning</option>
                        </Select>
                        {s.assincrona ? (
                          <Badge variant="yellow" className="mt-1">
                            Assíncrona
                          </Badge>
                        ) : null}
                      </td>
                      <td className="px-2 py-1.5 min-w-[12rem]" title={s.tituloModulo ?? ""}>
                        {s.tituloModulo ?? "-"}
                      </td>
                      <td className="px-2 py-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => removeSessao(idx)}
                        >
                          Remover
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => void descartarJob()}
              >
                Descartar
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => handleOpenChange(false)}
              >
                Mais tarde
              </Button>
              {jobId ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy || saving || !dirty}
                  onClick={() => draft && void guardarRascunho(jobId, draft)}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Guardar rascunho
                </Button>
              ) : null}
              <Button
                type="button"
                disabled={
                  busy ||
                  draft.sessoes.length === 0 ||
                  (draft.conformidadeCurso?.requerConfirmacao && !confirmarDesalinhamento)
                }
                onClick={() => void aplicar()}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Criar {draft.sessoes.length}{" "}
                {draft.sessoes.length === 1 ? "sessão" : "sessões"}
              </Button>
            </div>
          </div>
          ) : (
          <div className="flex flex-col gap-3 py-6 text-sm text-slate-300">
            <p>Este rascunho não tem sessões para mostrar.</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" disabled={busy} onClick={() => void descartarJob()}>
                Descartar
              </Button>
              <Button type="button" variant="secondary" onClick={() => handleOpenChange(false)}>
                Fechar
              </Button>
            </div>
          </div>
          )
        ) : busy && seedOnly ? (
          <div className="flex flex-col items-center gap-3 py-10 text-sm text-slate-300">
            <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
            A iniciar a análise do cronograma com IA…
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
