import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, randomUUID } from "crypto";
import type { SigoSubmissao } from "@nexiforma/database";
import type { Prisma } from "@nexiforma/database";
import type { RequestUser } from "../auth/types/access-token-payload";
import { AuditService } from "../audit/audit.service";
import { requireTenantId } from "../common/tenant-scope";
import { SigoExportService } from "../dossie-pedagogico/sigo-export.service";
import { PrismaService } from "../prisma/prisma.service";
import { interpolatePath, sigoHttpRequest } from "./sigo-http.util";
import { parseSigoRemoteStatus } from "./sigo-response.util";

export type SigoApiMode = "disabled" | "http";

export type SigoSubmitResult = {
  mode: SigoApiMode;
  success: boolean;
  referenceId: string;
  submissaoId: string;
  message: string;
  submittedAt: string;
};

const SUBMISSAO_INCLUDE = {
  acaoFormacao: { select: { id: true, codigoInterno: true, titulo: true } },
} satisfies Prisma.SigoSubmissaoInclude;

@Injectable()
export class SigoIntegrationService {
  constructor(
    private readonly config: ConfigService,
    private readonly sigoExport: SigoExportService,
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  getConfig() {
    const mode = this.mode();
    return {
      mode,
      configured: mode === "http",
      baseUrl: mode === "http" ? (this.config.get<string>("SIGO_API_BASE_URL") ?? null) : null,
    };
  }

  listSubmissoes(user: RequestUser, acaoId?: string) {
    const tenantId = requireTenantId(user);
    return this.prisma.sigoSubmissao.findMany({
      where: {
        tenantId,
        ...(acaoId ? { acaoFormacaoId: acaoId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: SUBMISSAO_INCLUDE,
    });
  }

  listSubmissoesAcao(user: RequestUser, acaoId: string) {
    return this.listSubmissoes(user, acaoId);
  }

  async reconcile(user: RequestUser, submissaoId: string): Promise<SigoSubmissao> {
    const tenantId = requireTenantId(user);
    const row = await this.prisma.sigoSubmissao.findFirst({
      where: { id: submissaoId, tenantId },
    });
    if (!row) throw new NotFoundException("Submissão SIGO não encontrada.");

    if (this.mode() !== "http") {
      throw new ServiceUnavailableException(
        "Reconciliação SIGO requer SIGO_API_MODE=http e credenciais DGEEC.",
      );
    }

    const parsed = await this.fetchRemoteStatus(row.referenceId);
    return this.prisma.sigoSubmissao.update({
      where: { id: submissaoId },
      data: {
        estado: parsed.estado === "PENDENTE" ? "SUBMETIDA" : parsed.estado,
        erros: parsed.erros.length ? parsed.erros : undefined,
        reconciledAt: new Date(),
      },
      include: SUBMISSAO_INCLUDE,
    });
  }

  async resubmit(user: RequestUser, submissaoId: string) {
    const tenantId = requireTenantId(user);
    const row = await this.prisma.sigoSubmissao.findFirst({
      where: { id: submissaoId, tenantId },
    });
    if (!row) throw new NotFoundException("Submissão SIGO não encontrada.");
    return this.submitAcao(user, row.acaoFormacaoId);
  }

  async submitAcao(user: RequestUser, acaoId: string): Promise<SigoSubmitResult> {
    const tenantId = requireTenantId(user);
    const mode = this.mode();
    if (mode !== "http") {
      throw new ServiceUnavailableException(
        "Integração SIGO desactivada - configure SIGO_API_MODE=http e credenciais DGEEC.",
      );
    }

    const validation = await this.sigoExport.validateForSigo(user, acaoId);
    const validacao = validation as { prontoParaImportacaoSigo?: boolean; erros?: unknown[] };
    if (!validacao.prontoParaImportacaoSigo) {
      throw new BadRequestException({
        message: "Validação SIGO falhou – corrigir erros antes de submeter.",
        erros: validacao.erros ?? [],
      });
    }

    const pkg = await this.sigoExport.buildSigoJsonPackage(user, acaoId);
    const referenceId = randomUUID();
    const submittedAt = new Date().toISOString();
    const payloadHash = createHash("sha256").update(JSON.stringify(pkg.body)).digest("hex");

    const submissao = await this.prisma.sigoSubmissao.create({
      data: {
        tenantId,
        acaoFormacaoId: acaoId,
        referenceId,
        estado: "PENDENTE",
        payloadHash,
      },
    });

    const { baseUrl, apiKey } = this.requireHttpConfig();
    const submitPath = this.config.get<string>("SIGO_API_SUBMIT_PATH") ?? "/acoes";
    const url = `${baseUrl.replace(/\/$/, "")}${submitPath.startsWith("/") ? submitPath : `/${submitPath}`}`;

    try {
      const res = await sigoHttpRequest(
        url,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${apiKey}`,
            "x-nexiforma-reference": referenceId,
          },
          body: JSON.stringify(pkg.body),
        },
        { timeoutMs: this.timeoutMs(), maxRetries: this.maxRetries() },
      );

      if (res.statusCode < 200 || res.statusCode >= 300) {
        const erros = this.extractHttpErrors(res.json, res.body, res.statusCode);
        await this.prisma.sigoSubmissao.update({
          where: { id: submissao.id },
          data: { estado: "ERRO", erros },
        });
        throw new BadRequestException(
          erros[0]?.mensagem ?? `SIGO API respondeu HTTP ${res.statusCode}.`,
        );
      }

      const remote = res.json as { id?: string; referenceId?: string };
      const finalRef = remote.id ?? remote.referenceId ?? referenceId;
      await this.prisma.sigoSubmissao.update({
        where: { id: submissao.id },
        data: {
          referenceId: finalRef,
          estado: "SUBMETIDA",
          submittedAt: new Date(),
        },
      });
      await this.audit.log({
        actorType: "TENANT_USER",
        actorId: user.sub,
        action: "sigo.submit.http",
        resourceType: "acao_formacao",
        resourceId: acaoId,
        targetTenantId: tenantId,
        payload: { referenceId: finalRef, submissaoId: submissao.id },
      });
      return {
        mode,
        success: true,
        referenceId: finalRef,
        submissaoId: submissao.id,
        message: "Pacote submetido à API SIGO.",
        submittedAt,
      };
    } catch (e) {
      if (!(e instanceof BadRequestException)) {
        await this.prisma.sigoSubmissao.update({
          where: { id: submissao.id },
          data: {
            estado: "ERRO",
            erros: [{ mensagem: e instanceof Error ? e.message : String(e) }],
          },
        });
      }
      throw e;
    }
  }

  private async fetchRemoteStatus(referenceId: string) {
    const { baseUrl, apiKey } = this.requireHttpConfig();
    const statusTemplate =
      this.config.get<string>("SIGO_API_STATUS_PATH") ?? "/acoes/{referenceId}";
    const path = interpolatePath(statusTemplate, { referenceId });
    const url = `${baseUrl.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;

    const res = await sigoHttpRequest(
      url,
      { method: "GET", headers: { authorization: `Bearer ${apiKey}`, accept: "application/json" } },
      { timeoutMs: this.timeoutMs(), maxRetries: this.maxRetries() },
    );

    if (res.statusCode < 200 || res.statusCode >= 300) {
      return {
        estado: "ERRO" as const,
        erros: this.extractHttpErrors(res.json, res.body, res.statusCode),
        mensagem: `Consulta estado falhou (HTTP ${res.statusCode}).`,
      };
    }

    return parseSigoRemoteStatus(res.json);
  }

  private extractHttpErrors(json: unknown, body: string, status: number) {
    const parsed = parseSigoRemoteStatus(json);
    if (parsed.erros.length) return parsed.erros;
    return [{ codigo: `HTTP-${status}`, mensagem: body.slice(0, 500) || `Erro HTTP ${status}` }];
  }

  private requireHttpConfig() {
    const baseUrl = this.config.get<string>("SIGO_API_BASE_URL");
    const apiKey = this.config.get<string>("SIGO_API_KEY");
    if (!baseUrl || !apiKey) {
      throw new ServiceUnavailableException("SIGO_API_BASE_URL ou SIGO_API_KEY em falta.");
    }
    return { baseUrl, apiKey };
  }

  private timeoutMs() {
    return Number(this.config.get<string>("SIGO_API_TIMEOUT_MS") ?? "30000");
  }

  private maxRetries() {
    return Number(this.config.get<string>("SIGO_API_MAX_RETRIES") ?? "2");
  }

  private mode(): SigoApiMode {
    const raw = (this.config.get<string>("SIGO_API_MODE") ?? "disabled").toLowerCase();
    if (raw === "http") return "http";
    return "disabled";
  }
}
