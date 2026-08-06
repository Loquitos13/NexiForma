import { Injectable } from "@nestjs/common";
import type { TenantUserRole } from "@nexiforma/database";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "../common/tenant-scope";
import { PrismaService } from "../prisma/prisma.service";
import { FormadorScopeService } from "../common/formador-scope.service";
import { userPodeVerReuniao } from "./calendario-reuniao.util";
import { userPodeEditarCalendarioEvento } from "./calendario-notas.util";
import { CalendarioNotasService } from "./calendario-notas.service";

export type CalendarioEventoDto = {
  id: string;
  tipo: "SESSAO_FORMACAO" | "REUNIAO_CRM" | "LEMBRETE" | "EVENTO" | "PRAZO_LMS";
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
  editavel?: boolean;
  criadoPorNome?: string;
  salaJoinUrl?: string | null;
  reuniaoEstado?: string | null;
  reuniaoIniciadaEm?: string | null;
  reuniaoTerminadaEm?: string | null;
  reuniaoDuracaoSegundos?: number | null;
  /** Sessão de formação – contador formador / entrada formando */
  iniciadaEm?: string | null;
  terminadaEm?: string | null;
  formadorEntradaEm?: string | null;
  formadorDuracaoSegundos?: number | null;
  lmsAtivo?: boolean;
  matriculaId?: string | null;
  acaoFormacaoId?: string | null;
};

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function horaFromDate(d: Date): string {
  return d.toISOString().slice(11, 16);
}

@Injectable()
export class CalendarioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly formadorScope: FormadorScopeService,
    private readonly notas: CalendarioNotasService,
  ) {}

  async listEventos(
    user: RequestUser,
    inicio: string,
    fim: string,
  ): Promise<CalendarioEventoDto[]> {
    const tenantId = requireTenantId(user);
    const start = new Date(inicio);
    const end = new Date(fim);
    end.setHours(23, 59, 59, 999);
    const eventos: CalendarioEventoDto[] = [];

    if (user.role !== "comercial") {
      const sessaoWhere: Record<string, unknown> = {
        tenantId,
        estado: { not: "CANCELADA" },
        data: { gte: start, lte: end },
      };

      if (user.role === "formador") {
        const profileId = await this.formadorScope.getProfileId(user);
        if (!profileId) return this.mergeNotasEPrazos(user, tenantId, start, end, eventos);
        sessaoWhere.formadorId = profileId;
      }

      let matriculaPorAcao = new Map<string, string>();
      if (user.role === "formando") {
        const map = await this.matriculasPorAcaoDoFormando(user, tenantId);
        matriculaPorAcao = map;
        const acaoIds = [...map.keys()];
        if (!acaoIds.length) {
          return this.mergeNotasEPrazos(user, tenantId, start, end, eventos);
        }
        sessaoWhere.cronograma = { acaoFormacaoId: { in: acaoIds } };
      }

      const sessoes = await this.prisma.sessaoFormacao.findMany({
        where: sessaoWhere,
        orderBy: [{ data: "asc" }, { horaInicio: "asc" }],
        include: {
          cronograma: {
            select: {
              acaoFormacaoId: true,
              acaoFormacao: { select: { codigoInterno: true, titulo: true } },
            },
          },
        },
      });

      for (const s of sessoes) {
        const acao = s.cronograma.acaoFormacao;
        const acaoFormacaoId = s.cronograma.acaoFormacaoId;
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
          salaJoinUrl: s.salaJoinUrl,
          iniciadaEm: s.iniciadaEm?.toISOString() ?? null,
          terminadaEm: s.terminadaEm?.toISOString() ?? null,
          formadorEntradaEm: s.formadorEntradaEm?.toISOString() ?? null,
          formadorDuracaoSegundos: s.formadorDuracaoSegundos,
          lmsAtivo: s.lmsAtivo,
          acaoFormacaoId,
          matriculaId: matriculaPorAcao.get(acaoFormacaoId) ?? null,
        });
      }
    }

    if (user.role === "comercial" || user.role === "tenant_manager") {
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
          horaInicio: horaFromDate(r.agendadoPara),
          horaFim: r.agendadoFim ? horaFromDate(r.agendadoFim) : undefined,
          estado: r.reuniaoEstado ?? "AGENDADA",
          fonteId: r.id,
          salaJoinUrl: r.salaJoinUrl,
          reuniaoEstado: r.reuniaoEstado,
          reuniaoIniciadaEm: r.reuniaoIniciadaEm?.toISOString() ?? null,
          reuniaoTerminadaEm: r.reuniaoTerminadaEm?.toISOString() ?? null,
          reuniaoDuracaoSegundos: r.reuniaoDuracaoSegundos,
        });
      }
    }

    return this.mergeNotasEPrazos(user, tenantId, start, end, eventos);
  }

  private async mergeNotasEPrazos(
    user: RequestUser,
    tenantId: string,
    start: Date,
    end: Date,
    eventos: CalendarioEventoDto[],
  ): Promise<CalendarioEventoDto[]> {
    await this.appendPrazosLms(user, tenantId, start, end, eventos);
    await this.appendNotasCalendario(user, tenantId, start, end, eventos);

    return eventos.sort((a, b) =>
      `${a.data}${a.horaInicio}`.localeCompare(`${b.data}${b.horaInicio}`),
    );
  }

  private async appendNotasCalendario(
    user: RequestUser,
    tenantId: string,
    start: Date,
    end: Date,
    eventos: CalendarioEventoDto[],
  ) {
    const notas = await this.notas.listVisiveis(user, tenantId, start, end);
    for (const n of notas) {
      const clienteNome = n.entidadeCliente?.nome?.trim();
      eventos.push({
        id: `nota-${n.id}`,
        tipo: n.tipo === "EVENTO" ? "EVENTO" : "LEMBRETE",
        titulo: n.titulo,
        subtitulo: clienteNome || n.descricao || undefined,
        data: toDateKey(n.inicio),
        horaInicio: horaFromDate(n.inicio),
        horaFim: n.fim ? horaFromDate(n.fim) : undefined,
        fonteId: n.id,
        editavel: userPodeEditarCalendarioEvento(user, n),
        criadoPorNome: n.criadoPor.displayName,
      });
    }
  }

  private async appendPrazosLms(
    user: RequestUser,
    tenantId: string,
    start: Date,
    end: Date,
    eventos: CalendarioEventoDto[],
  ) {
    if (user.role !== "formando" && user.role !== "formador") return;

    let acaoIds: string[] = [];
    if (user.role === "formando") {
      acaoIds = [...(await this.matriculasPorAcaoDoFormando(user, tenantId)).keys()];
    } else {
      const assigned = await this.formadorScope.assignedAcaoIds(user);
      acaoIds = assigned ?? [];
    }
    if (!acaoIds.length) return;

    const acoes = await this.prisma.acaoFormacao.findMany({
      where: {
        tenantId,
        id: { in: acaoIds },
        OR: [
          { prazoConclusaoLms: { gte: start, lte: end } },
          { prazosModuloLms: { some: { prazoConclusao: { gte: start, lte: end } } } },
        ],
      },
      select: {
        id: true,
        codigoInterno: true,
        titulo: true,
        prazoConclusaoLms: true,
        prazosModuloLms: {
          where: { prazoConclusao: { gte: start, lte: end } },
          select: {
            id: true,
            prazoConclusao: true,
            moduloUnidade: { select: { codigo: true, titulo: true } },
          },
        },
      },
    });

    for (const a of acoes) {
      if (a.prazoConclusaoLms) {
        const key = toDateKey(a.prazoConclusaoLms);
        if (key >= toDateKey(start) && key <= toDateKey(end)) {
          eventos.push({
            id: `prazo-${a.id}`,
            tipo: "PRAZO_LMS",
            titulo: `Prazo LMS: ${a.codigoInterno}`,
            subtitulo: a.titulo,
            data: key,
            horaInicio: "23:59",
            fonteId: a.id,
            estado: "PRAZO",
          });
        }
      }
      for (const p of a.prazosModuloLms) {
        const label = p.moduloUnidade.codigo
          ? `${p.moduloUnidade.codigo} - ${p.moduloUnidade.titulo}`
          : p.moduloUnidade.titulo;
        eventos.push({
          id: `prazo-mod-${p.id}`,
          tipo: "PRAZO_LMS",
          titulo: `Prazo LMS ${label}`,
          subtitulo: a.codigoInterno,
          data: toDateKey(p.prazoConclusao),
          horaInicio: "23:59",
          fonteId: a.id,
          estado: "PRAZO",
        });
      }
    }
  }

  private async matriculasPorAcaoDoFormando(
    user: RequestUser,
    tenantId: string,
  ): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (!user.sub) return map;
    const profile = await this.prisma.formandoProfile.findFirst({
      where: { tenantId, userId: user.sub },
      select: { id: true },
    });
    if (!profile) return map;

    const matriculas = await this.prisma.matricula.findMany({
      where: { tenantId, formandoId: profile.id, estado: { not: "DESISTENCIA" } },
      select: { id: true, turma: { select: { acaoFormacaoId: true } } },
    });
    for (const m of matriculas) {
      if (!map.has(m.turma.acaoFormacaoId)) {
        map.set(m.turma.acaoFormacaoId, m.id);
      }
    }
    return map;
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
