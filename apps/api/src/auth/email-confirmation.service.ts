import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MailService } from "../mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";
import { resolveAppPublicUrlForLinks } from "../common/app-public-url.util";
import { EmailTemplates } from "../notificacoes/templates/email.templates";
import { normalizeAuthEmail } from "./tenant-auth-resolve.util";
import {
  EMAIL_CONFIRMATION_TTL_MS,
  emailConfirmationPepperFromConfig,
  hashEmailConfirmationToken,
  newEmailConfirmationOpaque,
} from "./email-confirmation.util";

@Injectable()
export class EmailConfirmationService {
  private readonly logger = new Logger(EmailConfirmationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  private pepper(): string {
    return emailConfirmationPepperFromConfig(
      (k) => this.config.get<string>(k),
      (k) => this.config.getOrThrow<string>(k),
    );
  }

  private ttlMs(): number {
    const hours = Number(this.config.get<string>("EMAIL_CONFIRM_TTL_HOURS") ?? "48");
    if (!Number.isFinite(hours) || hours < 1) return EMAIL_CONFIRMATION_TTL_MS;
    return Math.round(hours * 60 * 60 * 1000);
  }

  /** Emite token hashed + envia email. Idempotente se já estiver verificado. */
  async issueForUser(
    userId: string,
    req?: { headers: Record<string, string | string[] | undefined> },
  ): Promise<{ sent: boolean; confirmUrl?: string; alreadyVerified: boolean }> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId },
      include: { tenant: { select: { id: true, slug: true, legalName: true } } },
    });
    if (!user) {
      throw new BadRequestException("Utilizador não encontrado.");
    }
    if (user.emailVerifiedAt) {
      return { sent: false, alreadyVerified: true };
    }
    if (!user.active) {
      throw new BadRequestException("Conta inactiva - active o utilizador ou reenvie o convite.");
    }

    const pepper = this.pepper();
    const { raw, hash } = newEmailConfirmationOpaque(pepper);
    const expiresAt = new Date(Date.now() + this.ttlMs());

    await this.prisma.emailConfirmationToken.deleteMany({
      where: { userId: user.id, usedAt: null },
    });

    await this.prisma.emailConfirmationToken.create({
      data: {
        tokenHash: hash,
        userId: user.id,
        tenantId: user.tenantId,
        email: normalizeAuthEmail(user.email),
        expiresAt,
      },
    });

    const appUrl = resolveAppPublicUrlForLinks(this.config, req).replace(/\/$/, "");
    const confirmUrl = `${appUrl}/confirmar-email/${raw}`;
    const expiresHours = Math.max(1, Math.round(this.ttlMs() / (60 * 60 * 1000)));
    const tpl = EmailTemplates.confirmarEmail({
      nomeUtilizador: user.displayName,
      entidadeFormadora: user.tenant.legalName,
      confirmUrl,
      expiresHours,
    });

    await this.mail.send({
      to: user.email,
      subject: tpl.subject,
      text: tpl.text,
      html: tpl.html,
    });

    if (this.config.get<string>("NODE_ENV") !== "production") {
      this.logger.log(`[dev] email confirmation link: ${confirmUrl}`);
    }

    return {
      sent: true,
      alreadyVerified: false,
      confirmUrl: this.config.get<string>("NODE_ENV") === "production" ? undefined : confirmUrl,
    };
  }

  async confirmToken(rawToken: string): Promise<{
    ok: true;
    email: string;
    tenantSlug: string;
  }> {
    const token = rawToken?.trim();
    if (!token || token.length < 32) {
      throw new UnauthorizedException("Link de confirmação inválido ou expirado.");
    }

    const tokenHash = hashEmailConfirmationToken(this.pepper(), token);
    const row = await this.prisma.emailConfirmationToken.findUnique({
      where: { tokenHash },
    });
    if (!row || row.usedAt || row.expiresAt <= new Date()) {
      throw new UnauthorizedException("Link de confirmação inválido ou expirado.");
    }

    const email = normalizeAuthEmail(row.email);
    const user = await this.prisma.user.findFirst({
      where: { id: row.userId, tenantId: row.tenantId },
      include: { tenant: { select: { slug: true } } },
    });
    if (!user || normalizeAuthEmail(user.email) !== email) {
      throw new UnauthorizedException("Link de confirmação inválido ou expirado.");
    }

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { emailVerifiedAt: user.emailVerifiedAt ?? now },
      }),
      this.prisma.emailConfirmationToken.update({
        where: { id: row.id },
        data: { usedAt: now },
      }),
      this.prisma.emailConfirmationToken.deleteMany({
        where: { userId: user.id, usedAt: null, NOT: { id: row.id } },
      }),
    ]);

    return { ok: true, email: user.email, tenantSlug: user.tenant.slug };
  }

  /**
   * Reenvio público (email + slug). Resposta genérica para não enumerar contas.
   */
  async resendPublic(input: {
    email: string;
    tenantSlug: string;
    req?: { headers: Record<string, string | string[] | undefined> };
  }): Promise<{ message: string }> {
    const message =
      "Se existir uma conta por confirmar com estes dados, enviámos um novo email de confirmação.";
    const email = normalizeAuthEmail(input.email);
    const slug = input.tenantSlug.trim();
    if (!email || !slug) return { message };

    const user = await this.prisma.user.findFirst({
      where: {
        email,
        active: true,
        emailVerifiedAt: null,
        tenant: { slug },
      },
      select: { id: true },
    });
    if (!user) return { message };

    try {
      await this.issueForUser(user.id, input.req);
    } catch (err) {
      this.logger.warn(
        `resendPublic(${email}): ${err instanceof Error ? err.message : err}`,
      );
    }
    return { message };
  }

  async markVerified(userId: string): Promise<void> {
    await this.prisma.user.updateMany({
      where: { id: userId, emailVerifiedAt: null },
      data: { emailVerifiedAt: new Date() },
    });
    await this.prisma.emailConfirmationToken.deleteMany({
      where: { userId, usedAt: null },
    });
  }

  async clearVerification(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { emailVerifiedAt: null },
    });
    await this.prisma.emailConfirmationToken.deleteMany({
      where: { userId, usedAt: null },
    });
  }
}
