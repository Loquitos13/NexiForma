"use client";

import { useCallback, useState } from "react";
import { FileText } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { parseApiError } from "@/lib/ui/backoffice";
import { Button } from "@/components/ui";

const MARKER = "--- Transcrição Teams ---";

export function extrairBlocoTranscricaoTeams(texto: string | null | undefined): string | null {
  if (!texto?.trim()) return null;
  const idx = texto.indexOf(MARKER);
  if (idx >= 0) return texto.slice(idx + MARKER.length).trim() || null;
  if (texto.includes("Transcrição Teams (automática)")) {
    const parts = texto.split("Transcrição Teams (automática):");
    return parts[parts.length - 1]?.trim() || null;
  }
  return null;
}

export function separarNotasLivresTranscricao(texto: string | null | undefined): {
  notas: string | null;
  transcricao: string | null;
} {
  if (!texto?.trim()) return { notas: null, transcricao: null };
  const idx = texto.indexOf(MARKER);
  if (idx < 0) return { notas: texto.trim(), transcricao: null };
  return {
    notas: texto.slice(0, idx).trim() || null,
    transcricao: texto.slice(idx + MARKER.length).trim() || null,
  };
}

type Props = {
  fonteId: string;
  fonte: "crm" | "sessao";
  teamsTranscricao?: string | null;
  teamsTranscricaoEstado?: string | null;
  /** Sala Teams criada - permite tentar importar */
  temSalaTeams?: boolean;
  writeDisabled?: boolean;
  onUpdated?: () => void | Promise<void>;
  compact?: boolean;
};

export function TeamsTranscricaoPanel({
  fonteId,
  fonte,
  teamsTranscricao,
  teamsTranscricaoEstado,
  temSalaTeams,
  writeDisabled,
  onUpdated,
  compact,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [localTexto, setLocalTexto] = useState<string | null>(null);
  const [localEstado, setLocalEstado] = useState<string | null>(null);

  const texto = localTexto ?? teamsTranscricao;
  const estado = localEstado ?? teamsTranscricaoEstado;
  const podeImportar = Boolean(temSalaTeams && !texto);

  const importar = useCallback(async () => {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const path =
        fonte === "crm"
          ? `/api/v1/crm/interaccoes/${fonteId}/teams/transcricao`
          : `/api/v1/integracoes/sessoes/${fonteId}/teams/transcricao`;
      const res = await bffFetch(path, {
        method: "POST",
        headers: { accept: "application/json" },
      });
      if (!res.ok) {
        setError(await parseApiError(res));
        return;
      }
      const data = (await res.json()) as {
        estado?: string;
        teamsTranscricao?: string | null;
      };
      if (data.teamsTranscricao) setLocalTexto(data.teamsTranscricao);
      if (data.estado) setLocalEstado(data.estado);
      if (data.estado === "DISPONIVEL" && data.teamsTranscricao) {
        setMsg("Transcrição importada.");
      } else if (data.estado === "PENDENTE") {
        setMsg("Ainda não disponível no Teams - tenta novamente dentro de alguns minutos.");
      } else if (data.estado === "INDISPONIVEL") {
        setMsg("Transcrição indisponível (confirma que foi iniciada na reunião Teams).");
      } else {
        setMsg(`Estado: ${data.estado ?? "desconhecido"}`);
      }
      await onUpdated?.();
    } catch {
      setError("Erro de rede.");
    } finally {
      setBusy(false);
    }
  }, [fonte, fonteId, onUpdated]);

  if (!temSalaTeams && !texto && !estado) return null;

  return (
    <div
      className={
        compact
          ? "space-y-2"
          : "rounded-lg border border-teal-500/20 bg-teal-950/10 p-3 space-y-2"
      }
    >
      {!compact ? (
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-teal-300/90">
          <FileText className="h-3.5 w-3.5" />
          Transcrição Teams
        </p>
      ) : null}

      {error ? <p className="text-xs text-red-400">{error}</p> : null}
      {msg ? <p className="text-xs text-emerald-400">{msg}</p> : null}

      {estado ? (
        <p className="text-xs text-slate-500">
          Estado: <span className="text-slate-300">{estado}</span>
        </p>
      ) : null}

      {texto ? (
        <details open={!compact} className="rounded-lg border border-slate-700/40 bg-slate-900/40 p-2">
          <summary className="cursor-pointer text-xs text-teal-300">
            {compact ? "Ver transcrição Teams" : "Texto completo"}
          </summary>
          <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap text-[11px] leading-relaxed text-slate-300">
            {texto}
          </pre>
        </details>
      ) : podeImportar ? (
        <Button
          size="sm"
          variant="secondary"
          disabled={busy || writeDisabled}
          onClick={() => void importar()}
        >
          {busy ? "A importar…" : "Importar transcrição Teams"}
        </Button>
      ) : null}

      {texto && temSalaTeams && estado !== "DISPONIVEL" ? (
        <Button
          size="sm"
          variant="ghost"
          className="text-xs"
          disabled={busy || writeDisabled}
          onClick={() => void importar()}
        >
          Actualizar
        </Button>
      ) : null}
    </div>
  );
}
