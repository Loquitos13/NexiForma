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

/** Origens técnicas gravadas em `Presenca.origem`. */
export type OrigemPresenca =
  | "qr"
  | "manual"
  | "portal"
  | "lms"
  | "zoom"
  | "teams"
  | "meet";

/** Rótulo de UI para a origem da marcação de presença. */
export function labelOrigemPresenca(
  origem: string | null | undefined,
  opts?: { online?: boolean },
): string {
  const o = (origem ?? "manual").toLowerCase();
  if (o === "qr") return "QR Code";
  if (o === "manual") return "Manual";
  if (o === "portal" || o === "lms" || o === "zoom" || o === "teams" || o === "meet") {
    return opts?.online === false ? "Manual" : "Automático";
  }
  return opts?.online ? "Automático" : "Manual";
}

/** Variante de badge para a origem (alinhada com o design system). */
export function origemPresencaBadgeVariant(
  origem: string | null | undefined,
): "green" | "blue" | "default" {
  const o = (origem ?? "manual").toLowerCase();
  if (o === "qr") return "green";
  if (o === "portal" || o === "lms" || o === "zoom" || o === "teams" || o === "meet") return "blue";
  return "default";
}
