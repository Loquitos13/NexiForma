import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "../common/tenant-scope";

@Injectable()
export class AvaliacoesService {
  constructor(private readonly prisma: PrismaService) {}

  list(user: RequestUser, matriculaId: string) {
    const tenantId = requireTenantId(user);
    return this.prisma.avaliacaoFormando.findMany({
      where: { tenantId, matriculaId },
      orderBy: { avaliadoEm: "desc" },
    });
  }

  async create(
    user: RequestUser,
    matriculaId: string,
    data: { tipo?: string; nota?: number; observacoes?: string },
  ) {
    const tenantId = requireTenantId(user);
    const matricula = await this.prisma.matricula.findFirst({ where: { id: matriculaId, tenantId } });
    if (!matricula) throw new NotFoundException("Matrícula não encontrada.");

    return this.prisma.avaliacaoFormando.create({
      data: {
        tenantId,
        matriculaId,
        tipo: data.tipo ?? "final",
        nota: data.nota ?? null,
        observacoes: data.observacoes?.trim() || null,
      },
    });
  }
}
