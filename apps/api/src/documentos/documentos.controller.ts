import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/types/access-token-payload";
import { DocumentosService } from "./documentos.service";

@Controller("documentos")
@UseGuards(JwtAuthGuard, RolesGuard)
export class DocumentosController {
  constructor(private readonly documentos: DocumentosService) {}

  @Get()
  @Roles("tenant_manager")
  list(
    @CurrentUser() user: RequestUser,
    @Query("entidadeClienteId") entidadeClienteId?: string,
    @Query("acaoFormacaoId") acaoFormacaoId?: string,
  ) {
    return this.documentos.list(user, entidadeClienteId, acaoFormacaoId);
  }

  @Post("upload")
  @Roles("tenant_manager")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 20 * 1024 * 1024 } }))
  upload(
    @CurrentUser() user: RequestUser,
    @UploadedFile() file: Express.Multer.File,
    @Query("entidadeClienteId") entidadeClienteId?: string,
    @Query("acaoFormacaoId") acaoFormacaoId?: string,
  ) {
    return this.documentos.upload(user, file, { entidadeClienteId, acaoFormacaoId });
  }

  @Get(":id/download-url")
  @Roles("tenant_manager")
  downloadUrl(@CurrentUser() user: RequestUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.documentos.downloadUrl(user, id);
  }
}
