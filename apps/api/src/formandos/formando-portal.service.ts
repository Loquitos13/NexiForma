import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import * as argon2 from "argon2";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { resolverEmailPresencaFormando, emailPresencaConfiguradoPeloGestor } from "@nexiforma/shared";
import { requireTenantId } from "../common/tenant-scope";
import { syncPasswordHashByEmail } from "../auth/shared-password.util";
import { StorageService } from "../storage/storage.service";
import { DocumentAccessAuditService } from "../audit/document-access-audit.service";
import { PortalNotificacoesService } from "../notificacoes/portal-notificacoes.service";
import { NotificacoesExtendedService } from "../notificacoes/notificacoes-extended.service";
import { isValidNifPt } from "../dossie-pedagogico/sigo-validation.util";
import type { UpdateFormandoMeDto } from "./dto/update-formando-me.dto";
import type { ChangeFormandoPasswordDto } from "./dto/change-formando-password.dto";
import type { FormandoMeResponse } from "./dto/formando-me.response";
import {
  avaliarDocumentosObrigatorios,
  FORMANDO_DOC_MAX_BYTES,
  FORMANDO_DOC_MIMES,
  FORMANDO_DOC_TIPOS,
  normalizarLadoDocumento,
} from "./formando-documentos.util";
import {
  ACAO_TEMPLATE_CATEGORIAS,
  isMatriculaDocCategoria,
  labelMatriculaDoc,
  type MatriculaDocCategoria,
} from "./matricula-documentos.util";
import { resolveDocumentosPolitica } from "./documentos-politica.util";
import { opaqueStorageKey } from "../common/opaque-storage-key.util";

@Injectable()
export class FormandoPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly documentAudit: DocumentAccessAuditService,
    private readonly portalNotificacoes: PortalNotificacoesService,
    private readonly notificacoes: NotificacoesExtendedService,
  ) {}

  private async requireProfile(user: RequestUser) {
    if (user.role !== "formando") {
      throw new ForbiddenException("Apenas formandos.");
    }
    const tenantId = requireTenantId(user);
    const profile = await this.prisma.formandoProfile.findFirst({
      where: { tenantId, userId: user.sub },
      include: { user: { select: { email: true } } },
    });
    if (!profile) {
      throw new NotFoundException("Perfil de formando não encontrado.");
    }
    return { tenantId, profile };
  }

  async getMe(user: RequestUser): Promise<FormandoMeResponse> {
    const { tenantId, profile } = await this.requireProfile(user);
    const account = await this.prisma.user.findFirst({
      where: { id: user.sub, tenantId },
      select: { email: true, displayName: true },
    });
    const [docs, tenant] = await Promise.all([
      this.prisma.documentoAnexo.findMany({
        where: { tenantId, formandoId: profile.id, matriculaId: null },
        select: { categoria: true, lado: true },
      }),
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { legalName: true, slug: true, metadata: true },
      }),
    ]);
    const politica = resolveDocumentosPolitica({ tenantMetadata: tenant?.metadata });
    const obrigatorios = avaliarDocumentosObrigatorios(docs, politica.universaisObrigatorios);

    return {
      id: profile.id,
      nome: profile.nome,
      nif: profile.nif,
      telefone: profile.telefone,
      email: account?.email ?? null,
      emailEditavel: false,
      emailPresencaReuniao: resolverEmailPresencaFormando({
        emailPresenca: profile.emailPresenca,
        emailConta: profile.user?.email ?? account?.email,
        emailContacto: profile.email,
      }),
      emailPresencaDefinidoPeloGestor: emailPresencaConfiguradoPeloGestor(profile.emailPresenca),
      tenantLegalName: tenant?.legalName ?? null,
      tenantSlug: tenant?.slug ?? null,
      documentosObrigatorios: obrigatorios,
    };
  }

  async updateMe(user: RequestUser, dto: UpdateFormandoMeDto) {
    const { tenantId, profile } = await this.requireProfile(user);

    if (dto.nif && !isValidNifPt(dto.nif.trim())) {
      throw new BadRequestException("NIF português inválido.");
    }

    if (dto.nif && dto.nif.trim() !== profile.nif) {
      const dup = await this.prisma.formandoProfile.findFirst({
        where: { tenantId, nif: dto.nif.trim(), NOT: { id: profile.id } },
      });
      if (dup) {
        throw new ConflictException("Já existe outro formando com esse NIF.");
      }
    }

    const updated = await this.prisma.formandoProfile.update({
      where: { id: profile.id },
      data: {
        ...(dto.nome !== undefined ? { nome: dto.nome.trim() } : {}),
        ...(dto.nif !== undefined ? { nif: dto.nif.trim() } : {}),
        ...(dto.telefone !== undefined ? { telefone: dto.telefone?.trim() || null } : {}),
      },
    });

    if (dto.nome !== undefined) {
      await this.prisma.user.update({
        where: { id: user.sub },
        data: { displayName: dto.nome.trim() },
      });
    }

    const account = await this.prisma.user.findFirst({
      where: { id: user.sub, tenantId },
      select: { email: true },
    });

    return {
      id: updated.id,
      nome: updated.nome,
      nif: updated.nif,
      telefone: updated.telefone,
      email: account?.email ?? null,
      emailEditavel: false,
    };
  }

  async changePassword(user: RequestUser, dto: ChangeFormandoPasswordDto) {
    const tenantId = requireTenantId(user);
    await this.requireProfile(user);

    const account = await this.prisma.user.findFirst({
      where: { id: user.sub, tenantId },
    });
    if (!account?.passwordHash) {
      throw new BadRequestException("Conta sem palavra-passe local.");
    }

    const ok = await argon2.verify(account.passwordHash, dto.currentPassword);
    if (!ok) {
      throw new UnauthorizedException("Palavra-passe actual incorrecta.");
    }

    const passwordHash = await argon2.hash(dto.newPassword, { type: argon2.argon2id });
    await syncPasswordHashByEmail(this.prisma, account.email, passwordHash);

    return { message: "Palavra-passe actualizada." };
  }

  async catalogo(user: RequestUser) {
    const { tenantId } = await this.requireProfile(user);

    const cursos = await this.prisma.curso.findMany({
      where: {
        tenantId,
        acoesFormacao: {
          some: { estado: { in: ["PLANEADA", "EM_CURSO"] } },
        },
      },
      orderBy: { designacao: "asc" },
      select: {
        id: true,
        codigoUfcd: true,
        designacao: true,
        cargaHoras: true,
        modalidade: true,
        objetivos: true,
        acoesFormacao: {
          where: { estado: { in: ["PLANEADA", "EM_CURSO"] } },
          orderBy: { dataInicio: "asc" },
          select: {
            id: true,
            codigoInterno: true,
            titulo: true,
            estado: true,
            dataInicio: true,
            dataFim: true,
          },
        },
      },
    });

    return cursos.filter((c) => c.acoesFormacao.length > 0);
  }

  async inscricoes(user: RequestUser) {
    const { tenantId, profile } = await this.requireProfile(user);

    const matriculas = await this.prisma.matricula.findMany({
      where: { tenantId, formandoId: profile.id },
      orderBy: { dataInscricao: "desc" },
      select: {
        id: true,
        estado: true,
        dataInscricao: true,
        turma: {
          select: {
            codigo: true,
            nome: true,
            acaoFormacao: {
              select: {
                id: true,
                codigoInterno: true,
                titulo: true,
                estado: true,
                dataInicio: true,
                dataFim: true,
                curso: {
                  select: {
                    id: true,
                    designacao: true,
                    codigoUfcd: true,
                    cargaHoras: true,
                    modalidade: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    return matriculas.map((m) => ({
      matriculaId: m.id,
      estado: m.estado,
      inscritoEm: m.dataInscricao,
      turma: `${m.turma.codigo} – ${m.turma.nome}`,
      acao: m.turma.acaoFormacao.titulo,
      acaoCodigo: m.turma.acaoFormacao.codigoInterno,
      acaoEstado: m.turma.acaoFormacao.estado,
      dataInicio: m.turma.acaoFormacao.dataInicio,
      dataFim: m.turma.acaoFormacao.dataFim,
      curso: m.turma.acaoFormacao.curso,
    }));
  }

  async listDocumentos(user: RequestUser) {
    const { tenantId, profile } = await this.requireProfile(user);
    return this.prisma.documentoAnexo.findMany({
      where: {
        tenantId,
        formandoId: profile.id,
        matriculaId: null,
        OR: [{ visivelFormando: true }, { createdByUserId: user.sub }],
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        nome: true,
        categoria: true,
        lado: true,
        mimeType: true,
        tamanhoBytes: true,
        createdAt: true,
      },
    });
  }

  async documentosObrigatorios(user: RequestUser) {
    const { tenantId, profile } = await this.requireProfile(user);
    const [docs, tenant] = await Promise.all([
      this.prisma.documentoAnexo.findMany({
        where: { tenantId, formandoId: profile.id, matriculaId: null },
        select: { categoria: true, lado: true },
      }),
      this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { metadata: true } }),
    ]);
    const politica = resolveDocumentosPolitica({ tenantMetadata: tenant?.metadata });
    return avaliarDocumentosObrigatorios(docs, politica.universaisObrigatorios);
  }

  async avisarLogoutDocumentosObrigatorios(user: RequestUser) {
    const { tenantId, profile } = await this.requireProfile(user);
    const resumo = await this.documentosObrigatorios(user);
    if (resumo.completo) {
      return { ok: true, avisado: false, emails: 0, destinatarios: 0 };
    }

    const account = await this.prisma.user.findFirst({
      where: { id: user.sub, tenantId },
      select: { email: true },
    });
    const linhas = resumo.items.filter((i) => !i.completo).map((i) => i.label);
    const portalPath = "/portal/formando/perfil?tab=documentos";

    const result = await this.notificacoes.notificarLogoutDocumentosObrigatoriosEmFalta(tenantId, {
      utilizadorUserId: user.sub,
      utilizadorNome: profile.nome.trim() || user.email || "Formando",
      roleKind: "formando",
      linhas,
      portalPath,
      emailConta: account?.email ?? user.email,
      emailContacto: profile.email,
    });

    return {
      ok: true,
      avisado: true,
      emails: result.emails,
      destinatarios: result.destinatarios,
      documentos: linhas.length,
    };
  }

  private async requireOwnMatricula(user: RequestUser, matriculaId: string) {
    const { tenantId, profile } = await this.requireProfile(user);
    const matricula = await this.prisma.matricula.findFirst({
      where: { id: matriculaId, tenantId, formandoId: profile.id },
      include: {
        turma: {
          select: {
            codigo: true,
            nome: true,
            acaoFormacao: {
              select: {
                id: true,
                codigoInterno: true,
                titulo: true,
                dataInicio: true,
                dataFim: true,
              },
            },
          },
        },
      },
    });
    if (!matricula) throw new NotFoundException("Inscrição não encontrada.");
    return { tenantId, profile, matricula };
  }

  async listMatriculaDocumentos(user: RequestUser, matriculaId: string) {
    const { tenantId, matricula } = await this.requireOwnMatricula(user, matriculaId);
    const acaoId = matricula.turma.acaoFormacao.id;

    const acaoFull = await this.prisma.acaoFormacao.findFirst({
      where: { id: acaoId, tenantId },
      select: {
        configuracaoMatricula: true,
        curso: { select: { configuracaoMatricula: true } },
      },
    });
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { metadata: true },
    });
    const politica = resolveDocumentosPolitica({
      tenantMetadata: tenant?.metadata,
      cursoConfig: acaoFull?.curso.configuracaoMatricula,
      acaoConfig: acaoFull?.configuracaoMatricula,
    });

    // Garantir linhas do checklist para as categorias exigidas nesta edição
    await this.prisma.matriculaDocumento.createMany({
      data: politica.inscricaoObrigatorios.map((categoria) => ({
        tenantId,
        matriculaId,
        categoria,
        estado: "pendente",
      })),
      skipDuplicates: true,
    });

    const [items, templates, universais] = await Promise.all([
      this.prisma.matriculaDocumento.findMany({
        where: { tenantId, matriculaId },
        include: {
          documentoAnexo: {
            select: {
              id: true,
              nome: true,
              mimeType: true,
              tamanhoBytes: true,
              createdAt: true,
            },
          },
        },
      }),
      this.prisma.documentoAnexo.findMany({
        where: {
          tenantId,
          acaoFormacaoId: acaoId,
          categoria: { in: Object.values(ACAO_TEMPLATE_CATEGORIAS) },
        },
        select: { id: true, categoria: true, nome: true, createdAt: true },
      }),
      this.prisma.documentoAnexo.findMany({
        where: { tenantId, formandoId: matricula.formandoId, matriculaId: null },
        select: { categoria: true, lado: true },
      }),
    ]);

    const byCat = new Map(items.map((i) => [i.categoria, i]));
    const templateByCat = new Map(
      templates.map((t) => [t.categoria, t] as const).filter(([c]) => !!c),
    );

    const checklist = politica.inscricaoObrigatorios.map((categoria, ordem) => {
      const row = byCat.get(categoria);
      const templateCat = ACAO_TEMPLATE_CATEGORIAS[categoria];
      const template = templateByCat.get(templateCat) ?? null;
      const estado = row?.estado ?? "pendente";
      const documentoGestor = row?.documentoAnexo ?? null;
      const documentoLeitura =
        documentoGestor ??
        (template
          ? {
              id: template.id,
              nome: template.nome,
              mimeType: "application/pdf",
              tamanhoBytes: null,
              createdAt: template.createdAt,
            }
          : null);
      const anterioresOk = politica.inscricaoObrigatorios
        .slice(0, ordem)
        .every((cat) => {
          const st = byCat.get(cat)?.estado ?? "pendente";
          return st === "aceite";
        });
      return {
        categoria,
        ordem,
        label: labelMatriculaDoc(categoria),
        estado,
        completo: estado === "aceite",
        aceiteEm: row?.aceiteEm ?? null,
        documento: documentoGestor,
        documentoLeitura,
        template: template
          ? { id: template.id, nome: template.nome, createdAt: template.createdAt }
          : null,
        disponivel: Boolean(documentoLeitura),
        podeAceitar: anterioresOk && Boolean(documentoLeitura) && estado !== "aceite",
        consentimentoObrigatorio: true,
      };
    });

    const univ = avaliarDocumentosObrigatorios(universais, politica.universaisObrigatorios);

    return {
      matriculaId,
      acao: matricula.turma.acaoFormacao,
      turma: { codigo: matricula.turma.codigo, nome: matricula.turma.nome },
      politica,
      documentosCurso: checklist,
      documentosUniversais: univ,
      completo:
        checklist.every((c) => c.completo) && univ.completo,
    };
  }

  async uploadMatriculaDocumento(
    _user: RequestUser,
    _matriculaId: string,
    _file: Express.Multer.File,
    _categoriaRaw?: string,
  ) {
    throw new BadRequestException(
      "Os documentos de inscrição são disponibilizados pela coordenação pedagógica. Leia e registe o consentimento na aplicação.",
    );
  }

  async aceitarMatriculaDocumento(
    user: RequestUser,
    matriculaId: string,
    categoriaRaw: string,
  ) {
    const { tenantId, matricula } = await this.requireOwnMatricula(user, matriculaId);
    const categoria = categoriaRaw.trim();
    if (!isMatriculaDocCategoria(categoria)) {
      throw new BadRequestException("Categoria de documento de inscrição inválida.");
    }

    const acaoFull = await this.prisma.acaoFormacao.findFirst({
      where: { id: matricula.turma.acaoFormacao.id, tenantId },
      select: {
        configuracaoMatricula: true,
        curso: { select: { configuracaoMatricula: true } },
      },
    });
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { metadata: true },
    });
    const politica = resolveDocumentosPolitica({
      tenantMetadata: tenant?.metadata,
      cursoConfig: acaoFull?.curso.configuracaoMatricula,
      acaoConfig: acaoFull?.configuracaoMatricula,
    });
    const ordem = politica.inscricaoObrigatorios.indexOf(categoria);
    if (ordem === -1) {
      throw new BadRequestException("Documento não exigido nesta inscrição.");
    }
    for (let i = 0; i < ordem; i += 1) {
      const prev = politica.inscricaoObrigatorios[i]!;
      const prevRow = await this.prisma.matriculaDocumento.findUnique({
        where: { matriculaId_categoria: { matriculaId, categoria: prev } },
      });
      if (prevRow?.estado !== "aceite") {
        throw new BadRequestException(
          `Deve aceitar primeiro «${labelMatriculaDoc(prev)}» antes de «${labelMatriculaDoc(categoria)}».`,
        );
      }
    }

    const item = await this.prisma.matriculaDocumento.findUnique({
      where: { matriculaId_categoria: { matriculaId, categoria } },
    });
    if (!item || item.tenantId !== tenantId) {
      throw new NotFoundException("Item documental da inscrição não encontrado.");
    }
    if (item.estado === "aceite") {
      return { categoria, estado: "aceite" as const, aceiteEm: item.aceiteEm };
    }

    const templateCat = ACAO_TEMPLATE_CATEGORIAS[categoria as MatriculaDocCategoria];
    const template = await this.prisma.documentoAnexo.findFirst({
      where: {
        tenantId,
        acaoFormacaoId: matricula.turma.acaoFormacao.id,
        categoria: templateCat,
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (!item.documentoAnexoId && !template) {
      throw new BadRequestException(
        "Documento ainda não disponível - a coordenação pedagógica irá publicá-lo em breve.",
      );
    }

    return this.prisma.matriculaDocumento.update({
      where: { id: item.id },
      data: { estado: "aceite", aceiteEm: new Date() },
      select: { categoria: true, estado: true, aceiteEm: true },
    });
  }

  async listDocumentoRequisicoes(user: RequestUser) {
    const { tenantId, profile } = await this.requireProfile(user);
    return this.prisma.documentoRequisicao.findMany({
      where: {
        tenantId,
        formandoId: profile.id,
        estado: { in: ["pendente", "submetido"] },
      },
      orderBy: [{ estado: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        titulo: true,
        descricao: true,
        estado: true,
        createdAt: true,
        submetidoEm: true,
        acaoFormacao: { select: { codigoInterno: true, titulo: true } },
        documentoAnexo: {
          select: { id: true, nome: true, mimeType: true, tamanhoBytes: true, createdAt: true },
        },
      },
    });
  }

  async uploadDocumentoRequisicao(
    user: RequestUser,
    requisicaoId: string,
    file: Express.Multer.File,
  ) {
    const { tenantId, profile } = await this.requireProfile(user);
    if (!file?.buffer?.length) {
      throw new BadRequestException("Ficheiro em falta.");
    }
    if (!FORMANDO_DOC_MIMES.has(file.mimetype)) {
      throw new BadRequestException("Formato inválido - use JPG, PNG ou PDF (máx. 10 MB).");
    }
    if (file.size > FORMANDO_DOC_MAX_BYTES) {
      throw new BadRequestException("Ficheiro demasiado grande (máx. 10 MB).");
    }

    const req = await this.prisma.documentoRequisicao.findFirst({
      where: { id: requisicaoId, tenantId, formandoId: profile.id },
    });
    if (!req) throw new NotFoundException("Requisição não encontrada.");
    if (req.estado === "cancelado") {
      throw new BadRequestException("Esta requisição foi cancelada.");
    }

    const storageKey = opaqueStorageKey(["docs", tenantId, "req", profile.id]);
    await this.storage.putObject(storageKey, file.buffer, file.mimetype);

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        if (req.documentoAnexoId) {
          const prev = await tx.documentoAnexo.findFirst({
            where: { id: req.documentoAnexoId, tenantId },
          });
          if (prev) {
            await tx.documentoAnexo.delete({ where: { id: prev.id } });
            await this.storage.deleteObject(prev.storageKey).catch(() => undefined);
          }
        }
        const doc = await tx.documentoAnexo.create({
          data: {
            tenantId,
            formandoId: profile.id,
            matriculaId: req.matriculaId,
            acaoFormacaoId: req.acaoFormacaoId,
            categoria: "outro",
            lado: "unico",
            nome: file.originalname,
            storageKey,
            mimeType: file.mimetype,
            tamanhoBytes: file.size,
            createdByUserId: user.sub,
            visivelFormando: true,
          },
        });
        return tx.documentoRequisicao.update({
          where: { id: req.id },
          data: {
            estado: "submetido",
            documentoAnexoId: doc.id,
            submetidoEm: new Date(),
          },
          select: {
            id: true,
            titulo: true,
            estado: true,
            submetidoEm: true,
            documentoAnexo: {
              select: { id: true, nome: true, mimeType: true, tamanhoBytes: true },
            },
          },
        });
      });

      void this.portalNotificacoes
        .notifyGestores(tenantId, {
          tipo: "documento_requisicao_submetido",
          titulo: "Documento submetido pelo formando",
          mensagem: `${profile.nome} enviou «${req.titulo}».`,
          link: "/portal/formandos",
        })
        .catch(() => undefined);

      return updated;
    } catch (err) {
      await this.storage.deleteObject(storageKey);
      throw err;
    }
  }

  async uploadDocumento(
    user: RequestUser,
    file: Express.Multer.File,
    categoria?: string,
    lado?: string,
  ) {
    const { tenantId, profile } = await this.requireProfile(user);

    if (!file?.buffer?.length) {
      throw new BadRequestException("Ficheiro em falta.");
    }
    if (!FORMANDO_DOC_MIMES.has(file.mimetype)) {
      throw new BadRequestException("Formato inválido - use JPG, PNG ou PDF (máx. 10 MB).");
    }
    if (file.size > FORMANDO_DOC_MAX_BYTES) {
      throw new BadRequestException("Ficheiro demasiado grande (máx. 10 MB).");
    }

    const cat = categoria?.trim();
    if (!cat || !FORMANDO_DOC_TIPOS.has(cat)) {
      throw new BadRequestException("Tipo de documento inválido.");
    }

    let ladoNorm: string;
    try {
      ladoNorm = normalizarLadoDocumento(cat, lado);
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : "Lado inválido.");
    }

    // Captura on-camera (CC/BI/carta) mantém-se só com imagens.
    if (
      (cat === "cc" || cat === "bi" || cat === "carta_conducao") &&
      file.mimetype === "application/pdf"
    ) {
      throw new BadRequestException("Para captura de cartão use JPG ou PNG (não PDF).");
    }

    const existing = await this.prisma.documentoAnexo.findFirst({
      where: {
        tenantId,
        formandoId: profile.id,
        matriculaId: null,
        categoria: cat,
        lado: ladoNorm,
      },
    });

    const storageKey = opaqueStorageKey(["docs", tenantId, "f", profile.id]);

    try {
      await this.storage.putObject(storageKey, file.buffer, file.mimetype);

      const created = await this.prisma.$transaction(async (tx) => {
        if (existing) {
          await tx.documentoAnexo.delete({ where: { id: existing.id } });
        }
        return tx.documentoAnexo.create({
          data: {
            tenantId,
            formandoId: profile.id,
            matriculaId: null,
            categoria: cat,
            lado: ladoNorm,
            nome: file.originalname,
            storageKey,
            mimeType: file.mimetype,
            tamanhoBytes: file.size,
            createdByUserId: user.sub,
            visivelFormando: true,
          },
          select: {
            id: true,
            nome: true,
            categoria: true,
            lado: true,
            mimeType: true,
            tamanhoBytes: true,
            createdAt: true,
          },
        });
      });

      if (existing) {
        await this.storage.deleteObject(existing.storageKey);
      }

      return created;
    } catch (err) {
      await this.storage.deleteObject(storageKey);
      throw err;
    }
  }

  private async assertCanAccessDocumento(
    tenantId: string,
    profileId: string,
    userId: string,
    docId: string,
  ) {
    const doc = await this.prisma.documentoAnexo.findFirst({
      where: { id: docId, tenantId },
    });
    if (!doc) throw new NotFoundException("Documento não encontrado.");
    if (doc.formandoId === profileId) {
      if (doc.visivelFormando || doc.createdByUserId === userId) return doc;
      throw new NotFoundException("Documento não encontrado.");
    }
    // Templates da acção em que o formando está matriculado
    if (doc.acaoFormacaoId && !doc.formandoId) {
      const mat = await this.prisma.matricula.findFirst({
        where: {
          tenantId,
          formandoId: profileId,
          turma: { acaoFormacaoId: doc.acaoFormacaoId },
        },
        select: { id: true },
      });
      if (mat) return doc;
    }
    void userId;
    throw new NotFoundException("Documento não encontrado.");
  }

  async downloadDocumento(user: RequestUser, id: string) {
    const { tenantId, profile } = await this.requireProfile(user);
    const doc = await this.assertCanAccessDocumento(tenantId, profile.id, user.sub, id);
    return {
      id: doc.id,
      nome: doc.nome,
      url: `/api/v1/formando-portal/documentos/${doc.id}/download`,
    };
  }

  async streamDocumento(user: RequestUser, id: string) {
    const { tenantId, profile } = await this.requireProfile(user);
    const doc = await this.assertCanAccessDocumento(tenantId, profile.id, user.sub, id);
    const obj = await this.storage.getObject(doc.storageKey);
    if (!obj) {
      throw new NotFoundException("Ficheiro não encontrado no armazenamento.");
    }
    await this.documentAudit.logDownload({
      user,
      tenantId,
      action: "document.download",
      resourceType: "DocumentoAnexo",
      resourceId: doc.id,
      channel: "stream",
      payload: { nome: doc.nome, formandoId: profile.id },
    });
    return {
      body: obj.body,
      contentType: doc.mimeType || obj.contentType,
      nome: doc.nome,
    };
  }
}
