import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "../common/tenant-scope";
import { parseListPagination, type PaginatedList } from "../common/paginated-list.util";
import type { CreateEntidadeClienteDto, UpdateEntidadeClienteDto } from "./dto/entidade-cliente.dto";
import type { EntidadeClienteResposta } from "./entidade-cliente.types";
import { assertDadosClienteCompletos } from "../faturas/faturacao-dados-legais.util";

@Injectable()
export class EntidadesClienteService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    user: RequestUser,
    opts?: { parceiro?: boolean; q?: string; page?: string; pageSize?: string },
  ): Promise<PaginatedList<EntidadeClienteResposta> | EntidadeClienteResposta[]> {
    const tenantId = requireTenantId(user);
    const parceiro = opts?.parceiro;

    if (!opts?.page && !opts?.pageSize && !opts?.q) {
      return this.prisma.entidadeCliente.findMany({
        where: {
          tenantId,
          ...(parceiro === true ? { isParceiro: true } : parceiro === false ? { isParceiro: false } : {}),
        },
        orderBy: { nome: "asc" },
        include: { _count: { select: { propostas: true } } },
      }) as Promise<EntidadeClienteResposta[]>;
    }

    const pagination = parseListPagination(opts?.page, opts?.pageSize);
    const where: Record<string, unknown> = {
      tenantId,
      ...(parceiro === true ? { isParceiro: true } : parceiro === false ? { isParceiro: false } : {}),
    };
    if (opts?.q?.trim()) {
      const q = opts.q.trim();
      where.OR = [
        { nome: { contains: q, mode: "insensitive" } },
        { nif: { contains: q.replace(/\D/g, "") } },
        { email: { contains: q, mode: "insensitive" } },
      ];
    }

    const [total, items] = await Promise.all([
      this.prisma.entidadeCliente.count({ where }),
      this.prisma.entidadeCliente.findMany({
        where,
        orderBy: { nome: "asc" },
        skip: pagination.skip,
        take: pagination.take,
        include: { _count: { select: { propostas: true } } },
      }),
    ]);

    return {
      items: items as EntidadeClienteResposta[],
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
    };
  }

  async getOne(user: RequestUser, id: string): Promise<EntidadeClienteResposta> {
    const tenantId = requireTenantId(user);
    const row = await this.prisma.entidadeCliente.findFirst({
      where: { id, tenantId },
      include: {
        _count: { select: { propostas: true } },
      },
    });
    if (!row) {
      throw new NotFoundException("Entidade cliente não encontrada.");
    }
    return row as EntidadeClienteResposta;
  }

  async create(user: RequestUser, dto: CreateEntidadeClienteDto): Promise<EntidadeClienteResposta> {
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
        isParceiro: dto.isParceiro ?? false,
        descontoPercent: dto.descontoPercent ?? null,
      },
    }) as Promise<EntidadeClienteResposta>;
  }

  async update(
    user: RequestUser,
    id: string,
    dto: UpdateEntidadeClienteDto,
  ): Promise<EntidadeClienteResposta> {
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
        ...(dto.isParceiro !== undefined ? { isParceiro: dto.isParceiro } : {}),
        ...(dto.descontoPercent !== undefined
          ? { descontoPercent: dto.descontoPercent }
          : {}),
      },
    }) as Promise<EntidadeClienteResposta>;
  }
}
