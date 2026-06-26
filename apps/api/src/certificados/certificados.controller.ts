import { Controller, Get, Param, ParseUUIDPipe, Post, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/types/access-token-payload";
import { CertificadosService } from "./certificados.service";
import { CertificadoVerificacaoService } from "./certificado-verificacao.service";

@Controller("certificados")
@UseGuards(JwtAuthGuard, RolesGuard)
export class CertificadosController {
  constructor(
    private readonly certificados: CertificadosService,
    private readonly verificacao: CertificadoVerificacaoService,
  ) {}

  @Get("acoes-formacao/:acaoId")
  @Roles("tenant_manager")
  listByAcao(
    @CurrentUser() user: RequestUser,
    @Param("acaoId", ParseUUIDPipe) acaoId: string,
  ) {
    return this.certificados.listByAcao(user, acaoId);
  }

  @Get("matricula/:matriculaId/certificado.html")
  @Roles("tenant_manager", "formador", "formando")
  async certificadoHtml(
    @CurrentUser() user: RequestUser,
    @Param("matriculaId", ParseUUIDPipe) matriculaId: string,
    @Res() res: Response,
  ) {
    const pkg = await this.certificados.buildCertificadoHtml(user, matriculaId);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${pkg.filename}"`,
    );
    res.send(pkg.html);
  }

  @Post("matricula/:matriculaId/verificacao/emitir")
  @Roles("tenant_manager")
  emitirVerificacao(
    @CurrentUser() user: RequestUser,
    @Param("matriculaId", ParseUUIDPipe) matriculaId: string,
  ) {
    return this.verificacao.emitir(user, matriculaId);
  }

  @Post("matricula/:matriculaId/verificacao/revogar")
  @Roles("tenant_manager")
  revogarVerificacao(
    @CurrentUser() user: RequestUser,
    @Param("matriculaId", ParseUUIDPipe) matriculaId: string,
  ) {
    return this.verificacao.revogar(user, matriculaId);
  }
}
