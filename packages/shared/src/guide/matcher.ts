import { canManageCrm, isComercial, isCrmPortalPath, isFormador, isFormando, roleSatisfies } from "../access";
import type { JwtRole } from "../index";
import { GUIDE_DESTINATIONS } from "./destinations";
import { GUIDE_KNOWLEDGE, type GuideKnowledgeEntry } from "./knowledge";
import { NEXIGUIA_INTRO, NEXIGUIA_OUT_OF_SCOPE } from "./identity";
import type {
  GuideAnswerResult,
  GuideDestination,
  GuideHelpResult,
  GuideHistoryTurn,
  GuideOutOfScopeResult,
  GuideQueryContext,
  GuideResult,
  GuideSearchHit,
  GuideUnknownResult,
  GuideViewContext,
} from "./types";
import { resolveViewContext } from "./view-context";

const NAV_INTENT =
  /\b(ir para|abrir|onde fica|onde esta|mostra|mostrar|leva|levar|ver|aceder|acessar|navegar|quero ir|leva me|levar me)\b/;

const HELP_INTENT =
  /^(ajuda|help|oi|ola|olá|bom dia|boa tarde|boa noite|menu|opcoes|opções)$/;

const QUESTION_INTENT =
  /\b(como|o que|oque|qual|quais|porque|porquê|quando|onde|posso|devo|explica|funciona|serve para|para que serve)\b/;

const OUT_OF_SCOPE =
  /\b(receita|tempo|clima|previsao|futebol|desporto|bitcoin|crypto|chatgpt|openai|gpt|excel|word|powerpoint|python|javascript|java\b|google docs|facebook|instagram|tiktok|netflix|filme|serie|medico|saude|politica|trump|bolo|cozinhar|piada|tabela periodica|matematica avancada)\b/;

/** Temas administrativos/fiscais genéricos (fora do NexiForma). */
const EXTERNAL_ADMIN =
  /\b(validar|verificar|consultar|como saber|saber se|e valido|é valido|esta valido|está valido)\b[\s\S]{0,40}\b(nif|nipc|niss|iban|cartao cidadao|cc)\b|\b(nif|nipc|niss|iban)\b[\s\S]{0,30}\b(valido|valida|validar|verificar)\b|\b(ine|instituto nacional de estatistica|seguranca social|financas|autoridade tributaria)\b/;

const NEXIFORMA_SCOPE =
  /\b(nexiforma|nexigui|dgert|sigo|dgeec|lms|scorm|crm|lead|fatura|faturacao|saft|at\b|cmd|rgpd|formando|formador|tenant|ufcd|compliance|dossie|dossier|matricula|inscricao|proposta|contrato|certificado|integracao|zoom|teams|portal|accao|acao formativa|curso|turma|sumario|lead|proposta)\b/;

const PROFILE_INTENT =
  /\b(perfil|conta|definicoes|configuracoes|settings|preferencias|meus dados|alterar dados|ver perfil)\b/;

const AFFIRMATIVE_INTENT =
  /^(sim|s|ok|okay|claro|podes|va|vamos|isso|exacto|exato|por favor|yes|yep|seria otimo|seria ótimo|pode ser|confirmo)[\s!.?]*$/;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(text: string): string[] {
  return normalize(text)
    .split(" ")
    .filter((t) => t.length > 1);
}

function destinationAllowed(dest: GuideDestination, role: JwtRole | null): boolean {
  if (dest.publicOnly) return true;
  if (!role) return false;
  if (dest.minRole === "super_admin") return role === "super_admin";
  if (dest.formandoOnly) return isFormando(role);
  if (isFormando(role)) return false;
  if (isComercial(role)) {
    return (
      dest.minRole === "comercial" ||
      isCrmPortalPath(dest.href) ||
      dest.href === "/portal/rgpd"
    );
  }
  if (canManageCrm(role) && isCrmPortalPath(dest.href)) return true;
  if (dest.minRole && !roleSatisfies(role, dest.minRole)) return false;
  return true;
}

function findDestination(href: string): GuideDestination | undefined {
  const base = href.split("#")[0]!;
  return GUIDE_DESTINATIONS.find((d) => d.href === href || d.href === base);
}

function labelForHref(href: string): string {
  return findDestination(href)?.label ?? href;
}

function relatedLinks(hrefs: string[] | undefined, role: JwtRole | null) {
  if (!hrefs) return [];
  return hrefs
    .filter((href) => {
      const dest = findDestination(href);
      return dest ? destinationAllowed(dest, role) : href.startsWith("/#");
    })
    .map((href) => ({ href, label: labelForHref(href) }));
}

function userCanAccessAny(hrefs: string[] | undefined, role: JwtRole | null): boolean {
  return relatedLinks(hrefs, role).length > 0;
}

function relatedBoost(pathname: string | undefined, dest: GuideDestination): number {
  if (!pathname) return 0;
  const view = resolveViewContext(pathname);
  if (view.related.some((r) => r.href === dest.href)) return 6;
  return 0;
}

function sharesPrefix(a: string, b: string, min = 4): boolean {
  const len = Math.min(a.length, b.length);
  return len >= min && a.slice(0, min) === b.slice(0, min);
}

function scoreSearchDestination(
  query: string,
  queryTokens: string[],
  dest: GuideDestination,
): number {
  const normalizedQuery = normalize(query);
  const normalizedLabel = normalize(dest.label);
  const haystack = normalize([dest.label, dest.description, ...dest.keywords].join(" "));
  let score = 0;

  for (const kw of dest.keywords) {
    const nkw = normalize(kw);
    if (nkw.length >= 3 && normalizedQuery.includes(nkw)) {
      score += nkw.includes(" ") ? 14 : 10;
    } else if (nkw.length === 2 && queryTokens.includes(nkw)) {
      score += 8;
    }
  }

  if (normalizedLabel === normalizedQuery) score += 24;
  if (normalizedQuery.includes(normalizedLabel)) score += 12;
  if (normalizedLabel.includes(normalizedQuery) && normalizedQuery.length >= 2) score += 10;

  for (const token of queryTokens) {
    if (haystack.split(" ").some((word) => word === token || sharesPrefix(word, token))) {
      score += 4;
    }
    for (const kw of dest.keywords) {
      const nkw = normalize(kw);
      if (
        nkw === token ||
        nkw.startsWith(token) ||
        token.startsWith(nkw) ||
        sharesPrefix(nkw, token)
      ) {
        score += 5;
      }
    }
  }

  return score;
}

function scoreDestination(
  query: string,
  queryTokens: string[],
  dest: GuideDestination,
  pathname?: string,
): number {
  const normalizedQuery = normalize(query);
  const haystack = normalize([dest.label, dest.description, ...dest.keywords].join(" "));
  let score = relatedBoost(pathname, dest);

  for (const kw of dest.keywords) {
    const nkw = normalize(kw);
    if (nkw.length >= 3 && normalizedQuery.includes(nkw)) {
      score += nkw.includes(" ") ? 12 : 8;
    }
  }

  if (normalize(dest.label) === normalizedQuery) score += 20;
  if (normalizedQuery.includes(normalize(dest.label))) score += 10;

  for (const token of queryTokens) {
    if (haystack.split(" ").includes(token)) score += 3;
    for (const kw of dest.keywords) {
      const nkw = normalize(kw);
      if (nkw.startsWith(token) || token.startsWith(nkw)) score += 2;
    }
  }

  return score;
}

function rankDestinations(
  query: string,
  queryTokens: string[],
  pathname: string | undefined,
  onlyAllowed: JwtRole | null | "all",
) {
  const pool =
    onlyAllowed === "all"
      ? GUIDE_DESTINATIONS
      : GUIDE_DESTINATIONS.filter((d) => destinationAllowed(d, onlyAllowed));

  return pool
    .map((dest) => ({
      dest,
      score: scoreDestination(query, queryTokens, dest, pathname),
    }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
}

function scoreKnowledge(
  query: string,
  queryTokens: string[],
): { entry: GuideKnowledgeEntry; score: number } | null {
  const normalizedQuery = normalize(query);
  let best: { entry: GuideKnowledgeEntry; score: number } | null = null;

  for (const entry of GUIDE_KNOWLEDGE) {
    let score = 0;
    for (const kw of entry.keywords) {
      const nkw = normalize(kw);
      if (normalizedQuery.includes(nkw)) score += nkw.includes(" ") ? 14 : 9;
    }
    for (const token of queryTokens) {
      for (const kw of entry.keywords) {
        const nkw = normalize(kw);
        if (
          nkw.includes(token) ||
          (token.length >= 4 && nkw.split(" ").some((w) => w.startsWith(token)))
        ) {
          score += 3;
        }
      }
    }
    if (!best || score > best.score) best = { entry, score };
  }

  return best && best.score >= 6 ? best : null;
}

function listAllowed(role: JwtRole | null): GuideDestination[] {
  return GUIDE_DESTINATIONS.filter((d) => destinationAllowed(d, role));
}

function primaryDestinationForKnowledge(entry: GuideKnowledgeEntry): GuideDestination | undefined {
  for (const href of entry.related ?? []) {
    const dest = findDestination(href);
    if (dest) return dest;
  }
  return undefined;
}

/** Resposta informativa sem links quando o perfil não tem acesso. */
function explainDestination(dest: GuideDestination, role: JwtRole | null): GuideAnswerResult {
  return {
    type: "answer",
    reply: `${dest.label}: ${dest.description}`,
    related:
      !role && !dest.publicOnly && dest.href.startsWith("/portal")
        ? relatedLinks(["/login"], role)
        : [],
  };
}

function formadorProfileAnswer(role: JwtRole | null): GuideAnswerResult {
  return {
    type: "answer",
    reply:
      "O portal do formador não inclui página de perfil - a gestão da conta fica com o gestor da entidade. Posso mostrar-te cursos, ações formativas, LMS e conteúdos.",
    related: listAllowed(role)
      .filter((d) => !d.publicOnly && !d.href.includes("#"))
      .slice(0, 4)
      .map((d) => ({ href: d.href, label: d.label })),
  };
}

function isFormadorProfileQuery(query: string, role: JwtRole | null): boolean {
  return isFormador(role) && PROFILE_INTENT.test(normalize(query));
}

/**
 * Resolve confirmações curtas («sim», «ok») com base no contexto recente.
 */
export function resolveGuideFollowUp(
  message: string,
  history: GuideHistoryTurn[],
  ctx: GuideQueryContext,
): GuideResult | null {
  const trimmed = message.trim();
  if (!trimmed || history.length === 0) return null;
  if (!AFFIRMATIVE_INTENT.test(normalize(trimmed))) return null;

  const { role, pathname } = ctx;
  const recentText = history
    .slice(-4)
    .map((t) => t.text)
    .join(" ");
  const recentNorm = normalize(recentText);

  if (isFormador(role) && PROFILE_INTENT.test(recentNorm)) {
    return formadorProfileAnswer(role);
  }

  const recentTokens = tokens(recentText);
  const allowedRanked = rankDestinations(recentText, recentTokens, pathname, role);
  const topAllowed = allowedRanked[0];

  if (topAllowed && topAllowed.score >= 8) {
    return {
      type: "navigate",
      href: topAllowed.dest.href,
      label: topAllowed.dest.label,
      description: topAllowed.dest.description,
      confidence: Math.min(topAllowed.score / 20, 1),
      reply: `A abrir ${topAllowed.dest.label}.`,
    };
  }

  const allRanked = rankDestinations(recentText, recentTokens, pathname, "all");
  const topAll = allRanked[0];

  if (topAll && topAll.score >= 6 && !destinationAllowed(topAll.dest, role)) {
    return explainDestination(topAll.dest, role);
  }

  return null;
}

function knowledgeResult(entry: GuideKnowledgeEntry, role: JwtRole | null): GuideAnswerResult {
  if (userCanAccessAny(entry.related, role)) {
    return {
      type: "answer",
      reply: entry.answer,
      related: relatedLinks(entry.related, role),
    };
  }

  const primary = primaryDestinationForKnowledge(entry);
  if (primary) {
    return explainDestination(primary, role);
  }

  const summary = entry.answer.split(".").slice(0, 2).join(".").trim();
  return {
    type: "answer",
    reply: summary.endsWith(".") ? summary : `${summary}.`,
    related: [],
  };
}

function contextualExamples(role: JwtRole | null): string[] {
  const allowed = listAllowed(role).filter((d) => !d.href.includes("#"));

  if (!role) {
    return ["O que é o NexiForma?", "Quais as integrações?", "Entrar"];
  }

  const questions = allowed
    .filter((d) => d.href.startsWith("/portal") || d.href.startsWith("/plataforma"))
    .slice(0, 4)
    .map((d) => `Para que serve ${d.label.toLowerCase()}?`);

  if (questions.length >= 2) return questions;

  if (isFormando(role)) {
    return ["Para que serve o calendário?", "Como funcionam as inscrições?"];
  }
  if (isComercial(role)) {
    return ["Para que servem os leads?", "Como funcionam as propostas?"];
  }

  return ["Para que serve o LMS?", "O que é o dossier DGERT?"];
}

function helpResult(role: JwtRole | null, _view?: GuideViewContext): GuideHelpResult {
  const allowed = listAllowed(role);

  return {
    type: "help",
    reply: NEXIGUIA_INTRO,
    examples: contextualExamples(role),
    destinations: allowed.slice(0, 8).map((d) => ({ href: d.href, label: d.label })),
  };
}

function sectionHintResult(view: GuideViewContext, role: JwtRole | null): GuideAnswerResult {
  const related = relatedLinks(
    view.related.map((r) => r.href),
    role,
  );

  const reply =
    related.length > 0
      ? `${view.description} Indica-me o que precisas - abro secções relacionadas ou explico o fluxo.`
      : view.description;

  return { type: "answer", reply, related };
}

function outOfScopeResult(role: JwtRole | null): GuideOutOfScopeResult {
  const allowed = listAllowed(role);
  return {
    type: "out_of_scope",
    reply: NEXIGUIA_OUT_OF_SCOPE,
    suggestions: allowed.slice(0, 4).map((d) => ({ href: d.href, label: d.label })),
  };
}

function unknownResult(role: JwtRole | null, query: string, pathname?: string): GuideUnknownResult {
  const allowed = listAllowed(role);
  const queryTokens = tokens(query);
  const ranked = rankDestinations(query, queryTokens, pathname, role)
    .slice(0, 4);

  const allRanked = rankDestinations(query, queryTokens, pathname, "all");
  const topBlocked = allRanked.find((r) => !destinationAllowed(r.dest, role));

  if (ranked.length === 0 && topBlocked && topBlocked.score >= 6) {
    const explain = explainDestination(topBlocked.dest, role);
    return {
      type: "unknown",
      reply: explain.reply,
      suggestions: [],
    };
  }

  const loginHint = !role ? " Para o portal, entra primeiro." : "";

  return {
    type: "unknown",
    reply:
      ranked.length > 0
        ? `Estas secções encaixam no que pediste:${loginHint}`
        : `Reformula em termos do NexiForma - por exemplo «para que serve o LMS?» ou «ir para leads».${loginHint}`,
    suggestions: (ranked.length > 0 ? ranked : allowed.slice(0, 4).map((d) => ({ dest: d, score: 0 }))).map(
      (r) => ({ href: r.dest.href, label: r.dest.label }),
    ),
  };
}

function isOutOfScope(query: string): boolean {
  const n = normalize(query);
  if (OUT_OF_SCOPE.test(n)) return true;
  if (EXTERNAL_ADMIN.test(n) && !NEXIFORMA_SCOPE.test(n)) return true;
  const isQuestion = QUESTION_INTENT.test(n) || n.includes("?");
  if (isQuestion && !NEXIFORMA_SCOPE.test(n)) return true;
  return false;
}

/** Verifica se a mensagem é externa ao NexiForma (usar antes do LLM). */
export function isGuideOutOfScope(query: string): boolean {
  return isOutOfScope(query.trim());
}

export function guideOutOfScopeResult(role: JwtRole | null): GuideOutOfScopeResult {
  return outOfScopeResult(role);
}

function resolveCtx(ctx: GuideQueryContext | JwtRole | null): GuideQueryContext {
  if (ctx === null || typeof ctx === "string") return { role: ctx };
  return ctx;
}

/**
 * Motor local: navegação + Q&A sobre NexiForma. Sem LLM nem agents externos.
 */
export function queryGuide(input: string, ctx: GuideQueryContext | JwtRole | null): GuideResult {
  const { role, pathname, history } = resolveCtx(ctx);
  const view = pathname ? resolveViewContext(pathname) : undefined;

  const query = input.trim();
  if (!query) return helpResult(role, view);

  if (history?.length) {
    const followUp = resolveGuideFollowUp(query, history, { role, pathname });
    if (followUp) return followUp;
  }

  const normalized = normalize(query);

  if (isFormadorProfileQuery(query, role)) {
    const knowledge = scoreKnowledge(query, tokens(query));
    if (knowledge?.entry.id === "formador") {
      return knowledgeResult(knowledge.entry, role);
    }
    return formadorProfileAnswer(role);
  }

  if (HELP_INTENT.test(normalized)) {
    return helpResult(role, view);
  }

  if (isOutOfScope(query)) {
    return outOfScopeResult(role);
  }

  const queryTokens = tokens(query);
  const knowledge = scoreKnowledge(query, queryTokens);
  const navExplicit = NAV_INTENT.test(normalized);
  const isQuestion = QUESTION_INTENT.test(normalized) || normalized.includes("?");

  const allRanked = rankDestinations(query, queryTokens, pathname, "all");
  const allowedRanked = rankDestinations(query, queryTokens, pathname, role);

  const topAll = allRanked[0];
  const topAllowed = allowedRanked[0];
  const secondAllowed = allowedRanked[1];

  if (navExplicit && topAll && topAll.score >= 4) {
    if (!destinationAllowed(topAll.dest, role)) {
      return explainDestination(topAll.dest, role);
    }

    const needsAuth = !role && !topAll.dest.publicOnly && topAll.dest.href.startsWith("/portal");
    if (needsAuth) {
      return {
        type: "navigate",
        href: "/login",
        label: "Entrar",
        description: "Autenticação necessária para aceder ao portal.",
        confidence: 0.9,
        reply: "Esta área requer autenticação no portal.",
      };
    }

    return {
      type: "navigate",
      href: topAll.dest.href,
      label: topAll.dest.label,
      description: topAll.dest.description,
      confidence: Math.min(topAll.score / 20, 1),
      reply: `A abrir ${topAll.dest.label}.`,
    };
  }

  if (knowledge && (isQuestion || !topAllowed || knowledge.score >= topAllowed.score + 2)) {
    return knowledgeResult(knowledge.entry, role);
  }

  if (
    topAllowed &&
    topAllowed.score >= 8 &&
    (!secondAllowed || topAllowed.score >= secondAllowed.score + 4) &&
    !isQuestion
  ) {
    const needsAuth =
      !role && !topAllowed.dest.publicOnly && topAllowed.dest.href.startsWith("/portal");
    if (needsAuth) {
      return {
        type: "navigate",
        href: "/login",
        label: "Entrar",
        description: "Autenticação necessária.",
        confidence: 0.9,
        reply: "Esta secção está no portal. Inicia sessão para continuar.",
      };
    }
    return {
      type: "navigate",
      href: topAllowed.dest.href,
      label: topAllowed.dest.label,
      description: topAllowed.dest.description,
      confidence: Math.min(topAllowed.score / 20, 1),
      reply: `A abrir ${topAllowed.dest.label}. ${topAllowed.dest.description}`,
    };
  }

  if (topAll && topAll.score >= 6 && !destinationAllowed(topAll.dest, role) && isQuestion) {
    return explainDestination(topAll.dest, role);
  }

  if (allowedRanked.length >= 2 && topAllowed && topAllowed.score >= 4 && navExplicit) {
    return {
      type: "suggest",
      reply: "Encontrei várias secções. Qual preferes?",
      options: allowedRanked.slice(0, 4).map((r) => ({
        href: r.dest.href,
        label: r.dest.label,
        description: r.dest.description,
        score: r.score,
      })),
    };
  }

  if (isQuestion && view) {
    const viewKnowledge = scoreKnowledge(`${view.label} ${normalized}`, tokens(view.label));
    if (viewKnowledge && viewKnowledge.score >= 6) {
      return knowledgeResult(viewKnowledge.entry, role);
    }
    return sectionHintResult(view, role);
  }

  if (knowledge) {
    return knowledgeResult(knowledge.entry, role);
  }

  if (topAllowed && topAllowed.score >= 4) {
    return {
      type: "suggest",
      reply: "Queres saber mais sobre alguma destas secções?",
      options: allowedRanked.slice(0, 4).map((r) => ({
        href: r.dest.href,
        label: r.dest.label,
        description: r.dest.description,
        score: r.score,
      })),
    };
  }

  return unknownResult(role, query, pathname);
}

export function getAllowedDestinations(role: JwtRole | null): GuideDestination[] {
  return listAllowed(role);
}

export function canAccessDestination(dest: GuideDestination, role: JwtRole | null): boolean {
  return destinationAllowed(dest, role);
}

export function findGuideDestinationByHref(href: string): GuideDestination | undefined {
  return findDestination(href);
}

function pickMatchedKeywords(query: string, keywords: string[]): string[] {
  const normalizedQuery = normalize(query);
  const queryToks = tokens(query);
  const matched = keywords.filter((kw) => {
    const nkw = normalize(kw);
    if (nkw.length >= 3 && normalizedQuery.includes(nkw)) return true;
    if (nkw.length >= 3 && nkw.includes(normalizedQuery)) return true;
    if (nkw.length === 2 && queryToks.includes(nkw)) return true;
    return queryToks.some(
      (t) =>
        t.length >= 2 &&
        (nkw.includes(t) ||
          t.includes(nkw) ||
          nkw.startsWith(t) ||
          t.startsWith(nkw) ||
          sharesPrefix(nkw, t)),
    );
  });
  return matched.slice(0, 4);
}

/** Pesquisa local de funcionalidades do portal (keywords + label). */
export function searchGuideDestinations(
  query: string,
  ctx: GuideQueryContext | JwtRole | null,
  limit = 8,
): GuideSearchHit[] {
  const { role } = resolveCtx(ctx);
  const trimmed = query.trim();

  if (!trimmed) {
    return listAllowed(role)
      .filter((d) => !d.href.includes("#") && (!role || !d.publicOnly))
      .slice(0, limit)
      .map((dest) => ({
        href: dest.href,
        label: dest.label,
        description: dest.description,
        matchedKeywords: dest.keywords.slice(0, 3),
        score: 0,
      }));
  }

  const queryTokens = tokens(trimmed);
  const ranked = listAllowed(role)
    .filter((d) => !role || !d.publicOnly)
    .map((dest) => ({
      dest,
      score: scoreSearchDestination(trimmed, queryTokens, dest),
    }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return ranked.map(({ dest, score }) => ({
    href: dest.href,
    label: dest.label,
    description: dest.description,
    matchedKeywords: pickMatchedKeywords(trimmed, dest.keywords),
    score,
  }));
}

/** Converte resposta do guia (IA/local) em sugestões de pesquisa. */
export function guideResultToSearchHits(result: GuideResult, limit = 6): GuideSearchHit[] {
  const aiTag = ["sugerido"];
  const toHit = (
    href: string,
    label: string,
    description: string,
    score: number,
  ): GuideSearchHit => ({
    href,
    label,
    description,
    matchedKeywords: aiTag,
    score,
  });

  switch (result.type) {
    case "navigate":
      return [toHit(result.href, result.label, result.description, 10)];
    case "suggest":
      return result.options.slice(0, limit).map((o) =>
        toHit(o.href, o.label, o.description, o.score),
      );
    case "unknown":
      return result.suggestions.slice(0, limit).map((s, i) =>
        toHit(
          s.href,
          s.label,
          findDestination(s.href)?.description ?? "",
          8 - i,
        ),
      );
    case "help":
      return result.destinations.slice(0, limit).map((d, i) =>
        toHit(
          d.href,
          d.label,
          findDestination(d.href)?.description ?? "",
          6 - i,
        ),
      );
    case "answer":
      return result.related.slice(0, limit).map((r, i) =>
        toHit(
          r.href,
          r.label,
          result.reply.slice(0, 120),
          7 - i,
        ),
      );
    case "out_of_scope":
      return result.suggestions.slice(0, limit).map((s, i) =>
        toHit(
          s.href,
          s.label,
          findDestination(s.href)?.description ?? "",
          5 - i,
        ),
      );
    default:
      return [];
  }
}

export { resolveViewContext };
