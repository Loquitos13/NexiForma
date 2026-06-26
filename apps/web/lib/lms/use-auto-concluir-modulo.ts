"use client";

import { useCallback, useRef } from "react";
import { bffFetch } from "@/lib/client/bff-fetch";

/** Regista conclusão automática de módulo (evita cliques manuais do formando). */
export function useAutoConcluirModulo({
  matriculaId,
  moduloId,
  jaConcluido,
  onConcluido,
}: {
  matriculaId: string;
  moduloId: string;
  jaConcluido: boolean;
  onConcluido?: () => void;
}) {
  const aRegistar = useRef(false);

  const registarConclusao = useCallback(
    async (percentual = 100, pontuacao = 100) => {
      if (!matriculaId || !moduloId || jaConcluido || aRegistar.current) return;
      aRegistar.current = true;
      const res = await bffFetch(
        `/api/v1/conteudos-lms/progresso/${moduloId}?matriculaId=${encodeURIComponent(matriculaId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", accept: "application/json" },
          body: JSON.stringify({ percentual, pontuacao }),
        },
      );
      if (res.ok) onConcluido?.();
      else aRegistar.current = false;
    },
    [matriculaId, moduloId, jaConcluido, onConcluido],
  );

  return { registarConclusao };
}
