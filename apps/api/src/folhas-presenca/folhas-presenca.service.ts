import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  isEstadoPresenca,
  presenteFromEstado,
} from "@nexiforma/shared";
import type { FolhaPresenca, Presenca } from "@nexiforma/database";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { FormadorScopeService } from "../common/formador-scope.service";
import { requireTenantId } from "../common/tenant-scope";
import type { CreateFolhaPresencaDto } from "./dto/create-folha-presenca.dto";
import type { UpdatePresencaDto } from "./dto/update-presenca.dto";

const PRESENCA_QR_TOKEN_RE = /^[A-Za-z0-9_-]{16,128}$/;

@Injectable()
export class FolhasPresencaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly formadorScope: FormadorScopeService,
  ) {}

  async listBySessao(user: RequestUser, sessaoId: string, turmaId?: string) {
    const tenantId = requireTenantId(user);
    await this.formadorScope.assertCanAccessSessao(user, sessaoId);

    return this.prisma.folhaPresenca.findMany({
      where: {
        tenantId,
        sessaoId,
        ...(turmaId ? { turmaId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        turmaId: true,
        origem: true,
        fechadaEm: true,
        validadaFormadorEm: true,
        aprovadaGestorEm: true,
        createdAt: true,
        turma: { select: { codigo: true, nome: true } },
        _count: { select: { presencas: true } },
      },
    });
  }

  async getDetail(user: RequestUser, id: string) {
    const tenantId = requireTenantId(user);
    const folha = await this.prisma.folhaPresenca.findFirst({
      where: { id, tenantId },
      include: {
        turma: { select: { id: true, codigo: true, nome: true } },
        sessao: {
          select: {
            numeroSessao: true,
            data: true,
            horaInicio: true,
            horaFim: true,
            iniciadaEm: true,
            terminadaEm: true,
            formadorPresente: true,
            formador: { select: { id: true, nomeCompleto: true } },
          },
        },
        presencas: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            presente: true,
            estado: true,
            motivoJustificacao: true,
            minutosEfetivos: true,
            validado: true,
            origem: true,
            matricula: {
              select: {
                id: true,
                formando: { select: { nome: true, nif: true } },
              },
            },
          },
        },
      },
    });
    if (!folha) {
      throw new NotFoundException("Folha de presença não encontrada.");
    }
    // Leitura: formadores da acção + gestor/coordenador pedagógico
    await this.formadorScope.assertCanAccessSessao(user, folha.sessaoId);

    const actorIds = [folha.validadaFormadorPor, folha.aprovadaGestorPor].filter(
      (x): x is string => Boolean(x),
    );
    const actors = actorIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: actorIds }, tenantId },
          select: { id: true, displayName: true, role: true },
        })
      : [];
    const byId = new Map(actors.map((a) => [a.id, a]));
    const roleLabel = (role: string) => {
      switch (role) {
        case "ADMIN":
          return "Gestor";
        case "COORDENADOR_PEDAGOGICO":
        case "COORDENADOR":
          return "Coordenador Pedagógico";
        case "FORMADOR":
          return "Formador";
        default:
          return role;
      }
    };

    return {
      ...folha,
      validacaoFormadorAssinaturaNome: folha.validacaoFormadorAssinaturaNome,
      aprovacaoAssinaturaNome: folha.aprovacaoAssinaturaNome,
      validadaPor: folha.validadaFormadorPor
        ? (() => {
            const u = byId.get(folha.validadaFormadorPor);
            return u
              ? {
                  id: u.id,
                  nome: u.displayName,
                  role: u.role,
                  roleLabel: roleLabel(u.role),
                  assinaturaNome: folha.validacaoFormadorAssinaturaNome,
                  em: folha.validadaFormadorEm,
                }
              : {
                  id: folha.validadaFormadorPor,
                  nome: folha.validacaoFormadorAssinaturaNome ?? "Formador",
                  role: "FORMADOR",
                  roleLabel: "Formador",
                  assinaturaNome: folha.validacaoFormadorAssinaturaNome,
                  em: folha.validadaFormadorEm,
                };
          })()
        : null,
      aprovadaPor: folha.aprovadaGestorPor
        ? (() => {
            const u = byId.get(folha.aprovadaGestorPor);
            return u
              ? {
                  id: u.id,
                  nome: u.displayName,
                  role: u.role,
                  roleLabel: roleLabel(u.role),
                  assinaturaNome: folha.aprovacaoAssinaturaNome,
                  em: folha.aprovadaGestorEm,
                }
              : {
                  id: folha.aprovadaGestorPor,
                  nome: folha.aprovacaoAssinaturaNome ?? "Gestor",
                  role: "ADMIN",
                  roleLabel: "Gestor",
                  assinaturaNome: folha.aprovacaoAssinaturaNome,
                  em: folha.aprovadaGestorEm,
                };
          })()
        : null,
    };
  }

  async create(user: RequestUser, dto: CreateFolhaPresencaDto): Promise<FolhaPresenca> {
    const tenantId = requireTenantId(user);
    await this.formadorScope.assertCanOperateSessao(user, dto.sessaoId);

    const sessao = await this.prisma.sessaoFormacao.findFirst({
      where: { id: dto.sessaoId, tenantId },
      include: { cronograma: { select: { acaoFormacaoId: true } } },
    });
    if (!sessao) {
      throw new NotFoundException("Sessão inexistente ou de outro tenant.");
    }
    if (!sessao.iniciadaEm) {
      throw new BadRequestException(
        "Inicia a sessão antes de abrir a folha de presença.",
      );
    }

    const turma = await this.prisma.turma.findFirst({
      where: { id: dto.turmaId, tenantId },
    });
    if (!turma) {
      throw new NotFoundException("Turma inexistente ou de outro tenant.");
    }

    if (turma.acaoFormacaoId !== sessao.cronograma.acaoFormacaoId) {
      throw new BadRequestException(
        "A turma não pertence à mesma acção de formação que a sessão.",
      );
    }

    const existente = await this.prisma.folhaPresenca.findFirst({
      where: { tenantId, sessaoId: dto.sessaoId, turmaId: dto.turmaId },
    });
    if (existente) {
      return existente;
    }

    const matriculas = await this.prisma.matricula.findMany({
      where: {
        tenantId,
        turmaId: dto.turmaId,
        estado: "ATIVA",
      },
      select: { id: true },
    });

    if (matriculas.length === 0) {
      throw new BadRequestException("A turma não tem matrículas activas.");
    }

    const origem = dto.origem?.trim() || "manual";

    return this.prisma.$transaction(async (tx) => {
      const folha = await tx.folhaPresenca.create({
        data: {
          tenantId,
          sessaoId: dto.sessaoId,
          turmaId: dto.turmaId,
          origem,
        },
      });

      await tx.presenca.createMany({
        data: matriculas.map((m) => ({
          tenantId,
          folhaPresencaId: folha.id,
          matriculaId: m.id,
          presente: false,
          origem,
        })),
        skipDuplicates: true,
      });

      return folha;
    });
  }

  /**
   * Formador valida a folha (assiduidade completa) com assinatura manuscrita.
   * A folha permanece aberta até aprovação do gestor / coordenador pedagógico.
   */
  async validarFormador(
    user: RequestUser,
    id: string,
    nomeAssinatura: string,
  ): Promise<FolhaPresenca> {
    const tenantId = requireTenantId(user);
    const nome = nomeAssinatura.trim();
    if (nome.length < 2) {
      throw new BadRequestException("Indique o nome completo para assinar a validação.");
    }
    const folha = await this.prisma.folhaPresenca.findFirst({
      where: { id, tenantId },
      include: { presencas: true },
    });
    if (!folha) {
      throw new NotFoundException("Folha de presença não encontrada.");
    }
    await this.formadorScope.assertCanOperateSessao(user, folha.sessaoId);

    for (const p of folha.presencas) {
      const estado = p.estado;
      if (!isEstadoPresenca(estado)) {
        throw new BadRequestException(
          "Todos os formandos devem ter presença, falta justificada ou falta injustificada assinalada.",
        );
      }
      if (estado === "FALTA_JUSTIFICADA" && !p.motivoJustificacao?.trim()) {
        throw new BadRequestException(
          "Indique o motivo para cada falta justificada.",
        );
      }
    }

    return this.prisma.folhaPresenca.update({
      where: { id: folha.id },
      data: {
        validadaFormadorEm: new Date(),
        validadaFormadorPor: user.sub,
        validacaoFormadorAssinaturaNome: nome.slice(0, 120),
        // Folha só fecha na aprovação do gestor/coordenador
        fechadaEm: null,
        aprovadaGestorEm: null,
        aprovadaGestorPor: null,
        aprovacaoAssinaturaNome: null,
      },
    });
  }

  /** Gestor aprova folha já validada pelo formador (com assinatura manuscrita). */
  async aprovarGestor(
    user: RequestUser,
    id: string,
    nomeAssinatura: string,
  ): Promise<FolhaPresenca> {
    const tenantId = requireTenantId(user);
    const nome = nomeAssinatura.trim();
    if (nome.length < 2) {
      throw new BadRequestException("Indique o nome completo para assinar a aprovação.");
    }
    const folha = await this.prisma.folhaPresenca.findFirst({
      where: { id, tenantId },
    });
    if (!folha) {
      throw new NotFoundException("Folha de presença não encontrada.");
    }
    if (!folha.validadaFormadorEm) {
      throw new BadRequestException(
        "A folha tem de ser validada pelo formador antes da aprovação do gestor ou coordenador pedagógico.",
      );
    }
    if (folha.aprovadaGestorEm) {
      throw new BadRequestException("Esta folha já foi aprovada.");
    }

    return this.prisma.folhaPresenca.update({
      where: { id: folha.id },
      data: {
        aprovadaGestorEm: new Date(),
        aprovadaGestorPor: user.sub,
        aprovacaoAssinaturaNome: nome.slice(0, 120),
        fechadaEm: new Date(),
      },
    });
  }

  async fechar(user: RequestUser, id: string, nomeAssinatura: string): Promise<FolhaPresenca> {
    return this.aprovarGestor(user, id, nomeAssinatura);
  }

  async updatePresenca(
    user: RequestUser,
    presencaId: string,
    dto: UpdatePresencaDto,
  ): Promise<Presenca> {
    const tenantId = requireTenantId(user);

    const presenca = await this.prisma.presenca.findFirst({
      where: { id: presencaId, tenantId },
      include: { folhaPresenca: true },
    });
    if (!presenca) {
      throw new NotFoundException("Registo de presença não encontrado.");
    }
    await this.formadorScope.assertCanOperateSessao(user, presenca.folhaPresenca.sessaoId);

    const data: {
      presente?: boolean;
      estado?: string | null;
      motivoJustificacao?: string | null;
      minutosEfetivos?: number | null;
      validado?: boolean;
      origem?: string;
    } = {};

    if (dto.estado !== undefined) {
      if (dto.estado === null) {
        data.estado = null;
        data.presente = false;
        data.validado = false;
        data.motivoJustificacao = null;
      } else {
        if (!isEstadoPresenca(dto.estado)) {
          throw new BadRequestException("Estado de presença inválido.");
        }
        if (dto.estado === "FALTA_JUSTIFICADA") {
          const motivo = dto.motivoJustificacao ?? presenca.motivoJustificacao;
          if (!motivo?.trim()) {
            throw new BadRequestException(
              "Indique o motivo da falta justificada.",
            );
          }
        }
        data.estado = dto.estado;
        data.presente = presenteFromEstado(dto.estado);
        data.validado = true;
        data.origem = "manual";
        if (dto.estado !== "FALTA_JUSTIFICADA") {
          data.motivoJustificacao = null;
        }
      }
    }

    if (dto.motivoJustificacao !== undefined) {
      data.motivoJustificacao = dto.motivoJustificacao;
    }

    if (dto.presente !== undefined && dto.estado === undefined) {
      data.presente = dto.presente;
      data.estado = dto.presente ? "PRESENTE" : "FALTA_INJUSTIFICADA";
      data.validado = true;
      data.origem = "manual";
    }
    if (dto.minutosEfetivos !== undefined) data.minutosEfetivos = dto.minutosEfetivos;
    if (dto.validado !== undefined) data.validado = dto.validado;

    if (!Object.keys(data).length) {
      throw new BadRequestException("Nenhum campo para actualizar.");
    }

    const folhaUpdate =
      presenca.folhaPresenca.aprovadaGestorEm || presenca.folhaPresenca.validadaFormadorEm
        ? {
            aprovadaGestorEm: null as Date | null,
            aprovadaGestorPor: null as string | null,
            aprovacaoAssinaturaNome: null as string | null,
            validadaFormadorEm: null as Date | null,
            validadaFormadorPor: null as string | null,
            validacaoFormadorAssinaturaNome: null as string | null,
            fechadaEm: null as Date | null,
          }
        : null;

    return this.prisma.$transaction(async (tx) => {
      if (folhaUpdate) {
        await tx.folhaPresenca.update({
          where: { id: presenca.folhaPresencaId },
          data: folhaUpdate,
        });
      }
      return tx.presenca.update({
        where: { id: presencaId },
        data,
      });
    });
  }

  private assertPresencaQrToken(token: string): string {
    const t = token.trim();
    if (!PRESENCA_QR_TOKEN_RE.test(t)) {
      throw new BadRequestException("Código QR de presença inválido.");
    }
    return t;
  }

  /** Info da sessão para o formando autenticado (antes do check-in). */
  async getCheckinInfo(user: RequestUser, tokenRaw: string) {
    const tenantId = requireTenantId(user);
    if (user.role !== "formando") {
      throw new ForbiddenException("Apenas formandos podem registar presença via QR.");
    }
    const token = this.assertPresencaQrToken(tokenRaw);

    const sessao = await this.prisma.sessaoFormacao.findFirst({
      where: { tenantId, presencaQrToken: token },
      select: {
        id: true,
        numeroSessao: true,
        data: true,
        horaInicio: true,
        horaFim: true,
        iniciadaEm: true,
        terminadaEm: true,
        presencaQrExpiresAt: true,
        cronograma: {
          select: {
            acaoFormacao: { select: { codigoInterno: true, titulo: true } },
          },
        },
      },
    });
    if (!sessao) {
      throw new NotFoundException(
        "Código QR de presença não encontrado ou já foi renovado. Peça o QR actual ao formador.",
      );
    }

    const qrValido =
      !sessao.presencaQrExpiresAt || sessao.presencaQrExpiresAt.getTime() > Date.now();

    return {
      sessao: {
        id: sessao.id,
        numeroSessao: sessao.numeroSessao,
        data: sessao.data,
        horaInicio: sessao.horaInicio,
        horaFim: sessao.horaFim,
        iniciadaEm: sessao.iniciadaEm,
        terminadaEm: sessao.terminadaEm,
        acao: sessao.cronograma.acaoFormacao,
      },
      podeRegistar:
        Boolean(sessao.iniciadaEm) && !sessao.terminadaEm && qrValido,
      qrExpirado: !qrValido,
    };
  }

  /** Formando regista presença escaneando o QR da sessão. */
  async checkinByQrToken(user: RequestUser, tokenRaw: string) {
    const tenantId = requireTenantId(user);
    if (user.role !== "formando") {
      throw new ForbiddenException("Apenas formandos podem registar presença via QR.");
    }
    const token = this.assertPresencaQrToken(tokenRaw);

    const sessao = await this.prisma.sessaoFormacao.findFirst({
      where: { tenantId, presencaQrToken: token },
      select: {
        id: true,
        iniciadaEm: true,
        terminadaEm: true,
        presencaQrExpiresAt: true,
      },
    });
    if (!sessao) {
      throw new NotFoundException(
        "Código QR de presença não encontrado ou já foi renovado. Peça o QR actual ao formador.",
      );
    }
    if (
      sessao.presencaQrExpiresAt &&
      sessao.presencaQrExpiresAt.getTime() <= Date.now()
    ) {
      throw new BadRequestException(
        "Este código QR expirou. Peça ao formador o código actualizado no projector.",
      );
    }

    return this.checkinFormandoNaSessao(user, sessao.id, "qr");
  }

  /** Estado do check-in na sessão (portal do formando). */
  async getCheckinStatusBySessao(user: RequestUser, sessaoId: string) {
    const tenantId = requireTenantId(user);
    if (user.role !== "formando") {
      throw new ForbiddenException("Apenas formandos podem consultar presença.");
    }

    const sessao = await this.prisma.sessaoFormacao.findFirst({
      where: { id: sessaoId, tenantId },
      select: {
        id: true,
        numeroSessao: true,
        data: true,
        horaInicio: true,
        horaFim: true,
        iniciadaEm: true,
        terminadaEm: true,
        cronograma: {
          select: {
            acaoFormacaoId: true,
            acaoFormacao: { select: { codigoInterno: true, titulo: true } },
          },
        },
      },
    });
    if (!sessao) {
      throw new NotFoundException("Sessão não encontrada.");
    }

    const formando = await this.prisma.formandoProfile.findFirst({
      where: { tenantId, userId: user.sub },
      select: { id: true },
    });
    if (!formando) {
      throw new ForbiddenException("Perfil de formando não encontrado.");
    }

    const matricula = await this.prisma.matricula.findFirst({
      where: {
        tenantId,
        formandoId: formando.id,
        estado: "ATIVA",
        turma: { acaoFormacaoId: sessao.cronograma.acaoFormacaoId },
      },
      select: { id: true, turmaId: true },
    });

    let alreadyPresent = false;
    if (matricula) {
      const presenca = await this.prisma.presenca.findFirst({
        where: {
          tenantId,
          matriculaId: matricula.id,
          folhaPresenca: { sessaoId: sessao.id, turmaId: matricula.turmaId },
        },
        select: { presente: true, estado: true },
      });
      alreadyPresent = Boolean(presenca?.presente && presenca.estado === "PRESENTE");
    }

    const podeRegistar =
      Boolean(sessao.iniciadaEm) && !sessao.terminadaEm && Boolean(matricula);

    return {
      sessao: {
        id: sessao.id,
        numeroSessao: sessao.numeroSessao,
        data: sessao.data,
        horaInicio: sessao.horaInicio,
        horaFim: sessao.horaFim,
        iniciadaEm: sessao.iniciadaEm,
        terminadaEm: sessao.terminadaEm,
        acao: sessao.cronograma.acaoFormacao,
      },
      podeRegistar,
      alreadyPresent,
      temMatricula: Boolean(matricula),
    };
  }

  /** Formando regista presença a partir do portal (sessão já iniciada). */
  async checkinBySessao(user: RequestUser, sessaoId: string) {
    if (user.role !== "formando") {
      throw new ForbiddenException("Apenas formandos podem registar presença.");
    }
    return this.checkinFormandoNaSessao(user, sessaoId, "portal");
  }

  private async checkinFormandoNaSessao(
    user: RequestUser,
    sessaoId: string,
    origem: "qr" | "portal",
  ) {
    const tenantId = requireTenantId(user);

    const sessao = await this.prisma.sessaoFormacao.findFirst({
      where: { id: sessaoId, tenantId },
      include: { cronograma: { select: { acaoFormacaoId: true } } },
    });
    if (!sessao) {
      throw new NotFoundException("Sessão não encontrada.");
    }
    if (!sessao.iniciadaEm) {
      throw new BadRequestException(
        "A sessão ainda não foi iniciada pelo formador ou gestor.",
      );
    }
    if (sessao.terminadaEm) {
      throw new BadRequestException(
        "A sessão já terminou - já não é possível registar presença.",
      );
    }

    const formando = await this.prisma.formandoProfile.findFirst({
      where: { tenantId, userId: user.sub },
      select: { id: true, nome: true },
    });
    if (!formando) {
      throw new ForbiddenException("Perfil de formando não encontrado.");
    }

    const matriculas = await this.prisma.matricula.findMany({
      where: {
        tenantId,
        formandoId: formando.id,
        estado: "ATIVA",
        turma: { acaoFormacaoId: sessao.cronograma.acaoFormacaoId },
      },
      select: { id: true, turmaId: true },
      take: 5,
    });
    if (matriculas.length === 0) {
      throw new BadRequestException(
        "Não tens matrícula activa nesta acção de formação.",
      );
    }
    const matricula = matriculas[0]!;

    let folha = await this.prisma.folhaPresenca.findFirst({
      where: {
        tenantId,
        sessaoId: sessao.id,
        turmaId: matricula.turmaId,
      },
    });

    if (!folha) {
      const turmaMatriculas = await this.prisma.matricula.findMany({
        where: { tenantId, turmaId: matricula.turmaId, estado: "ATIVA" },
        select: { id: true },
      });
      folha = await this.prisma.$transaction(async (tx) => {
        const created = await tx.folhaPresenca.create({
          data: {
            tenantId,
            sessaoId: sessao.id,
            turmaId: matricula.turmaId,
            origem: "hibrida",
          },
        });
        await tx.presenca.createMany({
          data: turmaMatriculas.map((m) => ({
            tenantId,
            folhaPresencaId: created.id,
            matriculaId: m.id,
            presente: false,
            origem: "manual",
          })),
          skipDuplicates: true,
        });
        return created;
      });
    }

    let presenca = await this.prisma.presenca.findFirst({
      where: {
        tenantId,
        folhaPresencaId: folha.id,
        matriculaId: matricula.id,
      },
    });

    const alreadyPresent = Boolean(presenca?.presente && presenca.estado === "PRESENTE");

    if (!presenca) {
      await this.prisma.presenca.create({
        data: {
          tenantId,
          folhaPresencaId: folha.id,
          matriculaId: matricula.id,
          presente: true,
          estado: "PRESENTE",
          origem,
          validado: true,
        },
      });
    } else if (!alreadyPresent) {
      const reopen =
        folha.aprovadaGestorEm || folha.validadaFormadorEm
          ? {
              aprovadaGestorEm: null as Date | null,
              aprovadaGestorPor: null as string | null,
              aprovacaoAssinaturaNome: null as string | null,
              validadaFormadorEm: null as Date | null,
              validadaFormadorPor: null as string | null,
              validacaoFormadorAssinaturaNome: null as string | null,
              fechadaEm: null as Date | null,
            }
          : null;

      await this.prisma.$transaction(async (tx) => {
        if (reopen) {
          await tx.folhaPresenca.update({ where: { id: folha!.id }, data: reopen });
        }
        await tx.presenca.update({
          where: { id: presenca!.id },
          data: {
            presente: true,
            estado: "PRESENTE",
            origem,
            validado: true,
            motivoJustificacao: null,
          },
        });
      });
    } else if (presenca.origem !== origem) {
      await this.prisma.presenca.update({
        where: { id: presenca.id },
        data: { origem },
      });
    }

    return {
      ok: true as const,
      alreadyPresent,
      formando: formando.nome,
      sessao: {
        id: sessao.id,
        numeroSessao: sessao.numeroSessao,
        data: sessao.data,
        horaInicio: sessao.horaInicio,
        horaFim: sessao.horaFim,
      },
    };
  }
}
