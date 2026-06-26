import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/types/access-token-payload";
import { CatalogoUfcdService } from "./catalogo-ufcd.service";

@Controller("catalogo-ufcd")
@UseGuards(JwtAuthGuard, RolesGuard)
export class CatalogoUfcdController {
  constructor(private readonly catalogo: CatalogoUfcdService) {}

  @Get()
  @Roles("tenant_manager", "formador")
  search(@Query("q") q?: string, @Query("limit") limit?: string) {
    return this.catalogo.search(q, limit ? Number(limit) : 50);
  }

  @Get("validar/curso/:codigo")
  @Roles("tenant_manager", "formador")
  validateCurso(@CurrentUser() user: RequestUser, @Param("codigo") codigo: string) {
    return this.catalogo.validateForCurso(user, codigo);
  }

  @Get("validar/sigo/:acaoId")
  @Roles("tenant_manager")
  validateSigo(@CurrentUser() user: RequestUser, @Param("acaoId") acaoId: string) {
    return this.catalogo.validateForSigo(user, acaoId);
  }

  @Get(":codigo")
  @Roles("tenant_manager", "formador")
  getOne(@Param("codigo") codigo: string) {
    return this.catalogo.getOne(codigo);
  }
}
