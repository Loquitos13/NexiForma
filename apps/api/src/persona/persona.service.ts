import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "../common/tenant-scope";
import { PersonaApiClient, PersonaApiError } from "./persona-api.client";
import { PersonaDocumentSyncService } from "./persona-document-sync.service";
import { ExternalServiceEventService } from "../common/external-service-event.service";

@Injectable()
export class PersonaService {
  private readonly logger = new Logger(PersonaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly personaApi: PersonaApiClient,
    private readonly documentSync: PersonaDocumentSyncService,
    private readonly externalEvents: ExternalServiceEventService,
  ) {}

  getPublicConfig() {
    const enabled = this.personaApi.isEnabled();
    return {
      enabled,
      environmentId: this.config.get<string>("PERSONA_ENVIRONMENT_ID")?.trim() || null,
    };
  }

  private assertEnabled() {
    if (!this.personaApi.isEnabled()) {
      throw new ServiceUnavailableException(
        "Verificação Persona não configurada (PERSONA_API_KEY).",
      );
    }
  }

  private roleKind(user: RequestUser): "formando" | "formador" {
    if (user.role === "formando") return "formando";
    if (user.role === "formador") return "formador";
    throw new ForbiddenException("Apenas formandos e formadores podem verificar identidade.");
  }

  private async resolveProfile(user: RequestUser) {
    const tenantId = requireTenantId(user);
    const roleKind = this.roleKind(user);
    if (roleKind === "formando") {
      const profile = await this.prisma.formandoProfile.findFirst({
        where: { tenantId, userId: user.sub },
        select: { id: true },
      });
      if (!profile) throw new NotFoundException("Perfil de formando não encontrado.");
      return { tenantId, roleKind, formandoId: profile.id, formadorId: null as string | null };
    }
    const profile = await this.prisma.formadorProfile.findFirst({
      where: { tenantId, userId: user.sub },
      select: { id: true },
    });
    if (!profile) throw new NotFoundException("Perfil de formador não encontrado.");
    return { tenantId, roleKind, formandoId: null, formadorId: profile.id };
  }

  async createInquiry(user: RequestUser) {
    this.assertEnabled();
    const { tenantId, roleKind, formandoId, formadorId } = await this.resolveProfile(user);
    const templateId = this.personaApi.templateIdForRole(roleKind);
    if (!templateId) {
      throw new BadRequestException(
        `Template Persona em falta (PERSONA_TEMPLATE_ID_${roleKind.toUpperCase()}).`,
      );
    }

    const referenceId = `${tenantId}:${user.sub}:${Date.now()}`;

    let created;
    try {
      created = await this.personaApi.createInquiry(templateId, referenceId);
    } catch (err) {
      throw this.mapPersonaApiError(err, tenantId);
    }

    try {
      await this.prisma.personaInquiry.create({
        data: {
          tenantId,
          userId: user.sub,
          roleKind,
          formandoId,
          formadorId,
          personaInquiryId: created.inquiryId,
          status: "created",
          personaStatus: created.status,
        },
      });
    } catch (err) {
      this.logger.error(
        `Falha ao guardar persona_inquiry ${created.inquiryId}`,
        err instanceof Error ? err.stack : String(err),
      );
      throw new InternalServerErrorException(
        "Verificação Persona iniciada mas não foi possível registar na plataforma. Confirme que a migration persona_inquiries foi aplicada.",
      );
    }

    return {
      inquiryId: created.inquiryId,
      sessionToken: created.sessionToken,
      status: created.status,
    };
  }

  private mapPersonaApiError(
    err: unknown,
    tenantId?: string,
  ): BadGatewayException | BadRequestException | ServiceUnavailableException | InternalServerErrorException {
    if (!(err instanceof PersonaApiError)) {
      return new InternalServerErrorException(
        err instanceof Error ? err.message : "Erro Persona inesperado.",
      );
    }
    if (err.status >= 500 || err.status === 401 || err.status === 403) {
      this.externalEvents.recordError({
        service: "persona",
        tenantId,
        code: `HTTP_${err.status}`,
        message: err.message,
      });
    }
    if (err.status === 401 || err.status === 403) {
      return new ServiceUnavailableException(
        "Chave Persona inválida ou sem permissões para criar verificações.",
      );
    }
    if (err.status === 404) {
      return new BadRequestException(
        "Template Persona não encontrado. Verifique PERSONA_TEMPLATE_ID_FORMANDO / FORMADOR.",
      );
    }
    if (err.status === 400) {
      return new BadRequestException(err.message);
    }
    return new BadGatewayException(err.message);
  }

  async getLatestInquiry(user: RequestUser) {
    const tenantId = requireTenantId(user);
    this.roleKind(user);
    const row = await this.prisma.personaInquiry.findFirst({
      where: { tenantId, userId: user.sub },
      orderBy: { createdAt: "desc" },
      select: {
        personaInquiryId: true,
        status: true,
        personaStatus: true,
        syncedAt: true,
        extractedName: true,
        createdAt: true,
      },
    });
    return row ?? null;
  }

  async syncInquiry(user: RequestUser, personaInquiryId: string, forceRegenerate = false) {
    this.assertEnabled();
    const { tenantId, roleKind, formandoId, formadorId } = await this.resolveProfile(user);
    const row = await this.prisma.personaInquiry.findFirst({
      where: { tenantId, userId: user.sub, personaInquiryId },
    });
    if (!row) throw new NotFoundException("Verificação Persona não encontrada.");

    try {
      const result = await this.documentSync.syncFromPersonaInquiry({
        tenantId,
        userId: user.sub,
        roleKind,
        formandoId,
        formadorId,
        personaInquiryId,
      });

      return {
        ok: true,
        inquiryId: personaInquiryId,
        ...result,
      };
    } catch (err) {
      throw this.mapPersonaApiError(err, tenantId);
    }
  }

  async handleWebhookEvent(body: Record<string, unknown>) {
    this.assertEnabled();
    const data = body.data as { id?: string; attributes?: Record<string, unknown> } | undefined;
    const personaInquiryId =
      (data?.id as string | undefined) ??
      (body["inquiry-id"] as string | undefined) ??
      extractInquiryIdFromPayload(body);

    if (!personaInquiryId) return { ok: true, handled: false };

    const row = await this.prisma.personaInquiry.findFirst({
      where: { personaInquiryId },
    });
    if (!row) return { ok: true, handled: false, reason: "unknown_inquiry" };

    const eventName = String(
      (body.attributes as Record<string, unknown> | undefined)?.name ??
        body.name ??
        "",
    ).toLowerCase();

    const shouldSync =
      eventName.includes("completed") ||
      eventName.includes("approved") ||
      eventName.includes("passed");

    if (!shouldSync) {
      await this.prisma.personaInquiry.update({
        where: { id: row.id },
        data: {
          personaStatus: String(data?.attributes?.status ?? row.personaStatus ?? ""),
          status: "pending",
        },
      });
      return { ok: true, handled: true, synced: false };
    }

    const result = await this.documentSync.syncFromPersonaInquiry({
      tenantId: row.tenantId,
      userId: row.userId,
      roleKind: row.roleKind as "formando" | "formador",
      formandoId: row.formandoId,
      formadorId: row.formadorId,
      personaInquiryId,
    });

    return { ok: true, handled: true, ...result };
  }
}

function extractInquiryIdFromPayload(body: Record<string, unknown>): string | null {
  const payload = body.payload as Record<string, unknown> | undefined;
  const nested = payload?.data as { id?: string } | undefined;
  return nested?.id ?? null;
}
