import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  isEstadoPresenca,
  presenteFromEstado,
} from "@nexiforma/shared";
import type { FolhaPresenca, Presenca } from "@nexiforma/database";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { FormadorScopeService } from "../common/formador-scope.service";
import { requireTenantId } from "../common/tenant-scope";
import type { CreateFolhaPresencaDto } from "./dto/create-folha-presenca.dto";
import type { UpdatePresencaDto } from "./dto/update-presenca.dto";

@Injectable()
export class FolhasPresencaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly formadorScope: FormadorScopeService,
  ) {}

  async listBySessao(user: RequestUser, sessaoId: string, turmaId?: string) {
    const tenantId = requireTenantId(user);
    await this.formadorScope.assertCanAccessSessao(user, sessaoId);

    return this.prisma.folhaPresenca.findMany({
      where: {
        tenantId,
        sessaoId,
        ...(turmaId ? { turmaId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        turmaId: true,
        origem: true,
        fechadaEm: true,
        validadaFormadorEm: true,
        aprovadaGestorEm: true,
        createdAt: true,
        turma: { select: { codigo: true, nome: true } },
        _count: { select: { presencas: true } },
      },
    });
  }

  async getDetail(user: RequestUser, id: string) {
    const tenantId = requireTenantId(user);
    const folha = await this.prisma.folhaPresenca.findFirst({
      where: { id, tenantId },
      include: {
        turma: { select: { id: true, codigo: true, nome: true } },
        sessao: {
          select: {
            numeroSessao: true,
            data: true,
            horaInicio: true,
            horaFim: true,
            iniciadaEm: true,
            terminadaEm: true,
            formadorPresente: true,
            formador: { select: { id: true, nomeCompleto: true } },
          },
        },
        presencas: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            presente: true,
            estado: true,
            motivoJustificacao: true,
            minutosEfetivos: true,
            validado: true,
            origem: true,
            matricula: {
              select: {
                id: true,
                formando: { select: { nome: true, nif: true } },
              },
            },
          },
        },
      },
    });
    if (!folha) {
      throw new NotFoundException("Folha de presença não encontrada.");
    }
    await this.formadorScope.assertCanAccessSessao(user, folha.sessaoId);
    return folha;
  }

  async create(user: RequestUser, dto: CreateFolhaPresencaDto): Promise<FolhaPresenca> {
    const tenantId = requireTenantId(user);
    await this.formadorScope.assertCanAccessSessao(user, dto.sessaoId);

    const sessao = await this.prisma.sessaoFormacao.findFirst({
      where: { id: dto.sessaoId, tenantId },
      include: { cronograma: { select: { acaoFormacaoId: true } } },
    });
    if (!sessao) {
      throw new NotFoundException("Sessão inexistente ou de outro tenant.");
    }

    const turma = await this.prisma.turma.findFirst({
      where: { id: dto.turmaId, tenantId },
    });
    if (!turma) {
      throw new NotFoundException("Turma inexistente ou de outro tenant.");
    }

    if (turma.acaoFormacaoId !== sessao.cronograma.acaoFormacaoId) {
      throw new BadRequestException(
        "A turma não pertence à mesma acção de formação que a sessão.",
      );
    }

    const existente = await this.prisma.folhaPresenca.findFirst({
      where: { tenantId, sessaoId: dto.sessaoId, turmaId: dto.turmaId },
    });
    if (existente) {
      return existente;
    }

    const matriculas = await this.prisma.matricula.findMany({
      where: {
        tenantId,
        turmaId: dto.turmaId,
        estado: "ATIVA",
      },
      select: { id: true },
    });

    if (matriculas.length === 0) {
      throw new BadRequestException("A turma não tem matrículas activas.");
    }

    const origem = dto.origem?.trim() || "manual";

    return this.prisma.$transaction(async (tx) => {
      const folha = await tx.folhaPresenca.create({
        data: {
          tenantId,
          sessaoId: dto.sessaoId,
          turmaId: dto.turmaId,
          origem,
        },
      });

      await tx.presenca.createMany({
        data: matriculas.map((m) => ({
          tenantId,
          folhaPresencaId: folha.id,
          matriculaId: m.id,
          presente: false,
          origem,
        })),
        skipDuplicates: true,
      });

      return folha;
    });
  }

  /** Formador valida e fecha a folha (registo final de assiduidade). */
  async validarFormador(user: RequestUser, id: string): Promise<FolhaPresenca> {
    const tenantId = requireTenantId(user);
    const folha = await this.prisma.folhaPresenca.findFirst({
      where: { id, tenantId },
      include: { presencas: true },
    });
    if (!folha) {
      throw new NotFoundException("Folha de presença não encontrada.");
    }
    await this.formadorScope.assertCanAccessSessao(user, folha.sessaoId);

    for (const p of folha.presencas) {
      const estado = p.estado;
      if (!isEstadoPresenca(estado)) {
        throw new BadRequestException(
          "Todos os formandos devem ter presença, falta justificada ou falta injustificada assinalada.",
        );
      }
      if (estado === "FALTA_JUSTIFICADA" && !p.motivoJustificacao?.trim()) {
        throw new BadRequestException(
          "Indique o motivo para cada falta justificada.",
        );
      }
    }

    return this.prisma.folhaPresenca.update({
      where: { id: folha.id },
      data: {
        validadaFormadorEm: new Date(),
        validadaFormadorPor: user.sub,
        fechadaEm: new Date(),
        aprovadaGestorEm: null,
        aprovadaGestorPor: null,
      },
    });
  }

  /** Gestor aprova folha já validada pelo formador. */
  async aprovarGestor(user: RequestUser, id: string): Promise<FolhaPresenca> {
    const tenantId = requireTenantId(user);
    const folha = await this.prisma.folhaPresenca.findFirst({
      where: { id, tenantId },
    });
    if (!folha) {
      throw new NotFoundException("Folha de presença não encontrada.");
    }
    if (!folha.validadaFormadorEm) {
      throw new BadRequestException(
        "A folha tem de ser validada pelo formador antes da aprovação do gestor.",
      );
    }

    return this.prisma.folhaPresenca.update({
      where: { id: folha.id },
      data: {
        aprovadaGestorEm: new Date(),
        aprovadaGestorPor: user.sub,
        fechadaEm: new Date(),
      },
    });
  }

  async fechar(user: RequestUser, id: string): Promise<FolhaPresenca> {
    return this.aprovarGestor(user, id);
  }

  async updatePresenca(
    user: RequestUser,
    presencaId: string,
    dto: UpdatePresencaDto,
  ): Promise<Presenca> {
    const tenantId = requireTenantId(user);

    const presenca = await this.prisma.presenca.findFirst({
      where: { id: presencaId, tenantId },
      include: { folhaPresenca: true },
    });
    if (!presenca) {
      throw new NotFoundException("Registo de presença não encontrado.");
    }
    await this.formadorScope.assertCanAccessSessao(user, presenca.folhaPresenca.sessaoId);

    const data: {
      presente?: boolean;
      estado?: string | null;
      motivoJustificacao?: string | null;
      minutosEfetivos?: number | null;
      validado?: boolean;
    } = {};

    if (dto.estado !== undefined) {
      if (dto.estado === null) {
        data.estado = null;
        data.presente = false;
        data.validado = false;
        data.motivoJustificacao = null;
      } else {
        if (!isEstadoPresenca(dto.estado)) {
          throw new BadRequestException("Estado de presença inválido.");
        }
        if (dto.estado === "FALTA_JUSTIFICADA") {
          const motivo = dto.motivoJustificacao ?? presenca.motivoJustificacao;
          if (!motivo?.trim()) {
            throw new BadRequestException(
              "Indique o motivo da falta justificada.",
            );
          }
        }
        data.estado = dto.estado;
        data.presente = presenteFromEstado(dto.estado);
        data.validado = true;
        if (dto.estado !== "FALTA_JUSTIFICADA") {
          data.motivoJustificacao = null;
        }
      }
    }

    if (dto.motivoJustificacao !== undefined) {
      data.motivoJustificacao = dto.motivoJustificacao;
    }

    if (dto.presente !== undefined && dto.estado === undefined) {
      data.presente = dto.presente;
      data.estado = dto.presente ? "PRESENTE" : "FALTA_INJUSTIFICADA";
      data.validado = true;
    }
    if (dto.minutosEfetivos !== undefined) data.minutosEfetivos = dto.minutosEfetivos;
    if (dto.validado !== undefined) data.validado = dto.validado;

    if (!Object.keys(data).length) {
      throw new BadRequestException("Nenhum campo para actualizar.");
    }

    const folhaUpdate =
      presenca.folhaPresenca.aprovadaGestorEm || presenca.folhaPresenca.validadaFormadorEm
        ? {
            aprovadaGestorEm: null as Date | null,
            aprovadaGestorPor: null as string | null,
            validadaFormadorEm: null as Date | null,
            validadaFormadorPor: null as string | null,
            fechadaEm: null as Date | null,
          }
        : null;

    return this.prisma.$transaction(async (tx) => {
      if (folhaUpdate) {
        await tx.folhaPresenca.update({
          where: { id: presenca.folhaPresencaId },
          data: folhaUpdate,
        });
      }
      return tx.presenca.update({
        where: { id: presencaId },
        data,
      });
    });
  }
}
