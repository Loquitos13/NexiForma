"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Video } from "lucide-react";
import { formatarDuracaoHhMmSs } from "@nexiforma/shared";
import { bffFetch } from "@/lib/client/bff-fetch";
import { openMeetingUrl } from "@/lib/client/open-meeting-url";
import { terminarSessaoFormacaoComConfirmacao } from "@/lib/client/terminar-sessao-formacao";
import { parseApiError } from "@/lib/ui/backoffice";
import { TempoPresencaAoVivo } from "@/components/lms/tempo-presenca-ao-vivo";
import { Button } from "@/components/ui";

export type SessaoFormacaoPresencaState = {
  fonteId: string;
  /** Para navegar à ficha da acção (cronograma + aside). */
  acaoFormacaoId?: string | null;
  salaJoinUrl?: string | null;
  iniciadaEm?: string | null;
  terminadaEm?: string | null;
  formadorEntradaEm?: string | null;
  formadorDuracaoSegundos?: number | null;
  lmsAtivo?: boolean;
  modalidade?: string | null;
};

type Props = {
  sessao: SessaoFormacaoPresencaState;
  /** Formador/gestor: iniciar, entrar e terminar. */
  podeGerir?: boolean;
  /** Formando: link para página de reunião com contador. */
  reuniaoHref?: string | null;
  writeDisabled?: boolean;
  onUpdated: () => void | Promise<void>;
};

export function SessaoFormacaoPresencaControls({
  sessao,
  podeGerir,
  reuniaoHref,
  writeDisabled,
  onUpdated,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const emCurso = !!sessao.iniciadaEm && !sessao.terminadaEm;
  const concluida = !!sessao.terminadaEm;
  const formadorEmSessao = emCurso && !!sessao.formadorEntradaEm;

  const cronogramaHref = sessao.acaoFormacaoId
    ? `/portal/acoes/${encodeURIComponent(sessao.acaoFormacaoId)}?tab=cronograma&sessaoId=${encodeURIComponent(sessao.fonteId)}`
    : null;

  const post = useCallback(
    async (path: string) => {
      setBusy(true);
      setError(null);
      setMsg(null);
      try {
        const res = await bffFetch(`/api/v1/sessoes-formacao/${sessao.fonteId}${path}`, {
          method: "POST",
          headers: { accept: "application/json" },
        });
        if (!res.ok) {
          setError(await parseApiError(res));
          return null;
        }
        const data = (await res.json()) as {
          salaOnline?: { joinUrl?: string } | null;
          alreadyStarted?: boolean;
        };
        await onUpdated();
        return data;
      } catch {
        setError("Erro de rede.");
        return null;
      } finally {
        setBusy(false);
      }
    },
    [onUpdated, sessao.fonteId],
  );

  const irParaSessaoNaAcao = () => {
    if (!cronogramaHref) {
      setError("Acção da sessão não disponível.");
      return;
    }
    router.push(cronogramaHref);
  };

  const iniciarEAbrir = async () => {
    // Preferência: abrir cronograma da acção com a sessão seleccionada (aside).
    if (cronogramaHref) {
      router.push(cronogramaHref);
      return;
    }
    const data = await post("/iniciar");
    if (!data) return;
    const joinUrl = data.salaOnline?.joinUrl ?? sessao.salaJoinUrl;
    if (joinUrl) {
      const opened = openMeetingUrl(joinUrl);
      setMsg(
        opened.blocked
          ? "Sessão iniciada - popup bloqueado; usa o link da sala."
          : "Sessão iniciada - contador activo.",
      );
    } else {
      setMsg(
        data.alreadyStarted
          ? "Sessão já iniciada - contador activo."
          : "Sessão iniciada - contador activo.",
      );
    }
  };

  const entrar = async () => {
    const data = await post("/entrar-formador");
    if (!data) return;
    const joinUrl = data.salaOnline?.joinUrl ?? sessao.salaJoinUrl;
    if (joinUrl) {
      const opened = openMeetingUrl(joinUrl);
      setMsg(opened.blocked ? "Entrada registada - popup bloqueado." : "Entrada registada - contador activo.");
    } else {
      setMsg("Entrada registada - contador activo.");
    }
  };

  const terminar = async () => {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const result = await terminarSessaoFormacaoComConfirmacao(sessao.fonteId);
      if (!result.ok) {
        if (!result.cancelled) setError(result.error);
        return;
      }
      await onUpdated();
      setMsg(
        result.data.avisoPedagogicoEnviado
          ? "Sessão terminada. Departamento pedagógico notificado das pendências."
          : "Sessão terminada.",
      );
    } catch {
      setError("Erro de rede.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 space-y-2 border-t border-slate-600/40 pt-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-teal-300/80">
        Sessão de formação
      </p>

      {error ? <p className="text-xs text-red-400">{error}</p> : null}
      {msg ? <p className="text-xs text-emerald-400">{msg}</p> : null}

      {concluida ? (
        <p className="text-xs text-slate-400">
          Duração formador:{" "}
          <span className="font-mono text-slate-200">
            {formatarDuracaoHhMmSs(sessao.formadorDuracaoSegundos ?? 0)}
          </span>
        </p>
      ) : formadorEmSessao && sessao.formadorEntradaEm ? (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-0.5">
            Tempo do formador
          </p>
          <TempoPresencaAoVivo
            segundosFechados={0}
            emSessao
            joinDesde={sessao.formadorEntradaEm}
            className="text-lg font-mono tabular-nums text-teal-300"
          />
        </div>
      ) : emCurso ? (
        <p className="text-xs text-amber-300/90">
          Sessão em curso - entra para iniciar o teu contador de presença.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {podeGerir && !concluida && !emCurso ? (
          <Button size="sm" disabled={busy || writeDisabled} onClick={() => void iniciarEAbrir()}>
            <Video className="h-3.5 w-3.5" />
            Iniciar sessão
          </Button>
        ) : null}

        {podeGerir && emCurso ? (
          <>
            <Button size="sm" disabled={busy || writeDisabled} onClick={() => void entrar()}>
              <Video className="h-3.5 w-3.5" />
              {formadorEmSessao ? "Abrir sala" : "Entrar na sessão"}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={busy || writeDisabled}
              onClick={() => void terminar()}
            >
              Terminar sessão
            </Button>
          </>
        ) : null}

        {cronogramaHref && (emCurso || concluida) ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={irParaSessaoNaAcao}
          >
            Ver na acção
          </Button>
        ) : null}

        {reuniaoHref && emCurso ? (
          <Button size="sm" asChild>
            <a href={reuniaoHref}>
              <Video className="h-3.5 w-3.5" />
              Entrar (contador)
            </a>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
