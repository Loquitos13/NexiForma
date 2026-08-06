"use client";

import { useId } from "react";
import type { CSSProperties } from "react";
import { cn } from "@/lib/ui/cn";
import {
  FORMAFUTURO_HEX_ENERGY_PATHS,
  FORMAFUTURO_LOGO_SRC,
  FORMAFUTURO_STRETCH_X,
  FORMAFUTURO_TRACE_DURATION,
  FORMAFUTURO_TRACED_VIEWBOX,
} from "./formafuturo-logo-traced";

type FormaFuturoLogoAnimatedProps = {
  width?: number;
  className?: string;
  loop?: boolean;
};

/** Faísca leve e contínua à volta do cristal. */
const FF_ENERGY = {
  trailColor: "#38BDF8",
  trailOpacity: 0.28,
  trailDash: "14 86",
  beamDash: "10 90",
  headColor: "#F0F9FF",
  headDash: "4 96",
  trailWidth: 5,
  beamWidth: 3,
  headWidth: 1.6,
  trailBlur: 2.5,
  glowBlur: 1.2,
} as const;

/**
 * Logo FormaFuturo (imagem) + energia no cristal
 * no mesmo estilo do vetor NexiForma.
 */
export function FormaFuturoLogoAnimated({
  width = 340,
  className,
  loop = true,
}: FormaFuturoLogoAnimatedProps) {
  const uid = useId().replace(/:/g, "");
  const energyGlow = `ff-hex-glow-${uid}`;
  const energyTrailGlow = `ff-hex-trail-glow-${uid}`;
  const hexGrad = `ff-hex-grad-${uid}`;

  const vb = FORMAFUTURO_TRACED_VIEWBOX;
  const stretchX = FORMAFUTURO_STRETCH_X;
  const height = Math.round((width / stretchX) * (vb.height / vb.width));
  const hexPath = FORMAFUTURO_HEX_ENERGY_PATHS[0]!;

  const cycleStyle = {
    ["--ff-hex-cycle" as string]: `${FORMAFUTURO_TRACE_DURATION}s`,
  } as CSSProperties;

  return (
    <svg
      viewBox={`0 0 ${vb.width} ${vb.height}`}
      width={width}
      height={height}
      preserveAspectRatio="none"
      className={cn("block overflow-visible", className)}
      style={cycleStyle}
      role="img"
      aria-label="FormaFuturo"
    >
      <defs>
        <linearGradient id={hexGrad} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#1D4ED8" stopOpacity={0.15} />
          <stop offset="55%" stopColor="#38BDF8" stopOpacity={0.9} />
          <stop offset="100%" stopColor="#E0F2FE" stopOpacity={1} />
        </linearGradient>
        <filter id={energyTrailGlow} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation={FF_ENERGY.trailBlur} result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={energyGlow} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={FF_ENERGY.glowBlur} result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <image
        href={FORMAFUTURO_LOGO_SRC}
        width={vb.width}
        height={vb.height}
        preserveAspectRatio="none"
      />

      <g className={cn("ff-energy-group", loop && "ff-hex-loop")}>
        <path
          d={hexPath}
          fill="none"
          stroke={FF_ENERGY.trailColor}
          strokeWidth={FF_ENERGY.trailWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={100}
          strokeDasharray={FF_ENERGY.trailDash}
          opacity={FF_ENERGY.trailOpacity}
          className="ff-hex-trail"
          filter={`url(#${energyTrailGlow})`}
        />
        <path
          d={hexPath}
          fill="none"
          stroke={`url(#${hexGrad})`}
          strokeWidth={FF_ENERGY.beamWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={100}
          strokeDasharray={FF_ENERGY.beamDash}
          className="ff-hex-beam"
          filter={`url(#${energyGlow})`}
        />
        <path
          d={hexPath}
          fill="none"
          stroke={FF_ENERGY.headColor}
          strokeWidth={FF_ENERGY.headWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={100}
          strokeDasharray={FF_ENERGY.headDash}
          className="ff-hex-head"
          filter={`url(#${energyGlow})`}
        />
      </g>
    </svg>
  );
}
