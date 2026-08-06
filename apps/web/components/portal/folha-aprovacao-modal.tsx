"use client";

import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { labelEstadoPresencaOuPorAssinalar, type EstadoPresenca } from "@nexiforma/shared";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/ui/cn";

export type FolhaAprovacaoLinha = {
  id: string;
  estado: EstadoPresenca | string | null;
  motivoJustificacao?: string | null;
  matricula: { formando: { nome: string; nif: string } };
};

export type FolhaAprovacaoDoc = {
  numeroSessao?: number | null;
  data?: string | null;
  horaInicio?: string | null;
  horaFim?: string | null;
  modalidade?: string | null;
  formadorNome?: string | null;
  turmaLabel?: string | null;
  presencas: FolhaAprovacaoLinha[];
};

export type FolhaAprovacaoConfirm = {
  nomeAssinatura: string;
};

export type FolhaAssinaturaModo = "validacao-formador" | "aprovacao-gestor";

type Props = {
  open: boolean;
  busy?: boolean;
  /** Validação pelo formador vs aprovação pelo gestor/coordenador. */
  modo?: FolhaAssinaturaModo;
  documento: FolhaAprovacaoDoc | null;
  onClose: () => void;
  onConfirm: (payload: FolhaAprovacaoConfirm) => void | Promise<void>;
};

type Step = "revisao" | "assinatura";

function formatDataLabel(value?: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleDateString("pt-PT");
}

const COPY: Record<
  FolhaAssinaturaModo,
  {
    title: string;
    descRevisao: string;
    descAssinatura: string;
    avisoAssinatura: string;
    labelAssinatura: string;
    confirmar: string;
  }
> = {
  "validacao-formador": {
    title: "Validar folha de presenças",
    descRevisao: "Passo 1 - reveja todas as presenças antes de validar.",
    descAssinatura: "Passo 2 - escreva o nome para assinar a validação.",
    avisoAssinatura:
      "Ao assinar, confirma a assiduidade desta sessão. A folha ficará à espera de aprovação do gestor ou coordenador pedagógico.",
    labelAssinatura: "Assinatura do formador",
    confirmar: "Confirmar validação",
  },
  "aprovacao-gestor": {
    title: "Aprovar folha de presenças",
    descRevisao: "Passo 1 - reveja a assiduidade antes de aprovar.",
    descAssinatura: "Passo 2 - escreva o nome para aplicar a assinatura manuscrita.",
    avisoAssinatura:
      "Folha validada pelo formador. Confirme a assinatura abaixo para aprovar e fechar a folha.",
    labelAssinatura: "Assinatura do gestor / coordenador",
    confirmar: "Confirmar aprovação",
  },
};

export function FolhaAprovacaoModal({
  open,
  busy = false,
  modo = "aprovacao-gestor",
  documento,
  onClose,
  onConfirm,
}: Props) {
  const [step, setStep] = useState<Step>("revisao");
  const [nome, setNome] = useState("");
  const copy = COPY[modo];

  useEffect(() => {
    if (!open) return;
    setStep("revisao");
    setNome("");
  }, [open, modo]);

  const presentes = useMemo(
    () => (documento?.presencas ?? []).filter((p) => p.estado === "PRESENTE").length,
    [documento?.presencas],
  );
  const total = documento?.presencas.length ?? 0;
  const nomeTrim = nome.trim();
  const canConfirmar = nomeTrim.length >= 2 && !busy;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) onClose();
      }}
    >
      <DialogContent
        title={copy.title}
        description={step === "revisao" ? copy.descRevisao : copy.descAssinatura}
        className="max-w-2xl"
      >
        <div className="space-y-5">
          <ol className="flex items-center gap-2 text-xs">
            <li
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium",
                step === "revisao"
                  ? "bg-teal-500/20 text-teal-200 ring-1 ring-teal-400/40"
                  : "bg-teal-500/10 text-teal-300/90",
              )}
            >
              {step === "assinatura" ? (
                <Check className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <span className="tabular-nums">1</span>
              )}
              Revisão
            </li>
            <li className="h-px flex-1 bg-slate-700/70" aria-hidden />
            <li
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium",
                step === "assinatura"
                  ? "bg-teal-500/20 text-teal-200 ring-1 ring-teal-400/40"
                  : "bg-slate-800 text-slate-500",
              )}
            >
              <span className="tabular-nums">2</span>
              Assinatura
            </li>
          </ol>

          {step === "assinatura" ? (
            <p className="rounded-lg border border-teal-500/25 bg-teal-950/30 px-3 py-2 text-xs text-teal-200/90">
              {copy.avisoAssinatura}
            </p>
          ) : null}

          <article className="rounded-xl border border-slate-600/50 bg-white text-slate-900 shadow-inner">
            <header className="border-b border-slate-200 px-5 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Folha de presenças
              </p>
              <h3 className="mt-1 text-lg font-semibold text-slate-900">
                {documento?.numeroSessao != null
                  ? `Sessão ${documento.numeroSessao}`
                  : "Sessão"}
              </h3>
              <dl className="mt-3 grid gap-1 text-xs text-slate-600 sm:grid-cols-2">
                <div>
                  <dt className="inline text-slate-500">Data: </dt>
                  <dd className="inline">{formatDataLabel(documento?.data)}</dd>
                </div>
                <div>
                  <dt className="inline text-slate-500">Horário: </dt>
                  <dd className="inline">
                    {documento?.horaInicio ?? "-"} – {documento?.horaFim ?? "-"}
                  </dd>
                </div>
                <div>
                  <dt className="inline text-slate-500">Modalidade: </dt>
                  <dd className="inline">{documento?.modalidade ?? "-"}</dd>
                </div>
                <div>
                  <dt className="inline text-slate-500">Formador: </dt>
                  <dd className="inline">{documento?.formadorNome ?? "-"}</dd>
                </div>
                {documento?.turmaLabel ? (
                  <div className="sm:col-span-2">
                    <dt className="inline text-slate-500">Turma: </dt>
                    <dd className="inline">{documento.turmaLabel}</dd>
                  </div>
                ) : null}
              </dl>
            </header>

            <div className="px-5 py-4">
              <div className="max-h-[min(36vh,320px)] overflow-y-auto -mx-1">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-white text-[11px] uppercase tracking-wide text-slate-500">
                    <tr className="border-b border-slate-200">
                      <th className="py-1.5 px-1 font-semibold">Formando</th>
                      <th className="py-1.5 px-1 font-semibold">Assiduidade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(documento?.presencas ?? []).map((p) => (
                      <tr key={p.id}>
                        <td className="py-1.5 px-1 text-slate-800">
                          <span className="font-medium">{p.matricula.formando.nome}</span>
                          <span className="ml-1.5 text-xs text-slate-500">
                            NIF: {p.matricula.formando.nif}
                          </span>
                        </td>
                        <td className="py-1.5 px-1 text-slate-700">
                          {labelEstadoPresencaOuPorAssinalar(p.estado)}
                          {p.estado === "FALTA_JUSTIFICADA" && p.motivoJustificacao ? (
                            <span className="block text-[11px] text-slate-500">
                              {p.motivoJustificacao}
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Resumo: {presentes} presente(s) de {total} formando(s).
              </p>
            </div>

            {step === "assinatura" ? (
              <footer className="border-t border-slate-200 px-5 py-4">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">
                  {copy.labelAssinatura}
                </p>
                <div className="mt-2 min-h-[4.5rem] rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3">
                  {nomeTrim ? (
                    <p
                      className="text-4xl leading-tight text-slate-900"
                      style={{ fontFamily: '"Harris Signature", cursive' }}
                    >
                      {nomeTrim}
                    </p>
                  ) : (
                    <p className="text-sm italic text-slate-400">
                      O nome aparecerá aqui com a fonte de assinatura.
                    </p>
                  )}
                </div>
              </footer>
            ) : null}
          </article>

          {step === "assinatura" ? (
            <Input
              label="Nome completo para assinar"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Maria Silva"
              autoComplete="name"
              maxLength={120}
              disabled={busy}
            />
          ) : null}

          <div className="flex flex-wrap justify-end gap-2">
            {step === "assinatura" ? (
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => setStep("revisao")}
              >
                Voltar
              </Button>
            ) : (
              <Button type="button" variant="secondary" disabled={busy} onClick={onClose}>
                Cancelar
              </Button>
            )}
            {step === "revisao" ? (
              <Button type="button" disabled={busy || total === 0} onClick={() => setStep("assinatura")}>
                Continuar para assinar
              </Button>
            ) : (
              <Button
                type="button"
                disabled={!canConfirmar}
                onClick={() => void onConfirm({ nomeAssinatura: nomeTrim })}
              >
                {copy.confirmar}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
