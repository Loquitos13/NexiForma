import { Injectable, NotFoundException } from "@nestjs/common";
import type { RgpdPedido } from "@nexiforma/database";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "../common/tenant-scope";
import { StorageService } from "../storage/storage.service";
import type { CreateRgpdPedidoDto } from "./dto/rgpd.dto";

@Injectable()
export class RgpdService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  list(user: RequestUser): Promise<RgpdPedido[]> {
    const tenantId = requireTenantId(user);
    return this.prisma.rgpdPedido.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async create(user: RequestUser, dto: CreateRgpdPedidoDto): Promise<RgpdPedido> {
    const tenantId = requireTenantId(user);
    const pedido = await this.prisma.rgpdPedido.create({
      data: {
        tenantId,
        subjectId: dto.subjectId,
        subjectType: dto.subjectType,
        tipo: dto.tipo,
      },
    });

    if (dto.tipo === "EXPORT") {
      return this.processExport(pedido.id, tenantId, dto.subjectId, dto.subjectType);
    }
    return this.processDelete(pedido.id, tenantId, dto.subjectId, dto.subjectType);
  }

  async exportSelf(user: RequestUser): Promise<{ downloadUrl: string; pedidoId: string }> {
    const tenantId = requireTenantId(user);
    const formando = await this.prisma.formandoProfile.findFirst({
      where: { tenantId, userId: user.sub },
    });
    if (!formando) {
      throw new NotFoundException("Perfil de formando não encontrado.");
    }

    const pedido = await this.prisma.rgpdPedido.create({
      data: {
        tenantId,
        subjectId: formando.id,
        subjectType: "formando",
        tipo: "EXPORT",
      },
    });

    const processed = await this.processExport(
      pedido.id,
      tenantId,
      formando.id,
      "formando",
    );

    const resultado = processed.resultado as { storageKey?: string } | null;
    const key = resultado?.storageKey;
    if (!key) {
      throw new NotFoundException("Exportação não disponível.");
    }

    const url = await this.storage.getDownloadUrl(key, 3600);
    return { downloadUrl: url, pedidoId: processed.id };
  }

  async processExport(
    pedidoId: string,
    tenantId: string,
    subjectId: string,
    subjectType: string,
  ): Promise<RgpdPedido> {
    const payload = await this.buildSubjectExport(tenantId, subjectId, subjectType);
    const key = `rgpd/${tenantId}/${pedidoId}.json`;
    await this.storage.putObject(key, Buffer.from(JSON.stringify(payload, null, 2)), "application/json");

    return this.prisma.rgpdPedido.update({
      where: { id: pedidoId },
      data: {
        estado: "PROCESSADO",
        processedAt: new Date(),
        resultado: { storageKey: key, registos: Object.keys(payload).length },
      },
    });
  }

  async processDelete(
    pedidoId: string,
    tenantId: string,
    subjectId: string,
    subjectType: string,
  ): Promise<RgpdPedido> {
    let anonymized = 0;
    if (subjectType === "formando") {
      const profile = await this.prisma.formandoProfile.findFirst({
        where: { id: subjectId, tenantId },
      });
      if (profile) {
        await this.prisma.formandoProfile.update({
          where: { id: subjectId },
          data: {
            nome: "Anónimo RGPD",
            email: null,
            telefone: null,
            nif: `RGPD-${subjectId.slice(0, 8)}`,
          },
        });
        anonymized = 1;
      }
    }

    return this.prisma.rgpdPedido.update({
      where: { id: pedidoId },
      data: {
        estado: anonymized > 0 ? "PROCESSADO" : "REJEITADO",
        processedAt: new Date(),
        resultado: { anonymized, subjectType },
      },
    });
  }

  private async buildSubjectExport(tenantId: string, subjectId: string, subjectType: string) {
    if (subjectType === "formando") {
      const formando = await this.prisma.formandoProfile.findFirst({
        where: { id: subjectId, tenantId },
        include: {
          matriculas: {
            include: {
              turma: { select: { codigo: true, nome: true } },
              avaliacoes: true,
              quizTentativas: { take: 50, orderBy: { createdAt: "desc" } },
            },
          },
        },
      });
      if (!formando) {
        throw new NotFoundException("Sujeito de dados não encontrado.");
      }
      return { tipo: "formando", dados: formando };
    }

    const entidade = await this.prisma.entidadeCliente.findFirst({
      where: { id: subjectId, tenantId },
      include: { propostas: true, formandos: { select: { id: true, nome: true } } },
    });
    if (!entidade) {
      throw new NotFoundException("Sujeito de dados não encontrado.");
    }
    return { tipo: "entidade_cliente", dados: entidade };
  }
}
