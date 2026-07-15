import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class CrmLlmService {
  private readonly logger = new Logger(CrmLlmService.name);
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
    this.timeoutMs = Number(this.config.get<string>("NEXIGUIA_LLM_TIMEOUT_MS") ?? "25000");
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async completeJson(system: string, user: string): Promise<unknown | null> {
    if (!this.enabled) return null;

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
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        this.logger.warn(`CRM LLM HTTP ${res.status}`);
        return null;
      }

      const data = (await res.json()) as { message?: { content?: string } };
      const raw = data.message?.content?.trim();
      if (!raw) return null;

      return this.parseJson(raw);
    } catch (err) {
      this.logger.warn(
        `CRM LLM indisponível: ${err instanceof Error ? err.message : "erro"}`,
      );
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  private parseJson(raw: string): unknown | null {
    try {
      return JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) return null;
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
  }
}
