import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/types/access-token-payload";
import { NotificacoesService } from "./notificacoes.service";
import { PortalNotificacoesService } from "./portal-notificacoes.service";
import { PushService } from "./push.service";
import { LembreteSessaoDto } from "./dto/lembrete-sessao.dto";
import { SubscribePushDto } from "./dto/subscribe-push.dto";

@Controller("notificacoes")
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificacoesController {
  constructor(
    private readonly notificacoes: NotificacoesService,
    private readonly portal: PortalNotificacoesService,
    private readonly push: PushService,
  ) {}

  @Get("portal")
  @Roles("tenant_manager", "comercial", "formador", "formando")
  listPortal(@CurrentUser() user: RequestUser) {
    return this.portal.listForUser(user);
  }

  @Get("portal/nao-lidas")
  @Roles("tenant_manager", "comercial", "formador", "formando")
  countUnread(@CurrentUser() user: RequestUser) {
    return this.portal.countUnreadForUser(user).then((count) => ({ count }));
  }

  @Patch("portal/:id/lida")
  @Roles("tenant_manager", "comercial", "formador", "formando")
  markRead(@CurrentUser() user: RequestUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.portal.markRead(user, id);
  }

  @Post("portal/marcar-todas-lidas")
  @Roles("tenant_manager", "comercial", "formador", "formando")
  markAllRead(@CurrentUser() user: RequestUser) {
    return this.portal.markAllRead(user);
  }

  @Get("push/vapid-public-key")
  @Roles("tenant_manager", "comercial", "formador", "formando")
  vapidPublicKey() {
    return {
      enabled: this.push.isEnabled(),
      publicKey: this.push.getPublicKey(),
    };
  }

  @Post("push/subscribe")
  @Roles("tenant_manager", "comercial", "formador", "formando")
  subscribePush(@CurrentUser() user: RequestUser, @Body() dto: SubscribePushDto) {
    return this.push.subscribe(user.sub, dto);
  }

  @Get("config")
  @Roles("tenant_manager", "comercial")
  config() {
    return this.notificacoes.getConfig();
  }

  @Post("alertas/digest")
  @Roles("tenant_manager")
  digestAlertas(@CurrentUser() user: RequestUser) {
    return this.notificacoes.enviarDigestAlertas(user);
  }

  @Post("sessoes/lembretes")
  @Roles("tenant_manager")
  lembretesSessao(@CurrentUser() user: RequestUser, @Body() dto: LembreteSessaoDto) {
    return this.notificacoes.enviarLembretesSessao(user, dto.acaoId);
  }

  @Post("certificados/acoes-formacao/:acaoId")
  @Roles("tenant_manager")
  certificadosDisponiveis(
    @CurrentUser() user: RequestUser,
    @Param("acaoId", ParseUUIDPipe) acaoId: string,
  ) {
    return this.notificacoes.enviarCertificadosDisponiveis(user, acaoId);
  }
}
