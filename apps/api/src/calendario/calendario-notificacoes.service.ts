import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { SessaoFormacao } from "@nexiforma/database";
import { MailService } from "../mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";
import { PortalNotificacoesService } from "../notificacoes/portal-notificacoes.service";
import { NotificacoesExtendedService } from "../notificacoes/notificacoes-extended.service";
import { EmailTemplates } from "../notificacoes/templates/email.templates";
import { parseAudienciaRoles, parseParticipantes } from "./calendario-reuniao.util";
import { resolveAppPublicUrlForLinks } from "../common/app-public-url.util";
import type { TenantUserRole } from "@nexiforma/database";

type LembreteTipo = "CRIACAO" | "SEMANA_ANTES" | "DIA_ANTES" | "HORA_EVENTO" | "TEAMS_SALA";

@Injectable()
export class CalendarioNotificacoesService {
  private readonly logger = new Logger(CalendarioNotificacoesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly portal: PortalNotificacoesService,
    private readonly extended: NotificacoesExtendedService,
    private readonly config: ConfigService,
  ) {}

  async onSessaoCriada(sessaoId: string, tenantId: string) {
    const sessao = await this.prisma.sessaoFormacao.findFirst({
      where: { id: sessaoId, tenantId },
      include: {
        cronograma: {
          select: {
            acaoFormacaoId: true,
            acaoFormacao: { select: { codigoInterno: true, titulo: true } },
          },
        },
        formador: { select: { user: { select: { id: true, email: true, displayName: true } } } },
      },
    });
    if (!sessao) return;

    const formandos = await this.formandosDaAcao(tenantId, sessao.cronograma.acaoFormacaoId);
    const dataHora = this.formatDataHora(sessao);
    const portalUrl = `${this.appUrl()}/portal/formando/calendario`;

    for (const f of formandos) {
      await this.enviarLembrete({
        tenantId,
        fonte: "SESSAO_FORMACAO",
        fonteId: sessao.id,
        userId: f.userId,
        email: f.email,
        nome: f.nome,
        tipo: "CRIACAO",
        titulo: `Nova sessão: ${sessao.cronograma.acaoFormacao.titulo}`,
        corpo: `Sessão ${sessao.numeroSessao} em ${dataHora} (${sessao.modalidade}).`,
        link: portalUrl,
        emailKind: "sessao",
        sessao: {
          nomeSessao: `${sessao.cronograma.acaoFormacao.codigoInterno} – Sessão ${sessao.numeroSessao}`,
          dataHora,
          localidade: sessao.local ?? sessao.modalidade,
          formador: sessao.formador?.user.displayName ?? "Formador",
        },
      });
    }
  }

  async onReuniaoAgendada(interaccaoId: string, tenantId: string) {
    const row = await this.loadReuniaoRow(interaccaoId, tenantId);
    if (!row?.agendadoPara) return;

    const userIds = await this.resolverDestinatariosReuniao(
      tenantId,
      parseParticipantes(row.participantesIds),
      row.audienciaRoles,
      row.criadoPorUserId,
    );

    await this.notificarUtilizadoresReuniao({
      row,
      tenantId,
      userIds,
      tipo: "CRIACAO",
      tituloPrefixo: "Reunião agendada",
    });

    await this.notificarClienteReuniao(row, "Reunião agendada");
  }

  /** Sala Teams criada ou actualizada - email + sino com link directo. */
  async onReuniaoTeamsSalaCriada(interaccaoId: string, tenantId: string) {
    const row = await this.loadReuniaoRow(interaccaoId, tenantId);
    if (!row?.agendadoPara || !row.salaJoinUrl) return;

    const userIds = await this.resolverDestinatariosReuniao(
      tenantId,
      parseParticipantes(row.participantesIds),
      row.audienciaRoles,
      row.criadoPorUserId,
    );

    await this.notificarUtilizadoresReuniao({
      row,
      tenantId,
      userIds,
      tipo: "TEAMS_SALA",
      tituloPrefixo: "Sala Teams disponível",
    });

    await this.notificarClienteReuniao(row, "Sala Teams da reunião");
  }

  private async loadReuniaoRow(interaccaoId: string, tenantId: string) {
    return this.prisma.interaccaoComercial.findFirst({
      where: { id: interaccaoId, tenantId, tipo: "REUNIAO" },
      include: {
        entidadeCliente: { select: { nome: true, email: true } },
        leadComercial: { select: { empresaNome: true, codigo: true } },
        criadoPor: { select: { id: true, email: true, displayName: true } },
      },
    });
  }

  private buildReuniaoCorpo(row: {
    agendadoPara: Date | null;
    salaJoinUrl: string | null;
    entidadeCliente?: { nome: string } | null;
    leadComercial?: { empresaNome: string; codigo: string } | null;
  }): string {
    const cliente =
      row.entidadeCliente?.nome ?? row.leadComercial?.empresaNome ?? row.leadComercial?.codigo ?? "";
    const parts = [row.agendadoPara?.toLocaleString("pt-PT") ?? "-"];
    if (cliente) parts.push(cliente);
    if (row.salaJoinUrl) parts.push("Reunião online via Microsoft Teams.");
    return parts.join(" · ");
  }

  private calendarioLink(row: { agendadoPara: Date; id: string }): string {
    const data = row.agendadoPara.toISOString().slice(0, 10);
    return `${this.appUrl()}/portal/calendario?data=${data}&reuniao=${row.id}`;
  }

  private async notificarUtilizadoresReuniao(input: {
    row: {
      id: string;
      titulo: string | null;
      agendadoPara: Date | null;
      salaJoinUrl: string | null;
      entidadeCliente?: { nome: string } | null;
      leadComercial?: { empresaNome: string; codigo: string } | null;
    };
    tenantId: string;
    userIds: string[];
    tipo: LembreteTipo;
    tituloPrefixo: string;
  }) {
    const titulo = input.row.titulo?.trim() || "Reunião comercial";
    const corpo = this.buildReuniaoCorpo(input.row);
    const link =
      input.row.agendadoPara != null
        ? this.calendarioLink({ agendadoPara: input.row.agendadoPara, id: input.row.id })
        : `${this.appUrl()}/portal/calendario`;

    const users = await this.prisma.user.findMany({
      where: { tenantId: input.tenantId, id: { in: input.userIds }, active: true },
      select: { id: true, email: true, displayName: true },
    });

    for (const u of users) {
      await this.enviarLembrete({
        tenantId: input.tenantId,
        fonte: "INTERACCAO_CRM",
        fonteId: input.row.id,
        userId: u.id,
        email: u.email,
        nome: u.displayName ?? u.email,
        tipo: input.tipo,
        titulo: `${input.tituloPrefixo}: ${titulo}`,
        corpo,
        link,
        emailKind: "reuniao",
        teamsJoinUrl: input.row.salaJoinUrl,
      });
    }
  }

  private async notificarClienteReuniao(
    row: {
      id: string;
      titulo: string | null;
      agendadoPara: Date | null;
      salaJoinUrl: string | null;
      entidadeCliente?: { nome: string; email: string | null } | null;
    },
    assuntoPrefixo: string,
  ) {
    const email = row.entidadeCliente?.email?.trim();
    if (!email || !row.salaJoinUrl) return;

    const titulo = row.titulo?.trim() || "Reunião comercial";
    const tpl = EmailTemplates.lembreteCalendario({
      nome: row.entidadeCliente?.nome ?? "Cliente",
      titulo: `${assuntoPrefixo}: ${titulo}`,
      corpo: this.buildReuniaoCorpo(row),
      tipo: row.salaJoinUrl ? "TEAMS_SALA" : "CRIACAO",
      link: row.salaJoinUrl,
      teamsJoinUrl: row.salaJoinUrl,
    });

    try {
      await this.mail.send({
        to: email,
        subject: tpl.subject,
        text: tpl.text,
        html: tpl.html,
      });
    } catch (err) {
      this.logger.warn(`Email reunião cliente (${row.id}): ${String(err)}`);
    }
  }

  async processarLembretesPendentes() {
    const now = new Date();
    const em7d = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const em1d = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const em1h = new Date(now.getTime() + 60 * 60 * 1000);

    await this.processarSessoes(now, em7d, em1d, em1h);
    await this.processarReunioes(now, em7d, em1d, em1h);
  }

  private async processarSessoes(now: Date, em7d: Date, em1d: Date, em1h: Date) {
    const sessoes = await this.prisma.sessaoFormacao.findMany({
      where: { data: { gte: now } },
      include: {
        cronograma: {
          select: {
            acaoFormacaoId: true,
            acaoFormacao: { select: { codigoInterno: true, titulo: true } },
          },
        },
        formador: { select: { user: { select: { displayName: true } } } },
      },
      take: 200,
    });

    for (const s of sessoes) {
      const inicio = this.sessaoDateTime(s);
      if (!inicio) continue;
      const formandos = await this.formandosDaAcao(s.tenantId, s.cronograma.acaoFormacaoId);
      const dataHora = this.formatDataHora(s);
      const portalUrl = `${this.appUrl()}/portal/formando/calendario`;

      for (const tipo of this.tiposParaInstante(inicio, now, em7d, em1d, em1h)) {
        for (const f of formandos) {
          await this.enviarLembrete({
            tenantId: s.tenantId,
            fonte: "SESSAO_FORMACAO",
            fonteId: s.id,
            userId: f.userId,
            email: f.email,
            nome: f.nome,
            tipo,
            titulo: `Lembrete: ${s.cronograma.acaoFormacao.titulo}`,
            corpo: `Sessão ${s.numeroSessao} – ${dataHora}`,
            link: portalUrl,
            emailKind: "sessao",
            sessao: {
              nomeSessao: `${s.cronograma.acaoFormacao.codigoInterno} – Sessão ${s.numeroSessao}`,
              dataHora,
              localidade: s.local ?? s.modalidade,
              formador: s.formador?.user.displayName ?? "Formador",
            },
          });
        }
      }
    }
  }

  private async processarReunioes(now: Date, em7d: Date, em1d: Date, em1h: Date) {
    const reunioes = await this.prisma.interaccaoComercial.findMany({
      where: { tipo: "REUNIAO", agendadoPara: { gte: now } },
      take: 200,
    });

    for (const r of reunioes) {
      if (!r.agendadoPara) continue;
      const agendadoPara = r.agendadoPara;
      const participantes = parseParticipantes(r.participantesIds);
      const userIds = await this.resolverDestinatariosReuniao(
        r.tenantId,
        participantes,
        r.audienciaRoles,
        r.criadoPorUserId,
      );
      const users = await this.prisma.user.findMany({
        where: { tenantId: r.tenantId, id: { in: userIds }, active: true },
        select: { id: true, email: true, displayName: true },
      });

      const link = this.calendarioLink({ agendadoPara, id: r.id });
      const corpo = this.buildReuniaoCorpo(r);

      for (const tipo of this.tiposParaInstante(agendadoPara, now, em7d, em1d, em1h)) {
        for (const u of users) {
          await this.enviarLembrete({
            tenantId: r.tenantId,
            fonte: "INTERACCAO_CRM",
            fonteId: r.id,
            userId: u.id,
            email: u.email,
            nome: u.displayName ?? u.email,
            tipo,
            titulo: `Lembrete: ${r.titulo ?? "Reunião"}`,
            corpo,
            link,
            emailKind: "reuniao",
            teamsJoinUrl: r.salaJoinUrl,
          });
        }
      }
    }
  }

  private async enviarLembrete(input: {
    tenantId: string;
    fonte: string;
    fonteId: string;
    userId: string;
    email: string;
    nome: string;
    tipo: LembreteTipo;
    titulo: string;
    corpo: string;
    link: string;
    emailKind: "sessao" | "reuniao";
    teamsJoinUrl?: string | null;
    sessao?: {
      nomeSessao: string;
      dataHora: string;
      localidade: string;
      formador: string;
    };
  }) {
    const exists = await this.prisma.calendarioLembreteLog.findUnique({
      where: {
        fonte_fonteId_userId_tipo: {
          fonte: input.fonte,
          fonteId: input.fonteId,
          userId: input.userId,
          tipo: input.tipo,
        },
      },
    });
    if (exists) return;

    try {
      if (input.emailKind === "sessao" && input.sessao && input.tipo === "CRIACAO") {
        await this.extended.notificarSessaoAgendada(input.email, input.nome, input.sessao);
      } else {
        const tpl = EmailTemplates.lembreteCalendario({
          nome: input.nome,
          titulo: input.titulo,
          corpo: input.corpo,
          tipo: input.tipo,
          link: input.link,
          teamsJoinUrl: input.teamsJoinUrl ?? undefined,
        });
        await this.mail.send({
          to: input.email,
          subject: tpl.subject,
          text: tpl.text,
          html: tpl.html,
        });
      }

      await this.portal.notifyUser({
        tenantId: input.tenantId,
        userId: input.userId,
        tipo: "calendario",
        titulo: input.titulo,
        mensagem: input.teamsJoinUrl
          ? `${input.corpo} Link Teams: ${input.teamsJoinUrl}`
          : input.corpo,
        link: input.link,
      });

      await this.prisma.calendarioLembreteLog.create({
        data: {
          tenantId: input.tenantId,
          fonte: input.fonte,
          fonteId: input.fonteId,
          userId: input.userId,
          tipo: input.tipo,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Lembrete calendário falhou (${input.fonte}/${input.fonteId}/${input.tipo}): ${String(err)}`,
      );
    }
  }

  private tiposParaInstante(
    inicio: Date,
    now: Date,
    em7d: Date,
    em1d: Date,
    em1h: Date,
  ): LembreteTipo[] {
    const out: LembreteTipo[] = [];
    const diff = inicio.getTime() - now.getTime();
    const week = 7 * 24 * 60 * 60 * 1000;
    const day = 24 * 60 * 60 * 1000;
    const hour = 60 * 60 * 1000;
    if (diff <= week + hour && diff >= week - hour) out.push("SEMANA_ANTES");
    if (diff <= day + 30 * 60 * 1000 && diff >= day - 30 * 60 * 1000) out.push("DIA_ANTES");
    if (diff <= hour + 10 * 60 * 1000 && diff >= hour - 10 * 60 * 1000) out.push("HORA_EVENTO");
    return out;
  }

  private sessaoDateTime(s: SessaoFormacao): Date | null {
    const [h, m] = s.horaInicio.split(":").map(Number);
    if (Number.isNaN(h)) return null;
    const d = new Date(s.data);
    d.setHours(h, m ?? 0, 0, 0);
    return d;
  }

  private formatDataHora(s: SessaoFormacao): string {
    const d = s.data.toLocaleDateString("pt-PT");
    return `${d} ${s.horaInicio}`;
  }

  private async formandosDaAcao(tenantId: string, acaoFormacaoId: string) {
    const mats = await this.prisma.matricula.findMany({
      where: {
        tenantId,
        estado: "ATIVA",
        turma: { acaoFormacaoId },
      },
      select: {
        formando: {
          select: {
            user: { select: { id: true, email: true, displayName: true } },
          },
        },
      },
    });
    return mats
      .filter((m) => m.formando.user)
      .map((m) => ({
        userId: m.formando.user!.id,
        email: m.formando.user!.email,
        nome: m.formando.user!.displayName ?? m.formando.user!.email,
      }))
      .filter((x) => x.email);
  }

  private async resolverDestinatariosReuniao(
    tenantId: string,
    participantesIds: string[],
    audienciaRolesRaw: unknown,
    criadorUserId?: string | null,
  ): Promise<string[]> {
    let ids: string[];
    if (participantesIds.length > 0) {
      ids = [...participantesIds];
    } else {
      const roles = parseAudienciaRoles(audienciaRolesRaw);
      if (roles.length > 0) {
        const users = await this.prisma.user.findMany({
          where: { tenantId, active: true, role: { in: roles as TenantUserRole[] } },
          select: { id: true },
        });
        ids = users.map((u) => u.id);
      } else if (criadorUserId) {
        ids = [criadorUserId];
      } else {
        ids = [];
      }
    }

    if (criadorUserId && !ids.includes(criadorUserId)) {
      ids = [criadorUserId, ...ids];
    }
    return ids;
  }

  private appUrl(): string {
    return resolveAppPublicUrlForLinks(this.config).replace(/\/$/, "");
  }
}
