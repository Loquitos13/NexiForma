/**
 * Proposal Service – NexiForma Fase 10
 * Gestão de Propostas Comerciais
 * - CRUD de propostas
 * - Ciclo de vida (RASCUNHO → ENVIADA → ACEITE)
 * - Orçamentos e exportação PDF
 */

import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  forwardRef,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { MailService } from "../mail/mail.service";
import { PropostaNotificacoesService } from "../notificacoes/proposta-notificacoes.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "../common/tenant-scope";
import type { PropostaEstado } from "@nexiforma/database";
import { buildPropostaHtmlDocument } from "../propostas/proposta-html.util";
import {
  gerarTokenRespostaProposta,
  validarTokenRespostaProposta,
} from "../propostas/proposta-resposta.util";
import {
  DEFAULTS_PROPOSTA_TEMPLATE,
  configRowToTemplate,
  extractPropostaConteudo,
} from "../propostas/proposta-template.util";
import {
  normalizePropostaLinhas,
  totaisPropostaLinhas,
} from "../propostas/proposta-linhas.util";
import type { PropostaLinhaDto } from "../propostas/dto/proposta-linha.dto";
import { CrmAuditService } from "./crm-audit.service";
import { CrmWebhooksService } from "./crm-webhooks.service";
import { CrmAutomationService } from "./crm-automation.service";

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
  linhas?: PropostaLinhaDto[];
}

@Injectable()
export class ProposalService {
  private readonly logger = new Logger(ProposalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly propostaNotificacoes: PropostaNotificacoesService,
    private readonly config: ConfigService,
    private readonly audit: CrmAuditService,
    private readonly webhooks: CrmWebhooksService,
    @Inject(forwardRef(() => CrmAutomationService))
    private readonly automation: CrmAutomationService,
  ) {}

  private respostaSecret(): string {
    return (
      this.config.get<string>("PROPOSTA_RESPOSTA_SECRET") ??
      this.config.get<string>("JWT_SECRET") ??
      "dev-change-me-at-least-32-characters-long____"
    );
  }

  private expiracaoRespostaProposta(validadeAte: Date | null): Date {
    if (validadeAte) {
      const fim = new Date(validadeAte);
      fim.setHours(23, 59, 59, 999);
      fim.setDate(fim.getDate() + 7);
      return fim;
    }
    const limite = new Date();
    limite.setDate(limite.getDate() + 90);
    return limite;
  }

  private buildLinksRespostaProposta(
    propostaId: string,
    tenantId: string,
    validadeAte: Date | null,
    portalUrl: string,
  ): { aceitarUrl: string; rejeitarUrl: string; token: string } {
    const exp = this.expiracaoRespostaProposta(validadeAte);
    const token = gerarTokenRespostaProposta(
      this.respostaSecret(),
      propostaId,
      tenantId,
      exp,
    );
    const base = `${portalUrl}/proposta/responder?token=${encodeURIComponent(token)}`;
    return {
      token,
      aceitarUrl: `${base}&acao=aceitar`,
      rejeitarUrl: `${base}&acao=rejeitar`,
    };
  }

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

    const linhasNorm = dto.linhas?.length
      ? normalizePropostaLinhas(
          dto.linhas.map((l) => ({
            descricao: l.descricao,
            quantidade: l.quantidade ?? 1,
            precoUnitCentavos: l.precoUnitCentavos,
            taxaIva: l.taxaIva ?? 23,
          })),
        )
      : [];
    const valorCentavos = linhasNorm.length
      ? totaisPropostaLinhas(linhasNorm).valorCentavos
      : dto.valorCentavos;

    const proposta = await this.prisma.propostaComercial.create({
      data: {
        tenantId,
        entidadeClienteId: dto.entidadeClienteId,
        codigo,
        titulo: dto.titulo,
        descricao: dto.descricao,
        valorCentavos,
        moeda: dto.moeda ?? "EUR",
        validadeAte: dto.validadeAte ? new Date(dto.validadeAte) : null,
        cursoId: dto.cursoId,
        notasInternas: dto.notasInternas,
        criadoPorUserId: user.sub,
        ...(linhasNorm.length
          ? {
              linhas: {
                create: linhasNorm.map((l, i) => ({
                  ordem: i + 1,
                  descricao: l.descricao,
                  quantidade: l.quantidade,
                  precoUnitCentavos: l.precoUnitCentavos,
                  taxaIva: l.taxaIva,
                  valorIvaCentavos: l.valorIvaCentavos,
                })),
              },
            }
          : {}),
      },
    });

    this.logger.log(`✓ Proposta criada: ${proposta.codigo}`);

    void this.audit.log({
      user,
      tenantId,
      action: "crm.proposta.created",
      resourceType: "PropostaComercial",
      resourceId: proposta.id,
      payload: { codigo: proposta.codigo },
    });
    void this.webhooks.emit(tenantId, "proposta.created", {
      id: proposta.id,
      codigo: proposta.codigo,
    });

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
        include: {
          entidadeCliente: { select: { id: true, nome: true, nif: true, email: true } },
          curso: { select: { designacao: true } },
          criadoPor: { select: { id: true, displayName: true, email: true } },
          enviadaPor: { select: { id: true, displayName: true, email: true } },
        },
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
        tenant: { select: { legalName: true, nif: true } },
        linhas: { orderBy: { ordem: "asc" } },
      },
    });

    if (!proposta) {
      throw new NotFoundException("Proposta não encontrada.");
    }

    if (proposta.estado === "CANCELADA") {
      throw new BadRequestException(
        "Não é possível enviar uma proposta cancelada.",
      );
    }

    const email = destinatario ?? proposta.entidadeCliente.email;

    if (!email) {
      throw new BadRequestException(
        "Email de destinatário não disponível.",
      );
    }

    const configRow =
      (await this.prisma.configPropostaTenant.findUnique({ where: { tenantId } })) ??
      (await this.prisma.configPropostaTenant.create({
        data: { tenantId, ...DEFAULTS_PROPOSTA_TEMPLATE, validadeDiasPadrao: 30 },
      }));

    const { html, filename } = buildPropostaHtmlDocument({
      codigo: proposta.codigo,
      titulo: proposta.titulo,
      subtitulo: proposta.subtitulo,
      descricao: proposta.descricao,
      moeda: proposta.moeda,
      valorCentavos: proposta.valorCentavos,
      validadeAte: proposta.validadeAte,
      createdAt: proposta.createdAt,
      tenant: proposta.tenant,
      entidadeCliente: {
        nome: proposta.entidadeCliente.nome,
        nif: proposta.entidadeCliente.nif,
        email: proposta.entidadeCliente.email,
      },
      curso: proposta.curso,
      conteudo: extractPropostaConteudo(proposta),
      config: configRowToTemplate(configRow),
      linhas: proposta.linhas.map((l) => ({
        descricao: l.descricao,
        quantidade: Number(l.quantidade),
        precoUnitCentavos: l.precoUnitCentavos,
        taxaIva: Number(l.taxaIva),
        valorIvaCentavos: l.valorIvaCentavos,
      })),
    });

    const totais = proposta.linhas.length
      ? totaisPropostaLinhas(
          proposta.linhas.map((l) => ({
            descricao: l.descricao,
            quantidade: Number(l.quantidade),
            precoUnitCentavos: l.precoUnitCentavos,
            taxaIva: Number(l.taxaIva),
          })),
        )
      : { valorCentavos: proposta.valorCentavos, ivaCentavos: 0 };
    const totalComIva = (totais.valorCentavos + totais.ivaCentavos) / 100;

    // Template email
    const portalUrl = process.env.APP_PUBLIC_URL ?? "https://nexiforma.pt";
    const assunto = `Proposta Comercial – ${proposta.codigo} (NexiForma)`;
    const valorLabel =
      proposta.linhas.length > 0
        ? `Total c/ IVA: €${totalComIva.toFixed(2)} (s/ IVA: €${(totais.valorCentavos / 100).toFixed(2)})`
        : `Valor: €${(proposta.valorCentavos / 100).toFixed(2)}`;

    const links = this.buildLinksRespostaProposta(
      propostaId,
      tenantId,
      proposta.validadeAte,
      portalUrl,
    );

    const texto =
      `Proposta: ${proposta.titulo}\n\n` +
      `Código: ${proposta.codigo}\n` +
      `${valorLabel}\n` +
      `Válida até: ${proposta.validadeAte?.toLocaleDateString("pt-PT") ?? "N/A"}\n\n` +
      (proposta.descricao ? `Descrição:\n${proposta.descricao}\n\n` : "") +
      `Em anexo encontra o documento completo da proposta (${filename}).\n\n` +
      `Para aceitar a proposta:\n${links.aceitarUrl}\n\n` +
      `Para recusar a proposta:\n${links.rejeitarUrl}\n`;

    const htmlBody =
      `<h2>${proposta.titulo}</h2>` +
      `<p><strong>Código:</strong> ${proposta.codigo}</p>` +
      `<p><strong>${proposta.linhas.length ? "Total c/ IVA" : "Valor"}:</strong> €${proposta.linhas.length ? totalComIva.toFixed(2) : (proposta.valorCentavos / 100).toFixed(2)}</p>` +
      (proposta.validadeAte
        ? `<p><strong>Válida até:</strong> ${proposta.validadeAte.toLocaleDateString("pt-PT")}</p>`
        : "") +
      (proposta.descricao ? `<p>${proposta.descricao.replace(/\n/g, "<br>")}</p>` : "") +
      `<p>Em anexo: documento completo da proposta (<strong>${filename}</strong>). Abra no browser e use «Imprimir» para PDF.</p>` +
      `<p style="margin-top:24px">` +
      `<a href="${links.aceitarUrl}" style="display:inline-block;padding:12px 20px;background:#0d9488;color:#fff;text-decoration:none;border-radius:6px;margin-right:12px">Aceitar proposta</a>` +
      `<a href="${links.rejeitarUrl}" style="display:inline-block;padding:12px 20px;background:#64748b;color:#fff;text-decoration:none;border-radius:6px">Recusar proposta</a>` +
      `</p>`;

    await this.mail.send({
      to: email,
      subject: assunto,
      text: texto,
      html: htmlBody,
      attachments: [
        {
          filename,
          content: html,
          contentType: "text/html; charset=utf-8",
        },
      ],
    });

    // Primeiro envio: RASCUNHO → ENVIADA. Reenvios mantêm o estado actual.
    const agora = new Date();
    await this.prisma.propostaComercial.update({
      where: { id: propostaId },
      data: {
        ...(proposta.estado === "RASCUNHO" ? { estado: "ENVIADA" as const } : {}),
        enviadaPorUserId: user.sub,
        enviadaEm: proposta.enviadaEm ?? agora,
      },
    });

    const reenvio = proposta.estado !== "RASCUNHO";
    this.logger.log(
      `✓ Proposta ${reenvio ? "reenviada" : "enviada"}: ${proposta.codigo} → ${email}`,
    );

    if (!reenvio) {
      void this.audit.log({
        user,
        tenantId,
        action: "crm.proposta.sent",
        resourceType: "PropostaComercial",
        resourceId: propostaId,
        payload: { codigo: proposta.codigo, destinatario: email },
      });
      void this.webhooks.emit(tenantId, "proposta.sent", {
        id: propostaId,
        codigo: proposta.codigo,
      });
      void this.automation.onPropostaSent(tenantId, propostaId);
    }

    return {
      sucesso: true,
      message: reenvio
        ? `Proposta reenviada para ${email}`
        : `Proposta enviada para ${email}`,
    };
  }

  /**
   * Pré-visualização pública da proposta (link no email).
   */
  async previewRespostaProposta(token: string) {
    let parsed: { propostaId: string; tenantId: string };
    try {
      parsed = validarTokenRespostaProposta(this.respostaSecret(), token);
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : "Link inválido.",
      );
    }

    const proposta = await this.prisma.propostaComercial.findFirst({
      where: { id: parsed.propostaId, tenantId: parsed.tenantId },
      include: {
        entidadeCliente: { select: { nome: true } },
        tenant: { select: { legalName: true } },
      },
    });

    if (!proposta) {
      throw new NotFoundException("Proposta não encontrada.");
    }

    return {
      codigo: proposta.codigo,
      titulo: proposta.titulo,
      estado: proposta.estado,
      valorCentavos: proposta.valorCentavos,
      moeda: proposta.moeda,
      validadeAte: proposta.validadeAte?.toISOString() ?? null,
      cliente: proposta.entidadeCliente.nome,
      formador: proposta.tenant.legalName,
      jaRespondida: proposta.estado === "ACEITE" || proposta.estado === "REJEITADA",
    };
  }

  /**
   * Resposta do cliente via link no email (aceitar ou recusar).
   */
  async responderPropostaPorToken(
    token: string,
    acao: "aceitar" | "rejeitar",
    motivo?: string,
  ) {
    let parsed: { propostaId: string; tenantId: string };
    try {
      parsed = validarTokenRespostaProposta(this.respostaSecret(), token);
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : "Link inválido.",
      );
    }

    if (acao === "aceitar") {
      return this.finalizarAceite(parsed.tenantId, parsed.propostaId);
    }
    return this.finalizarRejeicao(parsed.tenantId, parsed.propostaId, motivo);
  }

  /** @deprecated Aceite é feito pelo cliente via link no email. */
  async aceitarProposta(user: RequestUser, propostaId: string): Promise<void> {
    const tenantId = requireTenantId(user);
    await this.finalizarAceite(tenantId, propostaId);
  }

  /** @deprecated Recusa é feita pelo cliente via link no email. */
  async rejeitarProposta(
    user: RequestUser,
    propostaId: string,
    motivo?: string,
  ): Promise<void> {
    const tenantId = requireTenantId(user);
    await this.finalizarRejeicao(tenantId, propostaId, motivo);
  }

  private async finalizarAceite(tenantId: string, propostaId: string) {
    const proposta = await this.prisma.propostaComercial.findFirst({
      where: { id: propostaId, tenantId },
    });

    if (!proposta) {
      throw new NotFoundException("Proposta não encontrada.");
    }

    if (proposta.estado === "ACEITE") {
      return { sucesso: true, estado: "ACEITE" as const, already: true };
    }

    if (proposta.estado !== "ENVIADA") {
      throw new BadRequestException(
        "Esta proposta já não está disponível para aceitação.",
      );
    }

    await this.prisma.propostaComercial.update({
      where: { id: propostaId },
      data: {
        estado: "ACEITE",
        aceiteEm: proposta.aceiteEm ?? new Date(),
      },
    });

    await this.converterLeadsAssociados(tenantId, proposta.entidadeClienteId);

    await this.propostaNotificacoes.aoAlterarEstado(
      tenantId,
      propostaId,
      proposta.estado,
      "ACEITE",
    );

    this.logger.log(`✓ Proposta aceite pelo cliente: ${proposta.codigo}`);
    return { sucesso: true, estado: "ACEITE" as const, already: false };
  }

  private async finalizarRejeicao(
    tenantId: string,
    propostaId: string,
    motivo?: string,
  ) {
    const proposta = await this.prisma.propostaComercial.findFirst({
      where: { id: propostaId, tenantId },
    });

    if (!proposta) {
      throw new NotFoundException("Proposta não encontrada.");
    }

    if (proposta.estado === "REJEITADA") {
      return { sucesso: true, estado: "REJEITADA" as const, already: true };
    }

    if (proposta.estado !== "ENVIADA") {
      throw new BadRequestException(
        "Esta proposta já não está disponível para recusa.",
      );
    }

    await this.prisma.propostaComercial.update({
      where: { id: propostaId },
      data: {
        estado: "REJEITADA",
        rejeitadaEm: proposta.rejeitadaEm ?? new Date(),
      },
    });

    await this.propostaNotificacoes.aoAlterarEstado(
      tenantId,
      propostaId,
      proposta.estado,
      "REJEITADA",
      motivo,
    );

    this.logger.log(
      `✓ Proposta recusada pelo cliente: ${proposta.codigo}${motivo ? ` – ${motivo}` : ""}`,
    );
    return { sucesso: true, estado: "REJEITADA" as const, already: false };
  }

  /** Converte leads ligados à entidade quando o cliente aceita a proposta. */
  private async converterLeadsAssociados(
    tenantId: string,
    entidadeClienteId: string,
  ) {
    const entidade = await this.prisma.entidadeCliente.findFirst({
      where: { id: entidadeClienteId, tenantId },
    });
    if (!entidade) return;

    const leads = await this.prisma.leadComercial.findMany({
      where: {
        tenantId,
        estado: { notIn: ["CONVERTIDO", "PERDIDO"] },
        OR: [
          { entidadeClienteId },
          ...(entidade.nif ? [{ nif: entidade.nif.replace(/\D/g, "") }] : []),
        ],
      },
    });

    if (!leads.length) return;

    const agora = new Date();
    await this.prisma.leadComercial.updateMany({
      where: { id: { in: leads.map((l) => l.id) } },
      data: {
        estado: "CONVERTIDO",
        entidadeClienteId: entidade.id,
        nif: entidade.nif,
        convertidoEm: agora,
      },
    });

    this.logger.log(
      `✓ ${leads.length} lead(s) convertido(s) automaticamente após aceite (${entidade.nome})`,
    );
  }
}
