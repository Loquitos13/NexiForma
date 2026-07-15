import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/types/access-token-payload";
import { ProposalService } from "../crm/proposal.service";
import { PropostasService } from "./propostas.service";
import { CreatePropostaDto, UpdatePropostaDto } from "./dto/proposta.dto";
import { UpdateConfigPropostaDto } from "./dto/proposta-config.dto";

@Controller("propostas")
@UseGuards(JwtAuthGuard, RolesGuard)
export class PropostasController {
  constructor(
    private readonly propostas: PropostasService,
    private readonly proposal: ProposalService,
  ) {}

  @Get("config/template")
  @Roles("tenant_manager", "comercial")
  getConfig(@CurrentUser() user: RequestUser) {
    return this.propostas.getConfig(user);
  }

  @Patch("config/template")
  @Roles("tenant_manager")
  updateConfig(@CurrentUser() user: RequestUser, @Body() dto: UpdateConfigPropostaDto) {
    return this.propostas.updateConfig(user, dto);
  }

  @Get("resumo")
  @Roles("tenant_manager", "comercial")
  resumo(@CurrentUser() user: RequestUser) {
    return this.propostas.resumo(user);
  }

  @Get()
  @Roles("tenant_manager", "comercial")
  list(
    @CurrentUser() user: RequestUser,
    @Query("entidadeClienteId") entidadeClienteId?: string,
    @Query("estado") estado?: string,
    @Query("q") q?: string,
    @Query("comercialUserId") comercialUserId?: string,
    @Query("dataInicio") dataInicio?: string,
    @Query("dataFim") dataFim?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ): Promise<unknown> {
    return this.propostas.list(user, {
      entidadeClienteId,
      estado,
      q,
      comercialUserId,
      dataInicio,
      dataFim,
      page,
      pageSize,
    });
  }

  @Get(":id/proposta.html")
  @Roles("tenant_manager", "comercial")
  async propostaHtml(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Query("download") download: string | undefined,
    @Res() res: Response,
  ) {
    const pkg = await this.propostas.buildPropostaHtml(user, id);
    const asAttachment = download === "1" || download === "true";
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `${asAttachment ? "attachment" : "inline"}; filename="${pkg.filename}"`,
    );
    res.send(pkg.html);
  }

  @Get(":id")
  @Roles("tenant_manager", "comercial")
  detail(@CurrentUser() user: RequestUser, @Param("id", ParseUUIDPipe) id: string): Promise<unknown> {
    return this.propostas.getOne(user, id);
  }

  @Post()
  @Roles("tenant_manager", "comercial")
  create(@CurrentUser() user: RequestUser, @Body() dto: CreatePropostaDto): Promise<unknown> {
    return this.propostas.create(user, dto);
  }

  @Patch(":id")
  @Roles("tenant_manager", "comercial")
  update(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdatePropostaDto,
  ): Promise<unknown> {
    return this.propostas.update(user, id, dto);
  }

  @Post(":id/enviar")
  @Roles("tenant_manager", "comercial")
  enviar(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body?: { destinatario?: string },
  ) {
    return this.proposal.enviarProposta(user, id, body?.destinatario);
  }

  @Post(":id/aceitar")
  @Roles("tenant_manager")
  async aceitar(@CurrentUser() user: RequestUser, @Param("id", ParseUUIDPipe) id: string) {
    await this.proposal.aceitarProposta(user, id);
    return { sucesso: true };
  }

  @Post(":id/rejeitar")
  @Roles("tenant_manager")
  async rejeitar(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body?: { motivo?: string },
  ) {
    await this.proposal.rejeitarProposta(user, id, body?.motivo);
    return { sucesso: true };
  }
}
