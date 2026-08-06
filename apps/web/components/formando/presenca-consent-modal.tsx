"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ClipboardCheck } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { bffFetch } from "@/lib/client/bff-fetch";
import { parseApiError } from "@/lib/ui/backoffice";

type CheckinResult = {
  ok: boolean;
  alreadyPresent: boolean;
  formando: string;
  sessao: { numeroSessao: number };
};

type Props = {
  open: boolean;
  sessaoId: string;
  onClose: () => void;
  onSuccess?: (result: CheckinResult) => void;
};

type Phase = "consent" | "submitting" | "success" | "error";

/** Desktop: confirma presença sem câmara/QR (consentimento simples). */
export function PresencaConsentModal({ open, sessaoId, onClose, onSuccess }: Props) {
  const [phase, setPhase] = useState<Phase>("consent");
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<CheckinResult | null>(null);
  const openRef = useRef(open);
  const onSuccessRef = useRef(onSuccess);

  openRef.current = open;
  onSuccessRef.current = onSuccess;

  useEffect(() => {
    if (!open) {
      setPhase("consent");
      setErr(null);
      setResult(null);
    }
  }, [open]);

  async function confirmar() {
    if (!sessaoId || phase === "submitting") return;
    setPhase("submitting");
    setErr(null);
    try {
      const res = await bffFetch(
        `/api/v1/presenca-checkin/sessao/${encodeURIComponent(sessaoId)}`,
        {
          method: "POST",
          headers: { accept: "application/json" },
        },
      );
      if (!openRef.current) return;
      if (!res.ok) {
        setErr(await parseApiError(res));
        setPhase("error");
        return;
      }
      const data = (await res.json()) as CheckinResult;
      if (!openRef.current) return;
      setResult(data);
      setPhase("success");
      onSuccessRef.current?.(data);
    } catch {
      if (!openRef.current) return;
      setErr("Não foi possível registar a presença. Tenta novamente.");
      setPhase("error");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        title="Confirmar presença"
        description="Confirma que estás presente nesta sessão. Não é necessário assinar."
        className="max-w-md"
      >
        <div className="space-y-4">
          {phase === "consent" || phase === "submitting" ? (
            <div className="rounded-xl border border-slate-700/50 bg-slate-950/50 px-4 py-5 space-y-3">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-500/15 text-teal-300">
                  <ClipboardCheck className="h-5 w-5" />
                </span>
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-medium text-slate-100">
                    Registar a minha presença
                  </p>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Ao confirmar, declaras que estás a participar nesta sessão. O registo fica
                    associado à tua matrícula nesta acção de formação.
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end pt-1">
                <Button
                  type="button"
                  variant="secondary"
                  className="sm:order-1"
                  disabled={phase === "submitting"}
                  onClick={onClose}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  className="sm:order-2"
                  disabled={phase === "submitting"}
                  onClick={() => void confirmar()}
                >
                  {phase === "submitting" ? "A registar…" : "Confirmar presença"}
                </Button>
              </div>
            </div>
          ) : null}

          {phase === "success" && result ? (
            <div className="rounded-xl border border-teal-500/35 bg-teal-950/30 px-4 py-6 text-center space-y-2">
              <CheckCircle2 className="mx-auto h-10 w-10 text-teal-400" />
              <p className="text-base font-semibold text-slate-100">
                {result.alreadyPresent
                  ? "Presença já registada"
                  : "Presença registada com sucesso"}
              </p>
              <p className="text-sm text-slate-400">
                {result.formando} · Sessão {result.sessao.numeroSessao}
              </p>
              <Button type="button" className="mt-2 w-full" onClick={onClose}>
                Fechar
              </Button>
            </div>
          ) : null}

          {phase === "error" ? (
            <div className="rounded-xl border border-amber-500/35 bg-amber-950/25 px-4 py-4 space-y-3">
              <p className="text-sm text-amber-100">{err ?? "Não foi possível registar a presença."}</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="button" className="flex-1" onClick={() => void confirmar()}>
                  Tentar novamente
                </Button>
                <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
                  Fechar
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
