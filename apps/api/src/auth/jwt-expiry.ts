/** Converte `15m`, `900`, `900s`, `1h`, `7d` em segundos (access / refresh TTL). */
export function parseJwtExpirySeconds(value: string): number {
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed);
  }
  if (/^\d+s$/i.test(trimmed)) {
    return Number(trimmed.replace(/s$/i, ""));
  }
  const mMatch = trimmed.match(/^(\d+)m$/i);
  if (mMatch) {
    return Number(mMatch[1]) * 60;
  }
  const hMatch = trimmed.match(/^(\d+)h$/i);
  if (hMatch) {
    return Number(hMatch[1]) * 3600;
  }
  const dMatch = trimmed.match(/^(\d+)d$/i);
  if (dMatch) {
    return Number(dMatch[1]) * 86400;
  }
  return 900;
}
