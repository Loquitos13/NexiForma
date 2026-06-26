"use client";

import { useEffect, useState } from "react";
import { formatarDuracaoHhMmSs } from "@nexiforma/shared";

/** Contador HH:MM:SS que avança cada segundo (para listas com formandos em sessão). */
export function TempoPresencaAoVivo({
  segundosFechados,
  emSessao,
  joinDesde,
  className,
}: {
  /** Tempo acumulado de intervalos já fechados. */
  segundosFechados: number;
  emSessao: boolean;
  joinDesde?: string | null;
  className?: string;
}) {
  const [segundos, setSegundos] = useState(segundosFechados);

  useEffect(() => {
    if (!emSessao || !joinDesde) {
      setSegundos(segundosFechados);
      return;
    }

    const tick = () => {
      const extra = Math.max(
        0,
        Math.round((Date.now() - new Date(joinDesde).getTime()) / 1000),
      );
      setSegundos(segundosFechados + extra);
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [emSessao, joinDesde, segundosFechados]);

  return (
    <span className={className ?? "font-mono tabular-nums"}>
      {formatarDuracaoHhMmSs(segundos)}
    </span>
  );
}
