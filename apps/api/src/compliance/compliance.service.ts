import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "../common/tenant-scope";
import { buildDgertChecklist } from "../dossie-pedagogico/dgert-checklist.util";

@Injectable()
export class ComplianceService {
  constructor(private readonly prisma: PrismaService) {}

  private async loadAcaoComplianceData(tenantId: string, acaoId: string) {
    const [tenant, acao] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { nif: true, legalName: true },
      }),
      this.prisma.acaoFormacao.findFirst({
        where: { id: acaoId, tenantId },
        include: {
          curso: true,
          turmas: {
            include: {
              matriculas: {
                where: { estado: "ATIVA" },
                include: { formando: { select: { nome: true, nif: true } } },
              },
            },
          },
          cronogramas: {
            orderBy: { versao: "desc" },
            take: 1,
            include: {
              sessoes: {
                orderBy: { numeroSessao: "asc" },
                include: {
                  formador: {
                    select: {
                      nomeCompleto: true,
                      nif: true,
                      ccNumero: true,
                      ccpNumero: true,
                    },
                  },
                  sumarios: {
                    orderBy: { createdAt: "desc" },
                    take: 3,
                    select: {
                      imutavel: true,
                      assinadoEm: true,
                      conteudo: true,
                    },
                  },
                  folhasPresenca: {
                    select: {
                      fechadaEm: true,
                      validadaFormadorEm: true,
                      presencas: { select: { presente: true } },
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    if (!acao) {
      throw new NotFoundException("Acção de formação não encontrada.");
    }

    const cronograma = acao.cronogramas[0] ?? null;
    const sessoes = cronograma?.sessoes ?? [];
    const formandosAtivos = acao.turmas.flatMap((t) =>
      t.matriculas.map((m) => m.formando),
    );
    const totalMatriculas = formandosAtivos.length;

    let presencasPresentes = 0;
    let presencasTotal = 0;
    for (const s of sessoes) {
      for (const f of s.folhasPresenca) {
        for (const p of f.presencas) {
          presencasTotal += 1;
          if (p.presente) presencasPresentes += 1;
        }
      }
    }

    const checklist = buildDgertChecklist({
      tenantNif: tenant?.nif ?? null,
      curso: acao.curso,
      acao: {
        dataInicio: acao.dataInicio,
        dataFim: acao.dataFim,
        estado: acao.estado,
      },
      cronograma: cronograma
        ? { versao: cronograma.versao, aprovadoEm: cronograma.aprovadoEm }
        : null,
      sessoes,
      formandosAtivos,
      totalMatriculas,
      presencasPresentes,
      presencasTotal,
    });

    const pendencias = checklist.items
      .filter((i) => !i.ok)
      .map((i) => ({
        id: i.id,
        label: i.label,
        severidade: i.severidade,
        grupo: i.grupo,
        accaoSugerida: i.accaoSugerida,
      }));

    const folhaValidada = (f: { fechadaEm: Date | null; validadaFormadorEm: Date | null }) =>
      Boolean(f.fechadaEm || f.validadaFormadorEm);

    const sessoesResumo = sessoes.map((s) => {
      const folhas = s.folhasPresenca.map((f) => {
        const total = f.presencas.length;
        const presentes = f.presencas.filter((p) => p.presente).length;
        return {
          total,
          presentes,
          validada: folhaValidada(f),
        };
      });
      return {
        id: s.id,
        numeroSessao: s.numeroSessao,
        data: s.data,
        horaInicio: s.horaInicio,
        horaFim: s.horaFim,
        estado: s.estado,
        iniciadaEm: s.iniciadaEm,
        terminadaEm: s.terminadaEm,
        formadorPresente: s.formadorPresente,
        formador: s.formador
          ? { nomeCompleto: s.formador.nomeCompleto, nif: s.formador.nif }
          : null,
        folhas,
      };
    });

    return {
      acao: {
        id: acao.id,
        codigoInterno: acao.codigoInterno,
        titulo: acao.titulo,
        estado: acao.estado,
        dataInicio: acao.dataInicio,
        dataFim: acao.dataFim,
      },
      entidade: tenant,
      checklist,
      pendencias,
      sessoesResumo,
    };
  }

  async resumo(user: RequestUser) {
    const tenantId = requireTenantId(user);
    const acoes = await this.prisma.acaoFormacao.findMany({
      where: { tenantId },
      orderBy: { dataInicio: "desc" },
      take: 60,
      select: {
        id: true,
        codigoInterno: true,
        titulo: true,
        estado: true,
        dataInicio: true,
        dataFim: true,
      },
    });

    const rows = await Promise.all(
      acoes.map(async (a) => {
        const data = await this.loadAcaoComplianceData(tenantId, a.id);
        return {
          acaoId: a.id,
          codigoInterno: a.codigoInterno,
          titulo: a.titulo,
          estado: a.estado,
          dataInicio: a.dataInicio,
          dataFim: a.dataFim,
          scorePercent: data.checklist.scorePercent,
          scoreObrigatorioPercent: data.checklist.scoreObrigatorioPercent,
          prontoInspecao: data.checklist.prontoInspecao,
          pendenciasObrigatorias: data.pendencias.filter((p) => p.severidade === "obrigatorio").length,
        };
      }),
    );

    const prontas = rows.filter((r) => r.prontoInspecao).length;
    const mediaScore =
      rows.length > 0
        ? Math.round(rows.reduce((s, r) => s + r.scoreObrigatorioPercent, 0) / rows.length)
        : 0;

    return {
      geradoEm: new Date().toISOString(),
      resumo: {
        totalAcoes: rows.length,
        prontasInspecao: prontas,
        mediaScoreObrigatorio: mediaScore,
      },
      acoes: rows,
    };
  }

  async getByAcao(user: RequestUser, acaoId: string) {
    const tenantId = requireTenantId(user);
    return this.getByAcaoForTenant(tenantId, acaoId);
  }

  /** Uso interno (cron, jobs) sem contexto JWT. */
  async getByAcaoForTenant(tenantId: string, acaoId: string) {
    const data = await this.loadAcaoComplianceData(tenantId, acaoId);
    return {
      geradoEm: new Date().toISOString(),
      ...data,
    };
  }
}
