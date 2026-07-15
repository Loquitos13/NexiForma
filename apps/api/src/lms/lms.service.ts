import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  formatarDuracaoHhMmSs,
  resolverEmailPresencaFormando,
  emailPresencaConfiguradoPeloGestor,
  ALERTA_PRESENCA,
  type AlertaPresencaCodigo,
  resolverEstadoPresenca,
  segundosDesdeUltimoJoin,
  ultimoJoinAberto,
} from "@nexiforma/shared";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "../common/tenant-scope";
import type { CreateLmsEventoDto } from "./dto/create-lms-evento.dto";
import { isModalidadeOnline, resolveSalaOnline } from "./sessao-sala.util";

@Injectable()
export class LmsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Regista leave automático para cada formando com entrada aberta na sessão. */
  async fecharPresencasAbertasSessao(
    tenantId: string,
    sessaoFormacaoId: string,
    ate = new Date(),
    motivo = "sessao_terminada",
  ): Promise<number> {
    const acessos = await this.prisma.acessoLms.findMany({
      where: { tenantId, sessaoFormacaoId },
      select: {
        matriculaId: true,
        evento: true,
        ocorridoEm: true,
        duracaoSegundos: true,
      },
      orderBy: { ocorridoEm: "asc" },
    });

    const porMatricula = new Map<string, typeof acessos>();
    for (const a of acessos) {
      const list = porMatricula.get(a.matriculaId) ?? [];
      list.push(a);
      porMatricula.set(a.matriculaId, list);
    }

    let fechados = 0;
    for (const [matriculaId, eventos] of porMatricula) {
      if (!ultimoJoinAberto(eventos)) continue;

      const duracaoSegundos = segundosDesdeUltimoJoin(eventos, ate);
      if (duracaoSegundos == null) continue;

      await this.prisma.acessoLms.create({
        data: {
          tenantId,
          matriculaId,
          sessaoFormacaoId,
          evento: "leave",
          duracaoSegundos,
          metadata: { origem: motivo, automatico: true },
        },
      });
      fechados += 1;
    }

    return fechados;
  }

  private mapPresencaComSessao(
    acessos: Array<{ evento: string; ocorridoEm: Date; duracaoSegundos: number | null }>,
    sessao: { terminadaEm: Date | null },
    ate = new Date(),
  ) {
    const estado = resolverEstadoPresenca(acessos, ate);
    const encerrada = sessao.terminadaEm != null;

    if (encerrada) {
      return {
        ...estado,
        emSessao: false,
        joinDesde: null,
        segundosIntervaloAtual: 0,
        segundosTotais: estado.segundosFechados,
        sessaoEncerrada: true,
        sessaoTerminadaEm: sessao.terminadaEm!.toISOString(),
        tempoTotalFormatado: formatarDuracaoHhMmSs(estado.segundosFechados),
        tempoIntervaloFormatado: "00:00:00",
      };
    }

    return {
      ...estado,
      sessaoEncerrada: false,
      sessaoTerminadaEm: null as string | null,
      tempoTotalFormatado: formatarDuracaoHhMmSs(estado.segundosTotais),
      tempoIntervaloFormatado: formatarDuracaoHhMmSs(estado.segundosIntervaloAtual),
    };
  }

  async registerEvent(user: RequestUser, dto: CreateLmsEventoDto): Promise<Record<string, unknown>> {
    const tenantId = requireTenantId(user);

    const matricula = await this.prisma.matricula.findFirst({
      where: { id: dto.matriculaId, tenantId },
      include: {
        formando: {
          select: {
            userId: true,
            email: true,
            emailPresenca: true,
            user: { select: { email: true } },
          },
        },
      },
    });
    if (!matricula) {
      throw new NotFoundException("Matrícula não encontrada.");
    }

    if (user.role === "formando") {
      if (matricula.formando.userId !== user.sub) {
        throw new ForbiddenException("Só podes registar eventos da tua matrícula.");
      }
    }

    if (dto.sessaoFormacaoId) {
      const sessao = await this.prisma.sessaoFormacao.findFirst({
        where: { id: dto.sessaoFormacaoId, tenantId },
        select: { id: true, lmsAtivo: true, iniciadaEm: true, terminadaEm: true },
      });
      if (!sessao) {
        throw new NotFoundException("Sessão não encontrada.");
      }
      if (!sessao.lmsAtivo) {
        throw new BadRequestException("LMS não activo nesta sessão.");
      }
      if (sessao.terminadaEm) {
        throw new BadRequestException("Sessão já terminada - presença encerrada.");
      }
      if (dto.evento === "join" && !sessao.iniciadaEm) {
        throw new BadRequestException("A sessão ainda não foi iniciada pelo formador.");
      }
    }

    const now = new Date();
    let duracaoSegundos = dto.duracaoSegundos ?? null;

    if (dto.evento === "leave" && dto.sessaoFormacaoId && duracaoSegundos == null) {
      const anteriores = await this.prisma.acessoLms.findMany({
        where: {
          tenantId,
          matriculaId: dto.matriculaId,
          sessaoFormacaoId: dto.sessaoFormacaoId,
        },
        select: { evento: true, ocorridoEm: true, duracaoSegundos: true },
        orderBy: { ocorridoEm: "asc" },
      });
      duracaoSegundos = segundosDesdeUltimoJoin(anteriores, now);
      if (duracaoSegundos == null) {
        throw new BadRequestException("Saída sem entrada registada nesta sessão.");
      }
    }

    if (dto.evento === "join" && dto.sessaoFormacaoId) {
      const ultimo = await this.prisma.acessoLms.findFirst({
        where: {
          tenantId,
          matriculaId: dto.matriculaId,
          sessaoFormacaoId: dto.sessaoFormacaoId,
        },
        orderBy: { ocorridoEm: "desc" },
        select: { evento: true },
      });
      if (ultimo?.evento === "join") {
        throw new BadRequestException("Já existe uma entrada activa - regista saída primeiro.");
      }
    }

    const emailPresencaReuniao = resolverEmailPresencaFormando({
      emailPresenca: matricula.formando.emailPresenca,
      emailConta: matricula.formando.user?.email,
      emailContacto: matricula.formando.email,
    });

    return this.prisma.acessoLms.create({
      data: {
        tenantId,
        matriculaId: dto.matriculaId,
        sessaoFormacaoId: dto.sessaoFormacaoId ?? null,
        evento: dto.evento,
        duracaoSegundos,
        metadata: {
          userId: user.sub,
          role: user.role,
          origem: "portal",
          emailPresencaReuniao,
        },
      },
    });
  }

  async presencaEstado(user: RequestUser, matriculaId: string, sessaoFormacaoId: string) {
    if (!matriculaId || !sessaoFormacaoId) {
      throw new BadRequestException("matriculaId e sessaoFormacaoId são obrigatórios.");
    }

    const tenantId = requireTenantId(user);

    const matricula = await this.prisma.matricula.findFirst({
      where: { id: matriculaId, tenantId },
      include: { formando: { select: { userId: true } } },
    });
    if (!matricula) {
      throw new NotFoundException("Matrícula não encontrada.");
    }

    if (user.role === "formando" && matricula.formando.userId !== user.sub) {
      throw new ForbiddenException("Só podes consultar a tua matrícula.");
    }

    const sessao = await this.prisma.sessaoFormacao.findFirst({
      where: { id: sessaoFormacaoId, tenantId },
    });
    if (!sessao) {
      throw new NotFoundException("Sessão não encontrada.");
    }

    const acessos = await this.prisma.acessoLms.findMany({
      where: { tenantId, matriculaId, sessaoFormacaoId },
      select: { evento: true, ocorridoEm: true, duracaoSegundos: true },
      orderBy: { ocorridoEm: "asc" },
    });

    return this.mapPresencaComSessao(acessos, sessao, new Date());
  }

  listAcessos(
    user: RequestUser,
    opts: { sessaoFormacaoId?: string; matriculaId?: string; acaoFormacaoId?: string },
  ): Promise<Record<string, unknown>[]> {
    const tenantId = requireTenantId(user);
    return this.listAcessosForTenant(tenantId, opts);
  }

  private async listAcessosForTenant(
    tenantId: string,
    opts: { sessaoFormacaoId?: string; matriculaId?: string; acaoFormacaoId?: string },
  ): Promise<Record<string, unknown>[]> {
    let sessaoIds: string[] | undefined;

    if (opts.acaoFormacaoId) {
      const sessoes = await this.prisma.sessaoFormacao.findMany({
        where: {
          tenantId,
          cronograma: { acaoFormacaoId: opts.acaoFormacaoId },
        },
        select: { id: true },
      });
      sessaoIds = sessoes.map((s) => s.id);
      if (!sessaoIds.length) return [];
    }

    return this.prisma.acessoLms.findMany({
      where: {
        tenantId,
        ...(opts.sessaoFormacaoId && !opts.acaoFormacaoId
          ? { sessaoFormacaoId: opts.sessaoFormacaoId }
          : {}),
        ...(sessaoIds ? { sessaoFormacaoId: { in: sessaoIds } } : {}),
        ...(opts.matriculaId ? { matriculaId: opts.matriculaId } : {}),
      },
      orderBy: { ocorridoEm: "desc" },
      take: opts.acaoFormacaoId ? 500 : 200,
      include: {
        matricula: {
          select: {
            id: true,
            formando: { select: { nome: true, nif: true } },
          },
        },
        sessao: {
          select: {
            id: true,
            numeroSessao: true,
            data: true,
            horaInicio: true,
          },
        },
      },
    });
  }

  async minhasSessoes(user: RequestUser) {
    const tenantId = requireTenantId(user);
    if (user.role !== "formando") {
      throw new ForbiddenException("Apenas formandos.");
    }

    const profile = await this.prisma.formandoProfile.findFirst({
      where: { tenantId, userId: user.sub },
      include: { user: { select: { email: true } } },
    });
    if (!profile) {
      return [];
    }

    const emailPresencaReuniao = resolverEmailPresencaFormando({
      emailPresenca: profile.emailPresenca,
      emailConta: profile.user?.email,
      emailContacto: profile.email,
    });
    const emailPresencaDefinidoPeloGestor = emailPresencaConfiguradoPeloGestor(profile.emailPresenca);

    const matriculas = await this.prisma.matricula.findMany({
      where: { tenantId, formandoId: profile.id, estado: { not: "DESISTENCIA" } },
      select: {
        id: true,
        turma: {
          select: {
            codigo: true,
            nome: true,
            acaoFormacao: {
              select: {
                titulo: true,
                codigoInterno: true,
                cursoId: true,
                cronogramas: {
                  select: {
                    sessoes: {
                      where: { estado: { not: "CANCELADA" } },
                      orderBy: { data: "asc" },
                      select: {
                        id: true,
                        numeroSessao: true,
                        data: true,
                        horaInicio: true,
                        horaFim: true,
                        modalidade: true,
                        lmsAtivo: true,
                        iniciadaEm: true,
                        terminadaEm: true,
                        zoomMeetingId: true,
                        teamsMeetingId: true,
                        salaJoinUrl: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const matriculaIds = matriculas.map((m) => m.id);
    const sessaoIds = [
      ...new Set(
        matriculas.flatMap((m) =>
          m.turma.acaoFormacao.cronogramas.flatMap((c) => c.sessoes.map((s) => s.id)),
        ),
      ),
    ];

    const todosAcessos =
      matriculaIds.length && sessaoIds.length
        ? await this.prisma.acessoLms.findMany({
            where: {
              tenantId,
              matriculaId: { in: matriculaIds },
              sessaoFormacaoId: { in: sessaoIds },
            },
            select: {
              matriculaId: true,
              sessaoFormacaoId: true,
              evento: true,
              ocorridoEm: true,
              duracaoSegundos: true,
            },
            orderBy: { ocorridoEm: "asc" },
          })
        : [];

    const acessosPorChave = new Map<string, typeof todosAcessos>();
    for (const a of todosAcessos) {
      if (!a.sessaoFormacaoId) continue;
      if (a.evento !== "join" && a.evento !== "leave") continue;
      const key = `${a.matriculaId}:${a.sessaoFormacaoId}`;
      const list = acessosPorChave.get(key) ?? [];
      list.push(a);
      acessosPorChave.set(key, list);
    }

    const sessaoMeta = new Map<string, { terminadaEm: Date | null }>();
    for (const m of matriculas) {
      for (const c of m.turma.acaoFormacao.cronogramas) {
        for (const s of c.sessoes) {
          sessaoMeta.set(s.id, { terminadaEm: s.terminadaEm });
        }
      }
    }

    const now = new Date();

    return matriculas.map((m) => ({
      matriculaId: m.id,
      cursoId: m.turma.acaoFormacao.cursoId,
      turma: `${m.turma.codigo} – ${m.turma.nome}`,
      acao: m.turma.acaoFormacao.titulo,
      emailPresencaReuniao,
      emailPresencaDefinidoPeloGestor,
      sessoes: m.turma.acaoFormacao.cronogramas.flatMap((c) =>
        c.sessoes.map((s) => {
          const salaOnline = resolveSalaOnline(s);
          const eventos = acessosPorChave.get(`${m.id}:${s.id}`) ?? [];
          const presencaRaw = this.mapPresencaComSessao(
            eventos,
            sessaoMeta.get(s.id) ?? { terminadaEm: s.terminadaEm },
            now,
          );
          return {
            id: s.id,
            numeroSessao: s.numeroSessao,
            data: s.data,
            horaInicio: s.horaInicio,
            horaFim: s.horaFim,
            modalidade: s.modalidade,
            lmsAtivo: s.lmsAtivo,
            iniciadaEm: s.iniciadaEm,
            terminadaEm: s.terminadaEm,
            salaOnline,
            requerSalaOnline: isModalidadeOnline(s.modalidade) && salaOnline != null,
            presenca: {
              emSessao: presencaRaw.emSessao,
              joinDesde: presencaRaw.joinDesde,
              segundosFechados: presencaRaw.segundosFechados,
              segundosTotais: presencaRaw.segundosTotais,
              tempoFormatado: presencaRaw.tempoTotalFormatado,
              sessaoEncerrada: presencaRaw.sessaoEncerrada,
            },
          };
        }),
      ),
    }));
  }

  private eventosPresencaValidos(
    eventos: Array<{
      evento: string;
      ocorridoEm: Date;
      duracaoSegundos: number | null;
      metadata?: unknown;
    }>,
  ) {
    return eventos.filter((e) => e.evento === "join" || e.evento === "leave");
  }

  private resolverAlertasPresenca(
    eventos: Array<{ evento: string; metadata?: unknown }>,
    presenca: { emSessao: boolean },
    emailPresencaReuniao: string | null,
    sessaoEmCurso: boolean,
  ): AlertaPresencaCodigo[] {
    const alertas: AlertaPresencaCodigo[] = [];
    if (!emailPresencaReuniao) {
      alertas.push(ALERTA_PRESENCA.SEM_EMAIL_REUNIAO);
    }
    for (const ev of eventos) {
      if (ev.evento !== "alert") continue;
      const meta = ev.metadata as { tipo?: string } | null;
      if (meta?.tipo === ALERTA_PRESENCA.EMAIL_REUNIAO_INCORRETO) {
        alertas.push(ALERTA_PRESENCA.EMAIL_REUNIAO_INCORRETO);
      }
    }
    const temJoinReuniao = eventos.some((e) => {
      if (e.evento !== "join" && e.evento !== "leave") return false;
      const meta = e.metadata as { origem?: string } | null;
      return meta?.origem === "zoom" || meta?.origem === "teams";
    });
    if (sessaoEmCurso && presenca.emSessao && emailPresencaReuniao && !temJoinReuniao) {
      alertas.push(ALERTA_PRESENCA.SO_PORTAL);
    }
    return [...new Set(alertas)];
  }

  /** Painel ao vivo: formandos matriculados na turma e tempo LMS na sessão. */
  async painelPresencaTurma(user: RequestUser, sessaoFormacaoId: string, turmaId: string) {
    if (!turmaId) {
      throw new BadRequestException("turmaId é obrigatório.");
    }

    const tenantId = requireTenantId(user);

    const sessao = await this.prisma.sessaoFormacao.findFirst({
      where: { id: sessaoFormacaoId, tenantId },
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
      select: { id: true, codigo: true, nome: true, acaoFormacaoId: true },
    });
    if (!turma || turma.acaoFormacaoId !== sessao.cronograma.acaoFormacaoId) {
      throw new BadRequestException("Turma inválida para esta sessão.");
    }

    const matriculas = await this.prisma.matricula.findMany({
      where: { tenantId, turmaId, estado: "ATIVA" },
      include: {
        formando: {
          select: {
            nome: true,
            nif: true,
            email: true,
            emailPresenca: true,
            user: { select: { email: true } },
          },
        },
      },
      orderBy: { formando: { nome: "asc" } },
    });

    const matriculaIds = matriculas.map((m) => m.id);
    const acessos =
      matriculaIds.length > 0
        ? await this.prisma.acessoLms.findMany({
            where: {
              tenantId,
              sessaoFormacaoId,
              matriculaId: { in: matriculaIds },
            },
            select: {
              matriculaId: true,
              evento: true,
              ocorridoEm: true,
              duracaoSegundos: true,
              metadata: true,
            },
            orderBy: { ocorridoEm: "asc" },
          })
        : [];

    const porMatricula = new Map<string, typeof acessos>();
    for (const a of acessos) {
      const list = porMatricula.get(a.matriculaId) ?? [];
      list.push(a);
      porMatricula.set(a.matriculaId, list);
    }

    const now = new Date();
    const sessaoEmCurso = sessao.iniciadaEm != null && sessao.terminadaEm == null;
    const formandos = matriculas.map((m) => {
      const eventos = porMatricula.get(m.id) ?? [];
      const eventosValidos = this.eventosPresencaValidos(eventos);
      const presenca = this.mapPresencaComSessao(eventosValidos, sessao, now);
      const minutos = Math.round(presenca.segundosTotais / 60);
      const emailPresencaReuniao = resolverEmailPresencaFormando({
        emailPresenca: m.formando.emailPresenca,
        emailConta: m.formando.user?.email,
        emailContacto: m.formando.email,
      });
      const alertas = this.resolverAlertasPresenca(
        eventos,
        presenca,
        emailPresencaReuniao,
        sessaoEmCurso,
      );
      return {
        matriculaId: m.id,
        nome: m.formando.nome,
        nif: m.formando.nif,
        emailPresencaReuniao,
        emSessao: presenca.emSessao,
        segundosTotais: presenca.segundosTotais,
        tempoFormatado: presenca.tempoTotalFormatado,
        minutosEfetivos: minutos,
        joinDesde: presenca.joinDesde,
        segundosFechados: presenca.segundosFechados,
        alertas,
      };
    });

    const alertasCount = formandos.reduce((n, f) => n + f.alertas.length, 0);

    return {
      sessao: {
        id: sessao.id,
        numeroSessao: sessao.numeroSessao,
        iniciadaEm: sessao.iniciadaEm,
        terminadaEm: sessao.terminadaEm,
        minutosPresencaMin: sessao.minutosPresencaMin ?? 60,
        emCurso: sessaoEmCurso,
      },
      turma: { id: turma.id, codigo: turma.codigo, nome: turma.nome },
      formandos,
      emSessaoCount: formandos.filter((f) => f.emSessao).length,
      totalMatriculas: formandos.length,
      alertasCount,
    };
  }
}
