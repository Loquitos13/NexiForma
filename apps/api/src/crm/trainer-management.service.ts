/**
 * Trainer Management Service – NexiForma Fase 10
 * Gestão de Formadores
 * - CRUD de formadores
 * - Validação de qualificações (CCP/CC)
 * - Alertas de renovação
 */

import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { NotificacoesExtendedService } from "../notificacoes/notificacoes-extended.service";
import { resolverEmailNotificacaoFormador } from "@nexiforma/shared";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "../common/tenant-scope";

export interface FormadorDto {
  nomeCompleto: string;
  nif: string;
  email: string;
  ccNumero?: string;
  ccValidade?: string; // ISO date
  ccpNumero?: string;
  ccpValidade?: string; // ISO date
}

export interface FormadorComStatus {
  id: string;
  nomeCompleto: string;
  nif: string;
  email: string;
  cc?: {
    numero: string;
    validade: string;
    valido: boolean;
    diasAteExpiracao: number;
  } | null;
  ccp?: {
    numero: string;
    validade: string;
    valido: boolean;
    diasAteExpiracao: number;
  } | null;
  statusGeral: "OK" | "ALERTA" | "EXPIRADO";
}

@Injectable()
export class TrainerManagementService {
  private readonly logger = new Logger(TrainerManagementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificacoes: NotificacoesExtendedService,
  ) {}

  /**
   * Criar novo formador
   */
  async criarFormador(
    user: RequestUser,
    userId: string,
    dto: FormadorDto,
  ): Promise<FormadorComStatus> {
    const tenantId = requireTenantId(user);

    // Verificar duplicado por NIF
    const existente = await this.prisma.formadorProfile.findUnique({
      where: { tenantId_nif: { tenantId, nif: dto.nif } },
    });

    if (existente) {
      throw new ConflictException(`Formador com NIF ${dto.nif} já existe.`);
    }

    const formador = await this.prisma.formadorProfile.create({
      data: {
        tenantId,
        userId,
        nomeCompleto: dto.nomeCompleto,
        nif: dto.nif,
        email: dto.email,
        ccNumero: dto.ccNumero,
        ccValidade: dto.ccValidade ? new Date(dto.ccValidade) : null,
        ccpNumero: dto.ccpNumero,
        ccpValidade: dto.ccpValidade ? new Date(dto.ccpValidade) : null,
      },
    });

    this.logger.log(`✓ Formador criado: ${formador.nomeCompleto}`);

    return this.formatarFormador(formador);
  }

  /**
   * Listar formadores
   */
  async listarFormadores(
    user: RequestUser,
    filtros?: {
      nome?: string;
      status?: "OK" | "ALERTA" | "EXPIRADO";
      limit?: number;
      offset?: number;
    },
  ): Promise<{
    total: number;
    formadores: FormadorComStatus[];
  }> {
    const tenantId = requireTenantId(user);

    const where: any = { tenantId };
    if (filtros?.nome) {
      where.nomeCompleto = { contains: filtros.nome, mode: "insensitive" };
    }

    const limit = filtros?.limit ?? 20;
    const offset = filtros?.offset ?? 0;

    const formadores = await this.prisma.formadorProfile.findMany({
      where,
      orderBy: { nomeCompleto: "asc" },
      take: limit,
      skip: offset,
    });

    const total = await this.prisma.formadorProfile.count({ where });

    let resultado = formadores.map((f) => this.formatarFormador(f));

    // Filtrar por status se especificado
    if (filtros?.status) {
      resultado = resultado.filter((f) => f.statusGeral === filtros.status);
    }

    return { total, formadores: resultado };
  }

  /**
   * Obter detalhes de formador
   */
  async obterFormador(
    user: RequestUser,
    formadorId: string,
  ): Promise<FormadorComStatus> {
    const tenantId = requireTenantId(user);

    const formador = await this.prisma.formadorProfile.findFirst({
      where: { id: formadorId, tenantId },
    });

    if (!formador) {
      throw new NotFoundException("Formador não encontrado.");
    }

    return this.formatarFormador(formador);
  }

  /**
   * Atualizar qualificações de formador
   */
  async atualizarQualificacoes(
    user: RequestUser,
    formadorId: string,
    dto: {
      ccNumero?: string;
      ccValidade?: string;
      ccpNumero?: string;
      ccpValidade?: string;
    },
  ): Promise<FormadorComStatus> {
    const tenantId = requireTenantId(user);

    const formador = await this.prisma.formadorProfile.findFirst({
      where: { id: formadorId, tenantId },
    });

    if (!formador) {
      throw new NotFoundException("Formador não encontrado.");
    }

    const atualizado = await this.prisma.formadorProfile.update({
      where: { id: formadorId },
      data: {
        ccNumero: dto.ccNumero ?? formador.ccNumero,
        ccValidade: dto.ccValidade
          ? new Date(dto.ccValidade)
          : formador.ccValidade,
        ccpNumero: dto.ccpNumero ?? formador.ccpNumero,
        ccpValidade: dto.ccpValidade
          ? new Date(dto.ccpValidade)
          : formador.ccpValidade,
      },
    });

    this.logger.log(`✓ Qualificações atualizadas: ${atualizado.nomeCompleto}`);

    return this.formatarFormador(atualizado);
  }

  /**
   * Alertas de renovação de qualificações
   * Chamado por cron job (ex: diariamente)
   */
  async verificarRenovacoes(tenantId: string): Promise<{
    proximasRenovacoes: string[];
    expirados: string[];
  }> {
    const agora = new Date();
    const apenasX_dias = 30; // Alertar 30 dias antes

    const proximasRenovacoes = await this.prisma.formadorProfile.findMany({
      where: {
        tenantId,
        OR: [
          {
            ccValidade: {
              gte: agora,
              lte: new Date(agora.getTime() + apenasX_dias * 24 * 60 * 60 * 1000),
            },
          },
          {
            ccpValidade: {
              gte: agora,
              lte: new Date(agora.getTime() + apenasX_dias * 24 * 60 * 60 * 1000),
            },
          },
        ],
      },
      select: { id: true, nomeCompleto: true, email: true, ccValidade: true, ccpValidade: true, user: { select: { email: true } } },
    });

    const expirados = await this.prisma.formadorProfile.findMany({
      where: {
        tenantId,
        OR: [
          { ccValidade: { lt: agora } },
          { ccpValidade: { lt: agora } },
        ],
      },
      select: { id: true, nomeCompleto: true, email: true, user: { select: { email: true } } },
    });

    // Notificar admins
    if (proximasRenovacoes.length > 0 || expirados.length > 0) {
      await this.notificacoesAlertasRenovacao(
        tenantId,
        proximasRenovacoes,
        expirados,
      );
    }

    return {
      proximasRenovacoes: proximasRenovacoes.map((f) => f.nomeCompleto),
      expirados: expirados.map((f) => f.nomeCompleto),
    };
  }

  /**
   * Formatar formador com informações de status
   */
  private formatarFormador(
    formador: any,
  ): FormadorComStatus {
    const agora = new Date();

    const calcularStatus = (dataValidade: Date | null) => {
      if (!dataValidade) return null;

      const valido = dataValidade > agora;
      const diasAte = Math.ceil(
        (dataValidade.getTime() - agora.getTime()) / (1000 * 60 * 60 * 24),
      );

      return {
        numero: "",
        validade: dataValidade.toISOString().split("T")[0],
        valido,
        diasAteExpiracao: diasAte,
      };
    };

    const cc = formador.ccValidade ? calcularStatus(formador.ccValidade) : null;
    const ccp = formador.ccpValidade ? calcularStatus(formador.ccpValidade) : null;

    if (cc) cc.numero = formador.ccNumero;
    if (ccp) ccp.numero = formador.ccpNumero;

    const statusGeral = this.calcularStatusGeral(cc, ccp);

    return {
      id: formador.id,
      nomeCompleto: formador.nomeCompleto,
      nif: formador.nif,
      email: formador.email,
      cc,
      ccp,
      statusGeral,
    };
  }

  /**
   * Calcular status geral (OK/ALERTA/EXPIRADO)
   */
  private calcularStatusGeral(
    cc: any,
    ccp: any,
  ): "OK" | "ALERTA" | "EXPIRADO" {
    const qualificacoes = [cc, ccp].filter((q) => q !== null);

    if (qualificacoes.length === 0) return "ALERTA"; // Nenhuma qualificação

    const temExpirado = qualificacoes.some((q) => !q.valido);
    if (temExpirado) return "EXPIRADO";

    const temAlerta = qualificacoes.some((q) => q.diasAteExpiracao <= 30);
    if (temAlerta) return "ALERTA";

    return "OK";
  }

  /**
   * Notificar admins sobre renovações
   */
  private async notificacoesAlertasRenovacao(
    tenantId: string,
    proximasRenovacoes: any[],
    expirados: any[],
  ): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { legalName: true },
    });

    const alertas: string[] = [];

    if (proximasRenovacoes.length > 0) {
      alertas.push(
        `${proximasRenovacoes.length} formador(es) com qualificação próxima de expirar`,
      );
    }

    if (expirados.length > 0) {
      alertas.push(
        `${expirados.length} formador(es) com qualificação EXPIRADA`,
      );
    }

    if (alertas.length === 0) return;

    await this.notificacoes.notificarAlertaCompliance(tenantId, {
      severidade: expirados.length > 0 ? "critico" : "aviso",
      mensagem: alertas.join("; "),
      detalhes:
        expirados.length > 0
          ? `Expirados: ${expirados.map((f: { nomeCompleto: string }) => f.nomeCompleto).join(", ")}`
          : undefined,
    });

    const todos = [...proximasRenovacoes, ...expirados];
    const vistos = new Set<string>();
    for (const f of todos) {
      const email = resolverEmailNotificacaoFormador({
        emailPerfil: f.email,
        emailConta: f.user?.email,
      });
      if (!email || vistos.has(email)) continue;
      vistos.add(email);

      const expirado = expirados.some((x: { id: string }) => x.id === f.id);
      const msg = expirado
        ? "A sua certificação de formador (CC/CCP) está expirada. Actualize os documentos no portal."
        : "A sua certificação de formador (CC/CCP) expira em breve. Verifique a validade no portal.";

      await this.notificacoes.notificarFormadorQualificacao(
        email,
        f.nomeCompleto,
        msg,
        expirado ? "critico" : "aviso",
      );
    }
  }
}
