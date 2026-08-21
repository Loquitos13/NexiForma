import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma, QuizPergunta, QuizTentativa } from "@nexiforma/database";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "../common/tenant-scope";
import { FormadorNotificacoesService } from "../notificacoes/formador-notificacoes.service";
import type { CreateQuizPerguntaDto, SubmitQuizDto, UpdateQuizPerguntaDto } from "./dto/quizzes.dto";
import {
  notaMinimaParaDesbloquearProximo,
  prerequisitoUnidadeEfectivo,
  tarefaDesbloqueada,
} from "@nexiforma/shared";
import { prazoConclusaoAtingido } from "../conteudos-lms/lms-prazo.util";

type OpcaoQuiz = { id: string; texto: string; correta?: boolean };

export type QuizFeedbackItem = {
  perguntaId: string;
  enunciado: string;
  correto: boolean;
  opcaoEscolhidaId: string | null;
};

export type QuizSubmitResult = QuizTentativa & {
  notaMinima: number;
  feedback: QuizFeedbackItem[];
};

@Injectable()
export class QuizzesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly formadorNotificacoes: FormadorNotificacoesService,
  ) {}

  listPerguntas(user: RequestUser, moduloId: string): Promise<QuizPergunta[]> {
    const tenantId = requireTenantId(user);
    return this.prisma.quizPergunta.findMany({
      where: { tenantId, moduloId },
      orderBy: [{ ordem: "asc" }, { createdAt: "asc" }],
    });
  }

  /** Formando – opções sem flag correta. */
  async listPerguntasFormando(user: RequestUser, moduloId: string) {
    const rows = await this.listPerguntas(user, moduloId);
    return rows.map((p) => ({
      id: p.id,
      enunciado: p.enunciado,
      ordem: p.ordem,
      pontos: p.pontos,
      tipo: p.tipo ?? "MULTIPLA",
      opcoes: (p.opcoes as OpcaoQuiz[]).map(({ id, texto }) => ({ id, texto })),
    }));
  }

  async createPergunta(user: RequestUser, dto: CreateQuizPerguntaDto): Promise<QuizPergunta> {
    const tenantId = requireTenantId(user);
    const modulo = await this.prisma.moduloConteudo.findFirst({
      where: { id: dto.moduloId, tenantId, tipo: "QUIZ" },
    });
    if (!modulo) {
      throw new NotFoundException("Módulo QUIZ não encontrado.");
    }
    return this.prisma.quizPergunta.create({
      data: {
        tenantId,
        moduloId: dto.moduloId,
        enunciado: dto.enunciado.trim(),
        ordem: dto.ordem ?? 0,
        tipo: dto.tipo ?? "MULTIPLA",
        opcoes: dto.opcoes as unknown as Prisma.InputJsonValue,
        pontos: dto.pontos ?? 1,
        explicacao: dto.explicacao?.trim() || null,
      },
    });
  }

  async updatePergunta(
    user: RequestUser,
    id: string,
    dto: UpdateQuizPerguntaDto,
  ): Promise<QuizPergunta> {
    const tenantId = requireTenantId(user);
    const existing = await this.prisma.quizPergunta.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException("Pergunta não encontrada.");
    return this.prisma.quizPergunta.update({
      where: { id },
      data: {
        ...(dto.enunciado !== undefined ? { enunciado: dto.enunciado.trim() } : {}),
        ...(dto.ordem !== undefined ? { ordem: dto.ordem } : {}),
        ...(dto.tipo !== undefined ? { tipo: dto.tipo } : {}),
        ...(dto.opcoes !== undefined
          ? { opcoes: dto.opcoes as unknown as Prisma.InputJsonValue }
          : {}),
        ...(dto.pontos !== undefined ? { pontos: dto.pontos } : {}),
        ...(dto.explicacao !== undefined ? { explicacao: dto.explicacao?.trim() || null } : {}),
      },
    });
  }

  async deletePergunta(user: RequestUser, id: string): Promise<{ ok: true }> {
    const tenantId = requireTenantId(user);
    const existing = await this.prisma.quizPergunta.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException("Pergunta não encontrada.");
    await this.prisma.quizPergunta.delete({ where: { id } });
    return { ok: true };
  }

  async submitTentativa(
    user: RequestUser,
    matriculaId: string,
    moduloId: string,
    dto: SubmitQuizDto,
  ): Promise<QuizSubmitResult> {
    const tenantId = requireTenantId(user);
    await this.assertMatriculaAccess(user, matriculaId, tenantId);

    const modulo = await this.prisma.moduloConteudo.findFirst({
      where: { id: moduloId, tenantId, tipo: "QUIZ" },
    });
    if (!modulo) {
      throw new NotFoundException("Módulo QUIZ não encontrado.");
    }

    await this.assertTarefaAcessivel(tenantId, matriculaId, modulo);

    if (modulo.prerequisitoModuloId) {
      const prereq = await this.prisma.progressoModulo.findFirst({
        where: {
          tenantId,
          matriculaId,
          moduloId: modulo.prerequisitoModuloId,
          concluidoEm: { not: null },
        },
      });
      if (!prereq) {
        throw new ForbiddenException("Conclua o módulo pré-requisito antes do quiz.");
      }
    }

    const perguntas = await this.prisma.quizPergunta.findMany({
      where: { tenantId, moduloId },
    });
    if (perguntas.length === 0) {
      throw new BadRequestException("Quiz sem perguntas configuradas.");
    }

    let pontosObtidos = 0;
    let pontosMax = 0;
    const feedback: QuizFeedbackItem[] = [];
    for (const p of perguntas) {
      const tipo = p.tipo ?? "MULTIPLA";
      if (tipo === "ABERTA") continue;
      pontosMax += p.pontos;
      const opcoes = p.opcoes as OpcaoQuiz[];
      const correta = opcoes.find((o) => o.correta)?.id;
      const resposta = dto.respostas[p.id] ?? null;
      const acertou = !!(correta && resposta === correta);
      if (acertou) pontosObtidos += p.pontos;
      feedback.push({
        perguntaId: p.id,
        enunciado: p.enunciado,
        correto: acertou,
        opcaoEscolhidaId: resposta,
      });
    }

    for (const p of perguntas.filter((x) => (x.tipo ?? "MULTIPLA") === "ABERTA")) {
      const resposta = dto.respostas[p.id] ?? null;
      feedback.push({
        perguntaId: p.id,
        enunciado: p.enunciado,
        correto: false,
        opcaoEscolhidaId: resposta,
      });
    }

    const pontuacao = pontosMax > 0 ? Math.round((pontosObtidos / pontosMax) * 100) : 0;
    const notaMinima = modulo.notaMinima ?? 60;
    const aprovado = pontuacao >= notaMinima;

    const tentativa = await this.prisma.quizTentativa.create({
      data: {
        tenantId,
        matriculaId,
        moduloId,
        respostas: dto.respostas,
        pontuacao,
        aprovado,
      },
    });

    await this.prisma.progressoModulo.upsert({
      where: { matriculaId_moduloId: { matriculaId, moduloId } },
      create: {
        tenantId,
        matriculaId,
        moduloId,
        percentual: aprovado ? 100 : pontuacao,
        pontuacao,
        concluidoEm: aprovado ? new Date() : null,
        tentativas: 1,
      },
      update: {
        percentual: aprovado ? 100 : pontuacao,
        pontuacao,
        concluidoEm: aprovado ? new Date() : null,
        tentativas: { increment: 1 },
        ultimaVisita: new Date(),
      },
    });

    if (aprovado) {
      void this.formadorNotificacoes.notifyIfPercursoCompleto(tenantId, matriculaId);
    }

    return { ...tentativa, notaMinima, feedback };
  }

  private async assertTarefaAcessivel(
    tenantId: string,
    matriculaId: string,
    modulo: { id: string; cursoId: string; moduloUnidadeId: string | null },
  ): Promise<void> {
    const [unidades, modulos, progressos, desbloqueios, matricula, curso] = await Promise.all([
      this.prisma.moduloUnidade.findMany({ where: { tenantId, cursoId: modulo.cursoId } }),
      this.prisma.moduloConteudo.findMany({
        where: { tenantId, cursoId: modulo.cursoId, publicado: true },
      }),
      this.prisma.progressoModulo.findMany({ where: { tenantId, matriculaId } }),
      this.prisma.matriculaUnidadeDesbloqueio.findMany({
        where: { tenantId, matriculaId },
        select: { moduloUnidadeId: true },
      }),
      this.prisma.matricula.findFirst({
        where: { id: matriculaId, tenantId },
        select: { turma: { select: { acaoFormacaoId: true } } },
      }),
      this.prisma.curso.findFirst({
        where: { id: modulo.cursoId, tenantId },
        select: { lmsProgressaoSequencial: true },
      }),
    ]);

    if (modulo.moduloUnidadeId && matricula?.turma?.acaoFormacaoId) {
      const prazo = await this.prisma.acaoModuloPrazoLms.findUnique({
        where: {
          acaoFormacaoId_moduloUnidadeId: {
            acaoFormacaoId: matricula.turma.acaoFormacaoId,
            moduloUnidadeId: modulo.moduloUnidadeId,
          },
        },
        select: { prazoConclusao: true },
      });
      if (prazo && prazoConclusaoAtingido(prazo.prazoConclusao)) {
        throw new ForbiddenException(
          "O limite de conclusão deste módulo foi atingido. Já não é possível responder.",
        );
      }
    }

    const progressoRows = progressos.map((p) => ({
      moduloId: p.moduloId,
      percentual: p.percentual,
      pontuacao: p.pontuacao,
      concluidoEm: p.concluidoEm,
    }));
    const progressaoSequencial = curso?.lmsProgressaoSequencial !== false;
    const lockOpts = {
      desbloqueiosManuais: new Set(desbloqueios.map((d) => d.moduloUnidadeId)),
      progressaoSequencial,
    };

    if (!tarefaDesbloqueada(unidades, modulos, progressoRows, modulo.id, lockOpts)) {
      const unidadeId = modulo.moduloUnidadeId;
      if (unidadeId && !lockOpts.desbloqueiosManuais.has(unidadeId)) {
        throw new ForbiddenException(
          "Este módulo ainda está bloqueado. O formador ou o gestor precisam de o libertar em Tarefas.",
        );
      }
      const prevId = unidadeId
        ? prerequisitoUnidadeEfectivo(unidades, unidadeId, progressaoSequencial)
        : null;
      const prev = prevId ? unidades.find((u) => u.id === prevId) : null;
      const minima = prev ? notaMinimaParaDesbloquearProximo(prev) : 60;
      throw new ForbiddenException(
        prev
          ? `Conclui «${prev.titulo}» com pelo menos ${minima}% para desbloquear este quiz.`
          : "Este quiz ainda não está disponível.",
      );
    }
  }

  listTentativas(user: RequestUser, matriculaId: string, moduloId?: string): Promise<QuizTentativa[]> {
    const tenantId = requireTenantId(user);
    return this.prisma.quizTentativa.findMany({
      where: {
        tenantId,
        matriculaId,
        ...(moduloId ? { moduloId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
  }

  private async assertMatriculaAccess(user: RequestUser, matriculaId: string, tenantId: string) {
    const matricula = await this.prisma.matricula.findFirst({
      where: { id: matriculaId, tenantId },
      include: { formando: { select: { userId: true } } },
    });
    if (!matricula) {
      throw new NotFoundException("Matrícula não encontrada.");
    }
    if (user.role === "formando" && matricula.formando.userId !== user.sub) {
      throw new ForbiddenException("Sem acesso a esta matrícula.");
    }
  }
}
