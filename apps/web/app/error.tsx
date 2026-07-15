"use client";

import { useRouter } from "next/navigation";
import { NexiFormaBrandTitle } from "@/components/brand/NexiFormaBrandTitle";
import { NexiFormaLogoAnimated } from "@/components/brand/NexiFormaLogoAnimated";
import { InteractiveBackground } from "@/components/site/interactive-background";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  return (
    <div className="relative isolate flex min-h-screen items-center justify-center overflow-hidden p-6">
      <InteractiveBackground variant="login" fixed={false} />

      <div className="relative z-10 flex w-full max-w-[440px] flex-col items-center">
        <div className="mb-8 flex flex-col items-center gap-4">
          <NexiFormaLogoAnimated
            size={96}
            variant="reveal"
            loop
            className="drop-shadow-[0_0_28px_rgba(255,71,171,0.35)]"
          />
          <NexiFormaBrandTitle />
        </div>

        <div className="w-full overflow-hidden rounded-2xl border border-slate-700/30 bg-[#0f172a]/90 shadow-2xl ring-1 ring-slate-700/30">
          <div aria-hidden className="h-1 w-full bg-gradient-to-r from-blue-600 to-teal-500" />
          <div className="px-7 py-7">
            <h1 className="text-xl font-bold text-slate-50 mb-2">Algo correu mal</h1>
            <p className="text-sm text-slate-400 mb-4 leading-relaxed">
              Ocorreu um erro inesperado. Podes tentar novamente ou voltar à página anterior.
            </p>

            {process.env.NODE_ENV === "development" && error.message ? (
              <p className="text-xs text-red-400 break-words mb-4 font-mono bg-red-950/30 rounded-lg p-2.5">
                {error.message}
              </p>
            ) : null}

            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={() => reset()}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors"
              >
                Tentar novamente
              </button>
              <button
                type="button"
                onClick={() => router.back()}
                className="text-sm font-semibold text-blue-400 hover:text-blue-300 transition-colors"
              >
                Voltar atrás
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
