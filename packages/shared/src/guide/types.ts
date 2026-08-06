import type { JwtRole } from "../index";
import type { TenantEntitlements } from "../billing/entitlements";

export type GuideViewArea = "public" | "auth" | "portal" | "platform";

export type GuideViewContext = {
  pathname: string;
  area: GuideViewArea;
  label: string;
  description: string;
  related: Array<{ href: string; label: string }>;
  hints: string[];
};

export type GuideQueryContext = {
  role: JwtRole | null;
  pathname?: string;
  history?: GuideHistoryTurn[];
  entitlements?: TenantEntitlements | null;
};

export type GuideHistoryTurn = {
  role: "user" | "assistant";
  text: string;
};

export type GuideDestination = {
  href: string;
  label: string;
  /** Descrição curta para o utilizador */
  description: string;
  /** Palavras-chave e sinónimos (sem acentos - normalizados na pesquisa) */
  keywords: string[];
  minRole?: JwtRole;
  /** Rotas só para formandos */
  formandoOnly?: boolean;
  /** Rotas só para formadores (self-service) */
  formadorOnly?: boolean;
  /** Visível sem sessão (website, login) */
  publicOnly?: boolean;
};

export type GuideNavigateResult = {
  type: "navigate";
  href: string;
  label: string;
  description: string;
  confidence: number;
  reply: string;
};

export type GuideSuggestResult = {
  type: "suggest";
  reply: string;
  options: Array<{ href: string; label: string; description: string; score: number }>;
};

export type GuideHelpResult = {
  type: "help";
  reply: string;
  examples: string[];
  destinations: Array<{ href: string; label: string }>;
};

export type GuideUnknownResult = {
  type: "unknown";
  reply: string;
  suggestions: Array<{ href: string; label: string }>;
};

export type GuideAnswerResult = {
  type: "answer";
  reply: string;
  related: Array<{ href: string; label: string }>;
};

export type GuideOutOfScopeResult = {
  type: "out_of_scope";
  reply: string;
  suggestions: Array<{ href: string; label: string }>;
};

/** Resultado da pesquisa global do portal (funcionalidades + registos). */
export type GuideSearchHit = {
  href: string;
  label: string;
  description: string;
  matchedKeywords: string[];
  score: number;
  /** `registo` = entidade concreta (proposta, lead, cliente…); omitido = funcionalidade. */
  kind?: "funcionalidade" | "registo";
  /** Rótulo de secção na UI (ex. «Proposta», «Cliente»). */
  category?: string;
};

export type GuideResult =
  | GuideNavigateResult
  | GuideSuggestResult
  | GuideHelpResult
  | GuideUnknownResult
  | GuideAnswerResult
  | GuideOutOfScopeResult;
