import { Inject, Injectable, BadRequestException, NotFoundException, forwardRef } from "@nestjs/common";
import type { Prisma, SugestaoIaTipo } from "@nexiforma/database";
import {
  chaveSugestaoComercial,
  type CrmGatilhoVendaIa,
  type CrmInsightsEngine,
  type CrmNotaInsightsJson,
  type CrmSugestaoAcaoExecutavel,
} from "@nexiforma/shared";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "../common/tenant-scope";
import { mapSugestaoRow, type SugestaoIaComercialResposta } from "./crm-ia.types";
import {
  buildSugestoesProactivas,
  type EntidadeContextoProactivo,
} from "./crm-sugestoes-proactivas";
import { CrmSugestoesExecucaoService } from "./crm-sugestoes-execucao.service";

type GerarSugestoesInput = {
  tenantId: string;
  interaccaoId: string;
  insights: CrmNotaInsightsJson;
  engine: CrmInsightsEngine;
  entidadeClienteId?: string | null;
  leadComercialId?: string | null;
};

@Injectable()
export class CrmSugestoesIaService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => CrmSugestoesExecucaoService))
    private readonly execucao: CrmSugestoesExecucaoService,
  ) {}

  async gerarFromInsights(input: GerarSugestoesInput): Promise<number> {
    const sugestoes: Prisma.SugestaoIaComercialCreateManyInput[] = [];

    for (const g of input.insights.gatilhos_venda) {
      if (g.confianca < 0.45) continue;
      const tipo = this.mapGatilhoTipo(g);
      sugestoes.push({
        tenantId: input.tenantId,
        interaccaoId: input.interaccaoId,
        entidadeClienteId: input.entidadeClienteId ?? null,
        leadComercialId: input.leadComercialId ?? null,
        tipo,
        titulo: this.tituloFor(tipo, g),
        descricao: g.descricao,
        score: this.calcScore(g.confianca, input.insights),
        confianca: g.confianca,
        engine: input.engine,
        metadata: {
          produtoSugerido: g.produtoSugerido,
          sentimento: input.insights.sentimento,
          acao: this.acaoFromTipo(tipo),
        },
      });
    }

    if (input.insights.proximos_passos.length > 0) {
      const alta = input.insights.proximos_passos.find((p) => p.prioridade === "alta");
      const passo = alta ?? input.insights.proximos_passos[0];
      sugestoes.push({
        tenantId: input.tenantId,
        interaccaoId: input.interaccaoId,
        entidadeClienteId: input.entidadeClienteId ?? null,
        leadComercialId: input.leadComercialId ?? null,
        tipo: "FOLLOW_UP",
        titulo: "Follow-up comercial",
        descricao: passo.accao,
        score: passo.prioridade === "alta" ? 72 : 58,
        confianca: 0.7,
        engine: input.engine,
        metadata: {
          prazoSugerido: passo.prazoSugerido,
          responsavel: passo.responsavel,
          acao: "REGISTAR_FOLLOW_UP" as CrmSugestaoAcaoExecutavel,
        },
      });
    }

    const lookalikes = await this.sugerirLookalikeInterno(input.tenantId, input.entidadeClienteId);
    sugestoes.push(...lookalikes.map((s) => ({ ...s, interaccaoId: input.interaccaoId, engine: input.engine })));

    if (sugestoes.length === 0) return 0;

    await this.prisma.sugestaoIaComercial.createMany({ data: sugestoes });
    return sugestoes.length;
  }

  /** Sugestões baseadas em dados do cliente (notas, leads, propostas) - não exige propostas activas. */
  async gerarSugestoesProactivas(
    user: RequestUser,
    entidadeClienteId: string,
  ): Promise<{ criadas: number }> {
    const tenantId = requireTenantId(user);
    return this.gerarSugestoesProactivasInterno(tenantId, entidadeClienteId);
  }

  async gerarSugestoesProactivasInterno(
    tenantId: string,
    entidadeClienteId: string,
  ): Promise<{ criadas: number }> {
    const ctx = await this.carregarContextoEntidade(tenantId, entidadeClienteId);
    if (!ctx) throw new NotFoundException("Cliente não encontrado.");

    const drafts = buildSugestoesProactivas(ctx);
    if (!drafts.length) return { criadas: 0 };

    const dedupDesde = new Date();
    dedupDesde.setDate(dedupDesde.getDate() - 30);

    const existentes = await this.prisma.sugestaoIaComercial.findMany({
      where: {
        tenantId,
        entidadeClienteId,
        OR: [
          { estado: "PENDENTE" },
          { estado: "ACEITE", validadoEm: { gte: dedupDesde } },
        ],
      },
      select: { titulo: true, tipo: true, metadata: true },
    });
    const chaves = new Set(
      existentes.map((p) =>
        chaveSugestaoComercial({ tipo: p.tipo, titulo: p.titulo, metadata: p.metadata }),
      ),
    );

    const novas = drafts
      .filter(
        (d) =>
          !chaves.has(
            chaveSugestaoComercial({ tipo: d.tipo, titulo: d.titulo, metadata: d.metadata }),
          ),
      )
      .map((d) => ({
        ...d,
        tenantId,
        entidadeClienteId,
      }));

    if (!novas.length) return { criadas: 0 };

    await this.prisma.sugestaoIaComercial.createMany({ data: novas });
    return { criadas: novas.length };
  }

  private async carregarContextoEntidade(
    tenantId: string,
    entidadeClienteId: string,
  ): Promise<EntidadeContextoProactivo | null> {
    const entidade = await this.prisma.entidadeCliente.findFirst({
      where: { id: entidadeClienteId, tenantId },
      include: {
        propostas: {
          orderBy: { updatedAt: "desc" },
          take: 8,
          select: {
            estado: true,
            codigo: true,
            titulo: true,
            updatedAt: true,
            enviadaEm: true,
          },
        },
      },
    });
    if (!entidade) return null;

    const [interaccoes, leads] = await Promise.all([
      this.prisma.interaccaoComercial.findMany({
        where: { tenantId, entidadeClienteId },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          titulo: true,
          resumoIa: true,
          dorNecessidade: true,
          proximoPassoNota: true,
          createdAt: true,
        },
      }),
      this.prisma.leadComercial.findMany({
        where: { tenantId, entidadeClienteId },
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: { estado: true, codigo: true, valorEstimadoCentavos: true },
      }),
    ]);

    return {
      id: entidade.id,
      nome: entidade.nome,
      nif: entidade.nif,
      email: entidade.email,
      isParceiro: entidade.isParceiro,
      propostas: entidade.propostas,
      interaccoes,
      leads,
    };
  }

  list(
    user: RequestUser,
    filters?: {
      estado?: string;
      limit?: number;
      entidadeClienteId?: string;
      leadComercialId?: string;
    },
  ): Promise<SugestaoIaComercialResposta[]> {
    const tenantId = requireTenantId(user);
    const where: Prisma.SugestaoIaComercialWhereInput = { tenantId };
    if (filters?.estado) {
      where.estado = filters.estado as Prisma.SugestaoIaComercialWhereInput["estado"];
    }
    if (filters?.entidadeClienteId) where.entidadeClienteId = filters.entidadeClienteId;
    if (filters?.leadComercialId) where.leadComercialId = filters.leadComercialId;

    const orderBy: Prisma.SugestaoIaComercialOrderByWithRelationInput[] =
      filters?.estado === "ACEITE" || filters?.estado === "REJEITADA"
        ? [{ validadoEm: "desc" }, { createdAt: "desc" }]
        : [{ score: "desc" }, { createdAt: "desc" }];

    return this.prisma.sugestaoIaComercial
      .findMany({
        where,
        orderBy,
        take: Math.min(filters?.limit ?? 50, 100),
        include: {
          entidadeCliente: { select: { id: true, nome: true } },
          leadComercial: { select: { id: true, codigo: true, empresaNome: true } },
          interaccao: { select: { id: true, titulo: true, resumoIa: true, createdAt: true } },
          validadoPor: { select: { displayName: true } },
        },
      })
      .then((rows) => rows.map((r) => mapSugestaoRow(r as unknown as Record<string, unknown>)));
  }

  async aceitar(user: RequestUser, id: string): Promise<SugestaoIaComercialResposta> {
    const tenantId = requireTenantId(user);
    if (!user.sub) throw new BadRequestException("Utilizador inválido.");

    const row = await this.prisma.sugestaoIaComercial.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException("Sugestão não encontrada.");
    if (row.estado !== "PENDENTE") {
      throw new BadRequestException("Sugestão já foi validada.");
    }

    const leadId = await this.registrarLeadAoAceitar(row, tenantId, user.sub);
    const execucao = await this.execucao.executar(user, row, leadId);
    const metadataBase =
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {};

    const updated = await this.prisma.sugestaoIaComercial.update({
      where: { id },
      data: {
        estado: "ACEITE",
        validadoPorUserId: user.sub,
        validadoEm: new Date(),
        metadata: { ...metadataBase, execucao },
        ...(leadId ? { leadComercialId: leadId } : {}),
      },
      include: {
        entidadeCliente: { select: { id: true, nome: true } },
        leadComercial: { select: { id: true, codigo: true, empresaNome: true } },
        interaccao: { select: { id: true, titulo: true, resumoIa: true, createdAt: true } },
        validadoPor: { select: { displayName: true } },
      },
    });
    return { ...mapSugestaoRow(updated as unknown as Record<string, unknown>), execucao };
  }

  /** Regista oportunidade comercial na pipeline de leads ao aceitar sugestão IA. */
  private async registrarLeadAoAceitar(
    row: {
      id: string;
      tipo: SugestaoIaTipo;
      titulo: string;
      descricao: string;
      entidadeClienteId: string | null;
      leadComercialId: string | null;
    },
    tenantId: string,
    userId: string,
  ): Promise<string | null> {
    const notaIa = `[IA aceite · ${row.tipo}] ${row.titulo}\n${row.descricao}`;

    if (row.leadComercialId) {
      const lead = await this.prisma.leadComercial.findFirst({
        where: { id: row.leadComercialId, tenantId },
      });
      if (lead && lead.estado !== "CONVERTIDO" && lead.estado !== "PERDIDO") {
        await this.prisma.leadComercial.update({
          where: { id: lead.id },
          data: {
            notas: lead.notas ? `${lead.notas}\n\n${notaIa}` : notaIa,
            estado: lead.estado === "NOVO" ? "CONTACTADO" : lead.estado,
            atribuidoUserId: lead.atribuidoUserId ?? userId,
          },
        });
        return lead.id;
      }
    }

    if (row.entidadeClienteId) {
      const aberto = await this.prisma.leadComercial.findFirst({
        where: {
          tenantId,
          entidadeClienteId: row.entidadeClienteId,
          estado: { in: ["NOVO", "CONTACTADO", "QUALIFICADO"] },
        },
        orderBy: { updatedAt: "desc" },
      });
      if (aberto) {
        await this.prisma.leadComercial.update({
          where: { id: aberto.id },
          data: {
            notas: aberto.notas ? `${aberto.notas}\n\n${notaIa}` : notaIa,
            estado: aberto.estado === "NOVO" ? "CONTACTADO" : aberto.estado,
            atribuidoUserId: aberto.atribuidoUserId ?? userId,
          },
        });
        return aberto.id;
      }

      const ent = await this.prisma.entidadeCliente.findFirst({
        where: { id: row.entidadeClienteId, tenantId },
      });
      if (ent) {
        const criado = await this.prisma.leadComercial.create({
          data: {
            tenantId,
            codigo: this.gerarCodigoLead(),
            empresaNome: ent.nome,
            nif: ent.nif,
            email: ent.email,
            telefone: ent.telefone,
            origem: "IA",
            estado: "NOVO",
            notas: notaIa,
            entidadeClienteId: ent.id,
            criadoPorUserId: userId,
            atribuidoUserId: userId,
          },
        });
        return criado.id;
      }
    }

    const empresaNome = this.empresaNomeFromSugestao(row.titulo, row.descricao);
    const criado = await this.prisma.leadComercial.create({
      data: {
        tenantId,
        codigo: this.gerarCodigoLead(),
        empresaNome,
        origem: "IA",
        estado: "NOVO",
        notas: notaIa,
        criadoPorUserId: userId,
        atribuidoUserId: userId,
      },
    });
    return criado.id;
  }

  private gerarCodigoLead(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const r = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `LEAD-${y}${m}-${r}`;
  }

  private empresaNomeFromSugestao(titulo: string, descricao: string): string {
    const reactivar = titulo.match(/^Reactivar:\s*(.+)$/i);
    if (reactivar?.[1]?.trim()) return reactivar[1].trim().slice(0, 200);
    if (titulo.trim()) return titulo.trim().slice(0, 200);
    return descricao.trim().slice(0, 120) || "Oportunidade IA";
  }

  async rejeitar(user: RequestUser, id: string, motivo: string, comentario?: string): Promise<SugestaoIaComercialResposta> {
    const tenantId = requireTenantId(user);
    if (!user.sub) throw new BadRequestException("Utilizador inválido.");

    const row = await this.prisma.sugestaoIaComercial.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException("Sugestão não encontrada.");
    if (row.estado !== "PENDENTE") {
      throw new BadRequestException("Sugestão já foi validada.");
    }

    const motivoFinal = comentario?.trim()
      ? `${motivo}: ${comentario.trim().slice(0, 400)}`
      : motivo;

    const updated = await this.prisma.sugestaoIaComercial.update({
      where: { id },
      data: {
        estado: "REJEITADA",
        motivoRejeicao: motivoFinal.slice(0, 120),
        validadoPorUserId: user.sub,
        validadoEm: new Date(),
      },
      include: {
        entidadeCliente: { select: { id: true, nome: true } },
        leadComercial: { select: { id: true, codigo: true, empresaNome: true } },
        interaccao: { select: { id: true, titulo: true, resumoIa: true, createdAt: true } },
        validadoPor: { select: { displayName: true } },
      },
    });
    return mapSugestaoRow(updated as unknown as Record<string, unknown>);
  }

  countPendentes(tenantId: string) {
    return this.prisma.sugestaoIaComercial.count({
      where: { tenantId, estado: "PENDENTE" },
    });
  }

  private acaoFromTipo(tipo: SugestaoIaTipo): CrmSugestaoAcaoExecutavel {
    switch (tipo) {
      case "FOLLOW_UP":
        return "REGISTAR_FOLLOW_UP";
      case "UPSELL":
      case "CROSS_SELL":
      case "RENOVACAO":
        return "CRIAR_PROPOSTA";
      case "NOVO_LEAD":
        return "REGISTAR_LEAD";
      default:
        return "REGISTAR_FOLLOW_UP";
    }
  }

  private mapGatilhoTipo(g: CrmGatilhoVendaIa): SugestaoIaTipo {
    switch (g.tipo) {
      case "upsell":
        return "UPSELL";
      case "cross_sell":
        return "CROSS_SELL";
      case "renovacao":
        return "RENOVACAO";
      default:
        return "OUTRO";
    }
  }

  private tituloFor(tipo: SugestaoIaTipo, g: CrmGatilhoVendaIa): string {
    if (g.produtoSugerido) return g.produtoSugerido.slice(0, 300);
    const map: Record<SugestaoIaTipo, string> = {
      UPSELL: "Oportunidade de upsell",
      CROSS_SELL: "Cross-sell identificado",
      RENOVACAO: "Renovação / recertificação",
      NOVO_LEAD: "Novo lead sugerido",
      FOLLOW_UP: "Follow-up",
      OUTRO: "Oportunidade comercial",
    };
    return map[tipo];
  }

  private calcScore(confianca: number, insights: CrmNotaInsightsJson): number {
    let score = confianca * 70;
    if (insights.sentimento === "positivo" || insights.sentimento === "urgente") score += 10;
    if (insights.sinais_risco.includes("budget")) score -= 8;
    if (insights.sinais_risco.includes("timing")) score -= 5;
    return Math.min(99, Math.max(20, Math.round(score)));
  }

  /** Lookalike interno gratuito - clientes sem proposta recente. */
  private async sugerirLookalikeInterno(
    tenantId: string,
    entidadeClienteId?: string | null,
  ): Promise<Omit<Prisma.SugestaoIaComercialCreateManyInput, "interaccaoId" | "engine">[]> {
    if (!entidadeClienteId) return [];

    const ref = await this.prisma.entidadeCliente.findFirst({
      where: { id: entidadeClienteId, tenantId },
      include: {
        propostas: {
          where: { estado: "ACEITE" },
          orderBy: { updatedAt: "desc" },
          take: 3,
          select: { titulo: true, valorCentavos: true },
        },
      },
    });
    if (!ref || ref.propostas.length === 0) return [];

    const umAnoAtras = new Date();
    umAnoAtras.setFullYear(umAnoAtras.getFullYear() - 1);

    const similares = await this.prisma.entidadeCliente.findMany({
      where: {
        tenantId,
        id: { not: entidadeClienteId },
        isParceiro: ref.isParceiro,
        propostas: { none: { updatedAt: { gte: umAnoAtras } } },
      },
      take: 3,
      select: { id: true, nome: true },
    });

    return similares.map((e) => ({
      tenantId,
      entidadeClienteId: e.id,
      leadComercialId: null,
      tipo: "NOVO_LEAD" as SugestaoIaTipo,
      titulo: `Reactivar: ${e.nome}`,
      descricao: `Cliente similar a ${ref.nome} (${ref.propostas.length} proposta(s) aceite(s)) sem actividade recente. Considerar abordagem com base no perfil ICP interno.`,
      score: 55,
      confianca: 0.5,
      metadata: { referenciaEntidadeId: entidadeClienteId, lookalike: true, acao: "REGISTAR_LEAD" },
    }));
  }
}
