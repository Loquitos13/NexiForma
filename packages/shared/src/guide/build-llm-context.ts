import type { JwtRole } from "../index";
import { getAllowedDestinations } from "./matcher";
import { GUIDE_KNOWLEDGE } from "./knowledge";
import type { GuideHistoryTurn } from "./types";
import { NEXIGUIA_INTRO } from "./identity";
import { resolveViewContext } from "./view-context";

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function relevantKnowledge(query: string, limit = 4): string[] {
  const nq = normalize(query);
  const scored = GUIDE_KNOWLEDGE.map((entry) => {
    let score = 0;
    for (const kw of entry.keywords) {
      const nkw = normalize(kw);
      if (nq.includes(nkw)) score += nkw.includes(" ") ? 10 : 6;
    }
    return { entry, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map((x) => x.entry.answer);
}

export type GuideLlmContext = {
  role: JwtRole | null;
  pathname: string;
  viewLabel: string;
  allowedRoutes: Array<{ href: string; label: string; description: string }>;
  knowledgeSnippets: string[];
};

export function buildGuideLlmContext(
  query: string,
  role: JwtRole | null,
  pathname: string,
): GuideLlmContext {
  const view = resolveViewContext(pathname);
  const allowed = getAllowedDestinations(role)
    .filter((d) => !d.href.includes("#"))
    .slice(0, 40);

  return {
    role,
    pathname,
    viewLabel: view.label,
    allowedRoutes: allowed.map((d) => ({
      href: d.href,
      label: d.label,
      description: d.description,
    })),
    knowledgeSnippets: relevantKnowledge(query),
  };
}

function buildRoleConstraints(role: JwtRole | null): string {
  switch (role) {
    case "formador":
      return `RESTRIÇÕES DO PERFIL (obrigatório):
- Formador NÃO tem página de perfil, Configurações da entidade nem portal do formando.
- Nunca uses navigate para /portal/configuracoes, /portal/formando/perfil, /portal/utilizadores ou rotas de gestor/comercial.
- Se pedirem perfil, conta ou definições pessoais, explica que a conta é gerida pelo gestor - sem oferecer ir a páginas inexistentes.`;
    case "formando":
      return `RESTRIÇÕES DO PERFIL (obrigatório):
- Formando só acede a rotas /portal/formando/* (inclui perfil em /portal/formando/perfil).
- Nunca uses navigate para áreas de gestão (/portal/crm, /portal/configuracoes, etc.).`;
    case "comercial":
      return `RESTRIÇÕES DO PERFIL (obrigatório):
- Comercial acede sobretudo ao CRM, propostas e faturação; não acede a Configurações globais da entidade nem Control Plane.`;
    default:
      return "";
  }
}

export function buildGuideLlmSystemPrompt(): string {
  return `És o NexiGuia - o teu nome é sempre NexiGuia, assistente conversacional do NexiForma (plataforma SaaS de formação certificada DGERT em Portugal).

A tua função: ajudar no portal a encontrar funcionalidades, explicar módulos e orientar a navegação para secções a que o utilizador tem acesso.

Regras obrigatórias:
- Responde SEMPRE em português de Portugal, de forma natural, profissional e assertiva - como especialista do produto, não como assistente limitado.
- Tom: evita linguagem que se menospreze («só posso», «apenas», «não tenho acesso», «desculpa mas»). Redirecciona com confiança para o NexiForma.
- Se perguntarem quem és ou como te chamas, apresenta-te como NexiGuia e resume a tua função no portal.
- Foca-te no NexiForma e no CONTEXTO fornecido. Temas externos (NIF genérico, INE, Segurança Social, clima, receitas, etc.): NUNCA respondas - redirecciona para funcionalidades do portal.
- Nunca inventes informação sobre validação de NIF, entidades públicas ou serviços externos.
- Nunca inventes URLs, dados em tempo real, números de clientes ou estado de registos.
- O campo "navigate" só pode ser um href EXACTO da lista ROTAS_PERMITIDAS, ou null.
- Se o utilizador perguntar sobre uma funcionalidade que não está em ROTAS_PERMITIDAS, explica o que é e para que serve - sem navigate.
- Se a CONVERSA RECENTE ofereceu ir a um destino permitido e o utilizador confirma (ex.: «sim», «ok», «podes»), define navigate para esse href - não reinicies o assunto.
- Se confirmarem um destino que o perfil não tem, explica a limitação com clareza - não navegues.
- Não digas que és um modelo local, rule-based ou que "apenas descreves".

Responde APENAS com JSON válido (sem markdown):
{"reply":"texto da resposta","navigate":null}`;
}

export function buildGuideLlmUserPrompt(
  query: string,
  ctx: GuideLlmContext,
  history?: GuideHistoryTurn[],
): string {
  const routes =
    ctx.allowedRoutes.length > 0
      ? ctx.allowedRoutes.map((r) => `- ${r.href} | ${r.label}: ${r.description}`).join("\n")
      : "- (nenhuma rota de portal - utilizador anónimo ou perfil limitado)";

  const knowledge =
    ctx.knowledgeSnippets.length > 0
      ? ctx.knowledgeSnippets.map((k, i) => `${i + 1}. ${k}`).join("\n")
      : "(sem snippets adicionais)";

  const roleConstraints = buildRoleConstraints(ctx.role);

  const historyBlock =
    history && history.length > 0
      ? `CONVERSA RECENTE:\n${history
          .slice(-6)
          .map((t) => `${t.role === "user" ? "Utilizador" : "NexiGuia"}: ${t.text}`)
          .join("\n")}\n\n`
      : "";

  return `${historyBlock}IDENTIDADE (o teu nome é NexiGuia):
${NEXIGUIA_INTRO}

CONTEXTO INTERNO (não repetir literalmente "estás em..." unless natural):
- Página actual: ${ctx.viewLabel}
- Perfil: ${ctx.role ?? "anónimo"}
${roleConstraints ? `\n${roleConstraints}\n` : ""}
ROTAS_PERMITIDAS (único destino válido para "navigate"):
${routes}

CONHECIMENTO NEXIFORMA:
${knowledge}

MENSAGEM DO UTILIZADOR:
${query}`;
}
