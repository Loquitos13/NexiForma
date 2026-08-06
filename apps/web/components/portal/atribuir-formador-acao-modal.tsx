"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/ui/cn";
import { formadorIniciais, formadorSubtitulo } from "@/lib/formador-display";
import type { FormadorPickerOpt } from "@/components/portal/formador-sessao-picker";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formadores: FormadorPickerOpt[];
  busy?: boolean;
  onConfirm: (formadorId: string) => void | Promise<void>;
};

export function AtribuirFormadorAcaoModal({
  open,
  onOpenChange,
  formadores,
  busy,
  onConfirm,
}: Props) {
  const [selectedId, setSelectedId] = useState<string>("");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setSelectedId("");
        onOpenChange(next);
      }}
    >
      <DialogContent
        title="Atribuir formador para todas as sessões da turma"
        description="Será aplicado a todas as sessões do cronograma nesta vista de turma. Pode alterar individualmente depois."
        className="max-w-md"
      >
        <div className="space-y-4">
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {formadores.map((f) => {
              const active = selectedId === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  disabled={busy}
                  onClick={() => setSelectedId(f.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition",
                    active
                      ? "border-violet-500/60 bg-violet-950/50"
                      : "border-slate-700/50 bg-slate-900/60 hover:border-slate-600",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white",
                      active ? "bg-violet-600" : "bg-slate-600",
                    )}
                  >
                    {formadorIniciais(f.nomeCompleto)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-100">
                      {f.nomeCompleto}
                    </span>
                    <span className="block truncate text-xs text-slate-400">
                      {formadorSubtitulo(f)}
                    </span>
                  </span>
                  {active ? <Check className="h-4 w-4 shrink-0 text-violet-200" /> : null}
                </button>
              );
            })}
            {formadores.length === 0 ? (
              <p className="text-sm text-slate-500">Sem formadores registados neste tenant.</p>
            ) : null}
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              disabled={busy}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="flex-1 bg-violet-600 hover:bg-violet-500"
              disabled={busy || !selectedId}
              onClick={() => void onConfirm(selectedId)}
            >
              Atribuir a todas
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
