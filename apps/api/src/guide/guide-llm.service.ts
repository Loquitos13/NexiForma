import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  buildGuideLlmContext,
  buildGuideLlmSystemPrompt,
  buildGuideLlmUserPrompt,
  canAccessDestination,
  findGuideDestinationByHref,
  type GuideHistoryTurn,
  type GuideResult,
  type JwtRole,
} from "@nexiforma/shared";

type LlmJson = { reply?: string; navigate?: string | null };

@Injectable()
export class GuideLlmService {
  private readonly logger = new Logger(GuideLlmService.name);
  private readonly enabled: boolean;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(private readonly config: ConfigService) {
    this.enabled = this.config.get<string>("NEXIGUIA_LLM_ENABLED") === "true";
    this.baseUrl = (this.config.get<string>("NEXIGUIA_LLM_URL") ?? "http://127.0.0.1:11434").replace(
      /\/$/,
      "",
    );
    this.model = this.config.get<string>("NEXIGUIA_LLM_MODEL") ?? "qwen2.5:3b-instruct";
    this.timeoutMs = Number(this.config.get<string>("NEXIGUIA_LLM_TIMEOUT_MS") ?? "15000");
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async complete(
    message: string,
    pathname: string,
    role: JwtRole | null,
    history?: GuideHistoryTurn[],
  ): Promise<GuideResult | null> {
    if (!this.enabled) return null;

    const ctx = buildGuideLlmContext(message, role, pathname);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          stream: false,
          format: "json",
          messages: [
            { role: "system", content: buildGuideLlmSystemPrompt() },
            { role: "user", content: buildGuideLlmUserPrompt(message, ctx, history) },
          ],
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        this.logger.warn(`LLM HTTP ${res.status}`);
        return null;
      }

      const data = (await res.json()) as { message?: { content?: string } };
      const raw = data.message?.content?.trim();
      if (!raw) return null;

      const parsed = this.parseJson(raw);
      if (!parsed?.reply?.trim()) return null;

      return this.toGuideResult(parsed, role);
    } catch (err) {
      this.logger.warn(`LLM indisponível: ${err instanceof Error ? err.message : "erro"}`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  private parseJson(raw: string): LlmJson | null {
    try {
      return JSON.parse(raw) as LlmJson;
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) return null;
      try {
        return JSON.parse(match[0]) as LlmJson;
      } catch {
        return null;
      }
    }
  }

  private toGuideResult(output: LlmJson, role: JwtRole | null): GuideResult {
    const reply = output.reply!.trim();
    const navigate = typeof output.navigate === "string" ? output.navigate.trim() : null;

    if (navigate) {
      const dest = findGuideDestinationByHref(navigate);
      if (dest && canAccessDestination(dest, role)) {
        return {
          type: "navigate",
          href: dest.href,
          label: dest.label,
          description: dest.description,
          confidence: 0.85,
          reply,
        };
      }
    }

    return { type: "answer", reply, related: [] };
  }
}
