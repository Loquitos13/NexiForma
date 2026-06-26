import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { PropostaComercial, PropostaEstado } from "@nexiforma/database";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "../common/tenant-scope";
import type { CreatePropostaDto, UpdatePropostaDto } from "./dto/proposta.dto";

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const ESTADO_LABEL: Record<string, string> = {
  RASCUNHO: "Rascunho",
  ENVIADA: "Enviada",
  ACEITE: "Aceite",
  REJEITADA: "Rejeitada",
};

@Injectable()
export class PropostasService {
  constructor(private readonly prisma: PrismaService) {}

  list(user: RequestUser, entidadeClienteId?: string) {
    const tenantId = requireTenantId(user);
    return this.prisma.propostaComercial.findMany({
      where: {
        tenantId,
        ...(entidadeClienteId ? { entidadeClienteId } : {}),
      },
      orderBy: { updatedAt: "desc" },
      include: {
        entidadeCliente: { select: { id: true, nome: true, nif: true, email: true } },
        curso: { select: { id: true, designacao: true, codigoUfcd: true } },
        fatura: { select: { id: true, estado: true } },
      },
    });
  }

  async getOne(user: RequestUser, id: string): Promise<PropostaComercial> {
    const tenantId = requireTenantId(user);
    const row = await this.prisma.propostaComercial.findFirst({
      where: { id, tenantId },
      include: {
        entidadeCliente: { select: { id: true, nome: true, nif: true, email: true } },
        curso: { select: { id: true, designacao: true, codigoUfcd: true, cargaHoras: true } },
      },
    });
    if (!row) {
      throw new NotFoundException("Proposta não encontrada.");
    }
    return row;
  }

  async create(user: RequestUser, dto: CreatePropostaDto): Promise<PropostaComercial> {
    const tenantId = requireTenantId(user);
    await this.assertEntidade(tenantId, dto.entidadeClienteId);
    if (dto.cursoId) {
      await this.assertCurso(tenantId, dto.cursoId);
    }

    const codigo = (dto.codigo?.trim() || `PROP-${Date.now().toString(36).toUpperCase()}`).toUpperCase();
    const dup = await this.prisma.propostaComercial.findFirst({ where: { tenantId, codigo } });
    if (dup) {
      throw new ConflictException("Código de proposta já existe.");
    }

    return this.prisma.propostaComercial.create({
      data: {
        tenantId,
        entidadeClienteId: dto.entidadeClienteId,
        codigo,
        titulo: dto.titulo.trim(),
        descricao: dto.descricao?.trim() || null,
        valorCentavos: dto.valorCentavos ?? 0,
        validadeAte: dto.validadeAte ? new Date(dto.validadeAte) : null,
        cursoId: dto.cursoId ?? null,
        notasInternas: dto.notasInternas?.trim() || null,
      },
    });
  }

  async update(user: RequestUser, id: string, dto: UpdatePropostaDto): Promise<PropostaComercial> {
    const tenantId = requireTenantId(user);
    const existing = await this.prisma.propostaComercial.findFirst({ where: { id, tenantId } });
    if (!existing) {
      throw new NotFoundException("Proposta não encontrada.");
    }
    if (dto.cursoId) {
      await this.assertCurso(tenantId, dto.cursoId);
    }

    return this.prisma.propostaComercial.update({
      where: { id },
      data: {
        titulo: dto.titulo?.trim() ?? existing.titulo,
        descricao: dto.descricao !== undefined ? dto.descricao?.trim() || null : existing.descricao,
        valorCentavos: dto.valorCentavos ?? existing.valorCentavos,
        estado: (dto.estado as PropostaEstado | undefined) ?? existing.estado,
        validadeAte:
          dto.validadeAte !== undefined
            ? dto.validadeAte
              ? new Date(dto.validadeAte)
              : null
            : existing.validadeAte,
        cursoId: dto.cursoId !== undefined ? dto.cursoId : existing.cursoId,
        notasInternas:
          dto.notasInternas !== undefined ? dto.notasInternas?.trim() || null : existing.notasInternas,
      },
    });
  }

  resumo(user: RequestUser) {
    const tenantId = requireTenantId(user);
    return this.prisma.propostaComercial.groupBy({
      by: ["estado"],
      where: { tenantId },
      _count: { _all: true },
      _sum: { valorCentavos: true },
    });
  }

  async buildPropostaHtml(user: RequestUser, id: string) {
    const tenantId = requireTenantId(user);
    const row = await this.prisma.propostaComercial.findFirst({
      where: { id, tenantId },
      include: {
        tenant: { select: { legalName: true, nif: true } },
        entidadeCliente: { select: { nome: true, nif: true, email: true } },
        curso: { select: { designacao: true, codigoUfcd: true, cargaHoras: true } },
      },
    });
    if (!row) {
      throw new NotFoundException("Proposta não encontrada.");
    }

    const valor = `${(row.valorCentavos / 100).toFixed(2)} ${row.moeda}`;
    const validade = row.validadeAte
      ? row.validadeAte.toLocaleDateString("pt-PT", { day: "2-digit", month: "long", year: "numeric" })
      : "Sem data limite";
    const emitida = row.updatedAt.toLocaleDateString("pt-PT", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
    const descricaoHtml = row.descricao
      ? `<div class="desc">${escapeHtml(row.descricao).replace(/\n/g, "<br>")}</div>`
      : "";
    const cursoHtml = row.curso
      ? `<tr><th>Curso</th><td>${escapeHtml(row.curso.designacao)}${row.curso.codigoUfcd ? ` (UFCD ${escapeHtml(row.curso.codigoUfcd)})` : ""}${row.curso.cargaHoras ? ` · ${row.curso.cargaHoras}h` : ""}</td></tr>`
      : "";
    const filename = `proposta-${row.codigo.toLowerCase()}.html`;

    const html = `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="utf-8"/>
  <title>Proposta ${escapeHtml(row.codigo)} – ${escapeHtml(row.titulo)}</title>
  <style>
    @media print { .no-print { display: none; } body { margin: 1.5cm; } }
    body { font-family: "Segoe UI", system-ui, sans-serif; color: #111; margin: 2rem; line-height: 1.5; font-size: 11pt; max-width: 800px; }
    h1 { font-size: 1.4rem; margin: 0 0 0.25rem; color: #1e3a8a; }
    .meta { color: #555; font-size: 0.9rem; margin-bottom: 1.5rem; }
    .box { border: 1px solid #cbd5e1; border-radius: 8px; padding: 1rem 1.25rem; margin: 1rem 0; }
    .box h2 { font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin: 0 0 0.75rem; }
    table { width: 100%; border-collapse: collapse; font-size: 10.5pt; }
    th, td { border: 1px solid #e2e8f0; padding: 0.45rem 0.6rem; text-align: left; vertical-align: top; }
    th { background: #f8fafc; width: 32%; font-weight: 600; }
    .valor { font-size: 1.35rem; font-weight: 700; color: #1e40af; }
    .desc { margin-top: 0.75rem; white-space: pre-wrap; }
    .estado { display: inline-block; padding: 0.2rem 0.55rem; border-radius: 4px; font-size: 0.8rem; font-weight: 600; background: #eff6ff; color: #1d4ed8; }
    footer { margin-top: 2rem; font-size: 0.8rem; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 0.75rem; }
    .no-print { margin-bottom: 1rem; }
    .no-print button { background: #2563eb; color: #fff; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-size: 0.9rem; }
  </style>
</head>
<body>
  <div class="no-print"><button type="button" onclick="window.print()">Imprimir / Guardar PDF</button></div>
  <h1>Proposta Comercial</h1>
  <p class="meta">${escapeHtml(row.tenant.legalName)} · NIF ${escapeHtml(row.tenant.nif)}</p>
  <p><span class="estado">${escapeHtml(ESTADO_LABEL[row.estado] ?? row.estado)}</span></p>

  <div class="box">
    <h2>Identificação</h2>
    <table>
      <tr><th>Código</th><td>${escapeHtml(row.codigo)}</td></tr>
      <tr><th>Título</th><td>${escapeHtml(row.titulo)}</td></tr>
      <tr><th>Emitida em</th><td>${escapeHtml(emitida)}</td></tr>
      <tr><th>Validade</th><td>${escapeHtml(validade)}</td></tr>
      ${cursoHtml}
    </table>
    ${descricaoHtml}
  </div>

  <div class="box">
    <h2>Cliente</h2>
    <table>
      <tr><th>Entidade</th><td>${escapeHtml(row.entidadeCliente.nome)}</td></tr>
      <tr><th>NIF</th><td>${escapeHtml(row.entidadeCliente.nif)}</td></tr>
      ${row.entidadeCliente.email ? `<tr><th>Email</th><td>${escapeHtml(row.entidadeCliente.email)}</td></tr>` : ""}
    </table>
  </div>

  <div class="box">
    <h2>Valor proposto</h2>
    <p class="valor">${escapeHtml(valor)}</p>
    <p style="font-size:0.85rem;color:#64748b;margin:0.5rem 0 0;">Valores sem IVA, salvo indicação em contrário.</p>
  </div>

  <footer>Documento gerado por NexiForma · ${escapeHtml(row.codigo)}</footer>
</body>
</html>`;

    return { html, filename };
  }

  private async assertEntidade(tenantId: string, id: string) {
    const ec = await this.prisma.entidadeCliente.findFirst({ where: { id, tenantId } });
    if (!ec) {
      throw new NotFoundException("Entidade cliente não encontrada.");
    }
  }

  private async assertCurso(tenantId: string, id: string) {
    const curso = await this.prisma.curso.findFirst({ where: { id, tenantId } });
    if (!curso) {
      throw new NotFoundException("Curso não encontrado.");
    }
  }
}
