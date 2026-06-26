import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "../common/tenant-scope";

@Injectable()
export class CatalogoUfcdService {
  constructor(private readonly prisma: PrismaService) {}

  search(q?: string, limit = 50) {
    const term = q?.trim();
    return this.prisma.catalogoUfcd.findMany({
      where: term
        ? {
            activo: true,
            OR: [
              { codigo: { contains: term, mode: "insensitive" } },
              { designacao: { contains: term, mode: "insensitive" } },
              { area: { contains: term, mode: "insensitive" } },
            ],
          }
        : { activo: true },
      orderBy: { codigo: "asc" },
      take: Math.min(limit, 200),
    });
  }

  async getOne(codigo: string) {
    const row = await this.prisma.catalogoUfcd.findUnique({ where: { codigo } });
    if (!row || !row.activo) {
      throw new NotFoundException("UFCD não encontrada no catálogo.");
    }
    return row;
  }

  async validateForCurso(user: RequestUser, codigoUfcd: string) {
    const tenantId = requireTenantId(user);
    const ufcd = await this.getOne(codigoUfcd);
    const cursos = await this.prisma.curso.count({
      where: { tenantId, codigoUfcd: ufcd.codigo },
    });
    return {
      valido: true,
      ufcd,
      cursosTenantComCodigo: cursos,
      mensagem: "Código UFCD válido no catálogo DGEEC (referência NexiForma).",
    };
  }

  async validateForSigo(user: RequestUser, acaoId: string) {
    const tenantId = requireTenantId(user);
    const acao = await this.prisma.acaoFormacao.findFirst({
      where: { id: acaoId, tenantId },
      include: { curso: { select: { codigoUfcd: true, designacao: true } } },
    });
    if (!acao) {
      throw new NotFoundException("Acção de formação não encontrada.");
    }
    if (!acao.curso.codigoUfcd) {
      throw new BadRequestException("Curso sem código UFCD – obrigatório para SIGO.");
    }
    const ufcd = await this.getOne(acao.curso.codigoUfcd);
    return {
      acaoId,
      curso: acao.curso.designacao,
      ufcd,
      pronto: true,
    };
  }
}
