import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { Turma } from "@nexiforma/database";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "../common/tenant-scope";
import type { CreateTurmaDto } from "./dto/create-turma.dto";

@Injectable()
export class TurmasService {
  constructor(private readonly prisma: PrismaService) {}

  list(user: RequestUser, acaoFormacaoId?: string | undefined) {
    const tenantId = requireTenantId(user);
    return this.prisma.turma.findMany({
      where: {
        tenantId,
        ...(acaoFormacaoId ? { acaoFormacaoId } : {}),
      },
      orderBy: [{ acaoFormacaoId: "asc" }, { codigo: "asc" }],
      take: 160,
      select: {
        id: true,
        codigo: true,
        nome: true,
        acaoFormacaoId: true,
        acaoFormacao: {
          select: { codigoInterno: true, titulo: true },
        },
        _count: { select: { matriculas: true } },
      },
    });
  }

  async create(user: RequestUser, dto: CreateTurmaDto): Promise<Turma> {
    const tenantId = requireTenantId(user);

    const acao = await this.prisma.acaoFormacao.findFirst({
      where: { id: dto.acaoFormacaoId, tenantId },
    });
    if (!acao) {
      throw new NotFoundException("Acção de formação inexistente ou de outro tenant.");
    }

    const codigo = dto.codigo.trim();

    const clash = await this.prisma.turma.findFirst({
      where: {
        tenantId,
        acaoFormacaoId: dto.acaoFormacaoId,
        codigo,
      },
    });
    if (clash) {
      throw new ConflictException("Já existe uma turma com este código nesta acção.");
    }

    return this.prisma.turma.create({
      data: {
        tenantId,
        acaoFormacaoId: dto.acaoFormacaoId,
        codigo,
        nome: dto.nome.trim(),
      },
    });
  }
}
