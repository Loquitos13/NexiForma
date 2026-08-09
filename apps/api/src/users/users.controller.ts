import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/types/access-token-payload";
import { AcceptInviteDto, EnforceMfaDto, InviteUserDto, UpdateUserDto } from "./dto/users.dto";
import { UsersService } from "./users.service";

@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("tenant_manager")
  list(@CurrentUser() user: RequestUser) {
    return this.users.list(user);
  }

  @Get("invites")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("tenant_manager")
  listInvites(@CurrentUser() user: RequestUser) {
    return this.users.listInvites(user);
  }

  @Post("invite")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("tenant_manager")
  invite(
    @CurrentUser() user: RequestUser,
    @Body() dto: InviteUserDto,
    @Req() req: Request,
  ) {
    return this.users.invite(user, dto, req);
  }

  @Post("accept-invite")
  acceptInvite(@Body() dto: AcceptInviteDto) {
    return this.users.acceptInvite(dto);
  }

  @Delete("invites/:inviteId")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("tenant_manager")
  cancelInvite(
    @CurrentUser() user: RequestUser,
    @Param("inviteId", ParseUUIDPipe) inviteId: string,
  ) {
    return this.users.cancelInvite(user, inviteId);
  }

  @Post("invites/:inviteId/resend")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("tenant_manager")
  resendInvite(
    @CurrentUser() user: RequestUser,
    @Param("inviteId", ParseUUIDPipe) inviteId: string,
    @Req() req: Request,
  ) {
    return this.users.resendInvite(user, inviteId, req);
  }

  @Get(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("tenant_manager")
  getOne(@CurrentUser() user: RequestUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.users.getOne(user, id);
  }

  @Post(":id/resend-email-confirmation")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("tenant_manager")
  resendEmailConfirmation(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.users.resendEmailConfirmation(user, id, req);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("tenant_manager")
  update(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<unknown> {
    return this.users.update(user, id, dto);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("tenant_manager")
  removePermanent(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.users.removePermanent(user, id);
  }

  @Post("mfa/require")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("tenant_manager")
  requireMfa(@CurrentUser() user: RequestUser, @Body() dto: EnforceMfaDto) {
    return this.users.enforceMfa(user, dto.userIds);
  }

  @Post("mfa/disable")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("tenant_manager")
  disableMfa(@CurrentUser() user: RequestUser, @Body() dto: EnforceMfaDto) {
    return this.users.disableMfa(user, dto.userIds);
  }
}
