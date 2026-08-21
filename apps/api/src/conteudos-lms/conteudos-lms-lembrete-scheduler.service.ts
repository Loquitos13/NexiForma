import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { PortalNotificacoesService } from "../notificacoes/portal-notificacoes.service";
import { EmailTemplates } from "../notificacoes/templates/email.templates";
import { resolveAppPublicUrlForLinks } from "../common/app-public-url.util";
import {
  resolverContinuarPercurso,
  resolverEmailNotificacaoFormando,
  tarefaConcluidaEfectiva,
} from "@nexiforma/shared";

/** Dias antes do prazo em que enviamos lembrete (email + push). */
const LEMBRETE_DIAS = [7, 3, 1] as const;

/**
 * Lembretes de conclusão LMS antes do prazo da acção.
 * Activar com CRON_LMS_PRAZO_ENABLED=true ou CRON_NOTIFICACOES_ENABLED=true.
 */
@Injectable()
export class ConteudosLmsLembreteSchedulerService {
  private readonly logger = new Logger(ConteudosLmsLembreteSchedulerService.name);
  private running = false;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly portal: PortalNotificacoesService,
  ) {}

  private enabled(): boolean {
    const dedicated = this.config.get<string>("CRON_LMS_PRAZO_ENABLED");
    if (dedicated === "true") return true;
    if (dedicated === "false") return false;
    return this.config.get<string>("CRON_NOTIFICACOES_ENABLED") === "true";
  }

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async enviarLembretesPrazoLms() {
    if (!this.enabled() || this.running) return;
    this.running = true;
    try {
      const result = await this.processarLembretes();
      if (result.enviados > 0) {
        this.logger.log(`LMS lembretes: ${result.enviados} notificação(ões) enviada(s).`);
      }
    } catch (err) {
      this.logger.warn(`LMS lembretes cron: ${String(err)}`);
    } finally {
      this.running = false;
    }
  }

  async processarLembretes(): Promise<{ enviados: number }> {
    const now = new Date();
    const msDia = 86_400_000;
    const appUrl = resolveAppPublicUrlForLinks(this.config);
    let enviados = 0;

    const matriculas = await this.prisma.matricula.findMany({
      where: { estado: "ATIVA" },
      select: {
        id: true,
        tenantId: true,
        formando: {
          select: {
            userId: true,
            nome: true,
            email: true,
            user: { select: { email: true } },
          },
        },
        turma: {
          select: {
            acaoFormacao: {
              select: {
                titulo: true,
                cursoId: true,
                prazoConclusaoLms: true,
                dataFim: true,
              },
            },
          },
        },
      },
    });

    for (const m of matriculas) {
      const userId = m.formando.userId;
      const acao = m.turma.acaoFormacao;
      const limite = acao.prazoConclusaoLms ?? acao.dataFim;
      if (!userId || !limite || !acao.cursoId) continue;

      const diasRestantes = Math.ceil((limite.getTime() - now.getTime()) / msDia);
      if (!LEMBRETE_DIAS.includes(diasRestantes as (typeof LEMBRETE_DIAS)[number])) continue;

      const tipo = `lms_prazo_lembrete_${diasRestantes}d`;
      const link = `/portal/formando/aprendizagem/${m.id}`;
      const jaEnviado = await this.prisma.notificacaoPortal.findFirst({
        where: {
          userId,
          tenantId: m.tenantId,
          tipo,
          link,
          createdAt: { gte: new Date(now.getTime() - 20 * 60 * 60 * 1000) },
        },
        select: { id: true },
      });
      if (jaEnviado) continue;

      const [unidades, modulos, progressos, desbloqueios] = await Promise.all([
        this.prisma.moduloUnidade.findMany({
          where: { tenantId: m.tenantId, cursoId: acao.cursoId },
          select: { id: true, ordem: true, notaMinima: true },
          orderBy: { ordem: "asc" },
        }),
        this.prisma.moduloConteudo.findMany({
          where: { tenantId: m.tenantId, cursoId: acao.cursoId, publicado: true },
          select: {
            id: true,
            ordem: true,
            moduloUnidadeId: true,
            notaMinima: true,
          },
          orderBy: { ordem: "asc" },
        }),
        this.prisma.progressoModulo.findMany({
          where: { matriculaId: m.id },
          select: { moduloId: true, percentual: true, pontuacao: true, concluidoEm: true },
        }),
        this.prisma.matriculaUnidadeDesbloqueio.findMany({
          where: { matriculaId: m.id },
          select: { moduloUnidadeId: true },
        }),
      ]);

      const desbloqueiosSet = new Set(desbloqueios.map((d) => d.moduloUnidadeId));
      const progressoMap = new Map(progressos.map((p) => [p.moduloId, p]));

      const unidadesUi = unidades.map((u) => ({
        id: u.id,
        ordem: u.ordem,
        desbloqueado: desbloqueiosSet.has(u.id),
        notaMinima: u.notaMinima,
        pontuacao: null,
      }));

      const tarefasUi = modulos.map((mod) => {
        const prog = progressoMap.get(mod.id);
        const concluido = !!prog?.concluidoEm;
        const percentual = prog?.percentual ?? 0;
        return {
          id: mod.id,
          ordem: mod.ordem,
          moduloUnidadeId: mod.moduloUnidadeId,
          desbloqueado: mod.moduloUnidadeId ? desbloqueiosSet.has(mod.moduloUnidadeId) : true,
          notaMinima: mod.notaMinima,
          pontuacao: prog?.pontuacao ?? null,
          concluido,
          percentual,
        };
      });

      const pendentes = tarefasUi.filter((t) => t.desbloqueado && !tarefaConcluidaEfectiva(t));
      if (pendentes.length === 0) continue;

      const destino = resolverContinuarPercurso(unidadesUi, tarefasUi);
      const continuarUrl = destino.tarefaId
        ? `${appUrl}${link}?tarefa=${encodeURIComponent(destino.tarefaId)}`
        : `${appUrl}${link}`;

      const limiteStr = limite.toISOString().slice(0, 10);
      const titulo =
        diasRestantes === 1
          ? "Prazo LMS amanhã"
          : `Faltam ${diasRestantes} dias para o prazo LMS`;
      const mensagem = `Tens ${pendentes.length} conteúdo(s) por concluir em «${acao.titulo}» até ${limiteStr}.`;

      const emailTo = resolverEmailNotificacaoFormando({
        emailContacto: m.formando.email,
        emailConta: m.formando.user?.email,
      });
      const emailTpl = EmailTemplates.lmsPrazoLembrete({
        nomeFormando: m.formando.nome,
        acaoTitulo: acao.titulo,
        limite: limiteStr,
        diasRestantes,
        pendentes: pendentes.length,
        portalUrl: continuarUrl,
      });

      await this.portal.notifyUser({
        tenantId: m.tenantId,
        userId,
        tipo,
        titulo,
        mensagem,
        link,
        email: emailTo ? { to: emailTo, ...emailTpl } : undefined,
        push: {
          title: titulo,
          body: mensagem,
          url: continuarUrl,
        },
      });
      enviados += 1;
    }

    return { enviados };
  }
}
