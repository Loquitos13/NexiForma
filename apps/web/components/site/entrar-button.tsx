"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { cn } from "@/lib/ui/cn";

/** Duração total da animação de vidro partido (ms) */
export const ENTRAR_GLASS_ANIMATION_MS = 1650;
/** Pausa após a animação antes de ir para /login (ms) */
export const ENTRAR_POST_ANIMATION_DELAY_MS = 480;

/** Fragmentos de vidro - clip-path a partir do centro do botão */
const GLASS_SHARDS = [
  { clip: "polygon(48% 42%, 0% 0%, 52% 0%)", tx: -16, ty: -12, rot: -14 },
  { clip: "polygon(52% 42%, 48% 0%, 100% 0%)", tx: 18, ty: -10, rot: 12 },
  { clip: "polygon(48% 48%, 0% 0%, 0% 45%)", tx: -14, ty: -4, rot: -8 },
  { clip: "polygon(52% 48%, 100% 0%, 100% 40%)", tx: 16, ty: -2, rot: 9 },
  { clip: "polygon(50% 50%, 0% 55%, 0% 100%)", tx: -12, ty: 10, rot: -6 },
  { clip: "polygon(50% 50%, 100% 60%, 100% 100%)", tx: 14, ty: 12, rot: 11 },
  { clip: "polygon(50% 52%, 15% 100%, 55% 100%)", tx: -6, ty: 16, rot: -10 },
  { clip: "polygon(50% 52%, 45% 100%, 88% 100%)", tx: 10, ty: 15, rot: 8 },
] as const;

function motionReduced(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function EntrarButton() {
  const router = useRouter();
  const navigatingRef = useRef(false);
  const [phase, setPhase] = useState<"idle" | "shatter" | "afterglow">("idle");
  const [shatterKey, setShatterKey] = useState<number | null>(null);

  const handleClick = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      if (navigatingRef.current) return;
      navigatingRef.current = true;

      const reduced = motionReduced();
      const animMs = reduced ? 0 : ENTRAR_GLASS_ANIMATION_MS;
      const postDelay = reduced ? 160 : ENTRAR_POST_ANIMATION_DELAY_MS;

      setPhase("shatter");
      setShatterKey(Date.now());

      window.setTimeout(() => {
        setPhase("afterglow");
      }, animMs);

      window.setTimeout(() => {
        router.push("/login");
      }, animMs + postDelay);
    },
    [router],
  );

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={phase !== "idle"}
      aria-busy={phase !== "idle"}
      aria-label="Entrar no portal"
      style={
        phase === "shatter"
          ? ({ ["--entrar-anim-ms" as string]: `${ENTRAR_GLASS_ANIMATION_MS}ms` } as CSSProperties)
          : undefined
      }
      className={cn(
        "entrar-glass-btn group/entrar justify-self-end relative inline-flex items-center justify-center overflow-hidden rounded-lg",
        "border border-slate-600/55 bg-slate-800/35 px-4 py-1.5",
        "text-sm font-semibold text-slate-200",
        "transition-[transform,border-color,color,box-shadow] duration-200 ease-out",
        "hover:border-fuchsia-500/40 hover:text-white",
        "hover:shadow-[0_0_18px_rgba(168,85,247,0.22)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400/50",
        "disabled:cursor-wait disabled:opacity-95",
        phase === "shatter" && "entrar-glass-btn--shatter",
        phase === "afterglow" && "entrar-glass-btn--afterglow",
      )}
    >
      <span className="relative z-10">Entrar</span>

      {shatterKey && phase === "shatter" ? (
        <span
          key={shatterKey}
          className="pointer-events-none absolute inset-0 z-20"
          aria-hidden
        >
          <span className="entrar-glass-flash absolute inset-0" />

          <svg
            className="entrar-glass-cracks absolute inset-0 h-full w-full"
            viewBox="0 0 120 44"
            preserveAspectRatio="none"
            fill="none"
          >
            <defs>
              <linearGradient id="entrar-crack-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(232,121,249,0.95)" />
                <stop offset="50%" stopColor="rgba(255,71,171,0.85)" />
                <stop offset="100%" stopColor="rgba(168,85,247,0.9)" />
              </linearGradient>
            </defs>
            <path
              className="entrar-crack-line"
              d="M60 22 L8 6 M60 22 L112 10 M60 22 L98 38 M60 22 L22 40 M60 22 L4 24 M60 22 L116 28 M60 22 L44 4 M60 22 L76 42"
              stroke="url(#entrar-crack-grad)"
              strokeWidth="1.1"
              strokeLinecap="round"
            />
            <path
              className="entrar-crack-line entrar-crack-line--delay"
              d="M60 22 L35 12 M60 22 L85 16 M60 22 L52 36 M60 22 L68 8"
              stroke="rgba(244,114,182,0.75)"
              strokeWidth="0.65"
              strokeLinecap="round"
            />
          </svg>

          {GLASS_SHARDS.map((shard, i) => (
            <span
              key={i}
              className="entrar-glass-shard absolute inset-0"
              style={
                {
                  clipPath: shard.clip,
                  ["--shard-tx" as string]: `${shard.tx}px`,
                  ["--shard-ty" as string]: `${shard.ty}px`,
                  ["--shard-rot" as string]: `${shard.rot}deg`,
                  animationDelay: `${i * 45}ms`,
                } as CSSProperties
              }
            />
          ))}
        </span>
      ) : null}
    </button>
  );
}
