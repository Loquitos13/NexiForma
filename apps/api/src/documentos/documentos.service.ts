import { Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "../common/tenant-scope";
import { StorageService } from "../storage/storage.service";

@Injectable()
export class DocumentosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  list(user: RequestUser, entidadeClienteId?: string, acaoFormacaoId?: string) {
    const tenantId = requireTenantId(user);
    return this.prisma.documentoAnexo.findMany({
      where: {
        tenantId,
        ...(entidadeClienteId ? { entidadeClienteId } : {}),
        ...(acaoFormacaoId ? { acaoFormacaoId } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async upload(
    user: RequestUser,
    file: Express.Multer.File,
    opts: { entidadeClienteId?: string; acaoFormacaoId?: string },
  ) {
    const tenantId = requireTenantId(user);
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

    const storageKey = `documentos/${tenantId}/${randomUUID()}-${file.originalname.replace(/[^\w.-]/g, "_")}`;
    await this.storage.putObject(storageKey, file.buffer, file.mimetype);

    return this.prisma.documentoAnexo.create({
      data: {
        tenantId,
        entidadeClienteId: opts.entidadeClienteId ?? null,
        acaoFormacaoId: opts.acaoFormacaoId ?? null,
        nome: file.originalname,
        storageKey,
        mimeType: file.mimetype,
        tamanhoBytes: file.size,
        createdByUserId: user.sub,
      },
    });
  }

  async downloadUrl(user: RequestUser, id: string) {
    const tenantId = requireTenantId(user);
    const doc = await this.prisma.documentoAnexo.findFirst({ where: { id, tenantId } });
    if (!doc) throw new NotFoundException("Documento não encontrado.");
    const url = await this.storage.getDownloadUrl(doc.storageKey);
    return { id: doc.id, nome: doc.nome, url };
  }
}
