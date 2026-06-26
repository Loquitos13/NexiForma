import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from "@nestjs/common";
import type { Curso } from "@nexiforma/database";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/types/access-token-payload";
import { CursosService } from "./cursos.service";
import { CreateCursoDto } from "./dto/create-curso.dto";
import { UpdateCursoDto } from "./dto/update-curso.dto";

@Controller("cursos")
@UseGuards(JwtAuthGuard, RolesGuard)
export class CursosController {
  constructor(private readonly cursos: CursosService) {}

  /** Gestão ou formador pode consultar o catálogo do tenant */
  @Get()
  @Roles("tenant_manager", "formador")
  list(@CurrentUser() user: RequestUser) {
    return this.cursos.list(user);
  }

  @Get(":id")
  @Roles("tenant_manager", "formador")
  detail(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.cursos.getOne(user, id);
  }

  @Post()
  @Roles("tenant_manager")
  create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateCursoDto,
  ): Promise<Curso> {
    return this.cursos.create(user, dto);
  }

  @Patch(":id")
  @Roles("tenant_manager")
  update(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateCursoDto,
  ) {
    return this.cursos.update(user, id, dto);
  }
}
