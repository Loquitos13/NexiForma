import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Sumario } from "@nexiforma/database";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "../common/tenant-scope";
import type { CreateSumarioDto } from "./dto/create-sumario.dto";
import type { UpdateSumarioDto } from "./dto/update-sumario.dto";

@Injectable()
export class SumariosService {
  constructor(private readonly prisma: PrismaService) {}

  listBySessao(user: RequestUser, sessaoId: string) {
    const tenantId = requireTenantId(user);
    return this.prisma.sumario.findMany({
      where: { tenantId, sessaoId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        conteudo: true,
        assinadoEm: true,
        assinaturaRef: true,
        assinaturaTipo: true,
        imutavel: true,
        createdAt: true,
      },
    });
  }

  async create(
    user: RequestUser,
    sessaoId: string,
    dto: CreateSumarioDto,
  ): Promise<Sumario> {
    const tenantId = requireTenantId(user);

    const sessao = await this.prisma.sessaoFormacao.findFirst({
      where: { id: sessaoId, tenantId },
    });
    if (!sessao) {
      throw new NotFoundException("Sessão inexistente ou de outro tenant.");
    }

    const bloqueado = await this.prisma.sumario.findFirst({
      where: { tenantId, sessaoId, imutavel: true },
    });
    if (bloqueado) {
      throw new ConflictException(
        "Esta sessão já tem sumário assinado (imutável). Cria nova versão só após revogação futura.",
      );
    }

    return this.prisma.sumario.create({
      data: {
        tenantId,
        sessaoId,
        conteudo: dto.conteudo.trim(),
      },
    });
  }

  async update(
    user: RequestUser,
    id: string,
    dto: UpdateSumarioDto,
  ): Promise<Sumario> {
    const tenantId = requireTenantId(user);
    const row = await this.prisma.sumario.findFirst({
      where: { id, tenantId },
    });
    if (!row) {
      throw new NotFoundException("Sumário não encontrado.");
    }
    if (row.imutavel) {
      throw new ConflictException("Sumário assinado – não editável.");
    }

    return this.prisma.sumario.update({
      where: { id },
      data: { conteudo: dto.conteudo.trim() },
    });
  }

  async assinar(user: RequestUser, id: string): Promise<Sumario> {
    const tenantId = requireTenantId(user);
    const row = await this.prisma.sumario.findFirst({
      where: { id, tenantId },
    });
    if (!row) {
      throw new NotFoundException("Sumário não encontrado.");
    }
    if (row.imutavel) {
      throw new ConflictException("Sumário já assinado.");
    }

    return this.prisma.sumario.update({
      where: { id },
      data: {
        imutavel: true,
        assinadoEm: new Date(),
        assinaturaTipo: "interna",
        assinaturaRef: user.sub,
      },
    });
  }
}
