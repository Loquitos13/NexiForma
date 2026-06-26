import { Body, Controller, Headers, Param, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/types/access-token-payload";
import { AssiduidadeService } from "./assiduidade.service";
import { AssiduidadeQueueService } from "../queue/assiduidade-queue.service";
import { SincronizarAssiduidadeDto, TeamsWebhookDto, ZoomWebhookDto } from "./dto/assiduidade.dto";

@Controller("assiduidade")
export class AssiduidadeController {
  constructor(
    private readonly assiduidade: AssiduidadeService,
    private readonly queue: AssiduidadeQueueService,
  ) {}

  @Post("sessoes/:sessaoId/sincronizar")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("tenant_manager", "formador")
  sincronizar(
    @CurrentUser() user: RequestUser,
    @Param("sessaoId") sessaoId: string,
    @Body() dto: SincronizarAssiduidadeDto,
  ) {
    return this.assiduidade.sincronizarSessao(user, sessaoId, dto);
  }

  @Post("webhooks/zoom")
  zoomWebhook(
    @Body() dto: ZoomWebhookDto,
    @Headers("x-nexiforma-zoom-token") token: string | undefined,
  ) {
    return this.queue.enqueueZoom(dto, token);
  }

  @Post("webhooks/teams")
  teamsWebhook(
    @Body() dto: TeamsWebhookDto,
    @Headers("x-nexiforma-teams-token") token: string | undefined,
  ) {
    return this.queue.enqueueTeams(dto, token);
  }
}
