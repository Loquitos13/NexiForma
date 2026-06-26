import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "../common/tenant-scope";

@Injectable()
export class RelatoriosService {
  constructor(private readonly prisma: PrismaService) {}

  async executivo(user: RequestUser) {
    const tenantId = requireTenantId(user);
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 86_400_000);

    const [
      matriculasAtivas,
      matriculasConcluidas,
      propostasAbertas,
      propostasGanhas,
      acoesEmCurso,
      formadoresCcExpirar,
      sigoPendentes,
      sigoRejeitadas,
      quizAprovacao,
      complianceMedia,
    ] = await Promise.all([
      this.prisma.matricula.count({ where: { tenantId, estado: "ATIVA" } }),
      this.prisma.matricula.count({ where: { tenantId, estado: "CONCLUSAO" } }),
      this.prisma.propostaComercial.count({
        where: { tenantId, estado: { in: ["RASCUNHO", "ENVIADA"] } },
      }),
      this.prisma.propostaComercial.count({ where: { tenantId, estado: "ACEITE" } }),
      this.prisma.acaoFormacao.count({ where: { tenantId, estado: "EM_CURSO" } }),
      this.prisma.formadorProfile.count({
        where: {
          tenantId,
          ccValidade: { lte: in30, gte: now },
        },
      }),
      this.prisma.sigoSubmissao.count({
        where: { tenantId, estado: { in: ["PENDENTE", "SUBMETIDA"] } },
      }),
      this.prisma.sigoSubmissao.count({ where: { tenantId, estado: "REJEITADA" } }),
      this.prisma.quizTentativa.groupBy({
        by: ["aprovado"],
        where: { tenantId },
        _count: true,
      }),
      this.prisma.acaoFormacao.findMany({
        where: { tenantId },
        select: { id: true, codigoInterno: true, estado: true },
        take: 50,
      }),
    ]);

    const totalQuiz = quizAprovacao.reduce((s, r) => s + r._count, 0);
    const aprovados = quizAprovacao.find((r) => r.aprovado)?._count ?? 0;
    const taxaQuiz = totalQuiz > 0 ? Math.round((aprovados / totalQuiz) * 100) : null;

    return {
      geradoEm: now.toISOString(),
      formacao: {
        matriculasAtivas,
        matriculasConcluidas,
        taxaConclusao:
          matriculasAtivas + matriculasConcluidas > 0
            ? Math.round((matriculasConcluidas / (matriculasAtivas + matriculasConcluidas)) * 100)
            : 0,
        acoesEmCurso,
        taxaAprovacaoQuiz: taxaQuiz,
      },
      comercial: {
        propostasAbertas,
        propostasGanhas,
      },
      compliance: {
        formadoresCcExpirar30d: formadoresCcExpirar,
        sigoPendentes,
        sigoRejeitadas,
      },
      inspecao: {
        acoes: complianceMedia,
      },
    };
  }

  async inspecao(user: RequestUser): Promise<{
    acoes: Array<{
      id: string;
      codigoInterno: string;
      estado: string;
      curso: { designacao: string; codigoUfcd: string | null };
    }>;
    submissoes: import("@nexiforma/database").SigoSubmissao[];
    totalDocumentos: number;
  }> {
    const tenantId = requireTenantId(user);
    const [acoes, submissoes, documentos] = await Promise.all([
      this.prisma.acaoFormacao.findMany({
        where: { tenantId },
        select: {
          id: true,
          codigoInterno: true,
          estado: true,
          curso: { select: { designacao: true, codigoUfcd: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      this.prisma.sigoSubmissao.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      this.prisma.documentoAnexo.count({ where: { tenantId } }),
    ]);
    return { acoes, submissoes, totalDocumentos: documentos };
  }
}
