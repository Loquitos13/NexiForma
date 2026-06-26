import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/types/access-token-payload";
import { FormandoPortalService } from "./formando-portal.service";
import { UpdateFormandoMeDto } from "./dto/update-formando-me.dto";
import { ChangeFormandoPasswordDto } from "./dto/change-formando-password.dto";
import type { FormandoMeResponse } from "./dto/formando-me.response";

@Controller("formando-portal")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("formando")
export class FormandoPortalController {
  constructor(private readonly portal: FormandoPortalService) {}

  @Get("me")
  me(@CurrentUser() user: RequestUser): Promise<FormandoMeResponse> {
    return this.portal.getMe(user);
  }

  @Patch("me")
  updateMe(@CurrentUser() user: RequestUser, @Body() dto: UpdateFormandoMeDto) {
    return this.portal.updateMe(user, dto);
  }

  @Post("me/password")
  changePassword(@CurrentUser() user: RequestUser, @Body() dto: ChangeFormandoPasswordDto) {
    return this.portal.changePassword(user, dto);
  }

  @Get("catalogo")
  catalogo(@CurrentUser() user: RequestUser) {
    return this.portal.catalogo(user);
  }

  @Get("inscricoes")
  inscricoes(@CurrentUser() user: RequestUser) {
    return this.portal.inscricoes(user);
  }

  @Get("documentos")
  listDocumentos(@CurrentUser() user: RequestUser) {
    return this.portal.listDocumentos(user);
  }

  @Post("documentos")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 10 * 1024 * 1024 } }))
  uploadDocumento(
    @CurrentUser() user: RequestUser,
    @UploadedFile() file: Express.Multer.File,
    @Query("categoria") categoria?: string,
    @Query("lado") lado?: string,
  ) {
    return this.portal.uploadDocumento(user, file, categoria, lado);
  }

  @Get("documentos/:id/download-url")
  downloadUrl(@CurrentUser() user: RequestUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.portal.downloadDocumento(user, id);
  }

  @Get("documentos/:id/download")
  async download(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const file = await this.portal.streamDocumento(user, id);
    res.setHeader("Content-Type", file.contentType);
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(file.nome)}"`);
    res.setHeader("Cache-Control", "private, no-store");
    res.send(file.body);
  }
}
