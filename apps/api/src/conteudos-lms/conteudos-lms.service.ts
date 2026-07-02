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
import { StorageService } from "../storage/storage.service";
import type { CreateModuloConteudoDto, CreateModuloUnidadeDto, UpdateModuloUnidadeDto, UpdateProgressoModuloDto } from "./dto/conteudos-lms.dto";
import {
  moduloDesbloqueado,
  notaMinimaParaDesbloquearProximo,
  pontuacaoModulo,
  pontuacaoTarefa,
  tarefaDesbloqueada,
  tarefasOrdenadas,
  unidadesOrdenadas,
  validarModuloConteudoCompleto,
} from "@nexiforma/shared";

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
      dto.conteudoHtml !== undefined ? dto.conteudoHtml?.trim() || null : existing.conteudoHtml,
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
      conteudoHtml: dto.conteudoHtml?.trim() || null,
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
        conteudoHtml: dto.conteudoHtml !== undefined ? dto.conteudoHtml?.trim() || null : undefined,
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

    return this.prisma.moduloConteudo.update({
      where: { id: moduloId },
      data: {
        urlOuRef: storageKey,
        titulo:
          modulo.titulo.startsWith("Novo ") ? tituloFromFileName(file.originalname) : modulo.titulo,
        metadata: {
          ...(typeof modulo.metadata === "object" && modulo.metadata ? modulo.metadata : {}),
          fileName: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          uploadedAt: new Date().toISOString(),
        },
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
    if (user.role === "tenant_manager") return;

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
              select: { dataFim: true, prazoConclusaoLms: true },
            },
          },
        },
      },
    });

    const [unidades, modulos, progressos] = await Promise.all([
      this.prisma.moduloUnidade.findMany({
        where: { tenantId, cursoId },
        orderBy: [{ ordem: "asc" }, { createdAt: "asc" }],
      }),
      this.prisma.moduloConteudo.findMany({
        where: { tenantId, cursoId, publicado: true },
        orderBy: [{ ordem: "asc" }, { createdAt: "asc" }],
      }),
      this.prisma.progressoModulo.findMany({
        where: { tenantId, matriculaId },
      }),
    ]);

    const progressoRows = progressos.map((p) => ({
      moduloId: p.moduloId,
      percentual: p.percentual,
      pontuacao: p.pontuacao,
      concluidoEm: p.concluidoEm,
    }));

    const unidadesOut = unidadesOrdenadas(unidades).map((u, idx) => {
      const anterior = idx > 0 ? unidadesOrdenadas(unidades)[idx - 1] : null;
      const pontuacao = pontuacaoModulo(modulos, progressoRows, u.id);
      const desbloqueado = moduloDesbloqueado(unidades, modulos, progressoRows, u.id);
      return {
        id: u.id,
        titulo: u.titulo,
        descricao: u.descricao,
        ordem: u.ordem,
        notaMinima: u.notaMinima,
        pontuacao,
        desbloqueado,
        notaMinimaAnterior: anterior ? notaMinimaParaDesbloquearProximo(anterior) : null,
        tituloModuloAnterior: anterior?.titulo ?? null,
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
        pontuacao: pontuacaoTarefa(progresso, m),
        percentual: prog?.percentual ?? 0,
        concluido: !!prog?.concluidoEm,
        desbloqueado: tarefaDesbloqueada(unidades, modulos, progressoRows, m.id),
      };
    });

    const total = tarefasOut.length;
    const concluidos = tarefasOut.filter((t) => t.concluido).length;
    const acao = matricula?.turma.acaoFormacao;
    const limite = acao?.prazoConclusaoLms ?? acao?.dataFim ?? null;
    const now = new Date();
    const msDia = 86_400_000;
    const diasRestantes =
      limite != null ? Math.ceil((limite.getTime() - now.getTime()) / msDia) : null;
    const percentualConclusao = total > 0 ? Math.round((concluidos / total) * 1000) / 10 : 0;
    const completo = total > 0 && concluidos >= total;
    const emAtraso = limite != null && now > limite && !completo;
    const cumpridoNoPrazo = completo && !emAtraso;

    return {
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

    return this.prisma.progressoModulo.upsert({
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
  }

  private async assertTarefaAcessivel(
    tenantId: string,
    matriculaId: string,
    modulo: ModuloConteudo,
  ): Promise<void> {
    const [unidades, modulos, progressos] = await Promise.all([
      this.prisma.moduloUnidade.findMany({ where: { tenantId, cursoId: modulo.cursoId } }),
      this.prisma.moduloConteudo.findMany({
        where: { tenantId, cursoId: modulo.cursoId, publicado: true },
      }),
      this.prisma.progressoModulo.findMany({ where: { tenantId, matriculaId } }),
    ]);

    const progressoRows = progressos.map((p) => ({
      moduloId: p.moduloId,
      percentual: p.percentual,
      pontuacao: p.pontuacao,
      concluidoEm: p.concluidoEm,
    }));

    if (!tarefaDesbloqueada(unidades, modulos, progressoRows, modulo.id)) {
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

  private async assertMatriculaAccess(user: RequestUser, matriculaId: string, tenantId: string) {
    const matricula = await this.prisma.matricula.findFirst({
      where: { id: matriculaId, tenantId },
      include: { formando: { select: { userId: true } } },
    });
    if (!matricula) {
      throw new NotFoundException("Matrícula não encontrada.");
    }
    if (user.role === "formando" && matricula.formando.userId !== user.sub) {
      throw new ForbiddenException("Só podes ver o teu progresso.");
    }
  }
}
