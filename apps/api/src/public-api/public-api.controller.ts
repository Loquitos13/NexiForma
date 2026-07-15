import { Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Public } from "../auth/decorators/public.decorator";
import { apiStrictLimitPerMin, DDOS_WINDOW_MS } from "../common/ddos-throttle.config";
import { PrismaService } from "../prisma/prisma.service";
import { ApiKeyGuard, type ApiKeyRequest } from "./api-key.guard";

type ReqWithKey = { apiKey: ApiKeyRequest };

@Public()
@Throttle({ default: { limit: apiStrictLimitPerMin(), ttl: DDOS_WINDOW_MS } })
@Controller("public/v1")
export class PublicApiController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("health")
  health() {
    return { ok: true, service: "nexiforma-public-api" };
  }

  @Get("cursos")
  @UseGuards(ApiKeyGuard)
  cursos(@Req() req: ReqWithKey) {
    return this.prisma.curso.findMany({
      where: { tenantId: req.apiKey.tenantId },
      select: { id: true, designacao: true, codigoUfcd: true, cargaHoras: true },
      orderBy: { designacao: "asc" },
    });
  }

  @Get("acoes-formacao")
  @UseGuards(ApiKeyGuard)
  acoes(@Req() req: ReqWithKey) {
    return this.prisma.acaoFormacao.findMany({
      where: { tenantId: req.apiKey.tenantId },
      select: {
        id: true,
        codigoInterno: true,
        estado: true,
        dataInicio: true,
        dataFim: true,
        curso: { select: { designacao: true } },
      },
      orderBy: { dataInicio: "desc" },
      take: 100,
    });
  }

  @Get("propostas")
  @UseGuards(ApiKeyGuard)
  propostas(@Req() req: ReqWithKey) {
    return this.prisma.propostaComercial.findMany({
      where: { tenantId: req.apiKey.tenantId },
      select: { id: true, codigo: true, titulo: true, estado: true, valorCentavos: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  @Get("faturas")
  @UseGuards(ApiKeyGuard)
  faturas(@Req() req: ReqWithKey) {
    return this.prisma.faturaComercial.findMany({
      where: {
        tenantId: req.apiKey.tenantId,
        estado: { in: ["EMITIDA", "COMUNICADA_AT"] },
      },
      select: {
        id: true,
        numero: true,
        codigoAtcud: true,
        estado: true,
        valorCentavos: true,
        ivaCentavos: true,
        dataEmissao: true,
        destinatarioNome: true,
        destinatarioNif: true,
      },
      orderBy: { dataEmissao: "desc" },
      take: 100,
    });
  }

  @Get("matriculas")
  @UseGuards(ApiKeyGuard)
  matriculas(@Req() req: ReqWithKey) {
    return this.prisma.matricula.findMany({
      where: { tenantId: req.apiKey.tenantId, estado: "ATIVA" },
      select: {
        id: true,
        estado: true,
        dataInscricao: true,
        formando: { select: { nome: true } },
        turma: { select: { codigo: true, nome: true } },
      },
      orderBy: { dataInscricao: "desc" },
      take: 100,
    });
  }
}
