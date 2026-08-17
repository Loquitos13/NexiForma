import {
  ConflictException,
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Matricula } from "@nexiforma/database";
import { getModuloLogos, resolverEmailNotificacaoFormando, type DocumentLogoPlacement } from "@nexiforma/shared";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import {
  emailPresencaEfectivoDeFormando,
  turmaExigeEmailPresenca,
} from "../common/formando-presenca.util";
import { FormadorScopeService } from "../common/formador-scope.service";
import { HtmlPdfExportService } from "../common/html-pdf-export.service";
import { opaqueStorageKey } from "../common/opaque-storage-key.util";
import { requireTenantId } from "../common/tenant-scope";
import { renderMatriculaDocumentHtml } from "../portal/document-render.util";
import { resolveAppPublicUrlForLinks } from "../common/app-public-url.util";
import { MailService } from "../mail/mail.service";
import { FormadorNotificacoesService } from "../notificacoes/formador-notificacoes.service";
import { EmailTemplates } from "../notificacoes/templates/email.templates";
import { StorageService } from "../storage/storage.service";
import { buildFormacaoTemplateContext } from "../portal/document-template-context.util";
import {
  isEmitivelTemplateId,
  templateLabelForId,
  templateModuloForId,
} from "../portal/tenant-document-pdf.util";
import type { CreateMatriculaDto } from "./dto/create-matricula.dto";
import type { UpdateMatriculaDto } from "./dto/update-matricula.dto";
import {
  labelMatriculaDoc,
  matriculaDocumentosSeedRows,
} from "../formandos/matricula-documentos.util";
import {
  resolveDocumentosPolitica,
  UNIVERSAL_DOC_OPTIONS,
} from "../formandos/documentos-politica.util";

@Injectable()
export class MatriculasService {
  private readonly logger = new Logger(MatriculasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
    private readonly formadorNotificacoes: FormadorNotificacoesService,
    private readonly formadorScope: FormadorScopeService,
    private readonly storage: StorageService,
    private readonly htmlPdf: HtmlPdfExportService,
  ) {}

  /** Lista matrículas de uma turma (gestor ou formador da acção - só leitura). */
  async listByTurma(user: RequestUser, turmaId: string) {
    const tenantId = requireTenantId(user);
    const turma = await this.prisma.turma.findFirst({
      where: { id: turmaId, tenantId },
      select: { acaoFormacaoId: true },
    });
    if (!turma) {
      throw new NotFoundException("Turma inexistente ou de outro tenant.");
    }
    await this.formadorScope.assertCanAccessAcao(user, turma.acaoFormacaoId);

    const rows = await this.prisma.matricula.findMany({
      where: { tenantId, turmaId },
      orderBy: { dataInscricao: "desc" },
      take: 200,
      select: {
        id: true,
        estado: true,
        dataInscricao: true,
        formando: {
          select: {
            id: true,
            nome: true,
            nif: true,
            email: true,
            emailPresenca: true,
            user: { select: { email: true } },
          },
        },
        turma: {
          select: { codigo: true, nome: true },
        },
      },
    });
    return rows.map((m) => ({
      ...m,
      formando: {
        ...m.formando,
        emailPresencaEfectivo: emailPresencaEfectivoDeFormando(m.formando),
      },
    }));
  }

  async create(user: RequestUser, dto: CreateMatriculaDto): Promise<Matricula> {
    const tenantId = requireTenantId(user);

    const turma = await this.prisma.turma.findFirst({
      where: { id: dto.turmaId, tenantId },
    });
    if (!turma) {
      throw new NotFoundException("Turma inexistente ou de outro tenant.");
    }

    const formando = await this.prisma.formandoProfile.findFirst({
      where: { id: dto.formandoId, tenantId },
      include: { user: { select: { email: true } } },
    });
    if (!formando) {
      throw new NotFoundException("Formando inexistente ou de outro tenant.");
    }

    const exigeEmail = await turmaExigeEmailPresenca(this.prisma, tenantId, dto.turmaId);
    const emailEfectivo = emailPresencaEfectivoDeFormando(formando);
    if (exigeEmail && !emailEfectivo) {
      throw new BadRequestException(
        "Esta turma tem formação online - define o email de presença no perfil do formando (ou conta NexiForma) antes de matricular.",
      );
    }

    const exists = await this.prisma.matricula.findFirst({
      where: {
        turmaId: dto.turmaId,
        formandoId: dto.formandoId,
      },
    });
    if (exists) {
      throw new ConflictException("Este formando já está matriculado nesta turma.");
    }

    const turmaCtx = await this.prisma.turma.findFirst({
      where: { id: dto.turmaId, tenantId },
      select: {
        codigo: true,
        acaoFormacao: {
          select: {
            id: true,
            titulo: true,
            codigoInterno: true,
            configuracaoMatricula: true,
            curso: { select: { configuracaoMatricula: true } },
          },
        },
      },
    });
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { metadata: true, legalName: true },
    });
    const politica = resolveDocumentosPolitica({
      tenantMetadata: tenant?.metadata,
      cursoConfig: turmaCtx?.acaoFormacao.curso.configuracaoMatricula,
      acaoConfig: turmaCtx?.acaoFormacao.configuracaoMatricula,
    });

    const matricula = await this.prisma.$transaction(async (tx) => {
      const created = await tx.matricula.create({
        data: {
          tenantId,
          turmaId: dto.turmaId,
          formandoId: dto.formandoId,
        },
      });
      await tx.matriculaDocumento.createMany({
        data: matriculaDocumentosSeedRows(
          tenantId,
          created.id,
          politica.inscricaoObrigatorios,
        ),
      });
      return created;
    });

    if (turmaCtx?.acaoFormacao) {
      void this.formadorNotificacoes.notifyMatriculaNova(tenantId, turmaCtx.acaoFormacao.id, {
        formandoNome: formando.nome,
        turmaCodigo: turmaCtx.codigo,
        acaoTitulo: turmaCtx.acaoFormacao.titulo,
      });

      void this.enviarEmailInscricaoFormando({
        formando,
        turmaCodigo: turmaCtx.codigo,
        acao: turmaCtx.acaoFormacao,
        entidadeFormadora: tenant?.legalName ?? "entidade formadora",
        documentosInscricao: politica.inscricaoObrigatorios.map(labelMatriculaDoc),
        documentosUniversais: politica.universaisObrigatorios.map(
          (id) => UNIVERSAL_DOC_OPTIONS.find((o) => o.id === id)?.label ?? id,
        ),
      }).catch((err) => {
        this.logger.warn(
          `Email inscrição formando: ${err instanceof Error ? err.message : err}`,
        );
      });
    }

    return matricula;
  }

  private async enviarEmailInscricaoFormando(params: {
    formando: {
      nome: string;
      email: string | null;
      user?: { email: string | null } | null;
    };
    turmaCodigo: string;
    acao: { codigoInterno: string; titulo: string };
    entidadeFormadora: string;
    documentosInscricao: string[];
    documentosUniversais: string[];
  }) {
    const to = resolverEmailNotificacaoFormando({
      emailContacto: params.formando.email,
      emailConta: params.formando.user?.email,
    });
    if (!to) return;

    const appUrl = resolveAppPublicUrlForLinks(this.config).replace(/\/$/, "");
    const acaoLabel = `${params.acao.codigoInterno} – ${params.acao.titulo}`;
    const tpl = EmailTemplates.formandoInscritoAcao({
      nomeFormando: params.formando.nome,
      acaoLabel,
      turmaCodigo: params.turmaCodigo,
      entidadeFormadora: params.entidadeFormadora,
      documentosInscricao: params.documentosInscricao,
      documentosUniversais: params.documentosUniversais,
      portalUrl: `${appUrl}/portal/formando`,
    });
    await this.mail.send({
      to,
      subject: tpl.subject,
      text: tpl.text,
      html: tpl.html,
    });
  }

  async updateEstado(user: RequestUser, id: string, dto: UpdateMatriculaDto) {
    const tenantId = requireTenantId(user);
    const matricula = await this.prisma.matricula.findFirst({
      where: { id, tenantId },
    });
    if (!matricula) {
      throw new NotFoundException("Matrícula não encontrada.");
    }
    return this.prisma.matricula.update({
      where: { id },
      data: { estado: dto.estado },
      select: {
        id: true,
        estado: true,
        formando: { select: { nome: true, nif: true } },
      },
    });
  }

  /** Pré-visualização HTML do documento mergeado (antes da emissão PDF). */
  async previewDocumentoHtml(
    user: RequestUser,
    matriculaId: string,
    templateId: string,
    opts?: { bodyHtmlOverride?: string; logoPlacements?: DocumentLogoPlacement[] },
  ): Promise<{
    html: string;
    bodyHtml: string;
    label: string;
    logoPlacements: DocumentLogoPlacement[];
    moduleLogos: ReturnType<typeof getModuloLogos>;
  }> {
    const ctx = await this.loadMatriculaDocumentContext(user, matriculaId, templateId);
    try {
      const rendered = await renderMatriculaDocumentHtml({
        metadata: ctx.tenant.metadata,
        modulo: ctx.modulo,
        templateId,
        context: ctx.context,
        storage: this.storage,
        bodyHtmlOverride: opts?.bodyHtmlOverride,
        logoPlacements: opts?.logoPlacements,
      });
      return {
        ...rendered,
        moduleLogos: getModuloLogos(ctx.tenant.metadata, ctx.modulo),
      };
    } catch (e) {
      if (e instanceof Error && e.message === "EMPTY_TEMPLATE") {
        throw new BadRequestException(
          `Template «${templateLabelForId(templateId, ctx.tenant.metadata)}» vazio. Configura o texto em Configurações → Templates de formação.`,
        );
      }
      throw e;
    }
  }

  /** Gera PDF a partir de template tenant (ex.: declaração de frequência) para uma inscrição. */
  async emitirDocumentoPdf(
    user: RequestUser,
    matriculaId: string,
    templateId: string,
    opts?: {
      anexar?: boolean;
      bodyHtmlOverride?: string;
      logoPlacements?: DocumentLogoPlacement[];
    },
  ): Promise<{ pdf: Buffer; filename: string; documentoId?: string }> {
    const ctx = await this.loadMatriculaDocumentContext(user, matriculaId, templateId);
    let rendered;
    try {
      rendered = await renderMatriculaDocumentHtml({
        metadata: ctx.tenant.metadata,
        modulo: ctx.modulo,
        templateId,
        context: ctx.context,
        storage: this.storage,
        bodyHtmlOverride: opts?.bodyHtmlOverride,
        logoPlacements: opts?.logoPlacements,
      });
    } catch (e) {
      if (e instanceof Error && e.message === "EMPTY_TEMPLATE") {
        throw new BadRequestException(
          `Template «${templateLabelForId(templateId, ctx.tenant.metadata)}» vazio. Configura o texto em Configurações → Templates de formação.`,
        );
      }
      throw e;
    }

    const pdf = await this.htmlPdf.htmlToPdfBuffer(rendered.html);
    const filename =
      `${rendered.label} - ${ctx.matricula.formando.nome}`.replace(/[\\/:*?"<>|]/g, "-") + ".pdf";

    let documentoId: string | undefined;
    if (opts?.anexar) {
      documentoId = await this.anexarDocumentoEmitido(user, {
        tenantId: ctx.tenantId,
        matriculaId: ctx.matricula.id,
        formandoId: ctx.matricula.formandoId,
        acaoFormacaoId: ctx.matricula.turma.acaoFormacaoId,
        categoria: templateId,
        filename,
        pdf,
      });
    }

    return { pdf, filename, documentoId };
  }

  private async loadMatriculaDocumentContext(
    user: RequestUser,
    matriculaId: string,
    templateId: string,
  ) {
    const tenantId = requireTenantId(user);
    if (!isEmitivelTemplateId(templateId)) {
      throw new BadRequestException("Tipo de documento inválido.");
    }
    const modulo = templateModuloForId(templateId);
    if (!modulo) {
      throw new BadRequestException("Tipo de documento inválido.");
    }

    const matricula = await this.prisma.matricula.findFirst({
      where: { id: matriculaId, tenantId },
      select: {
        id: true,
        formandoId: true,
        formando: { select: { nome: true } },
        turma: { select: { acaoFormacaoId: true } },
      },
    });
    if (!matricula) {
      throw new NotFoundException("Inscrição não encontrada.");
    }

    await this.formadorScope.assertCanAccessAcao(user, matricula.turma.acaoFormacaoId);

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { metadata: true },
    });

    const context = await buildFormacaoTemplateContext(this.prisma, tenantId, {
      matriculaId,
    });

    return { tenantId, tenant: { metadata: tenant?.metadata }, matricula, modulo, context };
  }

  private async anexarDocumentoEmitido(
    user: RequestUser,
    params: {
      tenantId: string;
      matriculaId: string;
      formandoId: string;
      acaoFormacaoId: string;
      categoria: string;
      filename: string;
      pdf: Buffer;
    },
  ): Promise<string> {
    const storageKey = opaqueStorageKey([
      "docs",
      params.tenantId,
      params.formandoId,
      params.matriculaId,
      params.categoria,
    ]);

    try {
      await this.storage.putObject(storageKey, params.pdf, "application/pdf");
      const doc = await this.prisma.$transaction(async (tx) => {
        const prev = await tx.documentoAnexo.findMany({
          where: {
            tenantId: params.tenantId,
            matriculaId: params.matriculaId,
            categoria: params.categoria,
          },
        });
        for (const p of prev) {
          await tx.documentoAnexo.delete({ where: { id: p.id } });
          await this.storage.deleteObject(p.storageKey).catch(() => undefined);
        }
        return tx.documentoAnexo.create({
          data: {
            tenantId: params.tenantId,
            matriculaId: params.matriculaId,
            formandoId: params.formandoId,
            acaoFormacaoId: params.acaoFormacaoId,
            categoria: params.categoria,
            lado: "unico",
            nome: params.filename,
            storageKey,
            mimeType: "application/pdf",
            tamanhoBytes: params.pdf.byteLength,
            createdByUserId: user.sub,
            visivelFormando: true,
            visivelFormador: true,
          },
          select: { id: true },
        });
      });
      return doc.id;
    } catch (err) {
      await this.storage.deleteObject(storageKey).catch(() => undefined);
      throw err;
    }
  }
}
