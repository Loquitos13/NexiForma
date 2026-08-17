"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FileWarning, X } from "lucide-react";
import { useDocumentosObrigatorios } from "@/components/portal/documentos-obrigatorios-gate";

const DISMISS_KEY = "nexiforma-docs-login-alert-dismissed";

function profileDocsHref(roleKind: "formando" | "formador" | null): string {
  if (roleKind === "formador") return "/portal/formador/perfil?tab=documentos";
  return "/portal/formando/perfil?tab=documentos";
}

/** Modal no login quando há documentos obrigatórios em falta (dispensável até nova sessão). */
export function DocumentosEmFaltaLoginAlert() {
  const { ready, roleKind, completo, emFaltaCount, items } = useDocumentosObrigatorios();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  if (!ready || completo || emFaltaCount === 0) return null;
  if (roleKind !== "formando" && roleKind !== "formador") return null;
  if (dismissed) return null;

  const emFalta = items.filter((i) => i.obrigatorio && !i.completo);

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center">
      <div className="absolute inset-0 bg-black/60" aria-hidden onClick={dismiss} />
      <div
        role="dialog"
        aria-labelledby="docs-falta-title"
        className="relative w-full max-w-md rounded-2xl border border-amber-500/30 bg-slate-900 p-5 shadow-xl"
      >
        <button
          type="button"
          onClick={dismiss}
          className="absolute top-3 right-3 rounded-lg p-1 text-slate-400 hover:text-slate-200"
          aria-label="Fechar aviso"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-start gap-3 pr-6">
          <FileWarning className="h-6 w-6 shrink-0 text-amber-400" />
          <div>
            <h2 id="docs-falta-title" className="text-base font-semibold text-slate-100">
              Documentos em falta
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Complete a checklist documental para evitar bloqueios na formação.
            </p>
          </div>
        </div>
        <ul className="mt-4 space-y-1.5 text-sm text-slate-300 max-h-40 overflow-y-auto">
          {emFalta.slice(0, 8).map((item) => (
            <li key={item.id} className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#39ff14] shadow-[0_0_6px_rgba(57,255,20,0.8)]" />
              {item.label}
            </li>
          ))}
          {emFalta.length > 8 ? (
            <li className="text-xs text-slate-500">+{emFalta.length - 8} mais…</li>
          ) : null}
        </ul>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href={profileDocsHref(roleKind)}
            className="inline-flex flex-1 items-center justify-center rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500"
            onClick={dismiss}
          >
            Ir para documentos
          </Link>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-xl border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            Mais tarde
          </button>
        </div>
      </div>
    </div>
  );
}
