import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/types/access-token-payload";
import { EntidadesClienteService } from "./entidades-cliente.service";
import { CreateEntidadeClienteDto, UpdateEntidadeClienteDto } from "./dto/entidade-cliente.dto";
import type { EntidadeClienteResposta } from "./entidade-cliente.types";

@Controller("entidades-cliente")
@UseGuards(JwtAuthGuard, RolesGuard)
export class EntidadesClienteController {
  constructor(private readonly entidades: EntidadesClienteService) {}

  @Get()
  @Roles("tenant_manager", "comercial")
  list(
    @CurrentUser() user: RequestUser,
    @Query("parceiro") parceiro?: string,
    @Query("q") q?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    const filter =
      parceiro === "true" ? true : parceiro === "false" ? false : undefined;
    return this.entidades.list(user, { parceiro: filter, q, page, pageSize });
  }

  @Get(":id")
  @Roles("tenant_manager", "comercial")
  detail(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<EntidadeClienteResposta> {
    return this.entidades.getOne(user, id);
  }

  @Post()
  @Roles("tenant_manager", "comercial")
  create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateEntidadeClienteDto,
  ): Promise<EntidadeClienteResposta> {
    return this.entidades.create(user, dto);
  }

  @Patch(":id")
  @Roles("tenant_manager", "comercial")
  update(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateEntidadeClienteDto,
  ): Promise<EntidadeClienteResposta> {
    return this.entidades.update(user, id, dto);
  }
}
