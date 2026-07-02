import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { EntidadeCliente } from "@nexiforma/database";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "../common/tenant-scope";
import type { CreateEntidadeClienteDto, UpdateEntidadeClienteDto } from "./dto/entidade-cliente.dto";
import { assertDadosClienteCompletos } from "../faturas/faturacao-dados-legais.util";

@Injectable()
export class EntidadesClienteService {
  constructor(private readonly prisma: PrismaService) {}

  list(user: RequestUser) {
    const tenantId = requireTenantId(user);
    return this.prisma.entidadeCliente.findMany({
      where: { tenantId },
      orderBy: { nome: "asc" },
      include: {
        _count: { select: { formandos: true, propostas: true } },
      },
    });
  }

  async getOne(user: RequestUser, id: string): Promise<EntidadeCliente> {
    const tenantId = requireTenantId(user);
    const row = await this.prisma.entidadeCliente.findFirst({
      where: { id, tenantId },
      include: {
        _count: { select: { formandos: true, propostas: true } },
      },
    });
    if (!row) {
      throw new NotFoundException("Entidade cliente não encontrada.");
    }
    return row;
  }

  async create(user: RequestUser, dto: CreateEntidadeClienteDto): Promise<EntidadeCliente> {
    const tenantId = requireTenantId(user);
    const nif = dto.nif.trim();
    const dup = await this.prisma.entidadeCliente.findFirst({ where: { tenantId, nif } });
    if (dup) {
      throw new ConflictException("Já existe entidade cliente com este NIF.");
    }
    return this.prisma.entidadeCliente.create({
      data: {
        tenantId,
        nif,
        nome: dto.nome.trim(),
        moradaFiscal: dto.moradaFiscal.trim(),
        email: dto.email?.trim() || null,
        telefone: dto.telefone?.trim() || null,
      },
    });
  }

  async update(user: RequestUser, id: string, dto: UpdateEntidadeClienteDto): Promise<EntidadeCliente> {
    const tenantId = requireTenantId(user);
    const existing = await this.prisma.entidadeCliente.findFirst({ where: { id, tenantId } });
    if (!existing) {
      throw new NotFoundException("Entidade cliente não encontrada.");
    }
    const nextMorada =
      dto.moradaFiscal !== undefined ? dto.moradaFiscal.trim() : existing.moradaFiscal;
    const nextNome = dto.nome?.trim() ?? existing.nome;
    assertDadosClienteCompletos({
      nome: nextNome,
      nif: existing.nif,
      moradaFiscal: nextMorada,
    });

    return this.prisma.entidadeCliente.update({
      where: { id },
      data: {
        nome: nextNome,
        moradaFiscal: nextMorada,
        email: dto.email !== undefined ? dto.email?.trim() || null : existing.email,
        telefone: dto.telefone !== undefined ? dto.telefone?.trim() || null : existing.telefone,
      },
    });
  }
}
