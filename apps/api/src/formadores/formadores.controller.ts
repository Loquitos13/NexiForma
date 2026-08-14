import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import type { Request } from "express";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/types/access-token-payload";
import { FormadoresService } from "./formadores.service";
import { UpdateFormadorDto } from "./dto/update-formador.dto";
import { UpdateFormadorMeDto } from "./dto/update-formador-me.dto";
import { ChangeFormadorPasswordDto } from "./dto/change-formador-password.dto";
import { CreateFormadorDto } from "./dto/create-formador.dto";

@Controller("formadores")
@UseGuards(JwtAuthGuard, RolesGuard)
export class FormadoresController {
  constructor(private readonly formadores: FormadoresService) {}

  @Get()
  @Roles("tenant_manager", "coordenador_pedagogico", "formador")
  list(@CurrentUser() user: RequestUser) {
    return this.formadores.list(user);
  }

  @Get("alertas-cc")
  @Roles("tenant_manager", "coordenador_pedagogico")
  alertasCc(@CurrentUser() user: RequestUser) {
    return this.formadores.listAlertasCc(user);
  }

  @Get("me")
  @Roles("formador")
  getMe(@CurrentUser() user: RequestUser) {
    return this.formadores.getMe(user);
  }

  @Patch("me")
  @Roles("formador")
  updateMe(@CurrentUser() user: RequestUser, @Body() dto: UpdateFormadorMeDto) {
    return this.formadores.updateMe(user, dto);
  }

  @Post("me/password")
  @Roles("formador")
  changePassword(@CurrentUser() user: RequestUser, @Body() dto: ChangeFormadorPasswordDto) {
    return this.formadores.changePassword(user, dto);
  }

  @Get("me/documentos")
  @Roles("formador")
  listMeDocumentos(@CurrentUser() user: RequestUser) {
    return this.formadores.listMeDocumentos(user);
  }

  @Get("me/documentos/obrigatorios")
  @Roles("formador")
  getMeDocumentosObrigatorios(@CurrentUser() user: RequestUser) {
    return this.formadores.getMeDocumentosObrigatorios(user);
  }

  @Get("me/documentos/requisicoes")
  @Roles("formador")
  listMeDocumentoRequisicoes(@CurrentUser() user: RequestUser) {
    return this.formadores.listMeDocumentoRequisicoes(user);
  }

  @Post("me/documentos/requisicoes/:id")
  @Roles("formador")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 10 * 1024 * 1024 } }))
  uploadDocumentoRequisicao(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.formadores.uploadDocumentoRequisicao(user, id, file);
  }

  @Post("me/documentos")
  @Roles("formador")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 10 * 1024 * 1024 } }))
  uploadMeDocumento(
    @CurrentUser() user: RequestUser,
    @UploadedFile() file: Express.Multer.File,
    @Query("categoria") categoria?: string,
  ) {
    return this.formadores.uploadMeDocumento(user, file, categoria);
  }

  @Get("me/documentos/:id/download")
  @Roles("formador")
  async downloadMeDocumento(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const file = await this.formadores.streamMeDocumento(user, id);
    res.setHeader("Content-Type", file.contentType);
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(file.nome)}"`);
    res.setHeader("Cache-Control", "private, no-store");
    res.send(file.body);
  }

  @Get(":id/documentos/obrigatorios")
  @Roles("tenant_manager", "coordenador_pedagogico")
  getDocumentosObrigatorios(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.formadores.getDocumentosObrigatorios(user, id);
  }

  @Get(":id")
  @Roles("tenant_manager", "coordenador_pedagogico")
  getOne(@CurrentUser() user: RequestUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.formadores.getOne(user, id);
  }

  @Post()
  @Roles("tenant_manager", "coordenador_pedagogico")
  create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateFormadorDto,
    @Req() req: Request,
  ) {
    return this.formadores.create(user, dto, req);
  }

  @Patch(":id")
  @Roles("tenant_manager", "coordenador_pedagogico")
  update(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateFormadorDto,
  ) {
    return this.formadores.update(user, id, dto);
  }
}
