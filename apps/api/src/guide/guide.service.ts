import { Injectable } from "@nestjs/common";
import {
  guideOutOfScopeResult,
  guideResultToSearchHits,
  isGuideOutOfScope,
  queryGuide,
  resolveGuideFollowUp,
  searchGuideDestinations,
  type GuideHistoryTurn,
  type GuideResult,
  type GuideSearchHit,
  type JwtRole,
} from "@nexiforma/shared";
import { GuideLlmService } from "./guide-llm.service";

export type GuideChatResponse = GuideResult & { engine: "llm" | "local" };

export type GuideSearchResponse = {
  hits: GuideSearchHit[];
  source: "local" | "ai";
  hint?: string;
};

@Injectable()
export class GuideService {
  constructor(private readonly llm: GuideLlmService) {}

  async search(
    query: string,
    pathname: string,
    role: JwtRole | null,
  ): Promise<GuideSearchResponse> {
    const trimmed = query.trim();
    const local = searchGuideDestinations(trimmed, { role, pathname }, 8);

    if (local.length > 0 || trimmed.length < 3 || isGuideOutOfScope(trimmed)) {
      return { hits: local, source: "local" };
    }

    const aiResult = await this.chat(trimmed, pathname, role);
    const aiHits = guideResultToSearchHits(aiResult, 6);
    if (aiHits.length === 0) {
      return { hits: local, source: "local" };
    }

    const hint =
      aiResult.type === "answer" || aiResult.type === "unknown"
        ? aiResult.reply.slice(0, 160)
        : aiResult.type === "suggest"
          ? aiResult.reply
          : undefined;

    return { hits: aiHits, source: "ai", hint };
  }

  async chat(
    message: string,
    pathname: string,
    role: JwtRole | null,
    history?: GuideHistoryTurn[],
  ): Promise<GuideChatResponse> {
    if (history?.length) {
      const followUp = resolveGuideFollowUp(message, history, { role, pathname });
      if (followUp) return { ...followUp, engine: "local" };
    }

    if (isGuideOutOfScope(message)) {
      return { ...guideOutOfScopeResult(role), engine: "local" };
    }

    const llmResult = await this.llm.complete(message, pathname, role, history);
    if (llmResult) {
      return { ...llmResult, engine: "llm" };
    }

    return {
      ...queryGuide(message, { role, pathname, history }),
      engine: "local",
    };
  }
}
