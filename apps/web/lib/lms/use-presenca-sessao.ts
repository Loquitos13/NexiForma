"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  formatarDuracaoHhMmSs,
  type EstadoPresencaLms,
} from "@nexiforma/shared";
import { bffFetch } from "@/lib/client/bff-fetch";
import { getAccessToken } from "@/lib/client/access-token";
import {
  lerPresencaAtiva,
  limparPresencaAtiva,
  PRESENCA_ATIVA_KEY,
} from "@/lib/lms/presenca-storage";

export type PresencaEstadoApi = EstadoPresencaLms & {
  tempoTotalFormatado: string;
  tempoIntervaloFormatado: string;
  sessaoEncerrada?: boolean;
  sessaoTerminadaEm?: string | null;
};

export type SessaoPresencaAtiva = {
  matriculaId: string;
  sessaoId: string;
  salaOnline?: { provider: "ZOOM" | "TEAMS"; joinUrl: string } | null;
};

type UsePresencaSessaoOptions = {
  syncEnabled?: boolean;
  pollMs?: number;
  onSessaoEncerrada?: () => void;
};

async function fetchPresencaEstado(
  matriculaId: string,
  sessaoId: string,
): Promise<PresencaEstadoApi | null> {
  const r = await bffFetch(
    `/api/v1/lms/presenca-estado?matriculaId=${encodeURIComponent(matriculaId)}&sessaoFormacaoId=${encodeURIComponent(sessaoId)}`,
    { headers: { accept: "application/json" } },
  );
  if (!r.ok) return null;
  return (await r.json()) as PresencaEstadoApi;
}

async function postEvento(
  matriculaId: string,
  sessaoId: string,
  evento: "join" | "leave",
): Promise<boolean> {
  const r = await bffFetch("/api/v1/lms/eventos", {
    method: "POST",
    headers: { "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify({ matriculaId, sessaoFormacaoId: sessaoId, evento }),
  });
  return r.ok;
}

function postEventoKeepalive(matriculaId: string, sessaoId: string) {
  const token = getAccessToken();
  void fetch("/api/v1/lms/eventos", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      accept: "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ matriculaId, sessaoFormacaoId: sessaoId, evento: "leave" }),
    credentials: "include",
    keepalive: true,
  });
}

function toEstadoBase(data: PresencaEstadoApi): EstadoPresencaLms {
  return {
    emSessao: data.emSessao,
    joinDesde: data.joinDesde,
    segundosFechados: data.segundosFechados,
    segundosTotais: data.segundosTotais,
    segundosIntervaloAtual: data.segundosIntervaloAtual,
  };
}

/** Relógio ao vivo - actualiza cada segundo enquanto `emSessao`. */
export function usePresencaRelogio(estado: EstadoPresencaLms | null): PresencaEstadoApi | null {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!estado?.emSessao) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [estado?.emSessao]);

  if (!estado) return null;

  void tick;

  if (!estado.emSessao || !estado.joinDesde) {
    const total = estado.segundosFechados;
    return {
      ...estado,
      segundosTotais: total,
      segundosIntervaloAtual: 0,
      tempoTotalFormatado: formatarDuracaoHhMmSs(total),
      tempoIntervaloFormatado: "00:00:00",
    };
  }

  const segundosIntervaloAtual = Math.max(
    0,
    Math.round((Date.now() - new Date(estado.joinDesde).getTime()) / 1000),
  );
  const segundosTotais = estado.segundosFechados + segundosIntervaloAtual;

  return {
    emSessao: true,
    joinDesde: estado.joinDesde,
    segundosFechados: estado.segundosFechados,
    segundosTotais,
    segundosIntervaloAtual,
    tempoTotalFormatado: formatarDuracaoHhMmSs(segundosTotais),
    tempoIntervaloFormatado: formatarDuracaoHhMmSs(segundosIntervaloAtual),
  };
}

/** Sincronização com API + contador HH:MM:SS (portal formando). */
export function usePresencaSessao(
  active: SessaoPresencaAtiva | null,
  opts: UsePresencaSessaoOptions = {},
) {
  const { syncEnabled = true, pollMs = 4000, onSessaoEncerrada } = opts;
  const [estado, setEstado] = useState<EstadoPresencaLms | null>(null);
  const [syncing, setSyncing] = useState(false);
  const encerradaRef = useRef(false);
  const onEncerradaRef = useRef(onSessaoEncerrada);
  onEncerradaRef.current = onSessaoEncerrada;

  const sync = useCallback(async (matriculaId: string, sessaoId: string) => {
    setSyncing(true);
    try {
      const data = await fetchPresencaEstado(matriculaId, sessaoId);
      if (!data) return;

      if (
        data.sessaoEncerrada &&
        !encerradaRef.current
      ) {
        encerradaRef.current = true;
        limparPresencaAtiva();
        onEncerradaRef.current?.();
      }

      setEstado(toEstadoBase(data));
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    encerradaRef.current = false;
    if (!active || !syncEnabled) {
      setEstado(null);
      return;
    }
    void sync(active.matriculaId, active.sessaoId);
  }, [active?.matriculaId, active?.sessaoId, sync, syncEnabled, active]);

  useEffect(() => {
    if (!active || !syncEnabled) return;
    const id = setInterval(() => void sync(active.matriculaId, active.sessaoId), pollMs);
    return () => clearInterval(id);
  }, [active, pollMs, sync, syncEnabled]);

  const relogio = usePresencaRelogio(estado);

  const entrar = useCallback(
    async (matriculaId: string, sessaoId: string) => {
      const ok = await postEvento(matriculaId, sessaoId, "join");
      if (ok) await sync(matriculaId, sessaoId);
      return ok;
    },
    [sync],
  );

  const sair = useCallback(async () => {
    if (!active) return false;
    const ok = await postEvento(active.matriculaId, active.sessaoId, "leave");
    limparPresencaAtiva();
    if (ok) {
      const data = await fetchPresencaEstado(active.matriculaId, active.sessaoId);
      if (data) {
        setEstado({
          emSessao: false,
          joinDesde: null,
          segundosFechados: data.segundosFechados,
          segundosTotais: data.segundosFechados,
          segundosIntervaloAtual: 0,
        });
      } else {
        setEstado(null);
      }
    }
    return ok;
  }, [active]);

  return { estado, relogio, syncing, entrar, sair, sync };
}

/** Restaura sessão activa a partir do storage / API (janela da reunião). */
export function usePresencaAtivaRemota(onChange: () => void) {
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key?.startsWith(PRESENCA_ATIVA_KEY)) onChange();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [onChange]);
}

export async function resolverPresencaAtiva(): Promise<{
  active: SessaoPresencaAtiva | null;
  estado: PresencaEstadoApi | null;
}> {
  const stored = lerPresencaAtiva();
  if (!stored) return { active: null, estado: null };

  const estado = await fetchPresencaEstado(stored.matriculaId, stored.sessaoId);
  if (!estado || estado.sessaoEncerrada || !estado.emSessao) {
    limparPresencaAtiva();
    return { active: null, estado };
  }

  return {
    active: { matriculaId: stored.matriculaId, sessaoId: stored.sessaoId },
    estado,
  };
}

/** Polling para painel do formador. */
export function usePresencaPolling(
  load: () => void | Promise<void>,
  enabled: boolean,
  intervalMs = 5000,
) {
  useEffect(() => {
    if (!enabled) return;
    void load();
    const id = setInterval(() => void load(), intervalMs);
    return () => clearInterval(id);
  }, [load, enabled, intervalMs]);
}

export { formatarDuracaoHhMmSs };
