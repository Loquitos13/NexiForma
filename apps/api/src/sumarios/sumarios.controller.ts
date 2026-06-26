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
import type { Sumario } from "@nexiforma/database";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/types/access-token-payload";
import { CreateSumarioDto } from "./dto/create-sumario.dto";
import { UpdateSumarioDto } from "./dto/update-sumario.dto";
import { SumariosService } from "./sumarios.service";
import { CmdSignatureService } from "../cmd/cmd-signature.service";

@Controller("sumarios")
@UseGuards(JwtAuthGuard, RolesGuard)
export class SumariosController {
  constructor(
    private readonly sumarios: SumariosService,
    private readonly cmd: CmdSignatureService,
  ) {}

  @Get()
  @Roles("tenant_manager", "formador")
  list(
    @CurrentUser() user: RequestUser,
    @Query("sessaoId", ParseUUIDPipe) sessaoId: string,
  ) {
    return this.sumarios.listBySessao(user, sessaoId);
  }

  @Post("sessao/:sessaoId")
  @Roles("tenant_manager", "formador")
  create(
    @CurrentUser() user: RequestUser,
    @Param("sessaoId", ParseUUIDPipe) sessaoId: string,
    @Body() dto: CreateSumarioDto,
  ): Promise<Sumario> {
    return this.sumarios.create(user, sessaoId, dto);
  }

  @Patch(":id")
  @Roles("tenant_manager", "formador")
  update(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateSumarioDto,
  ): Promise<Sumario> {
    return this.sumarios.update(user, id, dto);
  }

  @Post(":id/assinar")
  @Roles("tenant_manager", "formador")
  assinar(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<Sumario> {
    return this.sumarios.assinar(user, id);
  }

  @Post(":id/assinar-cmd")
  @Roles("tenant_manager", "formador")
  assinarCmd(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.cmd.iniciarAssinaturaSumario(user, id);
  }
}
