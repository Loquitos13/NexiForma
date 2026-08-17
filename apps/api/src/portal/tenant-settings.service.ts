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
import {
  AVALIACAO_TIPO_OPTIONS,
  DEFAULT_AVALIACAO_PARAMETROS,
  mergeTenantAvaliacaoParametros,
  normalizeAvaliacaoTipo,
  parseTenantAvaliacaoParametros,
  type AvaliacaoParametrosTenant,
  type AvaliacaoTipoId,
} from "../avaliacoes/avaliacao-parametros.util";
import {
  getModuloTemplates,
  getModuloLogos,
  isAllowedTemplateId,
  isCustomTemplateId,
  mergeTenantDocumentTemplates,
  mergeTenantModuleLogos,
  parseDocumentLogoPlacements,
  slugifyModuleLogoId,
  TEMPLATE_TYPES,
  TEMPLATE_VARIABLES,
  variablesForModulo,
  type TemplateModulo,
  type TenantTemplateEntry,
  type ModuleLogoAsset,
} from "@nexiforma/shared";

export type TenantBrandingPayload = {
  logoUrl?: string;
  logoStorageKey?: string;
  primaryColor?: string;
  secondaryColor?: string;
  companyName?: string;
  supportEmail?: string;
  supportPhone?: string;
  footerText?: string;
  logoCabecalho?: {
    posicao?: "left" | "center" | "right";
    larguraPx?: number;
    alturaPx?: number;
  };
  logoRodape?: {
    posicao?: "left" | "center" | "right";
    larguraPx?: number;
    alturaPx?: number;
  };
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
  avaliacaoParametros?: AvaliacaoParametrosTenant;
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

  async getAvaliacaoParametros(user: RequestUser) {
    const tenantId = requireTenantId(user);
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { metadata: true },
    });
    if (!tenant) throw new BadRequestException("Tenant não encontrado.");
    const parametros = parseTenantAvaliacaoParametros(tenant.metadata);
    return {
      parametros,
      opcoesTipos: AVALIACAO_TIPO_OPTIONS,
      defaults: DEFAULT_AVALIACAO_PARAMETROS,
      ajuda:
        "Define a escala de notas, o mínimo para aprovação e os tipos de avaliação permitidos em toda a entidade.",
    };
  }

  async updateAvaliacaoParametros(
    user: RequestUser,
    body: {
      notaMinimaAprovacao?: number;
      escalaMaxima?: number;
      tiposPermitidos?: string[];
      exigirObservacoesAbaixoMinima?: boolean;
    },
  ) {
    const tenantId = requireTenantId(user);
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { metadata: true },
    });
    if (!tenant) throw new BadRequestException("Tenant não encontrado.");

    const escalaMaxima =
      body.escalaMaxima != null ? Math.round(body.escalaMaxima) : undefined;
    if (escalaMaxima != null && (escalaMaxima < 1 || escalaMaxima > 100)) {
      throw new BadRequestException("A escala máxima deve estar entre 1 e 100.");
    }
    const notaMinimaAprovacao =
      body.notaMinimaAprovacao != null ? Math.round(body.notaMinimaAprovacao) : undefined;
    const max = escalaMaxima ?? parseTenantAvaliacaoParametros(tenant.metadata).escalaMaxima;
    if (
      notaMinimaAprovacao != null &&
      (notaMinimaAprovacao < 0 || notaMinimaAprovacao > max)
    ) {
      throw new BadRequestException(`Nota mínima deve estar entre 0 e ${max}.`);
    }

    const tiposPermitidos = body.tiposPermitidos
      ? body.tiposPermitidos
          .map((t) => normalizeAvaliacaoTipo(t))
          .filter((t): t is AvaliacaoTipoId => t != null)
      : undefined;
    if (body.tiposPermitidos && (!tiposPermitidos || tiposPermitidos.length === 0)) {
      throw new BadRequestException("Selecciona pelo menos um tipo de avaliação.");
    }

    const patch: Partial<AvaliacaoParametrosTenant> = {
      ...(notaMinimaAprovacao != null ? { notaMinimaAprovacao } : {}),
      ...(escalaMaxima != null ? { escalaMaxima } : {}),
      ...(tiposPermitidos ? { tiposPermitidos } : {}),
      ...(body.exigirObservacoesAbaixoMinima != null
        ? { exigirObservacoesAbaixoMinima: body.exigirObservacoesAbaixoMinima }
        : {}),
    };

    const next = mergeTenantAvaliacaoParametros(tenant.metadata, patch);
    const parametros = parseTenantAvaliacaoParametros(next);
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { metadata: next as Prisma.InputJsonValue },
    });

    void this.audit.log({
      actorType: "TENANT_USER",
      actorId: user.sub,
      action: "tenant.avaliacao_parametros.update",
      resourceType: "tenant",
      resourceId: tenantId,
      targetTenantId: tenantId,
      payload: parametros as unknown as Prisma.InputJsonValue,
    });

    return { sucesso: true, parametros };
  }

  private assertTemplateModulo(modulo: string): TemplateModulo {
    const allowed: TemplateModulo[] = ["geral", "formacao", "crm", "faturacao"];
    if (!allowed.includes(modulo as TemplateModulo)) {
      throw new BadRequestException("Módulo de template inválido.");
    }
    return modulo as TemplateModulo;
  }

  async getDocumentTemplates(user: RequestUser, moduloRaw: string) {
    const modulo = this.assertTemplateModulo(moduloRaw);
    const tenantId = requireTenantId(user);
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { metadata: true, legalName: true, nif: true },
    });
    if (!tenant) throw new BadRequestException("Tenant não encontrado.");
    const templates = getModuloTemplates(tenant.metadata, modulo);
    const moduleLogos = getModuloLogos(tenant.metadata, modulo);
    return {
      modulo,
      templates,
      moduleLogos,
      tipos: TEMPLATE_TYPES[modulo] ?? [],
      variaveis: variablesForModulo(modulo),
      variaveisPorModulo: TEMPLATE_VARIABLES,
      ajuda:
        "Use {{variavel}} no texto. Na emissão do documento, cada token é substituído pelos dados reais do formando, acção, cliente, etc.",
    };
  }

  async updateDocumentTemplates(
    user: RequestUser,
    body: { modulo: string; templates: Record<string, TenantTemplateEntry> },
  ) {
    const modulo = this.assertTemplateModulo(body.modulo);
    const tenantId = requireTenantId(user);
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { metadata: true },
    });
    if (!tenant) throw new BadRequestException("Tenant não encontrado.");

    const clean: Record<string, TenantTemplateEntry> = {};
    for (const [id, entry] of Object.entries(body.templates ?? {})) {
      if (!isAllowedTemplateId(modulo, id)) continue;
      if (!entry || typeof entry.conteudo !== "string") continue;
      const isCustom = isCustomTemplateId(id) || entry.custom === true;
      if (isCustom && !isCustomTemplateId(id)) continue;
      clean[id] = {
        conteudo: entry.conteudo.slice(0, 200_000),
        ...(typeof entry.nome === "string" && entry.nome.trim()
          ? { nome: entry.nome.trim().slice(0, 200) }
          : {}),
        ...(isCustom ? { custom: true as const } : {}),
        ...(entry.formato === "texto" || entry.formato === "html"
          ? { formato: entry.formato }
          : {}),
        ...(entry.logos?.length
          ? { logos: parseDocumentLogoPlacements(entry.logos) }
          : {}),
        updatedAt: new Date().toISOString(),
      };
    }

    const next = mergeTenantDocumentTemplates(tenant.metadata, modulo, clean);
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { metadata: next as Prisma.InputJsonValue },
    });

    void this.audit.log({
      actorType: "TENANT_USER",
      actorId: user.sub,
      action: "tenant.document_templates.update",
      resourceType: "tenant",
      resourceId: tenantId,
      targetTenantId: tenantId,
      payload: { modulo, count: Object.keys(clean).length },
    });

    return { sucesso: true, modulo, templates: clean };
  }

  async getModuleLogos(user: RequestUser, moduloRaw: string) {
    const modulo = this.assertTemplateModulo(moduloRaw);
    const tenantId = requireTenantId(user);
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { metadata: true },
    });
    if (!tenant) throw new BadRequestException("Tenant não encontrado.");
    return { modulo, logos: getModuloLogos(tenant.metadata, modulo) };
  }

  async uploadModuleLogo(user: RequestUser, moduloRaw: string, file: Express.Multer.File, nomeRaw?: string) {
    const modulo = this.assertTemplateModulo(moduloRaw);
    const tenantId = requireTenantId(user);
    if (!file?.buffer?.length) {
      throw new BadRequestException("Ficheiro em falta.");
    }
    const allowed = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException("Formato inválido. Use PNG, JPEG, WebP ou SVG.");
    }
    const nome = (nomeRaw?.trim() || file.originalname || "Logo").slice(0, 120);
    const ext =
      file.mimetype === "image/png"
        ? "png"
        : file.mimetype === "image/jpeg"
          ? "jpg"
          : file.mimetype === "image/webp"
            ? "webp"
            : "svg";
    const logoId = slugifyModuleLogoId(nome);
    const key = `tenants/${tenantId}/module-logos/${modulo}/${logoId}.${ext}`;
    await this.storage.putObject(key, file.buffer, file.mimetype);

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { metadata: true },
    });
    if (!tenant) throw new BadRequestException("Tenant não encontrado.");

    const current = getModuloLogos(tenant.metadata, modulo);
    const asset: ModuleLogoAsset = {
      id: logoId,
      nome,
      storageKey: key,
      createdAt: new Date().toISOString(),
    };
    const next = mergeTenantModuleLogos(tenant.metadata, modulo, [...current, asset]);
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { metadata: next as Prisma.InputJsonValue },
    });

    return { sucesso: true, logo: asset };
  }

  async deleteModuleLogo(user: RequestUser, moduloRaw: string, logoId: string) {
    const modulo = this.assertTemplateModulo(moduloRaw);
    const tenantId = requireTenantId(user);
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { metadata: true },
    });
    if (!tenant) throw new BadRequestException("Tenant não encontrado.");

    const current = getModuloLogos(tenant.metadata, modulo);
    const hit = current.find((l) => l.id === logoId);
    if (!hit) throw new NotFoundException("Logótipo não encontrado.");

    await this.storage.deleteObject(hit.storageKey).catch(() => undefined);
    const next = mergeTenantModuleLogos(
      tenant.metadata,
      modulo,
      current.filter((l) => l.id !== logoId),
    );
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { metadata: next as Prisma.InputJsonValue },
    });
    return { sucesso: true };
  }

  async streamModuleLogo(user: RequestUser, moduloRaw: string, logoId: string) {
    const modulo = this.assertTemplateModulo(moduloRaw);
    const tenantId = requireTenantId(user);
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { metadata: true },
    });
    if (!tenant) throw new BadRequestException("Tenant não encontrado.");
    const hit = getModuloLogos(tenant.metadata, modulo).find((l) => l.id === logoId);
    if (!hit) return null;
    return this.storage.getObject(hit.storageKey);
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
