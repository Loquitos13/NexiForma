/** Estados de assiduidade registados na folha de presença (portal). */
export const ESTADOS_PRESENCA = [
  "PRESENTE",
  "FALTA_JUSTIFICADA",
  "FALTA_INJUSTIFICADA",
] as const;

export type EstadoPresenca = (typeof ESTADOS_PRESENCA)[number];

export const ESTADO_PRESENCA_LABELS: Record<EstadoPresenca, string> = {
  PRESENTE: "Presente",
  FALTA_JUSTIFICADA: "Falta justificada",
  FALTA_INJUSTIFICADA: "Falta injustificada",
};

export function isEstadoPresenca(value: string | null | undefined): value is EstadoPresenca {
  return typeof value === "string" && (ESTADOS_PRESENCA as readonly string[]).includes(value);
}

export function presenteFromEstado(estado: EstadoPresenca): boolean {
  return estado === "PRESENTE";
}

export function estadoPresencaCsvLabel(estado: EstadoPresenca): string {
  return ESTADO_PRESENCA_LABELS[estado];
}

export function labelEstadoPresencaOuPorAssinalar(estado: string | null | undefined): string {
  if (!estado || !isEstadoPresenca(estado)) return "Por assinalar";
  return ESTADO_PRESENCA_LABELS[estado];
}
