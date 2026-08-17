import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "../common/tenant-scope";
import { StorageService } from "../storage/storage.service";
import { assertAllowedUpload } from "../common/upload-mime.util";
import { DocumentAccessAuditService } from "../audit/document-access-audit.service";
import { PortalNotificacoesService } from "../notificacoes/portal-notificacoes.service";
import { ACAO_TEMPLATE_CATEGORIAS } from "../formandos/matricula-documentos.util";
import { opaqueStorageKey } from "../common/opaque-storage-key.util";
import type { CreateDocumentoRequisicaoDto } from "./dto/create-documento-requisicao.dto";

const TEMPLATE_CATEGORIAS = new Set(Object.values(ACAO_TEMPLATE_CATEGORIAS));

@Injectable()
export class DocumentosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly documentAudit: DocumentAccessAuditService,
    private readonly portalNotificacoes: PortalNotificacoesService,
  ) {}

  list(
    user: RequestUser,
    opts?: {
      entidadeClienteId?: string;
      acaoFormacaoId?: string;
      formandoId?: string;
      formadorId?: string;
      categoria?: string;
    },
  ) {
    const tenantId = requireTenantId(user);
    return this.prisma.documentoAnexo.findMany({
      where: {
        tenantId,
        ...(opts?.entidadeClienteId ? { entidadeClienteId: opts.entidadeClienteId } : {}),
        ...(opts?.acaoFormacaoId ? { acaoFormacaoId: opts.acaoFormacaoId } : {}),
        ...(opts?.formandoId ? { formandoId: opts.formandoId } : {}),
        ...(opts?.formadorId ? { formadorId: opts.formadorId } : {}),
        ...(opts?.categoria ? { categoria: opts.categoria } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        formando: { select: { id: true, nome: true, nif: true } },
        formador: { select: { id: true, nomeCompleto: true, nif: true } },
        entidadeCliente: { select: { id: true, nome: true } },
        acaoFormacao: { select: { id: true, codigoInterno: true, titulo: true } },
      },
    });
  }

  async upload(
    user: RequestUser,
    file: Express.Multer.File,
    opts: {
      entidadeClienteId?: string;
      acaoFormacaoId?: string;
      formandoId?: string;
      formadorId?: string;
      categoria?: string;
      visivelFormador?: boolean;
      visivelFormando?: boolean;
    },
  ) {
    const tenantId = requireTenantId(user);
    try {
      assertAllowedUpload(file);
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : "Ficheiro inválido.");
    }
    if (opts.entidadeClienteId) {
      const ent = await this.prisma.entidadeCliente.findFirst({
        where: { id: opts.entidadeClienteId, tenantId },
      });
      if (!ent) throw new NotFoundException("Entidade cliente não encontrada.");
    }
    if (opts.acaoFormacaoId) {
      const acao = await this.prisma.acaoFormacao.findFirst({
        where: { id: opts.acaoFormacaoId, tenantId },
      });
      if (!acao) throw new NotFoundException("Acção de formação não encontrada.");
    }
    if (opts.formandoId) {
      const formando = await this.prisma.formandoProfile.findFirst({
        where: { id: opts.formandoId, tenantId },
        select: { id: true },
      });
      if (!formando) throw new NotFoundException("Formando não encontrado.");
    }
    if (opts.formadorId) {
      const formador = await this.prisma.formadorProfile.findFirst({
        where: { id: opts.formadorId, tenantId },
        select: { id: true },
      });
      if (!formador) throw new NotFoundException("Formador não encontrado.");
    }

    const categoria = opts.categoria?.trim() || null;
    if (categoria && TEMPLATE_CATEGORIAS.has(categoria) && !opts.acaoFormacaoId) {
      throw new BadRequestException("Templates de inscrição exigem acaoFormacaoId.");
    }

    const ownerKey = opts.formadorId
      ? opaqueStorageKey(["docs", tenantId, "formador", opts.formadorId])
      : opaqueStorageKey(["docs", tenantId, opts.formandoId ?? "shared"]);
    const storageKey = ownerKey;
    await this.storage.putObject(storageKey, file.buffer, file.mimetype);

    try {
      return await this.prisma.$transaction(async (tx) => {
        if (categoria && opts.acaoFormacaoId && TEMPLATE_CATEGORIAS.has(categoria)) {
          const prev = await tx.documentoAnexo.findMany({
            where: { tenantId, acaoFormacaoId: opts.acaoFormacaoId, categoria },
          });
          for (const p of prev) {
            await tx.documentoAnexo.delete({ where: { id: p.id } });
            await this.storage.deleteObject(p.storageKey).catch(() => undefined);
          }
        }
        return tx.documentoAnexo.create({
          data: {
            tenantId,
            entidadeClienteId: opts.entidadeClienteId ?? null,
            acaoFormacaoId: opts.acaoFormacaoId ?? null,
            formandoId: opts.formandoId ?? null,
            formadorId: opts.formadorId ?? null,
            categoria,
            lado: categoria ? "unico" : null,
            nome: file.originalname,
            storageKey,
            mimeType: file.mimetype,
            tamanhoBytes: file.size,
            createdByUserId: user.sub,
            visivelFormador: opts.formadorId ? opts.visivelFormador === true : true,
            visivelFormando: opts.formandoId ? opts.visivelFormando === true : true,
          },
          include: {
            formando: { select: { id: true, nome: true, nif: true } },
            formador: { select: { id: true, nomeCompleto: true, nif: true } },
            entidadeCliente: { select: { id: true, nome: true } },
            acaoFormacao: { select: { id: true, codigoInterno: true, titulo: true } },
          },
        });
      });
    } catch (err) {
      await this.storage.deleteObject(storageKey);
      throw err;
    }
  }

  async associarFormando(user: RequestUser, id: string, formandoId: string) {
    const tenantId = requireTenantId(user);
    const doc = await this.prisma.documentoAnexo.findFirst({ where: { id, tenantId } });
    if (!doc) throw new NotFoundException("Documento não encontrado.");
    const formando = await this.prisma.formandoProfile.findFirst({
      where: { id: formandoId, tenantId },
      select: { id: true },
    });
    if (!formando) throw new NotFoundException("Formando não encontrado.");
    return this.prisma.documentoAnexo.update({
      where: { id },
      data: { formandoId: formando.id, formadorId: null },
      include: {
        formando: { select: { id: true, nome: true, nif: true } },
        formador: { select: { id: true, nomeCompleto: true, nif: true } },
        entidadeCliente: { select: { id: true, nome: true } },
        acaoFormacao: { select: { id: true, codigoInterno: true, titulo: true } },
      },
    });
  }

  async associarFormador(user: RequestUser, id: string, formadorId: string) {
    const tenantId = requireTenantId(user);
    const doc = await this.prisma.documentoAnexo.findFirst({ where: { id, tenantId } });
    if (!doc) throw new NotFoundException("Documento não encontrado.");
    const formador = await this.prisma.formadorProfile.findFirst({
      where: { id: formadorId, tenantId },
      select: { id: true },
    });
    if (!formador) throw new NotFoundException("Formador não encontrado.");
    return this.prisma.documentoAnexo.update({
      where: { id },
      data: { formadorId: formador.id, formandoId: null },
      include: {
        formando: { select: { id: true, nome: true, nif: true } },
        formador: { select: { id: true, nomeCompleto: true, nif: true } },
        entidadeCliente: { select: { id: true, nome: true } },
        acaoFormacao: { select: { id: true, codigoInterno: true, titulo: true } },
      },
    });
  }

  /** @deprecated Use stream autenticado `GET /documentos/:id/download`. */
  async downloadUrl(_user: RequestUser, _id: string) {
    throw new BadRequestException(
      "URLs pré-assinadas desactivadas. Use o download autenticado (login obrigatório).",
    );
  }

  async streamDownload(user: RequestUser, id: string) {
    const tenantId = requireTenantId(user);
    const doc = await this.prisma.documentoAnexo.findFirst({ where: { id, tenantId } });
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
      payload: { nome: doc.nome },
    });
    return {
      body: obj.body,
      contentType: doc.mimeType || obj.contentType,
      nome: doc.nome,
    };
  }

  async rename(user: RequestUser, id: string, nome: string) {
    const tenantId = requireTenantId(user);
    const trimmed = nome.trim();
    if (!trimmed) throw new BadRequestException("Nome em falta.");
    const doc = await this.prisma.documentoAnexo.findFirst({ where: { id, tenantId } });
    if (!doc) throw new NotFoundException("Documento não encontrado.");
    return this.prisma.documentoAnexo.update({
      where: { id },
      data: { nome: trimmed },
      select: {
        id: true,
        nome: true,
        mimeType: true,
        tamanhoBytes: true,
        createdAt: true,
      },
    });
  }

  async remove(user: RequestUser, id: string) {
    const tenantId = requireTenantId(user);
    const doc = await this.prisma.documentoAnexo.findFirst({ where: { id, tenantId } });
    if (!doc) throw new NotFoundException("Documento não encontrado.");
    if (doc.categoria && TEMPLATE_CATEGORIAS.has(doc.categoria)) {
      throw new BadRequestException(
        "Templates de inscrição não podem ser eliminados por aqui — use a secção de templates.",
      );
    }
    await this.prisma.documentoAnexo.delete({ where: { id } });
    await this.storage.deleteObject(doc.storageKey).catch(() => undefined);
    return { ok: true };
  }

  listRequisicoes(user: RequestUser, opts?: { estado?: string; formandoId?: string; formadorId?: string }) {
    const tenantId = requireTenantId(user);
    return this.prisma.documentoRequisicao.findMany({
      where: {
        tenantId,
        ...(opts?.estado ? { estado: opts.estado } : {}),
        ...(opts?.formandoId ? { formandoId: opts.formandoId } : {}),
        ...(opts?.formadorId ? { formadorId: opts.formadorId } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        formando: { select: { id: true, nome: true, nif: true } },
        formador: { select: { id: true, nomeCompleto: true, nif: true } },
        acaoFormacao: { select: { id: true, codigoInterno: true, titulo: true } },
        documentoAnexo: {
          select: { id: true, nome: true, mimeType: true, tamanhoBytes: true, createdAt: true },
        },
      },
    });
  }

  async criarRequisicao(user: RequestUser, dto: CreateDocumentoRequisicaoDto) {
    const tenantId = requireTenantId(user);
    const titulo = dto.titulo.trim();
    if (!titulo) throw new BadRequestException("Indique o título do documento pedido.");
    if (!dto.formandoId && !dto.formadorId && !dto.acaoFormacaoId) {
      throw new BadRequestException("Indique um formando, formador ou acção de formação.");
    }

    type Alvo = {
      formandoId: string | null;
      formadorId: string | null;
      matriculaId: string | null;
      acaoFormacaoId: string | null;
    };
    const alvos: Alvo[] = [];

    if (dto.formadorId) {
      const formador = await this.prisma.formadorProfile.findFirst({
        where: { id: dto.formadorId, tenantId },
        select: { id: true, userId: true, nomeCompleto: true },
      });
      if (!formador) throw new NotFoundException("Formador não encontrado.");
      alvos.push({
        formandoId: null,
        formadorId: formador.id,
        matriculaId: null,
        acaoFormacaoId: null,
      });
    } else if (dto.formandoId) {
      const formando = await this.prisma.formandoProfile.findFirst({
        where: { id: dto.formandoId, tenantId },
        select: { id: true, userId: true, nome: true },
      });
      if (!formando) throw new NotFoundException("Formando não encontrado.");

      let matriculaId: string | null = null;
      let acaoFormacaoId = dto.acaoFormacaoId ?? null;
      if (acaoFormacaoId) {
        const acao = await this.prisma.acaoFormacao.findFirst({
          where: { id: acaoFormacaoId, tenantId },
          select: { id: true },
        });
        if (!acao) throw new NotFoundException("Acção de formação não encontrada.");
        const mat = await this.prisma.matricula.findFirst({
          where: {
            tenantId,
            formandoId: formando.id,
            estado: "ATIVA",
            turma: { acaoFormacaoId },
          },
          select: { id: true },
        });
        matriculaId = mat?.id ?? null;
      }
      alvos.push({ formandoId: formando.id, formadorId: null, matriculaId, acaoFormacaoId });
    } else if (dto.acaoFormacaoId) {
      const acao = await this.prisma.acaoFormacao.findFirst({
        where: { id: dto.acaoFormacaoId, tenantId },
        select: { id: true },
      });
      if (!acao) throw new NotFoundException("Acção de formação não encontrada.");
      const mats = await this.prisma.matricula.findMany({
        where: {
          tenantId,
          estado: "ATIVA",
          turma: { acaoFormacaoId: acao.id },
        },
        select: { id: true, formandoId: true },
        distinct: ["formandoId"],
      });
      if (mats.length === 0) {
        throw new BadRequestException("Não há formandos com matrícula activa nesta acção.");
      }
      for (const m of mats) {
        alvos.push({
          formandoId: m.formandoId,
          formadorId: null,
          matriculaId: m.id,
          acaoFormacaoId: acao.id,
        });
      }
    }

    const created = await this.prisma.$transaction(
      alvos.map((a) =>
        this.prisma.documentoRequisicao.create({
          data: {
            tenantId,
            titulo,
            descricao: dto.descricao?.trim() || null,
            formandoId: a.formandoId,
            formadorId: a.formadorId,
            matriculaId: a.matriculaId,
            acaoFormacaoId: a.acaoFormacaoId,
            createdByUserId: user.sub,
            estado: "pendente",
          },
          include: {
            formando: { select: { id: true, nome: true, nif: true, userId: true } },
            formador: { select: { id: true, nomeCompleto: true, nif: true, userId: true } },
            acaoFormacao: { select: { id: true, codigoInterno: true, titulo: true } },
          },
        }),
      ),
    );

    for (const row of created) {
      const targetUserId = row.formando?.userId ?? row.formador?.userId;
      if (!targetUserId) continue;
      const link = row.formador
        ? "/portal/formador/perfil?tab=documentos"
        : "/portal/formando/perfil?tab=documentos";
      void this.portalNotificacoes
        .notifyUser({
          tenantId,
          userId: targetUserId,
          tipo: "documento_requisicao",
          titulo: "Documento pedido pela entidade formadora",
          mensagem: `Foi-lhe pedido o documento «${row.titulo}». Envie-o na área Documentos do perfil.`,
          link,
          emailConteudo: {
            subject: `Documento pedido: ${row.titulo}`,
            text: `A entidade formadora pediu-lhe o documento «${row.titulo}». Aceda ao portal (login) e envie o ficheiro na área Documentos do perfil.`,
            html: `<p>A entidade formadora pediu-lhe o documento <strong>${row.titulo}</strong>.</p><p>Aceda ao portal com login e envie o ficheiro na área Documentos do perfil.</p>`,
          },
          push: {
            title: "Documento pedido",
            body: row.titulo,
            url: link,
          },
        })
        .catch(() => undefined);
    }

    return { criados: created.length, itens: created };
  }

  async cancelarRequisicao(user: RequestUser, id: string) {
    const tenantId = requireTenantId(user);
    const row = await this.prisma.documentoRequisicao.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException("Requisição não encontrada.");
    if (row.estado === "cancelado") return row;
    if (row.estado === "submetido") {
      throw new BadRequestException("Não pode cancelar uma requisição já submetida.");
    }
    return this.prisma.documentoRequisicao.update({
      where: { id },
      data: { estado: "cancelado" },
    });
  }
}
