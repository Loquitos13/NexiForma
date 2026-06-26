import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { segundosDesdeUltimoJoin } from "@nexiforma/shared";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "../common/tenant-scope";
import {
  presentePorMinutos,
  sessaoDuracaoMinutos,
  sessaoFimDate,
  totalSegundosLms,
} from "./assiduidade-lms.util";
import type { SincronizarAssiduidadeDto, TeamsWebhookDto, ZoomWebhookDto } from "./dto/assiduidade.dto";
import { findFormandoPorEmailReuniao, detectarEmailReuniaoIncorreto, registarAlertaEmailReuniaoIncorreto } from "../common/formando-presenca.util";
import { NotificacoesExtendedService } from "../notificacoes/notificacoes-extended.service";

@Injectable()
export class AssiduidadeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notificacoes: NotificacoesExtendedService,
  ) {}

  async sincronizarSessao(
    user: RequestUser,
    sessaoId: string,
    dto: SincronizarAssiduidadeDto,
  ) {
    const tenantId = requireTenantId(user);
    return this.sincronizarSessaoInterno(tenantId, sessaoId, dto.turmaId);
  }

  /** Sincroniza LMS → folha de presença (sem validação JWT - uso interno ao terminar sessão). */
  async sincronizarSessaoInterno(tenantId: string, sessaoId: string, turmaId: string) {
    const sessao = await this.prisma.sessaoFormacao.findFirst({
      where: { id: sessaoId, tenantId },
      include: { cronograma: { select: { acaoFormacaoId: true } } },
    });
    if (!sessao) {
      throw new NotFoundException("Sessão não encontrada.");
    }
    if (!sessao.lmsAtivo) {
      throw new BadRequestException("LMS não activo nesta sessão.");
    }

    const turma = await this.prisma.turma.findFirst({
      where: { id: turmaId, tenantId },
    });
    if (!turma || turma.acaoFormacaoId !== sessao.cronograma.acaoFormacaoId) {
      throw new BadRequestException("Turma inválida para esta sessão.");
    }

    const matriculas = await this.prisma.matricula.findMany({
      where: { tenantId, turmaId, estado: "ATIVA" },
      select: { id: true },
    });

    let folha = await this.prisma.folhaPresenca.findFirst({
      where: { tenantId, sessaoId, turmaId },
    });

    if (!folha) {
      folha = await this.prisma.folhaPresenca.create({
        data: { tenantId, sessaoId, turmaId, origem: "automatica" },
      });
      await this.prisma.presenca.createMany({
        data: matriculas.map((m) => ({
          tenantId,
          folhaPresencaId: folha!.id,
          matriculaId: m.id,
          presente: false,
          origem: "lms",
        })),
        skipDuplicates: true,
      });
    }

    const duracaoSessaoMin = sessaoDuracaoMinutos(sessao.horaInicio, sessao.horaFim);
    const limiar = sessao.minutosPresencaMin ?? 60;
    const resultados: Array<{
      matriculaId: string;
      minutosEfetivos: number;
      presente: boolean;
    }> = [];

    for (const m of matriculas) {
      const acessosRaw = await this.prisma.acessoLms.findMany({
        where: {
          tenantId,
          matriculaId: m.id,
          sessaoFormacaoId: sessaoId,
        },
        select: { evento: true, duracaoSegundos: true, ocorridoEm: true },
      });
      const acessos = acessosRaw.filter((a) => a.evento === "join" || a.evento === "leave");

      const segundos = totalSegundosLms(acessos, {
        ate: new Date(),
        sessaoFim: sessaoFimDate(sessao.data, sessao.horaFim),
      });
      const minutos = Math.min(
        Math.round(segundos / 60),
        duracaoSessaoMin > 0 ? duracaoSessaoMin : 999,
      );
      const presente = presentePorMinutos(minutos, limiar);

      await this.prisma.presenca.updateMany({
        where: { folhaPresencaId: folha.id, matriculaId: m.id },
        data: {
          presente,
          ...(presente
            ? { estado: "PRESENTE", validado: true }
            : { estado: null, validado: false }),
          minutosEfetivos: minutos,
          origem: "lms",
        },
      });

      resultados.push({ matriculaId: m.id, minutosEfetivos: minutos, presente });
    }

    return {
      folhaPresencaId: folha.id,
      sessaoId,
      turmaId,
      limiarMinutos: limiar,
      resultados,
    };
  }

  /** Sincroniza todas as turmas da acção ligada à sessão (após terminar). */
  async sincronizarSessaoTodasTurmas(
    tenantId: string,
    sessaoId: string,
  ): Promise<{ turmasSincronizadas: number; folhas: string[] }> {
    const sessao = await this.prisma.sessaoFormacao.findFirst({
      where: { id: sessaoId, tenantId },
      include: { cronograma: { select: { acaoFormacaoId: true } } },
    });
    if (!sessao?.lmsAtivo) {
      return { turmasSincronizadas: 0, folhas: [] };
    }

    const turmas = await this.prisma.turma.findMany({
      where: { tenantId, acaoFormacaoId: sessao.cronograma.acaoFormacaoId },
      select: { id: true },
    });

    const folhas: string[] = [];
    for (const t of turmas) {
      try {
        const r = await this.sincronizarSessaoInterno(tenantId, sessaoId, t.id);
        folhas.push(r.folhaPresencaId);
      } catch {
        // turma sem matrículas ou inválida - ignorar
      }
    }

    return { turmasSincronizadas: folhas.length, folhas };
  }

  async handleZoomWebhook(dto: ZoomWebhookDto, token: string | undefined) {
    const expected = this.config.get<string>("ZOOM_WEBHOOK_TOKEN");
    if (expected && token !== expected) {
      throw new UnauthorizedException("Token Zoom inválido.");
    }

    const sessao = await this.prisma.sessaoFormacao.findFirst({
      where: { zoomMeetingId: dto.meetingId, lmsAtivo: true },
    });
    if (!sessao) {
      return { ignored: true, reason: "sessao_nao_encontrada" };
    }

    const formando = await findFormandoPorEmailReuniao(
      this.prisma,
      sessao.tenantId,
      dto.participantEmail,
    );
    if (!formando) {
      const incorreto = await detectarEmailReuniaoIncorreto(
        this.prisma,
        sessao.tenantId,
        sessao.id,
        dto.participantEmail,
      );
      if (incorreto) {
        await registarAlertaEmailReuniaoIncorreto(
          this.prisma,
          sessao.tenantId,
          sessao.id,
          incorreto.matriculaId,
          incorreto.emailEsperado,
          incorreto.emailParticipante,
        );
        void this.notificacoes
          .notificarEmailReuniaoIncorreto(
            sessao.tenantId,
            sessao.id,
            incorreto.matriculaId,
            incorreto.emailEsperado,
            incorreto.emailParticipante,
          )
          .catch(() => undefined);
        return {
          ignored: true,
          reason: "email_reuniao_incorreto",
          emailEsperado: incorreto.emailEsperado,
          matriculaId: incorreto.matriculaId,
        };
      }
      // Convidados externos (email fora do tenant) não contam para assiduidade oficial.
      return { ignored: true, reason: "formando_nao_encontrado" };
    }

    const matricula = await this.prisma.matricula.findFirst({
      where: {
        tenantId: sessao.tenantId,
        formandoId: formando.id,
        estado: "ATIVA",
        turma: {
          acaoFormacao: {
            cronogramas: { some: { sessoes: { some: { id: sessao.id } } } },
          },
        },
      },
    });
    if (!matricula) {
      return { ignored: true, reason: "matricula_nao_encontrada" };
    }

    const evento = dto.event === "participant_joined" ? "join" : "leave";
    const now = new Date();
    let duracaoSegundos: number | null = null;

    if (evento === "leave") {
      const anteriores = await this.prisma.acessoLms.findMany({
        where: {
          tenantId: sessao.tenantId,
          matriculaId: matricula.id,
          sessaoFormacaoId: sessao.id,
        },
        select: { evento: true, ocorridoEm: true, duracaoSegundos: true },
        orderBy: { ocorridoEm: "asc" },
      });
      duracaoSegundos = segundosDesdeUltimoJoin(anteriores, now);
    }

    await this.prisma.acessoLms.create({
      data: {
        tenantId: sessao.tenantId,
        matriculaId: matricula.id,
        sessaoFormacaoId: sessao.id,
        evento,
        duracaoSegundos,
        metadata: { origem: "zoom", meetingId: dto.meetingId, email: dto.participantEmail },
      },
    });

    return { ok: true, sessaoId: sessao.id, matriculaId: matricula.id, evento };
  }

  async handleTeamsWebhook(dto: TeamsWebhookDto, token: string | undefined) {
    const expected = this.config.get<string>("TEAMS_WEBHOOK_TOKEN");
    if (expected && token !== expected) {
      throw new UnauthorizedException("Token Teams inválido.");
    }

    const sessao = await this.prisma.sessaoFormacao.findFirst({
      where: { teamsMeetingId: dto.meetingId, lmsAtivo: true },
    });
    if (!sessao) {
      return { ignored: true, reason: "sessao_nao_encontrada" };
    }

    const formando = await findFormandoPorEmailReuniao(
      this.prisma,
      sessao.tenantId,
      dto.participantEmail,
    );
    if (!formando) {
      const incorreto = await detectarEmailReuniaoIncorreto(
        this.prisma,
        sessao.tenantId,
        sessao.id,
        dto.participantEmail,
      );
      if (incorreto) {
        await registarAlertaEmailReuniaoIncorreto(
          this.prisma,
          sessao.tenantId,
          sessao.id,
          incorreto.matriculaId,
          incorreto.emailEsperado,
          incorreto.emailParticipante,
        );
        void this.notificacoes
          .notificarEmailReuniaoIncorreto(
            sessao.tenantId,
            sessao.id,
            incorreto.matriculaId,
            incorreto.emailEsperado,
            incorreto.emailParticipante,
          )
          .catch(() => undefined);
        return {
          ignored: true,
          reason: "email_reuniao_incorreto",
          emailEsperado: incorreto.emailEsperado,
          matriculaId: incorreto.matriculaId,
        };
      }
      // Convidados externos (email fora do tenant) não contam para assiduidade oficial.
      return { ignored: true, reason: "formando_nao_encontrado" };
    }

    const matricula = await this.prisma.matricula.findFirst({
      where: {
        tenantId: sessao.tenantId,
        formandoId: formando.id,
        estado: "ATIVA",
        turma: {
          acaoFormacao: {
            cronogramas: { some: { sessoes: { some: { id: sessao.id } } } },
          },
        },
      },
    });
    if (!matricula) {
      return { ignored: true, reason: "matricula_nao_encontrada" };
    }

    const evento = dto.event === "participant_joined" ? "join" : "leave";
    const now = new Date();
    let duracaoSegundos: number | null = null;

    if (evento === "leave") {
      const anteriores = await this.prisma.acessoLms.findMany({
        where: {
          tenantId: sessao.tenantId,
          matriculaId: matricula.id,
          sessaoFormacaoId: sessao.id,
        },
        select: { evento: true, ocorridoEm: true, duracaoSegundos: true },
        orderBy: { ocorridoEm: "asc" },
      });
      duracaoSegundos = segundosDesdeUltimoJoin(anteriores, now);
    }

    await this.prisma.acessoLms.create({
      data: {
        tenantId: sessao.tenantId,
        matriculaId: matricula.id,
        sessaoFormacaoId: sessao.id,
        evento,
        duracaoSegundos,
        metadata: { origem: "teams", meetingId: dto.meetingId, email: dto.participantEmail },
      },
    });

    return { ok: true, sessaoId: sessao.id, matriculaId: matricula.id, evento };
  }
}
