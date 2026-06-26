import {
  ConflictException,
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Matricula } from "@nexiforma/database";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import {
  emailPresencaEfectivoDeFormando,
  turmaExigeEmailPresenca,
} from "../common/formando-presenca.util";
import { requireTenantId } from "../common/tenant-scope";
import type { CreateMatriculaDto } from "./dto/create-matricula.dto";
import type { UpdateMatriculaDto } from "./dto/update-matricula.dto";

@Injectable()
export class MatriculasService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lista matrículas de uma turma. */
  async listByTurma(user: RequestUser, turmaId: string) {
    const tenantId = requireTenantId(user);
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

    return this.prisma.matricula.create({
      data: {
        tenantId,
        turmaId: dto.turmaId,
        formandoId: dto.formandoId,
      },
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
}
