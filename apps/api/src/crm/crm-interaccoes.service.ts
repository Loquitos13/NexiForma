import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from "@nestjs/common";
import type { InteraccaoComercial, Prisma } from "@nexiforma/database";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { parseDateRangeFilter } from "../common/date-range.util";
import {
  parseListPagination,
  type PaginatedList,
} from "../common/paginated-list.util";
import { requireTenantId } from "../common/tenant-scope";
import { resolveInteraccaoListFilters, assertInteraccaoAcessivel } from "../common/comercial-scope.util";
import { CrmNotasInsightsService } from "./crm-notas-insights.service";
import { CrmSugestoesIaService } from "./crm-sugestoes-ia.service";
import type { CreateInteraccaoDto, UpdateInteraccaoDto } from "./dto/interaccoes.dto";
import { mapInteraccaoRow, type InteraccaoComercialResposta } from "./crm-ia.types";
import { CrmAuditService } from "./crm-audit.service";
import { CrmWebhooksService } from "./crm-webhooks.service";
import { interaccaoAutorFromUserId } from "./interaccao-autor.util";
import { CalendarioNotificacoesService } from "../calendario/calendario-notificacoes.service";
import { IntegracoesService } from "../integracoes/integracoes.service";

const INTERACCAO_LIST_INCLUDE = {
  entidadeCliente: { select: { id: true, nome: true, nif: true } },
  leadComercial: { select: { id: true, codigo: true, empresaNome: true } },
  criadoPor: { select: { id: true, displayName: true, email: true } },
  sugestoesIa: {
    orderBy: { createdAt: "desc" as const },
    take: 5,
  },
} satisfies Prisma.InteraccaoComercialInclude;

const INTERACCAO_DETAIL_INCLUDE = {
  entidadeCliente: { select: { id: true, nome: true, nif: true } },
  leadComercial: { select: { id: true, codigo: true, empresaNome: true } },
  criadoPor: { select: { id: true, displayName: true, email: true } },
  sugestoesIa: {
    orderBy: { createdAt: "desc" as const },
    take: 25,
  },
} satisfies Prisma.InteraccaoComercialInclude;

export type InteraccaoListFilters = {
  entidadeClienteId?: string;
  leadComercialId?: string;
  q?: string;
  comercialUserId?: string;
  dataInicio?: string;
  dataFim?: string;
  page?: string;
  pageSize?: string;
};

function buildInteraccaoWhere(
  tenantId: string,
  filters?: InteraccaoListFilters,
): Prisma.InteraccaoComercialWhereInput {
  const where: Prisma.InteraccaoComercialWhereInput = { tenantId };
  if (filters?.entidadeClienteId) where.entidadeClienteId = filters.entidadeClienteId;
  if (filters?.leadComercialId) where.leadComercialId = filters.leadComercialId;
  if (filters?.comercialUserId) where.criadoPorAutorId = filters.comercialUserId;

  const createdRange = parseDateRangeFilter(filters?.dataInicio, filters?.dataFim);
  if (createdRange) where.createdAt = createdRange;

  if (filters?.q?.trim()) {
    const q = filters.q.trim();
    const nifDigits = q.replace(/\D/g, "");
    const or: Prisma.InteraccaoComercialWhereInput[] = [
      { entidadeCliente: { nome: { contains: q, mode: "insensitive" } } },
      { leadComercial: { empresaNome: { contains: q, mode: "insensitive" } } },
    ];
    if (nifDigits.length >= 3) {
      or.push({ entidadeCliente: { nif: { contains: nifDigits } } });
      or.push({ leadComercial: { nif: { contains: nifDigits } } });
    }
    where.OR = or;
  }

  return where;
}

@Injectable()
export class CrmInteraccoesService {
  private readonly logger = new Logger(CrmInteraccoesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly insights: CrmNotasInsightsService,
    @Inject(forwardRef(() => CrmSugestoesIaService))
    private readonly sugestoes: CrmSugestoesIaService,
    private readonly audit: CrmAuditService,
    private readonly webhooks: CrmWebhooksService,
    private readonly calendarioNotificacoes: CalendarioNotificacoesService,
    private readonly integracoes: IntegracoesService,
  ) {}

  async list(
    user: RequestUser,
    filters?: InteraccaoListFilters,
  ): Promise<PaginatedList<InteraccaoComercialResposta>> {
    const tenantId = requireTenantId(user);
    const pagination = parseListPagination(filters?.page, filters?.pageSize);
    const where = buildInteraccaoWhere(
      tenantId,
      resolveInteraccaoListFilters(user, filters),
    );

    const [total, rows] = await Promise.all([
      this.prisma.interaccaoComercial.count({ where }),
      this.prisma.interaccaoComercial.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: pagination.skip,
        take: pagination.take,
        include: INTERACCAO_LIST_INCLUDE,
      }),
    ]);

    return {
      items: rows.map((r) => mapInteraccaoRow(r as unknown as Record<string, unknown>)),
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
    };
  }

  async getOne(user: RequestUser, id: string): Promise<InteraccaoComercialResposta> {
    const tenantId = requireTenantId(user);
    const row = await this.prisma.interaccaoComercial.findFirst({
      where: { id, tenantId },
      include: INTERACCAO_DETAIL_INCLUDE,
    });
    if (!row) throw new NotFoundException("Interacção não encontrada.");
    assertInteraccaoAcessivel(user, row);
    return mapInteraccaoRow(row as unknown as Record<string, unknown>);
  }

  async create(user: RequestUser, dto: CreateInteraccaoDto): Promise<InteraccaoComercialResposta> {
    const tenantId = requireTenantId(user);
    if (!user.sub) throw new BadRequestException("Utilizador inválido.");

    let entidadeClienteId = dto.entidadeClienteId;
    let leadComercialId = dto.leadComercialId;
    if (dto.reuniaoOrigemId && !entidadeClienteId && !leadComercialId) {
      const origem = await this.prisma.interaccaoComercial.findFirst({
        where: { id: dto.reuniaoOrigemId, tenantId, tipo: "REUNIAO" },
        select: { entidadeClienteId: true, leadComercialId: true },
      });
      if (origem) {
        entidadeClienteId = origem.entidadeClienteId ?? undefined;
        leadComercialId = origem.leadComercialId ?? undefined;
      }
    }

    if (!entidadeClienteId && !leadComercialId) {
      const agendamentoCalendario = dto.tipo === "REUNIAO" && !!dto.agendadoPara;
      if (!agendamentoCalendario) {
        throw new BadRequestException("Indique um cliente ou um lead.");
      }
    }
    if (!this.temConteudo(dto)) {
      throw new BadRequestException("Preencha pelo menos um campo de notas.");
    }

    await this.validarFks(tenantId, entidadeClienteId, leadComercialId);

    const autor = await interaccaoAutorFromUserId(this.prisma, user.sub);

    const row = await this.prisma.interaccaoComercial.create({
      data: {
        tenantId,
        tipo: dto.tipo ?? "REUNIAO",
        titulo: dto.titulo?.trim() || null,
        contexto: dto.contexto?.trim() || null,
        situacaoActual: dto.situacaoActual?.trim() || null,
        dorNecessidade: dto.dorNecessidade?.trim() || null,
        orcamentoTiming: dto.orcamentoTiming?.trim() || null,
        decisor: dto.decisor?.trim() || null,
        proximoPassoNota: dto.proximoPassoNota?.trim() || null,
        notasLivres: dto.notasLivres?.trim() || null,
        entidadeClienteId: entidadeClienteId ?? null,
        leadComercialId: leadComercialId ?? null,
        ...autor,
        agendadoPara: dto.agendadoPara ? new Date(dto.agendadoPara) : null,
        agendadoFim: dto.agendadoFim ? new Date(dto.agendadoFim) : null,
        participantesIds: dto.participantesIds ?? [],
        audienciaRoles: dto.audienciaRoles ?? [],
        reuniaoOrigemId: dto.reuniaoOrigemId ?? null,
        reuniaoEstado: dto.tipo === "REUNIAO" || dto.agendadoPara ? "AGENDADA" : null,
      },
      include: INTERACCAO_DETAIL_INCLUDE,
    });

    let result = row;
    if (dto.criarSalaTeams && row.tipo === "REUNIAO") {
      try {
        const meeting = await this.integracoes.criarTeamsMeetingComercial(tenantId, {
          subject: row.titulo?.trim() || "Reunião comercial NexiForma",
          start: row.agendadoPara ?? undefined,
          end: row.agendadoFim ?? undefined,
        });
        result = await this.prisma.interaccaoComercial.update({
          where: { id: row.id },
          data: {
            teamsMeetingId: meeting.meetingId,
            salaJoinUrl: meeting.joinUrl,
            reuniaoEstado: "AGENDADA",
          },
          include: INTERACCAO_DETAIL_INCLUDE,
        });
      } catch (err) {
        this.logger.warn(
          `Teams sala reunião ${row.id}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    if (result.agendadoPara && result.tipo === "REUNIAO") {
      void this.calendarioNotificacoes.onReuniaoAgendada(result.id, tenantId).catch((err) =>
        this.logger.warn(`Calendário reunião: ${String(err)}`),
      );
    }

    void this.processarAsync(result.id).catch((err) =>
      this.logger.warn(`Processamento IA falhou (${result.id}): ${err instanceof Error ? err.message : err}`),
    );

    void this.audit.log({
      user,
      tenantId,
      action: "crm.interaccao.created",
      resourceType: "InteraccaoComercial",
      resourceId: result.id,
    });
    void this.webhooks.emit(tenantId, "interaccao.created", { id: result.id });

    return mapInteraccaoRow(result as unknown as Record<string, unknown>);
  }

  async update(user: RequestUser, id: string, dto: UpdateInteraccaoDto): Promise<InteraccaoComercialResposta> {
    const tenantId = requireTenantId(user);
    const row = await this.prisma.interaccaoComercial.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException("Interacção não encontrada.");
    this.assertPodeGerirReuniao(user, row);

    if (row.tipo !== "REUNIAO" || !row.agendadoPara) {
      throw new BadRequestException("Só pode editar reuniões agendadas no calendário.");
    }
    if (row.reuniaoEstado === "EM_CURSO" || row.reuniaoEstado === "CONCLUIDA") {
      throw new BadRequestException("Não pode editar uma reunião em curso ou concluída.");
    }

    const entidadeClienteId =
      dto.entidadeClienteId !== undefined ? dto.entidadeClienteId || null : row.entidadeClienteId;
    await this.validarFks(tenantId, entidadeClienteId ?? undefined, undefined);

    const updated = await this.prisma.interaccaoComercial.update({
      where: { id },
      data: {
        titulo: dto.titulo !== undefined ? dto.titulo?.trim() || null : undefined,
        notasLivres: dto.notasLivres !== undefined ? dto.notasLivres?.trim() || null : undefined,
        agendadoPara: dto.agendadoPara ? new Date(dto.agendadoPara) : undefined,
        agendadoFim:
          dto.agendadoFim !== undefined
            ? dto.agendadoFim
              ? new Date(dto.agendadoFim)
              : null
            : undefined,
        entidadeClienteId: dto.entidadeClienteId !== undefined ? entidadeClienteId : undefined,
      },
      include: INTERACCAO_DETAIL_INCLUDE,
    });

    void this.audit.log({
      user,
      tenantId,
      action: "crm.interaccao.updated",
      resourceType: "InteraccaoComercial",
      resourceId: id,
    });

    return mapInteraccaoRow(updated as unknown as Record<string, unknown>);
  }

  async remove(user: RequestUser, id: string): Promise<{ ok: true }> {
    const tenantId = requireTenantId(user);
    const row = await this.prisma.interaccaoComercial.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException("Interacção não encontrada.");
    this.assertPodeGerirReuniao(user, row);

    if (row.tipo !== "REUNIAO" || !row.agendadoPara) {
      throw new BadRequestException("Só pode remover reuniões agendadas no calendário.");
    }
    if (row.reuniaoEstado === "EM_CURSO" || row.reuniaoEstado === "CONCLUIDA") {
      throw new BadRequestException("Só pode cancelar reuniões ainda agendadas.");
    }

    await this.prisma.interaccaoComercial.delete({ where: { id } });

    void this.audit.log({
      user,
      tenantId,
      action: "crm.interaccao.deleted",
      resourceType: "InteraccaoComercial",
      resourceId: id,
    });

    return { ok: true };
  }

  async reprocessar(user: RequestUser, id: string): Promise<InteraccaoComercialResposta> {
    const tenantId = requireTenantId(user);
    const row = await this.prisma.interaccaoComercial.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException("Interacção não encontrada.");
    assertInteraccaoAcessivel(user, row);

    await this.prisma.interaccaoComercial.update({
      where: { id },
      data: {
        processamentoEstado: "PENDENTE",
        processamentoErro: null,
        processadoEm: null,
      },
    });
    await this.prisma.sugestaoIaComercial.deleteMany({
      where: { interaccaoId: id, tenantId, estado: "PENDENTE" },
    });

    await this.processarAsync(id);
    return this.getOne(user, id);
  }

  async processarPendentes(limit = 20) {
    const rows = await this.prisma.interaccaoComercial.findMany({
      where: { processamentoEstado: "PENDENTE" },
      orderBy: { createdAt: "asc" },
      take: limit,
      select: { id: true },
    });
    for (const r of rows) {
      await this.processarAsync(r.id);
    }
    return rows.length;
  }

  private async processarAsync(id: string) {
    const row = await this.prisma.interaccaoComercial.findUnique({
      where: { id },
      include: {
        entidadeCliente: { select: { nome: true } },
        leadComercial: { select: { empresaNome: true } },
      },
    });
    if (!row || row.processamentoEstado === "PROCESSADO") return;

    try {
      const { insights, engine } = await this.insights.extrair({
        tipo: row.tipo,
        titulo: row.titulo,
        contexto: row.contexto,
        situacaoActual: row.situacaoActual,
        dorNecessidade: row.dorNecessidade,
        orcamentoTiming: row.orcamentoTiming,
        decisor: row.decisor,
        proximoPassoNota: row.proximoPassoNota,
        notasLivres: row.notasLivres,
        entidadeNome: row.entidadeCliente?.nome,
        leadNome: row.leadComercial?.empresaNome,
      });

      await this.prisma.interaccaoComercial.update({
        where: { id },
        data: {
          resumoIa: insights.resumo_situacao,
          proximosPassosIa: insights.proximos_passos as unknown as Prisma.InputJsonValue,
          gatilhosIa: insights.gatilhos_venda as unknown as Prisma.InputJsonValue,
          dadosExtraidosIa: insights.dados_extraidos as unknown as Prisma.InputJsonValue,
          processamentoEstado: "PROCESSADO",
          processamentoEngine: engine,
          processamentoErro: null,
          processadoEm: new Date(),
        },
      });

      await this.sugestoes.gerarFromInsights({
        tenantId: row.tenantId,
        interaccaoId: row.id,
        insights,
        engine,
        entidadeClienteId: row.entidadeClienteId,
        leadComercialId: row.leadComercialId,
      });

      if (row.entidadeClienteId) {
        await this.sugestoes.gerarSugestoesProactivasInterno(
          row.tenantId,
          row.entidadeClienteId,
        );
      }
    } catch (err) {
      await this.prisma.interaccaoComercial.update({
        where: { id },
        data: {
          processamentoEstado: "ERRO",
          processamentoErro: err instanceof Error ? err.message : "Erro desconhecido",
        },
      });
    }
  }

  private assertPodeGerirReuniao(
    user: RequestUser,
    row: { criadoPorAutorId: string; criadoPorUserId: string | null },
  ) {
    if (user.role === "tenant_manager" || user.role === "super_admin") return;
    if (user.sub && (row.criadoPorAutorId === user.sub || row.criadoPorUserId === user.sub)) {
      return;
    }
    throw new ForbiddenException("Sem permissão para gerir esta reunião.");
  }

  private temConteudo(dto: CreateInteraccaoDto): boolean {
    return !!(
      dto.contexto?.trim() ||
      dto.situacaoActual?.trim() ||
      dto.dorNecessidade?.trim() ||
      dto.orcamentoTiming?.trim() ||
      dto.decisor?.trim() ||
      dto.proximoPassoNota?.trim() ||
      dto.notasLivres?.trim()
    );
  }

  private async validarFks(
    tenantId: string,
    entidadeClienteId?: string,
    leadComercialId?: string,
  ) {
    if (entidadeClienteId) {
      const e = await this.prisma.entidadeCliente.findFirst({
        where: { id: entidadeClienteId, tenantId },
      });
      if (!e) throw new NotFoundException("Cliente não encontrado.");
    }
    if (leadComercialId) {
      const l = await this.prisma.leadComercial.findFirst({
        where: { id: leadComercialId, tenantId },
      });
      if (!l) throw new NotFoundException("Lead não encontrado.");
    }
  }
}

export type { InteraccaoComercialResposta, SugestaoIaComercialResposta } from "./crm-ia.types";
