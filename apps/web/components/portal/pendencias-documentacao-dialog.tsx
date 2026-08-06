"use client";

import Link from "next/link";
import { useCallback, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/ui/cn";

export type PendenciaItemLink = {
  label: string;
  /** Se definido, o item é clicável e navega para a sessão/foco. */
  href?: string;
};

export type PendenciaSessaoItem = {
  acaoLabel?: string;
  numeroSessao?: number;
  /** Link da sessão (bloco inteiro). */
  href?: string;
  itens: Array<string | PendenciaItemLink>;
};

export type PendenciasDocumentacaoDialogProps = {
  open: boolean;
  title: string;
  question: string;
  hint?: string;
  /** Lista de sessões (logout) ou uma sessão com itens (terminar). */
  sessoes?: PendenciaSessaoItem[];
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

function normalizeItem(item: string | PendenciaItemLink): PendenciaItemLink {
  return typeof item === "string" ? { label: item } : item;
}

function SessaoHeader({
  acaoLabel,
  numeroSessao,
}: {
  acaoLabel?: string;
  numeroSessao?: number;
}) {
  if (!acaoLabel && numeroSessao == null) return null;
  return (
    <span className="min-w-0 break-words font-medium text-amber-50">
      {acaoLabel ?? "Sessão"}
      {numeroSessao != null ? (
        <span className="text-amber-200/85"> · sessão {numeroSessao}</span>
      ) : null}
    </span>
  );
}

function PendenciaItensList({
  itens,
  onNavigate,
}: {
  itens: Array<string | PendenciaItemLink>;
  onNavigate: () => void;
}) {
  return (
    <ul className="mt-1.5 space-y-1.5">
      {itens.map((raw, itemIdx) => {
        const item = normalizeItem(raw);
        const key = `${item.label}-${itemIdx}`;
        if (item.href) {
          return (
            <li key={key}>
              <Link
                href={item.href}
                onClick={onNavigate}
                className="group flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/5 px-2.5 py-2 text-amber-50 transition-colors hover:border-amber-400/50 hover:bg-amber-500/15"
              >
                <span className="min-w-0 flex-1 break-words leading-snug">
                  {item.label}
                </span>
                <ChevronRight
                  className="mt-0.5 h-4 w-4 shrink-0 text-amber-300/70 group-hover:text-amber-200"
                  aria-hidden
                />
              </Link>
            </li>
          );
        }
        return (
          <li key={key} className="break-words pl-5 text-amber-100/90 list-disc">
            {item.label}
          </li>
        );
      })}
    </ul>
  );
}

/** Modal in-app de aviso (laranja) - substitui window.confirm do browser. */
export function PendenciasDocumentacaoDialog({
  open,
  title,
  question,
  hint,
  sessoes = [],
  confirmLabel = "Continuar na mesma",
  cancelLabel = "Cancelar",
  onConfirm,
  onCancel,
}: PendenciasDocumentacaoDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <DialogContent
        title={title}
        description={question}
        className={cn(
          "w-[calc(100%-1rem)] sm:w-[min(100%-2rem,42rem)] max-w-3xl",
          "max-h-[min(92dvh,900px)]",
          "border-amber-500/50",
          "shadow-[0_0_0_1px_rgba(245,158,11,0.25),0_25px_50px_-12px_rgba(0,0,0,0.6)]",
        )}
      >
        <div className="flex min-h-0 flex-col gap-4">
          <div
            className={cn(
              "min-h-0 flex-1 rounded-xl border border-amber-500/45 bg-amber-950/40 px-4 py-4 sm:px-5",
              "ring-1 ring-amber-400/25",
            )}
          >
            <div className="flex items-start gap-3 sm:gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-300">
                <AlertTriangle className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1 space-y-3">
                <p className="text-sm font-semibold text-amber-100 sm:text-base">
                  Documentação pedagógica por concluir
                </p>
                {sessoes.length > 0 ? (
                  <ul className="space-y-2.5 text-sm leading-relaxed text-amber-50/90">
                    {sessoes.map((s, idx) => (
                      <li
                        key={`${s.acaoLabel ?? "s"}-${s.numeroSessao ?? idx}`}
                        className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-3 sm:px-4"
                      >
                        {s.href ? (
                          <Link
                            href={s.href}
                            onClick={onCancel}
                            className="group mb-0.5 flex items-center justify-between gap-2 rounded-lg -mx-1 px-1 py-0.5 transition-colors hover:bg-amber-500/10"
                          >
                            <SessaoHeader
                              acaoLabel={s.acaoLabel}
                              numeroSessao={s.numeroSessao}
                            />
                            <span className="shrink-0 text-[11px] font-medium text-amber-300/90 group-hover:text-amber-200">
                              Abrir
                            </span>
                          </Link>
                        ) : (
                          <SessaoHeader
                            acaoLabel={s.acaoLabel}
                            numeroSessao={s.numeroSessao}
                          />
                        )}
                        <PendenciaItensList itens={s.itens} onNavigate={onCancel} />
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          </div>

          {hint ? (
            <p className="shrink-0 text-sm leading-snug text-amber-200/85">{hint}</p>
          ) : null}

          <div className="flex shrink-0 flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
            <Button
              type="button"
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={onCancel}
            >
              {cancelLabel}
            </Button>
            <Button
              type="button"
              className="w-full bg-amber-600 text-slate-950 hover:bg-amber-500 active:bg-amber-700 sm:w-auto sm:min-w-[10rem]"
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type ConfirmInput = {
  title: string;
  question: string;
  hint?: string;
  sessoes: PendenciaSessaoItem[];
  confirmLabel?: string;
  cancelLabel?: string;
};

/** Promise-based confirm in-app (laranja) para logout / terminar sessão. */
export function usePendenciasDocumentacaoConfirm(): {
  dialog: ReactNode;
  confirm: (input: ConfirmInput) => Promise<boolean>;
} {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState<ConfirmInput | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const settle = useCallback((value: boolean) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setOpen(false);
    setInput(null);
  }, []);

  const confirm = useCallback((next: ConfirmInput) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setInput(next);
      setOpen(true);
    });
  }, []);

  const dialog = (
    <PendenciasDocumentacaoDialog
      open={open && Boolean(input)}
      title={input?.title ?? "Atenção"}
      question={input?.question ?? ""}
      hint={input?.hint}
      sessoes={input?.sessoes}
      confirmLabel={input?.confirmLabel}
      cancelLabel={input?.cancelLabel}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  );

  return { dialog, confirm };
}
