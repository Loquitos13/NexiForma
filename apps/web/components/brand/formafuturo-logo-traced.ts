/** Logo FormaFuturo - imagem fornecida + perímetro do cristal para energia. */
export const FORMAFUTURO_TRACED_VIEWBOX = { width: 1024, height: 763 } as const;
/** Uma volta completa contínua ao redor do cristal. */
export const FORMAFUTURO_TRACE_DURATION = 2.8;
export const FORMAFUTURO_LOGO_SRC = "/brand/formafuturo-logo.png";
/** Alongamento horizontal do wordmark no hero. */
export const FORMAFUTURO_STRETCH_X = 1.72;

/** Perímetro do cristal azul (para animação de energia). */
export const FORMAFUTURO_HEX_ENERGY_PATHS: string[] = [
  "M 99 8 L 283 8 L 325 116 L 506 212 L 548 540 L 415 756 L 385 752 L 237 672 L 215 588 L 101 584 L 86 564 L 6 324 L 4 276 L 99 8 Z",
];

export const FORMAFUTURO_CRYSTAL_PATH = FORMAFUTURO_HEX_ENERGY_PATHS[0]!;
export const FORMAFUTURO_ENERGY_PATHS: string[] = [...FORMAFUTURO_HEX_ENERGY_PATHS];
export const FORMAFUTURO_OUTLINE_PATH = FORMAFUTURO_HEX_ENERGY_PATHS[0] ?? "";
