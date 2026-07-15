import { Injectable } from "@nestjs/common";
import type { TenantUserRole } from "@nexiforma/database";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "../common/tenant-scope";
import { PrismaService } from "../prisma/prisma.service";
import { FormadorScopeService } from "../common/formador-scope.service";
import { userPodeVerReuniao } from "./calendario-reuniao.util";

export type CalendarioEventoDto = {
  id: string;
  tipo: "SESSAO_FORMACAO" | "REUNIAO_CRM" | "OUTRO";
  titulo: string;
  subtitulo?: string;
  data: string;
  horaInicio: string;
  horaFim?: string;
  modalidade?: string;
  estado?: string;
  local?: string | null;
  fonteId: string;
  numeroSessao?: number;
};

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class CalendarioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly formadorScope: FormadorScopeService,
  ) {}

  async listEventos(
    user: RequestUser,
    inicio: string,
    fim: string,
  ): Promise<CalendarioEventoDto[]> {
    const tenantId = requireTenantId(user);
    const start = new Date(inicio);
    const end = new Date(fim);
    const eventos: CalendarioEventoDto[] = [];

    const sessaoWhere: Record<string, unknown> = {
      tenantId,
      estado: { not: "CANCELADA" },
      data: { gte: start, lte: end },
    };

    if (user.role === "formador") {
      const profileId = await this.formadorScope.getProfileId(user);
      if (!profileId) return [];
      sessaoWhere.OR = [{ formadorId: profileId }, { formadorId: null }];
    }

    if (user.role === "formando") {
      const acaoIds = await this.acaoIdsDoFormando(user, tenantId);
      if (!acaoIds.length) return [];
      sessaoWhere.cronograma = { acaoFormacaoId: { in: acaoIds } };
    }

    const sessoes = await this.prisma.sessaoFormacao.findMany({
      where: sessaoWhere,
      orderBy: [{ data: "asc" }, { horaInicio: "asc" }],
      include: {
        cronograma: {
          select: {
            acaoFormacao: { select: { codigoInterno: true, titulo: true } },
          },
        },
      },
    });

    for (const s of sessoes) {
      const acao = s.cronograma.acaoFormacao;
      eventos.push({
        id: `sessao-${s.id}`,
        tipo: "SESSAO_FORMACAO",
        titulo: `${acao.codigoInterno} – Sessão ${s.numeroSessao}`,
        subtitulo: acao.titulo,
        data: toDateKey(s.data),
        horaInicio: s.horaInicio,
        horaFim: s.horaFim,
        modalidade: s.modalidade,
        estado: s.estado,
        local: s.local,
        fonteId: s.id,
        numeroSessao: s.numeroSessao,
      });
    }

    if (user.role === "formando") {
      return eventos;
    }

    const userPrismaRole = await this.resolveUserPrismaRole(user);

    const reunioesRaw = await this.prisma.interaccaoComercial.findMany({
      where: {
        tenantId,
        tipo: "REUNIAO",
        agendadoPara: { gte: start, lte: end },
      },
      orderBy: { agendadoPara: "asc" },
      include: {
        entidadeCliente: { select: { nome: true } },
        leadComercial: { select: { empresaNome: true, codigo: true } },
      },
    });

    const reunioes = reunioesRaw.filter((r) =>
      userPodeVerReuniao(user, userPrismaRole, r),
    );

    for (const r of reunioes) {
      if (!r.agendadoPara) continue;
      const titulo = r.titulo?.trim() || "Reunião";
      const cliente =
        r.entidadeCliente?.nome ?? r.leadComercial?.empresaNome ?? r.leadComercial?.codigo;
      eventos.push({
        id: `reuniao-${r.id}`,
        tipo: "REUNIAO_CRM",
        titulo,
        subtitulo: cliente ?? undefined,
        data: toDateKey(r.agendadoPara),
        horaInicio: r.agendadoPara.toISOString().slice(11, 16),
        horaFim: r.agendadoFim?.toISOString().slice(11, 16),
        estado: "AGENDADA",
        fonteId: r.id,
      });
    }

    return eventos.sort((a, b) =>
      `${a.data}${a.horaInicio}`.localeCompare(`${b.data}${b.horaInicio}`),
    );
  }

  private async acaoIdsDoFormando(user: RequestUser, tenantId: string): Promise<string[]> {
    if (!user.sub) return [];
    const profile = await this.prisma.formandoProfile.findFirst({
      where: { tenantId, userId: user.sub },
      select: { id: true },
    });
    if (!profile) return [];

    const matriculas = await this.prisma.matricula.findMany({
      where: { tenantId, formandoId: profile.id, estado: { not: "DESISTENCIA" } },
      select: { turma: { select: { acaoFormacaoId: true } } },
    });
    return [...new Set(matriculas.map((m) => m.turma.acaoFormacaoId))];
  }

  private async resolveUserPrismaRole(user: RequestUser): Promise<TenantUserRole | null> {
    if (!user.sub) return null;
    const row = await this.prisma.user.findFirst({
      where: { id: user.sub },
      select: { role: true },
    });
    return row?.role ?? null;
  }
}
