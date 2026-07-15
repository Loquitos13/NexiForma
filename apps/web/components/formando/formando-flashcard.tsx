"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { sanitizeLmsHtml } from "@nexiforma/shared";

type Props = {
  frente: string;
  verso: string;
  frenteHtml?: string | null;
  versoHtml?: string | null;
  className?: string;
};

export function FormandoFlashcard({ frente, verso, frenteHtml, versoHtml, className }: Props) {
  const [flipped, setFlipped] = useState(false);
  const frenteSafe = frenteHtml ? sanitizeLmsHtml(frenteHtml) : null;
  const versoSafe = versoHtml ? sanitizeLmsHtml(versoHtml) : null;

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setFlipped((v) => !v)}
        className="group relative mx-auto block w-full max-w-md aspect-square perspective-[1200px]"
        aria-label={flipped ? "Virar para a frente" : "Clica para virar"}
      >
        <div
          className={`relative h-full w-full transition-transform duration-500 transform-style-preserve-3d ${
            flipped ? "[transform:rotateY(180deg)]" : ""
          }`}
        >
          <div className="absolute inset-0 rounded-2xl border border-slate-600/50 bg-slate-800/90 p-8 flex flex-col items-center justify-center text-center [backface-visibility:hidden]">
            {frenteSafe ? (
              <div
                className="prose prose-invert prose-sm max-w-none text-slate-100"
                dangerouslySetInnerHTML={{ __html: frenteSafe }}
              />
            ) : (
              <p className="text-lg font-semibold text-slate-100 whitespace-pre-wrap">{frente}</p>
            )}
          </div>
          <div className="absolute inset-0 rounded-2xl border border-teal-500/30 bg-slate-800/95 p-8 flex flex-col items-center justify-center text-center [backface-visibility:hidden] [transform:rotateY(180deg)]">
            {versoSafe ? (
              <div
                className="prose prose-invert prose-sm max-w-none text-slate-100"
                dangerouslySetInnerHTML={{ __html: versoSafe }}
              />
            ) : (
              <p className="text-base text-slate-200 whitespace-pre-wrap">{verso}</p>
            )}
          </div>
        </div>
        <span className="absolute bottom-4 right-4 flex items-center gap-1.5 rounded-full bg-slate-900/80 px-2.5 py-1 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
          <RefreshCw className="h-3 w-3" />
          Clica para virar
        </span>
      </button>
    </div>
  );
}
