import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
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

  async remove(user: RequestUser, id: string) {
    const tenantId = requireTenantId(user);
    const turma = await this.prisma.turma.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        codigo: true,
        nome: true,
        acaoFormacaoId: true,
        _count: { select: { matriculas: true, folhasPresenca: true } },
      },
    });
    if (!turma) {
      throw new NotFoundException("Turma não encontrada.");
    }

    // Folhas aprovadas/fechadas: bloquear para não perder evidência DGERT.
    const folhasFechadas = await this.prisma.folhaPresenca.count({
      where: {
        tenantId,
        turmaId: id,
        OR: [
          { fechadaEm: { not: null } },
          { aprovadaGestorEm: { not: null } },
        ],
      },
    });
    if (folhasFechadas > 0) {
      throw new BadRequestException(
        "Não é possível eliminar a turma: existem folhas de presença aprovadas ou fechadas.",
      );
    }

    await this.prisma.turma.delete({ where: { id } });
    return {
      ok: true,
      id: turma.id,
      codigo: turma.codigo,
      nome: turma.nome,
      matriculasRemovidas: turma._count.matriculas,
      folhasRemovidas: turma._count.folhasPresenca,
    };
  }
}
