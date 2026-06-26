import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
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
  @Roles("tenant_manager")
  list(@CurrentUser() user: RequestUser) {
    return this.formandos.list(user);
  }

  @Get(":id")
  @Roles("tenant_manager")
  detail(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<FormandoProfile> {
    return this.formandos.getOne(user, id);
  }

  @Post()
  @Roles("tenant_manager")
  create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateFormandoDto,
  ): Promise<FormandoProfile> {
    return this.formandos.create(user, dto);
  }

  @Patch(":id")
  @Roles("tenant_manager")
  update(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateFormandoDto,
  ): Promise<FormandoProfile> {
    return this.formandos.update(user, id, dto);
  }
}
