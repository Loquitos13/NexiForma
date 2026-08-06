import { canManageFormacao } from "@nexiforma/shared";
import { ForbiddenException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "./tenant-scope";

@Injectable()
export class FormadorScopeService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfileId(user: RequestUser): Promise<string | null> {
    if (user.role !== "formador") return null;
    const tenantId = requireTenantId(user);
    const profile = await this.prisma.formadorProfile.findFirst({
      where: { tenantId, userId: user.sub },
      select: { id: true },
    });
    return profile?.id ?? null;
  }

  /** IDs de acções onde o formador tem pelo menos uma sessão atribuída. `null` = sem filtro (gestor). */
  async assignedAcaoIds(user: RequestUser): Promise<string[] | null> {
    if (canManageFormacao(user.role)) return null;
    if (user.role !== "formador") return [];
    const formadorId = await this.getProfileId(user);
    if (!formadorId) return [];

    const tenantId = requireTenantId(user);
    const rows = await this.prisma.acaoFormacao.findMany({
      where: {
        tenantId,
        cronogramas: { some: { sessoes: { some: { formadorId } } } },
      },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  async assignedCursoIds(user: RequestUser): Promise<string[] | null> {
    if (canManageFormacao(user.role)) return null;
    if (user.role !== "formador") return [];
    const formadorId = await this.getProfileId(user);
    if (!formadorId) return [];

    const tenantId = requireTenantId(user);
    const rows = await this.prisma.acaoFormacao.findMany({
      where: {
        tenantId,
        cronogramas: { some: { sessoes: { some: { formadorId } } } },
      },
      select: { cursoId: true },
      distinct: ["cursoId"],
    });
    return rows.map((r) => r.cursoId);
  }

  async assertCanAccessAcao(user: RequestUser, acaoId: string): Promise<void> {
    const allowed = await this.assignedAcaoIds(user);
    if (allowed === null) return;
    if (!allowed.includes(acaoId)) {
      throw new ForbiddenException("Não estás atribuído a esta acção de formação.");
    }
  }

  async assertCanEditCurso(user: RequestUser, cursoId: string): Promise<void> {
    const allowed = await this.assignedCursoIds(user);
    if (allowed === null) return;
    if (!allowed.includes(cursoId)) {
      throw new ForbiddenException("Não podes editar conteúdos deste curso.");
    }
  }

  async assertCanAccessSessao(user: RequestUser, sessaoId: string): Promise<void> {
    if (canManageFormacao(user.role)) return;
    const tenantId = requireTenantId(user);
    const sessao = await this.prisma.sessaoFormacao.findFirst({
      where: { id: sessaoId, tenantId },
      select: { cronograma: { select: { acaoFormacaoId: true } } },
    });
    if (!sessao) {
      throw new ForbiddenException("Sessão não encontrada.");
    }
    await this.assertCanAccessAcao(user, sessao.cronograma.acaoFormacaoId);
  }

  /**
   * Operações de sessão (iniciar, QR, presenças, LMS da sessão):
   * gestor da entidade OU formador atribuído a essa sessão.
   */
  async assertCanOperateSessao(user: RequestUser, sessaoId: string): Promise<void> {
    if (canManageFormacao(user.role)) return;
    if (user.role !== "formador") {
      throw new ForbiddenException(
        "Só o gestor da entidade ou o formador atribuído podem operar esta sessão.",
      );
    }
    const tenantId = requireTenantId(user);
    const sessao = await this.prisma.sessaoFormacao.findFirst({
      where: { id: sessaoId, tenantId },
      select: {
        formadorId: true,
        cronograma: { select: { acaoFormacaoId: true } },
      },
    });
    if (!sessao) {
      throw new ForbiddenException("Sessão não encontrada.");
    }
    if (!sessao.formadorId) {
      throw new ForbiddenException(
        "Esta sessão não tem formador atribuído. O gestor deve atribuir um formador antes de operar a sessão.",
      );
    }
    const profileId = await this.getProfileId(user);
    if (!profileId || sessao.formadorId !== profileId) {
      throw new ForbiddenException(
        "Só o formador atribuído a esta sessão (ou o gestor) pode realizar esta operação.",
      );
    }
  }

  /** Formador só libera módulos das sessões que lhe estão atribuídas (mesma regra que a lista). */
  async assertCanLiberarModuloNaAcao(
    user: RequestUser,
    acaoId: string,
    moduloUnidadeId: string,
  ): Promise<void> {
    if (canManageFormacao(user.role)) return;
    if (user.role !== "formador") {
      throw new ForbiddenException("Sem permissão para libertar este módulo.");
    }
    const operaveis = await this.moduloIdsOperaveisNaAcao(user, acaoId);
    if (operaveis === null) return;
    if (!operaveis.includes(moduloUnidadeId)) {
      throw new ForbiddenException(
        "Só podes libertar módulos das sessões que te estão atribuídas.",
      );
    }
  }

  /**
   * Módulos que o utilizador pode libertar / editar na pauta desta acção.
   * `null` = gestor (todos); lista = formador.
   * Só módulos das sessões atribuídas a este formador (`moduloUnidadeId` ou título «Módulo N»).
   */
  async moduloIdsOperaveisNaAcao(
    user: RequestUser,
    acaoId: string,
  ): Promise<string[] | null> {
    if (canManageFormacao(user.role)) return null;
    if (user.role !== "formador") return [];
    const profileId = await this.getProfileId(user);
    if (!profileId) return [];
    const tenantId = requireTenantId(user);

    const acao = await this.prisma.acaoFormacao.findFirst({
      where: { id: acaoId, tenantId },
      select: { cursoId: true },
    });
    if (!acao) return [];

    const [sessoes, modulos] = await Promise.all([
      this.prisma.sessaoFormacao.findMany({
        where: { tenantId, formadorId: profileId, cronograma: { acaoFormacaoId: acaoId } },
        select: { moduloUnidadeId: true, titulo: true },
      }),
      this.prisma.moduloUnidade.findMany({
        where: { tenantId, cursoId: acao.cursoId },
        select: { id: true, titulo: true, ordem: true },
        orderBy: [{ ordem: "asc" }, { createdAt: "asc" }],
      }),
    ]);
    if (!sessoes.length || !modulos.length) return [];

    const cursoModuloIds = new Set(modulos.map((m) => m.id));
    const operaveis = new Set<string>();
    for (const s of sessoes) {
      if (s.moduloUnidadeId && cursoModuloIds.has(s.moduloUnidadeId)) {
        operaveis.add(s.moduloUnidadeId);
      }
      for (const num of extractModuloNumsFromTitulo(s.titulo)) {
        const byNum = modulos.find((m) =>
          new RegExp(`modulos?\\s*0*${num}\\b`, "i").test(normalizeTitulo(m.titulo)),
        );
        if (byNum) {
          operaveis.add(byNum.id);
          continue;
        }
        const byOrdem = modulos.find((m) => m.ordem === num - 1 || m.ordem === num);
        if (byOrdem) operaveis.add(byOrdem.id);
      }
    }
    return [...operaveis];
  }
}

function normalizeTitulo(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** Extrai números de «Módulo 3», «Módulos 5 e 6», etc. */
export function extractModuloNumsFromTitulo(titulo: string | null | undefined): number[] {
  if (!titulo?.trim()) return [];
  const tit = normalizeTitulo(titulo);
  const block = tit.match(/modulos?\s*([\d\s,e\/.-]+)/);
  if (!block?.[1]) return [];
  const nums = [...block[1].matchAll(/\d+/g)]
    .map((m) => Number(m[0]))
    .filter((n) => Number.isFinite(n) && n > 0 && n < 100);
  return [...new Set(nums)];
}
