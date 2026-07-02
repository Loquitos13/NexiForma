import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { InscricoesEstado, Prisma } from "@nexiforma/database";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "../common/tenant-scope";
import type {
  AgendaSessoesDto,
  CreateFormacaoAcaoDto,
  CreateFormacaoDto,
  UpdateFormacaoAcaoDto,
  UpdateFormacaoDto,
} from "./dto/formacoes.dto";
import {
  gerarDatasSessoes,
  parsePgDate,
  validarHorario,
  type AgendaTemplate,
} from "./formacoes-sessoes.util";
import { ConfigService } from "@nestjs/config";
import { EmailTemplates } from "../notificacoes/templates/email.templates";
import { PortalNotificacoesService } from "../notificacoes/portal-notificacoes.service";
import { FormacoesPublishService } from "./formacoes-publish.service";
import type { WebsiteSyncEvent } from "./formacoes-website.types";

const COVER_MAX_BYTES = 5 * 1024 * 1024;
const COVER_TYPES = ["image/png", "image/jpeg", "image/webp"];

@Injectable()
export class FormacoesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly publish: FormacoesPublishService,
    private readonly portalNotificacoes: PortalNotificacoesService,
    private readonly config: ConfigService,
  ) {}

  async list(user: RequestUser, opts?: { publicado?: boolean }) {
    const tenantId = requireTenantId(user);
    const rows = await this.prisma.curso.findMany({
      where: {
        tenantId,
        ...(opts?.publicado === true ? { publicado: true } : {}),
      },
      orderBy: [{ codigoPublico: "asc" }, { createdAt: "desc" }],
      include: {
        _count: { select: { acoesFormacao: true } },
      },
    });
    return rows.map((c) => this.mapFormacao(c));
  }

  async getOne(user: RequestUser, cursoId: string) {
    const curso = await this.loadCurso(user, cursoId);
    return this.mapFormacao(curso, true);
  }

  async listPublicas(tenantId: string) {
    const rows = await this.prisma.curso.findMany({
      where: { tenantId, publicado: true },
      orderBy: [{ codigoPublico: "asc" }, { createdAt: "desc" }],
      include: {
        _count: { select: { acoesFormacao: true } },
      },
    });
    return rows.map((c) => this.mapFormacao(c));
  }

  async getByCodigoPublico(tenantId: string, codigoPublico: number) {
    const curso = await this.prisma.curso.findFirst({
      where: { tenantId, codigoPublico, publicado: true },
      include: {
        _count: { select: { acoesFormacao: true } },
      },
    });
    if (!curso) {
      throw new NotFoundException("Formação não encontrada.");
    }
    return this.mapFormacao(curso, true);
  }

  async create(user: RequestUser, dto: CreateFormacaoDto) {
    const tenantId = requireTenantId(user);
    const codigoPublico = await this.nextCodigoPublico(tenantId);

    const curso = await this.prisma.curso.create({
      data: {
        tenantId,
        codigoPublico,
        designacao: dto.titulo.trim(),
        cargaHoras: dto.horas,
        codigoUfcd: dto.ufcd?.trim() || null,
        enquadramento: dto.enquadramento?.trim() || null,
        objetivos: dto.objetivos?.trim() || null,
        metodoEnsino: dto.metodoEnsino?.trim() || null,
        modalidade: dto.modalidade?.trim() || "presencial",
        publicado: dto.publicado ?? false,
      },
    });

    this.afterFormacaoChange(tenantId, curso.id, curso.publicado, "formacao.created");
    return this.mapFormacao(curso);
  }

  async update(user: RequestUser, cursoId: string, dto: UpdateFormacaoDto) {
    const existing = await this.loadCurso(user, cursoId);
    const curso = await this.prisma.curso.update({
      where: { id: cursoId },
      data: {
        ...(dto.titulo !== undefined ? { designacao: dto.titulo.trim() } : {}),
        ...(dto.horas !== undefined ? { cargaHoras: dto.horas } : {}),
        ...(dto.ufcd !== undefined ? { codigoUfcd: dto.ufcd.trim() || null } : {}),
        ...(dto.enquadramento !== undefined
          ? { enquadramento: dto.enquadramento.trim() || null }
          : {}),
        ...(dto.objetivos !== undefined ? { objetivos: dto.objetivos.trim() || null } : {}),
        ...(dto.metodoEnsino !== undefined
          ? { metodoEnsino: dto.metodoEnsino.trim() || null }
          : {}),
        ...(dto.modalidade !== undefined ? { modalidade: dto.modalidade.trim() } : {}),
        ...(dto.publicado !== undefined ? { publicado: dto.publicado } : {}),
      },
    });
    const tenantId = requireTenantId(user);
    const event: WebsiteSyncEvent =
      dto.publicado === true && !existing.publicado
        ? "formacao.published"
        : dto.publicado === false && existing.publicado
          ? "formacao.unpublished"
          : "formacao.updated";
    this.afterFormacaoChange(tenantId, curso.id, curso.publicado, event);

    if (existing.publicado) {
      const acaoCatalogo =
        dto.publicado === false && existing.publicado ? "despublicada" : "atualizada";
      void this.notificarGestoresCatalogo(
        tenantId,
        acaoCatalogo,
        curso.designacao,
        curso.codigoPublico,
      );
    }

    return this.mapFormacao(curso);
  }

  async setPublicado(user: RequestUser, cursoId: string, publicado: boolean) {
    return this.update(user, cursoId, { publicado });
  }

  async remove(user: RequestUser, cursoId: string) {
    const existing = await this.loadCurso(user, cursoId);
    const tenantId = requireTenantId(user);

    const acoesCount = await this.prisma.acaoFormacao.count({
      where: { tenantId, cursoId },
    });
    if (acoesCount > 0) {
      throw new BadRequestException(
        "Elimine primeiro as acções de formação associadas.",
      );
    }

    if (existing.publicado) {
      this.publish.scheduleFormacaoEvent(tenantId, "formacao.unpublished", cursoId);
      void this.notificarGestoresCatalogo(
        tenantId,
        "eliminada",
        existing.designacao,
        existing.codigoPublico,
      );
    }

    await this.prisma.curso.delete({ where: { id: cursoId } });
    return { ok: true, eliminada: true };
  }

  async uploadCapa(user: RequestUser, cursoId: string, file: Express.Multer.File) {
    const tenantId = requireTenantId(user);
    await this.loadCurso(user, cursoId);
    if (!file?.buffer?.length) {
      throw new BadRequestException("Imagem de capa em falta.");
    }
    if (!COVER_TYPES.includes(file.mimetype)) {
      throw new BadRequestException("Use PNG, JPEG ou WebP.");
    }
    if (file.buffer.byteLength > COVER_MAX_BYTES) {
      throw new BadRequestException("Imagem demasiado grande (máx. 5 MB).");
    }

    const ext =
      file.mimetype === "image/png" ? "png" : file.mimetype === "image/webp" ? "webp" : "jpg";
    const key = `tenants/${tenantId}/formacoes/${cursoId}/cover.${ext}`;
    await this.storage.putObject(key, file.buffer, file.mimetype);

    await this.prisma.curso.update({
      where: { id: cursoId },
      data: { coverStorageKey: key },
    });

    const curso = await this.prisma.curso.findUnique({
      where: { id: cursoId },
      select: { publicado: true },
    });
    if (curso?.publicado) {
      this.afterFormacaoChange(tenantId, cursoId, true, "formacao.updated");
    }

    return {
      capaUrl: `/api/v1/formacoes/${cursoId}/capa`,
      coverStorageKey: key,
    };
  }

  async streamCapa(user: RequestUser, cursoId: string) {
    const curso = await this.loadCurso(user, cursoId);
    if (!curso.coverStorageKey) {
      throw new NotFoundException("Esta formação não tem imagem de capa.");
    }
    const obj = await this.storage.getObject(curso.coverStorageKey);
    if (!obj) {
      throw new NotFoundException("Ficheiro de capa não encontrado.");
    }
    return obj;
  }

  async streamCapaPublica(tenantId: string, codigoPublico: number) {
    const curso = await this.prisma.curso.findFirst({
      where: { tenantId, codigoPublico, publicado: true },
      select: { coverStorageKey: true },
    });
    if (!curso?.coverStorageKey) {
      throw new NotFoundException("Capa não disponível.");
    }
    const obj = await this.storage.getObject(curso.coverStorageKey);
    if (!obj) {
      throw new NotFoundException("Ficheiro de capa não encontrado.");
    }
    return obj;
  }

  async listAcoes(user: RequestUser, cursoId: string) {
    await this.loadCurso(user, cursoId);
    const tenantId = requireTenantId(user);
    const acoes = await this.prisma.acaoFormacao.findMany({
      where: { tenantId, cursoId },
      orderBy: { dataInicio: "desc" },
      include: {
        turmas: {
          take: 1,
          orderBy: { codigo: "asc" },
          include: {
            _count: { select: { matriculas: { where: { estado: "ATIVA" } } } },
          },
        },
        cronogramas: {
          take: 1,
          orderBy: { versao: "desc" },
          include: {
            sessoes: {
              orderBy: { numeroSessao: "asc" },
              select: {
                id: true,
                numeroSessao: true,
                data: true,
                horaInicio: true,
                horaFim: true,
                local: true,
                estado: true,
              },
            },
          },
        },
      },
    });
    return acoes.map((a) => this.mapAcaoResumo(a));
  }

  async listAcoesPublicas(tenantId: string, codigoPublico: number) {
    const curso = await this.prisma.curso.findFirst({
      where: { tenantId, codigoPublico, publicado: true },
      select: { id: true },
    });
    if (!curso) {
      throw new NotFoundException("Formação não encontrada.");
    }
    const acoes = await this.prisma.acaoFormacao.findMany({
      where: { tenantId, cursoId: curso.id, publicado: true },
      orderBy: { dataInicio: "asc" },
      include: {
        turmas: {
          take: 1,
          orderBy: { codigo: "asc" },
          include: {
            _count: { select: { matriculas: { where: { estado: "ATIVA" } } } },
          },
        },
        cronogramas: {
          take: 1,
          orderBy: { versao: "desc" },
          include: {
            sessoes: {
              orderBy: { numeroSessao: "asc" },
              select: {
                id: true,
                numeroSessao: true,
                data: true,
                horaInicio: true,
                horaFim: true,
                local: true,
                estado: true,
              },
            },
          },
        },
      },
    });
    return acoes.map((a) => this.mapAcaoResumo(a));
  }

  async getAcao(user: RequestUser, cursoId: string, acaoId: string) {
    const acao = await this.loadAcao(user, cursoId, acaoId);
    return this.mapAcaoDetalhe(acao);
  }

  async createAcao(user: RequestUser, cursoId: string, dto: CreateFormacaoAcaoDto) {
    const tenantId = requireTenantId(user);
    const curso = await this.loadCurso(user, cursoId);
    const agenda = this.normalizeAgenda(dto.sessoes);

    const dataInicio = this.parseDateField(agenda.dataInicio, "dataInicio");
    const dataFim = this.parseDateField(agenda.dataFim, "dataFim");
    if (dataFim.getTime() < dataInicio.getTime()) {
      throw new BadRequestException("dataFim deve ser igual ou posterior a dataInicio.");
    }

    const datas = gerarDatasSessoes({
      dataInicio,
      dataFim,
      repete: agenda.repete,
      diasRepete: agenda.diasRepete,
    });
    if (!datas.length) {
      throw new BadRequestException("Nenhuma sessão gerada com as datas/repetição indicadas.");
    }

    const codigoInterno =
      dto.codigoInterno?.trim() ||
      `WEB-${curso.codigoPublico}-${dataInicio.getFullYear()}-${Date.now().toString(36).slice(-4).toUpperCase()}`;

    const clash = await this.prisma.acaoFormacao.findFirst({
      where: { tenantId, codigoInterno },
    });
    if (clash) {
      throw new ConflictException("codigoInterno já existe neste tenant.");
    }

    const titulo = dto.titulo?.trim() || curso.designacao;
    const inscricoesEstado = agenda.inscricoes as InscricoesEstado;
    const agendaTemplate: AgendaTemplate = agenda;

    const result = await this.prisma.$transaction(async (tx) => {
      const acao = await tx.acaoFormacao.create({
        data: {
          tenantId,
          cursoId,
          codigoInterno,
          titulo,
          dataInicio,
          dataFim,
          inscricoesEstado,
          publicado: dto.publicado ?? false,
          agendaTemplate: agendaTemplate as unknown as Prisma.InputJsonValue,
        },
      });

      await tx.turma.create({
        data: {
          tenantId,
          acaoFormacaoId: acao.id,
          codigo: "T1",
          nome: `Turma ${codigoInterno}`,
        },
      });

      const cronograma = await tx.cronograma.create({
        data: { tenantId, acaoFormacaoId: acao.id, versao: 1 },
      });

      await tx.sessaoFormacao.createMany({
        data: datas.map((data, idx) => ({
          tenantId,
          cronogramaId: cronograma.id,
          numeroSessao: idx + 1,
          data,
          horaInicio: agenda.horaInicio,
          horaFim: agenda.horaFim,
          local: agenda.local?.trim() || null,
          modalidade: curso.modalidade,
        })),
      });

      return acao.id;
    });

    const acao = await this.loadAcao(user, cursoId, result);
    this.afterFormacaoChange(
      tenantId,
      cursoId,
      curso.publicado || (dto.publicado ?? false),
      "acao.created",
    );
    return this.mapAcaoDetalhe(acao);
  }

  async updateAcao(
    user: RequestUser,
    cursoId: string,
    acaoId: string,
    dto: UpdateFormacaoAcaoDto,
  ) {
    const existing = await this.loadAcao(user, cursoId, acaoId);
    await this.prisma.acaoFormacao.update({
      where: { id: acaoId },
      data: {
        ...(dto.inscricoes !== undefined
          ? { inscricoesEstado: dto.inscricoes as InscricoesEstado }
          : {}),
        ...(dto.publicado !== undefined ? { publicado: dto.publicado } : {}),
        ...(dto.titulo !== undefined ? { titulo: dto.titulo.trim() } : {}),
      },
    });
    const acao = await this.loadAcao(user, cursoId, acaoId);
    const tenantId = requireTenantId(user);
    const cursoPub = await this.prisma.curso.findUnique({
      where: { id: cursoId },
      select: { publicado: true },
    });
    const event: WebsiteSyncEvent =
      dto.publicado === true && !existing.publicado
        ? "acao.published"
        : "acao.updated";
    if (cursoPub?.publicado || dto.publicado) {
      this.afterFormacaoChange(tenantId, cursoId, true, event);
    }
    return this.mapAcaoDetalhe(acao);
  }

  private afterFormacaoChange(
    tenantId: string,
    cursoUuid: string,
    isPublic: boolean,
    event: WebsiteSyncEvent,
  ) {
    if (!isPublic && event !== "formacao.unpublished") return;
    this.publish.scheduleFormacaoEvent(tenantId, event, cursoUuid);
  }

  private async notificarGestoresCatalogo(
    tenantId: string,
    acao: "atualizada" | "eliminada" | "despublicada",
    titulo: string,
    codigoPublico: number | null,
  ) {
    const appUrl = this.config.get<string>("APP_PUBLIC_URL") ?? "http://localhost:3000";
    const portalUrl = `${appUrl}/portal/formacoes`;
    await this.portalNotificacoes.notifyGestores(tenantId, {
      tipo: "formacao_catalogo",
      titulo: `Formação ${acao} no catálogo`,
      mensagem: `«${titulo}» foi ${acao}.`,
      link: "/portal/formacoes",
      buildEmail: (g) =>
        EmailTemplates.formacaoCatalogoGestor({
          gestorNome: g.displayName,
          acao,
          titulo,
          codigoPublico,
          portalUrl,
        }),
    });
  }

  private async nextCodigoPublico(tenantId: string): Promise<number> {
    const agg = await this.prisma.curso.aggregate({
      where: { tenantId },
      _max: { codigoPublico: true },
    });
    return (agg._max.codigoPublico ?? 0) + 1;
  }

  private normalizeAgenda(dto: AgendaSessoesDto): AgendaTemplate {
    try {
      validarHorario(dto.horaInicio, "horaInicio");
      validarHorario(dto.horaFim, "horaFim");
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : "Horário inválido.");
    }
    if (dto.horaFim <= dto.horaInicio) {
      throw new BadRequestException("horaFim deve ser posterior a horaInicio.");
    }
    return {
      dataInicio: dto.dataInicio,
      dataFim: dto.dataFim,
      horaInicio: dto.horaInicio,
      horaFim: dto.horaFim,
      repete: dto.repete ?? false,
      diasRepete: dto.diasRepete,
      local: dto.local,
      inscricoes: dto.inscricoes,
    };
  }

  private parseDateField(raw: string, field: string): Date {
    try {
      return parsePgDate(raw, field);
    } catch {
      throw new BadRequestException(`Data inválida (${field}).`);
    }
  }

  private async loadCurso(user: RequestUser, cursoId: string) {
    const tenantId = requireTenantId(user);
    const curso = await this.prisma.curso.findFirst({
      where: { id: cursoId, tenantId },
    });
    if (!curso) {
      throw new NotFoundException("Formação não encontrada.");
    }
    return curso;
  }

  private async loadAcao(user: RequestUser, cursoId: string, acaoId: string) {
    const tenantId = requireTenantId(user);
    const acao = await this.prisma.acaoFormacao.findFirst({
      where: { id: acaoId, tenantId, cursoId },
      include: {
        turmas: {
          orderBy: { codigo: "asc" },
          include: {
            matriculas: {
              where: { estado: "ATIVA" },
              orderBy: { dataInscricao: "asc" },
              include: {
                formando: {
                  select: { id: true, nome: true, email: true, nif: true },
                },
              },
            },
          },
        },
        cronogramas: {
          orderBy: { versao: "desc" },
          take: 1,
          include: {
            sessoes: {
              orderBy: { numeroSessao: "asc" },
            },
          },
        },
      },
    });
    if (!acao) {
      throw new NotFoundException("Acção de formação não encontrada.");
    }
    return acao;
  }

  private mapFormacao(
    c: {
      id: string;
      codigoPublico: number | null;
      designacao: string;
      cargaHoras: number;
      codigoUfcd: string | null;
      enquadramento: string | null;
      objetivos: string | null;
      metodoEnsino: string | null;
      modalidade: string;
      coverStorageKey: string | null;
      publicado: boolean;
      createdAt: Date;
      _count?: { acoesFormacao: number };
    },
    detalhe = false,
  ) {
    return {
      id: c.codigoPublico ?? c.id,
      uuid: c.id,
      codigoPublico: c.codigoPublico,
      titulo: c.designacao,
      horas: c.cargaHoras,
      ufcd: c.codigoUfcd,
      enquadramento: c.enquadramento,
      objetivos: c.objetivos,
      metodoEnsino: c.metodoEnsino,
      modalidade: c.modalidade,
      publicado: c.publicado,
      capaUrl: c.coverStorageKey ? `/api/v1/formacoes/${c.id}/capa` : null,
      ...(detalhe ? {} : {}),
      totalAcoes: c._count?.acoesFormacao,
      createdAt: c.createdAt.toISOString(),
    };
  }

  private mapAcaoResumo(a: {
    id: string;
    codigoInterno: string;
    titulo: string;
    dataInicio: Date;
    dataFim: Date;
    estado: string;
    inscricoesEstado: InscricoesEstado;
    publicado: boolean;
    agendaTemplate: unknown;
    turmas: Array<{ _count: { matriculas: number } }>;
    cronogramas: Array<{
      sessoes: Array<{
        id: string;
        numeroSessao: number;
        data: Date;
        horaInicio: string;
        horaFim: string;
        local: string | null;
        estado: string;
      }>;
    }>;
  }) {
    const sessoes = a.cronogramas[0]?.sessoes ?? [];
    const inscritos = a.turmas[0]?._count.matriculas ?? 0;
    return {
      id: a.id,
      codigoInterno: a.codigoInterno,
      titulo: a.titulo,
      dataInicio: a.dataInicio.toISOString().slice(0, 10),
      dataFim: a.dataFim.toISOString().slice(0, 10),
      estado: a.estado,
      inscricoes: a.inscricoesEstado,
      publicado: a.publicado,
      agenda: a.agendaTemplate,
      totalSessoes: sessoes.length,
      proximasSessoes: sessoes.slice(0, 5).map((s) => this.mapSessao(s)),
      inscritos,
    };
  }

  private mapAcaoDetalhe(a: Awaited<ReturnType<FormacoesService["loadAcao"]>>) {
    const turma = a.turmas[0];
    const sessoes = a.cronogramas[0]?.sessoes ?? [];
    const inscritos =
      turma?.matriculas.map((m) => ({
        matriculaId: m.id,
        dataInscricao: m.dataInscricao.toISOString(),
        formando: {
          id: m.formando.id,
          nome: m.formando.nome,
          email: m.formando.email,
          nif: m.formando.nif,
        },
      })) ?? [];

    return {
      ...this.mapAcaoResumo({
        ...a,
        turmas: turma ? [{ _count: { matriculas: inscritos.length } }] : [],
        cronogramas: a.cronogramas,
      }),
      sessoes: sessoes.map((s) => this.mapSessao(s)),
      inscritos,
    };
  }

  private mapSessao(s: {
    id: string;
    numeroSessao: number;
    data: Date;
    horaInicio: string;
    horaFim: string;
    local: string | null;
    estado: string;
  }) {
    return {
      id: s.id,
      numero: s.numeroSessao,
      data: s.data.toISOString().slice(0, 10),
      horaInicio: s.horaInicio,
      horaFim: s.horaFim,
      local: s.local,
      estado: s.estado,
    };
  }
}
