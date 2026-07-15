import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  normalizeSigoNif,
  parseSigoCertificadosList,
  resolverEmailNotificacaoFormando,
  type SigoCertificadoSyncResumo,
} from "@nexiforma/shared";
import type { SigoCertificadoEstado } from "@nexiforma/database";
import type { RequestUser } from "../auth/types/access-token-payload";
import { AuditService } from "../audit/audit.service";
import { requireTenantId } from "../common/tenant-scope";
import { NotificacoesExtendedService } from "../notificacoes/notificacoes-extended.service";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { interpolatePath, sigoHttpRequest, sigoHttpRequestBinary } from "./sigo-http.util";
import { SigoTenantConfigService } from "./sigo-tenant-config.service";
import { SigoAccessService } from "./sigo-access.service";

type MatriculaRow = {
  id: string;
  formando: {
    nome: string;
    nif: string | null;
    email: string | null;
    telefone: string | null;
    user: { email: string | null } | null;
  };
};

@Injectable()
export class SigoCertificatesService {
  private readonly logger = new Logger(SigoCertificatesService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly notificacoes: NotificacoesExtendedService,
    private readonly tenantConfig: SigoTenantConfigService,
    private readonly access: SigoAccessService,
  ) {}

  async listByAcao(user: RequestUser, acaoId: string): Promise<unknown> {
    const tenantId = requireTenantId(user);
    return this.prisma.sigoCertificadoFormando.findMany({
      where: { tenantId, acaoFormacaoId: acaoId },
      orderBy: [{ emitidoEm: "desc" }, { createdAt: "desc" }],
      include: {
        matricula: {
          select: {
            id: true,
            formando: { select: { nome: true, nif: true } },
          },
        },
      },
    });
  }

  async listBySubmissao(user: RequestUser, submissaoId: string): Promise<unknown> {
    const tenantId = requireTenantId(user);
    const sub = await this.prisma.sigoSubmissao.findFirst({
      where: { id: submissaoId, tenantId },
    });
    if (!sub) throw new NotFoundException("Submissão SIGO não encontrada.");

    return this.queryCertificadosSubmissao(tenantId, submissaoId);
  }

  private queryCertificadosSubmissao(tenantId: string, submissaoId: string) {
    return this.prisma.sigoCertificadoFormando.findMany({
      where: { tenantId, submissaoId },
      orderBy: [{ emitidoEm: "desc" }, { createdAt: "desc" }],
      include: {
        matricula: {
          select: {
            id: true,
            formando: { select: { nome: true, nif: true } },
          },
        },
      },
    });
  }

  async syncFromSubmissao(
    user: RequestUser,
    submissaoId: string,
    opts?: { forceDownload?: boolean },
  ): Promise<SigoCertificadoSyncResumo> {
    const tenantId = requireTenantId(user);
    await this.access.assertAcao(user, tenantId, "sincronizar");
    return this.syncForTenant(tenantId, submissaoId, { ...opts, actorId: user.sub });
  }

  async syncForTenant(
    tenantId: string,
    submissaoId: string,
    opts?: { forceDownload?: boolean; actorId?: string },
  ): Promise<SigoCertificadoSyncResumo> {
    const runtime = await this.tenantConfig.resolveRuntime(tenantId);
    if (runtime.mode === "disabled") {
      throw new ServiceUnavailableException("SIGO inactivo para esta entidade.");
    }

    const sub = await this.prisma.sigoSubmissao.findFirst({
      where: { id: submissaoId, tenantId },
      include: {
        acaoFormacao: { select: { codigoInterno: true, titulo: true } },
      },
    });
    if (!sub) throw new NotFoundException("Submissão SIGO não encontrada.");
    if (sub.estado !== "ACEITE") {
      throw new BadRequestException(
        "Só é possível sincronizar certificados quando a submissão está ACEITE pela SIGO.",
      );
    }

    const remotos = await this.fetchRemoteCertificados(tenantId, sub.referenceId);
    const matriculas = await this.loadMatriculasAcao(tenantId, sub.acaoFormacaoId);
    const matriculaByNif = this.indexMatriculasByNif(matriculas);
    const matriculaById = new Map(matriculas.map((m) => [m.id, m]));

    let associados = 0;
    let disponiveis = 0;
    let transferidos = 0;
    let pendentes = 0;
    let erros = 0;
    const notificar: MatriculaRow[] = [];

    for (const remoto of remotos) {
      const matricula =
        (remoto.matriculaId ? matriculaById.get(remoto.matriculaId) : undefined) ??
        (remoto.nif ? matriculaByNif.get(remoto.nif) : undefined);

      if (!matricula) {
        erros += 1;
        continue;
      }
      associados += 1;

      const estadoDb = this.mapEstado(remoto.estado);
      if (estadoDb === "DISPONIVEL") disponiveis += 1;
      if (estadoDb === "PENDENTE") pendentes += 1;
      if (estadoDb === "ERRO") erros += 1;

      const emitidoEm = remoto.emitidoEm ? new Date(remoto.emitidoEm) : null;
      const existing = await this.prisma.sigoCertificadoFormando.findUnique({
        where: {
          tenantId_matriculaId_sigoReferencia: {
            tenantId,
            matriculaId: matricula.id,
            sigoReferencia: remoto.referencia,
          },
        },
      });

      let storageKey = existing?.storageKey ?? null;
      let mimeType = existing?.mimeType ?? "application/pdf";
      let tamanhoBytes = existing?.tamanhoBytes ?? null;
      let syncErros: unknown = null;

      const shouldDownload =
        estadoDb === "DISPONIVEL" && (!storageKey || opts?.forceDownload === true);

      if (shouldDownload) {
        try {
          const file = await this.downloadRemoteCertificado(
            tenantId,
            sub.referenceId,
            remoto.referencia,
            remoto.downloadPath,
            remoto.nif,
          );
          const stored = await this.storage.putObject(
            `${tenantId}/sigo/certificados/${matricula.id}/${remoto.referencia}.pdf`,
            file.body,
            file.contentType,
          );
          storageKey = stored.key;
          mimeType = file.contentType;
          tamanhoBytes = stored.size;
          transferidos += 1;
          if (!existing?.storageKey) {
            notificar.push(matricula);
          }
        } catch (e) {
          syncErros = [{ mensagem: e instanceof Error ? e.message : String(e) }];
          erros += 1;
        }
      }

      await this.prisma.sigoCertificadoFormando.upsert({
        where: {
          tenantId_matriculaId_sigoReferencia: {
            tenantId,
            matriculaId: matricula.id,
            sigoReferencia: remoto.referencia,
          },
        },
        create: {
          tenantId,
          acaoFormacaoId: sub.acaoFormacaoId,
          matriculaId: matricula.id,
          submissaoId: sub.id,
          sigoReferencia: remoto.referencia,
          estado: storageKey ? "DISPONIVEL" : estadoDb,
          numeroCertificado: remoto.numeroCertificado,
          storageKey,
          mimeType,
          tamanhoBytes,
          emitidoEm,
          sincronizadoEm: new Date(),
          erros: syncErros ?? undefined,
        },
        update: {
          submissaoId: sub.id,
          estado: storageKey ? "DISPONIVEL" : estadoDb,
          numeroCertificado: remoto.numeroCertificado,
          storageKey,
          mimeType,
          tamanhoBytes,
          emitidoEm,
          sincronizadoEm: new Date(),
          erros: syncErros ?? undefined,
        },
      });
    }

    void this.notificarCertificadosSigo(notificar, sub.acaoFormacao);

    const certificados = await this.queryCertificadosSubmissao(tenantId, submissaoId);

    await this.audit.log({
      actorType: opts?.actorId && opts.actorId !== "system-cron" ? "TENANT_USER" : "SYSTEM",
      actorId: opts?.actorId ?? "system-cron",
      action: "sigo.certificados.sync",
      resourceType: "sigo_submissao",
      resourceId: submissaoId,
      targetTenantId: tenantId,
      payload: {
        totalRemotos: remotos.length,
        associados,
        disponiveis,
        transferidos,
      },
    });

    return {
      submissaoId,
      acaoFormacaoId: sub.acaoFormacaoId,
      referenceId: sub.referenceId,
      totalRemotos: remotos.length,
      associados,
      disponiveis,
      transferidos,
      pendentes,
      erros,
      certificados: certificados.map((c) => ({
        id: c.id,
        matriculaId: c.matriculaId,
        formandoNome: c.matricula.formando.nome,
        nif: c.matricula.formando.nif,
        estado: c.estado,
        numeroCertificado: c.numeroCertificado,
        emitidoEm: c.emitidoEm?.toISOString() ?? null,
        sincronizadoEm: c.sincronizadoEm?.toISOString() ?? null,
        temFicheiro: Boolean(c.storageKey),
      })),
    };
  }

  private async notificarCertificadosSigo(
    matriculas: MatriculaRow[],
    acao: { codigoInterno: string; titulo: string },
  ) {
    for (const m of matriculas) {
      const email = resolverEmailNotificacaoFormando({
        emailContacto: m.formando.email,
        emailConta: m.formando.user?.email,
      });
      if (!email) continue;
      try {
        await this.notificacoes.notificarCertificadoDisponivel(email, m.formando.nome, {
          nomeCurso: acao.titulo,
          codigoFormacao: acao.codigoInterno,
          telefone: m.formando.telefone ?? undefined,
        });
      } catch (err) {
        this.logger.warn(
          `Notificação certificado SIGO falhou (${m.formando.nome}): ${String(err)}`,
        );
      }
    }
  }

  async downloadStored(user: RequestUser, certificadoId: string) {
    const tenantId = requireTenantId(user);
    const row = await this.prisma.sigoCertificadoFormando.findFirst({
      where: { id: certificadoId, tenantId },
      include: {
        matricula: {
          select: {
            formando: { select: { nome: true, userId: true } },
          },
        },
      },
    });
    if (!row) throw new NotFoundException("Certificado SIGO não encontrado.");
    if (user.role === "formando" && row.matricula.formando.userId !== user.sub) {
      throw new ForbiddenException("Só podes descarregar o teu certificado SIGO.");
    }
    const pode = await this.access.podeDescarregarSigo(user, tenantId);
    if (!pode && user.role !== "formando") {
      throw new ForbiddenException("O teu perfil não pode descarregar certificados SIGO.");
    }
    if (!row.storageKey) {
      throw new BadRequestException("Certificado ainda não transferido da SIGO.");
    }

    const obj = await this.storage.getObject(row.storageKey);
    if (!obj) throw new NotFoundException("Ficheiro do certificado SIGO indisponível.");

    const safeName = row.matricula.formando.nome.replace(/[^\w.-]+/g, "_").slice(0, 48);
    const filename = `certificado-sigo-${safeName || row.sigoReferencia}.pdf`;

    return {
      buffer: obj.body,
      contentType: row.mimeType ?? obj.contentType,
      filename,
    };
  }

  private async fetchRemoteCertificados(tenantId: string, referenceId: string) {
    const runtime = await this.tenantConfig.resolveRuntime(tenantId);

    const pathTemplate =
      this.config.get<string>("SIGO_API_CERTIFICADOS_PATH") ??
      "/acoes/{referenceId}/certificados";
    const url = this.tenantConfig.buildUrl(
      runtime,
      interpolatePath(pathTemplate, { referenceId, certificadoId: "" }),
    );

    const res = await sigoHttpRequest(
      url,
      {
        method: "GET",
        headers: { authorization: `Bearer ${runtime.apiKey}`, accept: "application/json" },
      },
      { timeoutMs: this.timeoutMs(), maxRetries: this.maxRetries() },
    );

    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw new BadRequestException(
        `Listagem de certificados SIGO falhou (HTTP ${res.statusCode}).`,
      );
    }

    return parseSigoCertificadosList(res.json);
  }

  private async downloadRemoteCertificado(
    tenantId: string,
    referenceId: string,
    certificadoId: string,
    downloadPath: string | null,
    nif: string | null,
  ) {
    const runtime = await this.tenantConfig.resolveRuntime(tenantId);

    let url: string;
    if (downloadPath?.startsWith("http://") || downloadPath?.startsWith("https://")) {
      url = downloadPath;
    } else if (downloadPath?.startsWith("/")) {
      url = this.tenantConfig.buildUrl(runtime, downloadPath);
    } else {
      const template =
        this.config.get<string>("SIGO_API_CERTIFICADO_DOWNLOAD_PATH") ??
        "/certificados/{certificadoId}/download";
      url = this.tenantConfig.buildUrl(
        runtime,
        interpolatePath(template, {
          referenceId,
          certificadoId,
          nif: nif ?? "",
        }),
      );
    }

    const res = await sigoHttpRequestBinary(
      url,
      {
        method: "GET",
        headers: {
          authorization: `Bearer ${runtime.apiKey}`,
          accept: "application/pdf,application/octet-stream,*/*",
        },
      },
      { timeoutMs: this.timeoutMs(), maxRetries: this.maxRetries() },
    );

    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw new BadRequestException(
        `Download certificado SIGO falhou (HTTP ${res.statusCode}).`,
      );
    }

    return res;
  }

  private async loadMatriculasAcao(tenantId: string, acaoId: string): Promise<MatriculaRow[]> {
    return this.prisma.matricula.findMany({
      where: {
        tenantId,
        estado: { in: ["ATIVA", "CONCLUSAO"] },
        turma: { acaoFormacaoId: acaoId },
      },
      select: {
        id: true,
        formando: {
          select: {
            nome: true,
            nif: true,
            email: true,
            telefone: true,
            user: { select: { email: true } },
          },
        },
      },
    });
  }

  private indexMatriculasByNif(matriculas: MatriculaRow[]) {
    const map = new Map<string, MatriculaRow>();
    for (const m of matriculas) {
      const nif = normalizeSigoNif(m.formando.nif);
      if (nif) map.set(nif, m);
    }
    return map;
  }

  private mapEstado(estado: "DISPONIVEL" | "PENDENTE" | "INDISPONIVEL"): SigoCertificadoEstado {
    if (estado === "DISPONIVEL") return "DISPONIVEL";
    if (estado === "PENDENTE") return "PENDENTE";
    return "ERRO";
  }

  private timeoutMs() {
    return Number(this.config.get<string>("SIGO_API_TIMEOUT_MS") ?? "30000");
  }

  private maxRetries() {
    return Number(this.config.get<string>("SIGO_API_MAX_RETRIES") ?? "2");
  }
}
