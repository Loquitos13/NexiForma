/**
 * TTL do token opaco / link público de verificação de certificado.
 * Default 365 dias; 0 = sem expiração (não recomendado em produção).
 */
export function resolveCertificadoVerificacaoTtlDays(
  raw: string | null | undefined,
): number {
  if (raw == null || String(raw).trim() === "") return 365;
  const n = Number.parseInt(String(raw).trim(), 10);
  if (!Number.isFinite(n) || n < 0) return 365;
  return n;
}

export function computeCertificadoTokenExpiresAt(
  from: Date,
  ttlDays: number,
): Date | null {
  if (ttlDays <= 0) return null;
  const expires = new Date(from);
  expires.setUTCDate(expires.getUTCDate() + ttlDays);
  return expires;
}

/** true se o link já expirou (null tokenExpiresAt → calcula a partir de emitidoEm + ttl). */
export function isCertificadoTokenExpired(opts: {
  emitidoEm: Date;
  tokenExpiresAt: Date | null | undefined;
  ttlDays: number;
  now?: Date;
}): boolean {
  if (opts.ttlDays <= 0) return false;
  const now = opts.now ?? new Date();
  const expires =
    opts.tokenExpiresAt ?? computeCertificadoTokenExpiresAt(opts.emitidoEm, opts.ttlDays);
  if (!expires) return false;
  return expires.getTime() <= now.getTime();
}
