import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { requireTenantId } from "../common/tenant-scope";
import type { RequestUser } from "../auth/types/access-token-payload";

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
};

@Injectable()
export class TenantSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
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

  async getBranding(user: RequestUser) {
    const tenantId = requireTenantId(user);
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { legalName: true, metadata: true },
    });
    if (!tenant) throw new BadRequestException("Tenant não encontrado.");
    const meta = (tenant.metadata ?? {}) as TenantMetadata;
    const branding = meta.branding ?? {};
    return {
      ...branding,
      companyName: branding.companyName ?? tenant.legalName,
      logoUrl: branding.logoStorageKey
        ? `/api/v1/portal/tenant/logo`
        : branding.logoUrl,
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
      data: { metadata: next },
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
      select: { metadata: true, legalName: true },
    });
    const meta = (tenant?.metadata ?? {}) as TenantMetadata;
    const next: TenantMetadata = {
      ...meta,
      branding: {
        ...(meta.branding ?? {}),
        logoStorageKey: key,
        logoUrl: `/api/v1/portal/tenant/logo`,
        companyName: meta.branding?.companyName ?? tenant?.legalName,
      },
    };
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { metadata: next },
    });

    return { sucesso: true, logoUrl: `/api/v1/portal/tenant/logo`, logoStorageKey: key };
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
