import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DOSSIE_DGERT_DOCUMENTOS, DOSSIE_DGERT_TOTAL } from "@nexiforma/shared";
import AdmZip from "adm-zip";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "../common/tenant-scope";
import { ComplianceService } from "../compliance/compliance.service";
import { DossiePedagogicoService } from "./dossie-pedagogico.service";
import { DossieHtmlExportService } from "./dossie-html-export.service";
import { SigoExportService } from "./sigo-export.service";
import { CronogramaHtmlExportService } from "../cronogramas/cronograma-html-export.service";
import { buildDossieDocumentosMap, listDossieDocumentosStatus } from "./dossie-documentos.builder";

export const INSPECAO_PACOTE_SCHEMA = "nexiforma.inspecao_pacote.v1";

function safeExportSlug(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_|_$/g, "").slice(0, 64) || "acao";
}

function csvCell(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  if (/[",;\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

@Injectable()
export class InspecaoPacoteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
    private readonly dossie: DossiePedagogicoService,
    private readonly sigo: SigoExportService,
    private readonly html: DossieHtmlExportService,
    private readonly cronogramaHtml: CronogramaHtmlExportService,
    private readonly compliance: ComplianceService,
  ) {}

  async assertProntoInspecao(user: RequestUser, acaoId: string) {
    const detail = await this.compliance.getByAcao(user, acaoId);
    if (!detail.checklist.prontoInspecao) {
      const pendencias = detail.pendencias.filter((p) => p.severidade === "obrigatorio");
      throw new BadRequestException({
        message: `Complete os ${DOSSIE_DGERT_TOTAL} requisitos obrigatórios antes de gerar o dossiê técnico-pedagógico.`,
        pendencias,
        documentosPendentes: pendencias.length,
      });
    }
    return detail;
  }

  documentosDgertStatus(user: RequestUser, acaoId: string) {
    return this.compliance.getByAcao(user, acaoId).then((detail) => ({
      prontoInspecao: detail.checklist.prontoInspecao,
      totalDocumentos: DOSSIE_DGERT_TOTAL,
      documentos: listDossieDocumentosStatus(detail.checklist.items),
      pendencias: detail.pendencias.filter((p) => p.severidade === "obrigatorio"),
    }));
  }

  async gerarDossieTecnicoPedagogico(user: RequestUser, acaoId: string) {
    const compliance = await this.assertProntoInspecao(user, acaoId);
    const arquivo = await this.storePacote(user, acaoId);
    return {
      message: `Dossiê técnico-pedagógico gerado com ${DOSSIE_DGERT_TOTAL} documentos automatizados.`,
      totalDocumentos: DOSSIE_DGERT_TOTAL,
      documentos: listDossieDocumentosStatus(compliance.checklist.items),
      arquivo,
    };
  }

  async buildZipBuffer(user: RequestUser, acaoId: string) {
    await this.assertProntoInspecao(user, acaoId);

    const tenantId = requireTenantId(user);
    const acao = await this.prisma.acaoFormacao.findFirst({
      where: { id: acaoId, tenantId },
      select: { codigoInterno: true, titulo: true },
    });
    if (!acao) {
      throw new NotFoundException("Acção de formação não encontrada.");
    }

    const cronogramaAprovado = await this.prisma.cronograma.findFirst({
      where: { tenantId, acaoFormacaoId: acaoId, aprovadoEm: { not: null } },
      orderBy: { versao: "desc" },
      select: { id: true, versao: true },
    });

    const [dossiePkg, sigoPkg, htmlPkg, complianceDetail, presencasCsv, lmsJson, validacaoSigo] =
      await Promise.all([
        this.dossie.buildExportPackage(user, acaoId),
        this.sigo.buildSigoJsonPackage(user, acaoId),
        this.html.buildPrintableHtml(user, acaoId),
        this.compliance.getByAcao(user, acaoId),
        this.buildPresencasCsv(tenantId, acaoId),
        this.buildLmsEvidenciasJson(tenantId, acaoId),
        this.sigo.validateForSigo(user, acaoId),
      ]);

    const cronogramaPkg = cronogramaAprovado
      ? await this.cronogramaHtml.buildPrintableHtml(user, cronogramaAprovado.id)
      : null;

    const sigoCsv = await this.sigo.buildFormandosCsv(user, acaoId);
    const geradoEm = new Date().toISOString();
    const slug = safeExportSlug(acao.codigoInterno);
    const dossieInner = dossiePkg.body.dossie as Record<string, unknown>;
    const documentosMap = buildDossieDocumentosMap(complianceDetail, dossieInner, presencasCsv);

    const ficheiros = [
      "README.txt",
      "manifest.json",
      ...DOSSIE_DGERT_DOCUMENTOS.map((d) => `documentos/${d.filename}`),
      "dossie/dossie-pedagogico.json",
      "dossie/dossie-pedagogico.html",
      "sigo/sigo-export.json",
      "sigo/formandos.csv",
      "compliance/compliance-dgert.json",
      "compliance/validacao-sigo.json",
      "evidencias/presencas.csv",
      "evidencias/lms-progresso.json",
    ];
    if (cronogramaPkg) {
      ficheiros.push(`cronograma/${cronogramaPkg.filename}`);
    }

    const manifest = {
      schema: INSPECAO_PACOTE_SCHEMA,
      geradoEm,
      acao: { codigoInterno: acao.codigoInterno, titulo: acao.titulo },
      ficheiros,
      documentosDgert: DOSSIE_DGERT_DOCUMENTOS.map((d) => ({
        ordem: d.ordem,
        label: d.label,
        ficheiro: `documentos/${d.filename}`,
        checklistId: d.checklistId,
      })),
      totalDocumentos: DOSSIE_DGERT_TOTAL,
      cronogramaVersao: cronogramaAprovado?.versao ?? null,
      prontoInspecao: complianceDetail.checklist.prontoInspecao,
      scoreObrigatorioPercent: complianceDetail.checklist.scoreObrigatorioPercent,
    };

    const readme =
      `Dossiê técnico-pedagógico DGERT – NexiForma\n` +
      `Gerado: ${geradoEm}\n` +
      `Acção: ${acao.codigoInterno} – ${acao.titulo}\n\n` +
      `${DOSSIE_DGERT_TOTAL} documentos automatizados (pasta documentos/):\n` +
      DOSSIE_DGERT_DOCUMENTOS.map((d) => `  ${String(d.ordem).padStart(2, "0")}. ${d.label}`).join("\n") +
      `\n\nPacote completo:\n` +
      `- documentos/ – ${DOSSIE_DGERT_TOTAL} ficheiros de auditoria (1 por requisito obrigatório)\n` +
      `- dossie/ – dossiê pedagógico agregado (JSON + HTML imprimível)\n` +
      (cronogramaPkg ? `- cronograma/ – cronograma DGERT transferível (HTML)\n` : "") +
      `- sigo/ – export SIGO (JSON + CSV formandos)\n` +
      `- compliance/ – checklist DGERT e validação SIGO\n` +
      `- evidencias/ – presenças detalhadas e progresso LMS\n\n` +
      `Score obrigatórios: ${complianceDetail.checklist.scoreObrigatorioPercent}%\n` +
      `Pronto inspecção: sim\n`;

    const zip = new AdmZip();
    zip.addFile("README.txt", Buffer.from(readme, "utf8"));
    zip.addFile("manifest.json", Buffer.from(JSON.stringify(manifest, null, 2), "utf8"));
    for (const [path, content] of documentosMap) {
      zip.addFile(path, Buffer.from(content, "utf8"));
    }
    zip.addFile(
      "dossie/dossie-pedagogico.json",
      Buffer.from(JSON.stringify(dossiePkg.body, null, 2), "utf8"),
    );
    zip.addFile("dossie/dossie-pedagogico.html", Buffer.from(htmlPkg.html, "utf8"));
    if (cronogramaPkg) {
      zip.addFile(`cronograma/${cronogramaPkg.filename}`, Buffer.from(cronogramaPkg.html, "utf8"));
    }
    zip.addFile(
      "sigo/sigo-export.json",
      Buffer.from(JSON.stringify(sigoPkg.body, null, 2), "utf8"),
    );
    zip.addFile(`sigo/${sigoCsv.filename}`, Buffer.from(sigoCsv.csv, "utf8"));
    zip.addFile(
      "compliance/compliance-dgert.json",
      Buffer.from(JSON.stringify(complianceDetail, null, 2), "utf8"),
    );
    zip.addFile(
      "compliance/validacao-sigo.json",
      Buffer.from(JSON.stringify(validacaoSigo, null, 2), "utf8"),
    );
    zip.addFile("evidencias/presencas.csv", Buffer.from(presencasCsv, "utf8"));
    zip.addFile("evidencias/lms-progresso.json", Buffer.from(lmsJson, "utf8"));

    const buffer = zip.toBuffer();
    const filename = `dossie-tecnico-pedagogico-${slug}-${geradoEm.slice(0, 10)}.zip`;

    return { buffer, filename, manifest };
  }

  async storePacote(user: RequestUser, acaoId: string) {
    const tenantId = requireTenantId(user);
    const { buffer, filename } = await this.buildZipBuffer(user, acaoId);

    const storageKey = `${tenantId}/${acaoId}/inspecao_zip/${Date.now()}-${filename}`;
    const ttlDays = Number(this.config.get<string>("STORAGE_EXPORT_TTL_DAYS") ?? "90");
    const expiresAt = new Date(Date.now() + ttlDays * 86400000);
    const mimeType = "application/zip";

    await this.storage.putObject(storageKey, buffer, mimeType);

    const row = await this.prisma.arquivoExportacao.create({
      data: {
        tenantId,
        acaoFormacaoId: acaoId,
        tipo: "INSPECAO_ZIP",
        storageKey,
        nomeFicheiro: filename,
        mimeType,
        tamanhoBytes: buffer.byteLength,
        createdByUserId: user.sub,
        expiresAt,
      },
    });

    const downloadUrl = await this.storage.getDownloadUrl(storageKey);

    return {
      id: row.id,
      tipo: row.tipo,
      nomeFicheiro: row.nomeFicheiro,
      tamanhoBytes: row.tamanhoBytes,
      storageBackend: this.storage.getBackend(),
      downloadUrl,
      expiresAt: row.expiresAt,
    };
  }

  private async buildPresencasCsv(tenantId: string, acaoId: string): Promise<string> {
    const rows = await this.prisma.presenca.findMany({
      where: {
        tenantId,
        matricula: { turma: { acaoFormacaoId: acaoId } },
      },
      include: {
        matricula: {
          include: {
            formando: { select: { nome: true, nif: true } },
            turma: { select: { codigo: true } },
          },
        },
        folhaPresenca: {
          include: {
            sessao: {
              select: {
                numeroSessao: true,
                data: true,
                horaInicio: true,
                horaFim: true,
                iniciadaEm: true,
                terminadaEm: true,
                formadorPresente: true,
                formador: { select: { nomeCompleto: true } },
              },
            },
          },
        },
      },
      orderBy: [{ folhaPresenca: { sessao: { numeroSessao: "asc" } } }],
    });

    const header = [
      "turma",
      "formando",
      "nif",
      "sessao",
      "data_sessao",
      "hora_inicio",
      "hora_fim",
      "inicio_efectivo",
      "fim_efectivo",
      "formador",
      "formador_presente",
      "estado_presenca",
      "presente",
      "minutos_efetivos",
      "validado",
      "origem",
    ].join(";");

    const lines = rows.map((r) => {
      const sess = r.folhaPresenca.sessao;
      const formadorPres =
        sess.formadorPresente === true
          ? "sim"
          : sess.formadorPresente === false
            ? "nao"
            : "";
      return [
        csvCell(r.matricula.turma.codigo),
        csvCell(r.matricula.formando.nome),
        csvCell(r.matricula.formando.nif),
        csvCell(sess.numeroSessao),
        csvCell(sess.data.toISOString().slice(0, 10)),
        csvCell(sess.horaInicio),
        csvCell(sess.horaFim),
        csvCell(sess.iniciadaEm?.toISOString() ?? ""),
        csvCell(sess.terminadaEm?.toISOString() ?? ""),
        csvCell(sess.formador?.nomeCompleto ?? ""),
        csvCell(formadorPres),
        csvCell(r.estado ?? ""),
        csvCell(r.presente ? "sim" : "nao"),
        csvCell(r.minutosEfetivos != null ? String(r.minutosEfetivos) : ""),
        csvCell(r.validado ? "sim" : "nao"),
        csvCell(r.origem ?? ""),
      ].join(";");
    });

    return [header, ...lines].join("\n");
  }

  private async buildLmsEvidenciasJson(tenantId: string, acaoId: string): Promise<string> {
    const progressos = await this.prisma.progressoModulo.findMany({
      where: {
        tenantId,
        matricula: { turma: { acaoFormacaoId: acaoId } },
      },
      include: {
        matricula: {
          include: { formando: { select: { nome: true, nif: true } } },
        },
        modulo: { select: { titulo: true, tipo: true, ordem: true } },
      },
      orderBy: [{ matriculaId: "asc" }, { modulo: { ordem: "asc" } }],
    });

    const body = {
      schema: "nexiforma.lms_evidencias.v1",
      acaoFormacaoId: acaoId,
      totalRegistos: progressos.length,
      progressos: progressos.map((p) => ({
        formando: p.matricula.formando.nome,
        nif: p.matricula.formando.nif,
        modulo: p.modulo.titulo,
        tipo: p.modulo.tipo,
        estado: p.percentual >= 100 ? "concluido" : p.percentual > 0 ? "em_curso" : "nao_iniciado",
        percentual: p.percentual,
        pontuacao: p.pontuacao,
        tentativas: p.tentativas,
        concluidoEm: p.concluidoEm,
        metadata: p.metadata,
      })),
    };

    return JSON.stringify(body, null, 2);
  }
}
