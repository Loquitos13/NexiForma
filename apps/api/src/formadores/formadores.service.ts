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
import { requireTenantId } from "../common/tenant-scope";
import { syncPasswordHashByEmail } from "../auth/shared-password.util";
import type { UpdateFormadorDto } from "./dto/update-formador.dto";
import type { UpdateFormadorMeDto } from "./dto/update-formador-me.dto";
import type { ChangeFormadorPasswordDto } from "./dto/change-formador-password.dto";
import type { CreateFormadorDto } from "./dto/create-formador.dto";
import { StorageService } from "../storage/storage.service";
import { DocumentAccessAuditService } from "../audit/document-access-audit.service";
import { opaqueStorageKey } from "../common/opaque-storage-key.util";
import {
  avaliarDocumentosObrigatoriosFormador,
  FORMADOR_DOC_MAX_BYTES,
  FORMADOR_DOC_MIMES,
  FORMADOR_DOC_TIPOS,
} from "./formador-documentos.util";
import { parseTenantDocumentosPolitica } from "../formandos/documentos-politica.util";
import { UsersService } from "../users/users.service";
import { ViesService } from "../vies/vies.service";
import { PortalNotificacoesService } from "../notificacoes/portal-notificacoes.service";

const FORMADOR_CONTACT_SELECT = {
  id: true,
  nomeCompleto: true,
  nif: true,
  email: true,
  emailPresenca: true,
  telefone: true,
  morada: true,
  ccNumero: true,
  ccpNumero: true,
  ccValidade: true,
  ccpValidade: true,
} as const;

export type FormadorAlerta = {
  id: string;
  nomeCompleto: string;
  nif: string;
  tipo: "cc" | "ccp";
  validade: string;
  diasRestantes: number;
  severidade: "critico" | "aviso";
};

@Injectable()
export class FormadoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly documentAudit: DocumentAccessAuditService,
    private readonly users: UsersService,
    private readonly vies: ViesService,
    private readonly portalNotificacoes: PortalNotificacoesService,
  ) {}

  async create(
    user: RequestUser,
    dto: CreateFormadorDto,
    req?: { headers: Record<string, string | string[] | undefined> },
  ) {
    const nif = dto.nif.trim();
    if (!/^\d{9}$/.test(nif)) {
      throw new BadRequestException("NIF inválido (9 dígitos).");
    }
    await this.vies.assertConfirmado(nif, "pessoa");

    return this.users.provisionNewFormadorAccount(
      user,
      {
        email: dto.email,
        displayName: dto.nomeCompleto.trim(),
        nif,
        telefone: dto.telefone,
        morada: dto.morada,
      },
      req,
    );
  }

  list(user: RequestUser) {
    const tenantId = requireTenantId(user);
    return this.prisma.formadorProfile.findMany({
      where: { tenantId },
      orderBy: { nomeCompleto: "asc" },
      select: {
        ...FORMADOR_CONTACT_SELECT,
        _count: { select: { sessoesFormacao: true, documentos: true } },
      },
    });
  }

  async getOne(user: RequestUser, id: string) {
    const tenantId = requireTenantId(user);
    const formador = await this.prisma.formadorProfile.findFirst({
      where: { id, tenantId },
      select: {
        ...FORMADOR_CONTACT_SELECT,
        createdAt: true,
        user: { select: { id: true, email: true, active: true } },
        _count: { select: { sessoesFormacao: true } },
      },
    });
    if (!formador) throw new NotFoundException("Formador não encontrado.");

    const documentos = await this.prisma.documentoAnexo.findMany({
      where: { tenantId, formadorId: id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        nome: true,
        categoria: true,
        lado: true,
        mimeType: true,
        tamanhoBytes: true,
        visivelFormador: true,
        createdByUserId: true,
        createdAt: true,
      },
    });

    const requisicoes = await this.prisma.documentoRequisicao.findMany({
      where: { tenantId, formadorId: id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        titulo: true,
        descricao: true,
        estado: true,
        createdAt: true,
        submetidoEm: true,
        documentoAnexo: {
          select: { id: true, nome: true, mimeType: true, tamanhoBytes: true, createdAt: true },
        },
      },
    });

    return { ...formador, documentos, requisicoes };
  }

  async getDocumentosObrigatorios(user: RequestUser, id: string) {
    const tenantId = requireTenantId(user);
    const formador = await this.prisma.formadorProfile.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!formador) throw new NotFoundException("Formador não encontrado.");

    const [docs, tenant] = await Promise.all([
      this.prisma.documentoAnexo.findMany({
        where: { tenantId, formadorId: id },
        select: { categoria: true },
      }),
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { metadata: true },
      }),
    ]);
    const politica = parseTenantDocumentosPolitica(tenant?.metadata);
    return avaliarDocumentosObrigatoriosFormador(docs, politica.universaisObrigatorios);
  }

  async update(user: RequestUser, id: string, dto: UpdateFormadorDto) {
    const tenantId = requireTenantId(user);
    const row = await this.prisma.formadorProfile.findFirst({ where: { id, tenantId } });
    if (!row) {
      throw new NotFoundException("Formador não encontrado.");
    }

    return this.prisma.formadorProfile.update({
      where: { id },
      data: {
        ...(dto.nomeCompleto !== undefined ? { nomeCompleto: dto.nomeCompleto.trim() } : {}),
        ...(dto.email !== undefined ? { email: dto.email.trim() } : {}),
        ...(dto.emailPresenca !== undefined
          ? { emailPresenca: dto.emailPresenca?.trim() || null }
          : {}),
        ...(dto.telefone !== undefined ? { telefone: dto.telefone?.trim() || null } : {}),
        ...(dto.morada !== undefined ? { morada: dto.morada?.trim() || null } : {}),
        ...(dto.ccNumero !== undefined ? { ccNumero: dto.ccNumero.trim() || null } : {}),
        ...(dto.ccpNumero !== undefined ? { ccpNumero: dto.ccpNumero.trim() || null } : {}),
        ...(dto.ccValidade !== undefined
          ? { ccValidade: dto.ccValidade ? new Date(dto.ccValidade) : null }
          : {}),
        ...(dto.ccpValidade !== undefined
          ? { ccpValidade: dto.ccpValidade ? new Date(dto.ccpValidade) : null }
          : {}),
      },
      select: FORMADOR_CONTACT_SELECT,
    });
  }

  async listAlertasCc(user: RequestUser, diasAntecedencia = 90): Promise<{ alertas: FormadorAlerta[] }> {
    const tenantId = requireTenantId(user);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const limite = new Date(now);
    limite.setDate(limite.getDate() + diasAntecedencia);

    const formadores = await this.prisma.formadorProfile.findMany({
      where: { tenantId },
      select: {
        id: true,
        nomeCompleto: true,
        nif: true,
        ccValidade: true,
        ccpValidade: true,
      },
    });

    const alertas: FormadorAlerta[] = [];

    for (const f of formadores) {
      for (const [tipo, validade] of [
        ["cc", f.ccValidade],
        ["ccp", f.ccpValidade],
      ] as const) {
        if (!validade) continue;
        const v = new Date(validade);
        if (v > limite) continue;
        const diasRestantes = Math.ceil((v.getTime() - now.getTime()) / 86400000);
        alertas.push({
          id: `${f.id}-${tipo}`,
          nomeCompleto: f.nomeCompleto,
          nif: f.nif,
          tipo,
          validade: v.toISOString().slice(0, 10),
          diasRestantes,
          severidade: diasRestantes <= 30 || diasRestantes < 0 ? "critico" : "aviso",
        });
      }
    }

    alertas.sort((a, b) => a.diasRestantes - b.diasRestantes);

    return { alertas };
  }

  private async requireOwnProfile(user: RequestUser) {
    if (user.role !== "formador") {
      throw new ForbiddenException("Apenas formadores.");
    }
    const tenantId = requireTenantId(user);
    const profile = await this.prisma.formadorProfile.findFirst({
      where: { tenantId, userId: user.sub },
      select: FORMADOR_CONTACT_SELECT,
    });
    if (!profile) throw new NotFoundException("Perfil de formador não encontrado.");
    return { tenantId, profile };
  }

  async getMe(user: RequestUser) {
    const { tenantId, profile } = await this.requireOwnProfile(user);
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { legalName: true },
    });
    return {
      ...profile,
      tenantLegalName: tenant?.legalName ?? null,
      emailEditavel: false,
    };
  }

  async updateMe(user: RequestUser, dto: UpdateFormadorMeDto) {
    const { profile } = await this.requireOwnProfile(user);
    return this.prisma.formadorProfile.update({
      where: { id: profile.id },
      data: {
        ...(dto.nomeCompleto !== undefined ? { nomeCompleto: dto.nomeCompleto.trim() } : {}),
        ...(dto.emailPresenca !== undefined
          ? { emailPresenca: dto.emailPresenca?.trim() || null }
          : {}),
        ...(dto.telefone !== undefined ? { telefone: dto.telefone?.trim() || null } : {}),
        ...(dto.morada !== undefined ? { morada: dto.morada?.trim() || null } : {}),
        ...(dto.ccNumero !== undefined ? { ccNumero: dto.ccNumero?.trim() || null } : {}),
        ...(dto.ccpNumero !== undefined ? { ccpNumero: dto.ccpNumero?.trim() || null } : {}),
        ...(dto.ccValidade !== undefined
          ? { ccValidade: dto.ccValidade ? new Date(dto.ccValidade) : null }
          : {}),
        ...(dto.ccpValidade !== undefined
          ? { ccpValidade: dto.ccpValidade ? new Date(dto.ccpValidade) : null }
          : {}),
      },
      select: FORMADOR_CONTACT_SELECT,
    });
  }

  async changePassword(user: RequestUser, dto: ChangeFormadorPasswordDto) {
    const tenantId = requireTenantId(user);
    await this.requireOwnProfile(user);

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

  async listMeDocumentos(user: RequestUser) {
    const { tenantId, profile } = await this.requireOwnProfile(user);
    return this.prisma.documentoAnexo.findMany({
      where: {
        tenantId,
        formadorId: profile.id,
        OR: [{ visivelFormador: true }, { createdByUserId: user.sub }],
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        nome: true,
        categoria: true,
        lado: true,
        mimeType: true,
        tamanhoBytes: true,
        visivelFormador: true,
        createdAt: true,
      },
    });
  }

  async getMeDocumentosObrigatorios(user: RequestUser) {
    const { tenantId, profile } = await this.requireOwnProfile(user);
    const [docs, tenant] = await Promise.all([
      this.prisma.documentoAnexo.findMany({
        where: { tenantId, formadorId: profile.id },
        select: { categoria: true },
      }),
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { metadata: true },
      }),
    ]);
    const politica = parseTenantDocumentosPolitica(tenant?.metadata);
    return avaliarDocumentosObrigatoriosFormador(docs, politica.universaisObrigatorios);
  }

  async uploadMeDocumento(
    user: RequestUser,
    file: Express.Multer.File,
    categoria?: string,
  ) {
    const { tenantId, profile } = await this.requireOwnProfile(user);
    if (!file?.buffer?.length) throw new BadRequestException("Ficheiro em falta.");
    if (!FORMADOR_DOC_MIMES.has(file.mimetype)) {
      throw new BadRequestException("Formato inválido. Use PDF, JPG ou PNG.");
    }
    if (file.size > FORMADOR_DOC_MAX_BYTES) {
      throw new BadRequestException("Ficheiro demasiado grande (máx. 10 MB).");
    }
    const cat = categoria?.trim() || "outros";
    if (!FORMADOR_DOC_TIPOS.has(cat)) {
      throw new BadRequestException("Categoria de documento inválida.");
    }

    const storageKey = opaqueStorageKey(["docs", tenantId, "formador", profile.id]);
    await this.storage.putObject(storageKey, file.buffer, file.mimetype);
    try {
      return await this.prisma.documentoAnexo.create({
        data: {
          tenantId,
          formadorId: profile.id,
          categoria: cat,
          lado: "unico",
          nome: file.originalname,
          storageKey,
          mimeType: file.mimetype,
          tamanhoBytes: file.size,
          createdByUserId: user.sub,
          visivelFormador: true,
        },
        select: {
          id: true,
          nome: true,
          categoria: true,
          mimeType: true,
          tamanhoBytes: true,
          createdAt: true,
        },
      });
    } catch (err) {
      await this.storage.deleteObject(storageKey).catch(() => undefined);
      throw err;
    }
  }

  async streamMeDocumento(user: RequestUser, id: string) {
    const { tenantId, profile } = await this.requireOwnProfile(user);
    const doc = await this.prisma.documentoAnexo.findFirst({
      where: {
        id,
        tenantId,
        formadorId: profile.id,
        OR: [{ visivelFormador: true }, { createdByUserId: user.sub }],
      },
    });
    if (!doc) throw new NotFoundException("Documento não encontrado.");
    const obj = await this.storage.getObject(doc.storageKey);
    if (!obj) throw new NotFoundException("Ficheiro não encontrado no armazenamento.");
    await this.documentAudit.logDownload({
      user,
      tenantId,
      action: "document.download",
      resourceType: "DocumentoAnexo",
      resourceId: doc.id,
      channel: "stream",
      payload: { nome: doc.nome, formadorId: profile.id },
    });
    return {
      body: obj.body,
      contentType: doc.mimeType || obj.contentType,
      nome: doc.nome,
    };
  }

  async listMeDocumentoRequisicoes(user: RequestUser) {
    const { tenantId, profile } = await this.requireOwnProfile(user);
    return this.prisma.documentoRequisicao.findMany({
      where: {
        tenantId,
        formadorId: profile.id,
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
    const { tenantId, profile } = await this.requireOwnProfile(user);
    if (!file?.buffer?.length) throw new BadRequestException("Ficheiro em falta.");
    if (!FORMADOR_DOC_MIMES.has(file.mimetype)) {
      throw new BadRequestException("Formato inválido. Use PDF, JPG ou PNG.");
    }
    if (file.size > FORMADOR_DOC_MAX_BYTES) {
      throw new BadRequestException("Ficheiro demasiado grande (máx. 10 MB).");
    }

    const req = await this.prisma.documentoRequisicao.findFirst({
      where: { id: requisicaoId, tenantId, formadorId: profile.id },
    });
    if (!req) throw new NotFoundException("Requisição não encontrada.");
    if (req.estado === "cancelado") {
      throw new BadRequestException("Esta requisição foi cancelada.");
    }

    const storageKey = opaqueStorageKey(["docs", tenantId, "formador-req", profile.id]);
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
            formadorId: profile.id,
            categoria: "outros",
            lado: "unico",
            nome: file.originalname,
            storageKey,
            mimeType: file.mimetype,
            tamanhoBytes: file.size,
            createdByUserId: user.sub,
            visivelFormador: true,
          },
        });
        return tx.documentoRequisicao.update({
          where: { id: req.id },
          data: {
            estado: "submetido",
            submetidoEm: new Date(),
            documentoAnexoId: doc.id,
          },
          select: {
            id: true,
            titulo: true,
            estado: true,
            submetidoEm: true,
            documentoAnexo: {
              select: { id: true, nome: true, mimeType: true, tamanhoBytes: true, createdAt: true },
            },
          },
        });
      });
      return updated;
    } catch (err) {
      await this.storage.deleteObject(storageKey).catch(() => undefined);
      throw err;
    }
  }
}
