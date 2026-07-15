import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  avaliarProntidaoSigoTenant,
  normalizarPerfisAcesso,
  type SigoConfigPublica,
  type SigoPerfisAcesso,
  type SigoProtocolo,
  type SigoRegiaoPortal,
} from "@nexiforma/shared";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "../common/tenant-scope";
import { PrismaService } from "../prisma/prisma.service";
import { interpolatePath, sigoHttpRequest } from "./sigo-http.util";
import {
  desencriptarSigoApiKey,
  encriptarSigoApiKey,
} from "./sigo-credentials.util";
import type { UpdateSigoTenantConfigDto } from "./dto/sigo-config.dto";
import { SigoAccessService } from "./sigo-access.service";
import { SigoSoapService } from "./sigo-soap.service";

export type ResolvedSigoRuntime = {
  mode: "disabled" | "http" | "soap";
  protocolo: SigoProtocolo;
  baseUrl: string | null;
  apiKey: string | null;
  wsdlUrl: string | null;
  soapEndpoint: string | null;
  soapUsername: string | null;
  soapPassword: string | null;
  ipAutorizado: string | null;
  regiaoPortal: SigoRegiaoPortal;
  nifEntidade: string | null;
  codigoEntidade: string | null;
  denominacaoEntidade: string | null;
  perfisAcesso: SigoPerfisAcesso;
};

@Injectable()
export class SigoTenantConfigService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly access: SigoAccessService,
    private readonly soap: SigoSoapService,
  ) {}

  private encryptionKey(): string {
    const key = this.config.get<string>("AT_CREDENTIALS_ENCRYPTION_KEY");
    if (!key?.trim()) {
      throw new ServiceUnavailableException(
        "AT_CREDENTIALS_ENCRYPTION_KEY em falta (necessária para credenciais SIGO).",
      );
    }
    return key;
  }

  platformBaseUrl(): string | null {
    return this.config.get<string>("SIGO_API_BASE_URL")?.trim() || null;
  }

  platformSoapEndpoint(): string | null {
    return this.config.get<string>("SIGO_SOAP_ENDPOINT")?.trim() || null;
  }

  platformWsdlUrl(): string | null {
    return this.config.get<string>("SIGO_SOAP_WSDL_URL")?.trim() || null;
  }

  platformMode(): "disabled" | "http" | "soap" {
    const raw = (this.config.get<string>("SIGO_API_MODE") ?? "disabled").toLowerCase();
    if (raw === "http") return "http";
    if (raw === "soap") return "soap";
    return "disabled";
  }

  private resolveProtocolo(row: { protocolo?: string | null } | null): SigoProtocolo {
    const tenantProto = row?.protocolo?.toLowerCase();
    if (tenantProto === "http" || tenantProto === "soap") return tenantProto;
    const platform = this.platformMode();
    if (platform === "soap") return "soap";
    if (platform === "http") return "http";
    return "soap";
  }

  async getPublicConfig(user: RequestUser): Promise<SigoConfigPublica> {
    const tenantId = requireTenantId(user);
    const [row, tenant] = await Promise.all([
      this.prisma.configSigoTenant.findUnique({ where: { tenantId } }),
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { nif: true, legalName: true },
      }),
    ]);
    const perfisAcesso = normalizarPerfisAcesso(row?.perfisAcesso);
    const protocolo = this.resolveProtocolo(row);
    const baseUrlDisponivel = Boolean(row?.baseUrlOverride?.trim() || this.platformBaseUrl());
    const soapEndpointDisponivel = Boolean(
      row?.soapEndpoint?.trim() || row?.wsdlUrl?.trim() || this.platformSoapEndpoint() || this.platformWsdlUrl(),
    );
    const soapConfigured = Boolean(
      row?.soapUsername?.trim() && (row?.soapPasswordEnc || row?.apiKeyEnc),
    );
    const { prontoProducao, avisos } = avaliarProntidaoSigoTenant({
      integracaoAtiva: row?.integracaoAtiva ?? false,
      protocolo,
      nifEntidade: row?.nifEntidade ?? tenant?.nif ?? "",
      apiKeyConfigured: Boolean(row?.apiKeyEnc),
      soapConfigured,
      baseUrlDisponivel,
      soapEndpointDisponivel,
      ipAutorizado: row?.ipAutorizado,
    });

    return {
      integracaoAtiva: row?.integracaoAtiva ?? false,
      protocolo,
      nifEntidade: row?.nifEntidade ?? tenant?.nif ?? "",
      codigoEntidade: row?.codigoEntidade ?? null,
      denominacaoEntidade: row?.denominacaoEntidade ?? tenant?.legalName ?? null,
      baseUrlOverride: row?.baseUrlOverride ?? null,
      wsdlUrl: row?.wsdlUrl ?? null,
      soapEndpoint: row?.soapEndpoint ?? null,
      soapUsername: row?.soapUsername ?? null,
      soapPasswordConfigured: Boolean(row?.soapPasswordEnc || row?.apiKeyEnc),
      ipAutorizado: row?.ipAutorizado ?? null,
      regiaoPortal: (row?.regiaoPortal ?? "CONTINENTE") as SigoRegiaoPortal,
      apiKeyConfigured: Boolean(row?.apiKeyEnc),
      perfisAcesso,
      ultimoTesteOkEm: row?.ultimoTesteOkEm?.toISOString() ?? null,
      ultimoTesteMsg: row?.ultimoTesteMsg ?? null,
      prontoProducao,
      avisos,
    };
  }

  async upsert(user: RequestUser, dto: UpdateSigoTenantConfigDto) {
    const tenantId = requireTenantId(user);
    await this.access.assertAcao(user, tenantId, "configurar");

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { legalName: true, nif: true },
    });
    if (!tenant) throw new BadRequestException("Tenant não encontrado.");

    const existing = await this.prisma.configSigoTenant.findUnique({ where: { tenantId } });
    const protocolo: SigoProtocolo =
      dto.protocolo === "http" || dto.protocolo === "soap"
        ? dto.protocolo
        : this.resolveProtocolo(existing);

    let apiKeyEnc = existing?.apiKeyEnc ?? null;
    if (dto.apiKey?.trim()) {
      apiKeyEnc = encriptarSigoApiKey(dto.apiKey.trim(), this.encryptionKey());
    }

    let soapPasswordEnc = existing?.soapPasswordEnc ?? null;
    if (dto.soapPassword?.trim()) {
      soapPasswordEnc = encriptarSigoApiKey(dto.soapPassword.trim(), this.encryptionKey());
    }

    if (dto.integracaoAtiva) {
      if (protocolo === "soap") {
        const userOk = (dto.soapUsername?.trim() || existing?.soapUsername?.trim());
        const passOk = soapPasswordEnc || apiKeyEnc;
        if (!userOk || !passOk) {
          throw new BadRequestException(
            "Utilizador e password SOAP (WS-Security) obrigatórios para activar integração.",
          );
        }
      } else if (!apiKeyEnc) {
        throw new BadRequestException("API key SIGO obrigatória para activar integração HTTP.");
      }
    }

    const perfisAcesso = dto.perfisAcesso
      ? normalizarPerfisAcesso({ ...normalizarPerfisAcesso(existing?.perfisAcesso), ...dto.perfisAcesso })
      : normalizarPerfisAcesso(existing?.perfisAcesso);

    const regiaoPortal =
      dto.regiaoPortal === "MADEIRA" || dto.regiaoPortal === "ACORES" || dto.regiaoPortal === "CONTINENTE"
        ? dto.regiaoPortal
        : (existing?.regiaoPortal ?? "CONTINENTE");

    await this.prisma.configSigoTenant.upsert({
      where: { tenantId },
      create: {
        tenantId,
        integracaoAtiva: dto.integracaoAtiva,
        protocolo,
        nifEntidade: dto.nifEntidade.trim(),
        codigoEntidade: dto.codigoEntidade?.trim() || null,
        denominacaoEntidade: dto.denominacaoEntidade?.trim() || tenant.legalName || null,
        apiKeyEnc,
        baseUrlOverride: dto.baseUrlOverride?.trim() || null,
        wsdlUrl: dto.wsdlUrl?.trim() || null,
        soapEndpoint: dto.soapEndpoint?.trim() || null,
        soapUsername: dto.soapUsername?.trim() || null,
        soapPasswordEnc,
        ipAutorizado: dto.ipAutorizado?.trim() || null,
        regiaoPortal,
        perfisAcesso,
      },
      update: {
        integracaoAtiva: dto.integracaoAtiva,
        protocolo,
        nifEntidade: dto.nifEntidade.trim(),
        codigoEntidade: dto.codigoEntidade?.trim() || null,
        denominacaoEntidade: dto.denominacaoEntidade?.trim() || tenant.legalName || null,
        apiKeyEnc,
        baseUrlOverride: dto.baseUrlOverride?.trim() || null,
        wsdlUrl: dto.wsdlUrl?.trim() || null,
        soapEndpoint: dto.soapEndpoint?.trim() || null,
        soapUsername: dto.soapUsername?.trim() || existing?.soapUsername || null,
        soapPasswordEnc,
        ipAutorizado: dto.ipAutorizado?.trim() || null,
        regiaoPortal,
        perfisAcesso,
      },
    });

    return this.getPublicConfig(user);
  }

  async testTenantConnection(user: RequestUser) {
    const tenantId = requireTenantId(user);
    await this.access.assertAcao(user, tenantId, "configurar");
    const runtime = await this.resolveRuntime(tenantId);

    if (runtime.mode === "disabled") {
      const msg = "Integração SIGO inactiva ou incompleta para esta entidade.";
      await this.gravarTeste(tenantId, false, msg);
      return { ok: false, mode: runtime.mode, message: msg };
    }

    if (runtime.mode === "soap") {
      const result = await this.soap.testConnection(runtime);
      await this.gravarTeste(tenantId, result.ok, result.message);
      return { ok: result.ok, mode: runtime.mode, message: result.message };
    }

    const healthPath = this.config.get<string>("SIGO_API_HEALTH_PATH") ?? "/health";
    const url = `${runtime.baseUrl!.replace(/\/$/, "")}${healthPath.startsWith("/") ? healthPath : `/${healthPath}`}`;

    try {
      const res = await sigoHttpRequest(
        url,
        {
          method: "GET",
          headers: {
            authorization: `Bearer ${runtime.apiKey}`,
            accept: "application/json",
          },
        },
        { timeoutMs: Math.min(Number(this.config.get("SIGO_API_TIMEOUT_MS") ?? 30000), 10000), maxRetries: 0 },
      );
      const ok = res.statusCode >= 200 && res.statusCode < 300;
      const message = ok ? "Ligação SIGO OK." : `SIGO respondeu HTTP ${res.statusCode}.`;
      await this.gravarTeste(tenantId, ok, message);
      return { ok, mode: runtime.mode, statusCode: res.statusCode, message };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await this.gravarTeste(tenantId, false, message);
      return { ok: false, mode: runtime.mode, message };
    }
  }

  async resolveRuntime(tenantId: string): Promise<ResolvedSigoRuntime> {
    const row = await this.prisma.configSigoTenant.findUnique({ where: { tenantId } });
    const perfisAcesso = normalizarPerfisAcesso(row?.perfisAcesso);
    const protocolo = this.resolveProtocolo(row);
    const regiaoPortal = (row?.regiaoPortal ?? "CONTINENTE") as SigoRegiaoPortal;

    const baseFields = {
      protocolo,
      nifEntidade: row?.nifEntidade ?? null,
      codigoEntidade: row?.codigoEntidade ?? null,
      denominacaoEntidade: row?.denominacaoEntidade ?? null,
      perfisAcesso,
      ipAutorizado: row?.ipAutorizado ?? null,
      regiaoPortal,
    };

    if (!row?.integracaoAtiva) {
      return {
        mode: "disabled",
        baseUrl: null,
        apiKey: null,
        wsdlUrl: row?.wsdlUrl ?? null,
        soapEndpoint: row?.soapEndpoint ?? null,
        soapUsername: row?.soapUsername ?? null,
        soapPassword: null,
        ...baseFields,
      };
    }

    if (protocolo === "soap") {
      const soapEndpoint =
        row.soapEndpoint?.trim() || this.platformSoapEndpoint() || null;
      const wsdlUrl = row.wsdlUrl?.trim() || this.platformWsdlUrl() || null;
      const passwordEnc = row.soapPasswordEnc ?? row.apiKeyEnc;
      if (!row.soapUsername?.trim() || !passwordEnc || (!soapEndpoint && !wsdlUrl)) {
        return {
          mode: "disabled",
          baseUrl: null,
          apiKey: null,
          wsdlUrl,
          soapEndpoint,
          soapUsername: row.soapUsername ?? null,
          soapPassword: null,
          ...baseFields,
        };
      }
      const soapPassword = desencriptarSigoApiKey(passwordEnc, this.encryptionKey());
      return {
        mode: "soap",
        baseUrl: null,
        apiKey: null,
        wsdlUrl,
        soapEndpoint,
        soapUsername: row.soapUsername,
        soapPassword,
        ...baseFields,
      };
    }

    const baseUrl = row.baseUrlOverride?.trim() || this.platformBaseUrl();
    if (!baseUrl || !row.apiKeyEnc) {
      return {
        mode: "disabled",
        baseUrl: baseUrl ?? null,
        apiKey: null,
        wsdlUrl: null,
        soapEndpoint: null,
        soapUsername: null,
        soapPassword: null,
        ...baseFields,
      };
    }

    const apiKey = desencriptarSigoApiKey(row.apiKeyEnc, this.encryptionKey());
    return {
      mode: "http",
      baseUrl,
      apiKey,
      wsdlUrl: null,
      soapEndpoint: null,
      soapUsername: null,
      soapPassword: null,
      ...baseFields,
    };
  }

  buildUrl(runtime: ResolvedSigoRuntime, path: string): string {
    if (!runtime.baseUrl) {
      throw new ServiceUnavailableException("URL base SIGO em falta.");
    }
    const normalized = path.startsWith("/") ? path : `/${path}`;
    return `${runtime.baseUrl.replace(/\/$/, "")}${normalized}`;
  }

  private async gravarTeste(tenantId: string, ok: boolean, message: string) {
    const existing = await this.prisma.configSigoTenant.findUnique({ where: { tenantId } });
    if (!existing) return;
    await this.prisma.configSigoTenant.update({
      where: { tenantId },
      data: {
        ultimoTesteOkEm: ok ? new Date() : existing.ultimoTesteOkEm,
        ultimoTesteMsg: message,
      },
    });
  }
}
