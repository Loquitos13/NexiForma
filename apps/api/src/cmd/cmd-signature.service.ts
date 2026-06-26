import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "../common/tenant-scope";

export type CmdSignatureMode = "disabled" | "oauth";

type CmdPendingMeta = {
  cmdPending: {
    processId: string;
    confirmTokenHash: string;
    expiresAt: string;
    initiatedBy: string;
  };
};

type CmdSignedMeta = {
  provider: "cmd";
  mode: CmdSignatureMode;
  processId: string;
  assinanteNif: string;
  assinanteNome: string;
  signedAt: string;
  certificateRef?: string;
};

@Injectable()
export class CmdSignatureService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  getConfig() {
    const mode = this.mode();
    return {
      mode,
      configured: mode === "oauth",
      oauthUrl: mode === "oauth" ? (this.config.get<string>("CMD_OAUTH_URL") ?? null) : null,
    };
  }

  async iniciarAssinaturaSumario(user: RequestUser, sumarioId: string) {
    const mode = this.mode();
    if (mode !== "oauth") {
      throw new ServiceUnavailableException(
        "Assinatura CMD não configurada - configure CMD_SIGNATURE_MODE=oauth e CMD_OAUTH_URL.",
      );
    }

    const oauthUrl = this.config.get<string>("CMD_OAUTH_URL")?.trim();
    if (!oauthUrl) {
      throw new ServiceUnavailableException("CMD_OAUTH_URL em falta.");
    }

    const tenantId = requireTenantId(user);
    const sumario = await this.prisma.sumario.findFirst({
      where: { id: sumarioId, tenantId },
    });
    if (!sumario) {
      throw new NotFoundException("Sumário não encontrado.");
    }
    if (sumario.imutavel) {
      throw new ConflictException("Sumário já assinado.");
    }

    const meta = sumario.assinaturaMetadata as CmdPendingMeta | null;
    if (meta?.cmdPending) {
      throw new ConflictException("Já existe assinatura CMD pendente para este sumário.");
    }

    const processId = randomUUID();
    const confirmToken = randomUUID();
    const confirmTokenHash = createHash("sha256").update(confirmToken).digest("hex");
    const expiresAt = new Date(Date.now() + 15 * 60_000);

    const pendingMeta: CmdPendingMeta = {
      cmdPending: {
        processId,
        confirmTokenHash,
        expiresAt: expiresAt.toISOString(),
        initiatedBy: user.sub,
      },
    };

    await this.prisma.sumario.update({
      where: { id: sumarioId },
      data: { assinaturaMetadata: pendingMeta },
    });

    const authorizeUrl = `${oauthUrl.replace(/\/$/, "")}/oauth/authorize?processId=${processId}&sumarioId=${sumarioId}`;

    return {
      mode,
      processId,
      sumarioId,
      authorizeUrl,
      expiresAt: expiresAt.toISOString(),
      message: "Redirecciona para Autenticação.gov.pt (Chave Móvel Digital).",
    };
  }

  async confirmarAssinatura(input: {
    processId: string;
    confirmToken: string;
    sumarioId: string;
    assinanteNif: string;
    assinanteNome: string;
    certificateRef?: string;
  }) {
    if (this.mode() !== "oauth") {
      throw new ServiceUnavailableException("Assinatura CMD não activa.");
    }

    const sumario = await this.prisma.sumario.findFirst({
      where: { id: input.sumarioId },
    });
    if (!sumario) {
      throw new NotFoundException("Sumário não encontrado.");
    }
    if (sumario.imutavel) {
      throw new ConflictException("Sumário já assinado.");
    }

    const meta = sumario.assinaturaMetadata as CmdPendingMeta | null;
    const pending = meta?.cmdPending;
    if (!pending || pending.processId !== input.processId) {
      throw new BadRequestException("Processo CMD inválido ou expirado.");
    }
    if (new Date(pending.expiresAt) < new Date()) {
      throw new BadRequestException("Processo CMD expirado – reinicia a assinatura.");
    }

    const tokenHash = createHash("sha256").update(input.confirmToken).digest("hex");
    if (tokenHash !== pending.confirmTokenHash) {
      throw new BadRequestException("Token de confirmação inválido.");
    }

    const nif = input.assinanteNif.replace(/\D/g, "");
    if (nif.length !== 9) {
      throw new BadRequestException("NIF do assinante inválido.");
    }

    const signedMeta: CmdSignedMeta = {
      provider: "cmd",
      mode: "oauth",
      processId: input.processId,
      assinanteNif: nif,
      assinanteNome: input.assinanteNome.trim(),
      signedAt: new Date().toISOString(),
      certificateRef: input.certificateRef?.trim() || undefined,
    };

    const updated = await this.prisma.sumario.update({
      where: { id: input.sumarioId },
      data: {
        imutavel: true,
        assinadoEm: new Date(),
        assinaturaTipo: "cmd",
        assinaturaRef: `cmd:${input.processId}`,
        assinaturaMetadata: signedMeta,
      },
    });

    await this.audit.log({
      actorType: "TENANT_USER",
      actorId: pending.initiatedBy,
      action: "sumario.assinar.cmd",
      resourceType: "sumario",
      resourceId: input.sumarioId,
      targetTenantId: sumario.tenantId,
      payload: {
        processId: input.processId,
        assinanteNif: nif,
        mode: "oauth",
      },
    });

    return {
      success: true,
      sumarioId: updated.id,
      assinaturaTipo: updated.assinaturaTipo,
      assinadoEm: updated.assinadoEm,
      assinante: { nif, nome: input.assinanteNome.trim() },
      certificateRef: signedMeta.certificateRef,
    };
  }

  private mode(): CmdSignatureMode {
    const raw = (this.config.get<string>("CMD_SIGNATURE_MODE") ?? "disabled").toLowerCase();
    if (raw === "oauth") return "oauth";
    return "disabled";
  }
}
