import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from "@nestjs/common";
import type { LeadComercial, Prisma } from "@nexiforma/database";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { parseDateRangeFilter } from "../common/date-range.util";
import {
  countsFromGroupBy,
  parseListPagination,
  type PaginatedList,
} from "../common/paginated-list.util";
import { requireTenantId } from "../common/tenant-scope";
import { ProposalService } from "./proposal.service";
import { CrmAuditService } from "./crm-audit.service";
import { CrmWebhooksService } from "./crm-webhooks.service";
import { CrmAutomationService } from "./crm-automation.service";
import type { PublicCreateLeadDto } from "./dto/public-lead.dto";
import type {
  ConverterLeadDto,
  CreateLeadDto,
  CriarPropostaFromLeadDto,
  MarcarLeadPerdidoDto,
  UpdateLeadDto,
} from "./dto/leads.dto";

const LEAD_INCLUDE = {
  entidadeCliente: { select: { id: true, nome: true, nif: true } },
  atribuido: { select: { id: true, displayName: true, email: true } },
  criadoPor: { select: { id: true, displayName: true, email: true } },
} satisfies Prisma.LeadComercialInclude;

export type LeadListFilters = {
  estado?: string;
  origem?: string;
  q?: string;
  comercialUserId?: string;
  dataInicio?: string;
  dataFim?: string;
  entidadeClienteId?: string;
  page?: string;
  pageSize?: string;
};

function buildLeadWhere(
  tenantId: string,
  filters: LeadListFilters | undefined,
  opts?: { omitEstado?: boolean },
): Prisma.LeadComercialWhereInput {
  const where: Prisma.LeadComercialWhereInput = { tenantId };

  if (filters?.entidadeClienteId) {
    where.entidadeClienteId = filters.entidadeClienteId;
  }
  if (filters?.estado && !opts?.omitEstado) {
    where.estado = filters.estado as LeadComercial["estado"];
  }
  if (filters?.origem) {
    where.origem = filters.origem as LeadComercial["origem"];
  }
  if (filters?.comercialUserId) {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      {
        OR: [
          { criadoPorUserId: filters.comercialUserId },
          { atribuidoUserId: filters.comercialUserId },
        ],
      },
    ];
  }
  const createdRange = parseDateRangeFilter(filters?.dataInicio, filters?.dataFim);
  if (createdRange) {
    where.createdAt = createdRange;
  }
  if (filters?.q?.trim()) {
    const q = filters.q.trim();
    const nifDigits = q.replace(/\D/g, "");
    const or: Prisma.LeadComercialWhereInput[] = [
      { empresaNome: { contains: q, mode: "insensitive" } },
      { contactoNome: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { codigo: { contains: q, mode: "insensitive" } },
      { entidadeCliente: { nome: { contains: q, mode: "insensitive" } } },
    ];
    if (nifDigits.length >= 3) {
      or.push({ nif: { contains: nifDigits } });
      or.push({ entidadeCliente: { nif: { contains: nifDigits } } });
    }
    where.OR = or;
  }

  return where;
}

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ProposalService))
    private readonly proposal: ProposalService,
    private readonly audit: CrmAuditService,
    private readonly webhooks: CrmWebhooksService,
    @Inject(forwardRef(() => CrmAutomationService))
    private readonly automation: CrmAutomationService,
  ) {}

  async list(user: RequestUser, filters?: LeadListFilters): Promise<PaginatedList<LeadComercial>> {
    const tenantId = requireTenantId(user);
    const pagination = parseListPagination(filters?.page, filters?.pageSize);
    const where = buildLeadWhere(tenantId, filters);
    const whereForCounts = buildLeadWhere(tenantId, filters, { omitEstado: true });

    const [total, items, countRows] = await Promise.all([
      this.prisma.leadComercial.count({ where }),
      this.prisma.leadComercial.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: pagination.skip,
        take: pagination.take,
        include: LEAD_INCLUDE,
      }),
      this.prisma.leadComercial.groupBy({
        by: ["estado"],
        where: whereForCounts,
        _count: { _all: true },
      }),
    ]);

    return {
      items,
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
      countsByEstado: countsFromGroupBy(countRows),
    };
  }

  async getOne(user: RequestUser, id: string) {
    const tenantId = requireTenantId(user);
    const row = await this.prisma.leadComercial.findFirst({
      where: { id, tenantId },
      include: LEAD_INCLUDE,
    });
    if (!row) {
      throw new NotFoundException("Lead não encontrado.");
    }
    return row;
  }

  async create(user: RequestUser, dto: CreateLeadDto) {
    const tenantId = requireTenantId(user);
    const nif = dto.nif?.replace(/\D/g, "") || undefined;
    if (nif && !this.validarNif(nif)) {
      throw new BadRequestException("NIF inválido.");
    }

    if (dto.atribuidoUserId) {
      await this.assertUser(tenantId, dto.atribuidoUserId);
    } else {
      await this.assertUser(tenantId, user.sub);
    }

    if (dto.entidadeClienteId) {
      const entidade = await this.prisma.entidadeCliente.findFirst({
        where: { id: dto.entidadeClienteId, tenantId },
      });
      if (!entidade) {
        throw new BadRequestException("Cliente não encontrado.");
      }
    }

    const codigo = dto.codigo?.trim() || this.gerarCodigo();
    const responsavelId = dto.atribuidoUserId ?? user.sub;

    const metadata: Prisma.InputJsonValue | undefined =
      dto.customFields && Object.keys(dto.customFields).length
        ? ({ customFields: dto.customFields } as Prisma.InputJsonValue)
        : undefined;

    const lead = await this.prisma.leadComercial.create({
      data: {
        tenantId,
        codigo,
        empresaNome: dto.empresaNome.trim(),
        contactoNome: dto.contactoNome?.trim() || null,
        email: dto.email?.trim().toLowerCase() || null,
        telefone: dto.telefone?.trim() || null,
        nif: nif || null,
        origem: dto.origem ?? "OUTRO",
        valorEstimadoCentavos: dto.valorEstimadoCentavos ?? 0,
        notas: dto.notas?.trim() || null,
        criadoPorUserId: user.sub,
        atribuidoUserId: responsavelId,
        entidadeClienteId: dto.entidadeClienteId ?? null,
        metadata,
      },
      include: LEAD_INCLUDE,
    });

    void this.afterLeadCreated(user, tenantId, lead);
    return lead;
  }

  async createFromPublic(
    tenantId: string,
    dto: PublicCreateLeadDto,
    opts?: { source?: string; origem?: LeadComercial["origem"] },
  ) {
    const nif = dto.nif?.replace(/\D/g, "") || undefined;
    if (nif && !this.validarNif(nif)) {
      throw new BadRequestException("NIF inválido.");
    }

    const comercial = await this.prisma.user.findFirst({
      where: {
        tenantId,
        active: true,
        role: { in: ["ADMIN", "COORDENADOR", "COMERCIAL"] },
      },
      orderBy: { createdAt: "asc" },
    });

    const metadata: Prisma.InputJsonValue = {
      source: opts?.source ?? "public",
      ...(dto.customFields ? { customFields: dto.customFields as Prisma.InputJsonValue } : {}),
    };

    const lead = await this.prisma.leadComercial.create({
      data: {
        tenantId,
        codigo: this.gerarCodigo(),
        empresaNome: dto.empresaNome.trim(),
        contactoNome: dto.contactoNome?.trim() || null,
        email: dto.email?.trim().toLowerCase() || null,
        telefone: dto.telefone?.trim() || null,
        nif: nif || null,
        origem: opts?.origem ?? dto.origem ?? "WEBSITE",
        valorEstimadoCentavos: dto.valorEstimadoCentavos ?? 0,
        notas: dto.notas?.trim() || null,
        criadoPorUserId: comercial?.id ?? null,
        atribuidoUserId: comercial?.id ?? null,
        metadata,
      },
      include: LEAD_INCLUDE,
    });

    void this.afterLeadCreated(null, tenantId, lead);
    return { id: lead.id, codigo: lead.codigo, estado: lead.estado };
  }

  private async afterLeadCreated(
    user: RequestUser | null,
    tenantId: string,
    lead: LeadComercial,
  ): Promise<void> {
    await this.audit.log({
      user,
      tenantId,
      action: "crm.lead.created",
      resourceType: "LeadComercial",
      resourceId: lead.id,
      payload: { codigo: lead.codigo, origem: lead.origem },
    });
    void this.webhooks.emit(tenantId, "lead.created", {
      id: lead.id,
      codigo: lead.codigo,
      empresaNome: lead.empresaNome,
    });
    void this.automation.onLeadCreated(tenantId, lead.id);
  }

  async update(user: RequestUser, id: string, dto: UpdateLeadDto) {
    await this.getOne(user, id);
    const tenantId = requireTenantId(user);
    const existing = await this.prisma.leadComercial.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new NotFoundException("Lead não encontrado.");
    }
    if (existing.estado === "CONVERTIDO" || existing.estado === "PERDIDO") {
      throw new BadRequestException("Lead fechado - não pode ser editado.");
    }

    const nif = dto.nif !== undefined ? dto.nif.replace(/\D/g, "") || null : undefined;
    if (nif && !this.validarNif(nif)) {
      throw new BadRequestException("NIF inválido.");
    }

    if (dto.atribuidoUserId) {
      await this.assertUser(tenantId, dto.atribuidoUserId);
    }

    const updated = await this.prisma.leadComercial.update({
      where: { id },
      data: {
        ...(dto.empresaNome !== undefined ? { empresaNome: dto.empresaNome.trim() } : {}),
        ...(dto.contactoNome !== undefined
          ? { contactoNome: dto.contactoNome?.trim() || null }
          : {}),
        ...(dto.email !== undefined ? { email: dto.email?.trim().toLowerCase() || null } : {}),
        ...(dto.telefone !== undefined ? { telefone: dto.telefone?.trim() || null } : {}),
        ...(nif !== undefined ? { nif } : {}),
        ...(dto.origem !== undefined ? { origem: dto.origem } : {}),
        ...(dto.estado !== undefined ? { estado: dto.estado } : {}),
        ...(dto.valorEstimadoCentavos !== undefined
          ? { valorEstimadoCentavos: dto.valorEstimadoCentavos }
          : {}),
        ...(dto.notas !== undefined ? { notas: dto.notas?.trim() || null } : {}),
        ...(dto.atribuidoUserId !== undefined
          ? { atribuidoUserId: dto.atribuidoUserId }
          : {}),
        ...(dto.customFields !== undefined
          ? {
              metadata: {
                ...((existing.metadata as Prisma.JsonObject) ?? {}),
                customFields: dto.customFields as Prisma.InputJsonValue,
              } as Prisma.InputJsonValue,
            }
          : {}),
      },
      include: LEAD_INCLUDE,
    });

    void this.audit.log({
      user,
      tenantId,
      action: "crm.lead.updated",
      resourceType: "LeadComercial",
      resourceId: id,
      payload: { estado: updated.estado },
    });
    void this.webhooks.emit(tenantId, "lead.updated", { id, estado: updated.estado });

    return updated;
  }

  async marcarPerdido(user: RequestUser, id: string, dto: MarcarLeadPerdidoDto) {
    const lead = await this.getOne(user, id);
    if (lead.estado === "CONVERTIDO") {
      throw new BadRequestException("Lead já convertido.");
    }

    return this.prisma.leadComercial.update({
      where: { id },
      data: {
        estado: "PERDIDO",
        motivoPerda: dto.motivo?.trim() || null,
      },
      include: LEAD_INCLUDE,
    });
  }

  async converterEntidade(user: RequestUser, id: string, dto: ConverterLeadDto) {
    const tenantId = requireTenantId(user);
    const lead = await this.getOne(user, id);

    if (lead.estado === "CONVERTIDO" && lead.entidadeClienteId) {
      return {
        lead,
        entidade: lead.entidadeCliente,
        alreadyConverted: true,
      };
    }
    if (lead.estado === "PERDIDO") {
      throw new BadRequestException("Lead marcado como perdido.");
    }

    const nif = (dto.nif ?? lead.nif ?? "").replace(/\D/g, "");
    if (!nif || nif.length !== 9) {
      throw new BadRequestException("NIF é obrigatório para converter em entidade cliente.");
    }
    if (!this.validarNif(nif)) {
      throw new BadRequestException("NIF inválido.");
    }

    const nome = (dto.nome ?? lead.empresaNome).trim();
    const entidade = await this.resolverOuCriarEntidade(tenantId, lead, nif, nome);

    const updatedLead = await this.prisma.leadComercial.update({
      where: { id },
      data: {
        estado: "CONVERTIDO",
        nif,
        entidadeClienteId: entidade.id,
        convertidoEm: new Date(),
      },
      include: LEAD_INCLUDE,
    });

    void this.audit.log({
      user,
      tenantId,
      action: "crm.lead.converted",
      resourceType: "LeadComercial",
      resourceId: id,
      payload: { entidadeClienteId: entidade.id },
    });
    void this.webhooks.emit(tenantId, "lead.converted", {
      id,
      entidadeClienteId: entidade.id,
    });

    return { lead: updatedLead, entidade, alreadyConverted: false };
  }

  async criarProposta(user: RequestUser, id: string, dto: CriarPropostaFromLeadDto) {
    const tenantId = requireTenantId(user);
    const lead = await this.getOne(user, id);
    if (lead.estado === "PERDIDO") {
      throw new BadRequestException("Lead marcado como perdido.");
    }

    let entidadeClienteId = lead.entidadeClienteId;
    if (!entidadeClienteId) {
      const nif = (lead.nif ?? "").replace(/\D/g, "");
      if (!nif || nif.length !== 9 || !this.validarNif(nif)) {
        throw new BadRequestException(
          "Indique um NIF válido no lead antes de criar a proposta. A conversão em cliente ocorre automaticamente quando o cliente aceitar a proposta.",
        );
      }
      const entidade = await this.resolverOuCriarEntidade(
        tenantId,
        lead,
        nif,
        lead.empresaNome.trim(),
      );
      entidadeClienteId = entidade.id;
      await this.prisma.leadComercial.update({
        where: { id: lead.id },
        data: { entidadeClienteId: entidade.id, nif },
      });
    }

    const titulo =
      dto.titulo?.trim() ||
      `Formação - ${lead.empresaNome}`.slice(0, 200);

    const proposta = await this.proposal.criarProposta(user, {
      entidadeClienteId,
      titulo,
      valorCentavos: dto.valorCentavos ?? lead.valorEstimadoCentavos,
      cursoId: dto.cursoId,
      notasInternas: lead.notas ?? undefined,
    });

    const leadActualizado = await this.getOne(user, id);
    return { lead: leadActualizado, proposta };
  }

  private async resolverOuCriarEntidade(
    tenantId: string,
    lead: LeadComercial,
    nif: string,
    nome: string,
  ) {
    let entidade = await this.prisma.entidadeCliente.findUnique({
      where: { tenantId_nif: { tenantId, nif } },
    });

    if (entidade) {
      entidade = await this.prisma.entidadeCliente.update({
        where: { id: entidade.id },
        data: {
          nome,
          email: lead.email ?? entidade.email,
          telefone: lead.telefone ?? entidade.telefone,
        },
      });
    } else {
      entidade = await this.prisma.entidadeCliente.create({
        data: {
          tenantId,
          nif,
          nome,
          email: lead.email,
          telefone: lead.telefone,
        },
      });
    }

    return entidade;
  }

  private gerarCodigo(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const r = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `LEAD-${y}${m}-${r}`;
  }

  private async assertUser(tenantId: string, userId: string) {
    const u = await this.prisma.user.findFirst({
      where: {
        id: userId,
        tenantId,
        active: true,
        role: { in: ["ADMIN", "COORDENADOR", "FINANCEIRO", "COMERCIAL"] },
      },
    });
    if (!u) {
      throw new BadRequestException("Utilizador comercial inválido.");
    }
  }

  private validarNif(nif: string): boolean {
    const digits = nif.replace(/\D/g, "");
    if (digits.length !== 9) return false;
    let soma = 0;
    for (let i = 0; i < 8; i++) {
      soma += parseInt(digits[i]!, 10) * (9 - i);
    }
    const checkDigit = 11 - (soma % 11);
    const expectedDigit = checkDigit === 10 || checkDigit === 11 ? 0 : checkDigit;
    return parseInt(digits[8]!, 10) === expectedDigit;
  }
}
