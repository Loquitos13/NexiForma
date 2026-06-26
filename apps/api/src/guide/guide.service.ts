import { Injectable } from "@nestjs/common";
import {
  guideOutOfScopeResult,
  isGuideOutOfScope,
  queryGuide,
  resolveGuideFollowUp,
  type GuideHistoryTurn,
  type GuideResult,
  type JwtRole,
} from "@nexiforma/shared";
import { GuideLlmService } from "./guide-llm.service";

export type GuideChatResponse = GuideResult & { engine: "llm" | "local" };

@Injectable()
export class GuideService {
  constructor(private readonly llm: GuideLlmService) {}

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
