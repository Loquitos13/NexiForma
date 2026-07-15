import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { JwtKind, JwtRole } from "@nexiforma/shared";
import { JWT_KINDS, JWT_ROLES } from "@nexiforma/shared";
import { PrismaService } from "../../prisma/prisma.service";
import type { AccessTokenPayload } from "../types/access-token-payload";

type RawJwtPayload = Record<string, unknown>;

function ensureString(val: unknown, field: string): string {
  if (typeof val === "string" && val.length > 0) return val;
  throw new UnauthorizedException(`Token inválido (${field}).`);
}

function ensureRole(val: unknown): JwtRole {
  if (typeof val === "string" && JWT_ROLES.includes(val as JwtRole)) {
    return val as JwtRole;
  }
  throw new UnauthorizedException("Token inválido (role).");
}

function ensureKind(val: unknown): JwtKind {
  if (typeof val === "string" && JWT_KINDS.includes(val as JwtKind)) {
    return val as JwtKind;
  }
  throw new UnauthorizedException("Token inválido (kind).");
}

function optionalBool(val: unknown): boolean | undefined {
  return typeof val === "boolean" ? val : undefined;
}

function optionalString(val: unknown): string | undefined {
  return typeof val === "string" && val.length > 0 ? val : undefined;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const secret = config.getOrThrow<string>("JWT_SECRET");
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(raw: RawJwtPayload): Promise<AccessTokenPayload> {
    const sub = ensureString(raw["sub"], "sub");
    const email = ensureString(raw["email"], "email");
    const kind = ensureKind(raw["kind"]);
    const role = ensureRole(raw["role"]);

    if (kind === "platform") {
      if (raw["tenantId"] !== undefined || raw["tenantSlug"] !== undefined) {
        throw new UnauthorizedException("Token de plataforma só deve conter identidade global.");
      }
      return { sub, email, kind, role, tenantId: null, tenantSlug: null };
    }

    const tenantId = ensureString(raw["tenantId"], "tenantId");
    const tenantSlug = raw["tenantSlug"];
    const slug =
      typeof tenantSlug === "string" && tenantSlug.length > 0
        ? tenantSlug
        : null;

    const impersonating = optionalBool(raw["impersonating"]);
    const impersonationSessionId = optionalString(raw["impersonationSessionId"]);
    const readOnlyImpersonation = optionalBool(raw["readOnlyImpersonation"]);
    const jwtJti = optionalString(raw["jwtJti"]);

    if (impersonating) {
      if (!impersonationSessionId || !jwtJti) {
        throw new UnauthorizedException("Token de personificação incompleto.");
      }
      const session = await this.prisma.impersonationSession.findFirst({
        where: {
          id: impersonationSessionId,
          jwtJti,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
      });
      if (!session) {
        throw new UnauthorizedException("Sessão de personificação inválida ou expirada.");
      }
    }

    return {
      sub,
      email,
      kind,
      role,
      tenantId,
      tenantSlug: slug,
      impersonating,
      impersonationSessionId,
      readOnlyImpersonation,
      jwtJti,
      mustChangePassword: optionalBool(raw["mustChangePassword"]),
    };
  }
}
