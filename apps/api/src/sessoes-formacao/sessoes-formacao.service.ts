import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from "@nestjs/common";
import type { SessaoFormacao } from "@nexiforma/database";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { FormadorScopeService } from "../common/formador-scope.service";
import { requireTenantId } from "../common/tenant-scope";
import { NotificacoesExtendedService } from "../notificacoes/notificacoes-extended.service";
import { AssiduidadeService } from "../assiduidade/assiduidade.service";
import { LmsService } from "../lms/lms.service";
import { IntegracoesService } from "../integracoes/integracoes.service";
import { isModalidadeOnline, resolveSalaOnline } from "../lms/sessao-sala.util";
import type { CreateSessaoFormacaoDto } from "./dto/create-sessao-formacao.dto";
import type { UpdateSessaoFormacaoDto } from "./dto/update-sessao-formacao.dto";
import { CalendarioNotificacoesService } from "../calendario/calendario-notificacoes.service";

function toPgDate(raw: string, field: string): Date {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException(`Data inválida (${field}).`);
  }
  return d;
}

function compareHhMm(a: string, b: string): number {
  const [ah, am] = a.split(":").map(Number);
  const [bh, bm] = b.split(":").map(Number);
  return ah * 60 + am - (bh * 60 + bm);
}

@Injectable()
export class SessoesFormacaoService {
  private readonly logger = new Logger(SessoesFormacaoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificacoes: NotificacoesExtendedService,
    private readonly lms: LmsService,
    private readonly assiduidade: AssiduidadeService,
    private readonly formadorScope: FormadorScopeService,
    private readonly calendarioNotificacoes: CalendarioNotificacoesService,
    @Inject(forwardRef(() => IntegracoesService))
    private readonly integracoes: IntegracoesService,
  ) {}

  private sessaoSemSala(sessao: {
    salaJoinUrl: string | null;
    zoomMeetingId: string | null;
    teamsMeetingId: string | null;
  }): boolean {
    return !sessao.salaJoinUrl && !sessao.zoomMeetingId && !sessao.teamsMeetingId;
  }

  private async ensureSalaOnline(
    tenantId: string,
    sessao: Pick<SessaoFormacao, "id" | "modalidade" | "numeroSessao" | "salaJoinUrl" | "zoomMeetingId" | "teamsMeetingId">,
  ): Promise<void> {
    if (!isModalidadeOnline(sessao.modalidade) || !this.sessaoSemSala(sessao)) return;
    await this.integracoes.provisionSalaAoCriarSessao(
      tenantId,
      sessao.id,
      sessao.modalidade,
    );
  }

  list(user: RequestUser, cronogramaId?: string) {
    const tenantId = requireTenantId(user);
    return this.prisma.sessaoFormacao.findMany({
      where: {
        tenantId,
        ...(cronogramaId ? { cronogramaId } : {}),
      },
      orderBy: [{ cronogramaId: "asc" }, { numeroSessao: "asc" }],
      take: 120,
      select: {
        id: true,
        numeroSessao: true,
        data: true,
        horaInicio: true,
        horaFim: true,
        modalidade: true,
        estado: true,
        lmsAtivo: true,
        iniciadaEm: true,
        terminadaEm: true,
        formadorPresente: true,
        zoomMeetingId: true,
        teamsMeetingId: true,
        salaJoinUrl: true,
        minutosPresencaMin: true,
        cronogramaId: true,
        formador: {
          select: { id: true, nomeCompleto: true },
        },
        moduloUnidade: {
          select: { id: true, codigo: true, titulo: true },
        },
        _count: { select: { folhasPresenca: true } },
      },
    });
  }

  async create(user: RequestUser, dto: CreateSessaoFormacaoDto): Promise<SessaoFormacao> {
    const tenantId = requireTenantId(user);

    const cronograma = await this.prisma.cronograma.findFirst({
      where: { id: dto.cronogramaId, tenantId },
      select: { id: true, acaoFormacaoId: true },
    });
    if (!cronograma) {
      throw new NotFoundException("Cronograma inexistente ou de outro tenant.");
    }

    await this.formadorScope.assertCanAccessAcao(user, cronograma.acaoFormacaoId);

    if (compareHhMm(dto.horaFim, dto.horaInicio) <= 0) {
      throw new BadRequestException("horaFim deve ser posterior a horaInicio.");
    }

    const dup = await this.prisma.sessaoFormacao.findFirst({
      where: {
        cronogramaId: dto.cronogramaId,
        numeroSessao: dto.numeroSessao,
      },
    });
    if (dup) {
      throw new ConflictException("Número de sessão já usado neste cronograma.");
    }

    if (dto.formadorId) {
      const formador = await this.prisma.formadorProfile.findFirst({
        where: { id: dto.formadorId, tenantId },
      });
      if (!formador) {
        throw new NotFoundException("Formador inexistente ou de outro tenant.");
      }
    }

    if (dto.moduloUnidadeId) {
      const modulo = await this.prisma.moduloUnidade.findFirst({
        where: { id: dto.moduloUnidadeId, tenantId },
      });
      if (!modulo) {
        throw new NotFoundException("Módulo inexistente ou de outro tenant.");
      }
    }

    let formadorId = dto.formadorId ?? null;
    if (user.role === "formador") {
      const profileId = await this.formadorScope.getProfileId(user);
      if (!profileId) {
        throw new ForbiddenException("Perfil de formador não encontrado.");
      }
      formadorId = profileId;
    }

    const created = await this.prisma.sessaoFormacao.create({
      data: {
        tenantId,
        cronogramaId: dto.cronogramaId,
        numeroSessao: dto.numeroSessao,
        data: toPgDate(dto.data, "data"),
        horaInicio: dto.horaInicio,
        horaFim: dto.horaFim,
        modalidade: dto.modalidade,
        formadorId,
        moduloUnidadeId: dto.moduloUnidadeId ?? null,
        lmsAtivo: isModalidadeOnline(dto.modalidade),
      },
    });

    if (isModalidadeOnline(dto.modalidade)) {
      await this.ensureSalaOnline(tenantId, created);
      const finalSessao = await this.prisma.sessaoFormacao.findFirstOrThrow({ where: { id: created.id } });
      void this.calendarioNotificacoes.onSessaoCriada(finalSessao.id, tenantId).catch((err) =>
        this.logger.warn(`Calendário sessão: ${String(err)}`),
      );
      return finalSessao;
    }

    void this.calendarioNotificacoes.onSessaoCriada(created.id, tenantId).catch((err) =>
      this.logger.warn(`Calendário sessão: ${String(err)}`),
    );
    return created;
  }

  async update(user: RequestUser, id: string, dto: UpdateSessaoFormacaoDto) {
    const tenantId = requireTenantId(user);
    const existing = await this.prisma.sessaoFormacao.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new NotFoundException("Sessão não encontrada.");
    }

    if (dto.formadorId) {
      const formador = await this.prisma.formadorProfile.findFirst({
        where: { id: dto.formadorId, tenantId },
      });
      if (!formador) {
        throw new NotFoundException("Formador inexistente ou de outro tenant.");
      }
    }

    if (dto.moduloUnidadeId) {
      const modulo = await this.prisma.moduloUnidade.findFirst({
        where: { id: dto.moduloUnidadeId, tenantId },
      });
      if (!modulo) {
        throw new NotFoundException("Módulo inexistente ou de outro tenant.");
      }
    }

    const updated = await this.prisma.sessaoFormacao.update({
      where: { id },
      data: {
        ...(dto.estado !== undefined ? { estado: dto.estado } : {}),
        ...(dto.modalidade !== undefined
          ? {
              modalidade: dto.modalidade,
              ...(dto.lmsAtivo === undefined && isModalidadeOnline(dto.modalidade)
                ? { lmsAtivo: true }
                : {}),
            }
          : {}),
        ...(dto.formadorId !== undefined
          ? { formadorId: dto.formadorId || null }
          : {}),
        ...(dto.moduloUnidadeId !== undefined
          ? { moduloUnidadeId: dto.moduloUnidadeId || null }
          : {}),
        ...(dto.lmsAtivo !== undefined ? { lmsAtivo: dto.lmsAtivo } : {}),
        ...(dto.zoomMeetingId !== undefined
          ? { zoomMeetingId: dto.zoomMeetingId || null }
          : {}),
        ...(dto.minutosPresencaMin !== undefined
          ? { minutosPresencaMin: dto.minutosPresencaMin }
          : {}),
        ...(dto.formadorPresente !== undefined
          ? { formadorPresente: dto.formadorPresente }
          : {}),
      },
    });

    const modalidade = dto.modalidade ?? existing.modalidade;
    const lmsAtivo = dto.lmsAtivo !== undefined ? dto.lmsAtivo : updated.lmsAtivo;
    if (isModalidadeOnline(modalidade) && lmsAtivo && this.sessaoSemSala(updated)) {
      await this.ensureSalaOnline(tenantId, updated);
      return this.prisma.sessaoFormacao.findFirstOrThrow({ where: { id } });
    }

    return updated;
  }

  async iniciar(user: RequestUser, id: string) {
    const tenantId = requireTenantId(user);

    let sessao = await this.prisma.sessaoFormacao.findFirst({
      where: { id, tenantId },
    });
    if (!sessao) {
      throw new NotFoundException("Sessão não encontrada.");
    }
    if (sessao.estado === "CANCELADA") {
      throw new BadRequestException("Sessão cancelada - não pode ser iniciada.");
    }

    if (
      isModalidadeOnline(sessao.modalidade) &&
      sessao.lmsAtivo &&
      this.sessaoSemSala(sessao)
    ) {
      await this.ensureSalaOnline(tenantId, sessao);
      sessao = await this.prisma.sessaoFormacao.findFirstOrThrow({ where: { id, tenantId } });
    }

    const salaOnline = resolveSalaOnline(sessao);
    if (isModalidadeOnline(sessao.modalidade) && sessao.lmsAtivo && !salaOnline) {
      throw new BadRequestException(
        "Sessão online sem sala - configura Zoom/Teams em Integrações ou usa «Iniciar e abrir sala» no cronograma.",
      );
    }

    const alreadyStarted = sessao.iniciadaEm != null;
    const iniciadaEm = alreadyStarted ? sessao.iniciadaEm! : new Date();

    if (!alreadyStarted) {
      await this.prisma.sessaoFormacao.update({
        where: { id },
        data: {
          iniciadaEm,
          formadorPresente: sessao.formadorPresente ?? true,
        },
      });

      void this.notificacoes.enviarSessaoIniciada(tenantId, id).catch((err) => {
        this.logger.error(
          `Falha ao enviar notificações após iniciar sessão (${id})`,
          err instanceof Error ? err.stack : String(err),
        );
      });
    }

    return {
      ok: true,
      sessaoId: id,
      iniciadaEm,
      alreadyStarted,
      notificacoesEnviadas: !alreadyStarted,
      salaOnline,
    };
  }

  /**
   * Marca a sessão como iniciada e notifica formandos e formador.
   * Idempotente - só envia emails na primeira vez (quando `iniciadaEm` ainda não existia).
   */
  async iniciarAoCriarReuniao(
    tenantId: string,
    sessaoId: string,
  ): Promise<{ iniciadaEm: Date; alreadyStarted: boolean; notificacoesEnviadas: boolean }> {
    const sessao = await this.prisma.sessaoFormacao.findFirst({
      where: { id: sessaoId, tenantId },
    });
    if (!sessao) {
      throw new NotFoundException("Sessão não encontrada.");
    }
    if (sessao.estado === "CANCELADA") {
      throw new BadRequestException("Sessão cancelada - não pode ser iniciada.");
    }

    const alreadyStarted = sessao.iniciadaEm != null;
    const iniciadaEm = alreadyStarted ? sessao.iniciadaEm! : new Date();

    if (!alreadyStarted) {
      await this.prisma.sessaoFormacao.update({
        where: { id: sessaoId },
        data: {
          iniciadaEm,
          formadorPresente: sessao.formadorPresente ?? true,
        },
      });

      void this.notificacoes.enviarSessaoIniciada(tenantId, sessaoId).catch((err) => {
        this.logger.error(
          `Falha ao enviar notificações após criar reunião (${sessaoId})`,
          err instanceof Error ? err.stack : String(err),
        );
      });
    }

    return {
      iniciadaEm,
      alreadyStarted,
      notificacoesEnviadas: !alreadyStarted,
    };
  }

  async terminar(user: RequestUser, id: string) {
    const tenantId = requireTenantId(user);

    const sessao = await this.prisma.sessaoFormacao.findFirst({
      where: { id, tenantId },
    });
    if (!sessao) {
      throw new NotFoundException("Sessão não encontrada.");
    }
    if (sessao.estado === "CANCELADA") {
      throw new BadRequestException("Sessão cancelada.");
    }
    if (!sessao.iniciadaEm) {
      throw new BadRequestException("A sessão ainda não foi iniciada.");
    }

    const alreadyEnded = sessao.terminadaEm != null;
    const terminadaEm = alreadyEnded ? sessao.terminadaEm! : new Date();

    let presencasFechadas = 0;
    let turmasSincronizadas = 0;
    if (!alreadyEnded) {
      presencasFechadas = await this.lms.fecharPresencasAbertasSessao(
        tenantId,
        id,
        terminadaEm,
      );

      await this.prisma.sessaoFormacao.update({
        where: { id },
        data: {
          terminadaEm,
          estado: "REALIZADA",
        },
      });

      if (sessao.lmsAtivo) {
        try {
          const sync = await this.assiduidade.sincronizarSessaoTodasTurmas(tenantId, id);
          turmasSincronizadas = sync.turmasSincronizadas;
        } catch (err) {
          this.logger.error(
            `Falha ao sincronizar folhas LMS após terminar sessão ${id}`,
            err instanceof Error ? err.stack : String(err),
          );
        }
      }
    }

    return {
      ok: true,
      sessaoId: id,
      terminadaEm,
      alreadyEnded,
      presencasFechadas,
      turmasSincronizadas,
    };
  }
}
