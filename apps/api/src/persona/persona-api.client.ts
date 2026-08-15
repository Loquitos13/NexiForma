import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/** Erro upstream da API Persona (status HTTP + mensagem legível). */
export class PersonaApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "PersonaApiError";
  }
}

export type PersonaJsonApiResource = {
  id?: string;
  type?: string;
  attributes?: Record<string, unknown>;
};

export type PersonaInquiryPayload = {
  inquiryId: string;
  sessionToken: string | null;
  status: string;
  included: PersonaJsonApiResource[];
};

@Injectable()
export class PersonaApiClient {
  private readonly logger = new Logger(PersonaApiClient.name);

  constructor(private readonly config: ConfigService) {}

  isEnabled(): boolean {
    return Boolean(this.config.get<string>("PERSONA_API_KEY")?.trim());
  }

  templateIdForRole(role: "formando" | "formador"): string | null {
    const key =
      role === "formando" ? "PERSONA_TEMPLATE_ID_FORMANDO" : "PERSONA_TEMPLATE_ID_FORMADOR";
    return this.config.get<string>(key)?.trim() || null;
  }

  private apiKey(): string {
    const key = this.config.get<string>("PERSONA_API_KEY")?.trim();
    if (!key) throw new Error("PERSONA_API_KEY em falta.");
    return key;
  }

  private apiVersion(): string {
    return this.config.get<string>("PERSONA_API_VERSION")?.trim() || "2023-01-05";
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `https://api.withpersona.com/api/v1${path}`;
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.apiKey()}`,
        "Persona-Version": this.apiVersion(),
        Accept: "application/json",
        ...(init?.headers ?? {}),
      },
    });
    const text = await res.text();
    if (!res.ok) {
      this.logger.warn(`Persona API ${path} → ${res.status}: ${text.slice(0, 400)}`);
      throw new PersonaApiError(res.status, parsePersonaErrorMessage(text, res.status));
    }
    return JSON.parse(text) as T;
  }

  async createInquiry(templateId: string, referenceId: string): Promise<PersonaInquiryPayload> {
    const body = {
      data: {
        attributes: {
          "inquiry-template-id": templateId,
        },
      },
      meta: {
        "auto-create-inquiry-session": true,
        "auto-create-account-reference-id": referenceId,
      },
    };
    const json = await this.request<{
      data?: PersonaJsonApiResource;
      meta?: Record<string, string>;
      included?: PersonaJsonApiResource[];
    }>("/inquiries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const inquiryId = json.data?.id;
    if (!inquiryId) throw new Error("Persona não devolveu inquiry id.");
    const sessionToken =
      json.meta?.["session-token"] ?? json.meta?.sessionToken ?? null;
    const status = String(json.data?.attributes?.status ?? "created");
    return {
      inquiryId,
      sessionToken,
      status,
      included: json.included ?? [],
    };
  }

  async retrieveInquiry(inquiryId: string): Promise<PersonaInquiryPayload> {
    const json = await this.request<{
      data?: PersonaJsonApiResource;
      meta?: Record<string, string>;
      included?: PersonaJsonApiResource[];
    }>(
      `/inquiries/${encodeURIComponent(inquiryId)}?include=verifications,documents`,
    );
    if (!json.data?.id) throw new Error("Inquiry Persona não encontrada.");
    return {
      inquiryId: json.data.id,
      sessionToken: json.meta?.["session-token"] ?? null,
      status: String(json.data.attributes?.status ?? "unknown"),
      included: json.included ?? [],
    };
  }

  async retrieveGovernmentIdVerification(
    verificationId: string,
  ): Promise<PersonaJsonApiResource> {
    const json = await this.request<{ data?: PersonaJsonApiResource }>(
      `/verification/government-ids/${encodeURIComponent(verificationId)}`,
    );
    if (!json.data?.id) throw new Error("Verificação government-id Persona não encontrada.");
    return json.data;
  }

  async downloadFile(url: string): Promise<{ buffer: Buffer; contentType: string }> {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Falha ao descarregar ficheiro Persona (${res.status})`);
    }
    const arrayBuffer = await res.arrayBuffer();
    const contentType =
      res.headers.get("content-type")?.split(";")[0]?.trim() || guessMimeFromUrl(url);
    return { buffer: Buffer.from(arrayBuffer), contentType };
  }
}

function parsePersonaErrorMessage(text: string, status: number): string {
  try {
    const json = JSON.parse(text) as {
      errors?: Array<{ title?: string; detail?: string; description?: string }>;
      message?: string;
    };
    const first = json.errors?.[0];
    const detail = first?.detail ?? first?.description ?? first?.title ?? json.message;
    if (detail && typeof detail === "string") return detail;
  } catch {
    /* resposta não-JSON */
  }
  return `Persona API error (${status})`;
}

function guessMimeFromUrl(url: string): string {
  const lower = url.split("?")[0]?.toLowerCase() ?? "";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".heic")) return "image/heic";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return "image/jpeg";
}
