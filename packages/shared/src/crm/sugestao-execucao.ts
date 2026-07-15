export const CRM_SUGESTAO_ACOES = [
  "ENVIAR_PROPOSTA",
  "ACOMPANHAR_PROPOSTA",
  "CRIAR_PROPOSTA",
  "REGISTAR_FOLLOW_UP",
  "REGISTAR_LEAD",
] as const;

export type CrmSugestaoAcaoExecutavel = (typeof CRM_SUGESTAO_ACOES)[number];

export type CrmSugestaoExecucao = {
  sucesso: boolean;
  acao: CrmSugestaoAcaoExecutavel;
  mensagem: string;
  propostaId?: string;
  propostaCodigo?: string;
  interaccaoId?: string;
  leadCodigo?: string;
  executadoEm: string;
};

export function chaveSugestaoComercial(input: {
  tipo: string;
  titulo: string;
  metadata?: unknown;
}): string {
  const meta =
    input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata)
      ? (input.metadata as Record<string, unknown>)
      : {};
  if (meta.propostaCodigo && meta.acao) {
    return `${String(meta.acao)}:${String(meta.propostaCodigo)}`;
  }
  if (meta.leadCodigo && meta.acao) {
    return `${String(meta.acao)}:${String(meta.leadCodigo)}`;
  }
  if (meta.acao) {
    return `${String(meta.acao)}:${input.tipo}:${input.titulo}`;
  }
  return `${input.tipo}:${input.titulo}`;
}

export function inferirAcaoPlaneada(
  metadata: unknown,
  titulo: string,
  tipo: string,
): string | null {
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    const acao = (metadata as Record<string, unknown>).acao;
    if (typeof acao === "string") return labelAcaoSugestao(acao);
  }
  if (/^Enviar proposta/i.test(titulo)) return labelAcaoSugestao("ENVIAR_PROPOSTA");
  if (/^Acompanhar proposta/i.test(titulo)) return labelAcaoSugestao("ACOMPANHAR_PROPOSTA");
  if (/criar proposta|preparar primeira|iniciar relacionamento|proposta de formação|renovação/i.test(titulo)) {
    return labelAcaoSugestao("CRIAR_PROPOSTA");
  }
  if (/retomar contacto|nova abordagem/i.test(titulo) || tipo === "FOLLOW_UP") {
    return labelAcaoSugestao("REGISTAR_FOLLOW_UP");
  }
  if (tipo === "NOVO_LEAD") return labelAcaoSugestao("REGISTAR_LEAD");
  return null;
}

export function labelAcaoSugestao(acao: string): string {
  const map: Record<CrmSugestaoAcaoExecutavel, string> = {
    ENVIAR_PROPOSTA: "Enviar proposta",
    ACOMPANHAR_PROPOSTA: "Acompanhar proposta",
    CRIAR_PROPOSTA: "Criar proposta",
    REGISTAR_FOLLOW_UP: "Registar follow-up",
    REGISTAR_LEAD: "Registar lead",
  };
  return map[acao as CrmSugestaoAcaoExecutavel] ?? acao;
}

export function mensagemAceiteSugestao(data: {
  execucao?: CrmSugestaoExecucao | null;
  leadComercial?: { codigo: string } | null;
}): string {
  if (data.execucao?.mensagem) {
    const prefix = data.execucao.sucesso ? "Executado" : "Aceite, mas execução falhou";
    return `${prefix}: ${data.execucao.mensagem}`;
  }
  if (data.leadComercial?.codigo) {
    return `Lead ${data.leadComercial.codigo} registado na pipeline.`;
  }
  return "Sugestão aceite.";
}
