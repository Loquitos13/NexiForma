import type { Prisma, SugestaoIaTipo } from "@nexiforma/database";
import type { CrmSugestaoAcaoExecutavel } from "@nexiforma/shared";

export type EntidadeContextoProactivo = {
  id: string;
  nome: string;
  nif: string;
  email: string | null;
  isParceiro: boolean;
  propostas: Array<{
    estado: string;
    codigo: string;
    titulo: string;
    updatedAt: Date;
    enviadaEm: Date | null;
  }>;
  interaccoes: Array<{
    titulo: string | null;
    resumoIa: string | null;
    dorNecessidade: string | null;
    proximoPassoNota: string | null;
    createdAt: Date;
  }>;
  leads: Array<{
    estado: string;
    codigo: string;
    valorEstimadoCentavos: number;
  }>;
};

type SugestaoDraft = Omit<
  Prisma.SugestaoIaComercialCreateManyInput,
  "tenantId" | "entidadeClienteId"
>;

function mesesAtras(date: Date, meses: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() - meses);
  return d;
}

function base(
  acao: CrmSugestaoAcaoExecutavel,
  tipo: SugestaoIaTipo,
  titulo: string,
  descricao: string,
  score: number,
  confianca: number,
  metadata?: Record<string, unknown>,
): SugestaoDraft {
  return {
    interaccaoId: null,
    leadComercialId: null,
    tipo,
    titulo: titulo.slice(0, 300),
    descricao,
    score,
    confianca,
    engine: "local",
    metadata: { proactiva: true, acao, ...metadata },
  };
}

/** Gera sugestões comerciais a partir do contexto disponível (sem exigir propostas). */
export function buildSugestoesProactivas(ctx: EntidadeContextoProactivo): SugestaoDraft[] {
  const out: SugestaoDraft[] = [];
  const agora = new Date();

  const rascunho = ctx.propostas.find((p) => p.estado === "RASCUNHO");
  if (rascunho) {
    out.push(
      base(
        "ENVIAR_PROPOSTA",
        "FOLLOW_UP",
        `Enviar proposta ${rascunho.codigo}`,
        `A proposta «${rascunho.titulo}» está em rascunho. Envie ao cliente para avançar a conversão comercial.`,
        78,
        0.85,
        { propostaCodigo: rascunho.codigo },
      ),
    );
  }

  const enviada = ctx.propostas.find((p) => p.estado === "ENVIADA");
  if (enviada) {
    out.push(
      base(
        "ACOMPANHAR_PROPOSTA",
        "FOLLOW_UP",
        `Acompanhar proposta ${enviada.codigo}`,
        `Proposta «${enviada.titulo}» aguarda resposta do cliente. Confirme receção ou faça follow-up amigável.`,
        74,
        0.8,
        { propostaCodigo: enviada.codigo },
      ),
    );
  }

  const leadAberto = ctx.leads.find((l) =>
    ["NOVO", "CONTACTADO", "QUALIFICADO"].includes(l.estado),
  );
  const semPropostaActiva = !ctx.propostas.some((p) =>
    ["RASCUNHO", "ENVIADA", "ACEITE"].includes(p.estado),
  );
  if (leadAberto && semPropostaActiva) {
    out.push(
      base(
        "CRIAR_PROPOSTA",
        "OUTRO",
        "Criar proposta para converter lead",
        `Lead ${leadAberto.codigo} associado a ${ctx.nome} sem proposta activa. Crie e envie proposta comercial para converter automaticamente ao aceite.`,
        76,
        0.82,
        { leadCodigo: leadAberto.codigo },
      ),
    );
  }

  const ultimaNota = ctx.interaccoes[0];
  if (ultimaNota) {
    const snippet =
      ultimaNota.resumoIa?.trim() ||
      ultimaNota.dorNecessidade?.trim() ||
      ultimaNota.proximoPassoNota?.trim();
    if (snippet) {
      out.push(
        base(
          "REGISTAR_FOLLOW_UP",
          "FOLLOW_UP",
          "Retomar contacto comercial",
          snippet.length > 320 ? `${snippet.slice(0, 317)}…` : snippet,
          68,
          0.72,
          { interaccaoRecente: true },
        ),
      );
    }
  }

  const aceite = ctx.propostas.find((p) => p.estado === "ACEITE");
  if (aceite && aceite.updatedAt < mesesAtras(agora, 12)) {
    out.push(
      base(
        "CRIAR_PROPOSTA",
        "RENOVACAO",
        "Renovação ou nova formação",
        `Última proposta aceite (${aceite.codigo}) há mais de 12 meses. Avalie renovação, recertificação ou novo ciclo formativo.`,
        65,
        0.7,
        { propostaCodigo: aceite.codigo },
      ),
    );
  }

  const soRejeitadas =
    ctx.propostas.length > 0 &&
    ctx.propostas.every((p) => p.estado === "REJEITADA" || p.estado === "CANCELADA");
  if (soRejeitadas) {
    const ultima = ctx.propostas[0]!;
    out.push(
      base(
        "REGISTAR_FOLLOW_UP",
        "OUTRO",
        "Nova abordagem comercial",
        `Propostas anteriores não avançaram (ex.: ${ultima.codigo}). Registe nova nota de reunião ou envie proposta revista com condições actualizadas.`,
        62,
        0.65,
      ),
    );
  }

  if (
    out.length === 0 &&
    ctx.propostas.length === 0 &&
    ctx.interaccoes.length === 0 &&
    ctx.leads.length === 0
  ) {
    out.push(
      base(
        "CRIAR_PROPOSTA",
        "OUTRO",
        "Iniciar relacionamento comercial",
        `${ctx.nome} ainda não tem notas, leads nem propostas. Registe um contacto inicial ou prepare a primeira proposta comercial para activar a conversão.`,
        58,
        0.6,
        { coldStart: true },
      ),
    );
  } else if (out.length === 0 && semPropostaActiva && ctx.propostas.length === 0) {
    out.push(
      base(
        "CRIAR_PROPOSTA",
        "OUTRO",
        "Preparar primeira proposta",
        `Cliente com histórico comercial (${ctx.interaccoes.length} nota(s)) mas sem proposta. Consolide o interesse numa proposta formal para avançar a venda.`,
        64,
        0.68,
      ),
    );
  }

  const seen = new Set<string>();
  return out
    .filter((s) => {
      const key = `${s.tipo}:${s.titulo}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 3);
}
