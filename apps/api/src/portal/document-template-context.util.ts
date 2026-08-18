import type { PrismaClient } from "@nexiforma/database";
import { extrairSigoFormandoMetadata } from "@nexiforma/shared";

/** Formata data por extenso em pt-PT (ex.: 11 de março de 2026). */
export function formatDateExtensoPt(date: Date, local?: string | null): string {
  const part = date.toLocaleDateString("pt-PT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return local?.trim() ? `${local.trim()}, ${part}` : part;
}

function modalidadeLabel(modalidade: string | null | undefined): string {
  switch (modalidade) {
    case "presencial":
      return "Presencial";
    case "b-learning":
      return "B-learning";
    case "e-learning":
      return "E-learning";
    default:
      return modalidade ?? "-";
  }
}

type SigoMeta = {
  dataNascimento?: string;
  numDocIdentificacao?: string;
  validadeDocumento?: string;
  /** @deprecated nomes antigos  fallback de leitura */
  numeroDocumento?: string;
};

function parseFormandoSigo(metadata: unknown): SigoMeta {
  const sigo = extrairSigoFormandoMetadata(metadata);
  const raw =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? ((metadata as { sigo?: Record<string, unknown> }).sigo ?? {})
      : {};
  return {
    dataNascimento: sigo.dataNascimento,
    numDocIdentificacao:
      sigo.numDocIdentificacao ??
      (typeof raw.numeroDocumento === "string" ? raw.numeroDocumento : undefined),
    validadeDocumento:
      sigo.validadeDocumento ??
      (typeof raw.validadeDocumento === "string" ? raw.validadeDocumento : undefined),
  };
}

function fmtIsoDate(iso: string | undefined | null): string {
  if (!iso?.trim()) return "-";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("pt-PT");
}

/** Gera bloco HTML de módulos com carga horária. */
export function renderModulosConteudoHtml(
  modulos: Array<{ titulo: string; cargaHoras?: number | null }>,
  modalidade: string | null | undefined,
): string {
  if (!modulos.length) {
    return "<p><em>Conteúdos programáticos não disponíveis.</em></p>";
  }
  const isPresencial = modalidade === "presencial";
  const rows = modulos
    .map((m) => {
      const horas = m.cargaHoras ?? 0;
      if (isPresencial) {
        const teoria = Math.round(horas * 0.4);
        const pratica = horas - teoria;
        return `<tr><td style="padding:4px 8px;border:1px solid #ccc">${escapeHtml(m.titulo)}</td><td style="padding:4px 8px;border:1px solid #ccc;text-align:center">${teoria}h</td><td style="padding:4px 8px;border:1px solid #ccc;text-align:center">${pratica}h</td></tr>`;
      }
      return `<tr><td style="padding:4px 8px;border:1px solid #ccc">${escapeHtml(m.titulo)}</td><td style="padding:4px 8px;border:1px solid #ccc;text-align:center" colspan="2">${horas}h · ${escapeHtml(modalidadeLabel(modalidade))}</td></tr>`;
    })
    .join("");
  const header = isPresencial
    ? "<tr><th style=\"text-align:left;padding:4px 8px;border:1px solid #ccc\">Módulo</th><th style=\"padding:4px 8px;border:1px solid #ccc\">Teórica</th><th style=\"padding:4px 8px;border:1px solid #ccc\">Prática</th></tr>"
    : "<tr><th style=\"text-align:left;padding:4px 8px;border:1px solid #ccc\">Módulo</th><th colspan=\"2\" style=\"padding:4px 8px;border:1px solid #ccc\">Carga / regime</th></tr>";
  return `<table style="width:100%;border-collapse:collapse;font-size:12px"><thead>${header}</thead><tbody>${rows}</tbody></table>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Contexto de merge para templates de formação (declaração de frequência, etc.).
 */
export async function buildFormacaoTemplateContext(
  prisma: PrismaClient,
  tenantId: string,
  opts: { matriculaId?: string; acaoId?: string },
): Promise<Record<string, string>> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { legalName: true, nif: true, metadata: true },
  });
  const meta = (tenant?.metadata ?? {}) as { cronograma?: { local?: string } };
  const localDefault = meta.cronograma?.local ?? null;

  const matricula = opts.matriculaId
    ? await prisma.matricula.findFirst({
        where: { id: opts.matriculaId, tenantId },
        select: {
          formando: {
            select: {
              nome: true,
              nif: true,
              email: true,
              metadata: true,
              user: { select: { email: true } },
            },
          },
          turma: {
            select: {
              codigo: true,
              nome: true,
              acaoFormacao: {
                select: {
                  id: true,
                  titulo: true,
                  codigoInterno: true,
                  dataInicio: true,
                  dataFim: true,
                  cursoId: true,
                  curso: {
                    select: {
                      designacao: true,
                      codigoUfcd: true,
                      cargaHoras: true,
                      modalidade: true,
                    },
                  },
                },
              },
            },
          },
        },
      })
    : null;

  const acao = matricula?.turma.acaoFormacao;
  const cursoId = acao?.cursoId;
  const modulos =
    cursoId != null
      ? await prisma.moduloUnidade.findMany({
          where: { tenantId, cursoId },
          select: { titulo: true, cargaHoras: true },
          orderBy: { ordem: "asc" },
          take: 80,
        })
      : [];

  const curso = acao?.curso;
  const modalidade = curso?.modalidade ?? null;
  const sigo = parseFormandoSigo(matricula?.formando.metadata);

  const fmt = (d: Date | null | undefined) =>
    d ? d.toLocaleDateString("pt-PT") : "-";

  return {
    "entidade.nome_legal": tenant?.legalName ?? "",
    "entidade.nif": tenant?.nif ?? "",
    "formando.nome_completo": matricula?.formando.nome ?? "",
    "formando.nif": matricula?.formando.nif ?? "",
    "formando.data_nascimento": fmtIsoDate(sigo.dataNascimento),
    "formando.numero_identificacao": sigo.numDocIdentificacao ?? "",
    "formando.validade_identificacao": fmtIsoDate(sigo.validadeDocumento),
    "formando.email": matricula?.formando.user?.email ?? matricula?.formando.email ?? "",
    "curso.designacao": curso?.designacao ?? "",
    "curso.codigo_ufcd": curso?.codigoUfcd ?? "",
    "curso.modalidade": modalidadeLabel(modalidade),
    "acao.titulo": acao?.titulo ?? "",
    "acao.codigo_interno": acao?.codigoInterno ?? "",
    "acao.data_inicio": fmt(acao?.dataInicio),
    "acao.data_fim": fmt(acao?.dataFim),
    "acao.carga_horas": String(curso?.cargaHoras ?? ""),
    "acao.regime_ensino": modalidadeLabel(modalidade),
    "acao.conteudos_modulos": renderModulosConteudoHtml(modulos, modalidade),
    "turma.codigo": matricula?.turma.codigo ?? "",
    "turma.nome": matricula?.turma.nome ?? "",
    "local.cronograma": localDefault ?? "",
    "local.data_extenso": formatDateExtensoPt(new Date(), localDefault),
    "data.hoje_extenso": formatDateExtensoPt(new Date(), localDefault),
  };
}
