import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, type AcaoEstado } from "@nexiforma/database";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { FormadorScopeService } from "../common/formador-scope.service";
import { FormadorNotificacoesService } from "../notificacoes/formador-notificacoes.service";
import { requireTenantId } from "../common/tenant-scope";
import { StorageService } from "../storage/storage.service";
import { HtmlPdfExportService } from "../common/html-pdf-export.service";
import { opaqueStorageKey } from "../common/opaque-storage-key.util";
import { DocumentAccessAuditService } from "../audit/document-access-audit.service";
import { ComplianceService } from "../compliance/compliance.service";
import type { CreateAcaoFormacaoDto } from "./dto/create-acao-formacao.dto";
import type { UpdateAcaoFormacaoDto } from "./dto/update-acao-formacao.dto";
import {
  normalizeConfiguracaoMatriculaDocs,
  parseConfiguracaoMatriculaDocs,
} from "../formandos/documentos-politica.util";
import {
  ACAO_TEMPLATE_CATEGORIAS,
  isMatriculaDocCategoria,
  MATRICULA_DOC_CATEGORIAS,
  MATRICULA_DOC_LABELS,
  type MatriculaDocCategoria,
} from "../formandos/matricula-documentos.util";
import { defaultTemplateHtml } from "./acao-template-html.util";
import {
  injectTenantLogoIntoHtml,
  resolveTenantLogoDataUri,
} from "../common/tenant-logo-embed.util";
import { assertAllowedUpload } from "../common/upload-mime.util";
import { pautaTipo } from "../avaliacoes/pauta.util";
import { avaliarDocumentosObrigatorios } from "../formandos/formando-documentos.util";
import { resolveDocumentosPolitica } from "../formandos/documentos-politica.util";

function toPgDate(raw: string, field: string): Date {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException(`Data inválida (${field}).`);
  }
  return d;
}

const ESTADOS_CRIACAO: AcaoEstado[] = ["PLANEADA", "CANCELADA"];
const ESTADOS_PATCH: AcaoEstado[] = ["PLANEADA", "CANCELADA"];

@Injectable()
export class AcoesFormacaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly formadorScope: FormadorScopeService,
    private readonly formadorNotificacoes: FormadorNotificacoesService,
    private readonly storage: StorageService,
    private readonly htmlPdf: HtmlPdfExportService,
    private readonly documentAudit: DocumentAccessAuditService,
    private readonly compliance: ComplianceService,
  ) {}

  async list(user: RequestUser) {
    const tenantId = requireTenantId(user);
    const acaoIds = await this.formadorScope.assignedAcaoIds(user);
    return this.prisma.acaoFormacao.findMany({
      where: {
        tenantId,
        ...(acaoIds ? { id: { in: acaoIds } } : {}),
      },
      orderBy: { dataInicio: "desc" },
      take: 80,
      select: {
        id: true,
        codigoInterno: true,
        titulo: true,
        estado: true,
        dataInicio: true,
        dataFim: true,
        curso: {
          select: { id: true, designacao: true, modalidade: true },
        },
        _count: { select: { turmas: true } },
      },
    });
  }

  async create(user: RequestUser, dto: CreateAcaoFormacaoDto): Promise<unknown> {
    const tenantId = requireTenantId(user);

    const curso = await this.prisma.curso.findFirst({
      where: { id: dto.cursoId, tenantId },
    });
    if (!curso) {
      throw new NotFoundException("Curso inexistente ou de outro tenant.");
    }

    const clash = await this.prisma.acaoFormacao.findFirst({
      where: { tenantId, codigoInterno: dto.codigoInterno.trim() },
    });
    if (clash) {
      throw new ConflictException("Este código interno já está a ser usado no tenant.");
    }

    let estado: AcaoEstado = "PLANEADA";
    if (dto.estado) {
      const u = dto.estado.toUpperCase() as AcaoEstado;
      if (!ESTADOS_CRIACAO.includes(u)) {
        throw new BadRequestException(
          "Estado inválido na criação. Use PLANEADA (Em curso/Concluída são automáticos ou manuais dedicados).",
        );
      }
      estado = u;
    }

    const dataInicio = toPgDate(dto.dataInicio, "dataInicio");
    const dataFim = toPgDate(dto.dataFim, "dataFim");
    if (dataFim.getTime() < dataInicio.getTime()) {
      throw new BadRequestException("dataFim deve ser igual ou posterior a dataInicio.");
    }

    const cursoCfg = parseConfiguracaoMatriculaDocs(curso.configuracaoMatricula);
    const acao = await this.prisma.acaoFormacao.create({
      data: {
        tenantId,
        cursoId: dto.cursoId,
        codigoInterno: dto.codigoInterno.trim(),
        titulo: dto.titulo,
        dataInicio,
        dataFim,
        estado,
        ...(cursoCfg
          ? {
              configuracaoMatricula: normalizeConfiguracaoMatriculaDocs(
                cursoCfg,
              ) as Prisma.InputJsonValue,
            }
          : {}),
      },
      include: {
        curso: { select: { id: true, designacao: true, modalidade: true } },
      },
    });
    void this.formadorNotificacoes.notifyAcaoCrud(
      tenantId,
      acao.id,
      dto.cursoId,
      acao.titulo,
      "criada",
    );
    return acao;
  }

  async getOne(user: RequestUser, id: string): Promise<unknown> {
    const tenantId = requireTenantId(user);
    await this.formadorScope.assertCanAccessAcao(user, id);
    const acao = await this.prisma.acaoFormacao.findFirst({
      where: { id, tenantId },
      include: {
        curso: true,
        turmas: {
          orderBy: { codigo: "asc" },
          include: { _count: { select: { matriculas: true } } },
        },
        cronogramas: {
          orderBy: { versao: "desc" },
          include: { _count: { select: { sessoes: true } } },
        },
        _count: { select: { turmas: true } },
      },
    });
    if (!acao) {
      throw new NotFoundException("Acção de formação não encontrada.");
    }
    return acao;
  }

  async update(user: RequestUser, id: string, dto: UpdateAcaoFormacaoDto): Promise<unknown> {
    const tenantId = requireTenantId(user);
    const existing = await this.prisma.acaoFormacao.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new NotFoundException("Acção de formação não encontrada.");
    }

    const dataInicio = dto.dataInicio ? toPgDate(dto.dataInicio, "dataInicio") : existing.dataInicio;
    const dataFim = dto.dataFim ? toPgDate(dto.dataFim, "dataFim") : existing.dataFim;
    if (dataFim.getTime() < dataInicio.getTime()) {
      throw new BadRequestException("dataFim deve ser igual ou posterior a dataInicio.");
    }

    let prazoConclusaoLms = existing.prazoConclusaoLms;
    if (dto.prazoConclusaoLms !== undefined) {
      prazoConclusaoLms = dto.prazoConclusaoLms
        ? toPgDate(dto.prazoConclusaoLms, "prazoConclusaoLms")
        : null;
    }
    if (prazoConclusaoLms && prazoConclusaoLms.getTime() < dataInicio.getTime()) {
      throw new BadRequestException(
        "prazoConclusaoLms deve ser igual ou posterior a dataInicio.",
      );
    }

    let estado = existing.estado;
    if (dto.estado) {
      if (dto.estado === "CONCLUIDA") {
        throw new BadRequestException(
          "Para marcar como Concluída use POST /acoes-formacao/:id/concluir (após sessões, tarefas e compliance DGERT).",
        );
      }
      if (dto.estado === "EM_CURSO") {
        throw new BadRequestException(
          "O estado Em curso é definido automaticamente quando a primeira sessão é iniciada.",
        );
      }
      if (!ESTADOS_PATCH.includes(dto.estado)) {
        throw new BadRequestException("Estado de ação inválido.");
      }
      if (existing.estado === "CONCLUIDA") {
        throw new BadRequestException(
          "Uma acção concluída não pode voltar a outro estado por este endpoint.",
        );
      }
      estado = dto.estado;
    }

    const acao = await this.prisma.acaoFormacao.update({
      where: { id },
      data: {
        ...(dto.titulo !== undefined ? { titulo: dto.titulo.trim() } : {}),
        dataInicio,
        dataFim,
        prazoConclusaoLms,
        estado,
        ...(dto.configuracaoMatricula !== undefined
          ? {
              configuracaoMatricula:
                dto.configuracaoMatricula === null
                  ? Prisma.DbNull
                  : (normalizeConfiguracaoMatriculaDocs({
                      ...parseConfiguracaoMatriculaDocs(existing.configuracaoMatricula),
                      ...(dto.configuracaoMatricula as object),
                    }) as Prisma.InputJsonValue),
            }
          : {}),
      },
      include: {
        curso: {
          select: {
            id: true,
            designacao: true,
            modalidade: true,
            codigoUfcd: true,
            cargaHoras: true,
            configuracaoMatricula: true,
          },
        },
      },
    });
    void this.formadorNotificacoes.notifyAcaoCrud(
      tenantId,
      acao.id,
      acao.cursoId,
      acao.titulo,
      "actualizada",
    );
    return acao;
  }

  /**
   * Lista bloqueios que impedem marcar a acção como concluída.
   */
  async getConclusaoProntidao(user: RequestUser, id: string) {
    const tenantId = requireTenantId(user);
    const blockers = await this.collectConclusaoBlockers(tenantId, id);
    return { ready: blockers.length === 0, blockers };
  }

  private async collectConclusaoBlockers(
    tenantId: string,
    id: string,
  ): Promise<Array<{ id: string; label: string }>> {
    const blockers: Array<{ id: string; label: string }> = [];
    const acao = await this.prisma.acaoFormacao.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        estado: true,
        cursoId: true,
        configuracaoMatricula: true,
      },
    });
    if (!acao) throw new NotFoundException("Acção de formação não encontrada.");
    if (acao.estado === "CANCELADA") {
      blockers.push({ id: "estado_cancelada", label: "Acção cancelada" });
      return blockers;
    }
    if (acao.estado === "CONCLUIDA") return blockers;
    if (acao.estado !== "EM_CURSO") {
      blockers.push({
        id: "estado",
        label: "A acção tem de estar Em curso para poder ser concluída",
      });
    }

    const cronograma = await this.prisma.cronograma.findFirst({
      where: { tenantId, acaoFormacaoId: id },
      orderBy: { versao: "desc" },
      select: {
        id: true,
        aprovadoEm: true,
        sessoes: {
          where: { estado: { not: "CANCELADA" } },
          select: {
            id: true,
            numeroSessao: true,
            estado: true,
            formadorId: true,
            sumarios: {
              select: { imutavel: true, assinadoEm: true, conteudo: true },
              take: 1,
              orderBy: { createdAt: "desc" },
            },
            folhasPresenca: {
              select: {
                turmaId: true,
                fechadaEm: true,
                validadaFormadorEm: true,
                aprovadaGestorEm: true,
              },
            },
          },
          orderBy: { numeroSessao: "asc" },
        },
      },
    });
    if (!cronograma) {
      blockers.push({ id: "cronograma", label: "Cronograma em falta" });
    } else if (!cronograma.aprovadoEm) {
      blockers.push({ id: "cronograma_aprovado", label: "Cronograma por aprovar" });
    }

    const sessoes = cronograma?.sessoes ?? [];
    if (!sessoes.length) {
      blockers.push({ id: "sessoes", label: "Sem sessões associadas" });
    }
    const sessoesPendentes = sessoes.filter((s) => s.estado !== "REALIZADA");
    if (sessoesPendentes.length) {
      blockers.push({
        id: "sessoes_pendentes",
        label: `${sessoesPendentes.length} sessão(ões) por efectuar`,
      });
    }

    const turmas = await this.prisma.turma.findMany({
      where: { tenantId, acaoFormacaoId: id },
      select: {
        id: true,
        codigo: true,
        _count: { select: { matriculas: { where: { estado: "ATIVA" } } } },
      },
    });
    const turmasComInscritos = turmas.filter((t) => (t._count.matriculas ?? 0) > 0);

    for (const s of sessoes.filter((x) => x.estado === "REALIZADA")) {
      const sum = s.sumarios[0];
      if (!sum || (!sum.imutavel && (sum.conteudo?.length ?? 0) < 10)) {
        blockers.push({
          id: `sumario_${s.id}`,
          label: `Sumário por validar (sessão ${s.numeroSessao})`,
        });
      } else if (!sum.imutavel || !sum.assinadoEm) {
        blockers.push({
          id: `sumario_assin_${s.id}`,
          label: `Sumário por assinar (sessão ${s.numeroSessao})`,
        });
      }
      for (const t of turmasComInscritos) {
        const folha = s.folhasPresenca.find((f) => f.turmaId === t.id);
        const fechada =
          Boolean(folha?.fechadaEm) ||
          Boolean(folha?.validadaFormadorEm && folha?.aprovadaGestorEm);
        if (!folha || !fechada) {
          blockers.push({
            id: `folha_${s.id}_${t.id}`,
            label: `Folha de presença por validar/aprovar (sessão ${s.numeroSessao}, turma ${t.codigo})`,
          });
        }
      }
    }

    const tarefas = await this.prisma.moduloConteudo.findMany({
      where: { tenantId, cursoId: acao.cursoId, publicado: true },
      select: { id: true },
    });
    if (tarefas.length) {
      const matriculas = await this.prisma.matricula.findMany({
        where: { tenantId, estado: "ATIVA", turma: { acaoFormacaoId: id } },
        select: { id: true, formando: { select: { nome: true } } },
      });
      const tarefaIds = tarefas.map((t) => t.id);
      for (const m of matriculas) {
        const concluidos = await this.prisma.progressoModulo.count({
          where: {
            tenantId,
            matriculaId: m.id,
            moduloId: { in: tarefaIds },
            concluidoEm: { not: null },
          },
        });
        if (concluidos < tarefaIds.length) {
          blockers.push({
            id: `tarefas_${m.id}`,
            label: `Tarefas LMS incompletas: ${m.formando.nome} (${concluidos}/${tarefaIds.length})`,
          });
        }
      }
    }

    const modulos = await this.prisma.moduloUnidade.findMany({
      where: { tenantId, cursoId: acao.cursoId },
      select: { id: true },
    });
    if (modulos.length) {
      const matriculas = await this.prisma.matricula.findMany({
        where: { tenantId, estado: "ATIVA", turma: { acaoFormacaoId: id } },
        select: { id: true },
      });
      if (matriculas.length) {
        const tipos = modulos.map((m) => pautaTipo(m.id));
        const notas = await this.prisma.avaliacaoFormando.findMany({
          where: {
            tenantId,
            matriculaId: { in: matriculas.map((m) => m.id) },
            tipo: { in: tipos },
            nota: { not: null },
          },
          select: { matriculaId: true, tipo: true },
        });
        const filled = new Set(notas.map((n) => `${n.matriculaId}:${n.tipo}`));
        let missing = 0;
        for (const m of matriculas) {
          for (const mod of modulos) {
            if (!filled.has(`${m.id}:${pautaTipo(mod.id)}`)) missing += 1;
          }
        }
        if (missing > 0) {
          blockers.push({
            id: "pauta",
            label: `Notas da pauta por atribuir (${missing} célula(s))`,
          });
        }
      }
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { metadata: true },
    });
    const politica = resolveDocumentosPolitica({
      tenantMetadata: tenant?.metadata,
      acaoConfig: acao.configuracaoMatricula,
    });
    const matriculasDocs = await this.prisma.matricula.findMany({
      where: { tenantId, estado: "ATIVA", turma: { acaoFormacaoId: id } },
      select: {
        id: true,
        formando: {
          select: {
            id: true,
            nome: true,
            user: {
              select: {
                rgpdConsent: { select: { userAccepted: true, userDecidedAt: true } },
              },
            },
          },
        },
        documentosMatricula: {
          select: { categoria: true, estado: true, aceiteEm: true },
        },
      },
    });
    for (const m of matriculasDocs) {
      const consentOk = m.formando.user?.rgpdConsent?.userAccepted === true;
      if (m.formando.user && !consentOk) {
        blockers.push({
          id: `consent_${m.id}`,
          label: `Consentimento RGPD em falta: ${m.formando.nome}`,
        });
      }
      for (const cat of politica.inscricaoObrigatorios) {
        const row = m.documentosMatricula.find((d) => d.categoria === cat);
        if (!row || (row.estado !== "aceite" && !row.aceiteEm)) {
          blockers.push({
            id: `doc_mat_${m.id}_${cat}`,
            label: `Documento de inscrição por entregar/aceitar (${m.formando.nome})`,
          });
          break;
        }
      }
      const univDocs = await this.prisma.documentoAnexo.findMany({
        where: { tenantId, formandoId: m.formando.id, matriculaId: null },
        select: { categoria: true, lado: true },
      });
      const univ = avaliarDocumentosObrigatorios(univDocs, politica.universaisObrigatorios);
      if (!univ.completo) {
        blockers.push({
          id: `doc_univ_${m.formando.id}`,
          label: `Documentos pessoais obrigatórios em falta: ${m.formando.nome}`,
        });
      }
    }

    const formadorIds = [
      ...new Set(sessoes.map((s) => s.formadorId).filter((x): x is string => Boolean(x))),
    ];
    for (const formadorId of formadorIds) {
      const formador = await this.prisma.formadorProfile.findFirst({
        where: { id: formadorId, tenantId },
        select: {
          id: true,
          nomeCompleto: true,
          user: {
            select: {
              rgpdConsent: { select: { userAccepted: true } },
            },
          },
        },
      });
      if (!formador) continue;
      if (formador.user?.rgpdConsent?.userAccepted !== true) {
        blockers.push({
          id: `consent_f_${formador.id}`,
          label: `Consentimento RGPD em falta: formador ${formador.nomeCompleto}`,
        });
      }
      const docs = await this.prisma.documentoAnexo.findMany({
        where: { tenantId, formadorId: formador.id },
        select: { categoria: true, lado: true },
      });
      const univ = avaliarDocumentosObrigatorios(docs, politica.universaisObrigatorios);
      if (!univ.completo) {
        blockers.push({
          id: `doc_formador_${formador.id}`,
          label: `Documentos obrigatórios em falta: formador ${formador.nomeCompleto}`,
        });
      }
    }

    const compliance = await this.compliance.getByAcaoForTenant(tenantId, id);
    if (!compliance.checklist.prontoInspecao) {
      const pend = compliance.pendencias
        .filter((p) => p.severidade === "obrigatorio")
        .slice(0, 3)
        .map((p) => p.label);
      blockers.push({
        id: "compliance",
        label: `Compliance DGERT incompleta${pend.length ? `: ${pend.join("; ")}` : ""}`,
      });
    }

    const seen = new Set<string>();
    return blockers
      .filter((b) => {
        if (seen.has(b.id)) return false;
        seen.add(b.id);
        return true;
      })
      .slice(0, 40);
  }

  /**
   * Confirmação manual de conclusão (gestor / coord. pedagógico).
   * Exige folhas aprovadas, sumários assinados, pauta, tarefas, docs e DGERT.
   */
  async concluir(user: RequestUser, id: string) {
    const tenantId = requireTenantId(user);
    const acao = await this.prisma.acaoFormacao.findFirst({
      where: { id, tenantId },
      select: { id: true, estado: true, cursoId: true, titulo: true, codigoInterno: true },
    });
    if (!acao) {
      throw new NotFoundException("Acção de formação não encontrada.");
    }
    if (acao.estado === "CONCLUIDA") {
      return { ok: true, alreadyConcluded: true, estado: "CONCLUIDA" as const };
    }

    const blockers = await this.collectConclusaoBlockers(tenantId, id);
    if (blockers.length) {
      throw new BadRequestException(
        `Ainda há pendências para concluir a acção: ${blockers
          .slice(0, 5)
          .map((b) => b.label)
          .join("; ")}.`,
      );
    }

    const updated = await this.prisma.acaoFormacao.update({
      where: { id },
      data: { estado: "CONCLUIDA" },
      select: { id: true, estado: true, codigoInterno: true, titulo: true },
    });

    void this.formadorNotificacoes.notifyAcaoCrud(
      tenantId,
      updated.id,
      acao.cursoId,
      updated.titulo,
      "actualizada",
    );

    return { ok: true, alreadyConcluded: false, ...updated };
  }

  /** Resumo documental da acção (obrigatórios + formandos + formadores). */
  async documentosResumo(user: RequestUser, acaoId: string) {
    const tenantId = requireTenantId(user);
    await this.formadorScope.assertCanAccessAcao(user, acaoId);
    const acao = await this.prisma.acaoFormacao.findFirst({
      where: { id: acaoId, tenantId },
      select: { id: true, configuracaoMatricula: true },
    });
    if (!acao) throw new NotFoundException("Acção de formação não encontrada.");

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { metadata: true },
    });
    const politica = resolveDocumentosPolitica({
      tenantMetadata: tenant?.metadata,
      acaoConfig: acao.configuracaoMatricula,
    });
    const templates = await this.listTemplates(user, acaoId);

    const matriculas = await this.prisma.matricula.findMany({
      where: { tenantId, turma: { acaoFormacaoId: acaoId } },
      orderBy: { formando: { nome: "asc" } },
      select: {
        id: true,
        estado: true,
        turma: { select: { id: true, codigo: true, nome: true } },
        formando: {
          select: {
            id: true,
            nome: true,
            nif: true,
            user: {
              select: {
                rgpdConsent: { select: { userAccepted: true, userDecidedAt: true } },
              },
            },
          },
        },
        documentosMatricula: {
          select: {
            categoria: true,
            estado: true,
            aceiteEm: true,
            documentoAnexoId: true,
          },
        },
      },
    });

    const formandos = await Promise.all(
      matriculas.map(async (m) => {
        const pessoais = await this.prisma.documentoAnexo.findMany({
          where: { tenantId, formandoId: m.formando.id, matriculaId: null },
          select: { id: true, categoria: true, lado: true, nome: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        });
        const obrigatoriosPessoais = avaliarDocumentosObrigatorios(
          pessoais,
          politica.universaisObrigatorios,
        ).items;
        const obrigAcao = politica.inscricaoObrigatorios.map((cat) => {
          const row = m.documentosMatricula.find((d) => d.categoria === cat);
          return {
            categoria: cat,
            label: MATRICULA_DOC_LABELS[cat as MatriculaDocCategoria] ?? cat,
            estado: row?.estado ?? "pendente",
            aceiteEm: row?.aceiteEm ?? null,
            temFicheiro: Boolean(row?.documentoAnexoId),
          };
        });
        return {
          matriculaId: m.id,
          estado: m.estado,
          turma: m.turma,
          formando: {
            id: m.formando.id,
            nome: m.formando.nome,
            nif: m.formando.nif,
            consentimentoRgpd: m.formando.user?.rgpdConsent?.userAccepted === true,
            consentimentoEm: m.formando.user?.rgpdConsent?.userDecidedAt ?? null,
          },
          documentosAcao: obrigAcao,
          documentosPessoais: obrigatoriosPessoais,
          anexosPessoais: pessoais,
        };
      }),
    );

    const sessoes = await this.prisma.sessaoFormacao.findMany({
      where: {
        tenantId,
        estado: { not: "CANCELADA" },
        cronograma: { acaoFormacaoId: acaoId },
        formadorId: { not: null },
      },
      select: { formadorId: true },
    });
    const formadorIds = [
      ...new Set(sessoes.map((s) => s.formadorId).filter((x): x is string => Boolean(x))),
    ];
    const formadores = (
      await Promise.all(
        formadorIds.map(async (fid) => {
          const f = await this.prisma.formadorProfile.findFirst({
            where: { id: fid, tenantId },
            select: {
              id: true,
              nomeCompleto: true,
              nif: true,
              user: {
                select: {
                  rgpdConsent: { select: { userAccepted: true, userDecidedAt: true } },
                },
              },
            },
          });
          if (!f) return null;
          const pessoais = await this.prisma.documentoAnexo.findMany({
            where: { tenantId, formadorId: f.id },
            select: { id: true, categoria: true, lado: true, nome: true, createdAt: true },
            orderBy: { createdAt: "desc" },
          });
          return {
            id: f.id,
            nomeCompleto: f.nomeCompleto,
            nif: f.nif,
            consentimentoRgpd: f.user?.rgpdConsent?.userAccepted === true,
            consentimentoEm: f.user?.rgpdConsent?.userDecidedAt ?? null,
            documentosPessoais: avaliarDocumentosObrigatorios(
              pessoais,
              politica.universaisObrigatorios,
            ).items,
            documentosAcao: politica.inscricaoObrigatorios.map((cat) => ({
              categoria: cat,
              label: MATRICULA_DOC_LABELS[cat as MatriculaDocCategoria] ?? cat,
              templateDisponivel: templates.some(
                (t) => t.categoria === cat && Boolean(t.documento),
              ),
            })),
            anexos: pessoais,
          };
        }),
      )
    ).filter(Boolean);

    return {
      acaoId,
      politica: {
        inscricaoObrigatorios: politica.inscricaoObrigatorios,
        universaisObrigatorios: politica.universaisObrigatorios,
      },
      documentosAcao: templates,
      formandos,
      formadores,
    };
  }

  async listTemplates(user: RequestUser, acaoId: string) {
    const tenantId = requireTenantId(user);
    await this.formadorScope.assertCanAccessAcao(user, acaoId);
    const acao = await this.prisma.acaoFormacao.findFirst({
      where: { id: acaoId, tenantId },
      select: {
        id: true,
        titulo: true,
        codigoInterno: true,
        configuracaoMatricula: true,
        curso: { select: { cargaHoras: true } },
      },
    });
    if (!acao) throw new NotFoundException("Acção de formação não encontrada.");
    const cfg = parseConfiguracaoMatriculaDocs(acao.configuracaoMatricula);
    const docs = await this.prisma.documentoAnexo.findMany({
      where: {
        tenantId,
        acaoFormacaoId: acaoId,
        categoria: { in: Object.values(ACAO_TEMPLATE_CATEGORIAS) },
        formandoId: null,
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        nome: true,
        categoria: true,
        mimeType: true,
        tamanhoBytes: true,
        createdAt: true,
      },
    });
    const byCat = new Map(docs.map((d) => [d.categoria ?? "", d]));
    return MATRICULA_DOC_CATEGORIAS.map((cat) => {
      const templateCat = ACAO_TEMPLATE_CATEGORIAS[cat];
      const doc = byCat.get(templateCat) ?? null;
      return {
        categoria: cat,
        templateCategoria: templateCat,
        label: MATRICULA_DOC_LABELS[cat],
        obrigatorio: (cfg?.inscricaoObrigatorios ?? MATRICULA_DOC_CATEGORIAS).includes(cat),
        conteudoHtml: cfg?.templatesConteudo?.[cat] ?? null,
        documento: doc,
      };
    });
  }

  async uploadTemplate(
    user: RequestUser,
    acaoId: string,
    categoria: string,
    file: Express.Multer.File,
  ) {
    const tenantId = requireTenantId(user);
    if (!isMatriculaDocCategoria(categoria)) {
      throw new BadRequestException("Categoria de template inválida.");
    }
    try {
      assertAllowedUpload(file);
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : "Ficheiro inválido.");
    }
    if (file.mimetype !== "application/pdf") {
      throw new BadRequestException("O template deve ser um PDF.");
    }
    const acao = await this.prisma.acaoFormacao.findFirst({
      where: { id: acaoId, tenantId },
      select: { id: true },
    });
    if (!acao) throw new NotFoundException("Acção de formação não encontrada.");

    const templateCat = ACAO_TEMPLATE_CATEGORIAS[categoria];
    const storageKey = opaqueStorageKey(["docs", tenantId, "tpl", acaoId]);
    await this.storage.putObject(storageKey, file.buffer, file.mimetype);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const prev = await tx.documentoAnexo.findMany({
          where: { tenantId, acaoFormacaoId: acaoId, categoria: templateCat, formandoId: null },
        });
        for (const p of prev) {
          await tx.documentoAnexo.delete({ where: { id: p.id } });
          await this.storage.deleteObject(p.storageKey).catch(() => undefined);
        }
        return tx.documentoAnexo.create({
          data: {
            tenantId,
            acaoFormacaoId: acaoId,
            categoria: templateCat,
            lado: "unico",
            nome: file.originalname || `${MATRICULA_DOC_LABELS[categoria]}.pdf`,
            storageKey,
            mimeType: file.mimetype,
            tamanhoBytes: file.size,
            createdByUserId: user.sub,
          },
          select: {
            id: true,
            nome: true,
            categoria: true,
            mimeType: true,
            tamanhoBytes: true,
            createdAt: true,
          },
        });
      });
    } catch (err) {
      await this.storage.deleteObject(storageKey);
      throw err;
    }
  }

  async gerarTemplatePdf(
    user: RequestUser,
    acaoId: string,
    body: { categoria: string; html?: string },
  ) {
    const tenantId = requireTenantId(user);
    if (!isMatriculaDocCategoria(body.categoria)) {
      throw new BadRequestException("Categoria inválida.");
    }
    const cat = body.categoria as MatriculaDocCategoria;
    const [acao, tenantMeta] = await Promise.all([
      this.prisma.acaoFormacao.findFirst({
        where: { id: acaoId, tenantId },
        select: {
          id: true,
          titulo: true,
          codigoInterno: true,
          configuracaoMatricula: true,
          curso: { select: { cargaHoras: true } },
        },
      }),
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { metadata: true },
      }),
    ]);
    if (!acao) throw new NotFoundException("Acção de formação não encontrada.");

    const cfg = parseConfiguracaoMatriculaDocs(acao.configuracaoMatricula) ?? {
      version: 1 as const,
      inscricaoObrigatorios: [...MATRICULA_DOC_CATEGORIAS],
    };
    const logoSrc = await resolveTenantLogoDataUri(this.storage, tenantMeta?.metadata);
    // Template persistido sem data-URI (evita base64 enorme / logo desatualizado).
    const templateHtml =
      body.html?.trim() ||
      cfg.templatesConteudo?.[cat] ||
      defaultTemplateHtml(cat, {
        tituloAcao: acao.titulo,
        codigoInterno: acao.codigoInterno,
        cargaHoras: acao.curso.cargaHoras,
        notas: cfg.notas,
      });
    const html = injectTenantLogoIntoHtml(templateHtml, logoSrc);

    const pdf = await this.htmlPdf.htmlToPdfBuffer(html);
    const nextCfg = normalizeConfiguracaoMatriculaDocs({
      ...cfg,
      templatesConteudo: { ...(cfg.templatesConteudo ?? {}), [cat]: templateHtml },
    });
    await this.prisma.acaoFormacao.update({
      where: { id: acaoId },
      data: { configuracaoMatricula: nextCfg as Prisma.InputJsonValue },
    });

    const fakeFile = {
      buffer: pdf,
      mimetype: "application/pdf",
      size: pdf.byteLength,
      originalname: `${MATRICULA_DOC_LABELS[cat]}.pdf`,
    } as Express.Multer.File;
    const doc = await this.uploadTemplate(user, acaoId, cat, fakeFile);
    return { documento: doc, conteudoHtml: html };
  }

  async streamTemplate(user: RequestUser, acaoId: string, categoria: string) {
    const tenantId = requireTenantId(user);
    await this.formadorScope.assertCanAccessAcao(user, acaoId);
    if (!isMatriculaDocCategoria(categoria)) {
      throw new BadRequestException("Categoria inválida.");
    }
    const templateCat = ACAO_TEMPLATE_CATEGORIAS[categoria];
    const doc = await this.prisma.documentoAnexo.findFirst({
      where: {
        tenantId,
        acaoFormacaoId: acaoId,
        categoria: templateCat,
        formandoId: null,
      },
      orderBy: { createdAt: "desc" },
    });
    if (!doc) throw new NotFoundException("Template PDF ainda não existe para este documento.");
    const obj = await this.storage.getObject(doc.storageKey);
    if (!obj) throw new NotFoundException("Ficheiro não encontrado no armazenamento.");
    await this.documentAudit.logDownload({
      user,
      tenantId,
      action: "document.download",
      resourceType: "DocumentoAnexo",
      resourceId: doc.id,
      channel: "stream",
      payload: { nome: doc.nome, acaoFormacaoId: acaoId, template: true },
    });
    return { body: obj.body, contentType: doc.mimeType || obj.contentType, nome: doc.nome };
  }
}
