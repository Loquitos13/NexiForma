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
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import type { FormandoProfile } from "@nexiforma/database";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/types/access-token-payload";
import { FormandosService } from "./formandos.service";
import { CreateFormandoDto } from "./dto/create-formando.dto";
import { UpdateFormandoDto } from "./dto/update-formando.dto";

@Controller("formandos")
@UseGuards(JwtAuthGuard, RolesGuard)
export class FormandosController {
  constructor(private readonly formandos: FormandosService) {}

  @Get()
  @Roles("tenant_manager", "coordenador_pedagogico")
  list(
    @CurrentUser() user: RequestUser,
    @Query("entidadeClienteId") entidadeClienteId?: string,
  ) {
    return this.formandos.list(user, { entidadeClienteId });
  }

  @Get(":id/documentos/obrigatorios")
  @Roles("tenant_manager", "coordenador_pedagogico")
  getDocumentosObrigatorios(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.formandos.getDocumentosObrigatorios(user, id);
  }

  @Get(":id")
  @Roles("tenant_manager", "coordenador_pedagogico")
  detail(@CurrentUser() user: RequestUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.formandos.getOne(user, id);
  }

  @Post()
  @Roles("tenant_manager", "coordenador_pedagogico")
  create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateFormandoDto,
    @Req() req: Request,
  ): Promise<FormandoProfile & { contaProvisionada: boolean }> {
    return this.formandos.create(user, dto, req);
  }

  @Patch(":id")
  @Roles("tenant_manager", "coordenador_pedagogico")
  update(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateFormandoDto,
  ): Promise<FormandoProfile> {
    return this.formandos.update(user, id, dto);
  }

  @Delete(":id")
  @Roles("tenant_manager", "coordenador_pedagogico")
  remove(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.formandos.remove(user, id);
  }
}
