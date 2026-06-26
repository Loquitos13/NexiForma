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
  BadRequestException,
} from "@nestjs/common";
import type { Response } from "express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/types/access-token-payload";
import { FaturasService } from "./faturas.service";
import {
  AnularFaturaDto,
  CreateFaturaDto,
  EnviarFaturaEmailDto,
  RejeitarPedidoAnulacaoDto,
  SolicitarAnulacaoFaturaDto,
  UpdateConfigFaturacaoDto,
  UpdateFaturaDto,
  UpdateSerieFaturacaoDto,
} from "./dto/fatura.dto";

@Controller("crm")
@UseGuards(JwtAuthGuard, RolesGuard)
export class FaturasController {
  constructor(private readonly faturas: FaturasService) {}

  @Get("faturas")
  @Roles("tenant_manager", "comercial")
  list(
    @CurrentUser() user: RequestUser,
    @Query("entidadeClienteId") entidadeClienteId?: string,
    @Query("estado") estado?: string,
  ): Promise<unknown> {
    return this.faturas.list(user, { entidadeClienteId, estado });
  }

  @Get("faturas/export/saft")
  @Roles("tenant_manager", "comercial")
  async exportSaft(
    @CurrentUser() user: RequestUser,
    @Query("ano") ano: string,
    @Query("mes") mes: string | undefined,
    @Res() res: Response,
  ) {
    const year = parseInt(ano, 10);
    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      throw new BadRequestException("Parâmetro ano inválido.");
    }
    const month = mes ? parseInt(mes, 10) : undefined;
    if (month !== undefined && (month < 1 || month > 12)) {
      throw new BadRequestException("Parâmetro mes inválido (1-12).");
    }
    const pkg = await this.faturas.exportSaftPt(user, { ano: year, mes: month });
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${pkg.filename}"`);
    res.send(pkg.xml);
  }

  @Get("faturas/:id/documento.html")
  @Roles("tenant_manager", "comercial")
  async documentoHtml(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Query("download") download: string | undefined,
    @Res() res: Response,
  ) {
    const pkg = await this.faturas.buildDocumentoHtml(user, id);
    const asAttachment = download === "1" || download === "true";
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `${asAttachment ? "attachment" : "inline"}; filename="${pkg.filename}"`,
    );
    res.send(pkg.html);
  }

  @Get("faturas/:id")
  @Roles("tenant_manager", "comercial")
  detail(@CurrentUser() user: RequestUser, @Param("id", ParseUUIDPipe) id: string): Promise<unknown> {
    return this.faturas.getOne(user, id);
  }

  @Post("faturas")
  @Roles("tenant_manager", "comercial")
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateFaturaDto): Promise<unknown> {
    return this.faturas.create(user, dto);
  }

  @Patch("faturas/:id")
  @Roles("tenant_manager", "comercial")
  update(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateFaturaDto,
  ): Promise<unknown> {
    return this.faturas.update(user, id, dto);
  }

  @Post("faturas/:id/emitir")
  @Roles("tenant_manager", "comercial")
  emitir(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<unknown> {
    return this.faturas.emitir(user, id);
  }

  @Post("faturas/:id/comunicar-at")
  @Roles("tenant_manager", "comercial")
  comunicarAt(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<unknown> {
    return this.faturas.comunicarAt(user, id);
  }

  @Post("faturas/:id/reenviar-at")
  @Roles("tenant_manager", "comercial")
  reenviarAt(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<unknown> {
    return this.faturas.reenviarAt(user, id);
  }

  @Post("faturas/:id/enviar-email")
  @Roles("tenant_manager", "comercial")
  enviarEmail(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: EnviarFaturaEmailDto,
  ): Promise<unknown> {
    return this.faturas.enviarEmail(user, id, dto);
  }

  @Post("faturas/:id/solicitar-anulacao")
  @Roles("comercial")
  solicitarAnulacao(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: SolicitarAnulacaoFaturaDto,
  ): Promise<unknown> {
    return this.faturas.solicitarAnulacao(user, id, dto);
  }

  @Post("faturas/:id/anular")
  @Roles("tenant_manager")
  anular(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: AnularFaturaDto,
  ): Promise<unknown> {
    return this.faturas.anular(user, id, dto);
  }

  @Post("faturas/:id/rejeitar-pedido-anulacao")
  @Roles("tenant_manager")
  rejeitarPedidoAnulacao(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: RejeitarPedidoAnulacaoDto,
  ): Promise<unknown> {
    return this.faturas.rejeitarPedidoAnulacao(user, id, dto);
  }

  @Post("propostas/:propostaId/faturar")
  @Roles("tenant_manager", "comercial")
  faturarProposta(
    @CurrentUser() user: RequestUser,
    @Param("propostaId", ParseUUIDPipe) propostaId: string,
  ): Promise<unknown> {
    return this.faturas.createFromProposta(user, propostaId);
  }

  @Get("config/faturacao/certificacao")
  @Roles("tenant_manager")
  certificacaoStatus(@CurrentUser() user: RequestUser): Promise<unknown> {
    return this.faturas.getCertificacaoStatus(user);
  }

  @Patch("config/faturacao/series/:serieId")
  @Roles("tenant_manager")
  updateSerie(
    @CurrentUser() user: RequestUser,
    @Param("serieId", ParseUUIDPipe) serieId: string,
    @Body() dto: UpdateSerieFaturacaoDto,
  ): Promise<unknown> {
    return this.faturas.updateSerie(user, serieId, dto);
  }

  @Get("config/faturacao")
  @Roles("tenant_manager", "comercial")
  getConfig(@CurrentUser() user: RequestUser): Promise<unknown> {
    return this.faturas.getConfig(user);
  }

  @Patch("config/faturacao")
  @Roles("tenant_manager")
  updateConfig(
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateConfigFaturacaoDto,
  ): Promise<unknown> {
    return this.faturas.updateConfig(user, dto);
  }
}
