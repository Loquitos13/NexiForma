import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import * as argon2 from "argon2";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { resolverEmailPresencaFormando, emailPresencaConfiguradoPeloGestor } from "@nexiforma/shared";
import { requireTenantId } from "../common/tenant-scope";
import { StorageService } from "../storage/storage.service";
import { isValidNifPt } from "../dossie-pedagogico/sigo-validation.util";
import type { UpdateFormandoMeDto } from "./dto/update-formando-me.dto";
import type { ChangeFormandoPasswordDto } from "./dto/change-formando-password.dto";
import type { FormandoMeResponse } from "./dto/formando-me.response";

const DOC_MIMES = new Set(["image/jpeg", "image/jpg", "image/png"]);
const DOC_TIPOS = new Set(["cc", "bi", "carta_conducao"]);
const DOC_LADOS = new Set(["frente", "verso"]);
const MAX_DOC_BYTES = 10 * 1024 * 1024;

@Injectable()
export class FormandoPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
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
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { legalName: true, slug: true },
    });
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
    await this.prisma.user.update({
      where: { id: user.sub },
      data: { passwordHash },
    });

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
      where: { tenantId, formandoId: profile.id },
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
    if (!DOC_MIMES.has(file.mimetype)) {
      throw new BadRequestException("Use fotografia capturada on-camera (JPG ou PNG).");
    }
    if (file.size > MAX_DOC_BYTES) {
      throw new BadRequestException("Ficheiro demasiado grande (máx. 10 MB).");
    }

    const cat = categoria?.trim();
    if (!cat || !DOC_TIPOS.has(cat)) {
      throw new BadRequestException("Tipo de documento inválido.");
    }

    let ladoNorm = lado?.trim() || "frente";
    if (!DOC_LADOS.has(ladoNorm)) {
      throw new BadRequestException("Lado do documento inválido.");
    }
    if (cat !== "cc") {
      ladoNorm = "frente";
    }

    const existing = await this.prisma.documentoAnexo.findFirst({
      where: {
        tenantId,
        formandoId: profile.id,
        categoria: cat,
        lado: ladoNorm,
      },
    });

    const storageKey = `formandos/${tenantId}/${profile.id}/${randomUUID()}-${file.originalname.replace(/[^\w.-]/g, "_")}`;

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
            categoria: cat,
            lado: ladoNorm,
            nome: file.originalname,
            storageKey,
            mimeType: file.mimetype,
            tamanhoBytes: file.size,
            createdByUserId: user.sub,
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

  async downloadDocumento(user: RequestUser, id: string) {
    const { tenantId, profile } = await this.requireProfile(user);
    const doc = await this.prisma.documentoAnexo.findFirst({
      where: { id, tenantId, formandoId: profile.id },
    });
    if (!doc) {
      throw new NotFoundException("Documento não encontrado.");
    }
    return {
      id: doc.id,
      nome: doc.nome,
      url: `/api/v1/formando-portal/documentos/${doc.id}/download`,
    };
  }

  async streamDocumento(user: RequestUser, id: string) {
    const { tenantId, profile } = await this.requireProfile(user);
    const doc = await this.prisma.documentoAnexo.findFirst({
      where: { id, tenantId, formandoId: profile.id },
    });
    if (!doc) {
      throw new NotFoundException("Documento não encontrado.");
    }
    const obj = await this.storage.getObject(doc.storageKey);
    if (!obj) {
      throw new NotFoundException("Ficheiro não encontrado no armazenamento.");
    }
    return {
      body: obj.body,
      contentType: doc.mimeType || obj.contentType,
      nome: doc.nome,
    };
  }
}
