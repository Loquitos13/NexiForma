import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/types/access-token-payload";
import { FormadoresService } from "./formadores.service";
import { UpdateFormadorDto } from "./dto/update-formador.dto";

@Controller("formadores")
@UseGuards(JwtAuthGuard, RolesGuard)
export class FormadoresController {
  constructor(private readonly formadores: FormadoresService) {}

  @Get()
  @Roles("tenant_manager")
  list(@CurrentUser() user: RequestUser) {
    return this.formadores.list(user);
  }

  @Get("alertas-cc")
  @Roles("tenant_manager")
  alertasCc(@CurrentUser() user: RequestUser) {
    return this.formadores.listAlertasCc(user);
  }

  @Patch(":id")
  @Roles("tenant_manager")
  update(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateFormadorDto,
  ) {
    return this.formadores.update(user, id, dto);
  }
}
