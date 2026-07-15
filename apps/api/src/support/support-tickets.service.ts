import { Injectable, Logger, NotFoundException, ForbiddenException } from "@nestjs/common";
import { isTenantManager } from "@nexiforma/shared";
import { ConfigService } from "@nestjs/config";
import { randomBytes } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { MailService } from "../mail/mail.service";
import {
  decryptSupportTicketPayload,
  encryptSupportTicketPayload,
  type SupportTicketPayload,
} from "../common/support-ticket-crypto.util";
import type { RequestUser } from "../auth/types/access-token-payload";
import type { CreateSupportTicketDto, UpdateSupportTicketDto } from "./dto/support.dto";

function ticketRef(): string {
  const n = randomBytes(4).toString("hex").toUpperCase();
  return `ST-${n}`;
}

@Injectable()
export class SupportTicketsService {
  private readonly logger = new Logger(SupportTicketsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  private encryptionKey(): string {
    return (
      this.config.get<string>("SUPPORT_TICKET_ENCRYPTION_KEY") ??
      this.config.get<string>("PASSWORD_RESET_ENCRYPTION_KEY") ??
      ""
    );
  }

  async create(
    dto: CreateSupportTicketDto,
    reporter?: Pick<RequestUser, "sub" | "email" | "role" | "tenantId" | "tenantSlug">,
  ) {
    const slug = dto.slug.trim().toLowerCase();
    const email = dto.email.trim().toLowerCase();
    const tenant = await this.prisma.tenant.findUnique({ where: { slug } });

    let reporterMeta: Pick<SupportTicketPayload, "userId" | "role" | "displayName"> | undefined;
    if (reporter) {
      const profile = await this.prisma.user.findUnique({
        where: { id: reporter.sub },
        select: { displayName: true },
      });
      reporterMeta = {
        userId: reporter.sub,
        role: reporter.role,
        displayName: profile?.displayName?.trim() || reporter.email,
      };
    }

    const payload: SupportTicketPayload = {
      email,
      slug,
      subject: dto.subject.trim(),
      body: dto.body.trim(),
      ...(reporterMeta ?? {}),
    };

    const payloadEnc = encryptSupportTicketPayload(payload, this.encryptionKey());
    const ref = ticketRef();

    const row = await this.prisma.supportTicket.create({
      data: {
        ticketRef: ref,
        tenantId: tenant?.id ?? null,
        payloadEnc,
      },
    });

    await this.notifySuperadmins(ref, payload, tenant?.legalName ?? slug);

    return { ok: true, id: row.id, ticketRef: ref };
  }

  private async notifySuperadmins(
    ticketRef: string,
    payload: SupportTicketPayload,
    tenantName: string,
  ) {
    const admins = await this.prisma.platformUser.findMany({
      where: { active: true },
      select: { email: true },
    });
    if (!admins.length) {
      this.logger.warn("Sem platform_users activos para notificar ticket de suporte.");
      return;
    }

    const inbox =
      this.config.get<string>("PLATFORM_SUPPORT_EMAIL") ??
      admins[0]?.email;

    const text = [
      `Novo ticket de suporte (${ticketRef})`,
      "",
      `Tenant: ${tenantName} (${payload.slug})`,
      `Email: ${payload.email}`,
      ...(payload.userId ? [`User ID: ${payload.userId}`] : []),
      ...(payload.role ? [`Role: ${payload.role}`] : []),
      "",
      `Assunto: ${payload.subject}`,
      "",
      "Descrição:",
      payload.body,
      "",
      `Ver em: ${this.config.get<string>("APP_PUBLIC_URL") ?? ""}/plataforma/suporte`,
    ].join("\n");

    const html = text.replace(/\n/g, "<br>");

    for (const admin of admins) {
      try {
        await this.mail.send({
          to: admin.email,
          subject: `[NexiForma Suporte] ${ticketRef} - ${payload.subject}`,
          text,
          html,
        });
      } catch (err) {
        this.logger.warn(`Falha email ticket para ${admin.email}: ${String(err)}`);
      }
    }

    if (inbox && !admins.some((a) => a.email === inbox)) {
      await this.mail.send({
        to: inbox,
        subject: `[NexiForma Suporte] ${ticketRef} - ${payload.subject}`,
        text,
        html,
      });
    }
  }

  async listForPortalUser(user: RequestUser, limit = 50) {
    const tenantId = user.tenantId;
    if (!tenantId) return [];

    const isManager = isTenantManager(user.role);
    const email = user.email.trim().toLowerCase();
    const key = this.encryptionKey();

    const rows = await this.prisma.supportTicket.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 200),
    });

    const mapped = rows.map((r) => {
      const payload = decryptSupportTicketPayload(r.payloadEnc, key);
      const isOwn = payload.userId === user.sub || payload.email.trim().toLowerCase() === email;
      return {
        id: r.id,
        ticketRef: r.ticketRef,
        status: r.status,
        createdAt: r.createdAt,
        resolvedAt: r.resolvedAt,
        subject: payload.subject,
        bodyPreview: payload.body.slice(0, 240),
        submitter: {
          email: payload.email,
          displayName: payload.displayName?.trim() || payload.email,
          role: payload.role ?? null,
          userId: payload.userId ?? null,
        },
        isOwn,
      };
    });

    return isManager ? mapped : mapped.filter((t) => t.isOwn);
  }

  async getOneForPortalUser(user: RequestUser, id: string) {
    const tenantId = user.tenantId;
    if (!tenantId) throw new ForbiddenException("Sem tenant associado.");

    const row = await this.prisma.supportTicket.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException("Ticket não encontrado.");

    const payload = decryptSupportTicketPayload(row.payloadEnc, this.encryptionKey());
    const isManager = isTenantManager(user.role);
    const email = user.email.trim().toLowerCase();
    const isOwn = payload.userId === user.sub || payload.email.trim().toLowerCase() === email;
    if (!isManager && !isOwn) {
      throw new ForbiddenException("Sem acesso a este ticket.");
    }

    return {
      id: row.id,
      ticketRef: row.ticketRef,
      status: row.status,
      createdAt: row.createdAt,
      resolvedAt: row.resolvedAt,
      subject: payload.subject,
      body: payload.body,
      submitter: {
        email: payload.email,
        displayName: payload.displayName?.trim() || payload.email,
        role: payload.role ?? null,
        userId: payload.userId ?? null,
      },
      isOwn,
    };
  }

  async list(limit = 50) {
    const rows = await this.prisma.supportTicket.findMany({
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 200),
      include: { tenant: { select: { slug: true, legalName: true } } },
    });
    const key = this.encryptionKey();
    return rows.map((r) => {
      const payload = decryptSupportTicketPayload(r.payloadEnc, key);
      return {
        id: r.id,
        ticketRef: r.ticketRef,
        status: r.status,
        createdAt: r.createdAt,
        resolvedAt: r.resolvedAt,
        tenantId: r.tenantId,
        tenant: r.tenant
          ? { slug: r.tenant.slug, legalName: r.tenant.legalName }
          : { slug: payload.slug, legalName: null },
        email: payload.email,
        subject: payload.subject,
        bodyPreview: payload.body.slice(0, 240),
      };
    });
  }

  async getOne(id: string) {
    const row = await this.prisma.supportTicket.findUnique({
      where: { id },
      include: { tenant: { select: { slug: true, legalName: true } } },
    });
    if (!row) throw new NotFoundException("Ticket não encontrado.");
    const payload = decryptSupportTicketPayload(row.payloadEnc, this.encryptionKey());
    return {
      id: row.id,
      ticketRef: row.ticketRef,
      status: row.status,
      createdAt: row.createdAt,
      resolvedAt: row.resolvedAt,
      resolvedBy: row.resolvedBy,
      tenant: row.tenant,
      payload,
    };
  }

  async updateStatus(actor: RequestUser, id: string, dto: UpdateSupportTicketDto) {
    const resolved = dto.status === "RESOLVED" || dto.status === "CLOSED";
    const row = await this.prisma.supportTicket.update({
      where: { id },
      data: {
        status: dto.status,
        resolvedAt: resolved ? new Date() : null,
        resolvedBy: resolved ? actor.sub : null,
      },
    });
    return { ok: true, id: row.id, status: row.status };
  }
}
