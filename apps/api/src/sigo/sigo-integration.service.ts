import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, randomUUID } from "crypto";
import {
  buildSigoSubmitHttpBody,
  type SigoSubmitPayloadFormat,
} from "@nexiforma/shared";
import type { SigoSubmissao } from "@nexiforma/database";
import type { Prisma } from "@nexiforma/database";
import type { RequestUser } from "../auth/types/access-token-payload";
import { AuditService } from "../audit/audit.service";
import { requireTenantId } from "../common/tenant-scope";
import { SigoExportService } from "../dossie-pedagogico/sigo-export.service";
import { PrismaService } from "../prisma/prisma.service";
import { SigoCertificatesService } from "./sigo-certificates.service";
import { interpolatePath, sigoHttpRequest } from "./sigo-http.util";
import { parseSigoRemoteStatus } from "./sigo-response.util";
import { SigoTenantConfigService } from "./sigo-tenant-config.service";
import { SigoAccessService } from "./sigo-access.service";

import { SigoSoapService } from "./sigo-soap.service";

export type SigoApiMode = "disabled" | "http" | "soap";

export type SigoSubmitResult = {
  mode: SigoApiMode;
  success: boolean;
  referenceId: string;
  submissaoId: string;
  message: string;
  submittedAt: string;
};

export type SigoCertificarResult = {
  submissaoId: string;
  referenceId: string;
  estado: string;
  certificados: Awaited<ReturnType<SigoCertificatesService["syncFromSubmissao"]>> | null;
};

const SUBMISSAO_INCLUDE = {
  acaoFormacao: { select: { id: true, codigoInterno: true, titulo: true } },
} satisfies Prisma.SigoSubmissaoInclude;

@Injectable()
export class SigoIntegrationService {
  private readonly logger = new Logger(SigoIntegrationService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly sigoExport: SigoExportService,
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
    private readonly certificates: SigoCertificatesService,
    private readonly tenantConfig: SigoTenantConfigService,
    private readonly access: SigoAccessService,
    private readonly soap: SigoSoapService,
  ) {}

  async getConfig(user: RequestUser) {
    const tenantId = requireTenantId(user);
    const tenant = await this.tenantConfig.getPublicConfig(user);
    const runtime = await this.tenantConfig.resolveRuntime(tenantId);
    return {
      mode: runtime.mode,
      configured: runtime.mode !== "disabled",
      baseUrl: runtime.baseUrl ?? this.tenantConfig.platformBaseUrl(),
      payloadFormat: this.submitPayloadFormat(),
      tenant,
      platformBaseUrl: this.tenantConfig.platformBaseUrl(),
      platformMode: this.tenantConfig.platformMode(),
    };
  }

  async testConnection(user: RequestUser) {
    return this.tenantConfig.testTenantConnection(user);
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
    await this.access.assertAcao(user, tenantId, "reconciliar");
    return this.reconcileForTenant(tenantId, submissaoId, user.sub);
  }

  async reconcileForTenant(
    tenantId: string,
    submissaoId: string,
    actorId = "system-cron",
  ): Promise<SigoSubmissao> {
    const row = await this.prisma.sigoSubmissao.findFirst({
      where: { id: submissaoId, tenantId },
    });
    if (!row) throw new NotFoundException("Submissão SIGO não encontrada.");

    const runtime = await this.tenantConfig.resolveRuntime(tenantId);
    if (runtime.mode === "disabled") {
      throw new ServiceUnavailableException(
        "SIGO inactivo para esta entidade – configure credenciais em Integrações SIGO.",
      );
    }

    let parsed: Awaited<ReturnType<typeof parseSigoRemoteStatus>>;
    if (runtime.mode === "soap") {
      const soapParsed = await this.soap.consultarEstado(runtime, row.referenceId);
      parsed = {
        estado:
          soapParsed.sucesso
            ? "ACEITE"
            : soapParsed.fault
              ? "REJEITADA"
              : "ERRO",
        erros: soapParsed.errosFormandos.map((e) => ({
          codigo: e.codigo,
          mensagem: e.mensagem,
        })),
        mensagem: soapParsed.mensagem ?? undefined,
      };
    } else {
      parsed = await this.fetchRemoteStatus(tenantId, row.referenceId);
    }

    const updated = await this.prisma.sigoSubmissao.update({
      where: { id: submissaoId },
      data: {
        estado: parsed.estado === "PENDENTE" ? "SUBMETIDA" : parsed.estado,
        erros: parsed.erros.length ? parsed.erros : undefined,
        reconciledAt: new Date(),
      },
      include: SUBMISSAO_INCLUDE,
    });

    if (parsed.estado === "ACEITE") {
      try {
        await this.certificates.syncForTenant(tenantId, submissaoId, { actorId });
      } catch (err) {
        this.logger.warn(
          `Sync certificados SIGO após ACEITE falhou (${submissaoId}): ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return updated;
  }

  async resubmit(user: RequestUser, submissaoId: string) {
    const tenantId = requireTenantId(user);
    await this.access.assertAcao(user, tenantId, "submeter");
    const row = await this.prisma.sigoSubmissao.findFirst({
      where: { id: submissaoId, tenantId },
    });
    if (!row) throw new NotFoundException("Submissão SIGO não encontrada.");
    return this.submitAcao(user, row.acaoFormacaoId);
  }

  async certificarAcao(user: RequestUser, acaoId: string): Promise<SigoCertificarResult> {
    const tenantId = requireTenantId(user);
    await this.access.assertAcao(user, tenantId, "certificar");
    const submit = await this.submitAcaoInternal(user, acaoId);
    const reconciled = await this.reconcileForTenant(tenantId, submit.submissaoId, user.sub);

    let certificados: SigoCertificarResult["certificados"] = null;
    if (reconciled.estado === "ACEITE") {
      certificados = await this.certificates.syncFromSubmissao(user, submit.submissaoId, {
        forceDownload: true,
      });
    }

    return {
      submissaoId: submit.submissaoId,
      referenceId: submit.referenceId,
      estado: reconciled.estado,
      certificados,
    };
  }

  async submitAcao(user: RequestUser, acaoId: string): Promise<SigoSubmitResult> {
    const tenantId = requireTenantId(user);
    await this.access.assertAcao(user, tenantId, "submeter");
    return this.submitAcaoInternal(user, acaoId);
  }

  private async submitAcaoInternal(user: RequestUser, acaoId: string): Promise<SigoSubmitResult> {
    const tenantId = requireTenantId(user);
    const runtime = await this.tenantConfig.resolveRuntime(tenantId);
    if (runtime.mode === "disabled") {
      throw new ServiceUnavailableException(
        "SIGO inactivo – cada entidade deve configurar NIF, API key e activar a integração.",
      );
    }

    const validation = await this.sigoExport.validateForSigo(user, acaoId, {
      exigirCamposSoap: runtime.mode === "soap",
    });
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
    const httpBody = buildSigoSubmitHttpBody(
      pkg.body as Parameters<typeof buildSigoSubmitHttpBody>[0],
      referenceId,
      this.submitPayloadFormat(),
    );
    const payloadHash = createHash("sha256").update(JSON.stringify(httpBody)).digest("hex");

    const submissao = await this.prisma.sigoSubmissao.create({
      data: {
        tenantId,
        acaoFormacaoId: acaoId,
        referenceId,
        estado: "PENDENTE",
        payloadHash,
      },
    });

    try {
      if (runtime.mode === "soap") {
        const soapResult = await this.soap.submitAcao(runtime, {
          tenantId,
          submissaoId: submissao.id,
          referenceId,
          pkg: pkg.body as Parameters<typeof this.soap.submitAcao>[1]["pkg"],
        });
        const finalRef = soapResult.transacaoId ?? soapResult.referenceId;

        await this.prisma.sigoSubmissao.update({
          where: { id: submissao.id },
          data: {
            referenceId: finalRef,
            estado: "SUBMETIDA",
            submittedAt: new Date(),
          },
        });
        await this.audit.log({
          actorType: user.sub ? "TENANT_USER" : "SYSTEM",
          actorId: user.sub,
          action: "sigo.submit.soap",
          resourceType: "acao_formacao",
          resourceId: acaoId,
          targetTenantId: tenantId,
          payload: { referenceId: finalRef, submissaoId: submissao.id, transacaoId: soapResult.transacaoId },
        });
        return {
          mode: runtime.mode,
          success: true,
          referenceId: finalRef,
          submissaoId: submissao.id,
          message: "Pacote submetido ao SIGO via SOAP (WS-Security).",
          submittedAt,
        };
      }

      const finalRef = await this.submitHttp(tenantId, referenceId, httpBody);

      await this.prisma.sigoSubmissao.update({
        where: { id: submissao.id },
        data: {
          referenceId: finalRef,
          estado: "SUBMETIDA",
          submittedAt: new Date(),
        },
      });
      await this.audit.log({
        actorType: user.sub ? "TENANT_USER" : "SYSTEM",
        actorId: user.sub,
        action: "sigo.submit.http",
        resourceType: "acao_formacao",
        resourceId: acaoId,
        targetTenantId: tenantId,
        payload: { referenceId: finalRef, submissaoId: submissao.id },
      });
      return {
        mode: runtime.mode,
        success: true,
        referenceId: finalRef,
        submissaoId: submissao.id,
        message: "Pacote submetido à API SIGO (credenciais da entidade).",
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

  private async submitHttp(tenantId: string, referenceId: string, body: Record<string, unknown>) {
    const runtime = await this.tenantConfig.resolveRuntime(tenantId);
    const submitPath = this.config.get<string>("SIGO_API_SUBMIT_PATH") ?? "/acoes";
    const url = this.tenantConfig.buildUrl(runtime, submitPath);

    const res = await sigoHttpRequest(
      url,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${runtime.apiKey}`,
          "x-nexiforma-reference": referenceId,
        },
        body: JSON.stringify(body),
      },
      { timeoutMs: this.timeoutMs(), maxRetries: this.maxRetries() },
    );

    if (res.statusCode < 200 || res.statusCode >= 300) {
      const erros = this.extractHttpErrors(res.json, res.body, res.statusCode);
      throw new BadRequestException(
        erros[0]?.mensagem ?? `SIGO API respondeu HTTP ${res.statusCode}.`,
      );
    }

    const remote = res.json as { id?: string; referenceId?: string };
    return remote.id ?? remote.referenceId ?? referenceId;
  }

  private async fetchRemoteStatus(tenantId: string, referenceId: string) {
    const runtime = await this.tenantConfig.resolveRuntime(tenantId);
    const statusTemplate =
      this.config.get<string>("SIGO_API_STATUS_PATH") ?? "/acoes/{referenceId}";
    const path = interpolatePath(statusTemplate, { referenceId });
    const url = this.tenantConfig.buildUrl(runtime, path);

    const res = await sigoHttpRequest(
      url,
      { method: "GET", headers: { authorization: `Bearer ${runtime.apiKey}`, accept: "application/json" } },
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

  private submitPayloadFormat(): SigoSubmitPayloadFormat {
    const raw = (this.config.get<string>("SIGO_SUBMIT_PAYLOAD_FORMAT") ?? "dgeec").toLowerCase();
    if (raw === "nexiforma" || raw === "dual") return raw;
    return "dgeec";
  }

  private timeoutMs() {
    return Number(this.config.get<string>("SIGO_API_TIMEOUT_MS") ?? "30000");
  }

  private maxRetries() {
    return Number(this.config.get<string>("SIGO_API_MAX_RETRIES") ?? "2");
  }
}
