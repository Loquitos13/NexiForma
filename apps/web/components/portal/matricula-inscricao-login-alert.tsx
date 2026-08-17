"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { FileText, X } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";

const DISMISS_KEY = "nexiforma-inscricao-docs-login-dismissed";

type InscricaoPendente = {
  matriculaId: string;
  acaoTitulo: string;
  turmaCodigo: string;
  pendentes: number;
};

/** Alerta no login quando há documentos de inscrição por aceitar (dispensável). */
export function MatriculaInscricaoLoginAlert() {
  const [dismissed, setDismissed] = useState(true);
  const [items, setItems] = useState<InscricaoPendente[]>([]);

  const load = useCallback(async () => {
    const r = await bffFetch("/api/v1/formando-portal/inscricoes", {
      headers: { accept: "application/json" },
    });
    if (!r.ok) return;
    const inscricoes = (await r.json()) as Array<{
      matriculaId: string;
      acao?: string;
      turma?: string;
    }>;
    const pendentes: InscricaoPendente[] = [];
    for (const ins of inscricoes) {
      const dr = await bffFetch(
        `/api/v1/formando-portal/inscricoes/${ins.matriculaId}/documentos`,
        { headers: { accept: "application/json" } },
      );
      if (!dr.ok) continue;
      const docs = (await dr.json()) as { documentosCurso?: Array<{ completo: boolean }> };
      const count = docs.documentosCurso?.filter((d) => !d.completo).length ?? 0;
      if (count > 0) {
        pendentes.push({
          matriculaId: ins.matriculaId,
          acaoTitulo: ins.acao ?? "Acção de formação",
          turmaCodigo: ins.turma ?? "-",
          pendentes: count,
        });
      }
    }
    setItems(pendentes);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
    void load();
  }, [load]);

  if (dismissed || items.length === 0) return null;

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center">
      <div className="absolute inset-0 bg-black/60" aria-hidden onClick={dismiss} />
      <div className="relative w-full max-w-md rounded-2xl border border-blue-500/30 bg-slate-900 p-5 shadow-xl">
        <button
          type="button"
          onClick={dismiss}
          className="absolute top-3 right-3 rounded-lg p-1 text-slate-400 hover:text-slate-200"
          aria-label="Fechar aviso"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-start gap-3 pr-6">
          <FileText className="h-6 w-6 shrink-0 text-blue-400" />
          <div>
            <h2 className="text-base font-semibold text-slate-100">Documentos de inscrição</h2>
            <p className="mt-1 text-sm text-slate-400">
              Leia e registe o consentimento de cada documento por ordem antes de iniciar a formação.
            </p>
          </div>
        </div>
        <ul className="mt-4 space-y-2 text-sm">
          {items.map((item) => (
            <li key={item.matriculaId} className="flex items-center justify-between gap-2">
              <span className="text-slate-300 truncate">
                {item.acaoTitulo} · {item.turmaCodigo}
              </span>
              <Link
                href={`/portal/formando/inscricoes/${item.matriculaId}/documentos`}
                className="shrink-0 text-xs font-medium text-blue-400 hover:text-blue-300"
                onClick={dismiss}
              >
                {item.pendentes} em falta →
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-5 flex gap-2">
          <Link
            href={`/portal/formando/inscricoes/${items[0]!.matriculaId}/documentos`}
            className="inline-flex flex-1 items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
            onClick={dismiss}
          >
            Iniciar leitura
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
