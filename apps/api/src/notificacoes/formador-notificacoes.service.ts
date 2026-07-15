import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PortalNotificacoesService } from "./portal-notificacoes.service";

export type FormadorNotificacaoInput = {
  tipo: string;
  titulo: string;
  mensagem: string;
  link?: string;
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

  private uniqueUserIds(raw: Array<string | null | undefined>): string[] {
    return [...new Set(raw.filter((id): id is string => Boolean(id)))];
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
