import { Injectable } from "@nestjs/common";
import {
  guideOutOfScopeResult,
  guideResultToSearchHits,
  isGuideOutOfScope,
  isPortalPathAllowedByEntitlements,
  isPortalPathAllowedByRole,
  queryGuide,
  resolveGuideFollowUp,
  searchGuideDestinations,
  type GuideHistoryTurn,
  type GuideResult,
  type GuideSearchHit,
  type JwtRole,
  type TenantEntitlements,
} from "@nexiforma/shared";
import type { RequestUser } from "../auth/types/access-token-payload";
import { GuideLlmService } from "./guide-llm.service";
import { PortalEntitySearchService } from "./portal-entity-search.service";

export type GuideChatResponse = GuideResult & { engine: "llm" | "local" };

export type GuideSearchResponse = {
  hits: GuideSearchHit[];
  source: "local" | "ai";
  hint?: string;
};

@Injectable()
export class GuideService {
  constructor(
    private readonly llm: GuideLlmService,
    private readonly entities: PortalEntitySearchService,
  ) {}

  private filterSearchHits(
    hits: GuideSearchHit[],
    role: JwtRole | null,
    entitlements?: TenantEntitlements | null,
  ): GuideSearchHit[] {
    if (!role) return hits.filter((h) => h.href.startsWith("/#") || h.href === "/login");
    return hits.filter((hit) => {
      const href = hit.href.split("?")[0]!.split("#")[0]!;
      if (!href.startsWith("/portal") && !href.startsWith("/plataforma")) return true;
      if (!isPortalPathAllowedByRole(href, role)) return false;
      if (entitlements && !isPortalPathAllowedByEntitlements(href, entitlements, role)) {
        return false;
      }
      return true;
    });
  }

  async search(
    query: string,
    pathname: string,
    role: JwtRole | null,
    entitlements?: TenantEntitlements | null,
    user?: RequestUser | null,
  ): Promise<GuideSearchResponse> {
    const trimmed = query.trim();
    const ctx = { role, pathname, entitlements };
    const entityHits = this.filterSearchHits(
      await this.entities.search(user, trimmed),
      role,
      entitlements,
    );
    const local = searchGuideDestinations(trimmed, ctx, trimmed ? 6 : 8).map((h) => ({
      ...h,
      kind: h.kind ?? ("funcionalidade" as const),
      category: h.category ?? "Funcionalidade",
    }));

    // Registos concretos primeiro; funcionalidades a seguir.
    const mergedLocal = this.filterSearchHits(
      [...entityHits, ...local],
      role,
      entitlements,
    ).slice(0, 14);

    if (entityHits.length > 0 || local.length > 0 || trimmed.length < 3 || isGuideOutOfScope(trimmed)) {
      return { hits: mergedLocal, source: "local" };
    }

    const aiResult = await this.chat(trimmed, pathname, role, undefined, entitlements);
    const aiHits = this.filterSearchHits(
      guideResultToSearchHits(aiResult, 6).map((h) => ({
        ...h,
        kind: h.kind ?? ("funcionalidade" as const),
        category: h.category ?? "Funcionalidade",
      })),
      role,
      entitlements,
    );
    if (aiHits.length === 0) {
      return { hits: mergedLocal, source: "local" };
    }

    const hint =
      aiResult.type === "answer" || aiResult.type === "unknown"
        ? aiResult.reply.slice(0, 160)
        : aiResult.type === "suggest"
          ? aiResult.reply
          : undefined;

    return {
      hits: this.filterSearchHits([...entityHits, ...aiHits], role, entitlements).slice(0, 14),
      source: "ai",
      hint,
    };
  }

  async chat(
    message: string,
    pathname: string,
    role: JwtRole | null,
    history?: GuideHistoryTurn[],
    entitlements?: TenantEntitlements | null,
  ): Promise<GuideChatResponse> {
    const ctx = { role, pathname, history, entitlements };
    if (history?.length) {
      const followUp = resolveGuideFollowUp(message, history, ctx);
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
      ...queryGuide(message, ctx),
      engine: "local",
    };
  }
}
