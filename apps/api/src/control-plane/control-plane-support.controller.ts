import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/types/access-token-payload";
import { ControlPlaneTenantOpsService } from "./control-plane-tenant-ops.service";
import { TenantAccessKeyService } from "./tenant-access-key.service";
import { SupportTicketsService } from "../support/support-tickets.service";
import { UpdateSupportTicketDto } from "../support/dto/support.dto";
import {
  CreateTenantAccessKeyDto,
  CreateTenantMatriculaDto,
  FixFormandoAccessDto,
  RedeemTenantAccessKeyDto,
  ResetTenantUserPasswordDto,
} from "./dto/control-plane.dto";

@Controller("control-plane")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("super_admin")
export class ControlPlaneSupportController {
  constructor(
    private readonly ops: ControlPlaneTenantOpsService,
    private readonly accessKeys: TenantAccessKeyService,
    private readonly supportTickets: SupportTicketsService,
  ) {}

  @Get("support-tickets")
  listSupportTickets(@Query("limit") limit?: string) {
    return this.supportTickets.list(limit ? Number(limit) : 50);
  }

  @Get("support-tickets/:id")
  getSupportTicket(@Param("id", ParseUUIDPipe) id: string) {
    return this.supportTickets.getOne(id);
  }

  @Patch("support-tickets/:id")
  updateSupportTicket(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateSupportTicketDto,
  ) {
    return this.supportTickets.updateStatus(user, id, dto);
  }

  @Get("tenants/:id/users/search")
  searchUsers(@Param("id", ParseUUIDPipe) id: string, @Query("q") q?: string) {
    return this.ops.searchUsers(id, q ?? "");
  }

  @Post("tenants/:id/users/:userId/reset-password")
  resetPassword(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("userId", ParseUUIDPipe) userId: string,
    @Body() dto: ResetTenantUserPasswordDto,
    @Req() req: Request,
  ) {
    const ip = typeof req.ip === "string" ? req.ip : undefined;
    return this.ops.resetUserPassword(user, id, userId, dto, ip);
  }

  @Get("tenants/:id/acoes-formacao")
  listAcoes(@Param("id", ParseUUIDPipe) id: string) {
    return this.ops.listAcoes(id);
  }

  @Get("tenants/:id/turmas")
  listTurmas(
    @Param("id", ParseUUIDPipe) id: string,
    @Query("acaoId") acaoId?: string,
  ) {
    return this.ops.listTurmas(id, acaoId);
  }

  @Post("tenants/:id/matriculas")
  createMatricula(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CreateTenantMatriculaDto,
    @Req() req: Request,
  ) {
    const ip = typeof req.ip === "string" ? req.ip : undefined;
    return this.ops.createMatricula(user, id, dto, ip);
  }

  @Get("tenants/:id/formandos/:formandoId/diagnose-access")
  diagnoseAccess(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("formandoId", ParseUUIDPipe) formandoId: string,
    @Query("turmaId") turmaId?: string,
  ) {
    return this.ops.diagnoseFormandoAccess(id, formandoId, turmaId);
  }

  @Post("tenants/:id/formandos/:formandoId/fix-access")
  fixAccess(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("formandoId", ParseUUIDPipe) formandoId: string,
    @Body() dto: FixFormandoAccessDto,
    @Req() req: Request,
  ) {
    const ip = typeof req.ip === "string" ? req.ip : undefined;
    return this.ops.fixFormandoAccess(user, id, formandoId, dto, ip);
  }

  @Get("tenants/:id/access-keys")
  listAccessKeys(@Param("id", ParseUUIDPipe) id: string) {
    return this.accessKeys.listKeys(id);
  }

  @Post("tenants/:id/access-keys")
  createAccessKey(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CreateTenantAccessKeyDto,
    @Req() req: Request,
  ) {
    const ip = typeof req.ip === "string" ? req.ip : undefined;
    return this.accessKeys.createKey(user, id, dto, ip);
  }

  @Delete("tenants/:id/access-keys/:keyId")
  revokeAccessKey(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("keyId", ParseUUIDPipe) keyId: string,
    @Req() req: Request,
  ) {
    const ip = typeof req.ip === "string" ? req.ip : undefined;
    return this.accessKeys.revokeKey(user, id, keyId, ip);
  }

  @Post("tenant-access/redeem")
  redeemAccessKey(
    @CurrentUser() user: RequestUser,
    @Body() dto: RedeemTenantAccessKeyDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = typeof req.ip === "string" ? req.ip : undefined;
    return this.accessKeys.redeemKey(user, dto.key.trim(), res, ip);
  }
}
