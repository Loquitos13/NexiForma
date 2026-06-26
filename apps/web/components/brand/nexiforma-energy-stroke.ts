/** Vetor de energia - partilhado entre logo SVG e texto do hero. */
export const NEXIFORM_ENERGY_STROKE = {
  trailColor: "#EC4899",
  trailOpacity: 0.38,
  trailDash: "26 74",
  beamDash: "20 80",
  headColor: "#FFF1F5",
  headDash: "6 94",
  trailBlur: 5,
  glowBlur: 2.2,
  /** Logo NF (paths) - login / nav */
  logo: {
    trailWidth: 12,
    beamWidth: 6,
    headWidth: 3.2,
  },
} as const;

export const NEXIFORM_ENERGY_GRADIENT = {
  x1: "0%",
  y1: "100%",
  x2: "100%",
  y2: "0%",
  stops: [
    { offset: "0%", color: "#BE185D", opacity: 0.15 },
    { offset: "55%", color: "#F472B6", opacity: 0.85 },
    { offset: "100%", color: "#FDF2F8", opacity: 1 },
  ],
} as const;
