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
import type { CreateQuizPerguntaDto, SubmitQuizDto, UpdateQuizPerguntaDto } from "./dto/quizzes.dto";
import {
  notaMinimaParaDesbloquearProximo,
  tarefaDesbloqueada,
  unidadesOrdenadas,
} from "@nexiforma/shared";

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
  constructor(private readonly prisma: PrismaService) {}

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
        opcoes: dto.opcoes as unknown as Prisma.InputJsonValue,
        pontos: dto.pontos ?? 1,
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
        ...(dto.opcoes !== undefined
          ? { opcoes: dto.opcoes as unknown as Prisma.InputJsonValue }
          : {}),
        ...(dto.pontos !== undefined ? { pontos: dto.pontos } : {}),
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

    return { ...tentativa, notaMinima, feedback };
  }

  private async assertTarefaAcessivel(
    tenantId: string,
    matriculaId: string,
    modulo: { id: string; cursoId: string; moduloUnidadeId: string | null },
  ): Promise<void> {
    const [unidades, modulos, progressos] = await Promise.all([
      this.prisma.moduloUnidade.findMany({ where: { tenantId, cursoId: modulo.cursoId } }),
      this.prisma.moduloConteudo.findMany({
        where: { tenantId, cursoId: modulo.cursoId, publicado: true },
      }),
      this.prisma.progressoModulo.findMany({ where: { tenantId, matriculaId } }),
    ]);

    const progressoRows = progressos.map((p) => ({
      moduloId: p.moduloId,
      percentual: p.percentual,
      pontuacao: p.pontuacao,
      concluidoEm: p.concluidoEm,
    }));

    if (!tarefaDesbloqueada(unidades, modulos, progressoRows, modulo.id)) {
      const sorted = unidadesOrdenadas(unidades);
      const idx = sorted.findIndex((u) => u.id === modulo.moduloUnidadeId);
      const prev = idx > 0 ? sorted[idx - 1] : null;
      const minima = prev ? notaMinimaParaDesbloquearProximo(prev) : 60;
      throw new ForbiddenException(
        `Conclui o módulo anterior com pelo menos ${minima}% para desbloquear este quiz.`,
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
