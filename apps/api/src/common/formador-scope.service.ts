import { ForbiddenException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "./tenant-scope";

@Injectable()
export class FormadorScopeService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfileId(user: RequestUser): Promise<string | null> {
    if (user.role !== "formador") return null;
    const tenantId = requireTenantId(user);
    const profile = await this.prisma.formadorProfile.findFirst({
      where: { tenantId, userId: user.sub },
      select: { id: true },
    });
    return profile?.id ?? null;
  }

  /** IDs de acções onde o formador tem pelo menos uma sessão atribuída. `null` = sem filtro (gestor). */
  async assignedAcaoIds(user: RequestUser): Promise<string[] | null> {
    if (user.role === "tenant_manager") return null;
    if (user.role !== "formador") return [];
    const formadorId = await this.getProfileId(user);
    if (!formadorId) return [];

    const tenantId = requireTenantId(user);
    const rows = await this.prisma.acaoFormacao.findMany({
      where: {
        tenantId,
        cronogramas: { some: { sessoes: { some: { formadorId } } } },
      },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  async assignedCursoIds(user: RequestUser): Promise<string[] | null> {
    if (user.role === "tenant_manager") return null;
    if (user.role !== "formador") return [];
    const formadorId = await this.getProfileId(user);
    if (!formadorId) return [];

    const tenantId = requireTenantId(user);
    const rows = await this.prisma.acaoFormacao.findMany({
      where: {
        tenantId,
        cronogramas: { some: { sessoes: { some: { formadorId } } } },
      },
      select: { cursoId: true },
      distinct: ["cursoId"],
    });
    return rows.map((r) => r.cursoId);
  }

  async assertCanAccessAcao(user: RequestUser, acaoId: string): Promise<void> {
    const allowed = await this.assignedAcaoIds(user);
    if (allowed === null) return;
    if (!allowed.includes(acaoId)) {
      throw new ForbiddenException("Não estás atribuído a esta acção de formação.");
    }
  }

  async assertCanEditCurso(user: RequestUser, cursoId: string): Promise<void> {
    const allowed = await this.assignedCursoIds(user);
    if (allowed === null) return;
    if (!allowed.includes(cursoId)) {
      throw new ForbiddenException("Não podes editar conteúdos deste curso.");
    }
  }

  async assertCanAccessSessao(user: RequestUser, sessaoId: string): Promise<void> {
    if (user.role === "tenant_manager") return;
    const tenantId = requireTenantId(user);
    const sessao = await this.prisma.sessaoFormacao.findFirst({
      where: { id: sessaoId, tenantId },
      select: { cronograma: { select: { acaoFormacaoId: true } } },
    });
    if (!sessao) {
      throw new ForbiddenException("Sessão não encontrada.");
    }
    await this.assertCanAccessAcao(user, sessao.cronograma.acaoFormacaoId);
  }
}
