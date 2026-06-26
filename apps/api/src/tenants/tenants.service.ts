import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lista tenants (Control Plane / dev). Em produção: proteger com IAM + Cognito SuperAdmin.
   */
  listSummary() {
    return this.prisma.tenant.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        slug: true,
        legalName: true,
        nif: true,
        status: true,
        createdAt: true,
        _count: { select: { users: true } },
      },
    });
  }
}
