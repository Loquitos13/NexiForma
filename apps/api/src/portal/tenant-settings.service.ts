import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@nexiforma/database";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { AuditService } from "../audit/audit.service";
import { requireTenantId } from "../common/tenant-scope";
import type { RequestUser } from "../auth/types/access-token-payload";
import {
  isValidNifPt,
  normalizarNif,
} from "../dossie-pedagogico/sigo-validation.util";
import {
  DEFAULT_UNIVERSAL_REQUIRED,
  ENROLLMENT_DOC_OPTIONS,
  mergeTenantDocumentosPolitica,
  parseTenantDocumentosPolitica,
  UNIVERSAL_DOC_OPTIONS,
  type DocumentosPoliticaTenant,
} from "../formandos/documentos-politica.util";

export type TenantBrandingPayload = {
  logoUrl?: string;
  logoStorageKey?: string;
  primaryColor?: string;
  secondaryColor?: string;
  companyName?: string;
  supportEmail?: string;
  supportPhone?: string;
  footerText?: string;
};

export type TenantCronogramaConfig = {
  local?: string;
  horarioInicio?: string;
  horarioFim?: string;
  horarioSabadoInicio?: string;
  horarioSabadoFim?: string;
  funcionamento?: "laboral" | "pos_laboral" | "misto";
  metodologias?: string[];
};

type TenantMetadata = {
  branding?: TenantBrandingPayload;
  cronograma?: TenantCronogramaConfig;
  documentosPolitica?: DocumentosPoliticaTenant;
};

@Injectable()
export class TenantSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  async getTenantInfo(user: RequestUser): Promise<{
    slug: string;
    legalName: string;
    nif: string;
    status: string;
    metadata: unknown;
  }> {
    const tenantId = requireTenantId(user);
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { slug: true, legalName: true, nif: true, status: true, metadata: true },
    });
    if (!tenant) throw new BadRequestException("Tenant não encontrado.");
    return tenant;
  }

  /**
   * Actualiza identificação legal da entidade (nome + NIF).
   * Escrito na tabela Tenant partilhada com o control plane / superadmin.
   */
  async updateEntidade(
    user: RequestUser,
    dto: { legalName?: string; nif?: string },
  ): Promise<{
    slug: string;
    legalName: string;
    nif: string;
    status: string;
    metadata: unknown;
  }> {
    const tenantId = requireTenantId(user);
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, slug: true, legalName: true, nif: true, metadata: true },
    });
    if (!tenant) throw new NotFoundException("Tenant não encontrado.");

    const legalName =
      dto.legalName !== undefined ? dto.legalName.trim() : tenant.legalName;
    const nifRaw = dto.nif !== undefined ? normalizarNif(dto.nif) : tenant.nif;

    if (!legalName || legalName.length < 2) {
      throw new BadRequestException("Indique o nome legal da entidade (mín. 2 caracteres).");
    }
    if (legalName.length > 200) {
      throw new BadRequestException("Nome legal demasiado longo (máx. 200 caracteres).");
    }
    if (!isValidNifPt(nifRaw)) {
      throw new BadRequestException("NIF português inválido (9 dígitos com dígito de controlo).");
    }

    if (nifRaw !== tenant.nif) {
      const clash = await this.prisma.tenant.findFirst({
        where: { nif: nifRaw, id: { not: tenantId } },
        select: { id: true },
      });
      if (clash) {
        throw new ConflictException("Este NIF já está registado noutra entidade.");
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.tenant.update({
        where: { id: tenantId },
        data: { legalName, nif: nifRaw },
        select: { slug: true, legalName: true, nif: true, status: true, metadata: true },
      });

      // Manter faturação alinhada se o NIF emitente era o antigo NIF do tenant.
      if (nifRaw !== tenant.nif) {
        const cfg = await tx.configFaturacaoTenant.findUnique({
          where: { tenantId },
          select: { nifEmitente: true },
        });
        if (cfg && (cfg.nifEmitente === tenant.nif || !cfg.nifEmitente?.trim())) {
          await tx.configFaturacaoTenant.update({
            where: { tenantId },
            data: {
              nifEmitente: nifRaw,
              ...(legalName !== tenant.legalName ? { nomeEmpresa: legalName } : {}),
            },
          });
        }
      } else if (legalName !== tenant.legalName) {
        const cfg = await tx.configFaturacaoTenant.findUnique({
          where: { tenantId },
          select: { nomeEmpresa: true },
        });
        if (cfg && (!cfg.nomeEmpresa?.trim() || cfg.nomeEmpresa === tenant.legalName)) {
          await tx.configFaturacaoTenant.update({
            where: { tenantId },
            data: { nomeEmpresa: legalName },
          });
        }
      }

      // Branding: companyName por omissão segue o nome legal.
      const meta = (tenant.metadata ?? {}) as TenantMetadata;
      if (meta.branding && (!meta.branding.companyName || meta.branding.companyName === tenant.legalName)) {
        const next: TenantMetadata = {
          ...meta,
          branding: { ...meta.branding, companyName: legalName },
        };
        await tx.tenant.update({
          where: { id: tenantId },
          data: { metadata: next as Prisma.InputJsonValue },
        });
      }

      return row;
    });

    void this.audit.log({
      actorType: "TENANT_USER",
      actorId: user.sub,
      action: "tenant.entidade.update",
      resourceType: "Tenant",
      resourceId: tenantId,
      targetTenantId: tenantId,
      targetUserId: user.sub,
      payload: {
        from: { legalName: tenant.legalName, nif: tenant.nif },
        to: { legalName: updated.legalName, nif: updated.nif },
      },
    });

    return updated;
  }

  async getBranding(user: RequestUser) {
    const tenantId = requireTenantId(user);
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { legalName: true, slug: true, metadata: true },
    });
    if (!tenant) throw new BadRequestException("Tenant não encontrado.");
    const meta = (tenant.metadata ?? {}) as TenantMetadata;
    const branding = meta.branding ?? {};
    const publicLogo = branding.logoStorageKey
      ? `/api/v1/auth/public/tenant-logo?slug=${encodeURIComponent(tenant.slug)}`
      : branding.logoUrl;
    return {
      ...branding,
      companyName: branding.companyName ?? tenant.legalName,
      logoUrl: publicLogo,
      cronograma: meta.cronograma ?? {},
    };
  }

  async updateBranding(user: RequestUser, payload: TenantBrandingPayload & { cronograma?: TenantCronogramaConfig }) {
    const tenantId = requireTenantId(user);
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { metadata: true, legalName: true },
    });
    if (!tenant) throw new BadRequestException("Tenant não encontrado.");

    const meta = (tenant.metadata ?? {}) as TenantMetadata;
    const { cronograma, ...branding } = payload;

    const next: TenantMetadata = {
      ...meta,
      branding: {
        ...(meta.branding ?? {}),
        ...branding,
        companyName: branding.companyName ?? tenant.legalName,
      },
      ...(cronograma ? { cronograma: { ...(meta.cronograma ?? {}), ...cronograma } } : {}),
    };

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { metadata: next as Prisma.InputJsonValue },
    });

    return { sucesso: true, branding: next.branding, cronograma: next.cronograma };
  }

  async uploadLogo(user: RequestUser, file: Express.Multer.File) {
    const tenantId = requireTenantId(user);
    if (!file?.buffer?.length) {
      throw new BadRequestException("Ficheiro de logo em falta.");
    }
    const allowed = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException("Formato inválido. Use PNG, JPEG, WebP ou SVG.");
    }

    const ext =
      file.mimetype === "image/png"
        ? "png"
        : file.mimetype === "image/jpeg"
          ? "jpg"
          : file.mimetype === "image/webp"
            ? "webp"
            : "svg";
    const key = `tenants/${tenantId}/logo.${ext}`;
    await this.storage.putObject(key, file.buffer, file.mimetype);

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { metadata: true, legalName: true, slug: true },
    });
    const meta = (tenant?.metadata ?? {}) as TenantMetadata;
    const logoUrl = tenant?.slug
      ? `/api/v1/auth/public/tenant-logo?slug=${encodeURIComponent(tenant.slug)}`
      : `/api/v1/portal/tenant/logo`;
    const next: TenantMetadata = {
      ...meta,
      branding: {
        ...(meta.branding ?? {}),
        logoStorageKey: key,
        logoUrl,
        companyName: meta.branding?.companyName ?? tenant?.legalName,
      },
    };
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { metadata: next as Prisma.InputJsonValue },
    });

    return { sucesso: true, logoUrl, logoStorageKey: key };
  }

  async getDocumentosPolitica(user: RequestUser) {
    const tenantId = requireTenantId(user);
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { metadata: true },
    });
    if (!tenant) throw new BadRequestException("Tenant não encontrado.");
    const politica = parseTenantDocumentosPolitica(tenant.metadata);
    return {
      politica,
      opcoesUniversais: UNIVERSAL_DOC_OPTIONS,
      opcoesInscricao: ENROLLMENT_DOC_OPTIONS,
      defaults: {
        universaisObrigatorios: DEFAULT_UNIVERSAL_REQUIRED,
      },
      ajuda:
        "Os documentos universais ficam na ficha do formando. Os de inscrição (contrato, declaração, regulamento) configuram-se por curso/acção, porque horas e valor mudam entre edições.",
    };
  }

  async updateDocumentosPolitica(user: RequestUser, body: { universaisObrigatorios?: string[] }) {
    const tenantId = requireTenantId(user);
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { metadata: true },
    });
    if (!tenant) throw new BadRequestException("Tenant não encontrado.");

    const politica = parseTenantDocumentosPolitica({
      documentosPolitica: {
        version: 1,
        universaisObrigatorios: body.universaisObrigatorios ?? [],
      },
    });
    const next = mergeTenantDocumentosPolitica(tenant.metadata, politica);
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { metadata: next as Prisma.InputJsonValue },
    });
    return { sucesso: true, politica };
  }

  async streamLogo(user: RequestUser) {
    const tenantId = requireTenantId(user);
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { metadata: true },
    });
    const key = (tenant?.metadata as TenantMetadata | null)?.branding?.logoStorageKey;
    if (!key) return null;
    return this.storage.getObject(key);
  }
}
