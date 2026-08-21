import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "../common/tenant-scope";
import { IntegracoesService } from "../integracoes/integracoes.service";
import { CalendarioNotificacoesService } from "../calendario/calendario-notificacoes.service";
import { PrismaService } from "../prisma/prisma.service";
import { CrmInteraccoesService } from "./crm-interaccoes.service";
import type { TerminarReuniaoCrmDto } from "./dto/terminar-reuniao.dto";
import { mapInteraccaoRow, type InteraccaoComercialResposta } from "./crm-ia.types";
import { TeamsTranscriptService } from "../integracoes/teams-transcript.service";

function formatDuracao(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

@Injectable()
export class CrmReuniaoTeamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly integracoes: IntegracoesService,
    private readonly interaccoes: CrmInteraccoesService,
    private readonly calendarioNotificacoes: CalendarioNotificacoesService,
    private readonly teamsTranscript: TeamsTranscriptService,
  ) {}

  async criarSala(user: RequestUser, interaccaoId: string): Promise<InteraccaoComercialResposta> {
    const row = await this.getReuniao(user, interaccaoId);
    if (row.salaJoinUrl) {
      return mapInteraccaoRow(row as unknown as Record<string, unknown>);
    }
    const meeting = await this.integracoes.criarTeamsMeetingComercial(row.tenantId, {
      subject: row.titulo?.trim() || "Reunião comercial NexiForma",
      start: row.agendadoPara ?? undefined,
      end: row.agendadoFim ?? undefined,
    });
    const updated = await this.prisma.interaccaoComercial.update({
      where: { id: interaccaoId },
      data: {
        teamsMeetingId: meeting.meetingId,
        salaJoinUrl: meeting.joinUrl,
        reuniaoEstado: "AGENDADA",
      },
      include: this.detailInclude(),
    });
    void this.calendarioNotificacoes
      .onReuniaoTeamsSalaCriada(interaccaoId, row.tenantId)
      .catch(() => undefined);
    return mapInteraccaoRow(updated as unknown as Record<string, unknown>);
  }

  async iniciar(user: RequestUser, interaccaoId: string): Promise<InteraccaoComercialResposta> {
    const row = await this.getReuniao(user, interaccaoId);
    if (!row.salaJoinUrl) {
      throw new BadRequestException("Crie primeiro a sala Teams desta reunião.");
    }
    if (row.reuniaoEstado === "CONCLUIDA") {
      throw new BadRequestException("Esta reunião já foi terminada.");
    }
    const now = new Date();
    const updated = await this.prisma.interaccaoComercial.update({
      where: { id: interaccaoId },
      data: {
        reuniaoEstado: "EM_CURSO",
        reuniaoIniciadaEm: row.reuniaoIniciadaEm ?? now,
      },
      include: this.detailInclude(),
    });
    return mapInteraccaoRow(updated as unknown as Record<string, unknown>);
  }

  async importarTranscricao(
    user: RequestUser,
    interaccaoId: string,
  ): Promise<{ estado: string; teamsTranscricao?: string | null; mensagem?: string }> {
    const row = await this.getReuniao(user, interaccaoId);
    if (!row.teamsMeetingId) {
      throw new BadRequestException("Reunião sem sala Teams.");
    }
    const tenantId = requireTenantId(user);
    const result = await this.teamsTranscript.importarCrm(interaccaoId, tenantId);
    const fresh = await this.prisma.interaccaoComercial.findFirst({
      where: { id: interaccaoId, tenantId },
      select: { teamsTranscricao: true, teamsTranscricaoEstado: true },
    });
    return {
      estado: fresh?.teamsTranscricaoEstado ?? result.estado,
      teamsTranscricao: fresh?.teamsTranscricao ?? result.teamsTranscricao ?? null,
      mensagem: result.mensagem,
    };
  }

  async terminar(
    user: RequestUser,
    interaccaoId: string,
    dto: TerminarReuniaoCrmDto,
  ): Promise<{ reuniao: InteraccaoComercialResposta; nota?: InteraccaoComercialResposta }> {
    const row = await this.getReuniao(user, interaccaoId);
    if (row.reuniaoEstado === "CONCLUIDA") {
      throw new BadRequestException("Esta reunião já foi terminada.");
    }
    const fim = new Date();
    const inicio = row.reuniaoIniciadaEm ?? fim;
    const duracaoSegundos = Math.max(0, Math.floor((fim.getTime() - inicio.getTime()) / 1000));

    const updated = await this.prisma.interaccaoComercial.update({
      where: { id: interaccaoId },
      data: {
        reuniaoEstado: "CONCLUIDA",
        reuniaoTerminadaEm: fim,
        reuniaoDuracaoSegundos: duracaoSegundos,
        reuniaoIniciadaEm: inicio,
      },
      include: this.detailInclude(),
    });

    let nota: InteraccaoComercialResposta | undefined;
    if (dto.registarNota) {
      const cliente =
        updated.entidadeCliente?.nome ?? updated.leadComercial?.empresaNome ?? "Cliente";
      const comercial = updated.criadoPorDisplayName || updated.criadoPor?.displayName || "Comercial";
      const prefixo = [
        `Reunião Teams concluída em ${fim.toLocaleString("pt-PT")}.`,
        `Duração: ${formatDuracao(duracaoSegundos)}.`,
        `Comercial: ${comercial}.`,
        `Cliente: ${cliente}.`,
      ].join("\n");

      nota = await this.interaccoes.create(user, {
        tipo: "NOTA",
        titulo: updated.titulo ? `Follow-up: ${updated.titulo}` : "Follow-up reunião Teams",
        contexto: [prefixo, dto.contexto?.trim()].filter(Boolean).join("\n\n"),
        situacaoActual: dto.situacaoActual,
        dorNecessidade: dto.dorNecessidade,
        orcamentoTiming: dto.orcamentoTiming,
        decisor: dto.decisor,
        proximoPassoNota: dto.proximoPassoNota,
        notasLivres: dto.notasLivres,
        entidadeClienteId: updated.entidadeClienteId ?? undefined,
        leadComercialId: updated.leadComercialId ?? undefined,
        reuniaoOrigemId: interaccaoId,
      });
    }

    if (row.teamsMeetingId && dto.importarTranscricao !== false) {
      const tenantId = requireTenantId(user);
      await this.teamsTranscript.marcarPendenteCrm(interaccaoId, tenantId);
      void this.teamsTranscript.importarCrm(interaccaoId, tenantId).catch(() => undefined);
    }

    return {
      reuniao: mapInteraccaoRow(updated as unknown as Record<string, unknown>),
      nota,
    };
  }

  private async getReuniao(user: RequestUser, interaccaoId: string) {
    const tenantId = requireTenantId(user);
    const row = await this.prisma.interaccaoComercial.findFirst({
      where: { id: interaccaoId, tenantId, tipo: "REUNIAO" },
      include: this.detailInclude(),
    });
    if (!row) throw new NotFoundException("Reunião não encontrada.");
    this.assertPodeGerir(user, row);
    return row;
  }

  private assertPodeGerir(
    user: RequestUser,
    row: { criadoPorAutorId: string; criadoPorUserId: string | null },
  ) {
    if (user.role === "tenant_manager" || user.role === "super_admin") return;
    if (user.sub && (row.criadoPorAutorId === user.sub || row.criadoPorUserId === user.sub)) {
      return;
    }
    throw new ForbiddenException("Sem permissão para gerir esta reunião.");
  }

  private detailInclude() {
    return {
      entidadeCliente: { select: { id: true, nome: true, nif: true } },
      leadComercial: { select: { id: true, codigo: true, empresaNome: true } },
      criadoPor: { select: { id: true, displayName: true, email: true } },
      sugestoesIa: { orderBy: { createdAt: "desc" as const }, take: 5 },
    };
  }
}
