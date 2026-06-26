import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { ProgressoModulo } from "@nexiforma/database";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "../common/tenant-scope";

type ScormMetadata = {
  scormVersion?: "1.2" | "2004";
  launchUrl?: string;
};

type CmiStore = Record<string, string>;

const LESSON_TO_PERCENT: Record<string, number> = {
  "not attempted": 0,
  incomplete: 25,
  browsed: 50,
  completed: 100,
  passed: 100,
  failed: 50,
};

@Injectable()
export class ScormService {
  constructor(private readonly prisma: PrismaService) {}

  async getLaunchContext(user: RequestUser, moduloId: string, matriculaId: string) {
    const tenantId = requireTenantId(user);
    await this.assertMatriculaAccess(user, matriculaId, tenantId);

    const modulo = await this.prisma.moduloConteudo.findFirst({
      where: { id: moduloId, tenantId, tipo: "SCORM", publicado: true },
    });
    if (!modulo) {
      throw new NotFoundException("Módulo SCORM não encontrado.");
    }

    const meta = (modulo.metadata ?? {}) as ScormMetadata;
    const launchUrl = meta.launchUrl ?? modulo.urlOuRef;
    if (!launchUrl) {
      throw new BadRequestException("Módulo SCORM sem URL de lançamento.");
    }

    const progresso = await this.prisma.progressoModulo.findUnique({
      where: { matriculaId_moduloId: { matriculaId, moduloId } },
    });
    const storedMeta = (progresso?.metadata ?? {}) as { cmi?: CmiStore };
    const cmi: CmiStore = { ...(storedMeta.cmi ?? {}) };
    if (progresso && !storedMeta.cmi) {
      if (progresso.percentual >= 100) {
        cmi["cmi.core.lesson_status"] = "completed";
        cmi["cmi.core.score.raw"] = String(progresso.pontuacao ?? 100);
      } else if (progresso.percentual > 0) {
        cmi["cmi.core.lesson_status"] = "incomplete";
        cmi["cmi.core.score.raw"] = String(progresso.pontuacao ?? progresso.percentual);
      }
    }

    return {
      moduloId,
      matriculaId,
      titulo: modulo.titulo,
      scormVersion: meta.scormVersion ?? "1.2",
      launchUrl,
      requiresAssetSession: Boolean((meta as { storagePrefix?: string }).storagePrefix),
      cmi,
      percentual: progresso?.percentual ?? 0,
    };
  }

  async commitCmi(
    user: RequestUser,
    moduloId: string,
    matriculaId: string,
    cmi: CmiStore,
  ): Promise<ProgressoModulo> {
    const tenantId = requireTenantId(user);
    await this.assertMatriculaAccess(user, matriculaId, tenantId);

    const modulo = await this.prisma.moduloConteudo.findFirst({
      where: { id: moduloId, tenantId, tipo: "SCORM", publicado: true },
    });
    if (!modulo) {
      throw new NotFoundException("Módulo SCORM não encontrado.");
    }

    const lessonStatus = (
      cmi["cmi.core.lesson_status"] ??
      cmi["cmi.completion_status"] ??
      ""
    )
      .toLowerCase()
      .trim();
    const successStatus = (cmi["cmi.core.lesson_status"] ?? cmi["cmi.success_status"] ?? "")
      .toLowerCase()
      .trim();

    let percentual = LESSON_TO_PERCENT[lessonStatus];
    if (percentual === undefined && successStatus === "passed") percentual = 100;
    if (percentual === undefined && successStatus === "failed") percentual = 50;
    if (percentual === undefined && cmi["cmi.core.score.raw"]) {
      percentual = Math.min(100, Number(cmi["cmi.core.score.raw"]));
    }
    if (percentual === undefined && cmi["cmi.score.scaled"]) {
      percentual = Math.min(100, Math.round(Number(cmi["cmi.score.scaled"]) * 100));
    }

    const scoreRaw = cmi["cmi.core.score.raw"] ?? cmi["cmi.score.raw"];
    const pontuacao = scoreRaw ? Math.min(100, Math.max(0, Number(scoreRaw))) : undefined;

    const pct = percentual ?? 0;
    const concluidoEm = pct >= 100 ? new Date() : null;
    const metadata = { cmi, committedAt: new Date().toISOString() };

    return this.prisma.progressoModulo.upsert({
      where: { matriculaId_moduloId: { matriculaId, moduloId } },
      create: {
        tenantId,
        matriculaId,
        moduloId,
        percentual: pct,
        pontuacao: pontuacao ?? null,
        tentativas: 1,
        concluidoEm,
        metadata,
      },
      update: {
        percentual: pct,
        pontuacao: pontuacao ?? undefined,
        tentativas: { increment: 1 },
        ultimaVisita: new Date(),
        metadata,
        ...(concluidoEm ? { concluidoEm } : {}),
      },
    });
  }

  private async assertMatriculaAccess(user: RequestUser, matriculaId: string, tenantId: string) {
    const matricula = await this.prisma.matricula.findFirst({
      where: { id: matriculaId, tenantId },
      include: { formando: { select: { userId: true } } },
    });
    if (!matricula) {
      throw new NotFoundException("Matrícula não encontrada.");
    }
    if (user.role === "formando" && matricula.formando.userId !== user.sub) {
      throw new ForbiddenException("Só podes aceder ao teu SCORM.");
    }
  }
}
