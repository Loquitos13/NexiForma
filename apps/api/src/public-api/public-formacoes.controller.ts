import {
  Controller,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { FormacoesCatalogService } from "../formacoes/formacoes-catalog.service";
import { FormacoesService } from "../formacoes/formacoes.service";
import { ApiKeyGuard, type ApiKeyRequest } from "./api-key.guard";

type ReqWithKey = { apiKey: ApiKeyRequest };

/**
 * API pública (API key) - catálogo optimizado para website do tenant.
 */
@Controller("public/v1/formacoes")
export class PublicFormacoesController {
  constructor(
    private readonly catalog: FormacoesCatalogService,
    private readonly formacoes: FormacoesService,
  ) {}

  /** Catálogo paginado (recomendado para sites com muitas formações). */
  @Get("catalogo")
  @UseGuards(ApiKeyGuard)
  @Header("Cache-Control", "public, max-age=120, stale-while-revalidate=300")
  catalogo(
    @Req() req: ReqWithKey,
    @Query("limit") limit?: string,
    @Query("after") after?: string,
  ) {
    const afterCodigo = after ? Number(after) : undefined;
    return this.catalog.getPublicCatalogPage(req.apiKey.tenantId, {
      limit: limit ? Number(limit) : undefined,
      afterCodigo: Number.isFinite(afterCodigo) ? afterCodigo : undefined,
    });
  }

  @Get()
  @UseGuards(ApiKeyGuard)
  @Header("Cache-Control", "public, max-age=120, stale-while-revalidate=300")
  list(@Req() req: ReqWithKey) {
    return this.formacoes.listPublicas(req.apiKey.tenantId);
  }

  @Get(":codigoPublico")
  @UseGuards(ApiKeyGuard)
  @Header("Cache-Control", "public, max-age=120, stale-while-revalidate=300")
  detail(
    @Req() req: ReqWithKey,
    @Param("codigoPublico", ParseIntPipe) codigoPublico: number,
  ) {
    return this.formacoes.getByCodigoPublico(req.apiKey.tenantId, codigoPublico);
  }

  @Get(":codigoPublico/acoes")
  @UseGuards(ApiKeyGuard)
  @Header("Cache-Control", "public, max-age=60, stale-while-revalidate=120")
  acoes(
    @Req() req: ReqWithKey,
    @Param("codigoPublico", ParseIntPipe) codigoPublico: number,
  ) {
    return this.formacoes.listAcoesPublicas(req.apiKey.tenantId, codigoPublico);
  }

  @Get(":codigoPublico/capa")
  @UseGuards(ApiKeyGuard)
  @Header("Cache-Control", "public, max-age=86400, immutable")
  async capa(
    @Req() req: ReqWithKey,
    @Param("codigoPublico", ParseIntPipe) codigoPublico: number,
    @Res() res: Response,
  ) {
    const obj = await this.formacoes.streamCapaPublica(
      req.apiKey.tenantId,
      codigoPublico,
    );
    res.setHeader("Content-Type", obj.contentType);
    res.send(obj.body);
  }
}
