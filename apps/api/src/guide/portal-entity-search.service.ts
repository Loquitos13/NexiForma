import { Injectable } from "@nestjs/common";
import type { Prisma } from "@nexiforma/database";
import {
  canManageCrm,
  isFormador,
  isFormando,
  isTenantManager,
  type GuideSearchHit,
  type JwtRole,
} from "@nexiforma/shared";
import type { RequestUser } from "../auth/types/access-token-payload";
import { propostaScopeWhere } from "../common/comercial-scope.util";
import { PrismaService } from "../prisma/prisma.service";

const LIMIT_POR_TIPO = 5;

function hit(partial: GuideSearchHit): GuideSearchHit {
  return { kind: "registo", ...partial };
}

@Injectable()
export class PortalEntitySearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(user: RequestUser | null | undefined, query: string): Promise<GuideSearchHit[]> {
    const q = query.trim();
    if (!user?.tenantId || !user.role || q.length < 2) return [];

    const role = user.role as JwtRole;
    const tenantId = user.tenantId;
    const hits: GuideSearchHit[] = [];

    if (canManageCrm(role)) {
      const [propostas, leads, clientes] = await Promise.all([
        this.searchPropostas(user, tenantId, q),
        this.searchLeads(user, tenantId, q),
        this.searchClientes(tenantId, q),
      ]);
      hits.push(...propostas, ...leads, ...clientes);
    }

    if (isTenantManager(role) || isFormador(role)) {
      hits.push(...(await this.searchAcoes(user, tenantId, q, role)));
    }

    if (isTenantManager(role)) {
      hits.push(...(await this.searchFormandos(tenantId, q)));
    }

    if (isFormando(role) && user.sub) {
      hits.push(...(await this.searchFormandoOwn(tenantId, user.sub, q)));
    }

    return hits.sort((a, b) => b.score - a.score).slice(0, 12);
  }

  private async searchPropostas(
    user: RequestUser,
    tenantId: string,
    q: string,
  ): Promise<GuideSearchHit[]> {
    const scope = propostaScopeWhere(user);
    const nifDigits = q.replace(/\D/g, "");
    const or: Prisma.PropostaComercialWhereInput[] = [
      { codigo: { contains: q, mode: "insensitive" } },
      { titulo: { contains: q, mode: "insensitive" } },
      { entidadeCliente: { nome: { contains: q, mode: "insensitive" } } },
    ];
    if (nifDigits.length >= 3) {
      or.push({ entidadeCliente: { nif: { contains: nifDigits } } });
    }

    const rows = await this.prisma.propostaComercial.findMany({
      where: {
        tenantId,
        AND: [scope ?? {}, { OR: or }],
      },
      take: LIMIT_POR_TIPO,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        codigo: true,
        titulo: true,
        estado: true,
        entidadeCliente: { select: { nome: true, nif: true } },
      },
    });

    return rows.map((r) => {
      const exactCodigo = r.codigo.toLowerCase() === q.toLowerCase();
      return hit({
        href: `/portal/propostas/${r.id}`,
        label: r.codigo,
        description: `${r.titulo} · ${r.entidadeCliente.nome} · ${r.estado}`,
        matchedKeywords: [r.codigo, r.entidadeCliente.nif].filter(Boolean),
        score: exactCodigo ? 200 : 120,
        category: "Proposta",
      });
    });
  }

  private async searchLeads(
    user: RequestUser,
    tenantId: string,
    q: string,
  ): Promise<GuideSearchHit[]> {
    const nifDigits = q.replace(/\D/g, "");
    const or: Prisma.LeadComercialWhereInput[] = [
      { codigo: { contains: q, mode: "insensitive" } },
      { empresaNome: { contains: q, mode: "insensitive" } },
      { contactoNome: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ];
    if (nifDigits.length >= 3) {
      or.push({ nif: { contains: nifDigits } });
    }

    const comercialFilter =
      user.role === "comercial" && user.sub
        ? {
            OR: [
              { atribuidoUserId: user.sub },
              { criadoPorUserId: user.sub },
            ],
          }
        : {};

    const rows = await this.prisma.leadComercial.findMany({
      where: {
        tenantId,
        AND: [comercialFilter, { OR: or }],
      },
      take: LIMIT_POR_TIPO,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        codigo: true,
        empresaNome: true,
        estado: true,
        nif: true,
        entidadeClienteId: true,
      },
    });

    return rows.map((r) => {
      const exactCodigo = r.codigo.toLowerCase() === q.toLowerCase();
      const href = r.entidadeClienteId
        ? `/portal/clientes/${r.entidadeClienteId}?tab=leads`
        : `/portal/crm/leads?q=${encodeURIComponent(r.codigo)}`;
      return hit({
        href,
        label: r.codigo,
        description: `${r.empresaNome} · ${r.estado}`,
        matchedKeywords: [r.codigo, r.nif].filter((x): x is string => !!x),
        score: exactCodigo ? 190 : 110,
        category: "Lead",
      });
    });
  }

  private async searchClientes(tenantId: string, q: string): Promise<GuideSearchHit[]> {
    const nifDigits = q.replace(/\D/g, "");
    const or: Prisma.EntidadeClienteWhereInput[] = [
      { nome: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ];
    if (nifDigits.length >= 3) {
      or.push({ nif: { contains: nifDigits } });
    }

    const rows = await this.prisma.entidadeCliente.findMany({
      where: { tenantId, OR: or },
      take: LIMIT_POR_TIPO,
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, nif: true, email: true, isParceiro: true },
    });

    return rows.map((r) => {
      const exactNif = nifDigits.length === 9 && r.nif === nifDigits;
      return hit({
        href: `/portal/clientes/${r.id}`,
        label: r.nome,
        description: `NIF ${r.nif}${r.isParceiro ? " · Parceiro" : ""}${r.email ? ` · ${r.email}` : ""}`,
        matchedKeywords: [r.nif, r.nome],
        score: exactNif ? 195 : 100,
        category: "Cliente",
      });
    });
  }

  private async searchAcoes(
    user: RequestUser,
    tenantId: string,
    q: string,
    role: JwtRole,
  ): Promise<GuideSearchHit[]> {
    const textMatch: Prisma.AcaoFormacaoWhereInput = {
      OR: [
        { codigoInterno: { contains: q, mode: "insensitive" } },
        { titulo: { contains: q, mode: "insensitive" } },
      ],
    };

    const where: Prisma.AcaoFormacaoWhereInput = { tenantId, AND: [textMatch] };

    if (isFormador(role) && user.sub) {
      const formador = await this.prisma.formadorProfile.findFirst({
        where: { tenantId, userId: user.sub },
        select: { id: true },
      });
      if (!formador) return [];
      where.AND = [
        textMatch,
        { cronogramas: { some: { sessoes: { some: { formadorId: formador.id } } } } },
      ];
    }

    const rows = await this.prisma.acaoFormacao.findMany({
      where,
      take: LIMIT_POR_TIPO,
      orderBy: { createdAt: "desc" },
      select: { id: true, codigoInterno: true, titulo: true, estado: true },
    });

    return rows.map((r) =>
      hit({
        href: `/portal/acoes/${r.id}`,
        label: r.codigoInterno,
        description: `${r.titulo} · ${r.estado}`,
        matchedKeywords: [r.codigoInterno],
        score: 90,
        category: "Acção formativa",
      }),
    );
  }

  private async searchFormandos(tenantId: string, q: string): Promise<GuideSearchHit[]> {
    const nifDigits = q.replace(/\D/g, "");
    const or: Prisma.FormandoProfileWhereInput[] = [
      { nome: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ];
    if (nifDigits.length >= 3) {
      or.push({ nif: { contains: nifDigits } });
    }

    const rows = await this.prisma.formandoProfile.findMany({
      where: { tenantId, OR: or },
      take: LIMIT_POR_TIPO,
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, nif: true, email: true },
    });

    return rows.map((r) =>
      hit({
        href: `/portal/formandos?q=${encodeURIComponent(r.nif || r.nome)}`,
        label: r.nome,
        description: `NIF ${r.nif}${r.email ? ` · ${r.email}` : ""}`,
        matchedKeywords: [r.nif, r.nome],
        score: 85,
        category: "Formando",
      }),
    );
  }

  private async searchFormandoOwn(
    tenantId: string,
    userId: string,
    q: string,
  ): Promise<GuideSearchHit[]> {
    const profile = await this.prisma.formandoProfile.findFirst({
      where: { tenantId, userId },
      select: { id: true },
    });
    if (!profile) return [];

    const matriculas = await this.prisma.matricula.findMany({
      where: {
        tenantId,
        formandoId: profile.id,
        estado: { not: "DESISTENCIA" },
        turma: {
          acaoFormacao: {
            OR: [
              { codigoInterno: { contains: q, mode: "insensitive" } },
              { titulo: { contains: q, mode: "insensitive" } },
            ],
          },
        },
      },
      take: LIMIT_POR_TIPO,
      select: {
        turma: {
          select: {
            acaoFormacao: {
              select: { id: true, codigoInterno: true, titulo: true },
            },
          },
        },
      },
    });

    return matriculas.map((m) => {
      const a = m.turma.acaoFormacao;
      return hit({
        href: `/portal/formando`,
        label: a.codigoInterno,
        description: a.titulo,
        matchedKeywords: [a.codigoInterno],
        score: 80,
        category: "A minha formação",
      });
    });
  }
}
