/**
 * CRM Service – NexiForma Fase 10
 * Gestão de Entidades Cliente (B2B)
 * - CRUD de entidades
 * - Histórico de interações
 * - Pipeline comercial
 */

import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "../common/tenant-scope";

export interface EntidadeClienteDto {
  nif: string;
  nome: string;
  email?: string;
  telefone?: string;
  morada?: string;
  codigoPostal?: string;
  localidade?: string;
  contacto?: {
    nome: string;
    email: string;
    telefone?: string;
  };
}

export interface EntidadeClienteComHistorico {
  id: string;
  nif: string;
  nome: string;
  email?: string | null;
  telefone?: string | null;
  createdAt: string;
  totalPropostas: number;
  proposttasAceitadas: number;
  totalFormandos: number;
  ultimaInteracao?: string;
}

@Injectable()
export class CrmService {
  private readonly logger = new Logger(CrmService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Criar nova entidade cliente
   */
  async criarEntidade(
    user: RequestUser,
    dto: EntidadeClienteDto,
  ): Promise<any> {
    const tenantId = requireTenantId(user);

    // Validar NIF
    if (!this.validarNif(dto.nif)) {
      throw new BadRequestException("NIF inválido.");
    }

    // Verificar duplicado
    const existente = await this.prisma.entidadeCliente.findUnique({
      where: { tenantId_nif: { tenantId, nif: dto.nif } },
    });

    if (existente) {
      throw new ConflictException(
        `Entidade com NIF ${dto.nif} já existe neste tenant.`,
      );
    }

    const entidade = await this.prisma.entidadeCliente.create({
      data: {
        tenantId,
        nif: dto.nif,
        nome: dto.nome,
        email: dto.email,
        telefone: dto.telefone,
      },
    });

    this.logger.log(
      `✓ Entidade cliente criada: ${entidade.nome} (${entidade.nif})`,
    );

    return entidade;
  }

  /**
   * Listar entidades cliente com paginação
   */
  async listarEntidades(
    user: RequestUser,
    filtros?: {
      nome?: string;
      nif?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<{
    total: number;
    entidades: EntidadeClienteComHistorico[];
  }> {
    const tenantId = requireTenantId(user);
    const limit = filtros?.limit ?? 20;
    const offset = filtros?.offset ?? 0;

    const where: any = { tenantId };
    if (filtros?.nome) {
      where.nome = { contains: filtros.nome, mode: "insensitive" };
    }
    if (filtros?.nif) {
      where.nif = filtros.nif;
    }

    const [entidades, total] = await Promise.all([
      this.prisma.entidadeCliente.findMany({
        where,
        include: {
          propostas: true,
          formandos: true,
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      this.prisma.entidadeCliente.count({ where }),
    ]);

    const comHistorico = entidades.map((e) => ({
      id: e.id,
      nif: e.nif,
      nome: e.nome,
      email: e.email,
      telefone: e.telefone,
      createdAt: e.createdAt.toISOString(),
      totalPropostas: e.propostas?.length ?? 0,
      proposttasAceitadas: (e.propostas ?? []).filter(
        (p) => p.estado === "ACEITE",
      ).length,
      totalFormandos: e.formandos?.length ?? 0,
      ultimaInteracao: e.propostas?.[0]?.updatedAt?.toISOString(),
    }));

    return { total, entidades: comHistorico };
  }

  /**
   * Obter detalhes de entidade
   */
  async obterEntidade(user: RequestUser, entidadeId: string): Promise<any> {
    const tenantId = requireTenantId(user);

    const entidade = await this.prisma.entidadeCliente.findFirst({
      where: { id: entidadeId, tenantId },
      include: {
        propostas: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        formandos: {
          select: { id: true, nome: true, nif: true, email: true },
          take: 10,
        },
      },
    });

    if (!entidade) {
      throw new NotFoundException("Entidade não encontrada.");
    }

    return {
      ...entidade,
      createdAt: entidade.createdAt.toISOString(),
      propostas: entidade.propostas.map((p) => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      })),
    };
  }

  /**
   * Atualizar entidade
   */
  async atualizarEntidade(
    user: RequestUser,
    entidadeId: string,
    dto: Partial<EntidadeClienteDto>,
  ): Promise<any> {
    const tenantId = requireTenantId(user);

    const entidade = await this.prisma.entidadeCliente.findFirst({
      where: { id: entidadeId, tenantId },
    });

    if (!entidade) {
      throw new NotFoundException("Entidade não encontrada.");
    }

    const atualizada = await this.prisma.entidadeCliente.update({
      where: { id: entidadeId },
      data: {
        nome: dto.nome ?? entidade.nome,
        email: dto.email ?? entidade.email,
        telefone: dto.telefone ?? entidade.telefone,
      },
    });

    this.logger.log(`✓ Entidade actualizada: ${atualizada.nome}`);

    return atualizada;
  }

  /**
   * Eliminar entidade
   */
  async eliminarEntidade(user: RequestUser, entidadeId: string): Promise<void> {
    const tenantId = requireTenantId(user);

    const entidade = await this.prisma.entidadeCliente.findFirst({
      where: { id: entidadeId, tenantId },
    });

    if (!entidade) {
      throw new NotFoundException("Entidade não encontrada.");
    }

    await this.prisma.entidadeCliente.delete({ where: { id: entidadeId } });

    this.logger.log(`✓ Entidade eliminada: ${entidade.nome}`);
  }

  /**
   * Validar NIF português
   * Fórmula: 9 dígitos, com check digit
   */
  private validarNif(nif: string): boolean {
    nif = nif.replace(/\D/g, "");

    if (nif.length !== 9) return false;

    let soma = 0;
    for (let i = 0; i < 8; i++) {
      soma += parseInt(nif[i]) * (9 - i);
    }

    const checkDigit = 11 - (soma % 11);
    const expectedDigit =
      checkDigit === 10 ? 0 : checkDigit === 11 ? 0 : checkDigit;

    return parseInt(nif[8]) === expectedDigit;
  }

  /**
   * Obter estatísticas de entidades
   */
  async obterEstatisticas(user: RequestUser): Promise<{
    totalEntidades: number;
    entidadesAtivas: number;
    totalFormandos: number;
    totalPropostas: number;
    proposttasAceitadas: number;
    faturacaoTotalCentavos: number;
    faturasEmitidas: number;
    faturasComunicadasAt: number;
    faturasPendentesAt: number;
    valorFaturadoCentavos: number;
    leadsTotal: number;
    leadsAbertos: number;
    leadsConvertidos: number;
    pipelineLeadsCentavos: number;
  }> {
    const tenantId = requireTenantId(user);

    const [
      totalEntidades,
      entidadesComFormandos,
      totalFormandos,
      propostas,
      faturacao,
      faturasPorEstado,
      valorFaturado,
      leadsPorEstado,
      pipelineLeads,
    ] = await Promise.all([
      this.prisma.entidadeCliente.count({ where: { tenantId } }),
      this.prisma.entidadeCliente.count({
        where: {
          tenantId,
          formandos: { some: {} },
        },
      }),
      this.prisma.formandoProfile.count({
        where: {
          tenantId,
          entidadeClienteId: { not: null },
        },
      }),
      this.prisma.propostaComercial.groupBy({
        by: ["estado"],
        where: { tenantId },
        _count: { id: true },
      }),
      this.prisma.propostaComercial.aggregate({
        where: { tenantId, estado: "ACEITE" },
        _sum: { valorCentavos: true },
      }),
      this.prisma.faturaComercial.groupBy({
        by: ["estado"],
        where: { tenantId },
        _count: { id: true },
      }),
      this.prisma.faturaComercial.aggregate({
        where: {
          tenantId,
          estado: { in: ["EMITIDA", "COMUNICADA_AT"] },
        },
        _sum: { valorCentavos: true },
      }),
      this.prisma.leadComercial.groupBy({
        by: ["estado"],
        where: { tenantId },
        _count: { id: true },
      }),
      this.prisma.leadComercial.aggregate({
        where: {
          tenantId,
          estado: { in: ["NOVO", "CONTACTADO", "QUALIFICADO"] },
        },
        _sum: { valorEstimadoCentavos: true },
      }),
    ]);

    const totalPropostas = propostas.reduce((acc, p) => acc + (p._count?.id ?? 0), 0);
    const proposttasAceitadas =
      propostas.find((p) => p.estado === "ACEITE")?._count?.id ?? 0;

    const countEstado = (estado: string) =>
      faturasPorEstado.find((f) => f.estado === estado)?._count?.id ?? 0;

    const faturasEmitidas = countEstado("EMITIDA") + countEstado("COMUNICADA_AT");
    const faturasComunicadasAt = countEstado("COMUNICADA_AT");
    const faturasPendentesAt = countEstado("EMITIDA");

    const leadsTotal = leadsPorEstado.reduce((acc, l) => acc + (l._count?.id ?? 0), 0);
    const countLead = (estado: string) =>
      leadsPorEstado.find((l) => l.estado === estado)?._count?.id ?? 0;
    const leadsConvertidos = countLead("CONVERTIDO");
    const leadsAbertos =
      countLead("NOVO") + countLead("CONTACTADO") + countLead("QUALIFICADO");

    return {
      totalEntidades,
      entidadesAtivas: entidadesComFormandos,
      totalFormandos,
      totalPropostas,
      proposttasAceitadas,
      faturacaoTotalCentavos: faturacao._sum?.valorCentavos ?? 0,
      faturasEmitidas,
      faturasComunicadasAt,
      faturasPendentesAt,
      valorFaturadoCentavos: valorFaturado._sum?.valorCentavos ?? 0,
      leadsTotal,
      leadsAbertos,
      leadsConvertidos,
      pipelineLeadsCentavos: pipelineLeads._sum?.valorEstimadoCentavos ?? 0,
    };
  }
}
