"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { resolveSalaOnline, isModalidadeOnline } from "@nexiforma/shared";
import { bffFetch, refreshViaBffCookies } from "@/lib/client/bff-fetch";
import { openMeetingUrl } from "@/lib/client/open-meeting-url";
import {
  getAccessToken,
  syncAccessTokenToLocalStorage,
} from "@/lib/client/access-token";
import { parseApiError } from "@/lib/ui/backoffice";
import {
  guardarPresencaAtiva,
  limparPresencaAtiva,
} from "@/lib/lms/presenca-storage";
import {
  usePresencaRelogio,
  type PresencaEstadoApi,
} from "@/lib/lms/use-presenca-sessao";

type SessaoInfo = {
  id: string;
  numeroSessao: number;
  modalidade: string;
  iniciadaEm?: string | null;
  terminadaEm?: string | null;
  salaOnline?: ReturnType<typeof resolveSalaOnline>;
};

async function fetchPresenca(
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

function postLeaveKeepalive(matriculaId: string, sessaoId: string) {
  const token = getAccessToken();
  void fetch("/api/v1/lms/eventos", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      accept: "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      matriculaId,
      sessaoFormacaoId: sessaoId,
      evento: "leave",
    }),
    credentials: "include",
    keepalive: true,
  });
}

function ReuniaoContent() {
  const params = useSearchParams();
  const matriculaId = params.get("matriculaId") ?? "";
  const sessaoId = params.get("sessaoFormacaoId") ?? params.get("sessaoId") ?? "";

  const [sessao, setSessao] = useState<SessaoInfo | null>(null);
  const [estado, setEstado] = useState<PresencaEstadoApi | null>(null);
  const [emailPresencaReuniao, setEmailPresencaReuniao] = useState<string | null>(null);
  const [emailPresencaDefinidoPeloGestor, setEmailPresencaDefinidoPeloGestor] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [encerrada, setEncerrada] = useState(false);
  const [aguardaSala, setAguardaSala] = useState(false);
  const [popupBloqueado, setPopupBloqueado] = useState(false);
  const leaveSent = useRef(false);
  const meetingOpened = useRef(false);

  const relogio = usePresencaRelogio(
    estado
      ? {
          emSessao: estado.emSessao,
          joinDesde: estado.joinDesde,
          segundosFechados: estado.segundosFechados,
          segundosTotais: estado.segundosTotais,
          segundosIntervaloAtual: estado.segundosIntervaloAtual,
        }
      : null,
  );

  const registarSaida = useCallback(async () => {
    if (leaveSent.current || !matriculaId || !sessaoId) return;
    leaveSent.current = true;
    limparPresencaAtiva();
    postLeaveKeepalive(matriculaId, sessaoId);
    const r = await bffFetch("/api/v1/lms/eventos", {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        matriculaId,
        sessaoFormacaoId: sessaoId,
        evento: "leave",
      }),
    });
    if (r.ok) {
      const data = await fetchPresenca(matriculaId, sessaoId);
      if (data) setEstado(data);
    }
  }, [matriculaId, sessaoId]);

  useEffect(() => {
    if (!matriculaId || !sessaoId) {
      setError("Parâmetros em falta (matriculaId, sessaoId).");
      return;
    }

    let cancelled = false;

    void (async () => {
      syncAccessTokenToLocalStorage();
      if (!getAccessToken()) {
        await refreshViaBffCookies();
      }

      const r = await bffFetch("/api/v1/lms/minhas-sessoes", {
        headers: { accept: "application/json" },
      });
      if (!r.ok) {
        if (!cancelled) {
          setError(
            r.status === 403
              ? "Sem permissão - inicia sessão como formando."
              : await parseApiError(r),
          );
        }
        return;
      }

      const blocks = (await r.json()) as Array<{
        matriculaId: string;
        emailPresencaReuniao?: string | null;
        emailPresencaDefinidoPeloGestor?: boolean;
        sessoes: Array<{
          id: string;
          numeroSessao: number;
          modalidade: string;
          iniciadaEm?: string | null;
          terminadaEm?: string | null;
          zoomMeetingId?: string | null;
          teamsMeetingId?: string | null;
          salaJoinUrl?: string | null;
        }>;
      }>;

      const block = blocks.find((b) => b.matriculaId === matriculaId);
      if (!cancelled && block) {
        setEmailPresencaReuniao(block.emailPresencaReuniao ?? null);
        setEmailPresencaDefinidoPeloGestor(!!block.emailPresencaDefinidoPeloGestor);
      }
      const found = block?.sessoes.find((s) => s.id === sessaoId);
      if (!found) {
        if (!cancelled) setError("Sessão não encontrada para esta matrícula.");
        return;
      }

      if (!block?.emailPresencaReuniao && !cancelled) {
        setError(
          "Falta email de presença na reunião - pede ao gestor para configurar o teu perfil antes de entrar.",
        );
        return;
      }

      if (found.terminadaEm) {
        if (!cancelled) {
          setEncerrada(true);
          setError("Esta sessão já foi terminada pelo formador.");
        }
        return;
      }
      if (!found.iniciadaEm) {
        if (!cancelled) setError("Aguarda o formador iniciar a sessão.");
        return;
      }

      const salaOnline = resolveSalaOnline(found);
      const requerSala = isModalidadeOnline(found.modalidade);
      if (!cancelled) {
        setSessao({
          id: found.id,
          numeroSessao: found.numeroSessao,
          modalidade: found.modalidade,
          iniciadaEm: found.iniciadaEm,
          terminadaEm: found.terminadaEm,
          salaOnline,
        });
        setAguardaSala(requerSala && !salaOnline);
      }

      let pres = await fetchPresenca(matriculaId, sessaoId);
      if (pres?.sessaoEncerrada) {
        if (!cancelled) {
          setEncerrada(true);
          setError("Sessão terminada.");
        }
        return;
      }

      if (!pres?.emSessao) {
        const joinR = await bffFetch("/api/v1/lms/eventos", {
          method: "POST",
          headers: { "Content-Type": "application/json", accept: "application/json" },
          body: JSON.stringify({
            matriculaId,
            sessaoFormacaoId: sessaoId,
            evento: "join",
          }),
        });
        if (!joinR.ok) {
          pres = await fetchPresenca(matriculaId, sessaoId);
          if (!pres?.emSessao) {
            if (!cancelled) {
              setError(await parseApiError(joinR));
            }
            return;
          }
        } else {
          pres = await fetchPresenca(matriculaId, sessaoId);
        }
      }

      if (!cancelled && pres) {
        setEstado(pres);
        guardarPresencaAtiva({ matriculaId, sessaoId });
      }

      if (!cancelled && salaOnline?.joinUrl && !meetingOpened.current) {
        const skipAutoOpen = typeof window !== "undefined" && !!window.opener;
        if (!skipAutoOpen) {
          meetingOpened.current = true;
          const result = openMeetingUrl(salaOnline.joinUrl);
          if (result.blocked) setPopupBloqueado(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [matriculaId, sessaoId]);

  useEffect(() => {
    if (!matriculaId || !sessaoId || !aguardaSala || encerrada) return;

    const pollSala = async () => {
      const r = await bffFetch("/api/v1/lms/minhas-sessoes", {
        headers: { accept: "application/json" },
      });
      if (!r.ok) return;
      const blocks = (await r.json()) as Array<{
        matriculaId: string;
        sessoes: Array<{
          id: string;
          zoomMeetingId?: string | null;
          teamsMeetingId?: string | null;
          salaJoinUrl?: string | null;
        }>;
      }>;
      const block = blocks.find((b) => b.matriculaId === matriculaId);
      const found = block?.sessoes.find((s) => s.id === sessaoId);
      if (!found) return;
      const sala = resolveSalaOnline(found);
      if (!sala?.joinUrl) return;

      setAguardaSala(false);
      setSessao((prev) => (prev ? { ...prev, salaOnline: sala } : prev));
      if (!meetingOpened.current) {
        meetingOpened.current = true;
        const result = openMeetingUrl(sala.joinUrl);
        if (result.blocked) setPopupBloqueado(true);
      }
    };

    void pollSala();
    const id = setInterval(() => void pollSala(), 3000);
    return () => clearInterval(id);
  }, [matriculaId, sessaoId, aguardaSala, encerrada]);

  useEffect(() => {
    if (!matriculaId || !sessaoId || encerrada) return;

    const poll = async () => {
      const pres = await fetchPresenca(matriculaId, sessaoId);
      if (!pres) return;

      if (pres.sessaoEncerrada) {
        setEncerrada(true);
        setEstado(pres);
        limparPresencaAtiva();
        leaveSent.current = true;
        return;
      }

      setEstado(pres);
    };

    void poll();
    const id = setInterval(() => void poll(), 2000);
    return () => clearInterval(id);
  }, [matriculaId, sessaoId, encerrada]);

  useEffect(() => {
    if (!matriculaId || !sessaoId) return;

    const onLeave = () => {
      if (leaveSent.current || encerrada) return;
      leaveSent.current = true;
      limparPresencaAtiva();
      postLeaveKeepalive(matriculaId, sessaoId);
    };

    window.addEventListener("beforeunload", onLeave);
    window.addEventListener("pagehide", onLeave);
    return () => {
      window.removeEventListener("beforeunload", onLeave);
      window.removeEventListener("pagehide", onLeave);
    };
  }, [matriculaId, sessaoId, encerrada]);

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <p className="text-red-300">{error}</p>
          <Link href="/portal/formando" className="text-blue-400 hover:text-blue-300 text-sm">
            ← Voltar ao portal
          </Link>
        </div>
      </div>
    );
  }

  if (!sessao || !relogio) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-400 flex items-center justify-center">
        A entrar na sessão…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="border-b border-slate-800 px-5 py-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">Sessão {sessao.numeroSessao}</p>
          <p className="text-lg font-semibold text-teal-300">
            {encerrada ? "Sessão terminada" : "Estás na reunião"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">Tempo na sessão</p>
          <p className="text-2xl font-mono tabular-nums text-teal-200">
            {relogio.tempoTotalFormatado}
          </p>
        </div>
      </header>

      <main className="flex-1 p-6 max-w-lg mx-auto w-full space-y-6">
        {encerrada ? (
          <p className="text-sm text-amber-300/90">
            O formador terminou a sessão. O teu tempo de presença foi registado automaticamente.
          </p>
        ) : (
          <>
            <p className="text-sm text-slate-400 leading-relaxed">
              A tua entrada foi registada automaticamente. O contador só corre enquanto estás na
              reunião. Ao fechares esta janela, a saída é registada automaticamente.
            </p>
            {emailPresencaReuniao ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-950/25 px-4 py-3 text-sm text-amber-100/90">
                <p className="font-medium text-amber-200">Email obrigatório no Zoom/Teams</p>
                <p className="mt-1 font-mono text-base text-amber-50">{emailPresencaReuniao}</p>
                <p className="mt-2 text-xs text-amber-200/70 leading-snug">
                  {emailPresencaDefinidoPeloGestor
                    ? "O teu gestor definiu este endereço - só com ele a presença na reunião conta para a folha."
                    : "Usa o email da tua conta NexiForma ao entrar na sala de videoconferência."}
                </p>
              </div>
            ) : null}
            {aguardaSala ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-950/25 px-4 py-3 text-sm text-amber-100/90">
                <p className="font-medium text-amber-200">A aguardar sala Teams/Zoom</p>
                <p className="mt-1 text-xs text-amber-200/70 leading-snug">
                  O formador ainda não abriu a videoconferência. Esta página actualiza automaticamente
                  quando a sala estiver disponível.
                </p>
              </div>
            ) : null}
            {popupBloqueado && sessao.salaOnline ? (
              <p className="text-xs text-amber-300/90 text-center">
                O browser bloqueou a abertura automática - usa o botão abaixo para entrar na sala.
              </p>
            ) : null}
            {sessao.salaOnline ? (
              <button
                type="button"
                onClick={() => {
                  const result = openMeetingUrl(sessao.salaOnline!.joinUrl);
                  if (result.blocked) {
                    window.location.href = sessao.salaOnline!.joinUrl;
                  }
                }}
                className="block w-full text-center rounded-xl bg-teal-600 hover:bg-teal-500 text-white py-3 text-sm font-medium transition-colors"
              >
                Abrir {sessao.salaOnline.provider}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void registarSaida().then(() => window.close())}
              className="w-full rounded-xl border border-slate-700 py-3 text-sm text-slate-300 hover:bg-slate-900 transition-colors"
            >
              Saí da reunião e fechar
            </button>
          </>
        )}

        <Link href="/portal/formando" className="block text-center text-sm text-blue-400 hover:text-blue-300">
          Voltar ao portal
        </Link>
      </main>
    </div>
  );
}

export default function ReuniaoFormandoPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 text-slate-400 flex items-center justify-center">
          A carregar…
        </div>
      }
    >
      <ReuniaoContent />
    </Suspense>
  );
}
