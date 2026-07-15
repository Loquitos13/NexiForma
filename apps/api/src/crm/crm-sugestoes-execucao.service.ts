import { Inject, Injectable, Logger, forwardRef } from "@nestjs/common";
import type { SugestaoIaTipo } from "@nexiforma/database";
import type { CrmSugestaoAcaoExecutavel, CrmSugestaoExecucao } from "@nexiforma/shared";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "../common/tenant-scope";
import { ProposalService } from "./proposal.service";

type SugestaoRow = {
  id: string;
  tipo: SugestaoIaTipo;
  titulo: string;
  descricao: string;
  entidadeClienteId: string | null;
  leadComercialId: string | null;
  metadata: unknown;
};

@Injectable()
export class CrmSugestoesExecucaoService {
  private readonly logger = new Logger(CrmSugestoesExecucaoService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ProposalService))
    private readonly proposal: ProposalService,
  ) {}

  async executar(
    user: RequestUser,
    row: SugestaoRow,
    leadId: string | null,
  ): Promise<CrmSugestaoExecucao> {
    const tenantId = requireTenantId(user);
    const acao = this.resolverAcao(row);
    const meta = this.asMeta(row.metadata);
    const executadoEm = new Date().toISOString();

    try {
      switch (acao) {
        case "ENVIAR_PROPOSTA":
          return await this.enviarProposta(user, tenantId, row, meta, acao, executadoEm);
        case "ACOMPANHAR_PROPOSTA":
          return await this.acompanharProposta(user, tenantId, row, meta, acao, executadoEm);
        case "CRIAR_PROPOSTA":
          return await this.criarProposta(user, tenantId, row, meta, leadId, acao, executadoEm);
        case "REGISTAR_FOLLOW_UP":
          return await this.registarFollowUp(user, tenantId, row, leadId, acao, executadoEm);
        case "REGISTAR_LEAD":
          return await this.confirmarLead(tenantId, leadId, acao, executadoEm);
        default:
          return {
            sucesso: true,
            acao,
            mensagem: "Sugestão registada na pipeline comercial.",
            executadoEm,
          };
      }
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : "Erro desconhecido na execução.";
      this.logger.warn(`Execução sugestão ${row.id} (${acao}): ${mensagem}`);
      return { sucesso: false, acao, mensagem, executadoEm };
    }
  }

  private resolverAcao(row: SugestaoRow): CrmSugestaoAcaoExecutavel {
    const meta = this.asMeta(row.metadata);
    if (meta.acao && this.isAcao(meta.acao)) return meta.acao;

    if (meta.propostaCodigo) {
      if (/^Enviar proposta/i.test(row.titulo)) return "ENVIAR_PROPOSTA";
      if (/^Acompanhar proposta/i.test(row.titulo)) return "ACOMPANHAR_PROPOSTA";
    }
    if (meta.leadCodigo || /criar proposta/i.test(row.titulo)) return "CRIAR_PROPOSTA";
    if (/^Preparar|^Proposta de formação|^Renovação|^Nova abordagem|^Iniciar relacionamento/i.test(row.titulo)) {
      return meta.interaccaoRecente || /retomar contacto/i.test(row.titulo)
        ? "REGISTAR_FOLLOW_UP"
        : "CRIAR_PROPOSTA";
    }

    switch (row.tipo) {
      case "FOLLOW_UP":
        return "REGISTAR_FOLLOW_UP";
      case "UPSELL":
      case "CROSS_SELL":
      case "RENOVACAO":
        return "CRIAR_PROPOSTA";
      case "NOVO_LEAD":
        return "REGISTAR_LEAD";
      default:
        return "REGISTAR_FOLLOW_UP";
    }
  }

  private isAcao(v: unknown): v is CrmSugestaoAcaoExecutavel {
    return (
      v === "ENVIAR_PROPOSTA" ||
      v === "ACOMPANHAR_PROPOSTA" ||
      v === "CRIAR_PROPOSTA" ||
      v === "REGISTAR_FOLLOW_UP" ||
      v === "REGISTAR_LEAD"
    );
  }

  private asMeta(metadata: unknown): Record<string, unknown> {
    return metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {};
  }

  private async enviarProposta(
    user: RequestUser,
    tenantId: string,
    row: SugestaoRow,
    meta: Record<string, unknown>,
    acao: CrmSugestaoAcaoExecutavel,
    executadoEm: string,
  ): Promise<CrmSugestaoExecucao> {
    const codigo = String(meta.propostaCodigo ?? "");
    const proposta = await this.findProposta(tenantId, row.entidadeClienteId, codigo);
    if (!proposta) {
      return {
        sucesso: false,
        acao,
        mensagem: codigo ? `Proposta ${codigo} não encontrada.` : "Proposta não identificada.",
        executadoEm,
      };
    }
    if (proposta.estado !== "RASCUNHO") {
      return {
        sucesso: false,
        acao,
        mensagem: `Proposta ${proposta.codigo} não está em rascunho (${proposta.estado}).`,
        propostaId: proposta.id,
        propostaCodigo: proposta.codigo,
        executadoEm,
      };
    }

    const result = await this.proposal.enviarProposta(user, proposta.id);
    return {
      sucesso: result.sucesso,
      acao,
      mensagem: result.message,
      propostaId: proposta.id,
      propostaCodigo: proposta.codigo,
      executadoEm,
    };
  }

  private async acompanharProposta(
    user: RequestUser,
    tenantId: string,
    row: SugestaoRow,
    meta: Record<string, unknown>,
    acao: CrmSugestaoAcaoExecutavel,
    executadoEm: string,
  ): Promise<CrmSugestaoExecucao> {
    const codigo = String(meta.propostaCodigo ?? "");
    const proposta = await this.findProposta(tenantId, row.entidadeClienteId, codigo);
    if (!proposta) {
      return {
        sucesso: false,
        acao,
        mensagem: codigo ? `Proposta ${codigo} não encontrada.` : "Proposta não identificada.",
        executadoEm,
      };
    }
    if (proposta.estado !== "ENVIADA") {
      return {
        sucesso: false,
        acao,
        mensagem: `Proposta ${proposta.codigo} não está aguardando resposta (${proposta.estado}).`,
        propostaId: proposta.id,
        propostaCodigo: proposta.codigo,
        executadoEm,
      };
    }

    const result = await this.proposal.enviarProposta(user, proposta.id);
    return {
      sucesso: result.sucesso,
      acao,
      mensagem: result.message,
      propostaId: proposta.id,
      propostaCodigo: proposta.codigo,
      executadoEm,
    };
  }

  private async criarProposta(
    user: RequestUser,
    tenantId: string,
    row: SugestaoRow,
    meta: Record<string, unknown>,
    leadId: string | null,
    acao: CrmSugestaoAcaoExecutavel,
    executadoEm: string,
  ): Promise<CrmSugestaoExecucao> {
    const entidadeId = await this.resolverEntidadeId(tenantId, row, meta, leadId);
    if (!entidadeId) {
      return {
        sucesso: false,
        acao,
        mensagem: "Cliente não identificado para criar a proposta.",
        executadoEm,
      };
    }

    const lead = leadId
      ? await this.prisma.leadComercial.findFirst({ where: { id: leadId, tenantId } })
      : null;

    const titulo = this.tituloProposta(row);
    const proposta = await this.proposal.criarProposta(user, {
      entidadeClienteId: entidadeId,
      titulo,
      valorCentavos: lead?.valorEstimadoCentavos ?? 0,
      notasInternas: `[Sugestão IA aceite]\n${row.descricao}`,
    });

    if (lead && lead.estado === "NOVO") {
      await this.prisma.leadComercial.update({
        where: { id: lead.id },
        data: { estado: "QUALIFICADO" },
      });
    }

    return {
      sucesso: true,
      acao,
      mensagem: `Proposta ${proposta.codigo} criada em rascunho.`,
      propostaId: proposta.id,
      propostaCodigo: proposta.codigo,
      executadoEm,
    };
  }

  private async registarFollowUp(
    user: RequestUser,
    tenantId: string,
    row: SugestaoRow,
    leadId: string | null,
    acao: CrmSugestaoAcaoExecutavel,
    executadoEm: string,
  ): Promise<CrmSugestaoExecucao> {
    if (!user.sub) {
      return { sucesso: false, acao, mensagem: "Utilizador inválido.", executadoEm };
    }

    const interaccao = await this.prisma.interaccaoComercial.create({
      data: {
        tenantId,
        tipo: "TELEFONE",
        titulo: row.titulo.slice(0, 200),
        proximoPassoNota: row.descricao,
        notasLivres: `[Execução automática · sugestão IA aceite]\n${row.descricao}`,
        entidadeClienteId: row.entidadeClienteId,
        leadComercialId: leadId ?? row.leadComercialId,
        criadoPorUserId: user.sub,
        processamentoEstado: "PROCESSADO",
        resumoIa: row.descricao.slice(0, 500),
        processadoEm: new Date(),
      },
    });

    if (leadId) {
      const lead = await this.prisma.leadComercial.findFirst({ where: { id: leadId, tenantId } });
      if (lead && lead.estado === "NOVO") {
        await this.prisma.leadComercial.update({
          where: { id: leadId },
          data: { estado: "CONTACTADO" },
        });
      }
    }

    return {
      sucesso: true,
      acao,
      mensagem: "Follow-up comercial registado nas notas.",
      interaccaoId: interaccao.id,
      executadoEm,
    };
  }

  private async confirmarLead(
    tenantId: string,
    leadId: string | null,
    acao: CrmSugestaoAcaoExecutavel,
    executadoEm: string,
  ): Promise<CrmSugestaoExecucao> {
    if (!leadId) {
      return { sucesso: false, acao, mensagem: "Lead não foi criado.", executadoEm };
    }
    const lead = await this.prisma.leadComercial.findFirst({
      where: { id: leadId, tenantId },
      select: { codigo: true },
    });
    if (!lead) {
      return { sucesso: false, acao, mensagem: "Lead não encontrado.", executadoEm };
    }
    return {
      sucesso: true,
      acao,
      mensagem: `Lead ${lead.codigo} registado na pipeline comercial.`,
      leadCodigo: lead.codigo,
      executadoEm,
    };
  }

  private async resolverEntidadeId(
    tenantId: string,
    row: SugestaoRow,
    meta: Record<string, unknown>,
    leadId: string | null,
  ): Promise<string | null> {
    if (row.entidadeClienteId) return row.entidadeClienteId;

    if (leadId) {
      const lead = await this.prisma.leadComercial.findFirst({
        where: { id: leadId, tenantId },
        select: { entidadeClienteId: true },
      });
      if (lead?.entidadeClienteId) return lead.entidadeClienteId;
    }

    const leadCodigo = meta.leadCodigo ? String(meta.leadCodigo) : null;
    if (leadCodigo) {
      const lead = await this.prisma.leadComercial.findFirst({
        where: { tenantId, codigo: leadCodigo },
        select: { entidadeClienteId: true },
      });
      if (lead?.entidadeClienteId) return lead.entidadeClienteId;
    }

    return null;
  }

  private tituloProposta(row: SugestaoRow): string {
    if (/^Proposta|^Renovação|^Preparar|^Criar proposta/i.test(row.titulo)) {
      return row.titulo.slice(0, 200);
    }
    return `Proposta comercial - ${row.titulo}`.slice(0, 200);
  }

  private findProposta(tenantId: string, entidadeClienteId: string | null, codigo: string) {
    if (!codigo) return null;
    return this.prisma.propostaComercial.findFirst({
      where: {
        tenantId,
        codigo,
        ...(entidadeClienteId ? { entidadeClienteId } : {}),
      },
    });
  }
}
