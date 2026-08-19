import { ForbiddenException } from "@nestjs/common";
import type { Prisma } from "@nexiforma/database";
import { isComercial, isTenantManager } from "@nexiforma/shared";
import type { RequestUser } from "../auth/types/access-token-payload";

export function propostaAutoriaWhereInput(
  userId: string,
): Prisma.PropostaComercialWhereInput {
  return {
    OR: [{ criadoPorUserId: userId }, { enviadaPorUserId: userId }],
  };
}

/** Filtro de propostas por comercial; gestor vê todas (undefined). */
export function propostaScopeWhere(
  user: RequestUser,
): Prisma.PropostaComercialWhereInput | undefined {
  if (isTenantManager(user.role)) return undefined;
  if (isComercial(user.role) && user.sub) {
    return propostaAutoriaWhereInput(user.sub);
  }
  return undefined;
}

export function assertContratoAcessivel(
  user: RequestUser,
  row: { criadoPorUserId: string | null },
): void {
  if (!isComercial(user.role)) return;
  if (!user.sub) {
    throw new ForbiddenException("Utilizador inválido.");
  }
  if (row.criadoPorUserId !== user.sub) {
    throw new ForbiddenException("Sem acesso a este contrato.");
  }
}

export function contratoScopeWhere(
  user: RequestUser,
): Prisma.ContratoComercialWhereInput | undefined {
  if (isTenantManager(user.role)) return undefined;
  if (isComercial(user.role) && user.sub) {
    return { criadoPorUserId: user.sub };
  }
  return undefined;
}

export function assertPropostaAcessivel(
  user: RequestUser,
  row: { criadoPorUserId: string | null; enviadaPorUserId: string | null },
): void {
  if (!isComercial(user.role)) return;
  if (!user.sub) {
    throw new ForbiddenException("Utilizador inválido.");
  }
  const own =
    row.criadoPorUserId === user.sub || row.enviadaPorUserId === user.sub;
  if (!own) {
    throw new ForbiddenException("Sem acesso a esta proposta.");
  }
}

export type PropostaListFiltersLike = {
  comercialUserId?: string;
  [key: string]: unknown;
};

/** Comercial vê só as suas propostas; gestor pode filtrar por comercial. */
export function resolvePropostaListFilters<T extends PropostaListFiltersLike>(
  user: RequestUser,
  filters?: T,
): T | undefined {
  if (isComercial(user.role)) {
    const { comercialUserId: _ignored, ...rest } = filters ?? ({} as T);
    if (!user.sub) {
      throw new ForbiddenException("Utilizador inválido.");
    }
    return { ...rest, comercialUserId: user.sub } as T;
  }
  return filters;
}

/** Comercial vê só as suas notas; gestor pode filtrar por autor. */
export function resolveInteraccaoListFilters<T extends { comercialUserId?: string }>(
  user: RequestUser,
  filters?: T,
): T | undefined {
  if (isComercial(user.role)) {
    const { comercialUserId: _ignored, ...rest } = filters ?? ({} as T);
    if (!user.sub) {
      throw new ForbiddenException("Utilizador inválido.");
    }
    return { ...rest, comercialUserId: user.sub } as T;
  }
  return filters;
}

export function interaccaoAutoriaWhereInput(
  userId: string,
): Prisma.InteraccaoComercialWhereInput {
  return {
    OR: [{ criadoPorAutorId: userId }, { criadoPorUserId: userId }],
  };
}

/** Filtro de notas por comercial; gestor vê todas (undefined). */
export function interaccaoScopeWhere(
  user: RequestUser,
): Prisma.InteraccaoComercialWhereInput | undefined {
  if (isTenantManager(user.role)) return undefined;
  if (isComercial(user.role) && user.sub) {
    return interaccaoAutoriaWhereInput(user.sub);
  }
  return undefined;
}

export function assertInteraccaoAcessivel(
  user: RequestUser,
  row: { criadoPorAutorId: string; criadoPorUserId: string | null },
): void {
  if (!isComercial(user.role)) return;
  if (!user.sub) {
    throw new ForbiddenException("Utilizador inválido.");
  }
  const own =
    row.criadoPorAutorId === user.sub || row.criadoPorUserId === user.sub;
  if (!own) {
    throw new ForbiddenException("Sem acesso a esta nota comercial.");
  }
}
