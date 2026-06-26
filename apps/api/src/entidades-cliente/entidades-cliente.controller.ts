import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/types/access-token-payload";
import { EntidadesClienteService } from "./entidades-cliente.service";
import { CreateEntidadeClienteDto, UpdateEntidadeClienteDto } from "./dto/entidade-cliente.dto";

@Controller("entidades-cliente")
@UseGuards(JwtAuthGuard, RolesGuard)
export class EntidadesClienteController {
  constructor(private readonly entidades: EntidadesClienteService) {}

  @Get()
  @Roles("tenant_manager", "comercial")
  list(@CurrentUser() user: RequestUser) {
    return this.entidades.list(user);
  }

  @Get(":id")
  @Roles("tenant_manager", "comercial")
  detail(@CurrentUser() user: RequestUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.entidades.getOne(user, id);
  }

  @Post()
  @Roles("tenant_manager", "comercial")
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateEntidadeClienteDto) {
    return this.entidades.create(user, dto);
  }

  @Patch(":id")
  @Roles("tenant_manager", "comercial")
  update(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateEntidadeClienteDto,
  ) {
    return this.entidades.update(user, id, dto);
  }
}
