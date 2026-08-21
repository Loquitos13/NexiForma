"use client";

import { useCallback, useState } from "react";
import { Copy, Video } from "lucide-react";
import { formatarDuracaoHhMmSs } from "@nexiforma/shared";
import { bffFetch } from "@/lib/client/bff-fetch";
import { openMeetingUrl } from "@/lib/client/open-meeting-url";
import { parseApiError } from "@/lib/ui/backoffice";
import { TempoPresencaAoVivo } from "@/components/lms/tempo-presenca-ao-vivo";
import { TeamsTranscricaoPanel } from "@/components/integracoes/teams-transcricao-panel";
import { Button, Sheet, SheetContent, Textarea } from "@/components/ui";

export type ReuniaoTeamsState = {
  fonteId: string;
  salaJoinUrl?: string | null;
  reuniaoEstado?: string | null;
  reuniaoIniciadaEm?: string | null;
  reuniaoTerminadaEm?: string | null;
  reuniaoDuracaoSegundos?: number | null;
  teamsTranscricaoEstado?: string | null;
  teamsTranscricao?: string | null;
};

type NotaForm = {
  contexto: string;
  situacaoActual: string;
  dorNecessidade: string;
  orcamentoTiming: string;
  decisor: string;
  proximoPassoNota: string;
  notasLivres: string;
};

const emptyNotaForm = (): NotaForm => ({
  contexto: "",
  situacaoActual: "",
  dorNecessidade: "",
  orcamentoTiming: "",
  decisor: "",
  proximoPassoNota: "",
  notasLivres: "",
});

type Props = {
  reuniao: ReuniaoTeamsState;
  podeCriarSalaTeams: boolean;
  writeDisabled?: boolean;
  teamsAviso?: string | null;
  onUpdated: () => void | Promise<void>;
};

export function CrmReuniaoTeamsControls({
  reuniao,
  podeCriarSalaTeams,
  writeDisabled,
  teamsAviso,
  onUpdated,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [terminarOpen, setTerminarOpen] = useState(false);
  const [registarNota, setRegistarNota] = useState(true);
  const [notaForm, setNotaForm] = useState<NotaForm>(emptyNotaForm);

  const id = reuniao.fonteId;
  const emCurso = reuniao.reuniaoEstado === "EM_CURSO";
  const concluida = reuniao.reuniaoEstado === "CONCLUIDA";
  const aviso =
    teamsAviso ??
    (!podeCriarSalaTeams && !reuniao.salaJoinUrl
      ? "Configure Microsoft Teams em Portal → Integrações (Azure + organizador M365)."
      : null);

  const patchLocal = useCallback(
    async (path: string, body?: unknown) => {
      setBusy(true);
      setError(null);
      setMsg(null);
      try {
        const res = await bffFetch(`/api/v1/crm/interaccoes/${id}${path}`, {
          method: "POST",
          headers: body
            ? { "Content-Type": "application/json", accept: "application/json" }
            : { accept: "application/json" },
          body: body ? JSON.stringify(body) : undefined,
        });
        if (!res.ok) {
          setError(await parseApiError(res));
          return null;
        }
        await onUpdated();
        return res.json();
      } catch {
        setError("Erro de rede.");
        return null;
      } finally {
        setBusy(false);
      }
    },
    [id, onUpdated],
  );

  const criarSala = () => void patchLocal("/teams/criar-sala");

  const copiarLink = async () => {
    if (!reuniao.salaJoinUrl) return;
    try {
      await navigator.clipboard.writeText(reuniao.salaJoinUrl);
      setMsg("Link copiado.");
    } catch {
      setError("Não foi possível copiar o link.");
    }
  };

  const iniciarChamada = async () => {
    const data = await patchLocal("/reuniao/iniciar");
    if (!data || !reuniao.salaJoinUrl) return;
    const opened = openMeetingUrl(reuniao.salaJoinUrl);
    if (opened.blocked) {
      setMsg("Chamada iniciada - popup bloqueado; use «Copiar link».");
    } else {
      setMsg("Chamada iniciada.");
    }
  };

  const abrirSala = () => {
    if (!reuniao.salaJoinUrl) return;
    const opened = openMeetingUrl(reuniao.salaJoinUrl);
    if (opened.blocked) setError("Popup bloqueado - use «Copiar link».");
  };

  const submitTerminar = async () => {
    const payload = {
      registarNota,
      importarTranscricao: true,
      ...(registarNota
        ? {
            contexto: notaForm.contexto.trim() || undefined,
            situacaoActual: notaForm.situacaoActual.trim() || undefined,
            dorNecessidade: notaForm.dorNecessidade.trim() || undefined,
            orcamentoTiming: notaForm.orcamentoTiming.trim() || undefined,
            decisor: notaForm.decisor.trim() || undefined,
            proximoPassoNota: notaForm.proximoPassoNota.trim() || undefined,
            notasLivres: notaForm.notasLivres.trim() || undefined,
          }
        : {}),
    };
    const data = await patchLocal("/reuniao/terminar", payload);
    if (data) {
      setTerminarOpen(false);
      setNotaForm(emptyNotaForm());
      setMsg(registarNota ? "Reunião terminada e nota registada." : "Reunião terminada.");
    }
  };

  const temSalaTeams = Boolean(reuniao.salaJoinUrl);

  return (
    <div className="mt-3 space-y-2 border-t border-slate-600/40 pt-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-300/80">
        Microsoft Teams
      </p>

      {error ? <p className="text-xs text-red-400">{error}</p> : null}
      {msg ? <p className="text-xs text-emerald-400">{msg}</p> : null}

      {!reuniao.salaJoinUrl && aviso ? (
        <p className="text-xs text-amber-400/90">{aviso}</p>
      ) : null}

      {concluida ? (
        <div className="space-y-2">
          <p className="text-xs text-slate-400">
            Duração:{" "}
            <span className="font-mono text-slate-200">
              {formatarDuracaoHhMmSs(reuniao.reuniaoDuracaoSegundos ?? 0)}
            </span>
          </p>
          <TeamsTranscricaoPanel
            fonteId={id}
            fonte="crm"
            teamsTranscricao={reuniao.teamsTranscricao}
            teamsTranscricaoEstado={reuniao.teamsTranscricaoEstado}
            temSalaTeams={temSalaTeams}
            writeDisabled={writeDisabled}
            onUpdated={onUpdated}
            compact
          />
        </div>
      ) : emCurso && reuniao.reuniaoIniciadaEm ? (
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-0.5">Tempo</p>
            <TempoPresencaAoVivo
              segundosFechados={0}
              emSessao
              joinDesde={reuniao.reuniaoIniciadaEm}
              className="text-lg font-mono tabular-nums text-violet-300"
            />
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {!reuniao.salaJoinUrl && !concluida ? (
          <Button
            size="sm"
            disabled={busy || writeDisabled || !podeCriarSalaTeams}
            onClick={() => void criarSala()}
            title={!podeCriarSalaTeams ? aviso ?? undefined : undefined}
          >
            <Video className="h-3.5 w-3.5" />
            Criar sala Teams
          </Button>
        ) : null}

        {reuniao.salaJoinUrl ? (
          <>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => void copiarLink()}>
              <Copy className="h-3.5 w-3.5" />
              Copiar link
            </Button>
            {!concluida ? (
              <Button size="sm" variant="secondary" disabled={busy} onClick={abrirSala}>
                <Video className="h-3.5 w-3.5" />
                Abrir sala Teams
              </Button>
            ) : null}
            {!concluida && !emCurso ? (
              <Button size="sm" disabled={busy || writeDisabled} onClick={() => void iniciarChamada()}>
                <Video className="h-3.5 w-3.5" />
                Iniciar chamada
              </Button>
            ) : null}
            {emCurso ? (
              <>
                <Button size="sm" variant="secondary" disabled={busy} onClick={abrirSala}>
                  Entrar na sala
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={busy || writeDisabled}
                  onClick={() => setTerminarOpen(true)}
                >
                  Terminar reunião
                </Button>
              </>
            ) : null}
          </>
        ) : null}
      </div>

      <Sheet open={terminarOpen} onOpenChange={setTerminarOpen}>
        <SheetContent
          title="Terminar reunião"
          description="Opcionalmente registe uma nota comercial com o resumo da chamada."
        >
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={registarNota}
                onChange={(e) => setRegistarNota(e.target.checked)}
                className="rounded border-slate-600"
              />
              Registar nota comercial
            </label>

            {registarNota ? (
              <div className="space-y-3">
                {(
                  [
                    ["contexto", "Contexto"],
                    ["situacaoActual", "Situação actual"],
                    ["dorNecessidade", "Dor / necessidade"],
                    ["orcamentoTiming", "Orçamento / timing"],
                    ["decisor", "Decisor"],
                    ["proximoPassoNota", "Próximo passo"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="block">
                    <span className="text-xs text-slate-400">{label}</span>
                    <Textarea
                      rows={2}
                      value={notaForm[key]}
                      onChange={(e) => setNotaForm((f) => ({ ...f, [key]: e.target.value }))}
                      className="mt-1"
                    />
                  </label>
                ))}
                <label className="block">
                  <span className="text-xs text-slate-400">Notas livres</span>
                  <Textarea
                    rows={3}
                    value={notaForm.notasLivres}
                    onChange={(e) => setNotaForm((f) => ({ ...f, notasLivres: e.target.value }))}
                    className="mt-1"
                  />
                </label>
                <p className="text-[11px] text-slate-500">
                  A nota incluirá automaticamente duração, comercial e cliente.
                </p>
              </div>
            ) : null}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                size="sm"
                variant="danger"
                disabled={busy || writeDisabled}
                onClick={() => void submitTerminar()}
              >
                {busy ? "A terminar…" : "Terminar reunião"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
