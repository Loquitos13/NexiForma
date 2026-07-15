import { randomBytes } from "crypto";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import * as argon2 from "argon2";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { MailService } from "../mail/mail.service";
import type { RequestUser } from "../auth/types/access-token-payload";

function tempPassword(): string {
  return randomBytes(9).toString("base64url").slice(0, 12);
}

@Injectable()
export class ControlPlaneTenantOpsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
  ) {}

  async searchUsers(tenantId: string, q: string) {
    const term = q.trim().toLowerCase();
    if (term.length < 2) return [];

    return this.prisma.user.findMany({
      where: {
        tenantId,
        OR: [
          { email: { contains: term, mode: "insensitive" } },
          { displayName: { contains: term, mode: "insensitive" } },
        ],
      },
      take: 30,
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        active: true,
        mustChangePassword: true,
        formandoProfile: { select: { id: true, nome: true } },
      },
    });
  }

  async resetUserPassword(
    actor: RequestUser,
    tenantId: string,
    userId: string,
    opts: { forceChangeOnLogin?: boolean; notifyEmail?: boolean; customPassword?: string },
    actorIp?: string,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, active: true },
      include: { tenant: { select: { slug: true, legalName: true } } },
    });
    if (!user) throw new NotFoundException("Utilizador não encontrado.");

    const plain = opts.customPassword?.trim() || tempPassword();
    if (plain.length < 8) {
      throw new BadRequestException("Password temporária deve ter pelo menos 8 caracteres.");
    }

    const passwordHash = await argon2.hash(plain, { type: argon2.argon2id });
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        mustChangePassword: opts.forceChangeOnLogin ?? true,
      },
    });

    await this.audit.log({
      actorType: "SUPERADMIN_USER",
      actorId: actor.sub,
      actorIp,
      action: "user.reset_password",
      resourceType: "user",
      resourceId: userId,
      targetTenantId: tenantId,
      targetUserId: userId,
      payload: { forceChangeOnLogin: opts.forceChangeOnLogin ?? true },
    });

    if (opts.notifyEmail) {
      const body = [
        `A equipa NexiForma redefiniu a sua password temporária.`,
        ``,
        `Entidade: ${user.tenant.legalName} (${user.tenant.slug})`,
        `Email: ${user.email}`,
        `Password temporária: ${plain}`,
        ``,
        opts.forceChangeOnLogin !== false
          ? "Será obrigado a definir uma nova password no primeiro login."
          : "Pode usar esta password até definir uma nova nas definições da conta.",
      ].join("\n");
      await this.mail.send({
        to: user.email,
        subject: `[${user.tenant.legalName}] Password temporária NexiForma`,
        text: body,
        html: body.replace(/\n/g, "<br>"),
      });
    }

    return {
      ok: true,
      userId,
      email: user.email,
      temporaryPassword: plain,
      forceChangeOnLogin: opts.forceChangeOnLogin ?? true,
      emailed: !!opts.notifyEmail,
    };
  }

  async listAcoes(tenantId: string) {
    return this.prisma.acaoFormacao.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        titulo: true,
        estado: true,
        inscricoesEstado: true,
        turmas: { select: { id: true, codigo: true, nome: true } },
      },
    });
  }

  async listTurmas(tenantId: string, acaoId?: string) {
    return this.prisma.turma.findMany({
      where: {
        tenantId,
        ...(acaoId ? { acaoFormacaoId: acaoId } : {}),
      },
      orderBy: { codigo: "asc" },
      take: 50,
      select: { id: true, codigo: true, nome: true, acaoFormacaoId: true },
    });
  }

  async createMatricula(
    actor: RequestUser,
    tenantId: string,
    dto: { turmaId: string; formandoId: string },
    actorIp?: string,
  ) {
    const turma = await this.prisma.turma.findFirst({
      where: { id: dto.turmaId, tenantId },
    });
    if (!turma) throw new NotFoundException("Turma não encontrada.");

    const formando = await this.prisma.formandoProfile.findFirst({
      where: { id: dto.formandoId, tenantId },
    });
    if (!formando) throw new NotFoundException("Formando não encontrado.");

    const exists = await this.prisma.matricula.findFirst({
      where: { turmaId: dto.turmaId, formandoId: dto.formandoId },
    });
    if (exists) {
      if (exists.estado !== "ATIVA") {
        const updated = await this.prisma.matricula.update({
          where: { id: exists.id },
          data: { estado: "ATIVA" },
        });
        return { ok: true, matriculaId: updated.id, reactivated: true };
      }
      throw new BadRequestException("Formando já matriculado nesta turma.");
    }

    const matricula = await this.prisma.matricula.create({
      data: { tenantId, turmaId: dto.turmaId, formandoId: dto.formandoId },
    });

    await this.audit.log({
      actorType: "SUPERADMIN_USER",
      actorId: actor.sub,
      actorIp,
      action: "matricula.create",
      resourceType: "matricula",
      resourceId: matricula.id,
      targetTenantId: tenantId,
    });

    return { ok: true, matriculaId: matricula.id };
  }

  async diagnoseFormandoAccess(
    tenantId: string,
    formandoId: string,
    turmaId?: string,
  ) {
    const formando = await this.prisma.formandoProfile.findFirst({
      where: { id: formandoId, tenantId },
      include: {
        user: { select: { id: true, email: true, active: true, role: true } },
        matriculas: {
          include: {
            turma: {
              select: {
                id: true,
                codigo: true,
                nome: true,
                acaoFormacao: { select: { id: true, titulo: true, inscricoesEstado: true } },
              },
            },
          },
        },
      },
    });
    if (!formando) throw new NotFoundException("Formando não encontrado.");

    const issues: string[] = [];
    const fixes: string[] = [];

    if (!formando.userId) {
      issues.push("Formando sem conta de utilizador ligada (userId).");
      fixes.push("Ligar conta User ao perfil de formando.");
    } else if (!formando.user?.active) {
      issues.push("Conta de utilizador inactiva.");
      fixes.push("Activar utilizador.");
    } else if (formando.user.role !== "FORMANDO") {
      issues.push(`Role incorrecta: ${formando.user.role} (esperado FORMANDO).`);
    }

    const matriculas = turmaId
      ? formando.matriculas.filter((m) => m.turmaId === turmaId)
      : formando.matriculas;

    if (!matriculas.length) {
      issues.push("Sem matrícula na turma/acção indicada.");
      fixes.push("Criar matrícula ATIVA na turma correcta.");
    }

    for (const m of matriculas) {
      if (m.estado !== "ATIVA") {
        issues.push(`Matrícula ${m.turma.codigo} com estado ${m.estado}.`);
        fixes.push("Reactivar matrícula para ATIVA.");
      }
      if (m.turma.acaoFormacao.inscricoesEstado === "FECHADAS") {
        issues.push(`Inscrições fechadas na acção ${m.turma.acaoFormacao.titulo}.`);
      }
    }

    let modulos = 0;
    const acaoId = matriculas[0]?.turma.acaoFormacao.id;
    if (turmaId && acaoId) {
      const acao = await this.prisma.acaoFormacao.findFirst({
        where: { id: acaoId, tenantId },
        select: { cursoId: true },
      });
      if (acao) {
        modulos = await this.prisma.moduloConteudo.count({
          where: { tenantId, cursoId: acao.cursoId, publicado: true },
        });
      }
    }

    if (turmaId && modulos === 0) {
      issues.push("Acção sem módulos de conteúdo publicados.");
      fixes.push("Verificar conteúdos LMS da acção de formação.");
    }

    return {
      formando: {
        id: formando.id,
        nome: formando.nome,
        email: formando.email,
        userId: formando.userId,
        userEmail: formando.user?.email ?? null,
      },
      matriculas: matriculas.map((m) => ({
        id: m.id,
        estado: m.estado,
        turma: m.turma.codigo,
        acao: m.turma.acaoFormacao.titulo,
      })),
      issues,
      fixes,
      healthy: issues.length === 0,
    };
  }

  async fixFormandoAccess(
    actor: RequestUser,
    tenantId: string,
    formandoId: string,
    opts: { turmaId?: string; linkUserId?: string },
    actorIp?: string,
  ) {
    const formando = await this.prisma.formandoProfile.findFirst({
      where: { id: formandoId, tenantId },
    });
    if (!formando) throw new NotFoundException("Formando não encontrado.");

    const actions: string[] = [];

    if (opts.linkUserId && !formando.userId) {
      const user = await this.prisma.user.findFirst({
        where: { id: opts.linkUserId, tenantId, role: "FORMANDO" },
      });
      if (!user) throw new BadRequestException("Utilizador FORMANDO inválido.");
      await this.prisma.formandoProfile.update({
        where: { id: formandoId },
        data: { userId: opts.linkUserId },
      });
      actions.push("user_linked");
    }

    if (opts.turmaId) {
      const matricula = await this.prisma.matricula.findFirst({
        where: { formandoId, turmaId: opts.turmaId, tenantId },
      });
      if (matricula && matricula.estado !== "ATIVA") {
        await this.prisma.matricula.update({
          where: { id: matricula.id },
          data: { estado: "ATIVA" },
        });
        actions.push("matricula_reactivated");
      } else if (!matricula) {
        const created = await this.prisma.matricula.create({
          data: { tenantId, turmaId: opts.turmaId, formandoId },
        });
        actions.push(`matricula_created:${created.id}`);
      }
    }

    await this.audit.log({
      actorType: "SUPERADMIN_USER",
      actorId: actor.sub,
      actorIp,
      action: "formando.fix_access",
      resourceType: "formando",
      resourceId: formandoId,
      targetTenantId: tenantId,
      payload: { actions, opts },
    });

    return {
      ok: true,
      actions,
      diagnosis: await this.diagnoseFormandoAccess(tenantId, formandoId, opts.turmaId),
    };
  }
}
