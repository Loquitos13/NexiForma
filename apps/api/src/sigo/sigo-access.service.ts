import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { TenantUserRole } from "@nexiforma/database";
import type { RequestUser } from "../auth/types/access-token-payload";
import { PrismaService } from "../prisma/prisma.service";
import {
  podeExecutarAcaoSigo,
  normalizarPerfisAcesso,
  type SigoAcaoAcesso,
  type SigoPerfisAcesso,
} from "@nexiforma/shared";

@Injectable()
export class SigoAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async resolvePrismaRole(user: RequestUser): Promise<TenantUserRole | null> {
    if (user.kind === "platform") return "ADMIN";
    if (!user.sub) return null;
    const row = await this.prisma.user.findFirst({
      where: { id: user.sub },
      select: { role: true },
    });
    return row?.role ?? null;
  }

  async loadPerfisAcesso(tenantId: string): Promise<SigoPerfisAcesso> {
    const row = await this.prisma.configSigoTenant.findUnique({
      where: { tenantId },
      select: { perfisAcesso: true },
    });
    return normalizarPerfisAcesso(row?.perfisAcesso);
  }

  async assertAcao(user: RequestUser, tenantId: string, acao: SigoAcaoAcesso): Promise<void> {
    const role = await this.resolvePrismaRole(user);
    const perfis = await this.loadPerfisAcesso(tenantId);
    if (!podeExecutarAcaoSigo(role, perfis, acao)) {
      throw new ForbiddenException(
        `O teu perfil não tem permissão para: ${acao}.`,
      );
    }
  }

  async podeDescarregarSigo(user: RequestUser, tenantId: string): Promise<boolean> {
    const role = await this.resolvePrismaRole(user);
    const perfis = await this.loadPerfisAcesso(tenantId);
    return podeExecutarAcaoSigo(role, perfis, "descarregarSigo");
  }

  async getRoleOrThrow(user: RequestUser): Promise<TenantUserRole> {
    const role = await this.resolvePrismaRole(user);
    if (!role) throw new NotFoundException("Utilizador não encontrado.");
    return role;
  }
}
