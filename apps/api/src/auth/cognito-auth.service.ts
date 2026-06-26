import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { PrismaService } from "../prisma/prisma.service";
import type { Response } from "express";
import type { LoginResponse } from "./auth.service";
import { AuthService } from "./auth.service";

@Injectable()
export class CognitoAuthService {
  private jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {
    const issuer = this.config.get<string>("COGNITO_ISSUER");
    if (issuer) {
      this.jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
    }
  }

  isEnabled(): boolean {
    return Boolean(this.jwks && this.config.get<string>("COGNITO_CLIENT_ID"));
  }

  async exchangeIdToken(
    idToken: string,
    tenantSlug: string,
    res?: Response,
  ): Promise<LoginResponse> {
    if (!this.jwks) {
      throw new UnauthorizedException("Cognito não configurado.");
    }
    const clientId = this.config.getOrThrow<string>("COGNITO_CLIENT_ID");
    const issuer = this.config.getOrThrow<string>("COGNITO_ISSUER");

    const { payload } = await jwtVerify(idToken, this.jwks, {
      issuer,
      audience: clientId,
    });

    const sub = String(payload.sub ?? "");
    const email = String(payload.email ?? "").toLowerCase();
    if (!sub || !email) {
      throw new UnauthorizedException("Token Cognito inválido.");
    }

    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant || tenant.status === "SUSPENDED" || tenant.status === "ARCHIVED") {
      throw new UnauthorizedException("Tenant indisponível.");
    }

    let user = await this.prisma.user.findFirst({
      where: { tenantId: tenant.id, OR: [{ cognitoSub: sub }, { email }] },
      include: { tenant: true },
    });

    if (!user) {
      throw new UnauthorizedException("Utilizador não provisionado neste tenant.");
    }

    if (!user.cognitoSub) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { cognitoSub: sub },
        include: { tenant: true },
      });
    }

    if (!user.active) {
      throw new UnauthorizedException("Conta desactivada.");
    }

    return this.auth.completeLoginForUser(user, res);
  }
}
