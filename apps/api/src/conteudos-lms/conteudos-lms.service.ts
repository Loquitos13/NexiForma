import { randomUUID } from "crypto";
import path from "node:path";
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { ModuloConteudo, ModuloUnidade, Prisma, ProgressoModulo } from "@nexiforma/database";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { FormadorScopeService } from "../common/formador-scope.service";
import { requireTenantId } from "../common/tenant-scope";
import { FormadorNotificacoesService } from "../notificacoes/formador-notificacoes.service";
import { StorageService } from "../storage/storage.service";
import { sanitizeLmsHtml } from "../common/sanitize-html.util";
import type { CreateModuloConteudoDto, CreateModuloUnidadeDto, UpdateModuloUnidadeDto, UpdateProgressoModuloDto } from "./dto/conteudos-lms.dto";
import { moduloDesbloqueado,
  notaMinimaParaDesbloquearProximo,
  pontuacaoModulo,
  pontuacaoTarefa,
  tarefaDesbloqueada,
  tarefasOrdenadas,
  unidadesOrdenadas,
  validarModuloConteudoCompleto,
  canManageFormacao,
} from "@nexiforma/shared";
import { prazoConclusaoAtingido, prazoYmd } from "./lms-prazo.util";

const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;

const DOC_EXTENSIONS = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".ppt",
  ".pptx",
  ".xls",
  ".xlsx",
  ".txt",
  ".odt",
  ".odp",
  ".csv",
  ".rtf",
]);

function inferModuloTipo(mimeType: string, fileName: string): "VIDEO" | "PDF" {
  if (mimeType.startsWith("video/")) return "VIDEO";
  if (mimeType.startsWith("image/")) return "PDF";
  const ext = path.extname(fileName).toLowerCase();
  if (DOC_EXTENSIONS.has(ext)) return "PDF";
  if (mimeType === "application/pdf") return "PDF";
  throw new BadRequestException(
    "Tipo de ficheiro não suportado. Usa vídeo (mp4, webm…) ou documento (pdf, word, powerpoint, imagem…).",
  );
}

function assertUploadSize(file: Express.Multer.File): void {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new BadRequestException("Ficheiro demasiado grande (máximo 200 MB).");
  }
}

function tituloFromFileName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "Conteúdo";
}

function mergeModuloConteudo(
  existing: ModuloConteudo,
  dto: Partial<CreateModuloConteudoDto>,
): ModuloConteudo {
  return {
    ...existing,
    titulo: dto.titulo?.trim() ?? existing.titulo,
    urlOuRef: dto.urlOuRef !== undefined ? dto.urlOuRef?.trim() || null : existing.urlOuRef,
    conteudoHtml:
      dto.conteudoHtml !== undefined
        ? sanitizeLmsHtml(dto.conteudoHtml?.trim() || null)
        : existing.conteudoHtml,
    metadata:
      dto.metadata !== undefined
        ? (dto.metadata as Prisma.JsonValue)
        : (existing.metadata as Prisma.JsonValue),
  };
}

function resolvePublicadoOnSave(
  merged: ModuloConteudo,
  requested: boolean | undefined,
): boolean {
  const check = validarModuloConteudoCompleto({
    tipo: merged.tipo,
    urlOuRef: merged.urlOuRef,
    conteudoHtml: merged.conteudoHtml,
    metadata:
      merged.metadata && typeof merged.metadata === "object" && !Array.isArray(merged.metadata)
        ? (merged.metadata as Record<string, unknown>)
        : null,
  });

  if (requested === true && !check.ok) {
    throw new BadRequestException(check.message);
  }
  if (requested === false) return false;
  return check.ok;
}

@Injectable()
export class ConteudosLmsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly formadorScope: FormadorScopeService,
    private readonly storage: StorageService,
    private readonly formadorNotificacoes: FormadorNotificacoesService,
  ) {}

  async listModulos(user: RequestUser, cursoId: string): Promise<ModuloConteudo[]> {
    const tenantId = requireTenantId(user);
    if (user.role === "formador") {
      await this.formadorScope.assertCanEditCurso(user, cursoId);
    }
    const where =
      user.role === "formando"
        ? { tenantId, cursoId, publicado: true }
        : { tenantId, cursoId };

    return this.prisma.moduloConteudo.findMany({
      where,
      orderBy: [{ moduloUnidadeId: "asc" }, { ordem: "asc" }, { createdAt: "asc" }],
    });
  }

  async listUnidades(user: RequestUser, cursoId: string) {
    const tenantId = requireTenantId(user);
    if (user.role === "formador") {
      await this.formadorScope.assertCanEditCurso(user, cursoId);
    }
    return this.prisma.moduloUnidade.findMany({
      where: { tenantId, cursoId },
      orderBy: [{ ordem: "asc" }, { createdAt: "asc" }],
      include: {
        formador: { select: { id: true, nomeCompleto: true } },
        _count: { select: { conteudos: true } },
      },
    });
  }

  async createUnidade(user: RequestUser, dto: CreateModuloUnidadeDto): Promise<ModuloUnidade> {
    const tenantId = requireTenantId(user);
    await this.formadorScope.assertCanEditCurso(user, dto.cursoId);
    const curso = await this.prisma.curso.findFirst({ where: { id: dto.cursoId, tenantId } });
    if (!curso) throw new NotFoundException("Curso nao encontrado.");

    return this.prisma.moduloUnidade.create({
      data: {
        tenantId,
        cursoId: dto.cursoId,
        codigo: dto.codigo?.trim().toUpperCase() || null,
        titulo: dto.titulo.trim(),
        descricao: dto.descricao?.trim() || null,
        cargaHoras: dto.cargaHoras ?? null,
        formadorId: dto.formadorId ?? null,
        ordem: dto.ordem ?? 0,
        notaMinima: dto.notaMinima ?? 60,
      },
    });
  }

  async updateUnidade(
    user: RequestUser,
    id: string,
    dto: UpdateModuloUnidadeDto,
  ): Promise<ModuloUnidade> {
    const tenantId = requireTenantId(user);
    const existing = await this.prisma.moduloUnidade.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException("Unidade nao encontrada.");
    await this.formadorScope.assertCanEditCurso(user, existing.cursoId);

    return this.prisma.moduloUnidade.update({
      where: { id },
      data: {
        codigo: dto.codigo !== undefined ? dto.codigo?.trim().toUpperCase() || null : undefined,
        titulo: dto.titulo?.trim(),
        descricao: dto.descricao !== undefined ? dto.descricao?.trim() || null : undefined,
        cargaHoras: dto.cargaHoras !== undefined ? dto.cargaHoras : undefined,
        formadorId: dto.formadorId !== undefined ? dto.formadorId : undefined,
        ordem: dto.ordem,
        notaMinima: dto.notaMinima !== undefined ? dto.notaMinima : undefined,
        lockManual: dto.lockManual !== undefined ? dto.lockManual : undefined,
      },
    });
  }

  async deleteUnidade(user: RequestUser, id: string): Promise<void> {
    const tenantId = requireTenantId(user);
    const existing = await this.prisma.moduloUnidade.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException("Unidade nao encontrada.");
    await this.formadorScope.assertCanEditCurso(user, existing.cursoId);
    await this.prisma.moduloUnidade.delete({ where: { id } });
  }

  async createModulo(user: RequestUser, dto: CreateModuloConteudoDto): Promise<ModuloConteudo> {
    const tenantId = requireTenantId(user);
    await this.formadorScope.assertCanEditCurso(user, dto.cursoId);
    const curso = await this.prisma.curso.findFirst({
      where: { id: dto.cursoId, tenantId },
    });
    if (!curso) {
      throw new NotFoundException("Curso nao encontrado.");
    }

    if (dto.moduloUnidadeId) {
      const unidade = await this.prisma.moduloUnidade.findFirst({
        where: { id: dto.moduloUnidadeId, tenantId, cursoId: dto.cursoId },
      });
      if (!unidade) throw new BadRequestException("Módulo (unidade) inválido para este curso.");
    }

    const conteudoDraft = {
      tipo: dto.tipo,
      urlOuRef: dto.urlOuRef?.trim() || null,
      conteudoHtml: sanitizeLmsHtml(dto.conteudoHtml?.trim() || null),
      metadata: dto.metadata ?? null,
    };
    const check = validarModuloConteudoCompleto(conteudoDraft);
    let publicado = dto.publicado;
    if (publicado === undefined) {
      publicado = check.ok;
    } else if (publicado && !check.ok) {
      throw new BadRequestException(check.message);
    }

    return this.prisma.moduloConteudo.create({
      data: {
        tenantId,
        cursoId: dto.cursoId,
        moduloUnidadeId: dto.moduloUnidadeId ?? null,
        titulo: dto.titulo.trim(),
        tipo: dto.tipo,
        ordem: dto.ordem ?? 0,
        urlOuRef: conteudoDraft.urlOuRef,
        conteudoHtml: conteudoDraft.conteudoHtml,
        duracaoMin: dto.duracaoMin ?? null,
        publicado,
        notaMinima: dto.notaMinima ?? null,
        prerequisitoModuloId: dto.prerequisitoModuloId ?? null,
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async updateModulo(
    user: RequestUser,
    id: string,
    dto: Partial<CreateModuloConteudoDto>,
  ): Promise<ModuloConteudo> {
    const tenantId = requireTenantId(user);
    const existing = await this.prisma.moduloConteudo.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException("Modulo nao encontrado.");
    await this.formadorScope.assertCanEditCurso(user, existing.cursoId);

    const merged = mergeModuloConteudo(existing, dto);
    const contentChanged =
      dto.urlOuRef !== undefined ||
      dto.conteudoHtml !== undefined ||
      dto.metadata !== undefined ||
      dto.publicado !== undefined;
    const publicado = contentChanged ? resolvePublicadoOnSave(merged, dto.publicado) : undefined;

    return this.prisma.moduloConteudo.update({
      where: { id },
      data: {
        titulo: dto.titulo?.trim(),
        ordem: dto.ordem,
        moduloUnidadeId: dto.moduloUnidadeId !== undefined ? dto.moduloUnidadeId ?? null : undefined,
        urlOuRef: dto.urlOuRef !== undefined ? dto.urlOuRef?.trim() || null : undefined,
        conteudoHtml:
          dto.conteudoHtml !== undefined ? sanitizeLmsHtml(dto.conteudoHtml?.trim() || null) : undefined,
        duracaoMin: dto.duracaoMin,
        publicado,
        notaMinima: dto.notaMinima,
        prerequisitoModuloId: dto.prerequisitoModuloId,
        metadata: dto.metadata !== undefined ? (dto.metadata as Prisma.InputJsonValue) : undefined,
      },
    });
  }

  async deleteModulo(user: RequestUser, id: string): Promise<void> {
    const tenantId = requireTenantId(user);
    const existing = await this.prisma.moduloConteudo.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException("Modulo nao encontrado.");
    await this.formadorScope.assertCanEditCurso(user, existing.cursoId);
    await this.prisma.moduloConteudo.delete({ where: { id } });
  }

  async uploadModuloFicheiro(
    user: RequestUser,
    moduloId: string,
    file: Express.Multer.File,
  ): Promise<ModuloConteudo> {
    assertUploadSize(file);
    const tenantId = requireTenantId(user);
    const modulo = await this.prisma.moduloConteudo.findFirst({ where: { id: moduloId, tenantId } });
    if (!modulo) throw new NotFoundException("Modulo nao encontrado.");
    await this.formadorScope.assertCanEditCurso(user, modulo.cursoId);

    if (!["VIDEO", "PDF"].includes(modulo.tipo)) {
      throw new BadRequestException("Upload só disponível para módulos VIDEO ou PDF.");
    }

    const inferred = inferModuloTipo(file.mimetype, file.originalname);
    if (inferred !== modulo.tipo) {
      throw new BadRequestException(
        `Este módulo é do tipo ${modulo.tipo} - carrega um ficheiro compatível (${modulo.tipo === "VIDEO" ? "vídeo" : "documento/imagem"}).`,
      );
    }

    const storageKey = `lms/${tenantId}/${modulo.cursoId}/${randomUUID()}-${file.originalname.replace(/[^\w.-]/g, "_")}`;
    await this.storage.putObject(storageKey, file.buffer, file.mimetype);

    const merged = mergeModuloConteudo(modulo, {
      urlOuRef: storageKey,
      metadata: {
        ...(typeof modulo.metadata === "object" && modulo.metadata ? modulo.metadata : {}),
        fileName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        uploadedAt: new Date().toISOString(),
      },
    });
    const publicado = resolvePublicadoOnSave(merged, undefined);

    return this.prisma.moduloConteudo.update({
      where: { id: moduloId },
      data: {
        urlOuRef: storageKey,
        titulo:
          modulo.titulo.startsWith("Novo ") ? tituloFromFileName(file.originalname) : modulo.titulo,
        metadata: merged.metadata as Prisma.InputJsonValue,
        publicado,
      },
    });
  }

  async uploadNovoModuloComFicheiro(
    user: RequestUser,
    cursoId: string,
    moduloUnidadeId: string,
    file: Express.Multer.File,
  ): Promise<ModuloConteudo> {
    assertUploadSize(file);
    const tenantId = requireTenantId(user);
    await this.formadorScope.assertCanEditCurso(user, cursoId);

    const unidade = await this.prisma.moduloUnidade.findFirst({
      where: { id: moduloUnidadeId, tenantId, cursoId },
    });
    if (!unidade) throw new BadRequestException("Módulo (unidade) inválido para este curso.");

    const tipo = inferModuloTipo(file.mimetype, file.originalname);
    const ordem = await this.prisma.moduloConteudo.count({
      where: { tenantId, cursoId, moduloUnidadeId },
    });

    const modulo = await this.prisma.moduloConteudo.create({
      data: {
        tenantId,
        cursoId,
        moduloUnidadeId,
        titulo: tituloFromFileName(file.originalname),
        tipo,
        ordem,
        publicado: true,
      },
    });

    return this.uploadModuloFicheiro(user, modulo.id, file);
  }

  async getModuloMedia(
    user: RequestUser,
    moduloId: string,
  ): Promise<{ body: Buffer; contentType: string; fileName?: string }> {
    const tenantId = requireTenantId(user);
    const modulo = await this.prisma.moduloConteudo.findFirst({ where: { id: moduloId, tenantId } });
    if (!modulo?.urlOuRef?.startsWith("lms/")) {
      throw new NotFoundException("Ficheiro não encontrado.");
    }

    await this.assertCanViewModuloMedia(user, modulo);

    const obj = await this.storage.getObject(modulo.urlOuRef);
    if (!obj) throw new NotFoundException("Ficheiro não encontrado no storage.");

    const meta =
      typeof modulo.metadata === "object" && modulo.metadata
        ? (modulo.metadata as Record<string, unknown>)
        : {};
    const fileName = typeof meta.fileName === "string" ? meta.fileName : undefined;

    return {
      body: obj.body,
      contentType: (typeof meta.mimeType === "string" ? meta.mimeType : null) ?? obj.contentType,
      fileName,
    };
  }

  private async assertCanViewModuloMedia(user: RequestUser, modulo: ModuloConteudo): Promise<void> {
    const tenantId = requireTenantId(user);
    if (canManageFormacao(user.role)) return;

    if (user.role === "formador") {
      await this.formadorScope.assertCanEditCurso(user, modulo.cursoId);
      return;
    }

    if (user.role === "formando") {
      if (!modulo.publicado) throw new ForbiddenException("Conteúdo não publicado.");
      const matricula = await this.prisma.matricula.findFirst({
        where: {
          tenantId,
          estado: { not: "DESISTENCIA" },
          formando: { userId: user.sub },
          turma: { acaoFormacao: { cursoId: modulo.cursoId } },
        },
        select: { id: true },
      });
      if (!matricula) {
        throw new ForbiddenException("Não tens acesso a este conteúdo.");
      }
      return;
    }

    throw new ForbiddenException("Sem permissão para aceder a este ficheiro.");
  }

  async getPercursoFormando(user: RequestUser, cursoId: string, matriculaId: string) {
    const tenantId = requireTenantId(user);
    await this.assertMatriculaAccess(user, matriculaId, tenantId);

    const matricula = await this.prisma.matricula.findFirst({
      where: { id: matriculaId, tenantId },
      include: {
        turma: {
          include: {
            acaoFormacao: {
              select: { id: true, cursoId: true, dataFim: true, prazoConclusaoLms: true },
            },
          },
        },
      },
    });
    if (!matricula?.turma?.acaoFormacao) {
      throw new NotFoundException("Matrícula ou formação não encontrada.");
    }

    // Conteúdos LMS são por curso - todas as acções do mesmo curso partilham o percurso.
    const cursoIdResolved = matricula.turma.acaoFormacao.cursoId;
    const acaoId = matricula.turma.acaoFormacao.id;

    const [unidades, modulos, progressos, desbloqueios, prazosModulo] = await Promise.all([
      this.prisma.moduloUnidade.findMany({
        where: { tenantId, cursoId: cursoIdResolved },
        orderBy: [{ ordem: "asc" }, { createdAt: "asc" }],
      }),
      this.prisma.moduloConteudo.findMany({
        where: { tenantId, cursoId: cursoIdResolved, publicado: true },
        orderBy: [{ ordem: "asc" }, { createdAt: "asc" }],
      }),
      this.prisma.progressoModulo.findMany({
        where: { tenantId, matriculaId },
      }),
      this.prisma.matriculaUnidadeDesbloqueio.findMany({
        where: { tenantId, matriculaId },
        select: { moduloUnidadeId: true },
      }),
      // Client Prisma pode ainda não ter o model (generate pendente) - não derrubar o percurso.
      (() => {
        const prazoDb = (
          this.prisma as unknown as {
            acaoModuloPrazoLms?: {
              findMany: (args: {
                where: { tenantId: string; acaoFormacaoId: string };
                select: { moduloUnidadeId: true; prazoConclusao: true };
              }) => Promise<{ moduloUnidadeId: string; prazoConclusao: Date }[]>;
            };
          }
        ).acaoModuloPrazoLms;
        if (!prazoDb) return Promise.resolve([] as { moduloUnidadeId: string; prazoConclusao: Date }[]);
        return prazoDb
          .findMany({
            where: { tenantId, acaoFormacaoId: acaoId },
            select: { moduloUnidadeId: true, prazoConclusao: true },
          })
          .catch(() => [] as { moduloUnidadeId: string; prazoConclusao: Date }[]);
      })(),
    ]);
    const prazoPorUnidade = new Map(
      prazosModulo.map((p) => [p.moduloUnidadeId, p.prazoConclusao.toISOString().slice(0, 10)]),
    );

    const progressoRows = progressos.map((p) => ({
      moduloId: p.moduloId,
      percentual: p.percentual,
      pontuacao: p.pontuacao,
      concluidoEm: p.concluidoEm,
    }));
    const desbloqueiosManuais = new Set(desbloqueios.map((d) => d.moduloUnidadeId));
    const lockOpts = { desbloqueiosManuais };

    const now = new Date();
    const unidadesOut = unidadesOrdenadas(unidades).map((u, idx) => {
      const anterior = idx > 0 ? unidadesOrdenadas(unidades)[idx - 1] : null;
      const pontuacao = pontuacaoModulo(modulos, progressoRows, u.id);
      const prazoModulo = prazoPorUnidade.get(u.id) ?? null;
      const prazoAtingido = prazoModulo ? prazoConclusaoAtingido(prazoModulo, now) : false;
      const desbloqueado =
        !prazoAtingido &&
        moduloDesbloqueado(unidades, modulos, progressoRows, u.id, lockOpts);
      return {
        id: u.id,
        titulo: u.titulo,
        descricao: u.descricao,
        ordem: u.ordem,
        notaMinima: u.notaMinima,
        lockManual: u.lockManual,
        desbloqueioManual: desbloqueiosManuais.has(u.id),
        pontuacao,
        desbloqueado,
        notaMinimaAnterior: anterior ? notaMinimaParaDesbloquearProximo(anterior) : null,
        tituloModuloAnterior: anterior?.titulo ?? null,
        prazoConclusaoLms: prazoModulo,
        prazoEmAtraso: Boolean(
          prazoAtingido && (pontuacao ?? 0) < (u.notaMinima ?? 60),
        ),
      };
    });

    const tarefasOut = tarefasOrdenadas(modulos).map((m) => {
      const prog = progressos.find((p) => p.moduloId === m.id);
      const progresso = prog
        ? {
            moduloId: prog.moduloId,
            percentual: prog.percentual,
            pontuacao: prog.pontuacao,
            concluidoEm: prog.concluidoEm,
          }
        : undefined;
      const prazoModulo = m.moduloUnidadeId
        ? (prazoPorUnidade.get(m.moduloUnidadeId) ?? null)
        : null;
      const prazoAtingido = prazoModulo ? prazoConclusaoAtingido(prazoModulo, now) : false;
      return {
        id: m.id,
        titulo: m.titulo,
        tipo: m.tipo,
        ordem: m.ordem,
        moduloUnidadeId: m.moduloUnidadeId,
        notaMinima: m.notaMinima,
        duracaoMin: m.duracaoMin,
        urlOuRef: m.urlOuRef,
        conteudoHtml: m.conteudoHtml,
        metadata:
          m.metadata && typeof m.metadata === "object" && !Array.isArray(m.metadata)
            ? (m.metadata as Record<string, unknown>)
            : null,
        prerequisitoModuloId: m.prerequisitoModuloId,
        pontuacao: pontuacaoTarefa(progresso, m),
        percentual: prog?.percentual ?? 0,
        concluido: !!prog?.concluidoEm,
        desbloqueado:
          !prazoAtingido &&
          tarefaDesbloqueada(unidades, modulos, progressoRows, m.id, lockOpts),
      };
    });

    const total = tarefasOut.length;
    const concluidos = tarefasOut.filter((t) => t.concluido).length;
    const acao = matricula?.turma.acaoFormacao;
    const limite = acao?.prazoConclusaoLms ?? acao?.dataFim ?? null;
    const msDia = 86_400_000;
    const diasRestantes =
      limite != null ? Math.ceil((limite.getTime() - now.getTime()) / msDia) : null;
    const percentualConclusao = total > 0 ? Math.round((concluidos / total) * 1000) / 10 : 0;
    const completo = total > 0 && concluidos >= total;
    const emAtraso = limite != null && now > limite && !completo;
    const cumpridoNoPrazo = completo && !emAtraso;

    return {
      cursoId: cursoIdResolved,
      unidades: unidadesOut,
      tarefas: tarefasOut,
      prazoLms: limite
        ? {
            limite: limite.toISOString().slice(0, 10),
            diasRestantes,
            percentualConclusao,
            concluidos,
            total,
            completo,
            emAtraso,
            cumpridoNoPrazo,
          }
        : null,
    };
  }

  /** Progresso LMS agregado dos formandos nas acções do formador (ou todas, se gestor). */
  async resumoProgressoFormador(user: RequestUser) {
    const tenantId = requireTenantId(user);
    if (user.role !== "formador" && !canManageFormacao(user.role)) {
      throw new ForbiddenException("Sem permissão.");
    }

    const assigned = await this.formadorScope.assignedAcaoIds(user);
    // null = gestor (sem filtro); [] = formador sem acções
    if (assigned !== null && !assigned.length) {
      return {
        geral: { percentual: 0, concluidas: 0, totalTarefas: 0, formandosAtivos: 0 },
        acoes: [],
      };
    }

    const acoes = await this.prisma.acaoFormacao.findMany({
      where: {
        tenantId,
        ...(assigned ? { id: { in: assigned } } : {}),
      },
      select: {
        id: true,
        titulo: true,
        codigoInterno: true,
        cursoId: true,
        curso: { select: { designacao: true } },
        turmas: {
          select: {
            matriculas: {
              where: { estado: "ATIVA" },
              select: {
                id: true,
                formando: { select: { nome: true } },
              },
            },
          },
        },
      },
      orderBy: { dataInicio: "desc" },
    });

    const cursoIds = [...new Set(acoes.map((a) => a.cursoId))];
    const modulos = await this.prisma.moduloConteudo.findMany({
      where: { tenantId, cursoId: { in: cursoIds }, publicado: true },
      select: { id: true, cursoId: true, ordem: true, moduloUnidadeId: true, publicado: true },
    });
    const tarefasPorCurso = new Map<string, ReturnType<typeof tarefasOrdenadas>>();
    for (const cursoId of cursoIds) {
      const cursoModulos = modulos.filter((m) => m.cursoId === cursoId);
      tarefasPorCurso.set(cursoId, tarefasOrdenadas(cursoModulos));
    }

    const matriculaIds = acoes.flatMap((a) =>
      a.turmas.flatMap((t) => t.matriculas.map((m) => m.id)),
    );
    const progressos =
      matriculaIds.length > 0
        ? await this.prisma.progressoModulo.findMany({
            where: { tenantId, matriculaId: { in: matriculaIds } },
            select: { matriculaId: true, moduloId: true, concluidoEm: true },
          })
        : [];
    const progressoPorMatricula = new Map<string, typeof progressos>();
    for (const p of progressos) {
      const list = progressoPorMatricula.get(p.matriculaId) ?? [];
      list.push(p);
      progressoPorMatricula.set(p.matriculaId, list);
    }

    let geralConcluidas = 0;
    let geralTotal = 0;
    let formandosAtivos = 0;

    const acoesOut = acoes.map((acao) => {
      const tarefas = tarefasPorCurso.get(acao.cursoId) ?? [];
      const totalTarefas = tarefas.length;
      const matriculas = acao.turmas.flatMap((t) => t.matriculas);

      const formandos = matriculas.map((m) => {
        const prog = progressoPorMatricula.get(m.id) ?? [];
        const concluidas = tarefas.filter((t) =>
          prog.some((p) => p.moduloId === t.id && p.concluidoEm),
        ).length;
        const percentual =
          totalTarefas > 0 ? Math.round((concluidas / totalTarefas) * 1000) / 10 : 0;
        return {
          matriculaId: m.id,
          nome: m.formando.nome,
          percentual,
          concluidas,
          total: totalTarefas,
          completo: totalTarefas > 0 && concluidas >= totalTarefas,
        };
      });

      const somaPercentuais = formandos.reduce((s, f) => s + f.percentual, 0);
      const percentualMedio =
        formandos.length > 0 ? Math.round((somaPercentuais / formandos.length) * 10) / 10 : 0;
      const concluidasAcao = formandos.reduce((s, f) => s + f.concluidas, 0);
      const totalSlots = totalTarefas * formandos.length;

      geralConcluidas += concluidasAcao;
      geralTotal += totalSlots;
      formandosAtivos += formandos.length;

      return {
        acaoId: acao.id,
        codigoInterno: acao.codigoInterno,
        titulo: acao.titulo,
        cursoDesignacao: acao.curso.designacao,
        percentualMedio,
        formandos: formandos.length,
        concluidas: concluidasAcao,
        totalTarefas,
        formandosDetalhe: formandos.sort((a, b) => a.percentual - b.percentual),
      };
    });

    const percentualGeral =
      geralTotal > 0 ? Math.round((geralConcluidas / geralTotal) * 1000) / 10 : 0;

    return {
      geral: {
        percentual: percentualGeral,
        concluidas: geralConcluidas,
        totalTarefas: geralTotal,
        formandosAtivos,
      },
      acoes: acoesOut,
    };
  }

  async listProgresso(
    user: RequestUser,
    matriculaId: string,
  ): Promise<
    (ProgressoModulo & {
      modulo: { id: string; titulo: string; tipo: string; ordem: number };
    })[]
  > {
    const tenantId = requireTenantId(user);
    await this.assertMatriculaAccess(user, matriculaId, tenantId);

    return this.prisma.progressoModulo.findMany({
      where: { tenantId, matriculaId },
      include: { modulo: { select: { id: true, titulo: true, tipo: true, ordem: true } } },
    });
  }

  async updateProgresso(
    user: RequestUser,
    matriculaId: string,
    moduloId: string,
    dto: UpdateProgressoModuloDto,
  ): Promise<ProgressoModulo> {
    const tenantId = requireTenantId(user);
    await this.assertMatriculaAccess(user, matriculaId, tenantId);

    const modulo = await this.prisma.moduloConteudo.findFirst({
      where: { id: moduloId, tenantId, publicado: true },
    });
    if (!modulo) {
      throw new NotFoundException("Módulo não encontrado.");
    }

    await this.assertTarefaAcessivel(tenantId, matriculaId, modulo);

    const percentual = dto.percentual ?? 0;
    const pontuacao =
      dto.pontuacao ?? (percentual >= 100 ? 100 : percentual > 0 ? percentual : null);
    const concluidoEm = percentual >= 100 ? new Date() : null;

    const row = await this.prisma.progressoModulo.upsert({
      where: { matriculaId_moduloId: { matriculaId, moduloId } },
      create: {
        tenantId,
        matriculaId,
        moduloId,
        percentual,
        pontuacao,
        tentativas: 1,
        concluidoEm,
      },
      update: {
        percentual: dto.percentual ?? undefined,
        pontuacao: pontuacao ?? undefined,
        tentativas: { increment: 1 },
        ultimaVisita: new Date(),
        ...(concluidoEm ? { concluidoEm } : {}),
      },
    });

    if (concluidoEm) {
      void this.formadorNotificacoes.notifyIfPercursoCompleto(tenantId, matriculaId);
    }
    return row;
  }

  /** Detalhe do percurso LMS de um formando (para formador atribuído à acção). */
  async progressoDetalheFormador(user: RequestUser, matriculaId: string) {
    const tenantId = requireTenantId(user);
    if (user.role !== "formador" && !canManageFormacao(user.role)) {
      throw new ForbiddenException("Sem permissão.");
    }

    const matricula = await this.prisma.matricula.findFirst({
      where: { id: matriculaId, tenantId },
      select: {
        id: true,
        estado: true,
        formando: { select: { nome: true, nif: true, email: true } },
        turma: {
          select: {
            codigo: true,
            nome: true,
            acaoFormacaoId: true,
            acaoFormacao: {
              select: {
                id: true,
                codigoInterno: true,
                titulo: true,
                cursoId: true,
                curso: { select: { designacao: true } },
              },
            },
          },
        },
      },
    });
    if (!matricula) {
      throw new NotFoundException("Matrícula não encontrada.");
    }

    if (user.role === "formador") {
      await this.formadorScope.assertCanAccessAcao(user, matricula.turma.acaoFormacaoId);
    }

    const percurso = await this.getPercursoFormando(
      user,
      matricula.turma.acaoFormacao.cursoId,
      matriculaId,
    );

    return {
      matriculaId: matricula.id,
      formando: matricula.formando,
      turma: { codigo: matricula.turma.codigo, nome: matricula.turma.nome },
      acao: {
        id: matricula.turma.acaoFormacao.id,
        codigoInterno: matricula.turma.acaoFormacao.codigoInterno,
        titulo: matricula.turma.acaoFormacao.titulo,
        cursoDesignacao: matricula.turma.acaoFormacao.curso.designacao,
      },
      percurso,
    };
  }

  private async assertTarefaAcessivel(
    tenantId: string,
    matriculaId: string,
    modulo: ModuloConteudo,
  ): Promise<void> {
    const [unidades, modulos, progressos, desbloqueios, matricula] = await Promise.all([
      this.prisma.moduloUnidade.findMany({ where: { tenantId, cursoId: modulo.cursoId } }),
      this.prisma.moduloConteudo.findMany({
        where: { tenantId, cursoId: modulo.cursoId, publicado: true },
      }),
      this.prisma.progressoModulo.findMany({ where: { tenantId, matriculaId } }),
      this.prisma.matriculaUnidadeDesbloqueio.findMany({
        where: { tenantId, matriculaId },
        select: { moduloUnidadeId: true },
      }),
      this.prisma.matricula.findFirst({
        where: { id: matriculaId, tenantId },
        select: { turma: { select: { acaoFormacaoId: true } } },
      }),
    ]);

    if (modulo.moduloUnidadeId && matricula?.turma?.acaoFormacaoId) {
      const prazo = await this.prisma.acaoModuloPrazoLms.findUnique({
        where: {
          acaoFormacaoId_moduloUnidadeId: {
            acaoFormacaoId: matricula.turma.acaoFormacaoId,
            moduloUnidadeId: modulo.moduloUnidadeId,
          },
        },
        select: { prazoConclusao: true },
      });
      if (prazo && prazoConclusaoAtingido(prazo.prazoConclusao)) {
        throw new ForbiddenException(
          "O limite de conclusão deste módulo foi atingido. Já não é possível responder.",
        );
      }
    }

    const progressoRows = progressos.map((p) => ({
      moduloId: p.moduloId,
      percentual: p.percentual,
      pontuacao: p.pontuacao,
      concluidoEm: p.concluidoEm,
    }));
    const lockOpts = { desbloqueiosManuais: new Set(desbloqueios.map((d) => d.moduloUnidadeId)) };

    if (!tarefaDesbloqueada(unidades, modulos, progressoRows, modulo.id, lockOpts)) {
      const unidade = modulo.moduloUnidadeId
        ? unidades.find((u) => u.id === modulo.moduloUnidadeId)
        : null;
      if (unidade?.lockManual && !lockOpts.desbloqueiosManuais.has(unidade.id)) {
        throw new ForbiddenException(
          "Este módulo está bloqueado. O gestor ou o formando associado devem libertá-lo para continuares.",
        );
      }
      const unidadeId = modulo.moduloUnidadeId;
      const prev = unidadeId
        ? unidadesOrdenadas(unidades).find((u, i, arr) => arr[i + 1]?.id === unidadeId)
        : null;
      const minima = prev ? notaMinimaParaDesbloquearProximo(prev) : 60;
      throw new ForbiddenException(
        `Conclui o módulo anterior com pelo menos ${minima}% para desbloquear este conteúdo.`,
      );
    }
  }

  /**
   * Estado de libertação de módulos (lock manual) para todos os formandos da acção.
   * Inclui filtro de permissões: formador só opera módulos das suas sessões.
   */
  async estadoLibertarAcao(user: RequestUser, acaoId: string) {
    const tenantId = requireTenantId(user);
    if (user.role !== "formador" && !canManageFormacao(user.role)) {
      throw new ForbiddenException("Sem permissão.");
    }
    await this.formadorScope.assertCanAccessAcao(user, acaoId);

    const acao = await this.prisma.acaoFormacao.findFirst({
      where: { id: acaoId, tenantId },
      select: {
        id: true,
        cursoId: true,
        turmas: {
          select: {
            id: true,
            codigo: true,
            nome: true,
            matriculas: {
              where: { estado: "ATIVA" },
              select: {
                id: true,
                formando: { select: { nome: true, nif: true } },
              },
              orderBy: { formando: { nome: "asc" } },
            },
          },
          orderBy: { codigo: "asc" },
        },
      },
    });
    if (!acao) throw new NotFoundException("Acção não encontrada.");

    const [unidades, operaveis, prazos, tarefas] = await Promise.all([
      this.prisma.moduloUnidade.findMany({
        where: { tenantId, cursoId: acao.cursoId },
        orderBy: [{ ordem: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          titulo: true,
          codigo: true,
          ordem: true,
          lockManual: true,
          _count: { select: { conteudos: true } },
        },
      }),
      this.formadorScope.moduloIdsOperaveisNaAcao(user, acaoId),
      this.prisma.acaoModuloPrazoLms.findMany({
        where: { tenantId, acaoFormacaoId: acaoId },
        select: { moduloUnidadeId: true, prazoConclusao: true },
      }),
      this.prisma.moduloConteudo.findMany({
        where: { tenantId, cursoId: acao.cursoId, publicado: true },
        select: { id: true, moduloUnidadeId: true },
      }),
    ]);

    const prazoPorUnidade = new Map(
      prazos.map((p) => [p.moduloUnidadeId, prazoYmd(p.prazoConclusao)]),
    );
    const now = new Date();

    const matriculas = acao.turmas.flatMap((t) =>
      t.matriculas.map((m) => ({
        matriculaId: m.id,
        turmaId: t.id,
        turmaCodigo: t.codigo,
        nome: m.formando.nome,
        nif: m.formando.nif,
      })),
    );
    const matriculaIds = matriculas.map((m) => m.matriculaId);
    const tarefaIds = tarefas.map((t) => t.id);
    type DesbloqueioRow = {
      matriculaId: string;
      moduloUnidadeId: string;
      desbloqueadoEm: Date;
    };
    type ProgressoRow = {
      matriculaId: string;
      moduloId: string;
      concluidoEm: Date | null;
    };
    const [desbloqueios, progressos] = await Promise.all([
      matriculaIds.length > 0
        ? this.prisma.matriculaUnidadeDesbloqueio.findMany({
            where: { tenantId, matriculaId: { in: matriculaIds } },
            select: {
              matriculaId: true,
              moduloUnidadeId: true,
              desbloqueadoEm: true,
            },
          })
        : Promise.resolve([] as DesbloqueioRow[]),
      matriculaIds.length > 0 && tarefaIds.length > 0
        ? this.prisma.progressoModulo.findMany({
            where: {
              tenantId,
              matriculaId: { in: matriculaIds },
              moduloId: { in: tarefaIds },
            },
            select: { matriculaId: true, moduloId: true, concluidoEm: true },
          })
        : Promise.resolve([] as ProgressoRow[]),
    ]);
    const unlockKey = new Set(
      desbloqueios.map((d) => `${d.matriculaId}:${d.moduloUnidadeId}`),
    );
    const concluidasKey = new Set(
      progressos
        .filter((p) => p.concluidoEm)
        .map((p) => `${p.matriculaId}:${p.moduloId}`),
    );
    const tarefasPorModulo = new Map<string, string[]>();
    for (const t of tarefas) {
      if (!t.moduloUnidadeId) continue;
      const list = tarefasPorModulo.get(t.moduloUnidadeId) ?? [];
      list.push(t.id);
      tarefasPorModulo.set(t.moduloUnidadeId, list);
    }
    const totalFormandos = matriculas.length;
    const isGestor = canManageFormacao(user.role);

    return {
      acaoId: acao.id,
      cursoId: acao.cursoId,
      turmas: acao.turmas.map((t) => ({
        id: t.id,
        codigo: t.codigo,
        nome: t.nome,
      })),
      modulos: unidades.map((u) => {
        const libertados = matriculas.filter((m) =>
          unlockKey.has(`${m.matriculaId}:${u.id}`),
        ).length;
        const podeOperar = operaveis === null || operaveis.includes(u.id);
        const prazoConclusao = prazoPorUnidade.get(u.id) ?? null;
        const prazoAtingido = prazoConclusao
          ? prazoConclusaoAtingido(prazoConclusao, now)
          : false;
        /**
         * Switch «Desbloqueado» = libertação explícita para todos os formandos.
         * Sem registos de desbloqueio fica Bloqueado (mesmo que lockManual esteja off).
         * Com limite atingido trata-se como bloqueado na UI.
         */
        const desbloqueado =
          !prazoAtingido &&
          (totalFormandos > 0 ? libertados === totalFormandos : false);
        const tarefasModulo = tarefasPorModulo.get(u.id) ?? [];
        const progressoFormandos = matriculas.map((m) => {
          const total = tarefasModulo.length;
          const concluidos = tarefasModulo.filter((tid) =>
            concluidasKey.has(`${m.matriculaId}:${tid}`),
          ).length;
          const percentual =
            total > 0 ? Math.round((concluidos / total) * 1000) / 10 : 0;
          return {
            matriculaId: m.matriculaId,
            nome: m.nome,
            nif: m.nif,
            turmaCodigo: m.turmaCodigo,
            concluidos,
            total,
            percentual,
            libertado: unlockKey.has(`${m.matriculaId}:${u.id}`),
          };
        });
        return {
          id: u.id,
          titulo: u.titulo,
          codigo: u.codigo,
          ordem: u.ordem,
          lockManual: u.lockManual,
          totalConteudos: u._count.conteudos,
          totalFormandos,
          libertados: prazoAtingido ? 0 : libertados,
          desbloqueado,
          prazoConclusao,
          prazoAtingido,
          podeOperar,
          podeDesbloquear: podeOperar && !prazoAtingido,
          podeBloquear: isGestor,
          podeDefinirPrazo: isGestor,
          progressoFormandos,
        };
      }),
      formandos: matriculas.map((m) => ({
        ...m,
        desbloqueios: unidades
          .filter((u) => unlockKey.has(`${m.matriculaId}:${u.id}`))
          .map((u) => u.id),
      })),
    };
  }

  /**
   * Liga/desliga o módulo (tarefas) para todos os formandos da acção.
   * Desbloquear: gestor ou formador das sessões do módulo.
   * Bloquear: só gestor.
   */
  async setModuloTarefasAcao(
    user: RequestUser,
    acaoId: string,
    unidadeId: string,
    desbloqueado: boolean,
  ) {
    const tenantId = requireTenantId(user);
    if (user.role !== "formador" && !canManageFormacao(user.role)) {
      throw new ForbiddenException("Sem permissão.");
    }
    await this.formadorScope.assertCanAccessAcao(user, acaoId);

    if (desbloqueado) {
      await this.formadorScope.assertCanLiberarModuloNaAcao(user, acaoId, unidadeId);
    } else if (!canManageFormacao(user.role)) {
      throw new ForbiddenException("Só o gestor pode voltar a bloquear o módulo.");
    }

    const acao = await this.prisma.acaoFormacao.findFirst({
      where: { id: acaoId, tenantId },
      select: {
        id: true,
        cursoId: true,
        turmas: {
          select: {
            matriculas: {
              where: { estado: "ATIVA" },
              select: { id: true },
            },
          },
        },
      },
    });
    if (!acao) throw new NotFoundException("Acção não encontrada.");

    const unidade = await this.prisma.moduloUnidade.findFirst({
      where: { id: unidadeId, tenantId, cursoId: acao.cursoId },
      select: { id: true, lockManual: true },
    });
    if (!unidade) throw new NotFoundException("Módulo não encontrado neste curso.");

    if (desbloqueado) {
      const prazo = await this.prisma.acaoModuloPrazoLms.findUnique({
        where: {
          acaoFormacaoId_moduloUnidadeId: {
            acaoFormacaoId: acaoId,
            moduloUnidadeId: unidadeId,
          },
        },
        select: { prazoConclusao: true },
      });
      if (prazo && prazoConclusaoAtingido(prazo.prazoConclusao)) {
        throw new ForbiddenException(
          "O limite de conclusão deste módulo já foi atingido. Altera ou remove o limite para desbloquear.",
        );
      }
    }

    const matriculaIds = acao.turmas.flatMap((t) => t.matriculas.map((m) => m.id));

    if (desbloqueado) {
      if (!unidade.lockManual) {
        await this.prisma.moduloUnidade.update({
          where: { id: unidadeId },
          data: { lockManual: true },
        });
      }
      for (const matriculaId of matriculaIds) {
        await this.prisma.matriculaUnidadeDesbloqueio.upsert({
          where: {
            matriculaId_moduloUnidadeId: { matriculaId, moduloUnidadeId: unidadeId },
          },
          create: {
            tenantId,
            matriculaId,
            moduloUnidadeId: unidadeId,
            desbloqueadoPorUserId: user.sub,
            motivo: "tarefas_acao",
          },
          update: {
            desbloqueadoPorUserId: user.sub,
            desbloqueadoEm: new Date(),
            motivo: "tarefas_acao",
          },
        });
      }
    } else {
      await this.aplicarBloqueioModuloAcao(tenantId, acaoId, unidadeId, matriculaIds);
    }

    return this.estadoLibertarAcao(user, acaoId);
  }

  /**
   * Define/remove o limite de conclusão do módulo nesta acção (só gestor).
   * Se o limite já tiver passado (00:00 do dia seguinte), o bloqueio corre em background.
   */
  async setModuloPrazoAcao(
    user: RequestUser,
    acaoId: string,
    unidadeId: string,
    prazoConclusao: string | null,
  ) {
    const tenantId = requireTenantId(user);
    if (!canManageFormacao(user.role)) {
      throw new ForbiddenException("Só o gestor pode definir o limite de conclusão.");
    }

    const acao = await this.prisma.acaoFormacao.findFirst({
      where: { id: acaoId, tenantId },
      select: { id: true, cursoId: true },
    });
    if (!acao) throw new NotFoundException("Acção não encontrada.");

    const unidade = await this.prisma.moduloUnidade.findFirst({
      where: { id: unidadeId, tenantId, cursoId: acao.cursoId },
      select: { id: true },
    });
    if (!unidade) throw new NotFoundException("Módulo não encontrado neste curso.");

    if (prazoConclusao == null || prazoConclusao.trim() === "") {
      await this.prisma.acaoModuloPrazoLms.deleteMany({
        where: { tenantId, acaoFormacaoId: acaoId, moduloUnidadeId: unidadeId },
      });
    } else {
      const ymd = prazoYmd(prazoConclusao);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
        throw new BadRequestException("Data de limite inválida (usa YYYY-MM-DD).");
      }
      await this.prisma.acaoModuloPrazoLms.upsert({
        where: {
          acaoFormacaoId_moduloUnidadeId: {
            acaoFormacaoId: acaoId,
            moduloUnidadeId: unidadeId,
          },
        },
        create: {
          tenantId,
          acaoFormacaoId: acaoId,
          moduloUnidadeId: unidadeId,
          prazoConclusao: new Date(ymd),
        },
        update: { prazoConclusao: new Date(ymd) },
      });

      // Bloqueio assíncrono se o limite já chegou (não bloqueia a resposta HTTP).
      if (prazoConclusaoAtingido(ymd)) {
        void this.aplicarBloqueioModuloAcao(tenantId, acaoId, unidadeId).catch(() => undefined);
      }
    }

    return this.estadoLibertarAcao(user, acaoId);
  }

  /** Cron / fire-and-forget: bloqueia módulos com prazo ≤ hoje (00:00 local). */
  async processarBloqueiosPorPrazo(): Promise<{ bloqueados: number; acoes: number }> {
    const prazos = await this.prisma.acaoModuloPrazoLms.findMany({
      select: {
        tenantId: true,
        acaoFormacaoId: true,
        moduloUnidadeId: true,
        prazoConclusao: true,
      },
    });
    const now = new Date();
    const alvo = prazos.filter((p) => prazoConclusaoAtingido(p.prazoConclusao, now));
    const acoes = new Set<string>();
    let bloqueados = 0;
    for (const p of alvo) {
      const changed = await this.aplicarBloqueioModuloAcao(
        p.tenantId,
        p.acaoFormacaoId,
        p.moduloUnidadeId,
      );
      if (changed) {
        bloqueados += 1;
        acoes.add(p.acaoFormacaoId);
      }
    }
    return { bloqueados, acoes: acoes.size };
  }

  /**
   * Força lockManual + remove desbloqueios das matrículas activas da acção.
   * @returns true se havia desbloqueios ou precisou activar lock.
   */
  private async aplicarBloqueioModuloAcao(
    tenantId: string,
    acaoId: string,
    unidadeId: string,
    matriculaIdsPrefetched?: string[],
  ): Promise<boolean> {
    let matriculaIds = matriculaIdsPrefetched;
    if (!matriculaIds) {
      const acao = await this.prisma.acaoFormacao.findFirst({
        where: { id: acaoId, tenantId },
        select: {
          turmas: {
            select: {
              matriculas: {
                where: { estado: "ATIVA" },
                select: { id: true },
              },
            },
          },
        },
      });
      matriculaIds = acao?.turmas.flatMap((t) => t.matriculas.map((m) => m.id)) ?? [];
    }

    const unidade = await this.prisma.moduloUnidade.findFirst({
      where: { id: unidadeId, tenantId },
      select: { id: true, lockManual: true },
    });
    if (!unidade) return false;

    let changed = false;
    if (!unidade.lockManual) {
      await this.prisma.moduloUnidade.update({
        where: { id: unidadeId },
        data: { lockManual: true },
      });
      changed = true;
    }
    if (matriculaIds.length) {
      const del = await this.prisma.matriculaUnidadeDesbloqueio.deleteMany({
        where: {
          tenantId,
          moduloUnidadeId: unidadeId,
          matriculaId: { in: matriculaIds },
        },
      });
      if (del.count > 0) changed = true;
    }
    return changed;
  }

  async desbloquearUnidadeMatricula(
    user: RequestUser,
    matriculaId: string,
    unidadeId: string,
    motivo?: string,
  ) {
    const tenantId = requireTenantId(user);
    const matricula = await this.prisma.matricula.findFirst({
      where: { id: matriculaId, tenantId },
      include: {
        formando: { select: { userId: true } },
        turma: { select: { acaoFormacao: { select: { cursoId: true, id: true } } } },
      },
    });
    if (!matricula) throw new NotFoundException("Matrícula não encontrada.");

    const isGestor = canManageFormacao(user.role);
    if (user.role === "formador") {
      await this.formadorScope.assertCanLiberarModuloNaAcao(
        user,
        matricula.turma.acaoFormacao.id,
        unidadeId,
      );
    } else if (!isGestor) {
      throw new ForbiddenException(
        "Só o gestor da entidade ou o formador da sessão (módulo leccionado) podem libertar o módulo.",
      );
    }

    const unidade = await this.prisma.moduloUnidade.findFirst({
      where: { id: unidadeId, tenantId, cursoId: matricula.turma.acaoFormacao.cursoId },
    });
    if (!unidade) throw new NotFoundException("Módulo não encontrado neste curso.");
    if (!unidade.lockManual) {
      throw new BadRequestException("Este módulo não tem lock manual activo.");
    }

    return this.prisma.matriculaUnidadeDesbloqueio.upsert({
      where: {
        matriculaId_moduloUnidadeId: { matriculaId, moduloUnidadeId: unidadeId },
      },
      create: {
        tenantId,
        matriculaId,
        moduloUnidadeId: unidadeId,
        desbloqueadoPorUserId: user.sub,
        motivo: motivo?.trim() || null,
      },
      update: {
        desbloqueadoPorUserId: user.sub,
        desbloqueadoEm: new Date(),
        motivo: motivo?.trim() || null,
      },
    });
  }

  async bloquearUnidadeMatricula(user: RequestUser, matriculaId: string, unidadeId: string) {
    const tenantId = requireTenantId(user);
    if (!canManageFormacao(user.role)) {
      throw new ForbiddenException("Só o gestor pode voltar a bloquear o módulo.");
    }
    await this.assertMatriculaAccess(user, matriculaId, tenantId);
    await this.prisma.matriculaUnidadeDesbloqueio.deleteMany({
      where: { tenantId, matriculaId, moduloUnidadeId: unidadeId },
    });
  }

  private async assertMatriculaAccess(user: RequestUser, matriculaId: string, tenantId: string) {
    const matricula = await this.prisma.matricula.findFirst({
      where: { id: matriculaId, tenantId },
      include: {
        formando: { select: { userId: true } },
        turma: { select: { acaoFormacaoId: true } },
      },
    });
    if (!matricula) {
      throw new NotFoundException("Matrícula não encontrada.");
    }
    if (user.role === "formando" && matricula.formando.userId !== user.sub) {
      throw new ForbiddenException("Só podes ver o teu progresso.");
    }
    if (user.role === "formador") {
      await this.formadorScope.assertCanAccessAcao(user, matricula.turma.acaoFormacaoId);
    }
  }
}
