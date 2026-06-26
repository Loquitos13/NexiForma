import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { LeadComercial, Prisma } from "@nexiforma/database";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "../common/tenant-scope";
import { ProposalService } from "./proposal.service";
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
} satisfies Prisma.LeadComercialInclude;

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly proposal: ProposalService,
  ) {}

  list(
    user: RequestUser,
    filters?: { estado?: string; origem?: string; q?: string },
  ) {
    const tenantId = requireTenantId(user);
    const where: Prisma.LeadComercialWhereInput = { tenantId };

    if (filters?.estado) {
      where.estado = filters.estado as LeadComercial["estado"];
    }
    if (filters?.origem) {
      where.origem = filters.origem as LeadComercial["origem"];
    }
    if (filters?.q?.trim()) {
      const q = filters.q.trim();
      where.OR = [
        { empresaNome: { contains: q, mode: "insensitive" } },
        { contactoNome: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { codigo: { contains: q, mode: "insensitive" } },
      ];
    }

    return this.prisma.leadComercial.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: LEAD_INCLUDE,
    });
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
    }

    const codigo = dto.codigo?.trim() || this.gerarCodigo();

    return this.prisma.leadComercial.create({
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
        atribuidoUserId: dto.atribuidoUserId ?? null,
      },
      include: LEAD_INCLUDE,
    });
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

    return this.prisma.leadComercial.update({
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
      },
      include: LEAD_INCLUDE,
    });
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

    return { lead: updatedLead, entidade, alreadyConverted: false };
  }

  async criarProposta(user: RequestUser, id: string, dto: CriarPropostaFromLeadDto) {
    const lead = await this.getOne(user, id);
    if (!lead.entidadeClienteId) {
      throw new BadRequestException("Converta o lead em entidade cliente primeiro.");
    }

    const titulo =
      dto.titulo?.trim() ||
      `Formação - ${lead.empresaNome}`.slice(0, 200);

    const proposta = await this.proposal.criarProposta(user, {
      entidadeClienteId: lead.entidadeClienteId,
      titulo,
      valorCentavos: dto.valorCentavos ?? lead.valorEstimadoCentavos,
      cursoId: dto.cursoId,
      notasInternas: lead.notas ?? undefined,
    });

    return { lead, proposta };
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
