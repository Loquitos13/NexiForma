"use client";

import { useEffect, useState } from "react";
import { FileText, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  Button,
  Dialog,
  DialogContent,
  Textarea,
} from "@/components/ui";
import {
  criarNotaComercialFromTranscricao,
  useTeamsTranscricaoJobs,
  type TeamsTranscricaoJob,
} from "@/lib/crm/teams-transcricao-jobs-context";

type NotaForm = {
  contexto: string;
  situacaoActual: string;
  dorNecessidade: string;
  orcamentoTiming: string;
  decisor: string;
  proximoPassoNota: string;
  notasLivres: string;
};

const emptyForm = (): NotaForm => ({
  contexto: "",
  situacaoActual: "",
  dorNecessidade: "",
  orcamentoTiming: "",
  decisor: "",
  proximoPassoNota: "",
  notasLivres: "",
});

type Props = {
  job: TeamsTranscricaoJob | null;
};

export function TeamsTranscricaoNotaModal({ job }: Props) {
  const router = useRouter();
  const { fecharModal, descartarJob, marcarNotaCriada } = useTeamsTranscricaoJobs();
  const [form, setForm] = useState<NotaForm>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!job) {
      setForm(emptyForm());
      setErro(null);
      return;
    }
    const mins = Math.floor((job.duracaoSegundos ?? 0) / 60);
    const secs = (job.duracaoSegundos ?? 0) % 60;
    setForm({
      ...emptyForm(),
      contexto: [
        `Reunião Teams «${job.titulo}» concluída.`,
        job.clienteNome ? `Cliente: ${job.clienteNome}.` : null,
        job.duracaoSegundos != null
          ? `Duração: ${mins}m ${String(secs).padStart(2, "0")}s.`
          : null,
      ]
        .filter(Boolean)
        .join("\n"),
    });
  }, [job?.reuniaoId]);

  if (!job) return null;

  const open = job.modalOpen;

  const handleOpenChange = (o: boolean) => {
    if (!o) fecharModal(job.reuniaoId);
  };

  const submitNota = async () => {
    setBusy(true);
    setErro(null);
    const result = await criarNotaComercialFromTranscricao(job, form);
    setBusy(false);
    if (!result.ok) {
      setErro(result.erro);
      return;
    }
    marcarNotaCriada(job.reuniaoId);
    router.push("/portal/crm/interaccoes");
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        title="Transcrição Teams pronta"
        description={
          job.notaJaCriada
            ? "Revê a conversa abaixo. Se ainda não criaste nota manualmente, podes registá-la agora com a transcrição anexada."
            : "A conversa foi importada. Preenche os campos comerciais e regista a nota de follow-up."
        }
        className="max-w-2xl"
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <div className="rounded-lg border border-teal-500/25 bg-teal-950/20 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-teal-300/90">
              <FileText className="h-3.5 w-3.5" />
              Conversa
            </p>
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap text-xs leading-relaxed text-slate-300">
              {job.transcricao}
            </pre>
          </div>

          {!job.notaJaCriada ? (
            <div className="space-y-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-violet-300">
                <Sparkles className="h-3.5 w-3.5" />
                Nota comercial
              </p>
              {(
                [
                  ["contexto", "Contexto"],
                  ["situacaoActual", "Situação actual"],
                  ["dorNecessidade", "Dor / necessidade"],
                  ["orcamentoTiming", "Orçamento / timing"],
                  ["decisor", "Decisor"],
                  ["proximoPassoNota", "Próximo passo"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="block">
                  <span className="text-xs text-slate-400">{label}</span>
                  <Textarea
                    rows={2}
                    value={form[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="mt-1"
                  />
                </label>
              ))}
              <label className="block">
                <span className="text-xs text-slate-400">Notas livres</span>
                <Textarea
                  rows={2}
                  value={form.notasLivres}
                  onChange={(e) => setForm((f) => ({ ...f, notasLivres: e.target.value }))}
                  className="mt-1"
                />
              </label>
              <p className="text-[11px] text-slate-500">
                A transcrição Teams será anexada automaticamente à nota.
              </p>
            </div>
          ) : (
            <p className="text-xs text-emerald-300/90">
              Já existe uma nota de follow-up desta reunião - a transcrição será (ou já foi) anexada
              automaticamente quando disponível.
            </p>
          )}

          {erro ? <p className="text-xs text-red-400">{erro}</p> : null}
        </div>

        <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-slate-800 pt-4">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              descartarJob(job.reuniaoId);
            }}
          >
            Fechar
          </Button>
          {!job.notaJaCriada ? (
            <Button size="sm" disabled={busy} onClick={() => void submitNota()}>
              {busy ? "A registar…" : "Criar nota comercial"}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => {
                marcarNotaCriada(job.reuniaoId);
                router.push("/portal/crm/interaccoes");
              }}
            >
              Ver interacções
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
