"use client";

import { useEffect, useId, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { cn } from "@/lib/ui/cn";

export type NifTipo = "pessoa" | "empresa";
export type NifStatus = "idle" | "checking" | "valid" | "invalid";

type Props = {
  label?: string;
  value: string;
  onChange: (nif: string) => void;
  /** Default `pessoa` (formador/formando). */
  tipo?: NifTipo;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  /** Notifica o estado para desactivar submit, etc. */
  onStatusChange?: (status: NifStatus) => void;
};

export function NifStatusField({
  label = "NIF *",
  value,
  onChange,
  tipo = "pessoa",
  required = true,
  disabled,
  className,
  onStatusChange,
}: Props) {
  const id = useId();
  const [status, setStatus] = useState<NifStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);

  useEffect(() => {
    const nif = value.trim();
    if (nif.length < 9) {
      setStatus("idle");
      setErrorMsg(null);
      return;
    }
    if (!/^\d{9}$/.test(nif)) {
      setStatus("invalid");
      setErrorMsg("NIF deve ter 9 dígitos.");
      return;
    }

    let cancelled = false;
    setStatus("checking");
    setErrorMsg(null);
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await bffFetch("/api/v1/nif/validar", {
            method: "POST",
            headers: { "Content-Type": "application/json", accept: "application/json" },
            body: JSON.stringify({ nif, tipo }),
          });
          if (cancelled) return;
          if (!res.ok) {
            const data = (await res.json().catch(() => null)) as {
              message?: string | string[];
            } | null;
            const msg = Array.isArray(data?.message)
              ? data.message.join(", ")
              : typeof data?.message === "string"
                ? data.message
                : "NIF inválido. Tente novamente.";
            setErrorMsg(msg);
            setStatus("invalid");
            return;
          }
          const data = (await res.json()) as { valido?: boolean };
          if (data.valido === true) {
            setErrorMsg(null);
            setStatus("valid");
          } else {
            setErrorMsg("NIF inválido. Tente novamente.");
            setStatus("invalid");
          }
        } catch {
          if (!cancelled) {
            setErrorMsg("Não foi possível verificar o NIF.");
            setStatus("invalid");
          }
        }
      })();
    }, 450);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [value, tipo]);

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label ? (
        <label htmlFor={id} className="text-sm font-medium text-slate-300">
          {label}
        </label>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          required={required}
          disabled={disabled}
          minLength={9}
          maxLength={9}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 9))}
          placeholder="123456789"
          className={cn(
            "h-9 min-w-[10rem] flex-1 rounded-lg border border-slate-600/60 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500",
            "focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500/60",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            status === "valid" && "border-green-500/50",
            status === "invalid" && "border-red-500",
          )}
        />
        {status === "checking" ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 whitespace-nowrap">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            A verificar…
          </span>
        ) : null}
        {status === "valid" ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-green-400 whitespace-nowrap">
            <Check className="h-4 w-4" aria-hidden />
            NIF válido
          </span>
        ) : null}
        {status === "invalid" ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-red-500 whitespace-nowrap">
            <X className="h-4 w-4 shrink-0 text-red-500" aria-hidden />
            {errorMsg ?? "NIF inválido. Tente novamente."}
          </span>
        ) : null}
      </div>
    </div>
  );
}
