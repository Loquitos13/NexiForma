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
import { IsUUID } from "class-validator";

class AssociarFormandoDto {
  @IsUUID()
  formandoId!: string;
}

class AssociarFormadorDto {
  @IsUUID()
  formadorId!: string;
}
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/types/access-token-payload";
import { DocumentosService } from "./documentos.service";
import { CreateDocumentoRequisicaoDto } from "./dto/create-documento-requisicao.dto";

@Controller("documentos")
@UseGuards(JwtAuthGuard, RolesGuard)
export class DocumentosController {
  constructor(private readonly documentos: DocumentosService) {}

  @Get()
  @Roles("tenant_manager", "coordenador_pedagogico")
  list(
    @CurrentUser() user: RequestUser,
    @Query("entidadeClienteId") entidadeClienteId?: string,
    @Query("acaoFormacaoId") acaoFormacaoId?: string,
    @Query("formandoId") formandoId?: string,
    @Query("formadorId") formadorId?: string,
  ) {
    return this.documentos.list(user, {
      entidadeClienteId,
      acaoFormacaoId,
      formandoId,
      formadorId,
    });
  }

  @Get("requisicoes")
  @Roles("tenant_manager", "coordenador_pedagogico")
  listRequisicoes(
    @CurrentUser() user: RequestUser,
    @Query("estado") estado?: string,
    @Query("formandoId") formandoId?: string,
    @Query("formadorId") formadorId?: string,
  ) {
    return this.documentos.listRequisicoes(user, { estado, formandoId, formadorId });
  }

  @Post("requisicoes")
  @Roles("tenant_manager", "coordenador_pedagogico")
  criarRequisicao(@CurrentUser() user: RequestUser, @Body() dto: CreateDocumentoRequisicaoDto) {
    return this.documentos.criarRequisicao(user, dto);
  }

  @Post("requisicoes/:id/cancelar")
  @Roles("tenant_manager", "coordenador_pedagogico")
  cancelarRequisicao(@CurrentUser() user: RequestUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.documentos.cancelarRequisicao(user, id);
  }

  @Patch(":id/formando")
  @Roles("tenant_manager", "coordenador_pedagogico")
  associarFormando(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: AssociarFormandoDto,
  ) {
    return this.documentos.associarFormando(user, id, body.formandoId);
  }

  @Patch(":id/formador")
  @Roles("tenant_manager", "coordenador_pedagogico")
  associarFormador(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: AssociarFormadorDto,
  ) {
    return this.documentos.associarFormador(user, id, body.formadorId);
  }

  @Post("upload")
  @Roles("tenant_manager", "coordenador_pedagogico")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 20 * 1024 * 1024 } }))
  upload(
    @CurrentUser() user: RequestUser,
    @UploadedFile() file: Express.Multer.File,
    @Query("entidadeClienteId") entidadeClienteId?: string,
    @Query("acaoFormacaoId") acaoFormacaoId?: string,
    @Query("formandoId") formandoId?: string,
    @Query("formadorId") formadorId?: string,
    @Query("categoria") categoria?: string,
    @Query("visivelFormador") visivelFormador?: string,
    @Query("visivelFormando") visivelFormando?: string,
  ) {
    return this.documentos.upload(user, file, {
      entidadeClienteId,
      acaoFormacaoId,
      formandoId,
      formadorId,
      categoria,
      visivelFormador: visivelFormador === "true" || visivelFormador === "1",
      visivelFormando: visivelFormando === "true" || visivelFormando === "1",
    });
  }

  @Get(":id/download-url")
  @Roles("tenant_manager", "coordenador_pedagogico")
  downloadUrl(@CurrentUser() user: RequestUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.documentos.downloadUrl(user, id);
  }

  @Get(":id/download")
  @Roles("tenant_manager", "coordenador_pedagogico")
  async download(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const file = await this.documentos.streamDownload(user, id);
    res.setHeader("Content-Type", file.contentType);
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(file.nome)}"`);
    res.setHeader("Cache-Control", "private, no-store");
    res.send(file.body);
  }
}
