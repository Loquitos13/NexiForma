import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "../common/tenant-scope";
import { parseListPagination, type PaginatedList } from "../common/paginated-list.util";
import type { CreateEntidadeClienteDto, UpdateEntidadeClienteDto } from "./dto/entidade-cliente.dto";
import type { EntidadeClienteResposta } from "./entidade-cliente.types";
import { assertDadosClienteCompletos } from "../faturas/faturacao-dados-legais.util";
import { ViesService } from "../vies/vies.service";
import {
  mergeRegistoClienteMeta,
  resolveRegistoClienteStatus,
} from "../crm/entidade-cliente-registo.util";

@Injectable()
export class EntidadesClienteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vies: ViesService,
  ) {}

  private mapEntidade<T extends { metadata?: unknown }>(
    row: T,
  ): T & { registoStatus: ReturnType<typeof resolveRegistoClienteStatus> } {
    return {
      ...row,
      registoStatus: resolveRegistoClienteStatus(row.metadata as never),
    };
  }

  private filterClientesVisiveis<T extends { metadata?: unknown }>(
    rows: T[],
    opts?: { incluirProspectos?: boolean },
  ): T[] {
    if (opts?.incluirProspectos) return rows;
    return rows.filter((r) => {
      const status = resolveRegistoClienteStatus(r.metadata as never);
      return status !== "prospecto";
    });
  }

  async list(
    user: RequestUser,
    opts?: { parceiro?: boolean; q?: string; page?: string; pageSize?: string; incluirProspectos?: boolean },
  ): Promise<PaginatedList<EntidadeClienteResposta> | EntidadeClienteResposta[]> {
    const tenantId = requireTenantId(user);
    const parceiro = opts?.parceiro;

    if (!opts?.page && !opts?.pageSize && !opts?.q) {
      const rows = await this.prisma.entidadeCliente.findMany({
        where: {
          tenantId,
          ...(parceiro === true ? { isParceiro: true } : parceiro === false ? { isParceiro: false } : {}),
        },
        orderBy: { nome: "asc" },
        include: { _count: { select: { propostas: true } } },
      });
      return this.filterClientesVisiveis(rows, opts).map((r) => this.mapEntidade(r)) as EntidadeClienteResposta[];
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

    const [totalRaw, itemsRaw] = await Promise.all([
      this.prisma.entidadeCliente.count({ where }),
      this.prisma.entidadeCliente.findMany({
        where,
        orderBy: { nome: "asc" },
        skip: pagination.skip,
        take: pagination.take,
        include: { _count: { select: { propostas: true } } },
      }),
    ]);
    const items = this.filterClientesVisiveis(itemsRaw, opts).map((r) => this.mapEntidade(r));
    const total = opts?.incluirProspectos ? totalRaw : items.length;

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
    return this.mapEntidade(row) as EntidadeClienteResposta;
  }

  async listPendenciasRegisto(user: RequestUser) {
    const tenantId = requireTenantId(user);
    const rows = await this.prisma.entidadeCliente.findMany({
      where: { tenantId },
      orderBy: { nome: "asc" },
      select: {
        id: true,
        nome: true,
        nif: true,
        metadata: true,
        email: true,
        telefone: true,
      },
    });
    const pendentes = rows
      .filter((r) => resolveRegistoClienteStatus(r.metadata) === "pendente_completar")
      .map((r) => ({
        id: r.id,
        nome: r.nome,
        nif: r.nif,
        href: `/portal/clientes/${r.id}?tab=dados`,
        itens: [
          ...(r.email ? [] : ["Email de contacto"]),
          ...(r.telefone ? [] : ["Telefone (recomendado)"]),
          "Confirmar morada fiscal e dados de faturação",
        ],
      }));
    return {
      temPendencias: pendentes.length > 0,
      entidades: pendentes,
    };
  }

  async create(user: RequestUser, dto: CreateEntidadeClienteDto): Promise<EntidadeClienteResposta> {
    const tenantId = requireTenantId(user);
    const nif = dto.nif.trim();
    const vies = await this.vies.assertConfirmado(nif, "empresa");
    const nome = dto.nome.trim() || vies.nome?.trim() || "";
    const moradaFiscal =
      dto.moradaFiscal.trim() || vies.morada?.split("\n").join(", ").trim() || "";
    assertDadosClienteCompletos({ nome, nif, moradaFiscal });
    const dup = await this.prisma.entidadeCliente.findFirst({ where: { tenantId, nif } });
    if (dup) {
      throw new ConflictException({
        message: "Já existe um cliente registado com este número de contribuinte (NIF).",
        clienteExistente: {
          id: dup.id,
          nome: dup.nome,
          nif: dup.nif,
        },
      });
    }
    return this.prisma.entidadeCliente.create({
      data: {
        tenantId,
        nif,
        nome,
        moradaFiscal,
        email: dto.email?.trim() || null,
        telefone: dto.telefone?.trim() || null,
        isParceiro: false,
        descontoPercent: null,
        metadata: mergeRegistoClienteMeta(null, { status: "cliente" }),
      },
    }).then((r) => this.mapEntidade(r)) as Promise<EntidadeClienteResposta>;
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
