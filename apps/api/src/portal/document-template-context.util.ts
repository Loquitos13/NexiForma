import type { PrismaClient } from "@nexiforma/database";
import {
  extrairSigoFormandoMetadata,
  resolverEmailPresencaFormando,
} from "@nexiforma/shared";
import { extractFormandoMorada } from "../formandos/formando-sigo-metadata.util";

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
  tipoDocIdentificacao?: string;
  nacionalidade?: string;
  habilitacaoLiteraria?: string;
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
    tipoDocIdentificacao: sigo.tipoDocIdentificacao,
    nacionalidade: sigo.nacionalidade,
    habilitacaoLiteraria: sigo.habilitacaoLiteraria,
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

function fmtDate(d: Date | null | undefined): string {
  return d ? d.toLocaleDateString("pt-PT") : "-";
}

type TenantBrandingMeta = {
  companyName?: string;
  supportEmail?: string;
  supportPhone?: string;
  footerText?: string;
};

function extractEntidadeMorada(metadata: unknown): string {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return "";
  const m = metadata as Record<string, unknown>;
  for (const key of ["morada", "moradaFiscal", "moradaDgert"]) {
    const v = m[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  const dgert = m.dgert;
  if (dgert && typeof dgert === "object" && !Array.isArray(dgert)) {
    const morada = (dgert as Record<string, unknown>).morada;
    if (typeof morada === "string" && morada.trim()) return morada.trim();
  }
  return "";
}

/** Formato legível de horas para documentos (ex.: «0 Horas», «1 Hora»). */
export function formatCargaHorasLabel(horas: number): string {
  const n = Math.max(0, Math.round(Number(horas) || 0));
  return n === 1 ? "1 Hora" : `${n} Horas`;
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
        return `<tr><td style="padding:4px 8px;border:1px solid #ccc">${escapeHtml(m.titulo)}</td><td style="padding:4px 8px;border:1px solid #ccc;text-align:center">${formatCargaHorasLabel(teoria)}</td><td style="padding:4px 8px;border:1px solid #ccc;text-align:center">${formatCargaHorasLabel(pratica)}</td></tr>`;
      }
      return `<tr><td style="padding:4px 8px;border:1px solid #ccc">${escapeHtml(m.titulo)}</td><td style="padding:4px 8px;border:1px solid #ccc;text-align:center" colspan="2">${formatCargaHorasLabel(horas)} · ${escapeHtml(modalidadeLabel(modalidade))}</td></tr>`;
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
  const meta = (tenant?.metadata ?? {}) as {
    cronograma?: { local?: string };
    branding?: TenantBrandingMeta;
  };
  const localDefault = meta.cronograma?.local ?? null;
  const branding = meta.branding;

  const matricula = opts.matriculaId
    ? await prisma.matricula.findFirst({
        where: { id: opts.matriculaId, tenantId },
        select: {
          formando: {
            select: {
              nome: true,
              nif: true,
              email: true,
              telefone: true,
              emailPresenca: true,
              metadata: true,
              user: { select: { email: true } },
            },
          },
          turma: {
            select: {
              id: true,
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

  const sessaoFormador = matricula?.turma.id
    ? await prisma.sessaoFormacao.findFirst({
        where: { tenantId, turmaId: matricula.turma.id, formadorId: { not: null } },
        orderBy: { numeroSessao: "asc" },
        select: {
          formador: {
            select: {
              nomeCompleto: true,
              nif: true,
              email: true,
              emailPresenca: true,
              telefone: true,
              morada: true,
              ccNumero: true,
              ccValidade: true,
              ccpNumero: true,
              ccpValidade: true,
            },
          },
        },
      })
    : null;

  const formador = sessaoFormador?.formador;
  const curso = acao?.curso;
  const modalidade = curso?.modalidade ?? null;
  const sigo = parseFormandoSigo(matricula?.formando.metadata);
  const formando = matricula?.formando;

  return {
    "entidade.nome_legal": tenant?.legalName ?? "",
    "entidade.nif": tenant?.nif ?? "",
    "entidade.nome_comercial": branding?.companyName?.trim() ?? tenant?.legalName ?? "",
    "entidade.morada": extractEntidadeMorada(tenant?.metadata),
    "entidade.email": branding?.supportEmail?.trim() ?? "",
    "entidade.telefone": branding?.supportPhone?.trim() ?? "",
    "formando.nome_completo": formando?.nome ?? "",
    "formando.nif": formando?.nif ?? "",
    "formando.data_nascimento": fmtIsoDate(sigo.dataNascimento),
    "formando.tipo_documento": sigo.tipoDocIdentificacao ?? "",
    "formando.numero_identificacao": sigo.numDocIdentificacao ?? "",
    "formando.validade_identificacao": fmtIsoDate(sigo.validadeDocumento),
    "formando.nacionalidade": sigo.nacionalidade ?? "",
    "formando.habilitacao_literaria": sigo.habilitacaoLiteraria ?? "",
    "formando.email":
      formando?.user?.email ?? formando?.email ?? "",
    "formando.email_presenca":
      resolverEmailPresencaFormando({
        emailPresenca: formando?.emailPresenca,
        emailConta: formando?.user?.email,
        emailContacto: formando?.email,
      }) ?? "",
    "formando.telefone": formando?.telefone?.trim() ?? "",
    "formando.morada": extractFormandoMorada(formando?.metadata) ?? "",
    "formador.nome_completo": formador?.nomeCompleto ?? "",
    "formador.nif": formador?.nif ?? "",
    "formador.email": formador?.email ?? "",
    "formador.email_presenca": formador?.emailPresenca?.trim() ?? formador?.email ?? "",
    "formador.telefone": formador?.telefone?.trim() ?? "",
    "formador.morada": formador?.morada?.trim() ?? "",
    "formador.cc_numero": formador?.ccNumero?.trim() ?? "",
    "formador.cc_validade": fmtDate(formador?.ccValidade),
    "formador.ccp_numero": formador?.ccpNumero?.trim() ?? "",
    "formador.ccp_validade": fmtDate(formador?.ccpValidade),
    "curso.designacao": curso?.designacao ?? "",
    "curso.codigo_ufcd": curso?.codigoUfcd ?? "",
    "curso.modalidade": modalidadeLabel(modalidade),
    "acao.titulo": acao?.titulo ?? "",
    "acao.codigo_interno": acao?.codigoInterno ?? "",
    "acao.data_inicio": fmtDate(acao?.dataInicio),
    "acao.data_fim": fmtDate(acao?.dataFim),
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
