"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";

type Props = {
  propostaId: string;
};

export function PropostaDocumentoPreview({ propostaId }: Props) {
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    void (async () => {
      const res = await bffFetch(`/api/v1/propostas/${propostaId}/proposta.html`, {
        headers: { accept: "text/html" },
      });
      setLoading(false);
      if (!res.ok) {
        setError("Não foi possível carregar o documento da proposta.");
        return;
      }
      setHtml(await res.text());
    })();
  }, [propostaId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-slate-700/50 bg-slate-900/40 px-4 py-8 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        A carregar documento…
      </div>
    );
  }

  if (error || !html) {
    return (
      <p className="rounded-xl border border-slate-700/50 bg-slate-900/40 px-4 py-6 text-sm text-slate-500">
        {error ?? "Documento indisponível."}
      </p>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-slate-700/50 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5">
        <h2 className="text-sm font-semibold text-slate-800">Documento da proposta</h2>
        <p className="text-xs text-slate-500">Igual ao PDF enviado ao cliente.</p>
      </div>
      <iframe
        title="Pré-visualização da proposta"
        srcDoc={html}
        className="block w-full min-h-[720px] border-0 bg-white"
        sandbox="allow-same-origin allow-scripts"
      />
    </section>
  );
}
