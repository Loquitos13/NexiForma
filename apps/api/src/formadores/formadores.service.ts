import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "../common/tenant-scope";
import type { UpdateFormadorDto } from "./dto/update-formador.dto";

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
  constructor(private readonly prisma: PrismaService) {}

  list(user: RequestUser) {
    const tenantId = requireTenantId(user);
    return this.prisma.formadorProfile.findMany({
      where: { tenantId },
      orderBy: { nomeCompleto: "asc" },
      select: {
        id: true,
        nomeCompleto: true,
        nif: true,
        email: true,
        ccNumero: true,
        ccpNumero: true,
        ccValidade: true,
        ccpValidade: true,
        _count: { select: { sessoesFormacao: true } },
      },
    });
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
        ccNumero: dto.ccNumero !== undefined ? dto.ccNumero.trim() || null : row.ccNumero,
        ccpNumero: dto.ccpNumero !== undefined ? dto.ccpNumero.trim() || null : row.ccpNumero,
        ccValidade:
          dto.ccValidade !== undefined
            ? dto.ccValidade
              ? new Date(dto.ccValidade)
              : null
            : row.ccValidade,
        ccpValidade:
          dto.ccpValidade !== undefined
            ? dto.ccpValidade
              ? new Date(dto.ccpValidade)
              : null
            : row.ccpValidade,
      },
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
}
