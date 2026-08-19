import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import type { Sumario } from "@nexiforma/database";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { assertAllowedUpload } from "../common/upload-mime.util";
import {
  resolveTenantLogoDataUri,
  resolveTenantSignatureDataUri,
  tenantLogoImgHtml,
  userSignatureBlockHtml,
} from "../common/tenant-logo-embed.util";
import { readUserSignatureStorageKey } from "../auth/tenant-user-signatures.util";
import { FormadorScopeService } from "../common/formador-scope.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "../common/tenant-scope";
import type { AssinarSumarioDto } from "./dto/assinar-sumario.dto";
import type { CreateSumarioDto } from "./dto/create-sumario.dto";
import type { UpdateSumarioDto } from "./dto/update-sumario.dto";
import { sessaoPermiteSumario } from "./sumarios-sessao-terminada.util";

const PDF_ONLY = ["application/pdf"];

@Injectable()
export class SumariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly formadorScope: FormadorScopeService,
  ) {}

  /** Sumário só pode ser preenchido/assinado após a sessão estar terminada. */
  private assertSessaoTerminada(sessao: {
    terminadaEm: Date | null;
    iniciadaEm: Date | null;
  }) {
    if (!sessaoPermiteSumario(sessao)) {
      throw new BadRequestException(
        "O sumário só pode ser registado depois de a sessão ser terminada.",
      );
    }
  }

  private async requireSessaoTerminadaForSumario(
    tenantId: string,
    sessaoId: string,
  ) {
    const sessao = await this.prisma.sessaoFormacao.findFirst({
      where: { id: sessaoId, tenantId },
      select: { id: true, terminadaEm: true, iniciadaEm: true },
    });
    if (!sessao) {
      throw new NotFoundException("Sessão inexistente ou de outro tenant.");
    }
    this.assertSessaoTerminada(sessao);
    return sessao;
  }

  async listBySessao(user: RequestUser, sessaoId: string) {
    const tenantId = requireTenantId(user);
    await this.formadorScope.assertCanAccessSessao(user, sessaoId);
    return this.prisma.sumario.findMany({
      where: { tenantId, sessaoId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        conteudo: true,
        assinadoEm: true,
        assinaturaRef: true,
        assinaturaTipo: true,
        imutavel: true,
        pdfNomeFicheiro: true,
        pdfStorageKey: true,
        createdAt: true,
      },
    });
  }

  async create(
    user: RequestUser,
    sessaoId: string,
    dto: CreateSumarioDto,
  ): Promise<Sumario> {
    const tenantId = requireTenantId(user);
    await this.formadorScope.assertCanOperateSessao(user, sessaoId);
    await this.requireSessaoTerminadaForSumario(tenantId, sessaoId);

    const bloqueado = await this.prisma.sumario.findFirst({
      where: { tenantId, sessaoId, imutavel: true },
    });
    if (bloqueado) {
      throw new ConflictException(
        "Esta sessão já tem sumário assinado (imutável). Cria nova versão só após revogação futura.",
      );
    }

    return this.prisma.sumario.create({
      data: {
        tenantId,
        sessaoId,
        conteudo: dto.conteudo.trim(),
      },
    });
  }

  async update(
    user: RequestUser,
    id: string,
    dto: UpdateSumarioDto,
  ): Promise<Sumario> {
    const tenantId = requireTenantId(user);
    const row = await this.prisma.sumario.findFirst({
      where: { id, tenantId },
    });
    if (!row) {
      throw new NotFoundException("Sumário não encontrado.");
    }
    if (row.imutavel) {
      throw new ConflictException("Sumário assinado – não editável.");
    }
    await this.formadorScope.assertCanOperateSessao(user, row.sessaoId);
    await this.requireSessaoTerminadaForSumario(tenantId, row.sessaoId);

    return this.prisma.sumario.update({
      where: { id },
      data: { conteudo: dto.conteudo.trim() },
    });
  }

  async assinar(
    user: RequestUser,
    id: string,
    dto: AssinarSumarioDto,
  ): Promise<Sumario> {
    const tenantId = requireTenantId(user);
    const row = await this.prisma.sumario.findFirst({
      where: { id, tenantId },
    });
    if (!row) {
      throw new NotFoundException("Sumário não encontrado.");
    }
    if (row.imutavel) {
      throw new ConflictException("Sumário já assinado.");
    }
    await this.formadorScope.assertCanOperateSessao(user, row.sessaoId);
    await this.requireSessaoTerminadaForSumario(tenantId, row.sessaoId);

    const nomeAssinatura = dto.nomeAssinatura?.trim() || null;
    if (!nomeAssinatura || nomeAssinatura.length < 2) {
      throw new BadRequestException(
        "Indique o nome completo para assinar o sumário (mín. 2 caracteres).",
      );
    }

    const assinadoEm = new Date();
    const tenantMeta = (
      await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { metadata: true },
      })
    )?.metadata;
    const hasPngSignature = Boolean(readUserSignatureStorageKey(tenantMeta, user.sub));
    return this.prisma.sumario.update({
      where: { id },
      data: {
        imutavel: true,
        assinadoEm,
        assinaturaTipo: "interna",
        assinaturaRef: user.sub,
        assinaturaMetadata: {
          nomeAssinatura,
          fonte: hasPngSignature ? "png" : "Harris Signature",
          assinadoEm: assinadoEm.toISOString(),
        },
      },
    });
  }

  /**
   * Carrega PDF assinado (único tipo aceite), fecha o sumário como imutável.
   */
  async uploadPdfAssinado(
    user: RequestUser,
    id: string,
    file: Express.Multer.File | undefined,
  ): Promise<Sumario> {
    if (!file?.buffer?.byteLength) {
      throw new BadRequestException("Envie um ficheiro PDF.");
    }
    try {
      assertAllowedUpload(file, PDF_ONLY);
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : "Apenas ficheiros PDF são aceites.",
      );
    }
    if (!file.originalname.toLowerCase().endsWith(".pdf")) {
      throw new BadRequestException("Apenas ficheiros .pdf são aceites.");
    }

    const tenantId = requireTenantId(user);
    const row = await this.prisma.sumario.findFirst({
      where: { id, tenantId },
    });
    if (!row) {
      throw new NotFoundException("Sumário não encontrado.");
    }
    if (row.imutavel) {
      throw new ConflictException("Sumário já assinado – não pode substituir o PDF.");
    }
    await this.formadorScope.assertCanOperateSessao(user, row.sessaoId);
    await this.requireSessaoTerminadaForSumario(tenantId, row.sessaoId);

    const sha256 = createHash("sha256").update(file.buffer).digest("hex");
    const key = `sumarios/${tenantId}/${id}.pdf`;
    await this.storage.putObject(key, file.buffer, "application/pdf");

    if (row.pdfStorageKey && row.pdfStorageKey !== key) {
      await this.storage.deleteObject(row.pdfStorageKey);
    }

    return this.prisma.sumario.update({
      where: { id },
      data: {
        imutavel: true,
        assinadoEm: new Date(),
        assinaturaTipo: "pdf_upload",
        assinaturaRef: user.sub,
        pdfStorageKey: key,
        pdfNomeFicheiro: file.originalname.slice(0, 255),
        pdfSha256: sha256,
        assinaturaMetadata: {
          uploadedAt: new Date().toISOString(),
          originalName: file.originalname,
          sizeBytes: file.buffer.byteLength,
          sha256,
        },
      },
    });
  }

  async streamPdf(
    user: RequestUser,
    id: string,
  ): Promise<{ body: Buffer; contentType: string; nome: string }> {
    const tenantId = requireTenantId(user);
    const row = await this.prisma.sumario.findFirst({
      where: { id, tenantId },
    });
    if (!row?.pdfStorageKey) {
      throw new NotFoundException("PDF assinado não encontrado para este sumário.");
    }
    await this.formadorScope.assertCanAccessSessao(user, row.sessaoId);
    const obj = await this.storage.getObject(row.pdfStorageKey);
    if (!obj) {
      throw new NotFoundException("Ficheiro PDF não encontrado no armazenamento.");
    }
    return {
      body: obj.body,
      contentType: "application/pdf",
      nome: row.pdfNomeFicheiro ?? `sumario-${id.slice(0, 8)}.pdf`,
    };
  }

  /** HTML imprimível do sumário com logo da entidade. */
  async buildPrintableHtml(user: RequestUser, id: string) {
    const tenantId = requireTenantId(user);
    const row = await this.prisma.sumario.findFirst({
      where: { id, tenantId },
      include: {
        sessao: {
          select: {
            numeroSessao: true,
            data: true,
            horaInicio: true,
            horaFim: true,
            modalidade: true,
            formador: { select: { nomeCompleto: true } },
            cronograma: {
              select: {
                acaoFormacao: { select: { titulo: true, codigoInterno: true } },
              },
            },
          },
        },
      },
    });
    if (!row) throw new NotFoundException("Sumário não encontrado.");
    await this.formadorScope.assertCanAccessSessao(user, row.sessaoId);

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { legalName: true, metadata: true },
    });
    const logoHtml = tenantLogoImgHtml(
      await resolveTenantLogoDataUri(this.storage, tenant?.metadata),
    );
    const meta = row.assinaturaMetadata as { nomeAssinatura?: string } | null;
    const nomeAssinatura = meta?.nomeAssinatura?.trim() ?? "";
    const assinaturaSrc = row.assinaturaRef
      ? await resolveTenantSignatureDataUri(this.storage, tenant?.metadata, row.assinaturaRef)
      : null;
    const assinaturaHtml = userSignatureBlockHtml(assinaturaSrc, nomeAssinatura);
    const acao = row.sessao.cronograma.acaoFormacao;
    const dataLabel = row.sessao.data
      ? new Date(row.sessao.data).toLocaleDateString("pt-PT")
      : "–";
    const filename = `sumario-s${row.sessao.numeroSessao ?? "x"}-${id.slice(0, 8)}.html`;
    const html = `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="utf-8"/>
  <title>Sumário – sessão ${row.sessao.numeroSessao ?? ""}</title>
  <style>
    body { font-family: "Segoe UI", system-ui, sans-serif; color: #111; margin: 2rem; line-height: 1.5; font-size: 11pt; }
    .tenant-logo { max-height: 52px; max-width: 160px; object-fit: contain; margin: 0 0 12px; display: block; }
    h1 { font-size: 1.25rem; margin: 0 0 0.35rem; }
    .meta { color: #444; font-size: 0.9rem; margin-bottom: 1.25rem; }
    .conteudo { white-space: pre-wrap; border: 1px solid #ddd; border-radius: 6px; padding: 1rem; background: #fafafa; }
    .assinatura { margin-top: 1.5rem; font-size: 0.9rem; color: #334155; }
    @media print { body { margin: 1cm; } .no-print { display: none; } }
  </style>
</head>
<body>
  <p class="no-print" style="background:#eff6ff;padding:0.75rem;border-radius:6px;">
    <strong>Imprimir / PDF:</strong> Ctrl+P → «Guardar como PDF».
  </p>
  ${logoHtml}
  <h1>Sumário pedagógico</h1>
  <p class="meta">
    ${escapeHtml(tenant?.legalName ?? "")}<br/>
    Acção: ${escapeHtml(acao.titulo)} (${escapeHtml(acao.codigoInterno)})<br/>
    Sessão ${row.sessao.numeroSessao ?? "–"} · ${escapeHtml(dataLabel)} ·
    ${escapeHtml(row.sessao.horaInicio)}–${escapeHtml(row.sessao.horaFim)}
    ${row.sessao.modalidade ? ` · ${escapeHtml(row.sessao.modalidade)}` : ""}
    ${row.sessao.formador?.nomeCompleto ? `<br/>Formador: ${escapeHtml(row.sessao.formador.nomeCompleto)}` : ""}
  </p>
  <div class="conteudo">${escapeHtml(row.conteudo)}</div>
  ${
    row.assinadoEm
      ? `<div class="assinatura">
    <p style="margin:0 0 6px;font-size:0.85rem;color:#64748b">Assinado em ${escapeHtml(new Date(row.assinadoEm).toLocaleString("pt-PT"))}${
          row.assinaturaTipo ? ` (${escapeHtml(row.assinaturaTipo)})` : ""
        }</p>
    ${assinaturaHtml}
  </div>`
      : ""
  }
</body>
</html>`;
    return { filename, html };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
