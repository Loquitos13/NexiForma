/**
 * Proposal Service – NexiForma Fase 10
 * Gestão de Propostas Comerciais
 * - CRUD de propostas
 * - Ciclo de vida (RASCUNHO → ENVIADA → ACEITE)
 * - Orçamentos e exportação PDF
 */

import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { MailService } from "../mail/mail.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "../common/tenant-scope";
import type { PropostaEstado } from "@nexiforma/database";

export interface PropostaComercialDto {
  entidadeClienteId: string;
  codigo?: string; // Auto-gerado se omitido
  titulo: string;
  descricao?: string;
  valorCentavos: number;
  moeda?: string; // EUR
  validadeAte?: string; // ISO date
  cursoId?: string;
  notasInternas?: string;
}

@Injectable()
export class ProposalService {
  private readonly logger = new Logger(ProposalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  /**
   * Criar nova proposta
   */
  async criarProposta(
    user: RequestUser,
    dto: PropostaComercialDto,
  ): Promise<any> {
    const tenantId = requireTenantId(user);

    // Verificar entidade existe
    const entidade = await this.prisma.entidadeCliente.findFirst({
      where: { id: dto.entidadeClienteId, tenantId },
    });

    if (!entidade) {
      throw new NotFoundException(
        "Entidade cliente não encontrada.",
      );
    }

    // Gerar código se não fornecido
    const codigo =
      dto.codigo ?? `PROP-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    // Verificar curso se fornecido
    if (dto.cursoId) {
      const curso = await this.prisma.curso.findFirst({
        where: { id: dto.cursoId, tenantId },
      });
      if (!curso) {
        throw new NotFoundException("Curso não encontrado.");
      }
    }

    const proposta = await this.prisma.propostaComercial.create({
      data: {
        tenantId,
        entidadeClienteId: dto.entidadeClienteId,
        codigo,
        titulo: dto.titulo,
        descricao: dto.descricao,
        valorCentavos: dto.valorCentavos,
        moeda: dto.moeda ?? "EUR",
        validadeAte: dto.validadeAte ? new Date(dto.validadeAte) : null,
        cursoId: dto.cursoId,
        notasInternas: dto.notasInternas,
      },
    });

    this.logger.log(`✓ Proposta criada: ${proposta.codigo}`);

    return proposta;
  }

  /**
   * Listar propostas de uma entidade
   */
  async listarPropostas(
    user: RequestUser,
    entidadeClienteId: string,
    filtros?: {
      estado?: PropostaEstado;
      limit?: number;
      offset?: number;
    },
  ): Promise<{ total: number; propostas: any[] }> {
    const tenantId = requireTenantId(user);

    const where: any = {
      tenantId,
      entidadeClienteId,
    };

    if (filtros?.estado) {
      where.estado = filtros.estado;
    }

    const limit = filtros?.limit ?? 20;
    const offset = filtros?.offset ?? 0;

    const [propostas, total] = await Promise.all([
      this.prisma.propostaComercial.findMany({
        where,
        include: { curso: { select: { designacao: true } } },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      this.prisma.propostaComercial.count({ where }),
    ]);

    return {
      total,
      propostas: propostas.map((p) => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
        valor: `${(p.valorCentavos / 100).toFixed(2)} ${p.moeda}`,
      })),
    };
  }

  /**
   * Obter detalhes de proposta
   */
  async obterProposta(user: RequestUser, propostaId: string): Promise<any> {
    const tenantId = requireTenantId(user);

    const proposta = await this.prisma.propostaComercial.findFirst({
      where: { id: propostaId, tenantId },
      include: {
        entidadeCliente: true,
        curso: true,
      },
    });

    if (!proposta) {
      throw new NotFoundException("Proposta não encontrada.");
    }

    return {
      ...proposta,
      createdAt: proposta.createdAt.toISOString(),
      updatedAt: proposta.updatedAt.toISOString(),
      valor: `${(proposta.valorCentavos / 100).toFixed(2)} ${proposta.moeda}`,
    };
  }

  /**
   * Atualizar proposta (apenas se não enviada)
   */
  async atualizarProposta(
    user: RequestUser,
    propostaId: string,
    dto: Partial<PropostaComercialDto>,
  ): Promise<any> {
    const tenantId = requireTenantId(user);

    const proposta = await this.prisma.propostaComercial.findFirst({
      where: { id: propostaId, tenantId },
    });

    if (!proposta) {
      throw new NotFoundException("Proposta não encontrada.");
    }

    if (proposta.estado !== "RASCUNHO") {
      throw new ForbiddenException(
        `Não é possível editar proposta em estado ${proposta.estado}.`,
      );
    }

    const atualizada = await this.prisma.propostaComercial.update({
      where: { id: propostaId },
      data: {
        titulo: dto.titulo ?? proposta.titulo,
        descricao: dto.descricao ?? proposta.descricao,
        valorCentavos: dto.valorCentavos ?? proposta.valorCentavos,
        notasInternas: dto.notasInternas ?? proposta.notasInternas,
      },
    });

    this.logger.log(`✓ Proposta actualizada: ${atualizada.codigo}`);

    return atualizada;
  }

  /**
   * Enviar proposta por email
   */
  async enviarProposta(
    user: RequestUser,
    propostaId: string,
    destinatario?: string,
  ): Promise<{
    sucesso: boolean;
    message: string;
  }> {
    const tenantId = requireTenantId(user);

    const proposta = await this.prisma.propostaComercial.findFirst({
      where: { id: propostaId, tenantId },
      include: {
        entidadeCliente: true,
        curso: true,
      },
    });

    if (!proposta) {
      throw new NotFoundException("Proposta não encontrada.");
    }

    const email = destinatario ?? proposta.entidadeCliente.email;

    if (!email) {
      throw new BadRequestException(
        "Email de destinatário não disponível.",
      );
    }

    // Template email
    const portalUrl = "https://nexiforma.pt"; // TODO: CONFIG
    const assunto = `Proposta Comercial – ${proposta.codigo} (NexiForma)`;
    const texto =
      `Proposta: ${proposta.titulo}\n\n` +
      `Código: ${proposta.codigo}\n` +
      `Valor: €${(proposta.valorCentavos / 100).toFixed(2)}\n` +
      `Válida até: ${proposta.validadeAte?.toLocaleDateString("pt-PT") ?? "N/A"}\n\n` +
      (proposta.descricao ? `Descrição:\n${proposta.descricao}\n\n` : "") +
      `Consulta a proposta no portal: ${portalUrl}/propostas/${proposta.id}`;

    const html =
      `<h2>${proposta.titulo}</h2>` +
      `<p><strong>Código:</strong> ${proposta.codigo}</p>` +
      `<p><strong>Valor:</strong> €${(proposta.valorCentavos / 100).toFixed(2)}</p>` +
      (proposta.validadeAte
        ? `<p><strong>Válida até:</strong> ${proposta.validadeAte.toLocaleDateString("pt-PT")}</p>`
        : "") +
      (proposta.descricao ? `<p>${proposta.descricao.replace(/\n/g, "<br>")}</p>` : "") +
      `<p><a href="${portalUrl}/propostas/${proposta.id}">Ver proposta</a></p>`;

    await this.mail.send({
      to: email,
      subject: assunto,
      text: texto,
      html,
    });

    // Atualizar estado
    await this.prisma.propostaComercial.update({
      where: { id: propostaId },
      data: { estado: "ENVIADA" },
    });

    this.logger.log(
      `✓ Proposta enviada: ${proposta.codigo} → ${email}`,
    );

    return {
      sucesso: true,
      message: `Proposta enviada para ${email}`,
    };
  }

  /**
   * Aceitar proposta (por admin/coordenador)
   */
  async aceitarProposta(user: RequestUser, propostaId: string): Promise<void> {
    const tenantId = requireTenantId(user);

    const proposta = await this.prisma.propostaComercial.findFirst({
      where: { id: propostaId, tenantId },
    });

    if (!proposta) {
      throw new NotFoundException("Proposta não encontrada.");
    }

    if (proposta.estado === "ACEITE") {
      this.logger.log(`Proposta ${propostaId} já estava aceite.`);
      return;
    }

    await this.prisma.propostaComercial.update({
      where: { id: propostaId },
      data: { estado: "ACEITE" },
    });

    this.logger.log(`✓ Proposta aceite: ${proposta.codigo}`);
  }

  /**
   * Rejeitar proposta
   */
  async rejeitarProposta(
    user: RequestUser,
    propostaId: string,
    motivo?: string,
  ): Promise<void> {
    const tenantId = requireTenantId(user);

    const proposta = await this.prisma.propostaComercial.findFirst({
      where: { id: propostaId, tenantId },
    });

    if (!proposta) {
      throw new NotFoundException("Proposta não encontrada.");
    }

    await this.prisma.propostaComercial.update({
      where: { id: propostaId },
      data: { estado: "REJEITADA" },
    });

    this.logger.log(
      `✓ Proposta rejeitada: ${proposta.codigo}${motivo ? ` – ${motivo}` : ""}`,
    );
  }
}
