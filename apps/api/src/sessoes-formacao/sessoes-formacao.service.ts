import { randomBytes } from "crypto";
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
import { ConfigService } from "@nestjs/config";
import type { SessaoFormacao } from "@nexiforma/database";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { FormadorScopeService } from "../common/formador-scope.service";
import { requireTenantId } from "../common/tenant-scope";
import { resolveAppPublicUrlForLinks } from "../common/app-public-url.util";
import { NotificacoesExtendedService } from "../notificacoes/notificacoes-extended.service";
import { FormadorNotificacoesService } from "../notificacoes/formador-notificacoes.service";
import { EmailTemplates } from "../notificacoes/templates/email.templates";
import { AssiduidadeService } from "../assiduidade/assiduidade.service";
import { LmsService } from "../lms/lms.service";
import { IntegracoesService } from "../integracoes/integracoes.service";
import { TeamsTranscriptService } from "../integracoes/teams-transcript.service";
import { isModalidadeOnline, resolveSalaOnline } from "../lms/sessao-sala.util";
import type { CreateSessaoFormacaoDto } from "./dto/create-sessao-formacao.dto";
import type { UpdateSessaoFormacaoDto } from "./dto/update-sessao-formacao.dto";
import type {
  AtribuirFormadorCronogramaDto,
  NotificarAtribuicaoFormadorDto,
} from "./dto/atribuir-formador.dto";
import type { TerminarSessaoDto } from "./dto/terminar-sessao.dto";
import { CalendarioNotificacoesService } from "../calendario/calendario-notificacoes.service";

export type PendenciasFechoSessao = {
  temPendencias: boolean;
  folhaPendente: boolean;
  sumarioPendente: boolean;
  folhasTotal: number;
  folhasSemValidacao: number;
  itens: string[];
};

/** TTL do QR de presença (formandos devem ler o código actual). */
export const PRESENCA_QR_TTL_MS = 60 * 1000;

function newPresencaQrToken(): string {
  return randomBytes(24).toString("base64url");
}

function newPresencaQrExpiry(from = new Date()): Date {
  return new Date(from.getTime() + PRESENCA_QR_TTL_MS);
}

const PRESENCA_QR_SESSAO_SELECT = {
  id: true,
  numeroSessao: true,
  data: true,
  horaInicio: true,
  horaFim: true,
  iniciadaEm: true,
  terminadaEm: true,
  presencaQrToken: true,
  presencaQrExpiresAt: true,
  cronograma: {
    select: {
      acaoFormacao: { select: { codigoInterno: true, titulo: true } },
    },
  },
} as const;

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
    private readonly config: ConfigService,
    private readonly notificacoes: NotificacoesExtendedService,
    private readonly formadorNotificacoes: FormadorNotificacoesService,
    private readonly lms: LmsService,
    private readonly assiduidade: AssiduidadeService,
    private readonly formadorScope: FormadorScopeService,
    private readonly calendarioNotificacoes: CalendarioNotificacoesService,
    @Inject(forwardRef(() => IntegracoesService))
    private readonly integracoes: IntegracoesService,
    @Inject(forwardRef(() => TeamsTranscriptService))
    private readonly teamsTranscript: TeamsTranscriptService,
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

  private async assertModuloPertenceCursoDaAcao(
    tenantId: string,
    acaoFormacaoId: string,
    moduloUnidadeId: string,
  ): Promise<void> {
    const modulo = await this.prisma.moduloUnidade.findFirst({
      where: { id: moduloUnidadeId, tenantId },
      select: { cursoId: true },
    });
    if (!modulo) {
      throw new NotFoundException("Módulo inexistente ou de outro tenant.");
    }
    const acao = await this.prisma.acaoFormacao.findFirst({
      where: { id: acaoFormacaoId, tenantId },
      select: { cursoId: true },
    });
    if (!acao || modulo.cursoId !== acao.cursoId) {
      throw new BadRequestException(
        "O módulo seleccionado não pertence ao curso desta acção.",
      );
    }
  }

  list(user: RequestUser, cronogramaId?: string, turmaId?: string) {
    const tenantId = requireTenantId(user);
    return this.prisma.sessaoFormacao.findMany({
      where: {
        tenantId,
        ...(cronogramaId ? { cronogramaId } : {}),
        ...(turmaId ? { turmaId } : {}),
      },
      orderBy: [{ cronogramaId: "asc" }, { numeroSessao: "asc" }],
      take: 120,
      select: {
        id: true,
        numeroSessao: true,
        data: true,
        horaInicio: true,
        horaFim: true,
        titulo: true,
        modalidade: true,
        estado: true,
        lmsAtivo: true,
        iniciadaEm: true,
        terminadaEm: true,
        formadorPresente: true,
        formadorEntradaEm: true,
        formadorSaidaEm: true,
        formadorDuracaoSegundos: true,
        zoomMeetingId: true,
        teamsMeetingId: true,
        salaJoinUrl: true,
        minutosPresencaMin: true,
        cronogramaId: true,
        turmaId: true,
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

    const turma = await this.prisma.turma.findFirst({
      where: {
        id: dto.turmaId,
        tenantId,
        acaoFormacaoId: cronograma.acaoFormacaoId,
      },
      select: { id: true },
    });
    if (!turma) {
      throw new NotFoundException("Turma inexistente nesta acção.");
    }

    if (compareHhMm(dto.horaFim, dto.horaInicio) <= 0) {
      throw new BadRequestException("horaFim deve ser posterior a horaInicio.");
    }

    const dup = await this.prisma.sessaoFormacao.findFirst({
      where: {
        cronogramaId: dto.cronogramaId,
        turmaId: dto.turmaId,
        numeroSessao: dto.numeroSessao,
      },
    });
    if (dup) {
      throw new ConflictException("Número de sessão já usado nesta turma.");
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
      await this.assertModuloPertenceCursoDaAcao(
        tenantId,
        cronograma.acaoFormacaoId,
        dto.moduloUnidadeId,
      );
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
        turmaId: dto.turmaId,
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
      include: { cronograma: { select: { acaoFormacaoId: true } } },
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
      await this.assertModuloPertenceCursoDaAcao(
        tenantId,
        existing.cronograma.acaoFormacaoId,
        dto.moduloUnidadeId,
      );
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
    await this.formadorScope.assertCanOperateSessao(user, id);

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
    const now = new Date();
    const iniciadaEm = alreadyStarted ? sessao.iniciadaEm! : now;
    // Contador do formador começa ao abrir/iniciar a sessão (como reuniaoIniciadaEm no CRM).
    const formadorEntradaEm = sessao.formadorEntradaEm ?? now;

    const needsQrToken = !sessao.presencaQrToken;
    if (!alreadyStarted || !sessao.formadorEntradaEm || needsQrToken) {
      await this.prisma.sessaoFormacao.update({
        where: { id },
        data: {
          ...(!alreadyStarted ? { iniciadaEm } : {}),
          ...(needsQrToken
            ? {
                presencaQrToken: newPresencaQrToken(),
                presencaQrExpiresAt: newPresencaQrExpiry(now),
              }
            : {}),
          formadorEntradaEm,
          formadorPresente: true,
          formadorSaidaEm: null,
        },
      });
    }

    if (!alreadyStarted) {
      await this.markAcaoEmCursoSePlaneada(tenantId, id);
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
      formadorEntradaEm,
      alreadyStarted,
      notificacoesEnviadas: !alreadyStarted,
      salaOnline,
    };
  }

  /** Primeira sessão iniciada → acção passa de Planeada para Em curso. */
  private async markAcaoEmCursoSePlaneada(tenantId: string, sessaoId: string) {
    const sessao = await this.prisma.sessaoFormacao.findFirst({
      where: { id: sessaoId, tenantId },
      select: { cronograma: { select: { acaoFormacaoId: true } } },
    });
    const acaoId = sessao?.cronograma.acaoFormacaoId;
    if (!acaoId) return;
    await this.prisma.acaoFormacao.updateMany({
      where: { id: acaoId, tenantId, estado: "PLANEADA" },
      data: { estado: "EM_CURSO" },
    });
  }

  /**
   * Garante token QR da sessão (renova a cada 60s) e devolve o path de check-in.
   * Só disponível com a sessão iniciada e ainda não terminada.
   */
  async getPresencaQr(user: RequestUser, id: string, opts?: { force?: boolean }) {
    const tenantId = requireTenantId(user);
    await this.formadorScope.assertCanOperateSessao(user, id);

    let sessao = await this.prisma.sessaoFormacao.findFirst({
      where: { id, tenantId },
      select: PRESENCA_QR_SESSAO_SELECT,
    });
    if (!sessao) {
      throw new NotFoundException("Sessão não encontrada.");
    }
    if (!sessao.iniciadaEm) {
      throw new BadRequestException(
        "Inicia a sessão antes de gerar o código QR de presença.",
      );
    }
    if (sessao.terminadaEm) {
      throw new BadRequestException(
        "A sessão já terminou - o QR em directo já não está disponível. Podes ainda marcar e validar presenças na folha; para novo QR, volta a iniciar a sessão.",
      );
    }

    const now = new Date();
    const expired =
      !sessao.presencaQrToken ||
      !sessao.presencaQrExpiresAt ||
      sessao.presencaQrExpiresAt.getTime() <= now.getTime();

    // force=true: renovação manual (mesmo que o token actual ainda seja válido).
    if (expired || opts?.force) {
      const token = newPresencaQrToken();
      const expiresAt = newPresencaQrExpiry(now);
      sessao = await this.prisma.sessaoFormacao.update({
        where: { id },
        data: {
          presencaQrToken: token,
          presencaQrExpiresAt: expiresAt,
        },
        select: PRESENCA_QR_SESSAO_SELECT,
      });
    }

    const token = sessao.presencaQrToken!;
    const expiresAt = sessao.presencaQrExpiresAt ?? newPresencaQrExpiry(now);
    const ttlMs = Math.max(0, expiresAt.getTime() - now.getTime());

    return {
      token,
      /** Landing pública; redirecciona para o check-in do formando (com login se necessário). */
      checkinPath: `/presenca/${token}`,
      expiresAt: expiresAt.toISOString(),
      ttlSeconds: Math.ceil(ttlMs / 1000),
      ttlMs: PRESENCA_QR_TTL_MS,
      sessao: {
        id: sessao.id,
        numeroSessao: sessao.numeroSessao,
        data: sessao.data,
        horaInicio: sessao.horaInicio,
        horaFim: sessao.horaFim,
        iniciadaEm: sessao.iniciadaEm,
        acao: sessao.cronograma.acaoFormacao,
      },
    };
  }

  /**
   * Formador entra na sessão já iniciada: inicia/retoma o contador de presença.
   * Idempotente se já estiver em sessão.
   */
  async entrarFormador(user: RequestUser, id: string) {
    const tenantId = requireTenantId(user);
    await this.formadorScope.assertCanOperateSessao(user, id);
    let sessao = await this.prisma.sessaoFormacao.findFirst({
      where: { id, tenantId },
    });
    if (!sessao) {
      throw new NotFoundException("Sessão não encontrada.");
    }
    if (sessao.estado === "CANCELADA") {
      throw new BadRequestException("Sessão cancelada.");
    }
    if (sessao.terminadaEm) {
      throw new BadRequestException("Sessão já terminada.");
    }

    if (!sessao.iniciadaEm) {
      return this.iniciar(user, id);
    }

    if (
      isModalidadeOnline(sessao.modalidade) &&
      sessao.lmsAtivo &&
      this.sessaoSemSala(sessao)
    ) {
      await this.ensureSalaOnline(tenantId, sessao);
      sessao = await this.prisma.sessaoFormacao.findFirstOrThrow({ where: { id, tenantId } });
    }

    const now = new Date();
    const formadorEntradaEm = sessao.formadorEntradaEm ?? now;
    if (!sessao.formadorEntradaEm) {
      await this.prisma.sessaoFormacao.update({
        where: { id },
        data: {
          formadorEntradaEm,
          formadorPresente: true,
          formadorSaidaEm: null,
        },
      });
    }

    return {
      ok: true,
      sessaoId: id,
      iniciadaEm: sessao.iniciadaEm,
      formadorEntradaEm,
      salaOnline: resolveSalaOnline(sessao),
    };
  }

  /**
   * Marca a sessão como iniciada e notifica formandos e formador.
   * Idempotente - só envia emails na primeira vez (quando `iniciadaEm` ainda não existia).
   */
  async iniciarAoCriarReuniao(
    tenantId: string,
    sessaoId: string,
  ): Promise<{
    iniciadaEm: Date;
    formadorEntradaEm: Date;
    alreadyStarted: boolean;
    notificacoesEnviadas: boolean;
  }> {
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
    const now = new Date();
    const iniciadaEm = alreadyStarted ? sessao.iniciadaEm! : now;
    const formadorEntradaEm = sessao.formadorEntradaEm ?? now;

    if (!alreadyStarted || !sessao.formadorEntradaEm) {
      await this.prisma.sessaoFormacao.update({
        where: { id: sessaoId },
        data: {
          ...(!alreadyStarted ? { iniciadaEm } : {}),
          formadorEntradaEm,
          formadorPresente: true,
          formadorSaidaEm: null,
        },
      });
    }

    if (!alreadyStarted) {
      await this.markAcaoEmCursoSePlaneada(tenantId, sessaoId);
      void this.notificacoes.enviarSessaoIniciada(tenantId, sessaoId).catch((err) => {
        this.logger.error(
          `Falha ao enviar notificações após criar reunião (${sessaoId})`,
          err instanceof Error ? err.stack : String(err),
        );
      });
    }

    return {
      iniciadaEm,
      formadorEntradaEm,
      alreadyStarted,
      notificacoesEnviadas: !alreadyStarted,
    };
  }

  async getPendenciasFecho(tenantId: string, sessaoId: string): Promise<PendenciasFechoSessao> {
    const [folhas, sumarios] = await Promise.all([
      this.prisma.folhaPresenca.findMany({
        where: { tenantId, sessaoId },
        select: {
          id: true,
          validadaFormadorEm: true,
          turma: { select: { codigo: true } },
        },
      }),
      this.prisma.sumario.findMany({
        where: { tenantId, sessaoId },
        select: { id: true, imutavel: true },
      }),
    ]);

    const folhasSemValidacao = folhas.filter((f) => !f.validadaFormadorEm);
    const folhaPendente = folhas.length === 0 || folhasSemValidacao.length > 0;
    const sumarioPendente = !sumarios.some((s) => s.imutavel);

    const itens: string[] = [];
    if (folhas.length === 0) {
      itens.push("Folha de presenças não aberta / não validada pelo formador");
    } else if (folhasSemValidacao.length > 0) {
      const turmas = folhasSemValidacao
        .map((f) => f.turma?.codigo)
        .filter((c): c is string => Boolean(c));
      itens.push(
        turmas.length
          ? `Folha de presenças por validar (${turmas.join(", ")})`
          : `Folha de presenças por validar (${folhasSemValidacao.length})`,
      );
    }
    if (sumarioPendente) {
      itens.push(
        sumarios.length === 0
          ? "Sumário da sessão em falta / por assinar"
          : "Sumário da sessão por assinar (ainda em rascunho)",
      );
    }

    return {
      temPendencias: folhaPendente || sumarioPendente,
      folhaPendente,
      sumarioPendente,
      folhasTotal: folhas.length,
      folhasSemValidacao: folhasSemValidacao.length,
      itens,
    };
  }

  /**
   * Folha/sumário por validar nas sessões atribuídas a este formador
   * (para lembrete no logout / sair).
   */
  async listPendenciasDocumentacaoFormador(user: RequestUser) {
    const tenantId = requireTenantId(user);
    if (user.role !== "formador") {
      return { temPendencias: false, sessoes: [] };
    }
    const profileId = await this.formadorScope.getProfileId(user);
    if (!profileId) {
      return { temPendencias: false, sessoes: [] };
    }

    const sessoes = await this.prisma.sessaoFormacao.findMany({
      where: {
        tenantId,
        formadorId: profileId,
        iniciadaEm: { not: null },
        estado: { not: "CANCELADA" },
      },
      orderBy: [{ data: "desc" }, { numeroSessao: "desc" }],
      take: 40,
      select: {
        id: true,
        numeroSessao: true,
        data: true,
        terminadaEm: true,
        estado: true,
        cronograma: {
          select: {
            acaoFormacao: {
              select: { id: true, codigoInterno: true, titulo: true },
            },
          },
        },
        folhasPresenca: { select: { validadaFormadorEm: true } },
        sumarios: { select: { imutavel: true } },
      },
    });

    const pendentes: Array<{
      sessaoId: string;
      numeroSessao: number;
      acaoId: string;
      acaoLabel: string;
      folhaPendente: boolean;
      sumarioPendente: boolean;
      itens: string[];
    }> = [];
    for (const s of sessoes) {
      const folhaPendente =
        s.folhasPresenca.length === 0 ||
        s.folhasPresenca.some((f) => !f.validadaFormadorEm);
      const sumarioPendente = !s.sumarios.some((x) => x.imutavel);
      if (!folhaPendente && !sumarioPendente) continue;

      const itens: string[] = [];
      if (folhaPendente) {
        itens.push(
          s.folhasPresenca.length === 0
            ? "Folha de presenças por abrir/validar"
            : "Folha de presenças por validar",
        );
      }
      if (sumarioPendente) {
        itens.push(
          s.sumarios.length === 0
            ? "Sumário em falta / por assinar"
            : "Sumário por assinar",
        );
      }

      const acao = s.cronograma.acaoFormacao;
      pendentes.push({
        sessaoId: s.id,
        numeroSessao: s.numeroSessao,
        acaoId: acao.id,
        acaoLabel: `${acao.codigoInterno} – ${acao.titulo}`,
        folhaPendente,
        sumarioPendente,
        itens,
      });
    }

    return { temPendencias: pendentes.length > 0, sessoes: pendentes };
  }

  /**
   * Formador confirma logout com pendências → avisa departamento pedagógico.
   */
  async avisarPedagogicoPendenciasLogout(user: RequestUser) {
    const tenantId = requireTenantId(user);
    if (user.role !== "formador") {
      throw new ForbiddenException("Apenas formadores podem usar este aviso.");
    }

    const lista = await this.listPendenciasDocumentacaoFormador(user);
    if (!lista.temPendencias || lista.sessoes.length === 0) {
      return { ok: true, avisado: false, emails: 0, destinatarios: 0 };
    }

    const profile = await this.prisma.formadorProfile.findFirst({
      where: { tenantId, userId: user.sub },
      select: { nomeCompleto: true },
    });
    const formadorNome = profile?.nomeCompleto?.trim() || user.email || "Formador";

    const linhas = lista.sessoes.map(
      (s) =>
        `${s.acaoLabel} · sessão ${s.numeroSessao}: ${s.itens.join("; ")}`,
    );
    const primeira = lista.sessoes[0]!;
    const focus =
      primeira.folhaPendente && primeira.sumarioPendente
        ? "pendencias"
        : primeira.folhaPendente
          ? "folha"
          : "sumario";
    const portalPath =
      `/portal/acoes/${encodeURIComponent(primeira.acaoId)}` +
      `?tab=cronograma&sessaoId=${encodeURIComponent(primeira.sessaoId)}&focus=${focus}`;

    const result = await this.notificacoes.notificarPendenciasLogoutFormador(tenantId, {
      formadorNome,
      linhas,
      portalPath,
    });

    return {
      ok: true,
      avisado: true,
      emails: result.emails,
      destinatarios: result.destinatarios,
      sessoes: lista.sessoes.length,
    };
  }

  async terminar(user: RequestUser, id: string, dto: TerminarSessaoDto = {}) {
    const tenantId = requireTenantId(user);
    await this.formadorScope.assertCanOperateSessao(user, id);

    const sessao = await this.prisma.sessaoFormacao.findFirst({
      where: { id, tenantId },
      include: {
        formador: { select: { id: true, nomeCompleto: true } },
        cronograma: {
          select: {
            acaoFormacaoId: true,
            acaoFormacao: { select: { codigoInterno: true, titulo: true } },
          },
        },
      },
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
    /** Lembrete / email só para o formador atribuído a esta sessão. */
    const formadorProfileId =
      user.role === "formador" ? await this.formadorScope.getProfileId(user) : null;
    const isFormadorAtribuido = Boolean(
      formadorProfileId && sessao.formadorId && sessao.formadorId === formadorProfileId,
    );

    const pendencias =
      !alreadyEnded && isFormadorAtribuido
        ? await this.getPendenciasFecho(tenantId, id)
        : null;

    const terminadaEm = alreadyEnded ? sessao.terminadaEm! : new Date();

    let presencasFechadas = 0;
    let turmasSincronizadas = 0;
    if (!alreadyEnded) {
      presencasFechadas = await this.lms.fecharPresencasAbertasSessao(
        tenantId,
        id,
        terminadaEm,
      );

      const entrada = sessao.formadorEntradaEm ?? sessao.iniciadaEm;
      const formadorDuracaoSegundos = entrada
        ? Math.max(0, Math.floor((terminadaEm.getTime() - entrada.getTime()) / 1000))
        : null;

      await this.prisma.sessaoFormacao.update({
        where: { id },
        data: {
          terminadaEm,
          estado: "REALIZADA",
          formadorSaidaEm: terminadaEm,
          formadorDuracaoSegundos,
          formadorPresente: entrada != null ? true : (sessao.formadorPresente ?? false),
          ...(sessao.formadorEntradaEm ? {} : entrada ? { formadorEntradaEm: entrada } : {}),
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

      if (pendencias?.temPendencias && isFormadorAtribuido) {
        const acao = sessao.cronograma.acaoFormacao;
        const acaoLabel = `${acao.codigoInterno} – ${acao.titulo}`;
        const sessaoLabel = `Sessão ${sessao.numeroSessao}`;
        const formadorNome = sessao.formador?.nomeCompleto?.trim() || "Formador";
        void this.notificacoes
          .notificarPendenciasAposTerminarSessao(tenantId, {
            acaoId: sessao.cronograma.acaoFormacaoId,
            sessaoId: id,
            acaoLabel,
            sessaoLabel,
            formadorNome,
            pendencias: pendencias.itens,
            folhaPendente: pendencias.folhaPendente,
            sumarioPendente: pendencias.sumarioPendente,
          })
          .catch((err) => {
            this.logger.error(
              `Falha ao notificar pendências após terminar sessão ${id}`,
              err instanceof Error ? err.stack : String(err),
            );
          });
      }

      if (sessao.teamsMeetingId) {
        void this.teamsTranscript
          .marcarPendenteSessao(id, tenantId)
          .then(() => this.teamsTranscript.importarSessao(id, tenantId))
          .catch((err) => {
            this.logger.warn(
              `Transcrição Teams sessão ${id}: ${err instanceof Error ? err.message : String(err)}`,
            );
          });
      }
    }

    return {
      ok: true,
      sessaoId: id,
      terminadaEm,
      alreadyEnded,
      presencasFechadas,
      turmasSincronizadas,
      pendencias: pendencias?.temPendencias ? pendencias : null,
      avisoPedagogicoEnviado: Boolean(
        pendencias?.temPendencias && isFormadorAtribuido && !alreadyEnded,
      ),
    };
  }

  /** Atribui (ou remove) o mesmo formador em todas as sessões do cronograma. */
  async atribuirFormadorCronograma(user: RequestUser, dto: AtribuirFormadorCronogramaDto) {
    const tenantId = requireTenantId(user);
    const cronograma = await this.prisma.cronograma.findFirst({
      where: { id: dto.cronogramaId, tenantId },
      select: {
        id: true,
        acaoFormacaoId: true,
        acaoFormacao: { select: { codigoInterno: true, titulo: true } },
        _count: { select: { sessoes: true } },
      },
    });
    if (!cronograma) throw new NotFoundException("Cronograma não encontrado.");

    let formadorNome: string | null = null;
    if (dto.formadorId) {
      const formador = await this.prisma.formadorProfile.findFirst({
        where: { id: dto.formadorId, tenantId },
        select: { id: true, nomeCompleto: true },
      });
      if (!formador) throw new NotFoundException("Formador inexistente ou de outro tenant.");
      formadorNome = formador.nomeCompleto;
    }

    const result = await this.prisma.sessaoFormacao.updateMany({
      where: {
        tenantId,
        cronogramaId: dto.cronogramaId,
        ...(dto.turmaId ? { turmaId: dto.turmaId } : {}),
      },
      data: { formadorId: dto.formadorId },
    });

    return {
      ok: true,
      actualizadas: result.count,
      totalSessoes: cronograma._count.sessoes,
      formadorId: dto.formadorId,
      formadorNome,
      turmaId: dto.turmaId ?? null,
      acao: cronograma.acaoFormacao,
    };
  }

  /** Envia email + notificação in-app aos formadores atribuídos nas sessões. */
  async notificarAtribuicaoFormadores(user: RequestUser, dto: NotificarAtribuicaoFormadorDto) {
    const tenantId = requireTenantId(user);
    const cronograma = await this.prisma.cronograma.findFirst({
      where: { id: dto.cronogramaId, tenantId },
      select: {
        id: true,
        acaoFormacaoId: true,
        acaoFormacao: { select: { codigoInterno: true, titulo: true } },
      },
    });
    if (!cronograma) throw new NotFoundException("Cronograma não encontrado.");

    const sessoes = await this.prisma.sessaoFormacao.findMany({
      where: {
        tenantId,
        cronogramaId: dto.cronogramaId,
        formadorId: dto.formadorId ? dto.formadorId : { not: null },
      },
      select: {
        numeroSessao: true,
        formadorId: true,
        formador: {
          select: { id: true, userId: true, nomeCompleto: true, email: true },
        },
      },
      orderBy: { numeroSessao: "asc" },
    });

    const byFormador = new Map<
      string,
      { userId: string; nome: string; email: string; sessoes: number[] }
    >();
    for (const s of sessoes) {
      if (!s.formadorId || !s.formador) continue;
      const cur = byFormador.get(s.formadorId) ?? {
        userId: s.formador.userId,
        nome: s.formador.nomeCompleto,
        email: s.formador.email,
        sessoes: [],
      };
      cur.sessoes.push(s.numeroSessao);
      byFormador.set(s.formadorId, cur);
    }

    const acaoLabel = `${cronograma.acaoFormacao.codigoInterno} – ${cronograma.acaoFormacao.titulo}`;
    const link = `/portal/acoes/${cronograma.acaoFormacaoId}`;
    const appUrl = resolveAppPublicUrlForLinks(this.config).replace(/\/$/, "");
    const acaoUrl = `${appUrl}${link}`;
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { legalName: true },
    });
    let enviados = 0;

    for (const f of byFormador.values()) {
      const nums = f.sessoes.join(", ");
      const titulo = "Atribuição de acção";
      const mensagem =
        f.sessoes.length === 1
          ? `Foi-lhe atribuída a sessão ${nums} da acção «${acaoLabel}».`
          : `Foram-lhe atribuídas ${f.sessoes.length} sessões (${nums}) da acção «${acaoLabel}».`;
      const tpl = EmailTemplates.formadorAtribuicaoSessoes({
        nomeFormador: f.nome,
        acaoLabel,
        entidadeFormadora: tenant?.legalName,
        acaoUrl,
      });
      await this.formadorNotificacoes.notifyUserIds(tenantId, [f.userId], {
        tipo: "formador_atribuicao",
        titulo,
        mensagem,
        link,
        emailSubject: tpl.subject,
        emailText: tpl.text,
        emailHtml: tpl.html,
      });
      enviados += 1;
    }

    return { ok: true, formadoresNotificados: enviados, sessoesComFormador: sessoes.length };
  }
}
