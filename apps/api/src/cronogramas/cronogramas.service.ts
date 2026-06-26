import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { Cronograma } from "@nexiforma/database";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "../common/tenant-scope";
import type { CreateCronogramaDto } from "./dto/create-cronograma.dto";

@Injectable()
export class CronogramasService {
  constructor(private readonly prisma: PrismaService) {}

  list(user: RequestUser, acaoFormacaoId?: string) {
    const tenantId = requireTenantId(user);
    return this.prisma.cronograma.findMany({
      where: {
        tenantId,
        ...(acaoFormacaoId ? { acaoFormacaoId } : {}),
      },
      orderBy: [{ acaoFormacaoId: "asc" }, { versao: "desc" }],
      take: 40,
      select: {
        id: true,
        versao: true,
        acaoFormacaoId: true,
        aprovadoEm: true,
        createdAt: true,
        acaoFormacao: {
          select: { codigoInterno: true, titulo: true },
        },
        _count: { select: { sessoes: true } },
      },
    });
  }

  async create(user: RequestUser, dto: CreateCronogramaDto): Promise<Cronograma> {
    const tenantId = requireTenantId(user);

    const acao = await this.prisma.acaoFormacao.findFirst({
      where: { id: dto.acaoFormacaoId, tenantId },
    });
    if (!acao) {
      throw new NotFoundException("Acção de formação inexistente ou de outro tenant.");
    }

    let versao = dto.versao;
    if (versao == null) {
      const agg = await this.prisma.cronograma.aggregate({
        where: { tenantId, acaoFormacaoId: dto.acaoFormacaoId },
        _max: { versao: true },
      });
      versao = (agg._max.versao ?? 0) + 1;
    }

    const clash = await this.prisma.cronograma.findFirst({
      where: { tenantId, acaoFormacaoId: dto.acaoFormacaoId, versao },
    });
    if (clash) {
      throw new ConflictException(`Já existe cronograma versão ${versao} nesta acção.`);
    }

    return this.prisma.cronograma.create({
      data: {
        tenantId,
        acaoFormacaoId: dto.acaoFormacaoId,
        versao,
      },
    });
  }

  async aprovar(user: RequestUser, id: string) {
    const tenantId = requireTenantId(user);
    const cronograma = await this.prisma.cronograma.findFirst({
      where: { id, tenantId },
    });
    if (!cronograma) {
      throw new NotFoundException("Cronograma não encontrado.");
    }
    return this.prisma.cronograma.update({
      where: { id },
      data: {
        aprovadoEm: new Date(),
        aprovadoPor: user.sub,
      },
    });
  }
}
