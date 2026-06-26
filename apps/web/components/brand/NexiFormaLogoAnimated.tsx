"use client";

import { useId } from "react";
import type { CSSProperties } from "react";
import { cn } from "@/lib/ui/cn";
import {
  NEXIFORM_TRACE_DURATION,
  NEXIFORM_TRACED_LAYERS,
  NEXIFORM_TRACED_VIEWBOX,
} from "./nexiforma-logo-traced";
import {
  NEXIFORM_ENERGY_GRADIENT,
  NEXIFORM_ENERGY_STROKE,
} from "./nexiforma-energy-stroke";

type NexiFormaLogoAnimatedProps = {
  size?: number;
  className?: string;
  variant?: "reveal" | "mark";
  showCard?: boolean;
  splash?: boolean;
  loop?: boolean;
};

function fillForRole(role: "dark" | "mid" | "light", dark: string, mid: string, light: string) {
  if (role === "light") return `url(#${light})`;
  if (role === "mid") return `url(#${mid})`;
  return `url(#${dark})`;
}

/** Logo NF vetorial (traçado do PNG) - contorno rosa → preenchimento. */
export function NexiFormaLogoAnimated({
  size = 40,
  className,
  variant = "reveal",
  showCard = false,
  splash = false,
  loop = false,
}: NexiFormaLogoAnimatedProps) {
  const uid = useId().replace(/:/g, "");
  const darkGrad = `nexi-dark-${uid}`;
  const midGrad = `nexi-mid-${uid}`;
  const lightGrad = `nexi-light-${uid}`;
  const energyGlow = `nexi-energy-glow-${uid}`;
  const energyTrailGlow = `nexi-energy-trail-glow-${uid}`;
  const energyGrad = `nexi-energy-grad-${uid}`;

  const energyStroke = NEXIFORM_ENERGY_STROKE.logo;
  const isReveal = variant === "reveal";
  const cycleStyle = {
    ["--nexi-trace" as string]: `${NEXIFORM_TRACE_DURATION}s`,
    ["--nexi-cycle" as string]: `${NEXIFORM_TRACE_DURATION}s`,
  } as CSSProperties;
  const vb = NEXIFORM_TRACED_VIEWBOX;
  const height = Math.round(size * (vb.height / vb.width));

  const svg = (
    <svg
      viewBox={`0 0 ${vb.width} ${vb.height}`}
      width={size}
      height={height}
      className={cn("block", isReveal && "nexi-neon-svg", className)}
      role="img"
      aria-label="NexiForma NF"
      style={isReveal ? cycleStyle : undefined}
    >
      <defs>
        <linearGradient id={darkGrad} x1="4%" y1="96%" x2="96%" y2="8%">
          <stop offset="0%" stopColor="#1E1B4B" />
          <stop offset="45%" stopColor="#4338CA" />
          <stop offset="100%" stopColor="#6D28D9" />
        </linearGradient>
        <linearGradient id={midGrad} x1="10%" y1="90%" x2="90%" y2="10%">
          <stop offset="0%" stopColor="#5B21B6" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#7C3AED" stopOpacity="0.75" />
        </linearGradient>
        <linearGradient id={lightGrad} x1="8%" y1="88%" x2="92%" y2="8%">
          <stop offset="0%" stopColor="#A78BFA" stopOpacity="0.9" />
          <stop offset="55%" stopColor="#DDD6FE" />
          <stop offset="100%" stopColor="#EDE9FE" stopOpacity="0.95" />
        </linearGradient>
        <linearGradient
          id={energyGrad}
          x1={NEXIFORM_ENERGY_GRADIENT.x1}
          y1={NEXIFORM_ENERGY_GRADIENT.y1}
          x2={NEXIFORM_ENERGY_GRADIENT.x2}
          y2={NEXIFORM_ENERGY_GRADIENT.y2}
        >
          {NEXIFORM_ENERGY_GRADIENT.stops.map((stop) => (
            <stop
              key={stop.offset}
              offset={stop.offset}
              stopColor={stop.color}
              stopOpacity={stop.opacity}
            />
          ))}
        </linearGradient>
        <filter id={energyTrailGlow} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation={NEXIFORM_ENERGY_STROKE.trailBlur} result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={energyGlow} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={NEXIFORM_ENERGY_STROKE.glowBlur} result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {isReveal ? (
        <g className={cn("nexi-logo-reveal", loop && "nexi-logo-reveal--loop")}>
          {NEXIFORM_TRACED_LAYERS.map((layer, i) => (
            <path
              key={`fill-${layer.id}`}
              d={layer.d}
              fill={fillForRole(layer.role, darkGrad, midGrad, lightGrad)}
              className={cn("nexi-fill-traced", `nexi-fill-traced--${i}`)}
            />
          ))}
          {NEXIFORM_TRACED_LAYERS.map((layer, i) => (
            <g key={`energy-${layer.id}`} className="nexi-energy-group">
              <path
                d={layer.d}
                fill="none"
                stroke={NEXIFORM_ENERGY_STROKE.trailColor}
                strokeWidth={energyStroke.trailWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                pathLength={100}
                strokeDasharray={NEXIFORM_ENERGY_STROKE.trailDash}
                opacity={NEXIFORM_ENERGY_STROKE.trailOpacity}
                className={cn("nexi-energy-trail", `nexi-energy-trail--${i}`)}
                filter={`url(#${energyTrailGlow})`}
              />
              <path
                d={layer.d}
                fill="none"
                stroke={`url(#${energyGrad})`}
                strokeWidth={energyStroke.beamWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                pathLength={100}
                strokeDasharray={NEXIFORM_ENERGY_STROKE.beamDash}
                className={cn("nexi-energy-beam", `nexi-energy-beam--${i}`)}
                filter={`url(#${energyGlow})`}
              />
              <path
                d={layer.d}
                fill="none"
                stroke={NEXIFORM_ENERGY_STROKE.headColor}
                strokeWidth={energyStroke.headWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                pathLength={100}
                strokeDasharray={NEXIFORM_ENERGY_STROKE.headDash}
                className={cn("nexi-energy-head", `nexi-energy-head--${i}`)}
                filter={`url(#${energyGlow})`}
              />
            </g>
          ))}
        </g>
      ) : (
        NEXIFORM_TRACED_LAYERS.map((layer) => (
          <path
            key={layer.id}
            d={layer.d}
            fill={fillForRole(layer.role, darkGrad, midGrad, lightGrad)}
          />
        ))
      )}
    </svg>
  );

  if (showCard || splash) {
    const cardPad = Math.max(8, Math.round(size * 0.22));
    return (
      <div
        className={cn(
          splash && "nexi-neon-stage flex min-h-[min(420px,80vw)] w-full items-center justify-center bg-black p-8",
        )}
      >
        <div
          className={cn(
            "nexi-neon-card inline-flex items-center justify-center bg-white",
            isReveal && "nexi-neon-card--reveal",
            loop && "nexi-neon-card--loop",
          )}
          style={{
            padding: cardPad,
            borderRadius: Math.max(12, Math.round(size * 0.18)),
            ...(isReveal ? cycleStyle : {}),
          }}
        >
          {svg}
        </div>
      </div>
    );
  }

  return svg;
}
