import {
  Controller,
  Get,
  Param,
  Req,
  Res,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { ScormAssetAuthService } from "./scorm-asset-auth.service";
import { ScormPackageService } from "./scorm-package.service";

/** Serve ficheiros estáticos de pacotes SCORM (cookie de sessão curta). */
@Controller("conteudos-lms/scorm/assets")
export class ScormAssetsController {
  constructor(
    private readonly packages: ScormPackageService,
    private readonly assetAuth: ScormAssetAuthService,
  ) {}

  @Get(":moduloId/*assetPath")
  async serveAsset(
    @Param("moduloId") moduloId: string,
    @Param("assetPath") assetPath: string | string[],
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const session = this.assetAuth.assertAssetAccess(req, moduloId);
    const rel = this.assetAuth.normalizeRelativePath(
      Array.isArray(assetPath) ? assetPath.join("/") : assetPath,
    );
    const obj = await this.packages.readAsset(moduloId, session.tenantId, rel);
    res.setHeader("Content-Type", obj.contentType);
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.send(obj.body);
  }
}
