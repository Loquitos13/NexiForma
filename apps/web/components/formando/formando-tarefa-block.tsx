"use client";

import { useCallback, useEffect, useRef } from "react";
import { Lock } from "lucide-react";
import { isModuloStorageRef, parseVimeoVideoId, parseYoutubeVideoId, resolveModuloConteudoUrl, sanitizeLmsHtml } from "@nexiforma/shared";
import { ModuloStoredMedia } from "@/components/lms/ModuloStoredMedia";
import { ExternalVideoEmbed } from "@/components/lms/ExternalVideoEmbed";
import { useAutoConcluirModulo } from "@/lib/lms/use-auto-concluir-modulo";
import { FormandoFlashcard } from "./formando-flashcard";
import { FormandoQuizInline } from "./formando-quiz-inline";
import { isFlashcardTarefa, type TarefaPercurso } from "./formando-percurso-types";

type Props = {
  tarefa: TarefaPercurso;
  matriculaId: string;
  cursoId: string;
  onConcluido?: () => void;
};

export function FormandoTarefaBlock({ tarefa, matriculaId, cursoId, onConcluido }: Props) {
  const locked = !tarefa.desbloqueado;
  const concluido = tarefa.concluido || tarefa.percentual >= 100;
  const { registarConclusao } = useAutoConcluirModulo({
    matriculaId,
    moduloId: tarefa.id,
    jaConcluido: concluido,
    onConcluido,
  });

  const urlOuRef = tarefa.urlOuRef ?? null;
  const isStored = isModuloStorageRef(urlOuRef);
  const mediaUrl = !isStored ? resolveModuloConteudoUrl(tarefa) : null;
  const mimeType =
    tarefa.metadata && typeof tarefa.metadata.mimeType === "string" ? tarefa.metadata.mimeType : null;
  const isExternalVideo =
    mediaUrl &&
    (parseYoutubeVideoId(mediaUrl) !== null || mediaUrl.includes("youtube.com") || mediaUrl.includes("youtu.be"));
  const isOfficeDoc =
    mimeType?.includes("word") ||
    mimeType?.includes("powerpoint") ||
    mimeType?.includes("spreadsheet") ||
    mimeType?.includes("msword") ||
    (tarefa.metadata &&
      typeof tarefa.metadata.fileName === "string" &&
      /\.(doc|docx|ppt|pptx|xls|xlsx)$/i.test(tarefa.metadata.fileName));

  const textoRef = useRef<HTMLDivElement>(null);
  const handleConcluir = useCallback(() => void registarConclusao(), [registarConclusao]);

  useEffect(() => {
    if (concluido || locked) return;
    const webinarComPlayer =
      tarefa.tipo === "WEBINAR" &&
      (parseYoutubeVideoId(urlOuRef) !== null || parseVimeoVideoId(urlOuRef) !== null);
    const videoExternoComPlayer = tarefa.tipo === "VIDEO" && isExternalVideo;
    const usaTimerEngagement =
      !webinarComPlayer &&
      !videoExternoComPlayer &&
      tarefa.tipo === "PDF" &&
      mediaUrl &&
      !isOfficeDoc &&
      !mimeType?.startsWith("image/") &&
      !isStored;
    if (!usaTimerEngagement) return;
    const secs = tarefa.duracaoMin ? Math.max(30, Math.round(tarefa.duracaoMin * 60 * 0.7)) : 90;
    const t = setTimeout(() => void handleConcluir(), secs * 1000);
    return () => clearTimeout(t);
  }, [tarefa, concluido, locked, isExternalVideo, isOfficeDoc, isStored, mediaUrl, mimeType, urlOuRef, handleConcluir]);

  useEffect(() => {
    if (concluido || locked || !tarefa.conteudoHtml || isFlashcardTarefa(tarefa)) return;
    const el = textoRef.current;
    if (!el) return;
    function checkScroll() {
      const node = textoRef.current;
      if (!node) return;
      if (node.scrollHeight <= node.clientHeight + 8) {
        void handleConcluir();
        return;
      }
      if (node.scrollTop + node.clientHeight >= node.scrollHeight * 0.92) {
        void handleConcluir();
      }
    }
    el.addEventListener("scroll", checkScroll);
    checkScroll();
    return () => el.removeEventListener("scroll", checkScroll);
  }, [tarefa.conteudoHtml, concluido, locked, handleConcluir, tarefa]);

  const meta = tarefa.metadata ?? {};
  const flashcard = isFlashcardTarefa(tarefa);

  return (
    <section id={`tarefa-${tarefa.id}`} className="portal-card-shell scroll-mt-6 border-b border-slate-700/30 px-3 py-10 last:border-b-0 sm:px-6">
      <header className="mb-6 text-center">
        <h3 className="text-xl font-bold uppercase tracking-wide text-slate-100">{tarefa.titulo}</h3>
        {concluido ? (
          <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-teal-500/15 px-3 py-0.5 text-xs font-semibold text-teal-400">
            Concluído
          </span>
        ) : locked ? (
          <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-slate-700/50 px-3 py-0.5 text-xs font-semibold text-slate-400">
            <Lock className="h-3 w-3" /> Bloqueado
          </span>
        ) : null}
      </header>

      {locked ? (
        <p className="text-center text-sm text-slate-500">Conclui o tópico anterior para desbloquear este conteúdo.</p>
      ) : flashcard ? (
        <FormandoFlashcard
          frente={(typeof meta.frente === "string" ? meta.frente : null) ?? tarefa.titulo}
          verso={(typeof meta.verso === "string" ? meta.verso : null) ?? ""}
          frenteHtml={tarefa.conteudoHtml}
          versoHtml={typeof meta.versoHtml === "string" ? meta.versoHtml : null}
        />
      ) : tarefa.tipo === "QUIZ" ? (
        <FormandoQuizInline
          moduloId={tarefa.id}
          matriculaId={matriculaId}
          titulo={tarefa.titulo}
          embedded
          onComplete={() => onConcluido?.()}
        />
      ) : tarefa.tipo === "SCORM" && urlOuRef ? (
        <div className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-slate-700/30 bg-slate-900/50">
          <iframe src={urlOuRef} className="min-h-[60vh] w-full" title={tarefa.titulo} />
        </div>
      ) : tarefa.tipo === "VIDEO" && (isStored || mediaUrl) ? (
        <div className="mx-auto max-w-3xl overflow-hidden rounded-2xl bg-black shadow-md ring-1 ring-slate-700/30">
          {isExternalVideo && mediaUrl ? (
            <ExternalVideoEmbed
              url={mediaUrl}
              titulo={tarefa.titulo}
              duracaoMin={tarefa.duracaoMin}
              onConcluido={handleConcluir}
            />
          ) : isStored && urlOuRef ? (
            <ModuloStoredMedia
              moduloId={tarefa.id}
              urlOuRef={urlOuRef}
              tipo="VIDEO"
              titulo={tarefa.titulo}
              variant="full"
              onVideoEnded={handleConcluir}
            />
          ) : (
            <video controls className="aspect-video w-full" src={mediaUrl!} onEnded={handleConcluir}>
              O teu browser não suporta vídeo.
            </video>
          )}
        </div>
      ) : tarefa.tipo === "PDF" && (isStored || mediaUrl) ? (
        <div className="mx-auto max-w-3xl">
          {isStored && urlOuRef ? (
            <ModuloStoredMedia
              moduloId={tarefa.id}
              urlOuRef={urlOuRef}
              tipo="PDF"
              titulo={tarefa.titulo}
              mimeType={mimeType}
              fileName={typeof meta.fileName === "string" ? meta.fileName : null}
              variant="full"
              onDocumentoVisualizado={handleConcluir}
            />
          ) : mediaUrl ? (
            <iframe
              src={mediaUrl}
              className="min-h-[60vh] w-full rounded-xl border border-slate-700/30"
              title={tarefa.titulo}
            />
          ) : null}
        </div>
      ) : tarefa.tipo === "WEBINAR" && urlOuRef ? (
        <div className="mx-auto max-w-3xl">
          <ExternalVideoEmbed
            url={urlOuRef}
            titulo={tarefa.titulo}
            duracaoMin={tarefa.duracaoMin}
            onConcluido={handleConcluir}
          />
        </div>
      ) : tarefa.conteudoHtml ? (
        <div
          ref={textoRef}
          className="portal-prose prose prose-invert prose-sm mx-auto w-full max-w-2xl rounded-2xl border border-slate-700/30 bg-slate-900/40 p-4 sm:p-8"
          dangerouslySetInnerHTML={{ __html: sanitizeLmsHtml(tarefa.conteudoHtml) ?? "" }}
        />
      ) : (
        <p className="text-center text-sm text-slate-500">Conteúdo indisponível.</p>
      )}
    </section>
  );
}
