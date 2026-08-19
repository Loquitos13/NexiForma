import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/types/access-token-payload";
import { ContratosService } from "./contratos.service";
import {
  ContratoPdfDto,
  ContratoPreviewDto,
  CreateContratoDto,
  UpdateContratoDto,
} from "./dto/contrato.dto";

@Controller("contratos")
@UseGuards(JwtAuthGuard, RolesGuard)
export class ContratosController {
  constructor(private readonly contratos: ContratosService) {}

  @Get()
  @Roles("tenant_manager", "comercial")
  list(
    @CurrentUser() user: RequestUser,
    @Query("entidadeClienteId") entidadeClienteId?: string,
    @Query("estado") estado?: string,
    @Query("q") q?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ): Promise<unknown> {
    return this.contratos.list(user, {
      entidadeClienteId,
      estado,
      q,
      page,
      pageSize,
    });
  }

  @Get(":id")
  @Roles("tenant_manager", "comercial")
  detail(@CurrentUser() user: RequestUser, @Param("id", ParseUUIDPipe) id: string): Promise<unknown> {
    return this.contratos.getOne(user, id);
  }

  @Post()
  @Roles("tenant_manager", "comercial")
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateContratoDto): Promise<unknown> {
    return this.contratos.create(user, dto);
  }

  @Patch(":id")
  @Roles("tenant_manager", "comercial")
  update(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateContratoDto,
  ): Promise<unknown> {
    return this.contratos.update(user, id, dto);
  }

  @Delete(":id")
  @Roles("tenant_manager", "coordenador_comercial")
  remove(@CurrentUser() user: RequestUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.contratos.remove(user, id);
  }

  @Get(":id/preview")
  @Roles("tenant_manager", "comercial")
  previewGet(@CurrentUser() user: RequestUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.contratos.previewHtml(user, id);
  }

  @Post(":id/preview")
  @Roles("tenant_manager", "comercial")
  previewPost(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ContratoPreviewDto,
  ) {
    return this.contratos.previewHtml(user, id, dto);
  }

  @Get(":id/contrato.html")
  @Roles("tenant_manager", "comercial")
  async contratoHtml(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Query("download") download: string | undefined,
    @Res() res: Response,
  ) {
    const pkg = await this.contratos.previewHtml(user, id);
    const asAttachment = download === "1" || download === "true";
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `${asAttachment ? "attachment" : "inline"}; filename="contrato.html"`,
    );
    res.send(pkg.html);
  }

  @Post(":id/pdf")
  @Roles("tenant_manager", "comercial")
  async pdf(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ContratoPdfDto,
    @Res() res: Response,
  ) {
    const pkg = await this.contratos.buildPdf(user, id, dto);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${pkg.filename}"`);
    res.send(pkg.pdf);
  }
}
