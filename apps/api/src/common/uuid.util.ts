import { BadRequestException } from "@nestjs/common";

/** UUID v1–v5 (validação estrita para parâmetros de BD / RLS). */
export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_RE.test(value.trim());
}

export function assertValidUuid(value: string | null | undefined, label = "id"): string {
  const trimmed = value?.trim();
  if (!trimmed || !UUID_RE.test(trimmed)) {
    throw new BadRequestException(`${label} inválido.`);
  }
  return trimmed;
}
