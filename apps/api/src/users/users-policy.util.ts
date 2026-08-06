import {
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import type { User } from "@nexiforma/database";
import type { PrismaService } from "../prisma/prisma.service";
import type { UpdateUserDto } from "./dto/users.dto";
import { isTenantManagerPrismaRole } from "./users-guards.util";

export function forbiddenSelfDeactivate(): ForbiddenException {
  return new ForbiddenException("Não podes desactivar a tua própria conta.");
}

export function forbiddenSelfRemove(): ForbiddenException {
  return new ForbiddenException("Não podes eliminar a tua própria conta.");
}

export async function assertUserLimit(prisma: PrismaService, tenantId: string): Promise<void> {
  const sub = await prisma.tenantSubscription.findFirst({
    where: { tenantId, status: { in: ["ACTIVE", "TRIALING"] } },
    include: { plan: true },
    orderBy: { createdAt: "desc" },
  });
  const max = sub?.plan.maxActiveUsers;
  if (max == null) return;

  const activeCount = await prisma.user.count({
    where: { tenantId, active: true },
  });
  if (activeCount >= max) {
    throw new ForbiddenException(
      `Limite de ${max} utilizadores activos do plano atingido. Actualiza a subscrição.`,
    );
  }
}

export async function assertManagerSafety(
  prisma: PrismaService,
  tenantId: string,
  existing: { id: string; role: User["role"]; active: boolean },
  dto: UpdateUserDto,
): Promise<void> {
  const wasManager = isTenantManagerPrismaRole(existing.role);
  const willBeManager =
    dto.role !== undefined ? isTenantManagerPrismaRole(dto.role) : wasManager;
  const willBeActive = dto.active !== undefined ? dto.active : existing.active;

  const removesManager =
    wasManager &&
    existing.active &&
    (!willBeActive || (dto.role !== undefined && !willBeManager));

  if (!removesManager) return;

  const otherManagers = await prisma.user.count({
    where: {
      tenantId,
      active: true,
      id: { not: existing.id },
      role: { in: ["ADMIN", "COORDENADOR_PEDAGOGICO", "COORDENADOR_COMERCIAL", "COORDENADOR_FINANCEIRO", "COORDENADOR", "FINANCEIRO"] },
    },
  });

  if (otherManagers === 0) {
    throw new BadRequestException(
      "Não podes remover o último gestor activo da entidade.",
    );
  }
}
