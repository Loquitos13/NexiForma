import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@nexiforma/database";
import { isModalidadeOnline } from "@nexiforma/shared";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "../common/tenant-scope";
import type {
  AnalisarCronogramaIaDto,
  AplicarCronogramaIaDto,
  GuardarRascunhoImportIaDto,
} from "./dto/importar-cronograma-ia.dto";
import {
  extrairSessoesDeHtmlCalendario,
  fundirDrafts,
  sanitizarTextoLegivel,
} from "./cronograma-import-calendario.util";
import {
  extractPdfLayoutFromTexto,
  extrairSessoesDeGrelhaPdf,
} from "./cronograma-import-grelha.util";
import {
  condensarTextoCronograma,
  extrairSessoesHeuristica,
  matchModulo,
  materiaFromTituloModulo,
  normalizarImportDraft,
  parseLlmJsonResponse,
  sanitizarCampoTexto,
  stripHtmlToText,
  type CronogramaImportDraft,
  type ModuloRef,
} from "./cronograma-import-ia.util";
import {
  validarCronogramaContraCurso,
  type ModuloCursoRef,
} from "./cronograma-validacao-curso.util";

/** Limite do texto enviado ao LLM - qwen 3B fica muito lento acima disto. */
const LLM_TEXTO_MAX_CHARS = 6_000;
/** Timeout LLM em background (parsers locais correm primeiro). */
const BACKGROUND_TIMEOUT_MS = 90_000;
/** Estados que ainda merecem aparecer como "chip" activo no portal. */
const ACTIVE_JOB_STATUSES = ["A_PROCESSAR", "RASCUNHO", "FALHA"] as const;

const JOB_SELECT = {
  id: true,
  cronogramaId: true,
  acaoFormacaoId: true,
  status: true,
  nomeFicheiro: true,
  resultado: true,
  erro: true,
  progresso: true,
  createdAt: true,
  updatedAt: true,
  concludedAt: true,
  acaoFormacao: { select: { codigoInterno: true, titulo: true } },
} as const;

/** Tipo portable (TS2742) - sem Prisma GetPayload / runtime/library. */
export type CronogramaImportJobSummary = {
  id: string;
  cronogramaId: string;
  acaoFormacaoId: string;
  status: string;
  nomeFicheiro: string | null;
  resultado: unknown;
  erro: string | null;
  progresso: number;
  createdAt: Date;
  updatedAt: Date;
  concludedAt: Date | null;
  acaoFormacao: { codigoInterno: string; titulo: string } | null;
};

function toPgDate(raw: string, field: string): Date {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException(`Data inválida (${field}).`);
  }
  return d;
}

function compareHhMm(a: string, b: string): number {
  const [ah, am] = a.split(":").map(Number);
  const [bh, bm] = b.split(":").map(Number);
  return ah * 60 + am - (bh * 60 + bm);
}

const SYSTEM_PROMPT = `És um extrator de cronogramas de formação profissional (DGERT/Portugal).
Recebes o texto de um cronograma (grelha calendário + LEGENDA de módulos/códigos/cores/horários).
A LEGENDA é a fonte de verdade: cada código no diagrama (M1, M2, M3/M4, FPA (4h), etc.) mapeia para o módulo/modalidade descrito na legenda.
Devolve APENAS JSON válido com este schema:
{
  "legendaResumo": "resumo curto da legenda (códigos → módulos/modalidades)",
  "prazoConclusaoLms": "YYYY-MM-DD ou null - prazo global LMS da acção",
  "prazosModulos": [
    { "data": "YYYY-MM-DD", "moduloCodigo": "M1", "moduloTitulo": "..." }
  ],
  "sessoes": [
    {
      "numeroSessao": 1,
      "data": "YYYY-MM-DD",
      "horaInicio": "HH:mm",
      "horaFim": "HH:mm",
      "modalidade": "presencial|online|b-learning",
      "assincrona": false,
      "moduloCodigo": "código da legenda ou null",
      "moduloTitulo": "nome do módulo se conhecido",
      "formadorNome": "nome do formador se conhecido",
      "notas": "opcional"
    }
  ]
}
Regras:
- Lê primeiro a LEGENDA; depois percorre a grelha dia-a-dia e interpreta cada célula com essa legenda.
- Códigos típicos: M1, M2, M3/M4 (aula presencial dos módulos 3 e 4), sessões síncronas, auto-aprendizagem.
- Horário da linha ("das 9:00 às 13:00") aplica-se às células dessa faixa.
- Sessões = consolidação de módulos: presencial em sala e vídeo-conferência/síncrona.
- NÃO cries sessões para e-learning/auto-aprendizagem nem para datas limite de avaliação (vermelho na legenda).
- Em prazosModulos: para cada módulo, a data limite de avaliação/entrega LMS (vermelho / fim do bloco auto-aprendizagem).
- Presencial → "presencial"; síncrona/vídeo → "online" (assincrona=false).
- Datas: dia da coluna + mês (Agosto/Setembro) + ano do cabeçalho.
- Ignora dias vazios. Datas em ISO. Não inventes sessões sem evidência.
- Prefere códigos de módulo da lista fornecida no contexto.`;

@Injectable()
export class CronogramaImportIaService {
  private readonly logger = new Logger(CronogramaImportIaService.name);
  private readonly enabled: boolean;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  /** Evita reprocessar o mesmo job em duplicado (ex.: pedido duplicado a chegar em simultâneo). */
  private readonly runningJobs = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.enabled = this.config.get<string>("NEXIGUIA_LLM_ENABLED") === "true";
    // Docker Compose mapeia Ollama para 11435 (11434 costuma ser Ollama nativo vazio no Windows).
    this.baseUrl = (this.config.get<string>("NEXIGUIA_LLM_URL") ?? "http://127.0.0.1:11435").replace(
      /\/$/,
      "",
    );
    this.model = this.config.get<string>("NEXIGUIA_LLM_MODEL") ?? "qwen2.5:1.5b-instruct";
    const rawTimeout = Number(this.config.get<string>("NEXIGUIA_LLM_IMPORT_TIMEOUT_MS") ?? "180000");
    this.timeoutMs = Number.isFinite(rawTimeout) && rawTimeout > 0 ? rawTimeout : 180_000;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /** Cria o job em background e devolve de imediato (A_PROCESSAR). */
  async iniciarJob(
    user: RequestUser,
    cronogramaId: string,
    dto: AnalisarCronogramaIaDto,
  ): Promise<CronogramaImportJobSummary> {
    const tenantId = requireTenantId(user);
    const cronograma = await this.prisma.cronograma.findFirst({
      where: { id: cronogramaId, tenantId },
      select: { id: true, acaoFormacaoId: true, aprovadoEm: true },
    });
    if (!cronograma) throw new NotFoundException("Cronograma não encontrado.");
    if (cronograma.aprovadoEm) {
      throw new BadRequestException(
        "Cronograma já aprovado - crie uma nova versão antes de importar.",
      );
    }

    const textoRaw = dto.texto?.trim() ?? "";
    const { items: layoutPreview, textoPlano } = extractPdfLayoutFromTexto(textoRaw);
    let texto = textoPlano;
    if (texto.includes("<") && texto.includes(">")) {
      texto = stripHtmlToText(texto);
    }
    // Reembute layout (coordenadas PDF) - necessário para o parser de grelha.
    const textoComLayout =
      layoutPreview?.length && textoRaw.includes("@@NEXIFORMA_PDF_LAYOUT_V1@@")
        ? textoRaw
        : texto;
    if (texto.length < 40 && !(layoutPreview && layoutPreview.length >= 20)) {
      throw new BadRequestException("Texto do cronograma demasiado curto para analisar.");
    }

    // Um só job activo por cronograma - evita chips/rascunhos duplicados ao reimportar.
    await this.prisma.cronogramaImportJob.updateMany({
      where: {
        tenantId,
        cronogramaId,
        status: { in: ["A_PROCESSAR", "RASCUNHO", "FALHA"] },
      },
      data: {
        status: "DESCARTADO",
        textoFonte: null,
        concludedAt: new Date(),
      },
    });

    const job = await this.prisma.cronogramaImportJob.create({
      data: {
        tenantId,
        cronogramaId,
        acaoFormacaoId: cronograma.acaoFormacaoId,
        criadoPorUserId: user.sub,
        status: "A_PROCESSAR",
        nomeFicheiro: dto.nomeFicheiro ?? null,
        textoFonte: textoComLayout,
        progresso: 5,
      },
      select: JOB_SELECT,
    });

    // Dispara o processamento em background - não bloqueia o pedido HTTP.
    void this.processJob(job.id);

    return job;
  }

  /**
   * Compat: /analisar já não bloqueia 180s+ (causava HTTP 504 + alerta).
   * Devolve o job em background - o cliente deve fazer poll em /importar-ia/jobs/:id.
   */
  async analisar(
    user: RequestUser,
    cronogramaId: string,
    dto: AnalisarCronogramaIaDto,
  ): Promise<CronogramaImportJobSummary> {
    return this.iniciarJob(user, cronogramaId, dto);
  }

  async listJobs(
    user: RequestUser,
    filtro: { acaoFormacaoId?: string; cronogramaId?: string; ativos?: boolean } = {},
  ): Promise<CronogramaImportJobSummary[]> {
    const tenantId = requireTenantId(user);
    const ativos = filtro.ativos ?? true;

    return this.prisma.cronogramaImportJob.findMany({
      where: {
        tenantId,
        criadoPorUserId: user.sub,
        ...(filtro.acaoFormacaoId ? { acaoFormacaoId: filtro.acaoFormacaoId } : {}),
        ...(filtro.cronogramaId ? { cronogramaId: filtro.cronogramaId } : {}),
        ...(ativos ? { status: { in: [...ACTIVE_JOB_STATUSES] } } : {}),
      },
      orderBy: { createdAt: "desc" },
      select: JOB_SELECT,
      take: 20,
    });
  }

  async getJob(user: RequestUser, jobId: string): Promise<CronogramaImportJobSummary> {
    const tenantId = requireTenantId(user);
    const job = await this.prisma.cronogramaImportJob.findFirst({
      where: { id: jobId, tenantId, criadoPorUserId: user.sub },
      select: JOB_SELECT,
    });
    if (!job) throw new NotFoundException("Job de importação não encontrado.");
    return job;
  }

  /** Guarda edições feitas ao rascunho antes de aplicar (mantém o job em RASCUNHO). */
  async guardarRascunho(
    user: RequestUser,
    jobId: string,
    dto: GuardarRascunhoImportIaDto,
  ): Promise<CronogramaImportJobSummary> {
    const tenantId = requireTenantId(user);
    const job = await this.prisma.cronogramaImportJob.findFirst({
      where: { id: jobId, tenantId, criadoPorUserId: user.sub },
      select: { id: true, status: true, cronogramaId: true },
    });
    if (!job) throw new NotFoundException("Job de importação não encontrado.");
    if (job.status !== "RASCUNHO" && job.status !== "FALHA") {
      throw new BadRequestException("Só é possível editar um rascunho pendente de aplicação.");
    }

    const resultado: CronogramaImportDraft = {
      sessoes: dto.sessoes.map((s) => ({
        numeroSessao: s.numeroSessao,
        data: s.data,
        horaInicio: s.horaInicio,
        horaFim: s.horaFim,
        modalidade: s.modalidade,
        moduloUnidadeId: s.moduloUnidadeId ?? null,
        formadorId: s.formadorId ?? null,
        tituloModulo: sanitizarCampoTexto(s.tituloModulo) ?? null,
      })),
      prazoConclusaoLms: dto.prazoConclusaoLms ?? null,
      prazosModulos: (dto.prazosModulos ?? []).map((p) => ({
        data: p.data.slice(0, 10),
        moduloCodigo: p.moduloCodigo ?? null,
        moduloTitulo: p.moduloTitulo ?? null,
        moduloUnidadeId: p.moduloUnidadeId ?? null,
      })),
      avisos: dto.avisos ?? [],
      legendaResumo: dto.legendaResumo ?? null,
    };

    const ctx = await this.loadContext(tenantId, job.cronogramaId);
    const enriched = this.enrichDraftConformidade(resultado, ctx.modulosFull);

    return this.prisma.cronogramaImportJob.update({
      where: { id: jobId },
      data: {
        status: "RASCUNHO",
        resultado: enriched as unknown as Prisma.InputJsonValue,
        erro: null,
      },
      select: JOB_SELECT,
    });
  }

  async descartarJob(user: RequestUser, jobId: string): Promise<CronogramaImportJobSummary> {
    const tenantId = requireTenantId(user);
    const job = await this.prisma.cronogramaImportJob.findFirst({
      where: { id: jobId, tenantId, criadoPorUserId: user.sub },
      select: { id: true, cronogramaId: true },
    });
    if (!job) throw new NotFoundException("Job de importação não encontrado.");

    // Limpa também duplicados activos do mesmo cronograma (reimports antigos).
    await this.prisma.cronogramaImportJob.updateMany({
      where: {
        tenantId,
        cronogramaId: job.cronogramaId,
        criadoPorUserId: user.sub,
        status: { in: ["A_PROCESSAR", "RASCUNHO", "FALHA"] },
      },
      data: { status: "DESCARTADO", textoFonte: null, concludedAt: new Date() },
    });

    return this.prisma.cronogramaImportJob.findFirstOrThrow({
      where: { id: jobId },
      select: JOB_SELECT,
    });
  }

  /** Aplica o rascunho de um job (cria as sessões) e marca-o como APLICADO. */
  async aplicarJob(user: RequestUser, jobId: string, dto: AplicarCronogramaIaDto) {
    const tenantId = requireTenantId(user);
    const job = await this.prisma.cronogramaImportJob.findFirst({
      where: { id: jobId, tenantId, criadoPorUserId: user.sub },
      select: { id: true, cronogramaId: true, status: true },
    });
    if (!job) throw new NotFoundException("Job de importação não encontrado.");
    if (job.status === "APLICADO") {
      throw new BadRequestException("Este rascunho já foi aplicado.");
    }
    if (job.status === "DESCARTADO") {
      throw new BadRequestException("Este rascunho foi descartado.");
    }

    const resultado = await this.aplicar(user, job.cronogramaId, dto);

    await this.prisma.cronogramaImportJob.update({
      where: { id: jobId },
      data: { status: "APLICADO", textoFonte: null, concludedAt: new Date() },
    });

    return resultado;
  }

  async aplicar(user: RequestUser, cronogramaId: string, dto: AplicarCronogramaIaDto) {
    const tenantId = requireTenantId(user);
    const cronograma = await this.prisma.cronograma.findFirst({
      where: { id: cronogramaId, tenantId },
      select: {
        id: true,
        aprovadoEm: true,
        acaoFormacaoId: true,
      },
    });
    if (!cronograma) throw new NotFoundException("Cronograma não encontrado.");
    if (cronograma.aprovadoEm) {
      throw new BadRequestException(
        "Cronograma já aprovado - crie uma nova versão antes de importar.",
      );
    }

    let turmaIdAlvo = dto.turmaId ?? null;
    if (turmaIdAlvo) {
      const turmaOk = await this.prisma.turma.findFirst({
        where: {
          id: turmaIdAlvo,
          tenantId,
          acaoFormacaoId: cronograma.acaoFormacaoId,
        },
        select: { id: true },
      });
      if (!turmaOk) {
        throw new BadRequestException("Turma inválida para esta acção.");
      }
    } else {
      const primeira = await this.prisma.turma.findFirst({
        where: { tenantId, acaoFormacaoId: cronograma.acaoFormacaoId },
        orderBy: { codigo: "asc" },
        select: { id: true },
      });
      if (!primeira) {
        throw new BadRequestException("Crie pelo menos uma turma antes de importar sessões.");
      }
      turmaIdAlvo = primeira.id;
    }

    const existentesTurma = await this.prisma.sessaoFormacao.count({
      where: { tenantId, cronogramaId, turmaId: turmaIdAlvo },
    });
    if (existentesTurma > 0 && dto.substituirExistentes) {
      await this.prisma.sessaoFormacao.deleteMany({
        where: { tenantId, cronogramaId, turmaId: turmaIdAlvo },
      });
    } else if (existentesTurma > 0 && dto.substituirExistentes === false) {
      // append - renumerar a partir do máximo nesta turma
    } else if (existentesTurma > 0) {
      throw new ConflictException(
        `Já existem ${existentesTurma} sessões nesta turma. Confirme substituirExistentes=true ou false (acrescentar).`,
      );
    }

    let offset = 0;
    if (existentesTurma > 0 && dto.substituirExistentes === false) {
      const agg = await this.prisma.sessaoFormacao.aggregate({
        where: { cronogramaId, turmaId: turmaIdAlvo },
        _max: { numeroSessao: true },
      });
      offset = agg._max.numeroSessao ?? 0;
    }

    const ctx = await this.loadContext(tenantId, cronogramaId);
    const modulos = ctx.modulosFull;

    const resolvedSessoes = dto.sessoes.map((s) => {
      let moduloUnidadeId = s.moduloUnidadeId ?? null;
      if (!moduloUnidadeId) {
        const materia = materiaFromTituloModulo(s.tituloModulo);
        const mod =
          matchModulo(modulos, s.moduloCodigo, s.tituloModulo) ??
          (materia ? matchModulo(modulos, s.moduloCodigo, materia) : null);
        if (mod) moduloUnidadeId = mod.id;
      }
      const titulo =
        (moduloUnidadeId
          ? (modulos.find((m) => m.id === moduloUnidadeId)?.titulo ?? null)
          : null) ??
        sanitizarCampoTexto(s.tituloModulo);
      return { ...s, moduloUnidadeId, titulo };
    });

    const formadorIds = [
      ...new Set(resolvedSessoes.map((s) => s.formadorId).filter((id): id is string => !!id)),
    ];
    const moduloIds = [
      ...new Set(resolvedSessoes.map((s) => s.moduloUnidadeId).filter((id): id is string => !!id)),
    ];
    if (formadorIds.length) {
      const n = await this.prisma.formadorProfile.count({
        where: { tenantId, id: { in: formadorIds } },
      });
      if (n !== formadorIds.length) {
        throw new BadRequestException("Um ou mais formadores são inválidos para este tenant.");
      }
    }
    if (moduloIds.length) {
      const n = await this.prisma.moduloUnidade.count({
        where: { tenantId, id: { in: moduloIds }, cursoId: ctx.acao.cursoId },
      });
      if (n !== moduloIds.length) {
        throw new BadRequestException(
          "Um ou mais módulos não pertencem ao curso desta acção. Configure os módulos no curso.",
        );
      }
    }

    const conformidade = validarCronogramaContraCurso(
      resolvedSessoes.map((s) => ({
        numeroSessao: s.numeroSessao,
        data: s.data,
        horaInicio: s.horaInicio,
        horaFim: s.horaFim,
        modalidade: s.modalidade,
        moduloUnidadeId: s.moduloUnidadeId ?? null,
        formadorId: s.formadorId ?? null,
        tituloModulo: s.tituloModulo ?? null,
      })),
      modulos,
    );
    if (conformidade.requerConfirmacao && !dto.confirmarDesalinhamento) {
      throw new BadRequestException(
        "O cronograma não está alinhado com os módulos/horas do curso. Revise o preview e confirme para aplicar.",
      );
    }

    const turmaId = turmaIdAlvo;

    const rows = resolvedSessoes.map((s) => {
      if (compareHhMm(s.horaFim, s.horaInicio) <= 0) {
        throw new BadRequestException(
          `Sessão ${s.numeroSessao}: horaFim deve ser depois de horaInicio.`,
        );
      }
      const modalidade = s.modalidade === "e-learning" ? "online" : s.modalidade;
      return {
        tenantId,
        cronogramaId,
        turmaId,
        numeroSessao: offset + s.numeroSessao,
        data: toPgDate(s.data, "data"),
        horaInicio: s.horaInicio,
        horaFim: s.horaFim,
        modalidade,
        formadorId: s.formadorId ?? null,
        moduloUnidadeId: s.moduloUnidadeId ?? null,
        titulo: s.titulo,
        lmsAtivo: isModalidadeOnline(modalidade),
      };
    });

    // Evita colisão de números se o cliente enviar duplicados
    const nums = new Set(rows.map((r) => r.numeroSessao));
    if (nums.size !== rows.length) {
      throw new BadRequestException("Números de sessão duplicados no pedido.");
    }

    await this.prisma.sessaoFormacao.createMany({ data: rows });

    const criadas = await this.prisma.sessaoFormacao.findMany({
      where: {
        tenantId,
        cronogramaId,
        numeroSessao: { in: rows.map((r) => r.numeroSessao) },
      },
      orderBy: { numeroSessao: "asc" },
      select: { id: true, numeroSessao: true, data: true, modalidade: true },
    });

    let prazoActualizado: string | null = null;
    if (dto.actualizarPrazoLms && dto.prazoConclusaoLms) {
      await this.prisma.acaoFormacao.update({
        where: { id: cronograma.acaoFormacaoId },
        data: { prazoConclusaoLms: new Date(dto.prazoConclusaoLms) },
      });
      prazoActualizado = dto.prazoConclusaoLms.slice(0, 10);
    }

    let prazosModulosGravados = 0;
    const prazos = dto.prazosModulos ?? [];
    const aplicarPrazosMod =
      dto.actualizarPrazosModulos !== false && prazos.length > 0;
    if (aplicarPrazosMod) {
      const resolved = prazos
        .map((p) => {
          const data = p.data.slice(0, 10);
          let moduloUnidadeId = p.moduloUnidadeId ?? null;
          if (!moduloUnidadeId) {
            const mod = ctx.modulos.find(
              (m) =>
                (p.moduloCodigo &&
                  m.codigo &&
                  m.codigo.toLowerCase() === p.moduloCodigo.toLowerCase()) ||
                (p.moduloTitulo &&
                  m.titulo.toLowerCase().includes(p.moduloTitulo.toLowerCase().slice(0, 24))),
            );
            // M1 → procura código M1 ou título com "módulo 1"
            if (!mod && p.moduloCodigo) {
              const num = p.moduloCodigo.match(/^M(\d+)$/i)?.[1];
              if (num) {
                const byNum = ctx.modulos.find(
                  (m) =>
                    (m.codigo && new RegExp(`\\bM?0*${num}\\b`, "i").test(m.codigo)) ||
                    new RegExp(`m[oó]dulo\\s*0*${num}\\b`, "i").test(m.titulo),
                );
                if (byNum) moduloUnidadeId = byNum.id;
              }
            } else if (mod) {
              moduloUnidadeId = mod.id;
            }
          }
          return moduloUnidadeId ? { moduloUnidadeId, data } : null;
        })
        .filter((x): x is { moduloUnidadeId: string; data: string } => !!x);

      const prazoDb = (
        this.prisma as unknown as {
          acaoModuloPrazoLms?: {
            upsert: (args: unknown) => Promise<unknown>;
          };
        }
      ).acaoModuloPrazoLms;
      if (!prazoDb) {
        throw new Error(
          "Prisma client sem AcaoModuloPrazoLms - corre prisma generate e migrate deploy.",
        );
      }
      for (const p of resolved) {
        await prazoDb.upsert({
          where: {
            acaoFormacaoId_moduloUnidadeId: {
              acaoFormacaoId: cronograma.acaoFormacaoId,
              moduloUnidadeId: p.moduloUnidadeId,
            },
          },
          create: {
            tenantId,
            acaoFormacaoId: cronograma.acaoFormacaoId,
            moduloUnidadeId: p.moduloUnidadeId,
            prazoConclusao: new Date(p.data),
          },
          update: { prazoConclusao: new Date(p.data) },
        });
        prazosModulosGravados += 1;
      }

      const activarLock =
        dto.activarLockManualModulos !== false && resolved.length > 0;
      if (activarLock) {
        await this.prisma.moduloUnidade.updateMany({
          where: {
            tenantId,
            id: { in: [...new Set(resolved.map((r) => r.moduloUnidadeId))] },
          },
          data: { lockManual: true },
        });
      }

      // Prazo global da acção = o mais tarde entre prazos de módulo
      if (!prazoActualizado && resolved.length) {
        const maxData = resolved.map((r) => r.data).sort().at(-1)!;
        await this.prisma.acaoFormacao.update({
          where: { id: cronograma.acaoFormacaoId },
          data: { prazoConclusaoLms: new Date(maxData) },
        });
        prazoActualizado = maxData;
      }
    }

    return {
      criadas: criadas.length,
      sessoes: criadas,
      prazoConclusaoLms: prazoActualizado,
      prazosModulos: prazosModulosGravados,
    };
  }

  /** Processa o job em background: chama o LLM, normaliza o draft e grava RASCUNHO/FALHA. */
  private async processJob(jobId: string): Promise<void> {
    if (this.runningJobs.has(jobId)) return;
    this.runningJobs.add(jobId);
    try {
      const job = await this.prisma.cronogramaImportJob.findUnique({
        where: { id: jobId },
        select: {
          id: true,
          tenantId: true,
          cronogramaId: true,
          textoFonte: true,
          nomeFicheiro: true,
          status: true,
        },
      });
      if (!job || job.status !== "A_PROCESSAR" || !job.textoFonte) return;

      try {
        const ctx = await this.loadContext(job.tenantId, job.cronogramaId);

        const fonte = job.textoFonte;
        const { items: layoutItems, textoPlano: semLayout } = extractPdfLayoutFromTexto(fonte);
        const isHtml = /<table[\s>]/i.test(semLayout) || /<caption[\s>]/i.test(semLayout);
        const textoPlano =
          semLayout.includes("<") && semLayout.includes(">")
            ? stripHtmlToText(semLayout)
            : semLayout;
        const condensado = condensarTextoCronograma(textoPlano, LLM_TEXTO_MAX_CHARS);
        const parseOpts = {
          horarioInicio: ctx.horarioInicio,
          horarioFim: ctx.horarioFim,
          modulos: ctx.modulos,
        };

        await this.prisma.cronogramaImportJob.update({
          where: { id: jobId },
          data: { progresso: 20 },
        });

        // 1) Grelha PDF (legenda + dias)  2) HTML calendário  3) heurística - sem Ollama.
        // Se a grelha ler bem, NÃO misturar heurística (senão entram datas de matrícula/cabeçalho).
        const grelhaDraft = layoutItems?.length
          ? extrairSessoesDeGrelhaPdf(layoutItems, parseOpts)
          : null;
        const htmlDraft = isHtml
          ? extrairSessoesDeHtmlCalendario(semLayout, parseOpts)
          : null;
        const heuristic = extrairSessoesHeuristica(condensado, parseOpts);

        let draft: CronogramaImportDraft;
        let fonteParser = "heuristica";
        if (grelhaDraft && grelhaDraft.sessoes.length >= 3) {
          draft = grelhaDraft;
          fonteParser = "grelha-pdf";
        } else if (htmlDraft && htmlDraft.sessoes.length >= 1) {
          draft = fundirDrafts(htmlDraft, ...(grelhaDraft ? [grelhaDraft] : []));
          fonteParser = "html";
        } else if (grelhaDraft && grelhaDraft.sessoes.length >= 1) {
          draft = grelhaDraft;
          fonteParser = "grelha-pdf";
        } else {
          draft = fundirDrafts(
            ...(grelhaDraft ? [grelhaDraft] : []),
            ...(htmlDraft ? [htmlDraft] : []),
            heuristic,
          );
        }
        draft = {
          ...draft,
          legendaResumo: sanitizarTextoLegivel(draft.legendaResumo, 400),
        };
        draft = this.enrichDraftConformidade(draft, ctx.modulosFull);

        if (draft.sessoes.length >= 1) {
          this.logger.log(
            `Import job ${jobId}: ${draft.sessoes.length} sessões via ${fonteParser} (layout=${layoutItems?.length ?? 0}).`,
          );
          await this.prisma.cronogramaImportJob.update({
            where: { id: jobId },
            data: {
              status: "RASCUNHO",
              resultado: draft as unknown as Prisma.InputJsonValue,
              erro: null,
              progresso: 100,
              textoFonte: null,
              concludedAt: new Date(),
            },
          });
          return;
        }
        // 3) Fallback LLM só se parsers locais falharam e Ollama está activo.
        if (!this.enabled) {
          throw new Error(
            "Não foi possível ler sessões do documento. " +
              "Exporte o cronograma em HTML (Transferir no portal) ou TXT com datas e horas, " +
              "ou active NEXIGUIA_LLM_ENABLED para fallback IA.",
          );
        }

        await this.assertOllamaReachable();
        await this.prisma.cronogramaImportJob.update({
          where: { id: jobId },
          data: { progresso: 45 },
        });

        const userPrompt = [
          `Acção: ${ctx.acao.codigoInterno} - ${ctx.acao.titulo}`,
          `Período: ${ctx.acao.dataInicio} a ${ctx.acao.dataFim}`,
          `Horário: ${ctx.horarioInicio ?? "19:00"} – ${ctx.horarioFim ?? "23:00"}`,
          `Módulos:`,
          ...ctx.modulos.slice(0, 40).map((m) => `- ${m.codigo ?? "-"} | ${m.titulo}`),
          job.nomeFicheiro ? `Ficheiro: ${job.nomeFicheiro}` : "",
          ``,
          `CRONOGRAMA (resumo):`,
          condensado,
        ]
          .filter(Boolean)
          .join("\n");

        const timeoutMs = Math.min(Math.max(this.timeoutMs, 45_000), BACKGROUND_TIMEOUT_MS);
        const llmResult = await this.completeJson(SYSTEM_PROMPT, userPrompt, timeoutMs);

        if (llmResult.status !== "ok" || !llmResult.data) {
          throw new Error(
            llmResult.status === "timeout"
              ? `A IA excedeu ${Math.round(timeoutMs / 1000)}s. Prefira HTML exportado do portal (botão Transferir).`
              : `A IA não devolveu JSON válido. Prefira HTML/TXT com datas e horas explícitas.`,
          );
        }

        draft = normalizarImportDraft(llmResult.data, {
          modulos: ctx.modulos,
          formadores: ctx.formadores,
        });
        draft = {
          ...draft,
          legendaResumo: sanitizarTextoLegivel(draft.legendaResumo, 400),
        };

        if (!draft.sessoes.length) {
          throw new Error(
            "Não foi possível extrair sessões. Use o HTML do cronograma (Transferir) em vez de PDF digitalizado.",
          );
        }

        await this.prisma.cronogramaImportJob.update({
          where: { id: jobId },
          data: {
            status: "RASCUNHO",
            resultado: draft as unknown as Prisma.InputJsonValue,
            erro: null,
            progresso: 100,
            textoFonte: null,
            concludedAt: new Date(),
          },
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Falha desconhecida ao processar o cronograma.";
        this.logger.warn(`Job de importação ${jobId} falhou: ${msg}`);
        await this.prisma.cronogramaImportJob.update({
          where: { id: jobId },
          data: {
            status: "FALHA",
            erro: msg,
            progresso: 100,
            textoFonte: null,
            concludedAt: new Date(),
          },
        });
      }
    } finally {
      this.runningJobs.delete(jobId);
    }
  }

  /**
   * Preenche `titulo` / `moduloUnidadeId` em sessões já criadas a partir do último
   * job APLICADO (útil quando a importação anterior não gravou o nome do módulo).
   */
  async repararTitulosDeImportacao(user: RequestUser, cronogramaId: string) {
    const tenantId = requireTenantId(user);
    const cronograma = await this.prisma.cronograma.findFirst({
      where: { id: cronogramaId, tenantId },
      select: { id: true },
    });
    if (!cronograma) throw new NotFoundException("Cronograma não encontrado.");

    const job = await this.prisma.cronogramaImportJob.findFirst({
      where: { tenantId, cronogramaId, status: "APLICADO" },
      orderBy: { concludedAt: "desc" },
      select: { resultado: true },
    });
    const draft = job?.resultado as CronogramaImportDraft | null;
    if (!draft?.sessoes?.length) {
      return { actualizadas: 0 };
    }

    const ctx = await this.loadContext(tenantId, cronogramaId);
    const sessoes = await this.prisma.sessaoFormacao.findMany({
      where: { tenantId, cronogramaId },
      select: {
        id: true,
        numeroSessao: true,
        data: true,
        horaInicio: true,
        titulo: true,
        moduloUnidadeId: true,
      },
    });

    let actualizadas = 0;
    for (const sess of sessoes) {
      if (sess.titulo && sess.moduloUnidadeId) continue;
      const dataKey =
        sess.data instanceof Date
          ? sess.data.toISOString().slice(0, 10)
          : String(sess.data).slice(0, 10);
      const draftS =
        draft.sessoes.find(
          (d) => d.data.slice(0, 10) === dataKey && d.horaInicio === sess.horaInicio,
        ) ?? draft.sessoes.find((d) => d.numeroSessao === sess.numeroSessao);
      if (!draftS) continue;

      let moduloUnidadeId = sess.moduloUnidadeId ?? draftS.moduloUnidadeId ?? null;
      if (!moduloUnidadeId) {
        const mod = matchModulo(ctx.modulos, null, draftS.tituloModulo);
        if (mod) moduloUnidadeId = mod.id;
      }
      const titulo =
        sanitizarCampoTexto(draftS.tituloModulo) ??
        (moduloUnidadeId
          ? (ctx.modulos.find((m) => m.id === moduloUnidadeId)?.titulo ?? null)
          : null) ??
        sess.titulo;

      if (
        titulo === sess.titulo &&
        moduloUnidadeId === sess.moduloUnidadeId
      ) {
        continue;
      }

      await this.prisma.sessaoFormacao.update({
        where: { id: sess.id },
        data: {
          ...(titulo && titulo !== sess.titulo ? { titulo } : {}),
          ...(moduloUnidadeId && moduloUnidadeId !== sess.moduloUnidadeId
            ? { moduloUnidadeId }
            : {}),
        },
      });
      actualizadas += 1;
    }

    return { actualizadas };
  }

  private enrichDraftConformidade(
    draft: CronogramaImportDraft,
    modulos: ModuloCursoRef[],
  ): CronogramaImportDraft {
    const conformidade = validarCronogramaContraCurso(draft.sessoes, modulos);
    const avisos = [...new Set([...draft.avisos, ...conformidade.avisos])];
    return { ...draft, avisos, conformidadeCurso: conformidade };
  }

  private async loadContext(tenantId: string, cronogramaId: string) {
    const cronograma = await this.prisma.cronograma.findFirst({
      where: { id: cronogramaId, tenantId },
      select: {
        id: true,
        acaoFormacao: {
          select: {
            id: true,
            codigoInterno: true,
            titulo: true,
            dataInicio: true,
            dataFim: true,
            cursoId: true,
          },
        },
      },
    });
    if (!cronograma) throw new NotFoundException("Cronograma não encontrado.");

    const [modulosFull, formadores, tenant] = await Promise.all([
      this.prisma.moduloUnidade.findMany({
        where: { tenantId, cursoId: cronograma.acaoFormacao.cursoId },
        orderBy: [{ ordem: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          codigo: true,
          titulo: true,
          cargaHoras: true,
          cargaHorasTeoricas: true,
          cargaHorasPraticas: true,
          metodologia: true,
        },
        take: 80,
      }),
      this.prisma.formadorProfile.findMany({
        where: { tenantId },
        select: { id: true, nomeCompleto: true },
        take: 80,
        orderBy: { nomeCompleto: "asc" },
      }),
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { metadata: true },
      }),
    ]);

    const meta = (tenant?.metadata ?? {}) as {
      cronograma?: { horarioInicio?: string; horarioFim?: string };
    };

    const toKey = (d: Date) => d.toISOString().slice(0, 10);
    return {
      acao: {
        ...cronograma.acaoFormacao,
        dataInicio: toKey(cronograma.acaoFormacao.dataInicio),
        dataFim: toKey(cronograma.acaoFormacao.dataFim),
      },
      modulos: modulosFull as ModuloRef[],
      modulosFull,
      formadores,
      horarioInicio: meta.cronograma?.horarioInicio,
      horarioFim: meta.cronograma?.horarioFim,
    };
  }

  private async assertOllamaReachable(): Promise<void> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4_000);
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, {
        method: "GET",
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new ServiceUnavailableException(
          `Ollama respondeu HTTP ${res.status} em ${this.baseUrl}.`,
        );
      }
      const body = (await res.json()) as { models?: Array<{ name?: string; model?: string }> };
      const names = (body.models ?? []).flatMap((m) => [m.name, m.model].filter(Boolean) as string[]);
      const hasModel = names.some(
        (n) => n === this.model || n.startsWith(`${this.model}:`) || this.model.startsWith(`${n}:`),
      );
      if (!names.length) {
        throw new ServiceUnavailableException(
          `Ollama em ${this.baseUrl} não tem modelos. ` +
            `Use a porta Docker (11435) ou execute: npm run ollama:pull`,
        );
      }
      if (!hasModel) {
        throw new ServiceUnavailableException(
          `Modelo «${this.model}» ausente em ${this.baseUrl}. Modelos: ${names.join(", ") || "-"}. ` +
            `Execute: docker compose exec ollama ollama pull ${this.model}`,
        );
      }
    } catch (err) {
      if (err instanceof ServiceUnavailableException) throw err;
      throw new ServiceUnavailableException(
        `Ollama inacessível em ${this.baseUrl}. ` +
          `No Docker use NEXIGUIA_LLM_URL=http://127.0.0.1:11435 e npm run ollama:setup.`,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  private async completeJson(
    system: string,
    user: string,
    timeoutMs: number = this.timeoutMs,
  ): Promise<{ status: "ok" | "timeout" | "error"; data?: unknown }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          stream: false,
          format: "json",
          options: {
            temperature: 0.1,
            num_predict: 2048,
            num_ctx: 4096,
          },
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        this.logger.warn(`Import IA LLM HTTP ${res.status}`);
        return { status: "error" };
      }
      const data = (await res.json()) as { message?: { content?: string } };
      const raw = data.message?.content?.trim();
      if (!raw) {
        this.logger.warn("Import IA LLM: resposta vazia");
        return { status: "error" };
      }
      const parsed = parseLlmJsonResponse(raw);
      if (parsed == null) {
        this.logger.warn(`Import IA LLM: JSON inválido (início): ${raw.slice(0, 180)}`);
        return { status: "error" };
      }
      return { status: "ok", data: parsed };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "erro";
      const aborted =
        (err instanceof Error && err.name === "AbortError") ||
        /aborted|abort/i.test(msg);
      this.logger.warn(`Import IA LLM ${aborted ? "timeout" : "indisponível"}: ${msg}`);
      return { status: aborted ? "timeout" : "error" };
    } finally {
      clearTimeout(timer);
    }
  }
}
