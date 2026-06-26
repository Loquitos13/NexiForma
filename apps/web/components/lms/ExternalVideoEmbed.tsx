"use client";

import { useEffect, useId, useRef } from "react";
import {
  parseVimeoVideoId,
  parseYoutubeVideoId,
  resolveWebinarEmbedUrl,
} from "@nexiforma/shared";

type ExternalVideoEmbedProps = {
  url: string;
  titulo: string;
  duracaoMin?: number | null;
  /** Disparado quando o vídeo termina (YouTube/Vimeo) ou após tempo mínimo (URL genérico). */
  onConcluido?: () => void;
  footerNote?: string;
};

type YtPlayer = { destroy: () => void };
type VimeoPlayer = { on: (event: string, cb: () => void) => void; destroy: () => void };

declare global {
  interface Window {
    YT?: {
      Player: new (
        el: HTMLElement | string,
        opts: {
          videoId: string;
          playerVars?: Record<string, number | string>;
          events?: { onStateChange?: (ev: { data: number }) => void };
        },
      ) => YtPlayer;
      PlayerState: { ENDED: number };
    };
    onYouTubeIframeAPIReady?: () => void;
    Vimeo?: { Player: new (el: HTMLIFrameElement) => VimeoPlayer };
  }
}

let youtubeApiPromise: Promise<void> | null = null;

function loadYouTubeIframeApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise((resolve) => {
    const done = () => resolve();
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      done();
    };
    if (document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      if (window.YT?.Player) done();
      return;
    }
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  });
  return youtubeApiPromise;
}

let vimeoApiPromise: Promise<void> | null = null;

function loadVimeoPlayerApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.Vimeo?.Player) return Promise.resolve();
  if (vimeoApiPromise) return vimeoApiPromise;

  vimeoApiPromise = new Promise((resolve) => {
    if (document.querySelector('script[src="https://player.vimeo.com/api/player.js"]')) {
      if (window.Vimeo?.Player) resolve();
      else {
        const tag = document.querySelector('script[src="https://player.vimeo.com/api/player.js"]') as HTMLScriptElement;
        tag.addEventListener("load", () => resolve(), { once: true });
      }
      return;
    }
    const tag = document.createElement("script");
    tag.src = "https://player.vimeo.com/api/player.js";
    tag.onload = () => resolve();
    document.head.appendChild(tag);
  });
  return vimeoApiPromise;
}

function engagementFallbackSeconds(duracaoMin: number | null | undefined): number {
  if (duracaoMin && duracaoMin > 0) {
    return Math.max(30, Math.round(duracaoMin * 60 * 0.7));
  }
  return 90;
}

/** Embed YouTube/Vimeo com detecção de fim de vídeo; iframe genérico usa temporizador. */
export function ExternalVideoEmbed({
  url,
  titulo,
  duracaoMin,
  onConcluido,
  footerNote,
}: ExternalVideoEmbedProps) {
  const reactId = useId().replace(/:/g, "");
  const ytHostRef = useRef<HTMLDivElement>(null);
  const vimeoIframeRef = useRef<HTMLIFrameElement>(null);
  const playerRef = useRef<YtPlayer | VimeoPlayer | null>(null);
  const concluidoRef = useRef(false);

  const youtubeId = parseYoutubeVideoId(url);
  const vimeoId = parseVimeoVideoId(url);
  const embedUrl = resolveWebinarEmbedUrl(url);

  const marcarConcluido = () => {
    if (concluidoRef.current) return;
    concluidoRef.current = true;
    onConcluido?.();
  };

  useEffect(() => {
    concluidoRef.current = false;
  }, [url]);

  useEffect(() => {
    if (!youtubeId || !ytHostRef.current) return;
    let cancelled = false;
    let player: YtPlayer | null = null;

    void loadYouTubeIframeApi().then(() => {
      if (cancelled || !ytHostRef.current || !window.YT?.Player) return;
      player = new window.YT.Player(ytHostRef.current, {
        videoId: youtubeId,
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onStateChange: (ev) => {
            if (ev.data === window.YT!.PlayerState.ENDED) marcarConcluido();
          },
        },
      });
      playerRef.current = player;
    });

    return () => {
      cancelled = true;
      player?.destroy();
      playerRef.current = null;
    };
  }, [youtubeId]);

  useEffect(() => {
    if (!vimeoId || !vimeoIframeRef.current) return;
    let cancelled = false;
    let player: VimeoPlayer | null = null;

    void loadVimeoPlayerApi().then(() => {
      if (cancelled || !vimeoIframeRef.current || !window.Vimeo?.Player) return;
      player = new window.Vimeo.Player(vimeoIframeRef.current);
      player.on("ended", marcarConcluido);
      playerRef.current = player;
    });

    return () => {
      cancelled = true;
      player?.destroy();
      playerRef.current = null;
    };
  }, [vimeoId]);

  useEffect(() => {
    if (youtubeId || vimeoId || !embedUrl) return;
    const secs = engagementFallbackSeconds(duracaoMin);
    const t = setTimeout(marcarConcluido, secs * 1000);
    return () => clearTimeout(t);
  }, [youtubeId, vimeoId, embedUrl, duracaoMin]);

  if (youtubeId) {
    return (
      <div className="rounded-2xl overflow-hidden border border-cyan-500/20 bg-black">
        <div ref={ytHostRef} id={`yt-${reactId}`} className="w-full aspect-video" title={titulo} />
        {footerNote ? (
          <p className="text-[11px] text-slate-500 px-4 py-2 border-t border-slate-700/30">{footerNote}</p>
        ) : null}
      </div>
    );
  }

  if (vimeoId) {
    return (
      <div className="rounded-2xl overflow-hidden border border-cyan-500/20 bg-black">
        <iframe
          ref={vimeoIframeRef}
          src={`https://player.vimeo.com/video/${vimeoId}`}
          className="w-full aspect-video"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          title={titulo}
        />
        {footerNote ? (
          <p className="text-[11px] text-slate-500 px-4 py-2 border-t border-slate-700/30">{footerNote}</p>
        ) : null}
      </div>
    );
  }

  if (!embedUrl) {
    return (
      <div className="rounded-2xl border border-cyan-500/20 bg-slate-900/50 p-6 text-center">
        <p className="text-sm text-slate-300">URL de vídeo inválido</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden border border-cyan-500/20 bg-black">
      <iframe
        src={embedUrl}
        className="w-full aspect-video"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        title={titulo}
      />
      {footerNote ? (
        <p className="text-[11px] text-slate-500 px-4 py-2 border-t border-slate-700/30">{footerNote}</p>
      ) : null}
    </div>
  );
}
