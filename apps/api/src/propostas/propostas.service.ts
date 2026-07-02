import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { PropostaComercial, PropostaEstado } from "@nexiforma/database";
import { PrismaService } from "../prisma/prisma.service";
import { PropostaNotificacoesService } from "../notificacoes/proposta-notificacoes.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "../common/tenant-scope";
import type { CreatePropostaDto, UpdatePropostaDto } from "./dto/proposta.dto";
import type { UpdateConfigPropostaDto } from "./dto/proposta-config.dto";
import type { PropostaLinhaDto } from "./dto/proposta-linha.dto";
import { buildPropostaHtmlDocument } from "./proposta-html.util";
import {
  DEFAULTS_PROPOSTA_TEMPLATE,
  configRowToTemplate,
  extractPropostaConteudo,
  type ConfigPropostaTemplate,
} from "./proposta-template.util";
import {
  normalizePropostaLinhas,
  totaisPropostaLinhas,
} from "./proposta-linhas.util";

const PROPOSTA_INCLUDE = {
  entidadeCliente: { select: { id: true, nome: true, nif: true, email: true } },
  curso: { select: { id: true, designacao: true, codigoUfcd: true, cargaHoras: true } },
  fatura: { select: { id: true, estado: true } },
  linhas: { orderBy: { ordem: "asc" as const } },
};

@Injectable()
export class PropostasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly propostaNotificacoes: PropostaNotificacoesService,
  ) {}

  list(user: RequestUser, entidadeClienteId?: string): Promise<PropostaComercial[]> {
    const tenantId = requireTenantId(user);
    return this.prisma.propostaComercial.findMany({
      where: {
        tenantId,
        ...(entidadeClienteId ? { entidadeClienteId } : {}),
      },
      orderBy: { updatedAt: "desc" },
      include: PROPOSTA_INCLUDE,
    }) as Promise<PropostaComercial[]>;
  }

  async getOne(user: RequestUser, id: string): Promise<PropostaComercial> {
    const tenantId = requireTenantId(user);
    const row = await this.prisma.propostaComercial.findFirst({
      where: { id, tenantId },
      include: PROPOSTA_INCLUDE,
    });
    if (!row) {
      throw new NotFoundException("Proposta não encontrada.");
    }
    return row;
  }

  async getConfig(user: RequestUser) {
    const tenantId = requireTenantId(user);
    const config = await this.ensureConfigProposta(tenantId);
    return { config: this.toConfigTemplate(config) };
  }

  async updateConfig(user: RequestUser, dto: UpdateConfigPropostaDto) {
    const tenantId = requireTenantId(user);
    const existing = await this.ensureConfigProposta(tenantId);
    const config = await this.prisma.configPropostaTenant.update({
      where: { tenantId },
      data: {
        apresentacaoEmpresa:
          dto.apresentacaoEmpresa !== undefined
            ? dto.apresentacaoEmpresa?.trim() || null
            : existing.apresentacaoEmpresa,
        enquadramentoPadrao:
          dto.enquadramentoPadrao !== undefined
            ? dto.enquadramentoPadrao?.trim() || null
            : existing.enquadramentoPadrao,
        objetivosPadrao:
          dto.objetivosPadrao !== undefined
            ? dto.objetivosPadrao?.trim() || null
            : existing.objetivosPadrao,
        conteudosProgramaticosPadrao:
          dto.conteudosProgramaticosPadrao !== undefined
            ? dto.conteudosProgramaticosPadrao?.trim() || null
            : existing.conteudosProgramaticosPadrao,
        metodologiaPadrao:
          dto.metodologiaPadrao !== undefined
            ? dto.metodologiaPadrao?.trim() || null
            : existing.metodologiaPadrao,
        destinatariosPadrao:
          dto.destinatariosPadrao !== undefined
            ? dto.destinatariosPadrao?.trim() || null
            : existing.destinatariosPadrao,
        duracaoTextoPadrao:
          dto.duracaoTextoPadrao !== undefined
            ? dto.duracaoTextoPadrao?.trim() || null
            : existing.duracaoTextoPadrao,
        localTextoPadrao:
          dto.localTextoPadrao !== undefined
            ? dto.localTextoPadrao?.trim() || null
            : existing.localTextoPadrao,
        beneficiosPadrao:
          dto.beneficiosPadrao !== undefined
            ? dto.beneficiosPadrao?.trim() || null
            : existing.beneficiosPadrao,
        condicoesComerciaisPadrao:
          dto.condicoesComerciaisPadrao !== undefined
            ? dto.condicoesComerciaisPadrao?.trim() || null
            : existing.condicoesComerciaisPadrao,
        porqueEscolherPadrao:
          dto.porqueEscolherPadrao !== undefined
            ? dto.porqueEscolherPadrao?.trim() || null
            : existing.porqueEscolherPadrao,
        proximosPassosPadrao:
          dto.proximosPassosPadrao !== undefined
            ? dto.proximosPassosPadrao?.trim() || null
            : existing.proximosPassosPadrao,
        validadeDiasPadrao: dto.validadeDiasPadrao ?? existing.validadeDiasPadrao,
        nomeContacto:
          dto.nomeContacto !== undefined ? dto.nomeContacto?.trim() || null : existing.nomeContacto,
        emailContacto:
          dto.emailContacto !== undefined
            ? dto.emailContacto?.trim() || null
            : existing.emailContacto,
        telefoneContacto:
          dto.telefoneContacto !== undefined
            ? dto.telefoneContacto?.trim() || null
            : existing.telefoneContacto,
        website: dto.website !== undefined ? dto.website?.trim() || null : existing.website,
      },
    });
    return { config: this.toConfigTemplate(config) };
  }

  async create(user: RequestUser, dto: CreatePropostaDto): Promise<PropostaComercial> {
    const tenantId = requireTenantId(user);
    await this.assertEntidade(tenantId, dto.entidadeClienteId);
    if (dto.cursoId) {
      await this.assertCurso(tenantId, dto.cursoId);
    }

    const config = await this.ensureConfigProposta(tenantId);
    const codigo = (dto.codigo?.trim() || `PROP-${Date.now().toString(36).toUpperCase()}`).toUpperCase();
    const dup = await this.prisma.propostaComercial.findFirst({ where: { tenantId, codigo } });
    if (dup) {
      throw new ConflictException("Código de proposta já existe.");
    }

    const linhasNorm = this.parseLinhasDto(dto.linhas);
    const valorCentavos = linhasNorm.length
      ? totaisPropostaLinhas(linhasNorm).valorCentavos
      : (dto.valorCentavos ?? 0);

    let validadeAte: Date | null = dto.validadeAte ? new Date(dto.validadeAte) : null;
    if (!validadeAte && config.validadeDiasPadrao > 0) {
      validadeAte = new Date();
      validadeAte.setDate(validadeAte.getDate() + config.validadeDiasPadrao);
    }

    return this.prisma.propostaComercial.create({
      data: {
        tenantId,
        entidadeClienteId: dto.entidadeClienteId,
        codigo,
        titulo: dto.titulo.trim(),
        subtitulo: dto.subtitulo?.trim() || null,
        descricao: dto.descricao?.trim() || null,
        ...this.mapConteudoFromDto(dto),
        valorCentavos,
        validadeAte,
        cursoId: dto.cursoId ?? null,
        notasInternas: dto.notasInternas?.trim() || null,
        ...(linhasNorm.length
          ? {
              linhas: {
                create: linhasNorm.map((l, i) => ({
                  ordem: i + 1,
                  descricao: l.descricao,
                  notas: l.notas,
                  quantidade: l.quantidade,
                  precoUnitCentavos: l.precoUnitCentavos,
                  taxaIva: l.taxaIva,
                  valorIvaCentavos: l.valorIvaCentavos,
                })),
              },
            }
          : {}),
      },
      include: PROPOSTA_INCLUDE,
    });
  }

  async update(user: RequestUser, id: string, dto: UpdatePropostaDto): Promise<PropostaComercial> {
    const tenantId = requireTenantId(user);
    const existing = await this.prisma.propostaComercial.findFirst({
      where: { id, tenantId },
      include: { linhas: true },
    });
    if (!existing) {
      throw new NotFoundException("Proposta não encontrada.");
    }
    if (dto.cursoId) {
      await this.assertCurso(tenantId, dto.cursoId);
    }

    const linhasNorm = dto.linhas !== undefined ? this.parseLinhasDto(dto.linhas) : null;
    const valorCentavos =
      linhasNorm && linhasNorm.length > 0
        ? totaisPropostaLinhas(linhasNorm).valorCentavos
        : (dto.valorCentavos ?? existing.valorCentavos);

    const estadoNovo = (dto.estado as PropostaEstado | undefined) ?? existing.estado;
    const conteudoPatch = this.mapConteudoFromDto(dto as Partial<CreatePropostaDto>, existing);

    await this.prisma.$transaction(async (tx) => {
      if (linhasNorm !== null) {
        await tx.propostaLinha.deleteMany({ where: { propostaId: id } });
        if (linhasNorm.length > 0) {
          await tx.propostaLinha.createMany({
            data: linhasNorm.map((l, i) => ({
              propostaId: id,
              ordem: i + 1,
              descricao: l.descricao,
              notas: l.notas,
              quantidade: l.quantidade,
              precoUnitCentavos: l.precoUnitCentavos,
              taxaIva: l.taxaIva,
              valorIvaCentavos: l.valorIvaCentavos,
            })),
          });
        }
      }

      await tx.propostaComercial.update({
        where: { id },
        data: {
          titulo: dto.titulo?.trim() ?? existing.titulo,
          subtitulo:
            dto.subtitulo !== undefined ? dto.subtitulo?.trim() || null : existing.subtitulo,
          descricao: dto.descricao !== undefined ? dto.descricao?.trim() || null : existing.descricao,
          ...conteudoPatch,
          valorCentavos,
          estado: estadoNovo,
          validadeAte:
            dto.validadeAte !== undefined
              ? dto.validadeAte
                ? new Date(dto.validadeAte)
                : null
              : existing.validadeAte,
          cursoId: dto.cursoId !== undefined ? dto.cursoId : existing.cursoId,
          notasInternas:
            dto.notasInternas !== undefined ? dto.notasInternas?.trim() || null : existing.notasInternas,
        },
      });
    });

    if (estadoNovo !== existing.estado) {
      await this.propostaNotificacoes.aoAlterarEstado(
        tenantId,
        id,
        existing.estado,
        estadoNovo,
      );
    }

    return this.getOne(user, id);
  }

  resumo(user: RequestUser) {
    const tenantId = requireTenantId(user);
    return this.prisma.propostaComercial.groupBy({
      by: ["estado"],
      where: { tenantId },
      _count: { _all: true },
      _sum: { valorCentavos: true },
    });
  }

  async buildPropostaHtml(user: RequestUser, id: string) {
    const tenantId = requireTenantId(user);
    const [row, configRow] = await Promise.all([
      this.prisma.propostaComercial.findFirst({
        where: { id, tenantId },
        include: {
          tenant: { select: { legalName: true, nif: true } },
          entidadeCliente: { select: { nome: true, nif: true, email: true } },
          curso: { select: { designacao: true, codigoUfcd: true, cargaHoras: true } },
          linhas: { orderBy: { ordem: "asc" } },
        },
      }),
      this.ensureConfigProposta(tenantId),
    ]);
    if (!row) {
      throw new NotFoundException("Proposta não encontrada.");
    }

    return buildPropostaHtmlDocument({
      codigo: row.codigo,
      titulo: row.titulo,
      subtitulo: row.subtitulo,
      descricao: row.descricao,
      moeda: row.moeda,
      valorCentavos: row.valorCentavos,
      validadeAte: row.validadeAte,
      createdAt: row.createdAt,
      tenant: row.tenant,
      entidadeCliente: row.entidadeCliente,
      curso: row.curso,
      conteudo: extractPropostaConteudo(row),
      config: this.toConfigTemplate(configRow),
      linhas: row.linhas.map((l: (typeof row.linhas)[number]) => ({
        descricao: l.descricao,
        notas: l.notas,
        quantidade: Number(l.quantidade),
        precoUnitCentavos: l.precoUnitCentavos,
        taxaIva: Number(l.taxaIva),
        valorIvaCentavos: l.valorIvaCentavos,
      })),
    });
  }

  private mapConteudoFromDto(
    dto: Partial<CreatePropostaDto>,
    existing?: {
      apresentacaoEmpresa: string | null;
      enquadramento: string | null;
      objetivos: string | null;
      conteudosProgramaticos: string | null;
      metodologia: string | null;
      destinatarios: string | null;
      duracaoTexto: string | null;
      localTexto: string | null;
      beneficios: string | null;
      condicoesComerciais: string | null;
      porqueEscolher: string | null;
      proximosPassos: string | null;
    },
  ) {
    const trim = (v: string | null | undefined) =>
      v !== undefined ? v?.trim() || null : undefined;
    return {
      apresentacaoEmpresa:
        trim(dto.apresentacaoEmpresa) ?? existing?.apresentacaoEmpresa ?? undefined,
      enquadramento: trim(dto.enquadramento) ?? existing?.enquadramento ?? undefined,
      objetivos: trim(dto.objetivos) ?? existing?.objetivos ?? undefined,
      conteudosProgramaticos:
        trim(dto.conteudosProgramaticos) ?? existing?.conteudosProgramaticos ?? undefined,
      metodologia: trim(dto.metodologia) ?? existing?.metodologia ?? undefined,
      destinatarios: trim(dto.destinatarios) ?? existing?.destinatarios ?? undefined,
      duracaoTexto: trim(dto.duracaoTexto) ?? existing?.duracaoTexto ?? undefined,
      localTexto: trim(dto.localTexto) ?? existing?.localTexto ?? undefined,
      beneficios: trim(dto.beneficios) ?? existing?.beneficios ?? undefined,
      condicoesComerciais:
        trim(dto.condicoesComerciais) ?? existing?.condicoesComerciais ?? undefined,
      porqueEscolher: trim(dto.porqueEscolher) ?? existing?.porqueEscolher ?? undefined,
      proximosPassos: trim(dto.proximosPassos) ?? existing?.proximosPassos ?? undefined,
    };
  }

  private toConfigTemplate(row: Parameters<typeof configRowToTemplate>[0]): ConfigPropostaTemplate {
    return configRowToTemplate(row);
  }

  private async ensureConfigProposta(tenantId: string) {
    const existing = await this.prisma.configPropostaTenant.findUnique({ where: { tenantId } });
    if (existing) return existing;

    return this.prisma.configPropostaTenant.create({
      data: {
        tenantId,
        ...DEFAULTS_PROPOSTA_TEMPLATE,
        validadeDiasPadrao: 30,
      },
    });
  }

  private parseLinhasDto(linhas: PropostaLinhaDto[] | undefined) {
    if (!linhas?.length) return [];
    return normalizePropostaLinhas(
      linhas.map((l) => ({
        descricao: l.descricao,
        notas: l.notas ?? null,
        quantidade: l.quantidade ?? 1,
        precoUnitCentavos: l.precoUnitCentavos,
        taxaIva: l.taxaIva ?? 23,
      })),
    );
  }

  private async assertEntidade(tenantId: string, id: string) {
    const ec = await this.prisma.entidadeCliente.findFirst({ where: { id, tenantId } });
    if (!ec) {
      throw new NotFoundException("Entidade cliente não encontrada.");
    }
  }

  private async assertCurso(tenantId: string, id: string) {
    const curso = await this.prisma.curso.findFirst({ where: { id, tenantId } });
    if (!curso) {
      throw new NotFoundException("Curso não encontrado.");
    }
  }
}
