"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { bffFetch } from "@/lib/client/bff-fetch";
import { isModuloStorageRef, parseVimeoVideoId, parseYoutubeVideoId, resolveModuloConteudoUrl } from "@nexiforma/shared";
import { ModuloStoredMedia } from "@/components/lms/ModuloStoredMedia";
import { ExternalVideoEmbed } from "@/components/lms/ExternalVideoEmbed";
import { useAutoConcluirModulo } from "@/lib/lms/use-auto-concluir-modulo";

type ConteudoInfo = {
  id: string;
  titulo: string;
  tipo: string;
  urlOuRef: string | null;
  conteudoHtml: string | null;
  duracaoMin: number | null;
  metadata?: Record<string, unknown> | null;
};

export default function ConteudoViewerPage() {
  const params = useParams<{ moduloId: string }>();
  const moduloId = params.moduloId;
  const search = useSearchParams();
  const matriculaId = search.get("matriculaId") ?? "";
  const cursoId = search.get("cursoId") ?? "";

  const [modulo, setModulo] = useState<ConteudoInfo | null>(null);
  const [progresso, setProgresso] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    if (!cursoId || !matriculaId) {
      setError("Curso ou matrícula não identificados.");
      return;
    }

    const percursoRes = await bffFetch(
      `/api/v1/conteudos-lms/percurso?cursoId=${encodeURIComponent(cursoId)}&matriculaId=${encodeURIComponent(matriculaId)}`,
      { headers: { accept: "application/json" } },
    );
    if (!percursoRes.ok) {
      setError("Erro ao carregar percurso.");
      return;
    }

    const percurso = (await percursoRes.json()) as {
      tarefas: Array<{
        id: string;
        titulo: string;
        tipo: string;
        urlOuRef?: string | null;
        conteudoHtml?: string | null;
        duracaoMin: number | null;
        metadata?: Record<string, unknown> | null;
        desbloqueado: boolean;
        percentual: number;
        pontuacao: number | null;
      }>;
    };

    const found = percurso.tarefas.find((m) => m.id === moduloId);
    if (!found) {
      setError("Conteúdo não encontrado.");
      return;
    }
    if (!found.desbloqueado) {
      setError("Este conteúdo está bloqueado. Conclui o módulo anterior com a nota mínima exigida.");
      return;
    }

    setModulo({
      id: found.id,
      titulo: found.titulo,
      tipo: found.tipo,
      urlOuRef: found.urlOuRef ?? null,
      conteudoHtml: found.conteudoHtml ?? null,
      duracaoMin: found.duracaoMin,
      metadata: found.metadata ?? null,
    });
    setProgresso(found.percentual);
  }, [moduloId, matriculaId, cursoId]);

  useEffect(() => { void load(); }, [load]);

  const concluido = progresso >= 100;
  const { registarConclusao } = useAutoConcluirModulo({
    matriculaId,
    moduloId,
    jaConcluido: concluido,
    onConcluido: () => {
      setProgresso(100);
      setMsg("Conteúdo concluído.");
    },
  });

  const isStored = isModuloStorageRef(modulo?.urlOuRef);
  const mediaUrl = modulo && !isStored ? resolveModuloConteudoUrl(modulo) : null;
  const mimeType =
    modulo?.metadata && typeof modulo.metadata === "object" && typeof modulo.metadata.mimeType === "string"
      ? modulo.metadata.mimeType
      : null;
  const isExternalVideo =
    mediaUrl &&
    (parseYoutubeVideoId(mediaUrl) !== null || mediaUrl.includes("youtube.com") || mediaUrl.includes("youtu.be"));
  const isOfficeDoc =
    mimeType?.includes("word") ||
    mimeType?.includes("powerpoint") ||
    mimeType?.includes("spreadsheet") ||
    mimeType?.includes("msword") ||
    (modulo?.metadata &&
      typeof modulo.metadata.fileName === "string" &&
      /\.(doc|docx|ppt|pptx|xls|xlsx)$/i.test(modulo.metadata.fileName));

  const textoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (concluido || !modulo) return;
    const webinarComPlayer =
      modulo.tipo === "WEBINAR" &&
      (parseYoutubeVideoId(modulo.urlOuRef) !== null || parseVimeoVideoId(modulo.urlOuRef) !== null);
    const videoExternoComPlayer = modulo.tipo === "VIDEO" && isExternalVideo;
    const usaTimerEngagement =
      !webinarComPlayer &&
      !videoExternoComPlayer &&
      (modulo.tipo === "PDF" && mediaUrl && !isOfficeDoc && !mimeType?.startsWith("image/") && !isStored);
    if (!usaTimerEngagement) return;
    const secs = modulo.duracaoMin ? Math.max(30, Math.round(modulo.duracaoMin * 60 * 0.7)) : 90;
    const t = setTimeout(() => void registarConclusao(), secs * 1000);
    return () => clearTimeout(t);
  }, [modulo, concluido, isExternalVideo, isOfficeDoc, isStored, mediaUrl, mimeType, registarConclusao]);

  useEffect(() => {
    if (concluido || !modulo?.conteudoHtml) return;
    const el = textoRef.current;
    if (!el) return;
    function checkScroll() {
      const node = textoRef.current;
      if (!node) return;
      if (node.scrollHeight <= node.clientHeight + 8) {
        void registarConclusao();
        return;
      }
      if (node.scrollTop + node.clientHeight >= node.scrollHeight * 0.92) {
        void registarConclusao();
      }
    }
    el.addEventListener("scroll", checkScroll);
    checkScroll();
    return () => el.removeEventListener("scroll", checkScroll);
  }, [modulo?.conteudoHtml, concluido, registarConclusao]);

  return (
    <div className="max-w-4xl mx-auto px-5 py-8 space-y-6">
      <Link href={`/portal/formando/aprendizagem/${matriculaId}`} className="text-sm text-blue-400 hover:text-blue-300 transition-colors inline-flex items-center gap-1">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Portal do formando
      </Link>

      {error ? (
        <div className="flex items-start gap-2.5 rounded-xl bg-red-950/40 border border-red-500/25 px-4 py-3">
          <p className="text-sm text-red-300">{error}</p>
        </div>
      ) : null}
      {msg ? (
        <div className="flex items-start gap-2.5 rounded-xl bg-green-950/30 border border-green-500/25 px-4 py-3">
          <p className="text-sm text-green-300">{msg}</p>
        </div>
      ) : null}

      {modulo ? (
        <>
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-50">{modulo.titulo}</h1>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-700/50 text-[11px] font-medium text-slate-400">
                  {modulo.tipo}
                </span>
                {modulo.duracaoMin ? (
                  <span className="text-xs text-slate-500">{modulo.duracaoMin} min</span>
                ) : null}
                {concluido ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-500/10 text-[11px] font-medium text-teal-400">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    Concluido
                  </span>
                ) : null}
              </div>
            </div>

            {!concluido ? (
              <p className="text-xs text-slate-500">A conclusão regista-se automaticamente ao terminares o conteúdo.</p>
            ) : null}
          </div>

          {/* Progress bar */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${concluido ? "bg-teal-500" : "bg-blue-500"}`}
                style={{ width: `${progresso}%` }}
              />
            </div>
            <span className="text-sm font-bold text-slate-300 tabular-nums">{progresso}%</span>
          </div>

          {/* Content */}
          {modulo.tipo === "VIDEO" && (isStored || mediaUrl) ? (
            <div className="rounded-2xl overflow-hidden bg-black border border-slate-700/30">
              {isExternalVideo && mediaUrl ? (
                <ExternalVideoEmbed
                  url={mediaUrl}
                  titulo={modulo.titulo}
                  duracaoMin={modulo.duracaoMin}
                  onConcluido={() => void registarConclusao()}
                />
              ) : isStored && modulo.urlOuRef ? (
                <ModuloStoredMedia
                  moduloId={modulo.id}
                  urlOuRef={modulo.urlOuRef}
                  tipo="VIDEO"
                  titulo={modulo.titulo}
                  variant="full"
                  onVideoEnded={() => void registarConclusao()}
                />
              ) : (
                <video
                  controls
                  className="w-full aspect-video"
                  src={mediaUrl!}
                  onEnded={() => void registarConclusao()}
                >
                  O teu browser não suporta vídeo.
                </video>
              )}
            </div>
          ) : modulo.tipo === "PDF" && (isStored || mediaUrl) ? (
            isStored && modulo.urlOuRef ? (
              <div className="rounded-2xl overflow-hidden border border-slate-700/30 bg-slate-900/30">
                <ModuloStoredMedia
                  moduloId={modulo.id}
                  urlOuRef={modulo.urlOuRef}
                  tipo="PDF"
                  titulo={modulo.titulo}
                  mimeType={mimeType}
                  fileName={
                    modulo.metadata && typeof modulo.metadata === "object" && typeof modulo.metadata.fileName === "string"
                      ? modulo.metadata.fileName
                      : null
                  }
                  variant="full"
                  onDocumentoVisualizado={() => void registarConclusao()}
                />
              </div>
            ) : mimeType?.startsWith("image/") && mediaUrl ? (
              <div className="rounded-2xl overflow-hidden border border-slate-700/30 bg-slate-900/30 p-4 flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mediaUrl} alt={modulo.titulo} className="max-w-full max-h-[70vh] rounded-lg" />
              </div>
            ) : isOfficeDoc && mediaUrl ? (
              <div className="rounded-2xl border border-slate-700/30 bg-slate-900/50 p-6 text-center space-y-3">
                <p className="text-sm text-slate-300">Documento para transferir</p>
                <a
                  href={mediaUrl}
                  download
                  onClick={() => void registarConclusao()}
                  className="inline-flex px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium text-white"
                >
                  Descarregar ficheiro
                </a>
              </div>
            ) : mediaUrl ? (
              <div className="rounded-2xl overflow-hidden border border-slate-700/30 bg-white" style={{ minHeight: "70vh" }}>
                <iframe src={mediaUrl} className="w-full" style={{ height: "70vh" }} title={modulo.titulo} />
              </div>
            ) : null
          ) : modulo.tipo === "WEBINAR" && modulo.urlOuRef ? (
            <ExternalVideoEmbed
              url={modulo.urlOuRef}
              titulo={modulo.titulo}
              duracaoMin={modulo.duracaoMin}
              onConcluido={() => void registarConclusao()}
              footerNote="Se o webinar não carregar aqui, a plataforma externa pode bloquear embeds."
            />
          ) : modulo.conteudoHtml ? (
            <div
              ref={textoRef}
              className="rounded-2xl bg-slate-900/50 border border-slate-700/30 p-6 prose prose-invert prose-sm max-w-none max-h-[70vh] overflow-y-auto"
              dangerouslySetInnerHTML={{ __html: modulo.conteudoHtml }}
            />
          ) : (
            <div className="text-center py-12 rounded-2xl bg-slate-900/30 border border-slate-700/20">
              <svg className="w-12 h-12 text-slate-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              <p className="text-slate-500 text-sm">Conteudo nao disponivel.</p>
              <p className="text-slate-600 text-xs mt-1">O formador ainda nao carregou o conteudo deste modulo.</p>
            </div>
          )}

          {/* Concluded state */}
          {concluido ? (
            <div className="rounded-2xl bg-teal-500/5 border border-teal-500/15 p-5 text-center">
              <p className="text-teal-300 font-semibold">Modulo concluido com sucesso!</p>
              <Link href={`/portal/formando/aprendizagem/${matriculaId}`} className="text-sm text-teal-400 hover:text-teal-300 transition-colors mt-1.5 inline-block">
                Voltar ao portal
              </Link>
            </div>
          ) : null}
        </>
      ) : (
        <p className="text-slate-500 text-sm text-center py-12">A carregar...</p>
      )}
    </div>
  );
}
