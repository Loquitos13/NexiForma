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
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/types/access-token-payload";
import { CreateAcaoFormacaoDto } from "./dto/create-acao-formacao.dto";
import { UpdateAcaoFormacaoDto } from "./dto/update-acao-formacao.dto";
import { AcoesFormacaoService } from "./acoes-formacao.service";

@Controller("acoes-formacao")
@UseGuards(JwtAuthGuard, RolesGuard)
export class AcoesFormacaoController {
  constructor(private readonly acoesFormacao: AcoesFormacaoService) {}

  @Get()
  @Roles("tenant_manager", "formador")
  list(@CurrentUser() user: RequestUser) {
    return this.acoesFormacao.list(user);
  }

  @Get(":id")
  @Roles("tenant_manager", "formador")
  detail(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.acoesFormacao.getOne(user, id);
  }

  @Post()
  @Roles("tenant_manager")
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateAcaoFormacaoDto) {
    return this.acoesFormacao.create(user, dto);
  }

  @Patch(":id")
  @Roles("tenant_manager")
  update(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateAcaoFormacaoDto,
  ) {
    return this.acoesFormacao.update(user, id, dto);
  }
}
