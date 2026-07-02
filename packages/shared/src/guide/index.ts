export { GUIDE_DESTINATIONS } from "./destinations";
export { NEXIGUIA_INTRO, NEXIGUIA_OUT_OF_SCOPE, NEXIGUIA_CAPABILITIES } from "./identity";
export {
  queryGuide,
  resolveGuideFollowUp,
  isGuideOutOfScope,
  guideOutOfScopeResult,
  resolveViewContext,
  getAllowedDestinations,
  canAccessDestination,
  findGuideDestinationByHref,
  searchGuideDestinations,
  guideResultToSearchHits,
} from "./matcher";
export {
  buildGuideLlmContext,
  buildGuideLlmSystemPrompt,
  buildGuideLlmUserPrompt,
  type GuideLlmContext,
} from "./build-llm-context";
export type {
  GuideDestination,
  GuideHelpResult,
  GuideNavigateResult,
  GuideQueryContext,
  GuideHistoryTurn,
  GuideResult,
  GuideSuggestResult,
  GuideUnknownResult,
  GuideAnswerResult,
  GuideOutOfScopeResult,
  GuideSearchHit,
  GuideViewArea,
  GuideViewContext,
} from "./types";
