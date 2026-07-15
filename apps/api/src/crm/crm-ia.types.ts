import type { CrmSugestaoExecucao } from "@nexiforma/shared";
export type InteraccaoComercialResposta = {
  id: string;
  tenantId: string;
  tipo: string;
  titulo: string | null;
  contexto: string | null;
  situacaoActual: string | null;
  dorNecessidade: string | null;
  orcamentoTiming: string | null;
  decisor: string | null;
  proximoPassoNota: string | null;
  notasLivres: string | null;
  resumoIa: string | null;
  proximosPassosIa: unknown;
  gatilhosIa: unknown;
  dadosExtraidosIa: unknown;
  processamentoEstado: string;
  processamentoEngine: string | null;
  processamentoErro: string | null;
  processadoEm: Date | null;
  entidadeClienteId: string | null;
  leadComercialId: string | null;
  criadoPorUserId: string;
  createdAt: Date;
  entidadeCliente?: { id: string; nome: string; nif: string } | null;
  leadComercial?: { id: string; codigo: string; empresaNome: string } | null;
  criadoPor?: { id: string; displayName: string; email: string };
  sugestoesIa?: Array<{ id: string; titulo: string; descricao: string; estado: string; tipo: string; score: number }>;
};

export type SugestaoIaComercialResposta = {
  id: string;
  tenantId: string;
  interaccaoId: string | null;
  entidadeClienteId: string | null;
  leadComercialId: string | null;
  tipo: string;
  titulo: string;
  descricao: string;
  score: number;
  confianca: number;
  engine: string;
  metadata: unknown;
  estado: string;
  motivoRejeicao: string | null;
  validadoEm: Date | null;
  createdAt: Date;
  entidadeCliente?: { id: string; nome: string } | null;
  leadComercial?: { id: string; codigo: string; empresaNome: string } | null;
  interaccao?: { id: string; titulo: string | null; resumoIa: string | null; createdAt: Date } | null;
  validadoPor?: { displayName: string } | null;
  execucao?: CrmSugestaoExecucao;
};

export function mapInteraccaoRow(row: Record<string, unknown>): InteraccaoComercialResposta {
  const sugestoes = row.sugestoesIa as Array<Record<string, unknown>> | undefined;
  return {
    id: String(row.id),
    tenantId: String(row.tenantId),
    tipo: String(row.tipo),
    titulo: (row.titulo as string | null) ?? null,
    contexto: (row.contexto as string | null) ?? null,
    situacaoActual: (row.situacaoActual as string | null) ?? null,
    dorNecessidade: (row.dorNecessidade as string | null) ?? null,
    orcamentoTiming: (row.orcamentoTiming as string | null) ?? null,
    decisor: (row.decisor as string | null) ?? null,
    proximoPassoNota: (row.proximoPassoNota as string | null) ?? null,
    notasLivres: (row.notasLivres as string | null) ?? null,
    resumoIa: (row.resumoIa as string | null) ?? null,
    proximosPassosIa: row.proximosPassosIa ?? null,
    gatilhosIa: row.gatilhosIa ?? null,
    dadosExtraidosIa: row.dadosExtraidosIa ?? null,
    processamentoEstado: String(row.processamentoEstado),
    processamentoEngine: (row.processamentoEngine as string | null) ?? null,
    processamentoErro: (row.processamentoErro as string | null) ?? null,
    processadoEm: (row.processadoEm as Date | null) ?? null,
    entidadeClienteId: (row.entidadeClienteId as string | null) ?? null,
    leadComercialId: (row.leadComercialId as string | null) ?? null,
    criadoPorUserId: String(row.criadoPorUserId),
    createdAt: row.createdAt as Date,
    entidadeCliente: (row.entidadeCliente as InteraccaoComercialResposta["entidadeCliente"]) ?? null,
    leadComercial: (row.leadComercial as InteraccaoComercialResposta["leadComercial"]) ?? null,
    criadoPor: (row.criadoPor as InteraccaoComercialResposta["criadoPor"]) ?? undefined,
    sugestoesIa: sugestoes?.map((s) => ({
      id: String(s.id),
      titulo: String(s.titulo),
      descricao: String(s.descricao ?? ""),
      estado: String(s.estado),
      tipo: String(s.tipo),
      score: Number(s.score),
    })),
  };
}

export function mapSugestaoRow(row: Record<string, unknown>): SugestaoIaComercialResposta {
  const meta =
    row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : null;
  const execucaoFromMeta = meta?.execucao as CrmSugestaoExecucao | undefined;

  return {
    id: String(row.id),
    tenantId: String(row.tenantId),
    interaccaoId: (row.interaccaoId as string | null) ?? null,
    entidadeClienteId: (row.entidadeClienteId as string | null) ?? null,
    leadComercialId: (row.leadComercialId as string | null) ?? null,
    tipo: String(row.tipo),
    titulo: String(row.titulo),
    descricao: String(row.descricao),
    score: Number(row.score),
    confianca: Number(row.confianca),
    engine: String(row.engine),
    metadata: row.metadata ?? null,
    estado: String(row.estado),
    motivoRejeicao: (row.motivoRejeicao as string | null) ?? null,
    validadoEm: (row.validadoEm as Date | null) ?? null,
    createdAt: row.createdAt as Date,
    entidadeCliente: (row.entidadeCliente as SugestaoIaComercialResposta["entidadeCliente"]) ?? null,
    leadComercial: (row.leadComercial as SugestaoIaComercialResposta["leadComercial"]) ?? null,
    interaccao: (row.interaccao as SugestaoIaComercialResposta["interaccao"]) ?? null,
    validadoPor: (row.validadoPor as SugestaoIaComercialResposta["validadoPor"]) ?? null,
    execucao: (row.execucao as CrmSugestaoExecucao | undefined) ?? execucaoFromMeta,
  };
}
