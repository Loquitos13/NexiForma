import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "../common/tenant-scope";

@Injectable()
export class PortalService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(user: RequestUser) {
    const tenantId = requireTenantId(user);

    const [
      cursos,
      acoesPlaneadas,
      acoesCurso,
      formandos,
      turmas,
      sessoesProximas,
    ] = await Promise.all([
      this.prisma.curso.count({ where: { tenantId } }),
      this.prisma.acaoFormacao.count({
        where: { tenantId, estado: "PLANEADA" },
      }),
      this.prisma.acaoFormacao.count({
        where: { tenantId, estado: "EM_CURSO" },
      }),
      this.prisma.formandoProfile.count({ where: { tenantId } }),
      this.prisma.turma.count({ where: { tenantId } }),
      this.prisma.sessaoFormacao.count({
        where: {
          tenantId,
          estado: "AGENDADA",
          data: { gte: new Date(Date.now()) },
        },
      }),
    ]);

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { slug: true, legalName: true, status: true },
    });

    return {
      tenant,
      aggregates: {
        cursos,
        acoesPorEstado: {
          PLANEADA: acoesPlaneadas,
          EM_CURSO: acoesCurso,
        },
        formandos,
        turmas,
        sessoesAgendadasFuturas: sessoesProximas,
      },
      user,
    };
  }
}
