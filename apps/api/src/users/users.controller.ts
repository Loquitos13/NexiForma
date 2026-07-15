import {
  Body,
  Controller,
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

  @Patch(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("tenant_manager")
  update(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.users.update(user, id, dto);
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
