import type { Prisma } from "@nexiforma/database";

export type RegistoClienteStatus = "prospecto" | "pendente_completar" | "cliente";

export type RegistoClienteMeta = {
  status: RegistoClienteStatus;
  propostaAceiteId?: string;
  propostaAceiteEm?: string;
  completadoEm?: string;
  completadoPorUserId?: string;
};

type MetadataRecord = Record<string, unknown> | null | undefined;

function asRecord(metadata: Prisma.JsonValue | null | undefined): MetadataRecord {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  return metadata as Record<string, unknown>;
}

export function readRegistoClienteMeta(
  metadata: Prisma.JsonValue | null | undefined,
): RegistoClienteMeta | null {
  const root = asRecord(metadata) ?? {};
  const raw = root.registoCliente;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const status = obj.status;
  if (status !== "prospecto" && status !== "pendente_completar" && status !== "cliente") {
    return null;
  }
  return {
    status,
    propostaAceiteId: typeof obj.propostaAceiteId === "string" ? obj.propostaAceiteId : undefined,
    propostaAceiteEm: typeof obj.propostaAceiteEm === "string" ? obj.propostaAceiteEm : undefined,
    completadoEm: typeof obj.completadoEm === "string" ? obj.completadoEm : undefined,
    completadoPorUserId:
      typeof obj.completadoPorUserId === "string" ? obj.completadoPorUserId : undefined,
  };
}

/** Entidades legadas sem metadata contam como cliente confirmado. */
export function resolveRegistoClienteStatus(
  metadata: Prisma.JsonValue | null | undefined,
): RegistoClienteStatus {
  return readRegistoClienteMeta(metadata)?.status ?? "cliente";
}

export function isEntidadeClienteConfirmada(
  metadata: Prisma.JsonValue | null | undefined,
): boolean {
  return resolveRegistoClienteStatus(metadata) === "cliente";
}

export function mergeRegistoClienteMeta(
  metadata: Prisma.JsonValue | null | undefined,
  patch: Partial<RegistoClienteMeta> & { status: RegistoClienteStatus },
): Prisma.InputJsonValue {
  const root = { ...asRecord(metadata) };
  const prev = readRegistoClienteMeta(metadata) ?? {};
  root.registoCliente = { ...prev, ...patch };
  return root as Prisma.InputJsonValue;
}

export function entidadeRegistoPendenteCompletar(
  metadata: Prisma.JsonValue | null | undefined,
): boolean {
  return resolveRegistoClienteStatus(metadata) === "pendente_completar";
}
