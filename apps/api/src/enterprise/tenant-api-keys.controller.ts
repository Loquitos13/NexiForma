import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/types/access-token-payload";
import { TenantApiKeysService } from "./tenant-api-keys.service";

@Controller("enterprise/api-keys")
@UseGuards(JwtAuthGuard, RolesGuard)
export class TenantApiKeysController {
  constructor(private readonly keys: TenantApiKeysService) {}

  @Get()
  @Roles("tenant_manager")
  list(@CurrentUser() user: RequestUser) {
    return this.keys.list(user);
  }

  @Post()
  @Roles("tenant_manager")
  create(
    @CurrentUser() user: RequestUser,
    @Body() body?: { expiresInDays?: number },
  ) {
    return this.keys.create(user, body);
  }

  @Delete(":id")
  @Roles("tenant_manager")
  revoke(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.keys.revoke(user, id);
  }
}
