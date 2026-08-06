import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "../common/tenant-scope";
import {
  CATALOGO_UFCD_FONTES,
  isExcelUpload,
  parseUfcdImportCsv,
  parseUfcdImportJson,
  parseUfcdImportXlsx,
  type UfcdImportRow,
} from "./catalogo-ufcd-import.util";

const IMPORT_MAX_ROWS = 25_000;
const IMPORT_BATCH = 80;

@Injectable()
export class CatalogoUfcdService {
  constructor(private readonly prisma: PrismaService) {}

  fontes() {
    return {
      ...CATALOGO_UFCD_FONTES,
      colunasEsperadas: ["Código", "Designação", "Área", "Duração/Horas", "Nível QNQ"],
      formatosAceites: [".xlsx", ".xls", ".csv", ".tsv", ".txt"],
    };
  }

  search(q?: string, limit = 50) {
    const term = q?.trim();
    const take = Math.min(Math.max(1, Number.isFinite(limit) ? limit : 50), 10_000);
    return this.prisma.catalogoUfcd.findMany({
      where: term
        ? {
            activo: true,
            OR: [
              { codigo: { contains: term, mode: "insensitive" } },
              { designacao: { contains: term, mode: "insensitive" } },
              { area: { contains: term, mode: "insensitive" } },
            ],
          }
        : { activo: true },
      orderBy: { codigo: "asc" },
      take,
    });
  }

  async deleteMany(codigos: unknown) {
    if (!Array.isArray(codigos) || codigos.length === 0) {
      throw new BadRequestException("Indique pelo menos um código UFCD.");
    }
    const unique = [
      ...new Set(
        codigos
          .map((c) => String(c ?? "").trim())
          .filter((c) => /^\d{3,5}$/.test(c)),
      ),
    ];
    if (unique.length === 0) {
      throw new BadRequestException("Nenhum código UFCD válido.");
    }
    if (unique.length > 10_000) {
      throw new BadRequestException("Máximo de 10 000 UFCDs por eliminação.");
    }
    const result = await this.prisma.catalogoUfcd.deleteMany({
      where: { codigo: { in: unique } },
    });
    return { deleted: result.count, requested: unique.length };
  }

  async getOne(codigo: string) {
    const row = await this.prisma.catalogoUfcd.findUnique({ where: { codigo } });
    if (!row || !row.activo) {
      throw new NotFoundException("UFCD não encontrada no catálogo.");
    }
    return row;
  }

  async validateForCurso(user: RequestUser, codigoUfcd: string) {
    const tenantId = requireTenantId(user);
    const ufcd = await this.getOne(codigoUfcd);
    const cursos = await this.prisma.curso.count({
      where: { tenantId, codigoUfcd: ufcd.codigo },
    });
    return {
      valido: true,
      ufcd,
      cursosTenantComCodigo: cursos,
      mensagem: "Código UFCD válido no catálogo DGEEC (referência NexiForma).",
    };
  }

  async validateForSigo(user: RequestUser, acaoId: string) {
    const tenantId = requireTenantId(user);
    const acao = await this.prisma.acaoFormacao.findFirst({
      where: { id: acaoId, tenantId },
      include: { curso: { select: { codigoUfcd: true, designacao: true } } },
    });
    if (!acao) {
      throw new NotFoundException("Acção de formação não encontrada.");
    }
    if (!acao.curso.codigoUfcd) {
      throw new BadRequestException("Curso sem código UFCD – obrigatório para SIGO.");
    }
    const ufcd = await this.getOne(acao.curso.codigoUfcd);
    return {
      acaoId,
      curso: acao.curso.designacao,
      ufcd,
      pronto: true,
    };
  }

  async importFromFile(
    file: Express.Multer.File | undefined,
    opts?: { deactivateMissing?: boolean },
  ) {
    if (!file?.buffer?.byteLength) {
      throw new BadRequestException("Envie um ficheiro Excel (.xlsx) ou CSV/TSV no campo «file».");
    }
    const name = (file.originalname ?? "").toLowerCase();
    const mime = file.mimetype ?? "";
    const excel = isExcelUpload(name, mime, file.buffer);
    const textOk =
      /\.(csv|tsv|txt)$/.test(name) ||
      ["text/csv", "text/plain", "text/tab-separated-values"].includes(mime);

    if (!excel && !textOk) {
      throw new BadRequestException(
        "Formato não suportado. Importe o .xlsx do CNQ («Descarregar Listagem») ou um CSV/TSV.",
      );
    }

    let parsed;
    try {
      parsed = excel
        ? parseUfcdImportXlsx(file.buffer)
        : parseUfcdImportCsv(file.buffer.toString("utf8"));
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : "Ficheiro inválido.");
    }
    const result = await this.upsertRows(parsed.rows, opts?.deactivateMissing === true);
    const duplicateSkips = parsed.skipped.filter((s) => s.reason.includes("duplicado")).length;
    return {
      ...result,
      /** Linhas de dados úteis no ficheiro (únicas + ignoradas). */
      fileRows: parsed.rows.length + parsed.skipped.length,
      uniqueCodes: parsed.rows.length,
      duplicateRows: duplicateSkips,
      skipped: parsed.skipped.slice(0, 50),
      skippedTotal: parsed.skipped.length,
      delimiter: parsed.delimiter,
      headers: parsed.headers,
      format: parsed.format,
      mensagem:
        duplicateSkips > 0
          ? `O ficheiro CNQ lista a mesma UFCD em várias qualificações: ${parsed.rows.length + parsed.skipped.length} linhas → ${parsed.rows.length} UFCDs únicas (${duplicateSkips} linhas repetidas por código).`
          : `Importadas ${parsed.rows.length} UFCDs.`,
      fonte: this.fontes(),
    };
  }

  async importFromJson(body: unknown, opts?: { deactivateMissing?: boolean }) {
    let rows: UfcdImportRow[];
    try {
      rows = parseUfcdImportJson(body);
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : "JSON inválido.");
    }
    const deactivate =
      opts?.deactivateMissing === true ||
      (typeof body === "object" &&
        body !== null &&
        (body as { deactivateMissing?: boolean }).deactivateMissing === true);
    return this.upsertRows(rows, deactivate);
  }

  private async upsertRows(rows: UfcdImportRow[], deactivateMissing: boolean) {
    if (rows.length > IMPORT_MAX_ROWS) {
      throw new BadRequestException(`Máximo de ${IMPORT_MAX_ROWS} UFCDs por importação.`);
    }

    let created = 0;
    let updated = 0;
    const codes = rows.map((r) => r.codigo);

    for (let i = 0; i < rows.length; i += IMPORT_BATCH) {
      const batch = rows.slice(i, i + IMPORT_BATCH);
      const existing = await this.prisma.catalogoUfcd.findMany({
        where: { codigo: { in: batch.map((r) => r.codigo) } },
        select: { codigo: true },
      });
      const existingSet = new Set(existing.map((e) => e.codigo));

      await Promise.all(
        batch.map((r) => {
          const data = {
            designacao: r.designacao,
            area: r.area ?? null,
            cargaHoras: r.cargaHoras ?? null,
            nivelQnq: r.nivelQnq ?? null,
            activo: true,
          };
          if (existingSet.has(r.codigo)) {
            return this.prisma.catalogoUfcd.update({
              where: { codigo: r.codigo },
              data,
            });
          }
          return this.prisma.catalogoUfcd.create({
            data: { codigo: r.codigo, ...data },
          });
        }),
      );
      updated += batch.filter((r) => existingSet.has(r.codigo)).length;
      created += batch.filter((r) => !existingSet.has(r.codigo)).length;
    }

    let deactivated = 0;
    if (deactivateMissing && codes.length > 0) {
      const res = await this.prisma.catalogoUfcd.updateMany({
        where: { activo: true, codigo: { notIn: codes } },
        data: { activo: false },
      });
      deactivated = res.count;
    }

    return {
      imported: rows.length,
      created,
      updated,
      deactivated,
      deactivateMissing,
    };
  }
}
