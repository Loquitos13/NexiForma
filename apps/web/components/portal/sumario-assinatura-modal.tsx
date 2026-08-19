"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/ui/cn";

export type SumarioAssinaturaDoc = {
  numeroSessao?: number | null;
  data?: string | null;
  horaInicio?: string | null;
  horaFim?: string | null;
  modalidade?: string | null;
  formadorNome?: string | null;
  conteudo?: string | null;
};

export type SumarioAssinaturaConfirm = {
  conteudo: string;
  nomeAssinatura: string;
};

type Props = {
  open: boolean;
  busy?: boolean;
  /** Sumário já assinado - só consulta. */
  readOnly?: boolean;
  documento: SumarioAssinaturaDoc | null;
  onClose: () => void;
  onConfirm: (payload: SumarioAssinaturaConfirm) => void | Promise<void>;
};

type Step = "conteudo" | "assinatura";

function formatDataLabel(value?: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleDateString("pt-PT");
}

export function SumarioAssinaturaModal({
  open,
  busy = false,
  readOnly = false,
  documento,
  onClose,
  onConfirm,
}: Props) {
  const [step, setStep] = useState<Step>("conteudo");
  const [conteudo, setConteudo] = useState("");
  const [nome, setNome] = useState("");
  const [mySignatureUrl, setMySignatureUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep("conteudo");
    setConteudo(documento?.conteudo?.trim() ?? "");
    setNome("");
    setMySignatureUrl(null);
  }, [open, documento?.conteudo]);

  useEffect(() => {
    if (!open || step !== "assinatura" || readOnly) return;
    void bffFetch("/api/v1/portal/tenant/signatures/me", {
      headers: { accept: "application/json" },
    }).then(async (r) => {
      if (!r.ok) return;
      const data = (await r.json()) as {
        configured?: boolean;
        signatureUrl?: string;
        displayName?: string;
      };
      if (data.configured && data.signatureUrl) {
        setMySignatureUrl(`${data.signatureUrl}?v=${Date.now()}`);
        if (data.displayName?.trim()) {
          setNome((prev) => prev.trim() || data.displayName!.trim());
        }
      }
    });
  }, [open, step, readOnly]);

  const conteudoTrim = conteudo.trim();
  const nomeTrim = nome.trim();
  const canAvancar = conteudoTrim.length >= 10 && !busy;
  const canConfirmar = nomeTrim.length >= 2 && canAvancar && !busy;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) onClose();
      }}
    >
      <DialogContent
        title={readOnly ? "Sumário da sessão" : "Sumário e assinatura"}
        description={
          readOnly
            ? "Consulta do sumário pedagógico assinado."
            : step === "conteudo"
              ? "Passo 1 - registe o sumário pedagógico (mín. 10 caracteres)."
              : "Passo 2 - confirme o nome; será usada a sua assinatura configurada, se existir."
        }
        className="max-w-2xl"
      >
        <div className="space-y-5">
          {!readOnly ? (
            <ol className="flex items-center gap-2 text-xs">
              <li
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium",
                  step === "conteudo"
                    ? "bg-teal-500/20 text-teal-200 ring-1 ring-teal-400/40"
                    : "bg-teal-500/10 text-teal-300/90",
                )}
              >
                {step === "assinatura" ? (
                  <Check className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <span className="tabular-nums">1</span>
                )}
                Conteúdo
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
          ) : null}

          {step === "assinatura" && !readOnly ? (
            <p className="rounded-lg border border-teal-500/25 bg-teal-950/30 px-3 py-2 text-xs text-teal-200/90">
              Sumário pronto. Confirme a assinatura abaixo - o documento permanece aberto neste modal.
            </p>
          ) : null}

          <article className="rounded-xl border border-slate-600/50 bg-white text-slate-900 shadow-inner">
            <header className="border-b border-slate-200 px-5 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Sumário pedagógico
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
              </dl>
            </header>

            <div className="px-5 py-4">
              {step === "conteudo" && !readOnly ? (
                <Textarea
                  value={conteudo}
                  onChange={(e) => setConteudo(e.target.value)}
                  placeholder="Conteúdos abordados, metodologia, observações…"
                  rows={7}
                  disabled={busy}
                  minLength={10}
                  className="min-h-[10rem] border-slate-300 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:border-teal-500/50 focus:ring-teal-500/30"
                />
              ) : (
                <div className="max-h-[28vh] overflow-y-auto">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                    {conteudoTrim || "Sem conteúdo."}
                  </p>
                </div>
              )}
            </div>

            {(step === "assinatura" || readOnly) && (
              <footer className="border-t border-slate-200 px-5 py-4">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">
                  Assinatura
                </p>
                <div className="mt-2 min-h-[4.5rem] rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3">
                  {mySignatureUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={mySignatureUrl}
                      alt="Assinatura configurada"
                      className="max-h-20 max-w-full object-contain"
                    />
                  ) : nomeTrim ? (
                    <p
                      className="text-4xl leading-tight text-slate-900"
                      style={{ fontFamily: '"Harris Signature", cursive' }}
                    >
                      {nomeTrim}
                    </p>
                  ) : readOnly ? (
                    <p className="text-sm text-slate-500">Documento assinado.</p>
                  ) : (
                    <p className="text-sm italic text-slate-400">
                      Configure a assinatura em Configurações ou escreva o nome para a fonte manuscrita.
                    </p>
                  )}
                  {nomeTrim && mySignatureUrl ? (
                    <p className="mt-2 text-xs text-slate-600 border-t border-slate-200 pt-2">{nomeTrim}</p>
                  ) : null}
                </div>
              </footer>
            )}
          </article>

          {step === "assinatura" && !readOnly ? (
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
            {step === "assinatura" && !readOnly ? (
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => setStep("conteudo")}
              >
                Voltar
              </Button>
            ) : (
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={onClose}
              >
                {readOnly ? "Fechar" : "Cancelar"}
              </Button>
            )}
            {!readOnly && step === "conteudo" ? (
              <Button
                type="button"
                disabled={!canAvancar}
                onClick={() => setStep("assinatura")}
              >
                Continuar para assinar
              </Button>
            ) : null}
            {!readOnly && step === "assinatura" ? (
              <Button
                type="button"
                disabled={!canConfirmar}
                onClick={() =>
                  void onConfirm({ conteudo: conteudoTrim, nomeAssinatura: nomeTrim })
                }
              >
                Confirmar assinatura
              </Button>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
