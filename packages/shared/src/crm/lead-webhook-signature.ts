import { createHmac, timingSafeEqual } from "crypto";

/** Versão actual do esquema HMAC para webhooks inbound de leads. */
export const CRM_LEAD_WEBHOOK_SIGNATURE_VERSION = "2";

export type LeadWebhookSignInput = {
  empresaNome: string;
  contactoNome?: string | null;
  email?: string | null;
  telefone?: string | null;
  nif?: string | null;
  origem?: string | null;
  valorEstimadoCentavos?: number | null;
  notas?: string | null;
  customFields?: Record<string, unknown> | null;
};

/** Payload canónico v2 - todos os campos do lead, ordem fixa. */
export function buildLeadWebhookSignPayload(input: LeadWebhookSignInput): string {
  const canonical = {
    v: CRM_LEAD_WEBHOOK_SIGNATURE_VERSION,
    empresaNome: input.empresaNome?.trim() ?? "",
    contactoNome: input.contactoNome?.trim() ?? "",
    email: input.email?.trim().toLowerCase() ?? "",
    telefone: input.telefone?.trim() ?? "",
    nif: input.nif?.replace(/\D/g, "") ?? "",
    origem: input.origem ?? "",
    valorEstimadoCentavos: input.valorEstimadoCentavos ?? 0,
    notas: input.notas?.trim() ?? "",
    customFields: input.customFields ?? {},
  };
  return JSON.stringify(canonical);
}

export function signLeadWebhookPayload(secret: string, input: LeadWebhookSignInput): string {
  const body = buildLeadWebhookSignPayload(input);
  return createHmac("sha256", secret).update(body).digest("hex");
}

/** v1 legado: empresaNome|email|telefone (compatibilidade durante transição). */
export function signLeadWebhookPayloadV1(
  secret: string,
  empresaNome: string,
  email?: string | null,
  telefone?: string | null,
): string {
  const payload = `${empresaNome}|${email ?? ""}|${telefone ?? ""}`;
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function verifyLeadWebhookSignature(
  secret: string,
  signatureHeader: string | undefined,
  input: LeadWebhookSignInput,
): boolean {
  const provided = signatureHeader?.replace(/^sha256=/i, "").trim() ?? "";
  if (!provided) return false;
  const v2 = signLeadWebhookPayload(secret, input);
  if (timingSafeHexEqual(provided, v2)) return true;
  const v1 = signLeadWebhookPayloadV1(secret, input.empresaNome, input.email, input.telefone);
  return timingSafeHexEqual(provided, v1);
}

function timingSafeHexEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
