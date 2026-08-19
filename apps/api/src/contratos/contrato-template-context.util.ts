import type { PrismaClient } from "@nexiforma/database";
import { formatDateExtensoPt } from "../portal/document-template-context.util";

function fmtDate(d: Date | null | undefined): string {
  return d ? d.toLocaleDateString("pt-PT") : "-";
}

function fmtEuroCentavos(cents: number): string {
  return (cents / 100).toLocaleString("pt-PT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

type TenantBrandingMeta = {
  companyName?: string;
  supportEmail?: string;
  cronograma?: { local?: string };
};

function extractEntidadeMorada(metadata: unknown): string {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return "";
  const m = metadata as Record<string, unknown>;
  for (const key of ["morada", "moradaFiscal", "moradaDgert"]) {
    const v = m[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

export async function buildCrmContratoTemplateContext(
  prisma: PrismaClient,
  tenantId: string,
  opts: {
    contrato: {
      codigo: string;
      titulo: string;
      valorCentavos: number;
      dataInicio: Date | null;
      dataFim: Date | null;
    };
    entidadeClienteId: string;
    comercialNome?: string | null;
    proposta?: {
      codigo: string;
      titulo: string;
      valorCentavos: number;
      validadeAte: Date | null;
    } | null;
  },
): Promise<Record<string, string>> {
  const [tenant, cliente] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { legalName: true, nif: true, metadata: true },
    }),
    prisma.entidadeCliente.findFirst({
      where: { id: opts.entidadeClienteId, tenantId },
      select: { nome: true, nif: true, moradaFiscal: true, email: true },
    }),
  ]);

  const meta = (tenant?.metadata ?? {}) as TenantBrandingMeta & { cronograma?: { local?: string } };
  const localDefault = meta.cronograma?.local ?? null;
  const proposta = opts.proposta;

  return {
    "entidade.nome_legal": tenant?.legalName ?? "",
    "entidade.nif": tenant?.nif ?? "",
    "cliente.nome": cliente?.nome ?? "",
    "cliente.nif": cliente?.nif ?? "",
    "cliente.morada": cliente?.moradaFiscal?.trim() ?? "",
    "cliente.email": cliente?.email?.trim() ?? "",
    "contrato.numero": opts.contrato.codigo,
    "contrato.titulo": opts.contrato.titulo,
    "contrato.data_inicio": fmtDate(opts.contrato.dataInicio),
    "contrato.data_fim": fmtDate(opts.contrato.dataFim),
    "contrato.valor": `${fmtEuroCentavos(opts.contrato.valorCentavos)} €`,
    "proposta.numero": proposta?.codigo ?? "",
    "proposta.titulo": proposta?.titulo ?? opts.contrato.titulo,
    "proposta.valor": proposta ? `${fmtEuroCentavos(proposta.valorCentavos)} €` : "",
    "proposta.validade": fmtDate(proposta?.validadeAte),
    "comercial.nome": opts.comercialNome?.trim() ?? "",
    "local.data_extenso": formatDateExtensoPt(new Date(), localDefault),
    "data.hoje_extenso": formatDateExtensoPt(new Date(), localDefault),
  };
}
