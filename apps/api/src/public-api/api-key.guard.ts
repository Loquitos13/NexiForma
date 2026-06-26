import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash } from "crypto";
import { PrismaService } from "../prisma/prisma.service";

export type ApiKeyRequest = {
  tenantId: string;
  keyId: string;
};

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      apiKey?: ApiKeyRequest;
    }>();
    const raw =
      req.headers["x-api-key"] ??
      req.headers["authorization"]?.replace(/^Bearer\s+/i, "");
    if (!raw?.startsWith("nf_live_")) {
      throw new UnauthorizedException("Chave API inválida ou em falta.");
    }

    const prefix = "nf_live_";
    const pepper = this.config.get<string>("SUBSCRIPTION_KEY_PEPPER") ?? "";
    const keyHash = createHash("sha256").update(`${raw}${pepper}`).digest("hex");

    const row = await this.prisma.tenantSubscriptionKey.findFirst({
      where: {
        keyPrefix: prefix,
        keyHash,
        status: "ACTIVE",
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });
    if (!row) {
      throw new UnauthorizedException("Chave API inválida ou expirada.");
    }

    req.apiKey = { tenantId: row.tenantId, keyId: row.id };
    return true;
  }
}
