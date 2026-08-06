import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PortalNotificacoesService } from "./portal-notificacoes.service";

export type FormadorNotificacaoInput = {
  tipo: string;
  titulo: string;
  mensagem: string;
  link?: string;
  /** Se definido, envia também email para a conta do formador. */
  emailSubject?: string;
  emailText?: string;
  emailHtml?: string;
};

@Injectable()
export class FormadorNotificacoesService {
  private readonly logger = new Logger(FormadorNotificacoesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly portal: PortalNotificacoesService,
  ) {}

  /** Formadores com sessões atribuídas nesta acção. */
  async userIdsForAcao(tenantId: string, acaoId: string): Promise<string[]> {
    const rows = await this.prisma.sessaoFormacao.findMany({
      where: {
        tenantId,
        formadorId: { not: null },
        cronograma: { acaoFormacaoId: acaoId },
      },
      select: { formador: { select: { userId: true } } },
    });
    return this.uniqueUserIds(rows.map((r) => r.formador?.userId));
  }

  /** Formadores ligados ao curso (sessões em qualquer acção ou módulo). */
  async userIdsForCurso(tenantId: string, cursoId: string): Promise<string[]> {
    const [sessoes, modulos] = await Promise.all([
      this.prisma.sessaoFormacao.findMany({
        where: {
          tenantId,
          formadorId: { not: null },
          cronograma: { acaoFormacao: { cursoId } },
        },
        select: { formador: { select: { userId: true } } },
      }),
      this.prisma.moduloUnidade.findMany({
        where: { tenantId, cursoId, formadorId: { not: null } },
        select: { formador: { select: { userId: true } } },
      }),
    ]);
    return this.uniqueUserIds([
      ...sessoes.map((r) => r.formador?.userId),
      ...modulos.map((r) => r.formador?.userId),
    ]);
  }

  async notifyForAcao(tenantId: string, acaoId: string, input: FormadorNotificacaoInput) {
    const userIds = await this.userIdsForAcao(tenantId, acaoId);
    await this.notifyMany(tenantId, userIds, input);
  }

  async notifyForCurso(tenantId: string, cursoId: string, input: FormadorNotificacaoInput) {
    const userIds = await this.userIdsForCurso(tenantId, cursoId);
    await this.notifyMany(tenantId, userIds, input);
  }

  async notifyCursoCrud(
    tenantId: string,
    cursoId: string,
    designacao: string,
    operacao: "criado" | "atualizado",
  ) {
    await this.notifyForCurso(tenantId, cursoId, {
      tipo: "curso_crud",
      titulo: operacao === "criado" ? "Novo curso" : "Curso actualizado",
      mensagem: `O curso «${designacao}» foi ${operacao}.`,
      link: `/portal/cursos/${cursoId}`,
    });
  }

  async notifyAcaoCrud(
    tenantId: string,
    acaoId: string,
    cursoId: string,
    titulo: string,
    operacao: "criada" | "actualizada",
  ) {
    const input: FormadorNotificacaoInput = {
      tipo: "acao_crud",
      titulo: operacao === "criada" ? "Nova acção de formação" : "Acção actualizada",
      mensagem: `A acção «${titulo}» foi ${operacao}.`,
      link: `/portal/acoes/${acaoId}`,
    };
    await this.notifyForAcao(tenantId, acaoId, input);
    if (operacao === "criada") {
      await this.notifyForCurso(tenantId, cursoId, input);
    }
  }

  async notifyMatriculaNova(
    tenantId: string,
    acaoId: string,
    params: { formandoNome: string; turmaCodigo: string; acaoTitulo: string },
  ) {
    await this.notifyForAcao(tenantId, acaoId, {
      tipo: "matricula_nova",
      titulo: "Nova inscrição",
      mensagem: `${params.formandoNome} inscreveu-se na turma ${params.turmaCodigo} (${params.acaoTitulo}).`,
      link: `/portal/acoes/${acaoId}`,
    });
  }

  /**
   * Se o formando concluiu todas as tarefas LMS publicadas, notifica os formadores da acção (1×).
   */
  async notifyIfPercursoCompleto(tenantId: string, matriculaId: string): Promise<void> {
    try {
      const matricula = await this.prisma.matricula.findFirst({
        where: { id: matriculaId, tenantId },
        select: {
          id: true,
          formando: { select: { nome: true } },
          turma: {
            select: {
              codigo: true,
              acaoFormacaoId: true,
              acaoFormacao: {
                select: {
                  id: true,
                  titulo: true,
                  codigoInterno: true,
                  cursoId: true,
                },
              },
            },
          },
        },
      });
      if (!matricula) return;

      const cursoId = matricula.turma.acaoFormacao.cursoId;
      const tarefas = await this.prisma.moduloConteudo.findMany({
        where: { tenantId, cursoId, publicado: true },
        select: { id: true },
      });
      if (!tarefas.length) return;

      const concluidos = await this.prisma.progressoModulo.count({
        where: {
          tenantId,
          matriculaId,
          moduloId: { in: tarefas.map((t) => t.id) },
          concluidoEm: { not: null },
        },
      });
      if (concluidos < tarefas.length) return;

      const acaoId = matricula.turma.acaoFormacaoId;
      const link = `/portal/progresso-lms?acao=${encodeURIComponent(acaoId)}&matricula=${encodeURIComponent(matriculaId)}`;

      const jaNotificado = await this.prisma.notificacaoPortal.findFirst({
        where: {
          tenantId,
          tipo: "lms_percurso_completo",
          link,
        },
        select: { id: true },
      });
      if (jaNotificado) return;

      const formandoNome = matricula.formando.nome;
      const acao = matricula.turma.acaoFormacao;
      await this.notifyForAcao(tenantId, acaoId, {
        tipo: "lms_percurso_completo",
        titulo: "Formando concluiu o LMS",
        mensagem: `${formandoNome} concluiu todas as tarefas de «${acao.codigoInterno} – ${acao.titulo}» (${matricula.turma.codigo}).`,
        link,
      });
    } catch (err) {
      this.logger.warn(
        `notifyIfPercursoCompleto(${matriculaId}): ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  private uniqueUserIds(raw: Array<string | null | undefined>): string[] {
    return [...new Set(raw.filter((id): id is string => Boolean(id)))];
  }

  /** Notifica userIds concretos (ex.: atribuição de sessões). */
  async notifyUserIds(
    tenantId: string,
    userIds: string[],
    input: FormadorNotificacaoInput,
  ) {
    await this.notifyMany(tenantId, this.uniqueUserIds(userIds), input);
  }

  private async notifyMany(
    tenantId: string,
    userIds: string[],
    input: FormadorNotificacaoInput,
  ) {
    if (!userIds.length) return;
    for (const userId of userIds) {
      void this.portal
        .notifyUser({
          tenantId,
          userId,
          tipo: input.tipo,
          titulo: input.titulo,
          mensagem: input.mensagem,
          link: input.link,
          push: {
            title: input.titulo,
            body: input.mensagem,
            url: input.link,
          },
          ...(input.emailSubject && input.emailText
            ? {
                emailConteudo: {
                  subject: input.emailSubject,
                  text: input.emailText,
                  html:
                    input.emailHtml ??
                    `<p>${input.emailText.replace(/\n/g, "<br/>")}</p>`,
                },
              }
            : {}),
        })
        .catch((err) => {
          this.logger.warn(
            `Falha notificação formador ${userId} (${input.tipo}): ${err instanceof Error ? err.message : err}`,
          );
        });
    }
    this.logger.log(`Notificação ${input.tipo} → ${userIds.length} formador(es)`);
  }
}
