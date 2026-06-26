import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { Request, Response } from "express";
import { PrismaService } from "../prisma/prisma.service";

export const SCORM_ASSET_COOKIE = "nexiforma_scorm_asset";

type ScormAssetPayload = {
  sub: "scorm_asset";
  moduloId: string;
  tenantId: string;
  matriculaId: string;
};

@Injectable()
export class ScormAssetAuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async openAssetSession(
    moduloId: string,
    matriculaId: string,
    tenantId: string,
    res: Response,
  ): Promise<void> {
    const modulo = await this.prisma.moduloConteudo.findFirst({
      where: { id: moduloId, tenantId, tipo: "SCORM" },
    });
    if (!modulo) {
      throw new NotFoundException("Módulo SCORM não encontrado.");
    }

    const token = this.jwt.sign(
      {
        sub: "scorm_asset",
        moduloId,
        tenantId,
        matriculaId,
      } satisfies ScormAssetPayload,
      { expiresIn: "4h" },
    );

    const isProd = this.config.get<string>("NODE_ENV") === "production";
    res.cookie(SCORM_ASSET_COOKIE, token, {
      httpOnly: true,
      sameSite: isProd ? "strict" : "lax",
      secure: isProd,
      path: "/v1/conteudos-lms/scorm/assets",
      maxAge: 4 * 60 * 60 * 1000,
    });
  }

  assertAssetAccess(req: Request, moduloId: string): ScormAssetPayload {
    const raw = req.cookies?.[SCORM_ASSET_COOKIE] as string | undefined;
    if (!raw) {
      throw new UnauthorizedException("Sessão SCORM em falta.");
    }
    try {
      const payload = this.jwt.verify<ScormAssetPayload>(raw);
      if (payload.sub !== "scorm_asset" || payload.moduloId !== moduloId) {
        throw new UnauthorizedException("Sessão SCORM inválida.");
      }
      return payload;
    } catch {
      throw new UnauthorizedException("Sessão SCORM expirada.");
    }
  }

  /** Impede path traversal nos assets. */
  normalizeRelativePath(relativePath: string): string {
    const cleaned = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
    if (!cleaned || cleaned.includes("..")) {
      throw new BadRequestException("Caminho de asset inválido.");
    }
    return cleaned;
  }
}
