import { createHmac, timingSafeEqual } from "node:crypto";

function assinatura(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function gerarTokenRespostaProposta(
  secret: string,
  propostaId: string,
  tenantId: string,
  expiresAt: Date,
): string {
  const payload = `${propostaId}.${tenantId}.${Math.floor(expiresAt.getTime() / 1000)}`;
  return `${Buffer.from(payload, "utf8").toString("base64url")}.${assinatura(secret, payload)}`;
}

export function validarTokenRespostaProposta(
  secret: string,
  token: string,
): { propostaId: string; tenantId: string } {
  const parts = token.split(".");
  if (parts.length !== 2) {
    throw new Error("Token inválido.");
  }

  const [encoded, sig] = parts;
  const payload = Buffer.from(encoded!, "base64url").toString("utf8");
  const expected = assinatura(secret, payload);

  const sigBuf = Buffer.from(sig!, "utf8");
  const expBuf = Buffer.from(expected, "utf8");
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    throw new Error("Token inválido.");
  }

  const [propostaId, tenantId, expStr] = payload.split(".");
  if (!propostaId || !tenantId || !expStr) {
    throw new Error("Token inválido.");
  }

  const exp = Number.parseInt(expStr, 10);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) {
    throw new Error("Link expirado.");
  }

  return { propostaId, tenantId };
}
