import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from "@nestjs/common";
import type { LeadComercial, Prisma } from "@nexiforma/database";
import {
  CrmCustomFieldValidationError,
  validateCustomFieldsForEntity,
} from "@nexiforma/shared";
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
import { CrmConfigService } from "./crm-config.service";
import type { PublicCreateLeadDto } from "./dto/public-lead.dto";
import type {
  ConverterLeadDto,
  CreateLeadDto,
  CriarPropostaFromLeadDto,
  MarcarLeadPerdidoDto,
  UpdateLeadDto,
} from "./dto/leads.dto";
import { assertDadosClienteCompletos } from "../faturas/faturacao-dados-legais.util";
import { ViesService } from "../vies/vies.service";

const LEAD_INCLUDE = {
  entidadeCliente: {
    select: { id: true, nome: true, nif: true, moradaFiscal: true },
  },
  atribuido: { select: { id: true, displayName: true, email: true } },
  criadoPor: { select: { id: true, displayName: true, email: true } },
} satisfies Prisma.LeadComercialInclude;

function leadMoradaFiscalFromMetadata(
  metadata: Prisma.JsonValue | null | undefined,
): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const raw = (metadata as Prisma.JsonObject).moradaFiscal;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length >= 5 ? trimmed : null;
}

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
    private readonly crmConfig: CrmConfigService,
    private readonly vies: ViesService,
  ) {}

  private async validateLeadCustomFields(
    tenantId: string,
    customFields?: Record<string, unknown>,
  ): Promise<Record<string, unknown> | undefined> {
    if (!customFields) return undefined;
    const cfg = await this.crmConfig.getByTenantId(tenantId);
    try {
      return validateCustomFieldsForEntity(cfg.customFieldDefs, "lead", customFields);
    } catch (err) {
      if (err instanceof CrmCustomFieldValidationError) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }
  }

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
      assertDadosClienteCompletos({
        nome: entidade.nome,
        nif: entidade.nif,
        moradaFiscal: entidade.moradaFiscal,
      });
    } else {
      const morada = dto.moradaFiscal?.trim() ?? "";
      if (!nif || nif.length !== 9) {
        throw new BadRequestException(
          "NIF e morada fiscal são obrigatórios ao criar um lead sem cliente existente.",
        );
      }
      if (morada.length < 5) {
        throw new BadRequestException(
          "Morada fiscal é obrigatória ao criar um lead sem cliente existente.",
        );
      }
    }

    const codigo = dto.codigo?.trim() || this.gerarCodigo();
    const responsavelId = dto.atribuidoUserId ?? user.sub;

    const validatedCustom = await this.validateLeadCustomFields(tenantId, dto.customFields);
    const moradaFiscal = dto.moradaFiscal?.trim() || undefined;
    const metadata: Prisma.InputJsonValue | undefined =
      validatedCustom || moradaFiscal
        ? ({
            ...(validatedCustom && Object.keys(validatedCustom).length
              ? { customFields: validatedCustom }
              : {}),
            ...(moradaFiscal ? { moradaFiscal } : {}),
          } as Prisma.InputJsonValue)
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

    const cfg = await this.crmConfig.getByTenantId(tenantId);
    let validatedCustom: Record<string, unknown> | undefined;
    if (dto.customFields && Object.keys(dto.customFields).length > 0) {
      validatedCustom = validateCustomFieldsForEntity(
        cfg.customFieldDefs,
        "lead",
        dto.customFields,
      ) as Record<string, unknown>;
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
      ...(validatedCustom ? { customFields: validatedCustom as Prisma.InputJsonValue } : {}),
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

    if (dto.estado === "CONVERTIDO" && !existing.entidadeClienteId) {
      throw new BadRequestException(
        "Para converter o lead em cliente use a acção Converter (é necessário NIF).",
      );
    }
    if (dto.estado === "PERDIDO") {
      throw new BadRequestException(
        "Para marcar o lead como perdido use a acção dedicada (permite indicar o motivo).",
      );
    }

    const nif = dto.nif !== undefined ? dto.nif.replace(/\D/g, "") || null : undefined;
    if (nif && !this.validarNif(nif)) {
      throw new BadRequestException("NIF inválido.");
    }

    if (dto.atribuidoUserId) {
      await this.assertUser(tenantId, dto.atribuidoUserId);
    }

    const validatedCustom =
      dto.customFields !== undefined
        ? await this.validateLeadCustomFields(tenantId, dto.customFields)
        : undefined;

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
                customFields: (validatedCustom ?? {}) as Prisma.InputJsonValue,
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

    const moradaFiscal =
      dto.moradaFiscal?.trim() ||
      leadMoradaFiscalFromMetadata(lead.metadata) ||
      "";
    if (moradaFiscal.length < 5) {
      throw new BadRequestException(
        "Morada fiscal é obrigatória para converter em entidade cliente.",
      );
    }

    const nome = (dto.nome ?? lead.empresaNome).trim();
    const entidade = await this.resolverOuCriarEntidade(
      tenantId,
      lead,
      nif,
      nome,
      moradaFiscal,
    );

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
      const moradaFiscal = leadMoradaFiscalFromMetadata(lead.metadata);
      if (!nif || nif.length !== 9 || !this.validarNif(nif) || !moradaFiscal) {
        throw new BadRequestException(
          "Converta o lead em cliente (NIF e morada fiscal) antes de criar a proposta, ou preencha esses dados no lead.",
        );
      }
      const entidade = await this.resolverOuCriarEntidade(
        tenantId,
        lead,
        nif,
        lead.empresaNome.trim(),
        moradaFiscal,
      );
      entidadeClienteId = entidade.id;
      await this.prisma.leadComercial.update({
        where: { id: lead.id },
        data: { entidadeClienteId: entidade.id, nif },
      });
    } else if (lead.entidadeCliente) {
      assertDadosClienteCompletos({
        nome: lead.entidadeCliente.nome,
        nif: lead.entidadeCliente.nif,
        moradaFiscal: lead.entidadeCliente.moradaFiscal,
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
    moradaFiscal: string,
  ) {
    const nifNorm = nif.trim();
    const confirmado = await this.vies.assertConfirmado(nifNorm, "empresa");
    const nomeFinal = nome.trim() || confirmado.nome?.trim() || "";
    const moradaFinal =
      moradaFiscal.trim() || confirmado.morada?.split("\n").join(", ").trim() || "";
    assertDadosClienteCompletos({ nome: nomeFinal, nif: nifNorm, moradaFiscal: moradaFinal });

    let entidade = await this.prisma.entidadeCliente.findUnique({
      where: { tenantId_nif: { tenantId, nif: nifNorm } },
    });

    if (entidade) {
      entidade = await this.prisma.entidadeCliente.update({
        where: { id: entidade.id },
        data: {
          nome: nomeFinal,
          moradaFiscal: moradaFinal || entidade.moradaFiscal,
          email: lead.email ?? entidade.email,
          telefone: lead.telefone ?? entidade.telefone,
        },
      });
    } else {
      entidade = await this.prisma.entidadeCliente.create({
        data: {
          tenantId,
          nif: nifNorm,
          nome: nomeFinal,
          moradaFiscal: moradaFinal,
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
