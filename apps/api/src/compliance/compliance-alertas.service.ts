import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "../common/tenant-scope";
import { ComplianceService } from "./compliance.service";

export type ComplianceAlerta = {
  id: string;
  tipo: "inspecao" | "pendencia" | "sessao" | "cronograma";
  severidade: "critico" | "aviso";
  acaoId: string;
  codigoInterno: string;
  titulo: string;
  mensagem: string;
  accaoUrl: string;
};

@Injectable()
export class ComplianceAlertasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly compliance: ComplianceService,
  ) {}

  async listAlertas(user: RequestUser, limit = 20) {
    return this.listAlertasForTenant(requireTenantId(user), limit);
  }

  async listAlertasForTenant(tenantId: string, limit = 20) {
    const now = new Date();
    const em30Dias = new Date(now.getTime() + 30 * 86400000);
    const amanha = new Date(now.getTime() + 86400000);

    const acoes = await this.prisma.acaoFormacao.findMany({
      where: {
        tenantId,
        estado: { in: ["PLANEADA", "EM_CURSO"] },
      },
      orderBy: { dataFim: "asc" },
      take: 40,
      select: {
        id: true,
        codigoInterno: true,
        titulo: true,
        dataFim: true,
        estado: true,
        cronogramas: {
          orderBy: { versao: "desc" },
          take: 1,
          select: {
            aprovadoEm: true,
            sessoes: {
              orderBy: { numeroSessao: "asc" },
              select: {
                id: true,
                numeroSessao: true,
                data: true,
                estado: true,
                terminadaEm: true,
                folhasPresenca: {
                  select: {
                    fechadaEm: true,
                    validadaFormadorEm: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const alertas: ComplianceAlerta[] = [];

    for (const acao of acoes) {
      const detail = await this.compliance.getByAcaoForTenant(tenantId, acao.id);
      const checklist = detail.checklist;

      if (!checklist.prontoInspecao && acao.dataFim <= em30Dias) {
        const obrig = detail.pendencias.filter((p) => p.severidade === "obrigatorio").length;
        alertas.push({
          id: `inspecao-${acao.id}`,
          tipo: "inspecao",
          severidade: acao.dataFim <= now ? "critico" : "aviso",
          acaoId: acao.id,
          codigoInterno: acao.codigoInterno,
          titulo: acao.titulo,
          mensagem:
            obrig > 0
              ? `Acção termina em ${acao.dataFim.toISOString().slice(0, 10)} com ${obrig} pendência(s) obrigatória(s) DGERT.`
              : `Acção a terminar – score obrigatório ${checklist.scoreObrigatorioPercent}%.`,
          accaoUrl: `/portal/acoes/${acao.id}?tab=compliance`,
        });
      }

      const cron = acao.cronogramas[0];
      if (cron && !cron.aprovadoEm && acao.estado === "EM_CURSO") {
        alertas.push({
          id: `cronograma-${acao.id}`,
          tipo: "cronograma",
          severidade: "aviso",
          acaoId: acao.id,
          codigoInterno: acao.codigoInterno,
          titulo: acao.titulo,
          mensagem: "Cronograma ainda não aprovado – requisito DGERT para inspecção.",
          accaoUrl: `/portal/acoes/${acao.id}?tab=cronograma`,
        });
      }

      const folhaOk = (f: { fechadaEm: Date | null; validadaFormadorEm: Date | null }) =>
        Boolean(f.fechadaEm || f.validadaFormadorEm);

      for (const s of cron?.sessoes ?? []) {
        const realizada = s.estado === "REALIZADA" || s.terminadaEm != null;
        if (realizada) {
          const temFolhaValidada = s.folhasPresenca.some(folhaOk);
          if (!temFolhaValidada) {
            alertas.push({
              id: `presencas-${s.id}`,
              tipo: "sessao",
              severidade: "critico",
              acaoId: acao.id,
              codigoInterno: acao.codigoInterno,
              titulo: acao.titulo,
              mensagem: `Sessão ${s.numeroSessao} realizada sem folha de presenças validada.`,
              accaoUrl: `/portal/acoes/${acao.id}?tab=cronograma`,
            });
          }
          continue;
        }

        if (s.data <= amanha && s.estado === "AGENDADA") {
          alertas.push({
            id: `sessao-${s.id}`,
            tipo: "sessao",
            severidade: "aviso",
            acaoId: acao.id,
            codigoInterno: acao.codigoInterno,
            titulo: acao.titulo,
            mensagem: `Sessão ${s.numeroSessao} agendada para ${String(s.data).slice(0, 10)} – preparar sumário e presenças.`,
            accaoUrl: `/portal/acoes/${acao.id}?tab=cronograma`,
          });
        }
      }
    }

    return {
      geradoEm: now.toISOString(),
      total: alertas.length,
      alertas: alertas.slice(0, limit),
    };
  }
}
