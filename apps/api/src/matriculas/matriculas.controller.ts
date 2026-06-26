import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import type { Matricula } from "@nexiforma/database";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/types/access-token-payload";
import { MatriculasService } from "./matriculas.service";
import { CreateMatriculaDto } from "./dto/create-matricula.dto";
import { UpdateMatriculaDto } from "./dto/update-matricula.dto";

@Controller("matriculas")
@UseGuards(JwtAuthGuard, RolesGuard)
export class MatriculasController {
  constructor(private readonly matriculas: MatriculasService) {}

  @Get()
  @Roles("tenant_manager")
  list(
    @CurrentUser() user: RequestUser,
    @Query("turmaId", ParseUUIDPipe) turmaId: string,
  ) {
    return this.matriculas.listByTurma(user, turmaId);
  }

  @Post()
  @Roles("tenant_manager")
  create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateMatriculaDto,
  ): Promise<Matricula> {
    return this.matriculas.create(user, dto);
  }

  @Patch(":id")
  @Roles("tenant_manager")
  updateEstado(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateMatriculaDto,
  ) {
    return this.matriculas.updateEstado(user, id, dto);
  }
}
